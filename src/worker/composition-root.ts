import type { Env, ModuleStatus } from "./env.js";
import { createIdentityModuleFromD1 } from "../modules/identity/infrastructure/persistence/d1/create-identity-module.js";
import type { IdentityPublicApi } from "../modules/identity/module.public-api.js";
import type { FilesPublicApi } from "../modules/files/module.public-api.js";
import type { QuotaPublicApi } from "../modules/quota/module.public-api.js";
import type { SharingPublicApi } from "../modules/sharing/module.public-api.js";

export interface IdentityGateway extends IdentityPublicApi {}
export interface FilesGateway {
  status(): ModuleStatus;
}
export interface QuotaGateway {
  status(): ModuleStatus;
}
export interface SharingGateway {
  status(): ModuleStatus;
}

export class InProcessIdentityGateway implements IdentityGateway {
  constructor(private readonly api: IdentityPublicApi) {}
  status() {
    return this.api.status();
  }
  authConfig() {
    return this.api.authConfig();
  }
  register(
    input: Parameters<IdentityPublicApi["register"]>[0],
    ip: string | null,
  ) {
    return this.api.register(input, ip);
  }
  login(
    input: Parameters<IdentityPublicApi["login"]>[0],
    ip: string | null,
    previous: string | null,
  ) {
    return this.api.login(input, ip, previous);
  }
  logout(token: string | null) {
    return this.api.logout(token);
  }
  resolveSession(token: string | null) {
    return this.api.resolveSession(token);
  }
  changePassword(
    actor: Parameters<IdentityPublicApi["changePassword"]>[0],
    current: unknown,
    next: unknown,
    ip: string | null,
  ) {
    return this.api.changePassword(actor, current, next, ip);
  }
}

export class InProcessFilesGateway implements FilesGateway {
  constructor(private readonly api: FilesPublicApi) {}
  status() {
    return this.api.status();
  }
}
export class InProcessQuotaGateway implements QuotaGateway {
  constructor(private readonly api: QuotaPublicApi) {}
  status() {
    return this.api.status();
  }
}
export class InProcessSharingGateway implements SharingGateway {
  constructor(private readonly api: SharingPublicApi) {}
  status() {
    return this.api.status();
  }
}

export function createCompositionRoot(env: Env) {
  const identityApi = createIdentityModuleFromD1(env);
  const filesApi: FilesPublicApi = {
    status: () => ({ module: "files", ready: false }),
  };
  const quotaApi: QuotaPublicApi = {
    status: () => ({ module: "quota", ready: false }),
  };
  const sharingApi: SharingPublicApi = {
    status: () => ({ module: "sharing", ready: false }),
  };
  return {
    identity: new InProcessIdentityGateway(identityApi),
    files: new InProcessFilesGateway(filesApi),
    quota: new InProcessQuotaGateway(quotaApi),
    sharing: new InProcessSharingGateway(sharingApi),
  };
}
