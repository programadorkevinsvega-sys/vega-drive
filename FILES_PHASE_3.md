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

Antes de cerrar, añadir o identificar pruebas explícitas que demuestren:

- [ ] Mover carpeta ajena y mover una carpeta propia dentro de una carpeta ajena.
- [ ] Mover archivo propio a carpeta ajena, y mover archivo ajeno.
- [ ] Restaurar carpeta o archivo ajeno.
- [ ] Listar papelera sin revelar metadatos de otro propietario.
- [ ] Crear o mover dentro de una carpeta ajena.
- [ ] Rechazos sin cambios colaterales en metadatos ni reservas de nombres.
- [ ] Conflictos de nombre durante renombrado, movimiento y restauración, incluidos escenarios concurrentes relevantes.

Estos puntos son **brechas de evidencia de pruebas**; no deben describirse como vulnerabilidades confirmadas sin reproducir un fallo. Las respuestas HTTP 404 para recursos ajenos se deben verificar cuando el BFF/controller esté implementado en la Fase 5.

## 3. Migraciones y verificación estructural de D1

Las migraciones modulares esperadas documentadas en [migrations/manifest.md](./migrations/manifest.md) incluyen:

- `files/infrastructure/persistence/d1/migrations/0001_files_initial.sql`
- `files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql`
- `identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql`
- `identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql`

### Incidencia local registrada el 2026-10-11

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

La salida demuestra que la D1 **local** consultada no coincide con el conjunto de objetos esperado por las migraciones que el verificador leyó. No prueba por sí sola la causa. Una explicación posible es que las migraciones modulares nuevas no se hayan aplicado a la D1 local actual; hay que comprobarlo y no asumirlo.

### Procedimiento de reconciliación local

1. Inspeccionar el estado de los archivos de migración modulares y el patrón activo en `wrangler.toml`; no editar una migración ya aplicada en un entorno compartido.
2. Aplicar las migraciones **solo a la D1 local** con `pnpm run db:migrate:local`.
3. Volver a ejecutar `pnpm run db:verify:schema:local`.
4. Si aún falla, conservar la salida completa y comparar los objetos/DDL reales con las migraciones y con `scripts/verify-d1-schema.mjs`. Corregir intencionalmente la causa; no debilitar ni desactivar el verificador para que pase.
5. Registrar aquí el comando, resultado y commit que resuelve el problema.

No ejecutar `pnpm run db:migrate:production`, `pnpm run deploy` ni otros comandos que cambien D1 remota como parte de esta reconciliación local. Cualquier operación remota requiere revisión y autorización explícita separadas.

### Estado de la incidencia

- [ ] Migraciones locales aplicadas o causa alternativa identificada.
- [ ] `pnpm run db:verify:schema:local` pasa después de la reconciliación.
- [ ] Se registra evidencia del resultado y del commit.
- [ ] No se ha alterado el esquema remoto como parte de esta comprobación.

## 4. Papelera y limpieza

El borrado lógico y la restauración forman parte del catálogo. La limpieza permanente de metadatos y objetos físicos requiere una política explícita de retención, idempotencia y tratamiento de fallos. La limpieza de objetos R2 depende del adaptador de la Fase 4; no se debe marcar como implementada en el catálogo mientras no exista un caso de uso integrado y probado.

- [ ] Definir política de retención y condiciones de borrado permanente.
- [ ] Definir si la limpieza será síncrona o asíncrona y cómo se reintenta sin borrar recursos de otro propietario.
- [ ] Documentar pruebas de idempotencia, fallos parciales y aislamiento.
- [ ] Asignar el trabajo de objetos físicos a la Fase 4, si corresponde.

## 5. Evidencia de checks

Evidencia comunicada el 2026-10-11:

- [x] `pnpm run check`: Prettier, guardia arquitectónica, TypeScript y suite de tests aprobados; 126/126 tests.
- [x] `pnpm run verify:architecture:all`: los verificadores ejecutados finalizaron correctamente, con notas explícitas de capacidades R2/gateway aún no implementadas.
- [ ] `pnpm run db:verify:schema:local`: **falló**; incidencia pendiente descrita arriba.
- [x] CI previamente reportado como satisfactorio: [GitHub Actions run 38114942365](https://github.com/programadorkevinsvega-sys/vega-drive/actions/runs/38114942365).

Las casillas indican evidencia reportada, no una afirmación de que estos comandos se hayan vuelto a ejecutar durante la edición de este documento.

## 6. Criterio para cerrar la Fase 3

La fase permanece abierta hasta que:

1. Se complete la cobertura de pruebas de aislamiento y movimientos/restauraciones indicada en la sección 2.
2. Se resuelva y registre la discrepancia de D1 local con una verificación estructural satisfactoria.
3. Se defina y documente el alcance de limpieza permanente, separando metadatos de objetos R2.
4. Se actualicen los checks del roadmap únicamente cuando exista evidencia.
5. Se vuelvan a ejecutar los checks locales y CI sobre el commit candidato.

El cierre de esta fase no certifica las transferencias R2, la integración HTTP/BFF ni la certificación global de seguridad.
