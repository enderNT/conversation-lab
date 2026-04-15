import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseEditorForm } from "@/components/case-editor-form";
import {
  buildDerivedExamplePreview,
  parseConversationSlice,
  parseInterpretation,
  suggestCompatibleTaskSpecs,
} from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ taskSpecId?: string }>;
}) {
  const { caseId } = await params;
  const resolvedSearchParams = await searchParams;

  await ensureDefaultTaskSpecs();

  const [caseItem, taskSpecs] = await Promise.all([
    prisma.case.findUnique({
      where: { id: caseId },
      include: {
        project: {
          select: { name: true },
        },
        session: {
          select: { title: true },
        },
        artifacts: {
          orderBy: { type: "asc" },
        },
        derivedExamples: {
          orderBy: { updatedAt: "desc" },
          include: {
            taskSpec: {
              select: {
                id: true,
                name: true,
                slug: true,
                version: true,
                taskType: true,
              },
            },
            outgoingRelations: {
              include: {
                toDerivedExample: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            incomingRelations: {
              include: {
                fromDerivedExample: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.taskSpec.findMany({
      where: { isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        taskType: true,
        version: true,
        requiredArtifactsJson: true,
        optionalArtifactsJson: true,
        inputSchemaJson: true,
        outputSchemaJson: true,
        validationRulesJson: true,
      },
    }),
  ]);

  if (!caseItem) {
    notFound();
  }

  const taskSuggestions = suggestCompatibleTaskSpecs(taskSpecs, caseItem.artifacts);
  const previewTaskSpec =
    taskSpecs.find((taskSpec) => taskSpec.id === resolvedSearchParams.taskSpecId) ||
    null;
  const projectionPreview = previewTaskSpec
    ? buildDerivedExamplePreview({
        caseRecord: caseItem,
        artifacts: caseItem.artifacts,
        taskSpec: previewTaskSpec,
      })
    : null;

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
        projectName={caseItem.project.name}
        sessionId={caseItem.sessionId}
        sessionTitle={caseItem.session.title || "Untitled session"}
        title={caseItem.title || ""}
        sourceSummary={caseItem.sourceSummary}
        lastUserMessage={caseItem.lastUserMessage}
        interpretation={parseInterpretation(caseItem.interpretationJson)}
        artifacts={caseItem.artifacts}
        taskCandidateIds={Array.isArray(caseItem.taskCandidatesJson) ? caseItem.taskCandidatesJson.map(String) : []}
        status={caseItem.status}
        reviewStatus={caseItem.reviewStatus}
        projectionStatus={caseItem.projectionStatus}
        conversationSlice={parseConversationSlice(caseItem.conversationSliceJson)}
        surroundingContext={parseConversationSlice(caseItem.sourceContextJson)}
        sourceMetadataJson={caseItem.sourceMetadataJson}
        taskSuggestions={taskSuggestions}
        previewTaskSpec={previewTaskSpec}
        projectionPreview={projectionPreview}
        derivedExamples={caseItem.derivedExamples}
      />
    </div>
  );
}