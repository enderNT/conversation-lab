"use client";

import { useActionState } from "react";
import { createProjectWithFeedback } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";

export function ProjectCreateForm() {
  const [state, formAction] = useActionState(
    createProjectWithFeedback,
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible crear el proyecto",
    successTitle: "Proyecto creado",
  });

  return (
    <form action={formAction} className="surface rounded-[2rem] bg-white/88 p-6 sm:p-8">
      <div>
        <h2 className="editorial-heading text-[2.2rem] leading-none text-[var(--foreground)]">Create Project</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Inicializa un entorno de curación nuevo y continúa directo al detalle del proyecto.
        </p>
      </div>
      <div className="mt-6 space-y-5">
        <label className="block space-y-2">
          <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Project Name
          </FormLabel>
          <input name="name" className="field min-h-14 rounded-[1rem]" placeholder="Atención dermocosmética" required />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Description
          </FormLabel>
          <textarea
            name="description"
            className="field min-h-36 rounded-[1rem]"
            placeholder="Objetivo del laboratorio, dominio conversacional, notas del proyecto."
          />
        </label>
        <FormSubmitButton
          type="submit"
          className="button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.2em]"
          pendingLabel="Creating project..."
        >
          Create Workspace
          <span
            aria-hidden="true"
            className="inline-flex size-5 items-center justify-center rounded-full border border-white/45 text-[0.8rem] leading-none"
          >
            +
          </span>
        </FormSubmitButton>
      </div>
    </form>
  );
}
