import { describe, expect, it } from "vitest";
import { D1IdentityAuthAttemptRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-auth-attempt.repository.js";
import { createFakeD1 } from "./helpers/fake-d1.js";

describe("identity auth-attempt repository", () => {
  it("uses bound hash keys and returns the stored throttle state", async () => {
    const fake = createFakeD1({
      first: { failedAttempts: 6, windowStartedAt: 1000, lockedUntil: 301000 },
    });
    const repository = new D1IdentityAuthAttemptRepository(fake.db);
    await expect(repository.find("sha256-key", 2000, 900000)).resolves.toEqual({
      failedAttempts: 6,
      windowStartedAt: 1000,
      lockedUntil: 301000,
    });
    expect(fake.calls[0]?.sql).toContain(
      "FROM identity_auth_attempts WHERE key_hash = ?",
    );
    expect(fake.calls[0]?.bindings).toEqual(["sha256-key"]);
    expect(fake.calls[0]?.sql).not.toContain("sha256-key");
  });

  it("keeps an active long lockout after the failure window expires", async () => {
    const fake = createFakeD1({
      first: { failedAttempts: 10, windowStartedAt: 0, lockedUntil: 1_800_000 },
    });
    const repository = new D1IdentityAuthAttemptRepository(fake.db);

    await expect(repository.find("sha256-key", 1_000_000, 900_000)).resolves.toEqual({
      failedAttempts: 10,
      windowStartedAt: 0,
      lockedUntil: 1_800_000,
    });
  });

  it("records failures atomically and applies progressive lockout thresholds", async () => {
    const fake = createFakeD1({
      first: { failedAttempts: 6, windowStartedAt: 1000, lockedUntil: 301000 },
    });
    const repository = new D1IdentityAuthAttemptRepository(fake.db);
    await expect(
      repository.recordFailure("sha256-key", 2000, 900000),
    ).resolves.toEqual({
      failedAttempts: 6,
      windowStartedAt: 1000,
      lockedUntil: 301000,
    });
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]?.sql).toContain("ON CONFLICT(key_hash) DO UPDATE");
    expect(fake.calls[0]?.sql.match(/window_started_at <= \?/g)).toHaveLength(
      3,
    );
    expect(fake.calls[0]?.bindings).toEqual([
      "sha256-key",
      2000,
      2000,
      -898000,
      -898000,
      -898000,
    ]);
    expect(fake.calls[1]?.sql).toContain(
      "failed_attempts >= 10 THEN ? + 1800000",
    );
    expect(fake.calls[1]?.sql).toContain(
      "failed_attempts >= 8 THEN ? + 900000",
    );
    expect(fake.calls[1]?.sql).toContain(
      "failed_attempts >= 6 THEN ? + 300000",
    );
    expect(fake.calls[1]?.sql).toContain("failed_attempts >= 5 THEN ? + 60000");
    expect(fake.calls[1]?.bindings).toEqual([
      2000,
      2000,
      2000,
      2000,
      "sha256-key",
    ]);
  });

  it("clears an attempt key with a parameterized delete", async () => {
    const fake = createFakeD1();
    const repository = new D1IdentityAuthAttemptRepository(fake.db);
    await repository.clear("sha256-key");
    expect(fake.calls[0]?.sql).toBe(
      "DELETE FROM identity_auth_attempts WHERE key_hash = ?",
    );
    expect(fake.calls[0]?.bindings).toEqual(["sha256-key"]);
  });
});
