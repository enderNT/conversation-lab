import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { DatasetExampleReviewStatus, DatasetFormat, MessageRole, PrismaClient } from "@prisma/client";
import {
  buildSourceSliceMetadata,
  toConversationSlice,
  toExportDatasetExample,
} from "../src/lib/datasets";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: databaseUrl,
  }),
});

async function seedDatasetSpecs() {
  await prisma.datasetSpec.upsert({
    where: { slug: "qa_basic" },
    update: {
      name: "QA Basic",
      description: "Firma simple para mapear una pregunta hacia una respuesta ideal.",
      datasetFormat: DatasetFormat.dspy_jsonl,
      inputSchemaJson: [
        {
          key: "question",
          type: "string",
          required: true,
          description: "Pregunta final del usuario.",
        },
      ],
      outputSchemaJson: [
        {
          key: "answer",
          type: "string",
          required: true,
          description: "Respuesta ideal final.",
        },
      ],
      mappingHintsJson: {
        input: {
          question: ["source.last_user_message"],
        },
        output: {
          answer: ["manual"],
        },
      },
      validationRulesJson: {
        nonEmptyFields: ["question", "answer"],
      },
      exportConfigJson: {
        format: "dspy_jsonl",
      },
      isActive: true,
      version: 1,
      updatedBy: "seed",
    },
    create: {
      name: "QA Basic",
      slug: "qa_basic",
      description: "Firma simple para mapear una pregunta hacia una respuesta ideal.",
      datasetFormat: DatasetFormat.dspy_jsonl,
      inputSchemaJson: [
        {
          key: "question",
          type: "string",
          required: true,
          description: "Pregunta final del usuario.",
        },
      ],
      outputSchemaJson: [
        {
          key: "answer",
          type: "string",
          required: true,
          description: "Respuesta ideal final.",
        },
      ],
      mappingHintsJson: {
        input: {
          question: ["source.last_user_message"],
        },
        output: {
          answer: ["manual"],
        },
      },
      validationRulesJson: {
        nonEmptyFields: ["question", "answer"],
      },
      exportConfigJson: {
        format: "dspy_jsonl",
      },
      isActive: true,
      version: 1,
      createdBy: "seed",
      updatedBy: "seed",
    },
  });
}

async function main() {
  await seedDatasetSpecs();

  const existingProjects = await prisma.project.count();

  if (existingProjects > 0) {
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: "Demo DSPy Mapping Lab",
      description: "Proyecto semilla para convertir slices de chat en dataset examples DSPy.",
    },
  });

  const session = await prisma.session.create({
    data: {
      projectId: project.id,
      title: "Consulta con restricciones explícitas",
      curationNotes: "El usuario tiene sensibilidad en la piel y busca recomendaciones de uso diario.",
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
        text: "Puedo ayudarte. Necesitaré priorizar opciones suaves y de uso frecuente.",
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
  ]);

  const datasetSpec = await prisma.datasetSpec.findUniqueOrThrow({
    where: { slug: "qa_basic" },
  });
  const conversationSlice = toConversationSlice(messages);
  const sourceSlice = await prisma.sourceSlice.create({
    data: {
      projectId: project.id,
      sessionId: session.id,
      title: "Slice demo 1-3",
      conversationSliceJson: conversationSlice,
      surroundingContextJson: [],
      selectedTurnIdsJson: messages.map((message) => message.id),
      lastUserMessage: messages.at(-1)?.text ?? "",
      sourceSummary:
        "Consulta de skincare con restricción clara: respuesta útil, suave y apta para uso diario.",
      sourceMetadataJson: buildSourceSliceMetadata({
        projectId: project.id,
        sessionId: session.id,
        sessionNotes: session.curationNotes ?? "",
        selectedTurnIds: messages.map((message) => message.id),
        startOrderIndex: 0,
        endOrderIndex: 2,
      }),
    },
  });

  const datasetExample = await prisma.datasetExample.create({
    data: {
      sourceSliceId: sourceSlice.id,
      datasetSpecId: datasetSpec.id,
      title: "Respuesta ideal para consulta sensible",
      inputPayloadJson: {
        question: messages.at(-1)?.text ?? "",
      },
      outputPayloadJson: {
        answer:
          "Busca opciones despigmentantes suaves aptas para piel sensible y acompaña la recomendación con uso diario y protector solar.",
      },
      validationStateJson: {
        structuralErrors: [],
        semanticWarnings: [],
        shapeMatches: true,
      },
      provenanceJson: {
        source_slice_id: sourceSlice.id,
        edited_by: "seed",
      },
      reviewStatus: DatasetExampleReviewStatus.approved,
      version: datasetSpec.version,
      createdBy: "seed",
      updatedBy: "seed",
      fieldMappings: {
        create: [
          {
            side: "input",
            fieldKey: "question",
            sourceKey: "source.last_user_message",
            sourcePath: null,
            transformChainJson: ["trim"],
            resolvedPreviewJson: messages.at(-1)?.text ?? "",
            position: 0,
          },
          {
            side: "output",
            fieldKey: "answer",
            sourceKey: "manual",
            sourcePath: null,
            transformChainJson: [],
            manualValueJson:
              "Busca opciones despigmentantes suaves aptas para piel sensible y acompaña la recomendación con uso diario y protector solar.",
            resolvedPreviewJson:
              "Busca opciones despigmentantes suaves aptas para piel sensible y acompaña la recomendación con uso diario y protector solar.",
            position: 1,
          },
        ],
      },
    },
  });

  const exportedRow = toExportDatasetExample({
    datasetExampleId: datasetExample.id,
    sourceSliceId: sourceSlice.id,
    specSlug: datasetSpec.slug,
    version: datasetSpec.version,
    inputPayload: datasetExample.inputPayloadJson as never,
    outputPayload: datasetExample.outputPayloadJson as never,
  });

  console.log(`Seeded demo project "${project.name}"`);
  console.log(`Sample export row: ${JSON.stringify(exportedRow)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
