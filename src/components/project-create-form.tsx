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
    <form action={formAction} className="surface rounded-[1.75rem] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Create project</h2>
      <div className="mt-4 space-y-4">
        <label className="block space-y-2">
          <FormLabel required>Name</FormLabel>
          <input name="name" className="field" placeholder="Atención dermocosmética" required />
        </label>
        <label className="block space-y-2">
          <FormLabel>Description</FormLabel>
          <textarea
            name="description"
            className="field min-h-28"
            placeholder="Objetivo del laboratorio, dominio conversacional, notas del proyecto."
          />
        </label>
        <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Creating project...">
          Create Project
        </FormSubmitButton>
      </div>
    </form>
  );
}