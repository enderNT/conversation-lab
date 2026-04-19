import Link from "next/link";
import { DatasetExampleReviewStatus } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DatasetExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    datasetSpecId?: string;
    reviewStatus?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  await ensureDefaultDatasetSpecs();

  const [projects, datasetSpecs, datasetExamples] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.datasetSpec.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, version: true },
    }),
    prisma.datasetExample.findMany({
      where: {
        ...(resolvedSearchParams.datasetSpecId
          ? { datasetSpecId: resolvedSearchParams.datasetSpecId }
          : {}),
        ...(resolvedSearchParams.projectId
          ? {
              sourceSlice: {
                projectId: resolvedSearchParams.projectId,
              },
            }
          : {}),
        ...(resolvedSearchParams.reviewStatus &&
        Object.values(DatasetExampleReviewStatus).includes(
          resolvedSearchParams.reviewStatus as DatasetExampleReviewStatus,
        )
          ? {
              reviewStatus:
                resolvedSearchParams.reviewStatus as DatasetExampleReviewStatus,
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        datasetSpec: {
          select: {
            id: true,
            name: true,
            slug: true,
            version: true,
          },
        },
        sourceSlice: {
          select: {
            id: true,
            title: true,
            lastUserMessage: true,
            sourceSummary: true,
            session: {
              select: {
                title: true,
              },
            },
            project: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Dataset Examples
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Biblioteca curada de ejemplos DSPy listos para revisar, corregir y exportar.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Cada ejemplo conserva el slice fuente, el mapping por campo y el JSON final usado para el JSONL.
          </p>
        </div>

        <form action="/dataset-examples" className="surface rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Filtros</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Proyecto</span>
              <select name="projectId" className="field" defaultValue={resolvedSearchParams.projectId || ""}>
                <option value="">Todos</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Dataset spec</span>
              <select name="datasetSpecId" className="field" defaultValue={resolvedSearchParams.datasetSpecId || ""}>
                <option value="">Todos</option>
                {datasetSpecs.map((datasetSpec) => (
                  <option key={datasetSpec.id} value={datasetSpec.id}>
                    {datasetSpec.name} (v{datasetSpec.version})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Estado</span>
              <select name="reviewStatus" className="field" defaultValue={resolvedSearchParams.reviewStatus || ""}>
                <option value="">Todos</option>
                {Object.values(DatasetExampleReviewStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="button-primary w-full">
              Aplicar filtros
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {datasetExamples.length === 0 ? (
          <div className="surface rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            No hay dataset examples que coincidan con los filtros actuales.
          </div>
        ) : null}

        {datasetExamples.map((datasetExample) => (
          <article key={datasetExample.id} className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold">
                    {datasetExample.title || datasetExample.sourceSlice.title || "Untitled dataset example"}
                  </h2>
                  <StatusBadge status={datasetExample.reviewStatus} />
                </div>

                <p className="mt-2 text-sm text-[var(--muted)]">
                  {datasetExample.sourceSlice.project.name} • {datasetExample.sourceSlice.session.title || "Sesión sin título"} • {datasetExample.datasetSpec.name} • actualizado {formatDate(datasetExample.updatedAt)}
                </p>

                <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted-strong)]">
                  {datasetExample.sourceSlice.sourceSummary || datasetExample.sourceSlice.lastUserMessage}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                  <span className="rounded-full border border-[var(--line)] px-3 py-1">
                    {datasetExample.datasetSpec.slug}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1">
                    source slice {datasetExample.sourceSlice.id.slice(0, 8)}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-sm space-y-3">
                <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">Último mensaje</p>
                  <p className="mt-2 line-clamp-4 leading-7 text-[var(--muted)]">
                    {datasetExample.sourceSlice.lastUserMessage}
                  </p>
                </div>

                <Link href={`/dataset-examples/${datasetExample.id}`} className="button-primary w-full justify-center">
                  Abrir editor
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
