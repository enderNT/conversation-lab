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
import { generateAssistantReply } from "@/lib/openai";
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

  try {
    const assistantReply = await generateAssistantReply([
      ...session.messages.map((message) => ({
        role: message.role,
        text: message.text,
      })),
      {
        role: MessageRole.user,
        text: parsed.text,
      },
    ]);

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
            source: "openai",
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

  const [selectedMessages, contextMessages] = await Promise.all([
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
  ]);

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