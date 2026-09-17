/* i18n — DOM Application
 * Ruta: assets/js/i18n/dom.js
 * Origen: extraído sin cambios funcionales desde assets/js/i18n.js
 * Responsabilidad única:
 * - getValue()
 * - aplicar traducciones a [data-i18n] y [data-i18n-ph]
 */

(function () {
  "use strict";

  // Namespace interno i18n
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  function getValue(dict, path) {
    var parts = path.split(".");
    var v = dict;
    for (var i = 0; i < parts.length; i++) {
      var k = parts[i];
      v = v && v[k];
    }
    return v;
  }

  function applyI18nToDom(finalDict, finalLang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.dataset.i18n;
      var v = getValue(finalDict, key);

      if (typeof v === "string") {
        // Contrato actual: se permite HTML en strings i18n.
        // Evita escrituras DOM innecesarias en cambios de idioma, especialmente en móvil.
        if (el.innerHTML !== v) {
          el.innerHTML = v;
        }
        return;
      }

      if (root.isDevHost && root.isDevHost()) {
        if (v === undefined) {
          console.warn("[i18n] Missing key", { lang: finalLang, key: key, el: el });
        } else {
          console.warn("[i18n] Non-string value for key", {
            lang: finalLang,
            key: key,
            valueType: typeof v,
            el: el
          });
        }
      }
    });

    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var key = el.dataset.i18nPh;
      var v = getValue(finalDict, key);

      if (typeof v === "string") {
        if (el.placeholder !== v) {
          el.placeholder = v;
        }
        return;
      }

      if (root.isDevHost && root.isDevHost()) {
        if (v === undefined) {
          console.warn("[i18n] Missing placeholder key", { lang: finalLang, key: key, el: el });
        } else {
          console.warn("[i18n] Non-string placeholder value for key", {
            lang: finalLang,
            key: key,
            valueType: typeof v,
            el: el
          });
        }
      }
    });
  }

  root.getValue = getValue;
  root.applyI18nToDom = applyI18nToDom;
})();
