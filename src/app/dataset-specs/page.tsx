import { DatasetSpecManager } from "@/components/dataset-spec-manager";
import type { DatasetSpecCatalogRecord } from "@/components/dataset-spec-form";
import { datasetSpecFromPrisma, stringifyJsonValue } from "@/lib/datasets";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DatasetSpecsPage() {
  await ensureDefaultDatasetSpecs();

  const datasetSpecs = await prisma.datasetSpec.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          datasetExamples: true,
        },
      },
    },
  });

  const catalog = datasetSpecs.map<DatasetSpecCatalogRecord>((datasetSpec) => {
    const normalized = datasetSpecFromPrisma(datasetSpec);

    return {
      id: normalized.id,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      datasetFormat: normalized.datasetFormat,
      inputSchemaText: stringifyJsonValue(normalized.inputSchema),
      outputSchemaText: stringifyJsonValue(normalized.outputSchema),
      mappingHintsText: stringifyJsonValue(normalized.mappingHints),
      validationRulesText: stringifyJsonValue(normalized.validationRules),
      exportConfigText: stringifyJsonValue(normalized.exportConfig),
      isActive: normalized.isActive,
      version: normalized.version,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      datasetExampleCount: datasetSpec._count.datasetExamples,
    };
  });

  return <DatasetSpecManager datasetSpecs={catalog} />;
}
