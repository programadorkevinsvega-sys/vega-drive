# Files catalog search

## Endpoint

`GET /api/files/search` is available only to an authenticated session. The BFF derives the owner from the validated session actor. The request cannot select or override an owner.

| Query parameter | Required | Rules                                                   |
| --------------- | -------: | ------------------------------------------------------- |
| `q`             |      Yes | NFC-normalized, trimmed name fragment; 1–200 characters |
| `type`          |       No | `all` (default), `files`, or `folders`                  |
| `limit`         |       No | 1–100; defaults to 50                                   |
| `cursor`        |       No | Opaque cursor returned by the previous page             |

Unknown or repeated query parameters are rejected. Matching is case-insensitive for ASCII letters and treats `%`, `_`, and the escape character as literal user input.

## Response

The response contains `nodes` and `nextCursor`. Nodes are the public Files file/folder views; storage keys and owner identifiers are not returned. `nextCursor` is null when the result set is exhausted.

Results include active files and folders throughout the authenticated owner's active folder tree. Descendants of deleted, missing, or otherwise inactive folders are excluded. Ordering is stable by normalized name, folder before file for equal names, and then ID. The cursor encodes the final ordering tuple.

## Pagination

The cursor is opaque to clients and is bound to the last emitted ordering tuple. The service may scan additional bounded batches when it encounters records beneath inactive parent folders, so a page can remain complete without exposing those descendants.

## Boundaries

- Search persistence belongs to the Files module and uses its D1 repositories.
- The BFF performs authentication and strict query validation; it does not issue SQL.
- Every D1 query filters by the session-derived owner ID and binds user input as parameters.
- R2 is not queried; search returns metadata only.
- The frontend uses the same-origin BFF endpoint and never supplies an owner ID.
- Migration `0007_files_search_indexes.sql` adds owner-scoped indexes for active names. Applying it to a remote D1 database is part of the separately authorized deployment procedure.
