import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectSessionCard } from "@/components/project-session-card";
import { SessionCreateForm } from "@/components/session-create-form";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        include: {
          tags: {
            include: {
              tag: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              messages: true,
              sourceSlices: true,
            },
          },
        },
      },
      _count: {
        select: {
          sessions: true,
          sourceSlices: true,
        },
      },
    },
  });
  const sessionTags = await prisma.sessionTag.findMany({
    orderBy: { name: "asc" },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="surface rounded-[1.75rem] p-5 sm:p-6">
          <Link href="/" className="text-sm text-[var(--muted)] underline underline-offset-4">
            Back to projects
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[var(--muted)]">
            {project.description || "Sin descripción."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
              <p className="text-sm text-[var(--muted)]">Sessions</p>
              <p className="mt-2 text-2xl font-semibold">{project._count.sessions}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
              <p className="text-sm text-[var(--muted)]">Slices</p>
              <p className="mt-2 text-2xl font-semibold">{project._count.sourceSlices}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
              <p className="text-sm text-[var(--muted)]">Created</p>
              <p className="mt-2 text-sm font-semibold">{formatDate(project.createdAt)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/dataset-examples?projectId=${project.id}`} className="button-secondary">
              View dataset examples
            </Link>
          </div>
        </div>

        <SessionCreateForm projectId={project.id} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Sessions</h2>
          <p className="text-sm text-[var(--muted)]">
            Abre una sesión para conversar con el modelo y seleccionar slices consecutivos.
          </p>
        </div>

        {project.sessions.length === 0 ? (
          <div className="surface rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            Este proyecto todavía no tiene sesiones.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {project.sessions.map((session, index) => (
            <ProjectSessionCard
              key={session.id}
              projectId={project.id}
              index={index}
              availableTags={sessionTags.map((tag) => ({
                id: tag.id,
                name: tag.name,
              }))}
              session={{
                id: session.id,
                title: session.title || "",
                createdAt: session.createdAt.toISOString(),
                messageCount: session._count.messages,
                caseCount: session._count.sourceSlices,
                tags: session.tags.map((assignment) => ({
                  id: assignment.tag.id,
                  name: assignment.tag.name,
                })),
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
