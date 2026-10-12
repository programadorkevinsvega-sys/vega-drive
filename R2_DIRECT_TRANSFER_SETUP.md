# Configuración operativa de transferencias directas a R2

Este runbook prepara la cuenta para el flujo aprobado en [ADR-001](./ADR-001-direct-r2-transfers.md). **No habilita el flujo ni autoriza un despliegue por sí mismo.** Mientras falten credenciales, CORS y pruebas E2E, se conserva la transferencia por el Worker como ruta de respaldo.

## Estado conocido del bucket

Bucket: `vega-drive-files`  
Endpoint S3 mostrado por Cloudflare: `https://03f46bf3839f506fe22124be5f1cda25.r2.cloudflarestorage.com/vega-drive-files`

La URL pública `r2.dev` está desactivada, pero el dominio personalizado `s3-vegadirve.jnmtortas.com` aparece **Activo**, con **Access habilitado**. Esto significa que el contenido del bucket puede servirse públicamente por ese dominio aunque `r2.dev` esté desactivado; contradice el requisito de privacidad y debe tratarse como un bloqueo de seguridad. **Antes de continuar con pruebas de datos privados, deshabilita el dominio personalizado** en R2 → bucket → Settings → Custom Domains → `...` → **Disable domain** (y usa **Remove domain** si no se necesita). Luego confirma que el acceso figure como `Not allowed` y que un objeto de prueba no se pueda leer anónimamente por el dominio. No basta con CORS para protegerlo. El firmador usa el endpoint S3 estándar basado en el Account ID; Vega Drive no necesita un dominio público de R2 para usar URLs S3 prefirmadas.

## 1. Corregir CORS del bucket

La configuración informada actualmente no es adecuada para el navegador: incluye `https://s3-vegadirve.jnmtortas.com` como origen permitido, pero ese es el dominio de almacenamiento, no el origen desde el que se ejecuta la aplicación; además, no hay encabezados permitidos ni `ETag` expuesto.

En la política CORS de `vega-drive-files`, configurar:

- **Allowed origins (producción):**
  - `https://drive.jnmtortas.com`
  - `https://vega-drive.programadorkevinsvega.workers.dev`
- **Allowed methods:** `GET`, `PUT`
- **Allowed headers:** `Content-Type`, `If-None-Match`
- **Expose headers:** `ETag`
- **Max age:** un valor moderado, por ejemplo `3600` segundos, si la interfaz permite configurarlo.

No usar `*`. No incluir localhost en la política de producción. Para desarrollo local, agregar `http://localhost:3000` solo en una política/cuenta de desarrollo controlada o añadirlo temporalmente y retirarlo antes de producción. No se necesita permitir el dominio de R2 como origen del navegador.

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

## 3. Mantener la transferencia directa deshabilitada hasta validar

La aplicación solo usa las rutas directas cuando `DIRECT_R2_TRANSFERS_ENABLED` vale `true`. No habilitar esa variable todavía. Primero confirmar que los tres secretos están configurados en el entorno correcto y que el bucket continúa privado.

La activación futura debe hacerse explícitamente mediante la configuración de entorno del Worker, después de completar las pruebas descritas abajo y con autorización de despliegue. No añadir la variable a `wrangler.toml` ni desplegar como parte de este runbook.

## 4. Validaciones obligatorias antes de activar

- [ ] CORS de producción coincide exactamente con los dos orígenes de producción de arriba.
- [ ] La URL pública `r2.dev` sigue desactivada y no existe lectura anónima.
- [ ] Las credenciales están limitadas al bucket y guardadas como secretos del Worker.
- [ ] Una URL firmada expira; método, clave, encabezados o parte alterados son rechazados.
- [ ] Un usuario no puede iniciar, completar, cancelar ni descargar recursos de otro usuario.
- [ ] Subida directa pequeña: verificar tamaño real, Content-Type, cuota y publicación de metadatos solo tras HEAD.
- [ ] Subida multipart grande: todas las partes, reintentos, reanudación, pausa, cancelación y limpieza de sesiones incompletas.
- [ ] Descarga directa: permisos, papelera, nombre seguro, URL temporal y ausencia de secretos en logs.
- [ ] CORS rechaza un origen no permitido y expone `ETag` a la aplicación autorizada.
- [ ] Prueba E2E real y concurrencia controlada; documentar resultados y ruta de rollback al flujo por Worker.

Las pruebas unitarias y CI no sustituyen estas comprobaciones reales en Cloudflare. No declarar la migración completa ni desplegar por el hecho de haber configurado CORS o creado credenciales.
