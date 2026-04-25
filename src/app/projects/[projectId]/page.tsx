import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectSessionCard } from "@/components/project-session-card";
import { SessionCreateForm } from "@/components/session-create-form";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatProjectCreatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M19 12H5" strokeLinecap="round" />
      <path d="m11 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.6]">
      <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z" />
      <path d="m19 13 .8 2.2 2.2.8-2.2.8L19 19l-.8-2.2-2.2-.8 2.2-.8L19 13Z" />
      <path d="m5 14 .9 2.4 2.4.9-2.4.9L5 20.5l-.9-2.3-2.3-.9 2.3-.9L5 14Z" />
    </svg>
  );
}

function SortChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProjectMetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[1.3rem] border border-[rgba(24,35,47,0.07)] bg-white/76 px-4 py-5 shadow-[0_14px_30px_rgba(24,35,47,0.05)]">
      <div className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-[var(--accent)]" />
      <div className="pl-4">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
        <div
          className={cn(
            "mt-4 min-w-0 text-[1.7rem] font-semibold leading-none tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.85rem]",
            valueClassName,
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

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
    <div className="space-y-14 pb-8">
      <section className="grid gap-8 pt-2 xl:max-w-[82rem] xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-8 xl:pr-4 xl:pt-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--muted-strong)] transition hover:text-[var(--foreground)]"
          >
            <BackArrowIcon />
            <span>Back to Projects</span>
          </Link>

          <div className="max-w-[46rem] space-y-4">
            <h1 className="editorial-heading text-[clamp(3rem,5vw,4.7rem)] leading-[0.95] text-[var(--accent-strong)]">
              {project.name}
            </h1>
            <p className="max-w-[38rem] text-[1.08rem] leading-[1.75] text-[var(--muted-strong)]">
              {project.description ||
                "This workspace is ready to host new conversations, preserve useful slices, and keep the project archive coherent over time."}
            </p>
          </div>

          <div className="surface max-w-[54rem] rounded-[1.8rem] bg-white/90 p-6 sm:p-7">
            <div className="max-w-[40rem]">
              <h2 className="editorial-heading text-[2rem] leading-none text-[var(--foreground)] sm:text-[2.3rem]">
                Initialize New Workspace Session
              </h2>
            </div>
            <SessionCreateForm
              projectId={project.id}
              datasetExamplesHref={`/dataset-examples?projectId=${project.id}`}
              datasetImportHref={`/projects/${project.id}/dataset-import`}
            />
          </div>
        </div>

        <div className="space-y-5 xl:pt-20">
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-3">
            <ProjectMetricCard label="Sessions" value={project._count.sessions} />
            <ProjectMetricCard label="Slices" value={project._count.sourceSlices} />
            <ProjectMetricCard
              label="Created"
              value={formatProjectCreatedAt(project.createdAt)}
              valueClassName="editorial-heading text-[1.15rem] leading-[1.02] tracking-[-0.03em] sm:text-[1.45rem]"
            />
          </div>

          <aside className="relative overflow-hidden rounded-[1.8rem] border border-[rgba(9,76,73,0.2)] bg-[linear-gradient(135deg,#0f6663_0%,#135a58_42%,#0c4645_100%)] p-6 text-white shadow-[0_22px_52px_rgba(9,54,56,0.2)]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:28px_28px] opacity-20" />
            <div className="absolute -right-14 bottom-3 size-44 rounded-full border border-white/10 bg-white/10" />
            <div className="absolute right-8 top-8 size-24 rounded-full bg-white/10 blur-xl" />

            <div className="relative min-h-[11.5rem]">
              <div className="inline-flex size-12 items-center justify-center rounded-[1.1rem] border border-white/16 bg-white/10 text-white/85">
                <SparklesIcon />
              </div>
              <h2 className="editorial-heading mt-10 text-[2rem] leading-none text-white">
                Project Archive Ready
              </h2>
              <p className="mt-4 max-w-[16rem] text-sm leading-7 text-white/78">
                New sessions inherit this project context, while existing slices stay grouped in the same workspace.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="editorial-heading text-[2.55rem] leading-none text-[var(--foreground)]">Recent Sessions</h2>
          <div className="inline-flex items-center gap-2 self-start text-sm text-[var(--muted-strong)]">
            <span className="text-[var(--muted)]">Sort by:</span>
            <span className="font-semibold text-[var(--foreground)]">Date Created</span>
            <SortChevronIcon />
          </div>
        </div>

        {project.sessions.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-white/60 p-8 text-sm leading-7 text-[var(--muted)]">
            This project does not have sessions yet. Create the first workspace session to start chatting and
            collecting slices.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
