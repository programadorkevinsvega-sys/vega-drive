# Roadmap de Vega Drive

Plan paso a paso por **fases** y **subfases**. Cada subfase incluye tareas, criterio de aceptación y las **reglas de seguridad** (IDs de [Security.md](./Security.md)) que deben cumplirse antes de darla por terminada.

Leyenda: `[ ]` pendiente · `[x]` hecho · 🔒 reglas de seguridad aplicables

## Reglas generales para todas las fases

1. Una subfase = una rama `feature/<fase>-<descripcion>` y un PR.
2. El PR no se fusiona sin el [checklist de seguridad](./SECURITY.md#checklist-de-pull-request) completo.
3. Toda funcionalidad con datos de usuario lleva prueba de acceso cruzado (SEC-ISO-06).
4. Se despliega primero en un entorno de pruebas (`wrangler dev` / entorno `staging`) y luego a producción.
5. Definición de "hecho": código + pruebas + checklist de seguridad + documentación actualizada.

## Resumen de fases

| Fase | Nombre | Resultado |
|---|---|---|
| 0 | Fundamentos | Repo, entorno y recursos de Cloudflare listos |
| 1 | Base de datos | Esquema D1 y capa de acceso con aislamiento |
| 2 | Autenticación | Registro cerrado, login, sesiones |
| 3 | Carpetas y archivos (metadatos) | Árbol de carpetas por usuario |
| 4 | Almacenamiento y subidas | Acceso a R2 exclusivamente desde el Worker/backend |
| 5 | Frontend | Inicio, registro, login, dashboard |
| 6 | Cuotas y administración | Límites por usuario y panel mínimo |
| 7 | Compartir enlaces | Enlaces con expiración (opcional) |
| 8 | Endurecimiento | Pruebas de seguridad y revisión final |
| 9 | Despliegue y operación | Producción, monitoreo y respaldos |
| 10 | Mejoras futuras | Miniaturas, búsqueda, 2FA, etc. |

---

## Fase 0 — Fundamentos

### 0.1 Repositorio y convenciones
- [ ] Añadir `README.md`, `ROADMAP.md`, `SECURITY.md`.
- [ ] `.gitignore` (incluir `.dev.vars`, `.env*`, `.wrangler`, `node_modules`).
- [ ] Plantilla de PR con el checklist de seguridad.
- [ ] Protección de la rama `main` (PR obligatorio).
- **Aceptación:** repo con documentación y plantilla de PR visibles.
- 🔒 SEC-SEC-02, SEC-SEC-03.

### 0.2 Recursos de Cloudflare
- [ ] Crear bucket R2 privado `vega-drive-files`.
- [ ] Crear base D1 `vega-drive-db`.
- [ ] Crear token S3 de R2 con permisos mínimos sobre el bucket.
- [ ] Configurar dominio y DNS en Cloudflare.
- **Aceptación:** recursos creados; bucket sin acceso público.
- 🔒 SEC-R2-01, SEC-R2-02, SEC-WEB-03.

### 0.3 Esqueleto del Worker
- [ ] Inicializar proyecto TypeScript + `wrangler.toml` con bindings (D1, assets).
- [ ] Router básico y ruta `/api/health`.
- [ ] Middleware global de cabeceras de seguridad.
- [ ] Gestión de secretos con `wrangler secret`.
- **Aceptación:** `wrangler dev` responde `/api/health` con cabeceras de seguridad.
- 🔒 SEC-WEB-02, SEC-SEC-01.

### 0.4 Integración continua
- [ ] Workflow de GitHub Actions: lint, typecheck, tests.
- [ ] Escaneo de secretos (gitleaks) y `npm audit`.
- **Aceptación:** CI verde obligatoria para fusionar.
- 🔒 SEC-SEC-03, SEC-DEP-02.

---

## Fase 1 — Base de datos

### 1.1 Esquema inicial
- [ ] Migración con tablas: `users`, `sessions`, `invites`, `nodes` (archivos y carpetas), `uploads`, `audit_log`.
- [ ] Índices por `user_id` y `(user_id, parent_id)`.
- [ ] Claves foráneas y restricciones (`UNIQUE` en correo).
- **Aceptación:** migración aplicada en local y remoto.
- 🔒 SEC-ISO-02, SEC-AUTH-05.

### 1.2 Capa de acceso a datos
- [ ] Módulo `db/` con funciones que **siempre** reciben `userId` como parámetro.
- [ ] Prohibido SQL fuera de este módulo.
- [ ] Utilidad de paginación.
- **Aceptación:** ninguna ruta ejecuta SQL directo.
- 🔒 SEC-ISO-01, SEC-ISO-02, SEC-VAL-02, SEC-VAL-04.

### 1.3 Pruebas de aislamiento de datos
- [ ] Tests con dos usuarios: A no puede leer/modificar/borrar datos de B.
- **Aceptación:** pruebas pasan y se ejecutan en CI.
- 🔒 SEC-ISO-03, SEC-ISO-06.

---

## Fase 2 — Autenticación y sesiones

### 2.1 Registro cerrado
- [ ] Endpoint `POST /api/auth/register`.
- [ ] Código de invitación de un solo uso **o** tope de `MAX_USERS = 10`.
- [ ] Validación de correo y contraseña; hash PBKDF2 con sal.
- [ ] Turnstile en el servidor.
- **Aceptación:** no se pueden crear más de 10 cuentas ni registrarse sin invitación válida.
- 🔒 SEC-AUTH-01, SEC-AUTH-03, SEC-AUTH-05, SEC-AUTH-06, SEC-AUTH-07, SEC-VAL-01.

### 2.2 Login
- [ ] Endpoint `POST /api/auth/login` con mensajes genéricos.
- [ ] Comparación en tiempo constante.
- [ ] Bloqueo progresivo tras intentos fallidos.
- **Aceptación:** login correcto crea sesión; fallos no revelan si el correo existe.
- 🔒 SEC-AUTH-02, SEC-AUTH-04, SEC-AUTH-07, SEC-RATE-01, SEC-RATE-02.

### 2.3 Sesiones y logout
- [ ] Generar token aleatorio de 32 bytes; guardar solo su hash.
- [ ] Cookie `__Host-session` `HttpOnly; Secure; SameSite=Lax`.
- [ ] Middleware que resuelve la sesión y expone `userId`.
- [ ] `POST /api/auth/logout` invalida en servidor.
- [ ] Verificación de `Origin` en peticiones mutantes.
- **Aceptación:** rutas protegidas devuelven 401 sin sesión válida.
- 🔒 SEC-SES-01, SEC-SES-02, SEC-SES-03, SEC-SES-05, SEC-ISO-01.

### 2.4 Gestión de cuenta
- [ ] Cambio de contraseña (cierra las demás sesiones).
- [ ] Listado y cierre de sesiones activas.
- [ ] Registro de eventos de seguridad.
- **Aceptación:** tras cambiar la contraseña, las otras sesiones dejan de ser válidas.
- 🔒 SEC-SES-04, SEC-LOG-01, SEC-LOG-02.

---

## Fase 3 — Carpetas y archivos (metadatos)

### 3.1 Carpetas
- [ ] Crear, renombrar, mover y eliminar carpetas.
- [ ] Prevenir ciclos al mover (una carpeta no puede entrar en sus descendientes).
- **Aceptación:** operaciones limitadas al usuario de la sesión.
- 🔒 SEC-ISO-01, SEC-ISO-02, SEC-ISO-03, SEC-VAL-03.

### 3.2 Listado y navegación
- [ ] `GET /api/nodes?parent=<id>` con paginación y orden.
- [ ] Ruta de migas (breadcrumbs).
- **Aceptación:** un `parent` ajeno devuelve 404.
- 🔒 SEC-ISO-03, SEC-VAL-04.

### 3.3 Operaciones sobre archivos (metadatos)
- [ ] Renombrar y mover archivos.
- [ ] Validación de nombres duplicados en la misma carpeta.
- **Aceptación:** cambios solo afectan metadatos, no la clave en R2.
- 🔒 SEC-VAL-03, SEC-ISO-04.

### 3.4 Papelera
- [ ] Borrado lógico (`deleted_at`), restaurar y vaciar papelera.
- [ ] Cron que elimina de R2 y D1 tras N días.
- **Aceptación:** el borrado definitivo elimina el objeto en R2.
- 🔒 SEC-ISO-05, SEC-LOG-01.

---

## Fase 4 — Almacenamiento y subidas

### 4.1 Cliente privado de R2
- [ ] Módulo `lib/r2.ts` usado exclusivamente por el Worker/backend, mediante binding de R2 o credenciales privadas.
- [ ] Función de generación de clave `u/{userId}/{uuid}`.
- [ ] Mantener el bucket sin CORS para el navegador, sin dominio público ni URLs prefirmadas.
- **Aceptación:** el Worker crea, consulta y elimina objetos de prueba sin que el navegador pueda contactar R2.
- 🔒 SEC-ISO-04, SEC-R2-02, SEC-R2-08, SEC-SEC-01.

### 4.2 Subir mediante la API del backend
- [ ] `POST /api/files`: recibe el archivo en el Worker; valida sesión, nombre, tamaño y cuota antes de almacenarlo.
- [ ] El Worker transmite el contenido a R2 y crea internamente cualquier operación multipart necesaria; ningún identificador interno se expone al navegador.
- **Aceptación:** la API devuelve únicamente el metadato del archivo y R2 no registra ninguna petición originada por el navegador.
- 🔒 SEC-ISO-01, SEC-ISO-04, SEC-R2-04, SEC-VAL-01, SEC-VAL-03, SEC-RATE-01, SEC-RATE-03.

### 4.3 Finalizar y limpiar en backend
- [ ] El Worker verifica el tamaño real con `HEAD`, registra el archivo en `nodes` y limpia operaciones internas fallidas.
- [ ] Si el tamaño real excede la cuota o lo declarado, el Worker borra el objeto y rechaza la operación.
- **Aceptación:** una subida de un archivo > 300 MB completada a través de `/api/files`, sin URL, SDK ni llamada directa a R2 desde el navegador.
- 🔒 SEC-R2-05, SEC-ISO-05, SEC-LOG-01.

### 4.4 Limpieza de subidas huérfanas
- [ ] Regla de ciclo de vida de R2 para abortar multipart incompletas.
- [ ] Cron que cancela registros `uploads` vencidos.
- **Aceptación:** no quedan partes huérfanas tras el plazo.
- 🔒 SEC-R2-07.

### 4.5 Descargas
- [ ] `GET /api/files/:id/download`: verifica propiedad y transmite la respuesta de R2 a través del Worker; nunca devuelve una URL de R2.
- [ ] `Content-Disposition: attachment` y `nosniff`.
- [ ] Soporte de `Range` gestionado y autorizado por el backend.
- **Aceptación:** el archivo se descarga y se puede reanudar sin petición del navegador a R2.
- 🔒 SEC-ISO-05, SEC-R2-03, SEC-R2-06, SEC-WEB-04.

---

## Fase 5 — Frontend

### 5.1 Base del frontend
- [ ] Assets estáticos servidos por el mismo Worker.
- [ ] Estilos, layout y componentes comunes.
- [ ] CSP estricta compatible con los scripts propios.
- **Aceptación:** las páginas cargan sin errores de CSP.
- 🔒 SEC-WEB-01, SEC-WEB-02, SEC-VAL-05.

### 5.2 Página de inicio (landing)
- [ ] Presentación del producto, enlaces a login y registro.
- **Aceptación:** accesible sin sesión, sin datos sensibles.
- 🔒 SEC-WEB-02.

### 5.3 Registro y login
- [ ] Formularios que solo presentan la interfaz; cualquier validación de seguridad, autenticación y decisión de negocio se hace en el servidor.
- [ ] Widget de Turnstile.
- [ ] Mensajes de error genéricos.
- **Aceptación:** flujo completo registro → login → dashboard.
- 🔒 SEC-AUTH-04, SEC-AUTH-07, SEC-VAL-05, SEC-SES-02.

### 5.4 Dashboard
- [ ] Listado de carpetas/archivos, breadcrumbs, crear, renombrar, mover, eliminar, papelera.
- [ ] Indicador de cuota usada.
- [ ] Redirección al login si la sesión expira (401).
- **Aceptación:** un usuario solo ve sus propios datos.
- 🔒 SEC-ISO-01, SEC-VAL-05, SEC-WEB-04.

### 5.5 Formulario de subida
- [ ] Enviar el archivo únicamente a la ruta autenticada `/api/files`.
- [ ] Mostrar el estado y el resultado devuelto por la API, sin implementar reglas de cuota, autorización, fragmentación multipart ni reintentos contra R2.
- [ ] Prohibir en los assets del frontend referencias a endpoint, bucket, SDK, credenciales o URLs de R2.
- **Aceptación:** la red del navegador muestra peticiones solo al origen de la aplicación; no hay peticiones directas a R2.
- 🔒 SEC-R2-03, SEC-R2-08, SEC-RATE-03.

---

## Fase 6 — Cuotas y administración

### 6.1 Cuotas por usuario
- [ ] Campo `quota_bytes` y contador de uso.
- [ ] Comprobación en el Worker antes y después de guardar el archivo (tamaño real).
- [ ] Durable Object por usuario si hay condiciones de carrera.
- **Aceptación:** no se puede superar la cuota ni con subidas paralelas.
- 🔒 SEC-R2-05, SEC-ISO-01.

### 6.2 Panel de administración mínimo
- [ ] Rol `admin` solo para el propietario.
- [ ] Gestionar invitaciones, ver uso por cliente, desactivar cuentas.
- [ ] El admin **no** puede ver el contenido de los archivos por defecto.
- **Aceptación:** rutas admin devuelven 404/403 a usuarios normales.
- 🔒 SEC-ISO-03, SEC-LOG-01, SEC-AUTH-06.

### 6.3 Auditoría
- [ ] Visor de eventos de seguridad recientes.
- **Aceptación:** eventos clave visibles sin datos sensibles.
- 🔒 SEC-LOG-01, SEC-LOG-02.

---

## Fase 7 — Compartir enlaces (opcional)

### 7.1 Enlaces compartidos
- [ ] Crear, listar y revocar enlaces por archivo.
- [ ] Token de ≥ 32 bytes (hash en D1), expiración obligatoria, contraseña opcional.
- [ ] Descarga pública transmitida por el Worker tras validar el token; nunca devuelve una URL de R2.
- **Aceptación:** un enlace expirado o revocado no funciona.
- 🔒 SEC-SHARE-01, SEC-SHARE-02, SEC-SHARE-03, SEC-RATE-01.

---

## Fase 8 — Endurecimiento

### 8.1 Pruebas de seguridad
- [ ] Batería de pruebas de acceso cruzado en todos los endpoints.
- [ ] Pruebas de fuerza bruta, subidas con tamaños falsos y ausencia total de acceso directo del navegador a R2.
- [ ] Revisión de inyección y XSS (nombres de archivo con caracteres especiales).
- **Aceptación:** sin hallazgos críticos abiertos.
- 🔒 SEC-ISO-06, SEC-VAL-01…05, SEC-R2-04, SEC-R2-05, SEC-R2-08.

### 8.2 Revisión de configuración
- [ ] Verificar que R2 no permite CORS del navegador y revisar CSP, HSTS y cookies.
- [ ] Revisar permisos del token S3 y rotarlo.
- [ ] Auditar dependencias.
- **Aceptación:** checklist completo sin excepciones.
- 🔒 SEC-WEB-01…04, SEC-R2-02, SEC-R2-08, SEC-DEP-01…03.

---

## Fase 9 — Despliegue y operación

### 9.1 Producción
- [ ] Entornos `staging` y `production` separados (bucket y D1 distintos).
- [ ] Dominio, HTTPS forzado y reglas WAF.
- [ ] Despliegue desde CI con secretos de entorno.
- **Aceptación:** app accesible por HTTPS en el dominio final.
- 🔒 SEC-WEB-03, SEC-RATE-04, SEC-SEC-01.

### 9.2 Monitoreo y respaldos
- [ ] Alertas por errores y por picos de intentos fallidos.
- [ ] Respaldo/export periódico de D1 (más Time Travel).
- [ ] Procedimiento documentado de rotación de secretos y respuesta a incidentes.
- **Aceptación:** restauración de D1 probada al menos una vez.
- 🔒 SEC-LOG-01, SEC-LOG-02, SEC-SEC-04.

---

## Fase 10 — Mejoras futuras

- [ ] Miniaturas y previsualización de imágenes/PDF.
- [ ] Búsqueda por nombre.
- [ ] Autenticación en dos pasos (TOTP).
- [ ] Descarga de carpetas como ZIP en *streaming*.
- [ ] Versionado de archivos.
- [ ] Aplicación de sincronización.

Cada mejora debe pasar por el mismo ciclo: rama, PR, checklist de seguridad y pruebas de acceso cruzado.
