import Link from "next/link";
import { CaseStatus } from "@prisma/client";
import { updateCaseStatus } from "@/app/actions";
import { parseCaseLabels } from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; status?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedProjectId = resolvedSearchParams.projectId || "all";
  const selectedStatus =
    resolvedSearchParams.status &&
    [CaseStatus.draft, CaseStatus.reviewed, CaseStatus.approved].includes(
      resolvedSearchParams.status as CaseStatus,
    )
      ? (resolvedSearchParams.status as CaseStatus)
      : "all";

  const [projects, cases] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.case.findMany({
      where: {
        ...(selectedProjectId !== "all" ? { projectId: selectedProjectId } : {}),
        ...(selectedStatus !== "all" ? { status: selectedStatus } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        project: {
          select: { name: true },
        },
        session: {
          select: { title: true },
        },
      },
    }),
  ]);

  const exportHref =
    selectedProjectId !== "all"
      ? `/api/cases/export?projectId=${selectedProjectId}`
      : "/api/cases/export";

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Case Library
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Revisa, corrige estados y exporta solo los casos aprobados.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--muted)]">
            El export por defecto devuelve únicamente casos `approved`. Puedes filtrar la biblioteca sin afectar esa salida base.
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
              <span className="text-sm font-medium">Status</span>
              <select name="status" className="field" defaultValue={selectedStatus}>
                <option value="all">all</option>
                <option value="draft">draft</option>
                <option value="reviewed">reviewed</option>
                <option value="approved">approved</option>
              </select>
            </label>

            <div className="flex gap-3">
              <button type="submit" className="button-primary flex-1">
                Apply filters
              </button>
              <Link href={exportHref} className="button-secondary flex-1 text-center">
                Export approved JSON
              </Link>
            </div>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {cases.length === 0 ? (
          <div className="surface rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            No hay casos para los filtros seleccionados.
          </div>
        ) : null}

        {cases.map((caseItem) => {
          const labels = parseCaseLabels(caseItem.labelsJson);

          return (
            <article key={caseItem.id} className="surface rounded-[1.75rem] p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">
                      {caseItem.title || "Untitled case"}
                    </h2>
                    <StatusBadge status={caseItem.status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {caseItem.project.name} • {caseItem.session.title || "Untitled session"} • Updated {formatDate(caseItem.updatedAt)}
                  </p>
                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-700">
                    {caseItem.lastUserMessage}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                    <span className="rounded-full border border-[var(--line)] px-3 py-1">
                      expected_route: {labels.expected_route || "-"}
                    </span>
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3">
                  <form
                    action={updateCaseStatus.bind(null, caseItem.id)}
                    className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4"
                  >
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Quick status change</span>
                      <select name="status" className="field" defaultValue={caseItem.status}>
                        <option value="draft">draft</option>
                        <option value="reviewed">reviewed</option>
                        <option value="approved">approved</option>
                      </select>
                    </label>
                    <button type="submit" className="button-secondary mt-3 w-full">
                      Save status
                    </button>
                  </form>

                  <Link href={`/cases/${caseItem.id}`} className="button-primary inline-flex w-full justify-center">
                    Open details
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