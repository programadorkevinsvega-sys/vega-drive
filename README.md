# vega-drive

# Vega Drive

Sistema de almacenamiento de archivos en la nube (tipo Drive / Mega) construido **100 % sobre Cloudflare**, sin Cloudflare Containers. Producto propio para un máximo de **10 clientes**, con aislamiento total entre cuentas: ningún cliente puede ver, editar ni eliminar los archivos de otro.

> Estado del proyecto: en planificación. Consulta el [ROADMAP](./ROADMAP.md) para las fases y el [SECURITY](./SECURITY.md) para las reglas de seguridad obligatorias.

---

## Características previstas

- Registro, login, página de inicio y dashboard.
- Carpetas y archivos por usuario (crear, renombrar, mover, eliminar, papelera).
- Subida de archivos grandes (más de 300 MB) mediante **multipart upload con la API compatible con S3 de R2** y URLs prefirmadas.
- Descargas con soporte de `Range` (reanudación y streaming).
- Cuotas de almacenamiento por usuario.
- Enlaces compartidos con expiración (opcional, fase posterior).
- Sin cifrado de extremo a extremo (decisión de producto): los archivos se guardan cifrados en reposo por R2.

## Stack

| Necesidad | Servicio |
|---|---|
| Archivos | Cloudflare **R2** (acceso por API S3) |
| Metadatos, usuarios, sesiones | Cloudflare **D1** |
| Backend / API | Cloudflare **Workers** |
| Frontend | Workers con assets estáticos |
| Estado concurrente (cuotas, subidas) | **Durable Objects** (si hace falta) |
| Tareas programadas | **Cron Triggers** / **Queues** |
| Anti-bots | **Turnstile** |
| Límite de peticiones | **Workers Rate Limiting** |

Lenguaje: TypeScript. Librería de firma S3: [`aws4fetch`](https://github.com/mhart/aws4fetch).

## Arquitectura

```mermaid
flowchart LR
    B[Navegador] -- HTML/JS --> W[Worker: API + assets]
    W -- consultas --> D[(D1: usuarios, nodos, sesiones)]
    W -- firma URLs / orquesta multipart --> R[(R2 vía API S3)]
    B -- PUT de partes / GET con URL prefirmada --> R
```

Idea clave: **los archivos nunca pasan por el Worker**. El Worker autentica, valida propiedad y cuota, y entrega URLs prefirmadas de corta duración. El navegador sube y descarga directo contra R2.

### Flujo de subida grande

1. `POST /api/uploads/init` → valida sesión y cuota, crea la clave `u/{userId}/{uuid}` y el `uploadId` (CreateMultipartUpload).
2. `POST /api/uploads/part-url` → verifica que el `uploadId` es del usuario y devuelve una URL prefirmada para esa parte.
3. El navegador hace `PUT` de cada parte (en paralelo) y guarda el `ETag`.
4. `POST /api/uploads/complete` → verifica tamaño real, completa el multipart y registra el archivo en D1.
5. `POST /api/uploads/abort` → cancela y limpia.

## Estructura del repositorio (propuesta)

```
vega-drive/
├─ README.md
├─ ROADMAP.md
├─ SECURITY.md
├─ wrangler.toml
├─ package.json
├─ tsconfig.json
├─ migrations/            # migraciones SQL de D1
├─ src/
│  ├─ index.ts            # entrada del Worker y router
│  ├─ routes/             # auth, folders, files, uploads, shares, admin
│  ├─ middleware/         # sesión, CSRF/Origin, rate limit, headers
│  └─ lib/                # crypto, sesiones, cliente S3, validación
├─ public/                # inicio, registro, login, dashboard
├─ tests/
└─ .github/workflows/     # CI
```

## Requisitos

- Cuenta de Cloudflare con R2 y D1 habilitados.
- Node.js LTS y `npm`.
- `wrangler` (`npm i -D wrangler`).
- Un dominio gestionado en Cloudflare (recomendado).

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Autenticarse en Cloudflare
npx wrangler login

# 3. Crear recursos
npx wrangler r2 bucket create vega-drive-files
npx wrangler d1 create vega-drive-db

# 4. Copiar el database_id resultante a wrangler.toml

# 5. Aplicar migraciones
npx wrangler d1 migrations apply vega-drive-db --local   # desarrollo
npx wrangler d1 migrations apply vega-drive-db --remote  # producción

# 6. Secretos (nunca en el repositorio)
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put INVITE_SECRET

# 7. Desarrollo y despliegue
npx wrangler dev
npx wrangler deploy
```

### Configuración de CORS del bucket R2

Necesaria para subir desde el navegador. Sustituye el origen por tu dominio real:

```json
[{
  "AllowedOrigins": ["https://app.tudominio.com"],
  "AllowedMethods": ["GET", "PUT", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

`ExposeHeaders: ETag` es obligatorio: sin él el navegador no puede leer el ETag de cada parte y no se puede completar la subida.

## Variables y secretos

| Nombre | Tipo | Descripción |
|---|---|---|
| `R2_ACCESS_KEY_ID` | secreto | Credencial S3 de R2 (solo permisos sobre este bucket) |
| `R2_SECRET_ACCESS_KEY` | secreto | Clave secreta S3 de R2 |
| `CF_ACCOUNT_ID` | secreto | ID de la cuenta de Cloudflare |
| `BUCKET_NAME` | variable | Nombre del bucket |
| `TURNSTILE_SECRET` | secreto | Verificación de Turnstile |
| `INVITE_SECRET` | secreto | Firma de códigos de invitación |
| `MAX_USERS` | variable | Tope de cuentas (10) |

## Seguridad

Resumen de los principios (detalle completo en [SECURITY.md](./SECURITY.md)):

1. **Aislamiento por usuario en cada consulta y cada clave de R2.** El `userId` sale siempre de la sesión, nunca del cliente.
2. **Bucket privado.** Todo acceso a objetos es mediante URLs prefirmadas de corta duración.
3. **Registro cerrado** (invitación o tope de 10 usuarios).
4. **Secretos solo en `wrangler secret`**, jamás en el código ni en el repositorio.
5. **Cada implementación del roadmap debe cumplir el checklist de seguridad** antes de fusionarse.

## Contribución

- Trabaja en ramas `feature/<fase>-<descripcion>` y abre PR hacia `main`.
- Cada PR debe incluir el checklist de seguridad de [SECURITY.md](./SECURITY.md#checklist-de-pull-request) completado.
- Commits en formato convencional (`feat:`, `fix:`, `chore:`, `docs:`, `security:`).

## Licencia

Por definir (producto propietario).
