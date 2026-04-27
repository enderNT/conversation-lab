"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  generateDatasetFieldWithLlm,
  generateDatasetFieldWithRag,
  generateDatasetFieldsWithLlm,
} from "@/app/actions";
import { DatasetExampleDeleteButton } from "@/components/dataset-example-delete-button";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useToast } from "@/components/toast-provider";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import {
  buildDatasetFieldGenerationPrompt,
  DATASET_LLM_PROMPT_TOKEN_DEFINITIONS,
} from "@/lib/dataset-llm";
import {
  type DatasetTemplateRenderContext,
  buildDefaultMappings,
  buildPayloadFromMappings,
  hydrateMappingsFromStored,
  normalizeRetrievalTopK,
  parseTransformChainText,
  resolveFieldMapping,
  serializeTransformChain,
  stringifyCompactConversationSlice,
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

type ProjectSessionOption = {
  id: string;
  title: string;
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
  linkedExampleCount: number;
};

type DatasetFieldStep = {
  side: "input" | "output";
  field: DatasetSchemaField;
  mapping: DatasetFieldMappingRecord;
  stepKey: string;
  ordinal: number;
};

type TemplateEditorMode = "llm" | "manual";

type PreviewModalState = {
  title: string;
  content: string;
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
  rag_generated: "Retrieval manual",
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
  rag_generated: "Lookup",
  manual: "Manual",
  constant: "Const",
};

const DATASET_AUTOFILL_LLM_PROMPT_TEXT =
  "Autollenado asistido usando solo el transcript seleccionado y la descripcion del campo.";

function buildDatasetAutofillPromptText(fieldKey: string) {
  return `${DATASET_AUTOFILL_LLM_PROMPT_TEXT}\nCampo: ${fieldKey}.`;
}

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

function PreviewSurface(props: {
  label: string;
  content: string;
  onExpand: () => void;
}) {
  return (
    <section className="dataset-preview-surface">
      <div className="dataset-preview-header">
        <p className="dataset-mapping-control-label">{props.label}</p>
        <button type="button" className="button-secondary" onClick={props.onExpand}>
          Ver completo
        </button>
      </div>
      <pre className="dataset-preview-clamp">{props.content}</pre>
    </section>
  );
}

export function DatasetExampleEditor(props: {
  mode: "create" | "edit";
  datasetExampleId: string | null;
  backHref: string;
  backLabel: string;
  sourceSlice: SourceSliceRecord;
  datasetSpecs: DatasetSpecOption[];
  projectSessions: ProjectSessionOption[];
  currentSessionId: string;
  currentSessionTitle: string;
  isCurrentSessionFallback: boolean;
  isDatasetSpecLocked: boolean;
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
  sessionLinkAction?: (state: ActionFormState, formData: FormData) => Promise<ActionFormState>;
}) {
  const [state, formAction] = useActionState(props.action, EMPTY_ACTION_FORM_STATE);
  const [sessionLinkState, sessionLinkFormAction] = useActionState(
    props.sessionLinkAction ?? props.action,
    EMPTY_ACTION_FORM_STATE,
  );
  const [datasetSpecId, setDatasetSpecId] = useState(props.initialDatasetSpecId);
  const [title, setTitle] = useState(props.initialTitle);
  const [sourceTitle, setSourceTitle] = useState(props.sourceSlice.title);
  const [sourceSummary, setSourceSummary] = useState(props.sourceSlice.sourceSummary);
  const [reviewStatus, setReviewStatus] = useState(props.initialReviewStatus);
  const [linkedSessionId, setLinkedSessionId] = useState(props.currentSessionId);
  const [bulkLlmConfigurationId, setBulkLlmConfigurationId] = useState(
    () =>
      props.initialMappings?.find(
        (mapping) =>
          typeof mapping.llmConfigurationId === "string" && mapping.llmConfigurationId.trim().length > 0,
      )?.llmConfigurationId?.trim() ??
      props.llmConfigurations[0]?.id ??
      "",
  );
  const [generatingFieldKey, setGeneratingFieldKey] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [inputPayloadText, setInputPayloadText] = useState(
    JSON.stringify(props.initialInputPayload, null, 2),
  );
  const [outputPayloadText, setOutputPayloadText] = useState(
    JSON.stringify(props.initialOutputPayload, null, 2),
  );
  const [inputManualOverride, setInputManualOverride] = useState(false);
  const [outputManualOverride, setOutputManualOverride] = useState(false);
  const [inputJsonEditMode, setInputJsonEditMode] = useState(false);
  const [outputJsonEditMode, setOutputJsonEditMode] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [previewModalState, setPreviewModalState] = useState<PreviewModalState | null>(null);
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { pushToast } = useToast();
  const sessionLinkFormId = useMemo(
    () =>
      props.datasetExampleId
        ? `dataset-session-link-form-${props.datasetExampleId}`
        : "dataset-session-link-form",
    [props.datasetExampleId],
  );

  useActionFeedbackToast(state, {
    errorTitle:
      props.mode === "create"
        ? "No fue posible guardar el dataset example"
        : "No fue posible actualizar el dataset example",
    successTitle:
      props.mode === "create" ? "Dataset example guardado" : "Dataset example actualizado",
  });

  useActionFeedbackToast(sessionLinkState, {
    errorTitle: "No fue posible actualizar el vínculo de chat",
    successTitle: "Vínculo de chat actualizado",
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
  const sessionNotes = liveSourceSlice.sourceMetadata.session_notes ?? "";
  const compactConversationSliceJson = useMemo(
    () => stringifyCompactConversationSlice(liveSourceSlice.conversationSlice),
    [liveSourceSlice.conversationSlice],
  );
  const compactSurroundingContextJson = useMemo(
    () => stringifyCompactConversationSlice(liveSourceSlice.surroundingContext),
    [liveSourceSlice.surroundingContext],
  );
  const baseInputPayload = useMemo(() => {
    if (!selectedSpec) {
      return {};
    }

    return buildPayloadFromMappings({
      side: "input",
      sourceSlice: liveSourceSlice,
      schema: selectedSpec.inputSchema,
      mappings,
    });
  }, [liveSourceSlice, mappings, selectedSpec]);
  const baseOutputPayload = useMemo(() => {
    if (!selectedSpec) {
      return {};
    }

    return buildPayloadFromMappings({
      side: "output",
      sourceSlice: liveSourceSlice,
      schema: selectedSpec.outputSchema,
      mappings,
    });
  }, [liveSourceSlice, mappings, selectedSpec]);
  const baseInputPayloadJson = useMemo(
    () => JSON.stringify(baseInputPayload, null, 2),
    [baseInputPayload],
  );
  const baseOutputPayloadJson = useMemo(
    () => JSON.stringify(baseOutputPayload, null, 2),
    [baseOutputPayload],
  );

  useEffect(() => {
    setLinkedSessionId(props.currentSessionId);
  }, [props.currentSessionId]);
  const buildTemplateContext = (
    side: "input" | "output",
    field: DatasetSchemaField,
  ): DatasetTemplateRenderContext | undefined => {
    if (!selectedSpec) {
      return undefined;
    }

    return {
      side,
      field,
      datasetSpecName: selectedSpec.name,
      datasetSpecSlug: selectedSpec.slug,
      datasetSpecDescription: selectedSpec.description,
      inputPayloadJson: baseInputPayloadJson,
      outputPayloadJson: baseOutputPayloadJson,
    };
  };
  const computedInputPayload = useMemo(() => {
    if (!selectedSpec) {
      return {};
    }

    return buildPayloadFromMappings({
      side: "input",
      sourceSlice: liveSourceSlice,
      schema: selectedSpec.inputSchema,
      mappings,
      templateContextFactory: (field, side) => ({
        side,
        field,
        datasetSpecName: selectedSpec.name,
        datasetSpecSlug: selectedSpec.slug,
        datasetSpecDescription: selectedSpec.description,
        inputPayloadJson: baseInputPayloadJson,
        outputPayloadJson: baseOutputPayloadJson,
      }),
    });
  }, [baseInputPayloadJson, baseOutputPayloadJson, liveSourceSlice, mappings, selectedSpec]);
  const computedOutputPayload = useMemo(() => {
    if (!selectedSpec) {
      return {};
    }

    return buildPayloadFromMappings({
      side: "output",
      sourceSlice: liveSourceSlice,
      schema: selectedSpec.outputSchema,
      mappings,
      templateContextFactory: (field, side) => ({
        side,
        field,
        datasetSpecName: selectedSpec.name,
        datasetSpecSlug: selectedSpec.slug,
        datasetSpecDescription: selectedSpec.description,
        inputPayloadJson: baseInputPayloadJson,
        outputPayloadJson: baseOutputPayloadJson,
      }),
    });
  }, [baseInputPayloadJson, baseOutputPayloadJson, liveSourceSlice, mappings, selectedSpec]);
  const computedInputPayloadJson = useMemo(
    () => JSON.stringify(computedInputPayload, null, 2),
    [computedInputPayload],
  );
  const computedOutputPayloadJson = useMemo(
    () => JSON.stringify(computedOutputPayload, null, 2),
    [computedOutputPayload],
  );
  const effectiveInputPayloadText = inputManualOverride
    ? inputPayloadText
    : computedInputPayloadJson;
  const effectiveOutputPayloadText = outputManualOverride
    ? outputPayloadText
    : computedOutputPayloadJson;

  useEffect(() => {
    if (!inputManualOverride) {
      setInputPayloadText(computedInputPayloadJson);
    }
  }, [computedInputPayloadJson, inputManualOverride]);

  useEffect(() => {
    if (!outputManualOverride) {
      setOutputPayloadText(computedOutputPayloadJson);
    }
  }, [computedOutputPayloadJson, outputManualOverride]);

  function enableInputManualOverride() {
    setInputPayloadText(computedInputPayloadJson);
    setInputManualOverride(true);
    setInputJsonEditMode(true);
  }

  function enableOutputManualOverride() {
    setOutputPayloadText(computedOutputPayloadJson);
    setOutputManualOverride(true);
    setOutputJsonEditMode(true);
  }

  function resetInputManualOverride() {
    setInputPayloadText(computedInputPayloadJson);
    setInputManualOverride(false);
    setInputJsonEditMode(false);
  }

  function resetOutputManualOverride() {
    setOutputPayloadText(computedOutputPayloadJson);
    setOutputManualOverride(false);
    setOutputJsonEditMode(false);
  }
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

  useEffect(() => {
    if (!previewModalState) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewModalState(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewModalState]);

  useEffect(() => {
    if (props.llmConfigurations.length === 0) {
      if (bulkLlmConfigurationId !== "") {
        setBulkLlmConfigurationId("");
      }
      return;
    }

    if (!props.llmConfigurations.some((configuration) => configuration.id === bulkLlmConfigurationId)) {
      setBulkLlmConfigurationId(props.llmConfigurations[0]?.id ?? "");
    }
  }, [bulkLlmConfigurationId, props.llmConfigurations]);

  const activeStep =
    fieldSteps.find((step) => step.stepKey === activeFieldKey) ?? fieldSteps[0] ?? null;
  const activeStepIndex = activeStep
    ? fieldSteps.findIndex((step) => step.stepKey === activeStep.stepKey)
    : -1;
  const resolveFieldPreview = (
    side: "input" | "output",
    field: DatasetSchemaField,
    mapping: DatasetFieldMappingRecord,
  ) =>
    resolveFieldMapping(liveSourceSlice, mapping, {
      templateContext: buildTemplateContext(side, field),
    });

  const resolvedFieldCount =
    fieldSteps.length === 0
      ? 0
      : fieldSteps.reduce((count, step) => {
          const preview = resolveFieldPreview(step.side, step.field, step.mapping);
          return count + (isMeaningfulValue(preview) ? 1 : 0);
        }, 0);

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
  const datasetExampleName =
    title.trim() || sourceTitle.trim() || props.sourceSlice.title.trim() || "este dataset example";

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

  const insertTemplateToken = (
    side: "input" | "output",
    fieldKey: string,
    mode: TemplateEditorMode,
    currentValue: string,
    token: string,
  ) => {
    const textarea = templateTextareaRef.current;

    if (!textarea) {
      updateMapping(side, fieldKey, (current) => ({
        ...current,
        ...(mode === "llm"
          ? {
              llmPromptText: current.llmPromptText
                ? `${current.llmPromptText}\n${token}`
                : token,
            }
          : {
              manualValueText: current.manualValueText
                ? `${current.manualValueText}\n${token}`
                : token,
            }),
      }));
      return;
    }

    const baseValue = textarea.value || currentValue;
    const selectionStart = textarea.selectionStart ?? baseValue.length;
    const selectionEnd = textarea.selectionEnd ?? baseValue.length;
    const nextValue =
      baseValue.slice(0, selectionStart) +
      token +
      baseValue.slice(selectionEnd);
    const nextCaretPosition = selectionStart + token.length;

    updateMapping(side, fieldKey, (current) => ({
      ...current,
      ...(mode === "llm"
        ? { llmPromptText: nextValue }
        : { manualValueText: nextValue }),
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
        conversationSliceJson: compactConversationSliceJson,
        surroundingContextJson: compactSurroundingContextJson,
        inputPayloadJson: computedInputPayloadJson,
        outputPayloadJson: computedOutputPayloadJson,
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
        title: "Falta configuracion de retrieval",
        description: "Selecciona una configuracion global antes de consultar este campo.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    if (!mapping.ragPromptText.trim()) {
      pushToast({
        title: "Falta query manual",
        description: "Escribe la query que quieres buscar antes de consultar.",
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
        promptText: mapping.ragPromptText,
        topK: normalizeRetrievalTopK(mapping.ragTopK),
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
        description:
          normalizeRetrievalTopK(mapping.ragTopK) === 1
            ? `${field.key} ya tiene un resultado recuperado desde la base de conocimiento.`
            : `${field.key} ya tiene ${normalizeRetrievalTopK(mapping.ragTopK)} resultados recuperados desde la base de conocimiento.`,
        variant: "success",
        durationMs: 5000,
      });
    } finally {
      setGeneratingFieldKey(null);
    }
  }

  async function handleGenerateAllFieldsWithLlm() {
    if (!selectedSpec) {
      return;
    }

    if (!bulkLlmConfigurationId.trim()) {
      pushToast({
        title: "Falta configuracion LLM",
        description: "Selecciona una configuracion global antes de autollenar el dataset.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    if (fieldSteps.length === 0) {
      pushToast({
        title: "No hay campos para autollenar",
        description: "El dataset spec activo no define campos renderizables.",
        variant: "info",
        durationMs: 6000,
      });
      return;
    }

    if (
      resolvedFieldCount > 0 &&
      !window.confirm(
        "Este autollenado reemplazara los valores actuales de los campos con un nuevo borrador generado por LLM. ¿Quieres continuar?",
      )
    ) {
      return;
    }

    setIsBulkGenerating(true);

    try {
      const result = await generateDatasetFieldsWithLlm({
        llmConfigurationId: bulkLlmConfigurationId,
        datasetSpecName: selectedSpec.name,
        datasetSpecSlug: selectedSpec.slug,
        datasetSpecDescription: selectedSpec.description,
        conversationSliceJson: compactConversationSliceJson,
        fields: fieldSteps.map((step) => ({
          side: step.side,
          field: step.field,
        })),
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible autollenar el dataset",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      const generatedFieldMap = new Map(
        result.fields.map((item) => [`${item.side}:${item.fieldKey}`, item] as const),
      );

      setMappings((current) =>
        current.map((mapping) => {
          const generatedField = generatedFieldMap.get(`${mapping.side}:${mapping.fieldKey}`);

          if (!generatedField) {
            return mapping;
          }

          return {
            ...mapping,
            sourceKey: "llm_generated",
            sourcePath: "",
            transformChain: [],
            llmConfigurationId: bulkLlmConfigurationId,
            llmPromptText: buildDatasetAutofillPromptText(mapping.fieldKey),
            llmContextSelection: {
              conversationSlice: true,
            },
            llmGeneratedValueText: generatedField.valueText,
            llmGenerationMeta: generatedField.metadata,
          };
        }),
      );

      const generatedCount = result.fields.length;
      const missingCount = result.missingFieldKeys.length;

      pushToast({
        title: missingCount === 0 ? "Borrador asistido listo" : "Autollenado parcial completado",
        description:
          missingCount === 0
            ? `Se llenaron ${generatedCount} campos usando solo el slice seleccionado.`
            : `Se llenaron ${generatedCount} campos. ${missingCount} quedaron pendientes para revisión manual.`,
        variant: missingCount === 0 ? "success" : "info",
        durationMs: 7000,
      });
    } finally {
      setIsBulkGenerating(false);
    }
  }

  const renderFieldStep = (step: DatasetFieldStep) => {
    const { field, mapping, ordinal, side, stepKey } = step;
    const preview = resolveFieldPreview(side, field, mapping);
    const currentFieldKey = stepKey;
    const isGenerating = generatingFieldKey === currentFieldKey;
    const llmGenerationMeta = asRecord(mapping.llmGenerationMeta);
    const templateMode: TemplateEditorMode | null =
      mapping.sourceKey === "llm_generated"
        ? "llm"
        : mapping.sourceKey === "manual"
          ? "manual"
          : null;
    const selectedLlmConfiguration =
      props.llmConfigurations.find((configuration) => configuration.id === mapping.llmConfigurationId) ?? null;
    const llmPromptPreview = buildDatasetFieldGenerationPrompt({
      side,
      field,
      datasetSpecName: selectedSpec?.name ?? "",
      datasetSpecSlug: selectedSpec?.slug ?? "",
      datasetSpecDescription: selectedSpec?.description ?? "",
      promptText: mapping.llmPromptText,
      lastUserMessage: liveSourceSlice.lastUserMessage,
      sourceSummary: liveSourceSlice.sourceSummary,
      sessionNotes,
      conversationSliceJson: compactConversationSliceJson,
      surroundingContextJson: compactSurroundingContextJson,
      inputPayloadJson: computedInputPayloadJson,
      outputPayloadJson: computedOutputPayloadJson,
    });
    const llmRequestMetadata = {
      route: "dataset_example_field_generation",
      configurationName: selectedLlmConfiguration?.name ?? null,
      model: selectedLlmConfiguration?.chatModel ?? null,
      systemPromptApplied: false,
      promptTemplate: mapping.llmPromptText,
      usedTokens: llmPromptPreview.usedTokens,
      unresolvedTokens: llmPromptPreview.unresolvedTokens,
    } satisfies JsonValue;
    const llmGeneratedAt = formatDateTime(
      typeof llmGenerationMeta?.generatedAt === "string"
        ? llmGenerationMeta.generatedAt
        : undefined,
    );
    const ragGenerationMeta = asRecord(mapping.ragGenerationMeta);
    const ragTopK = normalizeRetrievalTopK(mapping.ragTopK);
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
                <option value="rag_generated">Retrieval manual</option>
                <option value="manual">Texto manual</option>
                <option value="constant">Valor constante</option>
              </select>
            </label>
          </div>

          {templateMode ? (
            <section className="dataset-mapping-template-panel mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="dataset-mapping-eyebrow">Variables reutilizables</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Inserta variables arriba del editor para armar{" "}
                    {templateMode === "llm" ? "el prompt" : "el texto manual"} sin ruido.
                  </p>
                </div>
                {renderBadge(templateMode === "llm" ? "prompt LLM" : "texto manual", "accent")}
              </div>

              <div className="dataset-mapping-token-grid mt-4">
                {DATASET_LLM_PROMPT_TOKEN_DEFINITIONS.map((definition) => (
                  <button
                    key={definition.key}
                    type="button"
                    className="dataset-mapping-chip dataset-mapping-chip-toggle dataset-mapping-chip-active dataset-mapping-token-button"
                    onClick={() =>
                      insertTemplateToken(
                        side,
                        field.key,
                        templateMode,
                        templateMode === "llm" ? mapping.llmPromptText : mapping.manualValueText,
                        definition.token,
                      )
                    }
                    title={`${definition.description} · Click para insertar`}
                  >
                    <span className="font-medium text-[var(--foreground)]">
                      {definition.label}
                    </span>
                    <span className="font-mono text-[0.7rem] text-[var(--muted)]">
                      {definition.token}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

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
                      ref={mapping.sourceKey === "manual" ? templateTextareaRef : null}
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
                          : 'Puedes escribir texto o JSON. Tambien funcionan variables como {{source.last_user_message}}.'
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

                  <label className="mt-4 block space-y-2">
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

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">
                      Instruccion para este campo
                    </FormLabel>
                    <textarea
                      ref={templateTextareaRef}
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
                      El request se separa en metadata tecnica y en el contenido real enviado al
                      modelo. Si dejas un token desconocido, se conserva tal cual.
                    </p>

                    <div className="mt-4 grid gap-4">
                      <PreviewSurface
                        label="Metadata tecnica"
                        content={prettyJson(llmRequestMetadata)}
                        onExpand={() =>
                          setPreviewModalState({
                            title: `${field.key} · metadata del request`,
                            content: prettyJson(llmRequestMetadata),
                          })
                        }
                      />

                      <div className="dataset-request-divider" />

                      <PreviewSurface
                        label="Content enviado al modelo"
                        content={llmPromptPreview.promptText}
                        onExpand={() =>
                          setPreviewModalState({
                            title: `${field.key} · content enviado al modelo`,
                            content: llmPromptPreview.promptText,
                          })
                        }
                      />
                    </div>
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
                        <p className="dataset-mapping-eyebrow">Configuracion global de retrieval</p>
                        <p className="text-sm text-[var(--muted)]">
                          Selecciona la base de conocimiento y escribe una query manual simple para consultar Qdrant.
                        </p>
                      </div>
                    </div>
                    {renderBadge("Retrieval", "accent")}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px_260px]">
                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">
                        Configuracion global de retrieval
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

                    <label className="block space-y-2">
                      <FormLabel className="dataset-mapping-control-label">Top K</FormLabel>
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={ragTopK}
                        onChange={(event) => {
                          const nextValue = normalizeRetrievalTopK(
                            Number.parseInt(event.target.value || "1", 10),
                          );
                          updateMapping(side, field.key, (current) => ({
                            ...current,
                            ragTopK: nextValue,
                          }));
                        }}
                      />
                    </label>

                    <div className="dataset-mapping-mini-panel">
                      <p className="dataset-mapping-eyebrow">Consulta enviada</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="dataset-mapping-chip">top k {ragTopK}</span>
                        <span className="dataset-mapping-chip">qdrant</span>
                        <span className="dataset-mapping-chip">embeddings</span>
                        <span className="dataset-mapping-chip">query manual</span>
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">
                      Query manual
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
                      placeholder="precio de envio express, horario sucursal centro, donde esta la oficina de soporte"
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
                      placeholder={
                        ragTopK === 1
                          ? "Aqui aparecera el resultado recuperado desde Qdrant."
                          : "Aqui aparecera un arreglo JSON con los resultados recuperados desde Qdrant."
                      }
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
                          ? `Consultar top ${ragTopK} de nuevo`
                          : `Consultar top ${ragTopK}`}
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
                      <p className="dataset-mapping-eyebrow">Proveniencia retrieval</p>
                      <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                        <p>
                          Configuracion: {typeof ragGenerationMeta.configurationName === "string" ? ragGenerationMeta.configurationName : "Sin nombre"}
                        </p>
                        <p>
                          Coleccion: {typeof ragGenerationMeta.collectionName === "string" ? ragGenerationMeta.collectionName : "No disponible"}
                        </p>
                        <p>Top K solicitado: {ragTopK}</p>
                        {typeof ragGenerationMeta.embeddingModel === "string" && ragGenerationMeta.embeddingModel.trim() ? (
                          <p>Modelo de embeddings: {ragGenerationMeta.embeddingModel}</p>
                        ) : null}
                        {ragGeneratedAt ? <p>Consultado: {ragGeneratedAt}</p> : null}
                        {typeof ragGenerationMeta.resultCount === "number" ? (
                          <p>Resultados devueltos: {ragGenerationMeta.resultCount}</p>
                        ) : null}
                        {typeof ragGenerationMeta.score === "number" ? (
                          <p>Score top 1: {ragGenerationMeta.score.toFixed(4)}</p>
                        ) : null}
                        {typeof ragGenerationMeta.pointId === "string" || typeof ragGenerationMeta.pointId === "number" ? (
                          <p>Point ID top 1: {String(ragGenerationMeta.pointId)}</p>
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
                        placeholder={ragTopK === 1 ? "answer.text o chunk" : "0.answer.text o 1.chunk"}
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
                    <p>
                      {ragTopK === 1
                        ? "Resultado recuperado por query manual y listo para persistir o ajustar."
                        : `Resultados top ${ragTopK} recuperados por query manual y listos para persistir o ajustar.`}
                    </p>
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
                <PreviewSurface
                  label="Preview"
                  content={prettyJson(preview)}
                  onExpand={() =>
                    setPreviewModalState({
                      title: `${field.key} · preview del campo`,
                      content: prettyJson(preview),
                    })
                  }
                />
              </section>
            </aside>
          </div>
      </article>
    );
  };

  return (
    <>
      {props.mode === "edit" && props.sessionLinkAction ? (
        <form id={sessionLinkFormId} action={sessionLinkFormAction} className="hidden" />
      ) : null}

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

        <div className="flex min-h-0 flex-1 flex-col xl:grid xl:h-full xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
          <aside className="flex min-h-0 flex-col border-b border-[var(--line)] bg-white/80 xl:overflow-hidden xl:border-b-0 xl:border-r">
            <div className="border-b border-[var(--line)] bg-[rgba(250,249,246,0.7)] px-4 py-4 backdrop-blur sm:px-5">
              <h3 className="font-[var(--font-editorial)] text-lg font-semibold text-[var(--accent)]">
                Transcripcion de Origen
              </h3>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Origen de la verdad
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
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
                      {props.isDatasetSpecLocked ? (
                        <div className="rounded-[1rem] border border-[var(--line)] bg-[rgba(250,249,246,0.88)] px-3 py-3 text-sm text-[var(--muted-strong)]">
                          <p className="font-medium text-[var(--foreground)]">
                            {selectedSpec?.name} ({selectedSpec?.slug})
                          </p>
                          <p className="mt-2 leading-6">
                            Este example fue importado y quedó casado con su dataset spec original.
                          </p>
                        </div>
                      ) : (
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
                      )}
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

                {props.mode === "edit" && props.sessionLinkAction ? (
                  <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                    <p className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Vínculo de chat
                    </p>
                    <div className="mt-3 space-y-3">
                      <div className="rounded-[0.9rem] border border-[var(--line)] bg-[rgba(250,249,246,0.88)] px-3 py-3 text-sm text-[var(--muted-strong)]">
                        <p className="font-medium text-[var(--foreground)]">
                          {props.currentSessionTitle}
                        </p>
                        <p className="mt-2 leading-6">
                          {props.isCurrentSessionFallback
                            ? "Este example vive en la sesión técnica fallback del proyecto."
                            : "Este example está vinculado a una sesión de chat operativa."}
                        </p>
                        {props.metadata && props.metadata.linkedExampleCount > 1 ? (
                          <p className="mt-2 leading-6">
                            Este cambio moverá el slice completo y {props.metadata.linkedExampleCount} example(s) vinculados a él.
                          </p>
                        ) : null}
                      </div>

                      <label className="block space-y-2">
                        <FormLabel className="dataset-mapping-control-label">Cambiar sesión</FormLabel>
                        <select
                          name="sessionId"
                          form={sessionLinkFormId}
                          className="field"
                          value={linkedSessionId}
                          onChange={(event) => setLinkedSessionId(event.target.value)}
                        >
                          {props.projectSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {session.title} ({session.id.slice(0, 8)})
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="submit"
                          form={sessionLinkFormId}
                          className="button-secondary inline-flex w-full items-center justify-center"
                        >
                          Guardar vínculo
                        </button>
                        <button
                          type="submit"
                          form={sessionLinkFormId}
                          name="unlink"
                          value="1"
                          className="button-danger inline-flex w-full items-center justify-center"
                        >
                          Desvincular
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Llenado asistido
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">
                    Genera un borrador completo usando solo el slice seleccionado y la descripcion de
                    cada campo del spec activo.
                  </p>

                  <label className="mt-4 block space-y-2">
                    <FormLabel className="dataset-mapping-control-label">
                      Configuracion global LLM
                    </FormLabel>
                    <select
                      className="field"
                      value={bulkLlmConfigurationId}
                      onChange={(event) => setBulkLlmConfigurationId(event.target.value)}
                    >
                      <option value="">Selecciona una configuracion</option>
                      {props.llmConfigurations.map((configuration) => (
                        <option key={configuration.id} value={configuration.id}>
                          {configuration.name} · {configuration.chatModel}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="button-primary mt-4 inline-flex w-full items-center justify-center"
                    onClick={() => void handleGenerateAllFieldsWithLlm()}
                    disabled={
                      isBulkGenerating ||
                      !selectedSpec ||
                      fieldSteps.length === 0 ||
                      props.llmConfigurations.length === 0
                    }
                  >
                    {isBulkGenerating ? "Llenando..." : "Llenar todo con LLM"}
                  </button>

                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    {fieldSteps.length > 0
                      ? `${fieldSteps.length} campo(s) disponibles para borrador asistido.`
                      : "No hay campos disponibles para el spec activo."}
                  </p>
                </div>

                {props.mode === "edit" ? (
                  <div className="rounded-[1rem] border border-[var(--danger-border)] bg-[var(--danger-background)] p-4">
                    <p className="font-[var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--danger-text)]">
                      Acciones
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">
                      Elimina este dataset example si ya no lo necesitas. Los field mappings asociados
                      también se borrarán.
                    </p>
                    <DatasetExampleDeleteButton
                      datasetExampleId={props.datasetExampleId ?? ""}
                      datasetExampleName={datasetExampleName}
                      redirectTo={props.backHref}
                      formClassName="mt-4"
                      buttonClassName="button-danger inline-flex w-full items-center justify-center"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[#faf9f6] xl:overflow-hidden dark:bg-[var(--background)]">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
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
                              resolveFieldPreview(step.side, step.field, step.mapping),
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

          <aside className="flex min-h-0 flex-col border-t border-[var(--line)] bg-[rgba(250,249,246,0.86)] xl:overflow-hidden xl:border-t-0 xl:border-l">
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

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
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
                        onClick={() => {
                          if (inputJsonEditMode) {
                            setInputJsonEditMode(false);
                            return;
                          }

                          enableInputManualOverride();
                        }}
                      >
                        {inputJsonEditMode ? "Preview" : "Editar"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                        onClick={resetInputManualOverride}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  {inputJsonEditMode ? (
                    <textarea
                      className="field mt-3 min-h-48 font-mono text-xs"
                      value={effectiveInputPayloadText}
                      onChange={(event) => {
                        setInputManualOverride(true);
                        setInputJsonEditMode(true);
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
                        onClick={() => {
                          if (outputJsonEditMode) {
                            setOutputJsonEditMode(false);
                            return;
                          }

                          enableOutputManualOverride();
                        }}
                      >
                        {outputJsonEditMode ? "Preview" : "Editar"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                        onClick={resetOutputManualOverride}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  {outputJsonEditMode ? (
                    <textarea
                      className="field mt-3 min-h-48 font-mono text-xs"
                      value={effectiveOutputPayloadText}
                      onChange={(event) => {
                        setOutputManualOverride(true);
                        setOutputJsonEditMode(true);
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
                      <p>Chat session: {props.currentSessionTitle}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 z-10 mt-auto border-t border-[var(--line)] bg-[rgba(250,249,246,0.96)] pb-2 pt-4 backdrop-blur">
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

      {previewModalState ? (
        <div
          className="dataset-preview-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewModalState(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={previewModalState.title}
            className="dataset-preview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dataset-preview-modal-header">
              <div>
                <p className="dataset-mapping-eyebrow">Vista completa</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {previewModalState.title}
                </h3>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPreviewModalState(null)}
              >
                Cerrar
              </button>
            </div>

            <pre className="dataset-preview-modal-content">{previewModalState.content}</pre>
          </div>
        </div>
      ) : null}
      </form>
    </>
  );
}
