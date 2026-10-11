# Cierre de Fase 3 — Catálogo de archivos y carpetas

**Estado: abierto; no certificado para cierre.**  
**Última actualización:** 2026-10-11.  
**Roadmap relacionado:** [roadmap.md, Fase 3](./roadmap.md).

Este documento separa lo que está implementado de lo que está demostrado por pruebas. Un caso de uso existente no equivale a una aceptación completa de seguridad, ni una verificación arquitectónica sustituye a la verificación estructural de D1.

## 1. Alcance funcional

El catálogo de `src/modules/files` contiene casos de uso y persistencia D1 para operaciones de metadatos, entre ellas:

- Crear, renombrar, mover y listar carpetas/archivos.
- Validar y normalizar nombres; detectar duplicados entre carpetas y archivos.
- Evitar ciclos y validar rutas de carpetas activas.
- Borrado lógico, papelera, restauración, paginación y breadcrumbs.
- Mantener los metadatos del catálogo separados de la clave física de almacenamiento.

Los tests de catálogo y repositorios existen. La ejecución local reportada el 2026-10-11 terminó con **126/126 tests aprobados**, además de Prettier, arquitectura, TypeScript y `pnpm run verify:architecture:all`. Esto no demuestra por sí solo la cobertura de todos los escenarios de aislamiento que siguen enumerados abajo.

**Fuera del cierre de esta fase:** adaptador/transferencias R2 (Fase 4), controllers HTTP y experiencia de frontend/BFF (Fase 5), certificación transversal de seguridad (Fase 8). El catálogo de dominio no debe documentarse como una API HTTP completa hasta que se integre por los gateways y controllers previstos.

## 2. Aislamiento por propietario: evidencia y pendientes

El código revisado deriva el propietario de la identidad de actor que recibe el caso de uso y filtra recursos mediante propietario; los caminos de carpeta también comprueban la propiedad y el estado de los ancestros. Los tests actuales cubren aislamiento de algunas operaciones de lectura, renombrado y borrado, así como la concurrencia de creación de nombres.

La cobertura adicional quedó incorporada directamente a `main` en [73b2c8f](https://github.com/programadorkevinsvega-sys/vega-drive/commit/73b2c8fa2041aa5b67d7d5d32254241eb1316d42), [4ef3c66](https://github.com/programadorkevinsvega-sys/vega-drive/commit/4ef3c662001351291bfaac7186f72c68f97fab9c), [a152cf7](https://github.com/programadorkevinsvega-sys/vega-drive/commit/a152cf72c1fe5422ceb5397339c59b50a7982a9c), [a0e2d3a](https://github.com/programadorkevinsvega-sys/vega-drive/commit/a0e2d3a1be305bd38fc7a873d685250f325e42ee) y [11438e3](https://github.com/programadorkevinsvega-sys/vega-drive/commit/11438e35a1cdfee667bbbb847a60dd4a3790f814). La ejecución local que se reportó antes de incorporar estas pruebas adicionales pasó 126/126; aún se debe volver a ejecutar la suite sobre la versión actual para validar las cuatro pruebas nuevas. Incluye pruebas para:

- [x] Intentar mover una carpeta ajena y mover una carpeta propia a una carpeta ajena.
- [x] Intentar mover un archivo ajeno y mover un archivo propio a una carpeta ajena.
- [x] Rechazar creación de carpeta/archivo dentro de una carpeta ajena.
- [x] Restaurar recursos ajenos y comprobar que no aparecen en la papelera del otro propietario.
- [x] Comprobar que los rechazos no mueven nodos y que conflictos de nombre no alteran la ubicación ni la reserva del nodo existente.
- [x] Cubrir movimientos y renombrados exitosos, breadcrumbs y conflicto al restaurar un archivo.
- [ ] Volver a ejecutar los checks locales sobre la versión que contiene las cuatro pruebas nuevas y registrar el resultado.
- [ ] Ejecutar la suite actualizada en CI y registrar el resultado antes de certificar el cierre.

Estos puntos eran **brechas de evidencia de pruebas**; no se describen como vulnerabilidades confirmadas. Las respuestas HTTP 404 para recursos ajenos se deben verificar cuando el BFF/controller esté implementado en la Fase 5.

## 3. Migraciones y verificación estructural de D1

Las migraciones modulares esperadas documentadas en [migrations/manifest.md](./migrations/manifest.md) incluyen:

- `files/infrastructure/persistence/d1/migrations/0001_files_initial.sql`
- `files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql`
- `identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql`
- `identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql`

### Incidencia local resuelta el 2026-10-11

Comando ejecutado por el propietario:

```text
pnpm run db:verify:schema:local
D1 structural verification FAILED.
Missing objects:
table:files_catalog_names,
index:files_folders_owner_parent_name_active_idx,
index:files_items_owner_folder_name_active_idx,
table:identity_auth_attempts,
index:identity_auth_attempts_locked_until_idx
Deployment must stop.
```

La salida inicial demostró que la D1 **local** no coincidía con los objetos esperados. La causa inmediata quedó resuelta al aplicar las dos migraciones pendientes de `files` e `identity` localmente; no fue necesario modificar las migraciones ni el verificador.

### Procedimiento de reconciliación local

1. Inspeccionar el estado de los archivos de migración modulares y el patrón activo en `wrangler.toml`; no editar una migración ya aplicada en un entorno compartido.
2. Aplicar las migraciones **solo a la D1 local** con `pnpm run db:migrate:local`.
3. Volver a ejecutar `pnpm run db:verify:schema:local`.
4. Si aún falla, conservar la salida completa y comparar los objetos/DDL reales con las migraciones y con `scripts/verify-d1-schema.mjs`. Corregir intencionalmente la causa; no debilitar ni desactivar el verificador para que pase.
5. Registrar aquí el comando, resultado y commit que resuelve el problema. **Resultado registrado:** `pnpm run db:migrate:local` aplicó `files/.../0002_files_catalog_names.sql` e `identity/.../0002_identity_auth_attempts.sql`; a continuación `pnpm run db:verify:schema:local` pasó con `22 tables/indexes match migrations in vega_drive_db (local)`. La reconciliación fue local; no se ejecutó una migración remota.

No ejecutar `pnpm run db:migrate:production`, `pnpm run deploy` ni otros comandos que cambien D1 remota como parte de esta reconciliación local. Cualquier operación remota requiere revisión y autorización explícita separadas.

### Estado de la incidencia

- [x] Migraciones locales aplicadas o causa alternativa identificada: se aplicaron las dos migraciones pendientes localmente.
- [x] `pnpm run db:verify:schema:local` pasa después de la reconciliación: 22 tablas/índices.
- [x] Se registra evidencia del resultado en la salida del usuario, 2026-10-11; no hubo commit de código porque el árbol estaba limpio.
- [x] No se ha alterado el esquema remoto como parte de esta comprobación.

## 4. Papelera y limpieza

El borrado lógico y la restauración forman parte del catálogo. La limpieza permanente de metadatos y objetos físicos requiere una política explícita de retención, idempotencia y tratamiento de fallos. La limpieza de objetos R2 depende del adaptador de la Fase 4; no se debe marcar como implementada en el catálogo mientras no exista un caso de uso integrado y probado.

- [x] Alcance de Fase 3 definido: solo borrado lógico y restauración; no hay borrado permanente ni purga automática por antigüedad.
- [x] Hasta que se apruebe una política de retención y exista un caso de uso de purga explícito, los metadatos eliminados permanecen recuperables en la papelera; no se elimina automáticamente ningún metadato ni objeto.
- [x] La eliminación física de objetos, reintentos/idempotencia y reconciliación de fallos D1/R2 se asignan a la Fase 4, cuando exista el adaptador R2. No se simula ni se marca como implementada esta capacidad en Fase 3.
- [ ] La política de retención de producto y cualquier borrado permanente futuro requieren una decisión explícita antes de implementar la purga.

## 5. Evidencia de checks

Evidencia comunicada el 2026-10-11:

- [x] Ejecución local anterior a las últimas cuatro pruebas adicionales: `pnpm run check` aprobó Prettier, guardia arquitectónica, TypeScript y 126/126 tests.
- [ ] Repetir `pnpm run check` después de los commits de cobertura adicionales; los resultados 126/126 no se atribuyen a esa revisión más reciente.
- [x] `pnpm run verify:architecture:all`: los verificadores ejecutados finalizaron correctamente, con notas explícitas de capacidades R2/gateway aún no implementadas.
- [x] `pnpm run db:verify:schema:local`: pasó tras `pnpm run db:migrate:local`; 22 tablas/índices coinciden con las migraciones.
- [x] `pnpm run cloudflare:build` en la revisión anterior: frontend 119/119 tests, build de producción, auditorías sin vulnerabilidades conocidas y Wrangler dry-run completados.
- [ ] Repetir `pnpm run cloudflare:build` tras la última edición de las pruebas; no desplegar.
- [x] CI previamente reportado como satisfactorio: [GitHub Actions run 38114942365](https://github.com/programadorkevinsvega-sys/vega-drive/actions/runs/38114942365).

Las casillas indican evidencia reportada, no una afirmación de que estos comandos se hayan vuelto a ejecutar durante la edición de este documento.

## 6. Criterio para cerrar la Fase 3

La fase permanece abierta hasta que:

1. La cobertura de aislamiento y movimientos/restauraciones está incorporada; falta que las cuatro pruebas nuevas pasen en la suite actual y que el resultado de CI se registre.
2. (Resuelto) Se reconcilie D1 local y se registre una verificación estructural satisfactoria; esto ya se completó el 2026-10-11.
3. Se documente el alcance de limpieza: Fase 3 no hace purga permanente ni automática; el ciclo de borrado físico y la reconciliación D1/R2 pertenecen a Fase 4. Esta delimitación de alcance ya está documentada; la política de retención de producto sigue pendiente y bloquea cualquier purga futura, no el catálogo de Fase 3.
4. Se actualicen los checks del roadmap únicamente cuando exista evidencia.
5. Se vuelvan a ejecutar los checks locales y CI sobre el commit candidato.

El cierre de esta fase no certifica las transferencias R2, la integración HTTP/BFF ni la certificación global de seguridad.
