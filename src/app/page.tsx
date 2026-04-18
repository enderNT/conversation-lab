import Link from "next/link";
import { LlmConfigurationManager } from "@/components/llm-configuration-manager";
import { ProjectCreateForm } from "@/components/project-create-form";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, llmConfigurations] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            sessions: true,
            cases: true,
          },
        },
      },
    }),
    prisma.llmConfiguration.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Projects
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Conversa con un LLM, conserva los mejores fragmentos y conviértelos en casos revisados.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--muted)]">
            Conversation Lab usa sesiones reales de chat como materia prima del dataset: guarda cada turno, permite seleccionar rangos consecutivos y solo crea un caso cuando lo confirmas manualmente.
          </p>
        </div>

        <ProjectCreateForm />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 ? (
          <div className="surface col-span-full rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            No hay proyectos todavía. Crea uno para empezar a conversar con el modelo y consolidar casos.
          </div>
        ) : null}

        {projects.map((project) => (
          <article key={project.id} className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{project.name}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {project.description || "Sin descripción aún."}
                </p>
              </div>
              <span className="mono rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {formatDate(project.createdAt)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                <p className="text-[var(--muted)]">Sessions</p>
                <p className="mt-2 text-2xl font-semibold">{project._count.sessions}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
                <p className="text-[var(--muted)]">Cases</p>
                <p className="mt-2 text-2xl font-semibold">{project._count.cases}</p>
              </div>
            </div>

            <Link href={`/projects/${project.id}`} className="button-primary mt-5 inline-flex">
              Open Project
            </Link>
          </article>
        ))}
      </section>

      <LlmConfigurationManager
        configurations={llmConfigurations.map((configuration) => ({
          id: configuration.id,
          name: configuration.name,
          chatModel: configuration.chatModel,
          chatBaseUrl: configuration.chatBaseUrl || "",
          chatApiKey: configuration.chatApiKey || "",
          createdAt: configuration.createdAt.toISOString(),
          updatedAt: configuration.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
