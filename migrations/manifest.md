# D1 migration manifest

Database: `vega_drive_db` (binding `VEGA_DRIVE_DB`).

The deployment workflow applies pending migrations before publishing the Worker, then lists the remote migration history to verify the recorded state. Wrangler applies migration files in lexicographic order from this directory and records applied migrations in D1's migration history.

## Migration inventory

### `0001_initial_schema.sql`

- **Owner:** identity + files
- **Purpose:** Initial tables and indexes for identity and files module boundaries
- **Status:** Versioned; the deployment command applies it when Wrangler reports it as pending.

## Deployment safety

- Use `pnpm run deploy` for production deployments. It applies pending remote migrations, lists the resulting migration history, deploys the Worker, and verifies `/api/health`.
- A missing local Wrangler migrations directory does **not** prove the remote database has no tables.
- `CREATE TABLE IF NOT EXISTS` does not reconcile existing tables with incompatible columns or constraints. Review existing production schema/history before first applying this initial migration to a database that may already contain application tables.
- Migrations must be additive and compatible with the currently deployed Worker. Never use destructive SQL to make the schema match without a reviewed backup and rollback plan.
- Each module owns only its prefixed tables. Cross-module IDs are values and do not use foreign keys.
- The migration list confirms Wrangler's recorded migration status; it does not validate every table column or constraint against application expectations.

## Rollback y compatibilidad

- Un rollback del Worker no revierte el historial ni los cambios ya aplicados en D1.
- Toda migración nueva debe evaluarse contra el código actualmente desplegado y la versión estable anterior.
- Durante la ventana de rollback, preferir expansión/contracción: añadir primero estructuras compatibles, desplegar código compatible, hacer backfill idempotente y retirar estructuras antiguas en un release separado.
- No editar migraciones aplicadas ni ejecutar `DROP` o cambios incompatibles como parte de una recuperación rutinaria.
- Antes de una migración de riesgo, confirmar backup disponible y procedimiento de restauración ensayado; restaurar D1 puede perder escrituras posteriores al punto de recuperación y requiere decisión operativa explícita.
- El proceso detallado está en [Rollback.md](../Rollback.md). Staging debe validar la migración y el rollback antes de aplicar cambios de riesgo en producción.
