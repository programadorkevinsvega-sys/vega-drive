import type { ModuleStatus } from "../../worker/env.js";
import { createSharingService, type SharedFileAccess } from "./application/sharing-service.js";
import type { SharingRepository } from "./application/sharing-repository.js";

export interface SharingPublicApi {
  status(): ModuleStatus;
  create(actor: { userId: string }, itemId: unknown, lifetimeSeconds: unknown, password?: unknown): ReturnType<ReturnType<typeof createSharingService>["create"]>;
  list(actor: { userId: string }): ReturnType<ReturnType<typeof createSharingService>["list"]>;
  revoke(actor: { userId: string }, id: unknown): ReturnType<ReturnType<typeof createSharingService>["revoke"]>;
  download(token: unknown, range: string | null, password?: unknown): ReturnType<ReturnType<typeof createSharingService>["download"]>;
}
export interface SharingModuleDependencies {
  repository: SharingRepository;
  files: SharedFileAccess;
  ready?: boolean;
  now?: () => Date;
  createId?: () => string;
}
export function createSharingModule(deps: SharingModuleDependencies): SharingPublicApi {
  const service = createSharingService(deps);
  return {
    status: () => ({ module: "sharing", ready: deps.ready ?? true }),
    create: (...args) => service.create(...args),
    list: (...args) => service.list(...args),
    revoke: (...args) => service.revoke(...args),
    download: (...args) => service.download(...args),
  };
}