## Resumen

## Verificación
- [ ] npm install
- [ ] npm run check
- [ ] npm audit --audit-level=high

## Seguridad y arquitectura
- [ ] Frontend solo consume /api del mismo origen; no accede a R2.
- [ ] No hay secretos, credenciales ni URLs prefirmadas.
- [ ] Controllers llaman gateways; no acceden a D1/R2 ni contienen negocio.
- [ ] Sin imports internos, SQL/JOIN/FK/batch entre módulos.
- [ ] Pruebas de aislamiento añadidas cuando aplique.
- [ ] Revisé Security.md#checklist-de-pull-request.
