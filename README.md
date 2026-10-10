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

El contrato arquitectónico está en [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md), los controles de seguridad en [Security.md](./Security.md) y el plan por fases en [roadmap.md](./roadmap.md).

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

## Comprobaciones y CI

`pnpm run check` ejecuta formato, guardia arquitectónica, TypeScript y pruebas. `pnpm run cloudflare:build` ejecuta primero `predeploy`, después todas las comprobaciones y finalmente `pnpm audit --audit-level=high`; debe usarse como comando de build de Cloudflare Workers Builds, junto con la instalación reproducible `pnpm install --frozen-lockfile`. Cloudflare solo debe desplegar si ese comando termina correctamente. Para que las migraciones D1 se apliquen antes de publicar el Worker, configura el **Deploy command** de Cloudflare Workers Builds como `pnpm run deploy` (no `pnpm exec wrangler deploy`): el script aplica `wrangler d1 migrations apply vega_drive_db --remote` y solo después ejecuta `wrangler deploy`. No cambies el comando de producción hasta inspeccionar el esquema remoto y validar la migración inicial `migrations/0001_initial_schema.sql`; el SQL usa `IF NOT EXISTS`, pero eso no reconcilia tablas existentes con columnas incompatibles.

GitHub Actions mantiene temporalmente las mismas comprobaciones como respaldo hasta confirmar que Cloudflare ejecuta correctamente el comando en cada push. Gitleaks permanece en GitHub Actions para el escaneo de secretos; no se elimina ni se considera sustituido por las pruebas de build. Después de verificar un build de Cloudflare exitoso, se puede retirar el job duplicado `verify` y conservar el job `secrets`. La obligatoriedad de checks en GitHub es una configuración separada de la rama.

## Cierre de Fase 0 y preparación para producción

No declarar la Fase 0 ni la preparación para producción como completadas hasta verificar:

- CI verde en el commit actual y protección de `main` con los checks obligatorios.
- `/api/health` desplegado y respondiendo.
- D1 con migraciones/esquema aplicados y comprobados.
- R2 privado, sin exposición pública/CORS, y operaciones reales probadas a través del Worker.
- Secretos y variables de entorno configurados; Turnstile listo si se exige para registro/login.
- Autenticación, autorización por usuario, aislamiento entre clientes y flujos de archivos implementados y probados antes de admitir usuarios reales.

La estructura actual es un andamiaje inicial. La arquitectura y el roadmap describen las fases posteriores; no son evidencia de funcionalidades implementadas.
