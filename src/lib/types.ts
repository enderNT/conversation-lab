import type {
  ArtifactType,
  CaseReviewStatus,
  CaseStatus,
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
