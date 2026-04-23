"use client";

import { useState, useTransition } from "react";
import { deleteSourceSliceWithFeedback } from "@/app/actions";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE, type ActionFormState } from "@/lib/form-state";

export function SourceSliceDeleteButton({
  sourceSliceId,
  sourceSliceName,
  linkedExampleCount = 0,
  className = "button-danger inline-flex items-center justify-center",
  label = "Eliminar",
}: {
  sourceSliceId: string;
  sourceSliceName: string;
  linkedExampleCount?: number;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<ActionFormState>(EMPTY_ACTION_FORM_STATE);
  const [isPending, startTransition] = useTransition();

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible eliminar el slice",
    successTitle: "Slice eliminado",
  });

  return (
    <button
      type="button"
      className={className}
      disabled={isPending}
      onClick={() => {
        const message =
          linkedExampleCount > 0
            ? `Eliminar ${sourceSliceName}? Esto también eliminará ${linkedExampleCount} dataset example(s) asociados. Esta acción no se puede deshacer.`
            : `Eliminar ${sourceSliceName}? Esta acción no se puede deshacer.`;

        if (!window.confirm(message)) {
          return;
        }

        startTransition(async () => {
          const nextState = await deleteSourceSliceWithFeedback(
            sourceSliceId,
            EMPTY_ACTION_FORM_STATE,
          );
          setState(nextState);
        });
      }}
    >
      {isPending ? "Eliminando..." : label}
    </button>
  );
}
