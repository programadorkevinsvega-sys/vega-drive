export interface AuthenticatedUser {
  email: string;
}
export interface AuthConfig {
  turnstileSiteKey: string;
  ready: boolean;
}
export type SessionState =
  { authenticated: true; user: AuthenticatedUser } | { authenticated: false };

export class IdentityApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "IdentityApiError";
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new IdentityApiError(
      "No se pudo conectar con Vega Drive. Comprueba tu conexión e inténtalo de nuevo.",
      0,
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "La solicitud no pudo completarse.";
    throw new IdentityApiError(message, response.status);
  }
  if (!payload || typeof payload !== "object") {
    throw new IdentityApiError(
      "El servidor devolvió una respuesta inválida.",
      response.status,
    );
  }
  return payload as T;
}

export function getAuthConfig(): Promise<AuthConfig> {
  return requestJson<AuthConfig>("/api/auth/config");
}
export function getSession(): Promise<SessionState> {
  return requestJson<SessionState>("/api/auth/session");
}
export async function login(
  email: string,
  password: string,
  turnstileToken: string,
): Promise<AuthenticatedUser> {
  const response = await requestJson<{ ok: true; user: AuthenticatedUser }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password, turnstileToken }),
    },
  );
  return response.user;
}
export function register(
  email: string,
  password: string,
  turnstileToken: string,
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, turnstileToken }),
  });
}
export function logout(): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
