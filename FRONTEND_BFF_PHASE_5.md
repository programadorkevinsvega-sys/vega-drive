# Fase 5 — Estado final de Frontend y BFF

**Estado: CERRADA. Revisión documental: 2026-11-23.** Este documento resume el alcance funcional integrado. Los resultados de CI y las validaciones de producción se distinguen: una prueba con D1/R2 simulados no certifica por sí sola el entorno real.

## Arquitectura frontend/BFF

- [x] Un único Worker enruta `/api/*` al BFF y el resto a los assets.
- [x] Frontend y API comparten el mismo origen.
- [x] Mi unidad y Papelera consumen el catálogo autenticado.
- [x] Recientes usa persistencia por propietario, paginación y pantalla conectada.
- [x] Favoritos usa persistencia por propietario, endpoints protegidos y pantalla conectada.
- [x] Búsqueda parcial por nombre de archivos/carpetas activas, filtro por tipo y paginación por cursor; endpoint protegido y vista conectada.
- [x] Los gateways de Identity y Files delegan en las APIs públicas de sus módulos. Quota y Sharing tienen sus propias fases; Sharing se completó en Fase 7 y Quota sigue pendiente en Fase 6.

## Transferencias

- [x] La interfaz integra subida simple y multipart, progreso, pausa/reanudación, cancelación y reintentos según el servicio implementado.
- [x] Las rutas BFF validan sesión, actor, permisos y estado de transferencia.
- [x] Las transferencias directas a R2 solo se habilitan mediante autorización del Worker y URLs prefirmadas temporales de alcance mínimo conforme a [ADR-001](./ADR-001-direct-r2-transfers.md).
- [x] Se conserva el flujo alternativo a través del Worker según configuración.
- [x] Las validaciones operativas de producción de Fase 4 fueron registradas como completadas por confirmación del propietario el 2026-10-12; véase [FILES_PHASE_4.md](./FILES_PHASE_4.md).

## Vista previa privada

- [x] La vista previa utiliza rutas same-origin autenticadas; el Worker vuelve a validar sesión y propietario y transmite bytes privados.
- [x] No entrega URL firmada ni clave R2 al navegador.
- [x] Soporta formatos nativos del navegador, PDF, texto/Markdown y extracción local limitada de DOCX/XLSX según los límites de [FILES_PREVIEW.md](./FILES_PREVIEW.md).
- [x] Pruebas HTTP cubren autorización, aislamiento entre propietarios, expiración/revocación de sesión, Range 206/416 y respuestas no-cacheables.
- [x] La vista previa no depende de CORS de R2; CORS solo aplica a transferencias directas autorizadas.

## Seguridad, arquitectura y CI

- [x] Estados de carga/error/vacío y controles accesibles principales integrados en las vistas.
- [x] Cabeceras de seguridad configuradas para assets y respuestas del Worker/BFF; las verificaciones del proyecto comprueban sus contratos.
- [x] El composition root mantiene un único punto de composición y gateways tipados.
- [x] Las guardias arquitectónicas impiden imports internos y acceso SQL/R2 desde capas no propietarias.
- [x] CI valida PR sobre el merge ref, push a ramas y main, y merge queue. El job agregado se denomina `Required checks`.
- [x] Las fases 7 y 8 ampliaron las capacidades de compartición y las pruebas transversales después del cierre de esta fase.

## Separación entre implementación y estado de producción

Las migraciones de Recientes, Favoritos y Búsqueda están versionadas en el módulo Files y se incluyen en el flujo de despliegue de producción. El estado aplicado en una D1 concreta se confirma consultando `pnpm run db:migration:list` y `pnpm run db:verify:schema:production` con autorización operativa; el CI local o el hecho de que una migración exista en Git no prueba por sí solo el estado remoto.

La operación de producción, el postcheck, el historial de despliegues y la recuperación D1 están en [Rollback.md](./Rollback.md). La Fase 9 sigue con certificación operativa pendiente hasta completar esas comprobaciones.

## Fuera de alcance de Fase 5

- Cuotas pertenecen a Fase 6 y se mantienen pendientes deliberadamente.
- Compartición se implementó en Fase 7.
- Endurecimiento transversal se cerró en Fase 8.
- Operación y recuperación se documentan por separado en Fase 9.
- No existe staging ni se requiere para cerrar esta fase.

## Criterio de cierre

La Fase 5 se considera cerrada: las vistas principales y sus contratos están conectados al BFF, Recientes/Favoritos/Búsqueda están implementados, la vista previa privada está integrada, y las guardias y pruebas correspondientes están en el repositorio. Los pendientes externos de producción no se trasladan artificialmente a esta fase; se mantienen en Fase 9.
