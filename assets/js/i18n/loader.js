/* i18n — JSON Loader & Cache
 * Ruta: assets/js/i18n/loader.js
 * Origen: extraído sin cambios funcionales desde assets/js/i18n.js
 * Responsabilidad única:
 * - I18N_JSON_BASE
 * - translationsCache
 * - isDevHost()
 * - fetchJson()
 * - loadTranslationsForLang()
 */

(function () {
  "use strict";

  // Namespace interno i18n
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  // --- Loader JSON ---

  // IMPORTANTE: base absoluta para funcionar también en /legal/*
  var I18N_JSON_BASE = "/assets/i18n";

  var translationsCache = new Map();

  function isDevHost() {
    if (typeof location === "undefined") return false;
    return (
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname.endsWith(".test")
    );
  }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function loadTranslationsForLang(lang) {
    if (!lang) return null;

    if (translationsCache.has(lang)) {
      return translationsCache.get(lang);
    }

    var url = I18N_JSON_BASE + "/" + encodeURIComponent(lang) + ".json";

    try {
      var json = await fetchJson(url);
      translationsCache.set(lang, json);
      return json;
    } catch (err) {
      if (lang === "es") {
        if (isDevHost()) {
          console.warn("[i18n] ES JSON not available, using embedded ES fallback", {
            lang: lang,
            url: url,
            err: String(err && err.message ? err.message : err)
          });
        }
        translationsCache.set("es", root.FALLBACK_ES);
        return root.FALLBACK_ES;
      }

      if (isDevHost()) {
        console.warn("[i18n] JSON not available (no embedded fallback for this lang)", {
          lang: lang,
          url: url,
          err: String(err && err.message ? err.message : err)
        });
      }
      return null;
    }
  }

  // Exposición pública
  root.I18N_JSON_BASE = I18N_JSON_BASE;
  root.translationsCache = translationsCache;
  root.isDevHost = isDevHost;
  root.fetchJson = fetchJson;
  root.loadTranslationsForLang = loadTranslationsForLang;
})();
