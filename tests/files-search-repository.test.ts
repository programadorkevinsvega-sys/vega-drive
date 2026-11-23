import { describe, expect, it } from "vitest";
import { D1FilesSearchRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-search.repository.js";
import { createFakeD1 } from "./helpers/fake-d1.js";

describe("files search D1 repository", () => {
  it("scopes both catalog node types to the owner and parameterizes the search", async () => {
    const fake = createFakeD1({ results: [] });
    const repository = new D1FilesSearchRepository(fake.db);

    await repository.searchByOwner("owner-a", "quarterly_%", "all", 51);

    const call = fake.calls[0];
    expect(call?.sql).toContain("FROM files_folders WHERE owner_id = ?");
    expect(call?.sql).toContain("FROM files_items WHERE owner_id = ?");
    expect(call?.sql).not.toContain("JOIN");
    expect(call?.sql).toContain("deleted_at IS NULL");
    expect(call?.sql).toContain("LIMIT ?");
    expect(call?.sql).not.toContain("quarterly_%");
    expect(call?.bindings).toEqual([
      "owner-a",
      "%quarterly\\_\\%%",
      "owner-a",
      "%quarterly\\_\\%%",
      51,
    ]);
  });

  it("applies type filtering and stable cursor ordering", async () => {
    const fake = createFakeD1({ results: [] });
    const repository = new D1FilesSearchRepository(fake.db);

    await repository.searchByOwner("owner-a", "report", "files", 26, {
      name: "Quarterly report",
      type: "folder",
      id: "folder-1",
    });

    const call = fake.calls[0];
    expect(call?.sql).toContain("AND type = ?");
    expect(call?.sql).toContain("lower(name) > lower(?)");
    expect(call?.sql).toContain("CASE type WHEN 'folder' THEN 0 ELSE 1 END");
    expect(call?.bindings).toEqual([
      "owner-a",
      "%report%",
      "owner-a",
      "%report%",
      "file",
      "Quarterly report",
      "Quarterly report",
      0,
      0,
      "folder-1",
      26,
    ]);
  });
});
