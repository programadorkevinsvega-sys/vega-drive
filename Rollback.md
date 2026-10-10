# Rollback y recuperación de Vega Drive

## Estado

**Estado de preparación: PENDIENTE.** Este documento define el procedimiento objetivo. No afirma que staging, backups/restauración de D1, Queues, DLQ, métricas avanzadas ni endpoints `/api/health/live` y `/api/health/ready` estén configurados o probados. El estado actual del despliegue y los comandos existentes se describen en [README.md](./README.md) y [migrations/manifest.md](./migrations/manifest.md).

## Objetivo

Recuperar una versión estable del Worker sin crear incompatibilidades con D1 ni perder o corromper objetos R2. Si se incorporan Queues, la recuperación también debe mantener la compatibilidad de mensajes y consumidores.

## Principios obligatorios

1. El rollback de aplicación debe ser reversible y tener un responsable y un deployment estable identificado.
2. Las migraciones D1 deben ser backward-compatible durante la ventana en que la versión anterior podría volver a activarse.
3. Una migración destructiva no se ejecuta en el mismo release que necesita poder volver al código anterior.
4. D1 no se considera automáticamente reversible: restaurar backup o reconstruir datos es una operación independiente, con análisis de pérdida de escrituras.
5. Staging debe validar el procedimiento antes de habilitarlo para producción.
6. R2 no se revierte borrando objetos nuevos por defecto. Los objetos pueden ser necesarios para la versión estable o haberse escrito después del despliegue.
7. No declarar rollback probado hasta conservar evidencia del ensayo y verificar salud y flujos críticos.

## Estrategia de release

```text
Release candidate
      ↓
Staging: aplicar migración compatible
      ↓
Staging Worker
      ↓
Smoke / E2E
      ↓
Confirmar compatibilidad con la versión anterior
      ↓
Migración de producción compatible
      ↓
Worker de producción
      ↓
Health + métricas + revisión de errores
```

El repositorio actualmente no declara un entorno staging separado. Antes de usar este flujo, crear y documentar recursos/configuración aislados para staging: Worker, D1, bucket R2, bindings y secretos independientes. Nunca ejecutar una prueba de rollback contra datos reales de producción.

## Rollback del Worker

Ante un fallo de aplicación que no requiera revertir datos:

1. Detener nuevos despliegues y registrar el commit, la versión Worker y la hora del incidente.
2. Consultar el historial de deployments con Wrangler y elegir explícitamente una versión estable anterior.
3. Revisar el diff de código/configuración y confirmar que esa versión es compatible con el esquema D1 actual y con cualquier objeto/evento que ya se haya escrito.
4. Ejecutar el rollback mediante el procedimiento soportado por la versión de Wrangler instalada y confirmar el deployment resultante. Los comandos orientativos son:

   ```bash
   pnpm exec wrangler deployments list
   pnpm exec wrangler rollback
   ```

   No ejecutar el segundo comando a ciegas: confirmar el deployment objetivo y la sintaxis/interacción que presenta Wrangler antes de confirmar.

5. Verificar salud, logs y flujos críticos; registrar resultado y decisión de recuperación.

El rollback del Worker no deshace las migraciones D1, no restaura R2 y no revierte mensajes ya publicados en una Queue.

## Migraciones y rollback de D1

Usar expansión/contracción para cambios incompatibles:

```text
vN: esquema antiguo
  ↓
expand: añadir columnas/tablas opcionales compatibles
  ↓
vN+1: código compatible con esquema antiguo y nuevo
  ↓
backfill idempotente y verificado
  ↓
vN+2: código usa el esquema nuevo
  ↓
esperar a que ninguna versión antigua siga activa
  ↓
contract: retirar elementos obsoletos en un release separado
```

- Antes de migrar, revisar el esquema remoto, historial de migraciones, backup disponible y procedimiento de restauración.
- Las migraciones se versionan y se prueban primero en una D1 de staging con datos representativos no sensibles.
- No editar una migración que ya se aplicó en un entorno compartido; añadir una migración nueva.
- No ejecutar `DROP`, renombres incompatibles ni eliminación de columnas mientras un Worker anterior pueda necesitar esos datos.
- Backfills y reparaciones deben ser idempotentes, medibles y reanudables.
- Si se requiere restaurar D1, detener o controlar escrituras, identificar el punto de recuperación, estimar pérdida de datos y obtener aprobación explícita antes de restaurar. No presentar la restauración como un simple rollback de código.
- El verificador actual de esquema D1 bloquea DDL que no sabe modelar; cualquier evolución del verificador debe revisarse y probarse antes de desplegar esa migración.

## R2

- Mantener el bucket privado y las claves de objeto estables durante el release.
- No exigir que un rollback borre objetos creados por la versión nueva.
- Los cambios de formato, nombre o estructura de metadatos deben permitir que ambas versiones lean los objetos durante la ventana de rollback.
- Si hace falta un backfill o migración de objetos, hacerla por etapas, idempotente y con un plan de reintento.
- No borrar objetos ni ejecutar una limpieza masiva como respuesta automática a un rollback.
- Verificar consistencia entre metadatos D1 y objetos R2 antes de reanudar operaciones críticas.

## Queues y eventos

**Aplicable solo si Vega Drive incorpora Queues o consumidores asíncronos.** En la configuración actual revisada no hay binding de Queue declarado; no simular ni marcar como existente una Queue/DLQ.

Cuando existan:

- Versionar el contrato de eventos cuando un cambio no sea compatible.
- Mantener consumidores capaces de procesar los mensajes emitidos por versiones anteriores durante la transición.
- No retirar campos requeridos mientras haya consumidores activos que los necesiten.
- Hacer handlers idempotentes y definir reintentos, dead-letter queue (DLQ) y replay seguro.
- Tras el rollback, revisar profundidad, antigüedad, errores y DLQ antes de volver a procesar o reproducir mensajes.

## Checklist operativo

### Antes del release

- [ ] Identificar y registrar el deployment estable anterior y el commit correspondiente.
- [ ] Confirmar compatibilidad del esquema D1 con la versión anterior.
- [ ] Confirmar que no hay migraciones destructivas pendientes.
- [ ] Confirmar backup de D1 y que el procedimiento de restauración se ensayó.
- [ ] Confirmar privacidad/consistencia de R2 y compatibilidad de los objetos.
- [ ] Revisar Queue/DLQ solo si están configuradas.
- [ ] Revisar logs, tasa de errores, latencia y alertas disponibles.
- [ ] Ensayar despliegue y rollback en staging con datos de prueba.

### Durante el rollback

- [ ] Detener nuevos releases y designar responsable del incidente.
- [ ] Confirmar objetivo estable y compatibilidad D1/R2 antes de revertir el Worker.
- [ ] Ejecutar rollback del Worker usando el procedimiento verificado para Wrangler.
- [ ] No ejecutar migraciones destructivas ni borrar objetos como parte automática del rollback.
- [ ] Confirmar bindings y secretos compatibles con la versión restaurada.
- [ ] Verificar el endpoint de salud realmente implementado. Hoy el script de producción verifica `/api/health`; `/api/health/live` y `/api/health/ready` son objetivos futuros hasta implementarlos y probarlos.

### Después

- [ ] Ejecutar smoke tests y flujos E2E críticos disponibles.
- [ ] Revisar tasa de errores, latencia y logs del Worker.
- [ ] Revisar errores D1 y coherencia de metadatos/objetos R2.
- [ ] Revisar Queue depth y DLQ solo si existen.
- [ ] Confirmar que operaciones y trabajos pendientes no se duplicaron ni perdieron.
- [ ] Registrar incidente, causa raíz, versión final y acciones preventivas.

## Evidencia y criterio de finalización

Guardar en CI/CD o en el registro operativo: fecha, entorno, commit inicial/final, ID de deployments, migraciones involucradas, comandos ejecutados, resultados de smoke/E2E y responsable. No registrar secretos ni datos privados.

La foundation de rollback solo puede declararse **COMPLETE** cuando staging está aislado, el procedimiento de despliegue y rollback se ejecuta de extremo a extremo, la compatibilidad D1/R2 está comprobada, el backup/restauración de D1 se ha ensayado y la evidencia se conserva. Los controles no aplicables (por ejemplo, Queues antes de incorporarlas) deben quedar explícitamente identificados como tales.
