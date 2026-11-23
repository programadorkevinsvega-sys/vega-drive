import type { SharingRepository, ShareRecord } from "./sharing-repository.js";

export interface SharedFileAccess {
  downloadFile(actor: { userId: string }, id: unknown, range: string | null, purpose?: "download" | "preview"): Promise<
    | { ok: true; value: { name: string; contentType: string; sizeBytes: number; contentLength: number; status: 200 | 206; contentRange: string | null; body: ReadableStream<Uint8Array> } }
    | { ok: false; reason: string; totalSizeBytes?: number }
  >;
  getFileMetadata(actor: { userId: string }, id: unknown): Promise<
    { ok: true; value: { id: string; name: string } } | { ok: false; reason: string }
  >;
}
export interface SharingServiceDependencies {
  repository: SharingRepository;
  files: SharedFileAccess;
  now?: () => Date;
  createId?: () => string;
}
function validActor(actor: { userId: string } | null | undefined): boolean {
  return Boolean(actor && typeof actor.userId === "string" && actor.userId.length >= 1 && actor.userId.length <= 128);
}
function encodeToken(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function validToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
export function createSharingService(deps: SharingServiceDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());
  async function create(actor: { userId: string }, rawItemId: unknown, rawLifetime: unknown) {
    if (!validActor(actor) || typeof rawItemId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(rawItemId)) return { ok: false as const, reason: "invalid-input" };
    const lifetime = rawLifetime === undefined ? 604800 : rawLifetime;
    if (typeof lifetime !== "number" || !Number.isInteger(lifetime) || lifetime < 3600 || lifetime > 2592000) return { ok: false as const, reason: "invalid-input" };
    try {
      const file = await deps.files.getFileMetadata(actor, rawItemId);
      if (!file.ok) return { ok: false as const, reason: file.reason === "not-found" ? "not-found" : "unavailable" };
      const timestamp = now();
      const since = new Date(timestamp.getTime() - 3600000).toISOString();
      if (await deps.repository.countRecent(actor.userId, since) >= 30) return { ok: false as const, reason: "rate-limited" };
      const token = encodeToken(crypto.getRandomValues(new Uint8Array(32)));
      const record: ShareRecord = {
        id: createId(), ownerId: actor.userId, itemId: rawItemId,
        tokenHash: await tokenHash(token), createdAt: timestamp.toISOString(),
        expiresAt: new Date(timestamp.getTime() + lifetime * 1000).toISOString(),
        revokedAt: null,
      };
      await deps.repository.create(record);
      return { ok: true as const, value: { id: record.id, itemId: record.itemId, fileName: file.value.name, token, createdAt: record.createdAt, expiresAt: record.expiresAt, permission: "read" as const } };
    } catch {
      return { ok: false as const, reason: "unavailable" };
    }
  }
  async function list(actor: { userId: string }) {
    if (!validActor(actor)) return { ok: false as const, reason: "invalid-input" };
    try {
      const records = await deps.repository.listByOwner(actor.userId, 100);
      const entries = await Promise.all(records.map(async (record) => {
        const file = await deps.files.getFileMetadata(actor, record.itemId);
        return { id: record.id, itemId: record.itemId, fileName: file.ok ? file.value.name : "Archivo no disponible", createdAt: record.createdAt, expiresAt: record.expiresAt, revokedAt: record.revokedAt };
      }));
      return { ok: true as const, value: { shares: entries } };
    } catch { return { ok: false as const, reason: "unavailable" }; }
  }
  async function revoke(actor: { userId: string }, rawId: unknown) {
    if (!validActor(actor) || typeof rawId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(rawId)) return { ok: false as const, reason: "invalid-input" };
    try {
      const changed = await deps.repository.revoke(rawId, actor.userId, now().toISOString());
      return changed ? { ok: true as const, value: { revoked: true as const } } : { ok: false as const, reason: "not-found" };
    } catch { return { ok: false as const, reason: "unavailable" }; }
  }
  async function download(rawToken: unknown, range: string | null) {
    if (!validToken(rawToken)) return { ok: false as const, reason: "not-found" };
    try {
      const record = await deps.repository.findByTokenHash(await tokenHash(rawToken));
      const timestamp = now().toISOString();
      if (!record || record.revokedAt !== null || record.expiresAt <= timestamp) return { ok: false as const, reason: "not-found" };
      return deps.files.downloadFile({ userId: record.ownerId }, record.itemId, range, "download");
    } catch { return { ok: false as const, reason: "unavailable" }; }
  }
  return { create, list, revoke, download };
}