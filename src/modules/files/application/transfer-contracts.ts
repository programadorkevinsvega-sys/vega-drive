import type { FileStorageRange } from "./ports/file-storage.js";

export const MAX_FILE_SIZE_BYTES = 95 * 1024 * 1024;
export const MAX_USER_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
export const UPLOAD_RESERVATION_TTL_MS = 60 * 60 * 1000;
export const UPLOADS_PER_HOUR = 20;
export const DOWNLOADS_PER_HOUR = 120;

export interface ParsedByteRange extends FileStorageRange {
  start: number;
  end: number;
}

export type ByteRangeParseResult = ParsedByteRange | null | false;

/** Supports one RFC 9110 byte range. Multiple ranges are deliberately rejected. */
export function parseByteRange(
  value: string | null,
  sizeBytes: number,
): ByteRangeParseResult {
  if (value === null) return null;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) return false;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || value.includes(",")) return false;
  if (sizeBytes === 0) return false;

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    const length = Math.min(suffix, sizeBytes);
    start = sizeBytes - length;
    end = sizeBytes - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : sizeBytes - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= sizeBytes
    ) {
      return false;
    }
    end = Math.min(end, sizeBytes - 1);
  }

  return { offset: start, length: end - start + 1, start, end };
}

export function isValidContentType(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 127 &&
    /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(value)
  );
}
