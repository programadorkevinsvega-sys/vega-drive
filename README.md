# Vega Drive

Sistema privado de almacenamiento de archivos sobre Cloudflare, diseñado para un máximo de 10 clientes y aislamiento estricto entre cuentas.

> **Estado real:** el esqueleto del Worker está desplegado en Cloudflare, pero la aplicación de archivos aún no está lista para producción con datos reales. No están implementados el registro/login, la autorización por usuario, el esquema de D1 ni las operaciones de subida y descarga de archivos. No habilites usuarios reales hasta cerrar esos puntos y las comprobaciones de seguridad.

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

**El rollback aún no está certificado.** El flujo actual `pnpm run deploy` aplica migraciones remotas antes de desplegar el Worker y solo verifica `/api/health) después. Revertir el Worker no deshace migraciones D1 ni restaura objetos R2. No ejecutar un rollback de producción sin identificar el deployment objetivo y comprobar compatibilidad del esquema.

## Estado de seguridad y certificación

Las reglas obligatorias, los headers esperados para Workers/Hono y la matriz de regresión están en [Security.md](./Security.md). El roadmap detalla el trabajo de certificación en la [Fase 8](./roadmap.md#fase-8--endurecimiento-y-pruebas-de-seguridad).

**La certificación global de seguridad permanece pendiente.** Un build correcto, la verificación de esquema D1 y una respuesta HTTP 200 de `/api/health` son señales útiles de despliegue, pero no prueban autenticación, autorización, aislamiento entre cuentas ni transferencias seguras. No habilites usuarios reales hasta implementar y probar los flujos correspondientes.

El adaptador real de almacenamiento, autenticación, autorización por usuario y flujo de archivos siguen pendientes. El endpoint `/api/health` es una comprobación de liveness, no prueba que D1 o R2 estén operativos.

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
- `src/platform`: infraestructura técnica compartida.
- `src/shared-kernel`: abstracciones compartidas mínimas.
- `public`: assets estáticos.
- `tests`: pruebas de salud, configuración y arquitectura.

## Servicios Cloudflare

- Backend, BFF y assets: Cloudflare Workers.
- Metadatos, usuarios y sesiones: D1 mediante `VEGA_DRIVE_DB`.
- Archivos: R2 privado mediante `FILES_BUCKET`.
- Anti-bots: Turnstile, pendiente de configuración.

El ID D1 y el nombre del bucket en `wrangler.toml` corresponden a recursos de la cuenta conectada al despliegue. La existencia de un binding no demuestra que exista el esquema de tablas ni que el bucket sea privado. Verifica en Cloudflare que R2 no tenga acceso público, dominio público, `r2.dev` ni CORS de navegador.

## Desarrollo

Requisitos: Node.js 22+ y pnpm 10.18.3.

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

`pnpm run check` ejecuta formato, guardia arquitectónica, TypeScript y pruebas. `pnpm run cloudflare:build` ejecuta primero `predeploy`, después todas las comprobaciones y finalmente `pnpm audit --audit-level=high`; debe usarse como comando de build de Cloudflare Workers Builds, junto con la instalación reproducible `pnpm install --frozen-lockfile`.

El comando de despliegue de producción de Cloudflare Workers Builds debe ser **`pnpm run deploy`**, no `pnpm exec wrangler deploy`. El script ejecuta, en orden:

1. `wrangler d1 migrations apply vega_drive_db --remote` para aplicar migraciones pendientes.
2. `wrangler d1 migrations list vega_drive_db --remote` para comprobar el historial registrado.
3. `scripts/verify-d1-schema.mjs` inspecciona `sqlite_schema` en la D1 remota y compara tablas e índices con las definiciones SQL versionadas; detecta objetos ausentes, definiciones incompatibles y objetos inesperados. Si hay diferencias, termina con error y bloquea el despliegue.
4. `wrangler deploy` publica el Worker solo si los pasos anteriores terminan correctamente.
5. `pnpm run verify:production` comprueba que `/api/health` responde con HTTP 200 y el JSON esperado.

`db:migrate:local` aplica migraciones al D1 local. La verificación estructural compara las definiciones SQL creadas por las migraciones con `sqlite_schema`; por seguridad, si se añade una migración con `ALTER`, `DROP` u otro DDL no admitido por el verificador, el despliegue se detendrá hasta actualizar el verificador para modelar el esquema final esperado. Las tablas o índices creados manualmente también se reportan como inesperados y requieren reconciliación intencional. La comprobación no sustituye pruebas funcionales de la aplicación ni valida datos de negocio.

GitHub Actions mantiene temporalmente las comprobaciones como respaldo hasta confirmar que Cloudflare ejecuta correctamente el comando en cada push. Gitleaks permanece en GitHub Actions para el escaneo de secretos; no se elimina ni se considera sustituido por las pruebas de build.

## Cierre de Fase 0 y preparación para producción

No declarar la Fase 0 ni la preparación para producción como completadas hasta verificar:

- CI verde en el commit actual y protección de `main` con los checks obligatorios.
- `/api/health` desplegado y respondiendo.
- D1 con migraciones/esquema aplicados y comprobados.
- R2 privado, sin exposición pública/CORS, y operaciones reales probadas a través del Worker.
- Secretos y variables de entorno configurados; Turnstile listo si se exige para registro/login.
- Autenticación, autorización por usuario, aislamiento entre clientes y flujos de archivos implementados y probados antes de admitir usuarios reales.

La estructura actual es un andamiaje inicial. La arquitectura y el roadmap describen las fases posteriores; no son evidencia de funcionalidades implementadas.
