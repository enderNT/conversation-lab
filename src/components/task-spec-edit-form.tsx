"use client";

import type { TaskSpec } from "@prisma/client";
import { useActionState } from "react";
import { updateTaskSpecWithFeedback } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/status-badge";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { stringifyJsonValue } from "@/lib/cases";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { TASK_TYPES } from "@/lib/types";

export function TaskSpecEditForm({ taskSpec }: { taskSpec: TaskSpec }) {
  const [state, formAction] = useActionState(
    updateTaskSpecWithFeedback.bind(null, taskSpec.id),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: `No fue posible actualizar ${taskSpec.name}`,
    successTitle: `${taskSpec.name} actualizado`,
  });

  return (
    <form action={formAction} className="surface rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{taskSpec.name}</h2>
          <StatusBadge status={taskSpec.isActive ? "approved" : "archived"} />
        </div>
        <p className="text-sm text-[var(--muted)]">
          {taskSpec.slug} • v{taskSpec.version} • {taskSpec.taskType}
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <label className="block space-y-2">
          <FormLabel required>Name</FormLabel>
          <input name="name" className="field" defaultValue={taskSpec.name} required />
        </label>
        <label className="block space-y-2">
          <FormLabel required>Slug</FormLabel>
          <input name="slug" className="field" defaultValue={taskSpec.slug} required />
        </label>
        <label className="block space-y-2 xl:col-span-2">
          <FormLabel>Description</FormLabel>
          <textarea name="description" className="field min-h-24" defaultValue={taskSpec.description} />
        </label>
        <label className="block space-y-2">
          <FormLabel>Task type</FormLabel>
          <select name="taskType" className="field" defaultValue={taskSpec.taskType}>
            {TASK_TYPES.map((taskType) => (
              <option key={taskType} value={taskType}>
                {taskType}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <FormLabel>Version</FormLabel>
          <input name="version" className="field" defaultValue={taskSpec.version} />
        </label>
        <label className="block space-y-2">
          <FormLabel>Required artifacts</FormLabel>
          <input name="requiredArtifacts" className="field" defaultValue={Array.isArray(taskSpec.requiredArtifactsJson) ? taskSpec.requiredArtifactsJson.join(", ") : ""} />
        </label>
        <label className="block space-y-2">
          <FormLabel>Optional artifacts</FormLabel>
          <input name="optionalArtifacts" className="field" defaultValue={Array.isArray(taskSpec.optionalArtifactsJson) ? taskSpec.optionalArtifactsJson.join(", ") : ""} />
        </label>
        <label className="block space-y-2 xl:col-span-2">
          <FormLabel>Input schema JSON</FormLabel>
          <textarea name="inputSchemaJson" className="field min-h-40 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.inputSchemaJson)} />
        </label>
        <label className="block space-y-2 xl:col-span-2">
          <FormLabel>Output schema JSON</FormLabel>
          <textarea name="outputSchemaJson" className="field min-h-32 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.outputSchemaJson)} />
        </label>
        <label className="block space-y-2 xl:col-span-2">
          <FormLabel>Validation rules JSON</FormLabel>
          <textarea name="validationRulesJson" className="field min-h-24 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.validationRulesJson)} />
        </label>
        <label className="block space-y-2 xl:col-span-2">
          <FormLabel>Export shape JSON</FormLabel>
          <textarea name="exportShapeJson" className="field min-h-24 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.exportShapeJson)} />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={taskSpec.isActive} />
          Active
        </label>
        <input type="hidden" name="updatedBy" value="human" />
        <FormSubmitButton type="submit" className="button-secondary" pendingLabel="Saving task spec...">
          Save task spec
        </FormSubmitButton>
      </div>
    </form>
  );
}