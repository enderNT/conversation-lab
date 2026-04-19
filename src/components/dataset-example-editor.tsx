"use client";

import { useActionState, useState } from "react";
import type { ActionFormState } from "@/lib/form-state";
import {
  buildDefaultMappings,
  buildPayloadFromMappings,
  hydrateMappingsFromStored,
  parseTransformChainText,
  resolveFieldMapping,
  serializeTransformChain,
} from "@/lib/datasets";
import type {
  DatasetFieldMappingRecord,
  DatasetSchemaField,
  DatasetValidationState,
  JsonObject,
  JsonValue,
  SourceSliceRecord,
} from "@/lib/types";
import { DATASET_EXAMPLE_STATUSES } from "@/lib/types";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/status-badge";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";

type DatasetSpecOption = {
  id: string;
  name: string;
  slug: string;
  description: string;
  datasetFormat: string;
  inputSchema: DatasetSchemaField[];
  outputSchema: DatasetSchemaField[];
  version: number;
};

type StoredMapping = {
  side: "input" | "output";
  fieldKey: string;
  sourceKey: string;
  sourcePath: string | null;
  transformChainJson: JsonValue;
  constantValueJson: JsonValue | null;
  manualValueJson: JsonValue | null;
  resolvedPreviewJson: JsonValue | null;
};

function serializeMappings(mappings: DatasetFieldMappingRecord[]) {
  return JSON.stringify(mappings, null, 2);
}

function prettyJson(value: JsonValue) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function DatasetExampleEditor({
  mode,
  sourceSlice,
  datasetSpecs,
  initialDatasetSpecId,
  initialTitle,
  initialReviewStatus,
  initialInputPayload,
  initialOutputPayload,
  initialMappings,
  initialValidationState,
  action,
}: {
  mode: "create" | "edit";
  sourceSlice: SourceSliceRecord;
  datasetSpecs: DatasetSpecOption[];
  initialDatasetSpecId: string;
  initialTitle: string;
  initialReviewStatus: (typeof DATASET_EXAMPLE_STATUSES)[number];
  initialInputPayload: JsonObject;
  initialOutputPayload: JsonObject;
  initialMappings?: StoredMapping[];
  initialValidationState?: DatasetValidationState | null;
  action: (state: ActionFormState, formData: FormData) => Promise<ActionFormState>;
}) {
  const [state, formAction] = useActionState(action, EMPTY_ACTION_FORM_STATE);
  const [datasetSpecId, setDatasetSpecId] = useState(initialDatasetSpecId);
  const [title, setTitle] = useState(initialTitle);
  const [sourceTitle, setSourceTitle] = useState(sourceSlice.title);
  const [sourceSummary, setSourceSummary] = useState(sourceSlice.sourceSummary);
  const [reviewStatus, setReviewStatus] = useState(initialReviewStatus);

  const initialSelectedSpec =
    datasetSpecs.find((spec) => spec.id === initialDatasetSpecId) ?? datasetSpecs[0] ?? null;
  const [mappings, setMappings] = useState<DatasetFieldMappingRecord[]>(() =>
    initialSelectedSpec
      ? hydrateMappingsFromStored({
          inputSchema: initialSelectedSpec.inputSchema,
          outputSchema: initialSelectedSpec.outputSchema,
          storedMappings: initialMappings,
        })
      : [],
  );
  const [inputPayloadText, setInputPayloadText] = useState(
    JSON.stringify(initialInputPayload, null, 2),
  );
  const [outputPayloadText, setOutputPayloadText] = useState(
    JSON.stringify(initialOutputPayload, null, 2),
  );
  const [inputManualOverride, setInputManualOverride] = useState(mode === "edit");
  const [outputManualOverride, setOutputManualOverride] = useState(mode === "edit");

  useActionFeedbackToast(state, {
    errorTitle: mode === "create" ? "No fue posible guardar el dataset example" : "No fue posible actualizar el dataset example",
    successTitle: mode === "create" ? "Dataset example guardado" : "Dataset example actualizado",
  });

  const selectedSpec =
    datasetSpecs.find((spec) => spec.id === datasetSpecId) ?? datasetSpecs[0] ?? null;
  const liveSourceSlice = {
    ...sourceSlice,
    title: sourceTitle,
    sourceSummary,
  };
  const computedInputPayload = selectedSpec
    ? buildPayloadFromMappings({
        side: "input",
        sourceSlice: liveSourceSlice,
        schema: selectedSpec.inputSchema,
        mappings,
      })
    : {};
  const computedOutputPayload = selectedSpec
    ? buildPayloadFromMappings({
        side: "output",
        sourceSlice: liveSourceSlice,
        schema: selectedSpec.outputSchema,
        mappings,
      })
    : {};
  const effectiveInputPayloadText = inputManualOverride
    ? inputPayloadText
    : JSON.stringify(computedInputPayload, null, 2);
  const effectiveOutputPayloadText = outputManualOverride
    ? outputPayloadText
    : JSON.stringify(computedOutputPayload, null, 2);

  const previewFor = (mapping: DatasetFieldMappingRecord) =>
    resolveFieldMapping(liveSourceSlice, mapping);

  const renderRows = (
    side: "input" | "output",
    schema: DatasetSpecOption["inputSchema"],
  ) =>
    schema.map((field) => {
      const mapping =
        mappings.find((item) => item.side === side && item.fieldKey === field.key) ?? null;

      if (!mapping) {
        return null;
      }

      const preview = previewFor(mapping);

      return (
        <article
          key={`${side}:${field.key}`}
          className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-[var(--foreground)]">{field.key}</p>
              <StatusBadge status={field.required ? "approved" : "draft"} />
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {field.type}
              </span>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {field.description || "Sin descripción."}
            </p>

            <label className="block space-y-2">
              <FormLabel>Fuente</FormLabel>
              <select
                className="field"
                value={mapping.sourceKey}
                onChange={(event) => {
                  const nextValue = event.target.value as DatasetFieldMappingRecord["sourceKey"];
                  setMappings((current) =>
                    current.map((item) =>
                      item.side === side && item.fieldKey === field.key
                        ? { ...item, sourceKey: nextValue }
                        : item,
                    ),
                  );
                }}
              >
                <option value="source.last_user_message">source.last_user_message</option>
                <option value="source.conversation_slice">source.conversation_slice</option>
                <option value="source.surrounding_context">source.surrounding_context</option>
                <option value="source.source_summary">source.source_summary</option>
                <option value="source.session_notes">source.session_notes</option>
                <option value="manual">manual</option>
                <option value="constant">constant</option>
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-2">
                <FormLabel>Path</FormLabel>
                <input
                  className="field"
                  value={mapping.sourcePath}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setMappings((current) =>
                      current.map((item) =>
                        item.side === side && item.fieldKey === field.key
                          ? { ...item, sourcePath: nextValue }
                          : item,
                      ),
                    );
                  }}
                  placeholder="0.text o metadata.answer"
                />
              </label>

              <label className="block space-y-2">
                <FormLabel>Transforms</FormLabel>
                <input
                  className="field"
                  value={serializeTransformChain(mapping.transformChain)}
                  onChange={(event) => {
                    const nextValue = parseTransformChainText(event.target.value);
                    setMappings((current) =>
                      current.map((item) =>
                        item.side === side && item.fieldKey === field.key
                          ? { ...item, transformChain: nextValue }
                          : item,
                      ),
                    );
                  }}
                  placeholder="trim | join_lines | pick_path:0.text"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block space-y-2">
              <FormLabel>{mapping.sourceKey === "constant" ? "Valor constante" : "Override manual"}</FormLabel>
              <textarea
                className="field min-h-36 font-mono text-xs"
                value={mapping.sourceKey === "constant" ? mapping.constantValueText : mapping.manualValueText}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setMappings((current) =>
                    current.map((item) =>
                      item.side === side && item.fieldKey === field.key
                        ? mapping.sourceKey === "constant"
                          ? { ...item, constantValueText: nextValue }
                          : { ...item, manualValueText: nextValue }
                        : item,
                    ),
                  );
                }}
                placeholder={
                  mapping.sourceKey === "constant"
                    ? '"valor fijo" o {"clave":"valor"}'
                    : "Escribe aquí si quieres resolver el campo a mano."
                }
              />
            </label>
          </div>

          <div className="space-y-2">
            <FormLabel>Preview</FormLabel>
            <pre className="min-h-36 overflow-x-auto rounded-[1rem] border border-[var(--line)] bg-[rgba(15,23,42,0.04)] p-3 text-xs leading-6 text-[var(--muted-strong)]">
              {preview === undefined ? "Sin resolver todavía" : prettyJson(preview)}
            </pre>
          </div>
        </article>
      );
    });

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="datasetSpecId" value={selectedSpec?.id ?? ""} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="sourceTitle" value={sourceTitle} />
      <input type="hidden" name="sourceSummary" value={sourceSummary} />
      <input type="hidden" name="reviewStatus" value={reviewStatus} />
      <input type="hidden" name="inputPayloadJson" value={effectiveInputPayloadText} />
      <input type="hidden" name="outputPayloadJson" value={effectiveOutputPayloadText} />
      <input type="hidden" name="mappingsJson" value={serializeMappings(mappings)} />

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Fuente</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {mode === "create" ? "Nuevo editor DSPy" : title || "Editar dataset example"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Revisa el slice seleccionado, ajusta el resumen curatorial y define la firma final casi directamente desde el chat.
            </p>
          </div>

          {selectedSpec ? (
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--foreground)]">{selectedSpec.name}</p>
              <p className="mt-1 text-[var(--muted)]">
                {selectedSpec.slug} · v{selectedSpec.version}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <FormLabel>Título del example</FormLabel>
                <input
                  className="field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="QA sobre consulta sensible"
                />
              </label>

              <label className="block space-y-2">
                <FormLabel>Título del slice</FormLabel>
                <input
                  className="field"
                  value={sourceTitle}
                  onChange={(event) => setSourceTitle(event.target.value)}
                  placeholder="Slice 3-6"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <FormLabel>Resumen curatorial</FormLabel>
              <textarea
                className="field min-h-28"
                value={sourceSummary}
                onChange={(event) => setSourceSummary(event.target.value)}
                placeholder="Resume por qué este slice es útil para el dataset."
              />
            </label>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Transcript seleccionado</p>
              <div className="mt-4 space-y-3">
                {sourceSlice.conversationSlice.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(15,23,42,0.03)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>{message.role === "user" ? "Usuario" : "Asistente"}</span>
                      <span>Turno {message.orderIndex + 1}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">
                      {message.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <FormLabel>Dataset spec</FormLabel>
              <select
                className="field"
                value={datasetSpecId}
                onChange={(event) => {
                  const nextDatasetSpecId = event.target.value;
                  const nextSpec =
                    datasetSpecs.find((spec) => spec.id === nextDatasetSpecId) ?? null;

                  setDatasetSpecId(nextDatasetSpecId);
                  setMappings(
                    nextSpec
                      ? nextSpec.id === initialDatasetSpecId && initialMappings?.length
                        ? hydrateMappingsFromStored({
                            inputSchema: nextSpec.inputSchema,
                            outputSchema: nextSpec.outputSchema,
                            storedMappings: initialMappings,
                          })
                        : [
                            ...buildDefaultMappings(nextSpec.inputSchema, "input"),
                            ...buildDefaultMappings(nextSpec.outputSchema, "output"),
                          ]
                      : [],
                  );
                  setInputManualOverride(false);
                  setOutputManualOverride(false);
                }}
              >
                {datasetSpecs.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.name} ({spec.slug})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <FormLabel>Estado</FormLabel>
              <select
                className="field"
                value={reviewStatus}
                onChange={(event) =>
                  setReviewStatus(event.target.value as (typeof DATASET_EXAMPLE_STATUSES)[number])
                }
              >
                {DATASET_EXAMPLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Contexto auxiliar</p>
              <pre className="mt-3 max-h-72 overflow-auto rounded-[1rem] bg-[rgba(15,23,42,0.04)] p-3 text-xs leading-6 text-[var(--muted-strong)]">
                {sourceSlice.surroundingContext.length === 0
                  ? "Sin contexto adicional cercano."
                  : JSON.stringify(sourceSlice.surroundingContext, null, 2)}
              </pre>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Última validación guardada</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <p>{initialValidationState?.shapeMatches ? "Shape válido" : "Todavía no validado"}</p>
                {(initialValidationState?.structuralErrors ?? []).map((error) => (
                  <p key={error} className="text-rose-700">
                    {error}
                  </p>
                ))}
                {(initialValidationState?.semanticWarnings ?? []).map((warning) => (
                  <p key={warning} className="text-amber-700">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedSpec ? (
        <section className="surface rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Mapeo</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Selecciona la fuente y ajusta la transformación por campo.
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">Input</p>
                <p className="text-sm text-[var(--muted)]">
                  Campos que alimentan la firma de entrada.
                </p>
              </div>
              {renderRows("input", selectedSpec.inputSchema)}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">Output</p>
                <p className="text-sm text-[var(--muted)]">
                  Campos que definen la respuesta o etiqueta final del dataset.
                </p>
              </div>
              {renderRows("output", selectedSpec.outputSchema)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Resultado</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              JSON final editable con override explícito.
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setInputManualOverride(false)}
            >
              Reset input desde mapping
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setOutputManualOverride(false)}
            >
              Reset output desde mapping
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <label className="block space-y-2">
            <FormLabel>Input JSON</FormLabel>
            <textarea
              className="field min-h-72 font-mono text-xs"
              value={effectiveInputPayloadText}
              onChange={(event) => {
                setInputManualOverride(true);
                setInputPayloadText(event.target.value);
              }}
            />
          </label>

          <label className="block space-y-2">
            <FormLabel>Output JSON</FormLabel>
            <textarea
              className="field min-h-72 font-mono text-xs"
              value={effectiveOutputPayloadText}
              onChange={(event) => {
                setOutputManualOverride(true);
                setOutputPayloadText(event.target.value);
              }}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <FormSubmitButton
            type="submit"
            className="button-primary"
            pendingLabel={mode === "create" ? "Guardando example..." : "Actualizando example..."}
          >
            {mode === "create" ? "Guardar dataset example" : "Actualizar dataset example"}
          </FormSubmitButton>
          <span className="text-sm text-[var(--muted)]">
            El guardado valida estructura y persiste el mapping junto con los payloads finales.
          </span>
        </div>
      </section>
    </form>
  );
}
