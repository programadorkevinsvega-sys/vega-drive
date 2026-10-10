const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BITS = 256;

export function validatePassword(password: unknown): password is string {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    return false;
  }
  const normalized = password.trim().toLowerCase();
  if (
    /^(?:password|qwerty|admin|letmein|welcome|iloveyou|monkey|dragon)\d{0,8}$/.test(
      normalized,
    ) ||
    /^(.)\1{11,}$/.test(password)
  ) {
    return false;
  }
  return !(
    /^(?:0123456789|1234567890)\d*$/.test(normalized) ||
    /^(?:abcdefghijklmnopqrstuvwxyz){1,}$/.test(normalized)
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function hashPassword(
  password: string,
): Promise<{ passwordHash: string; passwordSalt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    PASSWORD_HASH_BITS,
  );
  return {
    passwordHash: toBase64(new Uint8Array(bits)),
    passwordSalt: toBase64(salt),
  };
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
  passwordSalt: string,
): Promise<boolean> {
  try {
    const salt = fromBase64(passwordSalt);
    const expected = fromBase64(passwordHash);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: PASSWORD_ITERATIONS,
      },
      key,
      PASSWORD_HASH_BITS,
    );
    const actual = new Uint8Array(bits);
    return (
      actual.length === expected.length &&
      crypto.subtle.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
