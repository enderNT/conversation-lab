import type { DatasetSpec, SourceSlice } from "@prisma/client";
import {
  DEFAULT_DATASET_LLM_CONTEXT_SELECTION,
  buildDatasetFieldGenerationPrompt,
  normalizeDatasetLlmContextSelection,
} from "@/lib/dataset-llm";
import type {
  ConversationSliceItem,
  ImportedDatasetRow,
  DatasetFieldMappingRecord,
  DatasetSchemaField,
  DatasetSchemaFieldType,
  DatasetValidationState,
  ExportedDatasetExampleRow,
  JsonObject,
  JsonValue,
  SourceSliceMetadata,
  SourceSliceRecord,
} from "@/lib/types";
import { DATASET_SCHEMA_FIELD_TYPES } from "@/lib/types";

export const DATASET_IMPORT_SESSION_TITLE = "Dataset Imports";

type MessageInput = {
  id: string;
  role: ConversationSliceItem["role"];
  text: string;
  orderIndex: number;
  createdAt: Date | string;
  metadataJson?: unknown;
};

export type DatasetTemplateRenderContext = {
  side: "input" | "output";
  field: DatasetSchemaField;
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
  inputPayloadJson: string;
  outputPayloadJson: string;
};

type DatasetResolveOptions = {
  templateContext?: DatasetTemplateRenderContext;
};

type ParsedImportedDatasetRow = {
  lineNumber: number;
  row: ImportedDatasetRow | null;
  error: string | null;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyValue(value: JsonValue | undefined) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0) ||
    (isJsonObject(value) && Object.keys(value).length === 0)
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitTextareaList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseLooseJsonValue(value: string): JsonValue | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return trimmed;
  }
}

export function parseStrictJsonValue(value: string): JsonValue {
  return JSON.parse(value) as JsonValue;
}

export function stringifyJsonValue(value: unknown) {
  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function normalizeRetrievalTopK(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  const normalizedValue = Math.trunc(value);

  if (normalizedValue < 1) {
    return 1;
  }

  if (normalizedValue > 20) {
    return 20;
  }

  return normalizedValue;
}

export function toConversationSlice(messages: MessageInput[]): ConversationSliceItem[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    orderIndex: message.orderIndex,
    createdAt:
      typeof message.createdAt === "string"
        ? message.createdAt
        : message.createdAt.toISOString(),
    metadataJson: (message.metadataJson as JsonValue | null | undefined) ?? null,
  }));
}

export function toCompactConversationSlice(messages: ConversationSliceItem[]) {
  return messages.map((message) => ({
    role: message.role,
    text: message.text,
  }));
}

export function stringifyCompactConversationSlice(messages: ConversationSliceItem[]) {
  return JSON.stringify(toCompactConversationSlice(messages), null, 2);
}

export function deriveLastUserMessage(conversationSlice: ConversationSliceItem[]) {
  return [...conversationSlice]
    .reverse()
    .find((message) => message.role === "user")
    ?.text.trim() ?? "";
}

export function buildSourceSliceMetadata(input: {
  projectId: string;
  sessionId: string;
  sessionNotes?: string;
  selectedTurnIds: string[];
  startOrderIndex: number;
  endOrderIndex: number;
}): SourceSliceMetadata {
  return {
    project_id: input.projectId,
    session_id: input.sessionId,
    ...(input.sessionNotes?.trim()
      ? { session_notes: input.sessionNotes.trim() }
      : {}),
    selected_turn_ids: input.selectedTurnIds,
    selected_range: {
      start_order_index: input.startOrderIndex,
      end_order_index: input.endOrderIndex,
      turn_count: input.endOrderIndex - input.startOrderIndex + 1,
    },
    provenance: {
      source: "session_chat",
      selection_mode: "manual_range",
      conversation_version: 3,
    },
  };
}

export function canonicalizeJsonValue(value: JsonValue): string {
  const normalize = (currentValue: JsonValue): JsonValue => {
    if (Array.isArray(currentValue)) {
      return currentValue.map(normalize);
    }

    if (!isJsonObject(currentValue)) {
      return currentValue;
    }

    return Object.keys(currentValue)
      .sort((left, right) => left.localeCompare(right))
      .reduce<JsonObject>((normalizedObject, key) => {
        normalizedObject[key] = normalize(currentValue[key] as JsonValue);
        return normalizedObject;
      }, {});
  };

  return JSON.stringify(normalize(value));
}

export function buildImportedSourceSliceTitle(sourceSliceId: string) {
  return sourceSliceId.slice(0, 8);
}

export function buildImportedSourceSliceRecord(input: {
  projectId: string;
  sessionId: string;
  fileName: string;
  lineNumber: number;
}): SourceSliceRecord {
  return {
    projectId: input.projectId,
    sessionId: input.sessionId,
    title: "",
    conversationSlice: [],
    surroundingContext: [],
    selectedTurnIds: [],
    lastUserMessage: `Imported row ${input.lineNumber} from ${input.fileName}`,
    sourceSummary: `Imported from ${input.fileName} line ${input.lineNumber}.`,
    sourceMetadata: {
      project_id: input.projectId,
      session_id: input.sessionId,
      selected_turn_ids: [],
      selected_range: {
        start_order_index: 0,
        end_order_index: 0,
        turn_count: 0,
      },
      provenance: {
        source: "jsonl_import",
        selection_mode: "file_row",
        conversation_version: 1,
      },
    },
  };
}

export function buildImportedSourceSliceMetadataJson(input: {
  projectId: string;
  sessionId: string;
  fileName: string;
  lineNumber: number;
  importedAt: string;
  originalMetadata?: JsonObject;
}) {
  return {
    project_id: input.projectId,
    session_id: input.sessionId,
    selected_turn_ids: [],
    selected_range: {
      start_order_index: 0,
      end_order_index: 0,
      turn_count: 0,
    },
    provenance: {
      source: "jsonl_import",
      selection_mode: "file_row",
      conversation_version: 1,
    },
    import: {
      file_name: input.fileName,
      line_number: input.lineNumber,
      imported_at: input.importedAt,
    },
    ...(input.originalMetadata ? { original_metadata: input.originalMetadata } : {}),
  } satisfies JsonObject;
}

export function parseImportedDatasetText(value: string): ParsedImportedDatasetRow[] {
  return value
    .split(/\r?\n/)
    .map((line, index) => ({
      lineNumber: index + 1,
      line,
    }))
    .filter(({ line }) => line.trim().length > 0)
    .map<ParsedImportedDatasetRow>(({ lineNumber, line }) => {
      let parsedValue: JsonValue;

      try {
        parsedValue = JSON.parse(line) as JsonValue;
      } catch {
        return {
          lineNumber,
          row: null,
          error: "La línea no contiene JSON válido.",
        };
      }

      if (!isJsonObject(parsedValue)) {
        return {
          lineNumber,
          row: null,
          error: "La línea debe ser un objeto JSON.",
        };
      }

      const inputValue = parsedValue.input as JsonValue | undefined;
      const outputValue = parsedValue.output as JsonValue | undefined;
      const metadataValue = parsedValue.metadata as JsonValue | undefined;

      if (!isJsonObject(inputValue)) {
        return {
          lineNumber,
          row: null,
          error: "`input` debe ser un objeto JSON.",
        };
      }

      if (!isJsonObject(outputValue)) {
        return {
          lineNumber,
          row: null,
          error: "`output` debe ser un objeto JSON.",
        };
      }

      if (metadataValue !== undefined && !isJsonObject(metadataValue)) {
        return {
          lineNumber,
          row: null,
          error: "`metadata` debe ser un objeto JSON cuando existe.",
        };
      }

      return {
        lineNumber,
        row: {
          input: inputValue,
          output: outputValue,
          ...(metadataValue ? { metadata: metadataValue } : {}),
        },
        error: null,
      };
    });
}

export function parseTransformChainText(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeTransformChain(value: string[]) {
  return value.join(" | ");
}

function parseValueText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return trimmed;
  }
}

function tokenizePath(path: string) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function getValueAtPath(
  value: JsonValue | undefined,
  path: string,
): JsonValue | undefined {
  if (!path.trim()) {
    return value;
  }

  return tokenizePath(path).reduce<JsonValue | undefined>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (isJsonObject(current)) {
      return current[segment];
    }

    return undefined;
  }, value);
}

function resolveSourceValue(
  sourceSlice: SourceSliceRecord,
  mapping: DatasetFieldMappingRecord,
  options?: DatasetResolveOptions,
): JsonValue | undefined {
  const sourceMetadata = sourceSlice.sourceMetadata as SourceSliceMetadata;

  switch (mapping.sourceKey) {
    case "source.last_user_message":
      return sourceSlice.lastUserMessage;
    case "source.conversation_slice":
      return toCompactConversationSlice(sourceSlice.conversationSlice) as unknown as JsonValue;
    case "source.surrounding_context":
      return toCompactConversationSlice(sourceSlice.surroundingContext) as unknown as JsonValue;
    case "source.source_summary":
      return sourceSlice.sourceSummary;
    case "source.session_notes":
      return sourceMetadata.session_notes ?? "";
    case "llm_generated":
      return parseValueText(mapping.llmGeneratedValueText);
    case "rag_generated":
      return parseValueText(mapping.ragGeneratedValueText);
    case "constant":
      return parseValueText(mapping.constantValueText);
    case "manual": {
      const nextManualValue = options?.templateContext
        ? buildDatasetFieldGenerationPrompt({
            side: options.templateContext.side,
            field: options.templateContext.field,
            datasetSpecName: options.templateContext.datasetSpecName,
            datasetSpecSlug: options.templateContext.datasetSpecSlug,
            datasetSpecDescription: options.templateContext.datasetSpecDescription,
            promptText: mapping.manualValueText,
            lastUserMessage: sourceSlice.lastUserMessage,
            sourceSummary: sourceSlice.sourceSummary,
            sessionNotes: sourceMetadata.session_notes ?? "",
            conversationSliceJson: stringifyCompactConversationSlice(sourceSlice.conversationSlice),
            surroundingContextJson: stringifyCompactConversationSlice(sourceSlice.surroundingContext),
            inputPayloadJson: options.templateContext.inputPayloadJson,
            outputPayloadJson: options.templateContext.outputPayloadJson,
          }).promptText
        : mapping.manualValueText;

      return parseValueText(nextManualValue);
    }
    default:
      return undefined;
  }
}

function pickTurns(value: JsonValue | undefined, selector: string): JsonValue | undefined {
  if (!Array.isArray(value)) {
    return value;
  }

  const trimmed = selector.trim();

  if (!trimmed) {
    return value;
  }

  const values = trimmed
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const selectedIndexes = new Set<number>();

  for (const item of values) {
    if (item.includes("-")) {
      const [startText, endText] = item.split("-", 2);
      const start = Number.parseInt(startText ?? "", 10);
      const end = Number.parseInt(endText ?? "", 10);

      if (Number.isInteger(start) && Number.isInteger(end)) {
        for (let index = start; index <= end; index += 1) {
          selectedIndexes.add(index);
        }
      }

      continue;
    }

    const index = Number.parseInt(item, 10);

    if (Number.isInteger(index)) {
      selectedIndexes.add(index);
    }
  }

  return value.filter((_, index) => selectedIndexes.has(index));
}

function applyTemplate(value: JsonValue | undefined, template: string, sourceSlice: SourceSliceRecord) {
  const replacements: Record<string, string> = {
    value: value === undefined ? "" : stringifyJsonValue(value),
    last_user_message: sourceSlice.lastUserMessage,
    source_summary: sourceSlice.sourceSummary,
    session_notes: sourceSlice.sourceMetadata.session_notes ?? "",
  };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, token: string) => replacements[token] ?? "");
}

function applyTransform(
  currentValue: JsonValue | undefined,
  transform: string,
  sourceSlice: SourceSliceRecord,
) {
  const [transformName, ...rest] = transform.split(":");
  const argument = rest.join(":").trim();

  switch (transformName.trim()) {
    case "trim":
      return typeof currentValue === "string" ? currentValue.trim() : currentValue;
    case "join_lines":
      return Array.isArray(currentValue)
        ? currentValue.map((item) => stringifyJsonValue(item)).join("\n")
        : currentValue;
    case "pick_path":
      return getValueAtPath(currentValue, argument);
    case "pick_turns":
      return pickTurns(currentValue, argument);
    case "wrap_array":
      return Array.isArray(currentValue) ? currentValue : currentValue === undefined ? [] : [currentValue];
    case "to_string":
      return currentValue === undefined ? "" : stringifyJsonValue(currentValue);
    case "to_boolean":
      if (typeof currentValue === "boolean") {
        return currentValue;
      }

      if (typeof currentValue === "number") {
        return currentValue !== 0;
      }

      if (typeof currentValue === "string") {
        const normalized = currentValue.trim().toLowerCase();
        return ["true", "1", "yes", "si", "sí"].includes(normalized);
      }

      return Boolean(currentValue);
    case "template":
      return applyTemplate(currentValue, argument, sourceSlice);
    default:
      return currentValue;
  }
}

export function resolveFieldMapping(
  sourceSlice: SourceSliceRecord,
  mapping: DatasetFieldMappingRecord,
  options?: DatasetResolveOptions,
): JsonValue | undefined {
  let resolvedValue = resolveSourceValue(sourceSlice, mapping, options);

  if (mapping.sourcePath.trim()) {
    resolvedValue = getValueAtPath(resolvedValue, mapping.sourcePath);
  }

  for (const transform of mapping.transformChain) {
    resolvedValue = applyTransform(resolvedValue, transform, sourceSlice);
  }

  return resolvedValue;
}

export function buildPayloadFromMappings(input: {
  side: "input" | "output";
  sourceSlice: SourceSliceRecord;
  schema: DatasetSchemaField[];
  mappings: DatasetFieldMappingRecord[];
  templateContextFactory?: (
    field: DatasetSchemaField,
    side: "input" | "output",
  ) => DatasetTemplateRenderContext | undefined;
}) {
  return input.schema.reduce<JsonObject>((payload, field) => {
    const mapping = input.mappings.find(
      (item) => item.side === input.side && item.fieldKey === field.key,
    );

    if (!mapping) {
      return payload;
    }

    const resolvedValue = resolveFieldMapping(input.sourceSlice, mapping, {
      templateContext: input.templateContextFactory?.(field, input.side),
    });

    if (resolvedValue !== undefined) {
      payload[field.key] = resolvedValue;
    }

    return payload;
  }, {});
}

function validateFieldType(
  field: DatasetSchemaField,
  value: JsonValue | undefined,
  label: string,
) {
  const errors: string[] = [];

  if (value === undefined) {
    if (field.required) {
      errors.push(`${label}.${field.key} is required.`);
    }

    return errors;
  }

  switch (field.type) {
    case "string":
      if (typeof value !== "string") {
        errors.push(`${label}.${field.key} must be a string.`);
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push(`${label}.${field.key} must be an integer.`);
      }
      break;
    case "number":
      if (typeof value !== "number") {
        errors.push(`${label}.${field.key} must be a number.`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(`${label}.${field.key} must be a boolean.`);
      }
      break;
    case "object":
      if (!isJsonObject(value)) {
        errors.push(`${label}.${field.key} must be an object.`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        errors.push(`${label}.${field.key} must be an array.`);
      }
      break;
    case "null":
      if (value !== null) {
        errors.push(`${label}.${field.key} must be null.`);
      }
      break;
    case "enum":
      if (typeof value !== "string") {
        errors.push(`${label}.${field.key} must be a string enum value.`);
      } else if (field.enumValues?.length && !field.enumValues.includes(value)) {
        errors.push(`${label}.${field.key} must match one of: ${field.enumValues.join(", ")}.`);
      }
      break;
    case "datetime":
      if (
        typeof value !== "string" ||
        Number.isNaN(Date.parse(value))
      ) {
        errors.push(`${label}.${field.key} must be an ISO datetime string.`);
      }
      break;
    case "conversation_turns":
      if (!Array.isArray(value)) {
        errors.push(`${label}.${field.key} must be an array of conversation turns.`);
      }
      break;
    default:
      break;
  }

  return errors;
}

export function validatePayloadAgainstSchema(
  payload: JsonObject,
  schema: DatasetSchemaField[],
  label: string,
) {
  return schema.flatMap((field) => validateFieldType(field, payload[field.key], label));
}

export function validateDatasetExample(input: {
  datasetSpec: Pick<DatasetSpec, "inputSchemaJson" | "outputSchemaJson" | "validationRulesJson">;
  inputPayload: JsonObject;
  outputPayload: JsonObject;
}) {
  const inputSchema = parseDatasetSchema(input.datasetSpec.inputSchemaJson);
  const outputSchema = parseDatasetSchema(input.datasetSpec.outputSchemaJson);
  const validationRules = parseJsonObject(input.datasetSpec.validationRulesJson);

  const structuralErrors = [
    ...validatePayloadAgainstSchema(input.inputPayload, inputSchema, "input"),
    ...validatePayloadAgainstSchema(input.outputPayload, outputSchema, "output"),
  ];
  const semanticWarnings: string[] = [];

  const nonEmptyFields = Array.isArray(validationRules.nonEmptyFields)
    ? validationRules.nonEmptyFields.filter((item): item is string => typeof item === "string")
    : [];

  for (const fieldKey of nonEmptyFields) {
    const value = input.inputPayload[fieldKey] ?? input.outputPayload[fieldKey];

    if (isEmptyValue(value)) {
      semanticWarnings.push(`${fieldKey} should not be empty.`);
    }
  }

  return {
    structuralErrors,
    semanticWarnings,
    shapeMatches: structuralErrors.length === 0,
  } satisfies DatasetValidationState;
}

export function toExportDatasetExample(input: {
  datasetExampleId: string;
  sourceSliceId: string;
  specSlug: string;
  version: number;
  inputPayload: JsonObject;
  outputPayload: JsonObject;
}) {
  return {
    input: input.inputPayload,
    output: input.outputPayload,
    metadata: {
      spec: input.specSlug,
      version: input.version,
      sourceSliceId: input.sourceSliceId,
      datasetExampleId: input.datasetExampleId,
    },
  } satisfies ExportedDatasetExampleRow;
}

function parseJsonObject(value: unknown) {
  return isJsonObject(value as JsonValue) ? (value as JsonObject) : {};
}

export function parseConversationSlice(
  value: JsonValue | null | undefined,
): ConversationSliceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is JsonObject => isJsonObject(item))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      role: item.role === "assistant" ? "assistant" : "user",
      text: typeof item.text === "string" ? item.text : "",
      orderIndex: typeof item.orderIndex === "number" ? item.orderIndex : 0,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
      metadataJson: (item.metadataJson as JsonValue | undefined) ?? null,
    }));
}

export function parseDatasetSchema(value: unknown): DatasetSchemaField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is JsonObject => isJsonObject(item))
    .map<DatasetSchemaField>((item) => ({
      key: typeof item.key === "string" ? item.key : "",
      type:
        typeof item.type === "string" &&
        DATASET_SCHEMA_FIELD_TYPES.includes(item.type as DatasetSchemaFieldType)
          ? (item.type as DatasetSchemaFieldType)
          : ("string" as DatasetSchemaFieldType),
      required: item.required === true,
      description: typeof item.description === "string" ? item.description : "",
      enumValues: Array.isArray(item.enumValues)
        ? item.enumValues.filter((entry): entry is string => typeof entry === "string")
        : undefined,
    }))
    .filter((field) => field.key.trim().length > 0);
}

export function parseSourceMetadata(value: JsonValue | null | undefined): SourceSliceMetadata {
  const record = parseJsonObject(value);

  return {
    project_id: typeof record.project_id === "string" ? record.project_id : "",
    session_id: typeof record.session_id === "string" ? record.session_id : "",
    ...(typeof record.session_notes === "string"
      ? { session_notes: record.session_notes }
      : {}),
    selected_turn_ids: Array.isArray(record.selected_turn_ids)
      ? record.selected_turn_ids.filter((item): item is string => typeof item === "string")
      : [],
    selected_range: isJsonObject(record.selected_range)
      ? {
          start_order_index:
            typeof record.selected_range.start_order_index === "number"
              ? record.selected_range.start_order_index
              : 0,
          end_order_index:
            typeof record.selected_range.end_order_index === "number"
              ? record.selected_range.end_order_index
              : 0,
          turn_count:
            typeof record.selected_range.turn_count === "number"
              ? record.selected_range.turn_count
              : 0,
        }
      : {
          start_order_index: 0,
          end_order_index: 0,
          turn_count: 0,
        },
    provenance: isJsonObject(record.provenance)
      ? {
          source: typeof record.provenance.source === "string" ? record.provenance.source : "session_chat",
          selection_mode:
            typeof record.provenance.selection_mode === "string"
              ? record.provenance.selection_mode
              : "manual_range",
          conversation_version:
            typeof record.provenance.conversation_version === "number"
              ? record.provenance.conversation_version
              : 3,
        }
      : {
          source: "session_chat",
          selection_mode: "manual_range",
          conversation_version: 3,
        },
  };
}

export function parseValidationState(value: JsonValue | null | undefined): DatasetValidationState {
  const record = parseJsonObject(value);

  return {
    structuralErrors: Array.isArray(record.structuralErrors)
      ? record.structuralErrors.filter((item): item is string => typeof item === "string")
      : [],
    semanticWarnings: Array.isArray(record.semanticWarnings)
      ? record.semanticWarnings.filter((item): item is string => typeof item === "string")
      : [],
    shapeMatches: record.shapeMatches === true,
  };
}

export function sourceSliceFromPrisma(
  sourceSlice: Pick<
    SourceSlice,
    | "id"
    | "projectId"
    | "sessionId"
    | "title"
    | "conversationSliceJson"
    | "surroundingContextJson"
    | "selectedTurnIdsJson"
    | "lastUserMessage"
    | "sourceSummary"
    | "sourceMetadataJson"
  >,
): SourceSliceRecord {
  return {
    id: sourceSlice.id,
    projectId: sourceSlice.projectId,
    sessionId: sourceSlice.sessionId,
    title: sourceSlice.title ?? "",
    conversationSlice: parseConversationSlice(sourceSlice.conversationSliceJson as JsonValue),
    surroundingContext: parseConversationSlice(sourceSlice.surroundingContextJson as JsonValue),
    selectedTurnIds: Array.isArray(sourceSlice.selectedTurnIdsJson)
      ? sourceSlice.selectedTurnIdsJson.filter((item): item is string => typeof item === "string")
      : [],
    lastUserMessage: sourceSlice.lastUserMessage,
    sourceSummary: sourceSlice.sourceSummary,
    sourceMetadata: parseSourceMetadata(sourceSlice.sourceMetadataJson as JsonValue),
  };
}

function inferDefaultSource(field: DatasetSchemaField) {
  const normalizedKey = field.key.toLowerCase();

  if (field.type === "conversation_turns" || /(history|conversation|turns)/.test(normalizedKey)) {
    return "source.conversation_slice" as const;
  }

  if (/(question|last_user|prompt|user_message)/.test(normalizedKey)) {
    return "source.last_user_message" as const;
  }

  if (/(context|background)/.test(normalizedKey)) {
    return "source.surrounding_context" as const;
  }

  if (/(summary|notes)/.test(normalizedKey)) {
    return "source.source_summary" as const;
  }

  return "manual" as const;
}

function inferDefaultTransforms(field: DatasetSchemaField, sourceKey: DatasetFieldMappingRecord["sourceKey"]) {
  if (
    field.type === "string" &&
    sourceKey !== "manual" &&
    sourceKey !== "constant" &&
    sourceKey !== "llm_generated" &&
    sourceKey !== "rag_generated"
  ) {
    return ["trim"];
  }

  return [];
}

export function buildDefaultMappings(schema: DatasetSchemaField[], side: "input" | "output") {
  return schema.map<DatasetFieldMappingRecord>((field) => {
    const sourceKey = inferDefaultSource(field);

    return {
      side,
      fieldKey: field.key,
      sourceKey,
      sourcePath: "",
      transformChain: inferDefaultTransforms(field, sourceKey),
      constantValueText: "",
      manualValueText: "",
      llmConfigurationId: "",
      llmPromptText: "",
      llmContextSelection: DEFAULT_DATASET_LLM_CONTEXT_SELECTION,
      llmGeneratedValueText: "",
      ragConfigurationId: "",
      ragPromptText: "",
      ragTopK: 1,
      ragGeneratedValueText: "",
    };
  });
}

export function buildImportedDatasetMappings(input: {
  inputSchema: DatasetSchemaField[];
  outputSchema: DatasetSchemaField[];
  inputPayload: JsonObject;
  outputPayload: JsonObject;
}) {
  const buildMappingsForSide = (
    schema: DatasetSchemaField[],
    side: "input" | "output",
    payload: JsonObject,
  ) =>
    schema.map<DatasetFieldMappingRecord>((field) => ({
      side,
      fieldKey: field.key,
      sourceKey: "manual",
      sourcePath: "",
      transformChain: [],
      constantValueText: "",
      manualValueText:
        payload[field.key] === undefined ? "" : stringifyJsonValue(payload[field.key]),
      llmConfigurationId: "",
      llmPromptText: "",
      llmContextSelection: DEFAULT_DATASET_LLM_CONTEXT_SELECTION,
      llmGeneratedValueText: "",
      ragConfigurationId: "",
      ragPromptText: "",
      ragTopK: 1,
      ragGeneratedValueText: "",
    }));

  return [
    ...buildMappingsForSide(input.inputSchema, "input", input.inputPayload),
    ...buildMappingsForSide(input.outputSchema, "output", input.outputPayload),
  ];
}

export function hydrateMappingsFromStored(input: {
  inputSchema: DatasetSchemaField[];
  outputSchema: DatasetSchemaField[];
  storedMappings?: Array<{
    side: "input" | "output";
    fieldKey: string;
    sourceKey: string;
    sourcePath: string | null;
    transformChainJson: JsonValue;
    constantValueJson: JsonValue | null;
    manualValueJson: JsonValue | null;
    llmConfigurationId?: string | null;
    llmPromptText?: string | null;
    llmContextSelectionJson?: JsonValue | null;
    llmGeneratedValueJson?: JsonValue | null;
      llmGenerationMetaJson?: JsonValue | null;
      ragConfigurationId?: string | null;
      ragPromptText?: string | null;
      ragGeneratedValueJson?: JsonValue | null;
      ragGenerationMetaJson?: JsonValue | null;
    resolvedPreviewJson: JsonValue | null;
  }>;
}) {
  const defaults = [
    ...buildDefaultMappings(input.inputSchema, "input"),
    ...buildDefaultMappings(input.outputSchema, "output"),
  ];

  if (!input.storedMappings?.length) {
    return defaults;
  }

  const storedMap = new Map(
    input.storedMappings.map((mapping) => [
      `${mapping.side}:${mapping.fieldKey}`,
      mapping,
    ]),
  );

  return defaults.map((defaultMapping) => {
    const stored = storedMap.get(`${defaultMapping.side}:${defaultMapping.fieldKey}`);

    if (!stored) {
      return defaultMapping;
    }

    return {
      ...defaultMapping,
      sourceKey: stored.sourceKey as DatasetFieldMappingRecord["sourceKey"],
      sourcePath: stored.sourcePath ?? "",
      transformChain: Array.isArray(stored.transformChainJson)
        ? stored.transformChainJson.filter((item): item is string => typeof item === "string")
        : [],
      constantValueText: stringifyJsonValue(stored.constantValueJson as JsonValue | undefined),
      manualValueText: stringifyJsonValue(stored.manualValueJson as JsonValue | undefined),
      llmConfigurationId: stored.llmConfigurationId ?? "",
      llmPromptText: stored.llmPromptText ?? "",
      llmContextSelection: normalizeDatasetLlmContextSelection(stored.llmContextSelectionJson),
      llmGeneratedValueText: stringifyJsonValue(stored.llmGeneratedValueJson as JsonValue | undefined),
      llmGenerationMeta: (stored.llmGenerationMetaJson as JsonValue | undefined) ?? undefined,
      ragConfigurationId: stored.ragConfigurationId ?? "",
      ragPromptText: stored.ragPromptText ?? "",
      ragTopK:
        isJsonObject(stored.ragGenerationMetaJson as JsonValue)
          ? normalizeRetrievalTopK(
              (stored.ragGenerationMetaJson as JsonObject).topK,
            )
          : 1,
      ragGeneratedValueText: stringifyJsonValue(stored.ragGeneratedValueJson as JsonValue | undefined),
      ragGenerationMeta: (stored.ragGenerationMetaJson as JsonValue | undefined) ?? undefined,
      resolvedPreview: (stored.resolvedPreviewJson as JsonValue | undefined) ?? undefined,
    };
  });
}

export function datasetSpecFromPrisma(
  datasetSpec: Pick<
    DatasetSpec,
    | "id"
    | "name"
    | "slug"
    | "description"
    | "datasetFormat"
    | "inputSchemaJson"
    | "outputSchemaJson"
    | "mappingHintsJson"
    | "validationRulesJson"
    | "exportConfigJson"
    | "isActive"
    | "version"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return {
    id: datasetSpec.id,
    name: datasetSpec.name,
    slug: datasetSpec.slug,
    description: datasetSpec.description,
    datasetFormat: datasetSpec.datasetFormat,
    inputSchema: parseDatasetSchema(datasetSpec.inputSchemaJson as JsonValue),
    outputSchema: parseDatasetSchema(datasetSpec.outputSchemaJson as JsonValue),
    mappingHints: (datasetSpec.mappingHintsJson as JsonValue) ?? {},
    validationRules: (datasetSpec.validationRulesJson as JsonValue) ?? {},
    exportConfig: (datasetSpec.exportConfigJson as JsonValue) ?? {},
    isActive: datasetSpec.isActive,
    version: datasetSpec.version,
    createdAt: datasetSpec.createdAt.toISOString(),
    updatedAt: datasetSpec.updatedAt.toISOString(),
  };
}

export function buildJsonl(rows: ExportedDatasetExampleRow[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

export function replaceTemplatePlaceholders(
  template: string,
  replacements: Record<string, string>,
) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"), value),
    template,
  );
}
