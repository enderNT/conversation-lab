import Link from "next/link";
import { notFound } from "next/navigation";
import { createSession } from "@/app/actions";
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
          _count: {
            select: {
              messages: true,
              cases: true,
            },
          },
        },
      },
      _count: {
        select: {
          sessions: true,
          cases: true,
        },
      },
    },
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
              <p className="text-sm text-[var(--muted)]">Cases</p>
              <p className="mt-2 text-2xl font-semibold">{project._count.cases}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
              <p className="text-sm text-[var(--muted)]">Created</p>
              <p className="mt-2 text-sm font-semibold">{formatDate(project.createdAt)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/cases?projectId=${project.id}`} className="button-secondary">
              View project cases
            </Link>
          </div>
        </div>

        <form action={createSession.bind(null, project.id)} className="surface rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Create session</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Usa un título corto o déjalo vacío para una sesión sin nombre.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Title</span>
              <input name="title" className="field" placeholder="Consulta sobre manchas en rostro" />
            </label>
            <button type="submit" className="button-primary w-full">
              Create Session
            </button>
          </div>
        </form>
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
            <article key={session.id} className="surface rounded-[1.75rem] p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Session {index + 1}
              </p>
              <h3 className="mt-3 text-xl font-semibold">
                {session.title || `Untitled session ${index + 1}`}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {formatDate(session.createdAt)}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                  <p className="text-[var(--muted)]">Messages</p>
                  <p className="mt-2 text-2xl font-semibold">{session._count.messages}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                  <p className="text-[var(--muted)]">Cases</p>
                  <p className="mt-2 text-2xl font-semibold">{session._count.cases}</p>
                </div>
              </div>

              <Link
                href={`/projects/${project.id}/sessions/${session.id}`}
                className="button-primary mt-5 inline-flex"
              >
                Open Session
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}