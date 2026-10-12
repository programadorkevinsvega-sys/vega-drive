import { createFolder } from "./files-service";

export function getRelativeDirectories(file: File): string[] {
  const path = file.webkitRelativePath;
  if (!path) return [];
  return path
    .split("/")
    .filter(Boolean)
    .slice(0, -1)
    .filter((part) => part !== "." && part !== "..");
}

export function createFolderResolver(rootFolderId: string | null) {
  const cache = new Map<string, string>();

  return async function resolveFolder(
    file: File,
    preservePath: boolean,
  ): Promise<string | null> {
    const parts = preservePath ? getRelativeDirectories(file) : [];
    let parentId = rootFolderId;
    const pathParts: string[] = [];

    for (const name of parts) {
      pathParts.push(name);
      const key = (parentId ?? "root") + "/" + pathParts.join("/");
      let folderId = cache.get(key);
      if (!folderId) {
        folderId = (await createFolder(name, parentId)).id;
        cache.set(key, folderId);
      }
      parentId = folderId;
    }
    return parentId;
  };
}
