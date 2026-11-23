import type { Env } from "../../../../../worker/env.js";
import type { SharedFileAccess } from "../../../application/sharing-service.js";
import { createSharingModule } from "../../../module.public-api.js";
import { D1SharingRepository } from "./d1-sharing.repository.js";
export function createSharingModuleFromD1(env: Env, files: SharedFileAccess, filesReady: boolean) {
  return createSharingModule({ repository: new D1SharingRepository(env.VEGA_DRIVE_DB), files, ready: Boolean(env.VEGA_DRIVE_DB) && filesReady });
}