import type {
  ArtifactType,
  CaseReviewStatus,
  CaseStatus,
  DatasetExampleReviewStatus,
  DatasetFieldSide,
  DatasetFormat,
  DerivedExampleStatus,
  GenerationMode,
  MessageRole,
  Prisma,
  ProjectionStatus,
  RelationType,
  TaskType,
} from "@prisma/client";

export const CASE_STATUSES = [
  "draft",
  "curated",
  "artifact_complete",
  "ready_for_projection",
  "archived",
] as const satisfies ReadonlyArray<CaseStatus>;

export const CASE_REVIEW_STATUSES = [
  "pending",
  "human_reviewed",
  "approved",
  "rejected",
] as const satisfies ReadonlyArray<CaseReviewStatus>;

export const PROJECTION_STATUSES = [
  "not_started",
  "previewed",
  "projected",
] as const satisfies ReadonlyArray<ProjectionStatus>;

export const DERIVED_EXAMPLE_STATUSES = [
  "draft",
  "generated",
  "human_reviewed",
  "approved",
  "rejected",
  "exported",
] as const satisfies ReadonlyArray<DerivedExampleStatus>;

export const GENERATION_MODES = ["manual", "assisted"] as const satisfies ReadonlyArray<GenerationMode>;
export const RELATION_TYPES = ["precedes", "depends_on", "derived_from_same_case"] as const satisfies ReadonlyArray<RelationType>;

export const TASK_TYPES = [
  "write_query",
  "rag_reply",
  "routing",
  "tool_selection",
  "memory_write_decision",
  "custom",
] as const satisfies ReadonlyArray<TaskType>;

export const ARTIFACT_TYPES = [
  "ideal_search_query",
  "ideal_answer",
  "expected_route",
  "expected_tool",
  "relevant_context",
  "memory_write_decision",
  "policy_flags",
  "extracted_slots",
  "state_assumptions",
] as const satisfies ReadonlyArray<ArtifactType>;

export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  ideal_search_query: "Ideal search query",
  ideal_answer: "Ideal answer",
  expected_route: "Expected route",
  expected_tool: "Expected tool",
  relevant_context: "Relevant context",
  memory_write_decision: "Memory write decision",
  policy_flags: "Policy flags",
  extracted_slots: "Extracted slots",
  state_assumptions: "State assumptions",
};

export type ConversationSliceItem = {
  id: string;
  role: MessageRole;
  text: string;
  orderIndex: number;
  createdAt: string;
  metadataJson?: Prisma.JsonValue | null;
};

export type CaseInterpretation = {
  main_intent: string;
  subtask_candidates: string[];
  why_this_case_is_useful: string;
  ambiguity_level: string;
  difficulty_level: string;
  notes: string;
  llm_errors_detected: string[];
};

export type SourceMetadata = {
  project_id: string;
  session_id: string;
  session_notes?: string;
  selected_turn_ids: string[];
  selected_range: {
    start_order_index: number;
    end_order_index: number;
    turn_count: number;
  };
  provenance: {
    source: string;
    selection_mode: string;
    conversation_version: number;
  };
};

export type CaseArtifactInput = {
  type: ArtifactType;
  value: Prisma.JsonValue | null;
  notes: string;
  confidence: number | null;
  provenance: Prisma.JsonValue | null;
};

export type TaskSchemaFieldType =
  | "string"
  | "string[]"
  | "boolean"
  | "json"
  | "conversation_turns"
  | "string_or_none";

export type TaskSchemaField = {
  key: string;
  type: TaskSchemaFieldType;
  required: boolean;
  description: string;
};

export type TaskSpecDefinition = {
  name: string;
  slug: string;
  description: string;
  taskType: TaskType;
  inputSchema: TaskSchemaField[];
  outputSchema: TaskSchemaField[];
  requiredArtifacts: ArtifactType[];
  optionalArtifacts: ArtifactType[];
  validationRules: Prisma.JsonValue;
  exportShape: Prisma.JsonValue;
  isActive: boolean;
  version: number;
};

export type ValidationState = {
  structuralErrors: string[];
  semanticWarnings: string[];
  missingArtifacts: ArtifactType[];
  shapeMatches: boolean;
};

export type DerivedExamplePreview = {
  inputPayload: Record<string, Prisma.JsonValue>;
  outputPayload: Record<string, Prisma.JsonValue>;
  missingArtifacts: ArtifactType[];
  structuralErrors: string[];
  semanticWarnings: string[];
  usedArtifacts: ArtifactType[];
};

export type ExportedCase = {
  case_id: string;
  project_id: string;
  session_id: string;
  title: string;
  status: CaseStatus;
  review_status: CaseReviewStatus;
  projection_status: ProjectionStatus;
  source_summary: string;
  conversation_slice: Array<{
    role: MessageRole;
    text: string;
    order_index: number;
  }>;
  interpretation: CaseInterpretation;
  task_candidates: string[];
  artifact_count: number;
  derived_example_count: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type ExportedDerivedExample = {
  derived_example_id: string;
  case_id: string;
  task_spec: {
    id: string;
    slug: string;
    name: string;
    version: number;
    task_type: TaskType;
  };
  input: Prisma.JsonValue;
  output: Prisma.JsonValue;
  review_status: DerivedExampleStatus;
  generation_mode: GenerationMode;
  validation_state: ValidationState;
  provenance: Prisma.JsonValue;
  exported_at: string;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const DATASET_EXAMPLE_STATUSES = [
  "draft",
  "approved",
  "rejected",
  "exported",
] as const satisfies ReadonlyArray<DatasetExampleReviewStatus>;

export const DATASET_FORMATS = [
  "dspy_jsonl",
] as const satisfies ReadonlyArray<DatasetFormat>;

export const DATASET_FIELD_SIDES = [
  "input",
  "output",
] as const satisfies ReadonlyArray<DatasetFieldSide>;

export const DATASET_SCHEMA_FIELD_TYPES = [
  "string",
  "integer",
  "number",
  "boolean",
  "object",
  "array",
  "null",
  "enum",
  "datetime",
  "conversation_turns",
] as const;

export const DATASET_MAPPING_SOURCES = [
  "source.last_user_message",
  "source.conversation_slice",
  "source.surrounding_context",
  "source.source_summary",
  "source.session_notes",
  "llm_generated",
  "rag_generated",
  "manual",
  "constant",
] as const;

export const DATASET_TRANSFORMS = [
  "trim",
  "join_lines",
  "pick_path",
  "pick_turns",
  "wrap_array",
  "to_string",
  "to_boolean",
  "template",
] as const;

export type DatasetSchemaFieldType = (typeof DATASET_SCHEMA_FIELD_TYPES)[number];
export type DatasetMappingSourceKey = (typeof DATASET_MAPPING_SOURCES)[number];
export type DatasetTransformKey = (typeof DATASET_TRANSFORMS)[number];

export type DatasetSchemaField = {
  key: string;
  type: DatasetSchemaFieldType;
  required: boolean;
  description: string;
  enumValues?: string[];
};

export type DatasetSpecDefinition = {
  name: string;
  slug: string;
  description: string;
  datasetFormat: DatasetFormat;
  inputSchema: DatasetSchemaField[];
  outputSchema: DatasetSchemaField[];
  mappingHints: JsonValue;
  validationRules: JsonValue;
  exportConfig: JsonValue;
  isActive: boolean;
  version: number;
};

export type SourceSliceMetadata = {
  project_id: string;
  session_id: string;
  session_notes?: string;
  selected_turn_ids: string[];
  selected_range: {
    start_order_index: number;
    end_order_index: number;
    turn_count: number;
  };
  provenance: {
    source: string;
    selection_mode: string;
    conversation_version: number;
  };
};

export type SourceSliceRecord = {
  id?: string;
  projectId: string;
  sessionId: string;
  title: string;
  conversationSlice: ConversationSliceItem[];
  surroundingContext: ConversationSliceItem[];
  selectedTurnIds: string[];
  lastUserMessage: string;
  sourceSummary: string;
  sourceMetadata: SourceSliceMetadata;
};

export type DatasetFieldMappingRecord = {
  side: (typeof DATASET_FIELD_SIDES)[number];
  fieldKey: string;
  sourceKey: DatasetMappingSourceKey;
  sourcePath: string;
  transformChain: string[];
  constantValueText: string;
  manualValueText: string;
  llmConfigurationId: string;
  llmPromptText: string;
  llmContextSelection?: JsonValue;
  llmGeneratedValueText: string;
  llmGenerationMeta?: JsonValue;
  ragConfigurationId: string;
  ragPromptText: string;
  ragGeneratedValueText: string;
  ragGenerationMeta?: JsonValue;
  resolvedPreview?: JsonValue;
};

export type DatasetValidationState = {
  structuralErrors: string[];
  semanticWarnings: string[];
  shapeMatches: boolean;
};

export type ExportedDatasetExampleRow = {
  input: JsonObject;
  output: JsonObject;
  metadata: {
    spec: string;
    version: number;
    sourceSliceId: string;
    datasetExampleId: string;
  };
};
