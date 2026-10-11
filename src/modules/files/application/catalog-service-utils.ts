import type {
  FilesFolderRecord,
  FilesFolderRepository,
  FilesItemRepository,
} from "./ports/files-repositories.js";
import { isValidCatalogId } from "../domain/catalog-validation.js";

export async function activeFolderPath(
  folders: FilesFolderRepository,
  ownerId: string,
  folderId: string,
): Promise<FilesFolderRecord[] | null> {
  const path: FilesFolderRecord[] = [];
  const visited = new Set<string>();
  let currentId: string | null = folderId;

  while (currentId !== null) {
    if (visited.has(currentId) || path.length >= 1000) return null;
    visited.add(currentId);
    const folder = await folders.findByIdForOwner(currentId, ownerId);
    if (!folder || folder.deletedAt !== null) return null;
    path.push(folder);
    currentId = folder.parentFolderId;
  }
  return path;
}

export async function activeParentExists(
  folders: FilesFolderRepository,
  ownerId: string,
  parentId: string | null,
): Promise<boolean> {
  if (parentId === null) return true;
  if (!isValidCatalogId(parentId)) return false;
  return (await activeFolderPath(folders, ownerId, parentId)) !== null;
}

export async function nameIsAvailable(
  folders: FilesFolderRepository,
  items: FilesItemRepository,
  ownerId: string,
  parentId: string | null,
  name: string,
  exceptFolderId?: string,
  exceptFileId?: string,
): Promise<boolean> {
  const folderExists = await folders.findActiveByName(
    ownerId,
    parentId,
    name,
    exceptFolderId,
  );
  if (folderExists) return false;
  return !(await items.findActiveByName(ownerId, parentId, name, exceptFileId));
}
