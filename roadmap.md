# Roadmap de Vega Drive

Plan de implementación del monolito modular serverless. La arquitectura obligatoria está en [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md) y las reglas de seguridad en [Security.md](./Security.md).

Leyenda: [ ] pendiente · [x] hecho · 🔒 controles obligatorios.

## Reglas para todas las fases

1. Vega Drive se despliega como un único Worker con frontend y BFF internos, una única D1 llamada VEGA_DRIVE_DB y módulos en el mismo código.
2. Un módulo solo usa sus tablas, repositorios, migraciones y API pública. Están prohibidos imports internos, JOINs, claves foráneas, SQL o transacciones entre módulos.
3. Los controllers del BFF solo validan transporte, resuelven la sesión y llaman gateways; no contienen lógica de negocio, SQL ni R2.
4. El frontend llama solo al mismo origen bajo /api y nunca accede a R2.
5. R2 es privado y solo el módulo files lo usa mediante IFileStoragePort.
6. Cada fase incluye pruebas proporcionales y el checklist de Security.md.
7. Una subfase se termina solo con código, pruebas, documentación y controles arquitectónicos ejecutados por los scripts del proyecto y el build de Cloudflare.

## Resumen

| Fase | Resultado                                           |
| ---- | --------------------------------------------------- |
| 0    | Contrato, estructura del Worker y CI                |
| 1    | D1 única con límites verificables por módulo        |
| 2    | Módulo identity: registro, sesiones y autenticación |
| 3    | Módulo files: catálogo de carpetas y archivos       |
| 4    | Módulo files: transferencias privadas con R2        |
| 5    | Frontend/BFF en el mismo Worker                     |
| 6    | Módulo quota                                        |
| 7    | Módulo sharing                                      |
| 8    | Endurecimiento y pruebas de arquitectura            |
| 9    | Despliegue y operación                              |
| 10   | Mejoras y posible extracción de módulos             |

---

## Fase 0 — Fundamentos del monolito modular

Estado de cierre: **parcialmente verificado; no cerrar aún**. El Worker está desplegado, `/api/health` responde 200, D1 tiene 17 tablas/índices que coinciden con las migraciones y el último `cloudflare:build` confirmado por el usuario pasó formato, guardia arquitectónica, typecheck, 4 tests y `pnpm audit --audit-level=high`. El criterio principal es el resultado de los scripts `pnpm` ejecutados en el build/despliegue de Cloudflare, no GitHub Actions. Estas evidencias no demuestran por sí solas la privacidad real de R2.

### 0.1 Contrato y convenciones

- [x] Mantener Architecture, Security y este roadmap como documentos obligatorios y enlazados.
- [x] Añadir .gitignore para `.dev.vars*`, `.env*`, `.wrangler` y `node_modules`.
- [x] Añadir plantilla de PR con checklist de seguridad y arquitectura.
- [ ] Si se desea, revisar las reglas de `main` como configuración de colaboración, sin convertirlas en criterio de despliegue ni imponer un flujo de PR.
- **Aceptación:** documentos coherentes con el Worker único; las verificaciones que bloquean despliegue se ejecutan con los scripts `pnpm` en el build de Cloudflare.

### 0.2 Recursos Cloudflare

- [x] Configurar el binding `VEGA_DRIVE_DB` y verificar remotamente que las 17 tablas/índices coinciden con la migración versionada.
- [x] Configurar el binding `FILES_BUCKET` al bucket `vega-drive-files`.
- [ ] Verificar en el panel de Cloudflare que R2 no tiene acceso público, dominio público ni `r2.dev` habilitado y que no existe CORS para navegador. La configuración del binding no demuestra privacidad.
- [ ] Confirmar permisos mínimos y secretos del Worker en Cloudflare; la configuración local no demuestra los permisos reales del recurso.
- [ ] Configurar Turnstile solo cuando se habilite registro/login; actualmente `TURNSTILE_SITE_KEY` está vacío y no hay flujo de autenticación en Fase 0.
- [x] Ejecutar `pnpm audit --audit-level=high` dentro de `pnpm run cloudflare:build`.
- [ ] Definir un control de secretos que forme parte del camino de despliegue si se requiere que también bloquee despliegues. Gitleaks existe en GitHub Actions, pero ese job no debe presentarse como una comprobación ejecutada por `cloudflare:build`. Mantener secretos fuera de archivos versionados.
- **Aceptación:** D1/R2 solo se usan desde el Worker, privacidad R2 comprobada en Cloudflare y no hay secretos versionados. Los dos últimos puntos de privacidad/permisos siguen pendientes de verificación externa.
- 🔒 SEC-R2-01, SEC-R2-02, SEC-R2-08, SEC-SEC-01.

### 0.3 Esqueleto único del Worker

- [x] Crear `src/worker` para fetch/scheduled (sin trabajo programado en esta fase).
- [x] Crear `src/bff` con Hono y el punto de entrada de la aplicación.
- [x] Crear `src/modules/identity`, `files`, `quota` y `sharing`, cada uno con `module.public-api.ts` mínimo.
- [x] Crear composition root con gateways en proceso para los cuatro módulos; por ahora las APIs son placeholders que informan `ready: false`.
- [x] Servir assets y `/api/*` desde el mismo Worker; `/api/health` responde 200.
- [x] Añadir prueba de contrato del composition root: los cuatro gateways delegan en sus APIs públicas placeholder y se mantienen en `ready: false`. No hay todavía controllers de negocio que llamen gateways; registro, catálogo y transferencias pertenecen a fases posteriores.
- **Aceptación ajustada a Fase 0:** Worker único, rutas API separadas de assets, salud de liveness y composición mínima tipada. No afirmar que módulos placeholder están funcionalmente listos.
- 🔒 SEC-FE-01, SEC-MOD-01, SEC-MOD-04.

### 0.4 Verificaciones automatizadas de build y despliegue

- [x] `pnpm run cloudflare:build` ejecuta `predeploy`, `pnpm run check` (formato, guardia arquitectónica, TypeScript y tests) y `pnpm audit --audit-level=high`.
- [x] Existe Gitleaks como comprobación complementaria en GitHub Actions; no forma parte del gate de despliegue de Cloudflare según el script actual.
- [x] La guardia arquitectónica está conectada a `pnpm run lint` y revisa imports entre módulos, SQL con prefijos ajenos, JOIN, FOREIGN KEY, `db.batch()` y uso del binding R2 fuera de files.
- [ ] Ejecutar `pnpm run check` en el build de Cloudflare con las nuevas pruebas negativas, y corregir cualquier fallo antes de considerar cerrada esta subfase. Las pruebas cubren imports internos, SQL con prefijo ajeno, JOIN, FOREIGN KEY, `db.batch()` y binding R2 fuera de files.
- **Aceptación:** `pnpm run cloudflare:build` termina con código 0 y las pruebas de `pnpm test` demuestran que la guardia rechaza las violaciones insertadas a propósito. La ejecución anterior de build pasó los checks base, pero las nuevas pruebas negativas todavía necesitan una ejecución verde en el camino de build/despliegue.
- 🔒 SEC-MOD-02, SEC-MOD-03, SEC-SEC-03.

---

## Fase 1 — D1 única y límites de datos

### 1.1 Tablas y migraciones por módulo

- [ ] Crear migraciones independientes en cada módulo con numeración propia.
- [ ] Mantener un manifest central que documente el orden de aplicación contra VEGA_DRIVE_DB.
- [ ] Crear inicialmente identity_users, identity_sessions, identity_invites e identity_outbox.
- [ ] Preparar files_items, files_folders, files_uploads y files_outbox; quota_usage y sharing_links se completan en sus fases.
- [ ] Usar valores entre módulos, nunca claves foráneas; por ejemplo files_items.owner_id no referencia mediante FK a identity_users.
- **Aceptación:** cada tabla e índice tiene un módulo dueño; no existe una tabla genérica compartida.
- 🔒 SEC-MOD-02, SEC-ISO-02.

### 1.2 Repositorios por módulo

- [ ] Implementar repositorios solo bajo infrastructure/persistence/d1 de su módulo.
- [ ] Definir puertos en application y no exponer D1Database fuera de infraestructura.
- [ ] Usar SQL parametrizado y filtros de usuario derivados de la sesión.
- [ ] Prohibir un módulo global db/ que concentre la lógica de todos los dominios.
- **Aceptación:** domain y application no importan D1Database; un repositorio no menciona tablas ajenas.
- 🔒 SEC-ISO-01, SEC-ISO-02, SEC-VAL-02, SEC-MOD-01.

### 1.3 Pruebas de frontera y aislamiento

- [ ] Probar acceso cruzado entre usuarios para cada repositorio y caso de uso.
- [ ] Probar que el lint arquitectónico bloquea import, SQL, JOIN, FK y batch cruzados.
- **Aceptación:** las pruebas se ejecutan en CI y fallan ante una violación insertada a propósito.
- 🔒 SEC-ISO-06, SEC-MOD-03.

---

## Fase 2 — Módulo identity

### 2.1 Registro cerrado

- [ ] Exponer Register a través de IdentityPublicApi y IdentityGateway.
- [ ] Implementar invitación de un uso o MAX_USERS validado en servidor.
- [ ] Normalizar correo, aplicar política de contraseña y almacenar hashes seguros.
- [ ] Verificar Turnstile en el backend.
- **Aceptación:** el controller no llama repositorios ni maneja reglas de registro.
- 🔒 SEC-AUTH-01, SEC-AUTH-03, SEC-AUTH-05, SEC-AUTH-06, SEC-AUTH-07.

### 2.2 Login y sesiones

- [ ] Implementar Login, Logout y SessionResolver dentro de identity.
- [ ] Usar cookie \_\_Host-session y guardar solo hash de token.
- [ ] Crear AuthenticatedActor desde la sesión validada en middleware BFF.
- [ ] Pasar AuthenticatedActor a gateways; nunca aceptar ownerId, rol o permisos del navegador como autoridad.
- **Aceptación:** las rutas protegidas responden 401 sin sesión y un ownerId enviado por cliente no altera la autorización.
- 🔒 SEC-SES-01…05, SEC-ISO-01, SEC-AUTH-02, SEC-AUTH-04.

---

## Fase 3 — Módulo files: catálogo

### 3.1 Carpetas y nodos

- [ ] Implementar FilesPublicApi y FilesGateway.
- [ ] Crear, renombrar, mover, listar y eliminar carpetas/archivos de metadatos.
- [ ] Prevenir ciclos y duplicados dentro del mismo padre.
- [ ] Mantener el nombre de usuario separado de la clave física de R2.
- **Aceptación:** files usa solo files\_\* y devuelve 404 para recursos ajenos.
- 🔒 SEC-ISO-02…06, SEC-VAL-03, SEC-MOD-02.

### 3.2 Papelera y navegación

- [ ] Implementar borrado lógico, restauración, paginación y breadcrumbs.
- [ ] Programar limpieza de metadatos y objetos mediante el caso de uso de files.
- **Aceptación:** la papelera no cruza las fronteras de usuario ni de módulo.
- 🔒 SEC-ISO-03, SEC-ISO-05, SEC-LOG-01.

---

## Fase 4 — Módulo files: R2 privado

### 4.1 Adaptador de almacenamiento

- [ ] Definir IFileStoragePort en application.
- [ ] Implementar el adaptador solo en modules/files/infrastructure/storage/r2.
- [ ] Inyectar el binding/credenciales únicamente en ese adaptador.
- [ ] Generar claves u/{userId}/{uuid} en el backend.
- **Aceptación:** una búsqueda de imports muestra que solo files usa R2Bucket o API S3.
- 🔒 SEC-ISO-04, SEC-R2-01…03, SEC-MOD-04.

### 4.2 Subida por API

- [ ] Implementar POST /api/files a través de FilesGateway.
- [ ] Validar sesión, actor, nombre, tamaño, tipo, cuota y propiedad antes de almacenar.
- [ ] Transmitir bytes mediante el Worker; si se necesita multipart interno, encapsularlo sin exponer IDs, partes o URLs al navegador.
- [ ] Verificar tamaño real y registrar metadatos solo tras completar.
- **Aceptación:** la red del navegador contiene únicamente llamadas al mismo origen y ninguna a R2.
- 🔒 SEC-R2-03…05, SEC-ISO-05, SEC-RATE-01.

### 4.3 Descarga y limpieza

- [ ] Implementar GET /api/files/:id/download a través de FilesGateway.
- [ ] Autorizar antes de streaming y devolver Content-Disposition: attachment y nosniff.
- [ ] Gestionar Range y limpieza interna de operaciones fallidas u obsoletas.
- **Aceptación:** no se devuelve una URL de R2 ni se permite descargar un archivo ajeno.
- 🔒 SEC-R2-03, SEC-R2-06, SEC-R2-07.

---

## Fase 5 — Frontend y BFF del mismo Worker

### 5.1 Assets y presentación

- [ ] Servir frontend y API desde el mismo Worker/origen.
- [ ] Implementar componentes de presentación, accesibilidad, CSP y manejo visual de estados.
- [ ] Prohibir SDKs, endpoint, bucket o configuración de R2 en assets.
- **Aceptación:** frontend solo usa /api y no contiene lógica de autorización, cuota ni almacenamiento.
- 🔒 SEC-FE-01, SEC-FE-02, SEC-WEB-01, SEC-WEB-02.

### 5.2 Controllers y gateways

- [ ] Implementar controllers Hono delgados que validan transporte y llaman gateways.
- [ ] Mantener InProcessFilesGateway e InProcessIdentityGateway en el composition root.
- [ ] Manejar 401/404/errores sin detalles sensibles.
- **Aceptación:** controllers no importan domain, application, infrastructure, D1 ni R2.
- 🔒 SEC-MOD-01, SEC-MOD-04, SEC-LOG-03.

---

## Fase 6 — Módulo quota

- [ ] Crear quota_usage, migraciones y repositorios de quota.
- [ ] Exponer QuotaPublicApi para verificar y reservar capacidad.
- [ ] Usar contratos explícitos o eventos desde files; no leer files\_\* con SQL desde quota.
- [ ] Usar Durable Object solo si la concurrencia requiere coordinación fuerte.
- **Aceptación:** no se supera la cuota con transferencias paralelas y no hay SQL entre quota*\* y files*\*.
- 🔒 SEC-R2-05, SEC-RATE-03, SEC-MOD-02.

## Fase 7 — Módulo sharing

- [ ] Crear sharing_links, migraciones, SharePublicApi y SharingGateway.
- [ ] Usar token con hash, expiración y revocación.
- [ ] Obtener el recurso mediante contrato de files, no consultando files\_\* directamente.
- [ ] Transmitir descargas compartidas a través del Worker, sin URL de R2.
- **Aceptación:** un enlace expirado/revocado falla y no permite navegación fuera de un único recurso.
- 🔒 SEC-SHARE-01…03, SEC-R2-03, SEC-MOD-02.

## Fase 8 — Endurecimiento y pruebas de seguridad

Esta fase no se considera completada por tener un Worker desplegado o un endpoint de salud operativo. La certificación global permanece pendiente hasta obtener evidencia reproducible para cada control aplicable de [Security.md, sección 14](./Security.md#14-endurecimiento-transversal-y-certificación).

### 8.1 Arquitectura y entradas

- [ ] Probar que las rutas no acceden directamente a D1/R2 ni saltan gateways, APIs públicas o casos de uso.
- [ ] Probar entradas malformadas, identificadores inválidos, campos desconocidos, límites de cuerpo y paginación.
- [ ] Comprobar que errores públicos no filtran secretos, tokens, SQL ni trazas internas.

### 8.2 Autenticación y autorización

- [ ] Probar sesiones ausentes, inválidas, expiradas y revocadas; verificar que logout invalida la sesión.
- [ ] Probar autorización server-side para cada operación sensible.
- [ ] Ejecutar regresiones IDOR/BOLA entre cuentas para lectura, modificación, movimiento y borrado.
- [ ] Ejecutar pruebas concurrentes sobre propiedad, permisos, cuotas y límites.

### 8.3 Archivos y privacidad

- [ ] Probar que no se pueden leer, sobrescribir, mover o eliminar recursos ajenos.
- [ ] Verificar que claves y operaciones R2 están controladas por el servidor y que el bucket no es público.
- [ ] Probar límites y expiración de enlaces temporales si se introducen; no exponer URLs de R2 por defecto.
- [ ] Revisar respuestas, URLs y logs para detectar tokens, secretos, claves internas o datos sensibles.

### 8.4 Abuso, cabeceras y producción

- [ ] Probar rate limiting de Cloudflare y aplicación para autenticación y operaciones costosas.
- [ ] Probar Origin/CSRF para mutaciones autenticadas mediante cookies.
- [ ] Verificar CSP, HSTS, nosniff, defensa contra framing, Referrer-Policy, Permissions-Policy y Cache-Control.
- [ ] Ejecutar escaneo de secretos, auditoría de dependencias y revisión de configuración.
- [ ] Verificar `/api/health` y todos los flujos críticos ya implementados en el entorno de producción.

**Aceptación de la fase:** pruebas aplicables aprobadas en el commit candidato, evidencias registradas sin datos sensibles, excepciones justificadas y ninguna vulnerabilidad crítica/alta abierta. Los flujos aún no implementados quedan identificados como pendientes; no se declaran aprobados por no poder probarlos.

## Fase 9 — Despliegue, operación y rollback

- [ ] Separar staging y producción por configuración, con Worker, D1, bucket R2 y secretos aislados por entorno.
- [ ] Configurar dominio/HTTPS, controles de Cloudflare, alertas y backups de D1; documentar y ensayar restauración.
- [ ] Emitir logs estructurados sin secretos ni datos sensibles y documentar rotación de secretos e incidentes.
- [ ] Documentar el deployment estable anterior, comprobar compatibilidad del esquema D1 y seguir [Rollback.md](./Rollback.md) para rollback de Worker.
- [ ] Validar en staging un ciclo release candidate → migración compatible → Worker → smoke/E2E → rollback controlado.
- [ ] Demostrar que el rollback del Worker no depende de revertir migraciones ni borrar objetos R2; revisar consistencia D1/R2.
- [ ] Configurar Queues/DLQ y pruebas de compatibilidad solo si el producto incorpora procesamiento asíncrono.
- [ ] Implementar y probar endpoints `/api/health/live` y `/api/health/ready` solo si se necesitan; hasta entonces, documentar que la verificación actual usa `/api/health`.
- **Aceptación:** staging aislado; despliegue y rollback ejecutados con evidencia; restauración de D1 ensayada; salud, smoke/E2E, logs y métricas revisados. Rollback no se declara completo por una reversión del Worker únicamente.
- 🔒 SEC-WEB-03, SEC-RATE-04, SEC-LOG-01…03.

## Fase 10 — Mejoras y extracción futura

- [ ] Miniaturas, búsqueda, 2FA, versionado y sincronización se modelan en un módulo dueño antes de codificar.
- [ ] Extraer un módulo solo con una necesidad real de escala, despliegue o aislamiento operativo.
- [ ] Para extraer files: crear Worker y D1 propios, migrar solo files\_\*, sustituir InProcessFilesGateway por ServiceBindingFilesGateway y conservar sus contratos.
- **Aceptación:** la extracción no obliga a cambiar identity, controllers consumidores, dominio ni casos de uso.
