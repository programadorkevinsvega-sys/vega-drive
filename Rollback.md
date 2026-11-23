# Operación, recuperación y rollback de Vega Drive

**Última revisión documental: 2026-11-23.** Esta guía describe la arquitectura y los comandos del repositorio. No certifica que los controles externos de la cuenta Cloudflare hayan sido inspeccionados ni que se haya ejecutado una recuperación real.

## Alcance y estado real

- **Producción únicamente:** Vega Drive no tiene un entorno staging separado y esta guía no lo crea ni lo presupone.
- **Worker:** existe un flujo documentado de despliegue y un verificador postdespliegue.
- **D1:** Cloudflare D1 usa Time Travel para recuperación punto en el tiempo cuando la base está en el almacenamiento `production`. No necesariamente existe una pestaña de dashboard llamada “Backups”. La versión real de `vega_drive_db`, su bookmark y el plan/ventana aplicable todavía deben comprobarse.
- **R2:** el bucket `vega-drive-files` debe permanecer privado. Un rollback de Worker no restaura ni elimina objetos R2.
- **No certificado:** no se ha ejecutado una restauración real de D1 ni un rollback controlado de Worker como parte de esta fase. No declarar esas operaciones ensayadas hasta conservar evidencia de una ejecución autorizada.

## Arquitectura de recuperación

| Componente | Mecanismo                                                                   | Límite importante                                                          |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Worker     | Volver a una versión de deployment anterior compatible                      | No revierte D1 ni R2                                                       |
| D1         | Time Travel y bookmarks, si `wrangler d1 info` indica `version: production` | Restore sobrescribe la base in-place y puede perder escrituras posteriores |
| D1 legacy  | Backend `alpha` usa el mecanismo snapshot legacy                            | No asumir que los comandos de Time Travel están disponibles                |
| R2         | Objetos permanecen en el bucket privado                                     | No se borran ni restauran automáticamente                                  |
| Queues/DLQ | No hay binding de Queue declarado en `wrangler.toml`                        | No aplica                                                                  |
| Staging    | No existe                                                                   | No se crea como parte de la fase                                           |

### Time Travel de D1

Según la documentación oficial de Cloudflare, Time Travel:
- Está habilitado automáticamente para D1 que usa el almacenamiento nuevo; no hay que activar una opción ni crear snapshots manuales.
- Conserva historial y bookmarks dentro de la ventana del plan: **7 días en Workers Free y 30 días en Workers Paid**.
- Es compatible con bases cuyo campo `version` sea `production`. Una base `alpha` usa el sistema legacy de snapshots.
- Permite obtener un bookmark actual o para un timestamp anterior.
- La restauración sobrescribe la base de datos en el mismo lugar, cancela consultas/transacciones en curso y puede descartar escrituras posteriores al punto seleccionado.

Referencias: [Cloudflare D1 — Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/) y [Cloudflare D1 — Limits](https://developers.cloudflare.com/d1/platform/limits/).

**Importante para esta cuenta:** el usuario informó que no encuentra una sección “Backups” en el dashboard. Eso no demuestra que D1 carezca de recuperación: Time Travel es la interfaz de recuperación para el backend `production`. Aún no se conoce el valor real de `version` de `vega_drive_db`, ni el plan exacto que determina la ventana de retención. No registrar 7 o 30 días como retención confirmada de esta base hasta comprobar ambos datos.

## Comprobaciones D1 de solo lectura

Desde la raíz del repositorio, con Wrangler autenticado en la cuenta correcta:

```bash
pnpm exec wrangler d1 info vega_drive_db
pnpm exec wrangler d1 time-travel info vega_drive_db
pnpm run db:migration:list
```

Interpretación:
1. En la salida de `d1 info`, revisar que la base corresponda a `vega_drive_db` y que `version` sea `production`.
2. Si indica `production`, `d1 time-travel info` debe devolver el bookmark actual. Guardar solo el bookmark, la fecha/hora UTC y el resultado operativo en el registro privado; no publicar datos sensibles.
3. Si indica `alpha`, no asumir soporte de Time Travel; revisar el mecanismo legacy documentado por Cloudflare.
4. La lista de migraciones muestra el historial de Wrangler; no demuestra por sí sola consistencia funcional ni recuperabilidad.
5. El plan Workers Free/Paid de la cuenta determina la ventana publicada. No inferirlo del repositorio ni del nombre de la base.

Estos comandos no restauran ni modifican datos. No ejecutar `wrangler d1 time-travel restore` como prueba de disponibilidad.

## Despliegue normal

1. Confirmar que `main` contiene el commit aprobado y que el workflow CI completo está verde para ese SHA.
2. Revisar el diff de migraciones. Deben ser compatibles con el Worker anterior durante toda la ventana de rollback. Usar expansión/contracción: añadir primero, migrar consumidores después y retirar estructuras antiguas en un release posterior.
3. Verificar secretos y bindings requeridos sin imprimir ni compartir sus valores.
4. Ejecutar el comando oficial desde el entorno autorizado: `pnpm run deploy`. No usar `wrangler deploy` aislado para saltarse el preflight.
5. El script `deploy` ejecuta preflight, verificaciones/build/auditorías y el flujo `deploy:release`: aplica migraciones remotas, consulta el historial, verifica el esquema remoto, publica el Worker y ejecuta `pnpm run verify:production`.
6. El verificador postdespliegue comprueba:
   - `/`: HTML HTTP 200 y cabeceras de seguridad esperadas.
   - `/api/health`: HTTP 200 con `status=ok` y `service=vega-drive`.
   - `/api/auth/config`: `ready=true` y site key pública presente.
   - Cabeceras CSP, HSTS, nosniff, Referrer-Policy, protección de framing, Permissions-Policy, COOP/CORP.
   - `Cache-Control: no-store` en las rutas API comprobadas.
7. Si una verificación falla, detener releases posteriores, conservar el log, SHA, ID de deployment y hora UTC. Un build exitoso no equivale a un postcheck exitoso.

## Diagnóstico de producción

Comandos disponibles:

```bash
pnpm exec wrangler deployments list
pnpm run db:migration:list
pnpm run db:verify:schema:production
pnpm run verify:production
```

- `wrangler deployments list` permite consultar el historial de deployments.
- `db:migration:list` consulta el historial de migraciones remotas.
- `db:verify:schema:production` y `verify:production` consultan producción. Ejecutarlos solo con autorización operativa del propietario y credenciales seguras ya configuradas.
- No copiar secretos, cookies, tokens ni URLs firmadas en logs compartidos.

## Runbook: rollback del Worker

Usar solo si el incidente se debe al código/configuración del Worker y se comprobó que no requiere recuperar datos.

1. **Contener:** pausar nuevos releases y registrar incidente, hora UTC, SHA desplegado, versión Worker, síntomas y responsable.
2. **Identificar objetivo:** ejecutar `pnpm exec wrangler deployments list`; seleccionar deployment estable por ID/metadata y confirmar el SHA asociado.
3. **Comprobar compatibilidad:** revisar migraciones aplicadas, bindings, variables y secretos. Confirmar que el Worker anterior entiende el esquema D1 actual y los metadatos/objetos R2 escritos desde el release.
4. **Aprobar:** consultar `pnpm exec wrangler rollback --help` y seguir el flujo soportado por la versión de Wrangler. No ejecutar sin identificar el deployment y recibir aprobación explícita del propietario.
5. **Verificar:** ejecutar `pnpm run verify:production`, revisar logs y probar login/logout, listado, subida, descarga, preview y compartición con cuentas autorizadas.
6. **Registrar:** versión restaurada, SHA, ID, hora, comandos, resultados, migraciones que permanecen aplicadas y acciones correctivas.

El rollback de Worker no revierte D1, no revoca instantáneamente URLs firmadas ya emitidas, no restaura R2 y no revierte escrituras.

## Runbook: recuperación D1 con Time Travel

**Esta sección es un procedimiento de emergencia, no una autorización para ejecutarlo.** La restauración es destructiva.

Antes de cualquier restauración:
1. Confirmar `version: production` y el bookmark/fecha objetivo mediante comandos de consulta.
2. Confirmar plan y ventana de retención real de la cuenta.
3. Identificar el incidente, hora UTC aproximada, tablas/operaciones afectadas y el último punto sano. No elegir un timestamp solo por intuición.
4. Evaluar explícitamente qué escrituras legítimas se perderían desde el timestamp hasta el momento actual.
5. Preparar una ventana de mantenimiento y detener/controlar escrituras de la aplicación para evitar inconsistencias durante la operación.
6. Confirmar compatibilidad del esquema restaurado con el Worker que se ejecutará después y planificar la reconciliación de metadatos con R2.
7. Obtener aprobación explícita del propietario para la base, bookmark/timestamp y alcance exactos.

Solo después de esos pasos el propietario puede seguir el procedimiento oficial de Cloudflare para `wrangler d1 time-travel restore`. El comando sobrescribe la D1 in-place; no debe incluirse en CI, preflight, pruebas automatizadas ni scripts de despliegue normal. Registrar el bookmark previo y el bookmark resultante que Cloudflare devuelva, para poder evaluar una reversión de la propia restauración si fuera necesario.

Después:
- Ejecutar `pnpm run db:verify:schema:production` con autorización.
- Verificar migraciones, integridad funcional, sesiones, catálogo, compartición y coherencia entre metadatos D1 y objetos R2.
- Reabrir escrituras solo después de validar los flujos críticos.
- Registrar datos perdidos/reconciliados y resultado final sin incluir datos privados.

Si la base usa `alpha`, este runbook de Time Travel no aplica; seguir el mecanismo legacy documentado por Cloudflare y confirmar disponibilidad antes de actuar.

## Migraciones D1 y compatibilidad

- Nunca editar una migración que ya se aplicó en un entorno compartido; crear una nueva.
- Mantener compatibilidad hacia atrás mientras pueda activarse el Worker anterior.
- No combinar cambios destructivos (DROP, eliminación/renombre incompatible) con un release que requiere rollback inmediato.
- Usar expansión/contracción y backfills idempotentes, reanudables y verificables.
- La verificación estructural compara objetos D1 con migraciones; no prueba datos de negocio ni aislamiento de usuarios.

## R2 y consistencia

- Mantener `vega-drive-files` privado, sin acceso público ni dominio público.
- Las claves de objetos se generan/validan en servidor y la autorización se basa en el ID lógico y el actor.
- Las transferencias directas solo usan URLs prefirmadas temporales de alcance mínimo autorizadas por el Worker; nunca se exponen credenciales ni claves internas.
- La vista previa usa rutas same-origin autenticadas y el Worker transmite los bytes; no depende de CORS del navegador hacia R2.
- No ejecutar limpieza masiva de R2 durante una incidencia. Una recuperación D1 puede dejar referencias/metadatos que requieran reconciliación específica; no borrar objetos automáticamente.

## Observabilidad, secretos e incidentes

- La configuración versionada en `wrangler.toml` tiene `[observability].enabled = false`, aunque declara opciones de logs/traces. No asumir que logs persistentes, métricas o alertas avanzadas están efectivamente activos sin comprobar el panel/configuración real.
- Confirmar historial de deployments, acceso de los operadores a logs y mecanismos de alerta disponibles en el plan/configuración Cloudflare real.
- No registrar contraseñas, cookies, tokens, URLs firmadas completas, cuerpos privados ni secretos.
- Mantener secretos en Cloudflare Worker Secrets/GitHub Secrets; nunca en Git, logs ni frontend.
- Ante sospecha de filtración, detener el release, rotar el secreto afectado e investigar el periodo de exposición.
- No hay Queue/DLQ configurada actualmente.

## Registro privado de release/incidente

Guardar fuera de Git:
- Fecha/hora UTC y responsable.
- SHA Git, ID de deployment anterior/nuevo/restaurado.
- Resultado CI y comando de release.
- Migraciones aplicadas y resultado de verificación D1.
- Versión D1 (`production` o `alpha`), plan y ventana Time Travel confirmados, bookmark/fecha consultados.
- Resultado de frontend, health, auth config y cabeceras.
- Flujos manuales probados, impacto, decisiones, rollback/restauración y acciones correctivas.

Nunca incluir secretos, datos personales, tokens ni URLs firmadas.

## Checklist de producción

### Antes del release
- [ ] CI verde para el SHA candidato.
- [ ] Deployment estable anterior identificado.
- [ ] Compatibilidad del Worker anterior con el esquema D1 actual revisada.
- [ ] Migraciones aditivas/backward-compatible.
- [ ] Tipo de almacenamiento D1 y mecanismo de recuperación confirmados.
- [ ] Ventana Time Travel del plan y bookmark consultado confirmados (si `version: production`).
- [ ] Secretos/bindings presentes y protegidos.
- [ ] Bucket R2 privado.

### Después del despliegue
- [ ] Verificación automatizada frontend + health + auth config + headers aprobada.
- [ ] Login/logout comprobados.
- [ ] Listado, subida y descarga comprobados.
- [ ] Preview y enlaces compartidos comprobados.
- [ ] Logs de Worker revisados según disponibilidad real.
- [ ] SHA e ID de deployment registrados.

### Si hay rollback/recuperación
- [ ] Incidente contenido y responsable asignado.
- [ ] Deployment o timestamp/bookmark objetivo identificado.
- [ ] Compatibilidad y pérdida de escrituras evaluadas.
- [ ] Aprobación explícita recibida.
- [ ] Acción ejecutada por el propietario y evidencia guardada.
- [ ] D1/R2 reconciliados; no se borraron objetos automáticamente.
- [ ] Smoke tests repetidos.

## Criterio de cierre de Fase 9

La implementación documental y automatizada está completada: runbook de release/rollback, verificador postdespliegue y controles CI. La **certificación operativa** permanece pendiente hasta:
1. comprobar la versión real de `vega_drive_db`, el bookmark de Time Travel y la ventana de retención del plan (o documentar el mecanismo legacy si `alpha`);
2. confirmar historial de deployments y disponibilidad efectiva de logs/alertas;
3. ejecutar y registrar, con autorización explícita, una prueba controlada de rollback del Worker y la recuperación D1 que se decida realizar.

No se declarará que una restauración o rollback fue ensayado por el mero hecho de documentarlo o consultar un bookmark.
