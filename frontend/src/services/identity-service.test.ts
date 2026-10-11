import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthConfig,
  getSession,
  IdentityApiError,
  login,
  logout,
  register,
} from "./identity-service";
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cliente HTTP de identidad", () => {
  it("lee la configuración pública de Turnstile", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ turnstileSiteKey: "public-site-key", ready: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAuthConfig()).resolves.toEqual({
      turnstileSiteKey: "public-site-key",
      ready: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/config",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });
  it("envía login al endpoint real y deja la cookie bajo control del navegador", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, user: { email: "person@example.test" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      login("person@example.test", "a secure password", "turnstile-token"),
    ).resolves.toEqual({ email: "person@example.test" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          email: "person@example.test",
          password: "a secure password",
          turnstileToken: "turnstile-token",
        }),
      }),
    );
  });
  it("conecta registro y logout con sus rutas y estados HTTP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      register("person@example.test", "a secure password", "token"),
    ).resolves.toEqual({ ok: true });
    await expect(logout()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/register",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });
  it("conserva el estado HTTP en los errores del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Credenciales inválidas" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(
      login("person@example.test", "incorrect password", "token"),
    ).rejects.toMatchObject<Partial<IdentityApiError>>({
      name: "IdentityApiError",
      message: "Credenciales inválidas",
      status: 401,
    });
  });
  it("consulta la sesión con credenciales same-origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSession()).resolves.toEqual({ authenticated: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
