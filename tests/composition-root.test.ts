import { describe, expect, it, vi } from "vitest";
import {
  InProcessFilesGateway,
  InProcessIdentityGateway,
  createCompositionRoot,
} from "../src/worker/composition-root.js";
import type { FilesPublicApi } from "../src/modules/files/module.public-api.js";
import type { IdentityPublicApi } from "../src/modules/identity/module.public-api.js";
import type { Env } from "../src/worker/env.js";

describe("composition root and module gateways", () => {
  it("assembles one gateway per module and leaves future capabilities unavailable", () => {
    const gateways = createCompositionRoot({} as Env);

    expect(Object.keys(gateways).sort()).toEqual([
      "files",
      "identity",
      "quota",
      "sharing",
    ]);
    expect(gateways.identity.status()).toEqual({
      module: "identity",
      ready: false,
    });
    expect(gateways.files.status()).toEqual({
      module: "files",
      ready: false,
    });
    expect(gateways.quota.status()).toEqual({
      module: "quota",
      ready: false,
    });
    expect(gateways.sharing.status()).toEqual({
      module: "sharing",
      ready: false,
    });

    for (const gateway of [gateways.quota, gateways.sharing]) {
      expect(
        Object.getOwnPropertyNames(Object.getPrototypeOf(gateway)),
      ).toEqual(["constructor", "status"]);
      expect(gateway.status().ready).toBe(false);
    }
  });

  it("IdentityGateway delegates authentication operations to IdentityPublicApi", async () => {
    const session = { userId: "owner-a" };
    const resolveSession = vi.fn().mockResolvedValue({
      ok: true,
      value: session,
    });
    const api = {
      status: () => ({ module: "identity", ready: true }),
      resolveSession,
    } as unknown as IdentityPublicApi;
    const gateway = new InProcessIdentityGateway(api);

    await expect(
      gateway.resolveSession("session-token"),
    ).resolves.toEqual({ ok: true, value: session });
    expect(resolveSession).toHaveBeenCalledOnce();
    expect(resolveSession).toHaveBeenCalledWith("session-token");
  });

  it(
    "FilesGateway delegates file operations to FilesPublicApi without reimplementing them",
    async () => {
      const listing = { ok: true, value: { files: [], folders: [] } };
      const listFolder = vi.fn().mockResolvedValue(listing);
      const downloadFile = vi.fn().mockResolvedValue({
        ok: true,
        value: { body: new ReadableStream(), contentLength: 0 },
      });
      const api = {
        status: () => ({ module: "files", ready: true }),
        listFolder,
        downloadFile,
      } as unknown as FilesPublicApi;
      const gateway = new InProcessFilesGateway(api);
      const actor = { userId: "owner-a" };

      await expect(gateway.listFolder(actor, { folderId: null })).resolves.toBe(listing);
      await expect(
        gateway.downloadFile(actor, "file-a", "bytes=0-1", "preview"),
      ).resolves.toMatchObject({ ok: true });
      expect(listFolder).toHaveBeenCalledWith(actor, { folderId: null });
      expect(downloadFile).toHaveBeenCalledWith(
        actor,
        "file-a",
        "bytes=0-1",
        "preview",
      );
    },
  );
});
