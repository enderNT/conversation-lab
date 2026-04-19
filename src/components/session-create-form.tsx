"use client";

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

export function SessionCreateForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(
    createSessionWithFeedback.bind(null, projectId),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible crear la sesión",
    successTitle: "Sesión creada",
  });

  return (
    <form action={formAction} className="mt-7 space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center">
        <label className="block">
          <span className="sr-only">Session title</span>
          <input
            name="title"
            className="field min-h-15 rounded-[1.2rem] border border-[rgba(24,35,47,0.06)] bg-[var(--background)] px-5 text-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] placeholder:text-[color:rgba(102,114,125,0.7)]"
            placeholder="Session Title (e.g. Behavioral Response A)"
          />
        </label>

        <FormSubmitButton
          type="submit"
          className="button-primary inline-flex min-h-15 w-full items-center justify-center gap-3 px-6 text-lg"
          pendingLabel="Creating session..."
        >
          <span>Start Session</span>
          <LaunchArrowIcon />
        </FormSubmitButton>
      </div>

      <p className="text-sm italic leading-7 text-[var(--muted)] sm:text-base">
        Project context will be automatically synced to the new session.
      </p>
    </form>
  );
}
