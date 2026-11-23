import { requestJson, sendJson, sendNoBody } from "./files-http-client";

export interface ShareEntry {
  id: string;
  itemId: string;
  fileName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  passwordProtected: boolean;
}
export interface CreatedShare extends ShareEntry {
  token: string;
  permission: "read";
}
export function createShare(
  itemId: string,
  expiresInSeconds: number,
  password?: string,
): Promise<CreatedShare> {
  return sendJson<CreatedShare>("/api/shares", "POST", {
    itemId,
    expiresInSeconds,
    ...(password ? { password } : {}),
  });
}
export function listShares(): Promise<{ shares: ShareEntry[] }> {
  return requestJson<{ shares: ShareEntry[] }>("/api/shares");
}
export function revokeShare(id: string): Promise<{ revoked: true }> {
  return sendNoBody<{ revoked: true }>(
    "/api/shares/" + encodeURIComponent(id),
    "DELETE",
  );
}
