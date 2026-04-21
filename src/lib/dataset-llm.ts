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
  lastUserMessage: true,
  sourceSummary: true,
  sessionNotes: true,
  conversationSlice: true,
  surroundingContext: true,
  inputPayload: true,
  outputPayload: true,
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
  llmContextSelection?: JsonValue | Partial<DatasetLlmContextSelection> | null;
}) {
  const enumHint = input.field.enumValues?.length
    ? `Valores permitidos: ${input.field.enumValues.join(", ")}.`
    : "";
  const selection = normalizeDatasetLlmContextSelection(input.llmContextSelection);

  return [
    "Genera el valor de un unico campo para un dataset example de DSPy.",
    `Spec: ${input.datasetSpecName || input.datasetSpecSlug || "dataset_spec"}.`,
    input.datasetSpecDescription ? `Descripcion del spec: ${input.datasetSpecDescription}` : "",
    `Campo destino: ${input.field.key}.`,
    `Lado: ${input.side}.`,
    `Tipo esperado: ${input.field.type}.`,
    `Requerido: ${input.field.required ? "si" : "no"}.`,
    input.field.description ? `Descripcion del campo: ${input.field.description}` : "",
    enumHint,
    "Devuelve SOLO JSON valido, sin markdown ni texto extra.",
    'Usa exactamente esta forma: {"value": ..., "confidence": 0.0, "notes": "..."}.',
    "El contenido de value debe respetar el tipo esperado del campo.",
    "Si el valor debe salir de la conversacion o del contexto, sintetizalo de forma util para entrenamiento, no copies ruido innecesario.",
    `Instruccion del operador: ${input.promptText}`,
    selection.lastUserMessage ? `Ultimo mensaje del usuario: ${input.lastUserMessage || ""}` : "",
    selection.sourceSummary ? `Resumen curatorial: ${input.sourceSummary || ""}` : "",
    selection.sessionNotes ? `Notas de sesion: ${input.sessionNotes || ""}` : "",
    selection.conversationSlice ? "Transcript seleccionado:" : "",
    selection.conversationSlice ? input.conversationSliceJson : "",
    selection.surroundingContext ? "Contexto cercano:" : "",
    selection.surroundingContext ? input.surroundingContextJson : "",
    selection.inputPayload ? "Payload input actual:" : "",
    selection.inputPayload ? input.inputPayloadJson : "",
    selection.outputPayload ? "Payload output actual:" : "",
    selection.outputPayload ? input.outputPayloadJson : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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
  llmContextSelection?: JsonValue | Partial<DatasetLlmContextSelection> | null;
}) {
  const llmContextSelection = normalizeDatasetLlmContextSelection(input.llmContextSelection);
  const userPrompt = buildDatasetFieldGenerationPrompt(input);

  return {
    route: "dataset_example_field_generation",
    configurationName: input.configurationName?.trim() || null,
    model: input.model?.trim() || null,
    systemPrompt: null,
    systemPromptApplied: false,
    llmContextSelection,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  } satisfies JsonValue;
}
