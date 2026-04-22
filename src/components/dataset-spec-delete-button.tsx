"use client";

import { useState, useTransition } from "react";
import { deleteDatasetSpecWithFeedback } from "@/app/actions";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE, type ActionFormState } from "@/lib/form-state";

export function DatasetSpecDeleteButton({
  datasetSpecId,
  datasetSpecName,
  disabled = false,
}: {
  datasetSpecId: string;
  datasetSpecName: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<ActionFormState>(EMPTY_ACTION_FORM_STATE);
  const [isPending, startTransition] = useTransition();

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible eliminar el dataset spec",
    successTitle: "Dataset spec eliminado",
  });

  return (
    <button
      type="button"
      className="button-danger"
      disabled={disabled || isPending}
      onClick={() => {
        if (
          !window.confirm(
            `Eliminar ${datasetSpecName}? Esta acción no se puede deshacer.`,
          )
        ) {
          return;
        }

        startTransition(async () => {
          const nextState = await deleteDatasetSpecWithFeedback(
            datasetSpecId,
            EMPTY_ACTION_FORM_STATE,
          );
          setState(nextState);
        });
      }}
    >
      {isPending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
