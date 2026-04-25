import { DatasetFormat, Prisma } from "@prisma/client";
import { z } from "zod";
import { datasetSpecFromPrisma } from "@/lib/datasets";
import { prisma } from "@/lib/prisma";
import type {
  DatasetSpecDefinition,
  DatasetSpecExportBundle,
  ExportedDatasetSpec,
} from "@/lib/types";

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
  const existingCount = await prisma.datasetSpec.count();

  if (existingCount > 0) {
    return;
  }

  await Promise.all(
    DEFAULT_DATASET_SPECS.map((datasetSpec) =>
      prisma.datasetSpec.create({
        data: {
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

const datasetSpecImportBundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().trim().min(1).optional(),
  specs: z.array(z.unknown()),
});

export function toExportedDatasetSpec(
  datasetSpec: Parameters<typeof datasetSpecFromPrisma>[0],
): ExportedDatasetSpec {
  const normalized = datasetSpecFromPrisma(datasetSpec);

  return {
    name: normalized.name,
    slug: normalized.slug,
    description: normalized.description,
    datasetFormat: normalized.datasetFormat,
    inputSchema: normalized.inputSchema,
    outputSchema: normalized.outputSchema,
    mappingHints: normalized.mappingHints,
    validationRules: normalized.validationRules,
    exportConfig: normalized.exportConfig,
    isActive: normalized.isActive,
    version: normalized.version,
  };
}

export function buildDatasetSpecExportBundle(
  datasetSpecs: Array<Parameters<typeof datasetSpecFromPrisma>[0]>,
): DatasetSpecExportBundle {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    specs: datasetSpecs.map((datasetSpec) => toExportedDatasetSpec(datasetSpec)),
  };
}

export function parseDatasetSpecImportBundleText(value: string) {
  const parsedValue = JSON.parse(value) as unknown;

  return datasetSpecImportBundleSchema.parse(parsedValue);
}
