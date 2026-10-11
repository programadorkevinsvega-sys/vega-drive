export function isValidCatalogId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function normalizeNodeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim();
  if (
    name.length < 1 ||
    name.length > 255 ||
    name === "." ||
    name === ".." ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    /[\\/]/.test(name)
  ) {
    return null;
  }
  return name;
}

export function parseCatalogLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 50;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d{1,3}$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return null;
  return parsed;
}

export function parseSafeRecord(
  value: unknown,
  allowedKeys: string[],
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => allowedKeys.includes(key))
    ? record
    : null;
}

export function hasValidActor(actor: unknown): actor is { userId: string } {
  if (!actor || typeof actor !== "object") return false;
  return isValidCatalogId((actor as { userId?: unknown }).userId);
}
