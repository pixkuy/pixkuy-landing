/* assets/js/i18n.js */

/**
 * Entry point público i18n.
 * Objetivo de este refactor:
 * - Mantener comportamiento idéntico.
 * - Delegar en módulos cargados desde assets/js/i18n/*.
 * - No cambiar contrato de rutas (/assets/i18n) ni política de fallbacks/warnings.
 *
 * IMPORTANTE:
 * - Requiere que estos módulos estén cargados antes (ver index.html):
 *   - assets/js/i18n/fallback.es.js  -> root.FALLBACK_ES
 *   - assets/js/i18n/catalog.js      -> root.normalizeLangCode (+ catálogos)
 *   - assets/js/i18n/loader.js       -> root.loadTranslationsForLang (+ helpers)
 *   - assets/js/i18n/dom.js          -> root.applyI18nToDom
 *   - assets/js/i18n/selector.js     -> root.initLangSelector / root.updateLangUI
 */

(function () {
  "use strict";

  // Namespace interno i18n (módulos sin bundler)
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  // Dependencias obligatorias (fallo visible si el orden de scripts está mal)
  var normalizeLangCode = root.normalizeLangCode;

  var loadTranslationsForLang = root.loadTranslationsForLang;

  // IMPORTANTE: base absoluta para funcionar también en /legal/*
  var isDevHost = root.isDevHost;

  var applyI18nToDom = root.applyI18nToDom;

  var initLangSelector = root.initLangSelector;
  var updateLangUI = root.updateLangUI;

  // Mantiene estado de carrera (idéntico al original)
  var applySeq = 0;

  // -----------------------------
  // Detect Lang (se mantiene local)
  // -----------------------------

  function detectLang() {
    if (typeof location !== "undefined") {
      var params = new URLSearchParams(location.search);
      var fromUrlRaw = params.get("lang");
      var fromUrl = normalizeLangCode(fromUrlRaw);
      if (fromUrl) return fromUrl;
    }

    var savedRaw = localStorage.getItem("lang");
    var saved = normalizeLangCode(savedRaw);
    if (saved) return saved;

    var browserRaw = (navigator && navigator.language) || "es";
    var browser = normalizeLangCode(browserRaw);
    if (browser) return browser;

    return "es";
  }

  // -----------------------------
  // Apply Lang (orquestador)
  // -----------------------------

  async function applyLang(lang) {
    var seq = ++applySeq;

    var normalized = normalizeLangCode(lang) || "es";
    var dict = await loadTranslationsForLang(normalized);

    if (seq !== applySeq) return;

    if (!dict) {
      if (isDevHost && isDevHost()) {
        console.warn("[i18n] Falling back to ES because dict could not be loaded", {
          requested: normalized
        });
      }
      dict = await loadTranslationsForLang("es");
    }

    var finalLang = dict && normalized !== "es" ? normalized : "es";
    var finalDict = dict || root.FALLBACK_ES;

    document.documentElement.lang = finalLang;
    localStorage.setItem("lang", finalLang);
    window.__pixkuyI18nDict = finalDict;
    window.__pixkuyI18nLang = finalLang;

    applyI18nToDom(finalDict, finalLang);

    window.dispatchEvent(new CustomEvent("pixkuy:i18n-applied", {
      detail: {
        lang: finalLang
      }
    }));

    // Actualiza UI del selector (pro o legacy)
    updateLangUI(finalLang);
  }

  function applyLangFromSelector(lang) {
    var normalized = normalizeLangCode(lang) || "es";

    if (
      typeof location !== "undefined" &&
      typeof history !== "undefined" &&
      typeof history.replaceState === "function"
    ) {
      var url = new URL(location.href);
      url.searchParams.set("lang", normalized);
      history.replaceState(history.state, document.title, url.pathname + url.search + url.hash);
    }

    return applyLang(normalized);
  }

  // -----------------------------
  // Bootstrap
  // -----------------------------

  (async function bootstrapI18n() {
    // Inicializa selector (pro si existe, legacy si no)
    if (typeof initLangSelector === "function") {
      initLangSelector(applyLangFromSelector);
    }

    // Aplica idioma inicial (esto también setea UI)
    var lang = detectLang();
    await applyLang(lang);
  })();
})();
