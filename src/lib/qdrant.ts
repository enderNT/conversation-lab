import type { JsonValue } from "@/lib/types";

function tokenizePath(path: string) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getValueAtPath(value: JsonValue | undefined, path: string): JsonValue | undefined {
  if (!path.trim()) {
    return value;
  }

  return tokenizePath(path).reduce<JsonValue | undefined>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return current[segment];
    }

    return undefined;
  }, value);
}

export function normalizeQdrantBaseUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error("Define una URL valida para Qdrant.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error("Define una URL valida para Qdrant.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("La URL de Qdrant debe usar http o https.");
  }

  parsedUrl.hash = "";
  parsedUrl.search = "";

  return parsedUrl.toString().replace(/\/+$/, "");
}

async function parseQdrantResponse(response: Response) {
  const responseText = await response.text();
  const responseJson = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : null;

  if (!response.ok) {
    const statusError =
      responseJson &&
      typeof responseJson.status === "object" &&
      responseJson.status !== null &&
      "error" in responseJson.status &&
      typeof responseJson.status.error === "string"
        ? responseJson.status.error
        : null;

    throw new Error(statusError || `HTTP ${response.status} ${response.statusText}`);
  }

  return responseJson;
}

export async function queryQdrantTopPoint(input: {
  baseUrl: string;
  apiKey?: string | null;
  collectionName: string;
  queryText: string;
  vectorName?: string | null;
  queryModel?: string | null;
  payloadPath?: string | null;
}) {
  const collectionName = input.collectionName.trim();
  const queryText = input.queryText.trim();

  if (!collectionName) {
    throw new Error("Define una colección de Qdrant.");
  }

  if (!queryText) {
    throw new Error("La consulta RAG no puede estar vacía.");
  }

  const body: Record<string, unknown> = {
    limit: 1,
    with_payload: true,
    query: input.queryModel?.trim()
      ? {
          text: queryText,
          model: input.queryModel.trim(),
        }
      : queryText,
  };

  if (input.vectorName?.trim()) {
    body.using = input.vectorName.trim();
  }

  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (input.apiKey?.trim()) {
    headers.set("api-key", input.apiKey.trim());
  }

  const response = await fetch(
    `${normalizeQdrantBaseUrl(input.baseUrl)}/collections/${encodeURIComponent(collectionName)}/points/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const payload = (await parseQdrantResponse(response)) as {
    result?: {
      points?: Array<{
        id?: string | number;
        score?: number;
        payload?: JsonValue;
      }>;
    };
  };

  const point = payload.result?.points?.[0];

  if (!point) {
    return {
      point: null,
      value: undefined,
    };
  }

  const extractedValue = getValueAtPath(point.payload, input.payloadPath?.trim() ?? "");

  return {
    point,
    value: extractedValue === undefined ? point.payload : extractedValue,
  };
}
