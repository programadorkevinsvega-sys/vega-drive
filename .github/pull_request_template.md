## Resumen

## Verificación

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run check`
- [ ] `pnpm audit --audit-level=high`
- [ ] CI completo aprobado para el merge ref del PR, incluido `Required checks`

## Seguridad y arquitectura

- [ ] Frontend usa el BFF same-origin para control/autorización; solo usa URLs prefirmadas temporales de R2 emitidas por el Worker cuando aplica ADR-001.
- [ ] No se incorporan credenciales, claves internas, URLs firmadas hardcodeadas ni URLs temporales persistidas.
- [ ] Controllers llaman gateways; no acceden a D1/R2 ni contienen lógica de negocio.
- [ ] Sin imports internos, SQL/JOIN/FK/batch entre módulos.
- [ ] Pruebas de aislamiento entre usuarios añadidas cuando aplique.
- [ ] Cabeceras y políticas de seguridad compatibles con assets, preview PDF y CSP.
- [ ] Revisé [Security.md: checklist de Pull Request](../Security.md).
- [ ] Documentación actualizada si cambia arquitectura, comportamiento, operación o estado de una fase.
