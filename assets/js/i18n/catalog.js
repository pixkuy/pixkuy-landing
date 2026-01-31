/* i18n — Language Catalog & Normalization
 * Ruta: assets/js/i18n/catalog.js
 * Origen: extraído sin cambios funcionales desde assets/js/i18n.js
 * Responsabilidad única:
 * - SUPPORTED_LANGS
 * - LANGUAGE_CATALOG
 * - LANG_ALIASES
 * - normalizeLangCode()
 */

(function () {
  "use strict";

  // Namespace interno i18n
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  // Lista de idiomas soportados por la landing (selector).
  // IMPORTANTE: mantener exactamente el mismo set y orden que en i18n.js
  root.SUPPORTED_LANGS = [
    { code: "es", label: "ES" },
    { code: "en", label: "EN" },
    { code: "ru", label: "RU" },
    { code: "fr", label: "FR" },
    { code: "pt", label: "PT" },
    { code: "it", label: "IT" },
    { code: "de", label: "DE" },
    { code: "ko", label: "KO" },
    { code: "zh-hans", label: "中文" }
  ];

  /*
   * Catálogo de etiquetas para UI.
   * - short: la abreviatura visible en el selector
   * - label: el nombre largo que se usa en el menú
   * NOTA: Los labels aquí son “nativos” (no se “traducen”).
   */
  root.LANGUAGE_CATALOG = {
    es: { short: "ES", label: "Español" },
    en: { short: "EN", label: "English" },
    ru: { short: "RU", label: "Русский" },
    fr: { short: "FR", label: "Français" },
    pt: { short: "PT", label: "Português" },
    it: { short: "IT", label: "Italiano" },
    de: { short: "DE", label: "Deutsch" },
    ko: { short: "KO", label: "한국어" },
    "zh-hans": { short: "中文", label: "中文（简体）" }
  };

  // Aliases de idiomas (navigator / querystring) → code soportado
  root.LANG_ALIASES = {
    // Chinese (simplified)
    "zh-hans": "zh-hans",
    "zh_hans": "zh-hans",
    "zh-hans-cn": "zh-hans",
    "zh_cn": "zh-hans",
    "zh-cn": "zh-hans",
    // Korean
    "ko-kr": "ko",
    // Portuguese (agrupado a pt para landing)
    "pt-br": "pt",
    "pt-pt": "pt",
    // English (agrupado a en)
    "en-us": "en",
    "en-gb": "en",
    "en-ca": "en",
    // Spanish (agrupado a es)
    "es-mx": "es",
    "es-es": "es",
    "es-co": "es",
    "es-ar": "es",
    // Russian
    "ru-ru": "ru",
    // French (agrupado a fr)
    "fr-fr": "fr",
    "fr-ca": "fr",
    // Italian / German (por completitud)
    "it-it": "it",
    "de-de": "de"
  };

  function normalizeLangCode(raw) {
    if (!raw || typeof raw !== "string") return null;

    var s = raw.trim().toLowerCase().replace(/_/g, "-");

    if (root.LANG_ALIASES[s]) return root.LANG_ALIASES[s];

    var base = s.split("-")[0];
    if (!base) return null;

    // Equivalente funcional a: SUPPORTED_LANGS.some((l) => l.code === base)
    var isSupported = false;
    for (var i = 0; i < root.SUPPORTED_LANGS.length; i++) {
      if (root.SUPPORTED_LANGS[i] && root.SUPPORTED_LANGS[i].code === base) {
        isSupported = true;
        break;
      }
    }
    if (isSupported) return base;

    return null;
  }

  root.normalizeLangCode = normalizeLangCode;
})();
