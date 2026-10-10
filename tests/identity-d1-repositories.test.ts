import { describe, expect, it } from "vitest";
import { D1IdentityInviteRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-invite.repository.js";
import { D1IdentityOutboxRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-outbox.repository.js";
import { D1IdentitySessionRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-session.repository.js";
import { D1IdentityUserRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-user.repository.js";
import { createFakeD1 } from "./helpers/fake-d1.js";

describe("identity D1 repositories", () => {
  it("binds normalized email and does not interpolate it into SQL", async () => {
    const fake = createFakeD1();
    const repository = new D1IdentityUserRepository(fake.db);

    await repository.findByNormalizedEmail("owner@example.test");

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.sql).toContain(
      "FROM identity_users WHERE email = ?",
    );
    expect(fake.calls[0]?.sql).not.toContain("owner@example.test");
    expect(fake.calls[0]?.bindings).toEqual(["owner@example.test"]);
  });

  it("scopes session revocation by both session ID and its user", async () => {
    const fake = createFakeD1({ changes: 1 });
    const repository = new D1IdentitySessionRepository(fake.db);

    await expect(
      repository.revokeForUser("session-b", "user-a", "2026-10-10T00:00:00Z"),
    ).resolves.toBe(true);

    expect(fake.calls[0]?.sql).toContain(
      "WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
    );
    expect(fake.calls[0]?.bindings).toEqual([
      "2026-10-10T00:00:00Z",
      "session-b",
      "user-a",
    ]);
  });

  it("consumes an invite atomically only while unused and unexpired", async () => {
    const fake = createFakeD1({ changes: 1 });
    const repository = new D1IdentityInviteRepository(fake.db);
    const now = "2026-10-10T00:00:00Z";

    await expect(repository.consume("invite-hash", now)).resolves.toBe(true);

    expect(fake.calls[0]?.sql).toContain(
      "WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
    );
    expect(fake.calls[0]?.bindings).toEqual([now, "invite-hash", now]);
  });

  it("limits unpublished identity outbox reads with a bound parameter", async () => {
    const fake = createFakeD1({ results: [] });
    const repository = new D1IdentityOutboxRepository(fake.db);

    await repository.listUnpublished(10000);

    expect(fake.calls[0]?.sql).toContain("FROM identity_outbox");
    expect(fake.calls[0]?.sql).toContain("LIMIT ?");
    expect(fake.calls[0]?.bindings).toEqual([100]);
  });

  it("writes only to the identity-owned users table with bound values", async () => {
    const fake = createFakeD1();
    const repository = new D1IdentityUserRepository(fake.db);

    await repository.insert({
      id: "user-1",
      email: "one@example.test",
      passwordHash: "hash",
      passwordSalt: "salt",
      createdAt: "2026-10-10T00:00:00Z",
      updatedAt: "2026-10-10T00:00:00Z",
      disabledAt: null,
    });

    expect(fake.calls[0]?.sql).toContain("INSERT INTO identity_users");
    expect(fake.calls[0]?.sql).toContain("VALUES (?, ?, ?, ?, ?, ?, ?)");
    expect(fake.calls[0]?.sql).not.toContain("one@example.test");
    expect(fake.calls[0]?.bindings).toEqual([
      "user-1",
      "one@example.test",
      "hash",
      "salt",
      "2026-10-10T00:00:00Z",
      "2026-10-10T00:00:00Z",
      null,
    ]);
  });
});
