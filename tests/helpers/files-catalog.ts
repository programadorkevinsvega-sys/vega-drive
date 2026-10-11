import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFilesModule } from "../../src/modules/files/module.public-api.js";
import { D1FilesCatalogNameRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-catalog-name.repository.js";
import { D1FilesFolderRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-folder.repository.js";
import { D1FilesItemRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-item.repository.js";
import { createSqliteD1 } from "./sqlite-d1.js";

export async function createFilesCatalogFixture() {
  const fixture = createSqliteD1();
  for (const path of [
    "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
  ]) {
    fixture.exec(await readFile(resolve(path), "utf8"));
  }
  const api = createFilesModule({
    folders: new D1FilesFolderRepository(fixture.db),
    items: new D1FilesItemRepository(fixture.db),
    names: new D1FilesCatalogNameRepository(fixture.db),
    ready: true,
  });
  return { ...fixture, api };
}
