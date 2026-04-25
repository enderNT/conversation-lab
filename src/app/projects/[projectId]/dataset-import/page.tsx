import Link from "next/link";
import { notFound } from "next/navigation";
import { DatasetImportForm } from "@/components/dataset-import-form";
import { ensureDefaultDatasetSpecs } from "@/lib/dataset-specs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M19 12H5" strokeLinecap="round" />
      <path d="m11 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ProjectDatasetImportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  await ensureDefaultDatasetSpecs();

  const [project, datasetSpecs] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
      },
    }),
    prisma.datasetSpec.findMany({
      where: { isActive: true },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        version: true,
      },
    }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-strong)] transition hover:text-[var(--foreground)]"
        >
          <BackArrowIcon />
          <span>Volver al proyecto</span>
        </Link>

        <div className="max-w-4xl">
          <p className="mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--muted)]">
            Project Import
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Importar dataset examples en {project.name}
          </h1>
          <p className="mt-4 text-base leading-8 text-[var(--muted)]">
            Convierte un archivo JSONL en examples persistidos para curarlos dentro del editor actual.
          </p>
        </div>
      </section>

      {datasetSpecs.length === 0 ? (
        <section className="surface rounded-[1.8rem] p-6 text-sm leading-7 text-[var(--muted)]">
          No hay dataset specs activos para importar examples todavía.{" "}
          <Link href="/dataset-specs" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
            Crea o activa uno aquí
          </Link>
          .
        </section>
      ) : (
        <DatasetImportForm
          projectId={project.id}
          datasetSpecs={datasetSpecs.map((datasetSpec) => ({
            id: datasetSpec.id,
            name: datasetSpec.name,
            slug: datasetSpec.slug,
            version: datasetSpec.version,
          }))}
        />
      )}
    </div>
  );
}
