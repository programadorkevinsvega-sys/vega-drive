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

Las mutaciones exigen Origin exactamente igual al origen de la solicitud. Los cuerpos JSON rechazan campos desconocidos y se limitan a 64 KiB durante la lectura del stream. Los errores de login no distinguen correo inexistente, contraseña incorrecta o cuenta deshabilitada.

## Controles de seguridad implementados

- PBKDF2-SHA-256 con 100.000 iteraciones y sal aleatoria de 16 bytes.
- Comparación de hash derivado con crypto.subtle.timingSafeEqual.
- Normalización de correo y política de contraseña de 12–128 caracteres con rechazo de contraseñas triviales.
- Límite de registro MAX_USERS validado en servidor y aplicado dentro del mismo INSERT.
- Verificación server-side de Turnstile; errores, respuestas HTTP no exitosas y excepciones fallan de forma cerrada.
- Token de sesión aleatorio de 32 bytes; solo SHA-256 se persiste en D1.
- Cookie \_\_Host-session, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=604800 y sin Domain.
- Expiración absoluta de 7 días e inactividad máxima de 24 horas.
- Logout revoca la sesión en D1. Login rota la sesión anterior únicamente si pertenece al mismo usuario. Cambio de contraseña rota la sesión y revoca las demás.
- Limitación persistente por clave de correo/IP hasheada, con ventana de 15 minutos y bloqueo progresivo (1, 5, 15 y 30 minutos).
- Eventos de auditoría para login correcto/fallido, rechazo de Turnstile/registro y cambio de contraseña. No se guardan contraseñas, tokens de sesión ni cuerpos de petición.
- Middleware AuthenticatedActor crea userId, sessionId y email solo a partir de una sesión validada en el servidor.
- Respuestas API Cache-Control: no-store y cabeceras base nosniff, CSP, HSTS, X-Frame-Options y Referrer-Policy.

## Datos y migración

La migración src/modules/identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql añade identity_auth_attempts y su índice. Es aditiva; no modifica migraciones existentes ni crea referencias entre módulos. La tabla almacena hashes de claves de limitación, contador, inicio de ventana, vencimiento del bloqueo y fecha de actualización.

El adaptador D1 de identity es el único que consulta esa tabla. Las claves de correo/IP se hashean antes de persistirse. Los registros antiguos de limitación pueden requerir una política de limpieza operacional futura si el volumen de intentos aumenta.

## Configuración operativa requerida

La aplicación deshabilita registro/login con HTTP 503 cuando falta la site key o el secreto de Turnstile. Antes de habilitar autenticación en producción:

1. Configurar una site key real de Turnstile en TURNSTILE_SITE_KEY para el hostname de producción.
2. Configurar el secreto correspondiente como secreto del Worker TURNSTILE_SECRET_KEY; no guardarlo en Git ni en wrangler.toml.
3. Confirmar que MAX_USERS es el límite de registro aprobado (actualmente el valor versionado es 10).
4. Aplicar la migración 0002_identity_auth_attempts.sql a D1 remota mediante el flujo de despliegue autorizado y verificar el esquema.
5. Probar login y registro reales con tokens Turnstile válidos en el hostname de producción, así como rechazo de tokens inválidos.

La configuración registrada previamente en Cloudflare tenía TURNSTILE_SITE_KEY vacía. Por eso no se debe declarar autenticación de producción operativa hasta corregirla y verificar el secreto correspondiente.

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

La implementación y los tests se están incorporando directamente en main. La CI de la revisión previa falló en format:check, por lo que sus pasos posteriores fueron omitidos. Los tests añadidos en esta continuación aún deben ejecutarse en una revisión que supere el formateo manual. No hay evidencia nueva de prueba E2E de registro/login en producción en este documento.
