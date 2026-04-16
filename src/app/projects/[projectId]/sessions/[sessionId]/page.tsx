import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionSelection } from "@/components/session-selection";
import { StatusBadge } from "@/components/status-badge";
import { getChatRuntimeConfiguration } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

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
    <div className="space-y-8">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-[var(--muted)] underline underline-offset-4"
            >
              Back to project
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {session.title || "Untitled session"}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Project: {session.project.name} • {formatDate(session.createdAt)}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 px-4 py-3 text-sm text-[var(--muted)]">
            {session.messages.length} turn(s) stored as individual messages.
          </div>
        </div>
      </section>

      {!chatRuntime.enabled ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          El chat real con LLM está deshabilitado. {chatRuntime.disabledReason}
        </section>
      ) : null}

      <section>
        <SessionSelection
          projectId={projectId}
          sessionId={sessionId}
          chatRuntimeEnabled={chatRuntime.enabled}
          chatRuntimeDisabledReason={chatRuntime.disabledReason}
          chatProviderLabel={chatRuntime.providerLabel}
          chatBaseUrl={chatRuntime.baseUrl}
          chatModel={session.chatModel || ""}
          chatConnectionCheckedAt={session.chatConnectionCheckedAt?.toISOString() ?? null}
          chatConnectionVerifiedAt={session.chatConnectionVerifiedAt?.toISOString() ?? null}
          chatConnectionError={session.chatConnectionError}
          caseCount={session.cases.length}
          systemPrompt={session.systemPrompt || ""}
          messages={session.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            orderIndex: message.orderIndex,
            createdAt: message.createdAt.toISOString(),
          }))}
        />
      </section>

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Cases from this session</h2>
          <Link href={`/cases?projectId=${projectId}`} className="button-secondary">
            Open case library
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {session.cases.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
              Todavía no se han guardado casos para esta sesión.
            </div>
          ) : null}

          {session.cases.map((caseItem) => (
            <article key={caseItem.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">
                    {caseItem.title || "Untitled case"}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Updated {formatDate(caseItem.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={caseItem.status} />
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted-strong)]">
                {caseItem.lastUserMessage}
              </p>
              <Link href={`/cases/${caseItem.id}`} className="button-primary mt-5 inline-flex">
                Open Case
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}