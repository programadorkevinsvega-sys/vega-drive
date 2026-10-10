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
    ├── files
    ├── quota
    └── sharing
         │
         ├── D1 única: VEGA_DRIVE_DB
         └── R2 privado: solo files
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

Una subida normal sigue este flujo: navegador → POST /api/files → caso de uso de files → adaptador R2. Una descarga sigue: navegador → GET /api/files/:id/download → autorización → streaming del Worker desde R2. Nunca se devuelve una URL de R2 al navegador.

## 4. Módulos y propiedad

Cada módulo posee su dominio, casos de uso, repositorios, tablas y eventos. Los módulos iniciales son:

| Módulo   | Responsabilidad                                                                                |
| -------- | ---------------------------------------------------------------------------------------------- |
| identity | usuarios, invitaciones, credenciales y sesiones                                                |
| files    | carpetas, archivos, papelera, metadatos, transferencias privadas y almacenamiento físico en R2 |
| quota    | límites y contabilización de capacidad                                                         |
| sharing  | enlaces compartidos, revocación y expiración                                                   |

Los nombres pueden evolucionar, pero la propiedad de datos y reglas debe permanecer explícita.

### API pública de módulo

Cada módulo expone una fachada estable en module.public-api.ts o un puerto equivalente de aplicación.

- Otro módulo solo puede usar la API pública del módulo dueño.
- Están prohibidos los imports de carpetas internas de otro módulo: domain, application, infrastructure, repositories o tablas.
- La composición del Worker inyecta las fachadas en memoria. Esta llamada tipada en proceso es el mecanismo síncrono actual.
- Los eventos entre módulos se publican a través de una interfaz; pueden ejecutarse localmente hoy y cambiar a Cloudflare Queues al extraer módulos.
- Service Bindings no son obligatorios dentro del monolito actual. Serán el adaptador de transporte al separar un módulo en su propio Worker.

Esta regla conserva la independencia de los módulos sin fingir que ya son microservicios.

## 5. BFF interno y gateways

El BFF está dentro del único Worker. Sus controladores Hono son adaptadores de transporte: validan la forma de la petición, resuelven la sesión y llaman a un gateway. No importan domain, application ni infrastructure de los módulos.

El BFF solo conoce contratos de gateway y la API pública de cada módulo. El composition root conecta esos contratos con adaptadores en proceso:

```typescript
export interface FilesGateway {
  initUpload(
    actor: AuthenticatedActor,
    input: InitUploadInput,
  ): Promise<InitUploadOutput>;
  listFolder(
    actor: AuthenticatedActor,
    folderId: string,
  ): Promise<FolderListing>;
}

export class InProcessFilesGateway implements FilesGateway {
  constructor(private readonly api: FilesPublicApi) {}

  initUpload(actor: AuthenticatedActor, input: InitUploadInput) {
    return this.api.initUpload(actor, input);
  }

  listFolder(actor: AuthenticatedActor, folderId: string) {
    return this.api.listFolder(actor, folderId);
  }
}
```

AuthenticatedActor se crea exclusivamente a partir de la sesión validada en el backend. Ningún controller acepta ownerId, rol o permiso enviado por el navegador como fuente de verdad.

Al extraer files, este gateway se sustituye por ServiceBindingFilesGateway que implementa el mismo contrato. El BFF, los controllers y los casos de uso consumidores no cambian.

## 6. Capas internas y dependencias

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

## 7. Una D1 con límites estrictos

Vega Drive tiene una sola base de datos: VEGA_DRIVE_DB. Compartir el binding no elimina la propiedad modular.

- Cada módulo es dueño exclusivo de sus tablas, índices y migraciones.
- Las tablas llevan prefijo de módulo: identity_users, identity_sessions, identity_outbox, files_items, files_folders, files_uploads, files_outbox, quota_usage y sharing_links.
- Una referencia entre módulos es un valor, no una clave foránea. Por ejemplo, files_items.owner_id no tiene FK a identity_users.
- Las migraciones se guardan cerca del módulo dueño, por ejemplo modules/identity/infrastructure/persistence/d1/migrations y modules/files/infrastructure/persistence/d1/migrations. Cada módulo mantiene su propia numeración; un manifest central documenta el orden de aplicación sobre la única D1.
- Un repositorio solo consulta y modifica las tablas de su módulo.
- Están prohibidos los JOINs, claves foráneas, consultas SQL y modificaciones directas sobre tablas de otro módulo.
- La comunicación de datos entre módulos usa la API pública o eventos, aunque físicamente compartan D1.
- Un db.batch() o transacción solo toca tablas de un módulo. Si una operación necesita coordinación entre módulos, se modela mediante caso de uso orquestador, contratos explícitos e idempotencia; no mediante SQL que atraviese límites.
- Esta frontera se verifica automáticamente: una regla de lint o test de arquitectura debe fallar cuando SQL de files mencione identity* o cuando SQL de identity mencione files*, y se extiende la misma regla a todos los prefijos.
- Todo acceso a datos de usuario se filtra con el userId obtenido exclusivamente de la sesión validada.

## 8. R2 y almacenamiento privado

R2 pertenece funcionalmente a files.

- Solo infrastructure/storage/r2 de files recibe o usa el binding o las credenciales de R2.
- La aplicación usa un puerto IFileStoragePort; el dominio nunca importa R2Bucket ni APIs S3.
- El adaptador HTTP, los demás módulos y el frontend no acceden a R2.
- El bucket no es público, no usa r2.dev, no tiene dominio público ni CORS para el navegador.
- Está prohibido generar URLs prefirmadas o entregar cualquier referencia de R2 al cliente.
- Las claves se generan en el backend con el formato u/{userId}/{uuid}; nunca provienen del cliente.
- Antes de guardar, leer, descargar o borrar se valida sesión, propiedad, cuota y reglas del recurso.
- Las descargas se transmiten por el Worker con Content-Disposition: attachment y X-Content-Type-Options: nosniff.
- Se verifican tamaños reales y se limpian operaciones de almacenamiento internas fallidas.

## 9. Transporte HTTP y seguridad

- Las rutas públicas viven bajo /api y se sirven desde el mismo origen que el frontend.
- El adaptador HTTP usa validación de esquema para body, query y parámetros; rechaza campos no esperados.
- Las operaciones mutantes validan Origin y sesión.
- Los datos autenticados responden con Cache-Control: no-store.
- Se aplican CSP, HSTS, nosniff, Referrer-Policy y protección contra frame embedding.
- Se aplican límites de tasa en autenticación, registro y transferencias de archivos.
- Los secretos se entregan solo al Worker mediante bindings o wrangler secret. Nunca se registran, se incluyen en assets o se devuelven en respuestas.
- Todo cambio mantiene las reglas de Security.md; si este documento y Security.md discrepan sobre seguridad, prevalece la regla más restrictiva.

## 10. Estructura orientativa

```text
src/
  worker/
    fetch.ts
    composition-root.ts
  bff/
    gateways/
    controllers/
    middleware/
  modules/
    identity/
    files/
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

## 11. Evolución futura a Workers separados

Un módulo solo se extrae cuando exista una necesidad real de escala, despliegue, aislamiento operativo o equipo independiente.

Para extraerlo:

1. Se mantiene su domain y application sin cambios.
2. Se sustituye la fachada en memoria por un adaptador de Service Binding que respeta el mismo contrato.
3. Sus eventos pasan al adaptador de Cloudflare Queues si requieren entrega asíncrona.
4. Se crea su D1 propia y se migran solo sus tablas con prefijo, por ejemplo files\_\*. Como no existen FKs ni JOINs cruzados, la copia no rompe a identity ni a los demás módulos.
5. El composition root cambia InProcessFilesGateway por ServiceBindingFilesGateway(env.FILES_SERVICE).
6. El BFF/Worker principal deja de conocer su infraestructura y usa solo el contrato público.

No se anticipa esta separación con Workers ficticios ni con dependencias de red innecesarias en el monolito actual.

## 12. Checklist obligatorio de pull request

- [ ] El cambio pertenece a un módulo con dueño claro.
- [ ] No hay imports internos entre módulos; solo APIs públicas.
- [ ] Domain y application no dependen de Cloudflare ni de HTTP.
- [ ] D1 se usa solo desde repositorios de infraestructura del módulo dueño.
- [ ] No hay consultas, JOINs, claves foráneas ni db.batch() entre tablas de módulos distintos.
- [ ] Existe y pasa el lint/test que detecta referencias SQL a prefijos de otros módulos.
- [ ] El frontend no contiene lógica de negocio y usa solo /api.
- [ ] No existe acceso del navegador a R2, ni URLs prefirmadas, ni SDK/configuración de R2 en assets.
- [ ] Solo files accede a R2 mediante IFileStoragePort.
- [ ] Las rutas HTTP no contienen reglas de negocio ni SQL directo.
- [ ] Se añadieron pruebas de aislamiento entre usuarios cuando aplica.
- [ ] Los archivos de código respetan la responsabilidad única y el límite de 200 líneas.
- [ ] Una excepción arquitectónica incluye un ADR aprobado.

## 13. Prioridad

La arquitectura del monolito modular tiene prioridad sobre atajos de implementación. Si un requisito exige romper estas reglas, se detiene el cambio y se solicita una decisión explícita con ADR.

## 14. Seguridad transversal en la capa Worker/Hono

Los controles HTTP se configuran en el middleware Hono o en la capa de respuesta del Worker que corresponda; no se debe asumir Next.js ni configurar `next.config.ts` en este proyecto.

- Aplicar CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y defensa contra framing con valores revisados para los assets reales.
- Comprobar cabeceras en respuestas normales, errores, rutas API y assets cuando corresponda.
- HSTS solo se habilita con HTTPS confirmado y un alcance de dominio deliberado. La CSP debe probarse con el frontend real; no copiar una política genérica ni relajarla sin justificación.
- Las rutas Hono son adaptadores de transporte: validan la forma de la petición, obtienen el actor desde una sesión verificada y delegan a gateways/APIs públicas. No autorizan basándose en IDs o roles enviados por el navegador.
- Toda operación sobre metadatos o contenido de archivos verifica propiedad/permisos en el servidor antes de consultar o mutar D1 y antes de leer, escribir o borrar en R2.
- Las respuestas autenticadas o privadas deben usar `Cache-Control: no-store`. El diseño predeterminado es mismo origen y no CORS abierto.
- No introducir un segundo modelo de autorización ni identidades operativas adicionales sin una necesidad explícita del producto.
- La certificación requiere pruebas negativas de sesiones, autorización, IDOR/BOLA, concurrencia, entradas malformadas, rate limiting, privacidad R2 y comprobaciones productivas. El éxito de `/api/health` no sustituye estas pruebas.

La matriz y el estado de cada control se mantienen en [Security.md](./Security.md); el seguimiento por fases está en [roadmap.md](./roadmap.md).

## 15. Rollback y compatibilidad de despliegues

El procedimiento operativo canónico está en [Rollback.md](./Rollback.md). Todo cambio de aplicación, esquema D1, formato de metadatos u objeto R2 debe evaluar cómo se recuperará la versión anterior.

- Un rollback del Worker no revierte migraciones D1, objetos R2 ni eventos ya publicados.
- Las migraciones D1 deben ser backward-compatible durante la ventana de rollback; aplicar expansión/contracción y reservar los cambios destructivos para un release posterior al período de compatibilidad.
- No borrar objetos R2 como efecto automático de un rollback. Mantener claves/formato compatibles hasta que ninguna versión anterior pueda necesitarlos.
- Si se incorporan Queues, versionar contratos incompatibles y mantener consumidores compatibles durante la transición; no documentar Queue/DLQ como existente hasta que esté configurada.
- Staging debe tener Worker, D1, R2 y secretos aislados de producción y debe validar despliegue, smoke/E2E y rollback antes de certificar el procedimiento.
- El rollback debe seleccionar explícitamente un deployment estable de Wrangler; confirmar el objetivo y la sintaxis interactiva antes de confirmar. No automatizar un rollback ciego.
- La evidencia, el estado de backups y los criterios de recuperación se mantienen en [Rollback.md](./Rollback.md). Un health check aislado no demuestra recuperación de D1/R2 ni de los flujos funcionales.
