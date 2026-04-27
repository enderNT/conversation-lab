import Link from "next/link";
import { DatasetExampleReviewStatus } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function buildExportHref(searchParams: {
  projectId?: string;
  datasetSpecId?: string;
  reviewStatus?: string;
  from?: string;
  to?: string;
  version?: string;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/api/dataset-examples/export?${params.toString()}`;
}

export default async function ExportHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    datasetSpecId?: string;
    reviewStatus?: string;
    from?: string;
    to?: string;
    version?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  await ensureDefaultDatasetSpecs();

  const [projects, datasetSpecs, summary] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.datasetSpec.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, version: true },
    }),
    prisma.datasetExample.groupBy({
      by: ["reviewStatus"],
      _count: true,
    }),
  ]);

  const exportHref = buildExportHref(resolvedSearchParams);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Export Hub
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Exporta dataset examples a JSONL DSPy sin el pipeline viejo de artefactos.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Filtra por proyecto, spec, estado y versión; cada línea sale lista para usar en DSPy con solo `input` y `output`.
          </p>
        </div>

        <form action="/exports" className="surface rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Filtros de exportación</h2>
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
              <span className="text-sm font-medium">Versión</span>
              <input
                name="version"
                className="field"
                defaultValue={resolvedSearchParams.version || ""}
                placeholder="Versión del dataset example"
              />
            </label>

            <button type="submit" className="button-secondary w-full">
              Aplicar filtros
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((row) => (
          <article key={row.reviewStatus} className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <StatusBadge status={row.reviewStatus} />
              <p className="text-3xl font-semibold">{row._count}</p>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Dataset examples en este estado.
            </p>
          </article>
        ))}
      </section>

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Descarga</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          El archivo resultante usa una línea por example en formato `dspy_jsonl`.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={exportHref} className="button-primary">
            Exportar JSONL DSPy
          </Link>
        </div>
      </section>
    </div>
  );
}
