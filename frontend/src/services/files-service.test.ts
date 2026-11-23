import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFolder,
  deleteFile,
  FilesApiError,
  listFolder,
  listTrash,
  moveFolder,
  restoreFile,
} from "./files-service";

afterEach(() => vi.unstubAllGlobals());

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("cliente HTTP del catálogo de archivos", () => {
  it("consulta la raíz del servidor sin filtros de propiedad del navegador", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        folder: null,
        breadcrumbs: [{ id: null, name: "Mi unidad" }],
        folders: [],
        files: [],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listFolder(null)).resolves.toMatchObject({
      folder: null,
      folders: [],
      files: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files?limit=50",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("ownerId");
  });

  it("envía la carpeta y el cursor como parámetros codificados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ folders: [], files: [] })),
    );
    await listFolder("folder-123", "opaque cursor");
    expect(fetch).toHaveBeenCalledWith(
      "/api/files?folderId=folder-123&limit=50&cursor=opaque+cursor",
      expect.any(Object),
    );
  });

  it("lista la papelera desde el endpoint real", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ nodes: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listTrash()).resolves.toEqual({
      nodes: [],
      nextCursor: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files/trash?limit=50",
      expect.any(Object),
    );
  });

  it("crea carpetas con solo el nombre y el padre elegido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ type: "folder", id: "f1", name: "Docs" }, 201),
      );
    vi.stubGlobal("fetch", fetchMock);
    await createFolder("Docs", null);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files/folders",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ name: "Docs", parentFolderId: null }),
      }),
    );
  });

  it("codifica identificadores y envía movimientos al BFF", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ type: "folder", id: "a/b", name: "Docs" }));
    vi.stubGlobal("fetch", fetchMock);
    await moveFolder("a/b", "destination");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files/folders/a%2Fb/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ parentFolderId: "destination" }),
      }),
    );
  });

  it("elimina sin body y restaura a través de las rutas de papelera", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(
        response({ type: "file", id: "f1", name: "a.txt" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await deleteFile("f1");
    await restoreFile("f1");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/files/items/f1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/files/trash/items/f1/restore",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty("body");
  });

  it("lista, agrega y quita favoritos usando endpoints autenticados same-origin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response({ favorited: true }))
      .mockResolvedValueOnce(response({ favorited: false }));
    vi.stubGlobal("fetch", fetchMock);
    const { listFavorites, addFavorite, removeFavorite } =
      await import("./files-service");
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

  it("traduce los errores HTTP a mensajes públicos genéricos", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(response({ error: "PRIVATE SQL DETAILS" }, 409)),
    );
    const error = await createFolder("Duplicada", null).then(
      () => null,
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(FilesApiError);
    if (!(error instanceof FilesApiError)) {
      throw new Error("Se esperaba un error HTTP de catálogo.");
    }
    expect(error).toMatchObject({
      status: 409,
      message:
        "Ya existe un elemento con ese nombre o el movimiento no es válido.",
    });
    expect(error.message).not.toContain("PRIVATE SQL DETAILS");
  });

  it("traduce los fallos de red sin filtrar excepciones", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private")));
    await expect(listTrash()).rejects.toMatchObject<Partial<FilesApiError>>({
      name: "FilesApiError",
      status: 0,
      message: expect.stringContaining("No se pudo conectar"),
    });
  });
});
