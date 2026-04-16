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

  const session = await prisma.session.findUnique({
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
  });

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  const chatRuntime = getChatRuntimeConfiguration();

  return (
    <div className="-mx-4 flex min-h-0 flex-1 flex-col sm:-mx-6 lg:-mx-8">
      {!chatRuntime.enabled ? (
        <section className="mx-4 mb-4 rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:mx-6 lg:mx-8">
          El chat real con LLM está deshabilitado. {chatRuntime.disabledReason}
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col">
        <SessionSelection
          projectId={projectId}
          sessionId={sessionId}
          projectName={session.project.name}
          sessionTitle={session.title || "Untitled session"}
          sessionCreatedAt={session.createdAt.toISOString()}
          chatRuntimeEnabled={chatRuntime.enabled}
          chatRuntimeDisabledReason={chatRuntime.disabledReason}
          chatProviderLabel={chatRuntime.providerLabel}
          chatBaseUrl={chatRuntime.baseUrl}
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