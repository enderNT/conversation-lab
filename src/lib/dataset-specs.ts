import { DatasetFormat, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DatasetSpecDefinition } from "@/lib/types";

export const DEFAULT_DATASET_SPECS: DatasetSpecDefinition[] = [
  {
    name: "QA Basic",
    slug: "qa_basic",
    description:
      "Firma simple para mapear una pregunta final del usuario hacia una respuesta objetivo.",
    datasetFormat: DatasetFormat.dspy_jsonl,
    inputSchema: [
      {
        key: "question",
        type: "string",
        required: true,
        description: "Pregunta final o instrucción del usuario.",
      },
      {
        key: "context",
        type: "array",
        required: false,
        description: "Contexto opcional derivado del slice o del contexto cercano.",
      },
    ],
    outputSchema: [
      {
        key: "answer",
        type: "string",
        required: true,
        description: "Respuesta ideal final.",
      },
    ],
    mappingHints: {
      input: {
        question: ["source.last_user_message"],
        context: ["source.surrounding_context", "manual"],
      },
      output: {
        answer: ["manual"],
      },
    },
    validationRules: {
      nonEmptyFields: ["question", "answer"],
    },
    exportConfig: {
      format: "dspy_jsonl",
      metadata: ["spec", "version", "sourceSliceId", "datasetExampleId"],
    },
    isActive: true,
    version: 1,
  },
];

export async function ensureDefaultDatasetSpecs() {
  await Promise.all(
    DEFAULT_DATASET_SPECS.map((datasetSpec) =>
      prisma.datasetSpec.upsert({
        where: { slug: datasetSpec.slug },
        update: {
          name: datasetSpec.name,
          description: datasetSpec.description,
          datasetFormat: datasetSpec.datasetFormat,
          inputSchemaJson: datasetSpec.inputSchema as Prisma.InputJsonValue,
          outputSchemaJson: datasetSpec.outputSchema as Prisma.InputJsonValue,
          mappingHintsJson: datasetSpec.mappingHints as Prisma.InputJsonValue,
          validationRulesJson: datasetSpec.validationRules as Prisma.InputJsonValue,
          exportConfigJson: datasetSpec.exportConfig as Prisma.InputJsonValue,
          isActive: datasetSpec.isActive,
          version: datasetSpec.version,
          updatedBy: "system",
        },
        create: {
          name: datasetSpec.name,
          slug: datasetSpec.slug,
          description: datasetSpec.description,
          datasetFormat: datasetSpec.datasetFormat,
          inputSchemaJson: datasetSpec.inputSchema as Prisma.InputJsonValue,
          outputSchemaJson: datasetSpec.outputSchema as Prisma.InputJsonValue,
          mappingHintsJson: datasetSpec.mappingHints as Prisma.InputJsonValue,
          validationRulesJson: datasetSpec.validationRules as Prisma.InputJsonValue,
          exportConfigJson: datasetSpec.exportConfig as Prisma.InputJsonValue,
          isActive: datasetSpec.isActive,
          version: datasetSpec.version,
          createdBy: "system",
          updatedBy: "system",
        },
      }),
    ),
  );
}
