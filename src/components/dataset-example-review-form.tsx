"use client";

import { useActionState } from "react";
import { updateDatasetExampleReviewStatusWithFeedback } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { DATASET_EXAMPLE_STATUSES } from "@/lib/types";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";

export function DatasetExampleReviewForm({
  datasetExampleId,
  reviewStatus,
}: {
  datasetExampleId: string;
  reviewStatus: (typeof DATASET_EXAMPLE_STATUSES)[number];
}) {
  const [state, formAction] = useActionState(
    updateDatasetExampleReviewStatusWithFeedback.bind(null, datasetExampleId),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible actualizar el estado",
    successTitle: "Estado actualizado",
  });

  return (
    <form action={formAction} className="space-y-3 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">Review status</p>
      <select name="reviewStatus" className="field" defaultValue={reviewStatus}>
        {DATASET_EXAMPLE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <FormSubmitButton type="submit" className="button-secondary w-full" pendingLabel="Actualizando estado...">
        Guardar estado
      </FormSubmitButton>
    </form>
  );
}
