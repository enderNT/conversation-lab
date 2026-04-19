"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createSessionWithFeedback } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";

function LaunchArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[2]">
      <path d="M5 12h14" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DatasetGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.9]">
      <ellipse cx="12" cy="6" rx="6.5" ry="2.5" />
      <path d="M5.5 6v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6" />
      <path d="M5.5 11v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
    </svg>
  );
}

export function SessionCreateForm({
  projectId,
  datasetExamplesHref,
}: {
  projectId: string;
  datasetExamplesHref?: string;
}) {
  const [state, formAction] = useActionState(
    createSessionWithFeedback.bind(null, projectId),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible crear la sesión",
    successTitle: "Sesión creada",
  });

  return (
    <form action={formAction} className="mt-7 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <label className="block">
          <span className="sr-only">Session title</span>
          <input
            name="title"
            className="field min-h-14 rounded-[1rem] border border-[rgba(24,35,47,0.06)] bg-[rgba(238,232,223,0.72)] px-5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] placeholder:text-[color:rgba(102,114,125,0.62)]"
            placeholder="Session Title (e.g. Behavioral Response A)"
          />
        </label>

        <FormSubmitButton
          type="submit"
          className="button-primary inline-flex min-h-14 w-full items-center justify-center gap-3 px-6 text-base"
          pendingLabel="Creating session..."
        >
          <span>Start Session</span>
          <LaunchArrowIcon />
        </FormSubmitButton>
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm italic leading-7 text-[var(--muted)]">
          Project context will be automatically synced to the new session.
        </p>
        {datasetExamplesHref ? (
          <Link
            href={datasetExamplesHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
          >
            <DatasetGlyph />
            <span>View Dataset Examples</span>
          </Link>
        ) : null}
      </div>
    </form>
  );
}
