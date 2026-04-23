import type { ChatRequestStatus, ChatTransport, Prisma } from "@prisma/client";
import { getChatRuntimeConfiguration } from "@/lib/openai";

export type SessionChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type WebhookAckResponse = {
  integrationRequestId: string | null;
  responsePayloadJson: Prisma.JsonValue | null;
};

type ChatRuntimeConfiguration = {
  enabled: boolean;
  disabledReason: string | null;
  providerLabel: string;
  resolvedBaseUrl: string | null;
  transport: ChatTransport;
  requiresConnectionVerification: boolean;
};

const WEBHOOK_PROVIDER_LABEL = "Webhook async";

function normalizeHttpUrl(value: string | null | undefined, emptyMessage: string, invalidMessage: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error(emptyMessage);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error(invalidMessage);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(invalidMessage);
  }

  parsedUrl.hash = "";
  parsedUrl.search = "";

  return parsedUrl.toString().replace(/\/+$/, "");
}

function safeNormalize(
  value: string | null | undefined,
  emptyMessage: string,
  invalidMessage: string,
) {
  try {
    return {
      value: normalizeHttpUrl(value, emptyMessage, invalidMessage),
      error: null as string | null,
    };
  } catch (error) {
    return {
      value: null,
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : invalidMessage,
    };
  }
}

export function normalizeWebhookUrl(value: string | null | undefined) {
  return normalizeHttpUrl(
    value,
    "Define la URL del webhook de la integración.",
    "La URL del webhook debe ser http o https y debe ser válida.",
  );
}

export function normalizeAppBaseUrl(value: string | null | undefined) {
  return normalizeHttpUrl(
    value,
    "Define APP_BASE_URL para construir la URL de callback.",
    "APP_BASE_URL debe ser http o https y debe ser válida.",
  );
}

export function getSessionChatRuntimeConfiguration(input: {
  transport: ChatTransport;
  baseUrl?: string | null;
  apiKey?: string | null;
}): ChatRuntimeConfiguration {
  if (input.transport === "webhook_async") {
    const webhookUrl = safeNormalize(
      input.baseUrl,
      "Define la URL del webhook de la integración.",
      "La URL del webhook debe ser http o https y debe ser válida.",
    );
    const appBaseUrl = safeNormalize(
      process.env.APP_BASE_URL,
      "Define APP_BASE_URL para construir la URL de callback.",
      "APP_BASE_URL debe ser http o https y debe ser válida.",
    );
    const disabledReason = webhookUrl.error || appBaseUrl.error;

    return {
      enabled: disabledReason === null,
      disabledReason,
      providerLabel: WEBHOOK_PROVIDER_LABEL,
      resolvedBaseUrl: webhookUrl.value,
      transport: input.transport,
      requiresConnectionVerification: false,
    };
  }

  const runtime = getChatRuntimeConfiguration(input.baseUrl, input.apiKey);

  return {
    enabled: runtime.enabled,
    disabledReason: runtime.disabledReason,
    providerLabel: runtime.providerLabel,
    resolvedBaseUrl: runtime.resolvedBaseUrl,
    transport: input.transport,
    requiresConnectionVerification: true,
  };
}

export function getWebhookCallbackUrl() {
  return `${normalizeAppBaseUrl(process.env.APP_BASE_URL)}/api/chat/webhook/callback`;
}

export function getWebhookCallbackSecret() {
  const secret = process.env.CHAT_WEBHOOK_CALLBACK_SECRET?.trim();

  if (!secret) {
    throw new Error("Define CHAT_WEBHOOK_CALLBACK_SECRET para aceptar callbacks del chat.");
  }

  return secret;
}

function extractIntegrationRequestId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidateKeys = ["integrationRequestId", "requestId", "id"];

  for (const key of candidateKeys) {
    if (typeof record[key] === "string" && record[key]!.trim()) {
      return record[key] as string;
    }
  }

  return null;
}

async function parseWebhookAckResponse(response: Response): Promise<WebhookAckResponse> {
  const responseText = await response.text();
  let responsePayloadJson: Prisma.JsonValue | null = null;

  if (responseText) {
    try {
      responsePayloadJson = JSON.parse(responseText) as Prisma.JsonValue;
    } catch {
      responsePayloadJson = { rawText: responseText } satisfies Prisma.JsonObject;
    }
  }

  if (!response.ok) {
    const message =
      responsePayloadJson &&
      typeof responsePayloadJson === "object" &&
      !Array.isArray(responsePayloadJson) &&
      typeof responsePayloadJson.error === "string"
        ? responsePayloadJson.error
        : responseText.trim() || `HTTP ${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  return {
    integrationRequestId: extractIntegrationRequestId(responsePayloadJson),
    responsePayloadJson,
  };
}

export async function sendWebhookAsyncChatRequest(input: {
  integrationId: string;
  webhookUrl: string;
  apiKey?: string | null;
  sessionId: string;
  userMessageId: string;
  chatRequestId: string;
  systemPrompt?: string | null;
  history: SessionChatMessage[];
  message: SessionChatMessage & { id: string };
}) {
  const requestPayload = {
    sessionId: input.sessionId,
    userMessageId: input.userMessageId,
    chatRequestId: input.chatRequestId,
    integration: {
      id: input.integrationId,
      transport: "webhook_async" as const,
    },
    message: input.message,
    history: input.history,
    systemPrompt: input.systemPrompt?.trim() ? input.systemPrompt.trim() : null,
    callbackUrl: getWebhookCallbackUrl(),
  } satisfies Prisma.JsonObject;

  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (input.apiKey?.trim()) {
    headers.set("Authorization", `Bearer ${input.apiKey.trim()}`);
  }

  const response = await fetch(normalizeWebhookUrl(input.webhookUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(requestPayload),
    cache: "no-store",
  });

  const parsedResponse = await parseWebhookAckResponse(response);

  return {
    requestPayload,
    integrationRequestId: parsedResponse.integrationRequestId,
    responsePayloadJson: parsedResponse.responsePayloadJson,
  };
}

export type SerializableChatRequest = {
  id: string;
  sessionId: string;
  userMessageId: string;
  status: ChatRequestStatus;
  transport: ChatTransport;
  integrationRequestId: string | null;
  errorMessage: string | null;
  responseMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export function serializeChatRequest(
  chatRequest:
    | {
        id: string;
        sessionId: string;
        userMessageId: string;
        status: ChatRequestStatus;
        transport: ChatTransport;
        integrationRequestId: string | null;
        errorMessage: string | null;
        responseMessageId: string | null;
        createdAt: Date;
        updatedAt: Date;
        completedAt: Date | null;
      }
    | null
    | undefined,
): SerializableChatRequest | null {
  if (!chatRequest) {
    return null;
  }

  return {
    id: chatRequest.id,
    sessionId: chatRequest.sessionId,
    userMessageId: chatRequest.userMessageId,
    status: chatRequest.status,
    transport: chatRequest.transport,
    integrationRequestId: chatRequest.integrationRequestId,
    errorMessage: chatRequest.errorMessage,
    responseMessageId: chatRequest.responseMessageId,
    createdAt: chatRequest.createdAt.toISOString(),
    updatedAt: chatRequest.updatedAt.toISOString(),
    completedAt: chatRequest.completedAt?.toISOString() ?? null,
  };
}
