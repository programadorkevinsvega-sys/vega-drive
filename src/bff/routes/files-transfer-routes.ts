import { Hono, type Context } from "hono";
import { createCompositionRoot } from "../../worker/composition-root.js";
import type { AuthenticatedEnv } from "../authentication-middleware.js";
import { requireAuthenticatedActor } from "../authentication-middleware.js";

const REQUEST_ERROR = { error: "Invalid file transfer request" } as const;
const ORIGIN_ERROR = { error: "Invalid request origin" } as const;

export const filesTransferRoutes = new Hono<AuthenticatedEnv>();
filesTransferRoutes.use("*", requireAuthenticatedActor);

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function actorFor(c: Context<AuthenticatedEnv>) {
  return { userId: c.get("actor").userId };
}

function transferError(reason: string, totalSizeBytes?: number): Response {
  switch (reason) {
    case "invalid-input":
    case "size-mismatch":
      return Response.json(
        { error: "Invalid file transfer request" },
        { status: 400 },
      );
    case "too-large":
      return Response.json(
        { error: "File exceeds the maximum allowed size" },
        { status: 413 },
      );
    case "not-found":
      return Response.json({ error: "File not found" }, { status: 404 });
    case "duplicate-name":
      return Response.json(
        { error: "A catalog item with that name already exists" },
        { status: 409 },
      );
    case "quota-exceeded":
      return Response.json({ error: "Storage limit reached" }, { status: 409 });
    case "rate-limited":
      return new Response(
        JSON.stringify({ error: "Too many file transfers" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Retry-After": "3600",
          },
        },
      );
    case "range-not-satisfiable":
      return new Response(JSON.stringify({ error: "Range not satisfiable" }), {
        status: 416,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Content-Range": "bytes */" + String(totalSizeBytes ?? 0),
          "Accept-Ranges": "bytes",
        },
      });
    default:
      return Response.json(
        { error: "File storage temporarily unavailable" },
        { status: 503 },
      );
  }
}

function contentDisposition(name: string): string {
  const fallback =
    name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "download";
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
  return (
    'attachment; filename="' + fallback + "\"; filename*=UTF-8''" + encoded
  );
}

filesTransferRoutes.post("/", async (c) => {
  const request = c.req.raw;
  if (new URL(request.url).searchParams.size > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  if (!originAllowed(request)) return c.json(ORIGIN_ERROR, 403);

  const encodedName = request.headers.get("X-File-Name");
  const declaredSize = request.headers.get("X-File-Size");
  if (
    !encodedName ||
    encodedName.length > 4096 ||
    !declaredSize ||
    !/^\d{1,16}$/.test(declaredSize)
  ) {
    return c.json(REQUEST_ERROR, 400);
  }

  let name: string;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    return c.json(REQUEST_ERROR, 400);
  }
  const sizeBytes = Number(declaredSize);
  if (!Number.isSafeInteger(sizeBytes)) return c.json(REQUEST_ERROR, 400);
  const contentLength = request.headers.get("Content-Length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) !== sizeBytes)
  ) {
    return c.json(REQUEST_ERROR, 400);
  }

  const folderId = request.headers.get("X-File-Folder-Id");
  const contentType =
    (request.headers.get("Content-Type") ?? "application/octet-stream")
      .split(";")[0]
      ?.trim()
      .toLowerCase() || "application/octet-stream";
  const result = await createCompositionRoot(c.env).files.uploadFile(
    actorFor(c),
    { name, folderId: folderId ?? null, sizeBytes, contentType },
    request.body,
  );
  if (!result.ok) return transferError(result.reason);
  return c.json(result.value, 201);
});

// prettier-ignore
filesTransferRoutes.post("/multipart", async (c) => {
  if (new URL(c.req.raw.url).searchParams.size > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  if (!originAllowed(c.req.raw)) return c.json(ORIGIN_ERROR, 403);
  const input = await c.req.json().catch(() => null);
  const result = await createCompositionRoot(c.env).files.beginMultipartUpload(
    actorFor(c),
    input,
  );
  if (!result.ok) return transferError(result.reason);
  return c.json(result.value, 201);
});

// prettier-ignore
filesTransferRoutes.put("/multipart/:id/parts/:partNumber", async (c) => {
  const request = c.req.raw;
  if (new URL(request.url).searchParams.size > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  if (!originAllowed(request)) return c.json(ORIGIN_ERROR, 403);
  const partNumber = Number(c.req.param("partNumber"));
  const declaredPartSize =
    request.headers.get("X-Part-Size") ?? request.headers.get("Content-Length");
  if (!declaredPartSize || !/^\d+$/.test(declaredPartSize)) {
    return c.json(REQUEST_ERROR, 400);
  }
  const sizeBytes = Number(declaredPartSize);
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > 16 * 1024 * 1024
  ) {
    return c.json(REQUEST_ERROR, 413);
  }
  const result = await createCompositionRoot(c.env).files.uploadMultipartPart(
    actorFor(c),
    c.req.param("id"),
    partNumber,
    request.body,
    sizeBytes,
  );
  if (!result.ok) return transferError(result.reason);
  return c.json(result.value, 200);
});

// prettier-ignore
filesTransferRoutes.post("/multipart/:id/complete", async (c) => {
  if (new URL(c.req.raw.url).searchParams.size > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  if (!originAllowed(c.req.raw)) return c.json(ORIGIN_ERROR, 403);
  const result = await createCompositionRoot(c.env).files.completeMultipartUpload(
    actorFor(c),
    c.req.param("id"),
  );
  if (!result.ok) return transferError(result.reason);
  return c.json(result.value, 201);
});

// prettier-ignore
filesTransferRoutes.post("/multipart/:id/abort", async (c) => {
  if (new URL(c.req.raw.url).searchParams.size > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  if (!originAllowed(c.req.raw)) return c.json(ORIGIN_ERROR, 403);
  const result = await createCompositionRoot(c.env).files.abortMultipartUpload(
    actorFor(c),
    c.req.param("id"),
  );
  if (!result.ok) return transferError(result.reason);
  return c.json({ ok: true }, 200);
});

filesTransferRoutes.get("/:id/download", async (c) => {
  if (new URL(c.req.raw.url).searchParams.size > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  const result = await createCompositionRoot(c.env).files.downloadFile(
    actorFor(c),
    c.req.param("id"),
    c.req.header("Range") ?? null,
  );
  if (!result.ok) {
    return transferError(result.reason, result.totalSizeBytes);
  }
  const file = result.value;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Disposition": contentDisposition(file.name),
    "Content-Length": String(file.contentLength),
    "Content-Type": file.contentType,
    "X-Content-Type-Options": "nosniff",
  });
  if (file.contentRange) headers.set("Content-Range", file.contentRange);
  return new Response(file.body, { status: file.status, headers });
});
