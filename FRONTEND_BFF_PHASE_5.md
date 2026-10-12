# Fase 5 — Auditoría inicial de Frontend y BFF

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

### Recientes, favoritos y búsqueda

- [x] El router reconoce las rutas de recientes, favoritos y búsqueda.
- [ ] `frontend/src/screens/screen-for-route.tsx` todavía renderiza placeholders para estas vistas.
- [ ] No se encontró en la API pública actual de `files` un contrato implementado para listar recientes, marcar/listar favoritos o buscar en el catálogo. No conectar pantallas con mocks como sustituto del contrato real.
- [ ] Definir semántica, contratos públicos, autorización por propietario, paginación y pruebas de acceso cruzado antes de conectar estas vistas. La persistencia de favoritos debe ser propiedad de un módulo; no introducir SQL desde el BFF ni desde otro módulo.

### Composition root

- [x] `src/worker/composition-root.ts` expone gateways in-process para Identity y Files y gateways tipados para Quota y Sharing.
- [ ] Quota y Sharing son placeholders con `ready: false`; no deben tratarse como capacidades implementadas.
- [ ] Añadir/confirmar pruebas que garanticen que controllers consumen gateways y que las nuevas funcionalidades solo dependan de APIs públicas. No crear una segunda composición ni importar repositorios D1/R2 directamente desde rutas.

## Trabajo pendiente para cerrar la Fase 5

- [ ] Auditoría visual responsive y de accesibilidad por teclado/lector de pantalla; corregir contraste, foco, nombres accesibles y estados de carga/error/éxito donde haga falta.
- [ ] Añadir pruebas automatizadas de componentes/servicios para carga, vacío, error, reintento, paginación, transferencia fallida, cancelación y finalización.
- [ ] Probar assets y cabeceras en build/preview y en la URL desplegada: CSP compatible con React y Turnstile, nosniff, Referrer-Policy, frame protection, HSTS y `Cache-Control: no-store` en API; registrar respuestas observadas.
- [ ] Diseñar e implementar contratos de recientes, favoritos y búsqueda antes de sustituir los placeholders.
- [ ] Ejecutar la integración E2E de transferencia desde la UI hasta el resultado del catálogo, incluyendo archivos grandes, descarga, error, cancelación y acceso cruzado.
- [ ] Añadir pruebas de composición/arquitectura para Identity, Files y los gateways futuros; mantener Quota/Sharing explícitamente no disponibles hasta que sus módulos existan.
- [ ] Ejecutar `pnpm run cloudflare:build` y el conjunto de pruebas del commit candidato. No declarar éxito sin resultados observados.

## Criterio de cierre

La Fase 5 se cerrará cuando las vistas existentes y las nuevas capacidades que entren en alcance tengan contratos reales, estados accesibles, límites BFF verificados, evidencia de assets/cabeceras/operación, transferencias integradas de extremo a extremo y pruebas aprobadas. No se exige implementar Quota o Sharing dentro de esta fase, pero sus placeholders deben seguir siendo explícitos y seguros.
