# Reglas de seguridad de Vega Drive

Estas reglas son **obligatorias** para cada implementación. Cada regla tiene un ID (`SEC-XXX-NN`) que el [ROADMAP](./ROADMAP.md) referencia en cada fase. Si una tarea no puede cumplir una regla, se documenta la excepción en el PR y se aprueba explícitamente.

Modelo de amenaza resumido: hasta 10 clientes de confianza limitada entre sí; el atacante principal es **otro cliente autenticado** (que intenta acceder a datos ajenos), seguido de bots anónimos (fuerza bruta, abuso del registro) y de errores propios (secretos filtrados, configuraciones laxas).

---

## 1. Aislamiento entre clientes (ISO)

- **SEC-ISO-01** El `userId` se obtiene **únicamente de la sesión validada en el servidor**. Nunca de la URL, el body, headers ni cookies no firmadas.
- **SEC-ISO-02** Toda consulta a D1 sobre datos de usuario incluye `WHERE user_id = ?` con el ID de la sesión. Se centraliza en una capa de acceso a datos; prohibido SQL suelto en las rutas.
- **SEC-ISO-03** Un recurso ajeno responde **404** (no 403), para no revelar que existe.
- **SEC-ISO-04** Las claves de R2 las genera el servidor con el formato `u/{userId}/{uuid}`. El cliente nunca envía, elige, conoce ni recibe una clave o URL de R2.
- **SEC-ISO-05** Antes de cada operación de subida, descarga, lectura o borrado en R2, el Worker verifica en D1 que el recurso pertenece al usuario de la sesión. El navegador nunca contacta R2.
- **SEC-ISO-06** Toda funcionalidad nueva debe incluir al menos una **prueba automatizada de acceso cruzado** (usuario A intenta leer/modificar/borrar recursos de usuario B y falla).

## 2. Autenticación y contraseñas (AUTH)

- **SEC-AUTH-01** Contraseñas con PBKDF2-SHA-256 (Web Crypto) a **100.000 iteraciones** (máximo permitido en Workers), sal aleatoria de 16 bytes por usuario.
- **SEC-AUTH-02** Comparaciones de hashes/tokens con comparación de tiempo constante (`crypto.subtle.timingSafeEqual`).
- **SEC-AUTH-03** Política de contraseña: mínimo 12 caracteres; rechazar contraseñas triviales. Longitud máxima razonable (p. ej. 128) para evitar abuso de CPU.
- **SEC-AUTH-04** Mensajes de error genéricos en login ("credenciales inválidas"); no revelar si el correo existe.
- **SEC-AUTH-05** Correo normalizado (minúsculas, recortado) y único.
- **SEC-AUTH-06** Registro cerrado: código de invitación de un solo uso **o** tope de `MAX_USERS` verificado en el servidor.
- **SEC-AUTH-07** Turnstile obligatorio en registro y login, verificado en el servidor.

## 3. Sesiones (SES)

- **SEC-SES-01** Token de sesión aleatorio de 32 bytes (`crypto.getRandomValues`). En D1/KV se guarda **solo su hash SHA-256**, nunca el token.
- **SEC-SES-02** Cookie `__Host-session; HttpOnly; Secure; SameSite=Lax; Path=/` (sin `Domain`).
- **SEC-SES-03** Expiración absoluta (p. ej. 7 días) e inactividad (p. ej. 24 h). Logout invalida la sesión en el servidor.
- **SEC-SES-04** Rotar la sesión al iniciar sesión y al cambiar la contraseña; cambiar la contraseña cierra las demás sesiones.
- **SEC-SES-05** Peticiones que modifican datos: verificar el header `Origin` (debe coincidir con el dominio propio) como defensa CSRF, además de `SameSite`.

## 4. Entrada y validación (VAL)

- **SEC-VAL-01** Validar con un esquema (p. ej. Zod) **todo** body, query y parámetro. Rechazar campos desconocidos.
- **SEC-VAL-02** SQL siempre con parámetros enlazados (`.bind()`); prohibido concatenar strings.
- **SEC-VAL-03** Nombres de archivo/carpeta: longitud máxima, sin caracteres de control, sin `/` ni `\`, sin `..`. El nombre vive solo en D1, **nunca** forma parte de la clave de R2.
- **SEC-VAL-04** Límites de tamaño en cuerpos JSON (p. ej. 64 KB) y de profundidad/cantidad de elementos en listados (paginación obligatoria).
- **SEC-VAL-05** Salida HTML siempre escapada en el frontend; prohibido `innerHTML` con datos de usuario.

## 5. Almacenamiento y R2 (R2)

- **SEC-R2-01** Bucket **privado**: sin acceso público ni dominio público ni `r2.dev` habilitado.
- **SEC-R2-02** Token S3 de R2 con permisos mínimos (Object Read & Write) limitado a **este bucket**. Rotación periódica.
- **SEC-R2-03** Está prohibido emitir URLs prefirmadas, endpoints, credenciales o tokens de R2 al navegador. Toda transferencia pasa por una ruta autenticada del Worker/backend.
- **SEC-R2-04** El Worker valida el tamaño total y transmite a R2 solo después de autorizar la operación. Cualquier multipart interno queda encapsulado en el backend y no expone partes ni identificadores al navegador.
- **SEC-R2-05** Al completar, verificar con `HEAD` el **tamaño real** del objeto frente a la cuota y al tamaño declarado; si excede, borrar el objeto y rechazar.
- **SEC-R2-06** El Worker transmite las descargas con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff` para evitar XSS almacenado por archivos HTML/SVG subidos.
- **SEC-R2-07** Regla de ciclo de vida para abortar subidas multipart incompletas y cron de limpieza de subidas huérfanas.
- **SEC-R2-08** El bucket no acepta CORS ni peticiones del navegador: sin `AllowedOrigins`, sin dominio público, sin `r2.dev` y sin `ExposeHeaders` para clientes. Solo el Worker/backend puede acceder a R2.

## 6. Frontend sin lógica de negocio (FE)

- **SEC-FE-01** El frontend solo presenta interfaz y envía solicitudes al mismo origen `/api`. No toma decisiones de autorización, cuotas, propiedad, claves de almacenamiento ni reglas de negocio; el servidor siempre es la fuente de verdad.
- **SEC-FE-02** Los assets del frontend no importan SDKs de R2/S3 ni contienen endpoint, bucket, configuración, URL prefirmada, token o credencial de R2.

## 7. CORS, cabeceras y transporte (WEB)

- **SEC-WEB-01** Servir frontend y API desde el **mismo origen**; sin CORS abierto en la API. Si hace falta CORS, lista blanca exacta, nunca `*` con credenciales.
- **SEC-WEB-02** Cabeceras en todas las respuestas: `Content-Security-Policy` estricta (sin `unsafe-inline` si es posible), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (o `frame-ancestors 'none'`).
- **SEC-WEB-03** Solo HTTPS; redirección forzada y "Always Use HTTPS" activo.
- **SEC-WEB-04** Respuestas de la API con `Cache-Control: no-store` en datos autenticados.

## 8. Límite de peticiones y abuso (RATE)

- **SEC-RATE-01** Rate limiting en login, registro, transferencias de archivos por `/api` y creación de subidas (por IP y por usuario).
- **SEC-RATE-02** Bloqueo temporal progresivo tras intentos fallidos de login.
- **SEC-RATE-03** Tope de transferencias y subidas internas activas simultáneas por usuario.
- **SEC-RATE-04** Reglas WAF de Cloudflare activas sobre el dominio.

## 9. Secretos y configuración (SEC)

- **SEC-SEC-01** Ningún secreto en el repositorio, en `wrangler.toml`, en logs ni en el frontend. El frontend tampoco contiene endpoint, bucket, SDK, URL prefirmada, token ni configuración de R2. Solo el Worker usa `wrangler secret` / variables de entorno.
- **SEC-SEC-02** `.gitignore` incluye `.dev.vars`, `.env*`, `node_modules`, `.wrangler`.
- **SEC-SEC-03** Escaneo de secretos en CI (p. ej. gitleaks) y protección de rama `main`.
- **SEC-SEC-04** Si un secreto se filtra: rotar de inmediato y revisar logs de acceso.

## 10. Registro, auditoría y privacidad (LOG)

- **SEC-LOG-01** Registrar eventos de seguridad (login correcto/fallido, registro, cambio de contraseña, subida, borrado, compartición) con `userId`, IP y fecha.
- **SEC-LOG-02** Nunca registrar contraseñas, tokens, URLs prefirmadas completas ni cuerpos de petición sensibles.
- **SEC-LOG-03** Los errores al cliente son genéricos; el detalle va solo a logs internos.

## 11. Dependencias y cadena de suministro (DEP)

- **SEC-DEP-01** Mínimo de dependencias; versiones fijadas con lockfile.
- **SEC-DEP-02** `npm audit` / Dependabot activos; revisar antes de actualizar.
- **SEC-DEP-03** Preferir APIs nativas de Workers/Web Crypto antes que librerías de terceros.

## 12. Compartición de enlaces (SHARE)

- **SEC-SHARE-01** Token aleatorio de ≥ 32 bytes, guardado con hash; con expiración obligatoria y revocable por el dueño.
- **SEC-SHARE-02** Solo permiso de lectura por defecto; contraseña opcional.
- **SEC-SHARE-03** El enlace da acceso a **un** recurso concreto; nunca a una ruta navegable fuera de él.

---

## Checklist de Pull Request

Marca cada punto en el PR (si no aplica, indica "N/A" y por qué):

- [ ] El `userId` proviene solo de la sesión (SEC-ISO-01) y las consultas filtran por él (SEC-ISO-02).
- [ ] Añadí pruebas de acceso cruzado entre usuarios (SEC-ISO-06).
- [ ] Toda entrada nueva está validada con esquema (SEC-VAL-01) y el SQL usa parámetros (SEC-VAL-02).
- [ ] El frontend no incorpora lógica de negocio y solo llama al mismo origen `/api` (SEC-FE-01).
- [ ] Ninguna clave, endpoint, SDK, URL, token, configuración ni ruta de R2 llega al cliente; el Worker es el único acceso a R2 (SEC-FE-02, SEC-ISO-04, SEC-R2-03, SEC-R2-08).
- [ ] Cada operación de R2 se autoriza en el Worker y no se emiten URLs prefirmadas (SEC-ISO-05, SEC-R2-03).
- [ ] Los endpoints nuevos tienen rate limiting (SEC-RATE-01).
- [ ] No hay secretos, tokens ni datos sensibles en código, logs ni respuestas (SEC-SEC-01, SEC-LOG-02).
- [ ] Cabeceras de seguridad y CORS siguen cumpliéndose (SEC-WEB-01, SEC-WEB-02).
- [ ] Errores genéricos hacia el cliente (SEC-LOG-03, SEC-AUTH-04).
- [ ] Dependencias nuevas justificadas y auditadas (SEC-DEP-01, SEC-DEP-02).

## Reporte de vulnerabilidades

Si encuentras una vulnerabilidad, no abras un issue público: contacta directamente al propietario del repositorio.
