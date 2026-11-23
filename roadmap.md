# Roadmap de Vega Drive

**Última actualización: 2026-11-23.** Este documento refleja el estado actual del repositorio y el alcance acordado. No presupone staging. Los estados de implementación no equivalen automáticamente a certificaciones operativas externas.

La arquitectura obligatoria está en [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md), los controles en [Security.md](./Security.md), la operación/recuperación en [Rollback.md](./Rollback.md) y el inventario de migraciones en [migrations/manifest.md](./migrations/manifest.md).

## Reglas para todas las fases

1. Un único Worker sirve frontend y BFF; una única D1 usa `VEGA_DRIVE_DB`; R2 usa `FILES_BUCKET` y permanece privado.
2. Los módulos solo acceden a sus tablas y exponen contratos públicos. No se permiten imports internos, JOIN, FK, SQL ni transacciones entre prefijos de módulos.
3. Los controllers del BFF validan transporte, resuelven sesión y delegan en gateways; no contienen lógica de negocio ni acceso directo a D1/R2.
4. El navegador usa `/api` para control y autorización. Las transferencias directas a R2 solo se permiten mediante URLs prefirmadas temporales, limitadas y emitidas tras autorización del Worker conforme a [ADR-001](./ADR-001-direct-r2-transfers.md). La vista previa continúa same-origin y autenticada.
5. El bucket R2 no se hace público. Secretos y claves internas nunca llegan al frontend.
6. Cada cambio incluye pruebas de aislamiento entre usuarios y verificaciones arquitectónicas aplicables.
7. CI verde no sustituye las comprobaciones reales de producción ni autoriza por sí solo migraciones, despliegues, rollback o restauraciones.
8. Una fase se cierra con implementación, pruebas y documentación de su alcance; las dependencias operativas externas se declaran por separado.

## Resumen de fases

| Fase | Alcance | Estado actual |
|---|---|---|
| 0 | Fundamentos y contrato del Worker | Cerrada |
| 1 | D1 única y límites por módulo | Cerrada |
| 2 | Identity y autenticación | Cerrada |
| 3 | Catálogo de archivos y carpetas | Cerrada |
| 4 | Transferencias privadas con R2 | Cerrada; validación operativa registrada |
| 5 | Frontend/BFF, recientes, favoritos, búsqueda y vistas | Cerrada |
| 6 | Cuotas | Pendiente; se aborda al final |
| 7 | Compartición segura | Cerrada |
| 8 | Endurecimiento y pruebas de seguridad | Cerrada |
| 9 | Operación, recuperación y rollback sin staging | Implementación cerrada; certificación operativa pendiente |
| 10 | Mejoras futuras/extracción | Futuro, sin alcance comprometido |

---

## Fase 0 — Fundamentos del monolito modular

**Estado: CERRADA.** Contrato, estructura del Worker, bindings base, build, pruebas, CI y despliegue fundacional implementados. La documentación histórica de cierre se conserva en el historial del proyecto. Las fases posteriores incorporaron las capacidades de seguridad y producto que no pertenecían al alcance fundacional.

## Fase 1 — D1 única y límites por módulo

**Estado: CERRADA.** Una D1 compartida por binding, con propiedad de tablas/migraciones por módulo y verificadores que impiden cruces de SQL/imports. El orden de migraciones está descrito en [migrations/manifest.md](./migrations/manifest.md).

## Fase 2 — Identity y autenticación

**Estado: CERRADA.** Registro/login, sesiones, logout, cambio de contraseña, Turnstile y resolución server-side del actor. Las sesiones y los recursos protegidos se validan en el backend.

## Fase 3 — Catálogo de archivos y carpetas

**Estado: CERRADA.** Catálogo, carpetas, nombres únicos, movimientos, papelera, restauración, paginación y breadcrumbs con aislamiento por propietario. Evidencia histórica: [FILES_PHASE_3.md](./FILES_PHASE_3.md).

## Fase 4 — Transferencias privadas con R2

**Estado: CERRADA.** Transferencias con R2 y controles de privacidad. El Worker mantiene el plano de control; el navegador solo transfiere bytes directamente cuando el modo autorizado de URLs prefirmadas está habilitado. El flujo same-origin de respaldo se mantiene. Las pruebas operativas de producción se registraron como completadas por confirmación explícita del propietario el 2026-10-12. Evidencia: [FILES_PHASE_4.md](./FILES_PHASE_4.md) y [ADR-001-direct-r2-transfers.md](./ADR-001-direct-r2-transfers.md).

## Fase 5 — Frontend y BFF del mismo Worker

**Estado: CERRADA.** El frontend consume el BFF same-origin y las vistas de Mi unidad, Papelera, Recientes, Favoritos y Búsqueda están conectadas. La búsqueda admite nombre, tipo y paginación, con aislamiento por propietario. La vista previa usa rutas autenticadas del mismo origen y no expone URLs de R2. DOCX/XLSX se procesan localmente dentro de los límites documentados. Quota y Sharing no son placeholders funcionales de esta fase: Sharing se implementó en Fase 7 y Quota continúa pendiente en Fase 6.

Documentación técnica: [FRONTEND_BFF_PHASE_5.md](./FRONTEND_BFF_PHASE_5.md) y [FILES_PREVIEW.md](./FILES_PREVIEW.md).

## Fase 6 — Módulo quota

**Estado: PENDIENTE; deliberadamente reservada para el final.** No implementar ni marcar como funcional el módulo de cuotas antes de que el propietario decida iniciar esta fase.

Alcance previsto:
- Crear tablas, migraciones y repositorios propios de quota.
- Exponer una API pública para consultar y reservar capacidad.
- Coordinar con Files mediante contratos/eventos, nunca leyendo tablas `files_*` directamente.
- Garantizar límites bajo transferencias concurrentes.
- Añadir pruebas de concurrencia, aislamiento y compensación ante fallos.

## Fase 7 — Módulo sharing

**Estado: CERRADA.** Compartición implementada de extremo a extremo: enlaces de lectura con tokens protegidos por hash, expiración/revocación, controles de acceso al recurso y pruebas de aislamiento. Los detalles se mantienen en los cambios y pruebas de la fase; no describir Sharing como placeholder pendiente.

## Fase 8 — Endurecimiento y pruebas de seguridad

**Estado: CERRADA según el alcance y las evidencias integradas en el proyecto.** Incluye guardias arquitectónicas, pruebas de sesión/autorización, aislamiento de archivos y compartición, CSP/cabeceras, pruebas HTTP y escaneo de secretos/dependencias en CI. Los checks de CI y las pruebas automatizadas no sustituyen la verificación de la configuración externa de Cloudflare ni certifican una recuperación operativa de D1; eso se mantiene en Fase 9.

La política de cabeceras de assets está en `frontend/public/_headers`; las cabeceras del Worker/BFF se gestionan desde la capa HTTP. X-Frame-Options usa `SAMEORIGIN` y CSP `frame-ancestors 'self'` para permitir la vista previa PDF dentro del mismo origen, no para permitir framing externo.

## Fase 9 — Operación de producción y recuperación (sin staging)

**Estado: IMPLEMENTACIÓN CERRADA; CERTIFICACIÓN OPERATIVA PENDIENTE.** No existe staging ni se crea como parte de esta fase.

### Implementación completada

- [x] Runbook de release de producción con CI, preflight, migraciones, verificación de esquema, deploy y postchecks.
- [x] `pnpm run verify:production` comprueba frontend HTML, `/api/health`, `/api/auth/config`, cabeceras de seguridad y `Cache-Control: no-store` en las rutas API verificadas.
- [x] Runbook de rollback del Worker con identificación del deployment/SHA, revisión de compatibilidad D1/R2, aprobación y smoke tests.
- [x] Separación explícita entre rollback de Worker, recuperación D1 y consistencia de objetos R2.
- [x] Gestión de secretos, observabilidad, registro privado de releases/incidentes y checklist.
- [x] Queues/DLQ identificadas como no aplicables: no hay binding declarado.
- [x] Documentado el mecanismo actual de recuperación D1: Time Travel para bases con `version: production`, no una pestaña de backups que deba habilitarse manualmente.

### Verificaciones externas pendientes

- [ ] Ejecutar comandos de solo lectura `pnpm exec wrangler d1 info vega_drive_db` y `pnpm exec wrangler d1 time-travel info vega_drive_db`; guardar la versión real de almacenamiento y el bookmark actual.
- [ ] Confirmar el plan de Workers y su ventana efectiva de Time Travel (7 días Free / 30 días Paid según Cloudflare). No inferir el plan ni marcar retención confirmada sin evidencia.
- [ ] Si la D1 indica `version: alpha`, documentar el mecanismo legacy aplicable; no usar el runbook de Time Travel para una base incompatible.
- [ ] Confirmar en Cloudflare historial de deployments, acceso real a logs y política de alertas disponible en el plan/configuración. El repositorio tiene `[observability].enabled = false`; no afirmar que logs/alertas avanzadas están activas.
- [ ] Ejecutar un rollback controlado del Worker solo con autorización explícita y conservar evidencia.
- [ ] Realizar una prueba de recuperación D1 solo si se aprueba explícitamente, con evaluación de pérdida de escrituras, ventana de mantenimiento y consistencia con R2. No ejecutar restauración en CI/PR ni durante validaciones normales.

**Criterio de cierre:** no declarar Fase 9 operativamente certificada hasta verificar los puntos anteriores y conservar evidencia. Los comandos `d1 info` y `time-travel info` son de consulta; `time-travel restore` sobrescribe la base y no debe ejecutarse como comprobación.

Runbook completo: [Rollback.md](./Rollback.md). Documentación oficial: [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) y [límites D1](https://developers.cloudflare.com/d1/platform/limits/).

## Fase 10 — Mejoras y extracción futura

**Estado: FUTURO, sin alcance comprometido.** Miniaturas, 2FA, versionado, sincronización y extracción de módulos requieren una decisión de alcance y un diseño previo. No convertirlos en trabajo activo sin priorización explícita.
