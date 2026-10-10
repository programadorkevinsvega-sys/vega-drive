import type {
  IdentitySessionRecord,
  IdentitySessionRepository,
} from "../ports/identity-repositories.js";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  let hex = "";
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export async function hashRateKey(value: string): Promise<string> {
  return sha256Hex("vega-drive-auth-v1:" + value);
}

export async function createSession(
  userId: string,
  sessions: IdentitySessionRepository,
  now = new Date(),
): Promise<{ token: string; session: IdentitySessionRecord }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const timestamp = now.toISOString();
  const session: IdentitySessionRecord = {
    id: crypto.randomUUID(),
    userId,
    tokenHash: await sha256Hex(token),
    createdAt: timestamp,
    lastSeenAt: timestamp,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
  };
  await sessions.insert(session);
  return { token, session };
}
