import { notFound } from "next/navigation";
import { SessionSelection } from "@/components/session-selection";
import { getChatRuntimeConfiguration } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SessionChatPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
}) {
  const { projectId, sessionId } = await params;

  const [session, projectSessions] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        project: true,
        _count: {
          select: {
            cases: true,
          },
        },
        messages: {
          orderBy: { orderIndex: "asc" },
        },
        cases: {
          orderBy: { updatedAt: "desc" },
          take: 6,
        },
      },
    }),
    prisma.session.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            messages: true,
            cases: true,
          },
        },
      },
    }),
  ]);

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  const chatRuntime = getChatRuntimeConfiguration(session.chatBaseUrl, session.chatApiKey);

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
          sessionCreatedAt={session.createdAt.toISOString()}
          sessionHistory={projectSessions.map((projectSession) => ({
            id: projectSession.id,
            title: projectSession.title || "Chat sin titulo",
            createdAt: projectSession.createdAt.toISOString(),
            messageCount: projectSession._count.messages,
            caseCount: projectSession._count.cases,
          }))}
          chatRuntimeEnabled={chatRuntime.enabled}
          chatRuntimeDisabledReason={chatRuntime.disabledReason}
          chatProviderLabel={chatRuntime.providerLabel}
          chatBaseUrl={session.chatBaseUrl || ""}
          chatApiKey={session.chatApiKey || ""}
          chatResolvedBaseUrl={chatRuntime.resolvedBaseUrl}
          chatModel={session.chatModel || ""}
          chatConnectionCheckedAt={session.chatConnectionCheckedAt?.toISOString() ?? null}
          chatConnectionVerifiedAt={session.chatConnectionVerifiedAt?.toISOString() ?? null}
          chatConnectionError={session.chatConnectionError}
          caseCount={session._count.cases}
          systemPrompt={session.systemPrompt || ""}
          recentCases={session.cases.map((caseItem) => ({
            id: caseItem.id,
            title: caseItem.title || "Untitled case",
            status: caseItem.status,
            lastUserMessage: caseItem.lastUserMessage,
            updatedAt: caseItem.updatedAt.toISOString(),
          }))}
          messages={session.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            orderIndex: message.orderIndex,
            createdAt: message.createdAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
