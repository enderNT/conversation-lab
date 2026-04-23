import { notFound } from "next/navigation";
import { SessionSelection } from "@/components/session-selection";
import { getSessionChatRuntimeConfiguration, serializeChatRequest } from "@/lib/session-chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SessionChatPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
}) {
  const { projectId, sessionId } = await params;

  const [session, projectSessions, llmConfigurations, sessionTags, recentDatasetExamples, savedSourceSlices] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            sourceSlices: true,
          },
        },
        chatRequests: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
        messages: {
          orderBy: { orderIndex: "asc" },
        },
      },
    }),
    prisma.session.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        tags: {
          include: {
            tag: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            messages: true,
            sourceSlices: true,
          },
        },
      },
    }),
    prisma.llmConfiguration.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.sessionTag.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.datasetExample.findMany({
      where: {
        sourceSlice: {
          sessionId,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        sourceSlice: {
          select: {
            lastUserMessage: true,
          },
        },
      },
    }),
    prisma.sourceSlice.findMany({
      where: {
        sessionId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            datasetExamples: true,
          },
        },
      },
    }),
  ]);

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  const chatRuntime = getSessionChatRuntimeConfiguration({
    transport: session.chatTransport,
    baseUrl: session.chatBaseUrl,
    apiKey: session.chatApiKey,
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {!chatRuntime.enabled ? (
        <section className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          El chat real con LLM está deshabilitado. {chatRuntime.disabledReason}
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SessionSelection
          projectId={projectId}
          sessionId={sessionId}
          projectName={session.project.name}
          sessionTitle={session.title || ""}
          sessionHistory={projectSessions.map((projectSession) => ({
            id: projectSession.id,
            title: projectSession.title || "Chat sin titulo",
            createdAt: projectSession.createdAt.toISOString(),
            messageCount: projectSession._count.messages,
            caseCount: projectSession._count.sourceSlices,
            tags: projectSession.tags.map((assignment) => ({
              id: assignment.tag.id,
              name: assignment.tag.name,
            })),
          }))}
          sessionTags={session.tags.map((assignment) => ({
            id: assignment.tag.id,
            name: assignment.tag.name,
          }))}
          availableSessionTags={sessionTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
          }))}
          chatTransport={session.chatTransport}
          latestChatRequest={serializeChatRequest(session.chatRequests[0])}
          chatRuntimeEnabled={chatRuntime.enabled}
          chatRuntimeDisabledReason={chatRuntime.disabledReason}
          chatProviderLabel={chatRuntime.providerLabel}
          chatBaseUrl={session.chatBaseUrl || ""}
          chatApiKey={session.chatApiKey || ""}
          chatResolvedBaseUrl={chatRuntime.resolvedBaseUrl}
          chatModel={session.chatModel || ""}
          savedLlmConfigurations={llmConfigurations.map((configuration) => ({
            id: configuration.id,
            name: configuration.name,
            chatModel: configuration.chatModel,
            chatBaseUrl: configuration.chatBaseUrl || "",
            chatApiKey: configuration.chatApiKey || "",
            systemPrompt: configuration.systemPrompt || "",
          }))}
          chatConnectionCheckedAt={session.chatConnectionCheckedAt?.toISOString() ?? null}
          chatConnectionVerifiedAt={session.chatConnectionVerifiedAt?.toISOString() ?? null}
          chatConnectionError={session.chatConnectionError}
          caseCount={session._count.sourceSlices}
          curationNotes={session.curationNotes || ""}
          systemPrompt={session.systemPrompt || ""}
          recentCases={recentDatasetExamples.map((datasetExample) => ({
            id: datasetExample.id,
            title: datasetExample.title || "Untitled dataset example",
            status: datasetExample.reviewStatus,
            lastUserMessage: datasetExample.sourceSlice.lastUserMessage,
            updatedAt: datasetExample.updatedAt.toISOString(),
          }))}
          savedSlices={savedSourceSlices.map((sourceSlice) => ({
            id: sourceSlice.id,
            title: sourceSlice.title || "Slice sin título",
            lastUserMessage: sourceSlice.lastUserMessage,
            sourceSummary: sourceSlice.sourceSummary,
            updatedAt: sourceSlice.updatedAt.toISOString(),
            linkedExampleCount: sourceSlice._count.datasetExamples,
            turnCount: Array.isArray(sourceSlice.selectedTurnIdsJson)
              ? sourceSlice.selectedTurnIdsJson.length
              : 0,
          }))}
          messages={session.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            orderIndex: message.orderIndex,
            createdAt: message.createdAt.toISOString(),
            isEdited:
              !!message.metadataJson &&
              typeof message.metadataJson === "object" &&
              !Array.isArray(message.metadataJson) &&
              typeof message.metadataJson.editedAt === "string",
          }))}
        />
      </section>
    </div>
  );
}
