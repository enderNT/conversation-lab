"use client";

import { useActionState } from "react";
import { createTaskSpecWithFeedback } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { ARTIFACT_TYPES, TASK_TYPES } from "@/lib/types";

export function TaskSpecCreateForm({
  taskSchemaPlaceholder,
}: {
  taskSchemaPlaceholder: string;
}) {
  const [state, formAction] = useActionState(
    createTaskSpecWithFeedback,
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible crear el task spec",
    successTitle: "Task spec creado",
  });

  return (
    <form action={formAction} className="surface rounded-[1.75rem] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Create task spec</h2>
      <div className="mt-4 space-y-4">
        <label className="block space-y-2">
          <FormLabel required>Name</FormLabel>
          <input name="name" className="field" placeholder="Escalation routing" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <FormLabel required>Slug</FormLabel>
            <input name="slug" className="field" placeholder="escalation_routing" required />
          </label>
          <label className="block space-y-2">
            <FormLabel>Task type</FormLabel>
            <select name="taskType" className="field" defaultValue={TASK_TYPES[0]}>
              {TASK_TYPES.map((taskType) => (
                <option key={taskType} value={taskType}>
                  {taskType}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-2">
          <FormLabel>Description</FormLabel>
          <textarea name="description" className="field min-h-24" />
        </label>
        <label className="block space-y-2">
          <FormLabel>Input schema JSON</FormLabel>
          <textarea name="inputSchemaJson" className="field min-h-40 font-mono text-sm" defaultValue={taskSchemaPlaceholder} />
        </label>
        <label className="block space-y-2">
          <FormLabel>Output schema JSON</FormLabel>
          <textarea name="outputSchemaJson" className="field min-h-32 font-mono text-sm" defaultValue={taskSchemaPlaceholder} />
        </label>
        <label className="block space-y-2">
          <FormLabel>Required artifacts</FormLabel>
          <input name="requiredArtifacts" className="field" placeholder={ARTIFACT_TYPES.join(", ")} />
        </label>
        <label className="block space-y-2">
          <FormLabel>Optional artifacts</FormLabel>
          <input name="optionalArtifacts" className="field" placeholder="policy_flags, state_assumptions" />
        </label>
        <label className="block space-y-2">
          <FormLabel>Validation rules JSON</FormLabel>
          <textarea name="validationRulesJson" className="field min-h-28 font-mono text-sm" defaultValue="{}" />
        </label>
        <label className="block space-y-2">
          <FormLabel>Export shape JSON</FormLabel>
          <textarea name="exportShapeJson" className="field min-h-24 font-mono text-sm" defaultValue='{"format":"conversation_lab_v2","shape":"{ input, output, metadata }"}' />
        </label>
        <label className="block space-y-2">
          <FormLabel>Version</FormLabel>
          <input name="version" className="field" defaultValue="1" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked />
          Active
        </label>
        <input type="hidden" name="updatedBy" value="human" />
        <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Creating task spec...">
          Create task spec
        </FormSubmitButton>
      </div>
    </form>
  );
}