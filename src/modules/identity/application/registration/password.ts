const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BITS = 256;

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "qwerty123456",
  "admin1234567",
  "letmein12345",
]);

export function validatePassword(password: unknown): password is string {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return false;
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return false;
  if (/^(.)\1{11,}$/.test(password)) return false;
  if (/^(?:0123456789|1234567890|abcdefghijklmnopqrstuvwxyz){1,}$/.test(normalized)) {
    return false;
  }
  return true;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function hashPassword(
  password: string,
): Promise<{ passwordHash: string; passwordSalt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    keyMaterial,
    PASSWORD_HASH_BITS,
  );

  return {
    passwordHash: toBase64(new Uint8Array(derivedBits)),
    passwordSalt: toBase64(salt),
  };
}
