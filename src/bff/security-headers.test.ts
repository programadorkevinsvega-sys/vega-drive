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

  it("mantiene la protección contra MIME sniffing", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });
});
