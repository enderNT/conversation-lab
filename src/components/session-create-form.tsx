"use client";

import { useActionState } from "react";
import { createSessionWithFeedback } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";

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
    <form action={formAction} className="surface rounded-[1.75rem] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Create session</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Usa un título corto o déjalo vacío para una sesión sin nombre.
      </p>
      <div className="mt-4 space-y-4">
        <label className="block space-y-2">
          <FormLabel>Title</FormLabel>
          <input name="title" className="field" placeholder="Consulta sobre manchas en rostro" />
        </label>
        <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Creating session...">
          Create Session
        </FormSubmitButton>
      </div>
    </form>
  );
}