import type { TurnstileVerifier } from "../../application/registration/register-user.js";

interface TurnstileSiteverifyResponse {
  success?: boolean;
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async verify(token: string): Promise<boolean> {
    if (!this.secretKey || !token || token.length > 2048) return false;

    try {
      const body = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });
      const response = await this.fetcher(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
      );
      if (!response.ok) return false;
      const result = (await response.json()) as TurnstileSiteverifyResponse;
      return result.success === true;
    } catch {
      return false;
    }
  }
}
