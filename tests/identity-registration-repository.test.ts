import { describe, expect, it } from "vitest";
import { D1IdentityUserRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-user.repository.js";
import { createFakeD1 } from "./helpers/fake-d1.js";

describe("identity registration capacity guard", () => {
  it("checks MAX_USERS in the same atomic INSERT and binds all values", async () => {
    const fake = createFakeD1({ changes: 1 });
    const repository = new D1IdentityUserRepository(fake.db);
    const user = {
      id: "user-1",
      email: "person@example.test",
      passwordHash: "hash",
      passwordSalt: "salt",
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
      disabledAt: null,
    };

    await expect(repository.insertWithinLimit(user, 10)).resolves.toBe(true);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.sql).toContain(
      "SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM identity_users) < ?",
    );
    expect(fake.calls[0]?.sql).not.toContain("person@example.test");
    expect(fake.calls[0]?.bindings).toEqual([
      "user-1",
      "person@example.test",
      "hash",
      "salt",
      "2026-10-10T00:00:00.000Z",
      "2026-10-10T00:00:00.000Z",
      null,
      10,
    ]);
  });

  it("refuses unsafe limits without issuing SQL", async () => {
    const fake = createFakeD1();
    const repository = new D1IdentityUserRepository(fake.db);

    await expect(
      repository.insertWithinLimit(
        {
          id: "user-1",
          email: "person@example.test",
          passwordHash: "hash",
          passwordSalt: "salt",
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
          disabledAt: null,
        },
        11,
      ),
    ).resolves.toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});
