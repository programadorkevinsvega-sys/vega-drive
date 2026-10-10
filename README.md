# Vega Drive

Sistema privado de almacenamiento de archivos en la nube, construido sobre Cloudflare para un máximo de 10 clientes. El aislamiento entre cuentas es obligatorio: un cliente no puede leer, editar ni eliminar archivos de otro.

> Estado: planificación. El contrato de arquitectura está en [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md), la seguridad en [Security.md](./Security.md) y las fases en [roadmap.md](./roadmap.md).

## Arquitectura

Vega Drive es un monolito modular serverless:

- Un solo repositorio, código desplegable y Cloudflare Worker.
- Frontend y backend separados por capas, pero servidos desde el mismo Worker y origen.
- Una sola D1: VEGA_DRIVE_DB.
- Módulos internos con API pública y gateways en proceso; no son microservicios hoy.
- R2 es privado y solo el módulo files accede a él por IFileStoragePort.
- El frontend llama únicamente a /api y nunca conoce ni contacta R2.

```text
Navegador
   │ HTML, JS, CSS y /api desde el mismo origen
   ▼
Worker único de Vega Drive
├── frontend / assets
├── BFF: Hono, controllers y gateways
└── módulos: identity · files · quota · sharing
       ├── D1 única: VEGA_DRIVE_DB
       └── R2 privado: solo files
```

Cada módulo es dueño de sus tablas con prefijo, migraciones, repositorios, dominio y API pública. Aunque existe una sola D1, están prohibidos JOIN, FK, SQL, imports internos o transacciones entre módulos. CI verifica estas fronteras.

## Flujo de archivos

1. El frontend envía el archivo a POST /api/files.
2. El BFF valida transporte y sesión; crea AuthenticatedActor y llama FilesGateway.
3. El módulo files valida autorización, cuota, nombre y tamaño.
4. Su adaptador privado transmite a R2; el navegador nunca recibe una URL, token, SDK o clave de R2.
5. El módulo registra los metadatos y devuelve un resultado seguro.

Las descargas atraviesan GET /api/files/:id/download y el Worker transmite el contenido autorizado desde R2.

## Estructura propuesta

```text
src/
  worker/                 fetch, queue, scheduled y composition root
  bff/                    Hono, controllers, gateways y middleware
  modules/
    identity/             dominio, aplicación, infraestructura y migraciones
    files/                catálogo y R2 privado
    quota/                límites de almacenamiento
    sharing/              enlaces compartidos
  platform/               logging, eventos y observabilidad
  shared-kernel/          abstracciones universales mínimas
frontend/
  src/                    presentación y estado visual
public/
migrations/
  manifest.md             orden de migraciones sobre VEGA_DRIVE_DB
wrangler.toml
tests/
```

## Servicios Cloudflare

| Necesidad | Servicio |
|---|---|
| Backend, BFF y assets | Cloudflare Workers |
| Metadatos, usuarios y sesiones | D1: VEGA_DRIVE_DB |
| Archivos | R2 privado, solo módulo files |
| Coordinación de cuota si hace falta | Durable Objects |
| Eventos y tareas futuras | Queues y Cron Triggers |
| Anti-bots | Turnstile |
| Rate limiting | Workers Rate Limiting |

## Seguridad esencial

- El userId se deriva solo de la sesión validada; nunca del cliente.
- Los assets no incluyen secretos, configuración de R2 ni lógica de negocio.
- R2 no tiene acceso público, r2.dev, CORS de navegador ni URLs prefirmadas.
- Las claves de objeto las crea files en el backend como u/{userId}/{uuid}.
- D1 se mantiene como una base única, pero cada módulo solo consulta sus propios prefijos.
- Todo PR debe pasar el checklist de [Security.md](./Security.md#checklist-de-pull-request) y las pruebas de frontera modular.

## Preparación inicial

1. Instalar Node.js LTS y dependencias del proyecto.
2. Autenticarse en Cloudflare con Wrangler.
3. Crear la D1 VEGA_DRIVE_DB y el bucket R2 vega-drive-files.
4. Configurar los bindings en wrangler.toml.
5. Guardar secretos mediante wrangler secret; nunca en el repositorio.
6. Aplicar las migraciones según migrations/manifest.md.
7. Ejecutar pruebas, typecheck y lint antes de desplegar.

El binding de R2 es preferible. Si se requiere un adaptador S3 compatible, sus credenciales viven solo en el Worker y únicamente en infraestructura de files.

## Contribución

- Una subfase por rama feature/<fase>-<descripción>.
- Commits convencionales: feat:, fix:, docs:, security: o chore:.
- No se fusiona código que rompa los límites de módulos, la seguridad o el checklist de PR.
