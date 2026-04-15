"use client";

import type { CaseStatus } from "@prisma/client";
import { useActionState } from "react";
import { updateCaseStatusWithFeedback } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { CASE_STATUSES } from "@/lib/types";

export function CaseStatusForm({
  caseId,
  status,
}: {
  caseId: string;
  status: CaseStatus;
}) {
  const [state, formAction] = useActionState(
    updateCaseStatusWithFeedback.bind(null, caseId),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible actualizar el status del caso",
    successTitle: "Status del caso actualizado",
  });

  return (
    <form action={formAction} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Quick status change</span>
        <select name="status" className="field" defaultValue={status}>
          {CASE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <FormSubmitButton type="submit" className="button-secondary mt-3 w-full" pendingLabel="Saving status...">
        Save status
      </FormSubmitButton>
    </form>
  );
}