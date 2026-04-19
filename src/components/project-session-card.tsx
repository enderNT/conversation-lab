"use client";

import Link from "next/link";
import { SessionTagPicker } from "@/components/session-tag-picker";
import { formatDate } from "@/lib/utils";

type SessionTagOption = {
  id: string;
  name: string;
};

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
    <article className="surface rounded-[1.75rem] p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        Session {index + 1}
      </p>
      <h3 className="mt-3 text-xl font-semibold">
        {session.title || `Untitled session ${index + 1}`}
      </h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {formatDate(session.createdAt)}
      </p>

      <div className="mt-4">
        <SessionTagPicker
          projectId={projectId}
          sessionId={session.id}
          assignedTags={session.tags}
          availableTags={availableTags}
          compact
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
          <p className="text-[var(--muted)]">Messages</p>
          <p className="mt-2 text-2xl font-semibold">{session.messageCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/65 p-3">
          <p className="text-[var(--muted)]">Slices</p>
          <p className="mt-2 text-2xl font-semibold">{session.caseCount}</p>
        </div>
      </div>

      <Link
        href={`/projects/${projectId}/sessions/${session.id}`}
        className="button-primary mt-5 inline-flex"
      >
        Open Session
      </Link>
    </article>
  );
}
