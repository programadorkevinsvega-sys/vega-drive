# Reglas estrictas de arquitectura — perfil Vega Drive

Este documento no define una arquitectura paralela. El contrato canónico es [ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md](./ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md).

## Perfil obligatorio de este proyecto

Vega Drive usa un monolito modular serverless, no microservicios:

- Un solo repositorio, código desplegable y Cloudflare Worker.
- Frontend y backend independientes por capas, servidos desde el mismo Worker y origen.
- Una sola D1: VEGA_DRIVE_DB.
- Módulos internos con API pública tipada en proceso; no se obligan Service Bindings mientras sigan dentro del Worker.
- Cada módulo es dueño de sus tablas con prefijo, repositorios, dominio y casos de uso, aunque todos usen la misma D1.
- No hay imports internos, SQL ni JOINs entre módulos.
- Solo file-storage accede a R2 por IFileStoragePort.
- El frontend usa solo /api; no tiene lógica de negocio ni acceso, URL, SDK o configuración de R2.
- La futura extracción de un módulo preservará su API pública y sustituirá la llamada en proceso por Service Bindings; las Queues y bases separadas se adoptan solo al extraerlo.

Cualquier regla genérica que contradiga estas decisiones queda reemplazada por el contrato canónico de Vega Drive. Security.md continúa siendo obligatorio y prevalece la regla más restrictiva de seguridad.
