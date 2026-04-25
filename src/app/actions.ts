"use server";

import { createHash } from "node:crypto";
import {
  ChatTransport,
  CaseReviewStatus,
  CaseStatus,
  DatasetExampleReviewStatus,
  DatasetFieldSide,
  DatasetFormat,
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
  buildDatasetBatchGenerationPrompt,
  buildDatasetBatchGenerationRequestPreview,
  buildDatasetFieldGenerationPrompt,
  buildDatasetFieldGenerationRequestPreview,
  normalizeDatasetLlmContextSelection,
} from "@/lib/dataset-llm";
import {
  DATASET_IMPORT_SESSION_TITLE,
  buildImportedSourceSliceTitle,
  buildImportedDatasetMappings,
  buildImportedSourceSliceMetadataJson,
  buildImportedSourceSliceRecord,
  buildSourceSliceMetadata,
  canonicalizeJsonValue,
  deriveLastUserMessage as deriveDatasetLastUserMessage,
  normalizeRetrievalTopK,
  parseDatasetSchema,
  parseImportedDatasetText,
  parseStrictJsonValue as parseStrictDatasetJsonValue,
  resolveFieldMapping,
  sourceSliceFromPrisma,
  stringifyJsonValue,
  toConversationSlice as toDatasetConversationSlice,
  toExportDatasetExample,
  validateDatasetExample as validateDatasetExamplePayload,
} from "@/lib/datasets";
import {
  ensureDefaultDatasetSpecs,
  parseDatasetSpecImportBundleText,
} from "@/lib/dataset-specs";
import {
  createEmbedding,
  generateAssistantReply,
  normalizeChatBaseUrl,
  normalizeEmbeddingBaseUrl,
  testChatConnection as testOpenAIChatConnection,
} from "@/lib/openai";
import {
  normalizeQdrantBaseUrl,
  queryQdrantTopPoint,
  testQdrantConnection,
} from "@/lib/qdrant";
import {
  getSessionChatRuntimeConfiguration,
  normalizeWebhookUrl,
  sendWebhookAsyncChatRequest,
} from "@/lib/session-chat";
import type {
  ActionFormState,
  DatasetImportActionState,
  DatasetSpecImportActionState,
} from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import {
  ARTIFACT_TYPES,
  DATASET_EXAMPLE_STATUSES,
  DATASET_FIELD_SIDES,
  DATASET_FORMATS,
  DATASET_MAPPING_SOURCES,
  DATASET_SCHEMA_FIELD_TYPES,
  TASK_TYPES,
  type DatasetImportSummary,
  type DatasetSpecImportSummary,
  type DatasetFieldMappingRecord,
  type DatasetSchemaField,
  type ImportedDatasetRowResult,
  type ImportedDatasetSpecResult,
  type JsonObject,
  type JsonValue,
} from "@/lib/types";
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
  chatTransport: z.enum(["openai_compatible", "webhook_async"]).default("openai_compatible"),
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

const ragConfigurationSchema = z.object({
  name: z.string().trim().min(1, "Asigna un nombre para identificar la configuración."),
  qdrantBaseUrl: z.string().trim().min(1, "Define la URL base de Qdrant."),
  qdrantApiKey: z.string().default(""),
  collectionName: z.string().trim().min(1, "Define la colección a consultar."),
  vectorName: z.string().default(""),
  embeddingBaseUrl: z.string().default(""),
  embeddingApiKey: z.string().default(""),
  embeddingModel: z.string().default(""),
  payloadPath: z.string().default(""),
});

const ragConnectionTestSchema = z.object({
  qdrantBaseUrl: z.string().trim().min(1, "Define la URL base de Qdrant."),
  qdrantApiKey: z.string().default(""),
  collectionName: z.string().trim().min(1, "Define la colección a consultar."),
  vectorName: z.string().default(""),
  embeddingBaseUrl: z.string().default(""),
  embeddingApiKey: z.string().default(""),
  embeddingModel: z.string().default(""),
  payloadPath: z.string().default(""),
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

const datasetSchemaFieldSchema = z.object({
  key: z.string().trim().min(1),
  type: z.enum(DATASET_SCHEMA_FIELD_TYPES),
  required: z.boolean(),
  description: z.string().trim().default(""),
  enumValues: z.array(z.string().trim().min(1)).optional(),
});

const datasetSpecSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9_]+$/),
  description: z.string().trim().default(""),
  datasetFormat: z.enum(DATASET_FORMATS).default("dspy_jsonl"),
  inputSchemaJson: z.string().trim().default("[]"),
  outputSchemaJson: z.string().trim().default("[]"),
  mappingHintsJson: z.string().trim().default("{}"),
  validationRulesJson: z.string().trim().default("{}"),
  exportConfigJson: z.string().trim().default("{}"),
  version: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  updatedBy: z.string().trim().default("human"),
});

const datasetFieldMappingSchema = z.object({
  side: z.enum(DATASET_FIELD_SIDES),
  fieldKey: z.string().trim().min(1),
  sourceKey: z.enum(DATASET_MAPPING_SOURCES),
  sourcePath: z.string().default(""),
  transformChain: z.array(z.string().trim()),
  constantValueText: z.string().default(""),
  manualValueText: z.string().default(""),
  llmConfigurationId: z.string().default(""),
  llmPromptText: z.string().default(""),
  llmContextSelection: z.record(z.string(), z.boolean()).optional(),
  llmGeneratedValueText: z.string().default(""),
  llmGenerationMeta: z.any().optional(),
  ragConfigurationId: z.string().default(""),
  ragPromptText: z.string().default(""),
  ragTopK: z.coerce.number().int().min(1).max(20).default(1),
  ragGeneratedValueText: z.string().default(""),
  ragGenerationMeta: z.any().optional(),
});

const datasetExampleSchema = z.object({
  datasetSpecId: z.string().trim().min(1),
  title: z.string().trim().default(""),
  sourceTitle: z.string().trim().default(""),
  sourceSummary: z.string().trim().default(""),
  inputPayloadJson: z.string().trim().min(2),
  outputPayloadJson: z.string().trim().min(2),
  mappingsJson: z.string().trim().default("[]"),
  reviewStatus: z.enum(DATASET_EXAMPLE_STATUSES).default("draft"),
  updatedBy: z.string().trim().default("human"),
});

const datasetImportSchema = z.object({
  datasetSpecId: z.string().trim().min(1, "Selecciona un dataset spec para importar el archivo."),
  sessionId: z.string().trim().optional(),
});

const datasetExampleSessionLinkSchema = z.object({
  sessionId: z.string().trim().optional(),
});

const datasetFieldGenerationSchema = z.object({
  llmConfigurationId: z.string().trim().min(1, "Selecciona una configuración LLM global."),
  side: z.enum(DATASET_FIELD_SIDES),
  field: datasetSchemaFieldSchema,
  datasetSpecName: z.string().trim().default(""),
  datasetSpecSlug: z.string().trim().default(""),
  datasetSpecDescription: z.string().trim().default(""),
  promptText: z.string().trim().min(1, "Escribe una instrucción para el campo."),
  lastUserMessage: z.string().default(""),
  sourceSummary: z.string().default(""),
  sessionNotes: z.string().default(""),
  conversationSliceJson: z.string().trim().default("[]"),
  surroundingContextJson: z.string().trim().default("[]"),
  inputPayloadJson: z.string().trim().default("{}"),
  outputPayloadJson: z.string().trim().default("{}"),
  llmContextSelection: z.record(z.string(), z.boolean()).optional(),
});

const datasetBatchFieldGenerationSchema = z.object({
  side: z.enum(DATASET_FIELD_SIDES),
  field: datasetSchemaFieldSchema,
});

const datasetBatchGenerationSchema = z.object({
  llmConfigurationId: z.string().trim().min(1, "Selecciona una configuración LLM global."),
  datasetSpecName: z.string().trim().default(""),
  datasetSpecSlug: z.string().trim().default(""),
  datasetSpecDescription: z.string().default(""),
  conversationSliceJson: z.string().trim().default("[]"),
  fields: z.array(datasetBatchFieldGenerationSchema).min(1, "No hay campos para autollenar."),
});

const datasetFieldRagGenerationSchema = z.object({
  ragConfigurationId: z.string().trim().min(1, "Selecciona una configuración de retrieval."),
  promptText: z.string().trim().min(1, "Escribe una query manual."),
  topK: z.coerce.number().int().min(1, "Top K mínimo 1.").max(20, "Top K máximo 20."),
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

const DATASET_SPEC_IMPORT_UPDATED_BY = "import";

function buildDatasetImportState(input: {
  status: "error" | "success";
  message: string;
  summary: DatasetImportSummary | null;
}): DatasetImportActionState {
  return {
    status: input.status,
    message: input.message,
    eventId: Date.now(),
    redirectTo: null,
    navigationMode: null,
    shouldRefresh: false,
    summary: input.summary,
  };
}

function buildDatasetSpecImportState(input: {
  status: "error" | "success";
  message: string;
  summary: DatasetSpecImportSummary | null;
}): DatasetSpecImportActionState {
  return {
    status: input.status,
    message: input.message,
    eventId: Date.now(),
    redirectTo: null,
    navigationMode: null,
    shouldRefresh: false,
    summary: input.summary,
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

function parseDatasetSchemaText(value: string) {
  const parsedValue = JSON.parse(value) as unknown;

  return z.array(datasetSchemaFieldSchema).parse(parsedValue);
}

function parseDatasetMappingsText(value: string) {
  const parsedValue = JSON.parse(value) as unknown;

  return z.array(datasetFieldMappingSchema).parse(parsedValue);
}

function parseDatasetJsonObject(value: string, label: string) {
  const parsedValue = parseStrictDatasetJsonValue(value);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsedValue as JsonObject;
}

function buildDatasetImportFingerprint(input: {
  projectId: string;
  datasetSpecId: string;
  inputPayload: JsonObject;
  outputPayload: JsonObject;
}) {
  return createHash("sha256")
    .update(
      [
        input.projectId,
        input.datasetSpecId,
        canonicalizeJsonValue(input.inputPayload),
        canonicalizeJsonValue(input.outputPayload),
      ].join(":"),
    )
    .digest("hex");
}

function buildDatasetImportValidationMessage(validationState: {
  structuralErrors: string[];
  semanticWarnings: string[];
}) {
  return [...validationState.structuralErrors, ...validationState.semanticWarnings].join(" ");
}

function buildDatasetImportOutcomeMessage(summary: DatasetImportSummary) {
  if (summary.importedCount > 0) {
    return `Importación completada: ${summary.importedCount} importados, ${summary.duplicateCount} duplicados y ${summary.rejectedCount} rechazados.`;
  }

  if (summary.duplicateCount > 0 && summary.rejectedCount === 0) {
    return "No se importaron nuevos dataset examples porque todas las filas ya existían.";
  }

  if (summary.duplicateCount > 0) {
    return `No se importaron nuevos dataset examples. ${summary.duplicateCount} filas ya existían y ${summary.rejectedCount} fueron rechazadas.`;
  }

  return "No se pudo importar ninguna fila válida del archivo.";
}

async function findOrCreateDatasetFallbackSession(projectId: string) {
  const existingSession = await prisma.session.findFirst({
    where: {
      projectId,
      title: DATASET_IMPORT_SESSION_TITLE,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (existingSession) {
    return existingSession.id;
  }

  const createdSession = await prisma.session.create({
    data: {
      projectId,
      title: DATASET_IMPORT_SESSION_TITLE,
      curationNotes: "Sesión auto-creada para centralizar imports JSONL de dataset examples.",
    },
    select: {
      id: true,
    },
  });

  return createdSession.id;
}

async function resolveDatasetTargetSessionId(projectId: string, sessionId?: string) {
  const normalizedSessionId = sessionId?.trim() ?? "";

  if (!normalizedSessionId) {
    return findOrCreateDatasetFallbackSession(projectId);
  }

  const session = await prisma.session.findUnique({
    where: { id: normalizedSessionId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!session || session.projectId !== projectId) {
    throw new Error("La sesión seleccionada no existe o no pertenece a este proyecto.");
  }

  return session.id;
}

function asJsonObjectRecord(value: Prisma.JsonValue | null | undefined) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {} as Record<string, JsonValue>;
  }

  return { ...(value as Record<string, JsonValue>) };
}

function isImportedDatasetExampleProvenance(value: Prisma.JsonValue | null | undefined) {
  const record = asJsonObjectRecord(value);

  return record.import_mode === "jsonl_file";
}

function updateSourceMetadataSessionId(
  value: Prisma.JsonValue | null | undefined,
  sessionId: string,
) {
  return {
    ...asJsonObjectRecord(value),
    session_id: sessionId,
  } as Prisma.InputJsonValue;
}

function updateDatasetExampleProvenanceSessionId(
  value: Prisma.JsonValue | null | undefined,
  sessionId: string,
) {
  return {
    ...asJsonObjectRecord(value),
    source_session_id: sessionId,
  } as Prisma.InputJsonValue;
}

function buildDatasetFieldRagQuery(promptText: string) {
  return promptText.trim();
}

function parseGeneratedDatasetFieldResponse(rawText: string, field: DatasetSchemaField) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("El modelo devolvio una respuesta vacia para este campo.");
  }

  try {
    const parsed = JSON.parse(trimmed) as JsonValue;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      "value" in parsed
    ) {
      const record = parsed as Record<string, JsonValue>;
      const confidence = typeof record.confidence === "number" ? record.confidence : null;
      const notes = typeof record.notes === "string" ? record.notes : "";

      return {
        value: (record.value ?? null) as JsonValue,
        confidence,
        notes,
      };
    }

    return {
      value: parsed,
      confidence: null,
      notes: "",
    };
  } catch {
    if (["string", "datetime", "enum"].includes(field.type)) {
      return {
        value: trimmed,
        confidence: null,
        notes: "",
      };
    }

    throw new Error(
      `El modelo devolvio texto no JSON para ${field.key}. Ajusta la instruccion o usa un campo manual.`,
    );
  }
}

function parseGeneratedDatasetBatchResponse(
  rawText: string,
  requestedFields: Array<{ side: "input" | "output"; field: DatasetSchemaField }>,
) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("El modelo devolvio una respuesta vacia para el autollenado.");
  }

  let parsed: JsonValue;

  try {
    parsed = JSON.parse(trimmed) as JsonValue;
  } catch {
    throw new Error("El modelo devolvio una respuesta no JSON para el autollenado.");
  }

  const rawFields =
    Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          "fields" in parsed &&
          Array.isArray(parsed.fields)
        ? parsed.fields
        : null;

  if (!rawFields) {
    throw new Error("El modelo no devolvio la lista de fields esperada para el autollenado.");
  }

  const requestedKeys = requestedFields.map((item) => `${item.side}:${item.field.key}`);
  const requestedFieldMap = new Map<string, DatasetSchemaField>(
    requestedFields.map((item) => [`${item.side}:${item.field.key}`, item.field]),
  );
  const generatedFieldMap = new Map<
    string,
    {
      side: "input" | "output";
      fieldKey: string;
      value: JsonValue;
      confidence: number | null;
      notes: string;
    }
  >();

  for (const item of rawFields) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, JsonValue>;
    const side = record.side;
    const fieldKey = record.fieldKey;

    if ((side !== "input" && side !== "output") || typeof fieldKey !== "string") {
      continue;
    }

    const requestKey = `${side}:${fieldKey}`;

    if (!requestedFieldMap.has(requestKey)) {
      continue;
    }

    generatedFieldMap.set(requestKey, {
      side,
      fieldKey,
      value: (record.value ?? null) as JsonValue,
      confidence: typeof record.confidence === "number" ? record.confidence : null,
      notes: typeof record.notes === "string" ? record.notes : "",
    });
  }

  return {
    fields: requestedKeys
      .map((key) => generatedFieldMap.get(key))
      .filter(
        (
          item,
        ): item is {
          side: "input" | "output";
          fieldKey: string;
          value: JsonValue;
          confidence: number | null;
          notes: string;
        } => item !== undefined,
      ),
    missingFieldKeys: requestedKeys.filter((key) => !generatedFieldMap.has(key)),
  };
}

function parseArtifactList(value: string) {
  return splitTextareaList(value).filter((item): item is (typeof ARTIFACT_TYPES)[number] =>
    ARTIFACT_TYPES.includes(item as (typeof ARTIFACT_TYPES)[number]),
  );
}

type NormalizedDatasetSpecInput = {
  name: string;
  slug: string;
  description: string;
  datasetFormat: DatasetFormat;
  inputSchemaJson: Prisma.InputJsonValue;
  outputSchemaJson: Prisma.InputJsonValue;
  mappingHintsJson: Prisma.InputJsonValue;
  validationRulesJson: Prisma.InputJsonValue;
  exportConfigJson: Prisma.InputJsonValue;
  version: number;
  isActive: boolean;
  updatedBy: string;
};

function normalizeDatasetSpecInput(input: z.infer<typeof datasetSpecSchema>): NormalizedDatasetSpecInput {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    datasetFormat: input.datasetFormat,
    inputSchemaJson: parseDatasetSchemaText(input.inputSchemaJson) as Prisma.InputJsonValue,
    outputSchemaJson: parseDatasetSchemaText(input.outputSchemaJson) as Prisma.InputJsonValue,
    mappingHintsJson: parseStrictDatasetJsonValue(input.mappingHintsJson) as Prisma.InputJsonValue,
    validationRulesJson: parseStrictDatasetJsonValue(input.validationRulesJson) as Prisma.InputJsonValue,
    exportConfigJson: parseStrictDatasetJsonValue(input.exportConfigJson) as Prisma.InputJsonValue,
    version: input.version,
    isActive: input.isActive,
    updatedBy: input.updatedBy,
  };
}

function stripDatasetSpecVersionSuffix(slug: string) {
  return slug.replace(/_v\d+$/, "");
}

function hasDatasetSpecVersionedChanges(
  currentSpec: {
    name: string;
    slug: string;
    description: string;
    datasetFormat: DatasetFormat;
    inputSchemaJson: Prisma.JsonValue;
    outputSchemaJson: Prisma.JsonValue;
    mappingHintsJson: Prisma.JsonValue;
    validationRulesJson: Prisma.JsonValue;
    exportConfigJson: Prisma.JsonValue;
    version: number;
  },
  nextSpec: NormalizedDatasetSpecInput,
) {
  return JSON.stringify({
    name: currentSpec.name,
    slug: currentSpec.slug,
    description: currentSpec.description,
    datasetFormat: currentSpec.datasetFormat,
    inputSchemaJson: currentSpec.inputSchemaJson,
    outputSchemaJson: currentSpec.outputSchemaJson,
    mappingHintsJson: currentSpec.mappingHintsJson,
    validationRulesJson: currentSpec.validationRulesJson,
    exportConfigJson: currentSpec.exportConfigJson,
    version: currentSpec.version,
  }) !==
    JSON.stringify({
      name: nextSpec.name,
      slug: nextSpec.slug,
      description: nextSpec.description,
      datasetFormat: nextSpec.datasetFormat,
      inputSchemaJson: nextSpec.inputSchemaJson,
      outputSchemaJson: nextSpec.outputSchemaJson,
      mappingHintsJson: nextSpec.mappingHintsJson,
      validationRulesJson: nextSpec.validationRulesJson,
      exportConfigJson: nextSpec.exportConfigJson,
      version: nextSpec.version,
    });
}

async function buildNextDatasetSpecVersionSlug(baseSlug: string, version: number) {
  const normalizedBaseSlug = stripDatasetSpecVersionSuffix(baseSlug);
  let candidateVersion = Math.max(2, version);

  while (true) {
    const candidateSlug = `${normalizedBaseSlug}_v${candidateVersion}`;
    const existing = await prisma.datasetSpec.findUnique({
      where: { slug: candidateSlug },
      select: { id: true },
    });

    if (!existing) {
      return {
        slug: candidateSlug,
        version: candidateVersion,
      };
    }

    candidateVersion += 1;
  }
}

function buildDatasetSpecFamilyFilter(baseSlug: string): Prisma.DatasetSpecWhereInput {
  return {
    OR: [
      { slug: baseSlug },
      { slug: { startsWith: `${baseSlug}_v` } },
    ],
  };
}

function getImportedDatasetSpecDescriptor(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      name: "",
      slug: "",
    };
  }

  const record = input as Record<string, unknown>;

  return {
    name: typeof record.name === "string" ? record.name.trim() : "",
    slug: typeof record.slug === "string" ? record.slug.trim() : "",
  };
}

function buildImportedDatasetSpecCandidate(input: unknown) {
  const record =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    name: typeof record.name === "string" ? record.name : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    description: typeof record.description === "string" ? record.description : "",
    datasetFormat:
      typeof record.datasetFormat === "string" ? record.datasetFormat : DatasetFormat.dspy_jsonl,
    inputSchemaJson: stringifyJsonValue(record.inputSchema ?? []),
    outputSchemaJson: stringifyJsonValue(record.outputSchema ?? []),
    mappingHintsJson: stringifyJsonValue(record.mappingHints ?? {}),
    validationRulesJson: stringifyJsonValue(record.validationRules ?? {}),
    exportConfigJson: stringifyJsonValue(record.exportConfig ?? {}),
    version: typeof record.version === "number" ? record.version : 1,
    isActive: typeof record.isActive === "boolean" ? record.isActive : true,
    updatedBy: DATASET_SPEC_IMPORT_UPDATED_BY,
  };
}

async function createImportedDatasetSpec(
  input: NormalizedDatasetSpecInput,
): Promise<ImportedDatasetSpecResult> {
  const familySlug = stripDatasetSpecVersionSuffix(input.slug);
  const existingBySlug = await prisma.datasetSpec.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      version: true,
    },
  });

  const archiveFamilySpecs = async (tx: Prisma.TransactionClient) => {
    if (!input.isActive) {
      return;
    }

    await tx.datasetSpec.updateMany({
      where: {
        isActive: true,
        ...buildDatasetSpecFamilyFilter(familySlug),
      },
      data: {
        isActive: false,
        updatedBy: DATASET_SPEC_IMPORT_UPDATED_BY,
      },
    });
  };

  if (!existingBySlug) {
    await prisma.$transaction(async (tx) => {
      await archiveFamilySpecs(tx);

      await tx.datasetSpec.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          datasetFormat: input.datasetFormat,
          inputSchemaJson: input.inputSchemaJson,
          outputSchemaJson: input.outputSchemaJson,
          mappingHintsJson: input.mappingHintsJson,
          validationRulesJson: input.validationRulesJson,
          exportConfigJson: input.exportConfigJson,
          isActive: input.isActive,
          version: input.version,
          createdBy: DATASET_SPEC_IMPORT_UPDATED_BY,
          updatedBy: DATASET_SPEC_IMPORT_UPDATED_BY,
        },
      });
    });

    return {
      index: 0,
      name: input.name,
      slug: input.slug,
      finalSlug: input.slug,
      version: input.version,
      status: "imported",
      message: `Se importó ${input.name || input.slug} como ${input.slug}.`,
    };
  }

  const nextVersionData = await buildNextDatasetSpecVersionSlug(
    input.slug,
    Math.max(input.version, existingBySlug.version + 1),
  );

  await prisma.$transaction(async (tx) => {
    await archiveFamilySpecs(tx);

    await tx.datasetSpec.create({
      data: {
        name: input.name,
        slug: nextVersionData.slug,
        description: input.description,
        datasetFormat: input.datasetFormat,
        inputSchemaJson: input.inputSchemaJson,
        outputSchemaJson: input.outputSchemaJson,
        mappingHintsJson: input.mappingHintsJson,
        validationRulesJson: input.validationRulesJson,
        exportConfigJson: input.exportConfigJson,
        isActive: input.isActive,
        version: nextVersionData.version,
        createdBy: DATASET_SPEC_IMPORT_UPDATED_BY,
        updatedBy: DATASET_SPEC_IMPORT_UPDATED_BY,
      },
    });
  });

  return {
    index: 0,
    name: input.name,
    slug: input.slug,
    finalSlug: nextVersionData.slug,
    version: nextVersionData.version,
    status: "versioned",
    message: `El slug ${input.slug} ya existía; se creó ${nextVersionData.slug}.`,
  };
}

function buildDatasetSpecImportOutcomeMessage(summary: DatasetSpecImportSummary) {
  if (summary.importedCount > 0 || summary.versionedCount > 0) {
    return `Importación completada: ${summary.importedCount} importados, ${summary.versionedCount} versionados y ${summary.rejectedCount} rechazados.`;
  }

  return "No se pudo importar ningún dataset spec válido del archivo.";
}

async function updateDatasetSpecRecord(
  datasetSpecId: string,
  input: NormalizedDatasetSpecInput,
) {
  const currentSpec = await prisma.datasetSpec.findUnique({
    where: { id: datasetSpecId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      datasetFormat: true,
      inputSchemaJson: true,
      outputSchemaJson: true,
      mappingHintsJson: true,
      validationRulesJson: true,
      exportConfigJson: true,
      version: true,
      _count: {
        select: {
          datasetExamples: true,
        },
      },
    },
  });

  if (!currentSpec) {
    throw new Error("El dataset spec ya no existe.");
  }

  const hasVersionedChanges = hasDatasetSpecVersionedChanges(currentSpec, input);

  if (!hasVersionedChanges || currentSpec._count.datasetExamples === 0) {
    await prisma.datasetSpec.update({
      where: { id: datasetSpecId },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        datasetFormat: input.datasetFormat,
        inputSchemaJson: input.inputSchemaJson,
        outputSchemaJson: input.outputSchemaJson,
        mappingHintsJson: input.mappingHintsJson,
        validationRulesJson: input.validationRulesJson,
        exportConfigJson: input.exportConfigJson,
        isActive: input.isActive,
        version: input.version,
        updatedBy: input.updatedBy,
      },
    });

    return {
      mode: "updated_in_place" as const,
      message: "Dataset spec actualizado correctamente.",
    };
  }

  const nextVersionData = await buildNextDatasetSpecVersionSlug(
    input.slug,
    Math.max(input.version, currentSpec.version + 1),
  );

  await prisma.$transaction(async (tx) => {
    await tx.datasetSpec.update({
      where: { id: datasetSpecId },
      data: {
        isActive: false,
        updatedBy: input.updatedBy,
      },
    });

    await tx.datasetSpec.create({
      data: {
        name: input.name,
        slug: nextVersionData.slug,
        description: input.description,
        datasetFormat: input.datasetFormat,
        inputSchemaJson: input.inputSchemaJson,
        outputSchemaJson: input.outputSchemaJson,
        mappingHintsJson: input.mappingHintsJson,
        validationRulesJson: input.validationRulesJson,
        exportConfigJson: input.exportConfigJson,
        isActive: input.isActive,
        version: nextVersionData.version,
        createdBy: input.updatedBy,
        updatedBy: input.updatedBy,
      },
    });
  });

  return {
    mode: "versioned" as const,
    message: `Se creó una nueva versión del dataset spec (${nextVersionData.slug}) y la anterior quedó archivada.`,
  };
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

function revalidateDatasetPaths(projectId?: string, sessionId?: string, datasetExampleId?: string) {
  revalidatePath("/");
  revalidatePath("/dataset-specs");
  revalidatePath("/dataset-examples");
  revalidatePath("/exports");
  revalidatePath("/tasks");
  revalidatePath("/cases");

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/dataset-examples?projectId=${projectId}`);
  }

  if (projectId && sessionId) {
    revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);
    revalidatePath(`/projects/${projectId}/sessions/${sessionId}/dataset/new`);
  }

  if (datasetExampleId) {
    revalidatePath(`/dataset-examples/${datasetExampleId}`);
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

function normalizeSessionChatBaseUrl(transport: ChatTransport, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return transport === "webhook_async"
    ? normalizeWebhookUrl(trimmedValue)
    : normalizeChatBaseUrl(trimmedValue);
}

function normalizeSessionChatApiKey(value: string) {
  return value.trim() || null;
}

function serializeSelectableMessage(message: {
  id: string;
  role: MessageRole;
  text: string;
  orderIndex: number;
  createdAt: Date;
  metadataJson?: Prisma.JsonValue | null;
}) {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    orderIndex: message.orderIndex,
    createdAt: message.createdAt.toISOString(),
    isEdited:
      !!message.metadataJson &&
      typeof message.metadataJson === "object" &&
      !Array.isArray(message.metadataJson) &&
      typeof message.metadataJson.editedAt === "string",
  };
}

function normalizeRagConfigurationInput(input: z.infer<typeof ragConfigurationSchema>) {
  return {
    name: input.name.trim(),
    qdrantBaseUrl: normalizeQdrantBaseUrl(input.qdrantBaseUrl),
    qdrantApiKey: input.qdrantApiKey.trim() || null,
    collectionName: input.collectionName.trim(),
    vectorName: input.vectorName.trim() || null,
    embeddingBaseUrl: normalizeEmbeddingBaseUrl(input.embeddingBaseUrl),
    embeddingApiKey: input.embeddingApiKey.trim() || null,
    embeddingModel: input.embeddingModel.trim() || null,
    payloadPath: input.payloadPath.trim() || null,
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

export async function createRagConfigurationWithFeedback(
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = ragConfigurationSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    qdrantBaseUrl: asOptionalString(formData.get("qdrantBaseUrl")),
    qdrantApiKey: asOptionalString(formData.get("qdrantApiKey")),
    collectionName: asOptionalString(formData.get("collectionName")),
    vectorName: asOptionalString(formData.get("vectorName")),
    embeddingBaseUrl: asOptionalString(formData.get("embeddingBaseUrl")),
    embeddingApiKey: asOptionalString(formData.get("embeddingApiKey")),
    embeddingModel: asOptionalString(formData.get("embeddingModel")),
    payloadPath: asOptionalString(formData.get("payloadPath")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible guardar la configuración RAG."),
    );
  }

  try {
    const normalized = normalizeRagConfigurationInput(parsed.data);

    await prisma.ragConfiguration.create({
      data: normalized,
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar la configuración RAG."),
    );
  }

  revalidatePath("/");

  return buildActionRefreshSuccessState("Configuración RAG guardada correctamente.");
}

export async function updateRagConfigurationWithFeedback(
  configurationId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = ragConfigurationSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    qdrantBaseUrl: asOptionalString(formData.get("qdrantBaseUrl")),
    qdrantApiKey: asOptionalString(formData.get("qdrantApiKey")),
    collectionName: asOptionalString(formData.get("collectionName")),
    vectorName: asOptionalString(formData.get("vectorName")),
    embeddingBaseUrl: asOptionalString(formData.get("embeddingBaseUrl")),
    embeddingApiKey: asOptionalString(formData.get("embeddingApiKey")),
    embeddingModel: asOptionalString(formData.get("embeddingModel")),
    payloadPath: asOptionalString(formData.get("payloadPath")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible actualizar la configuración RAG."),
    );
  }

  try {
    const normalized = normalizeRagConfigurationInput(parsed.data);

    await prisma.ragConfiguration.update({
      where: { id: configurationId },
      data: normalized,
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar la configuración RAG."),
    );
  }

  revalidatePath("/");

  return buildActionRefreshSuccessState("Configuración RAG actualizada correctamente.");
}

export async function deleteRagConfigurationWithFeedback(
  configurationId: string,
  _previousState: ActionFormState,
) {
  void _previousState;

  try {
    await prisma.ragConfiguration.delete({
      where: { id: configurationId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar la configuración RAG."),
    );
  }

  revalidatePath("/");

  return buildActionRefreshSuccessState("Configuración RAG eliminada correctamente.");
}

export async function testRagConfigurationConnection(input: {
  qdrantBaseUrl: string;
  qdrantApiKey: string;
  collectionName: string;
  vectorName: string;
  embeddingBaseUrl: string;
  embeddingApiKey: string;
  embeddingModel: string;
  payloadPath: string;
}) {
  const parsed = ragConnectionTestSchema.safeParse({
    qdrantBaseUrl: input.qdrantBaseUrl,
    qdrantApiKey: input.qdrantApiKey,
    collectionName: input.collectionName,
    vectorName: input.vectorName,
    embeddingBaseUrl: input.embeddingBaseUrl,
    embeddingApiKey: input.embeddingApiKey,
    embeddingModel: input.embeddingModel,
    payloadPath: input.payloadPath,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: getActionErrorMessage(parsed.error, "No fue posible verificar la conexión con Qdrant."),
    };
  }

  try {
    const normalizedBaseUrl = normalizeQdrantBaseUrl(parsed.data.qdrantBaseUrl);
    const normalizedApiKey = parsed.data.qdrantApiKey.trim();
    const normalizedCollectionName = parsed.data.collectionName.trim();
    const normalizedEmbeddingBaseUrl = normalizeEmbeddingBaseUrl(parsed.data.embeddingBaseUrl);
    const normalizedEmbeddingApiKey = parsed.data.embeddingApiKey.trim();
    const normalizedEmbeddingModel = parsed.data.embeddingModel.trim();

    if (!normalizedEmbeddingBaseUrl) {
      throw new Error("Define la URL del proveedor de embeddings.");
    }

    if (!normalizedEmbeddingModel) {
      throw new Error("Define el modelo de embeddings antes de probar la conexión.");
    }

    await testQdrantConnection({
      baseUrl: normalizedBaseUrl,
      apiKey: normalizedApiKey,
      collectionName: normalizedCollectionName,
    });

    const embedding = await createEmbedding({
      model: normalizedEmbeddingModel,
      text: "connection test",
      baseUrl: normalizedEmbeddingBaseUrl,
      apiKey: normalizedEmbeddingApiKey,
    });

    await queryQdrantTopPoint({
      baseUrl: normalizedBaseUrl,
      apiKey: normalizedApiKey,
      collectionName: normalizedCollectionName,
      vectorName: parsed.data.vectorName,
      queryVector: embedding.vector,
      payloadPath: parsed.data.payloadPath,
    });

    return {
      ok: true as const,
      message: `Embeddings y Qdrant respondieron correctamente. La colección "${normalizedCollectionName}" aceptó una consulta vectorial.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible verificar la conexión con Qdrant.",
    };
  }
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
      chatTransport: true,
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
      chatRequests: {
        where: {
          status: "pending",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
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

  if (
    session.chatTransport === "openai_compatible" &&
    !session.chatConnectionVerifiedAt
  ) {
    return {
      ok: false as const,
      error: "La conexión del chat todavía no fue verificada para este modelo.",
    };
  }

  if (session.chatTransport === "webhook_async" && session.chatRequests.length > 0) {
    return {
      ok: false as const,
      error: "Esta sesión ya tiene una solicitud pendiente. Espera la respuesta antes de enviar otro mensaje.",
    };
  }

  try {
    if (session.chatTransport === "webhook_async") {
      const runtime = getSessionChatRuntimeConfiguration({
        transport: session.chatTransport,
        baseUrl: session.chatBaseUrl,
        apiKey: session.chatApiKey,
      });

      if (!runtime.enabled || !session.chatBaseUrl?.trim()) {
        return {
          ok: false as const,
          error:
            runtime.disabledReason ||
            "La configuración del webhook no está lista para usar el chat.",
        };
      }

      const userMessageId = crypto.randomUUID();
      const chatRequestId = crypto.randomUUID();
      const webhookResponse = await sendWebhookAsyncChatRequest({
        integrationId: session.chatModel.trim(),
        webhookUrl: session.chatBaseUrl,
        apiKey: session.chatApiKey,
        sessionId,
        userMessageId,
        chatRequestId,
        systemPrompt: session.systemPrompt,
        history: session.messages.map((message) => ({
          role: message.role,
          text: message.text,
        })),
        message: {
          id: userMessageId,
          role: "user",
          text: parsed.text,
        },
      });

      const createdUserMessage = await prisma.$transaction(async (tx) => {
        const lastMessage = await tx.message.findFirst({
          where: { sessionId },
          orderBy: { orderIndex: "desc" },
          select: { orderIndex: true },
        });

        const existingPendingRequest = await tx.chatRequest.findFirst({
          where: {
            sessionId,
            status: "pending",
          },
          select: {
            id: true,
          },
        });

        if (existingPendingRequest) {
          throw new Error("Esta sesión ya tiene una solicitud pendiente. Espera la respuesta antes de enviar otro mensaje.");
        }

        const nextOrderIndex = (lastMessage?.orderIndex ?? -1) + 1;
        const userMessage = await tx.message.create({
          data: {
            id: userMessageId,
            sessionId,
            role: MessageRole.user,
            text: parsed.text,
            orderIndex: nextOrderIndex,
            metadataJson: {
              source: "session_chat",
              transport: session.chatTransport,
            },
          },
        });

        await tx.chatRequest.create({
          data: {
            id: chatRequestId,
            sessionId,
            userMessageId,
            status: "pending",
            transport: session.chatTransport,
            integrationRequestId: webhookResponse.integrationRequestId,
            requestPayloadJson: webhookResponse.requestPayload,
            responsePayloadJson:
              webhookResponse.responsePayloadJson === null
                ? Prisma.JsonNull
                : (webhookResponse.responsePayloadJson as Prisma.InputJsonValue),
          },
        });

        return userMessage;
      });

      revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

      return {
        ok: true as const,
        transport: session.chatTransport,
        userMessage: serializeSelectableMessage(createdUserMessage),
        chatRequest: {
          id: chatRequestId,
          sessionId,
          userMessageId,
          status: "pending" as const,
          transport: session.chatTransport,
          integrationRequestId: webhookResponse.integrationRequestId,
          errorMessage: null,
          responseMessageId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
        },
      };
    }

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
    transport: session.chatTransport,
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

export async function retryLastAssistantMessage(projectId: string, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
      chatTransport: true,
      systemPrompt: true,
      chatModel: true,
      chatBaseUrl: true,
      chatApiKey: true,
      chatConnectionVerifiedAt: true,
      messages: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          role: true,
          text: true,
          orderIndex: true,
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

  if (session.chatTransport !== "openai_compatible") {
    return {
      ok: false as const,
      error: "El reintento del último mensaje solo está disponible para chats OpenAI-compatible.",
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

  const lastMessage = session.messages.at(-1);
  const conversationBeforeRetry = lastMessage ? session.messages.slice(0, -1) : [];
  const previousMessage = conversationBeforeRetry.at(-1);

  if (!lastMessage || lastMessage.role !== MessageRole.assistant) {
    return {
      ok: false as const,
      error: "Solo se puede reintentar cuando el último turno es del asistente.",
    };
  }

  if (!previousMessage || previousMessage.role !== MessageRole.user) {
    return {
      ok: false as const,
      error: "El reintento necesita que el último mensaje previo sea del usuario.",
    };
  }

  try {
    const assistantReply = await generateAssistantReply({
      model: session.chatModel,
      baseUrl: session.chatBaseUrl,
      apiKey: session.chatApiKey,
      systemPrompt: session.systemPrompt,
      messages: conversationBeforeRetry.map((message) => ({
        role: message.role,
        text: message.text,
      })),
    });

    const retriedMessage = await prisma.$transaction(async (tx) => {
      const latestMessage = await tx.message.findFirst({
        where: { sessionId },
        orderBy: { orderIndex: "desc" },
        select: {
          id: true,
          role: true,
          orderIndex: true,
        },
      });

      if (
        !latestMessage ||
        latestMessage.id !== lastMessage.id ||
        latestMessage.role !== MessageRole.assistant
      ) {
        throw new Error("El chat cambió antes de completar el reintento. Inténtalo de nuevo.");
      }

      await tx.message.delete({
        where: { id: lastMessage.id },
      });

      return tx.message.create({
        data: {
          sessionId,
          role: MessageRole.assistant,
          text: assistantReply.text,
          orderIndex: lastMessage.orderIndex,
          metadataJson: {
            source: "openai_compatible",
            model: assistantReply.model,
            response_id: assistantReply.responseId,
            retried_from_message_id: lastMessage.id,
          },
        },
      });
    });

    revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

    return {
      ok: true as const,
      message: {
        ...serializeSelectableMessage(retriedMessage),
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible regenerar la última respuesta del asistente.",
    };
  }
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
  input: {
    chatTransport: "openai_compatible" | "webhook_async";
    chatModel: string;
    chatBaseUrl: string;
    chatApiKey: string;
  },
) {
  const parsed = sessionChatSettingsSchema.parse({
    chatTransport: input.chatTransport,
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
    const transport = parsed.chatTransport;
    const normalizedModel = parsed.chatModel.trim();
    const normalizedBaseUrl = normalizeSessionChatBaseUrl(transport, parsed.chatBaseUrl);
    const normalizedApiKey = normalizeSessionChatApiKey(parsed.chatApiKey);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        chatTransport: transport,
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
  input: {
    chatTransport: "openai_compatible" | "webhook_async";
    chatModel: string;
    chatBaseUrl: string;
    chatApiKey: string;
  },
) {
  const parsed = sessionChatSettingsSchema.parse({
    chatTransport: input.chatTransport,
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

  const transport = parsed.chatTransport;
  const normalizedModel = parsed.chatModel.trim();
  const checkedAt = new Date();
  let normalizedBaseUrl: string | null = null;
  let normalizedApiKey: string | null = null;

  try {
    if (!normalizedModel) {
      throw new Error("Define un modelo antes de probar la conexión.");
    }

    if (transport !== "openai_compatible") {
      throw new Error("La verificación manual solo aplica al modo OpenAI-compatible.");
    }

    normalizedBaseUrl = normalizeSessionChatBaseUrl(transport, parsed.chatBaseUrl);
    normalizedApiKey = normalizeSessionChatApiKey(parsed.chatApiKey);
    const result = await testOpenAIChatConnection({
      model: normalizedModel,
      baseUrl: normalizedBaseUrl,
      apiKey: normalizedApiKey,
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        chatTransport: transport,
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
        chatTransport: transport,
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

async function loadSourceSliceDraftFromSelection(
  projectId: string,
  sessionId: string,
  startOrderIndex: number,
  endOrderIndex: number,
) {
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
          gte: Math.max(0, startOrderIndex - 3),
          lte: endOrderIndex + 3,
        },
      },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        projectId: true,
        title: true,
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

  const conversationSlice = toDatasetConversationSlice(selectedMessages);
  const surroundingContext = toDatasetConversationSlice(
    contextMessages.filter(
      (message) =>
        message.orderIndex < startOrderIndex || message.orderIndex > endOrderIndex,
    ),
  );
  const selectedTurnIds = selectedMessages.map((message) => message.id);

  return {
    projectId,
    sessionId,
    title: session.title
      ? `${session.title} · turnos ${startOrderIndex + 1}-${endOrderIndex + 1}`
      : `Slice ${startOrderIndex + 1}-${endOrderIndex + 1}`,
    conversationSlice,
    surroundingContext,
    selectedTurnIds,
    lastUserMessage:
      deriveDatasetLastUserMessage(conversationSlice) ||
      deriveLastUserMessage(toConversationSlice(selectedMessages)),
    sourceSummary: "",
    sourceMetadata: buildSourceSliceMetadata({
      projectId,
      sessionId,
      sessionNotes: session.curationNotes ?? "",
      selectedTurnIds,
      startOrderIndex,
      endOrderIndex,
    }),
  };
}

async function loadPersistedSourceSlice(projectId: string, sessionId: string, sourceSliceId: string) {
  const sourceSlice = await prisma.sourceSlice.findUnique({
    where: { id: sourceSliceId },
    select: {
      id: true,
      projectId: true,
      sessionId: true,
      title: true,
      conversationSliceJson: true,
      surroundingContextJson: true,
      selectedTurnIdsJson: true,
      lastUserMessage: true,
      sourceSummary: true,
      sourceMetadataJson: true,
    },
  });

  if (!sourceSlice || sourceSlice.projectId !== projectId || sourceSlice.sessionId !== sessionId) {
    throw new Error("El slice no existe o no pertenece a esta sesión.");
  }

  return sourceSliceFromPrisma(sourceSlice);
}

function buildPersistedMappings(input: {
  mappings: DatasetFieldMappingRecord[];
  sourceSlice: ReturnType<typeof sourceSliceFromPrisma> | Awaited<ReturnType<typeof loadSourceSliceDraftFromSelection>>;
}) {
  return input.mappings.map((mapping, index) => {
    const resolvedPreview = resolveFieldMapping(input.sourceSlice, mapping);
    const constantValue = parseLooseJsonValue(mapping.constantValueText);
    const manualValue = parseLooseJsonValue(mapping.manualValueText);
    const llmGeneratedValue = parseLooseJsonValue(mapping.llmGeneratedValueText);
    const ragGeneratedValue = parseLooseJsonValue(mapping.ragGeneratedValueText);
    const ragTopK = normalizeRetrievalTopK(mapping.ragTopK);
    const ragGenerationMeta =
      mapping.ragGenerationMeta &&
      typeof mapping.ragGenerationMeta === "object" &&
      !Array.isArray(mapping.ragGenerationMeta)
        ? {
            ...(mapping.ragGenerationMeta as Record<string, JsonValue>),
            topK: ragTopK,
          }
        : ragTopK !== 1
          ? { topK: ragTopK }
          : null;

    return {
      side: mapping.side as DatasetFieldSide,
      fieldKey: mapping.fieldKey,
      sourceKey: mapping.sourceKey,
      sourcePath: mapping.sourcePath || null,
      transformChainJson: mapping.transformChain as Prisma.InputJsonValue,
      constantValueJson:
        constantValue === null ? Prisma.JsonNull : (constantValue as Prisma.InputJsonValue),
      manualValueJson:
        manualValue === null ? Prisma.JsonNull : (manualValue as Prisma.InputJsonValue),
      llmConfigurationId: mapping.llmConfigurationId.trim() || null,
      llmPromptText: mapping.llmPromptText.trim() || null,
      llmContextSelectionJson:
        mapping.llmContextSelection === undefined
          ? Prisma.JsonNull
          : (normalizeDatasetLlmContextSelection(mapping.llmContextSelection) as Prisma.InputJsonValue),
      llmGeneratedValueJson:
        llmGeneratedValue === null ? Prisma.JsonNull : (llmGeneratedValue as Prisma.InputJsonValue),
      llmGenerationMetaJson:
        mapping.llmGenerationMeta === undefined
          ? Prisma.JsonNull
          : (mapping.llmGenerationMeta as Prisma.InputJsonValue),
      ragConfigurationId: mapping.ragConfigurationId.trim() || null,
      ragPromptText: mapping.ragPromptText.trim() || null,
      ragGeneratedValueJson:
        ragGeneratedValue === null ? Prisma.JsonNull : (ragGeneratedValue as Prisma.InputJsonValue),
      ragGenerationMetaJson:
        ragGenerationMeta === null
          ? Prisma.JsonNull
          : (ragGenerationMeta as Prisma.InputJsonValue),
      resolvedPreviewJson:
        resolvedPreview === null || resolvedPreview === undefined
          ? Prisma.JsonNull
          : (resolvedPreview as Prisma.InputJsonValue),
      position: index,
    };
  });
}

export async function createSourceSliceFromSelection(
  projectId: string,
  sessionId: string,
  startOrderIndex: number,
  endOrderIndex: number,
) {
  return loadSourceSliceDraftFromSelection(
    projectId,
    sessionId,
    startOrderIndex,
    endOrderIndex,
  );
}

export async function generateDatasetFieldWithLlm(input: {
  llmConfigurationId: string;
  side: "input" | "output";
  field: DatasetSchemaField;
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
  promptText: string;
  lastUserMessage: string;
  sourceSummary: string;
  sessionNotes: string;
  conversationSliceJson: string;
  surroundingContextJson: string;
  inputPayloadJson: string;
  outputPayloadJson: string;
  llmContextSelection?: Record<string, boolean>;
}) {
  const parsed = datasetFieldGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: getActionErrorMessage(parsed.error, "No fue posible preparar la generacion del campo."),
    };
  }

  let llmConfiguration;

  try {
    llmConfiguration = await prisma.llmConfiguration.findUnique({
      where: { id: parsed.data.llmConfigurationId },
      select: {
        id: true,
        name: true,
        chatModel: true,
        chatBaseUrl: true,
        chatApiKey: true,
        systemPrompt: true,
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "No fue posible cargar la configuracion LLM."),
    };
  }

  if (!llmConfiguration) {
    return {
      ok: false as const,
      error: "La configuracion LLM seleccionada ya no existe.",
    };
  }

  if (!llmConfiguration.chatModel.trim()) {
    return {
      ok: false as const,
      error: "La configuracion LLM no tiene un modelo definido.",
    };
  }

  const llmContextSelection = normalizeDatasetLlmContextSelection(parsed.data.llmContextSelection);
  const prompt = buildDatasetFieldGenerationPrompt({
    ...parsed.data,
  });
  const requestPreview = buildDatasetFieldGenerationRequestPreview({
    ...parsed.data,
    model: llmConfiguration.chatModel,
    configurationName: llmConfiguration.name,
  });

  try {
    const response = await generateAssistantReply({
      model: llmConfiguration.chatModel,
      baseUrl: llmConfiguration.chatBaseUrl,
      apiKey: llmConfiguration.chatApiKey,
      systemPrompt: null,
      messages: [
        {
          role: "user",
          text: prompt.promptText,
        },
      ],
    });

    const generated = parseGeneratedDatasetFieldResponse(response.text, parsed.data.field);
    const generatedAt = new Date().toISOString();

    return {
      ok: true as const,
      valueText: stringifyJsonValue(generated.value),
      metadata: {
        configurationId: llmConfiguration.id,
        configurationName: llmConfiguration.name,
        model: response.model,
        systemPromptApplied: false,
        llmContextSelection,
        requestPreview,
        usedTokens: prompt.usedTokens,
        unresolvedTokens: prompt.unresolvedTokens,
        generatedAt,
        responseId: response.responseId,
        promptText: parsed.data.promptText,
        confidence: generated.confidence,
        notes: generated.notes,
      } satisfies JsonValue,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "No fue posible generar el valor para este campo."),
    };
  }
}

export async function generateDatasetFieldsWithLlm(input: {
  llmConfigurationId: string;
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
  conversationSliceJson: string;
  fields: Array<{
    side: "input" | "output";
    field: DatasetSchemaField;
  }>;
}) {
  const parsed = datasetBatchGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: getActionErrorMessage(parsed.error, "No fue posible preparar el autollenado."),
    };
  }

  let llmConfiguration;

  try {
    llmConfiguration = await prisma.llmConfiguration.findUnique({
      where: { id: parsed.data.llmConfigurationId },
      select: {
        id: true,
        name: true,
        chatModel: true,
        chatBaseUrl: true,
        chatApiKey: true,
        systemPrompt: true,
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "No fue posible cargar la configuracion LLM."),
    };
  }

  if (!llmConfiguration) {
    return {
      ok: false as const,
      error: "La configuracion LLM seleccionada ya no existe.",
    };
  }

  if (!llmConfiguration.chatModel.trim()) {
    return {
      ok: false as const,
      error: "La configuracion LLM no tiene un modelo definido.",
    };
  }

  const prompt = buildDatasetBatchGenerationPrompt({
    ...parsed.data,
  });
  const requestPreview = buildDatasetBatchGenerationRequestPreview({
    ...parsed.data,
    model: llmConfiguration.chatModel,
    configurationName: llmConfiguration.name,
  });
  const llmContextSelection = normalizeDatasetLlmContextSelection({
    conversationSlice: true,
  });
  const promptText = "Autollenado asistido usando solo el transcript seleccionado y la descripcion del campo.";

  try {
    const response = await generateAssistantReply({
      model: llmConfiguration.chatModel,
      baseUrl: llmConfiguration.chatBaseUrl,
      apiKey: llmConfiguration.chatApiKey,
      systemPrompt: null,
      messages: [
        {
          role: "user",
          text: prompt.promptText,
        },
      ],
    });

    const generated = parseGeneratedDatasetBatchResponse(response.text, parsed.data.fields);

    if (generated.fields.length === 0) {
      return {
        ok: false as const,
        error: "El modelo no devolvio ningun campo util para el autollenado.",
      };
    }

    const generatedAt = new Date().toISOString();

    return {
      ok: true as const,
      fields: generated.fields.map((item) => ({
        side: item.side,
        fieldKey: item.fieldKey,
        valueText: stringifyJsonValue(item.value),
        metadata: {
          configurationId: llmConfiguration.id,
          configurationName: llmConfiguration.name,
          model: response.model,
          systemPromptApplied: false,
          llmContextSelection,
          requestPreview,
          generatedAt,
          responseId: response.responseId,
          promptText,
          confidence: item.confidence,
          notes: item.notes,
          generationMode: "bulk_autofill",
          batchFieldCount: parsed.data.fields.length,
        } satisfies JsonValue,
      })),
      missingFieldKeys: generated.missingFieldKeys,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "No fue posible autollenar el dataset example."),
    };
  }
}

export async function generateDatasetFieldWithRag(input: {
  ragConfigurationId: string;
  promptText: string;
  topK: number;
}) {
  const parsed = datasetFieldRagGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: getActionErrorMessage(parsed.error, "No fue posible preparar la consulta de retrieval."),
    };
  }

  let ragConfiguration;

  try {
    ragConfiguration = await prisma.ragConfiguration.findUnique({
      where: { id: parsed.data.ragConfigurationId },
      select: {
        id: true,
        name: true,
        qdrantBaseUrl: true,
        qdrantApiKey: true,
        collectionName: true,
        vectorName: true,
        embeddingBaseUrl: true,
        embeddingApiKey: true,
        embeddingModel: true,
        payloadPath: true,
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "No fue posible cargar la configuración de retrieval."),
    };
  }

  if (!ragConfiguration) {
    return {
      ok: false as const,
      error: "La configuración de retrieval seleccionada ya no existe.",
    };
  }

  const queryText = buildDatasetFieldRagQuery(parsed.data.promptText);

  try {
    if (!ragConfiguration.embeddingBaseUrl) {
      throw new Error("La configuración de retrieval no tiene URL de proveedor de embeddings.");
    }

    if (!ragConfiguration.embeddingModel) {
      throw new Error("La configuración de retrieval no tiene modelo de embeddings.");
    }

    const embedding = await createEmbedding({
      model: ragConfiguration.embeddingModel,
      text: queryText,
      baseUrl: ragConfiguration.embeddingBaseUrl,
      apiKey: ragConfiguration.embeddingApiKey,
    });

    const result = await queryQdrantTopPoint({
      baseUrl: ragConfiguration.qdrantBaseUrl,
      apiKey: ragConfiguration.qdrantApiKey,
      collectionName: ragConfiguration.collectionName,
      vectorName: ragConfiguration.vectorName,
      queryVector: embedding.vector,
      payloadPath: ragConfiguration.payloadPath,
      limit: parsed.data.topK,
    });

    if (!result.point || result.values.length === 0) {
      return {
        ok: false as const,
        error: "No se encontraron resultados para esa query manual.",
      };
    }

    const generatedAt = new Date().toISOString();
    const value =
      parsed.data.topK === 1
        ? result.values[0]
        : (result.values as JsonValue);

    return {
      ok: true as const,
      valueText: stringifyJsonValue(value),
      metadata: {
        configurationId: ragConfiguration.id,
        configurationName: ragConfiguration.name,
        collectionName: ragConfiguration.collectionName,
        vectorName: ragConfiguration.vectorName,
        embeddingModel: ragConfiguration.embeddingModel,
        payloadPath: ragConfiguration.payloadPath,
        generatedAt,
        queryText,
        topK: parsed.data.topK,
        resultCount: result.points.length,
        score: typeof result.point.score === "number" ? result.point.score : null,
        pointId: result.point.id ?? null,
        scores: result.points.map((point) =>
          typeof point.score === "number" ? point.score : null,
        ),
        pointIds: result.points.map((point) => point.id ?? null),
        retrievalMode: parsed.data.topK === 1 ? "manual_query_top_1" : "manual_query_top_k",
      } satisfies JsonValue,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "No fue posible recuperar conocimiento desde Qdrant."),
    };
  }
}

export async function createDatasetSpec(formData: FormData) {
  const parsed = datasetSpecSchema.parse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    datasetFormat: formData.get("datasetFormat") || DatasetFormat.dspy_jsonl,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    mappingHintsJson: asOptionalString(formData.get("mappingHintsJson")) || "{}",
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportConfigJson: asOptionalString(formData.get("exportConfigJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  const normalized = normalizeDatasetSpecInput(parsed);

  await prisma.datasetSpec.create({
    data: {
      ...normalized,
      createdBy: normalized.updatedBy,
    },
  });

  revalidateDatasetPaths();
  redirect("/dataset-specs");
}

export async function createDatasetSpecWithFeedback(
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = datasetSpecSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    datasetFormat: formData.get("datasetFormat") || DatasetFormat.dspy_jsonl,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    mappingHintsJson: asOptionalString(formData.get("mappingHintsJson")) || "{}",
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportConfigJson: asOptionalString(formData.get("exportConfigJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible crear el dataset spec."));
  }

  try {
    const normalized = normalizeDatasetSpecInput(parsed.data);

    await prisma.datasetSpec.create({
      data: {
        ...normalized,
        createdBy: normalized.updatedBy,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible crear el dataset spec."),
    );
  }

  revalidateDatasetPaths();
  return buildActionSuccessState("Dataset spec creado correctamente.", {
    redirectTo: "/dataset-specs",
    navigationMode: "replace",
  });
}

export async function updateDatasetSpec(datasetSpecId: string, formData: FormData) {
  const parsed = datasetSpecSchema.parse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    datasetFormat: formData.get("datasetFormat") || DatasetFormat.dspy_jsonl,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    mappingHintsJson: asOptionalString(formData.get("mappingHintsJson")) || "{}",
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportConfigJson: asOptionalString(formData.get("exportConfigJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  await updateDatasetSpecRecord(datasetSpecId, normalizeDatasetSpecInput(parsed));

  revalidateDatasetPaths();
  redirect("/dataset-specs");
}

export async function updateDatasetSpecWithFeedback(
  datasetSpecId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = datasetSpecSchema.safeParse({
    name: asOptionalString(formData.get("name")),
    slug: asOptionalString(formData.get("slug")),
    description: asOptionalString(formData.get("description")),
    datasetFormat: formData.get("datasetFormat") || DatasetFormat.dspy_jsonl,
    inputSchemaJson: asOptionalString(formData.get("inputSchemaJson")) || "[]",
    outputSchemaJson: asOptionalString(formData.get("outputSchemaJson")) || "[]",
    mappingHintsJson: asOptionalString(formData.get("mappingHintsJson")) || "{}",
    validationRulesJson: asOptionalString(formData.get("validationRulesJson")) || "{}",
    exportConfigJson: asOptionalString(formData.get("exportConfigJson")) || "{}",
    version: formData.get("version") || 1,
    isActive: formData.get("isActive") === "on",
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el dataset spec."));
  }

  try {
    const result = await updateDatasetSpecRecord(
      datasetSpecId,
      normalizeDatasetSpecInput(parsed.data),
    );

    revalidateDatasetPaths();
    return buildActionSuccessState(result.message, {
      redirectTo: "/dataset-specs",
      navigationMode: "replace",
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el dataset spec."),
    );
  }
}

export async function deleteDatasetSpecWithFeedback(
  datasetSpecId: string,
  _previousState: ActionFormState,
) {
  void _previousState;

  let datasetSpec;

  try {
    datasetSpec = await prisma.datasetSpec.findUnique({
      where: { id: datasetSpecId },
      select: {
        name: true,
        _count: {
          select: {
            datasetExamples: true,
          },
        },
      },
    });

    if (!datasetSpec) {
      return buildActionErrorState("El dataset spec ya no existe.");
    }

    if (datasetSpec._count.datasetExamples > 0) {
      return buildActionErrorState(
        `No se puede eliminar ${datasetSpec.name} porque ya tiene dataset examples asociados. Crea una nueva versión o archívalo.`,
      );
    }

    await prisma.datasetSpec.delete({
      where: { id: datasetSpecId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar el dataset spec."),
    );
  }

  revalidateDatasetPaths();
  return buildActionSuccessState("Dataset spec eliminado correctamente.", {
    redirectTo: "/dataset-specs",
    navigationMode: "replace",
  });
}

export async function importDatasetSpecsWithFeedback(
  _previousState: DatasetSpecImportActionState,
  formData: FormData,
): Promise<DatasetSpecImportActionState> {
  const fileEntry = formData.get("datasetSpecFile");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return buildDatasetSpecImportState({
      status: "error",
      message: "Selecciona un archivo JSON para importar dataset specs.",
      summary: null,
    });
  }

  let fileText: string;

  try {
    fileText = await fileEntry.text();
  } catch (error) {
    return buildDatasetSpecImportState({
      status: "error",
      message: getActionErrorMessage(error, "No fue posible leer el archivo JSON."),
      summary: null,
    });
  }

  let bundle: ReturnType<typeof parseDatasetSpecImportBundleText>;

  try {
    bundle = parseDatasetSpecImportBundleText(fileText);
  } catch (error) {
    return buildDatasetSpecImportState({
      status: "error",
      message: getActionErrorMessage(
        error,
        "El archivo no contiene un bundle de dataset specs compatible.",
      ),
      summary: null,
    });
  }

  const results: ImportedDatasetSpecResult[] = [];

  for (const [index, specInput] of bundle.specs.entries()) {
    const descriptor = getImportedDatasetSpecDescriptor(specInput);
    const parsed = datasetSpecSchema.safeParse(buildImportedDatasetSpecCandidate(specInput));

    if (!parsed.success) {
      results.push({
        index: index + 1,
        name: descriptor.name,
        slug: descriptor.slug,
        finalSlug: descriptor.slug,
        version: 0,
        status: "rejected",
        message: getActionErrorMessage(
          parsed.error,
          "El dataset spec importado no tiene un formato válido.",
        ),
      });
      continue;
    }

    try {
      const imported = await createImportedDatasetSpec(normalizeDatasetSpecInput(parsed.data));

      results.push({
        ...imported,
        index: index + 1,
      });
    } catch (error) {
      results.push({
        index: index + 1,
        name: descriptor.name || parsed.data.name,
        slug: descriptor.slug || parsed.data.slug,
        finalSlug: descriptor.slug || parsed.data.slug,
        version: parsed.data.version,
        status: "rejected",
        message: getActionErrorMessage(error, "No fue posible importar este dataset spec."),
      });
    }
  }

  const summary: DatasetSpecImportSummary = {
    fileName: fileEntry.name,
    importedCount: results.filter((result) => result.status === "imported").length,
    versionedCount: results.filter((result) => result.status === "versioned").length,
    rejectedCount: results.filter((result) => result.status === "rejected").length,
    results,
  };

  if (summary.importedCount > 0 || summary.versionedCount > 0) {
    revalidateDatasetPaths();
  }

  return buildDatasetSpecImportState({
    status:
      summary.importedCount > 0 || summary.versionedCount > 0 ? "success" : "error",
    message: buildDatasetSpecImportOutcomeMessage(summary),
    summary,
  });
}

export async function importDatasetExamplesWithFeedback(
  projectId: string,
  _previousState: DatasetImportActionState,
  formData: FormData,
): Promise<DatasetImportActionState> {
  const parsed = datasetImportSchema.safeParse({
    datasetSpecId: asOptionalString(formData.get("datasetSpecId")),
    sessionId: asOptionalString(formData.get("sessionId")),
  });

  if (!parsed.success) {
    return buildDatasetImportState({
      status: "error",
      message: getActionErrorMessage(parsed.error, "No fue posible preparar la importación."),
      summary: null,
    });
  }

  const fileEntry = formData.get("datasetFile");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return buildDatasetImportState({
      status: "error",
      message: "Selecciona un archivo JSONL o NDJSON antes de importar.",
      summary: null,
    });
  }

  const fileName = fileEntry.name.trim() || "dataset-import.jsonl";
  let fileContents = "";

  try {
    fileContents = await fileEntry.text();
  } catch (error) {
    return buildDatasetImportState({
      status: "error",
      message: getActionErrorMessage(error, "No fue posible leer el archivo seleccionado."),
      summary: null,
    });
  }

  const parsedRows = parseImportedDatasetText(fileContents);

  if (parsedRows.length === 0) {
    return buildDatasetImportState({
      status: "error",
      message: "El archivo no contiene filas JSONL válidas para procesar.",
      summary: null,
    });
  }

  await ensureDefaultDatasetSpecs();

  const [project, datasetSpec, existingDatasetExamples] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }),
    prisma.datasetSpec.findUnique({
      where: { id: parsed.data.datasetSpecId },
      select: {
        id: true,
        name: true,
        datasetFormat: true,
        version: true,
        inputSchemaJson: true,
        outputSchemaJson: true,
        validationRulesJson: true,
      },
    }),
    prisma.datasetExample.findMany({
      where: {
        datasetSpecId: parsed.data.datasetSpecId,
        sourceSlice: {
          projectId,
        },
      },
      select: {
        inputPayloadJson: true,
        outputPayloadJson: true,
      },
    }),
  ]);

  if (!project) {
    return buildDatasetImportState({
      status: "error",
      message: "El proyecto ya no existe.",
      summary: null,
    });
  }

  if (!datasetSpec) {
    return buildDatasetImportState({
      status: "error",
      message: "El dataset spec seleccionado no existe.",
      summary: null,
    });
  }

  const inputSchema = parseDatasetSchema(datasetSpec.inputSchemaJson);
  const outputSchema = parseDatasetSchema(datasetSpec.outputSchemaJson);
  const seenFingerprints = new Set(
    existingDatasetExamples.map((datasetExample) =>
      buildDatasetImportFingerprint({
        projectId,
        datasetSpecId: datasetSpec.id,
        inputPayload: datasetExample.inputPayloadJson as JsonObject,
        outputPayload: datasetExample.outputPayloadJson as JsonObject,
      }),
    ),
  );

  const results: ImportedDatasetRowResult[] = [];
  let importedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;
  let datasetImportSessionId: string | null = null;

  try {
    datasetImportSessionId = await resolveDatasetTargetSessionId(
      projectId,
      parsed.data.sessionId,
    );
  } catch (error) {
    return buildDatasetImportState({
      status: "error",
      message: getActionErrorMessage(error, "No fue posible resolver la sesión de importación."),
      summary: null,
    });
  }

  for (const parsedRow of parsedRows) {
    if (!parsedRow.row) {
      rejectedCount += 1;
      results.push({
        lineNumber: parsedRow.lineNumber,
        status: "rejected",
        message: parsedRow.error ?? "La línea no pudo procesarse.",
      });
      continue;
    }
    const importedRow = parsedRow.row;

    const validationState = validateDatasetExamplePayload({
      datasetSpec,
      inputPayload: importedRow.input,
      outputPayload: importedRow.output,
    });
    const validationMessage = buildDatasetImportValidationMessage(validationState);

    if (validationMessage) {
      rejectedCount += 1;
      results.push({
        lineNumber: parsedRow.lineNumber,
        status: "rejected",
        message: validationMessage,
      });
      continue;
    }

    const importFingerprint = buildDatasetImportFingerprint({
      projectId,
      datasetSpecId: datasetSpec.id,
      inputPayload: importedRow.input,
      outputPayload: importedRow.output,
    });

    if (seenFingerprints.has(importFingerprint)) {
      duplicateCount += 1;
      results.push({
        lineNumber: parsedRow.lineNumber,
        status: "duplicate",
        message: "Fila duplicada: ya existe un dataset example idéntico en este proyecto.",
      });
      continue;
    }

    const importedAt = new Date().toISOString();
    const sourceSliceDraft = buildImportedSourceSliceRecord({
      projectId,
      sessionId: datasetImportSessionId,
      fileName,
      lineNumber: parsedRow.lineNumber,
    });
    const sourceMetadataJson = buildImportedSourceSliceMetadataJson({
      projectId,
      sessionId: datasetImportSessionId,
      fileName,
      lineNumber: parsedRow.lineNumber,
      importedAt,
      originalMetadata: importedRow.metadata,
    });
    const mappings = buildImportedDatasetMappings({
      inputSchema,
      outputSchema,
      inputPayload: importedRow.input,
      outputPayload: importedRow.output,
    });

    try {
      const importSessionId = datasetImportSessionId;

      if (!importSessionId) {
        throw new Error("No fue posible inicializar la sesión de imports.");
      }

      const hydratedSourceSlice = {
        ...sourceSliceDraft,
        sessionId: importSessionId,
        sourceMetadata: {
          ...sourceSliceDraft.sourceMetadata,
          session_id: importSessionId,
        },
      };
      const hydratedSourceMetadataJson = {
        ...sourceMetadataJson,
        session_id: importSessionId,
      };
      const persistedMappings = buildPersistedMappings({
        mappings,
        sourceSlice: hydratedSourceSlice,
      });

      const createdDatasetExample = await prisma.$transaction(async (tx) => {
        const sourceSlice = await tx.sourceSlice.create({
          data: {
            projectId,
            sessionId: importSessionId,
            title: null,
            conversationSliceJson: [] as Prisma.InputJsonValue,
            surroundingContextJson: [] as Prisma.InputJsonValue,
            selectedTurnIdsJson: [] as Prisma.InputJsonValue,
            lastUserMessage: hydratedSourceSlice.lastUserMessage,
            sourceSummary: hydratedSourceSlice.sourceSummary,
            sourceMetadataJson: hydratedSourceMetadataJson as Prisma.InputJsonValue,
          },
        });

        await tx.sourceSlice.update({
          where: { id: sourceSlice.id },
          data: {
            title: buildImportedSourceSliceTitle(sourceSlice.id),
          },
        });

        const datasetExample = await tx.datasetExample.create({
          data: {
            sourceSliceId: sourceSlice.id,
            datasetSpecId: datasetSpec.id,
            title: null,
            inputPayloadJson: importedRow.input as Prisma.InputJsonValue,
            outputPayloadJson: importedRow.output as Prisma.InputJsonValue,
            validationStateJson: validationState as Prisma.InputJsonValue,
            provenanceJson: {
              import_mode: "jsonl_file",
              import_hash: importFingerprint,
              source_file_name: fileName,
              source_line_number: parsedRow.lineNumber,
              imported_at: importedAt,
              source_session_id: importSessionId,
              dataset_format: datasetSpec.datasetFormat,
              ...(importedRow.metadata
                ? { original_metadata: importedRow.metadata }
                : {}),
            } as Prisma.InputJsonValue,
            reviewStatus: DatasetExampleReviewStatus.draft,
            version: datasetSpec.version,
            createdBy: "human",
            updatedBy: "human",
          },
        });

        for (const mapping of persistedMappings) {
          await tx.datasetFieldMapping.create({
            data: {
              datasetExampleId: datasetExample.id,
              ...mapping,
            },
          });
        }

        return datasetExample;
      });

      seenFingerprints.add(importFingerprint);
      importedCount += 1;
      results.push({
        lineNumber: parsedRow.lineNumber,
        status: "imported",
        message: "Dataset example importado correctamente.",
        datasetExampleId: createdDatasetExample.id,
      });
    } catch (error) {
      rejectedCount += 1;
      results.push({
        lineNumber: parsedRow.lineNumber,
        status: "rejected",
        message: getActionErrorMessage(error, "No fue posible guardar esta fila."),
      });
    }
  }

  const summary: DatasetImportSummary = {
    fileName,
    datasetSpecId: datasetSpec.id,
    datasetSpecName: datasetSpec.name,
    sessionId: datasetImportSessionId,
    importedCount,
    duplicateCount,
    rejectedCount,
    results,
  };

  if (datasetImportSessionId) {
    revalidateDatasetPaths(projectId, datasetImportSessionId);
  } else {
    revalidateDatasetPaths(projectId);
  }
  revalidatePath(`/projects/${projectId}/dataset-import`);

  return buildDatasetImportState({
    status: importedCount > 0 || duplicateCount > 0 ? "success" : "error",
    message: buildDatasetImportOutcomeMessage(summary),
    summary,
  });
}

export async function reassignDatasetExampleSessionWithFeedback(
  datasetExampleId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = datasetExampleSessionLinkSchema.safeParse({
    sessionId: asOptionalString(formData.get("sessionId")),
  });

  if (!parsed.success) {
    return buildActionErrorState(
      getActionErrorMessage(parsed.error, "No fue posible actualizar el vínculo de chat."),
    );
  }

  const shouldUnlink = formData.get("unlink") === "1";

  let datasetExample;
  let linkedExamples: Array<{
    id: string;
    provenanceJson: Prisma.JsonValue;
  }> = [];
  let targetSessionId = "";

  try {
    datasetExample = await prisma.datasetExample.findUnique({
      where: { id: datasetExampleId },
      include: {
        sourceSlice: true,
      },
    });

    if (!datasetExample) {
      return buildActionErrorState("El dataset example ya no existe.");
    }

    linkedExamples = await prisma.datasetExample.findMany({
      where: {
        sourceSliceId: datasetExample.sourceSliceId,
      },
      select: {
        id: true,
        provenanceJson: true,
      },
    });

    targetSessionId = await resolveDatasetTargetSessionId(
      datasetExample.sourceSlice.projectId,
      shouldUnlink ? undefined : parsed.data.sessionId,
    );

    if (targetSessionId === datasetExample.sourceSlice.sessionId) {
      return buildActionRefreshSuccessState("El vínculo de chat ya estaba actualizado.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.sourceSlice.update({
        where: { id: datasetExample!.sourceSliceId },
        data: {
          sessionId: targetSessionId,
          sourceMetadataJson: updateSourceMetadataSessionId(
            datasetExample!.sourceSlice.sourceMetadataJson,
            targetSessionId,
          ),
        },
      });

      for (const linkedExample of linkedExamples) {
        await tx.datasetExample.update({
          where: { id: linkedExample.id },
          data: {
            provenanceJson: updateDatasetExampleProvenanceSessionId(
              linkedExample.provenanceJson,
              targetSessionId,
            ),
            updatedBy: "human",
          },
        });
      }
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el vínculo de chat."),
    );
  }

  revalidateDatasetPaths(
    datasetExample.sourceSlice.projectId,
    datasetExample.sourceSlice.sessionId,
    datasetExampleId,
  );
  revalidatePath(`/projects/${datasetExample.sourceSlice.projectId}/dataset-import`);

  if (targetSessionId !== datasetExample.sourceSlice.sessionId) {
    revalidatePath(`/projects/${datasetExample.sourceSlice.projectId}/sessions/${targetSessionId}`);
    revalidatePath(
      `/projects/${datasetExample.sourceSlice.projectId}/sessions/${targetSessionId}/dataset/new`,
    );
  }

  if (!shouldUnlink && parsed.data.sessionId?.trim()) {
    return buildActionRefreshSuccessState("Vínculo de chat actualizado correctamente.");
  }

  return buildActionRefreshSuccessState(
    `Dataset example movido a ${DATASET_IMPORT_SESSION_TITLE}.`,
  );
}

export async function createDatasetExample(
  projectId: string,
  sessionId: string,
  startOrderIndex: number,
  endOrderIndex: number,
  formData: FormData,
) {
  const parsed = datasetExampleSchema.parse({
    datasetSpecId: asOptionalString(formData.get("datasetSpecId")),
    title: asOptionalString(formData.get("title")),
    sourceTitle: asOptionalString(formData.get("sourceTitle")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    mappingsJson: asOptionalString(formData.get("mappingsJson")) || "[]",
    reviewStatus: formData.get("reviewStatus") || DatasetExampleReviewStatus.draft,
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  await ensureDefaultDatasetSpecs();

  const [sourceSliceDraft, datasetSpec] = await Promise.all([
    loadSourceSliceDraftFromSelection(projectId, sessionId, startOrderIndex, endOrderIndex),
    prisma.datasetSpec.findUnique({
      where: { id: parsed.datasetSpecId },
    }),
  ]);

  if (!datasetSpec) {
    throw new Error("El dataset spec seleccionado no existe.");
  }

  sourceSliceDraft.sourceSummary = parsed.sourceSummary;
  sourceSliceDraft.title = parsed.sourceTitle || sourceSliceDraft.title;

  const inputPayload = parseDatasetJsonObject(parsed.inputPayloadJson, "Input payload");
  const outputPayload = parseDatasetJsonObject(parsed.outputPayloadJson, "Output payload");
  const mappings = parseDatasetMappingsText(parsed.mappingsJson);
  const validationState = validateDatasetExamplePayload({
    datasetSpec,
    inputPayload,
    outputPayload,
  });
  const persistedMappings = buildPersistedMappings({
    mappings,
    sourceSlice: sourceSliceDraft,
  });

  const createdDatasetExample = await prisma.$transaction(async (tx) => {
    const sourceSlice = await tx.sourceSlice.create({
      data: {
        projectId,
        sessionId,
        title: sourceSliceDraft.title || null,
        conversationSliceJson: sourceSliceDraft.conversationSlice as Prisma.InputJsonValue,
        surroundingContextJson: sourceSliceDraft.surroundingContext as Prisma.InputJsonValue,
        selectedTurnIdsJson: sourceSliceDraft.selectedTurnIds as Prisma.InputJsonValue,
        lastUserMessage: sourceSliceDraft.lastUserMessage,
        sourceSummary: sourceSliceDraft.sourceSummary,
        sourceMetadataJson: sourceSliceDraft.sourceMetadata as Prisma.InputJsonValue,
      },
    });

    const datasetExample = await tx.datasetExample.create({
      data: {
        sourceSliceId: sourceSlice.id,
        datasetSpecId: datasetSpec.id,
        title: parsed.title || null,
        inputPayloadJson: inputPayload as Prisma.InputJsonValue,
        outputPayloadJson: outputPayload as Prisma.InputJsonValue,
        validationStateJson: validationState as Prisma.InputJsonValue,
        provenanceJson: {
          source_slice_id: sourceSlice.id,
          source_session_id: sessionId,
          selected_turn_ids: sourceSliceDraft.selectedTurnIds,
          mapping_count: persistedMappings.length,
          dataset_format: datasetSpec.datasetFormat,
          edited_by: parsed.updatedBy,
        } as Prisma.InputJsonValue,
        reviewStatus: parsed.reviewStatus,
        version: datasetSpec.version,
        createdBy: parsed.updatedBy,
        updatedBy: parsed.updatedBy,
      },
    });

    for (const mapping of persistedMappings) {
      await tx.datasetFieldMapping.create({
        data: {
          datasetExampleId: datasetExample.id,
          ...mapping,
        },
      });
    }

    return datasetExample;
  });

  revalidateDatasetPaths(projectId, sessionId, createdDatasetExample.id);
  redirect(`/dataset-examples/${createdDatasetExample.id}`);
}

export async function createDatasetExampleWithFeedback(
  projectId: string,
  sessionId: string,
  startOrderIndex: number,
  endOrderIndex: number,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = datasetExampleSchema.safeParse({
    datasetSpecId: asOptionalString(formData.get("datasetSpecId")),
    title: asOptionalString(formData.get("title")),
    sourceTitle: asOptionalString(formData.get("sourceTitle")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    mappingsJson: asOptionalString(formData.get("mappingsJson")) || "[]",
    reviewStatus: formData.get("reviewStatus") || DatasetExampleReviewStatus.draft,
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible guardar el dataset example."));
  }

  let sourceSliceDraft;
  let datasetSpec;

  try {
    await ensureDefaultDatasetSpecs();
    [sourceSliceDraft, datasetSpec] = await Promise.all([
      loadSourceSliceDraftFromSelection(projectId, sessionId, startOrderIndex, endOrderIndex),
      prisma.datasetSpec.findUnique({
        where: { id: parsed.data.datasetSpecId },
      }),
    ]);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible preparar el slice seleccionado."),
    );
  }

  if (!datasetSpec) {
    return buildActionErrorState("El dataset spec seleccionado no existe.");
  }

  sourceSliceDraft.sourceSummary = parsed.data.sourceSummary;
  sourceSliceDraft.title = parsed.data.sourceTitle || sourceSliceDraft.title;

  let inputPayload;
  let outputPayload;
  let mappings;

  try {
    inputPayload = parseDatasetJsonObject(parsed.data.inputPayloadJson, "Input payload");
    outputPayload = parseDatasetJsonObject(parsed.data.outputPayloadJson, "Output payload");
    mappings = parseDatasetMappingsText(parsed.data.mappingsJson);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "Los payloads y mappings deben ser JSON válidos."),
    );
  }

  const validationState = validateDatasetExamplePayload({
    datasetSpec,
    inputPayload,
    outputPayload,
  });
  const persistedMappings = buildPersistedMappings({
    mappings,
    sourceSlice: sourceSliceDraft,
  });

  let datasetExampleId = "";

  try {
    const createdDatasetExample = await prisma.$transaction(async (tx) => {
      const sourceSlice = await tx.sourceSlice.create({
        data: {
          projectId,
          sessionId,
          title: sourceSliceDraft.title || null,
          conversationSliceJson: sourceSliceDraft.conversationSlice as Prisma.InputJsonValue,
          surroundingContextJson: sourceSliceDraft.surroundingContext as Prisma.InputJsonValue,
          selectedTurnIdsJson: sourceSliceDraft.selectedTurnIds as Prisma.InputJsonValue,
          lastUserMessage: sourceSliceDraft.lastUserMessage,
          sourceSummary: sourceSliceDraft.sourceSummary,
          sourceMetadataJson: sourceSliceDraft.sourceMetadata as Prisma.InputJsonValue,
        },
      });

      const datasetExample = await tx.datasetExample.create({
        data: {
          sourceSliceId: sourceSlice.id,
          datasetSpecId: datasetSpec.id,
          title: parsed.data.title || null,
          inputPayloadJson: inputPayload as Prisma.InputJsonValue,
          outputPayloadJson: outputPayload as Prisma.InputJsonValue,
          validationStateJson: validationState as Prisma.InputJsonValue,
          provenanceJson: {
            source_slice_id: sourceSlice.id,
            source_session_id: sessionId,
            selected_turn_ids: sourceSliceDraft.selectedTurnIds,
            mapping_count: persistedMappings.length,
            dataset_format: datasetSpec.datasetFormat,
            edited_by: parsed.data.updatedBy,
          } as Prisma.InputJsonValue,
          reviewStatus: parsed.data.reviewStatus,
          version: datasetSpec.version,
          createdBy: parsed.data.updatedBy,
          updatedBy: parsed.data.updatedBy,
        },
      });

      for (const mapping of persistedMappings) {
        await tx.datasetFieldMapping.create({
          data: {
            datasetExampleId: datasetExample.id,
            ...mapping,
          },
        });
      }

      return datasetExample;
    });

    datasetExampleId = createdDatasetExample.id;
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar el dataset example."),
    );
  }

  revalidateDatasetPaths(projectId, sessionId, datasetExampleId);
  return buildActionSuccessState("Dataset example guardado correctamente.", {
    redirectTo: `/dataset-examples/${datasetExampleId}`,
    navigationMode: "push",
  });
}

export async function createDatasetExampleFromSourceSliceWithFeedback(
  projectId: string,
  sessionId: string,
  sourceSliceId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = datasetExampleSchema.safeParse({
    datasetSpecId: asOptionalString(formData.get("datasetSpecId")),
    title: asOptionalString(formData.get("title")),
    sourceTitle: asOptionalString(formData.get("sourceTitle")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    mappingsJson: asOptionalString(formData.get("mappingsJson")) || "[]",
    reviewStatus: formData.get("reviewStatus") || DatasetExampleReviewStatus.draft,
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible guardar el dataset example."));
  }

  let sourceSlice;
  let datasetSpec;
  let inputPayload;
  let outputPayload;
  let mappings;

  try {
    await ensureDefaultDatasetSpecs();
    [sourceSlice, datasetSpec] = await Promise.all([
      loadPersistedSourceSlice(projectId, sessionId, sourceSliceId),
      prisma.datasetSpec.findUnique({
        where: { id: parsed.data.datasetSpecId },
      }),
    ]);
    inputPayload = parseDatasetJsonObject(parsed.data.inputPayloadJson, "Input payload");
    outputPayload = parseDatasetJsonObject(parsed.data.outputPayloadJson, "Output payload");
    mappings = parseDatasetMappingsText(parsed.data.mappingsJson);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible preparar el slice seleccionado."),
    );
  }

  if (!datasetSpec) {
    return buildActionErrorState("El dataset spec seleccionado no existe.");
  }

  const sourceSliceDraft = {
    ...sourceSlice,
    sourceSummary: parsed.data.sourceSummary,
    title: parsed.data.sourceTitle || sourceSlice.title,
  };
  const validationState = validateDatasetExamplePayload({
    datasetSpec,
    inputPayload,
    outputPayload,
  });
  const persistedMappings = buildPersistedMappings({
    mappings,
    sourceSlice: sourceSliceDraft,
  });

  let datasetExampleId = "";

  try {
    const createdDatasetExample = await prisma.$transaction(async (tx) => {
      await tx.sourceSlice.update({
        where: { id: sourceSliceId },
        data: {
          title: parsed.data.sourceTitle || null,
          sourceSummary: parsed.data.sourceSummary,
        },
      });

      const datasetExample = await tx.datasetExample.create({
        data: {
          sourceSliceId,
          datasetSpecId: datasetSpec.id,
          title: parsed.data.title || null,
          inputPayloadJson: inputPayload as Prisma.InputJsonValue,
          outputPayloadJson: outputPayload as Prisma.InputJsonValue,
          validationStateJson: validationState as Prisma.InputJsonValue,
          provenanceJson: {
            source_slice_id: sourceSliceId,
            source_session_id: sessionId,
            selected_turn_ids: sourceSliceDraft.selectedTurnIds,
            mapping_count: persistedMappings.length,
            dataset_format: datasetSpec.datasetFormat,
            edited_by: parsed.data.updatedBy,
          } as Prisma.InputJsonValue,
          reviewStatus: parsed.data.reviewStatus,
          version: datasetSpec.version,
          createdBy: parsed.data.updatedBy,
          updatedBy: parsed.data.updatedBy,
        },
      });

      for (const mapping of persistedMappings) {
        await tx.datasetFieldMapping.create({
          data: {
            datasetExampleId: datasetExample.id,
            ...mapping,
          },
        });
      }

      return datasetExample;
    });

    datasetExampleId = createdDatasetExample.id;
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible guardar el dataset example."),
    );
  }

  revalidateDatasetPaths(projectId, sessionId, datasetExampleId);
  return buildActionSuccessState("Dataset example guardado correctamente.", {
    redirectTo: `/dataset-examples/${datasetExampleId}`,
    navigationMode: "push",
  });
}

export async function updateDatasetExample(datasetExampleId: string, formData: FormData) {
  const parsed = datasetExampleSchema.parse({
    datasetSpecId: asOptionalString(formData.get("datasetSpecId")),
    title: asOptionalString(formData.get("title")),
    sourceTitle: asOptionalString(formData.get("sourceTitle")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    mappingsJson: asOptionalString(formData.get("mappingsJson")) || "[]",
    reviewStatus: formData.get("reviewStatus") || DatasetExampleReviewStatus.draft,
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  const datasetExample = await prisma.datasetExample.findUnique({
    where: { id: datasetExampleId },
    include: {
      sourceSlice: true,
    },
  });

  if (!datasetExample) {
    throw new Error("El dataset example no existe.");
  }

  const requestedDatasetSpecId = isImportedDatasetExampleProvenance(
    datasetExample.provenanceJson,
  )
    ? datasetExample.datasetSpecId
    : parsed.datasetSpecId;

  const datasetSpec = await prisma.datasetSpec.findUnique({
    where: { id: requestedDatasetSpecId },
  });

  if (!datasetSpec) {
    throw new Error("El dataset spec seleccionado no existe.");
  }

  const inputPayload = parseDatasetJsonObject(parsed.inputPayloadJson, "Input payload");
  const outputPayload = parseDatasetJsonObject(parsed.outputPayloadJson, "Output payload");
  const mappings = parseDatasetMappingsText(parsed.mappingsJson);

  const updatedSourceSlice = sourceSliceFromPrisma({
    ...datasetExample.sourceSlice,
    sourceSummary: parsed.sourceSummary,
    title: parsed.sourceTitle || datasetExample.sourceSlice.title,
  });
  const validationState = validateDatasetExamplePayload({
    datasetSpec,
    inputPayload,
    outputPayload,
  });
  const persistedMappings = buildPersistedMappings({
    mappings,
    sourceSlice: updatedSourceSlice,
  });

  await prisma.$transaction(async (tx) => {
    await tx.sourceSlice.update({
      where: { id: datasetExample.sourceSliceId },
      data: {
        title: parsed.sourceTitle || null,
        sourceSummary: parsed.sourceSummary,
      },
    });

    await tx.datasetExample.update({
      where: { id: datasetExampleId },
      data: {
        datasetSpecId: datasetSpec.id,
        title: parsed.title || null,
        inputPayloadJson: inputPayload as Prisma.InputJsonValue,
        outputPayloadJson: outputPayload as Prisma.InputJsonValue,
        validationStateJson: validationState as Prisma.InputJsonValue,
        provenanceJson: {
          source_slice_id: datasetExample.sourceSliceId,
          source_session_id: datasetExample.sourceSlice.sessionId,
          selected_turn_ids: updatedSourceSlice.selectedTurnIds,
          mapping_count: persistedMappings.length,
          dataset_format: datasetSpec.datasetFormat,
          edited_by: parsed.updatedBy,
        } as Prisma.InputJsonValue,
        reviewStatus: parsed.reviewStatus,
        version: datasetSpec.version,
        updatedBy: parsed.updatedBy,
      },
    });

    await tx.datasetFieldMapping.deleteMany({
      where: { datasetExampleId },
    });

    for (const mapping of persistedMappings) {
      await tx.datasetFieldMapping.create({
        data: {
          datasetExampleId,
          ...mapping,
        },
      });
    }
  });

  revalidateDatasetPaths(
    datasetExample.sourceSlice.projectId,
    datasetExample.sourceSlice.sessionId,
    datasetExampleId,
  );
  redirect(`/dataset-examples/${datasetExampleId}`);
}

export async function updateDatasetExampleWithFeedback(
  datasetExampleId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = datasetExampleSchema.safeParse({
    datasetSpecId: asOptionalString(formData.get("datasetSpecId")),
    title: asOptionalString(formData.get("title")),
    sourceTitle: asOptionalString(formData.get("sourceTitle")),
    sourceSummary: asOptionalString(formData.get("sourceSummary")),
    inputPayloadJson: asOptionalString(formData.get("inputPayloadJson")),
    outputPayloadJson: asOptionalString(formData.get("outputPayloadJson")),
    mappingsJson: asOptionalString(formData.get("mappingsJson")) || "[]",
    reviewStatus: formData.get("reviewStatus") || DatasetExampleReviewStatus.draft,
    updatedBy: asOptionalString(formData.get("updatedBy")) || "human",
  });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el dataset example."));
  }

  let datasetExample;
  let datasetSpec;
  let inputPayload;
  let outputPayload;
  let mappings;

  try {
    datasetExample = await prisma.datasetExample.findUnique({
      where: { id: datasetExampleId },
      include: {
        sourceSlice: true,
      },
    });

    const requestedDatasetSpecId =
      datasetExample &&
      isImportedDatasetExampleProvenance(datasetExample.provenanceJson)
        ? datasetExample.datasetSpecId
        : parsed.data.datasetSpecId;

    datasetSpec = await prisma.datasetSpec.findUnique({
      where: { id: requestedDatasetSpecId },
    });

    inputPayload = parseDatasetJsonObject(parsed.data.inputPayloadJson, "Input payload");
    outputPayload = parseDatasetJsonObject(parsed.data.outputPayloadJson, "Output payload");
    mappings = parseDatasetMappingsText(parsed.data.mappingsJson);
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible preparar el dataset example."),
    );
  }

  if (!datasetExample) {
    return buildActionErrorState("El dataset example no existe.");
  }

  if (!datasetSpec) {
    return buildActionErrorState("El dataset spec seleccionado no existe.");
  }

  const updatedSourceSlice = sourceSliceFromPrisma({
    ...datasetExample.sourceSlice,
    sourceSummary: parsed.data.sourceSummary,
    title: parsed.data.sourceTitle || datasetExample.sourceSlice.title,
  });
  const validationState = validateDatasetExamplePayload({
    datasetSpec,
    inputPayload,
    outputPayload,
  });
  const persistedMappings = buildPersistedMappings({
    mappings,
    sourceSlice: updatedSourceSlice,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sourceSlice.update({
        where: { id: datasetExample.sourceSliceId },
        data: {
          title: parsed.data.sourceTitle || null,
          sourceSummary: parsed.data.sourceSummary,
        },
      });

      await tx.datasetExample.update({
        where: { id: datasetExampleId },
        data: {
          datasetSpecId: datasetSpec.id,
          title: parsed.data.title || null,
          inputPayloadJson: inputPayload as Prisma.InputJsonValue,
          outputPayloadJson: outputPayload as Prisma.InputJsonValue,
          validationStateJson: validationState as Prisma.InputJsonValue,
          provenanceJson: {
            source_slice_id: datasetExample.sourceSliceId,
            source_session_id: datasetExample.sourceSlice.sessionId,
            selected_turn_ids: updatedSourceSlice.selectedTurnIds,
            mapping_count: persistedMappings.length,
            dataset_format: datasetSpec.datasetFormat,
            edited_by: parsed.data.updatedBy,
          } as Prisma.InputJsonValue,
          reviewStatus: parsed.data.reviewStatus,
          version: datasetSpec.version,
          updatedBy: parsed.data.updatedBy,
        },
      });

      await tx.datasetFieldMapping.deleteMany({
        where: { datasetExampleId },
      });

      for (const mapping of persistedMappings) {
        await tx.datasetFieldMapping.create({
          data: {
            datasetExampleId,
            ...mapping,
          },
        });
      }
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el dataset example."),
    );
  }

  revalidateDatasetPaths(
    datasetExample.sourceSlice.projectId,
    datasetExample.sourceSlice.sessionId,
    datasetExampleId,
  );
  return buildActionSuccessState("Dataset example actualizado correctamente.", {
    redirectTo: `/dataset-examples/${datasetExampleId}`,
    navigationMode: "replace",
  });
}

export async function updateDatasetExampleReviewStatusWithFeedback(
  datasetExampleId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  const parsed = z
    .object({
      reviewStatus: z.enum(DATASET_EXAMPLE_STATUSES),
    })
    .safeParse({
      reviewStatus: formData.get("reviewStatus"),
    });

  if (!parsed.success) {
    return buildActionErrorState(getActionErrorMessage(parsed.error, "No fue posible actualizar el estado."));
  }

  let datasetExample;

  try {
    datasetExample = await prisma.datasetExample.update({
      where: { id: datasetExampleId },
      data: {
        reviewStatus: parsed.data.reviewStatus,
      },
      include: {
        sourceSlice: true,
      },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible actualizar el estado."),
    );
  }

  revalidateDatasetPaths(
    datasetExample.sourceSlice.projectId,
    datasetExample.sourceSlice.sessionId,
    datasetExampleId,
  );
  return buildActionRefreshSuccessState("Estado actualizado correctamente.");
}

export async function deleteDatasetExampleWithFeedback(
  datasetExampleId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  void _previousState;

  const redirectTo = asOptionalString(formData.get("redirectTo"));

  let datasetExample;

  try {
    datasetExample = await prisma.datasetExample.findUnique({
      where: { id: datasetExampleId },
      select: {
        sourceSlice: {
          select: {
            projectId: true,
            sessionId: true,
          },
        },
      },
    });

    if (!datasetExample) {
      return buildActionErrorState("El dataset example ya no existe.");
    }

    await prisma.datasetExample.delete({
      where: { id: datasetExampleId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar el dataset example."),
    );
  }

  revalidateDatasetPaths(
    datasetExample.sourceSlice.projectId,
    datasetExample.sourceSlice.sessionId,
    datasetExampleId,
  );

  if (redirectTo) {
    return buildActionSuccessState("Dataset example eliminado correctamente.", {
      redirectTo,
      navigationMode: "replace",
    });
  }

  return buildActionRefreshSuccessState("Dataset example eliminado correctamente.");
}

export async function deleteSourceSliceWithFeedback(
  sourceSliceId: string,
  _previousState: ActionFormState,
) {
  void _previousState;

  let sourceSlice;

  try {
    sourceSlice = await prisma.sourceSlice.findUnique({
      where: { id: sourceSliceId },
      select: {
        projectId: true,
        sessionId: true,
        _count: {
          select: {
            datasetExamples: true,
          },
        },
      },
    });

    if (!sourceSlice) {
      return buildActionErrorState("El slice ya no existe.");
    }

    await prisma.sourceSlice.delete({
      where: { id: sourceSliceId },
    });
  } catch (error) {
    return buildActionErrorState(
      getActionErrorMessage(error, "No fue posible eliminar el slice."),
    );
  }

  revalidateDatasetPaths(sourceSlice.projectId, sourceSlice.sessionId);

  return buildActionRefreshSuccessState(
    sourceSlice._count.datasetExamples > 0
      ? `Slice eliminado junto con ${sourceSlice._count.datasetExamples} dataset example(s) asociados.`
      : "Slice eliminado correctamente.",
  );
}

export async function exportDatasetExamples(filters?: {
  projectId?: string;
  datasetSpecId?: string;
  reviewStatus?: (typeof DATASET_EXAMPLE_STATUSES)[number];
  from?: string;
  to?: string;
  version?: string;
}) {
  const fromDate = filters?.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined;
  const toDate = filters?.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined;
  const version = filters?.version ? Number.parseInt(filters.version, 10) : undefined;

  const examples = await prisma.datasetExample.findMany({
    where: {
      ...(filters?.datasetSpecId ? { datasetSpecId: filters.datasetSpecId } : {}),
      ...(filters?.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
      ...(Number.isInteger(version) ? { version } : {}),
      ...(fromDate || toDate
        ? {
            updatedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(filters?.projectId
        ? {
            sourceSlice: {
              projectId: filters.projectId,
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      datasetSpec: {
        select: {
          slug: true,
          version: true,
        },
      },
      sourceSlice: {
        select: {
          id: true,
        },
      },
    },
  });

  return examples.map((example) =>
    toExportDatasetExample({
      datasetExampleId: example.id,
      sourceSliceId: example.sourceSlice.id,
      specSlug: example.datasetSpec.slug,
      version: example.datasetSpec.version,
      inputPayload: example.inputPayloadJson as JsonObject,
      outputPayload: example.outputPayloadJson as JsonObject,
    }),
  );
}
