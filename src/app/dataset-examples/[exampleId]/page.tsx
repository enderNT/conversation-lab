import Link from "next/link";
import { notFound } from "next/navigation";
import { DatasetExampleEditor } from "@/components/dataset-example-editor";
import { DatasetExampleReviewForm } from "@/components/dataset-example-review-form";
import { datasetSpecFromPrisma, parseValidationState, sourceSliceFromPrisma } from "@/lib/datasets";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";
import type { JsonObject, JsonValue } from "@/lib/types";
import { updateDatasetExampleWithFeedback } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function DatasetExampleDetailPage({
  params,
}: {
  params: Promise<{ exampleId: string }>;
}) {
  const { exampleId } = await params;

  await ensureDefaultDatasetSpecs();

  const [datasetExample, datasetSpecs] = await Promise.all([
    prisma.datasetExample.findUnique({
      where: { id: exampleId },
      include: {
        sourceSlice: true,
        datasetSpec: true,
        fieldMappings: {
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.datasetSpec.findMany({
      where: { isActive: true },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!datasetExample) {
    notFound();
  }

  const sourceSlice = sourceSliceFromPrisma(datasetExample.sourceSlice);

  return (
    <div className="space-y-8">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <Link href="/dataset-examples" className="text-sm text-[var(--muted)] underline underline-offset-4">
          Volver a dataset examples
        </Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <DatasetExampleEditor
          mode="edit"
          sourceSlice={sourceSlice}
          datasetSpecs={datasetSpecs.map(datasetSpecFromPrisma)}
          initialDatasetSpecId={datasetExample.datasetSpecId}
          initialTitle={datasetExample.title ?? ""}
          initialReviewStatus={datasetExample.reviewStatus}
          initialInputPayload={datasetExample.inputPayloadJson as JsonObject}
          initialOutputPayload={datasetExample.outputPayloadJson as JsonObject}
          initialMappings={datasetExample.fieldMappings.map((mapping) => ({
            side: mapping.side,
            fieldKey: mapping.fieldKey,
            sourceKey: mapping.sourceKey,
            sourcePath: mapping.sourcePath,
            transformChainJson: mapping.transformChainJson as JsonValue,
            constantValueJson: mapping.constantValueJson as JsonValue | null,
            manualValueJson: mapping.manualValueJson as JsonValue | null,
            resolvedPreviewJson: mapping.resolvedPreviewJson as JsonValue | null,
          }))}
          initialValidationState={parseValidationState(datasetExample.validationStateJson as JsonValue)}
          action={updateDatasetExampleWithFeedback.bind(null, datasetExample.id)}
        />

        <div className="space-y-4">
          <DatasetExampleReviewForm
            datasetExampleId={datasetExample.id}
            reviewStatus={datasetExample.reviewStatus}
          />

          <div className="surface rounded-[1.75rem] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Metadata</p>
            <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <p>Spec: {datasetExample.datasetSpec.slug}</p>
              <p>Versión: {datasetExample.version}</p>
              <p>Source slice: {datasetExample.sourceSliceId}</p>
              <p>Field mappings: {datasetExample.fieldMappings.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
