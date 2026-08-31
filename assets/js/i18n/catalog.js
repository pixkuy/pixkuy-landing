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

  var NEXT_AVAILABILITY_INTL_LOCALES = {
    es: "es-MX",
    en: "en-US",
    ru: "ru-RU",
    fr: "fr-FR",
    pt: "pt-PT",
    it: "it-IT",
    de: "de-DE",
    ko: "ko-KR",
    "zh-hans": "zh-CN"
  };

  var NEXT_AVAILABILITY_TIME_CONNECTORS = {
    es: " a las ",
    en: " at ",
    ru: " в ",
    fr: " à ",
    pt: " às ",
    it: " alle ",
    de: " um ",
    ko: " ",
    "zh-hans": " "
  };

  function parseLocalDateParts(value) {
    var match = typeof value === "string"
      ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
      : null;
    var year;
    var month;
    var day;
    var utcDate;

    if (!match) return null;

    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
    utcDate = new Date(Date.UTC(year, month - 1, day, 12));

    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return null;
    }

    return {
      year: year,
      month: month,
      day: day,
      key: year * 10000 + month * 100 + day,
      utcDate: utcDate
    };
  }

  function parseLocalDateTimeParts(value) {
    var normalized = typeof value === "string" ? value.trim() : "";
    var match = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );
    var dateParts = parseLocalDateParts(normalized);
    var hours;
    var minutes;

    if (!match || !dateParts) return null;

    hours = Number(match[4]);
    minutes = Number(match[5]);

    if (hours > 23 || minutes > 59) return null;

    return {
      date: dateParts,
      time: match[4] + ":" + match[5]
    };
  }

  function formatNextAvailabilityLabel(input) {
    var safeInput = input && typeof input === "object" ? input : {};
    var nextValue = typeof safeInput.nextAvailableStartLocal === "string"
      ? safeInput.nextAvailableStartLocal.trim()
      : "";
    var nextParts = parseLocalDateTimeParts(nextValue);
    var requestedParts = parseLocalDateParts(safeInput.requestedLocalDate);
    var lang = normalizeLangCode(safeInput.locale) || "es";
    var formattedDate;

    if (!nextValue) return "";
    if (!nextParts) return nextValue;

    if (!requestedParts || nextParts.date.key <= requestedParts.key) {
      return nextParts.time;
    }

    formattedDate = new Intl.DateTimeFormat(
      NEXT_AVAILABILITY_INTL_LOCALES[lang] || NEXT_AVAILABILITY_INTL_LOCALES.es,
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC"
      }
    ).format(nextParts.date.utcDate);

    return formattedDate +
      (NEXT_AVAILABILITY_TIME_CONNECTORS[lang] ||
        NEXT_AVAILABILITY_TIME_CONNECTORS.es) +
      nextParts.time;
  }

  root.normalizeLangCode = normalizeLangCode;
  root.formatNextAvailabilityLabel = formatNextAvailabilityLabel;
})();
