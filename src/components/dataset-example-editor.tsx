"use client";

import { useActionState, useState } from "react";
import { generateDatasetFieldWithLlm } from "@/app/actions";
import { EMPTY_ACTION_FORM_STATE, type ActionFormState } from "@/lib/form-state";
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
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast-provider";
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

type GlobalLlmConfigurationOption = {
  id: string;
  name: string;
  chatModel: string;
  updatedAt: string;
};

type StoredMapping = {
  side: "input" | "output";
  fieldKey: string;
  sourceKey: string;
  sourcePath: string | null;
  transformChainJson: JsonValue;
  constantValueJson: JsonValue | null;
  manualValueJson: JsonValue | null;
  llmConfigurationId?: string | null;
  llmPromptText?: string | null;
  llmGeneratedValueJson?: JsonValue | null;
  llmGenerationMetaJson?: JsonValue | null;
  resolvedPreviewJson: JsonValue | null;
};

function serializeMappings(mappings: DatasetFieldMappingRecord[]) {
  return JSON.stringify(mappings, null, 2);
}

function prettyJson(value: JsonValue | undefined) {
  if (value === undefined) {
    return "Sin resolver todavía";
  }

  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function asRecord(value: JsonValue | undefined) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function isDirectSource(sourceKey: DatasetFieldMappingRecord["sourceKey"]) {
  return sourceKey.startsWith("source.");
}

export function DatasetExampleEditor(props: {
  mode: "create" | "edit";
  sourceSlice: SourceSliceRecord;
  datasetSpecs: DatasetSpecOption[];
  llmConfigurations: GlobalLlmConfigurationOption[];
  initialDatasetSpecId: string;
  initialTitle: string;
  initialReviewStatus: (typeof DATASET_EXAMPLE_STATUSES)[number];
  initialInputPayload: JsonObject;
  initialOutputPayload: JsonObject;
  initialMappings?: StoredMapping[];
  initialValidationState?: DatasetValidationState | null;
  action: (state: ActionFormState, formData: FormData) => Promise<ActionFormState>;
}) {
  const [state, formAction] = useActionState(props.action, EMPTY_ACTION_FORM_STATE);
  const [datasetSpecId, setDatasetSpecId] = useState(props.initialDatasetSpecId);
  const [title, setTitle] = useState(props.initialTitle);
  const [sourceTitle, setSourceTitle] = useState(props.sourceSlice.title);
  const [sourceSummary, setSourceSummary] = useState(props.sourceSlice.sourceSummary);
  const [reviewStatus, setReviewStatus] = useState(props.initialReviewStatus);
  const [generatingFieldKey, setGeneratingFieldKey] = useState<string | null>(null);
  const [inputPayloadText, setInputPayloadText] = useState(
    JSON.stringify(props.initialInputPayload, null, 2),
  );
  const [outputPayloadText, setOutputPayloadText] = useState(
    JSON.stringify(props.initialOutputPayload, null, 2),
  );
  const [inputManualOverride, setInputManualOverride] = useState(props.mode === "edit");
  const [outputManualOverride, setOutputManualOverride] = useState(props.mode === "edit");
  const { pushToast } = useToast();

  useActionFeedbackToast(state, {
    errorTitle:
      props.mode === "create"
        ? "No fue posible guardar el dataset example"
        : "No fue posible actualizar el dataset example",
    successTitle:
      props.mode === "create" ? "Dataset example guardado" : "Dataset example actualizado",
  });

  const initialSelectedSpec =
    props.datasetSpecs.find((spec) => spec.id === props.initialDatasetSpecId) ?? props.datasetSpecs[0] ?? null;
  const [mappings, setMappings] = useState<DatasetFieldMappingRecord[]>(() =>
    initialSelectedSpec
      ? hydrateMappingsFromStored({
          inputSchema: initialSelectedSpec.inputSchema,
          outputSchema: initialSelectedSpec.outputSchema,
          storedMappings: props.initialMappings,
        })
      : [],
  );

  const selectedSpec =
    props.datasetSpecs.find((spec) => spec.id === datasetSpecId) ?? props.datasetSpecs[0] ?? null;
  const liveSourceSlice = {
    ...props.sourceSlice,
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
  const sessionNotes = liveSourceSlice.sourceMetadata.session_notes ?? "";

  const updateMapping = (
    side: "input" | "output",
    fieldKey: string,
    updater: (mapping: DatasetFieldMappingRecord) => DatasetFieldMappingRecord,
  ) => {
    setMappings((current) =>
      current.map((item) =>
        item.side === side && item.fieldKey === fieldKey ? updater(item) : item,
      ),
    );
  };

  async function handleGenerateField(
    side: "input" | "output",
    field: DatasetSchemaField,
    mapping: DatasetFieldMappingRecord,
  ) {
    if (!selectedSpec) {
      return;
    }

    if (!mapping.llmConfigurationId.trim()) {
      pushToast({
        title: "Falta configuración LLM",
        description: "Selecciona una configuración global antes de generar este campo.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    if (!mapping.llmPromptText.trim()) {
      pushToast({
        title: "Falta instrucción",
        description: "Escribe una instrucción específica para este campo antes de generar.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    const currentFieldKey = `${side}:${field.key}`;
    setGeneratingFieldKey(currentFieldKey);

    try {
      const result = await generateDatasetFieldWithLlm({
        llmConfigurationId: mapping.llmConfigurationId,
        side,
        field,
        datasetSpecName: selectedSpec.name,
        datasetSpecSlug: selectedSpec.slug,
        datasetSpecDescription: selectedSpec.description,
        promptText: mapping.llmPromptText,
        lastUserMessage: liveSourceSlice.lastUserMessage,
        sourceSummary: liveSourceSlice.sourceSummary,
        sessionNotes,
        conversationSliceJson: JSON.stringify(liveSourceSlice.conversationSlice, null, 2),
        surroundingContextJson: JSON.stringify(liveSourceSlice.surroundingContext, null, 2),
        inputPayloadJson: JSON.stringify(computedInputPayload, null, 2),
        outputPayloadJson: JSON.stringify(computedOutputPayload, null, 2),
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible generar el campo",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      updateMapping(side, field.key, (current) => ({
        ...current,
        sourceKey: "llm_generated",
        llmGeneratedValueText: result.valueText,
        llmGenerationMeta: result.metadata,
      }));

      pushToast({
        title: "Campo generado",
        description: `${field.key} ya tiene un valor generado con la configuración seleccionada.`,
        variant: "success",
        durationMs: 5000,
      });
    } finally {
      setGeneratingFieldKey(null);
    }
  }

  const renderRows = (side: "input" | "output", schema: DatasetSpecOption["inputSchema"]) =>
    schema.map((field) => {
      const mapping =
        mappings.find((item) => item.side === side && item.fieldKey === field.key) ?? null;

      if (!mapping) {
        return null;
      }

      const preview = resolveFieldMapping(liveSourceSlice, mapping);
      const currentFieldKey = `${side}:${field.key}`;
      const isGenerating = generatingFieldKey === currentFieldKey;
      const generationMeta = asRecord(mapping.llmGenerationMeta);
      const generatedAt = formatDateTime(
        typeof generationMeta?.generatedAt === "string" ? generationMeta.generatedAt : undefined,
      );

      return (
        <article
          key={currentFieldKey}
          className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_220px]"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-[var(--foreground)]">{field.key}</p>
              <StatusBadge status={field.required ? "approved" : "draft"} />
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {side}
              </span>
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {field.type}
              </span>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {field.description || "Sin descripción."}
            </p>

            <label className="block space-y-2">
              <FormLabel>Fuente de verdad</FormLabel>
              <select
                className="field"
                value={mapping.sourceKey}
                onChange={(event) => {
                  const nextValue = event.target.value as DatasetFieldMappingRecord["sourceKey"];
                  updateMapping(side, field.key, (current) => ({
                    ...current,
                    sourceKey: nextValue,
                  }));
                }}
              >
                <option value="source.last_user_message">Mapear: último mensaje del usuario</option>
                <option value="source.conversation_slice">Mapear: transcript seleccionado</option>
                <option value="source.surrounding_context">Mapear: contexto cercano</option>
                <option value="source.source_summary">Mapear: resumen curatorial</option>
                <option value="source.session_notes">Mapear: notas de sesión</option>
                <option value="llm_generated">Generar con LLM</option>
                <option value="manual">Texto manual</option>
                <option value="constant">Valor constante</option>
              </select>
            </label>

            {isDirectSource(mapping.sourceKey) ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <FormLabel>Path</FormLabel>
                  <input
                    className="field"
                    value={mapping.sourcePath}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updateMapping(side, field.key, (current) => ({
                        ...current,
                        sourcePath: nextValue,
                      }));
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
                      updateMapping(side, field.key, (current) => ({
                        ...current,
                        transformChain: nextValue,
                      }));
                    }}
                    placeholder="trim | join_lines | pick_path:0.text"
                  />
                </label>
              </div>
            ) : null}

            {mapping.sourceKey === "manual" || mapping.sourceKey === "constant" ? (
              <label className="block space-y-2">
                <FormLabel>{mapping.sourceKey === "constant" ? "Valor constante" : "Texto manual"}</FormLabel>
                <textarea
                  className="field min-h-36 font-mono text-xs"
                  value={mapping.sourceKey === "constant" ? mapping.constantValueText : mapping.manualValueText}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateMapping(side, field.key, (current) =>
                      mapping.sourceKey === "constant"
                        ? { ...current, constantValueText: nextValue }
                        : { ...current, manualValueText: nextValue },
                    );
                  }}
                  placeholder={
                    mapping.sourceKey === "constant"
                      ? '"valor fijo" o {"clave":"valor"}'
                      : "Escribe aquí el valor final de este campo."
                  }
                />
              </label>
            ) : null}

            {mapping.sourceKey === "llm_generated" ? (
              <div className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[rgba(15,95,92,0.04)] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <FormLabel>Configuración global LLM</FormLabel>
                    <select
                      className="field"
                      value={mapping.llmConfigurationId}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          llmConfigurationId: nextValue,
                        }));
                      }}
                    >
                      <option value="">Selecciona una configuración</option>
                      {props.llmConfigurations.map((configuration) => (
                        <option key={configuration.id} value={configuration.id}>
                          {configuration.name} · {configuration.chatModel}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-[1rem] border border-[var(--line)] bg-white/75 px-4 py-3 text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">Contexto enviado al modelo</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--line)] px-3 py-1">último mensaje</span>
                      <span className="rounded-full border border-[var(--line)] px-3 py-1">resumen</span>
                      <span className="rounded-full border border-[var(--line)] px-3 py-1">notas de sesión</span>
                      <span className="rounded-full border border-[var(--line)] px-3 py-1">transcript</span>
                      <span className="rounded-full border border-[var(--line)] px-3 py-1">payload actual</span>
                    </div>
                  </div>
                </div>

                <label className="block space-y-2">
                  <FormLabel>Instrucción para este campo</FormLabel>
                  <textarea
                    className="field min-h-28"
                    value={mapping.llmPromptText}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updateMapping(side, field.key, (current) => ({
                        ...current,
                        llmPromptText: nextValue,
                      }));
                    }}
                    placeholder="Resume los hechos clave y devuelve solo el valor útil para este campo."
                  />
                </label>

                <label className="block space-y-2">
                  <FormLabel>Resultado generado</FormLabel>
                  <textarea
                    className="field min-h-36 font-mono text-xs"
                    value={mapping.llmGeneratedValueText}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updateMapping(side, field.key, (current) => ({
                        ...current,
                        llmGeneratedValueText: nextValue,
                      }));
                    }}
                    placeholder="Aquí aparecerá el resultado generado por el modelo."
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => handleGenerateField(side, field, mapping)}
                    disabled={isGenerating || props.llmConfigurations.length === 0}
                  >
                    {isGenerating
                      ? "Generando..."
                      : mapping.llmGeneratedValueText.trim()
                        ? "Regenerar"
                        : "Generar"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      updateMapping(side, field.key, (current) => ({
                        ...current,
                        llmGeneratedValueText: "",
                        llmGenerationMeta: undefined,
                      }));
                    }}
                    disabled={isGenerating}
                  >
                    Limpiar resultado
                  </button>
                </div>

                {generationMeta ? (
                  <div className="rounded-[1rem] border border-[var(--line)] bg-white/75 px-4 py-3 text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">Proveniencia LLM</p>
                    <div className="mt-2 space-y-1">
                      <p>
                        Configuración: {typeof generationMeta.configurationName === "string" ? generationMeta.configurationName : "Sin nombre"}
                      </p>
                      <p>
                        Modelo: {typeof generationMeta.model === "string" ? generationMeta.model : "No disponible"}
                      </p>
                      {generatedAt ? <p>Generado: {generatedAt}</p> : null}
                      {typeof generationMeta.confidence === "number" ? (
                        <p>Confianza estimada: {Math.round(generationMeta.confidence * 100)}%</p>
                      ) : null}
                      {typeof generationMeta.notes === "string" && generationMeta.notes.trim() ? (
                        <p>Notas: {generationMeta.notes}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <FormLabel>Path post-generación</FormLabel>
                    <input
                      className="field"
                      value={mapping.sourcePath}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          sourcePath: nextValue,
                        }));
                      }}
                      placeholder="value.text o 0.answer"
                    />
                  </label>

                  <label className="block space-y-2">
                    <FormLabel>Transforms</FormLabel>
                    <input
                      className="field"
                      value={serializeTransformChain(mapping.transformChain)}
                      onChange={(event) => {
                        const nextValue = parseTransformChainText(event.target.value);
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          transformChain: nextValue,
                        }));
                      }}
                      placeholder="trim | pick_path:value"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Estado del campo</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <p>
                  Resolución actual: <span className="font-medium text-[var(--foreground)]">{mapping.sourceKey}</span>
                </p>
                {mapping.sourceKey === "llm_generated" && mapping.llmGeneratedValueText.trim() ? (
                  <p>Resultado LLM listo para persistir o ajustar.</p>
                ) : null}
                {mapping.sourceKey === "manual" && mapping.manualValueText.trim() ? (
                  <p>Valor manual presente.</p>
                ) : null}
                {mapping.sourceKey === "constant" && mapping.constantValueText.trim() ? (
                  <p>Valor constante configurado.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Último mensaje del usuario</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                {liveSourceSlice.lastUserMessage || "Sin mensaje de usuario detectado."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <FormLabel>Preview</FormLabel>
            <pre className="min-h-36 overflow-x-auto rounded-[1rem] border border-[var(--line)] bg-[rgba(15,23,42,0.04)] p-3 text-xs leading-6 text-[var(--muted-strong)]">
              {prettyJson(preview)}
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
              {props.mode === "create" ? "Nuevo editor DSPy" : title || "Editar dataset example"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Revisa el slice seleccionado, ajusta el resumen curatorial y define la firma final campo por campo con mapeo directo, texto manual o generación asistida por LLM.
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
                {props.sourceSlice.conversationSlice.map((message) => (
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
                    props.datasetSpecs.find((spec) => spec.id === nextDatasetSpecId) ?? null;

                  setDatasetSpecId(nextDatasetSpecId);
                  setMappings(
                    nextSpec
                      ? nextSpec.id === props.initialDatasetSpecId && props.initialMappings?.length
                        ? hydrateMappingsFromStored({
                            inputSchema: nextSpec.inputSchema,
                            outputSchema: nextSpec.outputSchema,
                            storedMappings: props.initialMappings,
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
                {props.datasetSpecs.map((spec) => (
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
              <p className="text-sm font-semibold text-[var(--foreground)]">Configuraciones LLM globales</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {props.llmConfigurations.length === 0 ? (
                  <p>No hay configuraciones LLM globales guardadas todavía.</p>
                ) : (
                  props.llmConfigurations.slice(0, 4).map((configuration) => (
                    <p key={configuration.id}>
                      {configuration.name} · {configuration.chatModel}
                    </p>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Contexto auxiliar</p>
              <pre className="mt-3 max-h-72 overflow-auto rounded-[1rem] bg-[rgba(15,23,42,0.04)] p-3 text-xs leading-6 text-[var(--muted-strong)]">
                {props.sourceSlice.surroundingContext.length === 0
                  ? "Sin contexto adicional cercano."
                  : JSON.stringify(props.sourceSlice.surroundingContext, null, 2)}
              </pre>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Última validación guardada</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <p>{props.initialValidationState?.shapeMatches ? "Shape válido" : "Todavía no validado"}</p>
                {(props.initialValidationState?.structuralErrors ?? []).map((error) => (
                  <p key={error} className="text-rose-700">
                    {error}
                  </p>
                ))}
                {(props.initialValidationState?.semanticWarnings ?? []).map((warning) => (
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
                Selecciona la fuente y ajusta la resolución por campo.
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Cada campo puede salir de una fuente del slice, texto manual o una generación puntual con LLM global.
              </p>
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
            <button type="button" className="button-secondary" onClick={() => setInputManualOverride(false)}>
              Reset input desde mapping
            </button>
            <button type="button" className="button-secondary" onClick={() => setOutputManualOverride(false)}>
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
            pendingLabel={props.mode === "create" ? "Guardando example..." : "Actualizando example..."}
          >
            {props.mode === "create" ? "Guardar dataset example" : "Actualizar dataset example"}
          </FormSubmitButton>
          <span className="text-sm text-[var(--muted)]">
            El guardado valida estructura y persiste el mapping junto con los payloads finales.
          </span>
        </div>
      </section>
    </form>
  );
}
