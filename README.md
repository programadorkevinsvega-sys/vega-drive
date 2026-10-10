# Vega Drive

Sistema privado de almacenamiento de archivos en la nube sobre Cloudflare, para un máximo de 10 clientes. El aislamiento entre cuentas es obligatorio.

> Estado: Fase 0 en construcción. Consulta [arquitectura](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md), [seguridad](./Security.md) y [roadmap](./roadmap.md).

## Arquitectura

Monolito modular serverless: un Worker, una D1 (`VEGA_DRIVE_DB`) y un bucket R2 privado. Frontend y BFF comparten origen; el navegador solo consume `/api`. Solo infraestructura del módulo `files` podrá usar R2 mediante `IFileStoragePort`.

## Desarrollo

Requisitos: Node.js 22+, npm 10+ y cuenta Cloudflare. Ejecuta `npm install` y `npm run dev`. Configura secretos solo con Wrangler, por ejemplo `npx wrangler secret put TURNSTILE_SECRET_KEY`; nunca los guardes en Git.

## Recursos Cloudflare

El ID de D1 en `wrangler.toml` es un marcador hasta crear el recurso en la cuenta correcta:

```bash
npx wrangler d1 create VEGA_DRIVE_DB
npx wrangler r2 bucket create vega-drive-files
```

Copia el ID devuelto por Wrangler. Mantén R2 privado: sin `r2.dev`, dominio público ni CORS de navegador. No añadas credenciales de R2 al frontend.

## Comandos

| Comando | Propósito |
|---|---|
| `npm run dev` | Worker local |
| `npm run format:check` | Formato |
| `npm run lint` | Guardia arquitectónica |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Pruebas |
| `npm run check` | Verificaciones locales |

## CI

Cada PR a `main` ejecuta formato, guardia arquitectónica, typecheck, pruebas, `npm audit` y Gitleaks. Dependabot y plantilla de PR quedan configurados. La protección de rama requiere activar en GitHub la obligatoriedad de CI; un workflow no protege `main` por sí solo.
