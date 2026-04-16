"use client";

import { useActionState } from "react";
import { deleteTaskSpecWithFeedback } from "@/app/actions";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";

export function TaskSpecDeleteButton({
  taskSpecId,
  taskSpecName,
}: {
  taskSpecId: string;
  taskSpecName: string;
}) {
  const [state, formAction] = useActionState(
    deleteTaskSpecWithFeedback.bind(null, taskSpecId),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: `No fue posible eliminar ${taskSpecName}`,
    successTitle: `${taskSpecName} eliminado`,
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Eliminar ${taskSpecName}? Esta acción no se puede deshacer.`)) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className="button-secondary text-rose-700">
        Delete
      </button>
    </form>
  );
}