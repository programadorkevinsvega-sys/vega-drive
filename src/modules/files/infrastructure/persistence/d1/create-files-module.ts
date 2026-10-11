import type { Env } from "../../../../../worker/env.js";
import { createFilesModule } from "../../../module.public-api.js";
import { D1FilesCatalogNameRepository } from "./d1-files-catalog-name.repository.js";
import { D1FilesFolderRepository } from "./d1-files-folder.repository.js";
import { D1FilesItemRepository } from "./d1-files-item.repository.js";

export function createFilesModuleFromD1(env: Env) {
  return createFilesModule({
    folders: new D1FilesFolderRepository(env.VEGA_DRIVE_DB),
    items: new D1FilesItemRepository(env.VEGA_DRIVE_DB),
    names: new D1FilesCatalogNameRepository(env.VEGA_DRIVE_DB),
    ready: Boolean(env.VEGA_DRIVE_DB),
  });
}
