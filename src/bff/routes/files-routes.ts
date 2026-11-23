import { Hono, type Context } from "hono";
import { createCompositionRoot } from "../../worker/composition-root.js";
import {
  requireAuthenticatedActor,
  type AuthenticatedEnv,
} from "../authentication-middleware.js";

const MAX_BODY_BYTES = 64 * 1024;
const ORIGIN_ERROR = { error: "Invalid request origin" } as const;
const REQUEST_ERROR = { error: "Invalid request" } as const;

type CatalogHttpResult =
  { ok: true; value: unknown } | { ok: false; reason: string };

export const filesRoutes = new Hono<AuthenticatedEnv>();

filesRoutes.use("*", requireAuthenticatedActor);

function actorFor(c: Context<AuthenticatedEnv>) {
  return { userId: c.get("actor").userId };
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function mutationRejection(c: Context<AuthenticatedEnv>): Response | null {
  const url = new URL(c.req.raw.url);
  if (Array.from(url.searchParams.keys()).length > 0) {
    return c.json(REQUEST_ERROR, 400);
  }
  if (!originAllowed(c.req.raw)) return c.json(ORIGIN_ERROR, 403);
  return null;
}

async function strictJson(
  request: Request,
  allowedKeys: string[],
): Promise<Record<string, unknown> | null> {
  const contentType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") return null;

  const contentLength = request.headers.get("Content-Length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
  ) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const body = parsed as Record<string, unknown>;
    return Object.keys(body).every((key) => allowedKeys.includes(key))
      ? body
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function queryRecord(
  request: Request,
  allowedKeys: string[],
): Record<string, string> | null {
  const params = new URL(request.url).searchParams;
  const query: Record<string, string> = {};
  for (const [key, value] of params) {
    if (!allowedKeys.includes(key) || Object.hasOwn(query, key)) return null;
    query[key] = value;
  }
  return query;
}

async function requestHasBody(request: Request): Promise<boolean> {
  const reader = request.body?.getReader();
  if (!reader) return false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.byteLength > 0) {
        await reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function catalogResponse(
  c: Context<AuthenticatedEnv>,
  result: CatalogHttpResult,
  successStatus: 200 | 201 = 200,
) {
  if (result.ok) {
    if (result.value === undefined) return c.json({ ok: true }, successStatus);
    return c.json(result.value as never, successStatus);
  }

  switch (result.reason) {
    case "invalid-input":
      return c.json({ error: "Invalid catalog request" }, 400);
    case "not-found":
      return c.json({ error: "Catalog item not found" }, 404);
    case "duplicate-name":
      return c.json(
        { error: "A catalog item with that name already exists" },
        409,
      );
    case "cycle":
      return c.json({ error: "Folder move would create a cycle" }, 409);
    case "unavailable":
      return c.json({ error: "Catalog temporarily unavailable" }, 503);
    default:
      return c.json({ error: "Unable to complete catalog request" }, 500);
  }
}

async function listFolder(c: Context<AuthenticatedEnv>) {
  const query = queryRecord(c.req.raw, ["folderId", "limit", "cursor"]);
  if (!query) return c.json(REQUEST_ERROR, 400);

  const input: Record<string, unknown> = {
    folderId: Object.hasOwn(query, "folderId") ? query.folderId : null,
  };
  if (Object.hasOwn(query, "limit")) input.limit = query.limit;
  if (Object.hasOwn(query, "cursor")) input.cursor = query.cursor;

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.listFolder(actorFor(c), input),
  );
}

async function listTrash(c: Context<AuthenticatedEnv>) {
  const query = queryRecord(c.req.raw, ["limit", "cursor"]);
  if (!query) return c.json(REQUEST_ERROR, 400);

  const input: Record<string, unknown> = {};
  if (Object.hasOwn(query, "limit")) input.limit = query.limit;
  if (Object.hasOwn(query, "cursor")) input.cursor = query.cursor;

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.listTrash(actorFor(c), input),
  );
}

filesRoutes.get("/", listFolder);
filesRoutes.get("", listFolder);
filesRoutes.get("/trash", listTrash);
filesRoutes.get("/favorites", async (c) => {
  const query = queryRecord(c.req.raw, ["limit", "cursor"]);
  if (!query) return c.json(REQUEST_ERROR, 400);
  const input: Record<string, unknown> = {};
  if (Object.hasOwn(query, "limit")) input.limit = query.limit;
  if (Object.hasOwn(query, "cursor")) input.cursor = query.cursor;
  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.listFavorites(actorFor(c), input),
  );
});

filesRoutes.post("/items/:id/favorite", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) return c.json(REQUEST_ERROR, 400);
  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.addFavorite(actorFor(c), c.req.param("id")),
  );
});

filesRoutes.delete("/items/:id/favorite", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) return c.json(REQUEST_ERROR, 400);
  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.removeFavorite(actorFor(c), c.req.param("id")),
  );
});

filesRoutes.get("/recent", async (c) => {
  const query = queryRecord(c.req.raw, ["limit", "cursor"]);
  if (!query) return c.json(REQUEST_ERROR, 400);
  const input: Record<string, unknown> = {};
  if (Object.hasOwn(query, "limit")) input.limit = query.limit;
  if (Object.hasOwn(query, "cursor")) input.cursor = query.cursor;
  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.listRecent(actorFor(c), input),
  );
});

filesRoutes.post("/items/:id/open", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) return c.json(REQUEST_ERROR, 400);
  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.recordRecentActivity(
      actorFor(c),
      c.req.param("id"),
      "open",
    ),
  );
});

filesRoutes.post("/trash/empty", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) return c.json(REQUEST_ERROR, 400);

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.emptyTrash(actorFor(c)),
  );
});

filesRoutes.post("/folders", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;

  const body = await strictJson(c.req.raw, ["name", "parentFolderId"]);
  if (!body) return c.json(REQUEST_ERROR, 400);

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.createFolder(actorFor(c), body),
    201,
  );
});

filesRoutes.patch("/folders/:id", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;

  const body = await strictJson(c.req.raw, ["name"]);
  if (!body) return c.json(REQUEST_ERROR, 400);

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.renameFolder(
      actorFor(c),
      c.req.param("id"),
      body.name,
    ),
  );
});

filesRoutes.post("/folders/:id/move", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;

  const body = await strictJson(c.req.raw, ["parentFolderId"]);
  if (!body || !Object.hasOwn(body, "parentFolderId")) {
    return c.json(REQUEST_ERROR, 400);
  }

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.moveFolder(
      actorFor(c),
      c.req.param("id"),
      body.parentFolderId,
    ),
  );
});

filesRoutes.delete("/folders/:id", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) {
    return c.json(REQUEST_ERROR, 400);
  }

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.deleteFolder(
      actorFor(c),
      c.req.param("id"),
    ),
  );
});

filesRoutes.post("/folders/:id/permanent-delete", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) return c.json(REQUEST_ERROR, 400);

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.permanentlyDeleteFolder(
      actorFor(c),
      c.req.param("id"),
    ),
  );
});

filesRoutes.post("/trash/folders/:id/restore", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) {
    return c.json(REQUEST_ERROR, 400);
  }

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.restoreFolder(
      actorFor(c),
      c.req.param("id"),
    ),
  );
});

filesRoutes.patch("/items/:id", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;

  const body = await strictJson(c.req.raw, ["name"]);
  if (!body) return c.json(REQUEST_ERROR, 400);

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.renameFile(
      actorFor(c),
      c.req.param("id"),
      body.name,
    ),
  );
});

filesRoutes.post("/items/:id/move", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;

  const body = await strictJson(c.req.raw, ["folderId"]);
  if (!body || !Object.hasOwn(body, "folderId")) {
    return c.json(REQUEST_ERROR, 400);
  }

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.moveFile(
      actorFor(c),
      c.req.param("id"),
      body.folderId,
    ),
  );
});

filesRoutes.delete("/items/:id", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) {
    return c.json(REQUEST_ERROR, 400);
  }

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.deleteFile(
      actorFor(c),
      c.req.param("id"),
    ),
  );
});

filesRoutes.post("/items/:id/permanent-delete", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) return c.json(REQUEST_ERROR, 400);

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.permanentlyDeleteFile(
      actorFor(c),
      c.req.param("id"),
    ),
  );
});

filesRoutes.post("/trash/items/:id/restore", async (c) => {
  const rejected = mutationRejection(c);
  if (rejected) return rejected;
  if (await requestHasBody(c.req.raw)) {
    return c.json(REQUEST_ERROR, 400);
  }

  return catalogResponse(
    c,
    await createCompositionRoot(c.env).files.restoreFile(
      actorFor(c),
      c.req.param("id"),
    ),
  );
});
