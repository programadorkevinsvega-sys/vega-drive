import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFolder } = vi.hoisted(() => ({ createFolder: vi.fn() }));
vi.mock("./files-service", () => ({ createFolder }));

import { createFolderResolver, getRelativeDirectories } from "./files-folder-upload";

function directoryFile(name: string, path: string): File {
  const file = new File(["data"], name);
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("subida de carpetas", () => {
  beforeEach(() => createFolder.mockReset());

  it("extrae la ruta de carpetas sin incluir el nombre del archivo", () => {
    expect(
      getRelativeDirectories(directoryFile("foto.png", "amor/bb/foto.png")),
    ).toEqual(["amor", "bb"]);
  });

  it("crea cada carpeta una sola vez y reutiliza la jerarquía", async () => {
    createFolder
      .mockResolvedValueOnce({ id: "amor-id" })
      .mockResolvedValueOnce({ id: "bb-id" });

    const resolveFolder = createFolderResolver(null);
    const first = await resolveFolder(
      directoryFile("uno.txt", "amor/bb/uno.txt"),
      true,
    );
    const second = await resolveFolder(
      directoryFile("dos.txt", "amor/bb/dos.txt"),
      true,
    );

    expect(first).toBe("bb-id");
    expect(second).toBe("bb-id");
    expect(createFolder).toHaveBeenNthCalledWith(1, "amor", null);
    expect(createFolder).toHaveBeenNthCalledWith(2, "bb", "amor-id");
    expect(createFolder).toHaveBeenCalledTimes(2);
  });

  it("sube archivos normales a la carpeta actual sin crear subcarpetas", async () => {
    const resolveFolder = createFolderResolver("current-folder");
    await expect(resolveFolder(new File(["x"], "archivo.txt"), true)).resolves.toBe(
      "current-folder",
    );
    expect(createFolder).not.toHaveBeenCalled();
  });
});
