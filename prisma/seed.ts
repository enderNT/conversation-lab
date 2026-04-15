import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  ArtifactType,
  CaseReviewStatus,
  CaseStatus,
  DerivedExampleStatus,
  GenerationMode,
  MessageRole,
  PrismaClient,
  ProjectionStatus,
  TaskType,
} from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: databaseUrl,
  }),
});

async function seedTaskSpecs() {
  const taskSpecs = [
    {
      name: "Write Query",
      slug: "write_query",
      description: "Generate the ideal search query from conversation context.",
      taskType: TaskType.write_query,
      inputSchemaJson: [
        { key: "recent_history", type: "conversation_turns", required: true, description: "Conversation before the last user message." },
        { key: "last_user_message", type: "string", required: true, description: "Latest user message." },
      ],
      outputSchemaJson: [
        { key: "search_query", type: "string", required: true, description: "Ideal search query." },
      ],
      requiredArtifactsJson: [ArtifactType.ideal_search_query],
      optionalArtifactsJson: [ArtifactType.policy_flags],
      validationRulesJson: { query_like_max_words: 16 },
      exportShapeJson: { format: "conversation_lab_v2", shape: "{ input, output, metadata }" },
      version: 1,
    },
    {
      name: "RAG Reply",
      slug: "rag_reply",
      description: "Generate the ideal final answer using retrieved context.",
      taskType: TaskType.rag_reply,
      inputSchemaJson: [
        { key: "last_user_message", type: "string", required: true, description: "Latest user message." },
        { key: "retrieved_context", type: "json", required: true, description: "Retrieved context." },
      ],
      outputSchemaJson: [
        { key: "answer", type: "string", required: true, description: "Ideal answer." },
      ],
      requiredArtifactsJson: [ArtifactType.ideal_answer, ArtifactType.relevant_context],
      optionalArtifactsJson: [ArtifactType.policy_flags],
      validationRulesJson: { requires_relevant_context: true },
      exportShapeJson: { format: "conversation_lab_v2", shape: "{ input, output, metadata }" },
      version: 1,
    },
    {
      name: "Routing",
      slug: "routing",
      description: "Choose the correct route or module.",
      taskType: TaskType.routing,
      inputSchemaJson: [
        { key: "recent_history", type: "conversation_turns", required: true, description: "Conversation before the last user message." },
        { key: "last_user_message", type: "string", required: true, description: "Latest user message." },
      ],
      outputSchemaJson: [
        { key: "route", type: "string", required: true, description: "Route taxonomy value." },
      ],
      requiredArtifactsJson: [ArtifactType.expected_route],
      optionalArtifactsJson: [ArtifactType.policy_flags],
      validationRulesJson: { allowed_routes: ["retrieval", "tool_call", "clarification", "direct_answer"] },
      exportShapeJson: { format: "conversation_lab_v2", shape: "{ input, output, metadata }" },
      version: 1,
    },
    {
      name: "Tool Selection",
      slug: "tool_selection",
      description: "Decide which tool should be used, or none.",
      taskType: TaskType.tool_selection,
      inputSchemaJson: [
        { key: "recent_history", type: "conversation_turns", required: true, description: "Conversation before the last user message." },
        { key: "last_user_message", type: "string", required: true, description: "Latest user message." },
      ],
      outputSchemaJson: [
        { key: "tool_name", type: "string_or_none", required: true, description: "Tool name or none." },
      ],
      requiredArtifactsJson: [ArtifactType.expected_tool],
      optionalArtifactsJson: [ArtifactType.state_assumptions],
      validationRulesJson: { allow_none: true },
      exportShapeJson: { format: "conversation_lab_v2", shape: "{ input, output, metadata }" },
      version: 1,
    },
    {
      name: "Memory Write Decision",
      slug: "memory_write_decision",
      description: "Decide whether memory should be written.",
      taskType: TaskType.memory_write_decision,
      inputSchemaJson: [
        { key: "recent_history", type: "conversation_turns", required: true, description: "Conversation before the last user message." },
        { key: "last_user_message", type: "string", required: true, description: "Latest user message." },
      ],
      outputSchemaJson: [
        { key: "write_memory", type: "boolean", required: true, description: "Should write memory." },
        { key: "memory_payload", type: "json", required: false, description: "Optional memory payload." },
      ],
      requiredArtifactsJson: [ArtifactType.memory_write_decision],
      optionalArtifactsJson: [ArtifactType.state_assumptions],
      validationRulesJson: { allow_empty_memory_payload_when_false: true },
      exportShapeJson: { format: "conversation_lab_v2", shape: "{ input, output, metadata }" },
      version: 1,
    },
  ];

  for (const taskSpec of taskSpecs) {
    await prisma.taskSpec.upsert({
      where: { slug: taskSpec.slug },
      update: {
        ...taskSpec,
        isActive: true,
        updatedBy: "seed",
      },
      create: {
        ...taskSpec,
        isActive: true,
        createdBy: "seed",
        updatedBy: "seed",
      },
    });
  }
}

async function main() {
  await seedTaskSpecs();

  const existingProjects = await prisma.project.count();

  if (existingProjects > 0) {
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: "Demo Conversation Lab V2",
      description:
        "Proyecto semilla con source cases, task specs y derived examples listos para revisar.",
    },
  });

  const session = await prisma.session.create({
    data: {
      projectId: project.id,
      title: "Consulta con necesidad de retrieval y restricciones explícitas",
    },
  });

  const messages = await Promise.all([
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.user,
        text: "Estoy buscando productos para manchas del rostro, pero mi piel es sensible.",
        orderIndex: 0,
      },
    }),
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.assistant,
        text: "Puedo ayudarte. Necesitaré centrar la búsqueda en opciones suaves y acompañarlas con protector solar.",
        orderIndex: 1,
      },
    }),
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.user,
        text: "También quiero algo que pueda usar a diario sin irritación.",
        orderIndex: 2,
      },
    }),
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.assistant,
        text: "Entonces conviene recuperar productos despigmentantes suaves y filtrar por uso diario para piel sensible.",
        orderIndex: 3,
      },
    }),
  ]);

  const taskSpec = await prisma.taskSpec.findUniqueOrThrow({
    where: { slug: "write_query" },
  });

  const sourceCase = await prisma.case.create({
    data: {
      projectId: project.id,
      sessionId: session.id,
      title: "Retrieval request with explicit sensitivity constraints",
      conversationSliceJson: messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        orderIndex: message.orderIndex,
        createdAt: message.createdAt.toISOString(),
        metadataJson: message.metadataJson,
      })),
      sourceContextJson: [],
      selectedTurnIdsJson: messages.map((message) => message.id),
      sourceSummary:
        "The user needs retrieval-backed product guidance and explicitly constrains the answer to gentle daily-use options.",
      lastUserMessage: messages[2].text,
      interpretationJson: {
        main_intent: "Find suitable products via retrieval",
        subtask_candidates: ["write_query", "routing", "rag_reply"],
        why_this_case_is_useful:
          "It contains explicit retrieval need plus real-world constraints that should change search formulation.",
        ambiguity_level: "medium",
        difficulty_level: "medium",
        notes: "Useful for testing query-writing and route selection before answer generation.",
        llm_errors_detected: ["Assistant answered too generally before retrieval."],
      },
      sourceMetadataJson: {
        project_id: project.id,
        session_id: session.id,
        selected_turn_ids: messages.map((message) => message.id),
        selected_range: {
          start_order_index: 0,
          end_order_index: 3,
          turn_count: 4,
        },
        provenance: {
          source: "session_chat",
          selection_mode: "manual_range",
          conversation_version: 2,
        },
      },
      taskCandidatesJson: [taskSpec.id],
      projectionStatus: ProjectionStatus.projected,
      reviewStatus: CaseReviewStatus.human_reviewed,
      status: CaseStatus.ready_for_projection,
      createdBy: "seed",
      updatedBy: "seed",
      artifacts: {
        create: [
          {
            type: ArtifactType.ideal_search_query,
            valueJson:
              "productos para manchas del rostro uso diario piel sensible despigmentantes suaves",
            notes: "Compact query focused on retrieval.",
            confidence: 0.96,
          },
          {
            type: ArtifactType.expected_route,
            valueJson: "retrieval",
            confidence: 0.9,
          },
          {
            type: ArtifactType.relevant_context,
            valueJson: [
              "Despigmentantes suaves con uso diario",
              "Indicaciones de uso para piel sensible",
              "Protector solar como requisito complementario",
            ],
          },
          {
            type: ArtifactType.ideal_answer,
            valueJson:
              "La mejor respuesta debería recuperar opciones suaves de uso diario, aclarar que la constancia y el protector solar importan, y evitar recomendaciones agresivas.",
          },
          {
            type: ArtifactType.policy_flags,
            valueJson: ["avoid_medical_diagnosis", "recommend_patch_test"],
          },
        ],
      },
    },
    include: {
      artifacts: true,
    },
  });

  await prisma.derivedExample.create({
    data: {
      caseId: sourceCase.id,
      taskSpecId: taskSpec.id,
      title: "Write query example from sensitive-skin retrieval request",
      inputPayloadJson: {
        recent_history: sourceCase.conversationSliceJson,
        last_user_message: sourceCase.lastUserMessage,
        intent: "Find suitable products via retrieval",
      },
      outputPayloadJson: {
        search_query:
          "productos para manchas del rostro uso diario piel sensible despigmentantes suaves",
      },
      generationMode: GenerationMode.assisted,
      reviewStatus: DerivedExampleStatus.approved,
      validationStateJson: {
        structuralErrors: [],
        semanticWarnings: [],
        missingArtifacts: [],
        shapeMatches: true,
      },
      provenanceJson: {
        source_case_id: sourceCase.id,
        source_session_id: session.id,
        source_selected_turn_ids: sourceCase.selectedTurnIdsJson,
        used_artifacts: [ArtifactType.ideal_search_query],
        edited_by: "seed",
        generation_mode: GenerationMode.assisted,
        task_spec_version: taskSpec.version,
      },
      version: taskSpec.version,
      createdBy: "seed",
      updatedBy: "seed",
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });