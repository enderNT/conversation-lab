import type {
  ArtifactType,
  Case,
  CaseArtifact,
  DerivedExample,
  Prisma,
  TaskSpec,
} from "@prisma/client";
import {
  ARTIFACT_TYPES,
  type CaseArtifactInput,
  type CaseInterpretation,
  type ConversationSliceItem,
  type DerivedExamplePreview,
  type ExportedCase,
  type ExportedDerivedExample,
  type SourceMetadata,
  type TaskSchemaField,
  type ValidationState,
} from "@/lib/types";

function asRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function asArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: Prisma.JsonValue | null | undefined) {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

function toArtifactTypeArray(value: Prisma.JsonValue | null | undefined) {
  return toStringArray(value).filter((item): item is ArtifactType =>
    ARTIFACT_TYPES.includes(item as ArtifactType),
  );
}

export function parseConversationSlice(
  value: Prisma.JsonValue | null | undefined,
) {
  if (!Array.isArray(value)) {
    return [] as ConversationSliceItem[];
  }

  return value as ConversationSliceItem[];
}

export function parseInterpretation(
  value: Prisma.JsonValue | null | undefined,
): CaseInterpretation {
  const record = asRecord(value);

  return {
    main_intent:
      typeof record.main_intent === "string" ? record.main_intent : "",
    subtask_candidates: toStringArray(record.subtask_candidates),
    why_this_case_is_useful:
      typeof record.why_this_case_is_useful === "string"
        ? record.why_this_case_is_useful
        : "",
    ambiguity_level:
      typeof record.ambiguity_level === "string" ? record.ambiguity_level : "",
    difficulty_level:
      typeof record.difficulty_level === "string" ? record.difficulty_level : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    llm_errors_detected: toStringArray(record.llm_errors_detected),
  };
}

export function parseSourceMetadata(
  value: Prisma.JsonValue | null | undefined,
): SourceMetadata {
  const record = asRecord(value);
  const selectedRange = asRecord(record.selected_range);
  const provenance = asRecord(record.provenance);

  return {
    project_id: typeof record.project_id === "string" ? record.project_id : "",
    session_id: typeof record.session_id === "string" ? record.session_id : "",
    session_notes:
      typeof record.session_notes === "string" ? record.session_notes : "",
    selected_turn_ids: toStringArray(record.selected_turn_ids),
    selected_range: {
      start_order_index:
        typeof selectedRange.start_order_index === "number"
          ? selectedRange.start_order_index
          : 0,
      end_order_index:
        typeof selectedRange.end_order_index === "number"
          ? selectedRange.end_order_index
          : 0,
      turn_count:
        typeof selectedRange.turn_count === "number" ? selectedRange.turn_count : 0,
    },
    provenance: {
      source: typeof provenance.source === "string" ? provenance.source : "session_chat",
      selection_mode:
        typeof provenance.selection_mode === "string"
          ? provenance.selection_mode
          : "manual_range",
      conversation_version:
        typeof provenance.conversation_version === "number"
          ? provenance.conversation_version
          : 2,
    },
  };
}

export function parseTaskCandidates(value: Prisma.JsonValue | null | undefined) {
  return toStringArray(value);
}

export function parseTaskSchema(value: Prisma.JsonValue | null | undefined) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);

      return {
        key: typeof record.key === "string" ? record.key : "",
        type: typeof record.type === "string" ? record.type : "json",
        required: record.required === true,
        description:
          typeof record.description === "string" ? record.description : "",
      } as TaskSchemaField;
    })
    .filter((field) => field.key.length > 0);
}

export function parseValidationState(
  value: Prisma.JsonValue | null | undefined,
): ValidationState {
  const record = asRecord(value);

  return {
    structuralErrors: toStringArray(record.structuralErrors),
    semanticWarnings: toStringArray(record.semanticWarnings),
    missingArtifacts: toArtifactTypeArray(record.missingArtifacts),
    shapeMatches: record.shapeMatches === true,
  };
}

export function deriveLastUserMessage(slice: ConversationSliceItem[]) {
  const latestUserMessage = [...slice].reverse().find((item) => item.role === "user");

  return latestUserMessage?.text ?? "";
}

export function deriveRecentHistory(slice: ConversationSliceItem[]) {
  const lastUserTurn = [...slice].reverse().find((item) => item.role === "user");

  if (!lastUserTurn) {
    return slice.map((item) => ({ role: item.role, text: item.text }));
  }

  return slice
    .filter((item) => item.orderIndex < lastUserTurn.orderIndex)
    .map((item) => ({ role: item.role, text: item.text }));
}

export function toConversationSlice(
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    text: string;
    orderIndex: number;
    createdAt: Date;
    metadataJson: Prisma.JsonValue | null;
  }>,
) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    orderIndex: message.orderIndex,
    createdAt: message.createdAt.toISOString(),
    metadataJson: message.metadataJson,
  })) satisfies ConversationSliceItem[];
}

export function splitTextareaList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stringifyJsonValue(value: Prisma.JsonValue | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function parseLooseJsonValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as Prisma.JsonValue;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function parseStrictJsonValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {} as Prisma.JsonObject;
  }

  return JSON.parse(trimmed) as Prisma.JsonValue;
}

export function buildSourceMetadata(input: {
  projectId: string;
  sessionId: string;
  sessionNotes?: string | null;
  selectedTurnIds: string[];
  startOrderIndex: number;
  endOrderIndex: number;
}) {
  const normalizedSessionNotes = input.sessionNotes?.trim() ?? "";

  return {
    project_id: input.projectId,
    session_id: input.sessionId,
    ...(normalizedSessionNotes ? { session_notes: normalizedSessionNotes } : {}),
    selected_turn_ids: input.selectedTurnIds,
    selected_range: {
      start_order_index: input.startOrderIndex,
      end_order_index: input.endOrderIndex,
      turn_count: input.endOrderIndex - input.startOrderIndex + 1,
    },
    provenance: {
      source: "session_chat",
      selection_mode: "manual_range",
      conversation_version: 2,
    },
  } satisfies SourceMetadata;
}

export function buildProjectionStatus(taskCandidateIds: string[], derivedExampleCount: number) {
  if (derivedExampleCount > 0) {
    return "projected" as const;
  }

  if (taskCandidateIds.length > 0) {
    return "previewed" as const;
  }

  return "not_started" as const;
}

export function getArtifactMap(
  artifacts: Array<Pick<CaseArtifact, "type" | "valueJson" | "notes" | "confidence" | "provenanceJson">>,
) {
  return new Map(
    artifacts.map((artifact) => [
      artifact.type,
      {
        type: artifact.type,
        value: artifact.valueJson,
        notes: artifact.notes ?? "",
        confidence: artifact.confidence ?? null,
        provenance: artifact.provenanceJson ?? null,
      } satisfies CaseArtifactInput,
    ]),
  );
}

export function getArtifactValueAsString(
  artifacts: Array<Pick<CaseArtifact, "type" | "valueJson">>,
  type: ArtifactType,
) {
  const artifact = artifacts.find((item) => item.type === type);

  if (!artifact || artifact.valueJson === null) {
    return "";
  }

  return typeof artifact.valueJson === "string"
    ? artifact.valueJson
    : JSON.stringify(artifact.valueJson);
}

export function parseRequiredArtifacts(value: Prisma.JsonValue | null | undefined) {
  return toArtifactTypeArray(value);
}

function schemaFieldMatchesType(value: Prisma.JsonValue | undefined, type: TaskSchemaField["type"]) {
  if (value === undefined || value === null) {
    return false;
  }

  switch (type) {
    case "string":
      return typeof value === "string";
    case "string[]":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "boolean":
      return typeof value === "boolean";
    case "conversation_turns":
      return (
        Array.isArray(value) &&
        value.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            typeof asRecord(item).role === "string" &&
            typeof asRecord(item).text === "string",
        )
      );
    case "string_or_none":
      return typeof value === "string";
    case "json":
    default:
      return true;
  }
}

function validateAgainstSchema(
  payload: Record<string, Prisma.JsonValue>,
  schema: TaskSchemaField[],
  label: string,
) {
  const errors: string[] = [];

  for (const field of schema) {
    const value = payload[field.key];

    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`${label} is missing required field \`${field.key}\`.`);
      continue;
    }

    if (value !== undefined && value !== null && !schemaFieldMatchesType(value, field.type)) {
      errors.push(`${label} field \`${field.key}\` does not match expected type ${field.type}.`);
    }
  }

  return errors;
}

function normalizeMemoryWriteDecision(value: Prisma.JsonValue | null | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = asRecord(value);

    return {
      write_memory: record.write_memory === true,
      memory_payload:
        record.memory_payload !== undefined ? record.memory_payload : null,
    };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    return {
      write_memory: normalized === "yes" || normalized === "true",
      memory_payload: null,
    };
  }

  return {
    write_memory: false,
    memory_payload: null,
  };
}

function buildGenericPayloadValue(key: string, source: ReturnType<typeof buildProjectionSource>) {
  switch (key) {
    case "recent_history":
      return source.recentHistory;
    case "last_user_message":
      return source.lastUserMessage;
    case "intent":
      return source.interpretation.main_intent;
    case "constraints":
      return source.constraints;
    case "retrieved_context":
      return source.relevantContext;
    case "state":
      return source.stateAssumptions;
    case "search_query":
      return source.idealSearchQuery;
    case "answer":
      return source.idealAnswer;
    case "route":
      return source.expectedRoute;
    case "tool_name":
      return source.expectedTool || "none";
    case "write_memory":
      return source.memoryDecision.write_memory;
    case "memory_payload":
      return source.memoryDecision.memory_payload;
    default:
      return null;
  }
}

function buildProjectionSource(
  caseRecord: Pick<Case, "conversationSliceJson" | "lastUserMessage" | "interpretationJson">,
  artifacts: Array<Pick<CaseArtifact, "type" | "valueJson" | "notes" | "confidence" | "provenanceJson">>,
) {
  const artifactMap = getArtifactMap(artifacts);
  const conversationSlice = parseConversationSlice(caseRecord.conversationSliceJson);
  const interpretation = parseInterpretation(caseRecord.interpretationJson);
  const memoryDecision = normalizeMemoryWriteDecision(
    artifactMap.get("memory_write_decision")?.value,
  );

  return {
    conversationSlice,
    recentHistory: deriveRecentHistory(conversationSlice),
    lastUserMessage: caseRecord.lastUserMessage || deriveLastUserMessage(conversationSlice),
    interpretation,
    idealSearchQuery:
      typeof artifactMap.get("ideal_search_query")?.value === "string"
        ? (artifactMap.get("ideal_search_query")?.value as string)
        : "",
    idealAnswer:
      typeof artifactMap.get("ideal_answer")?.value === "string"
        ? (artifactMap.get("ideal_answer")?.value as string)
        : "",
    expectedRoute:
      typeof artifactMap.get("expected_route")?.value === "string"
        ? (artifactMap.get("expected_route")?.value as string)
        : "",
    expectedTool:
      typeof artifactMap.get("expected_tool")?.value === "string"
        ? (artifactMap.get("expected_tool")?.value as string)
        : "",
    relevantContext: artifactMap.get("relevant_context")?.value ?? "",
    constraints: artifactMap.get("policy_flags")?.value ?? "",
    stateAssumptions: artifactMap.get("state_assumptions")?.value ?? null,
    memoryDecision,
  };
}

function buildSemanticWarnings(input: {
  taskSpec: Pick<TaskSpec, "taskType" | "validationRulesJson">;
  preview: Pick<DerivedExamplePreview, "inputPayload" | "outputPayload">;
  missingArtifacts: ArtifactType[];
}) {
  const warnings: string[] = [];
  const rules = asRecord(input.taskSpec.validationRulesJson);

  switch (input.taskSpec.taskType) {
    case "write_query": {
      const query = input.preview.outputPayload.search_query;

      if (typeof query === "string") {
        const wordCount = query.trim().split(/\s+/).filter(Boolean).length;

        if (/[.!?]/.test(query) || wordCount > 16) {
          warnings.push("write_query output looks more like a full answer than a compact query.");
        }
      }
      break;
    }
    case "rag_reply": {
      const retrievedContext = input.preview.inputPayload.retrieved_context;

      if (
        input.missingArtifacts.includes("relevant_context") ||
        retrievedContext === "" ||
        retrievedContext === null ||
        (Array.isArray(retrievedContext) && retrievedContext.length === 0)
      ) {
        warnings.push("rag_reply should include relevant_context before approval.");
      }
      break;
    }
    case "routing": {
      const route = input.preview.outputPayload.route;
      const allowedRoutes = toStringArray(rules.allowed_routes);

      if (typeof route === "string" && allowedRoutes.length > 0 && !allowedRoutes.includes(route)) {
        warnings.push("routing output is not part of the configured route taxonomy.");
      }
      break;
    }
    case "tool_selection": {
      const toolName = input.preview.outputPayload.tool_name;
      const toolPayload = input.preview.outputPayload.tool_payload;

      if (toolName === "none" && toolPayload !== undefined && toolPayload !== null && toolPayload !== "") {
        warnings.push("tool_selection has a tool payload even though the tool name is none.");
      }
      break;
    }
    case "memory_write_decision": {
      const writeMemory = input.preview.outputPayload.write_memory;
      const memoryPayload = input.preview.outputPayload.memory_payload;

      if (writeMemory === true && (memoryPayload === null || memoryPayload === undefined || memoryPayload === "")) {
        warnings.push("memory_write_decision says yes but has no memory_payload.");
      }

      if (writeMemory === false && memoryPayload !== null && memoryPayload !== undefined && memoryPayload !== "") {
        warnings.push("memory_write_decision includes memory_payload even though write_memory is false.");
      }
      break;
    }
    default:
      break;
  }

  return warnings;
}

export function suggestCompatibleTaskSpecs(
  taskSpecs: Array<Pick<TaskSpec, "id" | "name" | "slug" | "taskType" | "requiredArtifactsJson" | "optionalArtifactsJson" | "version">>,
  artifacts: Array<Pick<CaseArtifact, "type">>,
) {
  const availableArtifactTypes = new Set(artifacts.map((artifact) => artifact.type));

  return taskSpecs
    .map((taskSpec) => {
      const requiredArtifacts = parseRequiredArtifacts(taskSpec.requiredArtifactsJson);
      const optionalArtifacts = parseRequiredArtifacts(taskSpec.optionalArtifactsJson);
      const missingArtifacts = requiredArtifacts.filter(
        (artifactType) => !availableArtifactTypes.has(artifactType),
      );

      return {
        ...taskSpec,
        requiredArtifacts,
        optionalArtifacts,
        missingArtifacts,
        compatible: missingArtifacts.length === 0,
      };
    })
    .sort((left, right) => left.missingArtifacts.length - right.missingArtifacts.length);
}

export function buildDerivedExamplePreview(input: {
  caseRecord: Pick<Case, "conversationSliceJson" | "lastUserMessage" | "interpretationJson">;
  artifacts: Array<Pick<CaseArtifact, "type" | "valueJson" | "notes" | "confidence" | "provenanceJson">>;
  taskSpec: Pick<
    TaskSpec,
    "taskType" | "requiredArtifactsJson" | "inputSchemaJson" | "outputSchemaJson" | "validationRulesJson"
  >;
}) {
  const source = buildProjectionSource(input.caseRecord, input.artifacts);
  const missingArtifacts = parseRequiredArtifacts(input.taskSpec.requiredArtifactsJson).filter(
    (artifactType) => !input.artifacts.some((artifact) => artifact.type === artifactType),
  );

  let inputPayload: Record<string, Prisma.JsonValue> = {};
  let outputPayload: Record<string, Prisma.JsonValue> = {};
  let usedArtifacts: ArtifactType[] = [];

  switch (input.taskSpec.taskType) {
    case "write_query":
      inputPayload = {
        recent_history: source.recentHistory,
        last_user_message: source.lastUserMessage,
        intent: source.interpretation.main_intent,
        constraints: source.constraints,
      };
      outputPayload = {
        search_query: source.idealSearchQuery,
      };
      usedArtifacts = ["ideal_search_query"];
      break;
    case "rag_reply":
      inputPayload = {
        last_user_message: source.lastUserMessage,
        retrieved_context: source.relevantContext,
        recent_history: source.recentHistory,
        constraints: source.constraints,
      };
      outputPayload = {
        answer: source.idealAnswer,
      };
      usedArtifacts = ["ideal_answer", "relevant_context"];
      break;
    case "routing":
      inputPayload = {
        recent_history: source.recentHistory,
        last_user_message: source.lastUserMessage,
      };
      outputPayload = {
        route: source.expectedRoute,
      };
      usedArtifacts = ["expected_route"];
      break;
    case "tool_selection":
      inputPayload = {
        recent_history: source.recentHistory,
        last_user_message: source.lastUserMessage,
        state: source.stateAssumptions,
      };
      outputPayload = {
        tool_name: source.expectedTool || "none",
      };
      usedArtifacts = ["expected_tool"];
      break;
    case "memory_write_decision":
      inputPayload = {
        recent_history: source.recentHistory,
        last_user_message: source.lastUserMessage,
      };
      outputPayload = {
        write_memory: source.memoryDecision.write_memory,
        memory_payload: source.memoryDecision.memory_payload,
      };
      usedArtifacts = ["memory_write_decision"];
      break;
    case "custom":
    default: {
      const inputSchema = parseTaskSchema(input.taskSpec.inputSchemaJson);
      const outputSchema = parseTaskSchema(input.taskSpec.outputSchemaJson);

      inputPayload = Object.fromEntries(
        inputSchema.map((field) => [field.key, buildGenericPayloadValue(field.key, source)]),
      );
      outputPayload = Object.fromEntries(
        outputSchema.map((field) => [field.key, buildGenericPayloadValue(field.key, source)]),
      );
      usedArtifacts = parseRequiredArtifacts(input.taskSpec.requiredArtifactsJson);
      break;
    }
  }

  const inputSchemaErrors = validateAgainstSchema(
    inputPayload,
    parseTaskSchema(input.taskSpec.inputSchemaJson),
    "Input payload",
  );
  const outputSchemaErrors = validateAgainstSchema(
    outputPayload,
    parseTaskSchema(input.taskSpec.outputSchemaJson),
    "Output payload",
  );
  const semanticWarnings = buildSemanticWarnings({
    taskSpec: input.taskSpec,
    preview: { inputPayload, outputPayload },
    missingArtifacts,
  });

  return {
    inputPayload,
    outputPayload,
    missingArtifacts,
    structuralErrors: [...inputSchemaErrors, ...outputSchemaErrors],
    semanticWarnings,
    usedArtifacts,
  } satisfies DerivedExamplePreview;
}

export function validateDerivedExample(input: {
  taskSpec: Pick<TaskSpec, "taskType" | "inputSchemaJson" | "outputSchemaJson" | "requiredArtifactsJson" | "validationRulesJson">;
  inputPayload: Record<string, Prisma.JsonValue>;
  outputPayload: Record<string, Prisma.JsonValue>;
  caseArtifacts: Array<Pick<CaseArtifact, "type">>;
}) {
  const missingArtifacts = parseRequiredArtifacts(input.taskSpec.requiredArtifactsJson).filter(
    (artifactType) => !input.caseArtifacts.some((artifact) => artifact.type === artifactType),
  );
  const structuralErrors = [
    ...validateAgainstSchema(
      input.inputPayload,
      parseTaskSchema(input.taskSpec.inputSchemaJson),
      "Input payload",
    ),
    ...validateAgainstSchema(
      input.outputPayload,
      parseTaskSchema(input.taskSpec.outputSchemaJson),
      "Output payload",
    ),
  ];

  if (missingArtifacts.length > 0) {
    structuralErrors.push(
      `Missing required artifacts: ${missingArtifacts.join(", ")}.`,
    );
  }

  const semanticWarnings = buildSemanticWarnings({
    taskSpec: input.taskSpec,
    preview: {
      inputPayload: input.inputPayload,
      outputPayload: input.outputPayload,
    },
    missingArtifacts,
  });

  return {
    structuralErrors,
    semanticWarnings,
    missingArtifacts,
    shapeMatches: structuralErrors.length === 0,
  } satisfies ValidationState;
}

export function toExportCase(
  caseRecord: Case & {
    artifacts: CaseArtifact[];
    derivedExamples: Array<Pick<DerivedExample, "id">>;
  },
): ExportedCase {
  const conversationSlice = parseConversationSlice(caseRecord.conversationSliceJson);

  return {
    case_id: caseRecord.id,
    project_id: caseRecord.projectId,
    session_id: caseRecord.sessionId,
    title: caseRecord.title || "Untitled case",
    status: caseRecord.status,
    review_status: caseRecord.reviewStatus,
    projection_status: caseRecord.projectionStatus,
    source_summary: caseRecord.sourceSummary,
    conversation_slice: conversationSlice.map((item) => ({
      role: item.role,
      text: item.text,
      order_index: item.orderIndex,
    })),
    interpretation: parseInterpretation(caseRecord.interpretationJson),
    task_candidates: parseTaskCandidates(caseRecord.taskCandidatesJson),
    artifact_count: caseRecord.artifacts.length,
    derived_example_count: caseRecord.derivedExamples.length,
    created_by: caseRecord.createdBy,
    updated_by: caseRecord.updatedBy,
    created_at: caseRecord.createdAt.toISOString(),
    updated_at: caseRecord.updatedAt.toISOString(),
  };
}

export function toExportDerivedExample(
  derivedExample: DerivedExample & {
    taskSpec: Pick<TaskSpec, "id" | "slug" | "name" | "version" | "taskType">;
  },
): ExportedDerivedExample {
  return {
    derived_example_id: derivedExample.id,
    case_id: derivedExample.caseId,
    task_spec: {
      id: derivedExample.taskSpec.id,
      slug: derivedExample.taskSpec.slug,
      name: derivedExample.taskSpec.name,
      version: derivedExample.taskSpec.version,
      task_type: derivedExample.taskSpec.taskType,
    },
    input: derivedExample.inputPayloadJson,
    output: derivedExample.outputPayloadJson,
    review_status: derivedExample.reviewStatus,
    generation_mode: derivedExample.generationMode,
    validation_state: parseValidationState(derivedExample.validationStateJson),
    provenance: derivedExample.provenanceJson,
    exported_at: new Date().toISOString(),
  };
}
