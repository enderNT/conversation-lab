import type { Case, Prisma } from "@prisma/client";
import type {
  CaseArtifacts,
  CaseLabels,
  ConversationSliceItem,
  ExportedCase,
} from "@/lib/types";

function asRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

export function parseConversationSlice(
  value: Prisma.JsonValue | null | undefined,
) {
  if (!Array.isArray(value)) {
    return [] as ConversationSliceItem[];
  }

  return value as ConversationSliceItem[];
}

export function parseCaseLabels(value: Prisma.JsonValue | null | undefined): CaseLabels {
  const record = asRecord(value);

  return {
    expected_route:
      typeof record.expected_route === "string" ? record.expected_route : "",
  };
}

export function parseCaseArtifacts(
  value: Prisma.JsonValue | null | undefined,
): CaseArtifacts {
  const record = asRecord(value);

  return {
    ideal_search_query:
      typeof record.ideal_search_query === "string"
        ? record.ideal_search_query
        : "",
    ideal_answer:
      typeof record.ideal_answer === "string" ? record.ideal_answer : "",
    expected_tool:
      typeof record.expected_tool === "string" ? record.expected_tool : "",
  };
}

export function deriveLastUserMessage(slice: ConversationSliceItem[]) {
  const latestUserMessage = [...slice].reverse().find((item) => item.role === "user");

  return latestUserMessage?.text ?? "";
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

export function toExportCase(caseRecord: Case): ExportedCase {
  const conversationSlice = parseConversationSlice(caseRecord.conversationSliceJson);

  return {
    case_id: caseRecord.id,
    project_id: caseRecord.projectId,
    session_id: caseRecord.sessionId,
    conversation_slice: conversationSlice.map((item) => ({
      role: item.role,
      text: item.text,
    })),
    last_user_message: caseRecord.lastUserMessage,
    labels: parseCaseLabels(caseRecord.labelsJson),
    artifacts: parseCaseArtifacts(caseRecord.artifactsJson),
    notes: caseRecord.notes,
    status: caseRecord.status,
  };
}