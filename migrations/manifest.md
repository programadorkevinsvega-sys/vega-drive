# D1 migration manifest

Database: `vega_drive_db` (binding `VEGA_DRIVE_DB`).

Migrations are applied in lexicographic order by Wrangler from this directory.

| Migration | Owner | Purpose | Status |
| --- | --- | --- | --- |
| `0001_initial_schema.sql` | identity + files | Initial tables and indexes for the identity and files module boundaries | Draft; inspect remote schema before production use |

## Deployment safety

- The deployment script applies pending migrations remotely before running `wrangler deploy`.
- Cloudflare Workers Builds must use `pnpm run deploy` as its deploy command; the old direct `pnpm exec wrangler deploy` bypasses D1 migrations.
- Before changing the production deploy command, inspect the remote D1 schema and migration history. A missing Wrangler migrations directory does **not** mean the database has no tables.
- Migrations must be additive and compatible with the currently deployed Worker. Never use destructive SQL to make the schema match without a reviewed backup/rollback plan.
- Each module owns only its prefixed tables. Cross-module IDs are values and do not use foreign keys.
