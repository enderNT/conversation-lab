import { DatasetExampleReviewStatus } from "@prisma/client";
import { buildJsonl, toExportDatasetExample } from "@/lib/datasets";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";
import type { JsonObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDefaultDatasetSpecs();

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const datasetSpecId = searchParams.get("datasetSpecId") || undefined;
  const reviewStatus = searchParams.get("reviewStatus") || undefined;
  const version = searchParams.get("version");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;
  const parsedVersion = version ? Number.parseInt(version, 10) : undefined;

  const datasetExamples = await prisma.datasetExample.findMany({
    where: {
      ...(projectId
        ? {
            sourceSlice: {
              projectId,
            },
          }
        : {}),
      ...(datasetSpecId ? { datasetSpecId } : {}),
      ...(reviewStatus &&
      Object.values(DatasetExampleReviewStatus).includes(
        reviewStatus as DatasetExampleReviewStatus,
      )
        ? {
            reviewStatus: reviewStatus as DatasetExampleReviewStatus,
          }
        : {}),
      ...(Number.isInteger(parsedVersion) ? { version: parsedVersion } : {}),
      ...(fromDate || toDate
        ? {
            updatedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      datasetSpec: {
        select: {
          slug: true,
          version: true,
        },
      },
      sourceSlice: {
        select: {
          id: true,
        },
      },
    },
  });

  const rows = datasetExamples.map((datasetExample) =>
    toExportDatasetExample({
      datasetExampleId: datasetExample.id,
      sourceSliceId: datasetExample.sourceSlice.id,
      specSlug: datasetExample.datasetSpec.slug,
      version: datasetExample.datasetSpec.version,
      inputPayload: datasetExample.inputPayloadJson as JsonObject,
      outputPayload: datasetExample.outputPayloadJson as JsonObject,
    }),
  );

  return new Response(buildJsonl(rows), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dataset-examples.jsonl"',
    },
  });
}
