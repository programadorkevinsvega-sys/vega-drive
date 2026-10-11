# Diseño post-roadmap: transferencias directas con R2 y API S3

> **ESTADO: DOCUMENTO DE DISEÑO; NO IMPLEMENTAR TODAVÍA.**
>
> Este documento define una evolución futura para Vega Drive. **No agrega una fase activa ni autoriza cambios de código, configuración de Cloudflare o producción mientras quede pendiente cualquier fase del roadmap principal.** La implementación solo podrá comenzar cuando las fases 0 a 10 de `roadmap.md` estén cerradas con sus criterios de aceptación y evidencias, y se haya aprobado un ADR que reconcilie las reglas arquitectónicas y de seguridad afectadas.

## 1. Objetivo

Evitar que el Worker de Vega Drive reciba y retransmita cada byte de las transferencias cuando Cloudflare R2 pueda servir o recibir el objeto directamente.

La solución debe beneficiar a **ambos productos**:

1. **La aplicación Vega Drive:** subidas, descargas, visualización/preview y descargas de archivos compartidos cuando la política lo permita.
2. **La futura API compatible con S3:** aplicaciones, sitios web, servicios y backends externos que almacenen y recuperen objetos mediante Vega Drive.

El Worker seguirá siendo el plano de control: autenticación, autorización, propiedad, cuotas, metadatos, creación de permisos temporales, auditoría y coordinación. R2 será el plano de datos para las transferencias directas.

Objetivo arquitectónico:

- **Control plane:** cliente → Worker/BFF → casos de uso y gateways → D1/R2 según la operación.
- **Data plane:** navegador o cliente compatible → endpoint de objeto autorizado de R2.
- El Worker no debe leer el cuerpo completo de una descarga para luego retransmitirlo, ni actuar como proxy del cuerpo de una subida, salvo una excepción documentada y necesaria.

## 2. Puerta de entrada obligatoria: completar todo el roadmap

Antes de iniciar cualquier implementación, comprobar y registrar que:

- [ ] Todas las fases 0–10 de `roadmap.md` están cerradas y cada criterio de aceptación tiene evidencia reproducible.
- [ ] La Fase 4 tiene transferencia real validada en el Worker desplegado y configuración de privacidad/permisos de R2 verificada.
- [ ] Las Fases 5–9 están cerradas, incluida integración de la app, cuotas, compartición, certificación de seguridad, staging y rollback ensayado.
- [ ] La Fase 10 está cerrada conforme a su alcance acordado; cualquier mejora opcional que se haya descartado está documentada explícitamente, no marcada como realizada.
- [ ] El estado real de README, `roadmap.md`, `Security.md`, `Rollback.md` y este diseño es coherente.
- [ ] Existe una decisión arquitectónica aprobada (ADR) que autoriza excepciones o cambios a las reglas actuales que prohíben URLs firmadas y acceso directo del navegador a R2.
- [ ] Se define una estrategia de despliegue gradual, métricas, reversión y compatibilidad de clientes.
- [ ] Se ejecutan los gates del repositorio y las pruebas pertinentes en staging antes de habilitar la función en producción.

**No se debe adelantar esta tarea para desbloquear una fase anterior.** Hasta cumplir todas las condiciones, el flujo actual por `/api` y el Worker permanece como comportamiento de referencia.

## 3. Modelo combinado de entrega

### 3.1 Objetos públicos: dominio personalizado y CDN

Para objetos que el propietario marque explícitamente como públicos:

1. El usuario carga el objeto a través del flujo de subida autorizado.
2. Vega Drive registra su política de visibilidad y conserva el control de metadatos.
3. R2 sirve el objeto a través de un dominio personalizado, por ejemplo `assets.example.com`, conectado al bucket correspondiente.
4. Cloudflare puede almacenar en caché las respuestas según la política de caché configurada.

Requisitos:

- La visibilidad pública debe ser una decisión explícita y autorizada; nunca convertir archivos privados en públicos por defecto.
- Separar los objetos públicos de los privados por una política de almacenamiento inequívoca. Preferir buckets separados si eso simplifica la garantía de que un objeto privado no pueda quedar expuesto por una regla de dominio o caché.
- No exponer el bucket privado actual ni habilitar `r2.dev` como atajo.
- Definir `Content-Type`, `Content-Disposition`, `Cache-Control`, validación de tipos y tratamiento de nombres.
- Establecer estrategia de invalidación/versión de caché al reemplazar o retirar objetos.
- Evitar almacenar en caché respuestas privadas, cookies, tokens o metadatos autenticados.
- Probar que cambiar un objeto de público a privado evita su exposición en origen y caché. La estrategia debe contemplar purga, URL versionada o expiración de caché.

El dominio público no se debe usar para objetos privados ni tratarse como una forma de autorización.

### 3.2 Objetos privados: URL firmada y temporal

Para archivos privados de Vega Drive:

1. El cliente solicita una descarga o subida usando las rutas autenticadas de Vega Drive.
2. El Worker resuelve la sesión y el actor desde el servidor.
3. El caso de uso valida propiedad/permisos, estado del objeto, cuota y límites de uso.
4. Vega Drive genera una URL firmada de vida corta para la operación concreta sobre una clave de objeto ya validada.
5. El cliente transfiere los bytes directamente con R2.
6. Para subidas, el cliente confirma la operación a Vega Drive; el servidor verifica el objeto real y completa los metadatos/reserva de cuota.

Reglas de seguridad:

- Una URL firmada es una credencial temporal de tipo bearer: quien la tenga puede usarla hasta que expire o deje de ser válida.
- Firmar únicamente una clave exacta y un método HTTP específico; no aceptar claves R2 arbitrarias del cliente.
- Establecer una expiración corta y configurable por tipo de operación. No registrar la URL completa, firma, query string ni tokens en logs, analítica o errores.
- Las URL firmadas privadas de R2 se usan con el endpoint S3 de R2. **No asumir que funcionarán en el dominio personalizado público:** las URL firmadas de R2 no son intercambiables con el dominio personalizado.
- No incluir credenciales de R2/S3 en el navegador ni en el frontend compilado.
- No habilitar CORS abierto. Si la transferencia desde navegador requiere CORS, permitir únicamente los orígenes de la app autorizados y los métodos/headers mínimos necesarios, y probar preflight y solicitudes reales.
- La expiración limita la ventana de exposición, pero no es revocación instantánea. La revocación de un archivo o enlace debe impedir nuevas firmas; las URL ya emitidas solo deben tener una ventana residual muy corta y documentada.
- No considerar una URL firmada como sustituto de autorización previa, cuotas, auditoría ni aislamiento entre propietarios.

### 3.3 Subidas directas desde Vega Drive

Flujo propuesto:

1. El navegador solicita `POST /api/files/uploads/init` (nombre ilustrativo; definir la ruta final durante el ADR).
2. El Worker autentica y valida nombre, carpeta, tamaño máximo, tipo permitido, cuota, rate limit y permisos.
3. El módulo `files` reserva cuota/estado de carga de forma atómica y genera la clave de objeto en el servidor.
4. Devuelve un permiso temporal para subir ese objeto, limitado a método, clave, expiración y headers requeridos.
5. El navegador sube los bytes directamente a R2.
6. El navegador llama al endpoint de confirmación autenticado.
7. El Worker comprueba el objeto real mediante HEAD y/o validación adicional, verifica tamaño y metadatos esperados y finaliza la operación.
8. Si falla o expira, el sistema libera la reserva y limpia objetos huérfanos mediante un proceso idempotente.

No confiar en el tamaño, checksum, tipo ni resultado declarado por el cliente sin validación de servidor. El sistema debe soportar reintentos, solicitudes duplicadas, expiración y concurrencia sin duplicar cuota ni metadatos.

Para objetos grandes o cargas reanudables, decidir explícitamente el soporte de multipart, expiración de partes incompletas, abortado y limpieza. No asumir que una única URL PUT resuelve todos los tamaños.

### 3.4 Descargas, previews y rangos

Flujo propuesto para archivos privados:

1. El navegador solicita una URL de descarga a Vega Drive.
2. El Worker valida sesión, propiedad, estado del archivo, permiso de preview/descarga y cuota/límites.
3. Vega Drive devuelve una URL firmada de corta duración para el objeto exacto.
4. El navegador solicita el objeto directamente a R2; los bytes no pasan por el Worker.

Aplicar políticas diferentes cuando corresponda:

- **Descargar:** nombre seguro y `Content-Disposition: attachment`.
- **Preview:** permitir solo tipos aprobados, con headers seguros; evitar ejecutar contenido activo no confiable en el origen de la app.
- **Range requests:** comprobar que el endpoint de objeto y el cliente soporten rangos y reanudación; probar `206`, `Content-Range` y rangos inválidos. No afirmar que el comportamiento de `/api/files/:id/download` se conserva automáticamente al cambiar de endpoint.
- **Compartición:** validar el token de compartir, su alcance, expiración y revocación antes de emitir una firma. Reducir al mínimo la vigencia de la URL y documentar que una firma ya emitida no necesariamente puede revocarse de inmediato.

Si una función de preview, transformación, escaneo o política exige que los bytes pasen por un servicio, la excepción debe estar documentada; no convertir esa excepción en el camino predeterminado de todas las descargas.

### 3.5 Eliminación y otras operaciones de control

Mover a papelera, restaurar, renombrar, mover, cambiar visibilidad, administrar permisos, consultar cuotas y eliminar metadatos continúan pasando por el Worker y los casos de uso. No son transferencias de bytes y no deben implementarse como llamadas directas del navegador a R2.

Para borrar objetos, respetar el orden y la estrategia de consistencia definida por el módulo `files`, registrar fallos y permitir reconciliación. Nunca permitir que una clave proporcionada por el cliente se use como autoridad para borrar objetos.

## 4. Requisito especial para la API compatible con S3

La compatibilidad S3 y el requisito de no retransmitir bytes deben diseñarse juntos, no como dos proyectos independientes.

### 4.1 Separar control y transferencia de objetos

La futura API debe resolver autenticación de credenciales de desarrollador, autorización por tenant/espacio, cuotas, nombres de bucket/objeto, metadatos, auditoría y límites. Sin embargo, un endpoint S3 convencional normalmente espera que el cuerpo de GET/PUT se entregue en la propia respuesta/solicitud S3.

**No se debe prometer compatibilidad completa con S3 y a la vez afirmar que ninguna operación de objeto atravesará el Worker sin definir cómo se resuelve esa diferencia.** Un proxy S3 implementado en el Worker que responda cuerpos GET o consuma cuerpos PUT sí transferiría esos bytes a través del Worker.

Antes de implementar, el ADR debe comparar y probar estas alternativas:

1. **Endpoint S3 nativo de R2 con credenciales adecuadamente aisladas:** los clientes usan el endpoint S3 de R2 directamente. Solo se acepta si Cloudflare permite una delimitación de credenciales suficiente para el modelo multiusuario de Vega Drive, sin exponer credenciales de servicio compartidas ni permitir acceso cruzado.
2. **API de control Vega Drive + URLs de transferencia directas:** el Worker autentica y autoriza; la app o un SDK de Vega Drive obtiene URLs de subida/descarga y transfiere bytes a R2. Es eficiente, pero no equivale automáticamente a que cualquier cliente S3 funcione sin cambios.
3. **Endpoint S3 de compatibilidad con proxy:** mantiene el flujo HTTP S3 habitual pero el Worker transmite bytes. Solo puede aceptarse para operaciones o clientes que lo requieran y debe identificarse claramente como excepción al objetivo de transferencia directa.

Evaluar redirecciones a URLs firmadas solo con pruebas reales de los clientes S3 elegidos: algunos SDKs pueden no seguirlas o pueden manejar firmas, headers y métodos de manera diferente. No declarar compatibilidad general basándose únicamente en una prueba de GET sencilla.

### 4.2 Matriz de compatibilidad

Antes de anunciar compatibilidad, decidir y probar al menos:

- Autenticación y firma SigV4.
- Operaciones de bucket y objeto que se soportarán.
- GET, HEAD, PUT, DELETE y listado.
- Metadatos y headers de contenido.
- Descargas parciales y rangos.
- Cargas multipart, reintentos, abortado y limpieza.
- Límites de tamaño, cuotas, rate limits y errores compatibles.
- Aislamiento entre usuarios/tenants y espacios de nombres.
- Herramientas/SDKs de referencia y versiones probadas.
- Operaciones S3 no soportadas y errores documentados.

No anunciar “100 % compatible con S3” sin una matriz de conformidad y pruebas de los clientes acordados.

### 4.3 Credenciales y aislamiento

- Las claves API de Vega Drive son distintas de los secretos de R2.
- Mostrar el secreto de una clave de desarrollador solo en el momento de creación; almacenar un hash cuando el diseño criptográfico lo permita y ofrecer rotación/revocación.
- Cada clave se vincula a una identidad, tenant/espacio, permisos y límites explícitos.
- No aceptar un `ownerId`, tenant o prefijo de objeto como autoridad suministrada por el cliente.
- Nunca compartir con un cliente credenciales de R2 que le permitan leer o modificar objetos de otros usuarios.
- Antes de seleccionar acceso S3 directo, verificar de forma documentada el alcance real de las credenciales que ofrece Cloudflare R2. Si el aislamiento requerido no es posible con la granularidad disponible, no usar ese método para el modelo multiusuario.

## 5. Arquitectura y límites modulares

Conservar el monolito modular y las fronteras existentes:

- `identity`: identidad y sesión de la app.
- `files`: propiedad de los objetos, políticas de visibilidad, claves internas y puerto `IFileStoragePort`.
- `quota`: reservas y contabilización de capacidad/operaciones.
- `sharing`: enlaces, permisos, expiración y revocación.
- módulo/API de desarrolladores/S3: credenciales, scopes y traducción del protocolo; se debe definir su módulo dueño antes de codificar.
- BFF/Worker: adaptador HTTP y orquestación; no contiene reglas de negocio ni lógica de almacenamiento de infraestructura.

R2 seguirá accesible solo a través de adaptadores de infraestructura autorizados y contratos públicos. No introducir SQL, JOINs, claves foráneas o imports internos entre módulos. El frontend no incluirá SDK, endpoint, bucket ni credenciales internas de R2.

Como la arquitectura vigente prohíbe URLs firmadas y acceso directo desde el navegador, **esta propuesta necesita un ADR aprobado y la actualización coordinada de los documentos canónicos antes de escribir código**. No modificar esas reglas silenciosamente ni tratarlas como derogadas por este archivo.

## 6. Seguridad, cuotas y abuso

La implementación futura debe contemplar:

- Verificación de sesión/credencial y autorización por cada operación de control.
- Aislamiento entre propietarios y tenants probado contra IDOR/BOLA.
- Reservas atómicas de cuota antes de emitir permisos de subida; reconciliación del tamaño real después.
- Límites por usuario/clave/IP, tamaño, concurrencia y número de operaciones.
- URLs firmadas con expiración mínima, método y objeto restringidos.
- No registrar firmas, query strings sensibles, secretos, cookies ni cuerpos de archivo.
- Headers de contenido seguros, prevención de MIME sniffing y política de preview.
- CORS limitado a orígenes exactos y solo donde sea necesario.
- Política de caché diferenciada entre objetos públicos e información privada.
- Limpieza idempotente de cargas incompletas y objetos huérfanos.
- Rotación/revocación de claves de desarrollador y respuesta a incidentes.
- Pruebas de concurrencia, repetición, expiración, permisos revocados y límites.
- Revisión de costos: almacenamiento, operaciones R2, invocaciones Worker, operaciones auxiliares y otros servicios. La transferencia de salida de R2 puede no tener cargo de egress, pero eso no significa que toda la arquitectura sea gratuita.

## 7. Observabilidad y costos

Registrar métricas agregadas sin datos sensibles:

- bytes subidos/descargados por método de transferencia;
- porcentaje de transferencias directas frente a fallback por Worker;
- errores de firma, expiración, CORS y confirmación;
- reservas, cargas incompletas y objetos huérfanos;
- operaciones R2 y consumo de cuotas;
- latencia del plano de control y resultado de las pruebas de disponibilidad.

No guardar URLs firmadas ni identificadores secretos en logs. Definir alertas para fallos de confirmación, anomalías de costos, errores de autorización y aumento inesperado del tráfico por el Worker.

El objetivo de la métrica de bytes es demostrar que las transferencias habituales ya no atraviesan el Worker, no simplemente que se generan URLs firmadas.

## 8. Plan de entrega futuro

Solo después de cumplir la puerta de entrada de la sección 2:

1. **ADR y contrato:** decidir el modelo de público/privado, endpoint S3, aislamiento de credenciales, CORS, caché y excepciones de proxy.
2. **Infraestructura aislada:** configurar dominios/buckets/credenciales y políticas en staging, sin exponer el bucket privado actual.
3. **API de permisos temporales:** implementar casos de uso y contratos públicos para iniciar/confirmar subida y autorizar descarga.
4. **App Vega Drive:** adaptar subidas, descargas, previews y compartición; conservar el fallback por Worker mientras dure la migración.
5. **API de desarrolladores/S3:** implementar scopes y matriz de compatibilidad; verificar que el modo elegido realmente evita retransmitir bytes en las operaciones anunciadas como directas.
6. **Migración gradual:** activar por feature flag y por entorno/usuario; no habilitar por defecto para todos los usuarios.
7. **Certificación:** ejecutar la matriz de pruebas, medir bytes, costos, permisos, cuotas y expiración; documentar excepciones.
8. **Activación y retiro de fallback:** retirar el proxy solo cuando las métricas y pruebas de producción demuestren que los flujos críticos funcionan. Mantener rollback compatible durante la ventana acordada.

Cada paso necesita cambios de código, pruebas, documentación y evidencia operativa. Este archivo por sí solo no autoriza ni realiza esos cambios.

## 9. Criterios de aceptación

La futura implementación solo se considerará completa cuando:

- [ ] Todas las fases 0–10 del roadmap principal se cerraron antes de empezar este trabajo.
- [ ] El ADR está aprobado y los documentos de arquitectura/seguridad/roadmap están actualizados.
- [ ] La app Vega Drive puede subir y descargar objetos privados sin retransmitir sus bytes por el Worker en el camino normal.
- [ ] Los objetos públicos se sirven por dominio personalizado/CDN sin exponer el bucket privado.
- [ ] Preview, rangos, archivos compartidos, expiración y revocación tienen pruebas específicas.
- [ ] Las cargas directas se confirman con validación server-side, cuota y limpieza idempotente.
- [ ] El aislamiento entre usuarios/tenants se prueba con intentos de acceso cruzado y concurrencia.
- [ ] La matriz de compatibilidad S3 documenta con precisión qué operaciones son compatibles y cuáles transmiten bytes por el Worker.
- [ ] Ninguna credencial compartida de R2 se expone a usuarios ni permite acceso cruzado.
- [ ] CORS, caché, headers, logs y secretos pasan revisión de seguridad.
- [ ] Las métricas demuestran la reducción esperada de bytes que atraviesan el Worker.
- [ ] Staging, despliegue gradual, observabilidad y rollback están probados y documentados.
- [ ] Los gates del repositorio y las pruebas E2E pertinentes pasan en el commit que se despliega.

## 10. Documentos canónicos que habrá que revisar

Cuando se cumpla la puerta de entrada, actualizar en una misma iniciativa y sin contradicciones:

- `roadmap.md`: registrar esta iniciativa post-roadmap sin marcarla como completada antes de tiempo.
- `ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md`: reemplazar las prohibiciones actuales de acceso directo/URLs firmadas solo mediante ADR aprobado y con límites explícitos.
- `Security.md`: añadir amenazas, pruebas y controles de URL firmada, CORS, caché, cargas directas y credenciales S3.
- `Rollback.md`: documentar feature flags, compatibilidad del flujo antiguo y reversión de configuración de dominios/transferencias.
- `README.md`: actualizar la descripción de los flujos únicamente después de su implementación y certificación real.

---

**Recordatorio final:** este documento es una especificación futura. No cambiar el flujo actual, no habilitar dominios públicos, no crear claves S3, no generar URLs firmadas y no desplegar esta arquitectura hasta cerrar todo el roadmap principal y aprobar el ADR correspondiente.
