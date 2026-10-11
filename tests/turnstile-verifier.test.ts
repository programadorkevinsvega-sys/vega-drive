import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareTurnstileVerifier } from "../src/modules/identity/infrastructure/turnstile/cloudflare-turnstile-verifier.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cloudflare Turnstile verifier", () => {
  it("posts the token and secret to Siteverify and validates action and hostname", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            success: true,
            action: "register",
            hostname: "vega-drive.test",
          }),
          {
            status: 200,
            headers: { "cf-ray": "aabbcc-MIA" },
          },
        ),
    );
    const verifier = new CloudflareTurnstileVerifier(
      "test-secret",
      ["vega-drive.test"],
      fetcher,
    );
    await expect(
      verifier.verify("captcha-token", "register", "203.0.113.10"),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    const [, init] = fetcher.mock.calls[0]!;
    expect(init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("captcha-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
    expect(JSON.stringify(info.mock.calls)).toContain("aabbcc-MIA");
  });

  it("fails closed for missing configuration, HTTP failures, invalid results and network errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const unusedFetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            action: "register",
            hostname: "vega-drive.test",
          }),
          { status: 200 },
        ),
    );
    await expect(
      new CloudflareTurnstileVerifier(
        "",
        ["vega-drive.test"],
        unusedFetcher,
      ).verify("token", "register"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        ["vega-drive.test"],
        unusedFetcher,
      ).verify("", "register"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        ["vega-drive.test"],
        async () => new Response("unavailable", { status: 503 }),
      ).verify("token", "register"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        ["vega-drive.test"],
        async () =>
          new Response(JSON.stringify({ success: false }), { status: 200 }),
      ).verify("token", "register"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        ["vega-drive.test"],
        async () => {
          throw new Error("network");
        },
      ).verify("token", "register"),
    ).resolves.toBe(false);
    await expect(
      new CloudflareTurnstileVerifier("secret", [], unusedFetcher).verify(
        "token",
        "register",
      ),
    ).resolves.toBe(false);
    expect(unusedFetcher).not.toHaveBeenCalled();
  });

  it("logs allowlisted Siteverify error codes without exposing secrets or tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verifier = new CloudflareTurnstileVerifier(
      "sensitive-secret",
      ["vega-drive.test"],
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

    await expect(
      verifier.verify("sensitive-token-value", "register"),
    ).resolves.toBe(false);

    const diagnostic = JSON.stringify(warn.mock.calls);
    expect(diagnostic).toContain("invalid-input-secret");
    expect(diagnostic).toContain("timeout-or-duplicate");
    expect(diagnostic).not.toContain("sensitive-secret");
    expect(diagnostic).not.toContain("sensitive-token-value");
  });

  it("logs HTTP status and Cloudflare Ray ID but not an unsafe response body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verifier = new CloudflareTurnstileVerifier(
      "secret-never-log",
      ["vega-drive.test"],
      async () =>
        new Response(
          JSON.stringify({
            "error-codes": ["invalid-input-secret", "secret-never-log"],
            detail: "token-never-log",
          }),
          {
            status: 403,
            headers: {
              "cf-ray": "fedcba-MIA",
              "content-type": "application/json",
            },
          },
        ),
    );

    await expect(verifier.verify("token-never-log", "register")).resolves.toBe(
      false,
    );

    const diagnostic = JSON.stringify(warn.mock.calls);
    expect(diagnostic).toContain("Siteverify HTTP failure");
    expect(diagnostic).toContain("403");
    expect(diagnostic).toContain("fedcba-MIA");
    expect(diagnostic).toContain("invalid-input-secret");
    expect(diagnostic).not.toContain("secret-never-log");
    expect(diagnostic).not.toContain("token-never-log");
  });

  it("logs sanitized network exception messages and the failing stage", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const networkError = new TypeError(
      "fetch failed for secret-never-log and token-never-log",
    );
    const networkCause = Object.assign(
      new Error(
        "private network detail with secret-never-log and token-never-log",
      ),
      { code: "UND_ERR_CONNECT_TIMEOUT" },
    );
    Object.defineProperty(networkError, "cause", {
      value: networkCause,
      configurable: true,
    });

    const verifier = new CloudflareTurnstileVerifier(
      "secret-never-log",
      ["vega-drive.test"],
      async () => {
        throw networkError;
      },
    );

    await expect(
      verifier.verify("token-never-log", "register", "203.0.113.10"),
    ).resolves.toBe(false);

    const diagnostic = JSON.stringify(warn.mock.calls);
    expect(diagnostic).toContain("Siteverify exception");
    expect(diagnostic).toContain("siteverify-fetch");
    expect(diagnostic).toContain("UND_ERR_CONNECT_TIMEOUT");
    expect(diagnostic).toContain("fetch failed for [redacted] and [redacted]");
    expect(diagnostic).toContain(
      "private network detail with [redacted] and [redacted]",
    );
    expect(diagnostic).not.toContain("secret-never-log");
    expect(diagnostic).not.toContain("token-never-log");
    expect(diagnostic).not.toContain("203.0.113.10");
  });

  it("reports invalid JSON responses with HTTP and Cloudflare metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verifier = new CloudflareTurnstileVerifier(
      "secret",
      ["vega-drive.test"],
      async () =>
        new Response("not-json", {
          status: 200,
          headers: { "cf-ray": "badjson-MIA" },
        }),
    );

    await expect(verifier.verify("token", "register")).resolves.toBe(false);

    const diagnostic = JSON.stringify(warn.mock.calls);
    expect(diagnostic).toContain("Siteverify returned invalid JSON");
    expect(diagnostic).toContain("200");
    expect(diagnostic).toContain("badjson-MIA");
  });

  it("rejects a successful Siteverify response with the wrong hostname or action", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrongHostname = new CloudflareTurnstileVerifier(
      "secret",
      ["vega-drive.test"],
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            action: "register",
            hostname: "attacker.example",
          }),
          { status: 200 },
        ),
    );
    const wrongAction = new CloudflareTurnstileVerifier(
      "secret",
      ["vega-drive.test"],
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            action: "login",
            hostname: "vega-drive.test",
          }),
          { status: 200 },
        ),
    );

    await expect(wrongHostname.verify("token", "register")).resolves.toBe(
      false,
    );
    await expect(wrongAction.verify("token", "register")).resolves.toBe(false);
  });

  it("rejects oversized tokens before making a request", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            action: "register",
            hostname: "vega-drive.test",
          }),
          { status: 200 },
        ),
    );
    await expect(
      new CloudflareTurnstileVerifier(
        "secret",
        ["vega-drive.test"],
        fetcher,
      ).verify("x".repeat(2049), "register"),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
