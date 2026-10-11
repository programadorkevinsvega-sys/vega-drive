# Vega Drive

Sistema privado de almacenamiento de archivos sobre Cloudflare, diseñado para un máximo de 10 clientes y aislamiento estricto entre cuentas.

> **Estado real (2026-10-10):** las Fases 0 y 1 están cerradas y la Fase 2 de identity quedó implementada y aceptada: registro, login, logout, resolución de sesión y cambio de contraseña; Turnstile se valida en el servidor. El propietario confirmó en producción la aceptación con tokens válidos e inválidos y la rotación/revocación de sesiones tras cambiar la contraseña. La aplicación de archivos todavía no está lista para almacenar datos reales: el catálogo, las transferencias con R2, las cuotas y la compartición siguen pendientes. La certificación global de seguridad y el procedimiento de rollback también continúan pendientes.

## Arquitectura

Vega Drive se diseña como un monolito modular serverless:

- Un único Cloudflare Worker y un único origen para frontend y API.
- Una única D1 con binding `VEGA_DRIVE_DB`.
- Un bucket R2 privado con binding `FILES_BUCKET`.
- El navegador solo consume rutas del mismo origen bajo `/api`; nunca accede directamente a R2.
- Los módulos previstos son `identity`, `files`, `quota` y `sharing`. Cada módulo debe poseer sus tablas con prefijo, migraciones, dominio y API pública.
- Los módulos solo se comunican mediante sus API públicas y gateways. No se permiten JOIN, claves foráneas ni SQL entre prefijos de módulos.

El contrato arquitectónico está en [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md), los controles de seguridad en [Security.md](./Security.md), el procedimiento de recuperación en [Rollback.md](./Rollback.md) y el plan por fases en [roadmap.md](./roadmap.md).

## Rollback y recuperación

La política de rollback del Worker, compatibilidad de D1/R2, staging y evidencia operativa está en [Rollback.md](./Rollback.md), y su implementación planificada en la [Fase 9 del roadmap](./roadmap.md#fase-9--despliegue-operación-y-rollback).

**El rollback aún no está certificado.** El flujo actual `pnpm run deploy` aplica migraciones remotas antes de desplegar el Worker y solo verifica `/api/health` después. Revertir el Worker no deshace migraciones D1 ni restaura objetos R2. No ejecutar un rollback de producción sin identificar el deployment objetivo y comprobar compatibilidad del esquema.

## Estado de seguridad y certificación

Las reglas obligatorias, los headers esperados para Workers/Hono y la matriz de regresión están en [Security.md](./Security.md). El roadmap detalla el trabajo de certificación en la [Fase 8](./roadmap.md#fase-8--endurecimiento-y-pruebas-de-seguridad).

**La certificación global de seguridad permanece pendiente.** Un build correcto, la verificación de esquema D1 y una respuesta HTTP 200 de `/api/health` son señales útiles de despliegue, pero no prueban autenticación, autorización, aislamiento entre cuentas ni transferencias seguras. No habilites usuarios reales hasta implementar y probar los flujos correspondientes.

La autenticación y la resolución de sesión del módulo `identity` están implementadas y probadas. Siguen pendientes el adaptador de almacenamiento real, el catálogo de archivos y la autorización por recurso en las operaciones de `files`. El endpoint `/api/health` es una comprobación de liveness, no prueba que D1 o R2 estén operativos.

## Flujo de archivos previsto

1. El frontend envía el archivo a `POST /api/files`.
2. El BFF valida la petición y la sesión y llama a `FilesGateway`.
3. El módulo `files` valida autorización, cuota, nombre y tamaño.
4. El adaptador privado transmite el objeto a R2.
5. El módulo registra los metadatos y devuelve un resultado seguro.

Las descargas se harán por `GET /api/files/:id/download`, tras autorizar el recurso y transmitir el contenido desde el Worker. Este flujo todavía no está implementado.

## Estructura

- `src/worker`: entrada del Worker.
- `src/bff`: Hono y composition root.
- `src/modules/identity`, `files`, `quota` y `sharing`: límites y APIs públicas de módulos.
- `src/modules/identity/application/ports` y `src/modules/files/application/ports`: contratos de repositorios sin dependencias de Cloudflare.
- `src/modules/{identity,files}/infrastructure/persistence/d1`: adaptadores y migraciones D1 propietarios del módulo.
- `src/platform`: infraestructura técnica compartida.
- `src/shared-kernel`: abstracciones compartidas mínimas.
- `public`: assets estáticos.
- `tests`: pruebas de salud, configuración, migraciones, repositorios y arquitectura.

El módulo `identity` ya implementa registro/login, logout, resolución de sesión y cambio de contraseña mediante sus APIs reales. El módulo `files` conserva la base de persistencia, pero el catálogo y las transferencias no están implementados.

## Servicios Cloudflare

- Backend, BFF y assets: Cloudflare Workers.
- Metadatos, usuarios y sesiones: D1 mediante `VEGA_DRIVE_DB`.
- Archivos: R2 privado mediante `FILES_BUCKET`.
- Anti-bots: Turnstile integrado en registro/login; configuración de producción y aceptación de tokens válidos e inválidos confirmadas el 2026-10-10.

El esquema de D1 para `identity` y `files` está versionado en migraciones independientes por módulo y se comprueba con `pnpm run db:verify:schema:local` o `pnpm run db:verify:schema:production`. La existencia de un binding, por sí sola, no prueba que el esquema real coincida con las migraciones ni que el bucket R2 sea privado. Verifica en Cloudflare que R2 no tenga acceso público, dominio público, `r2.dev` ni CORS de navegador.

## Desarrollo

Requisitos: Node.js 22.13+ y pnpm 10.18.3. La suite de aislamiento usa `node:sqlite`, disponible sin bandera experimental desde Node 22.13.

```bash
pnpm install --frozen-lockfile
pnpm run dev
pnpm run check
```

No guardes secretos en Git ni en `wrangler.toml`. Configura secretos de Worker mediante Wrangler, por ejemplo:

```bash
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

La clave de sitio de Turnstile es pública; la clave secreta nunca debe incluirse en el frontend ni en archivos versionados.

## Comprobaciones, migraciones y CI

`pnpm run check` ejecuta formato, guardia arquitectónica, TypeScript y pruebas. `pnpm run cloudflare:build` ejecuta primero `pnpm run deploy:preflight`, después todas las comprobaciones y finalmente `pnpm audit --audit-level=high`; debe usarse como comando de build de Cloudflare Workers Builds, junto con la instalación reproducible `pnpm install --frozen-lockfile`.

`pnpm run deploy:preflight` comprueba la configuración de Cloudflare, la propiedad y ubicación de cada migración con `scripts/check-module-migrations.mjs`, y las fronteras entre módulos con `scripts/architecture-check.mjs`. Si falla cualquiera de las guardias, termina antes de consultar o mutar la D1 remota. El comando `pnpm run deploy` ejecuta explícitamente ese gate antes de `db:migrate:production`; no uses `pnpm exec wrangler deploy` como comando de publicación.

El comando de despliegue de producción de Cloudflare Workers Builds debe ser **`pnpm run deploy`**, no `pnpm exec wrangler deploy`. El script ejecuta, en orden:

0. `pnpm run deploy:preflight` valida los bindings, la ubicación y prefijos de tablas/índices de las migraciones y las reglas arquitectónicas. Cualquier infracción bloquea los pasos remotos posteriores.
1. `wrangler d1 migrations apply vega_drive_db --remote` para aplicar migraciones pendientes.
2. `wrangler d1 migrations list vega_drive_db --remote` para comprobar el historial registrado.
3. `scripts/verify-d1-schema.mjs` inspecciona `sqlite_schema` en la D1 remota y compara tablas e índices con las definiciones SQL versionadas; detecta objetos ausentes, definiciones incompatibles y objetos inesperados. Si hay diferencias, termina con error y bloquea el despliegue.
4. `wrangler deploy` publica el Worker solo si los pasos anteriores terminan correctamente.
5. `pnpm run verify:production` comprueba que `/api/health` responde con HTTP 200 y el JSON esperado.

Las migraciones activas viven junto a su módulo en `src/modules/<módulo>/infrastructure/persistence/d1/migrations/`. Wrangler descubre `src/modules/*/infrastructure/persistence/d1/migrations/*.sql`; `migrations/manifest.md` documenta el orden de aplicación y cada módulo mantiene su propia numeración. `migrations/0001_initial_schema.sql` se conserva intacta como migración histórica conjunta, pero queda fuera del patrón activo.

`pnpm run db:migrate:local` aplica las migraciones modulares al D1 local y `pnpm run db:verify:schema:local` compara el esquema local con `sqlite_schema` sin usar producción. `pnpm run db:verify:schema:production` consulta explícitamente la D1 remota. La verificación estructural compara las definiciones SQL de las migraciones activas con `sqlite_schema`; por seguridad, si se añade una migración con `ALTER`, `DROP` u otro DDL no admitido por el verificador, el despliegue se detendrá hasta actualizar el verificador para modelar el esquema final esperado. Las tablas o índices creados manualmente también se reportan como inesperados y requieren reconciliación intencional. La comprobación no sustituye pruebas funcionales de la aplicación ni valida datos de negocio.

GitHub Actions ejecuta las comprobaciones complementarias y Gitleaks; la ejecución del commit `23329baa646e38ecc816620c68eef8f861ae49b5` terminó correctamente, con 4 archivos/12 tests aprobados y sin secretos detectados. Cloudflare Workers Builds también ejecutó correctamente `pnpm run cloudflare:build` y `pnpm run deploy` el 2026-10-10, incluidas migraciones, verificación estructural D1 y smoke check de producción. Son ejecuciones separadas; no se asume que el commit de CI y el artefacto desplegado sean el mismo commit porque el log de despliegue aportado no incluye el SHA del commit.

## Estado de Fase 0 y preparación para producción

**Fase 0: CERRADA (2026-10-10), dentro de su alcance fundacional.** El contrato, el esqueleto del Worker, los bindings base, el build, las pruebas, CI y el despliegue están verificados. Los pendientes operativos que dependen de funciones aún no implementadas se asignan a las fases que las incorporan; no bloquean el cierre de Fase 0. Evidencia del 2026-10-10: Cloudflare completó `pnpm run cloudflare:build` y `pnpm run deploy`; los 4 archivos de pruebas (12 tests), el typecheck, el control arquitectónico y `pnpm audit --audit-level=high` pasaron. D1 no tenía migraciones pendientes y la verificación remota confirmó 17 tablas/índices. La versión Worker desplegada más reciente registrada a las 07:13 UTC fue `a6bb5609-9afd-4566-b298-d0b3178c5698`, y `/api/health` respondió HTTP 200. GitHub Actions para el commit `23329baa646e38ecc816620c68eef8f861ae49b5` quedó verde (29 s), con 4 archivos/12 tests aprobados y Gitleaks sin fugas detectadas. El usuario confirmó en el panel que el bucket R2 es privado.

Como tareas de fases posteriores, antes de implementar transferencias en la Fase 4 se verificará que R2 no tenga dominio público ni `r2.dev` ni CORS de navegador y se confirmarán los permisos mínimos del adaptador. Turnstile y su secreto quedaron configurados y validados durante la Fase 2. No se deben inferir esos ajustes de un binding o de un escaneo de repositorio; se mantienen como requisitos antes de habilitar esas funciones, pero no bloquean el cierre fundacional de Fase 0.

El despliegue no certifica que Vega Drive esté lista para almacenar archivos con datos reales. Registro/login, sesiones, cambio de contraseña y Turnstile ya están implementados y aceptados en la Fase 2; siguen pendientes el catálogo y las transferencias de archivos, la autorización por recurso, las pruebas de aislamiento de las operaciones funcionales y la certificación global de seguridad y rollback según [Security.md](./Security.md) y [Rollback.md](./Rollback.md). Las fases posteriores describen trabajo futuro, no funcionalidades de archivos ya implementadas.
