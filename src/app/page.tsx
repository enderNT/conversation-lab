import Link from "next/link";
import { LlmConfigurationManager } from "@/components/llm-configuration-manager";
import { ProjectCreateForm } from "@/components/project-create-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatProjectDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function ProjectGlyph({ index }: { index: number }) {
  const variant = index % 3;

  if (variant === 0) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
        <path d="M5.5 7.5h13v9h-7l-3.5 3v-3h-2.5z" strokeLinejoin="round" />
      </svg>
    );
  }

  if (variant === 1) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="12" r="5.8" />
        <path d="M12 9v3.5l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
      <path d="M5 8.25h14" strokeLinecap="round" />
      <path d="M9 5v14" strokeLinecap="round" />
      <path d="m12.5 13.5 1.75-1.75L16 13.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.25 11.75v5.25" strokeLinecap="round" />
    </svg>
  );
}

export default async function ProjectsPage() {
  const [projects, llmConfigurations] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            sessions: true,
            sourceSlices: true,
          },
        },
      },
    }),
    prisma.llmConfiguration.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-14 pb-8">
      <section className="grid gap-10 pt-2 lg:grid-cols-[minmax(0,1.1fr)_380px] lg:items-start">
        <div className="space-y-7 lg:pt-6">
          <span className="section-kicker">Projects</span>
          <div className="space-y-6">
            <h1 className="editorial-display max-w-4xl text-[clamp(3.6rem,8vw,6.4rem)] text-[var(--foreground)]">
              Transforma diálogo vivo en{" "}
              <span className="text-[var(--accent)] italic">inteligencia estructurada.</span>
            </h1>
            <p className="max-w-3xl text-lg leading-9 text-[var(--muted-strong)]">
              Conversation Lab convierte sesiones reales de chat en materia prima curable para DSPy: conserva
              turnos, selecciona slices consecutivos, mapea campos hacia JSONL y mantiene un archivo operativo de
              proyectos activos.
            </p>
          </div>

          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/72 p-5 shadow-[0_14px_30px_rgba(24,35,47,0.06)]">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--muted)]">Projects</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{projects.length}</p>
            </div>
            <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/72 p-5 shadow-[0_14px_30px_rgba(24,35,47,0.06)]">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--muted)]">Sessions</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                {projects.reduce((total, project) => total + project._count.sessions, 0)}
              </p>
            </div>
            <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/72 p-5 shadow-[0_14px_30px_rgba(24,35,47,0.06)]">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--muted)]">Source Slices</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                {projects.reduce((total, project) => total + project._count.sourceSlices, 0)}
              </p>
            </div>
          </div>
        </div>

        <ProjectCreateForm />
      </section>

      <section id="project-library" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="editorial-heading text-[3rem] leading-none text-[var(--foreground)]">Active Archives</h2>
            <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--muted)]">
              Gestiona tus proyectos actuales, retoma sesiones activas y entra al detalle con el mismo flujo que hoy
              ya usa la aplicación.
            </p>
          </div>
          <div className="inline-flex self-start rounded-full border border-[var(--line)] bg-white/72 px-4 py-2 text-sm text-[var(--muted-strong)] shadow-[0_10px_24px_rgba(24,35,47,0.06)]">
            {projects.length} {projects.length === 1 ? "project" : "projects"} registrados
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-white/60 p-8 text-sm leading-7 text-[var(--muted)]">
            No hay proyectos todavía. Crea uno para empezar a conversar con el modelo, conservar slices útiles y
            construir dataset examples exportables.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => (
              <article
                key={project.id}
                className="surface flex h-full flex-col rounded-[2rem] bg-white/84 p-6 transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-[3.25rem] items-center justify-center rounded-2xl bg-[var(--background-glow)] text-[var(--accent)]">
                    <ProjectGlyph index={index} />
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-[var(--background)] px-3 py-1 text-xs text-[var(--muted)]">
                    {formatProjectDate(project.createdAt)}
                  </span>
                </div>

                <div className="mt-6">
                  <h3 className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">{project.name}</h3>
                  <p className="mt-4 min-h-[5.25rem] text-sm leading-7 text-[var(--muted)]">
                    {project.description || "Sin descripción aún."}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--background)] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">Sessions</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{project._count.sessions}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--background)] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">Slices</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{project._count.sourceSlices}</p>
                  </div>
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="button-primary mt-6 inline-flex w-full items-center justify-center px-5 py-4 text-sm uppercase tracking-[0.18em]"
                >
                  Open Project
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div>
          <span className="section-kicker">Infrastructure</span>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--muted)]">
            Las configuraciones LLM globales siguen disponibles desde la home para preparar providers, endpoints y
            prompts reutilizables antes de abrir o continuar una sesión.
          </p>
        </div>
        <LlmConfigurationManager
          configurations={llmConfigurations.map((configuration) => ({
            id: configuration.id,
            name: configuration.name,
            chatModel: configuration.chatModel,
            chatBaseUrl: configuration.chatBaseUrl || "",
            chatApiKey: configuration.chatApiKey || "",
            systemPrompt: configuration.systemPrompt || "",
            createdAt: configuration.createdAt.toISOString(),
            updatedAt: configuration.updatedAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
