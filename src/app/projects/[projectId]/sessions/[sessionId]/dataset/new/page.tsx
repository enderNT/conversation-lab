import { notFound } from "next/navigation";
import {
  createDatasetExampleFromSourceSliceWithFeedback,
  createDatasetExampleWithFeedback,
} from "@/app/actions";
import { DatasetExampleEditor } from "@/components/dataset-example-editor";
import {
  buildSourceSliceMetadata,
  datasetSpecFromPrisma,
  deriveLastUserMessage,
  sourceSliceFromPrisma,
  toConversationSlice,
} from "@/lib/datasets";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";
import { parseInteger } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewDatasetExamplePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
  searchParams: Promise<{ start?: string; end?: string; sourceSliceId?: string }>;
}) {
  const { projectId, sessionId } = await params;
  const resolvedSearchParams = await searchParams;
  const start = parseInteger(resolvedSearchParams.start);
  const end = parseInteger(resolvedSearchParams.end);
  const sourceSliceId = resolvedSearchParams.sourceSliceId?.trim() || null;

  const usingSelection = start !== null && end !== null;
  const usingSavedSourceSlice = !!sourceSliceId;

  if ((usingSelection && usingSavedSourceSlice) || (!usingSelection && !usingSavedSourceSlice)) {
    notFound();
  }

  if (usingSelection && start! > end!) {
    notFound();
  }

  await ensureDefaultDatasetSpecs();

  const [session, datasetSpecs, lastUsedDatasetExample, llmConfigurations, ragConfigurations] =
    await Promise.all([
      prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          project: true,
        },
      }),
      prisma.datasetSpec.findMany({
        where: { isActive: true },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      }),
      prisma.datasetExample.findFirst({
        orderBy: { updatedAt: "desc" },
        where: {
          datasetSpec: {
            isActive: true,
          },
        },
        select: {
          datasetSpecId: true,
        },
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

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  const sourceSlice = usingSavedSourceSlice
    ? await prisma.sourceSlice.findUnique({
        where: { id: sourceSliceId! },
        select: {
          id: true,
          projectId: true,
          sessionId: true,
          title: true,
          conversationSliceJson: true,
          surroundingContextJson: true,
          selectedTurnIdsJson: true,
          lastUserMessage: true,
          sourceSummary: true,
          sourceMetadataJson: true,
        },
      })
    : null;

  if (usingSavedSourceSlice) {
    if (!sourceSlice || sourceSlice.projectId !== projectId || sourceSlice.sessionId !== sessionId) {
      notFound();
    }
  }

  const sourceSliceDraft = usingSavedSourceSlice
    ? sourceSliceFromPrisma(sourceSlice!)
    : await (async () => {
        const [selectedMessages, contextMessages] = await Promise.all([
          prisma.message.findMany({
            where: {
              sessionId,
              orderIndex: {
                gte: start!,
                lte: end!,
              },
            },
            orderBy: { orderIndex: "asc" },
          }),
          prisma.message.findMany({
            where: {
              sessionId,
              orderIndex: {
                gte: Math.max(0, start! - 3),
                lte: end! + 3,
              },
            },
            orderBy: { orderIndex: "asc" },
          }),
        ]);

        if (selectedMessages.length !== end! - start! + 1 || selectedMessages.length === 0) {
          notFound();
        }

        return {
          projectId,
          sessionId,
          title: session.title
            ? `${session.title} · turnos ${start! + 1}-${end! + 1}`
            : `Slice ${start! + 1}-${end! + 1}`,
          conversationSlice: toConversationSlice(selectedMessages),
          surroundingContext: toConversationSlice(
            contextMessages.filter((message) => message.orderIndex < start! || message.orderIndex > end!),
          ),
          selectedTurnIds: selectedMessages.map((message) => message.id),
          lastUserMessage: deriveLastUserMessage(toConversationSlice(selectedMessages)),
          sourceSummary: "",
          sourceMetadata: buildSourceSliceMetadata({
            projectId,
            sessionId,
            sessionNotes: session.curationNotes ?? "",
            selectedTurnIds: selectedMessages.map((message) => message.id),
            startOrderIndex: start!,
            endOrderIndex: end!,
          }),
        };
      })();

  const selectedDatasetSpecId =
    lastUsedDatasetExample?.datasetSpecId ?? datasetSpecs[0]?.id ?? "";
  const selectedDatasetSpec =
    datasetSpecs.find((datasetSpec) => datasetSpec.id === selectedDatasetSpecId) ??
    datasetSpecs[0] ??
    null;

  return (
    <DatasetExampleEditor
      mode="create"
      datasetExampleId={null}
      backHref={`/projects/${projectId}/sessions/${sessionId}`}
      backLabel="Volver al chat"
      sourceSlice={sourceSliceDraft}
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
      initialDatasetSpecId={selectedDatasetSpec?.id ?? ""}
      initialTitle=""
      initialReviewStatus="draft"
      initialInputPayload={{}}
      initialOutputPayload={{}}
      initialValidationState={null}
      action={
        usingSavedSourceSlice
          ? createDatasetExampleFromSourceSliceWithFeedback.bind(
              null,
              projectId,
              sessionId,
              sourceSliceId!,
            )
          : createDatasetExampleWithFeedback.bind(null, projectId, sessionId, start!, end!)
      }
    />
  );
}
