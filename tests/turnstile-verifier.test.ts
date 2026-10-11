import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareTurnstileVerifier } from "../src/modules/identity/infrastructure/turnstile/cloudflare-turnstile-verifier.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cloudflare Turnstile verifier", () => {
  it("posts the token and secret to Siteverify and accepts only success=true", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const verifier = new CloudflareTurnstileVerifier("test-secret", fetcher);
    await expect(
      verifier.verify("captcha-token", "203.0.113.10"),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, init] = fetcher.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("captcha-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  it("fails closed for missing configuration, HTTP failures, invalid results and network errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    await expect(
      new CloudflareTurnstileVerifier("", fetcher).verify("token"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier("secret", fetcher).verify(""),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        async () => new Response("unavailable", { status: 503 }),
      ).verify("token"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        async () =>
          new Response(JSON.stringify({ success: false }), { status: 200 }),
      ).verify("token"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier("secret", async () => {
        throw new Error("network");
      }).verify("token"),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("logs allowlisted Siteverify error codes without exposing secrets or tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verifier = new CloudflareTurnstileVerifier(
      "sensitive-secret",
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            "error-codes": [
              "invalid-input-secret",
              "timeout-or-duplicate",
              "sensitive-token-value",
            ],
          }),
          { status: 200 },
        ),
    );

    await expect(verifier.verify("sensitive-token-value")).resolves.toBe(false);

    const diagnostic = JSON.stringify(warn.mock.calls);
    expect(diagnostic).toContain("invalid-input-secret");
    expect(diagnostic).toContain("timeout-or-duplicate");
    expect(diagnostic).not.toContain("sensitive-secret");
    expect(diagnostic).not.toContain("sensitive-token-value");
  });

  it("rejects oversized tokens before making a request", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    await expect(
      new CloudflareTurnstileVerifier("secret", fetcher).verify(
        "x".repeat(2049),
      ),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
