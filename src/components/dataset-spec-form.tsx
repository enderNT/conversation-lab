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
import { cn } from "@/lib/utils";

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

const DEFAULT_INPUT_SCHEMA = `[
  {
    "key": "question",
    "type": "string",
    "required": true,
    "description": "Ultima instruccion del usuario"
  }
]`;

const DEFAULT_OUTPUT_SCHEMA = `[
  {
    "key": "answer",
    "type": "string",
    "required": true,
    "description": "Respuesta objetivo final"
  }
]`;

const DEFAULT_MAPPING_HINTS = `{
  "input": {
    "question": ["source.last_user_message"]
  },
  "output": {
    "answer": ["manual"]
  }
}`;

const DEFAULT_VALIDATION_RULES = `{
  "nonEmptyFields": ["question", "answer"]
}`;

const DEFAULT_EXPORT_CONFIG = `{
  "format": "dspy_jsonl",
  "metadata": ["spec", "version", "sourceSliceId"]
}`;

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,white_80%)] text-[var(--accent)]">
      {children}
    </span>
  );
}

function SectionHeading({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div className="flex items-center gap-3">
          <SectionIcon>{icon}</SectionIcon>
          <div>
            <h3 className="editorial-heading text-[1.9rem] font-semibold leading-none text-[var(--foreground)]">
              {title}
            </h3>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

function LabelText({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <FormLabel
      required={required}
      className="block text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]"
    >
      {children}
    </FormLabel>
  );
}

function JsonPanel({
  tone,
  title,
  name,
  defaultValue,
  placeholder,
  required = false,
  minHeightClass,
}: {
  tone: "dark" | "accent" | "light";
  title: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  required?: boolean;
  minHeightClass: string;
}) {
  return (
    <label
      className={cn(
        "overflow-hidden border shadow-sm",
        tone === "dark" && "border-stone-700 bg-stone-950",
        tone === "accent" && "border-teal-950/80 bg-teal-950",
        tone === "light" && "border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_82%,white_24%)]",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2",
          tone === "dark" && "border-stone-700 bg-stone-900 text-stone-200",
          tone === "accent" && "border-teal-900 bg-teal-950 text-teal-100",
          tone === "light" && "border-[var(--line)] bg-[color-mix(in_srgb,var(--foreground)_4%,white_96%)] text-[var(--muted-strong)]",
        )}
      >
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em]">{title}</span>
        <span className="mono text-[0.64rem] uppercase tracking-[0.18em] opacity-70">JSON</span>
      </div>
      <textarea
        name={name}
        className={cn(
          "dataspec-scrollbar w-full resize-y border-none bg-transparent p-4 font-mono text-sm leading-7 focus:outline-none",
          minHeightClass,
          tone === "dark" && "text-stone-200 placeholder:text-stone-500",
          tone === "accent" && "text-teal-50 placeholder:text-teal-500/70",
          tone === "light" && "text-[var(--foreground)] placeholder:text-[var(--muted)]",
        )}
        defaultValue={defaultValue}
        placeholder={placeholder}
        spellCheck={false}
        required={required}
      />
    </label>
  );
}

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

  const inputSchemaText = datasetSpec?.inputSchemaText ?? DEFAULT_INPUT_SCHEMA;
  const outputSchemaText = datasetSpec?.outputSchemaText ?? DEFAULT_OUTPUT_SCHEMA;
  const mappingHintsText = datasetSpec?.mappingHintsText ?? DEFAULT_MAPPING_HINTS;
  const validationRulesText = datasetSpec?.validationRulesText ?? DEFAULT_VALIDATION_RULES;
  const exportConfigText = datasetSpec?.exportConfigText ?? DEFAULT_EXPORT_CONFIG;

  return (
    <form action={formAction} className="space-y-12">
      <section className="space-y-6">
        <SectionHeading
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
              <path d="M12 3.5 8.5 5v4.25L12 11l3.5-1.75V5L12 3.5Z" />
              <path d="M8.5 14.75 12 16.5l3.5-1.75" />
              <path d="M8.5 9.25v5.5L12 16.5l3.5-1.75v-5.5" />
              <path d="M12 11v5.5" />
            </svg>
          }
          title="Core Identity"
        />

        <div className="grid gap-5 border border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_88%,white_18%)] p-5 shadow-sm sm:grid-cols-2 sm:p-6">
          <label className="space-y-2 sm:col-span-1">
            <LabelText required>Nombre</LabelText>
            <input
              name="name"
              className="field border-[color-mix(in_srgb,var(--line)_92%,white_8%)] bg-white/90 shadow-sm"
              defaultValue={datasetSpec?.name ?? ""}
              placeholder="Sentiment Analysis Base"
              required
            />
          </label>

          <label className="space-y-2 sm:col-span-1">
            <LabelText required>Slug</LabelText>
            <input
              name="slug"
              className="field mono border-[color-mix(in_srgb,var(--line)_92%,white_8%)] bg-[color-mix(in_srgb,var(--foreground)_3%,white_97%)] shadow-sm"
              defaultValue={datasetSpec?.slug ?? ""}
              placeholder="sentiment_base"
              required
            />
          </label>

          <label className="space-y-2 sm:col-span-1">
            <LabelText>Formato</LabelText>
            <select
              name="datasetFormat"
              className="field mono border-[color-mix(in_srgb,var(--line)_92%,white_8%)] bg-white/90 shadow-sm"
              defaultValue={datasetSpec?.datasetFormat ?? "dspy_jsonl"}
            >
              <option value="dspy_jsonl">DSPy JSONL</option>
            </select>
          </label>

          <label className="space-y-2 sm:col-span-1">
            <LabelText>Version</LabelText>
            <input
              name="version"
              type="number"
              min={1}
              className="field mono max-w-40 border-[color-mix(in_srgb,var(--line)_92%,white_8%)] bg-white/90 shadow-sm"
              defaultValue={datasetSpec?.version ?? 1}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <LabelText>Descripcion</LabelText>
            <textarea
              name="description"
              className="field min-h-28 resize-y border-[color-mix(in_srgb,var(--line)_92%,white_8%)] bg-white/90 shadow-sm"
              defaultValue={datasetSpec?.description ?? ""}
              placeholder="Describe el objetivo del dataset y el tipo de salida esperada."
            />
          </label>

          <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-4 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Active State</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Haz disponible este spec para curacion inmediata.
              </p>
            </div>

            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                name="isActive"
                value="on"
                className="peer sr-only"
                defaultChecked={datasetSpec?.isActive ?? true}
              />
              <span className="relative h-7 w-12 border border-[var(--line)] bg-[color-mix(in_srgb,var(--foreground)_12%,white_88%)] transition peer-checked:bg-[var(--accent)]">
                <span className="absolute left-[3px] top-[3px] size-5 bg-white transition peer-checked:translate-x-5" />
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
              <path d="M4 6.5h16" />
              <path d="M4 12h16" />
              <path d="M4 17.5h10" />
            </svg>
          }
          title="Schema Contract"
          action={
            <button
              type="button"
              disabled
              className="mono inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-2 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)] opacity-70"
              title="Proximamente"
            >
              <span aria-hidden="true">*</span>
              Generate from Text
            </button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <JsonPanel
            tone="dark"
            title="Input Schema"
            name="inputSchemaJson"
            defaultValue={inputSchemaText}
            placeholder={DEFAULT_INPUT_SCHEMA}
            required
            minHeightClass="min-h-72"
          />
          <JsonPanel
            tone="accent"
            title="Output Schema"
            name="outputSchemaJson"
            defaultValue={outputSchemaText}
            placeholder={DEFAULT_OUTPUT_SCHEMA}
            required
            minHeightClass="min-h-72"
          />
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
              <path d="M5 5.5h5v5H5z" />
              <path d="M14 5.5h5v5h-5z" />
              <path d="M9.5 8h5" />
              <path d="M16.5 10.5v3H8v5" />
            </svg>
          }
          title="Mapping Guidance"
          description="Proporciona pistas para operadores o agentes LLM sobre como mapear variables fuente a propiedades del schema de salida."
        />

        <JsonPanel
          tone="light"
          title="Mapping Config"
          name="mappingHintsJson"
          defaultValue={mappingHintsText}
          placeholder={DEFAULT_MAPPING_HINTS}
          minHeightClass="min-h-44"
        />
      </section>

      <section className="space-y-6 pb-24">
        <SectionHeading
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
              <path d="M5 6h14" />
              <path d="M8 6v12" />
              <path d="M16 6v12" />
              <path d="M5 18h14" />
            </svg>
          }
          title="Validation & Export"
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <JsonPanel
            tone="light"
            title="Validation Rules"
            name="validationRulesJson"
            defaultValue={validationRulesText}
            placeholder={DEFAULT_VALIDATION_RULES}
            minHeightClass="min-h-40"
          />
          <JsonPanel
            tone="light"
            title="Export Config"
            name="exportConfigJson"
            defaultValue={exportConfigText}
            placeholder={DEFAULT_EXPORT_CONFIG}
            minHeightClass="min-h-40"
          />
        </div>
      </section>

      <input type="hidden" name="updatedBy" value="human" />

      {state.status === "error" && state.message ? (
        <div className="rounded-[1rem] border border-[var(--danger-border)] bg-[var(--danger-background)] px-4 py-3 text-sm text-[var(--danger-text)]">
          {state.message}
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--drawer-background)_88%,white_12%)] px-6 py-4 shadow-[0_-8px_24px_rgba(24,35,47,0.06)] backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {onCancel ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}

        <FormSubmitButton
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[var(--accent-strong)]"
          pendingLabel={isEditing ? "Guardando spec..." : "Creando spec..."}
        >
          <span aria-hidden="true">+</span>
          {isEditing ? "Guardar dataset spec" : "Crear dataset spec"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
