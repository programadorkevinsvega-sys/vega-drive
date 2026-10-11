import type { TurnstileVerifier } from "../../application/registration/register-user.types.js";

interface SiteverifyResponse {
  success?: boolean;
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

function safeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (code): code is string =>
      typeof code === "string" && SAFE_SITEVERIFY_ERROR_CODES.has(code),
  );
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async verify(token: string, clientIp?: string | null): Promise<boolean> {
    if (!this.secretKey || !token || token.length > 2048) {
      console.warn("[turnstile] Siteverify skipped", {
        reason: !this.secretKey
          ? "missing-secret"
          : "missing-or-oversized-token",
      });
      return false;
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });
      if (clientIp) params.set("remoteip", clientIp);
      const response = await this.fetcher(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        },
      );

      if (!response.ok) {
        console.warn("[turnstile] Siteverify HTTP failure", {
          status: response.status,
        });
        return false;
      }

      let result: SiteverifyResponse;
      try {
        result = (await response.json()) as SiteverifyResponse;
      } catch {
        console.warn("[turnstile] Siteverify returned invalid JSON");
        return false;
      }

      if (result.success !== true) {
        console.warn("[turnstile] Siteverify rejected token", {
          errorCodes: safeErrorCodes(result["error-codes"]),
        });
        return false;
      }
      return true;
    } catch {
      // Do not log exception messages: they can contain request details.
      console.warn("[turnstile] Siteverify network failure");
      return false;
    }
  }
}
