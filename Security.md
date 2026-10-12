# Reglas de seguridad de Vega Drive

Estas reglas son **obligatorias** para cada implementación. Las excepciones de transferencia directa autorizadas por el propietario se definen en [ADR-001](./ADR-001-direct-r2-transfers.md); no relajan el aislamiento entre usuarios ni la privacidad del bucket. Cada regla tiene un ID (`SEC-XXX-NN`) que el [roadmap](./roadmap.md) referencia en cada fase. La separación de módulos se rige además por [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md). Si una tarea no puede cumplir una regla, se documenta la excepción en el PR y se aprueba explícitamente.

Modelo de amenaza resumido: hasta 10 clientes de confianza limitada entre sí; el atacante principal es **otro cliente autenticado** (que intenta acceder a datos ajenos), seguido de bots anónimos (fuerza bruta, abuso del registro) y de errores propios (secretos filtrados, configuraciones laxas).

---

## 1. Aislamiento entre clientes (ISO)

- **SEC-ISO-01** El `userId` se obtiene **únicamente de la sesión validada en el servidor**. Nunca de la URL, el body, headers ni cookies no firmadas.
- **SEC-ISO-02** Toda consulta a D1 sobre datos propiedad de un usuario debe limitarse al actor obtenido de la sesión validada usando la columna de propiedad definida por el esquema del módulo. En tablas que usan `user_id`, aplica `WHERE user_id = ?`; en las tablas de `files` existentes (`files_items`, `files_folders` y `files_uploads`), aplica `WHERE owner_id = ?`. Las búsquedas directas de recursos deben combinar el identificador del recurso con el filtro de propiedad, nunca confiar solo en un ID recibido del cliente. Cada repositorio vive en el módulo dueño y solo accede a sus tablas con prefijo; está prohibido SQL suelto en rutas, gateways o módulos ajenos.
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
- **SEC-R2-02** El binding o token S3 de R2 tiene permisos mínimos (Object Read & Write) limitados a **este bucket**, y solo infrastructure/storage/r2 del módulo files puede usarlo. Rotación periódica.
- **SEC-R2-03** Las credenciales y la configuración de R2 nunca se entregan al navegador. La URL prefirmada temporal incluye el endpoint y la ruta exacta del objeto como parte de la firma; no concede acceso general. Se permite emitir exclusivamente URLs prefirmadas de vida corta y alcance mínimo para una única operación/objeto/parte, tras autorización del Worker y conforme a [ADR-001](./ADR-001-direct-r2-transfers.md). Una URL firmada es una credencial portadora hasta su expiración; no prometer revocación instantánea.
- **SEC-R2-04** El módulo files valida el tamaño total, permisos, cuota y frecuencia antes de autorizar una transferencia. Las cargas multipart pueden enviar bytes directamente a R2 con URLs prefirmadas por parte; los IDs de sesión internos, claves de objeto y listas de partes autoritativas permanecen en el servidor. La URL firmada contiene solo el upload ID y número de parte necesarios para esa operación. El Worker valida y completa la sesión.
- **SEC-R2-05** Al completar, verificar con `HEAD` el **tamaño real** del objeto frente a la cuota y al tamaño declarado; si excede, borrar el objeto y rechazar.
- **SEC-R2-06** Las descargas directas firman `Content-Disposition: attachment` y `Content-Type: application/octet-stream`; el flujo alternativo del Worker añade `X-Content-Type-Options: nosniff`.
- **SEC-R2-07** Regla de ciclo de vida para abortar subidas multipart incompletas y cron de limpieza de subidas huérfanas.
- **SEC-R2-08** El bucket permanece privado, sin dominio público ni `r2.dev`. Para transferencias directas, CORS de R2 permite solo orígenes explícitos de producción/desarrollo, métodos estrictamente necesarios y cabeceras mínimas; nunca `*` con credenciales. CORS no es autorización: cada operación requiere una URL prefirmada de alcance mínimo. No exponer cabeceras que no sean necesarias.

## 6. Frontend sin lógica de negocio (FE)

- **SEC-FE-01** El frontend solo presenta interfaz y envía solicitudes al mismo origen `/api`. No toma decisiones de autorización, cuotas, propiedad, claves de almacenamiento ni reglas de negocio; el servidor siempre es la fuente de verdad.
- **SEC-FE-02** Los assets del frontend no importan SDKs de R2/S3 ni contienen credenciales, configuración de cuenta/bucket ni URLs prefirmadas persistentes. Pueden usar una URL temporal devuelta por la API same-origin, que contiene una ruta firmada fija; no la almacenan ni registran y no pueden elegir claves, permisos, expiración ni parámetros firmados.

## 7. Fronteras modulares y D1 única (MOD)

- **SEC-MOD-01** Un módulo solo se comunica con otro mediante su API pública y un gateway. Están prohibidos imports de domain, application, infrastructure o repositorios internos de otro módulo.
- **SEC-MOD-02** VEGA_DRIVE_DB es única, pero cada módulo solo lee y escribe sus tablas con prefijo. Están prohibidos JOINs, claves foráneas, SQL y `db.batch()` entre prefijos distintos; una referencia entre módulos es un valor, no una FK.
- **SEC-MOD-03** CI ejecuta un lint o test de arquitectura que bloquea imports internos y SQL que mencione el prefijo de otro módulo.
- **SEC-MOD-04** Controllers y gateways del BFF no contienen reglas de negocio ni acceden a D1 o R2. El actor autenticado se deriva de la sesión del backend, nunca de ownerId, rol o permisos enviados por el cliente.

## 8. CORS, cabeceras y transporte (WEB)

- **SEC-WEB-01** Servir frontend y API desde el **mismo origen**; sin CORS abierto en la API. Si hace falta CORS, lista blanca exacta, nunca `*` con credenciales.
- **SEC-WEB-02** Cabeceras en todas las respuestas: `Content-Security-Policy` estricta (sin `unsafe-inline` si es posible), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (o `frame-ancestors 'none'`).
- **SEC-WEB-03** Solo HTTPS; redirección forzada y "Always Use HTTPS" activo.
- **SEC-WEB-04** Respuestas de la API con `Cache-Control: no-store` en datos autenticados.

## 9. Límite de peticiones y abuso (RATE)

- **SEC-RATE-01** Rate limiting en login, registro, transferencias de archivos por `/api` y creación de subidas (por IP y por usuario).
- **SEC-RATE-02** Bloqueo temporal progresivo tras intentos fallidos de login.
- **SEC-RATE-03** Tope de transferencias y subidas internas activas simultáneas por usuario.
- **SEC-RATE-04** Reglas WAF de Cloudflare activas sobre el dominio.

## 10. Secretos y configuración (SEC)

- **SEC-SEC-01** Ningún secreto en el repositorio, en `wrangler.toml`, en logs ni en el frontend. El frontend tampoco contiene endpoint, bucket, SDK, URL prefirmada, token ni configuración de R2. Solo el Worker usa `wrangler secret` / variables de entorno.
- **SEC-SEC-02** `.gitignore` incluye `.dev.vars`, `.env*`, `node_modules`, `.wrangler`.
- **SEC-SEC-03** Escaneo de secretos en CI (p. ej. gitleaks) y protección de rama `main`.
- **SEC-SEC-04** Si un secreto se filtra: rotar de inmediato y revisar logs de acceso.

## 11. Registro, auditoría y privacidad (LOG)

- **SEC-LOG-01** Registrar eventos de seguridad (login correcto/fallido, registro, cambio de contraseña, subida, borrado, compartición) con `userId`, IP y fecha.
- **SEC-LOG-02** Nunca registrar contraseñas, tokens, URLs prefirmadas completas ni cuerpos de petición sensibles.
- **SEC-LOG-03** Los errores al cliente son genéricos; el detalle va solo a logs internos.

## 12. Dependencias y cadena de suministro (DEP)

- **SEC-DEP-01** Mínimo de dependencias; versiones fijadas con lockfile.
- **SEC-DEP-02** `npm audit` / Dependabot activos; revisar antes de actualizar.
- **SEC-DEP-03** Preferir APIs nativas de Workers/Web Crypto antes que librerías de terceros.

## 13. Compartición de enlaces (SHARE)

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
- [ ] El BFF usa gateways y APIs públicas; no importa internals de módulos, SQL, D1 ni R2 (SEC-MOD-01, SEC-MOD-04).
- [ ] El cambio usa solo tablas del prefijo dueño, sin JOIN, FK ni batch cruzado, y pasa el lint/test de fronteras (SEC-MOD-02, SEC-MOD-03).
- [ ] Ninguna credencial, SDK ni configuración de R2 llega al cliente; las únicas URLs externas son capacidades firmadas temporales autorizadas por el Worker (SEC-FE-02, SEC-ISO-04, SEC-R2-03, SEC-R2-08).
- [ ] Cada URL prefirmada se emite solo tras autorización del Worker, con alcance mínimo y expiración corta (SEC-ISO-05, SEC-R2-03).
- [ ] Los endpoints nuevos tienen rate limiting (SEC-RATE-01).
- [ ] No hay secretos, tokens ni datos sensibles en código, logs ni respuestas (SEC-SEC-01, SEC-LOG-02).
- [ ] Cabeceras de seguridad y CORS siguen cumpliéndose (SEC-WEB-01, SEC-WEB-02).
- [ ] Errores genéricos hacia el cliente (SEC-LOG-03, SEC-AUTH-04).
- [ ] Dependencias nuevas justificadas y auditadas (SEC-DEP-01, SEC-DEP-02).

## Reporte de vulnerabilidades

Si encuentras una vulnerabilidad, no abras un issue público: contacta directamente al propietario del repositorio.

## 14. Endurecimiento transversal y certificación

Esta sección concreta los requisitos de seguridad para la arquitectura real de Vega Drive: Cloudflare Workers, Hono, D1, R2 y frontend servido desde el mismo origen. No se debe copiar configuración específica de Next.js ni introducir roles, identidades o mecanismos paralelos que el producto no necesite.

**Estado de certificación: PENDIENTE.** Que el Worker se despliegue, que D1 coincida con las migraciones y que `/api/health` responda correctamente no demuestra que los controles de seguridad estén implementados ni que hayan superado pruebas negativas. Los checks de esta sección solo se marcan como completados cuando exista evidencia reproducible en pruebas o en la verificación de producción.

### 14.1 Reglas transversales obligatorias

- **SEC-BASE-01 — Sesiones seguras:** las cookies de sesión serán `HttpOnly`, `Secure` en producción y usarán una política `SameSite` adecuada. El servidor validará la sesión en cada petición protegida; las sesiones tendrán expiración y revocación verificables.
- **SEC-BASE-02 — Autorización por operación:** cada endpoint y caso de uso sensible comprobará la identidad autenticada, los permisos necesarios y la propiedad del recurso antes de leerlo o mutarlo. La interfaz nunca es una frontera de autorización.
- **SEC-BASE-03 — IDOR/BOLA:** conocer o adivinar un identificador no concede acceso. Las lecturas, descargas, cambios y borrados deben estar limitados al propietario o al actor explícitamente autorizado; se devolverá 404 para recursos ajenos cuando corresponda para evitar enumeración.
- **SEC-BASE-04 — Validación del servidor:** validar tipos, formato, longitud, rangos, identificadores, campos permitidos y límites de cuerpo en el servidor. Las restricciones del navegador son solo UX. SQL debe estar parametrizado.
- **SEC-BASE-05 — Privacidad de datos y archivos:** R2 permanecerá privado y solo será accesible a través del Worker autorizado. No exponer credenciales, tokens, claves internas de objetos, URLs de almacenamiento ni datos sensibles en URLs, respuestas o logs.
- **SEC-BASE-06 — Protección contra abuso:** aplicar límites apropiados a autenticación, recuperación de acceso si existe, subidas/descargas y operaciones costosas. Combinar controles por IP y por actor cuando sea viable; un límite global no sustituye los controles específicos.
- **SEC-BASE-07 — Fronteras de aplicación:** las rutas Hono validan el transporte y delegan en gateways/APIs públicas y casos de uso. No contienen SQL, acceso directo a R2 ni reglas de negocio; el actor se deriva de la sesión validada.
- **SEC-BASE-08 — Roles mínimos:** solo implementar roles y clases de identidad que tengan un requisito real. No añadir una identidad de técnicos ni un segundo sistema de autorización por analogía con otra aplicación. Si se introducen roles administrativos, la comprobación de permisos será server-side.
- **SEC-BASE-09 — Webhooks condicionales:** si se integra un proveedor de pagos u otro webhook privilegiado, verificar criptográficamente la autenticidad, proteger contra repetición cuando el proveedor lo permita y reconciliar el estado con el proveedor antes de una transición financiera. No crear esta infraestructura si el producto no tiene ese flujo.
- **SEC-BASE-10 — D1 y despliegue:** conservar la verificación de esquema D1 previa al despliegue. Es un control de integridad de esquema, no una prueba de aislamiento de usuarios ni una certificación funcional.

### 14.2 Cabeceras HTTP en Workers/Hono

La configuración debe implementarse en la capa Hono/Worker adecuada para este repositorio, no en `next.config.ts`. Debe comprobarse en respuestas normales, errores, rutas de API y assets según corresponda.

- `Content-Security-Policy`: limitar scripts, estilos, imágenes, conexiones y `frame-ancestors` a lo que la aplicación realmente necesita; evitar `unsafe-inline` cuando sea viable.
- `Strict-Transport-Security`: habilitar solo para dominios servidos exclusivamente por HTTPS y con un alcance deliberado.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` o una política CSP equivalente con `frame-ancestors 'none'`, salvo necesidad de incrustación aprobada.
- `Referrer-Policy: strict-origin-when-cross-origin` o una política más restrictiva compatible con el producto.
- `Permissions-Policy`: desactivar capacidades del navegador que no se utilicen.
- Considerar también `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` y `X-DNS-Prefetch-Control` cuando sean compatibles con la aplicación.
- Deshabilitar encabezados que revelen tecnología innecesariamente cuando la plataforma permita controlarlos.
- Las respuestas autenticadas o con datos privados deben usar `Cache-Control: no-store`. No habilitar CORS abierto; el diseño predeterminado es mismo origen.

No copiar una CSP genérica sin probar los assets y las llamadas legítimas: una política debe ser restrictiva y funcional. Registrar las excepciones necesarias y su justificación.

### 14.3 Matriz de regresión para la certificación

Todos los puntos comienzan **pendientes**. Para marcar uno como completado se requiere una prueba automatizada reproducible o evidencia de verificación documentada; una casilla marcada manualmente no ejecuta ni demuestra el control.

#### Arquitectura y entradas

- [ ] Las rutas no pueden saltarse los gateways, APIs públicas o casos de uso ni acceder directamente a D1/R2.
- [ ] Las entradas malformadas, identificadores inválidos, campos desconocidos y valores fuera de límites se rechazan en el servidor.
- [ ] Los errores públicos no revelan secretos, tokens, consultas, trazas ni detalles internos.

#### Autenticación y autorización

- [ ] Las sesiones ausentes, inválidas, vencidas y revocadas se rechazan; logout invalida la sesión en el servidor.
- [ ] Cada operación sensible verifica identidad y permisos en el servidor.
- [ ] Las pruebas IDOR/BOLA demuestran que una cuenta no puede leer, modificar ni eliminar recursos de otra cuenta.
- [ ] Las pruebas concurrentes demuestran que solicitudes paralelas no eluden propiedad, permisos, cuotas o límites de uso.

#### Archivos y privacidad

- [ ] Una cuenta no puede leer, sobrescribir, mover ni eliminar archivos o metadatos ajenos.
- [ ] Las claves de objetos R2 se generan/validan en el servidor y no permiten acceso arbitrario.
- [ ] Los enlaces temporales, si el diseño llega a utilizarlos, son limitados, expiran y pueden revocarse cuando corresponda; no se exponen URLs de R2 por defecto.
- [ ] Tokens, secretos, claves internas y datos sensibles no aparecen en URLs, respuestas públicas ni logs.

#### Abuso y despliegue

- [ ] El rate limiting de Cloudflare y los controles de aplicación se prueban con solicitudes reales, incluidos los límites de autenticación y operaciones costosas.
- [ ] Se validan `Origin` y las defensas CSRF para las operaciones que usan cookies y modifican estado.
- [ ] Se revisan dependencias, configuración y secretos; el escaneo de secretos y la auditoría de dependencias se ejecutan en CI.
- [ ] La verificación de producción comprueba salud y, cuando existan, los flujos críticos de autenticación, autorización y transferencia de archivos; el endpoint de salud por sí solo no certifica esos flujos.

### 14.4 Evidencia y cierre

Para cada punto certificado, registrar la prueba o comando, el resultado, el commit revisado y, para verificaciones productivas, la fecha y el entorno. No incluir tokens, datos privados ni secretos en la evidencia. Mantener los fallos como pendientes hasta corregirlos y volver a ejecutar las pruebas.

La certificación global solo puede declararse completada cuando todos los controles aplicables hayan pasado, las excepciones estén justificadas y las pruebas se ejecuten contra el commit que se pretende desplegar. Los controles que aún no tengan funcionalidad asociada se mantienen como requisitos futuros, no como controles aprobados.
