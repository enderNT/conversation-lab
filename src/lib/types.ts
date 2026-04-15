import type { CaseStatus, MessageRole, Prisma } from "@prisma/client";

export const CASE_STATUSES = ["draft", "reviewed", "approved"] as const;
export const MESSAGE_ROLES = ["user", "assistant"] as const;

export type ConversationSliceItem = {
  id: string;
  role: MessageRole;
  text: string;
  orderIndex: number;
  createdAt: string;
  metadataJson?: Prisma.JsonValue | null;
};

export type CaseLabels = {
  expected_route: string;
};

export type CaseArtifacts = {
  ideal_search_query: string;
  ideal_answer: string;
  expected_tool: string;
};

export type ExportedCase = {
  case_id: string;
  project_id: string;
  session_id: string;
  conversation_slice: Array<{
    role: MessageRole;
    text: string;
  }>;
  last_user_message: string;
  labels: CaseLabels;
  artifacts: CaseArtifacts;
  notes: string;
  status: CaseStatus;
};