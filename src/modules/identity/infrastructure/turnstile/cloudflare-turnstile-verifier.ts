import type {
  TurnstileAction,
  TurnstileVerifier,
} from "../../application/registration/register-user.types.js";

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

const SAFE_SITEVERIFY_ERROR_CODES = new Set([
  "missing-input-secret",
  "invalid-input-secret",
  "missing-input-response",
  "invalid-input-response",
  "bad-request",
  "timeout-or-duplicate",
  "internal-error",
]);

const SAFE_NETWORK_CAUSE_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "ERR_NETWORK",
  "ERR_ABORTED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_SSL_PROTOCOL_ERROR",
]);

function safeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (code): code is string =>
      typeof code === "string" && SAFE_SITEVERIFY_ERROR_CODES.has(code),
  );
}

function safeErrorName(value: unknown): string {
  return typeof value === "string" &&
    /^[A-Za-z][A-Za-z0-9_.-]{0,39}$/.test(value)
    ? value
    : "unknown";
}

function safeCloudflareRayId(value: string | null): string | null {
  return value && /^[A-Za-z0-9-]{1,100}$/.test(value) ? value : null;
}

function responseDiagnostics(response: Response, startedAt: number) {
  return {
    status: response.status,
    durationMs: Math.max(0, Date.now() - startedAt),
    contentType:
      (response.headers.get("content-type") ?? "").slice(0, 100) || null,
    cloudflareRayId: safeCloudflareRayId(response.headers.get("cf-ray")),
  };
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  private readonly expectedHostnames: ReadonlySet<string>;

  constructor(
    private readonly secretKey: string,
    expectedHostnames: readonly string[],
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.expectedHostnames = new Set(
      expectedHostnames
        .map((hostname) => hostname.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async verify(
    token: string,
    expectedAction: TurnstileAction,
    clientIp?: string | null,
  ): Promise<boolean> {
    if (
      !this.secretKey ||
      !token ||
      token.length > 2048 ||
      !expectedAction ||
      this.expectedHostnames.size === 0
    ) {
      console.warn("[turnstile] Siteverify skipped", {
        reason: !this.secretKey
          ? "missing-secret"
          : !token
            ? "missing-token"
            : token.length > 2048
              ? "token-too-large"
              : !expectedAction
                ? "missing-action"
                : "missing-hostname-allowlist",
        expectedAction: expectedAction || null,
      });
      return false;
    }

    const startedAt = Date.now();
    let stage = "prepare-request";
    let response: Response | null = null;
    let cloudflareRayId: string | null = null;

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });
      if (clientIp) params.set("remoteip", clientIp);

      const signal = AbortSignal.timeout(10_000);
      stage = "siteverify-fetch";
      response = await this.fetcher(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
          signal,
        },
      );

      cloudflareRayId = safeCloudflareRayId(response.headers.get("cf-ray"));

      if (!response.ok) {
        let errorCodes: string[] = [];
        try {
          const payload: unknown = await response.json();
          if (
            payload &&
            typeof payload === "object" &&
            !Array.isArray(payload)
          ) {
            errorCodes = safeErrorCodes(
              (payload as SiteverifyResponse)["error-codes"],
            );
          }
        } catch {
          // HTTP status and headers remain useful when the body is not JSON.
        }
        console.warn("[turnstile] Siteverify HTTP failure", {
          ...responseDiagnostics(response, startedAt),
          expectedAction,
          errorCodes,
        });
        return false;
      }

      stage = "siteverify-response-json";
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        console.warn("[turnstile] Siteverify returned invalid JSON", {
          ...responseDiagnostics(response, startedAt),
          expectedAction,
        });
        return false;
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        console.warn("[turnstile] Siteverify returned malformed response", {
          ...responseDiagnostics(response, startedAt),
          expectedAction,
        });
        return false;
      }

      const result = payload as SiteverifyResponse;
      if (result.success !== true) {
        console.warn("[turnstile] Siteverify rejected token", {
          ...responseDiagnostics(response, startedAt),
          expectedAction,
          errorCodes: safeErrorCodes(result["error-codes"]),
        });
        return false;
      }

      const hostname =
        typeof result.hostname === "string"
          ? result.hostname.toLowerCase()
          : "";
      if (!this.expectedHostnames.has(hostname)) {
        console.warn("[turnstile] Siteverify hostname mismatch", {
          ...responseDiagnostics(response, startedAt),
          hostname: hostname || null,
          expectedHostnames: [...this.expectedHostnames],
          expectedAction,
          action:
            typeof result.action === "string"
              ? result.action.slice(0, 32)
              : null,
        });
        return false;
      }

      if (result.action !== expectedAction) {
        console.warn("[turnstile] Siteverify action mismatch", {
          ...responseDiagnostics(response, startedAt),
          hostname,
          action:
            typeof result.action === "string"
              ? result.action.slice(0, 32)
              : null,
          expectedAction,
        });
        return false;
      }

      console.info("[turnstile] Siteverify accepted token", {
        ...diagnostics,
        hostname,
        action: expectedAction,
      });
      return true;
    } catch (error) {
      const failure = error instanceof Error ? error : null;
      const cause =
        failure?.cause && typeof failure.cause === "object"
          ? (failure.cause as { name?: unknown; code?: unknown })
          : null;
      const rawCauseCode =
        typeof cause?.code === "string" &&
        SAFE_NETWORK_CAUSE_CODES.has(cause.code)
          ? cause.code
          : "unavailable";

      console.warn("[turnstile] Siteverify exception", {
        stage,
        errorName: safeErrorName(failure?.name),
        causeName: safeErrorName(cause?.name),
        causeCode: rawCauseCode,
        status: response?.status ?? null,
        durationMs: Math.max(0, Date.now() - startedAt),
        cloudflareRayId,
        expectedAction,
      });
      return false;
    }
  }
}
