import { notFound } from "next/navigation";
import { createDatasetExampleWithFeedback } from "@/app/actions";
import { DatasetExampleEditor } from "@/components/dataset-example-editor";
import {
  buildSourceSliceMetadata,
  datasetSpecFromPrisma,
  deriveLastUserMessage,
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
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { projectId, sessionId } = await params;
  const resolvedSearchParams = await searchParams;
  const start = parseInteger(resolvedSearchParams.start);
  const end = parseInteger(resolvedSearchParams.end);

  if (start === null || end === null || start > end) {
    notFound();
  }

  await ensureDefaultDatasetSpecs();

  const [
    session,
    selectedMessages,
    contextMessages,
    datasetSpecs,
    lastUsedDatasetExample,
    llmConfigurations,
    ragConfigurations,
  ] =
    await Promise.all([
      prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          project: true,
        },
      }),
      prisma.message.findMany({
        where: {
          sessionId,
          orderIndex: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { orderIndex: "asc" },
      }),
      prisma.message.findMany({
        where: {
          sessionId,
          orderIndex: {
            gte: Math.max(0, start - 3),
            lte: end + 3,
          },
        },
        orderBy: { orderIndex: "asc" },
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
          queryModel: true,
          updatedAt: true,
        },
      }),
    ]);

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  if (selectedMessages.length !== end - start + 1 || selectedMessages.length === 0) {
    notFound();
  }

  const sourceSlice = {
    projectId,
    sessionId,
    title: session.title
      ? `${session.title} · turnos ${start + 1}-${end + 1}`
      : `Slice ${start + 1}-${end + 1}`,
    conversationSlice: toConversationSlice(selectedMessages),
    surroundingContext: toConversationSlice(
      contextMessages.filter(
        (message) => message.orderIndex < start || message.orderIndex > end,
      ),
    ),
    selectedTurnIds: selectedMessages.map((message) => message.id),
    lastUserMessage: deriveLastUserMessage(toConversationSlice(selectedMessages)),
    sourceSummary: "",
    sourceMetadata: buildSourceSliceMetadata({
      projectId,
      sessionId,
      sessionNotes: session.curationNotes ?? "",
      selectedTurnIds: selectedMessages.map((message) => message.id),
      startOrderIndex: start,
      endOrderIndex: end,
    }),
  };

  const selectedDatasetSpecId =
    lastUsedDatasetExample?.datasetSpecId ?? datasetSpecs[0]?.id ?? "";
  const selectedDatasetSpec =
    datasetSpecs.find((datasetSpec) => datasetSpec.id === selectedDatasetSpecId) ??
    datasetSpecs[0] ??
    null;

  return (
    <DatasetExampleEditor
      mode="create"
      backHref={`/projects/${projectId}/sessions/${sessionId}`}
      backLabel="Volver al chat"
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
        queryModel: configuration.queryModel,
        updatedAt: configuration.updatedAt.toISOString(),
      }))}
      initialDatasetSpecId={selectedDatasetSpec?.id ?? ""}
      initialTitle=""
      initialReviewStatus="draft"
      initialInputPayload={{}}
      initialOutputPayload={{}}
      initialValidationState={null}
      action={createDatasetExampleWithFeedback.bind(null, projectId, sessionId, start, end)}
    />
  );
}
