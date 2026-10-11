import type {
  FilesFolderRecord,
  FilesFolderRepository,
  FilesItemRepository,
} from "./ports/files-repositories.js";
import {
  failure,
  success,
  toFileView,
  toFolderView,
  type CatalogResult,
  type FilesActor,
  type FilesBreadcrumb,
  type FilesFileView,
  type FilesFolderListing,
  type FilesFolderView,
  type FilesTrashListing,
} from "./catalog-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
  parseCatalogLimit,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";
import {
  compareCatalogNodes,
  compareTrashNodes,
  encodeCursor,
  parseFolderCursor,
  parseTrashCursor,
  type ListedNode,
} from "./catalog-pagination.js";

export interface CatalogListingDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
}

export function createCatalogListing(deps: CatalogListingDependencies) {
  async function listFolder(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFolderListing>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const value = parseSafeRecord(input, ["folderId", "limit", "cursor"]);
    if (!value) return failure("invalid-input");
    const limit = parseCatalogLimit(value.limit);
    const folderId = value.folderId ?? null;
    const cursor = parseFolderCursor(value.cursor);
    if (
      limit === null ||
      (folderId !== null && !isValidCatalogId(folderId)) ||
      cursor === undefined
    ) {
      return failure("invalid-input");
    }
    try {
      let currentFolder: FilesFolderRecord | null = null;
      let breadcrumbs: FilesBreadcrumb[] = [{ id: null, name: "Mi unidad" }];
      if (folderId !== null) {
        const path = await activeFolderPath(
          deps.folders,
          actor.userId,
          folderId,
        );
        if (!path) return failure("not-found");
        currentFolder = path[0] ?? null;
        breadcrumbs = breadcrumbs.concat(
          path
            .slice()
            .reverse()
            .map((folder) => ({ id: folder.id, name: folder.name })),
        );
      }
      const [folders, files] = await Promise.all([
        deps.folders.listChildren(actor.userId, folderId, limit + 1, cursor),
        deps.items.listByOwnerAndFolder(
          actor.userId,
          folderId,
          limit + 1,
          cursor,
        ),
      ]);
      const merged: ListedNode[] = [
        ...folders.map((record) => ({ type: "folder" as const, record })),
        ...files.map((record) => ({ type: "file" as const, record })),
      ].sort(compareCatalogNodes);
      const page = merged.slice(0, limit);
      const last = page[page.length - 1];
      const nextCursor =
        merged.length > limit && last
          ? encodeCursor({
              name: last.record.name,
              type: last.type,
              id: last.record.id,
            })
          : null;
      return success({
        folder: currentFolder ? toFolderView(currentFolder) : null,
        breadcrumbs,
        folders: page
          .filter(
            (node): node is Extract<ListedNode, { type: "folder" }> =>
              node.type === "folder",
          )
          .map((node): FilesFolderView => toFolderView(node.record)),
        files: page
          .filter(
            (node): node is Extract<ListedNode, { type: "file" }> =>
              node.type === "file",
          )
          .map((node): FilesFileView => toFileView(node.record)),
        nextCursor,
      });
    } catch {
      return failure("unavailable");
    }
  }

  async function listTrash(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesTrashListing>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const value = parseSafeRecord(input, ["limit", "cursor"]);
    if (!value) return failure("invalid-input");
    const limit = parseCatalogLimit(value.limit);
    const cursor = parseTrashCursor(value.cursor);
    if (limit === null || cursor === undefined) return failure("invalid-input");
    try {
      const [folders, files] = await Promise.all([
        deps.folders.listTrashByOwner(actor.userId, limit + 1, cursor),
        deps.items.listTrashByOwner(actor.userId, limit + 1, cursor),
      ]);
      const merged: ListedNode[] = [
        ...folders.map((record) => ({ type: "folder" as const, record })),
        ...files.map((record) => ({ type: "file" as const, record })),
      ].sort(compareTrashNodes);
      const page = merged.slice(0, limit);
      const last = page[page.length - 1];
      const nextCursor =
        merged.length > limit && last?.record.deletedAt
          ? encodeCursor({
              deletedAt: last.record.deletedAt,
              type: last.type,
              id: last.record.id,
            })
          : null;
      const nodes = page.map((node) =>
        node.type === "folder"
          ? toFolderView(node.record)
          : toFileView(node.record),
      );
      return success({ nodes, nextCursor });
    } catch {
      return failure("unavailable");
    }
  }

  return { listFolder, listTrash };
}
