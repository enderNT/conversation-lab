import { buildDatasetSpecExportBundle, ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function sortDatasetSpecsByRequestedIds<
  T extends {
    id: string;
  },
>(datasetSpecs: T[], requestedIds: string[]) {
  if (requestedIds.length === 0) {
    return datasetSpecs;
  }

  const positionById = new Map(requestedIds.map((id, index) => [id, index]));

  return [...datasetSpecs].sort(
    (left, right) =>
      (positionById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (positionById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export async function GET(request: Request) {
  await ensureDefaultDatasetSpecs();

  const { searchParams } = new URL(request.url);
  const requestedIds = searchParams.getAll("ids").filter(Boolean);
  const datasetSpecs = await prisma.datasetSpec.findMany({
    where: requestedIds.length > 0 ? { id: { in: requestedIds } } : undefined,
    orderBy: requestedIds.length === 0 ? [{ isActive: "desc" }, { name: "asc" }] : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      datasetFormat: true,
      inputSchemaJson: true,
      outputSchemaJson: true,
      mappingHintsJson: true,
      validationRulesJson: true,
      exportConfigJson: true,
      isActive: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const orderedDatasetSpecs = sortDatasetSpecsByRequestedIds(datasetSpecs, requestedIds);
  const bundle = buildDatasetSpecExportBundle(orderedDatasetSpecs);

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dataset-specs.json"',
    },
  });
}
