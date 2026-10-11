import type {
  FilesCatalogCursor,
  FilesFolderRecord,
  FilesItemRecord,
  FilesTrashCursor,
} from "./ports/files-repositories.js";
import {
  isValidCatalogId,
  parseSafeRecord,
} from "../domain/catalog-validation.js";

export type ListedNode =
  | { type: "folder"; record: FilesFolderRecord }
  | { type: "file"; record: FilesItemRecord };

function asciiFold(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareCatalogNodes(
  left: ListedNode,
  right: ListedNode,
): number {
  const nameOrder = compareText(
    asciiFold(left.record.name),
    asciiFold(right.record.name),
  );
  if (nameOrder !== 0) return nameOrder;
  if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
  return compareText(left.record.id, right.record.id);
}

export function compareTrashNodes(left: ListedNode, right: ListedNode): number {
  const leftDeleted = left.record.deletedAt ?? "";
  const rightDeleted = right.record.deletedAt ?? "";
  const dateOrder = compareText(rightDeleted, leftDeleted);
  if (dateOrder !== 0) return dateOrder;
  if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
  return compareText(left.record.id, right.record.id);
}

export function parseFolderCursor(
  value: unknown,
): FilesCatalogCursor | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1024) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    const record = parseSafeRecord(parsed, ["name", "type", "id"]);
    if (
      !record ||
      typeof record.name !== "string" ||
      record.name.length > 255 ||
      !isValidCatalogId(record.id) ||
      (record.type !== "folder" && record.type !== "file")
    ) {
      return undefined;
    }
    return { name: record.name, type: record.type, id: record.id };
  } catch {
    return undefined;
  }
}

export function parseTrashCursor(
  value: unknown,
): FilesTrashCursor | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1024) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    const record = parseSafeRecord(parsed, ["deletedAt", "type", "id"]);
    if (
      !record ||
      typeof record.deletedAt !== "string" ||
      !Number.isFinite(Date.parse(record.deletedAt)) ||
      !isValidCatalogId(record.id) ||
      (record.type !== "folder" && record.type !== "file")
    ) {
      return undefined;
    }
    return { deletedAt: record.deletedAt, type: record.type, id: record.id };
  } catch {
    return undefined;
  }
}

export function encodeCursor(
  value: FilesCatalogCursor | FilesTrashCursor,
): string {
  return encodeURIComponent(JSON.stringify(value));
}
