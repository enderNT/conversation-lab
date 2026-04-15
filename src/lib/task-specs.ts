import { Prisma, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TaskSpecDefinition } from "@/lib/types";

export const DEFAULT_ROUTE_TAXONOMY = [
  "retrieval",
  "tool_call",
  "direct_answer",
  "clarification",
  "memory_write",
  "safety_review",
] as const;

export const DEFAULT_TASK_SPECS: TaskSpecDefinition[] = [
  {
    name: "Write Query",
    slug: "write_query",
    description:
      "Generate the ideal search query from the recent conversation context.",
    taskType: TaskType.write_query,
    inputSchema: [
      {
        key: "recent_history",
        type: "conversation_turns",
        required: true,
        description: "Conversation turns before the final user request.",
      },
      {
        key: "last_user_message",
        type: "string",
        required: true,
        description: "The most recent user message in the selected slice.",
      },
      {
        key: "intent",
        type: "string",
        required: false,
        description: "Human interpretation of the main intent.",
      },
      {
        key: "constraints",
        type: "json",
        required: false,
        description: "Relevant constraints or policy notes.",
      },
    ],
    outputSchema: [
      {
        key: "search_query",
        type: "string",
        required: true,
        description: "The ideal search query for retrieval.",
      },
    ],
    requiredArtifacts: ["ideal_search_query"],
    optionalArtifacts: ["policy_flags", "state_assumptions"],
    validationRules: {
      query_like_max_words: 16,
      should_not_end_with_punctuation: true,
    },
    exportShape: {
      format: "conversation_lab_v2",
      shape: "{ input, output, metadata }",
    },
    isActive: true,
    version: 1,
  },
  {
    name: "RAG Reply",
    slug: "rag_reply",
    description:
      "Generate the ideal final answer using retrieved context for the last user message.",
    taskType: TaskType.rag_reply,
    inputSchema: [
      {
        key: "last_user_message",
        type: "string",
        required: true,
        description: "The most recent user request.",
      },
      {
        key: "retrieved_context",
        type: "json",
        required: true,
        description: "Relevant retrieved context used to answer.",
      },
      {
        key: "recent_history",
        type: "conversation_turns",
        required: false,
        description: "Conversation history before the final user message.",
      },
      {
        key: "constraints",
        type: "json",
        required: false,
        description: "Policy or product constraints that should shape the answer.",
      },
    ],
    outputSchema: [
      {
        key: "answer",
        type: "string",
        required: true,
        description: "The final ideal answer.",
      },
    ],
    requiredArtifacts: ["ideal_answer", "relevant_context"],
    optionalArtifacts: ["policy_flags", "state_assumptions"],
    validationRules: {
      requires_relevant_context: true,
    },
    exportShape: {
      format: "conversation_lab_v2",
      shape: "{ input, output, metadata }",
    },
    isActive: true,
    version: 1,
  },
  {
    name: "Routing",
    slug: "routing",
    description: "Choose the correct route, module, or branch for the user request.",
    taskType: TaskType.routing,
    inputSchema: [
      {
        key: "recent_history",
        type: "conversation_turns",
        required: true,
        description: "Conversation turns before the final user request.",
      },
      {
        key: "last_user_message",
        type: "string",
        required: true,
        description: "The message that should be routed.",
      },
    ],
    outputSchema: [
      {
        key: "route",
        type: "string",
        required: true,
        description: "Selected route taxonomy value.",
      },
    ],
    requiredArtifacts: ["expected_route"],
    optionalArtifacts: ["policy_flags"],
    validationRules: {
      allowed_routes: [...DEFAULT_ROUTE_TAXONOMY],
    },
    exportShape: {
      format: "conversation_lab_v2",
      shape: "{ input, output, metadata }",
    },
    isActive: true,
    version: 1,
  },
  {
    name: "Tool Selection",
    slug: "tool_selection",
    description: "Decide whether a tool should be called and which one.",
    taskType: TaskType.tool_selection,
    inputSchema: [
      {
        key: "recent_history",
        type: "conversation_turns",
        required: true,
        description: "Conversation turns before the final user request.",
      },
      {
        key: "last_user_message",
        type: "string",
        required: true,
        description: "The latest user message.",
      },
      {
        key: "state",
        type: "json",
        required: false,
        description: "Optional working state or assumptions.",
      },
    ],
    outputSchema: [
      {
        key: "tool_name",
        type: "string_or_none",
        required: true,
        description: "Tool name or none.",
      },
    ],
    requiredArtifacts: ["expected_tool"],
    optionalArtifacts: ["state_assumptions"],
    validationRules: {
      allow_none: true,
    },
    exportShape: {
      format: "conversation_lab_v2",
      shape: "{ input, output, metadata }",
    },
    isActive: true,
    version: 1,
  },
  {
    name: "Memory Write Decision",
    slug: "memory_write_decision",
    description:
      "Decide whether memory should be written after the selected conversation fragment.",
    taskType: TaskType.memory_write_decision,
    inputSchema: [
      {
        key: "recent_history",
        type: "conversation_turns",
        required: true,
        description: "Conversation turns before the final user message.",
      },
      {
        key: "last_user_message",
        type: "string",
        required: true,
        description: "The latest user message.",
      },
    ],
    outputSchema: [
      {
        key: "write_memory",
        type: "boolean",
        required: true,
        description: "Whether memory should be written.",
      },
      {
        key: "memory_payload",
        type: "json",
        required: false,
        description: "Optional memory payload.",
      },
    ],
    requiredArtifacts: ["memory_write_decision"],
    optionalArtifacts: ["state_assumptions"],
    validationRules: {
      allow_empty_memory_payload_when_false: true,
    },
    exportShape: {
      format: "conversation_lab_v2",
      shape: "{ input, output, metadata }",
    },
    isActive: true,
    version: 1,
  },
];

export async function ensureDefaultTaskSpecs() {
  await Promise.all(
    DEFAULT_TASK_SPECS.map((taskSpec) =>
      prisma.taskSpec.upsert({
        where: { slug: taskSpec.slug },
        update: {
          name: taskSpec.name,
          description: taskSpec.description,
          taskType: taskSpec.taskType,
          inputSchemaJson: taskSpec.inputSchema,
          outputSchemaJson: taskSpec.outputSchema,
          requiredArtifactsJson: taskSpec.requiredArtifacts,
          optionalArtifactsJson: taskSpec.optionalArtifacts,
          validationRulesJson: taskSpec.validationRules as Prisma.InputJsonValue,
          exportShapeJson: taskSpec.exportShape as Prisma.InputJsonValue,
          isActive: taskSpec.isActive,
          version: taskSpec.version,
          updatedBy: "system",
        },
        create: {
          name: taskSpec.name,
          slug: taskSpec.slug,
          description: taskSpec.description,
          taskType: taskSpec.taskType,
          inputSchemaJson: taskSpec.inputSchema,
          outputSchemaJson: taskSpec.outputSchema,
          requiredArtifactsJson: taskSpec.requiredArtifacts,
          optionalArtifactsJson: taskSpec.optionalArtifacts,
          validationRulesJson: taskSpec.validationRules as Prisma.InputJsonValue,
          exportShapeJson: taskSpec.exportShape as Prisma.InputJsonValue,
          isActive: taskSpec.isActive,
          version: taskSpec.version,
          createdBy: "system",
          updatedBy: "system",
        },
      }),
    ),
  );
}