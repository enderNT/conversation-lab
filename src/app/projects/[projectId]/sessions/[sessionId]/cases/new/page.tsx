import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseStatus } from "@prisma/client";
import { CaseEditorForm } from "@/components/case-editor-form";
import { deriveLastUserMessage, toConversationSlice } from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { parseInteger } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewCasePage({
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

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      project: true,
      messages: {
        where: {
          orderIndex: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  if (session.messages.length !== end - start + 1 || session.messages.length === 0) {
    notFound();
  }

  const conversationSlice = toConversationSlice(session.messages);

  return (
    <div className="space-y-8">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <Link
          href={`/projects/${projectId}/sessions/${sessionId}`}
          className="text-sm text-[var(--muted)] underline underline-offset-4"
        >
          Back to session
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Create case from selected conversation
        </h1>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          Proyecto: {session.project.name} • Sesión: {session.title || "Untitled session"} • Turnos {start + 1} a {end + 1}
        </p>
      </section>

      <CaseEditorForm
        mode="create"
        projectId={projectId}
        sessionId={sessionId}
        title=""
        lastUserMessage={deriveLastUserMessage(conversationSlice)}
        labels={{ expected_route: "" }}
        artifacts={{
          ideal_search_query: "",
          ideal_answer: "",
          expected_tool: "",
        }}
        notes=""
        status={CaseStatus.draft}
        conversationSlice={conversationSlice}
        selection={{
          startOrderIndex: start,
          endOrderIndex: end,
        }}
      />
    </div>
  );
}