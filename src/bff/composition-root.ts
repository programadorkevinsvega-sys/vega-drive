import type { Env, ModuleStatus } from "../worker/env.js";
import type { IdentityPublicApi } from "../modules/identity/module.public-api.js";
import type { FilesPublicApi } from "../modules/files/module.public-api.js";
import type { QuotaPublicApi } from "../modules/quota/module.public-api.js";
import type { SharingPublicApi } from "../modules/sharing/module.public-api.js";
export interface IdentityGateway { status(): ModuleStatus }
export interface FilesGateway { status(): ModuleStatus }
export interface QuotaGateway { status(): ModuleStatus }
export interface SharingGateway { status(): ModuleStatus }
export class InProcessIdentityGateway implements IdentityGateway { constructor(private readonly api: IdentityPublicApi) {} status() { return this.api.status(); } }
export class InProcessFilesGateway implements FilesGateway { constructor(private readonly api: FilesPublicApi) {} status() { return this.api.status(); } }
export class InProcessQuotaGateway implements QuotaGateway { constructor(private readonly api: QuotaPublicApi) {} status() { return this.api.status(); } }
export class InProcessSharingGateway implements SharingGateway { constructor(private readonly api: SharingPublicApi) {} status() { return this.api.status(); } }
export function createCompositionRoot(_env: Env) {
  const identityApi: IdentityPublicApi = { status: () => ({ module: "identity", ready: true }) };
  const filesApi: FilesPublicApi = { status: () => ({ module: "files", ready: true }) };
  const quotaApi: QuotaPublicApi = { status: () => ({ module: "quota", ready: true }) };
  const sharingApi: SharingPublicApi = { status: () => ({ module: "sharing", ready: true }) };
  return { identity: new InProcessIdentityGateway(identityApi), files: new InProcessFilesGateway(filesApi), quota: new InProcessQuotaGateway(quotaApi), sharing: new InProcessSharingGateway(sharingApi) };
}
