export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
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

export function getChatRuntimeConfiguration() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const compatibleMode = isOpenAICompatibleModeEnabled();
  const baseUrl = compatibleMode ? getConfiguredOpenAIBaseUrl() : null;
  const providerLabel = compatibleMode ? "OpenAI-compatible" : "OpenAI";
  const disabledReason = compatibleMode && !baseUrl
      ? "Define OPENAI_BASE_URL para usar un backend OpenAI-compatible."
    : !compatibleMode && !apiKey
      ? "Define OPENAI_API_KEY para habilitar el chat con OpenAI."
      : null;

  return {
    enabled: disabledReason === null,
    disabledReason,
    providerLabel,
    compatibleMode,
    apiKey: apiKey || null,
    baseUrl,
    resolvedBaseUrl: compatibleMode ? baseUrl : DEFAULT_OPENAI_BASE_URL,
  };
}

function buildApiUrl(pathname: string) {
  const configuration = getChatRuntimeConfiguration();

  if (!configuration.enabled) {
    throw new Error(configuration.disabledReason ?? "OpenAI runtime is not configured.");
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${configuration.resolvedBaseUrl}${normalizedPath}`;
}

function buildRequestHeaders() {
  const configuration = getChatRuntimeConfiguration();
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (configuration.apiKey) {
    headers.set("Authorization", `Bearer ${configuration.apiKey}`);
  }

  return headers;
}

async function parseApiResponse(response: Response) {
  const responseText = await response.text();
  const responseJson = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : null;

  if (!response.ok) {
    const errorMessage =
      responseJson &&
      typeof responseJson === "object" &&
      "error" in responseJson &&
      responseJson.error &&
      typeof responseJson.error === "object" &&
      "message" in responseJson.error &&
      typeof responseJson.error.message === "string"
        ? responseJson.error.message
        : `HTTP ${response.status} ${response.statusText}`;

    throw new Error(errorMessage);
  }

  return responseJson;
}

async function fetchOpenAIJson(pathname: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(pathname), {
    ...init,
    headers: buildRequestHeaders(),
    cache: "no-store",
  });

  return parseApiResponse(response);
}

function normalizeModel(value: string) {
  return value.trim();
}

export async function testChatConnection(input: { model: string }) {
  const model = normalizeModel(input.model);

  if (!model) {
    throw new Error("Define un modelo antes de probar la conexión.");
  }

  const responseJson = await fetchOpenAIJson("/models", {
    method: "GET",
  });

  const listedModels =
    responseJson &&
    typeof responseJson === "object" &&
    "data" in responseJson &&
    Array.isArray(responseJson.data)
      ? responseJson.data
          .reduce<string[]>((accumulator, item) => {
            if (
              item &&
              typeof item === "object" &&
              "id" in item &&
              typeof item.id === "string"
            ) {
              accumulator.push(item.id);
            }

            return accumulator;
          }, [])
      : [];

  if (listedModels.length > 0 && !listedModels.includes(model)) {
    throw new Error(
      `La conexión respondió, pero el modelo \"${model}\" no aparece en /models.`,
    );
  }

  return {
    ok: true as const,
    model,
    listedModels,
  };
}

export async function generateAssistantReply(input: {
  messages: ConversationMessage[];
  systemPrompt?: string | null;
  model: string;
}) {
  const model = normalizeModel(input.model);

  if (!model) {
    throw new Error("Define un modelo antes de enviar mensajes al chat.");
  }

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

  const response = (await fetchOpenAIJson("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      messages: requestMessages,
    }),
  })) as {
    id?: string;
    model?: string;
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = response.choices?.[0]?.message?.content;
  const contentParts = Array.isArray(content) ? content : null;
  const text =
    typeof content === "string"
      ? content.trim()
      : contentParts
        ? contentParts
            .reduce<string[]>((parts, part) => {
              if (part?.type === "text" && typeof part.text === "string") {
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
    model: response.model || model,
    responseId: response.id || null,
  };
}