# Fase 2 — Identidad, autenticación y sesiones

## Alcance

Esta fase implementa el registro cerrado, login, logout, consulta de sesión, cambio de contraseña y resolución de identidad del lado servidor. No implementa todavía autorización de archivos: esa integración pertenece a las fases de files y debe recibir el actor autenticado a través del gateway.

## Rutas HTTP

Todas las rutas están bajo el mismo origen y prefijo /api/auth.

| Método y ruta  | Requiere sesión | Comportamiento                                                                |
| -------------- | --------------- | ----------------------------------------------------------------------------- |
| GET /config    | No              | Devuelve la site key pública de Turnstile y si el módulo está listo.          |
| POST /register | No              | Acepta email, password y turnstileToken. Registro cerrado mediante MAX_USERS. |
| POST /login    | No              | Verifica Turnstile y credenciales; al éxito emite cookie de sesión.           |
| POST /logout   | Cookie opcional | Revoca la sesión presentada y elimina la cookie.                              |
| GET /session   | No              | Devuelve solo estado autenticado y correo público, nunca el token.            |
| POST /password | Sí              | Comprueba contraseña actual, rota sesión y revoca las demás sesiones.         |

Las mutaciones exigen Origin exactamente igual al origen de la solicitud. Las mutaciones requieren `Content-Type: application/json`; los cuerpos rechazan campos desconocidos y se limitan a 64 KiB durante la lectura del stream. Los errores de login no distinguen correo inexistente, contraseña incorrecta o cuenta deshabilitada.

## Controles de seguridad implementados

- PBKDF2-SHA-256 con 100.000 iteraciones y sal aleatoria de 16 bytes.
- Comparación de hash derivado con crypto.subtle.timingSafeEqual.
- Normalización de correo y política de contraseña de 12–128 caracteres con rechazo de contraseñas triviales.
- Límite de registro MAX_USERS validado en servidor y aplicado dentro del mismo INSERT.
- Verificación server-side de Turnstile: exige `success: true`, la acción esperada (`register` o `login`) y un `hostname` incluido en `TURNSTILE_HOSTNAMES`. Los fallos son cerrados y los diagnósticos solo registran códigos de error permitidos, nunca tokens ni secretos.
- Token de sesión aleatorio de 32 bytes; solo SHA-256 se persiste en D1.
- Cookie \_\_Host-session, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=604800 y sin Domain.
- Expiración absoluta de 7 días e inactividad máxima de 24 horas.
- Logout revoca la sesión en D1. Login rota la sesión anterior únicamente si pertenece al mismo usuario. Cambio de contraseña rota la sesión y revoca las demás.
- Limitación persistente por clave de correo/IP hasheada, con ventana de 15 minutos y bloqueo progresivo (1, 5, 15 y 30 minutos).
- Eventos de auditoría con fecha, IP y actor cuando se conoce para login correcto/fallido, registro y cambio de contraseña. No se guardan contraseñas, tokens de sesión ni cuerpos de petición.
- Middleware AuthenticatedActor crea userId, sessionId y email solo a partir de una sesión validada en el servidor.
- Respuestas API Cache-Control: no-store y cabeceras base nosniff, CSP, HSTS, X-Frame-Options y Referrer-Policy.

## Datos y migración

La migración src/modules/identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql añade identity_auth_attempts y su índice. Es aditiva; no modifica migraciones existentes ni crea referencias entre módulos. La tabla almacena hashes de claves de limitación, contador, inicio de ventana, vencimiento del bloqueo y fecha de actualización.

El adaptador D1 de identity es el único que consulta esa tabla. Las claves de correo/IP se hashean antes de persistirse. Los registros antiguos de limitación pueden requerir una política de limpieza operacional futura si el volumen de intentos aumenta.

## Configuración operativa requerida

La aplicación deshabilita registro/login con HTTP 503 cuando falta la site key o el secreto de Turnstile. Antes de habilitar autenticación en producción:

1. Configurar una site key real de Turnstile en TURNSTILE_SITE_KEY para el hostname de producción.
2. Configurar el secreto correspondiente como secreto del Worker TURNSTILE_SECRET_KEY; no guardarlo en Git ni en wrangler.toml. Confirmar que pertenece al mismo widget que TURNSTILE_SITE_KEY.
3. Configurar `TURNSTILE_HOSTNAMES` con los hostnames exactos permitidos por despliegue; producción no debe incluir `localhost` ni `127.0.0.1`.
4. Confirmar que MAX_USERS es el límite de registro aprobado (actualmente el valor versionado es 10).
5. Aplicar la migración 0002_identity_auth_attempts.sql a D1 remota mediante el flujo de despliegue autorizado y verificar el esquema.
6. Confirmar que `GET /api/auth/config` devuelve `ready: true` sin revelar el secreto.
7. Probar login y registro con tokens Turnstile válidos en el hostname de producción o en un staging aislado con sus propias claves; verificar también el rechazo de tokens inválidos. No automatizar estos escenarios contra datos reales de producción sin una cuenta y un procedimiento de limpieza aprobados.

La salida del despliegue de Cloudflare del 2026-10-11 muestra TURNSTILE_SITE_KEY presente entre las variables del Worker. Esa salida no revela ni valida el secreto y no demuestra que Siteverify acepte tokens. El script `deploy` comprueba ahora `GET /api/auth/config` antes de migraciones/publicación y exige `ready: true`, lo que acredita que ambas variables están presentes, pero no sustituye el E2E con tokens válidos e inválidos en el hostname real. Nunca se deben usar las claves de prueba de Turnstile en producción.

## Verificación

Tras el formateo manual acordado por el responsable del repositorio, ejecutar en este orden:

1. pnpm run format:check
2. pnpm run verify:module-migrations
3. pnpm run verify:architecture:all
4. pnpm run lint
5. pnpm run typecheck
6. pnpm test
7. pnpm audit --audit-level=high
8. pnpm run cloudflare:build

La suite incluye pruebas de registro y límite atómico, política/derivación de contraseñas, login y rotación, expiración/revocación de sesiones, middleware del actor autenticado, adaptador Turnstile, persistencia del bloqueo progresivo, cambio de contraseña, límites de cuerpo y origen de mutaciones. Los tests unitarios usan dobles/fakes; no sustituyen la prueba E2E con Turnstile real ni la verificación del Worker desplegado.

## Estado honesto

El código en `main` ahora configura una allowlist de hostnames, etiqueta los tokens con la acción `register` o `login`, y el verificador exige que Siteverify confirme `success: true`, la acción esperada y el hostname esperado. También registra errores de Siteverify con códigos permitidos sin exponer tokens ni secretos.

Estos commits no despliegan el Worker activo. La captura de producción sigue mostrando cero solicitudes de Siteverify, así que no se puede afirmar que el problema esté resuelto en producción ni que el secreto configurado corresponda a esta site key. Después del despliegue autorizado, los nuevos logs deben distinguir una clave secreta inválida, un token rechazado/duplicado, un hostname inesperado y un fallo de red. Sigue pendiente el E2E real con un token nuevo válido e inválido en un entorno apropiado; no se debe crear una cuenta de producción solo para validar sin un plan de limpieza aprobado.


## Diagnóstico operativo de Turnstile / Siteverify

El verificador registra eventos estructurados bajo el prefijo `[turnstile]` en Cloudflare Worker Logs. Cada evento omite deliberadamente el token, la clave secreta, la IP del cliente, el cuerpo de respuesta y los mensajes de excepción sin filtrar.

| Evento | Interpretación |
| --- | --- |
| `Siteverify accepted token` | Siteverify respondió correctamente y `success`, `hostname` y `action` pasaron las validaciones locales. |
| `Siteverify rejected token` | Siteverify respondió, pero no aceptó el token. `errorCodes` contiene solo códigos oficiales permitidos. |
| `Siteverify HTTP failure` | Siteverify devolvió un estado HTTP no exitoso; revisar `status`, `contentType`, `cloudflareRayId` y `errorCodes`. |
| `Siteverify exception` | La llamada o preparación de la petición lanzó una excepción. `stage`, `errorName`, `causeName` y `causeCode` permiten localizar la clase de fallo sin exponer el mensaje original. |
| `Siteverify returned invalid JSON` / `malformed response` | Se recibió respuesta HTTP pero su cuerpo no tenía el formato JSON esperado. |
| `Siteverify hostname mismatch` / `action mismatch` | Siteverify respondió con éxito, pero la validación adicional del backend rechazó el hostname o la acción. |
| `Siteverify skipped` | No se hizo una llamada de red por configuración o entrada inválida; `reason` explica la condición. |

Los eventos de respuesta incluyen `status`, `durationMs`, `contentType` y `cloudflareRayId` cuando están disponibles. El `cloudflareRayId` es el encabezado `cf-ray` de la respuesta a Siteverify, no el Ray ID de la petición entrante al Worker. Si hay una respuesta HTTP, este ID ayuda a identificar la transacción del lado de Cloudflare; una excepción de red puede no tener ID porque no se recibió respuesta.

Para investigar un registro fallido, abre el evento `POST /api/auth/register` en Workers > Logs y revisa las líneas `[turnstile]` de la misma invocación. Si aparece `Siteverify exception` con `stage: siteverify-fetch` y sin `cloudflareRayId`, el Worker no obtuvo una respuesta de Siteverify; el `causeCode` puede ayudar a distinguir timeout/socket/DNS. Si aparece `Siteverify rejected token` o `Siteverify HTTP failure`, sí hubo respuesta y se deben analizar el estado y los códigos. Si no aparece ninguna línea `[turnstile]`, revisar si el request fue rechazado antes del verificador o si el Worker activo no ejecuta esta versión del código.

Estos logs ayudan a localizar la frontera del fallo, pero por sí solos no atribuyen automáticamente la culpa a Cloudflare: una excepción de red puede originarse en la conectividad o runtime del Worker, y un código de rechazo puede indicar un secreto equivocado, un token vencido/reutilizado o una solicitud inválida. No activar el registro del cuerpo completo ni agregar tokens, secretos, contraseñas o mensajes de excepción sin filtrar a los logs.
