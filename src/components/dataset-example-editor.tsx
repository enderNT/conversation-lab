"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { generateDatasetFieldWithLlm, generateDatasetFieldWithRag } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useToast } from "@/components/toast-provider";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import {
  buildDatasetFieldGenerationRequestPreview,
  DATASET_LLM_PROMPT_TOKEN_DEFINITIONS,
} from "@/lib/dataset-llm";
import {
  buildDefaultMappings,
  buildPayloadFromMappings,
  hydrateMappingsFromStored,
  parseTransformChainText,
  resolveFieldMapping,
  serializeTransformChain,
} from "@/lib/datasets";
import { EMPTY_ACTION_FORM_STATE, type ActionFormState } from "@/lib/form-state";
import {
  DATASET_EXAMPLE_STATUSES,
  type DatasetFieldMappingRecord,
  type DatasetMappingSourceKey,
  type DatasetSchemaField,
  type DatasetValidationState,
  type JsonObject,
  type JsonValue,
  type SourceSliceRecord,
} from "@/lib/types";

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

type GlobalRagConfigurationOption = {
  id: string;
  name: string;
  collectionName: string;
  embeddingModel: string | null;
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
  llmContextSelectionJson?: JsonValue | null;
  llmGeneratedValueJson?: JsonValue | null;
  llmGenerationMetaJson?: JsonValue | null;
  ragConfigurationId?: string | null;
  ragPromptText?: string | null;
  ragGeneratedValueJson?: JsonValue | null;
  ragGenerationMetaJson?: JsonValue | null;
  resolvedPreviewJson: JsonValue | null;
};

type DatasetEditorMetadata = {
  specSlug: string;
  version: number;
  sourceSliceId: string;
  fieldMappingCount: number;
};

type DatasetFieldStep = {
  side: "input" | "output";
  field: DatasetSchemaField;
  mapping: DatasetFieldMappingRecord;
  stepKey: string;
  ordinal: number;
};

function serializeMappings(mappings: DatasetFieldMappingRecord[]) {
  return JSON.stringify(mappings, null, 2);
}

function prettyJson(value: JsonValue | undefined) {
  if (value === undefined) {
    return "Sin resolver todavia";
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

function isMeaningfulValue(value: JsonValue | undefined) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Object.keys(value).length > 0;
}

const SOURCE_LABELS: Record<DatasetMappingSourceKey, string> = {
  "source.last_user_message": "Mapear desde fuente",
  "source.conversation_slice": "Mapear transcript",
  "source.surrounding_context": "Mapear contexto",
  "source.source_summary": "Mapear resumen",
  "source.session_notes": "Mapear notas",
  llm_generated: "Generar con LLM",
  rag_generated: "Recuperar con RAG",
  manual: "Texto manual",
  constant: "Valor constante",
};

const SOURCE_BADGES: Record<DatasetFieldMappingRecord["sourceKey"], string> = {
  "source.last_user_message": "Transcript",
  "source.conversation_slice": "Slice",
  "source.surrounding_context": "Contexto",
  "source.source_summary": "Resumen",
  "source.session_notes": "Notas",
  llm_generated: "LLM",
  rag_generated: "RAG",
  manual: "Manual",
  constant: "Const",
};

function getSourceSnapshot(
  sourceKey: DatasetFieldMappingRecord["sourceKey"],
  sourceSlice: SourceSliceRecord,
): JsonValue | undefined {
  switch (sourceKey) {
    case "source.last_user_message":
      return sourceSlice.lastUserMessage;
    case "source.conversation_slice":
      return sourceSlice.conversationSlice.map((message) => ({
        role: message.role,
        text: message.text,
      }));
    case "source.surrounding_context":
      return sourceSlice.surroundingContext.map((message) => ({
        role: message.role,
        text: message.text,
      }));
    case "source.source_summary":
      return sourceSlice.sourceSummary;
    case "source.session_notes":
      return sourceSlice.sourceMetadata.session_notes ?? "";
    default:
      return undefined;
  }
}

function renderBadge(text: string, tone: "neutral" | "accent" | "warm" = "neutral") {
  return (
    <span
      className={[
        "dataset-mapping-badge",
        tone === "accent" ? "dataset-mapping-badge-accent" : "",
        tone === "warm" ? "dataset-mapping-badge-warm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {text}
    </span>
  );
}

function getValidationTone(percent: number) {
  if (percent >= 85) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (percent >= 60) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-rose-200 bg-rose-50 text-rose-900";
}

function getCheckTone(kind: "ok" | "warn" | "error") {
  if (kind === "ok") {
    return "text-emerald-800";
  }

  if (kind === "warn") {
    return "text-amber-800";
  }

  return "text-rose-800";
}

function getStepStatusTone(resolved: boolean, active: boolean) {
  if (active) {
    return "dataset-stepper-status-active";
  }

  if (resolved) {
    return "dataset-stepper-status-complete";
  }

  return "dataset-stepper-status-pending";
}

export function DatasetExampleEditor(props: {
  mode: "create" | "edit";
  backHref: string;
  backLabel: string;
  sourceSlice: SourceSliceRecord;
  datasetSpecs: DatasetSpecOption[];
  llmConfigurations: GlobalLlmConfigurationOption[];
  ragConfigurations: GlobalRagConfigurationOption[];
  initialDatasetSpecId: string;
  initialTitle: string;
  initialReviewStatus: (typeof DATASET_EXAMPLE_STATUSES)[number];
  initialInputPayload: JsonObject;
  initialOutputPayload: JsonObject;
  initialMappings?: StoredMapping[];
  initialValidationState?: DatasetValidationState | null;
  metadata?: DatasetEditorMetadata;
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
  const [showSchema, setShowSchema] = useState(false);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const llmPromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
    props.datasetSpecs.find((spec) => spec.id === props.initialDatasetSpecId) ??
    props.datasetSpecs[0] ??
    null;
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
  const liveSourceSlice = useMemo(
    () => ({
      ...props.sourceSlice,
      title: sourceTitle,
      sourceSummary,
    }),
    [props.sourceSlice, sourceSummary, sourceTitle],
  );
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
  const fieldSteps = useMemo<DatasetFieldStep[]>(() => {
    if (!selectedSpec) {
      return [];
    }

    const fields = [
      ...selectedSpec.inputSchema.map((field) => ({ side: "input" as const, field })),
      ...selectedSpec.outputSchema.map((field) => ({ side: "output" as const, field })),
    ];

    return fields.flatMap((item, index) => {
      const mapping =
        mappings.find(
          (current) => current.side === item.side && current.fieldKey === item.field.key,
        ) ?? null;

      if (!mapping) {
        return [];
      }

      return [
        {
          side: item.side,
          field: item.field,
          mapping,
          stepKey: `${item.side}:${item.field.key}`,
          ordinal: index + 1,
        },
      ];
    });
  }, [mappings, selectedSpec]);

  useEffect(() => {
    if (fieldSteps.length === 0) {
      if (activeFieldKey !== null) {
        setActiveFieldKey(null);
      }
      return;
    }

    if (!activeFieldKey || !fieldSteps.some((step) => step.stepKey === activeFieldKey)) {
      setActiveFieldKey(fieldSteps[0]?.stepKey ?? null);
    }
  }, [activeFieldKey, fieldSteps]);

  const activeStep =
    fieldSteps.find((step) => step.stepKey === activeFieldKey) ?? fieldSteps[0] ?? null;
  const activeStepIndex = activeStep
    ? fieldSteps.findIndex((step) => step.stepKey === activeStep.stepKey)
    : -1;

  const resolvedFieldCount = useMemo(() => {
    if (fieldSteps.length === 0) {
      return 0;
    }

    return fieldSteps.reduce((count, step) => {
      const preview = resolveFieldMapping(liveSourceSlice, step.mapping);
      return count + (isMeaningfulValue(preview) ? 1 : 0);
    }, 0);
  }, [fieldSteps, liveSourceSlice]);

  const totalFieldCount =
    (selectedSpec?.inputSchema.length ?? 0) + (selectedSpec?.outputSchema.length ?? 0);
  const readinessPercent =
    totalFieldCount === 0 ? 0 : Math.round((resolvedFieldCount / totalFieldCount) * 100);
  const structuralErrors = props.initialValidationState?.structuralErrors ?? [];
  const semanticWarnings = props.initialValidationState?.semanticWarnings ?? [];
  const validationChecks = [
    {
      label:
        totalFieldCount === 0
          ? "Sin campos definidos"
          : `${resolvedFieldCount}/${totalFieldCount} campos resueltos`,
      kind:
        resolvedFieldCount === totalFieldCount
          ? "ok"
          : resolvedFieldCount > 0
            ? "warn"
            : "error",
    },
    {
      label:
        structuralErrors.length === 0
          ? "Shape del payload sin errores estructurales"
          : `${structuralErrors.length} errores estructurales detectados`,
      kind: structuralErrors.length === 0 ? "ok" : "error",
    },
    {
      label:
        semanticWarnings.length === 0
          ? "Sin warnings semanticos persistidos"
          : `${semanticWarnings.length} warnings semanticos pendientes`,
      kind: semanticWarnings.length === 0 ? "ok" : "warn",
    },
    {
      label:
        inputManualOverride || outputManualOverride
          ? "Hay overrides manuales activos en JSON final"
          : "JSON final derivado directamente desde mappings",
      kind: inputManualOverride || outputManualOverride ? "warn" : "ok",
    },
  ] as const;

  const renderSchemaSummary = () => {
    if (!selectedSpec || !showSchema) {
      return null;
    }

    return (
      <div className="dataset-schema-sheet mt-5 grid gap-4 lg:grid-cols-2">
        <section className="dataset-schema-column">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dataset-mapping-eyebrow">Input schema</p>
              <p className="text-sm text-[var(--muted)]">Campos de entrada de la firma.</p>
            </div>
            {renderBadge(`${selectedSpec.inputSchema.length} campos`, "accent")}
          </div>
          <div className="mt-4 space-y-3">
            {selectedSpec.inputSchema.map((field) => (
              <article key={`schema-input-${field.key}`} className="dataset-schema-row">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--foreground)]">{field.key}</p>
                  {renderBadge("input")}
                  {renderBadge(
                    field.required ? "required" : "optional",
                    field.required ? "warm" : "neutral",
                  )}
                  {renderBadge(field.type)}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {field.description || "Sin descripcion."}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="dataset-schema-column">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dataset-mapping-eyebrow">Output schema</p>
              <p className="text-sm text-[var(--muted)]">Campos de salida esperados.</p>
            </div>
            {renderBadge(`${selectedSpec.outputSchema.length} campos`, "accent")}
          </div>
          <div className="mt-4 space-y-3">
            {selectedSpec.outputSchema.map((field) => (
              <article key={`schema-output-${field.key}`} className="dataset-schema-row">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--foreground)]">{field.key}</p>
                  {renderBadge("output")}
                  {renderBadge(
                    field.required ? "required" : "optional",
                    field.required ? "warm" : "neutral",
                  )}
                  {renderBadge(field.type)}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {field.description || "Sin descripcion."}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  };

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

  const insertPromptToken = (
    side: "input" | "output",
    fieldKey: string,
    currentPromptText: string,
    token: string,
  ) => {
    const textarea = llmPromptTextareaRef.current;

    if (!textarea) {
      updateMapping(side, fieldKey, (current) => ({
        ...current,
        llmPromptText: current.llmPromptText
          ? `${current.llmPromptText}\n${token}`
          : token,
      }));
      return;
    }

    const basePromptText = textarea.value || currentPromptText;
    const selectionStart = textarea.selectionStart ?? basePromptText.length;
    const selectionEnd = textarea.selectionEnd ?? basePromptText.length;
    const nextPromptText =
      basePromptText.slice(0, selectionStart) +
      token +
      basePromptText.slice(selectionEnd);
    const nextCaretPosition = selectionStart + token.length;

    updateMapping(side, fieldKey, (current) => ({
      ...current,
      llmPromptText: nextPromptText,
    }));

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
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
        title: "Falta configuracion LLM",
        description: "Selecciona una configuracion global antes de generar este campo.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    if (!mapping.llmPromptText.trim()) {
      pushToast({
        title: "Falta instruccion",
        description: "Escribe una instruccion especifica para este campo antes de generar.",
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
        description: `${field.key} ya tiene un valor generado con la configuracion seleccionada.`,
        variant: "success",
        durationMs: 5000,
      });
    } finally {
      setGeneratingFieldKey(null);
    }
  }

  async function handleRetrieveField(
    side: "input" | "output",
    field: DatasetSchemaField,
    mapping: DatasetFieldMappingRecord,
  ) {
    if (!selectedSpec) {
      return;
    }

    if (!mapping.ragConfigurationId.trim()) {
      pushToast({
        title: "Falta configuracion RAG",
        description: "Selecciona una configuracion global antes de consultar este campo.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    if (!mapping.ragPromptText.trim()) {
      pushToast({
        title: "Falta instruccion",
        description: "Escribe una instruccion especifica para este campo antes de consultar.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    const currentFieldKey = `${side}:${field.key}`;
    setGeneratingFieldKey(currentFieldKey);

    try {
      const result = await generateDatasetFieldWithRag({
        ragConfigurationId: mapping.ragConfigurationId,
        side,
        field,
        datasetSpecName: selectedSpec.name,
        datasetSpecSlug: selectedSpec.slug,
        datasetSpecDescription: selectedSpec.description,
        promptText: mapping.ragPromptText,
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
          title: "No fue posible recuperar el campo",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      updateMapping(side, field.key, (current) => ({
        ...current,
        sourceKey: "rag_generated",
        ragGeneratedValueText: result.valueText,
        ragGenerationMeta: result.metadata,
      }));

      pushToast({
        title: "Campo recuperado",
        description: `${field.key} ya tiene un valor recuperado desde Qdrant.`,
        variant: "success",
        durationMs: 5000,
      });
    } finally {
      setGeneratingFieldKey(null);
    }
  }

  const renderFieldStep = (step: DatasetFieldStep) => {
    const { field, mapping, ordinal, side, stepKey } = step;
    const preview = resolveFieldMapping(liveSourceSlice, mapping);
    const currentFieldKey = stepKey;
    const isGenerating = generatingFieldKey === currentFieldKey;
    const llmGenerationMeta = asRecord(mapping.llmGenerationMeta);
    const selectedLlmConfiguration =
      props.llmConfigurations.find((configuration) => configuration.id === mapping.llmConfigurationId) ?? null;
    const llmRequestPreview = buildDatasetFieldGenerationRequestPreview({
      model: selectedLlmConfiguration?.chatModel ?? null,
      configurationName: selectedLlmConfiguration?.name ?? null,
      side,
      field,
      datasetSpecName: selectedSpec?.name ?? "",
      datasetSpecSlug: selectedSpec?.slug ?? "",
      datasetSpecDescription: selectedSpec?.description ?? "",
      promptText: mapping.llmPromptText,
      lastUserMessage: liveSourceSlice.lastUserMessage,
      sourceSummary: liveSourceSlice.sourceSummary,
      sessionNotes,
      conversationSliceJson: JSON.stringify(liveSourceSlice.conversationSlice, null, 2),
      surroundingContextJson: JSON.stringify(liveSourceSlice.surroundingContext, null, 2),
      inputPayloadJson: JSON.stringify(computedInputPayload, null, 2),
      outputPayloadJson: JSON.stringify(computedOutputPayload, null, 2),
    });
    const llmGeneratedAt = formatDateTime(
      typeof llmGenerationMeta?.generatedAt === "string"
        ? llmGenerationMeta.generatedAt
        : undefined,
    );
    const ragGenerationMeta = asRecord(mapping.ragGenerationMeta);
    const ragGeneratedAt = formatDateTime(
      typeof ragGenerationMeta?.generatedAt === "string"
        ? ragGenerationMeta.generatedAt
        : undefined,
    );
    const sourceSnapshot = getSourceSnapshot(mapping.sourceKey, liveSourceSlice);
    const activeStepLabel = side === "input" ? "Entrada" : "Salida";
    const totalSteps = fieldSteps.length;

    return (
      <article key={currentFieldKey} className="dataset-mapping-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="dataset-stepper-card-index">Paso {ordinal}</span>
                <p className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                  {field.key}
                </p>
                {renderBadge(side === "input" ? "input" : "output", "accent")}
                {renderBadge(
                  field.required ? "required" : "optional",
                  field.required ? "warm" : "neutral",
                )}
                {renderBadge(field.type)}
              </div>
              <p className="dataset-mapping-eyebrow">
                {activeStepLabel} {ordinal} de {totalSteps}
              </p>
              <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {field.description || "Sin descripcion."}
              </p>
            </div>

            <label className="dataset-mapping-source-control lg:max-w-[20rem]">
              <span className="dataset-mapping-control-label">Proveniencia</span>
              <select
                className="field dataset-mapping-select"
                value={mapping.sourceKey}
                onChange={(event) => {
                  const nextValue = event.target.value as DatasetFieldMappingRecord["sourceKey"];
                  updateMapping(side, field.key, (current) => ({
                    ...current,
                    sourceKey: nextValue,
                  }));
                }}
              >
                <option value="source.last_user_message">Mapear: ultimo mensaje del usuario</option>
                <option value="source.conversation_slice">Mapear: transcript seleccionado</option>
                <option value="source.surrounding_context">Mapear: contexto cercano</option>
                <option value="source.source_summary">Mapear: resumen curatorial</option>
                <option value="source.session_notes">Mapear: notas de sesion</option>
                <option value="llm_generated">Generar con LLM</option>
                <option value="rag_generated">Recuperar con RAG</option>
                <option value="manual">Texto manual</option>
                <option value="constant">Valor constante</option>
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              {isDirectSource(mapping.sourceKey) ? (
                <section className="dataset-mapping-surface">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderBadge(SOURCE_BADGES[mapping.sourceKey], "accent")}
                    <span className="dataset-mapping-chip">{SOURCE_LABELS[mapping.sourceKey]}</span>
                    {mapping.sourcePath.trim() ? (
                      <span className="dataset-mapping-chip mono">{mapping.sourcePath}</span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">Path</FormLabel>
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
                      <FormLabel className="dataset-mapping-control-label">Transforms</FormLabel>
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

                  <div className="dataset-mapping-quote mt-4">
                    <p className="dataset-mapping-eyebrow">Vista de la fuente</p>
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">
                      {prettyJson(sourceSnapshot)}
                    </pre>
                  </div>
                </section>
              ) : null}

              {mapping.sourceKey === "manual" || mapping.sourceKey === "constant" ? (
                <section className="dataset-mapping-surface">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderBadge(SOURCE_BADGES[mapping.sourceKey], "accent")}
                    <span className="dataset-mapping-chip">{SOURCE_LABELS[mapping.sourceKey]}</span>
                  </div>
                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">
                      {mapping.sourceKey === "constant" ? "Valor constante" : "Texto manual"}
                    </FormLabel>
                    <textarea
                      className="field min-h-40 font-mono text-xs"
                      value={
                        mapping.sourceKey === "constant"
                          ? mapping.constantValueText
                          : mapping.manualValueText
                      }
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
                          : "Escribe aqui el valor final de este campo."
                      }
                    />
                  </label>
                </section>
              ) : null}

              {mapping.sourceKey === "llm_generated" ? (
                <section className="dataset-mapping-llm-surface">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="dataset-mapping-llm-icon" aria-hidden="true">
                        AI
                      </div>
                      <div>
                        <p className="dataset-mapping-eyebrow">Configuracion global LLM</p>
                        <p className="text-sm text-[var(--muted)]">
                          Selecciona el modelo y define la instruccion especifica para este campo.
                        </p>
                      </div>
                    </div>
                    {renderBadge("LLM", "accent")}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">
                        Configuracion global LLM
                      </FormLabel>
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
                        <option value="">Selecciona una configuracion</option>
                        {props.llmConfigurations.map((configuration) => (
                          <option key={configuration.id} value={configuration.id}>
                            {configuration.name} · {configuration.chatModel}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="dataset-mapping-mini-panel">
                      <p className="dataset-mapping-eyebrow">Variables invocables</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DATASET_LLM_PROMPT_TOKEN_DEFINITIONS.map((definition) => (
                          <button
                            key={definition.key}
                            type="button"
                            className="dataset-mapping-chip dataset-mapping-chip-toggle dataset-mapping-chip-active"
                            onClick={() =>
                              insertPromptToken(
                                side,
                                field.key,
                                mapping.llmPromptText,
                                definition.token,
                              )
                            }
                            title={`${definition.description} · Click para insertar`}
                          >
                            <span className="font-medium text-[var(--foreground)]">
                              {definition.label}
                            </span>
                            <span className="ml-2 font-mono text-[0.68rem] text-[var(--muted)]">
                              {definition.token}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                        Nada se envia por defecto. Usa estas variables como guia y haz click para
                        insertarlas donde quieras dentro del prompt.
                      </p>
                    </div>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">
                      Instruccion para este campo
                    </FormLabel>
                    <textarea
                      ref={llmPromptTextareaRef}
                      className="field min-h-28"
                      value={mapping.llmPromptText}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          llmPromptText: nextValue,
                        }));
                      }}
                      placeholder={"Ejemplo: Usa {{field.summary}} y {{source.last_user_message}}.\nSi quieres salida compatible con el parser, agrega {{guide.output_contract}}."}
                    />
                  </label>

                  <details className="dataset-mapping-mini-panel mt-4">
                    <summary className="cursor-pointer list-none text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                      Preview del request al modelo
                    </summary>
                    <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                      Se enviara exactamente este prompt expandido a partir de tu plantilla. Si
                      dejas un token desconocido, se conservara tal cual en el request.
                    </p>
                    <pre className="mt-4 whitespace-pre-wrap break-words rounded-[0.9rem] border border-[var(--line)] bg-white/75 p-4 text-xs leading-6 text-[var(--muted-strong)]">
                      {prettyJson(llmRequestPreview)}
                    </pre>
                  </details>

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">Resultado generado</FormLabel>
                    <textarea
                      className="field min-h-40 font-mono text-xs"
                      value={mapping.llmGeneratedValueText}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          llmGeneratedValueText: nextValue,
                        }));
                      }}
                      placeholder="Aqui aparecera el resultado generado por el modelo."
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
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

                  {llmGenerationMeta ? (
                    <div className="dataset-mapping-mini-panel mt-4">
                      <p className="dataset-mapping-eyebrow">Proveniencia LLM</p>
                      <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                        <p>
                          Configuracion: {typeof llmGenerationMeta.configurationName === "string" ? llmGenerationMeta.configurationName : "Sin nombre"}
                        </p>
                        <p>
                          Modelo: {typeof llmGenerationMeta.model === "string" ? llmGenerationMeta.model : "No disponible"}
                        </p>
                        {typeof llmGenerationMeta.systemPromptApplied === "boolean" ? (
                          <p>Prompt global aplicado: {llmGenerationMeta.systemPromptApplied ? "si" : "no"}</p>
                        ) : null}
                        {llmGeneratedAt ? <p>Generado: {llmGeneratedAt}</p> : null}
                        {typeof llmGenerationMeta.confidence === "number" ? (
                          <p>Confianza estimada: {Math.round(llmGenerationMeta.confidence * 100)}%</p>
                        ) : null}
                        {typeof llmGenerationMeta.notes === "string" && llmGenerationMeta.notes.trim() ? (
                          <p>Notas: {llmGenerationMeta.notes}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">
                        Path post-generacion
                      </FormLabel>
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
                      <FormLabel className="dataset-mapping-control-label">Transforms</FormLabel>
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
                </section>
              ) : null}

              {mapping.sourceKey === "rag_generated" ? (
                <section className="dataset-mapping-llm-surface">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="dataset-mapping-llm-icon" aria-hidden="true">
                        R
                      </div>
                      <div>
                        <p className="dataset-mapping-eyebrow">Configuracion global RAG</p>
                        <p className="text-sm text-[var(--muted)]">
                          Selecciona el vector store, define la instruccion y consulta Qdrant usando embeddings externos.
                        </p>
                      </div>
                    </div>
                    {renderBadge("RAG", "accent")}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">
                        Configuracion global RAG
                      </FormLabel>
                      <select
                        className="field"
                        value={mapping.ragConfigurationId}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          updateMapping(side, field.key, (current) => ({
                            ...current,
                            ragConfigurationId: nextValue,
                          }));
                        }}
                      >
                        <option value="">Selecciona una configuracion</option>
                        {props.ragConfigurations.map((configuration) => (
                          <option key={configuration.id} value={configuration.id}>
                            {configuration.name} · {configuration.collectionName}
                            {configuration.embeddingModel ? ` · ${configuration.embeddingModel}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="dataset-mapping-mini-panel">
                      <p className="dataset-mapping-eyebrow">Consulta enviada</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="dataset-mapping-chip">top k 1</span>
                        <span className="dataset-mapping-chip">qdrant</span>
                        <span className="dataset-mapping-chip">embeddings</span>
                        <span className="dataset-mapping-chip">transcript</span>
                        <span className="dataset-mapping-chip">payload actual</span>
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">
                      Instruccion para este campo
                    </FormLabel>
                    <textarea
                      className="field min-h-28"
                      value={mapping.ragPromptText}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          ragPromptText: nextValue,
                        }));
                      }}
                      placeholder="Busca el fragmento o payload mas util para este campo y usa solo el primer resultado."
                    />
                  </label>

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">Resultado recuperado</FormLabel>
                    <textarea
                      className="field min-h-40 font-mono text-xs"
                      value={mapping.ragGeneratedValueText}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          ragGeneratedValueText: nextValue,
                        }));
                      }}
                      placeholder="Aqui aparecera el payload recuperado desde Qdrant."
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => handleRetrieveField(side, field, mapping)}
                      disabled={isGenerating || props.ragConfigurations.length === 0}
                    >
                      {isGenerating
                        ? "Consultando..."
                        : mapping.ragGeneratedValueText.trim()
                          ? "Consultar de nuevo"
                          : "Consultar"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        updateMapping(side, field.key, (current) => ({
                          ...current,
                          ragGeneratedValueText: "",
                          ragGenerationMeta: undefined,
                        }));
                      }}
                      disabled={isGenerating}
                    >
                      Limpiar resultado
                    </button>
                  </div>

                  {ragGenerationMeta ? (
                    <div className="dataset-mapping-mini-panel mt-4">
                      <p className="dataset-mapping-eyebrow">Proveniencia RAG</p>
                      <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                        <p>
                          Configuracion: {typeof ragGenerationMeta.configurationName === "string" ? ragGenerationMeta.configurationName : "Sin nombre"}
                        </p>
                        <p>
                          Coleccion: {typeof ragGenerationMeta.collectionName === "string" ? ragGenerationMeta.collectionName : "No disponible"}
                        </p>
                        {typeof ragGenerationMeta.embeddingModel === "string" && ragGenerationMeta.embeddingModel.trim() ? (
                          <p>Modelo de embeddings: {ragGenerationMeta.embeddingModel}</p>
                        ) : null}
                        {ragGeneratedAt ? <p>Consultado: {ragGeneratedAt}</p> : null}
                        {typeof ragGenerationMeta.score === "number" ? (
                          <p>Score: {ragGenerationMeta.score.toFixed(4)}</p>
                        ) : null}
                        {typeof ragGenerationMeta.pointId === "string" || typeof ragGenerationMeta.pointId === "number" ? (
                          <p>Point ID: {String(ragGenerationMeta.pointId)}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">
                        Path post-retrieval
                      </FormLabel>
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
                        placeholder="answer.text o chunk"
                      />
                    </label>

                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">Transforms</FormLabel>
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
                </section>
              ) : null}
            </div>

            <aside className="space-y-4">
              <section className="dataset-mapping-mini-panel">
                <div className="flex flex-wrap items-center gap-2">
                  {renderBadge(SOURCE_BADGES[mapping.sourceKey], "accent")}
                  <span className="dataset-mapping-chip">{SOURCE_LABELS[mapping.sourceKey]}</span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  <p>
                    Resolucion actual: <span className="font-medium text-[var(--foreground)]">{mapping.sourceKey}</span>
                  </p>
                  {mapping.sourceKey === "llm_generated" && mapping.llmGeneratedValueText.trim() ? (
                    <p>Resultado LLM listo para persistir o ajustar.</p>
                  ) : null}
                  {mapping.sourceKey === "rag_generated" && mapping.ragGeneratedValueText.trim() ? (
                    <p>Resultado RAG top 1 listo para persistir o ajustar.</p>
                  ) : null}
                  {mapping.sourceKey === "manual" && mapping.manualValueText.trim() ? (
                    <p>Valor manual presente.</p>
                  ) : null}
                  {mapping.sourceKey === "constant" && mapping.constantValueText.trim() ? (
                    <p>Valor constante configurado.</p>
                  ) : null}
                </div>
              </section>

              <section className="dataset-mapping-mini-panel">
                <p className="dataset-mapping-eyebrow">Ultimo mensaje del usuario</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                  {liveSourceSlice.lastUserMessage || "Sin mensaje de usuario detectado."}
                </p>
              </section>

              <section className="dataset-mapping-preview-panel">
                <FormLabel className="dataset-mapping-control-label">Preview</FormLabel>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--muted-strong)]">
                  {prettyJson(preview)}
                </pre>
              </section>
            </aside>
          </div>
      </article>
    );
  };

  return (
    <form action={formAction} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <input type="hidden" name="datasetSpecId" value={selectedSpec?.id ?? ""} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="sourceTitle" value={sourceTitle} />
      <input type="hidden" name="sourceSummary" value={sourceSummary} />
      <input type="hidden" name="reviewStatus" value={reviewStatus} />
      <input type="hidden" name="inputPayloadJson" value={effectiveInputPayloadText} />
      <input type="hidden" name="outputPayloadJson" value={effectiveOutputPayloadText} />
      <input type="hidden" name="mappingsJson" value={serializeMappings(mappings)} />

      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#faf9f6] text-[var(--foreground)] dark:bg-[var(--background)]">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--line)] bg-[rgba(250,249,246,0.94)] px-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="font-[var(--font-editorial)] text-xl font-black tracking-tight text-[var(--accent)] sm:text-2xl">
              Conversation Lab
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Hybrid DSPy Mapping Editor
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={props.backHref}
              className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 text-xs font-medium text-[var(--muted-strong)] transition-colors hover:text-[var(--foreground)]"
            >
              {props.backLabel}
            </Link>
            <Link
              href="/exports"
              className="rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:bg-white/80 hover:text-[var(--foreground)]"
            >
              Exportar
            </Link>
            <FormSubmitButton
              type="submit"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]"
              pendingLabel={props.mode === "create" ? "Guardando..." : "Actualizando..."}
            >
              {props.mode === "create" ? "Guardar Dataset" : "Guardar Cambios"}
            </FormSubmitButton>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col xl:grid xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
          <aside className="min-h-0 border-b border-[var(--line)] bg-white/80 xl:border-b-0 xl:border-r">
            <div className="border-b border-[var(--line)] bg-[rgba(250,249,246,0.7)] px-4 py-4 backdrop-blur sm:px-5">
              <h3 className="font-[var(--font-editorial)] text-lg font-semibold text-[var(--accent)]">
                Transcripcion de Origen
              </h3>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Origen de la verdad
              </p>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-4">
                {props.sourceSlice.conversationSlice.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <article
                      key={message.id}
                      className={[
                        "flex items-start gap-3",
                        isUser ? "flex-row-reverse" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div
                        className={[
                          "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
                          isUser
                            ? "bg-[rgba(204,85,0,0.12)] text-[#cc5500]"
                            : "bg-[rgba(43,94,140,0.12)] text-[#2b5e8c]",
                        ].join(" ")}
                      >
                        {isUser ? "U" : "A"}
                      </div>
                      <div
                        className={[
                          "relative rounded-xl border px-3 py-3 text-sm leading-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
                          isUser
                            ? "border-[rgba(204,85,0,0.18)] bg-white"
                            : "border-[rgba(24,35,47,0.08)] bg-[rgba(250,249,246,0.92)]",
                        ].join(" ")}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                          <span>{isUser ? "Usuario" : "Asistente"}</span>
                          <span>Turno {message.orderIndex + 1}</span>
                        </div>
                        <p className={isUser ? "text-[var(--foreground)]" : "text-[var(--muted-strong)]"}>
                          {message.text}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <label className="block space-y-2">
                  <span className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Notas del Operador
                  </span>
                  <textarea
                    className="field min-h-28 resize-y text-sm leading-6"
                    value={sourceSummary}
                    onChange={(event) => setSourceSummary(event.target.value)}
                    placeholder="Anadir contexto adicional..."
                  />
                </label>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Configuracion
                  </p>
                  <div className="mt-3 space-y-3">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">Titulo del example</FormLabel>
                      <input
                        className="field"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Nombre interno del dataset example"
                      />
                    </label>
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">Titulo del slice</FormLabel>
                      <input
                        className="field"
                        value={sourceTitle}
                        onChange={(event) => setSourceTitle(event.target.value)}
                        placeholder="Slice 3-6"
                      />
                    </label>
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">Dataset spec</FormLabel>
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
                      <FormLabel className="dataset-mapping-control-label">Estado</FormLabel>
                      <select
                        className="field"
                        value={reviewStatus}
                        onChange={(event) =>
                          setReviewStatus(
                            event.target.value as (typeof DATASET_EXAMPLE_STATUSES)[number],
                          )
                        }
                      >
                        {DATASET_EXAMPLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Configuraciones LLM globales
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    {props.llmConfigurations.length === 0 ? (
                      <p>No hay configuraciones LLM guardadas todavia.</p>
                    ) : (
                      props.llmConfigurations.slice(0, 4).map((configuration) => (
                        <p key={configuration.id}>
                          {configuration.name} · {configuration.chatModel}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Configuraciones RAG globales
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    {props.ragConfigurations.length === 0 ? (
                      <p>No hay configuraciones RAG guardadas todavia.</p>
                    ) : (
                      props.ragConfigurations.slice(0, 4).map((configuration) => (
                        <p key={configuration.id}>
                          {configuration.name} · {configuration.collectionName}
                          {configuration.embeddingModel ? ` · ${configuration.embeddingModel}` : ""}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-h-0 bg-[#faf9f6] dark:bg-[var(--background)]">
            <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[rgba(255,255,255,0.82)] px-5 py-5 shadow-sm backdrop-blur sm:px-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h1 className="font-[var(--font-editorial)] text-2xl font-bold tracking-tight text-[var(--accent)]">
                    Campos de Destino
                    <span className="ml-2 font-mono text-sm font-normal text-[var(--muted)]">
                      (DSPy Signature)
                    </span>
                  </h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Configura la proveniencia de cada campo para el pipeline de inferencia.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--muted-strong)] transition-colors hover:text-[var(--accent)]"
                  onClick={() => setShowSchema((current) => !current)}
                >
                  {showSchema ? "Ocultar esquema" : "Ver esquema"}
                </button>
              </div>

              {renderSchemaSummary()}
            </div>

            <div className="h-full overflow-y-auto px-5 py-6 sm:px-6">
              {selectedSpec ? (
                fieldSteps.length > 0 && activeStep ? (
                  <div className="space-y-6 pb-24">
                    <section className="dataset-stepper-summary">
                      <div>
                        <p className="dataset-mapping-eyebrow">Pipeline dinamico del dataspec</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Cada paso se construye segun los campos definidos por el spec activo.
                          Navega uno por uno para curar el example con menos ruido visual.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {renderBadge(`${fieldSteps.length} pasos`, "accent")}
                        {renderBadge(`${resolvedFieldCount}/${fieldSteps.length} resueltos`)}
                        {renderBadge(
                          activeStep.side === "input" ? "trabajando entrada" : "trabajando salida",
                          "warm",
                        )}
                      </div>
                    </section>

                    <div className="dataset-stepper-shell">
                      <aside className="dataset-stepper-rail xl:sticky xl:top-24 xl:self-start">
                        <div className="dataset-stepper-rail-header">
                          <div>
                            <p className="dataset-mapping-eyebrow">Steps</p>
                            <p className="mt-2 text-sm text-[var(--muted)]">
                              El orden sigue el schema activo.
                            </p>
                          </div>
                          <span className="dataset-stepper-progress-text">
                            Paso {activeStep.ordinal} de {fieldSteps.length}
                          </span>
                        </div>

                        <div className="dataset-stepper-list">
                          {fieldSteps.map((step) => {
                            const resolved = isMeaningfulValue(
                              resolveFieldMapping(liveSourceSlice, step.mapping),
                            );
                            const isActive = activeStep.stepKey === step.stepKey;

                            return (
                              <button
                                key={step.stepKey}
                                type="button"
                                className={[
                                  "dataset-stepper-button",
                                  isActive ? "dataset-stepper-button-active" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => setActiveFieldKey(step.stepKey)}
                                aria-pressed={isActive}
                              >
                                <span className="dataset-stepper-button-top">
                                  <span className="dataset-stepper-index">{step.ordinal}</span>
                                  <span
                                    className={`dataset-stepper-status ${getStepStatusTone(resolved, isActive)}`}
                                  >
                                    {isActive ? "Actual" : resolved ? "Listo" : "Pendiente"}
                                  </span>
                                </span>
                                <span className="dataset-stepper-button-body">
                                  <span className="dataset-stepper-field-name">{step.field.key}</span>
                                  <span className="dataset-stepper-field-meta">
                                    {step.side === "input" ? "Input" : "Output"} ·{" "}
                                    {SOURCE_BADGES[step.mapping.sourceKey]}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </aside>

                      <div className="space-y-5">
                        <section className="dataset-stepper-summary">
                          <div>
                            <p className="dataset-mapping-eyebrow">Campo activo</p>
                            <h2 className="mt-2 font-[var(--font-editorial)] text-2xl font-semibold text-[var(--foreground)]">
                              {activeStep.field.key}
                            </h2>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {activeStep.field.description || "Sin descripcion para este campo."}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {renderBadge(activeStep.side, "accent")}
                            {renderBadge(activeStep.field.type)}
                            {renderBadge(
                              activeStep.field.required ? "required" : "optional",
                              activeStep.field.required ? "warm" : "neutral",
                            )}
                          </div>
                        </section>

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-[var(--line)] bg-white/70 px-4 py-3">
                          <div className="text-sm text-[var(--muted)]">
                            Paso actual:{" "}
                            <span className="font-medium text-[var(--foreground)]">
                              {activeStep.ordinal}/{fieldSteps.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => setActiveFieldKey(fieldSteps[activeStepIndex - 1]?.stepKey ?? null)}
                              disabled={activeStepIndex <= 0}
                            >
                              Anterior
                            </button>
                            <button
                              type="button"
                              className="button-primary"
                              onClick={() => setActiveFieldKey(fieldSteps[activeStepIndex + 1]?.stepKey ?? null)}
                              disabled={activeStepIndex < 0 || activeStepIndex >= fieldSteps.length - 1}
                            >
                              Siguiente
                            </button>
                          </div>
                        </div>

                        {renderFieldStep(activeStep)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-6 text-sm text-[var(--muted)]">
                    Este dataset spec no define campos renderizables para el pipeline del example.
                  </div>
                )
              ) : (
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-6 text-sm text-[var(--muted)]">
                  No hay dataset specs activos para construir este example.
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 border-t border-[var(--line)] bg-[rgba(250,249,246,0.86)] xl:border-t-0 xl:border-l">
            <div className="border-b border-[var(--line)] bg-white/60 px-4 py-4 backdrop-blur sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-[var(--font-editorial)] text-lg font-semibold text-[var(--accent)]">
                  Validacion y Payload
                </h3>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${getValidationTone(readinessPercent)}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {readinessPercent}%
                </span>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-6 pb-28">
                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-[var(--font-label)] text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      Input JSON
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                        onClick={() => setInputManualOverride((current) => !current)}
                      >
                        {inputManualOverride ? "Preview" : "Editar"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                        onClick={() => setInputManualOverride(false)}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  {inputManualOverride ? (
                    <textarea
                      className="field mt-3 min-h-48 font-mono text-xs"
                      value={effectiveInputPayloadText}
                      onChange={(event) => {
                        setInputManualOverride(true);
                        setInputPayloadText(event.target.value);
                      }}
                    />
                  ) : (
                    <pre className="mt-3 overflow-x-auto rounded-md border border-[var(--line)] bg-[#1e1e1e] p-3 text-[11px] leading-relaxed text-green-400">
                      {effectiveInputPayloadText}
                    </pre>
                  )}
                </div>

                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-[var(--font-label)] text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      Output JSON Preview
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                        onClick={() => setOutputManualOverride((current) => !current)}
                      >
                        {outputManualOverride ? "Preview" : "Editar"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                        onClick={() => setOutputManualOverride(false)}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  {outputManualOverride ? (
                    <textarea
                      className="field mt-3 min-h-48 font-mono text-xs"
                      value={effectiveOutputPayloadText}
                      onChange={(event) => {
                        setOutputManualOverride(true);
                        setOutputPayloadText(event.target.value);
                      }}
                    />
                  ) : (
                    <pre className="mt-3 overflow-x-auto rounded-md border border-[var(--line)] bg-[#1e1e1e] p-3 text-[11px] leading-relaxed text-green-400">
                      {effectiveOutputPayloadText}
                    </pre>
                  )}
                </div>

                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <h4 className="font-[var(--font-label)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    Checks DSPy
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm">
                    {validationChecks.map((check) => (
                      <li
                        key={check.label}
                        className={`flex items-start gap-2 ${getCheckTone(check.kind)}`}
                      >
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
                        <span>{check.label}</span>
                      </li>
                    ))}
                    {structuralErrors.map((error) => (
                      <li key={error} className="flex items-start gap-2 text-rose-800">
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
                        <span>{error}</span>
                      </li>
                    ))}
                    {semanticWarnings.map((warning) => (
                      <li key={warning} className="flex items-start gap-2 text-amber-800">
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {props.metadata ? (
                  <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4 text-sm text-[var(--muted)]">
                    <h4 className="font-[var(--font-label)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      Metadata
                    </h4>
                    <div className="mt-3 space-y-2">
                      <p>Spec: {props.metadata.specSlug}</p>
                      <p>Version: {props.metadata.version}</p>
                      <p>Source slice: {props.metadata.sourceSliceId}</p>
                      <p>Field mappings: {props.metadata.fieldMappingCount}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 mt-auto border-t border-[var(--line)] bg-[rgba(250,249,246,0.96)] pb-2 pt-4 backdrop-blur">
                <FormSubmitButton
                  type="submit"
                  className="flex w-full items-center justify-center rounded-xl bg-[#cc5500] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a00]"
                  pendingLabel={
                    props.mode === "create"
                      ? "Guardando dataset..."
                      : "Guardando cambios..."
                  }
                >
                  {props.mode === "create" ? "Crear borrador" : "Guardar cambios"}
                </FormSubmitButton>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}
