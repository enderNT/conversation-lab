"use client";

import { useActionState, useEffect } from "react";
import { createTaskSpecWithFeedback, updateTaskSpecWithFeedback } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { ARTIFACT_TYPES, TASK_TYPES } from "@/lib/types";

export type TaskSpecCatalogRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  taskType: (typeof TASK_TYPES)[number];
  inputSchemaText: string;
  outputSchemaText: string;
  requiredArtifactsText: string;
  optionalArtifactsText: string;
  validationRulesText: string;
  exportShapeText: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  derivedExampleCount: number;
};

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]/80">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-4 sm:p-5">
      <SectionHeader title={title} description={description} />
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

export function TaskSpecForm({
  mode,
  taskSchemaPlaceholder,
  taskSpec,
  onCancel,
  onSuccess,
}: {
  mode: "create" | "edit";
  taskSchemaPlaceholder: string;
  taskSpec?: TaskSpecCatalogRecord | null;
  onCancel: () => void;
  onSuccess?: () => void;
}) {
  const isEditing = mode === "edit" && taskSpec;
  const action = isEditing
    ? updateTaskSpecWithFeedback.bind(null, taskSpec.id)
    : createTaskSpecWithFeedback;
  const [state, formAction] = useActionState(action, EMPTY_ACTION_FORM_STATE);

  useActionFeedbackToast(state, {
    errorTitle: isEditing
      ? `No fue posible actualizar ${taskSpec.name}`
      : "No fue posible crear el task spec",
    successTitle: isEditing ? `${taskSpec.name} actualizado` : "Task spec creado",
  });

  useEffect(() => {
    if (state.status === "success" && state.eventId) {
      onSuccess?.();
    }
  }, [onSuccess, state.eventId, state.status]);

  return (
    <form action={formAction} className="flex min-h-full flex-col gap-5">
      <FormSection
        title="Identity"
        description="Define the task name, routing type, human description, and lifecycle state."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-2">
            <FormLabel required>Name</FormLabel>
            <input
              name="name"
              className="field"
              defaultValue={taskSpec?.name ?? ""}
              placeholder="Escalation routing"
              required
            />
          </label>
          <label className="block space-y-2">
            <FormLabel required>Slug</FormLabel>
            <input
              name="slug"
              className="field mono"
              defaultValue={taskSpec?.slug ?? ""}
              placeholder="escalation_routing"
              required
            />
          </label>
        </div>

        <label className="block space-y-2">
          <FormLabel>Description</FormLabel>
          <textarea
            name="description"
            className="field min-h-28"
            defaultValue={taskSpec?.description ?? ""}
            placeholder="Explain what this task transforms and how the dataset row should be used."
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
          <label className="block space-y-2">
            <FormLabel>Task type</FormLabel>
            <select
              name="taskType"
              className="field"
              defaultValue={taskSpec?.taskType ?? TASK_TYPES[0]}
            >
              {TASK_TYPES.map((taskType) => (
                <option key={taskType} value={taskType}>
                  {taskType}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <FormLabel>Version</FormLabel>
            <input
              name="version"
              className="field"
              defaultValue={taskSpec?.version ?? 1}
            />
          </label>

          <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--line)] bg-white/80 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
            <input type="checkbox" name="isActive" defaultChecked={taskSpec?.isActive ?? true} />
            Active task spec
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Artifacts"
        description="List the required and optional artifacts that the projection depends on."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-2">
            <FormLabel>Required artifacts</FormLabel>
            <input
              name="requiredArtifacts"
              className="field"
              defaultValue={taskSpec?.requiredArtifactsText ?? ""}
              placeholder={ARTIFACT_TYPES.join(", ")}
            />
          </label>
          <label className="block space-y-2">
            <FormLabel>Optional artifacts</FormLabel>
            <input
              name="optionalArtifacts"
              className="field"
              defaultValue={taskSpec?.optionalArtifactsText ?? ""}
              placeholder="policy_flags, state_assumptions"
            />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Schemas"
        description="Keep the input and output contracts explicit so derived examples remain consistent."
      >
        <label className="block space-y-2">
          <FormLabel>Input schema JSON</FormLabel>
          <textarea
            name="inputSchemaJson"
            className="field min-h-44 font-mono text-sm"
            defaultValue={taskSpec?.inputSchemaText ?? taskSchemaPlaceholder}
          />
        </label>

        <label className="block space-y-2">
          <FormLabel>Output schema JSON</FormLabel>
          <textarea
            name="outputSchemaJson"
            className="field min-h-36 font-mono text-sm"
            defaultValue={taskSpec?.outputSchemaText ?? taskSchemaPlaceholder}
          />
        </label>
      </FormSection>

      <FormSection
        title="Validation And Export"
        description="Control runtime checks and the final payload shape used by exports."
      >
        <label className="block space-y-2">
          <FormLabel>Validation rules JSON</FormLabel>
          <textarea
            name="validationRulesJson"
            className="field min-h-28 font-mono text-sm"
            defaultValue={taskSpec?.validationRulesText ?? "{}"}
          />
        </label>

        <label className="block space-y-2">
          <FormLabel>Export shape JSON</FormLabel>
          <textarea
            name="exportShapeJson"
            className="field min-h-28 font-mono text-sm"
            defaultValue={
              taskSpec?.exportShapeText ??
              '{"format":"conversation_lab_v2","shape":"{ input, output, metadata }"}'
            }
          />
        </label>
      </FormSection>

      <input type="hidden" name="updatedBy" value="human" />

      <div className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[rgba(248,246,241,0.96)] px-1 py-4 backdrop-blur-xl">
        <p className="text-sm text-[var(--muted)]">
          {isEditing
            ? "Edit the spec in one focused panel, save it, and return to the manager list."
            : "Create the spec in a dedicated panel and go back to managing the catalog."}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <FormSubmitButton
            type="submit"
            className="button-primary"
            pendingLabel={isEditing ? "Saving task spec..." : "Creating task spec..."}
          >
            {isEditing ? "Save task spec" : "Create task spec"}
          </FormSubmitButton>
        </div>
      </div>
    </form>
  );
}