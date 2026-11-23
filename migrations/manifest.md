# Manifest central de migraciones D1

Base de datos única: `vega_drive_db`, vinculada como `VEGA_DRIVE_DB`.

## Descubrimiento y orden activo

Wrangler lee `migrations_dir = "src/modules"` y aplica los archivos que coinciden con `migrations_pattern = "src/modules/*/infrastructure/persistence/d1/migrations/*.sql"`, configurado en `wrangler.toml`. El nombre registrado en `d1_migrations` es la ruta relativa a `src/modules`, por lo que cada módulo puede empezar su numeración en `0001` sin colisionar con la de otro módulo.

Wrangler ordena las rutas de forma lexicográfica. El orden actual es:

1. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0001_files_initial.sql`.
   - Tablas: `files_items`, `files_folders`, `files_uploads` y `files_outbox`.

2. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql`.
   - Tabla `files_catalog_names` con unicidad por propietario, padre y nombre normalizado; coordina los nombres activos entre carpetas y archivos.
   - Índices únicos parciales adicionales en ambas tablas de nodos.

3. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql`.
   - Tabla e índices: `files_transfer_events`, `files_transfer_owner_kind_time_idx` y `files_transfer_time_idx`; registra límites temporales de transferencias dentro del módulo propietario.

4. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0004_files_multipart_uploads.sql`.
   - Tablas e índices: `files_multipart_uploads` y `files_multipart_parts`; conservan la propiedad del usuario, el estado R2 y los ETags/tamaños de las partes para completar o limpiar subidas grandes.

5. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0005_files_recent_activity.sql`.
   - Tabla e índice: `files_recent_activity` y `files_recent_owner_activity_idx`; registran por propietario la última apertura o descarga de cada elemento del catálogo.

6. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0006_files_favorites.sql`.
   - Tabla e índice: `files_favorites` y `files_favorites_owner_time_idx`; registran por propietario los archivos marcados como favoritos, sin claves foráneas entre módulos.

7. **Propietario: `files`**
   - Migración: `files/infrastructure/persistence/d1/migrations/0007_files_search_indexes.sql`.
   - Índices parciales por propietario y nombre activo para búsquedas del catálogo.

8. **Propietario: `identity`**
   - Migración: `identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql`.
   - Tablas: `identity_users`, `identity_sessions`, `identity_invites` e `identity_outbox`.

9. **Propietario: `identity`**
   - Migración: `identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql`.
   - Tabla e índice: `identity_auth_attempts` e `identity_auth_attempts_locked_until_idx`; las claves de limitación se guardan como hashes.

10. **Propietario: `sharing`**

- Migración: `sharing/infrastructure/persistence/d1/migrations/0001_sharing_initial.sql`.
- Tablas e índices: `sharing_links`, `sharing_links_owner_created_idx`, `sharing_links_expiry_idx` y `sharing_password_attempts`; guardan hashes de tokens, vencimiento, revocación y contadores de intentos de contraseña. No almacenan tokens en claro ni crean claves foráneas hacia `files`.

El orden no establece dependencias entre módulos. Los IDs entre módulos son valores, nunca claves foráneas; no hay tablas genéricas compartidas, JOIN ni SQL cruzado. Los índices se definen en la migración del mismo propietario que la tabla indexada. El catálogo reserva el nombre en `files_catalog_names` antes de crear o restaurar y actualiza la reserva antes de renombrar o mover. La clave única cubre ambos tipos de nodo. Las modificaciones de reserva y metadatos son escrituras separadas, por lo que el código compensa reservas si falla la segunda operación; no se usa `db.batch()` para coordinarlas. `quota_usage` queda pendiente para la Fase 6; la Fase 7 incorpora `sharing_links` y `sharing_password_attempts`.

## Migración histórica conservada

`migrations/0001_initial_schema.sql` es la migración inicial conjunta que existía antes de separar la propiedad por módulo. Se conserva **sin modificar ni eliminar** para preservar el historial de código y despliegue, pero el patrón activo de Wrangler ya no la descubre. No se debe usar como destino de cambios nuevos. Las migraciones modulares actuales reproducen sus definiciones de `identity` y `files`; su DDL usa `CREATE ... IF NOT EXISTS` para ser compatible con una D1 que ya contenga esas tablas.

## Despliegue y verificación

Antes de cualquier migración remota, `pnpm run deploy:preflight` ejecuta tres controles: configuración Cloudflare, `scripts/check-module-migrations.mjs` (ubicación, patrón Wrangler y prefijos propietarios de tablas/índices) y `scripts/architecture-check.mjs` (fronteras e imports entre módulos). Una infracción detiene `pnpm run deploy` antes de alterar D1 remota. El archivo histórico `migrations/0001_initial_schema.sql` permanece fuera del patrón activo y no es una fuente de migraciones nuevas.

- `pnpm run db:migrate:local` aplica las migraciones modulares a la D1 local.
- `pnpm run db:verify:schema:local` comprueba el esquema local sin conectarse a producción.
- `pnpm run db:migrate:production` aplica las migraciones modulares a D1 remota; úsalo únicamente como parte del procedimiento de despliegue revisado.
- `pnpm run db:migration:list` enumera migraciones pendientes según el patrón activo de Wrangler.
- `pnpm run db:verify:schema:production` consulta explícitamente la D1 remota y compara tablas e índices con las migraciones modulares.
- `pnpm run deploy` es el comando de despliegue documentado: migraciones remotas, historial, verificación estructural, publicación del Worker y comprobación de `/api/health`.

Una migración nueva debe ser propiedad de un módulo, permanecer dentro de su directorio y ser aditiva y compatible con el Worker desplegado durante la ventana de rollback. Nunca edites una migración que ya se haya aplicado en un entorno compartido. No ejecutes migraciones remotas ni alteres datos de producción durante una validación local.

El verificador estructural rechaza DDL que todavía no pueda modelar, objetos incompatibles u objetos inesperados. Si se necesita `ALTER`, `DROP` u otra operación no admitida, primero amplía y prueba el verificador para representar explícitamente el esquema final. La lista de Wrangler demuestra el historial de migraciones, no la compatibilidad de columnas y restricciones ni la seguridad funcional de la aplicación.

## Incidencia de verificación local resuelta

El 2026-10-11, `pnpm run db:verify:schema:local` detectó objetos ausentes de las migraciones de `files` e `identity`. Se aplicaron únicamente en la D1 local las migraciones modulares pendientes `files/.../0002_files_catalog_names.sql` e `identity/.../0002_identity_auth_attempts.sql`. La verificación posterior pasó con `25 tables/indexes match migrations in vega_drive_db (local)`.

El incidente y la evidencia se documentan en [FILES_PHASE_3.md](../FILES_PHASE_3.md). Esta reconciliación no modificó D1 remota ni demuestra por sí sola el cierre de la Fase 3; siguen siendo obligatorias las pruebas funcionales y de aislamiento descritas en el documento de fase.

## Compatibilidad y rollback

Un rollback del Worker no revierte D1. Usa expansión/contracción: añade estructuras compatibles primero, despliega código compatible, realiza backfills idempotentes y retira estructuras obsoletas en otro release, cuando ninguna versión anterior las necesite. Antes de cambios de riesgo, revisa el esquema remoto, backups y el procedimiento de restauración según [Rollback.md](../Rollback.md).
