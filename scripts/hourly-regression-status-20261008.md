# Regresiones Hourly conservadas — 08/10/2026

`hourly-correction-regression.cjs` y `hourly-integrated-regression.js` proceden
de SPEC-20261003-213150-3DE84785. Se conservan como soporte versionado, sin alterar
aserciones ni equiparar sus versiones históricas con los recorridos aceptados.

Ejecución actual de `node scripts/hourly-correction-regression.cjs`:
**9 PASS / 15 FAIL**, con dobles de DOM y extracción de funciones reales.
Los dobles no implementan `hourlyEdit`, `getAttribute` o `style.removeProperty`,
y la aserción estática de scroll corresponde al diseño anterior. Hace falta
adaptar exclusivamente esas fronteras al DOM/CSS vigente antes de volver a usar
esta colección como gate. No se modifica producto para satisfacer expectativas
obsoletas ni se declara que estos fallos acrediten un defecto funcional actual.

`hourly-integrated-regression.js` no se repitió: requiere el runner habitual,
modo explícito `PIXKUY_HOURLY_BROWSER_FIXTURES=1` y fronteras controladas.
Sus escenarios iniciales deben contrastarse con las correcciones posteriores
antes de considerarlo un gate completo del recorrido actual. No debe iniciar
otro servidor ni acceder a API o proveedores reales.

Las pruebas posteriores de navegación, edición, vencimiento y Confirmada están
en los expedientes del workspace, especialmente HOURLY-EXPIRY-GUARD-20261006,
HOURLY-RELOAD-CTA-20261005 y AIRPORT-INTEGRATED-20261007. La aceptación declarada
de las diez secuencias iPhone es evidencia separada; no se repite ni se sustituye
por estos dobles. La integración SQL de Hourly continúa NO EJECUTADA.

En esta consolidación: sintaxis y JSON de los archivos seleccionados PASS;
ESLint dirigido PASS con tres warnings de variables sin uso. Los resultados y
hashes están en `D:/Pixkuy web/evidence/local-commits-20261008/`.
