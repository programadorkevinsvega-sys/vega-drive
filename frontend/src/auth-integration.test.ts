import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("integración de identidad en la interfaz", () => {
  it("monta el estado de sesión real en la raíz de React", () => {
    const app = read("./App.tsx");
    expect(app).toContain("<AuthProvider>");
    expect(app).toContain("useAuth()");
    expect(app).toContain('navigate({ name: "login" })');
  });
  it("renderiza Turnstile y envía el token en login y registro", () => {
    const auth = read("./screens/AuthLayout.tsx");
    const widget = read("./services/TurnstileWidget.tsx");
    const api = read("./services/identity-service.ts");
    expect(auth).toContain("<TurnstileWidget");
    expect(auth).toContain("submittedToken");
    expect(widget).toContain(
      "https://challenges.cloudflare.com/turnstile/v0/api.js",
    );
    expect(api).toContain('"/api/auth/login"');
    expect(api).toContain('"/api/auth/register"');
    expect(api).toContain("turnstileToken");
  });
  it("permite Turnstile en CSP sin relajar las restricciones base", () => {
    const headers = read("../public/_headers");
    expect(headers).toContain(
      "script-src 'self' https://challenges.cloudflare.com",
    );
    expect(headers).toContain("frame-src https://challenges.cloudflare.com");
    expect(headers).toContain(
      "connect-src 'self' https://challenges.cloudflare.com",
    );
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("frame-ancestors 'none'");
  });
});
