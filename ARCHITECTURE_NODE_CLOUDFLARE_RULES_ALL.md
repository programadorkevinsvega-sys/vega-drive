# Arquitectura obligatoria de Vega Drive

## 1. Decisiones de arquitectura

Este documento es el contrato canónico de arquitectura de Vega Drive. Se aplica a todo código, configuración, pruebas y cambios de despliegue.

Vega Drive es un **monolito modular serverless**:

- Hay un único repositorio, un único código desplegable y un único Cloudflare Worker.
- El frontend y el backend son capas independientes por código y responsabilidad, pero conviven en el mismo Worker y el mismo origen.
- Existe una única base de datos D1, con el binding `VEGA_DRIVE_DB`.
- Los módulos no son microservicios ni Workers independientes hoy.
- Los límites de los módulos se diseñan para permitir una separación futura sin reescribir el dominio ni los casos de uso.
- R2 es privado y solo se usa desde el módulo de almacenamiento a través del backend.

No se permite convertir estas decisiones en sugerencias implícitas. Una excepción exige un ADR aprobado antes de implementar.

## 2. Diagrama de despliegue actual

```text
Navegador
    │  mismo origen: HTML, JS, CSS y /api
    ▼
Cloudflare Worker único: Vega Drive
├── assets del frontend
├── adaptador HTTP /api
├── composición de dependencias
└── módulos internos
    ├── identity
    ├── drive-catalog
    ├── file-storage
    ├── quota
    └── sharing
         │
         ├── D1 única: VEGA_DRIVE_DB
         └── R2 privado: solo file-storage
```

El Worker atiende los assets estáticos y las rutas /api. El enrutador HTTP delega en los módulos; no incorpora reglas de negocio ni acceso directo a D1 o R2.

## 3. Frontera frontend/backend

El frontend es una aplicación de presentación dentro del mismo despliegue, no un backend alterno.

- Solo llama a rutas del mismo origen bajo /api.
- Puede manejar estado visual, accesibilidad, navegación y validaciones de experiencia de usuario.
- No decide autorización, propiedad, cuota, claves de almacenamiento, precios, flujos de negocio ni políticas de seguridad.
- No contiene ni recibe endpoint, bucket, credenciales, token, SDK, URL prefirmada ni configuración de R2/S3.
- No contacta R2. Las subidas y descargas atraviesan /api y el Worker.
- Toda validación de seguridad y toda decisión de negocio se repite y se resuelve de forma autoritativa en el backend.

Una subida normal sigue este flujo: navegador → POST /api/files → caso de uso de file-storage → adaptador R2. Una descarga sigue: navegador → GET /api/files/:id/download → autorización → streaming del Worker desde R2. Nunca se devuelve una URL de R2 al navegador.

## 4. Módulos y propiedad

Cada módulo posee su dominio, casos de uso, repositorios, tablas y eventos. Los módulos iniciales son:

| Módulo | Responsabilidad |
|---|---|
| identity | usuarios, invitaciones, credenciales y sesiones |
| drive-catalog | carpetas, nodos, papelera y metadatos de archivos |
| file-storage | transferencia privada y almacenamiento físico en R2 |
| quota | límites y contabilización de capacidad |
| sharing | enlaces compartidos, revocación y expiración |

Los nombres pueden evolucionar, pero la propiedad de datos y reglas debe permanecer explícita.

### API pública de módulo

Cada módulo expone una fachada estable en module.public-api.ts o un puerto equivalente de aplicación.

- Otro módulo solo puede usar la API pública del módulo dueño.
- Están prohibidos los imports de carpetas internas de otro módulo: domain, application, infrastructure, repositories o tablas.
- La composición del Worker inyecta las fachadas en memoria. Esta llamada tipada en proceso es el mecanismo síncrono actual.
- Los eventos entre módulos se publican a través de una interfaz; pueden ejecutarse localmente hoy y cambiar a Cloudflare Queues al extraer módulos.
- Service Bindings no son obligatorios dentro del monolito actual. Serán el adaptador de transporte al separar un módulo en su propio Worker.

Esta regla conserva la independencia de los módulos sin fingir que ya son microservicios.

## 5. Capas internas y dependencias

Todo módulo mantiene estas capas:

```text
modules/<module>/
  domain/           entidades, value objects, invariantes y errores
  application/      casos de uso, DTOs y puertos
  infrastructure/   D1, R2, eventos y otros adaptadores de Cloudflare
  module.public-api.ts
```

Las dependencias apuntan hacia adentro:

- domain no importa application, infrastructure, HTTP, Cloudflare ni SDKs.
- application depende de domain y de puertos, nunca de D1Database, R2Bucket, Hono ni bindings de env.
- infrastructure implementa los puertos y es el único lugar que usa los bindings concretos.
- El adaptador HTTP valida la petición y llama una API pública; no ejecuta SQL ni manipula R2.
- shared-kernel contiene solo abstracciones realmente universales: Result, Clock, IDs, errores base y tipos técnicos mínimos. No contiene entidades del dominio ni modelos de persistencia.

Un archivo tiene una responsabilidad pública principal y no supera 200 líneas de código, salvo una excepción documentada y revisada.

## 6. Una D1 con límites estrictos

Vega Drive tiene una sola base de datos: VEGA_DRIVE_DB. Compartir el binding no elimina la propiedad modular.

- Cada módulo es dueño exclusivo de sus tablas, índices y migraciones.
- Las tablas llevan prefijo de módulo: identity_users, identity_sessions, drive_nodes, storage_uploads, quota_usage y sharing_links.
- Las migraciones se guardan cerca del módulo dueño y se ejecutan en un orden central documentado contra la única D1.
- Un repositorio solo consulta y modifica las tablas de su módulo.
- Están prohibidos los JOINs, consultas SQL y modificaciones directas sobre tablas de otro módulo.
- La comunicación de datos entre módulos usa la API pública o eventos, aunque físicamente compartan D1.
- Las transacciones abarcan las tablas de un único módulo. Si una operación necesita coordinación entre módulos, se modela mediante caso de uso orquestador, contratos explícitos e idempotencia; no mediante SQL que atraviese límites.
- Todo acceso a datos de usuario se filtra con el userId obtenido exclusivamente de la sesión validada.

## 7. R2 y almacenamiento privado

R2 pertenece funcionalmente a file-storage.

- Solo infrastructure/storage/r2 de file-storage recibe o usa el binding o las credenciales de R2.
- La aplicación usa un puerto IFileStoragePort; el dominio nunca importa R2Bucket ni APIs S3.
- El adaptador HTTP, los demás módulos y el frontend no acceden a R2.
- El bucket no es público, no usa r2.dev, no tiene dominio público ni CORS para el navegador.
- Está prohibido generar URLs prefirmadas o entregar cualquier referencia de R2 al cliente.
- Las claves se generan en el backend con el formato u/{userId}/{uuid}; nunca provienen del cliente.
- Antes de guardar, leer, descargar o borrar se valida sesión, propiedad, cuota y reglas del recurso.
- Las descargas se transmiten por el Worker con Content-Disposition: attachment y X-Content-Type-Options: nosniff.
- Se verifican tamaños reales y se limpian operaciones de almacenamiento internas fallidas.

## 8. Transporte HTTP y seguridad

- Las rutas públicas viven bajo /api y se sirven desde el mismo origen que el frontend.
- El adaptador HTTP usa validación de esquema para body, query y parámetros; rechaza campos no esperados.
- Las operaciones mutantes validan Origin y sesión.
- Los datos autenticados responden con Cache-Control: no-store.
- Se aplican CSP, HSTS, nosniff, Referrer-Policy y protección contra frame embedding.
- Se aplican límites de tasa en autenticación, registro y transferencias de archivos.
- Los secretos se entregan solo al Worker mediante bindings o wrangler secret. Nunca se registran, se incluyen en assets o se devuelven en respuestas.
- Todo cambio mantiene las reglas de Security.md; si este documento y Security.md discrepan sobre seguridad, prevalece la regla más restrictiva.

## 9. Estructura orientativa

```text
src/
  worker/
    fetch.ts
    composition-root.ts
  http/
    routes/
    middleware/
  modules/
    identity/
    drive-catalog/
    file-storage/
    quota/
    sharing/
  platform/
    logger/
    events/
  shared-kernel/
frontend/
  src/
public/
migrations/
  manifest.md
wrangler.toml
```

La estructura puede ajustarse, pero no se cambian las fronteras de dependencia, propiedad ni despliegue definidas aquí.

## 10. Evolución futura a Workers separados

Un módulo solo se extrae cuando exista una necesidad real de escala, despliegue, aislamiento operativo o equipo independiente.

Para extraerlo:

1. Se mantiene su domain y application sin cambios.
2. Se sustituye la fachada en memoria por un adaptador de Service Binding que respeta el mismo contrato.
3. Sus eventos pasan al adaptador de Cloudflare Queues si requieren entrega asíncrona.
4. Sus tablas se migran gradualmente desde la D1 única a su almacenamiento propio, con un plan de migración y reconciliación.
5. El BFF/Worker principal deja de conocer su infraestructura y usa solo el contrato público.

No se anticipa esta separación con Workers ficticios ni con dependencias de red innecesarias en el monolito actual.

## 11. Checklist obligatorio de pull request

- [ ] El cambio pertenece a un módulo con dueño claro.
- [ ] No hay imports internos entre módulos; solo APIs públicas.
- [ ] Domain y application no dependen de Cloudflare ni de HTTP.
- [ ] D1 se usa solo desde repositorios de infraestructura del módulo dueño.
- [ ] No hay consultas ni JOINs entre tablas de módulos distintos.
- [ ] El frontend no contiene lógica de negocio y usa solo /api.
- [ ] No existe acceso del navegador a R2, ni URLs prefirmadas, ni SDK/configuración de R2 en assets.
- [ ] Solo file-storage accede a R2 mediante IFileStoragePort.
- [ ] Las rutas HTTP no contienen reglas de negocio ni SQL directo.
- [ ] Se añadieron pruebas de aislamiento entre usuarios cuando aplica.
- [ ] Los archivos de código respetan la responsabilidad única y el límite de 200 líneas.
- [ ] Una excepción arquitectónica incluye un ADR aprobado.

## 12. Prioridad

La arquitectura del monolito modular tiene prioridad sobre atajos de implementación. Si un requisito exige romper estas reglas, se detiene el cambio y se solicita una decisión explícita con ADR.
