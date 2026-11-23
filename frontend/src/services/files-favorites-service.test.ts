import { afterEach, describe, expect, it, vi } from "vitest";
import { addFavorite, listFavorites, removeFavorite } from "./files-service";

afterEach(() => vi.unstubAllGlobals());

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("cliente HTTP de Favoritos", () => {
  it("lista, agrega y quita favoritos usando endpoints autenticados same-origin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response({ favorited: true }))
      .mockResolvedValueOnce(response({ favorited: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listFavorites()).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    await addFavorite("file/one");
    await removeFavorite("file/one");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/files/favorites?limit=50",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/files/items/file%2Fone/favorite",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/files/items/file%2Fone/favorite",
      expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
    );
  });
});
