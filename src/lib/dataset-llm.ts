import type { DatasetSchemaField, JsonValue } from "@/lib/types";

export const DATASET_LLM_CONTEXT_KEYS = [
  "lastUserMessage",
  "sourceSummary",
  "sessionNotes",
  "conversationSlice",
  "surroundingContext",
  "inputPayload",
  "outputPayload",
] as const;

export type DatasetLlmContextKey = (typeof DATASET_LLM_CONTEXT_KEYS)[number];

export type DatasetLlmContextSelection = Record<DatasetLlmContextKey, boolean>;

export const DEFAULT_DATASET_LLM_CONTEXT_SELECTION: DatasetLlmContextSelection = {
  lastUserMessage: false,
  sourceSummary: false,
  sessionNotes: false,
  conversationSlice: false,
  surroundingContext: false,
  inputPayload: false,
  outputPayload: false,
};

export const DATASET_LLM_CONTEXT_LABELS: Record<DatasetLlmContextKey, string> = {
  lastUserMessage: "ultimo mensaje",
  sourceSummary: "resumen",
  sessionNotes: "notas",
  conversationSlice: "transcript",
  surroundingContext: "contexto cercano",
  inputPayload: "payload input",
  outputPayload: "payload output",
};

export const DATASET_LLM_PROMPT_TOKEN_DEFINITIONS = [
  {
    key: "guide.task",
    token: "{{guide.task}}",
    label: "tarea",
    description: "Instruccion general para generar un unico campo.",
  },
  {
    key: "guide.output_contract",
    token: "{{guide.output_contract}}",
    label: "contrato json",
    description: "Formato de salida compatible con el parser del editor.",
  },
  {
    key: "guide.type_guardrails",
    token: "{{guide.type_guardrails}}",
    label: "guardrails",
    description: "Recordatorio de tipo esperado y sintesis util.",
  },
  {
    key: "spec.summary",
    token: "{{spec.summary}}",
    label: "spec resumen",
    description: "Nombre, slug y descripcion del dataset spec.",
  },
  {
    key: "spec.name",
    token: "{{spec.name}}",
    label: "spec nombre",
    description: "Nombre visible del dataset spec.",
  },
  {
    key: "spec.slug",
    token: "{{spec.slug}}",
    label: "spec slug",
    description: "Slug del dataset spec.",
  },
  {
    key: "spec.description",
    token: "{{spec.description}}",
    label: "spec descripcion",
    description: "Descripcion del dataset spec.",
  },
  {
    key: "field.summary",
    token: "{{field.summary}}",
    label: "campo resumen",
    description: "Resumen completo del campo actual.",
  },
  {
    key: "field.key",
    token: "{{field.key}}",
    label: "campo key",
    description: "Clave del campo destino.",
  },
  {
    key: "field.side",
    token: "{{field.side}}",
    label: "campo lado",
    description: "Si el campo es input u output.",
  },
  {
    key: "field.type",
    token: "{{field.type}}",
    label: "campo tipo",
    description: "Tipo esperado del campo.",
  },
  {
    key: "field.required",
    token: "{{field.required}}",
    label: "campo required",
    description: "Si el campo es obligatorio.",
  },
  {
    key: "field.description",
    token: "{{field.description}}",
    label: "campo descripcion",
    description: "Descripcion del campo destino.",
  },
  {
    key: "field.enum_values",
    token: "{{field.enum_values}}",
    label: "campo enum",
    description: "Valores permitidos cuando el campo es enum.",
  },
  {
    key: "source.last_user_message",
    token: "{{source.last_user_message}}",
    label: "ultimo mensaje",
    description: "Ultimo mensaje del usuario del slice.",
  },
  {
    key: "source.source_summary",
    token: "{{source.source_summary}}",
    label: "resumen",
    description: "Resumen curatorial o notas del operador.",
  },
  {
    key: "source.session_notes",
    token: "{{source.session_notes}}",
    label: "notas de sesion",
    description: "Notas persistidas de la sesion.",
  },
  {
    key: "source.conversation_slice",
    token: "{{source.conversation_slice}}",
    label: "transcript",
    description: "Transcript seleccionado en JSON.",
  },
  {
    key: "source.surrounding_context",
    token: "{{source.surrounding_context}}",
    label: "contexto cercano",
    description: "Mensajes cercanos fuera del slice.",
  },
  {
    key: "payload.input",
    token: "{{payload.input}}",
    label: "payload input",
    description: "Payload input actual derivado desde mappings.",
  },
  {
    key: "payload.output",
    token: "{{payload.output}}",
    label: "payload output",
    description: "Payload output actual derivado desde mappings.",
  },
] as const;

export type DatasetLlmPromptTokenKey =
  (typeof DATASET_LLM_PROMPT_TOKEN_DEFINITIONS)[number]["key"];

export type DatasetLlmPromptTokenDefinition =
  (typeof DATASET_LLM_PROMPT_TOKEN_DEFINITIONS)[number];

const DATASET_LLM_PROMPT_TOKEN_PATTERN = /\{\{\s*([a-z0-9_.-]+)\s*\}\}/gi;

export function normalizeDatasetLlmContextSelection(
  value?: JsonValue | Partial<DatasetLlmContextSelection> | null,
) {
  const normalized = { ...DEFAULT_DATASET_LLM_CONTEXT_SELECTION };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalized;
  }

  for (const key of DATASET_LLM_CONTEXT_KEYS) {
    const candidate = value[key];

    if (typeof candidate === "boolean") {
      normalized[key] = candidate;
    }
  }

  return normalized;
}

function buildDatasetFieldSummary(field: DatasetSchemaField, side: "input" | "output") {
  const enumHint = field.enumValues?.length
    ? `Valores permitidos: ${field.enumValues.join(", ")}.`
    : "";

  return [
    `Campo destino: ${field.key}.`,
    `Lado: ${side}.`,
    `Tipo esperado: ${field.type}.`,
    `Requerido: ${field.required ? "si" : "no"}.`,
    field.description ? `Descripcion del campo: ${field.description}` : "",
    enumHint,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDatasetSpecSummary(input: {
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
}) {
  return [
    `Spec: ${input.datasetSpecName || input.datasetSpecSlug || "dataset_spec"}.`,
    input.datasetSpecDescription
      ? `Descripcion del spec: ${input.datasetSpecDescription}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDatasetFieldGenerationTokenMap(input: {
  side: "input" | "output";
  field: DatasetSchemaField;
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
  lastUserMessage: string;
  sourceSummary: string;
  sessionNotes: string;
  conversationSliceJson: string;
  surroundingContextJson: string;
  inputPayloadJson: string;
  outputPayloadJson: string;
}) {
  return {
    "guide.task": "Genera el valor de un unico campo para un dataset example de DSPy.",
    "guide.output_contract": [
      "Devuelve SOLO JSON valido, sin markdown ni texto extra.",
      'Usa exactamente esta forma: {"value": ..., "confidence": 0.0, "notes": "..."}.',
    ].join("\n"),
    "guide.type_guardrails": [
      "El contenido de value debe respetar el tipo esperado del campo.",
      "Si el valor debe salir de la conversacion o del contexto, sintetizalo de forma util para entrenamiento, no copies ruido innecesario.",
    ].join("\n"),
    "spec.summary": buildDatasetSpecSummary(input),
    "spec.name": input.datasetSpecName || "",
    "spec.slug": input.datasetSpecSlug || "",
    "spec.description": input.datasetSpecDescription || "",
    "field.summary": buildDatasetFieldSummary(input.field, input.side),
    "field.key": input.field.key,
    "field.side": input.side,
    "field.type": input.field.type,
    "field.required": input.field.required ? "si" : "no",
    "field.description": input.field.description || "",
    "field.enum_values": input.field.enumValues?.join(", ") || "",
    "source.last_user_message": input.lastUserMessage || "",
    "source.source_summary": input.sourceSummary || "",
    "source.session_notes": input.sessionNotes || "",
    "source.conversation_slice": input.conversationSliceJson,
    "source.surrounding_context": input.surroundingContextJson,
    "payload.input": input.inputPayloadJson,
    "payload.output": input.outputPayloadJson,
  } satisfies Record<DatasetLlmPromptTokenKey, string>;
}

export function buildDatasetFieldGenerationPrompt(input: {
  side: "input" | "output";
  field: DatasetSchemaField;
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
  promptText: string;
  lastUserMessage: string;
  sourceSummary: string;
  sessionNotes: string;
  conversationSliceJson: string;
  surroundingContextJson: string;
  inputPayloadJson: string;
  outputPayloadJson: string;
}) {
  const tokenMap = buildDatasetFieldGenerationTokenMap(input);
  const usedTokens: DatasetLlmPromptTokenKey[] = [];
  const unresolvedTokens = new Set<string>();
  const promptText = input.promptText.replace(
    DATASET_LLM_PROMPT_TOKEN_PATTERN,
    (match, rawKey: string) => {
      const key = rawKey.trim() as DatasetLlmPromptTokenKey;

      if (!(key in tokenMap)) {
        unresolvedTokens.add(rawKey.trim());
        return match;
      }

      usedTokens.push(key);
      return tokenMap[key];
    },
  );

  return {
    promptText,
    usedTokens: Array.from(new Set(usedTokens)),
    unresolvedTokens: Array.from(unresolvedTokens),
    tokenMap,
  };
}

export function buildDatasetFieldGenerationRequestPreview(input: {
  model?: string | null;
  configurationName?: string | null;
  side: "input" | "output";
  field: DatasetSchemaField;
  datasetSpecName: string;
  datasetSpecSlug: string;
  datasetSpecDescription: string;
  promptText: string;
  lastUserMessage: string;
  sourceSummary: string;
  sessionNotes: string;
  conversationSliceJson: string;
  surroundingContextJson: string;
  inputPayloadJson: string;
  outputPayloadJson: string;
}) {
  const renderedPrompt = buildDatasetFieldGenerationPrompt(input);

  return {
    route: "dataset_example_field_generation",
    configurationName: input.configurationName?.trim() || null,
    model: input.model?.trim() || null,
    systemPrompt: null,
    systemPromptApplied: false,
    promptTemplate: input.promptText,
    usedTokens: renderedPrompt.usedTokens,
    unresolvedTokens: renderedPrompt.unresolvedTokens,
    messages: [
      {
        role: "user",
        content: renderedPrompt.promptText,
      },
    ],
  } satisfies JsonValue;
}
