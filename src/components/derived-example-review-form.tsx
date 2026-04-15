"use client";

import type { DerivedExampleStatus } from "@prisma/client";
import { useActionState } from "react";
import { updateDerivedExampleReviewStatusWithFeedback } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { DERIVED_EXAMPLE_STATUSES } from "@/lib/types";

export function DerivedExampleReviewForm({
  derivedExampleId,
  reviewStatus,
}: {
  derivedExampleId: string;
  reviewStatus: DerivedExampleStatus;
}) {
  const [state, formAction] = useActionState(
    updateDerivedExampleReviewStatusWithFeedback.bind(null, derivedExampleId),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible actualizar el review status",
    successTitle: "Review status actualizado",
  });

  return (
    <form action={formAction} className="w-full max-w-xs rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Review status</span>
        <select className="field" name="reviewStatus" defaultValue={reviewStatus}>
          {DERIVED_EXAMPLE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <FormSubmitButton type="submit" className="button-secondary mt-3 w-full" pendingLabel="Saving review...">
        Save status
      </FormSubmitButton>
    </form>
  );
}