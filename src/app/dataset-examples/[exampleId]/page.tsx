import { notFound } from "next/navigation";
import { DatasetExampleEditor } from "@/components/dataset-example-editor";
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

  const [datasetExample, datasetSpecs, llmConfigurations, ragConfigurations] = await Promise.all([
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
    prisma.llmConfiguration.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        chatModel: true,
        updatedAt: true,
      },
    }),
    prisma.ragConfiguration.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        collectionName: true,
        embeddingModel: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!datasetExample) {
    notFound();
  }

  const sourceSlice = sourceSliceFromPrisma(datasetExample.sourceSlice);

  return (
    <DatasetExampleEditor
      mode="edit"
      datasetExampleId={datasetExample.id}
      backHref="/dataset-examples"
      backLabel="Volver a dataset examples"
      sourceSlice={sourceSlice}
      datasetSpecs={datasetSpecs.map(datasetSpecFromPrisma)}
      llmConfigurations={llmConfigurations.map((configuration) => ({
        id: configuration.id,
        name: configuration.name,
        chatModel: configuration.chatModel,
        updatedAt: configuration.updatedAt.toISOString(),
      }))}
      ragConfigurations={ragConfigurations.map((configuration) => ({
        id: configuration.id,
        name: configuration.name,
        collectionName: configuration.collectionName,
        embeddingModel: configuration.embeddingModel,
        updatedAt: configuration.updatedAt.toISOString(),
      }))}
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
        llmConfigurationId: mapping.llmConfigurationId,
        llmPromptText: mapping.llmPromptText,
        llmContextSelectionJson: mapping.llmContextSelectionJson as JsonValue | null,
        llmGeneratedValueJson: mapping.llmGeneratedValueJson as JsonValue | null,
        llmGenerationMetaJson: mapping.llmGenerationMetaJson as JsonValue | null,
        ragConfigurationId: mapping.ragConfigurationId,
        ragPromptText: mapping.ragPromptText,
        ragGeneratedValueJson: mapping.ragGeneratedValueJson as JsonValue | null,
        ragGenerationMetaJson: mapping.ragGenerationMetaJson as JsonValue | null,
        resolvedPreviewJson: mapping.resolvedPreviewJson as JsonValue | null,
      }))}
      initialValidationState={parseValidationState(datasetExample.validationStateJson as JsonValue)}
      metadata={{
        specSlug: datasetExample.datasetSpec.slug,
        version: datasetExample.version,
        sourceSliceId: datasetExample.sourceSliceId,
        fieldMappingCount: datasetExample.fieldMappings.length,
      }}
      action={updateDatasetExampleWithFeedback.bind(null, datasetExample.id)}
    />
  );
}
