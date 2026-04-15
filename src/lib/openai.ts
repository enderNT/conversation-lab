import OpenAI from "openai";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

function readBooleanEnv(value: string | undefined) {
  if (!value) {
    return false;
  }

  return TRUE_ENV_VALUES.has(value.trim().toLowerCase());
}

export function isOpenAICompatibleModeEnabled() {
  return readBooleanEnv(process.env.OPENAI_COMPATIBLE);
}

export function getConfiguredOpenAIBaseUrl() {
  const baseUrl = process.env.OPENAI_BASE_URL?.trim();

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, "");
}

function getOpenAIClient() {
  const configuration = getChatRuntimeConfiguration();

  if (!configuration.enabled || !configuration.apiKey) {
    throw new Error(configuration.disabledReason ?? "OpenAI runtime is not configured.");
  }

  return new OpenAI({
    apiKey: configuration.apiKey,
    ...(configuration.baseUrl ? { baseURL: configuration.baseUrl } : {}),
  });
}

export function getConfiguredOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function getChatRuntimeConfiguration() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const compatibleMode = isOpenAICompatibleModeEnabled();
  const baseUrl = compatibleMode ? getConfiguredOpenAIBaseUrl() : null;
  const providerLabel = compatibleMode ? "OpenAI-compatible" : "OpenAI";
  const disabledReason = !apiKey
    ? compatibleMode
      ? "Define OPENAI_API_KEY para autenticar el backend OpenAI-compatible."
      : "Define OPENAI_API_KEY para habilitar el chat con OpenAI."
    : compatibleMode && !baseUrl
      ? "Define OPENAI_BASE_URL para usar un backend OpenAI-compatible."
      : null;

  return {
    enabled: disabledReason === null,
    disabledReason,
    providerLabel,
    compatibleMode,
    apiKey: apiKey || null,
    baseUrl,
    model: getConfiguredOpenAIModel(),
  };
}

export async function generateAssistantReply(input: {
  messages: ConversationMessage[];
  systemPrompt?: string | null;
}) {
  const requestMessages = input.systemPrompt?.trim()
    ? [
        {
          role: "system" as const,
          content: input.systemPrompt.trim(),
        },
        ...input.messages.map((message) => ({
          role: message.role,
          content: message.text,
        })),
      ]
    : input.messages.map((message) => ({
        role: message.role,
        content: message.text,
      }));

  const response = await getOpenAIClient().chat.completions.create({
    model: getConfiguredOpenAIModel(),
    messages: requestMessages,
  });

  const content = response.choices[0]?.message?.content;
  const contentParts = Array.isArray(content) ? (content as unknown[]) : null;
  const text =
    typeof content === "string"
      ? content.trim()
      : contentParts
        ? contentParts
            .reduce<string[]>((parts, part) => {
              if (
                part &&
                typeof part === "object" &&
                "type" in part &&
                part.type === "text" &&
                "text" in part &&
                typeof part.text === "string"
              ) {
                parts.push(part.text);
              }

              return parts;
            }, [])
            .join("\n")
            .trim()
        : "";

  if (!text) {
    throw new Error("The configured model returned an empty response.");
  }

  return {
    text,
    model: response.model,
    responseId: response.id,
  };
}