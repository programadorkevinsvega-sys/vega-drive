# Operación y rollback de Vega Drive

## Alcance y estado real

**Entorno operativo: producción únicamente.** Vega Drive no tiene un entorno staging separado; esta guía no presupone ni exige uno. Las pruebas automatizadas se ejecutan en CI con D1 local/efímera y servicios simulados. No equivalen a un ensayo destructivo en producción.

La preparación del procedimiento queda documentada y automatizada parcialmente. **No se declara certificado un rollback real ni una restauración de D1** hasta que el propietario ejecute y registre esas operaciones en Cloudflare. No se han creado backups, no se ha restaurado D1 y no se ha ejecutado rollback como parte de esta fase.

## Arquitectura de recuperación

- **Worker:** se puede volver a publicar una versión anterior del Worker si sigue siendo compatible con los bindings, secretos y esquema D1 actuales.
- **D1:** las migraciones remotas no se revierten al hacer rollback del Worker. La recuperación de datos desde backup es una operación separada, con posible pérdida de escrituras posteriores al punto restaurado.
- **R2:** no se eliminan objetos como parte de un rollback de Worker. Los objetos nuevos pueden ser válidos y necesarios; no se hace limpieza masiva automática.
- **Queues/DLQ:** no hay binding de Queue declarado actualmente; no aplica.
- **Staging:** no existe y no se crea como parte de esta fase.

## Despliegue normal

1. Confirmar que main contiene el commit aprobado y que CI está verde para ese SHA.
2. Revisar el diff de migraciones. Las migraciones deben ser compatibles con la versión Worker que permanece activa hasta completar el despliegue. Usar expansión/contracción: añadir primero, migrar consumidores después y retirar elementos antiguos en un release posterior.
3. Verificar que los secretos requeridos existen en el entorno Worker y que no se han incluido en Git.
4. Ejecutar el comando oficial: pnpm run deploy. No ejecutar wrangler deploy ni migraciones remotas por separado para saltarse deploy:preflight.
5. El release aplica migraciones, consulta el historial, compara el esquema remoto, publica el Worker y ejecuta pnpm run verify:production.
6. La verificación de producción comprueba:
   - / responde HTML HTTP 200 y entrega cabeceras de seguridad.
   - /api/health responde JSON HTTP 200 con status=ok y service=vega-drive.
   - /api/auth/config informa ready=true y contiene la site key pública.
   - Las rutas comprobadas conservan CSP estricta, HSTS, nosniff, Referrer-Policy, protección de framing, Permissions-Policy, COOP/CORP; las rutas API deben responder Cache-Control: no-store.
7. Si una verificación falla, detener nuevos releases, conservar logs y registrar SHA, hora y versión Worker. No asumir que el release está sano por haber compilado.

Comandos de diagnóstico de solo lectura:

    pnpm exec wrangler deployments list
    pnpm run db:migration:list
    pnpm run db:verify:schema:production
    pnpm run verify:production

Los dos últimos comandos consultan producción. Ejecutarlos solo con autorización operativa del propietario y credenciales Cloudflare ya configuradas en el entorno seguro.

## Runbook: rollback del Worker

Usar solo cuando el problema sea del código/configuración del Worker y se haya comprobado que no requiere restaurar datos.

1. **Contener:** pausar nuevos despliegues y registrar incidente, hora UTC, SHA desplegado, versión Worker, síntomas y responsable.
2. **Identificar objetivo:** ejecutar pnpm exec wrangler deployments list; seleccionar la versión estable anterior por ID/metadata y confirmar el SHA asociado. No elegir "la anterior" sin inspeccionar historial.
3. **Comprobar compatibilidad:** revisar cambios desde el deployment estable, migraciones aplicadas, bindings, variables y secretos. Confirmar que el Worker anterior entiende el esquema D1 actual y los metadatos/objetos R2 escritos desde el release.
4. **Confirmar la acción:** consultar pnpm exec wrangler rollback --help y seguir el flujo interactivo soportado. No automatizar ni ejecutar rollback sin identificar el deployment objetivo y aprobación explícita del propietario.
5. **Verificar:** tras el rollback, ejecutar pnpm run verify:production; revisar en Cloudflare los logs/errores del Worker y probar manualmente login, listado, subida, descarga, preview y compartición con cuentas autorizadas. La verificación automatizada de health no sustituye esos flujos.
6. **Cerrar:** registrar versión restaurada, SHA, hora, comandos, resultado de smoke tests, migraciones que permanecen aplicadas y decisión de seguimiento.

**Importante:** rollback de Worker no deshace D1, no revoca URLs firmadas ya emitidas, no restaura R2 y no revierte escrituras. No borrar objetos ni revertir migraciones como reacción automática.

## Migraciones D1 y restauración

- Nunca editar una migración que ya se aplicó en un entorno compartido; crear una migración nueva.
- Mantener compatibilidad hacia atrás durante toda la ventana en que pueda volver a activarse el Worker anterior.
- No combinar cambios destructivos (DROP, eliminación/renombre incompatible) con el release que necesita rollback inmediato.
- Aplicar expansión/contracción y backfills idempotentes, reanudables y verificables.
- Antes del release, consultar el historial y el esquema remoto, y confirmar que existe un punto de recuperación D1 adecuado según la política/plan de Cloudflare vigente.
- El backup y la restauración deben administrarse desde los controles soportados de Cloudflare para esa base. Confirmar retención, timestamp, alcance y efecto sobre escrituras antes de restaurar.
- Restaurar D1 requiere aprobación explícita, plan de parada/control de escrituras, estimación de pérdida de datos y verificación posterior del esquema y consistencia. No se proporciona un comando genérico de restauración porque el mecanismo y la disponibilidad dependen de la configuración real de Cloudflare.
- La restauración no debe confundirse con rollback de Worker. Tras restaurar, validar coherencia con R2; no borrar objetos automáticamente.

## R2 y consistencia

- Mantener el bucket privado y sus claves estables.
- Los cambios de formato de metadatos deben permitir que el Worker anterior lea los objetos durante la ventana de rollback.
- No ejecutar limpieza masiva de R2 durante una incidencia.
- Si se necesita reparar metadatos/objetos, preparar un procedimiento específico, idempotente y con inventario previo.
- Antes de reabrir operaciones críticas, revisar errores D1, registros de transferencias y coherencia de metadatos/objetos según los medios disponibles.

## Observabilidad, secretos e incidentes

- Revisar Cloudflare Workers Logs/Observability para errores, excepciones y ejecuciones programadas. La configuración actual de observability global está desactivada aunque logs/traces tengan opciones declaradas; no asumir que existe un panel de métricas o alertas avanzadas configurado.
- No registrar contraseñas, cookies, tokens, URLs firmadas completas, cuerpos privados ni secretos.
- Mantener secretos en Cloudflare Worker Secrets/GitHub Environment Secrets; nunca en .env versionado, logs o frontend.
- Ante sospecha de filtración, detener el release, rotar el secreto afectado en Cloudflare y los sistemas que lo usan, invalidar credenciales relacionadas cuando corresponda y revisar el periodo de exposición.
- No hay Queue/DLQ configurada en el Worker; omitir pasos de replay de mensajes.

## Registro de release/incidente

Guardar en un sistema privado de operaciones (no en Git) los siguientes datos:

- Fecha/hora UTC y responsable.
- SHA de Git, ID de deployment anterior/nuevo/restaurado.
- Resultado CI y comando de release ejecutado.
- Migraciones aplicadas y resultado de verificación D1.
- Resultado de frontend, health y auth config.
- Flujos manuales probados y resultado.
- Incidente, impacto, decisiones, rollback y acciones correctivas.

Nunca incluir secretos, datos personales, tokens ni enlaces firmados.

## Checklist de producción

### Antes
- [ ] CI verde para el SHA que se va a publicar.
- [ ] Deployment estable anterior identificado.
- [ ] Compatibilidad Worker anterior ↔ esquema D1 actual revisada.
- [ ] Migraciones aditivas/backward-compatible; sin contract destructivo.
- [ ] Punto de recuperación D1 disponible y retención comprobada en Cloudflare.
- [ ] Secretos/bindings requeridos presentes y protegidos.
- [ ] Bucket R2 privado; no se planea borrar objetos durante recuperación.

### Después del despliegue
- [ ] Verificación automatizada frontend + health + auth config + headers aprobada.
- [ ] Login y logout comprobados.
- [ ] Listado, subida y descarga comprobados.
- [ ] Preview y enlaces compartidos comprobados.
- [ ] Logs de Worker revisados; sin errores nuevos relevantes.
- [ ] SHA y ID de deployment registrados.

### Si hay rollback
- [ ] Despliegues pausados y responsable asignado.
- [ ] Deployment objetivo y compatibilidad confirmados.
- [ ] Rollback Worker aprobado y ejecutado explícitamente.
- [ ] D1/R2 no revertidos ni limpiados automáticamente.
- [ ] Smoke tests repetidos y evidencia guardada.

## Criterio de cierre honesto

La fase puede cerrar su implementación de runbooks y verificaciones automatizadas sin staging. La **certificación operativa real** seguirá pendiente hasta que el propietario confirme desde Cloudflare: política/retención de backups D1, acceso a historial de deployments, logs observables y una prueba controlada de rollback/restauración apropiada. No se afirmará que la restauración de D1 o rollback de producción se ensayaron si no se ejecutaron.
