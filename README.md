# Vega Drive

Vega Drive es una aplicación privada de almacenamiento y compartición de archivos sobre Cloudflare, diseñada para un máximo de 10 clientes y con aislamiento estricto entre cuentas.

> **Estado documental: 2026-11-23.** Las fases 0–5 y 7–8 están cerradas. La Fase 9 tiene implementados el runbook y los controles automáticos de postdespliegue, pero su certificación operativa sigue pendiente de confirmar Time Travel de la D1 real, observabilidad/historial de despliegues y ejecutar pruebas de recuperación únicamente con autorización explícita. La Fase 6 (cuotas) se mantiene pendiente y se abordará al final, según el orden acordado. No existe entorno staging y no se presupone uno.

## Estado funcional

- **Identity:** registro/login protegido por Turnstile, sesiones, logout y cambio de contraseña.
- **Files:** carpetas, catálogo, papelera, restauración, recientes, favoritos y búsqueda paginada por nombre/tipo, siempre filtrados por el actor autenticado.
- **Transferencias:** subida/descarga con autorización del Worker y transferencia directa de bytes navegador↔R2 mediante URLs prefirmadas limitadas cuando el modo directo está habilitado; el Worker conserva el plano de control. El flujo de respaldo a través del Worker se mantiene disponible según la configuración.
- **Vista previa:** rutas same-origin autenticadas; el Worker comprueba sesión y propietario y transmite el contenido privado. Incluye formatos compatibles del navegador, PDF, texto/Markdown y extracción local limitada de DOCX/XLSX. La vista previa no entrega URLs de R2.
- **Sharing:** enlaces de lectura protegidos, con token almacenado como hash, expiración/revocación y aislamiento del recurso.
- **Quota:** módulo no implementado funcionalmente; es la Fase 6 pendiente.

Los detalles históricos y las evidencias específicas de cada fase permanecen en los documentos de fase enlazados desde [roadmap.md](./roadmap.md).

## Arquitectura

Vega Drive es un monolito modular serverless:

- Un único Cloudflare Worker sirve frontend y BFF desde el mismo origen.
- Una única base D1 usa el binding `VEGA_DRIVE_DB`.
- Un bucket R2 privado usa el binding `FILES_BUCKET`.
- El navegador consume el BFF bajo `/api`. Para transferencias directas autorizadas puede enviar/recibir bytes desde R2 usando URLs temporales firmadas; nunca recibe credenciales ni elige claves, permisos o expiración.
- La vista previa y las operaciones de metadatos pasan por el Worker y no requieren acceso CORS del navegador a R2.
- Cada módulo posee sus tablas, migraciones, dominio y API pública. No se permiten SQL/JOIN/FK ni imports internos entre módulos.

Contrato arquitectónico: [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md). Controles de seguridad: [Security.md](./Security.md). Decisión de transferencias: [ADR-001-direct-r2-transfers.md](./ADR-001-direct-r2-transfers.md). Migraciones: [migrations/manifest.md](./migrations/manifest.md).

## Operación de producción y recuperación

No hay staging. El comando oficial de despliegue es `pnpm run deploy`; ejecuta preflight, verificaciones, auditorías/build, migraciones remotas, verificación del esquema, despliegue del Worker y `pnpm run verify:production`. No se debe sustituir por un `wrangler deploy` aislado que omita el flujo aprobado.

La verificación postdespliegue comprueba HTML, `/api/health`, `/api/auth/config`, cabeceras de seguridad y `Cache-Control: no-store` en las rutas API inspeccionadas.

**Recuperación D1:** Cloudflare D1 no muestra necesariamente una sección llamada “Backups”. Para bases que usan el almacenamiento `production`, el mecanismo es Time Travel: se activa automáticamente, mantiene bookmarks y permite recuperación punto en el tiempo dentro de la ventana del plan (7 días Workers Free / 30 días Workers Paid según la documentación de Cloudflare). Bases legacy `alpha` usan el mecanismo antiguo. La versión real de `vega_drive_db` y su bookmark todavía deben verificarse con los comandos de solo lectura documentados en [Rollback.md](./Rollback.md); no se afirma que ya se haya verificado. Restaurar es destructivo y requiere autorización explícita, evaluación de pérdida de escrituras y un plan operativo.

**No se ha ejecutado rollback real ni restauración de D1 como parte de la Fase 9.** Revertir el Worker no revierte migraciones D1 ni recupera objetos R2. El estado de certificación y los pendientes están en [Rollback.md](./Rollback.md) y en la Fase 9 del [roadmap](./roadmap.md).

## Desarrollo

Requisitos: Node.js `22.23.5` o superior y pnpm `11.28.13` (versión fijada en `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm run dev
pnpm run check
```

No guardes secretos en Git, `.env` versionados ni `wrangler.toml`. Los secretos del Worker se administran mediante Wrangler/Cloudflare Secrets. La clave de sitio de Turnstile es pública; la clave secreta solo existe en el entorno del Worker.

## CI, verificaciones y despliegue

- GitHub Actions valida los PR sobre su merge ref sintético y también los pushes a ramas, `main` y `merge_group`.
- Los checks incluyen formato sin autoescritura, verificación de arquitectura/tipos/pruebas y escaneo de secretos.
- El job agregado requerido se llama exactamente **`Required checks`**. Para bloquear merges con CI rojo, la protección de `main` debe exigir ese check; la configuración de branch protection/ruleset debe verificarse en GitHub y no se presume activa solo porque el workflow exista.
- `pnpm run check` ejecuta formato, guardia arquitectónica, TypeScript y pruebas.
- `pnpm run cloudflare:build` ejecuta preflight, checks, build/auditorías y Wrangler dry-run.
- `pnpm run deploy` es el flujo completo de publicación de producción; incluye migraciones D1 remotas y por ello es una operación de producción, no un comando de CI local.
- `pnpm run db:verify:schema:local` verifica D1 local. Los comandos con sufijo `:production` o `--remote` consultan/modifican producción y requieren autorización operativa.

### Comandos D1 de consulta

```bash
pnpm exec wrangler d1 info vega_drive_db
pnpm exec wrangler d1 time-travel info vega_drive_db
pnpm run db:migration:list
```

Los dos primeros permiten comprobar versión del almacenamiento y bookmark actual de Time Travel. No ejecutar `wrangler d1 time-travel restore` durante una comprobación: restaura la base in-place y sobrescribe datos.

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 0–5 | Fundamentos, módulos base, transferencias e integración frontend/BFF | Cerradas |
| 6 | Cuotas | Pendiente; se abordará al final |
| 7 | Compartición segura | Cerrada |
| 8 | Endurecimiento y certificación de seguridad | Cerrada según evidencias del proyecto |
| 9 | Operación, postchecks y recuperación sin staging | Implementación cerrada; certificación operativa pendiente |
| 10 | Mejoras futuras y posible extracción | Futuro, sin alcance comprometido |

