# Manifest central de migraciones D1

Base de datos única: `vega_drive_db`, vinculada como `VEGA_DRIVE_DB`.

## Descubrimiento y orden activo

Wrangler lee `migrations_dir = "src/modules"` y aplica los archivos que coinciden con `migrations_pattern = "src/modules/*/infrastructure/persistence/d1/migrations/*.sql"`, configurado en `wrangler.toml`. El nombre registrado en `d1_migrations` es la ruta relativa a `src/modules`, por lo que cada módulo puede empezar su numeración en `0001` sin colisionar con la de otro módulo.

Wrangler ordena las rutas de forma lexicográfica. El orden actual es:

1. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0001_files_initial.sql`.
   - Tablas: `files_items`, `files_folders`, `files_uploads` y `files_outbox`.

2. **Propietario: `identity`**
   - Migración: `identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql`.
   - Tablas: `identity_users`, `identity_sessions`, `identity_invites` e `identity_outbox`.

El orden no establece dependencias entre módulos. Los IDs entre módulos son valores, nunca claves foráneas; no hay tablas genéricas compartidas, JOIN ni SQL cruzado. Los índices se definen en la migración del mismo propietario que la tabla indexada. `quota_usage` y `sharing_links` se crearán en las fases 6 y 7, respectivamente.

## Migración histórica conservada

`migrations/0001_initial_schema.sql` es la migración inicial conjunta que existía antes de separar la propiedad por módulo. Se conserva **sin modificar ni eliminar** para preservar el historial de código y despliegue, pero el patrón activo de Wrangler ya no la descubre. No se debe usar como destino de cambios nuevos. Las migraciones modulares actuales reproducen sus definiciones de `identity` y `files`; su DDL usa `CREATE ... IF NOT EXISTS` para ser compatible con una D1 que ya contenga esas tablas.

## Despliegue y verificación

- `pnpm run db:migrate:local` aplica las migraciones modulares al D1 local.
- `pnpm run db:migrate:production` aplica las migraciones modulares a D1 remota; úsalo únicamente como parte del procedimiento de despliegue revisado.
- `pnpm run db:migration:list` enumera migraciones pendientes según el patrón activo de Wrangler.
- `pnpm run db:verify:schema:production` compara las tablas e índices reales de `sqlite_schema` con el resultado esperado de las migraciones modulares.
- `pnpm run deploy` es el comando de despliegue documentado: migraciones remotas, historial, verificación estructural, publicación del Worker y comprobación de `/api/health`.

Una migración nueva debe ser propiedad de un módulo, permanecer dentro de su directorio y ser aditiva y compatible con el Worker desplegado durante la ventana de rollback. Nunca edites una migración que ya se haya aplicado en un entorno compartido. No ejecutes migraciones remotas ni alteres datos de producción durante una validación local.

El verificador estructural rechaza DDL que todavía no pueda modelar, objetos incompatibles u objetos inesperados. Si se necesita `ALTER`, `DROP` u otra operación no admitida, primero amplía y prueba el verificador para representar explícitamente el esquema final. La lista de Wrangler demuestra el historial de migraciones, no la compatibilidad de columnas y restricciones ni la seguridad funcional de la aplicación.

## Compatibilidad y rollback

Un rollback del Worker no revierte D1. Usa expansión/contracción: añade estructuras compatibles primero, despliega código compatible, realiza backfills idempotentes y retira estructuras obsoletas en otro release, cuando ninguna versión anterior las necesite. Antes de cambios de riesgo, revisa el esquema remoto, backups y el procedimiento de restauración según [Rollback.md](../Rollback.md).
