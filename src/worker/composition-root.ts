import type { Env, ModuleStatus } from "./env.js";
import { createIdentityModuleFromD1 } from "../modules/identity/infrastructure/persistence/d1/create-identity-module.js";
import type { IdentityPublicApi } from "../modules/identity/module.public-api.js";
import { createFilesModuleFromD1 } from "../modules/files/infrastructure/persistence/d1/create-files-module.js";
import type { FilesPublicApi } from "../modules/files/module.public-api.js";
import type { QuotaPublicApi } from "../modules/quota/module.public-api.js";
import type { SharingPublicApi } from "../modules/sharing/module.public-api.js";

export interface IdentityGateway extends IdentityPublicApi {}

export interface FilesGateway extends FilesPublicApi {}

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

  createFolder(...args: Parameters<FilesPublicApi["createFolder"]>) {
    return this.api.createFolder(...args);
  }

  renameFolder(...args: Parameters<FilesPublicApi["renameFolder"]>) {
    return this.api.renameFolder(...args);
  }

  moveFolder(...args: Parameters<FilesPublicApi["moveFolder"]>) {
    return this.api.moveFolder(...args);
  }

  deleteFolder(...args: Parameters<FilesPublicApi["deleteFolder"]>) {
    return this.api.deleteFolder(...args);
  }

  restoreFolder(...args: Parameters<FilesPublicApi["restoreFolder"]>) {
    return this.api.restoreFolder(...args);
  }

  renameFile(...args: Parameters<FilesPublicApi["renameFile"]>) {
    return this.api.renameFile(...args);
  }

  moveFile(...args: Parameters<FilesPublicApi["moveFile"]>) {
    return this.api.moveFile(...args);
  }

  deleteFile(...args: Parameters<FilesPublicApi["deleteFile"]>) {
    return this.api.deleteFile(...args);
  }

  permanentlyDeleteFile(
    ...args: Parameters<FilesPublicApi["permanentlyDeleteFile"]>
  ) {
    return this.api.permanentlyDeleteFile(...args);
  }

  permanentlyDeleteFolder(
    ...args: Parameters<FilesPublicApi["permanentlyDeleteFolder"]>
  ) {
    return this.api.permanentlyDeleteFolder(...args);
  }

  emptyTrash(...args: Parameters<FilesPublicApi["emptyTrash"]>) {
    return this.api.emptyTrash(...args);
  }

  cleanupExpiredTrash(
    ...args: Parameters<FilesPublicApi["cleanupExpiredTrash"]>
  ) {
    return this.api.cleanupExpiredTrash(...args);
  }

  restoreFile(...args: Parameters<FilesPublicApi["restoreFile"]>) {
    return this.api.restoreFile(...args);
  }

  uploadFile(...args: Parameters<FilesPublicApi["uploadFile"]>) {
    return this.api.uploadFile(...args);
  }

  downloadFile(...args: Parameters<FilesPublicApi["downloadFile"]>) {
    return this.api.downloadFile(...args);
  }

  cleanupExpiredUploads(
    ...args: Parameters<FilesPublicApi["cleanupExpiredUploads"]>
  ) {
    return this.api.cleanupExpiredUploads(...args);
  }

  beginMultipartUpload(...args: Parameters<FilesPublicApi["beginMultipartUpload"]>) {
    return this.api.beginMultipartUpload(...args);
  }

  uploadMultipartPart(...args: Parameters<FilesPublicApi["uploadMultipartPart"]>) {
    return this.api.uploadMultipartPart(...args);
  }

  completeMultipartUpload(...args: Parameters<FilesPublicApi["completeMultipartUpload"]>) {
    return this.api.completeMultipartUpload(...args);
  }

  abortMultipartUpload(...args: Parameters<FilesPublicApi["abortMultipartUpload"]>) {
    return this.api.abortMultipartUpload(...args);
  }

  listFolder(...args: Parameters<FilesPublicApi["listFolder"]>) {
    return this.api.listFolder(...args);
  }

  listTrash(...args: Parameters<FilesPublicApi["listTrash"]>) {
    return this.api.listTrash(...args);
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
  const filesApi = createFilesModuleFromD1(env);
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
