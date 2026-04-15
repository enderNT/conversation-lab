import Link from "next/link";
import { DerivedExampleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

function buildExportHref(searchParams: {
  projectId?: string;
  taskSpecId?: string;
  reviewStatus?: string;
  approvedOnly?: string;
  from?: string;
  to?: string;
  version?: string;
  format: "json" | "jsonl";
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/api/derived-examples/export?${params.toString()}`;
}

export default async function ExportHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    taskSpecId?: string;
    reviewStatus?: string;
    approvedOnly?: string;
    from?: string;
    to?: string;
    version?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  await ensureDefaultTaskSpecs();

  const [projects, taskSpecs, summary] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.taskSpec.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, version: true },
    }),
    prisma.derivedExample.groupBy({
      by: ["reviewStatus"],
      _count: true,
    }),
  ]);

  const jsonHref = buildExportHref({
    ...resolvedSearchParams,
    format: "json",
  });
  const jsonlHref = buildExportHref({
    ...resolvedSearchParams,
    format: "jsonl",
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Export Hub
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Export reviewed derived examples in task-aligned JSON or JSONL with full provenance.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Filters apply by project, task spec, review status, date range, and version. Exported metadata keeps the source case, selected turns, artifacts used, editor, generation mode, and task-spec version.
          </p>
        </div>

        <form action="/exports" className="surface rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Export filters</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Project</span>
              <select name="projectId" className="field" defaultValue={resolvedSearchParams.projectId || ""}>
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Task spec</span>
              <select name="taskSpecId" className="field" defaultValue={resolvedSearchParams.taskSpecId || ""}>
                <option value="">All task specs</option>
                {taskSpecs.map((taskSpec) => (
                  <option key={taskSpec.id} value={taskSpec.id}>
                    {taskSpec.name} (v{taskSpec.version})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Review status</span>
              <select name="reviewStatus" className="field" defaultValue={resolvedSearchParams.reviewStatus || ""}>
                <option value="">All review states</option>
                {Object.values(DerivedExampleStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="approvedOnly" value="true" defaultChecked={resolvedSearchParams.approvedOnly === "true"} />
              Approved only
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">From</span>
                <input type="date" name="from" className="field" defaultValue={resolvedSearchParams.from || ""} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">To</span>
                <input type="date" name="to" className="field" defaultValue={resolvedSearchParams.to || ""} />
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Version</span>
              <input name="version" className="field" defaultValue={resolvedSearchParams.version || ""} placeholder="Task spec version or derived example version" />
            </label>
            <button type="submit" className="button-secondary w-full">
              Apply filters
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.map((row) => (
          <article key={row.reviewStatus} className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <StatusBadge status={row.reviewStatus} />
              <p className="text-3xl font-semibold">{row._count}</p>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Derived examples in this review state.
            </p>
          </article>
        ))}
      </section>

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Download</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Both formats align rows to the selected task spec export shape and preserve provenance metadata.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={jsonHref} className="button-primary">
            Export JSON
          </Link>
          <Link href={jsonlHref} className="button-secondary">
            Export JSONL
          </Link>
        </div>
      </section>
    </div>
  );
}