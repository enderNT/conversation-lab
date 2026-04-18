"use server";

import {
  CaseReviewStatus,
  CaseStatus,
  DerivedExampleStatus,
  GenerationMode,
  MessageRole,
  Prisma,
  RelationType,
  TaskType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buildProjectionStatus,
  buildSourceMetadata,
  deriveLastUserMessage,
  parseLooseJsonValue,
  parseStrictJsonValue,
  splitTextareaList,
  toConversationSlice,
  validateDerivedExample,
} from "@/lib/cases";
import {
  generateAssistantReply,
  normalizeChatBaseUrl,
  testChatConnection as testOpenAIChatConnection,
} from "@/lib/openai";
import type { ActionFormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { ARTIFACT_TYPES, TASK_TYPES } from "@/lib/types";
import { asOptionalString } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  description: z.string().trim().default(""),
});

const sessionSchema = z.object({
  title: z.string().trim().optional().default(""),
});

const chatTurnSchema = z.object({
  text: z.string().trim().min(1, "El mensaje no puede estar vacío"),
});

const sessionMessageEditSchema = z.object({
  messageId: z.string().trim().min(1, "El mensaje no es válido."),
  text: z.string().trim().min(1, "El mensaje no puede estar vacío"),
});

const sessionPromptSchema = z.object({
  systemPrompt: z.string().default(""),
});

const sessionNotesSchema = z.object({
  curationNotes: z.string().default(""),
});

const sessionChatSettingsSchema = z.object({
  chatModel: z.string().trim().default(""),
  chatBaseUrl: z.string().default(""),
  chatApiKey: z.string().default(""),
});

const llmConfigurationSchema = z.object({
  name: z.string().trim().min(1, "Asigna un nombre para identificar la configuración."),
  chatModel: z.string().trim().min(1, "Define un modelo para la configuración."),
  chatBaseUrl: z.string().default(""),
  chatApiKey: z.string().default(""),
  systemPrompt: z.string().default(""),
});

const sessionTagSchema = z.object({
  name: z.string().trim().min(1, "Asigna un nombre para la etiqueta."),
});

const caseSchema = z.object({
  title: z.string().trim().optional().default(""),
  sourceSummary: z.string().trim().default(""),
  lastUserMessage: z.string().trim().default(""),
  mainIntent: z.string().trim().default(""),
  whyThisCaseIsUseful: z.string().trim().default(""),
  ambiguityLevel: z.string().trim().default(""),
  difficultyLevel: z.string().trim().default(""),
  interpretationNotes: z.string().trim().default(""),
  status: z.nativeEnum(CaseStatus),
  reviewStatus: z.nativeEnum(CaseReviewStatus),
  updatedBy: z.string().trim().default("human"),
});

const taskSchemaFieldSchema = z.object({
  key: z.string().trim().min(1),
  type: z.enum(["string", "string[]", "boolean", "json", "conversation_turns", "string_or_none"]),
  required: z.boolean(),
  description: z.string().trim().default(""),
});

const taskSpecSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9_]+$/),
  description: z.string().trim().default(""),
  taskType: z.enum(TASK_TYPES),
  inputSchemaJson: z.string().trim().default("[]"),
  outputSchemaJson: z.string().trim().default("[]"),
  requiredArtifacts: z.string().trim().default(""),
  optionalArtifacts: z.string().trim().default(""),
  validationRulesJson: z.string().trim().default("{}"),
  exportShapeJson: z.string().trim().default("{}"),
  version: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  updatedBy: z.string().trim().default("human"),
});

const derivedExampleSchema = z.object({
  taskSpecId: z.string().trim().min(1),
  title: z.string().trim().optional().default(""),
  inputPayloadJson: z.string().trim().min(2),
  outputPayloadJson: z.string().trim().min(2),
  generationMode: z.nativeEnum(GenerationMode),
  reviewStatus: z.nativeEnum(DerivedExampleStatus),
  usedArtifactsJson: z.string().trim().default("[]"),
  updatedBy: z.string().trim().default("human"),
  relatedDerivedExampleId: z.string().trim().default(""),
  relationType: z.nativeEnum(RelationType).optional(),
  relationNotes: z.string().trim().default(""),
});

function buildActionErrorState(message: string): ActionFormState {
  return {
    status: "error",
    message,
    eventId: Date.now(),
    redirectTo: null,
    navigationMode: null,
    shouldRefresh: false,
  };
}

function buildActionSuccessState(
  message: string,
  options?: {
    redirectTo?: string;
    navigationMode?: "push" | "replace";
  },
): ActionFormState {
  return {
    status: "success",
    message,
    eventId: Date.now(),
    redirectTo: options?.redirectTo ?? null,
    navigationMode: options?.navigationMode ?? null,
    shouldRefresh: options?.redirectTo ? false : false,
  };
}

function buildActionRefreshSuccessState(message: string): ActionFormState {
  return {
    status: "success",
    message,
    eventId: Date.now(),
    redirectTo: null,
    navigationMode: null,
    shouldRefresh: true,
  };
}

function getActionErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallbackMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function parseTaskSchemaText(value: string) {
  const parsedValue = JSON.parse(value) as unknown;

  return z.array(taskSchemaFieldSchema).parse(parsedValue);
}

function parseArtifactList(value: string) {
  return splitTextareaList(value).filter((item): item is (typeof ARTIFACT_TYPES)[number] =>
    ARTIFACT_TYPES.includes(item as (typeof ARTIFACT_TYPES)[number]),
  );
}

function extractCaseArtifacts(
  formData: FormData,
): Prisma.CaseArtifactCreateWithoutCaseInput[] {
  return ARTIFACT_TYPES.reduce<Prisma.CaseArtifactCreateWithoutCaseInput[]>((accumulator, artifactType) => {
    const value = asOptionalString(formData.get(`${artifactType}__value`));
    const notes = asOptionalString(formData.get(`${artifactType}__notes`));
    const confidenceRaw = asOptionalString(formData.get(`${artifactType}__confidence`));
    const provenance = asOptionalString(formData.get(`${artifactType}__provenance`));
    const confidence = confidenceRaw ? Number.parseFloat(confidenceRaw) : null;

    if (!value) {
      return accumulator;
    }

    const parsedValue = parseLooseJsonValue(value);
    const parsedProvenance = provenance ? parseLooseJsonValue(provenance) : undefined;

    if (parsedValue === null) {
      return accumulator;
    }

    accumulator.push({
      type: artifactType,
      valueJson: parsedValue as Prisma.InputJsonValue,
      notes: notes || null,
      confidence: Number.isFinite(confidence) ? confidence : null,
      provenanceJson: parsedProvenance as Prisma.InputJsonValue | undefined,
    });

    return accumulator;
  }, []);
}

function extractCaseInterpretation(formData: FormData) {
  return {
    main_intent: asOptionalString(formData.get("mainIntent")),
    subtask_candidates: splitTextareaList(
      asOptionalString(formData.get("subtaskCandidates")),
    ),
    why_this_case_is_useful: asOptionalString(formData.get("whyThisCaseIsUseful")),
    ambiguity_level: asOptionalString(formData.get("ambiguityLevel")),
    difficulty_level: asOptionalString(formData.get("difficultyLevel")),
    notes: asOptionalString(formData.get("interpretationNotes")),
    llm_errors_detected: splitTextareaList(
      asOptionalString(formData.get("llmErrorsDetected")),
    ),
  };
}

function extractTaskCandidateIds(formData: FormData) {
  return formData
    .getAll("taskCandidateIds")
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function revalidateCasePaths(projectId: string, sessionId: string, caseId?: string) {
  revalidatePath("/");
  revalidatePath("/cases");
  revalidatePath("/tasks");
  revalidatePath("/exports");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
  }
}

function normalizeLlmConfigurationInput(input: z.infer<typeof llmConfigurationSchema>) {
  return {
    name: input.name.trim(),
    chatModel: input.chatModel.trim(),
    chatBaseUrl: normalizeChatBaseUrl(input.chatBaseUrl),
    chatApiKey: input.chatApiKey.trim() || null,
    systemPrompt: input.systemPrompt.trim() || null,
  };
}

export async function createProject(formData: FormData) {
  const parsed = projectSchema.parse({
    name: asOptionalString(formData.get("name")),
    description: asOptionalString(formData.get("description")),
  });

  const project = await prisma.project.create({
    data: parsed,
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function createProjectWithFeedback(
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = projectSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    description: asOptionalString(formData.get("description")),
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "El nombre es obligatorio."));
  }

  let projectId = "";

  try {
    const project = await prisma.project.create({
      data: parsed.data,
    });

    projectId = project.id;
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible crear el proyecto."),
    );
  }

  revalidatePath("/");
  return buildActionSuccessState("Proyecto creado correctamente.", {
    redirectTo: `/projects/${projectId}`,
    navigationMode: "push",
  });
}

export async function createSession(projectId: string, formData: FormData) {
  const parsed = sessionSchema.parse({
    title: asOptionalString(formData.get("title")),
  });

  const session = await prisma.session.create({
    data: {
      projectId,
      title: parsed.title || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/sessions/${session.id}`);
}

export async function createSessionWithFeedback(
  projectId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = sessionSchema.safeParse({
    title: asOptionalString(formData.get("title")),
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible crear la sesión."));
  }

  let sessionId = "";

  try {
    const session = await prisma.session.create({
      data: {
        projectId,
        title: parsed.data.title || null,
      },
    });

    sessionId = session.id;
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible crear la sesión."),
    );
  }

  revalidatePath(`/projects/${projectId}`);
  return buildActionSuccessState("Sesión creada correctamente.", {
    redirectTo: `/projects/${projectId}/sessions/${sessionId}`,
    navigationMode: "push",
  });
}

export async function createLlmConfigurationWithFeedback(
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = llmConfigurationSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    chatModel: asOptionalString(formData.get("chatModel")),
    chatBaseUrl: asOptionalString(formData.get("chatBaseUrl")),
    chatApiKey: asOptionalString(formData.get("chatApiKey")),
    systemPrompt: asOptionalString(formData.get("systemPrompt")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible guardar la configuración LLM."),
    );
  }

  try {
    const normalized = normalizeLlmConfigurationInput(parsed.data);

    await prisma.llmConfiguration.create({
      data: normalized,
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar la configuración LLM."),
    );
  }

  revalidatePath("/");

  return buildActionRefreshSuccessState("Configuración LLM guardada correctamente.");
}

export async function updateLlmConfigurationWithFeedback(
  configurationId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = llmConfigurationSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    chatModel: asOptionalString(formData.get("chatModel")),
    chatBaseUrl: asOptionalString(formData.get("chatBaseUrl")),
    chatApiKey: asOptionalString(formData.get("chatApiKey")),
    systemPrompt: asOptionalString(formData.get("systemPrompt")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible actualizar la configuración LLM."),
    );
  }

  try {
    const normalized = normalizeLlmConfigurationInput(parsed.data);

    await prisma.llmConfiguration.update({
      where: { id: configurationId },
      data: normalized,
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar la configuración LLM."),
    );
  }

  revalidatePath("/");

  return buildActionRefreshSuccessState("Configuración LLM actualizada correctamente.");
}

export async function deleteLlmConfigurationWithFeedback(
  configurationId: string,
  _previousState: ActionFormState,
) {
  void _previousState;

  try {
    await prisma.llmConfiguration.delete({
      where: { id: configurationId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar la configuración LLM."),
    );
  }

  revalidatePath("/");

  return buildActionRefreshSuccessState("Configuración LLM eliminada correctamente.");
}

export async function createLlmConfiguration(input: {
  name: string;
  chatModel: string;
  chatBaseUrl: string;
  chatApiKey: string;
  systemPrompt: string;
}) {
  const parsed = llmConfigurationSchema.parse({
    name: input.name,
    chatModel: input.chatModel,
    chatBaseUrl: input.chatBaseUrl,
    chatApiKey: input.chatApiKey,
    systemPrompt: input.systemPrompt,
  });

  try {
    const normalized = normalizeLlmConfigurationInput(parsed);

    await prisma.llmConfiguration.create({
      data: normalized,
    });
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible guardar la configuración LLM.",
    };
  }

  revalidatePath("/");

  return {
    ok: true as const,
  };
}

export async function createSessionTagWithFeedback(
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = sessionTagSchema.safeParse({
    name: asOptionalString(formData.get("name")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible guardar la etiqueta."),
    );
  }

  try {
    await prisma.sessionTag.create({
      data: {
        name: parsed.data.name.trim(),
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar la etiqueta."),
    );
  }

  revalidatePath("/session-tags");

  return buildActionRefreshSuccessState("Etiqueta guardada correctamente.");
}

export async function updateSessionTagWithFeedback(
  tagId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = sessionTagSchema.safeParse({
    name: asOptionalString(formData.get("name")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible actualizar la etiqueta."),
    );
  }

  try {
    await prisma.sessionTag.update({
      where: { id: tagId },
      data: {
        name: parsed.data.name.trim(),
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar la etiqueta."),
    );
  }

  revalidatePath("/session-tags");

  return buildActionRefreshSuccessState("Etiqueta actualizada correctamente.");
}

export async function deleteSessionTagWithFeedback(
  tagId: string,
  _previousState: ActionFormState,
) {
  void _previousState;

  try {
    await prisma.sessionTag.delete({
      where: { id: tagId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar la etiqueta."),
    );
  }

  revalidatePath("/session-tags");
  revalidatePath("/");

  return buildActionRefreshSuccessState("Etiqueta eliminada correctamente.");
}

export async function assignSessionTagToSession(
  projectId: string,
  sessionId: string,
  tagId: string,
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    await prisma.sessionTagOnSession.upsert({
      where: {
        sessionId_tagId: {
          sessionId,
          tagId,
        },
      },
      update: {},
      create: {
        sessionId,
        tagId,
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible asignar la etiqueta a la sesión.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function removeSessionTagFromSession(
  projectId: string,
  sessionId: string,
  tagId: string,
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    await prisma.sessionTagOnSession.delete({
      where: {
        sessionId_tagId: {
          sessionId,
          tagId,
        },
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible remover la etiqueta de la sesión.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function createSessionTagAndAssign(
  projectId: string,
  sessionId: string,
  input: { name: string },
) {
  const parsed = sessionTagSchema.parse({
    name: input.name,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    const normalizedName = parsed.name.trim();
    let tag = await prisma.sessionTag.findUnique({
      where: { name: normalizedName },
      select: { id: true, name: true },
    });

    if (!tag) {
      tag = await prisma.sessionTag.create({
        data: { name: normalizedName },
        select: { id: true, name: true },
      });
    }

    await prisma.sessionTagOnSession.upsert({
      where: {
        sessionId_tagId: {
          sessionId,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        sessionId,
        tagId: tag.id,
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible crear o asignar la etiqueta.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);
  revalidatePath("/session-tags");

  return {
    ok: true as const,
  };
}

export async function sendSessionMessage(
  projectId: string,
  sessionId: string,
  input: { text: string },
) {
  const parsed = chatTurnSchema.parse({
    text: input.text,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
      systemPrompt: true,
      chatModel: true,
      chatBaseUrl: true,
      chatApiKey: true,
      chatConnectionVerifiedAt: true,
      messages: {
        orderBy: { orderIndex: "asc" },
        select: {
          role: true,
          text: true,
        },
      },
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  if (!session.chatModel?.trim()) {
    return {
      ok: false as const,
      error: "Define un modelo y prueba la conexión antes de usar el chat.",
    };
  }

  if (!session.chatConnectionVerifiedAt) {
    return {
      ok: false as const,
      error: "La conexión del chat todavía no fue verificada para este modelo.",
    };
  }

  try {
    const assistantReply = await generateAssistantReply({
      model: session.chatModel,
      baseUrl: session.chatBaseUrl,
      apiKey: session.chatApiKey,
      systemPrompt: session.systemPrompt,
      messages: [
        ...session.messages.map((message) => ({
          role: message.role,
          text: message.text,
        })),
        {
          role: MessageRole.user,
          text: parsed.text,
        },
      ],
    });

    await prisma.$transaction(async (tx) => {
      const lastMessage = await tx.message.findFirst({
        where: { sessionId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });

      const nextOrderIndex = (lastMessage?.orderIndex ?? -1) + 1;

      await tx.message.create({
        data: {
          sessionId,
          role: MessageRole.user,
          text: parsed.text,
          orderIndex: nextOrderIndex,
          metadataJson: {
            source: "session_chat",
          },
        },
      });

      await tx.message.create({
        data: {
          sessionId,
          role: MessageRole.assistant,
          text: assistantReply.text,
          orderIndex: nextOrderIndex + 1,
          metadataJson: {
            source: "openai_compatible",
            model: assistantReply.model,
            response_id: assistantReply.responseId,
          },
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible obtener una respuesta del modelo.";

    return {
      ok: false as const,
      error: message,
    };
  }

  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function updateSessionMessage(
  projectId: string,
  sessionId: string,
  input: { messageId: string; text: string },
) {
  const parsed = sessionMessageEditSchema.parse(input);

  const sessionMessage = await prisma.message.findUnique({
    where: { id: parsed.messageId },
    select: {
      id: true,
      sessionId: true,
      text: true,
      metadataJson: true,
      session: {
        select: {
          projectId: true,
        },
      },
    },
  });

  if (
    !sessionMessage ||
    sessionMessage.sessionId !== sessionId ||
    sessionMessage.session.projectId !== projectId
  ) {
    return {
      ok: false as const,
      error: "El mensaje no existe o no pertenece a esta sesión.",
    };
  }

  const currentMetadata =
    sessionMessage.metadataJson &&
    typeof sessionMessage.metadataJson === "object" &&
    !Array.isArray(sessionMessage.metadataJson)
      ? { ...(sessionMessage.metadataJson as Prisma.JsonObject) }
      : {};

  if (parsed.text === sessionMessage.text) {
    return {
      ok: true as const,
      message: {
        id: sessionMessage.id,
        text: sessionMessage.text,
        editedAt:
          typeof currentMetadata.editedAt === "string" ? currentMetadata.editedAt : null,
      },
    };
  }

  const editedAt = new Date().toISOString();
  const nextMetadata: Prisma.InputJsonValue = {
    ...currentMetadata,
    editedAt,
    originalText:
      typeof currentMetadata.originalText === "string"
        ? currentMetadata.originalText
        : sessionMessage.text,
  };

  await prisma.message.update({
    where: { id: parsed.messageId },
    data: {
      text: parsed.text,
      metadataJson: nextMetadata,
    },
  });

  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
    message: {
      id: parsed.messageId,
      text: parsed.text,
      editedAt,
    },
  };
}

export async function clearSessionChat(projectId: string, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  if (session._count.messages === 0) {
    return {
      ok: true as const,
      clearedMessages: 0,
      message: "La sesión ya estaba vacía.",
    };
  }

  try {
    const result = await prisma.message.deleteMany({
      where: { sessionId },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

    return {
      ok: true as const,
      clearedMessages: result.count,
      message:
        result.count === 1
          ? "Se eliminó 1 mensaje de la conversación."
          : `Se eliminaron ${result.count} mensajes de la conversación.`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible limpiar la conversación de la sesión.";

    return {
      ok: false as const,
      error: message,
    };
  }
}

export async function deleteSession(projectId: string, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
      _count: {
        select: {
          messages: true,
          cases: true,
        },
      },
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    await prisma.session.delete({
      where: { id: sessionId },
    });

    revalidatePath("/");
    revalidatePath("/cases");
    revalidatePath("/tasks");
    revalidatePath("/exports");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

    return {
      ok: true as const,
      redirectTo: `/projects/${projectId}`,
      deletedMessages: session._count.messages,
      deletedCases: session._count.cases,
      message:
        session._count.cases > 0
          ? `La sesión y sus ${session._count.cases} caso(s) asociados fueron eliminados.`
          : "La sesión fue eliminada correctamente.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible eliminar la sesión.";

    return {
      ok: false as const,
      error: message,
    };
  }
}

export async function updateSessionChatModel(
  projectId: string,
  sessionId: string,
  input: { chatModel: string; chatBaseUrl: string; chatApiKey: string },
) {
  const parsed = sessionChatSettingsSchema.parse({
    chatModel: input.chatModel,
    chatBaseUrl: input.chatBaseUrl,
    chatApiKey: input.chatApiKey,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    const normalizedModel = parsed.chatModel.trim();
    const normalizedBaseUrl = normalizeChatBaseUrl(parsed.chatBaseUrl);
    const normalizedApiKey = parsed.chatApiKey.trim();

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        chatModel: normalizedModel || null,
        chatBaseUrl: normalizedBaseUrl,
        chatApiKey: normalizedApiKey,
        chatConnectionCheckedAt: null,
        chatConnectionVerifiedAt: null,
        chatConnectionError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible guardar el modelo del chat.";

    return {
      ok: false as const,
      error: message,
    };
  }

  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function verifySessionChatConnection(
  projectId: string,
  sessionId: string,
  input: { chatModel: string; chatBaseUrl: string; chatApiKey: string },
) {
  const parsed = sessionChatSettingsSchema.parse({
    chatModel: input.chatModel,
    chatBaseUrl: input.chatBaseUrl,
    chatApiKey: input.chatApiKey,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  const normalizedModel = parsed.chatModel.trim();
  const checkedAt = new Date();
  let normalizedBaseUrl: string | null = null;
  let normalizedApiKey: string | null = null;

  try {
    if (!normalizedModel) {
      throw new Error("Define un modelo antes de probar la conexión.");
    }

    normalizedBaseUrl = normalizeChatBaseUrl(parsed.chatBaseUrl);
    normalizedApiKey = parsed.chatApiKey.trim();
    const result = await testOpenAIChatConnection({
      model: normalizedModel,
      baseUrl: normalizedBaseUrl,
      apiKey: normalizedApiKey,
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        chatModel: normalizedModel,
        chatBaseUrl: normalizedBaseUrl,
        chatApiKey: normalizedApiKey,
        chatConnectionCheckedAt: checkedAt,
        chatConnectionVerifiedAt: checkedAt,
        chatConnectionError: null,
      },
    });

    revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

    return {
      ok: true as const,
      message:
        result.listedModels.length > 0
          ? `Conexión verificada. El modelo \"${normalizedModel}\" está disponible.`
          : `Conexión verificada para el modelo \"${normalizedModel}\".`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible verificar la conexión con el proveedor del chat.";

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        chatModel: normalizedModel,
        chatBaseUrl: normalizedBaseUrl,
        chatApiKey: normalizedApiKey,
        chatConnectionCheckedAt: checkedAt,
        chatConnectionVerifiedAt: null,
        chatConnectionError: message,
      },
    });

    revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

    return {
      ok: false as const,
      error: message,
    };
  }
}

export async function updateSessionSystemPrompt(
  projectId: string,
  sessionId: string,
  input: { systemPrompt: string },
) {
  const parsed = sessionPromptSchema.parse({
    systemPrompt: input.systemPrompt,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    const normalizedPrompt = parsed.systemPrompt.trim();

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        systemPrompt: normalizedPrompt || null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible actualizar el prompt de comportamiento.";

    return {
      ok: false as const,
      error: message,
    };
  }

  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function updateSessionNotes(
  projectId: string,
  sessionId: string,
  input: { curationNotes: string },
) {
  const parsed = sessionNotesSchema.parse({
    curationNotes: input.curationNotes,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    const normalizedNotes = parsed.curationNotes.trim();

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        curationNotes: normalizedNotes || null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible actualizar las notas del chat.";

    return {
      ok: false as const,
      error: message,
    };
  }

  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function createCase(
  projectId: string,
  sessionId: string,
  formData: FormData,
) {
  const startOrderIndex = Number.parseInt(String(formData.get("startOrderIndex") ?? ""), 10);
  const endOrderIndex = Number.parseInt(String(formData.get("endOrderIndex") ?? ""), 10);

  if (
    !Number.isInteger(startOrderIndex) ||
    !Number.isInteger(endOrderIndex) ||
    startOrderIndex > endOrderIndex
  ) {
    throw new Error("La selección de mensajes no es válida.");
  }

  const [selectedMessages, contextMessages, session] = await Promise.all([
    prisma.message.findMany({
      where: {
        sessionId,
        orderIndex: {
          gte: startOrderIndex,
          lte: endOrderIndex,
        },
      },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.message.findMany({
      where: {
        sessionId,
        orderIndex: {
          gte: Math.max(0, startOrderIndex - 2),
          lte: endOrderIndex + 2,
        },
      },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        projectId: true,
        curationNotes: true,
      },
    }),
  ]);

  if (!session || session.projectId !== projectId) {
    throw new Error("La sesión no existe o no pertenece al proyecto indicado.");
  }

  if (selectedMessages.length !== endOrderIndex - startOrderIndex + 1) {
    throw new Error("La selección debe ser consecutiva.");
  }

  const conversationSlice = toConversationSlice(selectedMessages);
  const surroundingContext = toConversationSlice(
    contextMessages.filter(
      (message) =>
        message.orderIndex < startOrderIndex || message.orderIndex > endOrderIndex,
    ),
  );
  const parsed = caseSchema.parse({
    title: asOptionalString(formData.get("title")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    lastUserMessage:
      asOptionalString(formData.get("lastUserMessage")) ||
      deriveLastUserMessage(conversationSlice),
    mainIntent: asOptionalString(formData.get("mainIntent")),
    whyThisCaseIsUseful: asOptionalString(formData.get("whyThisCaseIsUseful")),
    ambiguityLevel: asOptionalString(formData.get("ambiguityLevel")),
    difficultyLevel: asOptionalString(formData.get("difficultyLevel")),
    interpretationNotes: asOptionalString(formData.get("interpretationNotes")),
    status: formData.get("status"),
    reviewStatus: formData.get("reviewStatus"),
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });
  const taskCandidateIds = extractTaskCandidateIds(formData);
  const artifacts = extractCaseArtifacts(formData);
  const interpretation = extractCaseInterpretation(formData);

  const createdCase = await prisma.case.create({
    data: {
      projectId,
      sessionId,
      title: parsed.title || null,
      conversationSliceJson: conversationSlice,
      sourceContextJson: surroundingContext,
      selectedTurnIdsJson: selectedMessages.map((message) => message.id),
      sourceSummary: parsed.sourceSummary,
      lastUserMessage: parsed.lastUserMessage,
      interpretationJson: interpretation,
      sourceMetadataJson: buildSourceMetadata({
        projectId,
        sessionId,
        sessionNotes: session.curationNotes,
        selectedTurnIds: selectedMessages.map((message) => message.id),
        startOrderIndex,
        endOrderIndex,
      }),
      taskCandidatesJson: taskCandidateIds,
      projectionStatus: buildProjectionStatus(taskCandidateIds, 0),
      reviewStatus: parsed.reviewStatus,
      status: parsed.status,
      createdBy: "human",
      updatedBy: parsed.updatedBy,
      artifacts: {
        create: artifacts,
      },
    },
  });

  revalidateCasePaths(projectId, sessionId, createdCase.id);
  redirect(`/cases/${createdCase.id}`);
}

export async function createCaseWithFeedback(
  projectId: string,
  sessionId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const startOrderIndex = Number.parseInt(String(formData.get("startOrderIndex") ?? ""), 10);
  const endOrderIndex = Number.parseInt(String(formData.get("endOrderIndex") ?? ""), 10);

  if (
    !Number.isInteger(startOrderIndex) ||
    !Number.isInteger(endOrderIndex) ||
    startOrderIndex > endOrderIndex
  ) {
    return buildActionErrorState("La selección de mensajes no es válida.");
  }

  let selectedMessages;
  let contextMessages;
  let session;

  try {
    [selectedMessages, contextMessages, session] = await Promise.all([
      prisma.message.findMany({
        where: {
          sessionId,
          orderIndex: {
            gte: startOrderIndex,
            lte: endOrderIndex,
          },
        },
        orderBy: { orderIndex: "asc" },
      }),
      prisma.message.findMany({
        where: {
          sessionId,
          orderIndex: {
            gte: Math.max(0, startOrderIndex - 2),
            lte: endOrderIndex + 2,
          },
        },
        orderBy: { orderIndex: "asc" },
      }),
      prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          projectId: true,
          curationNotes: true,
        },
      }),
    ]);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible cargar la selección del caso."),
    );
  }

  if (!session || session.projectId !== projectId) {
    return buildActionErrorState("La sesión no existe o no pertenece al proyecto indicado.");
  }

  if (selectedMessages.length !== endOrderIndex - startOrderIndex + 1) {
    return buildActionErrorState("La selección debe ser consecutiva.");
  }

  const conversationSlice = toConversationSlice(selectedMessages);
  const surroundingContext = toConversationSlice(
    contextMessages.filter(
      (message) =>
        message.orderIndex < startOrderIndex || message.orderIndex > endOrderIndex,
    ),
  );
  const parsed = caseSchema.safeParse({
    title: asOptionalString(formData.get("title")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    lastUserMessage:
      asOptionalString(formData.get("lastUserMessage")) ||
      deriveLastUserMessage(conversationSlice),
    mainIntent: asOptionalString(formData.get("mainIntent")),
    whyThisCaseIsUseful: asOptionalString(formData.get("whyThisCaseIsUseful")),
    ambiguityLevel: asOptionalString(formData.get("ambiguityLevel")),
    difficultyLevel: asOptionalString(formData.get("difficultyLevel")),
    interpretationNotes: asOptionalString(formData.get("interpretationNotes")),
    status: formData.get("status"),
    reviewStatus: formData.get("reviewStatus"),
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible crear el caso."));
  }

  const taskCandidateIds = extractTaskCandidateIds(formData);
  const artifacts = extractCaseArtifacts(formData);
  const interpretation = extractCaseInterpretation(formData);

  let createdCaseId = "";

  try {
    const createdCase = await prisma.case.create({
      data: {
        projectId,
        sessionId,
        title: parsed.data.title || null,
        conversationSliceJson: conversationSlice,
        sourceContextJson: surroundingContext,
        selectedTurnIdsJson: selectedMessages.map((message) => message.id),
        sourceSummary: parsed.data.sourceSummary,
        lastUserMessage: parsed.data.lastUserMessage,
        interpretationJson: interpretation,
        sourceMetadataJson: buildSourceMetadata({
          projectId,
          sessionId,
          sessionNotes: session.curationNotes,
          selectedTurnIds: selectedMessages.map((message) => message.id),
          startOrderIndex,
          endOrderIndex,
        }),
        taskCandidatesJson: taskCandidateIds,
        projectionStatus: buildProjectionStatus(taskCandidateIds, 0),
        reviewStatus: parsed.data.reviewStatus,
        status: parsed.data.status,
        createdBy: "human",
        updatedBy: parsed.data.updatedBy,
        artifacts: {
          create: artifacts,
        },
      },
    });

    createdCaseId = createdCase.id;
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar el caso."),
    );
  }

  revalidateCasePaths(projectId, sessionId, createdCaseId);
  return buildActionSuccessState("Caso guardado correctamente.", {
    redirectTo: `/cases/${createdCaseId}`,
    navigationMode: "push",
  });
}

export async function updateCase(caseId: string, formData: FormData) {
  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      projectId: true,
      sessionId: true,
      derivedExamples: {
        select: { id: true },
      },
    },
  });

  if (!existingCase) {
    throw new Error("El caso no existe.");
  }

  const parsed = caseSchema.parse({
    title: asOptionalString(formData.get("title")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    lastUserMessage: asOptionalString(formData.get("lastUserMessage")),
    mainIntent: asOptionalString(formData.get("mainIntent")),
    whyThisCaseIsUseful: asOptionalString(formData.get("whyThisCaseIsUseful")),
    ambiguityLevel: asOptionalString(formData.get("ambiguityLevel")),
    difficultyLevel: asOptionalString(formData.get("difficultyLevel")),
    interpretationNotes: asOptionalString(formData.get("interpretationNotes")),
    status: formData.get("status"),
    reviewStatus: formData.get("reviewStatus"),
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });
  const taskCandidateIds = extractTaskCandidateIds(formData);
  const artifacts = extractCaseArtifacts(formData);
  const interpretation = extractCaseInterpretation(formData);

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: {
        title: parsed.title || null,
        sourceSummary: parsed.sourceSummary,
        lastUserMessage: parsed.lastUserMessage,
        interpretationJson: interpretation,
        taskCandidatesJson: taskCandidateIds,
        projectionStatus: buildProjectionStatus(
          taskCandidateIds,
          existingCase.derivedExamples.length,
        ),
        reviewStatus: parsed.reviewStatus,
        status: parsed.status,
        updatedBy: parsed.updatedBy,
      },
    });

    await tx.caseArtifact.deleteMany({
      where: { caseId },
    });

    for (const artifact of artifacts) {
      await tx.caseArtifact.create({
        data: {
          caseId,
          ...artifact,
        },
      });
    }
  });

  revalidateCasePaths(existingCase.projectId, existingCase.sessionId, caseId);
  redirect(`/cases/${caseId}`);
}

export async function updateCaseWithFeedback(
  caseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  let existingCase;

  try {
    existingCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        projectId: true,
        sessionId: true,
        derivedExamples: {
          select: { id: true },
        },
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible cargar el caso."),
    );
  }

  if (!existingCase) {
    return buildActionErrorState("El caso no existe.");
  }

  const parsed = caseSchema.safeParse({
    title: asOptionalString(formData.get("title")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    lastUserMessage: asOptionalString(formData.get("lastUserMessage")),
    mainIntent: asOptionalString(formData.get("mainIntent")),
    whyThisCaseIsUseful: asOptionalString(formData.get("whyThisCaseIsUseful")),
    ambiguityLevel: asOptionalString(formData.get("ambiguityLevel")),
    difficultyLevel: asOptionalString(formData.get("difficultyLevel")),
    interpretationNotes: asOptionalString(formData.get("interpretationNotes")),
    status: formData.get("status"),
    reviewStatus: formData.get("reviewStatus"),
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el caso."));
  }

  const taskCandidateIds = extractTaskCandidateIds(formData);
  const artifacts = extractCaseArtifacts(formData);
  const interpretation = extractCaseInterpretation(formData);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.case.update({
        where: { id: caseId },
        data: {
          title: parsed.data.title || null,
          sourceSummary: parsed.data.sourceSummary,
          lastUserMessage: parsed.data.lastUserMessage,
          interpretationJson: interpretation,
          taskCandidatesJson: taskCandidateIds,
          projectionStatus: buildProjectionStatus(
            taskCandidateIds,
            existingCase.derivedExamples.length,
          ),
          reviewStatus: parsed.data.reviewStatus,
          status: parsed.data.status,
          updatedBy: parsed.data.updatedBy,
        },
      });

      await tx.caseArtifact.deleteMany({
        where: { caseId },
      });

      for (const artifact of artifacts) {
        await tx.caseArtifact.create({
          data: {
            caseId,
            ...artifact,
          },
        });
      }
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el caso."),
    );
  }

  revalidateCasePaths(existingCase.projectId, existingCase.sessionId, caseId);
  return buildActionSuccessState("Caso actualizado correctamente.", {
    redirectTo: `/cases/${caseId}`,
    navigationMode: "replace",
  });
}

export async function updateCaseStatus(caseId: string, formData: FormData) {
  const parsed = z
    .object({
      status: z.nativeEnum(CaseStatus),
    })
    .parse({
      status: formData.get("status"),
    });

  const caseRecord = await prisma.case.update({
    where: { id: caseId },
    data: {
      status: parsed.status,
    },
    select: {
      id: true,
      projectId: true,
      sessionId: true,
    },
  });

  revalidateCasePaths(caseRecord.projectId, caseRecord.sessionId, caseRecord.id);
}

export async function updateCaseStatusWithFeedback(
  caseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = z
    .object({
      status: z.nativeEnum(CaseStatus),
    })
    .safeParse({
      status: formData.get("status"),
    });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el status del caso."));
  }

  let caseRecord;

  try {
    caseRecord = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: parsed.data.status,
      },
      select: {
        id: true,
        projectId: true,
        sessionId: true,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el status del caso."),
    );
  }

  revalidateCasePaths(caseRecord.projectId, caseRecord.sessionId, caseRecord.id);
  return buildActionRefreshSuccessState("Status del caso actualizado correctamente.");
}

export async function createTaskSpec(formData: FormData) {
  const parsed = taskSpecSchema.parse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    taskType: formData.get("taskType") || TaskType.custom,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    requiredArtifacts: asOptionalString(formData.get("requiredArtifacts")),
    optionalArtifacts: asOptionalString(formData.get("optionalArtifacts")),
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportShapeJson: asOptionalString(formData.get("exportShapeJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  await prisma.taskSpec.create({
    data: {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      taskType: parsed.taskType,
      inputSchemaJson: parseTaskSchemaText(parsed.inputSchemaJson),
      outputSchemaJson: parseTaskSchemaText(parsed.outputSchemaJson),
      requiredArtifactsJson: parseArtifactList(parsed.requiredArtifacts),
      optionalArtifactsJson: parseArtifactList(parsed.optionalArtifacts),
      validationRulesJson: parseStrictJsonValue(parsed.validationRulesJson) as Prisma.InputJsonValue,
      exportShapeJson: parseStrictJsonValue(parsed.exportShapeJson) as Prisma.InputJsonValue,
      isActive: parsed.isActive,
      version: parsed.version,
      createdBy: parsed.updatedBy,
      updatedBy: parsed.updatedBy,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/cases");
  redirect("/tasks");
}

export async function createTaskSpecWithFeedback(
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = taskSpecSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    taskType: formData.get("taskType") || TaskType.custom,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    requiredArtifacts: asOptionalString(formData.get("requiredArtifacts")),
    optionalArtifacts: asOptionalString(formData.get("optionalArtifacts")),
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportShapeJson: asOptionalString(formData.get("exportShapeJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible crear el task spec."));
  }

  try {
    await prisma.taskSpec.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        taskType: parsed.data.taskType,
        inputSchemaJson: parseTaskSchemaText(parsed.data.inputSchemaJson),
        outputSchemaJson: parseTaskSchemaText(parsed.data.outputSchemaJson),
        requiredArtifactsJson: parseArtifactList(parsed.data.requiredArtifacts),
        optionalArtifactsJson: parseArtifactList(parsed.data.optionalArtifacts),
        validationRulesJson: parseStrictJsonValue(parsed.data.validationRulesJson) as Prisma.InputJsonValue,
        exportShapeJson: parseStrictJsonValue(parsed.data.exportShapeJson) as Prisma.InputJsonValue,
        isActive: parsed.data.isActive,
        version: parsed.data.version,
        createdBy: parsed.data.updatedBy,
        updatedBy: parsed.data.updatedBy,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible crear el task spec."),
    );
  }

  revalidatePath("/tasks");
  revalidatePath("/cases");
  revalidatePath("/exports");
  return buildActionRefreshSuccessState("Task spec creado correctamente.");
}

export async function updateTaskSpec(taskSpecId: string, formData: FormData) {
  const parsed = taskSpecSchema.parse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    taskType: formData.get("taskType") || TaskType.custom,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    requiredArtifacts: asOptionalString(formData.get("requiredArtifacts")),
    optionalArtifacts: asOptionalString(formData.get("optionalArtifacts")),
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportShapeJson: asOptionalString(formData.get("exportShapeJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  await prisma.taskSpec.update({
    where: { id: taskSpecId },
    data: {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      taskType: parsed.taskType,
      inputSchemaJson: parseTaskSchemaText(parsed.inputSchemaJson),
      outputSchemaJson: parseTaskSchemaText(parsed.outputSchemaJson),
      requiredArtifactsJson: parseArtifactList(parsed.requiredArtifacts),
      optionalArtifactsJson: parseArtifactList(parsed.optionalArtifacts),
      validationRulesJson: parseStrictJsonValue(parsed.validationRulesJson) as Prisma.InputJsonValue,
      exportShapeJson: parseStrictJsonValue(parsed.exportShapeJson) as Prisma.InputJsonValue,
      isActive: parsed.isActive,
      version: parsed.version,
      updatedBy: parsed.updatedBy,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/cases");
  revalidatePath("/exports");
  redirect("/tasks");
}

export async function updateTaskSpecWithFeedback(
  taskSpecId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = taskSpecSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    taskType: formData.get("taskType") || TaskType.custom,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    requiredArtifacts: asOptionalString(formData.get("requiredArtifacts")),
    optionalArtifacts: asOptionalString(formData.get("optionalArtifacts")),
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportShapeJson: asOptionalString(formData.get("exportShapeJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el task spec."));
  }

  try {
    await prisma.taskSpec.update({
      where: { id: taskSpecId },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        taskType: parsed.data.taskType,
        inputSchemaJson: parseTaskSchemaText(parsed.data.inputSchemaJson),
        outputSchemaJson: parseTaskSchemaText(parsed.data.outputSchemaJson),
        requiredArtifactsJson: parseArtifactList(parsed.data.requiredArtifacts),
        optionalArtifactsJson: parseArtifactList(parsed.data.optionalArtifacts),
        validationRulesJson: parseStrictJsonValue(parsed.data.validationRulesJson) as Prisma.InputJsonValue,
        exportShapeJson: parseStrictJsonValue(parsed.data.exportShapeJson) as Prisma.InputJsonValue,
        isActive: parsed.data.isActive,
        version: parsed.data.version,
        updatedBy: parsed.data.updatedBy,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el task spec."),
    );
  }

  revalidatePath("/tasks");
  revalidatePath("/cases");
  revalidatePath("/exports");
  return buildActionRefreshSuccessState("Task spec actualizado correctamente.");
}

export async function deleteTaskSpecWithFeedback(
  taskSpecId: string,
  previousState: ActionFormState,
) {
  void previousState;

  try {
    const taskSpec = await prisma.taskSpec.findUnique({
      where: { id: taskSpecId },
      select: {
        name: true,
        _count: {
          select: {
            derivedExamples: true,
          },
        },
      },
    });

    if (!taskSpec) {
      return buildActionErrorState("El task spec ya no existe.");
    }

    if (taskSpec._count.derivedExamples > 0) {
      return buildActionErrorState(
        `No se puede eliminar ${taskSpec.name} porque ya tiene derived examples asociados.`,
      );
    }

    await prisma.taskSpec.delete({
      where: { id: taskSpecId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar el task spec."),
    );
  }

  revalidatePath("/tasks");
  revalidatePath("/cases");
  revalidatePath("/exports");
  return buildActionRefreshSuccessState("Task spec eliminado correctamente.");
}

export async function createDerivedExample(caseId: string, formData: FormData) {
  const parsed = derivedExampleSchema.parse({
    taskSpecId: asOptionalString(formData.get("taskSpecId")),
    title: asOptionalString(formData.get("title")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    generationMode: formData.get("generationMode") || GenerationMode.assisted,
    reviewStatus: formData.get("reviewStatus") || DerivedExampleStatus.generated,
    usedArtifactsJson: asOptionalString(formData.get("usedArtifactsJson")) || "[]",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
    relatedDerivedExampleId: asOptionalString(formData.get("relatedDerivedExampleId")),
    relationType: formData.get("relationType") || undefined,
    relationNotes: asOptionalString(formData.get("relationNotes")),
  });

  const [caseRecord, taskSpec] = await Promise.all([
    prisma.case.findUnique({
      where: { id: caseId },
      include: {
        artifacts: true,
      },
    }),
    prisma.taskSpec.findUnique({
      where: { id: parsed.taskSpecId },
    }),
  ]);

  if (!caseRecord || !taskSpec) {
    throw new Error("El caso o el task spec no existen.");
  }

  const inputPayload = parseStrictJsonValue(parsed.inputPayloadJson);
  const outputPayload = parseStrictJsonValue(parsed.outputPayloadJson);

  if (
    typeof inputPayload !== "object" ||
    inputPayload === null ||
    Array.isArray(inputPayload) ||
    typeof outputPayload !== "object" ||
    outputPayload === null ||
    Array.isArray(outputPayload)
  ) {
    throw new Error("Los payloads de entrada y salida deben ser objetos JSON.");
  }

  const validationState = validateDerivedExample({
    taskSpec,
    inputPayload: inputPayload as Record<string, Prisma.JsonValue>,
    outputPayload: outputPayload as Record<string, Prisma.JsonValue>,
    caseArtifacts: caseRecord.artifacts,
  });

  const usedArtifacts = parseArtifactList(parsed.usedArtifactsJson);
  const createdExample = await prisma.$transaction(async (tx) => {
    const derivedExample = await tx.derivedExample.create({
      data: {
        caseId,
        taskSpecId: taskSpec.id,
        title: parsed.title || null,
        inputPayloadJson: inputPayload as Prisma.InputJsonValue,
        outputPayloadJson: outputPayload as Prisma.InputJsonValue,
        generationMode: parsed.generationMode,
        reviewStatus: parsed.reviewStatus,
        validationStateJson: validationState as Prisma.InputJsonValue,
        provenanceJson: {
          source_case_id: caseRecord.id,
          source_session_id: caseRecord.sessionId,
          source_selected_turn_ids: caseRecord.selectedTurnIdsJson,
          used_artifacts: usedArtifacts,
          edited_by: parsed.updatedBy,
          generation_mode: parsed.generationMode,
          task_spec_version: taskSpec.version,
        } as Prisma.InputJsonValue,
        version: taskSpec.version,
        createdBy: parsed.updatedBy,
        updatedBy: parsed.updatedBy,
      },
    });

    if (parsed.relatedDerivedExampleId && parsed.relationType) {
      await tx.projectionRelation.create({
        data: {
          fromDerivedExampleId: parsed.relatedDerivedExampleId,
          toDerivedExampleId: derivedExample.id,
          relationType: parsed.relationType,
          notes: parsed.relationNotes || null,
        },
      });
    }

    await tx.case.update({
      where: { id: caseId },
      data: {
        projectionStatus: "projected",
        updatedBy: parsed.updatedBy,
      },
    });

    return derivedExample;
  });

  revalidateCasePaths(caseRecord.projectId, caseRecord.sessionId, caseId);
  redirect(`/cases/${caseId}?taskSpecId=${createdExample.taskSpecId}`);
}

export async function createDerivedExampleWithFeedback(
  caseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = derivedExampleSchema.safeParse({
    taskSpecId: asOptionalString(formData.get("taskSpecId")),
    title: asOptionalString(formData.get("title")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    generationMode: formData.get("generationMode") || GenerationMode.assisted,
    reviewStatus: formData.get("reviewStatus") || DerivedExampleStatus.generated,
    usedArtifactsJson: asOptionalString(formData.get("usedArtifactsJson")) || "[]",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
    relatedDerivedExampleId: asOptionalString(formData.get("relatedDerivedExampleId")),
    relationType: formData.get("relationType") || undefined,
    relationNotes: asOptionalString(formData.get("relationNotes")),
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible guardar el derived example."));
  }

  let caseRecord;
  let taskSpec;

  try {
    [caseRecord, taskSpec] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        include: {
          artifacts: true,
        },
      }),
      prisma.taskSpec.findUnique({
        where: { id: parsed.data.taskSpecId },
      }),
    ]);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible preparar el derived example."),
    );
  }

  if (!caseRecord || !taskSpec) {
    return buildActionErrorState("El caso o el task spec no existen.");
  }

  let inputPayload;
  let outputPayload;

  try {
    inputPayload = parseStrictJsonValue(parsed.data.inputPayloadJson);
    outputPayload = parseStrictJsonValue(parsed.data.outputPayloadJson);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "Los payloads deben ser JSON válidos."),
    );
  }

  if (
    typeof inputPayload !== "object" ||
    inputPayload === null ||
    Array.isArray(inputPayload) ||
    typeof outputPayload !== "object" ||
    outputPayload === null ||
    Array.isArray(outputPayload)
  ) {
    return buildActionErrorState("Los payloads de entrada y salida deben ser objetos JSON.");
  }

  const validationState = validateDerivedExample({
    taskSpec,
    inputPayload: inputPayload as Record<string, Prisma.JsonValue>,
    outputPayload: outputPayload as Record<string, Prisma.JsonValue>,
    caseArtifacts: caseRecord.artifacts,
  });

  const usedArtifacts = parseArtifactList(parsed.data.usedArtifactsJson);
  let createdTaskSpecId = taskSpec.id;

  try {
    const createdExample = await prisma.$transaction(async (tx) => {
      const derivedExample = await tx.derivedExample.create({
        data: {
          caseId,
          taskSpecId: taskSpec.id,
          title: parsed.data.title || null,
          inputPayloadJson: inputPayload as Prisma.InputJsonValue,
          outputPayloadJson: outputPayload as Prisma.InputJsonValue,
          generationMode: parsed.data.generationMode,
          reviewStatus: parsed.data.reviewStatus,
          validationStateJson: validationState as Prisma.InputJsonValue,
          provenanceJson: {
            source_case_id: caseRecord.id,
            source_session_id: caseRecord.sessionId,
            source_selected_turn_ids: caseRecord.selectedTurnIdsJson,
            used_artifacts: usedArtifacts,
            edited_by: parsed.data.updatedBy,
            generation_mode: parsed.data.generationMode,
            task_spec_version: taskSpec.version,
          } as Prisma.InputJsonValue,
          version: taskSpec.version,
          createdBy: parsed.data.updatedBy,
          updatedBy: parsed.data.updatedBy,
        },
      });

      if (parsed.data.relatedDerivedExampleId && parsed.data.relationType) {
        await tx.projectionRelation.create({
          data: {
            fromDerivedExampleId: parsed.data.relatedDerivedExampleId,
            toDerivedExampleId: derivedExample.id,
            relationType: parsed.data.relationType,
            notes: parsed.data.relationNotes || null,
          },
        });
      }

      await tx.case.update({
        where: { id: caseId },
        data: {
          projectionStatus: "projected",
          updatedBy: parsed.data.updatedBy,
        },
      });

      return derivedExample;
    });

    createdTaskSpecId = createdExample.taskSpecId;
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar el derived example."),
    );
  }

  revalidateCasePaths(caseRecord.projectId, caseRecord.sessionId, caseId);
  return buildActionSuccessState("Derived example guardado correctamente.", {
    redirectTo: `/cases/${caseId}?taskSpecId=${createdTaskSpecId}`,
    navigationMode: "replace",
  });
}

export async function updateDerivedExampleReviewStatus(
  derivedExampleId: string,
  formData: FormData,
) {
  const parsed = z
    .object({
      reviewStatus: z.nativeEnum(DerivedExampleStatus),
    })
    .parse({
      reviewStatus: formData.get("reviewStatus"),
    });

  const derivedExample = await prisma.derivedExample.update({
    where: { id: derivedExampleId },
    data: {
      reviewStatus: parsed.reviewStatus,
    },
    include: {
      case: {
        select: {
          id: true,
          projectId: true,
          sessionId: true,
        },
      },
    },
  });

  revalidateCasePaths(
    derivedExample.case.projectId,
    derivedExample.case.sessionId,
    derivedExample.case.id,
  );
}

export async function updateDerivedExampleReviewStatusWithFeedback(
  derivedExampleId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = z
    .object({
      reviewStatus: z.nativeEnum(DerivedExampleStatus),
    })
    .safeParse({
      reviewStatus: formData.get("reviewStatus"),
    });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el review status."));
  }

  let derivedExample;

  try {
    derivedExample = await prisma.derivedExample.update({
      where: { id: derivedExampleId },
      data: {
        reviewStatus: parsed.data.reviewStatus,
      },
      include: {
        case: {
          select: {
            id: true,
            projectId: true,
            sessionId: true,
          },
        },
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el review status."),
    );
  }

  revalidateCasePaths(
    derivedExample.case.projectId,
    derivedExample.case.sessionId,
    derivedExample.case.id,
  );
  return buildActionRefreshSuccessState("Review status actualizado correctamente.");
}

export async function createProjectionRelation(caseId: string, formData: FormData) {
  const parsed = z
    .object({
      fromDerivedExampleId: z.string().trim().min(1),
      toDerivedExampleId: z.string().trim().min(1),
      relationType: z.nativeEnum(RelationType),
      notes: z.string().trim().default(""),
    })
    .parse({
      fromDerivedExampleId: asOptionalString(formData.get("fromDerivedExampleId")),
      toDerivedExampleId: asOptionalString(formData.get("toDerivedExampleId")),
      relationType: formData.get("relationType"),
      notes: asOptionalString(formData.get("notes")),
    });

  if (parsed.fromDerivedExampleId === parsed.toDerivedExampleId) {
    throw new Error("La relación debe conectar dos derived examples distintos.");
  }

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      projectId: true,
      sessionId: true,
    },
  });

  if (!caseRecord) {
    throw new Error("El caso no existe.");
  }

  await prisma.projectionRelation.create({
    data: {
      fromDerivedExampleId: parsed.fromDerivedExampleId,
      toDerivedExampleId: parsed.toDerivedExampleId,
      relationType: parsed.relationType,
      notes: parsed.notes || null,
    },
  });

  revalidateCasePaths(caseRecord.projectId, caseRecord.sessionId, caseId);
  redirect(`/cases/${caseId}`);
}

export async function createProjectionRelationWithFeedback(
  caseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = z
    .object({
      fromDerivedExampleId: z.string().trim().min(1),
      toDerivedExampleId: z.string().trim().min(1),
      relationType: z.nativeEnum(RelationType),
      notes: z.string().trim().default(""),
    })
    .safeParse({
      fromDerivedExampleId: asOptionalString(formData.get("fromDerivedExampleId")),
      toDerivedExampleId: asOptionalString(formData.get("toDerivedExampleId")),
      relationType: formData.get("relationType"),
      notes: asOptionalString(formData.get("notes")),
    });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible crear la relación."));
  }

  if (parsed.data.fromDerivedExampleId === parsed.data.toDerivedExampleId) {
    return buildActionErrorState("La relación debe conectar dos derived examples distintos.");
  }

  let caseRecord;

  try {
    caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        projectId: true,
        sessionId: true,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible cargar el caso."),
    );
  }

  if (!caseRecord) {
    return buildActionErrorState("El caso no existe.");
  }

  try {
    await prisma.projectionRelation.create({
      data: {
        fromDerivedExampleId: parsed.data.fromDerivedExampleId,
        toDerivedExampleId: parsed.data.toDerivedExampleId,
        relationType: parsed.data.relationType,
        notes: parsed.data.notes || null,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible crear la relación."),
    );
  }

  revalidateCasePaths(caseRecord.projectId, caseRecord.sessionId, caseId);
  return buildActionSuccessState("Relación creada correctamente.", {
    redirectTo: `/cases/${caseId}`,
    navigationMode: "replace",
  });
}
