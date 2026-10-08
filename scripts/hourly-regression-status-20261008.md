# Regresiones Hourly conservadas — 08/10/2026

## Reparación posterior autorizada — 08/10/2026

`node scripts/hourly-correction-regression.cjs`: **24 PASS, 0 FAIL, 0 omitidos**.
Se mantienen los 24 escenarios, ejecutando los módulos/declaraciones reales.
No se han cambiado producto, contratos de pago ni diseño.

Los dobles representan ahora `hourlyEdit`, atributos de campos, etiquetas del
formulario, `CSSStyleDeclaration`, foco, almacenamiento, propiedad Hourly y la
forma actual del recurso de traducción. El caso sin historial reutiliza el DOM
del fixture integrado, sin una segunda implementación de navegación.
Tras volver a Configuración, se entra por `openData()` antes de `review()`;
también se afirma que la llamada directa desde Configuración es rechazada.
Es la guarda instalada por HOURLY-EXPIRY-GUARD-20261006, no una expectativa
suavizada para pasar el test.

La aserción CSS se vincula al diseño aprobado: Datos/Revisión usan el scroll del
documento, altura automática y overflow visible, con cabecera conservada;
Configuración conserva su scroll limitado y safe areas. Se comprueba también la
ausencia del contenedor fijo anterior. El control único Volver conserva su
presentación común y se prueba su destino; no se exige la antigua clave de texto.
Referencias de implementación/aceptación en el workspace:

- `.pixkuy-agents/work/sdd-local-dashboard/specs/SPEC-20261003-213150-3DE84785/candidate-revisions/mobile-composition-20261004/iphone-acceptance-r1/RESULTADO.md`.
- El mismo expediente, `candidate-revisions/mobile-data-menu-20261005/RESULTADO.md`, y la continuación humana que acepta Datos/navegación y exige conservar el scroll del documento.
- `.pixkuy-agents/work/microphases/HOURLY-EXPIRY-TRANSPORT-20261006/ACEPTACION-USUARIO.md`: declaración de diez secuencias físicas aceptadas, distinta de estas comprobaciones.

Evidencia de reparación: `evidence/local-commits-20261008/repairs/hourly-final.tap`.
Los dobles DOM y la aserción CSS estática no acreditan layout de navegador ni una
nueva aceptación iPhone. No se ejecutó SQL ni se repitió la batería física.

## Registro anterior conservado

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
