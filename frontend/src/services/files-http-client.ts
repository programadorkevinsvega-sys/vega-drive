import { FilesApiError, messageForStatus } from "./files-api-error";

/** Cliente HTTP same-origin; nunca expone detalles internos del servidor. */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body && !(init.body instanceof File)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new FilesApiError(messageForStatus(0), 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new FilesApiError(messageForStatus(response.status), response.status);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new FilesApiError(
      "El servidor devolvió una respuesta inválida.",
      response.status,
    );
  }
  return payload as T;
}

export function queryString(
  values: Record<string, string | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? "?" + serialized : "";
}

export function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  return requestJson<T>(path, { method, body: JSON.stringify(body) });
}

export function sendNoBody<T>(path: string, method: string): Promise<T> {
  return requestJson<T>(path, { method });
}

