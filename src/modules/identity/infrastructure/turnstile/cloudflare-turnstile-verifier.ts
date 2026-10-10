import type { TurnstileVerifier } from "../../application/registration/register-user.types.js";

interface SiteverifyResponse {
  success?: boolean;
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async verify(token: string, clientIp?: string | null): Promise<boolean> {
    if (!this.secretKey || !token || token.length > 2048) return false;
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
      if (!response.ok) return false;
      return ((await response.json()) as SiteverifyResponse).success === true;
    } catch {
      return false;
    }
  }
}
