import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFilesModule } from "../../src/modules/files/module.public-api.js";
import { D1FilesCatalogNameRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-catalog-name.repository.js";
import { D1FilesFolderRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-folder.repository.js";
import { D1FilesItemRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-item.repository.js";
import { D1FilesUploadRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-upload.repository.js";
import { D1FilesTransferEventRepository } from "../../src/modules/files/infrastructure/persistence/d1/d1-files-transfer-event.repository.js";
import type { FilesActor } from "../../src/modules/files/application/catalog-contracts.js";
import type { IFileStoragePort } from "../../src/modules/files/application/ports/file-storage.js";
import { createSqliteD1 } from "./sqlite-d1.js";

export async function createFilesCatalogFixture() {
  const fixture = createSqliteD1();
  for (const path of [
    "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0004_files_multipart_uploads.sql",
  ]) {
    fixture.exec(await readFile(resolve(path), "utf8"));
  }
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const storage: IFileStoragePort = {
    async put(key, body, contentType, _sizeBytes) {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value);
        size += part.value.byteLength;
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      objects.set(key, { bytes, contentType });
    },
    async head(key) {
      const object = objects.get(key);
      return object
        ? {
            sizeBytes: object.bytes.byteLength,
            contentType: object.contentType,
          }
        : null;
    },
    async get(key, range) {
      const object = objects.get(key);
      if (!object) return null;
      const bytes = range
        ? object.bytes.slice(range.offset, range.offset + range.length)
        : object.bytes.slice();
      return {
        body: new Response(bytes).body!,
        sizeBytes: object.bytes.byteLength,
        contentType: object.contentType,
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  const api = createFilesModule({
    folders: new D1FilesFolderRepository(fixture.db),
    items: new D1FilesItemRepository(fixture.db),
    names: new D1FilesCatalogNameRepository(fixture.db),
    uploads: new D1FilesUploadRepository(fixture.db),
    transferEvents: new D1FilesTransferEventRepository(fixture.db),
    storage,
    ready: true,
  });
  const testApi = Object.assign(api, {
    createFileMetadata(actor: FilesActor, input: unknown) {
      const record = input as { sizeBytes?: number };
      const sizeBytes = record.sizeBytes ?? 0;
      return api.uploadFile(
        actor,
        input,
        new Response(new ArrayBuffer(sizeBytes)).body,
      );
    },
  });
  return { ...fixture, api: testApi, objects };
}
