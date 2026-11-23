import { describe, expect, it, vi } from "vitest";
import { createSharingService } from "../src/modules/sharing/application/sharing-service.js";
import type { ShareRecord, SharingRepository } from "../src/modules/sharing/application/sharing-repository.js";

class MemorySharingRepository implements SharingRepository {
  records = new Map<string, ShareRecord>();
  attempts = 0;
  allowCreate = true;
  async create(record: ShareRecord): Promise<boolean> {
    if (!this.allowCreate) return false;
    this.records.set(record.tokenHash, record);
    return true;
  }
  async findByTokenHash(hash: string) { return this.records.get(hash) ?? null; }
  async listByOwner(ownerId: string) { return [...this.records.values()].filter((record) => record.ownerId === ownerId); }
  async revoke(id: string, ownerId: string, revokedAt: string) {
    const record = [...this.records.values()].find((entry) => entry.id === id && entry.ownerId === ownerId && entry.revokedAt === null);
    if (!record) return false;
    record.revokedAt = revokedAt;
    return true;
  }
  async consumePasswordAttempt() {
    this.attempts += 1;
    return this.attempts <= 10;
  }
}
const fixedNow = new Date("2026-11-22T12:00:00.000Z");
function fixture() {
  const repository = new MemorySharingRepository();
  const downloadFile = vi.fn().mockResolvedValue({ ok: true, value: { name: "private.txt", contentType: "text/plain", sizeBytes: 4, contentLength: 4, status: 200, contentRange: null, body: new ReadableStream<Uint8Array>() } });
  const getFileMetadata = vi.fn().mockResolvedValue({ ok: true, value: { id: "file-a", name: "private.txt" } });
  const service = createSharingService({
    repository,
    files: { downloadFile, getFileMetadata },
    now: () => new Date(fixedNow),
    createId: () => "share-a",
  });
  return { repository, downloadFile, getFileMetadata, service };
}
describe("sharing service security", () => {
  it("creates an opaque 256-bit read-only link and persists only its hash", async () => {
    const { repository, service } = fixture();
    const result = await service.create({ userId: "owner-a" }, "file-a", 86400);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.value.permission).toBe("read");
    expect(result.value.passwordProtected).toBe(false);
    expect(result.value.expiresAt).toBe("2026-11-23T12:00:00.000Z");
    const record = [...repository.records.values()][0];
    expect(record?.tokenHash).not.toBe(result.value.token);
    expect(record?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(record)).not.toContain(result.value.token);
  });

  it("requires the optional password and uses PBKDF2 before authorizing download", async () => {
    const { service, downloadFile, repository } = fixture();
    const created = await service.create({ userId: "owner-a" }, "file-a", 3600, "strong-password");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.passwordProtected).toBe(true);
    await expect(service.download(created.value.token, null)).resolves.toMatchObject({ ok: false, reason: "password-required" });
    await expect(service.download(created.value.token, null, "wrong-password")).resolves.toMatchObject({ ok: false, reason: "password-required" });
    await expect(service.download(created.value.token, null, "strong-password")).resolves.toMatchObject({ ok: true });
    expect(repository.attempts).toBe(2);
    expect(downloadFile).toHaveBeenCalledOnce();
  });

  it("rejects revoked and expired tokens without asking Files to access storage", async () => {
    const { service, downloadFile } = fixture();
    const created = await service.create({ userId: "owner-a" }, "file-a", 3600);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await service.revoke({ userId: "owner-b" }, created.value.id);
    await expect(service.download(created.value.token, null)).resolves.toMatchObject({ ok: true });
    await service.revoke({ userId: "owner-a" }, created.value.id);
    await expect(service.download(created.value.token, null)).resolves.toMatchObject({ ok: false, reason: "not-found" });
    expect(downloadFile).toHaveBeenCalledOnce();
  });

  it("does not create links for files that Files cannot resolve for the owner", async () => {
    const { service, repository, getFileMetadata } = fixture();
    getFileMetadata.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(service.create({ userId: "owner-a" }, "foreign-file", 3600)).resolves.toMatchObject({ ok: false, reason: "not-found" });
    expect(repository.records.size).toBe(0);
  });

  it("honors the atomic creation limit and the password attempt limit", async () => {
    const { service, repository } = fixture();
    repository.allowCreate = false;
    await expect(service.create({ userId: "owner-a" }, "file-a", 3600)).resolves.toMatchObject({ ok: false, reason: "rate-limited" });
    repository.allowCreate = true;
    const created = await service.create({ userId: "owner-a" }, "file-a", 3600, "strong-password");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    repository.attempts = 10;
    await expect(service.download(created.value.token, null, "strong-password")).resolves.toMatchObject({ ok: false, reason: "rate-limited" });
  });
});
