import { describe, expect, it, vi } from "vitest";
import {
  InProcessFilesGateway,
  InProcessIdentityGateway,
  InProcessQuotaGateway,
  InProcessSharingGateway,
} from "../src/worker/composition-root.js";
import type { FilesPublicApi } from "../src/modules/files/module.public-api.js";
import type { IdentityPublicApi } from "../src/modules/identity/module.public-api.js";
import type { QuotaPublicApi } from "../src/modules/quota/module.public-api.js";
import type { SharingPublicApi } from "../src/modules/sharing/module.public-api.js";

describe("Worker composition gateways", () => {
  it("delegates Identity operations to the public module API", async () => {
    const api = {
      status: vi.fn(() => ({ module: "identity" as const, ready: true })),
      authConfig: vi.fn(() => ({ turnstileSiteKey: "site", ready: true })),
      resolveSession: vi.fn(async (token: string | null) =>
        token === "valid" ? ({ userId: "owner-a" } as never) : null,
      ),
      logout: vi.fn(async () => undefined),
    } as unknown as IdentityPublicApi;
    const gateway = new InProcessIdentityGateway(api);

    expect(gateway.status()).toEqual({ module: "identity", ready: true });
    expect(gateway.authConfig()).toEqual({
      turnstileSiteKey: "site",
      ready: true,
    });
    expect(await gateway.resolveSession("valid")).toEqual({
      userId: "owner-a",
    });
    await gateway.logout("valid");
    expect(api.resolveSession).toHaveBeenCalledWith("valid");
    expect(api.logout).toHaveBeenCalledWith("valid");
  });

  it("delegates Files operations without exposing infrastructure adapters", async () => {
    const api = {
      status: vi.fn(() => ({ module: "files" as const, ready: true })),
      listFolder: vi.fn(async (actor: unknown, input: unknown) => ({
        ok: true as const,
        value: { actor, input },
      })),
      createPreviewUrl: vi.fn(async (actor: unknown, id: unknown) => ({
        ok: true as const,
        value: { actor, id },
      })),
      search: vi.fn(async (actor: unknown, input: unknown) => ({
        ok: true as const,
        value: { actor, input },
      })),
    } as unknown as FilesPublicApi;
    const gateway = new InProcessFilesGateway(api);
    const actor = { userId: "owner-a" };

    expect(gateway.status()).toEqual({ module: "files", ready: true });
    await gateway.listFolder(actor, { folderId: null });
    await gateway.createPreviewUrl(actor, "file-a");
    await gateway.search(actor, { query: "report" });
    expect(api.listFolder).toHaveBeenCalledWith(actor, { folderId: null });
    expect(api.createPreviewUrl).toHaveBeenCalledWith(actor, "file-a");
    expect(api.search).toHaveBeenCalledWith(actor, { query: "report" });
  });

  it("keeps Quota and Sharing explicitly unavailable", () => {
    const quotaApi = {
      status: () => ({ module: "quota" as const, ready: false }),
    } as QuotaPublicApi;
    const sharingApi = {
      status: () => ({ module: "sharing" as const, ready: false }),
    } as SharingPublicApi;

    expect(new InProcessQuotaGateway(quotaApi).status()).toEqual({
      module: "quota",
      ready: false,
    });
    expect(new InProcessSharingGateway(sharingApi).status()).toEqual({
      module: "sharing",
      ready: false,
    });
    expect(Object.keys(quotaApi)).toEqual(["status"]);
    expect(Object.keys(sharingApi)).toEqual(["status"]);
  });
});
