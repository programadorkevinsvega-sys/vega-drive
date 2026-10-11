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

## Configuración operativa verificada en producción

El despliegue y la aceptación manual confirmaron que la configuración de Turnstile está activa en el hostname de producción. La comprobación publicada informó que la site key pública está presente y que el secreto server-side está configurado; nunca se registra ni se expone el valor del secreto.

- [x] La site key pública y el secreto del Worker están configurados.
- [x] `TURNSTILE_HOSTNAMES` incluye el hostname de producción permitido, sin depender de localhost.
- [x] El límite de registro permanece definido por `MAX_USERS` (valor versionado: 10).
- [x] La configuración de `/api/auth/config` se verificó durante la comprobación de producción.
- [x] Se probó el flujo positivo de autenticación con Turnstile válido.
- [x] El propietario probó de extremo a extremo un token Turnstile inválido y confirmó que el servidor lo rechaza.
- [x] El registro/login funcionan en el Worker desplegado; cualquier prueba adicional debe usar un entorno aprobado y no exponer tokens, contraseñas ni secretos.

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

## Cambio de contraseña desde Ajustes

El frontend incorpora la pantalla real en `#/settings`, con contraseña actual, nueva contraseña, confirmación, controles de mostrar/ocultar, validación de longitud y coincidencia, estados accesibles de error/éxito y limpieza de los campos tras cada intento enviado. El cliente llama a `POST /api/auth/password` en el mismo origen y no persiste los valores en almacenamiento local. La validación del navegador mejora la experiencia, pero el backend sigue siendo la autoridad para las reglas de contraseña y la contraseña actual.

El endpoint renueva la cookie de la sesión actual y revoca las demás sesiones del usuario. El propietario confirmó en producción el cambio real de contraseña, que la nueva contraseña permite iniciar sesión, que la anterior se rechaza, que la sesión actual sigue operativa y que las demás sesiones quedan revocadas.

## Estado y evidencia de cierre

**Estado de la Fase 2: CERRADA (2026-10-10, hora local de Colombia).** El código, las verificaciones automatizadas disponibles y las pruebas manuales de aceptación descritas a continuación cubren el alcance de identidad, autenticación y sesiones.

El verificador de Turnstile exige que Siteverify confirme `success: true`, la acción esperada (`register` o `login`) y un hostname permitido; falla de forma cerrada y los diagnósticos omiten secretos y tokens. El fallo `Illegal invocation` en `siteverify-fetch` se corrigió envolviendo la llamada al `fetch` global para que no reciba la instancia del verificador como `this`.

**Evidencia reportada por el propietario en producción (2026-10-10):**

- Registro e inicio de sesión funcionan con Turnstile válido.
- La prueba de extremo a extremo con un token Turnstile inválido fue rechazada por el servidor.
- El cambio de contraseña desde Ajustes se completó correctamente; la nueva contraseña permite iniciar sesión y la anterior es rechazada.
- La sesión actual sigue funcionando después del cambio y las demás sesiones del usuario quedan revocadas.
- El despliegue proporcionado publicó la versión Worker `aa3c2aa4-1e86-4c38-9d52-a587dbfea36c`; el log mostró `/api/health` HTTP 200 y confirmó que la site key pública y el secreto server-side de Turnstile están configurados. El log no incluye el SHA de Git de la versión publicada.
- GitHub Actions terminó correctamente para el commit `bd7e192f1afe6e89af2b6c10442f2b51e7d60ed5`, con los jobs `verify` y `secrets` aprobados: [ver ejecución de CI](https://github.com/programadorkevinsvega-sys/vega-drive/actions/runs/38112184984).

El cierre de la Fase 2 no certifica la seguridad global ni implica que el almacenamiento de archivos esté listo: siguen pendientes el catálogo y las transferencias de archivos, las pruebas de autorización por recurso, la certificación transversal indicada en `Security.md` y el procedimiento de rollback de `Rollback.md`.

## Diagnóstico operativo de Turnstile / Siteverify

El verificador registra eventos estructurados bajo el prefijo `[turnstile]` en Cloudflare Worker Logs. Cada evento omite deliberadamente el token, la clave secreta, la IP del cliente, el cuerpo de respuesta y los mensajes de excepción sin filtrar.

| Evento                                                    | Interpretación                                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Siteverify accepted token`                               | Siteverify respondió y `success`, `hostname` y `action` pasaron las validaciones locales.                                                                                                              |
| `Siteverify rejected token`                               | Siteverify respondió, pero rechazó el token. `errorCodes` incluye códigos permitidos.                                                                                                                  |
| `Siteverify HTTP failure`                                 | La respuesta tuvo estado HTTP no exitoso; revisa `status`, `contentType`, `cloudflareRayId` y `errorCodes`.                                                                                            |
| `Siteverify exception`                                    | Falló la preparación o llamada. `stage`, `errorName`, `errorMessage`, `causeName`, `causeMessage` y `causeCode` ayudan a localizar el fallo. Los mensajes se recortan y redactan antes de registrarse. |
| `Siteverify returned invalid JSON` / `malformed response` | Se recibió una respuesta HTTP, pero el cuerpo no tenía el formato esperado.                                                                                                                            |
| `Siteverify hostname mismatch` / `action mismatch`        | Siteverify respondió con éxito, pero el backend rechazó el hostname o la acción.                                                                                                                       |
| `Siteverify skipped`                                      | No se llamó a la red por configuración o entrada inválida; `reason` indica la condición.                                                                                                               |

Los eventos de respuesta incluyen `status`, `durationMs`, `contentType` y `cloudflareRayId` cuando están disponibles. El `cloudflareRayId` es el encabezado `cf-ray` de la respuesta a Siteverify, no el Ray ID de la petición entrante al Worker. Si hay una respuesta HTTP, este ID ayuda a identificar la transacción del lado de Cloudflare; una excepción de red puede no tener ID porque no se recibió respuesta.

Para investigar un registro fallido, abre el evento `POST /api/auth/register` en Workers > Logs y revisa las líneas `[turnstile]` de la misma invocación. Si aparece `Siteverify exception` con `stage: siteverify-fetch` y sin `cloudflareRayId`, el Worker no obtuvo una respuesta de Siteverify; el `errorMessage`, `causeMessage` y `causeCode` pueden ayudar a distinguir timeout/socket/DNS. Si aparece `Siteverify rejected token` o `Siteverify HTTP failure`, sí hubo respuesta y se deben analizar el estado y los códigos. Si no aparece ninguna línea `[turnstile]`, revisar si el request fue rechazado antes del verificador o si el Worker activo no ejecuta esta versión del código.

Estos logs ayudan a localizar la frontera del fallo, pero por sí solos no atribuyen automáticamente la culpa a Cloudflare: una excepción de red puede originarse en la conectividad o runtime del Worker, y un código de rechazo puede indicar un secreto equivocado, un token vencido/reutilizado o una solicitud inválida. No activar el registro del cuerpo completo ni agregar tokens, secretos, contraseñas o mensajes de excepción sin filtrar a los logs.
