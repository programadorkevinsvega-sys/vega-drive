# D1 migration manifest

Database: `vega_drive_db` (binding `VEGA_DRIVE_DB`).

Wrangler applies migration files in lexicographic order from this directory when a migration command is explicitly run.

| Migration | Owner | Purpose | Status |
| --- | --- | --- | --- |
| `0001_initial_schema.sql` | identity + files | Initial tables and indexes for identity and files module boundaries | Draft; production schema and migration history must be inspected first |

## Deployment safety

- The normal deploy script remains `wrangler deploy`; remote migrations are not automatically applied by this repository yet.
- Do not change the production deploy command to apply remote migrations until the existing D1 schema and migration history have been inspected and reconciled with this SQL.
- A missing local Wrangler migrations directory does **not** prove the remote database has no tables.
- `CREATE TABLE IF NOT EXISTS` does not reconcile existing tables with incompatible columns or constraints.
- Migrations must be additive and compatible with the currently deployed Worker. Never use destructive SQL to make the schema match without a reviewed backup and rollback plan.
- Each module owns only its prefixed tables. Cross-module IDs are values and do not use foreign keys.
