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

**Cierre de fase: CERRADA (2026-10-10).** Se cumplieron los entregables propios de contrato, esqueleto del Worker, recursos base, build, pruebas, CI y despliegue. Las verificaciones de seguridad ligadas a funciones aún no implementadas quedan asignadas a las fases que las introducen; no se marca como terminada la plataforma completa.

Estado de cierre: **Fase 0 cerrada en alcance fundacional**. Los pendientes de configuración operativa que solo se vuelven necesarios al implementar autenticación o transferencias R2 se mantienen como requisitos de sus fases correspondientes, no como bloqueadores de esta fase. El 2026-10-10 Cloudflare completó `pnpm run cloudflare:build` y `pnpm run deploy`: formato, guardia arquitectónica, TypeScript, 4 archivos de pruebas/12 tests, `pnpm audit --audit-level=high`, migraciones remotas, verificación estructural de D1 (17 tablas/índices), despliegue y `verify:production` con `/api/health` HTTP 200. Versión Worker desplegada más reciente registrada (2026-10-10 07:13 UTC): `a6bb5609-9afd-4566-b298-d0b3178c5698`; el despliegue volvió a pasar el build, 4 archivos/12 tests, auditoría, verificación de D1 (17 tablas/índices) y `/api/health` HTTP 200. GitHub Actions del commit `23329baa646e38ecc816620c68eef8f861ae49b5` terminó en verde (29 s), con 4 archivos/12 tests aprobados y Gitleaks sin fugas detectadas. El usuario confirmó que el bucket R2 es privado. Estas evidencias validan el esqueleto y el pipeline, pero no certifican permisos mínimos de R2, ausencia de dominio público/`r2.dev`/CORS ni la certificación global de seguridad.

### 0.1 Contrato y convenciones

- [x] Mantener Architecture, Security y este roadmap como documentos obligatorios y enlazados.
- [x] Añadir .gitignore para `.dev.vars*`, `.env*`, `.wrangler` y `node_modules`.
- [x] Añadir plantilla de PR con checklist de seguridad y arquitectura.
- [ ] Si se desea, revisar las reglas de `main` como configuración de colaboración, sin convertirlas en criterio de despliegue ni imponer un flujo de PR.
- **Aceptación:** documentos coherentes con el Worker único; las verificaciones que bloquean despliegue se ejecutan con los scripts `pnpm` en el build de Cloudflare.

### 0.2 Recursos Cloudflare

- [x] Configurar el binding `VEGA_DRIVE_DB` y verificar remotamente que las 17 tablas/índices coinciden con la migración versionada.
- [x] Configurar el binding `FILES_BUCKET` al bucket `vega-drive-files`.
- [x] Confirmar en el panel de Cloudflare que el bucket `vega-drive-files` es privado (confirmación del usuario, 2026-10-10).
- [ ] **Antes de la Fase 4 (transferencias R2):** verificar en el panel que no haya dominio público ni `r2.dev` habilitado y que no exista CORS de navegador. El bucket está confirmado como privado; esta comprobación adicional no bloquea el cierre de Fase 0 porque todavía no existe flujo de archivos.
- [ ] **Antes de la Fase 4:** confirmar permisos mínimos para el acceso de R2, limitado al bucket requerido, cuando se implemente el adaptador real. No hay todavía un adaptador de almacenamiento de archivos.
- [x] Configurar Turnstile y su secreto en el Worker durante la Fase 2; la verificación de producción confirmó que la configuración pública y el secreto server-side están presentes y el propietario probó tokens válidos e inválidos.
- [ ] Revisar los secretos operativos del Worker antes de habilitar funciones que los requieran; Gitleaks ya pasó en GitHub Actions y no se presenta como parte del build de Cloudflare.
- [x] Ejecutar `pnpm audit --audit-level=high` dentro de `pnpm run cloudflare:build`.
- [ ] Definir un control de secretos que forme parte del camino de despliegue si se requiere que también bloquee despliegues. Gitleaks existe en GitHub Actions, pero ese job no debe presentarse como una comprobación ejecutada por `cloudflare:build`. Mantener secretos fuera de archivos versionados.
- **Aceptación de Fase 0:** bindings D1/R2 configurados, D1 verificada, bucket confirmado como privado y Gitleaks sin fugas detectadas en CI. Cumplido con la evidencia disponible del 2026-10-10. Las verificaciones adicionales de exposición/permisos de R2 se deben completar antes de implementar o habilitar transferencias en la Fase 4; Turnstile quedó configurado y probado durante la Fase 2. Estos pendientes no impiden cerrar el esqueleto fundacional y no certifican la seguridad global.
- 🔒 SEC-R2-01, SEC-R2-02, SEC-R2-08, SEC-SEC-01.

### 0.3 Esqueleto único del Worker

- [x] Crear `src/worker` para fetch/scheduled (sin trabajo programado en esta fase).
- [x] Crear `src/bff` con Hono y el punto de entrada de la aplicación.
- [x] Crear `src/modules/identity`, `files`, `quota` y `sharing`, cada uno con `module.public-api.ts` mínimo.
- [x] Crear composition root con gateways en proceso para los cuatro módulos; por ahora las APIs son placeholders que informan `ready: false`.
- [x] Servir assets y `/api/*` desde el mismo Worker; `/api/health` responde 200.
- [x] Añadir prueba de contrato del composition root: los cuatro gateways delegan en sus APIs públicas placeholder y se mantienen en `ready: false`. El catálogo ya dispone de rutas BFF autenticadas sobre `FilesGateway`; las transferencias y los demás flujos de negocio siguen pendientes.
- **Aceptación ajustada a Fase 0:** Worker único, rutas API separadas de assets, salud de liveness y composición mínima tipada. No afirmar que módulos placeholder están funcionalmente listos.
- 🔒 SEC-FE-01, SEC-MOD-01, SEC-MOD-04.

### 0.4 Verificaciones automatizadas de build y despliegue

- [x] `pnpm run cloudflare:build` ejecuta `predeploy`, `pnpm run check` (formato, guardia arquitectónica, TypeScript y tests) y `pnpm audit --audit-level=high`.
- [x] Existe Gitleaks como comprobación complementaria en GitHub Actions; no forma parte del gate de despliegue de Cloudflare según el script actual.
- [x] La guardia arquitectónica está conectada a `pnpm run lint` y revisa imports entre módulos, SQL con prefijos ajenos, JOIN, FOREIGN KEY, `db.batch()` y uso del binding R2 fuera de files.
- [x] Ejecutar `pnpm run check` en el build de Cloudflare con las pruebas negativas de arquitectura; la ejecución del 2026-10-10 pasó los 4 archivos y 12 tests. Las pruebas cubren imports internos, SQL con prefijo ajeno, JOIN, FOREIGN KEY, `db.batch()` y binding R2 fuera de files.
- **Aceptación:** `pnpm run cloudflare:build` termina con código 0 y las pruebas de `pnpm test` demuestran que la guardia rechaza violaciones insertadas a propósito. Cumplido en Cloudflare el 2026-10-10.
- 🔒 SEC-MOD-02, SEC-MOD-03, SEC-SEC-03.

---

## Fase 1 — D1 única y límites de datos

**Estado: CERRADA (2026-10-10).** Todos los entregables de persistencia modular, límites de datos y aislamiento previstos en esta fase están implementados. Las dos actividades originalmente diferidas se completaron en las fases que introdujeron sus dependencias: identidad autenticada en Fase 2 y autorización de operaciones de catálogo en Fase 3. No queda trabajo pendiente dentro del alcance de Fase 1.

### Evidencia de cierre

- **Persistencia modular:** migraciones independientes de `identity` y `files`, manifest central, puertos/repositorios D1 y guardias arquitectónicas implementados.
- **SQL:** los repositorios D1 usan consultas parametrizadas y las pruebas comprueban los valores enlazados.
- **Aislamiento de repositorios:** pruebas con migraciones versionadas sobre SQLite real cubren lecturas y mutaciones de items, carpetas y uploads, además de revocación de sesiones entre propietarios.
- **Identidad y actor:** Fase 2 implementó `SessionResolver` y `AuthenticatedActor`; el actor se deriva de una sesión validada en servidor.
- **Aislamiento de casos de uso:** Fase 3 incorporó y probó movimientos, creación, papelera y restauración entre propietarios, sin aceptar un `ownerId` del cliente como autoridad.
- **Guardias:** las pruebas negativas comprueban que los verificadores detectan infracciones de fronteras.
- **Verificación final local (2026-10-11, commit `9cfb738`):** `pnpm run check` pasó con 130/130 pruebas de backend; `pnpm run verify:architecture:all` pasó; `pnpm run db:verify:schema:local` confirmó 22 tablas/índices; `pnpm run cloudflare:build` pasó con 119/119 pruebas de frontend, build de producción, auditorías sin vulnerabilidades conocidas y Wrangler dry-run.
- **D1 remota:** se conserva como evidencia histórica la verificación de solo lectura reportada el 2026-10-10 (17 tablas/índices en ese momento). La validación actual descrita arriba es de D1 local; no se afirma que la D1 remota se haya vuelto a consultar.

### 1.1 Tablas y migraciones por módulo

- [x] Crear migraciones independientes en cada módulo con numeración propia.
- [x] Mantener un manifest central que documente el orden de aplicación contra `VEGA_DRIVE_DB`.
- [x] Crear inicialmente `identity_users`, `identity_sessions`, `identity_invites` e `identity_outbox`.
- [x] Preparar `files_items`, `files_folders`, `files_uploads` y `files_outbox`; `quota_usage` y `sharing_links` se completan en sus fases.
- [x] Usar valores entre módulos, nunca claves foráneas.
- **Aceptación:** cada tabla e índice tiene un módulo dueño; no existe una tabla genérica compartida.
- 🔒 SEC-MOD-02, SEC-ISO-02.

### 1.2 Repositorios por módulo

- [x] Implementar repositorios solo bajo `infrastructure/persistence/d1` de su módulo.
- [x] Definir puertos en application y no exponer `D1Database` fuera de infraestructura.
- [x] Usar SQL parametrizado en los repositorios D1; las pruebas verifican valores enlazados y ausencia de interpolación SQL.
- [x] Derivar el actor de propietario desde la sesión validada mediante `SessionResolver` y `AuthenticatedActor` (implementado en Fase 2).
- [x] Probar aislamiento entre propietarios en las operaciones funcionales del catálogo (implementado en Fase 3).
- [x] Prohibir un módulo global `db/` que concentre la lógica de todos los dominios.
- **Aceptación:** domain/application no importan `D1Database`; un repositorio no consulta tablas ajenas; los casos de uso protegidos usan identidad de servidor y las pruebas cubren el aislamiento de recursos.
- 🔒 SEC-ISO-01, SEC-ISO-02, SEC-VAL-02, SEC-MOD-01.

### 1.3 Pruebas de frontera y aislamiento

- [x] Validar en CI las pruebas de aislamiento de repositorios D1 con SQLite real.
- [x] Probar acceso cruzado en los casos de uso de catálogo implementados; los intentos no autorizados se rechazan y no provocan cambios colaterales.
- [x] Probar que el lint arquitectónico bloquea imports, SQL, JOIN, FK y batch cruzados.
- [x] Volver a ejecutar las pruebas y verificaciones sobre el commit candidato `9cfb738`: 130/130 pruebas backend, verificadores arquitectónicos, D1 local (22 objetos) y build Cloudflare completados correctamente.
- **Aceptación de Fase 1:** persistencia y límites modulares verificados; autenticación de servidor y aislamiento funcional completados por las fases dependientes. No queda pendiente de Fase 1.
- 🔒 SEC-ISO-06, SEC-MOD-03.

---

## Fase 2 — Módulo identity

**Estado: CERRADA (2026-10-10, hora local de Colombia).** La implementación y aceptación funcional del módulo identity quedaron completadas. Este cierre cubre registro, autenticación, sesiones, Turnstile y cambio de contraseña. El catálogo de metadatos quedó completado y validado por separado en la Fase 3; las transferencias físicas de archivos, la certificación transversal de seguridad y el procedimiento de rollback pertenecen a fases posteriores. Véase [IDENTITY_PHASE_2.md](./IDENTITY_PHASE_2.md).

### Evidencia de cierre

- [x] El propietario confirmó en producción el registro y el inicio de sesión con Turnstile válido.
- [x] El propietario ejecutó una prueba de extremo a extremo con un token Turnstile inválido y confirmó que el servidor lo rechaza.
- [x] El propietario cambió la contraseña desde Ajustes, inició sesión con la nueva y confirmó el rechazo de la contraseña anterior.
- [x] El propietario confirmó que la sesión actual sigue funcionando tras el cambio y que las demás sesiones quedan revocadas.
- [x] El despliegue aportado por el propietario publicó la versión Worker `aa3c2aa4-1e86-4c38-9d52-a587dbfea36c`; la verificación de producción informó HTTP 200 en `/api/health` y presencia de la site key pública y del secreto server-side de Turnstile. El log compartido no identifica el SHA de Git asociado a esa versión.
- [x] La ejecución de GitHub Actions del commit `bd7e192f1afe6e89af2b6c10442f2b51e7d60ed5` terminó correctamente en los jobs `verify` y `secrets`: [ver CI](https://github.com/programadorkevinsvega-sys/vega-drive/actions/runs/38112184984).

### 2.1 Registro cerrado

- [x] Exponer Register a través de IdentityPublicApi y IdentityGateway.
- [x] Aplicar MAX_USERS validado en servidor con inserción atómica.
- [x] Normalizar correo, aplicar política de contraseña y almacenar hashes seguros.
- [x] Verificar Turnstile en el backend y fallar de forma cerrada.
- **Aceptación:** el controller no llama repositorios ni maneja reglas de registro; se mantiene el límite cerrado en servidor y la verificación de Turnstile falla de forma cerrada.
- 🔒 SEC-AUTH-01, SEC-AUTH-03, SEC-AUTH-05, SEC-AUTH-06, SEC-AUTH-07.

### 2.2 Login y sesiones

- [x] Implementar Login, Logout y SessionResolver dentro de identity.
- [x] Usar cookie `__Host-session` y guardar solo hash de token.
- [x] Crear AuthenticatedActor desde la sesión validada en middleware BFF.
- [x] Pasar el actor derivado de la sesión validada al gateway de identity para cambio de contraseña; nunca aceptar ownerId, rol o permisos del navegador como autoridad.
- [x] Proteger cambio de contraseña con AuthenticatedActor; validar sesión y no aceptar campos desconocidos como userId/ownerId.
- [x] Añadir auditoría de login, registro y cambio de contraseña sin guardar contraseñas ni tokens.
- [x] Añadir bloqueo progresivo por correo/IP con claves hasheadas y expiración de ventana.
- [x] Limitar el cuerpo JSON a 64 KiB durante lectura, verificar Origin y aplicar cabeceras de seguridad.
- [x] Añadir pruebas de casos de uso y límites HTTP para registro, login, logout, sesiones, contraseña, Turnstile y rate limiting.
- **Aceptación:** las rutas protegidas responden 401 sin sesión y rechazan campos de autoridad enviados por cliente. Las pruebas automatizadas y la aceptación manual en producción cubren Turnstile válido/inválido, cambio de contraseña, continuidad de la sesión actual y revocación de las demás sesiones.
- 🔒 SEC-SES-01…05, SEC-ISO-01, SEC-AUTH-02, SEC-AUTH-04.

---

## Fase 3 — Módulo files: catálogo

**Estado: CERRADA (2026-10-11).** El catálogo de metadatos de archivos y carpetas está implementado y validado localmente en el commit `9cfb738`. Véase el registro de evidencia y alcance en [FILES_PHASE_3.md](./FILES_PHASE_3.md).

### Evidencia de cierre

- [x] Crear, listar, renombrar y mover metadatos de carpetas y archivos.
- [x] Validar y normalizar nombres; rechazar duplicados entre tipos de nodo y prevenir ciclos de carpetas.
- [x] Aplicar aislamiento por propietario a operaciones de catálogo; rechazar movimientos, creación y restauración sobre recursos ajenos.
- [x] Implementar borrado lógico, papelera, restauración, paginación y breadcrumbs.
- [x] Probar movimientos/renombrados correctos, aislamiento entre propietarios y conflictos sin cambios colaterales.
- [x] Reconciliar D1 local y verificar las 22 tablas/índices contra las migraciones.
- [x] Ejecutar `pnpm run check`: Prettier, lint arquitectónico, TypeScript y 130/130 pruebas backend aprobadas.
- [x] Ejecutar `pnpm run verify:architecture:all`: todos los verificadores finalizaron correctamente.
- [x] Ejecutar `pnpm run cloudflare:build`: 119/119 pruebas frontend, build de producción, auditorías sin vulnerabilidades conocidas y Wrangler dry-run aprobados.
- [x] Actualizar la documentación de fase y el estado del roadmap.

### 3.1 Catálogo, aislamiento y validación

- [x] Mantener los datos de catálogo bajo tablas y repositorios del módulo `files`.
- [x] Derivar autoridad del actor de servidor, nunca de un `ownerId` proporcionado por el navegador.
- [x] Verificar que rechazos por propiedad y conflictos de nombre no alteren recursos ni produzcan efectos colaterales.
- [x] Probar papelera y restauración con aislamiento por propietario.
- **Aceptación:** el catálogo de dominio implementa y prueba el alcance funcional de metadatos y aislamiento. El hito HTTP conecta esas operaciones existentes con Hono, sin declarar terminada la integración completa del frontend/Fase 5.
- 🔒 SEC-ISO-02…06, SEC-VAL-03, SEC-MOD-02.

### 3.2 Papelera y ciclo de vida

- [x] Implementar borrado lógico y restauración.
- [x] Definir el alcance actual sin purga permanente ni limpieza automática.
- [x] Asignar eliminación física R2, idempotencia, reintentos y reconciliación de fallos D1/R2 a la Fase 4.
- [x] Documentar que una futura política de retención/purga requiere una decisión de producto y no bloquea el catálogo actual.
- **Aceptación:** papelera y restauración están probadas; el ciclo de vida se limita explícitamente al borrado lógico y la recuperación.
- 🔒 SEC-ISO-03, SEC-ISO-05, SEC-LOG-01.

### Fuera de alcance de Fase 3

- **Fase 4:** adaptador y transferencias físicas privadas con R2.
- **Fase 5:** integración completa del frontend, presentación, assets, verificación integral de cabeceras y operación. El hito HTTP del catálogo se implementa de forma incremental y no cierra esta fase.
- **Fase 6:** cuotas.
- **Fase 7:** compartición.
- **Fase 8:** certificación transversal de seguridad.

Estos trabajos permanecen en sus respectivas fases y no representan pendientes dentro del alcance de catálogo de Fase 3.

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

- [x] Implementar rutas Hono delgadas para el catálogo de metadatos: validan transporte y llaman `FilesGateway` sin importar capas internas.
- [x] Traducir resultados del catálogo a 400/404/409/503, rechazar sesiones ausentes con 401 y evitar exponer detalles internos.
- [ ] Completar la integración visual del frontend y las evidencias de presentación, assets y operación exigidas por la Fase 5.
- [ ] Mantener los gateways del composition root como punto de entrada modular para las funciones que se implementen después.
- **Aceptación:** controllers no importan domain, application, infrastructure, D1 ni R2; este hito no implica el cierre de la Fase 5.
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
