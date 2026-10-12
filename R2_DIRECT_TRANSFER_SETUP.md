# Configuración operativa de transferencias directas a R2

Este runbook prepara la cuenta para el flujo aprobado en [ADR-001](./ADR-001-direct-r2-transfers.md). **No habilita el flujo ni autoriza un despliegue por sí mismo.** Mientras falten credenciales, CORS y pruebas E2E, se conserva la transferencia por el Worker como ruta de respaldo.

## Estado conocido del bucket

Bucket: `vega-drive-files`  
Endpoint S3 mostrado por Cloudflare: `https://03f46bf3839f506fe22124be5f1cda25.r2.cloudflarestorage.com/vega-drive-files`

Estado actualizado informado por el propietario el 2026-10-12: `r2.dev` está desactivado, el bucket está privado y el dominio personalizado `s3-vegadirve.jnmtortas.com` está desactivado. Mantener esos tres controles así. Antes de la prueba E2E, comprobar desde una sesión no autenticada que un objeto de prueba no pueda leerse por una URL pública. No basta con CORS para proteger el bucket. El firmador usa el endpoint S3 estándar basado en el Account ID; Vega Drive no necesita un dominio público de R2 para usar URLs S3 prefirmadas.

## 1. Corregir CORS del bucket

La política CORS configurada e informada el 2026-10-12 permite `https://vega-drive.programadorkevinsvega.workers.dev`, métodos `GET`/`PUT`, encabezados `Content-Type`/`If-None-Match`, expone `ETag` y usa `MaxAgeSeconds: 3600`. Esa configuración es correcta para solicitudes iniciadas desde el origen `workers.dev`.

La aplicación también contempla el origen de producción `https://drive.jnmtortas.com`. Si ese dominio es el que los usuarios usan para abrir Vega Drive, añadirlo a `AllowedOrigins` y guardar la política. Si no se usa, no hace falta añadirlo. No incluir el dominio de R2 como origen del navegador ni usar `*`. `http://localhost:3000` solo debe permitirse temporalmente para desarrollo local controlado y retirarse de CORS de producción.

- **Allowed methods:** `GET`, `PUT`
- **Allowed headers:** `Content-Type`, `If-None-Match`
- **Expose headers:** `ETag`
- **Max age:** `3600` segundos.

CORS no autoriza usuarios ni objetos: las URLs firmadas y las comprobaciones del Worker siguen siendo obligatorias.

CORS no autoriza usuarios ni objetos: las URLs firmadas y las comprobaciones del Worker siguen siendo obligatorias.

## 2. Credenciales S3 de alcance mínimo

**Regla de respuesta ante exposición:** si un token de Cloudflare, un Access Key ID o una Secret Access Key se pega en un chat, issue, log, captura o commit, tratarlo como expuesto aunque el texto parezca truncado. Revocar la credencial afectada y generar una nueva antes de usarla. Si se compartieron un token de API de Cloudflare y credenciales S3, rotarlos por separado: son credenciales distintas. No copiar valores de secretos al repositorio ni a este runbook.

La política que se ha compartido incluye los grupos **Workers R2 Storage Bucket Item Read** y **Workers R2 Storage Bucket Item Write** sobre el recurso específico `vega-drive-files`. Es el alcance de permisos adecuado para leer/escribir objetos sin conceder administración de la cuenta ni acceso a otros buckets.

Importante: el JSON de la política muestra permisos y alcance; **no contiene por sí solo las credenciales S3**. Confirma que el token se creó desde **R2 → Overview → Manage API Tokens**, no desde el creador genérico de tokens de Cloudflare. En el resultado de creación de un token R2 deben aparecer **Access Key ID** y **Secret Access Key**. Si ya cerraste esa pantalla y no guardaste la clave secreta, crea otro token R2 equivalente y revoca el anterior cuando hayas confirmado que no se utiliza.

El endpoint S3 que usa el firmador es `https://03f46bf3839f506fe22124be5f1cda25.r2.cloudflarestorage.com`; el firmador añade el bucket y la clave de objeto. No uses el dominio personalizado público como endpoint de firma.

No publiques el Access Key ID ni, especialmente, el Secret Access Key en issues, commits, logs, capturas ni conversaciones. El Account ID no es una clave secreta, pero también debe configurarse en el entorno correcto.

Configurar los valores como secretos del Worker desde una terminal autenticada con Wrangler:

```sh
pnpm exec wrangler secret put R2_ACCOUNT_ID
pnpm exec wrangler secret put R2_ACCESS_KEY_ID
pnpm exec wrangler secret put R2_SECRET_ACCESS_KEY
```

Introducir cada valor cuando Wrangler lo solicite. No escribir secretos en `wrangler.toml`, archivos `.env` versionados ni en el frontend. Si no se han creado las credenciales, detenerse aquí; no inventar valores.

## Estado de credenciales tras una posible exposición

El propietario confirmó que los secretos `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID` y `R2_SECRET_ACCESS_KEY` aparecen configurados en el panel del Worker. Sin embargo, los valores de credenciales se compartieron parcialmente en una conversación. Por precaución, **no considerar seguras las credenciales actuales aunque el texto parezca truncado**: crear un nuevo token S3 de R2 con el mismo alcance mínimo, actualizar los tres secretos correspondientes si cambian sus valores, probarlo y revocar las credenciales anteriores. Si también se compartió un token de API de Cloudflare, revocarlo/rotarlo por separado; no es lo mismo que la clave S3.

No se han verificado las credenciales mediante una operación real contra R2. Nunca pedir ni copiar sus valores en este documento, el repositorio, logs o chats.

## 3. Mantener la transferencia directa deshabilitada hasta validar

La aplicación solo usa las rutas directas cuando `DIRECT_R2_TRANSFERS_ENABLED` vale `true`. No habilitar esa variable todavía. Primero rotar las credenciales compartidas, comprobar que los tres secretos están configurados en el entorno correcto y que el bucket continúa privado.

La activación futura debe hacerse explícitamente mediante la configuración de entorno del Worker, después de completar las pruebas descritas abajo y con autorización de despliegue. No añadir la variable a `wrangler.toml` ni desplegar como parte de este runbook.

## 4. Validaciones obligatorias antes de activar

- [ ] CORS de producción coincide exactamente con los dos orígenes de producción de arriba.
- [ ] La URL pública `r2.dev` sigue desactivada y no existe lectura anónima.
- [ ] Las credenciales están limitadas al bucket y guardadas como secretos del Worker.
- [ ] Una URL firmada expira; método, clave, encabezados o parte alterados son rechazados.
- [ ] Un usuario no puede iniciar, completar, cancelar ni descargar recursos de otro usuario.
- [ ] Subida directa pequeña: verificar que tamaño real y Content-Type de HEAD coincidan con la sesión antes de publicar metadatos; comprobar cuota y limpieza ante discrepancias.
- [ ] Subida multipart grande: verificar todas las partes, reintentos, reanudación, pausa, cancelación, Content-Type de HEAD y limpieza/reintento de sesiones incompletas.
- [ ] Cancelación de PUT directo: como la URL previamente emitida no puede revocarse al instante, confirmar que `complete` se rechaza, que una escritura tardía no queda huérfana después de la limpieza diferida y que la sesión fallida se conserva para reintento.
- [ ] Descarga directa: permisos, papelera, nombre seguro, URL temporal y ausencia de secretos en logs.
- [ ] CORS rechaza un origen no permitido y expone `ETag` a la aplicación autorizada.
- [ ] Prueba E2E real y concurrencia controlada; documentar resultados y ruta de rollback al flujo por Worker.

Las pruebas unitarias y CI no sustituyen estas comprobaciones reales en Cloudflare. No declarar la migración completa ni desplegar por el hecho de haber configurado CORS o creado credenciales.
