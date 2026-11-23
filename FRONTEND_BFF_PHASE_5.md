# Fase 5 — Seguimiento de Frontend y BFF

**Fecha:** 2026-10-12  
**Estado:** EN CURSO. Este documento registra el estado observado en el código; no certifica producción ni sustituye la ejecución de CI.

## Estado comprobado en el repositorio

### Frontend y catálogo

- [x] El Worker enruta `/api/*` al BFF y el resto de las peticiones a los assets de Cloudflare: `src/worker/index.ts`.
- [x] Mi unidad y Papelera se renderizan con `FilesCatalogScreen`, que consume el catálogo mediante los servicios HTTP same-origin.
- [x] La pantalla del catálogo integra `FileTransferControls` y refresca el catálogo tras una subida completada.
- [x] Existen estados visuales de carga, error, vacío y paginación; la pantalla usa `role="status"`, `role="alert"` y etiquetas accesibles en la lista.
- [x] El shell incluye salto al contenido principal, título por ruta, foco al cambiar de ruta y cierre del menú móvil con Escape.
- [x] Hay una configuración de cabeceras para assets en `frontend/public/_headers`, además de `SECURITY_HEADERS` para respuestas del BFF.
- [ ] La existencia de esos componentes/configuraciones no demuestra que la experiencia completa sea accesible ni que las cabeceras correctas se reciban en producción. Falta una matriz de pruebas y evidencia HTTP.

### Transferencias físicas

- [x] El frontend contiene un servicio de transferencia con subida simple, multipart, pausa/reanudación, cancelación y progreso.
- [x] El BFF contiene rutas de transferencia y descarga en `src/bff/routes/files-transfer-routes.ts`.
- [x] La configuración de activación de transferencias directas está controlada por `DIRECT_R2_TRANSFERS_ENABLED`; existe una ruta de respaldo a través del Worker.
- [x] La Fase 4 y sus validaciones operativas están registradas como completadas en `FILES_PHASE_4.md`.
- [ ] En esta auditoría de documentación no se volvió a ejecutar una prueba E2E ni CI. El cierre de integración de Fase 5 requiere comprobar que el flujo de UI, los endpoints y los estados de error/cancelación encajan en el commit candidato.

### Vista previa segura de archivos

- [x] El BFF autoriza URLs GET firmadas de corta duración; los bytes se sirven directamente desde R2.
- [x] Visor nativo de imágenes, audio/vídeo y PDF, lectura de texto y extracción local limitada de DOCX/XLSX.
- [ ] Configurar y verificar CORS del bucket R2; instrucciones en FILES_PREVIEW.md.
- [ ] Verificar acceso cruzado, caducidad, Range y host R2 en producción.

### Recientes, favoritos y búsqueda

- [x] Recientes ya tiene contrato público en `files`: lista archivos por última apertura/descarga, con paginación por cursor y solo recursos activos visibles para el actor.
- [x] La migración `0005_files_recent_activity.sql` registra la última actividad por combinación de propietario y archivo; las escrituras usan el actor autenticado y la consulta D1 filtra por `owner_id`.
- [x] El BFF expone `GET /api/files/recent` y `POST /api/files/items/:id/open`, detrás del middleware de sesión. Las descargas registran actividad al iniciar el flujo autorizado, tanto en la ruta de URL firmada como en el fallback del Worker.
- [x] La pantalla Recientes consume el BFF y muestra carga, error, reintento, vacío, paginación y acción de descarga.
- [ ] La migración aún no se ha aplicado ni desplegado desde esta tarea; requiere autorización operativa explícita y posterior verificación de D1.
- [x] Favoritos y Búsqueda cuentan con contratos reales en Files, persistencia D1 y endpoints BFF protegidos. La búsqueda consulta únicamente el árbol activo del propietario autenticado; no introducir SQL desde el BFF ni desde otro módulo.
- [ ] Se añadieron pruebas unitarias para aislamiento de actividad, pero todavía no se han ejecutado. Falta prueba de integración BFF y evidencia de acceso cruzado en el entorno de pruebas.

### Composition root

- [x] `src/worker/composition-root.ts` expone gateways in-process para Identity y Files y gateways tipados para Quota y Sharing.
- [ ] Quota y Sharing son placeholders con `ready: false`; no deben tratarse como capacidades implementadas.
- [ ] Añadir/confirmar pruebas que garanticen que controllers consumen gateways y que las nuevas funcionalidades solo dependan de APIs públicas. No crear una segunda composición ni importar repositorios D1/R2 directamente desde rutas.

## Trabajo pendiente para cerrar la Fase 5

- [ ] Auditoría visual responsive y de accesibilidad por teclado/lector de pantalla; corregir contraste, foco, nombres accesibles y estados de carga/error/éxito donde haga falta.
- [ ] Añadir pruebas automatizadas de componentes/servicios para carga, vacío, error, reintento, paginación, transferencia fallida, cancelación y finalización.
- [ ] Probar assets y cabeceras en build/preview y en la URL desplegada: CSP compatible con React y Turnstile, nosniff, Referrer-Policy, frame protection, HSTS y `Cache-Control: no-store` en API; registrar respuestas observadas.
- [x] Definir e implementar el contrato inicial de Recientes, su persistencia por propietario y su pantalla conectada.
- [x] Favoritos implementados: migración `0006_files_favorites.sql`, contrato público, persistencia D1, endpoints protegidos, pantalla conectada y pruebas.
- [x] Búsqueda implementada en el alcance del PR: búsqueda parcial por nombre de archivos/carpetas activos, filtro por tipo, paginación por cursor, endpoint protegido y pantalla conectada. La aplicación de `0007_files_search_indexes.sql` en D1 requiere el despliegue autorizado.
- [ ] Aplicar/verificar la migración de Recientes solo en una operación autorizada; ejecutar las pruebas añadidas y agregar pruebas BFF/E2E de acceso cruzado.
- [ ] Ejecutar la integración E2E de transferencia desde la UI hasta el resultado del catálogo, incluyendo archivos grandes, descarga, error, cancelación y acceso cruzado.
- [ ] Añadir pruebas de composición/arquitectura para Identity, Files y los gateways futuros; mantener Quota/Sharing explícitamente no disponibles hasta que sus módulos existan.
- [ ] Ejecutar `pnpm run cloudflare:build` y el conjunto de pruebas del commit candidato. No declarar éxito sin resultados observados.

## Criterio de cierre

La Fase 5 se cerrará cuando las vistas existentes y las nuevas capacidades que entren en alcance tengan contratos reales, estados accesibles, límites BFF verificados, evidencia de assets/cabeceras/operación, transferencias integradas de extremo a extremo y pruebas aprobadas. No se exige implementar Quota o Sharing dentro de esta fase, pero sus placeholders deben seguir siendo explícitos y seguros.
