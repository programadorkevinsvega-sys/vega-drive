/**
 * Minimal AWS Signature Version 4 presigner for Cloudflare R2.
 * This module is server-only; callers must authorize each operation first.
 */
export interface R2SigningConfig {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface R2PresignInput {
  method: "GET" | "PUT";
  key: string;
  expiresInSeconds: number;
  query?: Record<string, string>;
  contentType?: string;
  ifNoneMatch?: string;
  contentLength?: number;
}

const encoder = new TextEncoder();
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function amzDate(date: Date): { timestamp: string; day: string } {
  const value = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { timestamp: value, day: value.slice(0, 8) };
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  value: string,
): Promise<ArrayBuffer> {
  const rawKey =
    key instanceof Uint8Array
      ? new Uint8Array(key)
      : new Uint8Array(key as ArrayBuffer);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function signingKey(secret: string, day: string): Promise<ArrayBuffer> {
  const dateKey = await hmac(encoder.encode("AWS4" + secret), day);
  const regionKey = await hmac(dateKey, AWS_REGION);
  const serviceKey = await hmac(regionKey, AWS_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

/** Returns a short-lived URL for one method and one exact object key. */
export async function presignR2Object(
  config: R2SigningConfig,
  input: R2PresignInput,
  now = new Date(),
): Promise<string> {
  if (
    (input.method !== "GET" && input.method !== "PUT") ||
    !/^[a-f0-9]{32}$/i.test(config.accountId) ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucketName) ||
    !config.accessKeyId ||
    /[\r\n\u0000-\u001f\u007f]/.test(config.accessKeyId) ||
    !config.secretAccessKey ||
    /[\r\n\u0000-\u001f\u007f]/.test(config.secretAccessKey) ||
    !input.key ||
    input.key.startsWith("/") ||
    input.key.includes("\\") ||
    input.key
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..") ||
    /[\u0000-\u001f\u007f]/.test(input.key) ||
    (input.contentType !== undefined &&
      (!input.contentType ||
        /[\r\n\u0000-\u001f\u007f]/.test(input.contentType))) ||
    (input.ifNoneMatch !== undefined &&
      (!input.ifNoneMatch ||
        /[\r\n\u0000-\u001f\u007f]/.test(input.ifNoneMatch))) ||
    (input.contentLength !== undefined &&
      (!Number.isSafeInteger(input.contentLength) ||
        input.contentLength < 0)) ||
    !Number.isSafeInteger(input.expiresInSeconds) ||
    input.expiresInSeconds < 1 ||
    input.expiresInSeconds > 900 ||
    !Number.isFinite(now.getTime()) ||
    Object.entries(input.query ?? {}).some(
      ([key, value]) =>
        !key ||
        !value ||
        /[\r\n\u0000-\u001f\u007f]/.test(key + value) ||
        /^x-amz-/i.test(key),
    )
  ) {
    throw new Error("Invalid R2 presign configuration");
  }

  const { timestamp, day } = amzDate(now);
  const host = config.accountId + ".r2.cloudflarestorage.com";
  const path =
    "/" +
    encode(config.bucketName) +
    "/" +
    input.key.split("/").map(encode).join("/");
  const scope = day + "/" + AWS_REGION + "/" + AWS_SERVICE + "/aws4_request";
  const signedHeaders = [
    ...(input.contentLength !== undefined ? ["content-length"] : []),
    ...(input.contentType ? ["content-type"] : []),
    ...(input.ifNoneMatch ? ["if-none-match"] : []),
    "host",
  ].join(";");
  const query: Record<string, string> = {
    ...(input.query ?? {}),
    "X-Amz-Algorithm": AWS_ALGORITHM,
    "X-Amz-Credential": config.accessKeyId + "/" + scope,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(input.expiresInSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => encode(key) + "=" + encode(value))
    .join("&");
  const canonicalHeaders = [
    ...(input.contentLength !== undefined
      ? ["content-length:" + String(input.contentLength)]
      : []),
    ...(input.contentType ? ["content-type:" + input.contentType] : []),
    ...(input.ifNoneMatch ? ["if-none-match:" + input.ifNoneMatch] : []),
    "host:" + host,
  ].join("\n");
  const canonicalRequest = [
    input.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const requestHash = hex(
    await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)),
  );
  const stringToSign = [AWS_ALGORITHM, timestamp, scope, requestHash].join(
    "\n",
  );
  const key = await signingKey(config.secretAccessKey, day);
  const signature = hex(await hmac(key, stringToSign));
  return (
    "https://" +
    host +
    path +
    "?" +
    canonicalQuery +
    "&X-Amz-Signature=" +
    signature
  );
}
