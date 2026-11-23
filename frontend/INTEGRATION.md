# Integración del frontend con el Worker

**Estado: INTEGRACIÓN IMPLEMENTADA. Revisión: 2026-11-23.** El frontend forma parte del artefacto del Worker y consume el BFF desde el mismo origen. El estado de fases y sus criterios de cierre se mantienen en [roadmap.md](../roadmap.md).

## Decisiones aplicadas

- Un único Worker y un único origen. Hono sirve la API bajo `/api/*`; Workers Static Assets sirve `frontend/dist`.
- El enrutado de vistas usa hash (`#/drive`, `#/recent`, etc.). `not_found_handling = "none"` conserva los 404 reales de assets y rutas API desconocidas.
- Se mantienen separados `pnpm-lock.yaml` y `frontend/pnpm-lock.yaml`; la raíz ofrece `frontend:install`, `frontend:check` y `frontend:audit`.
- Vite copia `frontend/public/_headers` a `frontend/dist`. La configuración estática aplica CSP, nosniff, Referrer-Policy, protección de framing, HSTS, Permissions-Policy, COOP y CORP. El Worker/BFF conserva las cabeceras aplicables y añade `Cache-Control: no-store` en `/api/*`.
- `cloudflare:build` ejecuta preflight, formato, arquitectura, tipos, pruebas, auditorías y Wrangler dry-run. `pnpm run deploy` ejecuta el flujo de producción completo, incluidas migraciones remotas y `verify:production`; no debe sustituirse por un `wrangler deploy` aislado.
- Login, registro, sesión, logout y cambio de contraseña usan `/api/auth/*`. La cookie permanece HttpOnly y el token de sesión no se expone al JavaScript.
- Turnstile se verifica en el servidor; la CSP permite los recursos necesarios del widget.
- La vista previa usa rutas same-origin autenticadas; el Worker comprueba sesión y propietario en cada petición y transmite los bytes privados.
- Las transferencias directas a R2, cuando el feature flag está habilitado, usan URLs prefirmadas temporales de alcance mínimo emitidas por el Worker conforme a [ADR-001](../ADR-001-direct-r2-transfers.md). El navegador no recibe credenciales ni claves internas. El valor actual del flag no se puede deducir del repositorio.

## Vistas y capacidades conectadas

- Mi unidad y carpetas: listado, paginación, breadcrumbs, creación, renombrado y movimiento.
- Papelera: listado, borrado lógico y restauración.
- Recientes: persistencia de última apertura/descarga por propietario, cursor y pantalla conectada.
- Favoritos: persistencia por propietario, endpoints protegidos y pantalla conectada.
- Búsqueda: nombre parcial de archivos/carpetas activas, filtro por tipo, paginación y aislamiento entre propietarios.
- Transferencias: subida simple/multipart, progreso, pausa/reanudación, cancelación y descarga; ver [FILES_PHASE_4.md](../FILES_PHASE_4.md).
- Vista previa: imágenes, audio/vídeo compatibles, PDF, texto/Markdown y extracción local limitada de DOCX/XLSX; ver [FILES_PREVIEW.md](../FILES_PREVIEW.md).
- Sharing: flujos de enlaces compartidos implementados en Fase 7.
- Ajustes: cambio real de contraseña; preferencias adicionales de perfil siguen fuera del alcance actual.

## Límites de responsabilidad

- El frontend presenta UI, estado, accesibilidad y navegación; no decide propiedad, permisos, cuotas ni reglas de negocio.
- El BFF valida transporte, resuelve la sesión y delega en gateways. No ejecuta SQL ni accede directamente a R2.
- El módulo Files posee sus tablas y adaptadores de almacenamiento.
- Quota sigue pendiente en Fase 6; Sharing se implementó en Fase 7. No describir Sharing como placeholder.
- La vista previa no necesita CORS de R2. CORS solo aplica al intercambio directo de bytes autorizado.
- No hay staging; estas instrucciones no crean ni presuponen uno.

## Instalación y validación

Requisitos: Node.js `22.23.5` o superior y pnpm `11.28.13`.

Desde la raíz:

```bash
pnpm install --frozen-lockfile
pnpm run frontend:install
pnpm run frontend:check
pnpm run cloudflare:build
pnpm run dev
```

`cloudflare:build` produce los assets y ejecuta Wrangler dry-run; no despliega ni aplica migraciones remotas. `pnpm run deploy` es una operación de producción.

## Evidencia y separación de estados

- Las pruebas de frontend/BFF y las guardias de arquitectura se ejecutan en CI.
- Las pruebas con D1/R2 simulados validan contratos y aislamiento, no el estado externo de Cloudflare.
- La Fase 4 registra las validaciones operativas de transferencias confirmadas por el propietario.
- El cierre de Fase 8 incluye controles de seguridad automatizados.
- La certificación operativa de Fase 9 permanece pendiente de verificar Time Travel de la D1 real, historial/logs/alertas y ejercicios autorizados de rollback/recuperación. Consultar [Rollback.md](../Rollback.md).

## Reversión

No eliminar `frontend/` como procedimiento genérico: forma parte del artefacto integrado. Antes de revertir una versión, revisar el diff y la compatibilidad de Worker, assets, rutas, cabeceras, migraciones y estado D1/R2. Todo rollback de producción debe seguir [Rollback.md](../Rollback.md) y requiere autorización explícita.
