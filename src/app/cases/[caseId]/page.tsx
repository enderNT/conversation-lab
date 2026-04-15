import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseEditorForm } from "@/components/case-editor-form";
import { parseCaseArtifacts, parseCaseLabels, parseConversationSlice } from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;

  const caseItem = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      project: {
        select: { name: true },
      },
      session: {
        select: { title: true },
      },
    },
  });

  if (!caseItem) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <Link href="/cases" className="text-sm text-[var(--muted)] underline underline-offset-4">
          Back to case library
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {caseItem.title || "Untitled case"}
          </h1>
          <StatusBadge status={caseItem.status} />
        </div>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {caseItem.project.name} • {caseItem.session.title || "Untitled session"} • Updated {formatDate(caseItem.updatedAt)}
        </p>
      </section>

      <CaseEditorForm
        mode="edit"
        caseId={caseItem.id}
        projectId={caseItem.projectId}
        sessionId={caseItem.sessionId}
        title={caseItem.title || ""}
        lastUserMessage={caseItem.lastUserMessage}
        labels={parseCaseLabels(caseItem.labelsJson)}
        artifacts={parseCaseArtifacts(caseItem.artifactsJson)}
        notes={caseItem.notes}
        status={caseItem.status}
        conversationSlice={parseConversationSlice(caseItem.conversationSliceJson)}
      />
    </div>
  );
}