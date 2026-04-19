"use client";

import { useActionState } from "react";
import {
  createDatasetSpecWithFeedback,
  updateDatasetSpecWithFeedback,
} from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";

export type DatasetSpecCatalogRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  datasetFormat: string;
  inputSchemaText: string;
  outputSchemaText: string;
  mappingHintsText: string;
  validationRulesText: string;
  exportConfigText: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  datasetExampleCount: number;
};

export function DatasetSpecForm({
  datasetSpec,
  onCancel,
}: {
  datasetSpec?: DatasetSpecCatalogRecord | null;
  onCancel?: () => void;
}) {
  const isEditing = !!datasetSpec;
  const action = isEditing
    ? updateDatasetSpecWithFeedback.bind(null, datasetSpec.id)
    : createDatasetSpecWithFeedback;
  const [state, formAction] = useActionState(action, EMPTY_ACTION_FORM_STATE);

  useActionFeedbackToast(state, {
    errorTitle: isEditing ? "No fue posible actualizar el dataset spec" : "No fue posible crear el dataset spec",
    successTitle: isEditing ? "Dataset spec actualizado" : "Dataset spec creado",
  });

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <FormLabel>Nombre</FormLabel>
          <input
            name="name"
            className="field"
            defaultValue={datasetSpec?.name ?? ""}
            placeholder="QA Basic"
            required
          />
        </label>

        <label className="block space-y-2">
          <FormLabel>Slug</FormLabel>
          <input
            name="slug"
            className="field"
            defaultValue={datasetSpec?.slug ?? ""}
            placeholder="qa_basic"
            required
          />
        </label>
      </div>

      <label className="block space-y-2">
        <FormLabel>Descripción</FormLabel>
        <textarea
          name="description"
          className="field min-h-28"
          defaultValue={datasetSpec?.description ?? ""}
          placeholder="Describe la firma DSPy que este spec representa."
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <FormLabel>Formato</FormLabel>
          <select
            name="datasetFormat"
            className="field"
            defaultValue={datasetSpec?.datasetFormat ?? "dspy_jsonl"}
          >
            <option value="dspy_jsonl">dspy_jsonl</option>
          </select>
        </label>

        <label className="block space-y-2">
          <FormLabel>Versión</FormLabel>
          <input
            name="version"
            type="number"
            min={1}
            className="field"
            defaultValue={datasetSpec?.version ?? 1}
          />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <label className="block space-y-2">
          <FormLabel>Input schema JSON</FormLabel>
          <textarea
            name="inputSchemaJson"
            className="field min-h-64 font-mono text-xs"
            defaultValue={datasetSpec?.inputSchemaText ?? "[]"}
            required
          />
        </label>

        <label className="block space-y-2">
          <FormLabel>Output schema JSON</FormLabel>
          <textarea
            name="outputSchemaJson"
            className="field min-h-64 font-mono text-xs"
            defaultValue={datasetSpec?.outputSchemaText ?? "[]"}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <label className="block space-y-2">
          <FormLabel>Mapping hints JSON</FormLabel>
          <textarea
            name="mappingHintsJson"
            className="field min-h-48 font-mono text-xs"
            defaultValue={datasetSpec?.mappingHintsText ?? "{}"}
          />
        </label>

        <label className="block space-y-2">
          <FormLabel>Validation rules JSON</FormLabel>
          <textarea
            name="validationRulesJson"
            className="field min-h-48 font-mono text-xs"
            defaultValue={datasetSpec?.validationRulesText ?? "{}"}
          />
        </label>

        <label className="block space-y-2">
          <FormLabel>Export config JSON</FormLabel>
          <textarea
            name="exportConfigJson"
            className="field min-h-48 font-mono text-xs"
            defaultValue={datasetSpec?.exportConfigText ?? "{}"}
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="isActive"
          value="on"
          defaultChecked={datasetSpec?.isActive ?? true}
        />
        Activo
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <FormSubmitButton
          type="submit"
          className="button-primary"
          pendingLabel={isEditing ? "Guardando spec..." : "Creando spec..."}
        >
          {isEditing ? "Guardar dataset spec" : "Crear dataset spec"}
        </FormSubmitButton>

        {onCancel ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
