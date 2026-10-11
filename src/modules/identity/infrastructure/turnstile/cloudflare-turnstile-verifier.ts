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

function safeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (code): code is string =>
      typeof code === "string" && SAFE_SITEVERIFY_ERROR_CODES.has(code),
  );
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
          signal: AbortSignal.timeout(10_000),
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

      const hostname =
        typeof result.hostname === "string"
          ? result.hostname.toLowerCase()
          : "";
      if (!this.expectedHostnames.has(hostname)) {
        console.warn("[turnstile] Siteverify hostname mismatch", {
          hostname: hostname || null,
          expectedHostnames: [...this.expectedHostnames],
        });
        return false;
      }

      if (result.action !== expectedAction) {
        console.warn("[turnstile] Siteverify action mismatch", {
          action:
            typeof result.action === "string"
              ? result.action.slice(0, 32)
              : null,
          expectedAction,
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
