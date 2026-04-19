import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectSessionCard } from "@/components/project-session-card";
import { SessionCreateForm } from "@/components/session-create-form";
import { prisma } from "@/lib/prisma";

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

function LibraryGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-[1.6]">
      <path d="M12 3.5v17" strokeLinecap="round" />
      <path d="M8.25 7.25 12 3.5l3.75 3.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20.5h14" strokeLinecap="round" />
      <path d="M6.75 13.25a2.25 2.25 0 0 1 2.25-2.25" strokeLinecap="round" />
      <path d="M17.25 13.25A2.25 2.25 0 0 0 15 11" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
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
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/72 p-4 shadow-[0_14px_30px_rgba(24,35,47,0.06)]">
      <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 text-[2rem] font-semibold leading-none text-[var(--foreground)]">{value}</div>
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
      <section className="grid gap-10 pt-2 xl:grid-cols-[minmax(0,1.18fr)_430px] xl:items-start">
        <div className="space-y-8 xl:pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base text-[var(--muted-strong)] transition hover:text-[var(--foreground)]"
          >
            <BackArrowIcon />
            <span>Back to Projects</span>
          </Link>

          <div className="space-y-5">
            <h1 className="editorial-display max-w-5xl text-[clamp(3.4rem,7vw,5.8rem)] text-[var(--foreground)]">
              {project.name}
            </h1>
            <p className="max-w-4xl text-lg leading-9 text-[var(--muted-strong)]">
              {project.description ||
                "This workspace is ready to host new conversations, preserve useful slices, and keep the project archive coherent over time."}
            </p>
          </div>

          <div className="surface rounded-[2.15rem] bg-white/84 p-6 sm:p-8">
            <div className="max-w-3xl">
              <h2 className="editorial-heading text-[2.35rem] leading-none text-[var(--foreground)] sm:text-[2.8rem]">
                Initialize New Workspace Session
              </h2>
            </div>
            <SessionCreateForm projectId={project.id} />
          </div>
        </div>

        <div className="space-y-6 xl:pt-28">
          <div className="grid gap-4 sm:grid-cols-3">
            <ProjectMetricCard label="Sessions" value={project._count.sessions} />
            <ProjectMetricCard label="Slices" value={project._count.sourceSlices} />
            <ProjectMetricCard label="Created" value={formatProjectCreatedAt(project.createdAt)} />
          </div>

          <Link
            href={`/dataset-examples?projectId=${project.id}`}
            className="group relative block overflow-hidden rounded-[2.15rem] border border-[rgba(9,76,73,0.26)] bg-[linear-gradient(135deg,#0f6562_0%,#0d4f4e_55%,#0a3638_100%)] p-6 text-white shadow-[0_22px_52px_rgba(9,54,56,0.24)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(132,227,214,0.14),transparent_28%)]" />
            <div className="absolute -right-12 top-10 size-40 rounded-full border border-white/10 bg-white/5 blur-[2px]" />
            <div className="absolute bottom-0 right-0 h-36 w-44 bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.08)_100%)]" />

            <div className="relative flex min-h-[18rem] flex-col justify-between gap-10">
              <div className="inline-flex size-12 items-center justify-center rounded-[1.2rem] border border-white/18 bg-white/10 text-white/90">
                <LibraryGlyph />
              </div>

              <div>
                <p className="text-[0.74rem] uppercase tracking-[0.28em] text-white/72">Dataset Examples</p>
                <h2 className="mt-4 editorial-heading text-[2.35rem] leading-none text-white">
                  Explore Project Library
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-7 text-white/74">
                  Review the saved examples already connected to this project and continue curation inside the same
                  archive context.
                </p>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-wrap gap-3 text-sm text-white/78">
                  <span>{project._count.sessions} live sessions</span>
                  <span>{project._count.sourceSlices} source slices</span>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-white/14">
                  View dataset examples
                  <ChevronRightIcon />
                </span>
              </div>
            </div>
          </Link>
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
