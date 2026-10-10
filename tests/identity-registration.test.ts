import { describe, expect, it, vi } from "vitest";
import { createRegisterUser } from "../src/modules/identity/application/registration/register-user.js";
import type {
  IdentityUserRecord,
  IdentityUserRepository,
} from "../src/modules/identity/application/ports/identity-repositories.js";

const validInput = {
  email: "  Person@Example.test ",
  password: "A secure passphrase 42!",
  turnstileToken: "valid-turnstile-token",
};

function createUsers(
  overrides: Partial<IdentityUserRepository> = {},
): IdentityUserRepository {
  return {
    findById: vi.fn(async () => null),
    findByNormalizedEmail: vi.fn(async () => null),
    insert: vi.fn(async () => undefined),
    insertWithinLimit: vi.fn(async () => true),
    updatePassword: vi.fn(async () => true),
    ...overrides,
  };
}

describe("identity registration use case", () => {
  it("normalizes email and persists only a PBKDF2 hash and random salt", async () => {
    let inserted: IdentityUserRecord | undefined;
    const users = createUsers({
      insertWithinLimit: vi.fn(async (user) => {
        inserted = user;
        return true;
      }),
    });
    const register = createRegisterUser({
      users,
      turnstile: { verify: vi.fn(async () => true) },
      maxUsers: 10,
      now: () => new Date("2026-10-10T00:00:00.000Z"),
      createId: () => "user-1",
    });

    await expect(register(validInput)).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });
    expect(inserted?.email).toBe("person@example.test");
    expect(inserted?.passwordHash).not.toBe(validInput.password);
    expect(inserted?.passwordSalt).not.toBe("");
    expect(inserted?.passwordHash).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(inserted?.passwordSalt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(inserted?.passwordHash).not.toBe(inserted?.passwordSalt);
    expect(users.insertWithinLimit).toHaveBeenCalledWith(
      expect.objectContaining({ email: "person@example.test" }),
      10,
    );
  });

  it("rejects invalid email and weak/short passwords before Turnstile", async () => {
    const verify = vi.fn(async () => true);
    const register = createRegisterUser({
      users: createUsers(),
      turnstile: { verify },
      maxUsers: 10,
    });

    await expect(
      register({ ...validInput, email: "not-an-email" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-input" });
    await expect(
      register({ ...validInput, password: "short" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-input" });
    await expect(
      register({ ...validInput, password: "123456789012" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-input" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed if Turnstile fails or configuration is invalid", async () => {
    const users = createUsers();
    const failedCaptcha = createRegisterUser({
      users,
      turnstile: { verify: vi.fn(async () => false) },
      maxUsers: 10,
    });
    await expect(failedCaptcha(validInput)).resolves.toEqual({
      ok: false,
      reason: "captcha-failed",
    });

    const invalidLimit = createRegisterUser({
      users,
      turnstile: { verify: vi.fn(async () => true) },
      maxUsers: 11,
    });
    await expect(invalidLimit(validInput)).resolves.toEqual({
      ok: false,
      reason: "registration-closed",
    });
    expect(users.insertWithinLimit).not.toHaveBeenCalled();
  });

  it("does not create duplicate users and handles database failures generically", async () => {
    const duplicate = createRegisterUser({
      users: createUsers({
        findByNormalizedEmail: vi.fn(async () => ({
          id: "existing",
          email: "person@example.test",
          passwordHash: "hash",
          passwordSalt: "salt",
          createdAt: "",
          updatedAt: "",
          disabledAt: null,
        })),
      }),
      turnstile: { verify: vi.fn(async () => true) },
      maxUsers: 10,
    });
    await expect(duplicate(validInput)).resolves.toEqual({
      ok: false,
      reason: "registration-unavailable",
    });

    const broken = createRegisterUser({
      users: createUsers({
        findByNormalizedEmail: vi.fn(async () => {
          throw new Error("sensitive database detail");
        }),
      }),
      turnstile: { verify: vi.fn(async () => true) },
      maxUsers: 10,
    });
    await expect(broken(validInput)).resolves.toEqual({
      ok: false,
      reason: "registration-unavailable",
    });
  });

  it("treats a simultaneous capacity limit as registration closed", async () => {
    const users = createUsers({
      insertWithinLimit: vi.fn(async () => false),
    });
    const register = createRegisterUser({
      users,
      turnstile: { verify: vi.fn(async () => true) },
      maxUsers: 10,
    });
    await expect(register(validInput)).resolves.toEqual({
      ok: false,
      reason: "registration-closed",
    });
  });
});
