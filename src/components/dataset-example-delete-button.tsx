"use client";

import { useState, useTransition } from "react";
import { deleteDatasetExampleWithFeedback } from "@/app/actions";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE, type ActionFormState } from "@/lib/form-state";

export function DatasetExampleDeleteButton({
  datasetExampleId,
  datasetExampleName,
  redirectTo,
  formClassName,
  buttonClassName = "button-danger inline-flex items-center justify-center",
  label = "Eliminar",
}: {
  datasetExampleId: string;
  datasetExampleName: string;
  redirectTo?: string;
  formClassName?: string;
  buttonClassName?: string;
  label?: string;
}) {
  const [state, setState] = useState<ActionFormState>(EMPTY_ACTION_FORM_STATE);
  const [isPending, startTransition] = useTransition();

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible eliminar el dataset example",
    successTitle: "Dataset example eliminado",
  });

  return (
    <div className={formClassName}>
      <button
        type="button"
        className={buttonClassName}
        disabled={isPending}
        onClick={() => {
          if (
            !window.confirm(
              `Eliminar ${datasetExampleName}? Esta acción no se puede deshacer.`,
            )
          ) {
            return;
          }

          const formData = new FormData();

          if (redirectTo) {
            formData.set("redirectTo", redirectTo);
          }

          startTransition(async () => {
            const nextState = await deleteDatasetExampleWithFeedback(
              datasetExampleId,
              EMPTY_ACTION_FORM_STATE,
              formData,
            );
            setState(nextState);
          });
        }}
      >
        {isPending ? "Eliminando..." : label}
      </button>
    </div>
  );
}
