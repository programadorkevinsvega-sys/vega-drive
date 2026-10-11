# Cierre de Fase 3 — Catálogo de archivos y carpetas

**Estado del catálogo de metadatos: CERRADO (2026-10-11).** El alcance definido para el módulo está implementado y validado localmente en el commit `9cfb738` (`test: strengthen architecture boundary checks`). El catálogo dispone ahora de un hito incremental de integración HTTP autenticada descrito en la sección 7. Esto no cierra la integración visual del frontend ni la Fase 5 completa.

## 1. Alcance implementado

El módulo `src/modules/files` contiene casos de uso, contratos y persistencia D1 para:

- Crear, listar, renombrar y mover carpetas y archivos por metadatos.
- Validar y normalizar nombres y rechazar nombres duplicados entre tipos de nodo.
- Prevenir ciclos y validar carpetas destino y ancestros activos.
- Aislar operaciones por propietario; impedir movimientos, creación y restauración en recursos ajenos.
- Realizar borrado lógico, listar la papelera y restaurar nodos.
- Proporcionar paginación estable y breadcrumbs navegables.
- Mantener el nombre visible del catálogo separado de la clave física de almacenamiento.

El propietario se deriva del actor autenticado entregado por la capa de aplicación; no se confía en un `ownerId` del navegador como autoridad. Los recursos ajenos se tratan como no encontrados en los casos de uso. La capa HTTP del catálogo reutiliza `FilesGateway`, toma el usuario exclusivamente del middleware de sesión y convierte el resultado `not-found` en HTTP 404.

## 2. Evidencia de pruebas y verificaciones

El propietario ejecutó los comandos siguientes en `main`, en el commit `9cfb738`, el 2026-10-11. Todas las ejecuciones finalizaron correctamente:

| Verificación | Resultado |
| --- | --- |
| `pnpm run check` | Prettier, guardia arquitectónica, TypeScript y 130/130 pruebas de backend aprobadas |
| Pruebas de catálogo | 4/4 pruebas de aislamiento y 8/8 de operaciones aprobadas; 3 pruebas de listado también aprobadas |
| `pnpm run verify:architecture:all` | Todos los verificadores terminaron correctamente |
| `pnpm run db:verify:schema:local` | 22 tablas/índices coinciden con las migraciones de D1 local |
| `pnpm run cloudflare:build` | Preflight, suite backend, 119/119 pruebas de frontend, TypeScript, build de producción, auditorías y Wrangler dry-run aprobados |
| Auditoría de dependencias | Backend y frontend: ninguna vulnerabilidad conocida encontrada |
| Estado Git | `HEAD`, `main` y `origin/main` sincronizados en `9cfb738`; `git status --short` sin cambios |

La prueba de catálogo incluye intentos de mover carpetas/archivos entre propietarios, crear elementos dentro de carpetas ajenas, restaurar recursos ajenos, movimientos y renombrados exitosos, breadcrumbs y conflictos de nombre sin cambios colaterales.

El build de Cloudflare se ejecutó con `--dry-run`: **no se publicó un despliegue** y no se ejecutaron migraciones remotas. La D1 local se verificó estructuralmente; la salida no afirma que se haya vuelto a verificar la D1 remota.

## 3. D1 y migraciones

Las migraciones modulares permanecen en `src/modules/<module>/infrastructure/persistence/d1/migrations/`. La reconciliación local del 2026-10-11 aplicó las migraciones pendientes de `files` e `identity` mediante el flujo local documentado. Después, `pnpm run db:verify:schema:local` confirmó que los 22 objetos estructurales coinciden con las migraciones.

No se modificaron migraciones históricas para ocultar la diferencia, y esta validación no cambió el esquema remoto.

## 4. Alcance del ciclo de vida

La Fase 3 implementa borrado lógico y restauración. No promete borrado permanente ni purga automática. Los metadatos eliminados permanecen recuperables en la papelera; una política de retención y una purga futura son decisiones de producto separadas y **no son pendientes para cerrar el alcance actual de Fase 3**.

La eliminación física de objetos R2, su idempotencia, reintentos y reconciliación de fallos D1/R2 pertenecen a la Fase 4, cuando exista el adaptador de almacenamiento.

## 5. Criterios de cierre

- [x] Operaciones de catálogo de carpetas y archivos implementadas.
- [x] Validación de nombres, duplicados, ciclos y destinos implementada.
- [x] Aislamiento por propietario y rechazo de recursos ajenos cubiertos por pruebas.
- [x] Papelera, restauración, paginación y breadcrumbs implementados y probados.
- [x] Conflictos de movimiento/restauración no producen cambios colaterales.
- [x] Migraciones modulares y esquema D1 local verificados.
- [x] Suite completa de backend, verificaciones arquitectónicas y build de Cloudflare aprobados en el commit candidato.
- [x] Alcance de borrado lógico documentado y responsabilidades de fases posteriores delimitadas.
- [x] Roadmap y documentación actualizados para reflejar el cierre.

## 6. Fuera de alcance y fases posteriores

El cierre de Fase 3 **no** certifica ni marca como completados:

- **Fase 4:** adaptador y transferencias de archivos con R2.
- **Fase 5:** integración completa del frontend, presentación de estados, assets y aceptación integral de seguridad/operación; las rutas del catálogo cubren solo el hito HTTP del backend.
- **Fase 6:** cuotas.
- **Fase 7:** compartición.
- **Fase 8:** certificación transversal de seguridad.
- **Fase 9:** staging, operación, recuperación y rollback certificados.

Estas son tareas explícitas de otras fases, no defectos ni pendientes de implementación del alcance de catálogo de Fase 3.

## 7. Hito incremental de integración HTTP del catálogo

La aplicación Hono expone las operaciones ya implementadas por `FilesPublicApi` a través de `FilesGateway` e `InProcessFilesGateway`. Este hito cubre el backend HTTP y no conecta todavía la interfaz del navegador.

| Método | Ruta                                   | Uso                                                              |
| ------ | -------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/api/files`                           | Listar la raíz; admite `limit` y `cursor`.                       |
| GET    | `/api/files?folderId={id}`             | Listar el contenido de una carpeta, incluidos `breadcrumbs`.     |
| GET    | `/api/files/trash`                     | Listar la papelera; admite `limit` y `cursor`.                   |
| POST   | `/api/files/folders`                   | Crear carpeta; cuerpo `name` y, opcionalmente, `parentFolderId`. |
| PATCH  | `/api/files/folders/:id`               | Renombrar carpeta; cuerpo `name`.                                |
| POST   | `/api/files/folders/:id/move`          | Mover carpeta; cuerpo `parentFolderId` (`null` indica la raíz).  |
| DELETE | `/api/files/folders/:id`               | Enviar carpeta a la papelera.                                    |
| POST   | `/api/files/trash/folders/:id/restore` | Restaurar carpeta.                                               |
| POST   | `/api/files/items/metadata`            | Crear metadatos de archivo; no sube bytes ni escribe en R2.      |
| PATCH  | `/api/files/items/:id`                 | Renombrar archivo; cuerpo `name`.                                |
| POST   | `/api/files/items/:id/move`            | Mover archivo; cuerpo `folderId` (`null` indica la raíz).        |
| DELETE | `/api/files/items/:id`                 | Enviar archivo a la papelera.                                    |
| POST   | `/api/files/trash/items/:id/restore`   | Restaurar archivo.                                               |

Las respuestas de listado, creación, renombrado, movimiento y restauración contienen las vistas públicas que devuelve el catálogo; las creaciones usan HTTP 201 y las demás respuestas correctas HTTP 200. Las operaciones de eliminación lógica devuelven `{ "ok": true }`.

### Controles de transporte y autorización

- Todas las rutas del catálogo exigen la sesión validada por `requireAuthenticatedActor`; el actor de archivos contiene únicamente el `userId` resuelto en servidor.
- Los cuerpos JSON se limitan a 64 KiB y rechazan tipos de contenido incorrectos, JSON malformado y claves desconocidas. Los parámetros de consulta no reconocidos o duplicados se rechazan.
- Las mutaciones verifican que `Origin` coincida con el origen de la petición. No aceptan parámetros de consulta; las operaciones sin cuerpo rechazan cuerpos inesperados.
- Los resultados `invalid-input`, `not-found`, `duplicate-name`, `cycle` y `unavailable` se traducen respectivamente a HTTP 400, 404, 409, 409 y 503. La respuesta de error no revela SQL, trazas ni mensajes internos.
- Se conservan las cabeceras existentes y `Cache-Control: no-store` en las respuestas `/api/*`.

No se exponen rutas de subida o descarga física, búsqueda, favoritos ni transferencias R2: el contrato actual no implementa esas operaciones. El frontend sigue sin estar conectado al catálogo mediante un cliente de API.
