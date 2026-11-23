import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "./security-headers.js";

describe("cabeceras de seguridad para documentos privados", () => {
  it("permite incrustar documentos solo desde el mismo origen", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain(
      "frame-ancestors 'self'",
    );
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain(
      "object-src 'none'",
    );
  });

  it("autoriza exclusivamente los recursos necesarios para la aplicación y Turnstile", () => {
    const policy = SECURITY_HEADERS["Content-Security-Policy"];
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(policy).toContain("connect-src 'self' https://challenges.cloudflare.com");
    expect(policy).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(policy).toContain("form-action 'self'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/(?:^|\\s)https:(?:\\s|;)/);
  });

  it("desactiva capacidades del navegador que Vega Drive no utiliza", () => {
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("microphone=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("geolocation=()");
    expect(SECURITY_HEADERS["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(SECURITY_HEADERS["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(SECURITY_HEADERS["X-DNS-Prefetch-Control"]).toBe("off");
  });

  it("mantiene la protección contra MIME sniffing y el transporte HTTPS", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("max-age=");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});
