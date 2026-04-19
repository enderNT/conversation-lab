"use client";

import Link from "next/link";
import { SessionTagPicker } from "@/components/session-tag-picker";
import { formatDate } from "@/lib/utils";

type SessionTagOption = {
  id: string;
  name: string;
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffInMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  if (Math.abs(diffInMinutes) < 60) {
    return formatter.format(diffInMinutes, "minute");
  }

  const diffInHours = Math.round(diffInMinutes / 60);

  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, "hour");
  }

  const diffInDays = Math.round(diffInHours / 24);

  if (Math.abs(diffInDays) < 7) {
    return formatter.format(diffInDays, "day");
  }

  const diffInWeeks = Math.round(diffInDays / 7);

  if (Math.abs(diffInWeeks) < 5) {
    return formatter.format(diffInWeeks, "week");
  }

  const diffInMonths = Math.round(diffInDays / 30);

  if (Math.abs(diffInMonths) < 12) {
    return formatter.format(diffInMonths, "month");
  }

  return formatter.format(Math.round(diffInDays / 365), "year");
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M5.5 7.5h13v9h-7l-3.5 3v-3h-2.5z" strokeLinejoin="round" />
    </svg>
  );
}

function SliceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="m12 4 7 5-7 5-7-5 7-5Z" strokeLinejoin="round" />
      <path d="m5 14 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
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

export function ProjectSessionCard({
  projectId,
  session,
  index,
  availableTags,
}: {
  projectId: string;
  session: {
    id: string;
    title: string;
    createdAt: string;
    messageCount: number;
    caseCount: number;
    tags: SessionTagOption[];
  };
  index: number;
  availableTags: SessionTagOption[];
}) {
  return (
    <article className="surface flex h-full flex-col rounded-[1.7rem] bg-white/88 p-6 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Session {index + 1}</p>
        <p className="text-sm text-[var(--muted-strong)]" title={formatDate(session.createdAt)}>
          {formatRelativeTime(session.createdAt)}
        </p>
      </div>

      <h3 className="editorial-heading mt-3 max-w-[16rem] text-[1.75rem] leading-[1.15] text-[var(--foreground)]">
        {session.title || `Untitled Session ${index + 1}`}
      </h3>

      <div className="mt-5 flex-1">
        <SessionTagPicker
          projectId={projectId}
          sessionId={session.id}
          assignedTags={session.tags}
          availableTags={availableTags}
          compact
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
        <div className="flex flex-wrap items-center gap-5 text-sm text-[var(--muted-strong)]">
          <span className="inline-flex items-center gap-2">
            <MessageIcon />
            {session.messageCount}
          </span>
          <span className="inline-flex items-center gap-2">
            <SliceIcon />
            {session.caseCount}
          </span>
        </div>

        <Link
          href={`/projects/${projectId}/sessions/${session.id}`}
          className="inline-flex items-center gap-2 text-[1.05rem] font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          <span>Open Session</span>
          <ChevronRightIcon />
        </Link>
      </div>
    </article>
  );
}
