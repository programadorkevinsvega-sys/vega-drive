import { describe, expect, it } from "vitest";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../src/modules/identity/application/registration/password.js";

describe("identity password policy and storage", () => {
  it("rejects short, trivial, repetitive and overlong passwords", () => {
    expect(validatePassword("short")).toBe(false);
    expect(validatePassword("Password123456")).toBe(false);
    expect(validatePassword("aaaaaaaaaaaa")).toBe(false);
    expect(validatePassword("123456789012")).toBe(false);
    expect(validatePassword("x".repeat(129))).toBe(false);
    expect(validatePassword("A strong passphrase 42!")).toBe(true);
  });

  it("uses independent random salts and verifies only the matching password", async () => {
    const first = await hashPassword("A strong passphrase 42!");
    const second = await hashPassword("A strong passphrase 42!");
    expect(first.passwordSalt).not.toBe(second.passwordSalt);
    expect(first.passwordHash).not.toBe("A strong passphrase 42!");
    expect(
      await verifyPassword(
        "A strong passphrase 42!",
        first.passwordHash,
        first.passwordSalt,
      ),
    ).toBe(true);
    expect(
      await verifyPassword(
        "Wrong passphrase 42!",
        first.passwordHash,
        first.passwordSalt,
      ),
    ).toBe(false);
    expect(
      await verifyPassword(
        "A strong passphrase 42!",
        "not-base64!",
        "bad-salt",
      ),
    ).toBe(false);
  });
});
