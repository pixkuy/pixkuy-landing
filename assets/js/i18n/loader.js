/* i18n — JSON Loader & Cache
 * Ruta: assets/js/i18n/loader.js
 * Responsabilidad única:
 * - I18N_JSON_BASE
 * - translationsCache
 * - isDevHost()
 * - fetchJson()
 * - deepMerge()
 * - loadTranslationsForLang()
 *
 * Evolución:
 * - Mantiene compatibilidad con el modelo legacy:
 *   /assets/i18n/<lang>.json
 * - Añade soporte para fragmentos opcionales por idioma:
 *   /assets/i18n/<lang>/<fragment>.json
 * - Devuelve siempre un único diccionario final fusionado.
 */

(function () {
  "use strict";

  // Namespace interno i18n
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  // IMPORTANTE: base absoluta para funcionar también en /legal/*
  var I18N_JSON_BASE = "/assets/i18n";

  // Cache por combinación idioma + fragmentos
  var translationsCache = new Map();

  // Registro centralizado de fragmentos opcionales por idioma.
  // Primera apertura: tours como nuevo dominio modular.
  var I18N_OPTIONAL_FRAGMENTS = {
    es: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "legal", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    en: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    ru: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    fr: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    pt: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    it: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    de: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    ko: ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"],
    "zh-hans": ["services-tours", "services-hourly", "services-events", "brand-collaborations", "consent", "in-motion", "in-motion-scroll-cinema", "in-motion-desktop-cinema", "contact-success", "mobile-booking-entry", "direct-transfer-mobile-booking-flow", "airport-mobile-booking-flow", "airport-mobile-contact-step"]
  };

  function isDevHost() {
    if (typeof location === "undefined") return false;
    return (
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname.endsWith(".test")
    );
  }

  async function fetchJson(url) {
    var fetchOptions = isDevHost() ? { cache: "no-store" } : { cache: "default" };
    var res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(target, source) {
    var out = isPlainObject(target) ? target : {};

    if (!isPlainObject(source)) {
      return out;
    }

    Object.keys(source).forEach(function (key) {
      var sourceValue = source[key];
      var targetValue = out[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        out[key] = deepMerge(targetValue, sourceValue);
        return;
      }

      if (isPlainObject(sourceValue)) {
        out[key] = deepMerge({}, sourceValue);
        return;
      }

      if (Array.isArray(sourceValue)) {
        out[key] = sourceValue.slice();
        return;
      }

      out[key] = sourceValue;
    });

    return out;
  }

  function cloneDict(dict) {
    if (!isPlainObject(dict)) return {};
    return deepMerge({}, dict);
  }

  function buildCacheKey(lang, fragments) {
    var safeLang = lang || "";
    var safeFragments = Array.isArray(fragments) ? fragments.slice() : [];
    return safeLang + "::" + safeFragments.join("|");
  }

  function getOptionalFragmentsForLang(lang) {
    var own = I18N_OPTIONAL_FRAGMENTS[lang];
    if (!Array.isArray(own)) return [];
    return own.slice();
  }

  async function tryLoadOptionalFragment(lang, fragmentName) {
    if (!lang || !fragmentName) return null;

    var url =
      I18N_JSON_BASE +
      "/" +
      encodeURIComponent(lang) +
      "/" +
      encodeURIComponent(fragmentName) +
      ".json";

    try {
      return await fetchJson(url);
    } catch (err) {
      if (isDevHost()) {
        console.warn("[i18n] Optional fragment not available", {
          lang: lang,
          fragment: fragmentName,
          url: url,
          err: String(err && err.message ? err.message : err)
        });
      }
      return null;
    }
  }

  async function loadBaseTranslationsForLang(lang) {
    if (!lang) return null;

    var url = I18N_JSON_BASE + "/" + encodeURIComponent(lang) + ".json";

    try {
      return await fetchJson(url);
    } catch (err) {
      if (lang === "es") {
        if (isDevHost()) {
          console.warn("[i18n] ES JSON not available, using embedded ES fallback", {
            lang: lang,
            url: url,
            err: String(err && err.message ? err.message : err)
          });
        }
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

  async function loadTranslationsForLang(lang, fragments) {
    if (!lang) return null;

    var requestedFragments;
    if (Array.isArray(fragments)) {
      requestedFragments = fragments.slice();
    } else {
      requestedFragments = getOptionalFragmentsForLang(lang);
    }

    var cacheKey = buildCacheKey(lang, requestedFragments);
    if (translationsCache.has(cacheKey)) {
      return translationsCache.get(cacheKey);
    }

    var baseDict = await loadBaseTranslationsForLang(lang);
    if (!baseDict) {
      return null;
    }

    var finalDict = cloneDict(baseDict);

    var fragmentResults = await Promise.all(
      requestedFragments.map(function (fragmentName) {
        return tryLoadOptionalFragment(lang, fragmentName);
      })
    );

    for (var i = 0; i < fragmentResults.length; i++) {
      var fragmentDict = fragmentResults[i];

      if (fragmentDict) {
        finalDict = deepMerge(finalDict, fragmentDict);
      }
    }

    translationsCache.set(cacheKey, finalDict);
    return finalDict;
  }

  // Exposición pública
  root.I18N_JSON_BASE = I18N_JSON_BASE;
  root.I18N_OPTIONAL_FRAGMENTS = I18N_OPTIONAL_FRAGMENTS;
  root.translationsCache = translationsCache;
  root.isDevHost = isDevHost;
  root.fetchJson = fetchJson;
  root.deepMerge = deepMerge;
  root.loadTranslationsForLang = loadTranslationsForLang;
})();