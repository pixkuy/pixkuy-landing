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

  function escapeHtml(s) {
    // Mantiene el contrato actual de usar innerHTML,
    // pero para el caso especial (eyebrow) evitamos inyección accidental.
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderWc2026EyebrowHtml(rawValue) {
    // Objetivo: 3 líneas centradas en el mismo eje:
    // 1) MÉXICO
    // 2) JUNIO–JULIO
    // 3) 2026
    //
    // Soporta input actual típico:
    // "MÉXICO\nJUNIO–JULIO 2026"
    // y también si ya viniera en 3 líneas.

    var lines = String(rawValue)
      .split("\n")
      .map(function (l) { return l.trim(); })
      .filter(Boolean);

    if (lines.length === 2) {
      // Intentar separar un año final de 4 dígitos en la 2ª línea
      var m = lines[1].match(/^(.*)\s(\d{4})\s*$/);
      if (m) {
        lines = [lines[0], m[1].trim(), m[2].trim()];
      }
    }

    // Si sigue sin ser 3 líneas, renderizamos lo que haya (robusto),
    // pero el diseño premium esperado se garantiza cuando el input incluye año final o 3 líneas.
    var html = lines
      .map(function (t) {
        return '<span class="wc2026-eyebrow-line">' + escapeHtml(t) + "</span>";
      })
      .join("");

    return html;
  }

  function applyI18nToDom(finalDict, finalLang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.dataset.i18n;
      var v = getValue(finalDict, key);

      if (typeof v === "string") {
        // Caso editorial especial: WC2026 eyebrow necesita control de líneas
        // para alinear MÉXICO y 2026 centrados sobre JUNIO–JULIO.
        if (key === "event.wc2026.eyebrow") {
          el.innerHTML = renderWc2026EyebrowHtml(v);
          return;
        }

        // Contrato actual: se permite HTML en strings i18n
        el.innerHTML = v;
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
        el.placeholder = v;
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
