# Reglas Estrictas de Arquitectura — Monolito Modular Serverless en Cloudflare (Node / TypeScript)
## DDD + Clean Architecture + Hexagonal + SOLID + Cloudflare Ecosystem


> **Propósito de este documento:** este archivo es el contrato de arquitectura que debe respetarse en TODO momento al crear o modificar código en cualquier proyecto TypeScript / Node.js diseñado para ejecutarse en la plataforma **Serverless de Cloudflare** (Workers, Pages, D1, Queues, R2, KV, Durable Objects, Hyperdrive). Debe entregarse como contexto/system prompt a cualquier agente (Claude, Codex, Copilot, etc.) antes de generar código.
>
> Ninguna regla aquí es "sugerencia": son restricciones obligatorias. Si una petición del usuario contradice una regla, el agente debe señalarlo antes de generar código que la viole.
>
> Este documento es **agnóstico al dominio de negocio**. No asume CRM, e-commerce, trading, fintech, ERP, SaaS, logística, salud, educación ni ningún otro dominio concreto.
>
> En el proyecto real, los nombres de módulos, entidades, agregados, casos de uso, eventos y recursos deben corresponder al dominio real del negocio, pero la disciplina arquitectónica y los límites definidos aquí deben mantenerse.


---


# 0. Objetivo estratégico (léelo primero)


Este es un **monolito modular serverless nativo de Cloudflare preparado para fisión a microservicios/workers independientes**.


Eso significa:


- Cada módulo/bounded context se comporta como un servicio aislado con límites estrictos, ejecutándose sobre el runtime **`workerd` (V8 Isolates)** de Cloudflare.
- **Ningún módulo importa código interno de otro módulo directamente.** La única comunicación permitida entre módulos es a través de:
  - (a) el contrato público del módulo (`module.public-api.ts`, invocado de forma síncrona mediante **Service Bindings** de Cloudflare con latencia cero o mediante RPC tipado de Workers), o
  - (b) eventos de integración asíncronos publicados en **Cloudflare Queues**.
- Si en el futuro un módulo se extrae a un Worker independiente, el cambio se limita a:
  - configurar su propio `wrangler.toml` / `wrangler.jsonc`,
  - desplegar su Worker en Cloudflare,
  - ajustar los Service Bindings en el Worker llamador.
- **La lógica de dominio y aplicación NO debe tocarse**, porque el contrato de Service Bindings y los eventos de Cloudflare Queues ya están desacoplados desde el día uno.
- Por eso: trata cada carpeta bajo `src/modules/<nombre>` como un "servicio en potencia" con su propio dominio, aplicación, infraestructura y puertos de entrada/salida.


---


## REGLA FUNDAMENTAL: Módulos No-Serverless y Procesos Continuos (Python / VMs / Contenedores)


> [!IMPORTANT]
> **REGLA DE DETECCIÓN Y CONSULTA OBLIGATORIA PARA EL AGENTE:**
> 
> Los Workers de Cloudflare están basados en ejecución Serverless efímera por evento/petición. Si el proyecto requiere un módulo o componente que **NO puede ejecutarse dentro de los límites de Cloudflare Workers** (por ejemplo: procesos en segundo plano de ejecución continua 24/7, procesamiento intensivo en Python con librerías nativas como NumPy/PyTorch/Pandas, renderizado pesado de video/GPU, demonios TCP persistentes tradicionales o software de terceros no compatible con V8 isolates):
>
> 1. **El agente TIENE PROHIBIDO intentar forzar código incompatible dentro de un Cloudflare Worker o improvisar atajos.**
> 2. **El agente DEBE DETENERSE y PREGUNTAR explícitamente al usuario:**
>    - **Opción A:** Desplegar ese módulo específico en **Cloudflare Containers / Cloudflare Container Applications** (la solución de ejecución basada en contenedores de Cloudflare).
>    - **Opción B:** Desplegar ese módulo como **Servicio Externo en una Máquina Virtual / Contenedor dedicado (Docker, VPS, Kubernetes, AWS ECS, Fly.io, Railway)**, comunicándose de forma segura con los Workers de Cloudflare mediante HTTPS/REST con mTLS o tokens de autenticación internos.


---


## Capas de la arquitectura completa (de afuera hacia adentro)


1. **Frontend** (Cloudflare Pages):
   - sin lógica de negocio;
   - SPA (React, Vue, Svelte) o SSR alojado en **Cloudflare Pages**;
   - consume los endpoints **REST/HTTP** del BFF;
   - maneja presentación, estado de UI y validaciones superficiales de entrada.


2. **BFF (REST API Gateway en Cloudflare Worker)**:
   - sin lógica de negocio;
   - implementado con **Hono** (o la API nativa de Cloudflare Workers) con validación **OpenAPI / Zod**;
   - adapta y compone respuestas REST;
   - se comunica con los módulos exclusivamente mediante **Service Bindings** tipados;
   - puede existir uno o varios BFF según las necesidades del proyecto, pero cada uno debe respetar estas reglas.


3. **Módulos del monolito modular (Bounded Contexts Serverless)**:
   - únicos dueños de su lógica de negocio;
   - dueños de su dominio;
   - dueños de sus casos de uso;
   - dueños de su persistencia en **Cloudflare D1** (SQLite distribuido), **Hyperdrive** (PostgreSQL acelerado), **Durable Objects** (estado transaccional con SQLite integrado) o **Cloudflare R2** (object storage);
   - exponen su `module.public-api.ts` vía Service Bindings;
   - se comunican entre sí de forma asíncrona mediante **Cloudflare Queues**.


4. **Infraestructura transversal**:
   - bootstrap y exportador de Worker (`fetch`, `queue`, `scheduled`);
   - configuración centralizada mediante variables y secrets de Cloudflare (`env`);
   - logging estructurado en JSON (`console.log(JSON.stringify(log))`);
   - tracing y métricas distribuidas con **OpenTelemetry OTLP** / **Workers Analytics Engine**;
   - tareas programadas con **Cron Triggers**.


---


### Regla de nombres


**Los nombres de módulos siempre deben ser genéricos en este documento.**


Ejemplos:


```text
module-a
module-b
module-c
```


En el proyecto real:


```text
src/modules/<nombre-real-del-contexto>
```


El nombre real debe representar un **bounded context** del dominio, no una capa técnica.


---


## 0.1 Diagrama canónico de la arquitectura en Cloudflare


Este es el diagrama de referencia obligatorio:


```text
Frontend (Cloudflare Pages)
   │
   │ HTTP fetch / REST
   ▼
 BFF (Cloudflare Worker — Hono)
   │
   │ Service Bindings (latencia cero en red de Cloudflare)
   ▼
┌────────────────────────────────────────────────────────┐
│        Monolito Modular Serverless (Cloudflare)        │
│                                                        │
│   module-a             module-b             module-c   │
│      │                    │                    │       │
│  D1 Database          D1 Database          D1 Database │
│  (o Hyperdrive)       (o Hyperdrive)       (o Hyperdrive)
│      │                    │                    │       │
│  Durable Objects      R2 Bucket            Workers KV  │
│      │                    │                    │       │
│      └────────────────────┴────────────────────┘       │
│                           │                            │
│                   Cloudflare Queues                    │
└────────────────────────────────────────────────────────┘
                            │ (Si existe módulo continuo/Python)
                            ▼
           ┌──────────────────────────────────┐
           │ Preguntar al usuario:            │
           │ 1. Cloudflare Container          │
           │ 2. VM Externa / VPS / Docker     │
           └──────────────────────────────────┘
```


---


## 0.2 Responsabilidad de cada componente en Cloudflare


| Componente | Responsabilidad única | Tecnología Cloudflare estándar |
|---|---|---|
| **Frontend** | UI/presentación. Sin lógica de negocio. | **Cloudflare Pages** (SPA / SSR) |
| **BFF (REST Gateway)** | Adaptación y composición de respuestas REST. Sin lógica de negocio. | **Cloudflare Worker** (`Hono` + `@hono/zod-openapi`) |
| **Service Bindings** | Contrato síncrono entre BFF↔módulos y entre módulos entre sí. | Cloudflare Worker Service Bindings (`env.MODULE_A.fetch`) |
| **Módulo** | Dueño exclusivo de su lógica de negocio: dominio, casos de uso y persistencia. | Bounded Context aislado en `src/modules/<context>` |
| **DB Relacional** | Fuente de verdad de cada módulo — una DB/schema D1 por módulo, nunca compartida. | **Cloudflare D1** (SQLite serverless) o **Hyperdrive** (Postgres) |
| **Durable Objects** | Agregados con consistencia fuerte y coordinación atómica en el edge. | **Cloudflare Durable Objects** con SQLite Storage |
| **Cloudflare Queues** | Comunicación asíncrona entre módulos — eventos de dominio/integración. | **Cloudflare Queues** (con ack manual y DLQ) |
| **Cloudflare R2** | Almacenamiento de archivos, documentos y medios sin costos de egress. | **Cloudflare R2** (S3-compatible bucket) |
| **Workers KV** | Cache distribuida de lectura ultra-rápida y estado no crítico. | **Cloudflare Workers KV** (lecturas globales eventuales) |
| **Cron Triggers** | Tareas programadas periódicas y Outbox Relay. | **Cloudflare Scheduled Workers** (`scheduled`) |
| **OpenTelemetry / Analytics** | Tracing y métricas de extremo a extremo. | **Workers Analytics Engine** / OpenTelemetry OTLP |
| **k6** | Pruebas de rendimiento y carga sobre los endpoints del Worker. | `k6` contra endpoints públicos |
| **Chaos / Resiliencia** | Validación activa de fallos en D1, Queues y Bindings. | Fault injection / mocks en entorno Miniflare |

---


# 1. Principios SOLID — aplicación obligatoria


| Principio | Regla obligatoria en Cloudflare |
|---|---|
| **S**RP | Una clase/función = una razón para cambiar. Prohibido `utils.ts` o `helpers.ts` genéricos. Casos de uso (`UseCase`) hacen UNA sola acción de negocio. |
| **O**CP | Extender comportamiento mediante nuevas implementaciones de interfaces/puertos, nunca con `if/switch` de tipos. |
| **L**SP | Toda implementación de una interfaz de puerto debe ser sustituible sin romper el contrato. Prohibido lanzar excepciones no declaradas. |
| **I**SP | Interfaces pequeñas y específicas por caso de uso (`IResourceReader`, `IResourceWriter`) en vez de una interfaz gorda con 20 métodos. |
| **D**IP | Las capas de dominio y aplicación jamás dependen de APIs concretas de Cloudflare (`D1Database`, `KVNamespace`, `R2Bucket`, `Queue`). Dependen de interfaces (puertos) definidas en dominio/aplicación. La infraestructura implementa esas interfaces inyectando los bindings de `env`. |

---


# 1.bis Límite de tamaño de archivo y "una función/clase por archivo"


Esta regla es tan obligatoria como SOLID y se verifica en cada archivo generado:


- **Máximo 200 líneas de código por archivo** (sin contar imports, comentarios de licencia ni líneas en blanco).
- Si un archivo se acerca a ese límite, es señal de que está violando SRP y debe dividirse.
- No se "estira" la regla. Se refactoriza.


### Un archivo = una responsabilidad pública principal


Un archivo debe contener:


- una función pública;
- una clase;
- un caso de uso;
- un handler/controlador REST;


según corresponda.


No se permiten archivos "bolsa" con múltiples clases/funciones no relacionadas.


### Nombre de archivo


**Nombre de archivo = nombre de lo que exporta.**


Ejemplo:


```text
ExecuteActionUseCase.ts
```


exporta:


```typescript
export class ExecuteActionUseCase { ... }
```


Evitar `index.ts` como contenedor de lógica (solo re-exports limpios).


---


# 2. Regla de dependencias — Clean Architecture / Hexagonal


```text
        ┌─────────────────────────────────────────────────┐
        │          INFRASTRUCTURE (adapters)               │
        │   Cloudflare D1, Queues, KV, R2, ServiceBindings │
        │  ┌───────────────────────────────────────────┐  │
        │  │           APPLICATION (use cases)         │  │
        │  │           ports in/out, DTOs, mappers     │  │
        │  │  ┌─────────────────────────────────────┐  │  │
        │  │  │            DOMAIN (core)            │  │  │
        │  │  │   entities, VOs, aggregates, rules  │  │  │
        │  │  └─────────────────────────────────────┘  │  │
        │  └───────────────────────────────────────────┘  │
        └─────────────────────────────────────────────────┘
```


### Regla de oro


Las flechas de dependencia (`import`) **SIEMPRE apuntan hacia adentro**.


El dominio:


- no importa aplicación;
- no importa infraestructura;
- no importa tipos de Cloudflare (`@cloudflare/workers-types`, `D1Database`, `R2Bucket`, `KVNamespace`, `Queue`);
- no importa librerías HTTP (`hono`, `itty-router`).


La aplicación:


- no importa infraestructura concreta de Cloudflare;
- depende únicamente del dominio y de los puertos (interfaces) de entrada y salida.


La infraestructura:


- importa los bindings de Cloudflare (`env.DB`, `env.QUEUE`, `env.BUCKET`);
- implementa los puertos definidos por dominio/aplicación.


---


# 3. Estructura de carpetas obligatoria


```text
wrangler.jsonc / wrangler.toml          # Configuración del Worker, D1, Queues, KV, R2, Bindings


apps/
  bff/                                  # API Gateway REST — Hono en Cloudflare Worker
    src/
      modules/
        <domain>/
          controllers/                  # controladores REST (Hono routers)
          dto/                          # schemas Zod / OpenAPI
      common/
        bindings/                       # clientes tipados de Service Bindings
      server.ts                         # export default { fetch } del Worker BFF


src/
  modules/
    <bounded-context>/                  # ej: module-a, module-b, etc.
      domain/
        entities/                       # entidades con identidad
        value-objects/                  # objetos de valor inmutables
        aggregates/                     # raíces de agregado + invariantes
        events/                         # domain events internos
        repositories/                   # INTERFACES / puertos de salida
        services/                       # domain services
        errors/                         # errores de dominio tipados


      application/
        use-cases/                      # 1 archivo = 1 caso de uso
        ports/
          in/                           # puertos de entrada
          out/                          # puertos de salida (ICachePort, IEventPublisher, IRepository)
        dto/                            # DTOs application
        mappers/                        # domain <-> DTO


      infrastructure/
        persistence/
          d1/                           # implementación concreta Cloudflare D1
            repositories/               # implementan domain/repositories
            mappers/                    # persistence <-> domain
            migrations/                 # migraciones SQL de D1 (0001_init.sql)
          durable-objects/              # implementación de Agregados en Durable Objects (si aplica)


        storage/
          r2/                           # implementación de storage de archivos con Cloudflare R2


        cache/
          kv/                           # implementación de ICachePort con Workers KV / Cache API


        messaging/
          queues/
            publishers/                 # implementación IEventPublisher con Cloudflare Queues
            consumers/                  # handlers de mensajes entrantes (queue handler)
            schemas/                    # contratos versionados (Zod / JSON Schema)


        bindings/
          service/                      # implementación de comunicación síncrona vía Service Bindings
          dto/                          # mapeo DTO binding <-> application DTO


      module.config.ts                  # composition root / wiring DI con inyección de env
      module.public-api.ts              # contrato público lógico expuesto vía Service Binding


  shared-kernel/                        # SOLO elementos verdaderamente universales
  platform/                             # telemetry, logger JSON, error handling
  index.ts                              # Worker Entrypoint: fetch, queue, scheduled
```


---


# 4. Reglas de DDD


## 4.1 Bounded Context primero


Antes de escribir código:


1. define el lenguaje ubicuo;
2. define los límites del contexto;
3. define qué conceptos pertenecen al contexto.


---


## 4.2 Entidades


Las entidades tienen identidad estable (`id`), mutables mediante métodos de negocio explícitos (`recurso.desactivar()`). Prohibidos los setters genéricos (`recurso.setIsActive(false)`).


---


## 4.3 Value Objects


Inmutables, comparables por valor, auto-validados en el constructor (`Email`, `Money`, `DocumentId`). Prohibido representar VOs como `string`/`number` sueltos en firmas de dominio.


---


## 4.4 Agregados


- Una raíz de agregado (`AggregateRoot`) protege sus invariantes.
- En Cloudflare D1 / SQL: un caso de uso modifica **un solo agregado por transacción `db.batch()`**.
- Para escenarios de concurrencia extrema o consistencia fuerte en memoria: utilizar **Cloudflare Durable Objects** con almacenamiento SQLite transaccional.


---


## 4.5 Domain Events


Toda mutación de negocio emite un Domain Event interno, mapeado a un **Integration Event** versionado con Zod antes de publicarse a **Cloudflare Queues**.


---


## 4.6 Repositorios


La interfaz vive en `domain/repositories/` orientada a agregados completos (`save`, `findById`, `nextIdentity`). Prohibido exponer queries SQL crudas o D1 prepared statements fuera de `infrastructure/persistence/d1/`.


---


## 4.7 Anti-Corruption Layer (ACL)


Al consumir datos de otro módulo vía Service Binding o Cloudflare Queue, traduce SIEMPRE el payload externo al lenguaje ubicuo propio mediante un mapper dedicado.


---


# 5. Reglas de Casos de Uso — Application Layer


- 1 clase/función = 1 caso de uso = 1 archivo (`ExecuteActionUseCase.ts`).
- Recibe un `InputDTO`, devuelve un `OutputDTO` o `Result<T, DomainError>`.
- Orquesta: valida input → recupera agregado vía puerto → ejecuta método de dominio → persiste vía puerto → publica eventos en Cloudflare Queues.
- No contiene reglas de negocio propias.
- Idempotencia garantizada mediante `eventId` / `idempotencyKey`.


---


# 6. Base de datos y Almacenamiento (D1, Hyperdrive, R2)


## 6.1 Propiedad de los datos


- **Un módulo = su propia base de datos o namespace en Cloudflare D1** (`env.MODULE_A_DB`, `env.MODULE_B_DB`).
- Prohibido hacer JOINs SQL entre bases de datos de módulos distintos. Si necesitas datos de otro módulo, solicítalos vía Service Binding o mantenlos desnormalizados vía Queue.


## 6.2 Migraciones en Cloudflare D1


- Migraciones versionadas en archivos SQL independientes por módulo (`infrastructure/persistence/d1/migrations/0001_init.sql`).
- Ejecutadas mediante `wrangler d1 migrations apply <DB_NAME>`.


## 6.3 Hyperdrive para bases de datos externas


- Si el proyecto utiliza PostgreSQL/MySQL externo, debe conectarse SIEMPRE a través de **Cloudflare Hyperdrive** (`env.HYPERDRIVE`) para mantener pooling acelerado y latencia de conexión cero desde el edge.


## 6.4 Cloudflare R2 para almacenamiento de objetos


- El almacenamiento de archivos/documentos se realiza exclusivamente mediante **Cloudflare R2** detrás de un puerto `IFileStoragePort` en aplicación.


## 6.5 Outbox Pattern en Cloudflare


Para garantizar consistencia entre la escritura en D1 y la publicación del evento:


1. Insertar el cambio de estado y el evento en la tabla `outbox_events` dentro de un `db.batch([...])` atómico.
2. Un handler **Cron Trigger** (`scheduled`) o consumer de Cloudflare Queue lee los eventos pendientes, los publica a la Queue de destino y los marca como procesados.


---


# 7. Cache y KV (Workers KV & Cache API)


- Acceso a KV siempre detrás de un puerto `ICachePort` en `application/ports/out/`.
- Usos permitidos de **Workers KV**:
  - Lecturas de configuración global y cache con tolerancia a consistencia eventual.
  - TTL explícito (`expirationTtl`).
  - Keys namespaced: `<module>:<entity>:<id>:<subresource>`.
- Para cache de respuestas HTTP completas: usar la **Cloudflare Cache API** (`caches.default`).
- Prohibido usar Workers KV como fuente única de verdad para datos críticos de negocio.


---


# 8. Eventos con Cloudflare Queues


## 8.1 Contrato versionado


Cada evento en Cloudflare Queues tiene un schema Zod explícito (`resource-updated.v1.ts`) con:


```typescript
{
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  producerModule: string;
  payload: Record<string, unknown>;
  traceId: string;
}
```


## 8.2 Publisher


Implementado en `infrastructure/messaging/queues/publishers/` usando `env.QUEUE.send(event)`.


## 8.3 Consumer y Ack Manual


En el handler `queue(batch, env, ctx)`:


- Procesar cada mensaje de forma individual dentro de un bloque seguro.
- Hacer `message.ack()` únicamente tras confirmar la persistencia exitosa.
- Ante fallos recuperables: hacer `message.retry({ delaySeconds })`.
- Configurar Dead-Letter Queue (DLQ) en `wrangler.jsonc` para mensajes que superen el límite de reintentos.
- At-least-once: los consumidores deben ser **idempotentes**.


---


# 9. BFF, REST y Frontend


## Frontend


- Aloja la UI en **Cloudflare Pages**.
- Sin lógica de negocio. Consume endpoints REST del Worker BFF.


## BFF (Hono en Cloudflare Worker)


- Enrutador HTTP ultra-rápido basado en **Hono** con validación Zod y documentación OpenAPI.
- Controladores adaptadores puros: reciben petición HTTP → validan schema Zod → invocan el Service Binding del módulo correspondiente (`env.MODULE_A.fetch(request)`).
- Sin lógica de negocio ni acceso directo a bases de datos D1 de los módulos.


---


# 10. Comunicación Síncrona: Service Bindings


- La comunicación síncrona entre el BFF y los módulos (o entre módulos) se realiza mediante **Service Bindings** de Cloudflare.
- Los Service Bindings se ejecutan directamente en la red interna de Cloudflare con **latencia cero** y sin costo de egress.
- Cada módulo expone su `module.public-api.ts` manejando peticiones internas de Service Binding.


---


# 11. Shared Kernel — uso muy restringido


- `shared-kernel/` SOLO contiene: tipos de utilidad universales (`Result<T,E>`, `UUID`), interfaces base de logging/reloj (`IClock`), y errores base.
- Prohibido compartir entidades o modelos de persistencia entre módulos.


---


# 12. Observabilidad en Cloudflare


- **Logs estructurados:** emitidos en formato JSON mediante `console.log(JSON.stringify(log))` incluyendo: `timestamp`, `service`, `module`, `level`, `trace_id`, `request_id`, `duration`.
- **OpenTelemetry / Analytics:** Exportación OTLP HTTP de trazas y métricas o uso de **Workers Analytics Engine** para métricas en tiempo real.
- Propagación de `traceparent` a través de cabeceras HTTP entre Pages → Worker BFF → Service Bindings → Queues.
- Prohibido registrar credenciales, secretos o PII en logs.


---


# 13. SLO / SLA / SLI y Health Checks


- Definir métricas clave: latencia en edge (p50, p90, p95, p99), error rate (< 0.1%), queue processing lag.
- Endpoint de health check `/health` en el Worker BFF verificando disponibilidad de bindings críticos.


---


# 14. Testing — obligatorio, no opcional


- **Unit Testing:** Lógica pura de dominio y use cases sin dependencias de Cloudflare (`vitest`).
- **Integration Testing con Miniflare / Vitest Pool Workers:** Probar D1, KV, Queues y Service Bindings usando `@cloudflare/vitest-pool-workers` en entorno `workerd` local simulado.
- **Contract Testing:** Validación de schemas Zod / OpenAPI y contratos de Queues.
- **End-to-End Testing:** Flujos críticos probados con peticiones HTTP reales contra el entorno Miniflare local o preview de Cloudflare.


---


# 15. Rendimiento y Pruebas de Carga


- Herramienta: **k6** ejecutando pruebas de carga contra los endpoints del Worker.
- Medir `requests/sec`, latencia p95/p99, y validar que no se alcancen límites de CPU time de Cloudflare Workers (50ms en plan gratuito, 30s en plan Workers Paid / Unbound).


---


# 16. Resiliencia en Serverless


- Timeouts explícitos en llamadas `fetch` externas usando `AbortController`.
- Retries con backoff exponencial configurados en Cloudflare Queues.
- Graceful degradation: si un servicio secundario falla, responder con datos en cache de KV si está disponible.


---


# 17. Chaos Engineering


- Pruebas simulando fallos en D1, saturación de Queues o desconexión de Service Bindings en tests de integración con Miniflare.


---


# 18. Alerting


- Alertas configuradas en Cloudflare Dashboard / Notifications sobre: excepciones no capturadas de Workers, saturación de DLQs, tiempo de CPU excedido y códigos 5xx.


---


# 19. Definition of Done


Antes de dar por terminada una funcionalidad en Cloudflare Serverless, verificar:


- [ ] Bounded Context delimitado en `src/modules/<context>`.
- [ ] Sin imports directos entre módulos (comunicación solo vía Service Bindings o Queues).
- [ ] Dominio POJO/POTS puro, sin acoplamiento a tipos de Cloudflare (`D1Database`, `KVNamespace`).
- [ ] Casos de uso respetan límite de 200 líneas.
- [ ] D1 con migraciones SQL versionadas.
- [ ] Queues con ack manual y DLQ configurada.
- [ ] Endpoints Hono documentados con Zod / OpenAPI.
- [ ] Tests pasando con `vitest` y `@cloudflare/vitest-pool-workers`.
- [ ] Logs estructurados en JSON con `trace_id`.
- [ ] Si existe algún proceso no-serverless (Python, demonios continuos), se consultó al usuario (Cloudflare Container vs VM externa).


---


# 19.1 Matriz de Verificación de Cobertura por Bounded Context


| Bounded Context | Entidades de Dominio | Command Handlers | Query Handlers | Suites de Prueba (Vitest) |
|---|---|---|---|:---:|
| `module-a` | `<EntityA>, <EntityB>` | `<CommandA>, <CommandB>` | `<QueryA>, <QueryB>` | 🟢 / 🟡 / 🔴 |
| `module-b` | `<EntityA>, <EntityB>` | `<CommandA>, <CommandB>` | `<QueryA>, <QueryB>` | 🟢 / 🟡 / 🔴 |
| `module-c` | `<EntityA>, <EntityB>` | `<CommandA>, <CommandB>` | `<QueryA>, <QueryB>` | 🟢 / 🟡 / 🔴 |

---


# 20. Prohibiciones explícitas en Cloudflare Serverless


Antes de entregar código, verifica que NO hiciste ninguna de estas cosas:


- [ ] Importar tipos de infraestructura de Cloudflare (`D1Database`, `KVNamespace`, `Queue`, `R2Bucket`) dentro de `domain/` o `application/`.
- [ ] Hacer `import` directo del código interno de otro módulo (`../otro-modulo/domain/...`).
- [ ] Hacer JOINs SQL entre bases de datos D1 de diferentes módulos.
- [ ] Escribir lógica de negocio en handlers de Hono o controladores del BFF.
- [ ] Hacer que el BFF acceda directamente a bases de datos D1 o R2 de un módulo.
- [ ] Usar auto-ack en Cloudflare Queues antes de persistir con éxito.
- [ ] Usar Workers KV como fuente única de verdad para datos críticos de negocio.
- [ ] Intentar correr un proceso continuo 24/7 o script incompatible de Python dentro de un Cloudflare Worker sin consultar al usuario.
- [ ] Usar `console.log` sin formato JSON estructurado en producción.
- [ ] Registrar contraseñas, secretos o PII en logs.
- [ ] Generar un archivo de más de 200 líneas de código.


---


# 21. Instrucción final para el agente (Claude/Codex/Copilot)


> Cuando generes código para este proyecto en Cloudflare:
>
> 1. Aplica TODAS las reglas de arquitectura monolito modular serverless.
> 2. Mantén la separación estricta de capas (DDD, Clean Architecture, SOLID).
> 3. Utiliza los primitives nativos de Cloudflare (Hono, D1, Queues, R2, KV, Service Bindings).
> 4. **SI UN REQUERIMIENTO NO PUEDE SER SERVERLESS (ej. ejecución continua, Python nativo, GPUs, demonios TCP): DETENTE Y PREGUNTA AL USUARIO si prefiere desplegarlo en Cloudflare Containers o en una VM/Contenedor externo.**


---


# 22. Regla de adaptación al proyecto real


- `ARCHITECTURE_RULES.md`: Contiene las reglas universales de este documento.
- `PROJECT_RULES.md`: Contiene las decisiones concretas del proyecto (nombres de Workers, bases de datos D1, Queues, Buckets R2 y bounded contexts reales).


---


# 23. Regla de prioridad arquitectónica


La integridad arquitectónica tiene prioridad sobre atajos rápidos. Cualquier excepción debe documentarse mediante un ADR.


---


# 24. Principio final


La arquitectura permite que el monolito modular serverless en Cloudflare evolucione:


```text
                 ┌─────────────────────────┐
                 │ Frontend (Pages)        │
                 └───────────┬─────────────┘
                             │
                        HTTP / REST
                             │
                             ▼
                 ┌─────────────────────────┐
                 │ BFF Worker (Hono)       │
                 └───────────┬─────────────┘
                             │
                      Service Bindings
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
      module-a           module-b           module-c
          │                  │                  │
      D1 Database        D1 Database        D1 Database
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                     Cloudflare Queues
                             │
                             ▼
                     Eventos asíncronos
```


Todo módulo puede desplegarse como Worker independiente sin reescribir dominio ni aplicación.


---


# FIN DEL CONTRATO DE ARQUITECTURA
