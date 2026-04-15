import Link from "next/link";
import { parseInterpretation, parseTaskCandidates, suggestCompatibleTaskSpecs } from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { CASE_STATUSES } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { CaseStatusForm } from "@/components/case-status-form";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    status?: string;
    taskSpecId?: string;
    completeness?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedProjectId = resolvedSearchParams.projectId || "all";
  const selectedStatus = CASE_STATUSES.includes(resolvedSearchParams.status as never)
    ? resolvedSearchParams.status
    : "all";
  const selectedTaskSpecId = resolvedSearchParams.taskSpecId || "all";
  const selectedCompleteness = resolvedSearchParams.completeness || "all";

  await ensureDefaultTaskSpecs();

  const [projects, taskSpecs, caseItems] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.taskSpec.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        taskType: true,
        version: true,
        requiredArtifactsJson: true,
        optionalArtifactsJson: true,
      },
    }),
    prisma.case.findMany({
      where: {
        ...(selectedProjectId !== "all" ? { projectId: selectedProjectId } : {}),
        ...(selectedStatus !== "all" ? { status: selectedStatus as (typeof CASE_STATUSES)[number] } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        project: {
          select: { name: true },
        },
        session: {
          select: { title: true },
        },
        artifacts: {
          select: { type: true },
        },
        derivedExamples: {
          select: { id: true },
        },
      },
    }),
  ]);

  const filteredCases = caseItems.filter((caseItem) => {
    const suggestions = suggestCompatibleTaskSpecs(taskSpecs, caseItem.artifacts);
    const interpretation = parseInterpretation(caseItem.interpretationJson);
    const taskCandidates = parseTaskCandidates(caseItem.taskCandidatesJson);
    const hasReadyProjection = suggestions.some((task) => task.compatible);
    const matchesTask =
      selectedTaskSpecId === "all"
        ? true
        : suggestions.some(
            (task) => task.id === selectedTaskSpecId || taskCandidates.includes(task.id),
          );
    const matchesCompleteness =
      selectedCompleteness === "all"
        ? true
        : selectedCompleteness === "complete"
          ? hasReadyProjection
          : !hasReadyProjection;

    return matchesTask && matchesCompleteness && interpretation !== null;
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Case Library V2
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Browse source cases, check artifact completeness, and project them into reusable task examples.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Cases are no longer final rows. They are structured source objects with interpretation, artifacts, candidate tasks, and linked derived examples.
          </p>
        </div>

        <form className="surface rounded-[1.75rem] p-5 sm:p-6" action="/cases">
          <h2 className="text-lg font-semibold">Filters</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Project</span>
              <select name="projectId" className="field" defaultValue={selectedProjectId}>
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Case status</span>
              <select name="status" className="field" defaultValue={selectedStatus}>
                <option value="all">all</option>
                {CASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Candidate task</span>
              <select name="taskSpecId" className="field" defaultValue={selectedTaskSpecId}>
                <option value="all">all</option>
                {taskSpecs.map((taskSpec) => (
                  <option key={taskSpec.id} value={taskSpec.id}>
                    {taskSpec.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Artifact completeness</span>
              <select name="completeness" className="field" defaultValue={selectedCompleteness}>
                <option value="all">all</option>
                <option value="complete">ready for at least one projection</option>
                <option value="incomplete">missing projection requirements</option>
              </select>
            </label>

            <div className="flex gap-3">
              <button type="submit" className="button-primary flex-1">
                Apply filters
              </button>
              <Link href="/exports" className="button-secondary flex-1 text-center">
                Open Export Hub
              </Link>
            </div>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {filteredCases.length === 0 ? (
          <div className="surface rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            No cases match the current filters.
          </div>
        ) : null}

        {filteredCases.map((caseItem) => {
          const interpretation = parseInterpretation(caseItem.interpretationJson);
          const suggestions = suggestCompatibleTaskSpecs(taskSpecs, caseItem.artifacts);
          const readyTasks = suggestions.filter((task) => task.compatible);
          const detectedSubtasks = interpretation.subtask_candidates.slice(0, 4);

          return (
            <article key={caseItem.id} className="surface rounded-[1.75rem] p-5 sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">
                      {caseItem.title || "Untitled case"}
                    </h2>
                    <StatusBadge status={caseItem.status} />
                    <StatusBadge status={caseItem.reviewStatus} />
                  </div>

                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {caseItem.project.name} • {caseItem.session.title || "Untitled session"} • Updated {formatDate(caseItem.updatedAt)}
                  </p>

                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-700">
                    {caseItem.sourceSummary || caseItem.lastUserMessage}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                    {detectedSubtasks.length > 0 ? detectedSubtasks.map((subtask) => (
                      <span key={`${caseItem.id}-${subtask}`} className="rounded-full border border-[var(--line)] px-3 py-1">
                        {subtask}
                      </span>
                    )) : (
                      <span className="rounded-full border border-[var(--line)] px-3 py-1">
                        No subtasks labeled yet
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                      <p className="text-[var(--muted)]">Artifacts</p>
                      <p className="mt-2 text-2xl font-semibold">{caseItem.artifacts.length}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                      <p className="text-[var(--muted)]">Derived</p>
                      <p className="mt-2 text-2xl font-semibold">{caseItem.derivedExamples.length}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                      <p className="text-[var(--muted)]">Ready tasks</p>
                      <p className="mt-2 text-2xl font-semibold">{readyTasks.length}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                    {caseItem.artifacts.map((artifact) => (
                      <span key={`${caseItem.id}-${artifact.type}`} className="rounded-full border border-[var(--line)] px-3 py-1">
                        {artifact.type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3">
                  <CaseStatusForm caseId={caseItem.id} status={caseItem.status} />

                  <Link href={`/cases/${caseItem.id}`} className="button-primary inline-flex w-full justify-center">
                    Open V2 editor
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}