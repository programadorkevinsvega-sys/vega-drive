import type { FilesActor } from "./catalog-contracts.js";
import type { FileTransferDependencies } from "./file-transfer-dependencies.js";
import { DOWNLOADS_PER_HOUR } from "./transfer-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";

export type FileUrlPurpose = "download" | "preview";

function previewContentType(name: string): string | null {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    mp4: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
    md: "text/plain; charset=utf-8",
    markdown: "text/plain; charset=utf-8",
    csv: "text/plain; charset=utf-8",
    json: "text/plain; charset=utf-8",
    log: "text/plain; charset=utf-8",
    yaml: "text/plain; charset=utf-8",
    yml: "text/plain; charset=utf-8",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return types[extension] ?? null;
}
export type FilesDownloadUrlResult =
  | { ok: true; value: { url: string; expiresInSeconds: number } }
  | { ok: false; reason: string };

export function createFileDownloadUrl(deps: FileTransferDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  return async function createDownloadUrl(
    actor: FilesActor,
    rawId: unknown,
    purpose: FileUrlPurpose = "download",
  ): Promise<FilesDownloadUrlResult> {
    if (!hasValidActor(actor) || !isValidCatalogId(rawId)) {
      return { ok: false, reason: "invalid-input" };
    }
    if (!deps.storage.presignGetUrl) {
      return { ok: false, reason: "unavailable" };
    }
    try {
      const item = await deps.items.findByIdForOwner(rawId, actor.userId);
      if (
        !item ||
        item.deletedAt !== null ||
        (item.folderId !== null &&
          !(await activeFolderPath(deps.folders, actor.userId, item.folderId)))
      ) {
        return { ok: false, reason: "not-found" };
      }

      const contentType =
        purpose === "preview" ? previewContentType(item.name) : null;
      if (purpose === "preview" && !contentType) {
        return { ok: false, reason: "unsupported-preview" };
      }

      const timestamp = now();
      if (
        !(await deps.transferEvents.consume(
          createId(),
          actor.userId,
          "download",
          timestamp.toISOString(),
          new Date(timestamp.getTime() - 3_600_000).toISOString(),
          DOWNLOADS_PER_HOUR,
        ))
      ) {
        return { ok: false, reason: "rate-limited" };
      }

      const head = await deps.storage.head(item.storageKey);
      if (!head || head.sizeBytes !== item.sizeBytes) {
        return { ok: false, reason: "unavailable" };
      }
      const expiresInSeconds = purpose === "preview" ? 900 : 120;
      const url =
        purpose === "preview"
          ? await deps.storage.presignGetUrl(
              item.storageKey,
              expiresInSeconds,
              item.name,
              {
                disposition: "inline",
                responseContentType: contentType!,
              },
            )
          : await deps.storage.presignGetUrl(
              item.storageKey,
              expiresInSeconds,
              item.name,
            );
      if (!url) return { ok: false, reason: "unavailable" };
      return { ok: true, value: { url, expiresInSeconds } };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  };
}
