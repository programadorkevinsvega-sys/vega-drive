# Vega Drive

Sistema privado de almacenamiento de archivos sobre Cloudflare, diseñado para un máximo de 10 clientes y aislamiento estricto entre cuentas.

> **Estado real (2026-10-12):** las Fases 0, 1 y 2 están cerradas; la Fase 3 del catálogo está implementada y validada, y la Fase 4 de transferencias privadas con R2 tiene registradas como completadas sus validaciones operativas. Mi unidad, carpetas y papelera están conectadas al BFF autenticado; la pantalla de Mi unidad incluye controles frontend de transferencia. La Fase 5 sigue en curso: Recientes ya tiene contrato autenticado, persistencia por propietario y pantalla conectada (su migración aún requiere aplicación autorizada); Favoritos y Búsqueda siguen siendo placeholders. Faltan auditoría completa de presentación/accesibilidad, evidencia HTTP de assets/cabeceras, pruebas E2E de integración UI-transferencias y verificación automatizada del composition root. Cuotas (Fase 6), compartición (Fase 7), certificación global (Fase 8) y rollback/operación (Fase 9) siguen pendientes. Ver [FRONTEND_BFF_PHASE_5.md](./FRONTEND_BFF_PHASE_5.md).

## Arquitectura

Vega Drive se diseña como un monolito modular serverless:

- Un único Cloudflare Worker y un único origen para frontend y API.
- Una única D1 con binding `VEGA_DRIVE_DB`.
- Un bucket R2 privado con binding `FILES_BUCKET`.
- El navegador solo consume rutas del mismo origen bajo `/api`; nunca accede directamente a R2.
- Los módulos previstos son `identity`, `files`, `quota` y `sharing`. Cada módulo debe poseer sus tablas con prefijo, migraciones, dominio y API pública.
- Los módulos solo se comunican mediante sus API públicas y gateways. No se permiten JOIN, claves foráneas ni SQL entre prefijos de módulos.

El contrato arquitectónico está en [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md), los controles de seguridad en [Security.md](./Security.md), el procedimiento de recuperación en [Rollback.md](./Rollback.md) y el plan por fases en [roadmap.md](./roadmap.md).

## Operación, rollback y recuperación

El procedimiento de producción (sin entorno staging), la compatibilidad D1/R2, el runbook de rollback del Worker y el registro de incidentes están en [Rollback.md](./Rollback.md). La Fase 9 del [roadmap](./roadmap.md) añade verificaciones posteriores al despliegue para frontend, health, configuración de autenticación y cabeceras de seguridad.

**El rollback y la restauración de D1 aún no están certificados mediante una ejecución real.** El comando `pnpm run deploy` aplica migraciones remotas antes de publicar el Worker y verifica el frontend, `/api/health`, `/api/auth/config` y las cabeceras requeridas. Revertir el Worker no deshace migraciones D1 ni restaura objetos R2. No ejecutar un rollback de producción sin identificar el deployment objetivo y comprobar compatibilidad del esquema.

## Estado de seguridad y certificación

Las reglas obligatorias, los headers esperados para Workers/Hono y la matriz de regresión están en [Security.md](./Security.md). El roadmap detalla el trabajo de certificación en la [Fase 8](./roadmap.md#fase-8--endurecimiento-y-pruebas-de-seguridad).

**La certificación global de seguridad permanece pendiente.** Un build correcto, la verificación de esquema D1 y una respuesta HTTP 200 de `/api/health` son señales útiles de despliegue, pero no prueban por sí solas autenticación, autorización, aislamiento entre cuentas ni todos los flujos. Las validaciones operativas de R2 de la Fase 4 se registraron como completadas el 2026-10-12; esto no equivale a la certificación transversal de la Fase 8.

La autenticación y la resolución de sesión de `identity` están implementadas y probadas. El catálogo de `files` se consume desde Mi unidad y Papelera mediante rutas HTTP privadas sobre `FilesGateway`; el actor se obtiene de la sesión validada. El código de transferencia física con R2 está implementado y sus validaciones operativas están registradas en [FILES_PHASE_4.md](./FILES_PHASE_4.md). En Fase 5 siguen pendientes recientes, favoritos, búsqueda y evidencia E2E de integración de la interfaz. `/api/health` es una comprobación de liveness, no prueba que D1 o R2 estén operativos.

## Flujo de archivos previsto

1. El frontend envía el archivo a `POST /api/files`.
2. El BFF valida la petición y la sesión y llama a `FilesGateway`.
3. El módulo `files` valida autorización, cuota, nombre y tamaño.
4. El adaptador privado transmite el objeto a R2.
5. El módulo registra los metadatos y devuelve un resultado seguro.

Las descargas se realizan por `GET /api/files/:id/download`, tras autorizar el recurso. Según la configuración de transferencias, el Worker transmite el contenido o responde con una redirección a una URL temporal firmada para R2. La ruta frontend de descarga y la integración de transferencia forman parte de la verificación E2E de Fase 5.

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

El módulo `identity` ya implementa registro/login, logout, resolución de sesión y cambio de contraseña mediante sus APIs reales. El módulo `files` implementa el catálogo de metadatos y su persistencia D1, así como las operaciones de transferencia con R2. La interfaz ya expone controles de subida en Mi unidad; la cobertura visual, accesible y E2E de extremo a extremo continúa en la Fase 5.

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

Las verificaciones operativas de privacidad, CORS, permisos mínimos y transferencias reales de R2 quedaron registradas como completadas en la Fase 4 el 2026-10-12, según confirmación del propietario. Turnstile y su secreto quedaron configurados y validados durante la Fase 2. No se deben inferir ajustes de Cloudflare únicamente de un binding o de un escaneo de repositorio; consulta [FILES_PHASE_4.md](./FILES_PHASE_4.md) para el estado de cierre registrado. La certificación global de seguridad sigue pendiente.

El despliegue por sí solo no certifica que Vega Drive esté lista para todos los escenarios de producción. Registro/login, sesiones, cambio de contraseña y Turnstile están implementados; Mi unidad y Papelera consumen el catálogo HTTP autenticado; las transferencias físicas con R2 están implementadas y las validaciones operativas de Fase 4 están registradas como completadas. Siguen pendientes recientes/favoritos/búsqueda, el cierre de presentación y accesibilidad, la evidencia de assets/cabeceras/operación y la verificación E2E de la integración frontend-transferencias. La certificación global de seguridad y el rollback siguen pendientes según [Security.md](./Security.md) y [Rollback.md](./Rollback.md).
