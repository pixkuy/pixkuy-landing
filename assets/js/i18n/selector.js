/* i18n — Language Selector (Pro + Legacy)
 * Ruta: assets/js/i18n/selector.js
 * Origen: extraído sin cambios funcionales desde assets/js/i18n.js
 * Responsabilidad única:
 * - Overlay + scroll lock
 * - Selector pro (trigger + menu)
 * - Compat selector legacy ([data-lang])
 * Exposición:
 * - initLangSelector(applyLangFn)
 * - updateLangUI(activeLang)
 */

(function () {
  "use strict";

  // Namespace interno i18n
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  // --- Lang selector overlay (premium UX) ---

  var LANG_OVERLAY_ID = "lang-overlay";

  function getOrCreateLangOverlay() {
    var existing = document.getElementById(LANG_OVERLAY_ID);
    if (existing) return existing;

    var overlay = document.createElement("div");
    overlay.id = LANG_OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");

    // Inline styles para NO depender de CSS (evita otro fichero)
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.webkitBackdropFilter = "blur(2px)";
    overlay.style.zIndex = "19"; // justo por debajo de .lang (que va a 20)
    overlay.style.display = "none";

    document.body.appendChild(overlay);
    return overlay;
  }

  function setLangOverlayVisible(visible) {
    var overlay = getOrCreateLangOverlay();
    overlay.style.display = visible ? "block" : "none";

    // Bloqueo scroll del body (sin clase CSS adicional)
    document.body.style.overflow = visible ? "hidden" : "";
  }

  /**
   * Selector de idioma “pro”.
   * - Si existe estructura nueva (trigger + menu vacío), se renderiza dinámicamente.
   * - Si no existe, se mantiene compat con botones legacy (3 botones data-lang).
   */
  function getLangDom() {
    var nav = document.querySelector(".lang");
    if (!nav) return null;

    var trigger = document.getElementById("lang-trigger");
    var current = nav.querySelector(".lang-current");
    var menu = nav.querySelector(".lang-menu");

    var isPro = !!(trigger && current && menu);

    var legacyButtons = Array.prototype.slice.call(nav.querySelectorAll("[data-lang]"));

    return {
      nav: nav,
      isPro: isPro,
      trigger: trigger,
      current: current,
      menu: menu,
      legacyButtons: legacyButtons
    };
  }

  function buildMenuItems(langDom) {
    if (!langDom || !langDom.isPro) return;

    var allowed = [];
    for (var i = 0; i < (root.SUPPORTED_LANGS || []).length; i++) {
      var l = root.SUPPORTED_LANGS[i];
      if (l && l.code) allowed.push(l.code);
    }

    langDom.menu.innerHTML = "";

    for (var j = 0; j < allowed.length; j++) {
      var code = allowed[j];
      var meta =
        (root.LANGUAGE_CATALOG && root.LANGUAGE_CATALOG[code]) || {
          short: String(code).toUpperCase(),
          label: String(code)
        };

      var li = document.createElement("li");
      li.setAttribute("role", "none");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "menuitemradio");
      btn.setAttribute("data-lang", code);
      btn.setAttribute("aria-checked", "false");
      btn.textContent = meta.label;

      li.appendChild(btn);
      langDom.menu.appendChild(li);
    }
  }

  function setMenuOpen(langDom, open) {
    if (!langDom || !langDom.isPro) return;

    langDom.trigger.setAttribute("aria-expanded", open ? "true" : "false");
    langDom.menu.hidden = !open;

    // Overlay + scroll lock solo si está abierto
    setLangOverlayVisible(open);
  }

  function updateLangUI(activeLang) {
    var langDom = getLangDom();
    if (!langDom) return;

    // A11y base
    langDom.nav.setAttribute("role", "group");
    langDom.nav.setAttribute("aria-label", "Language selector");

    // Pro selector
    if (langDom.isPro) {
      var meta =
        (root.LANGUAGE_CATALOG && root.LANGUAGE_CATALOG[activeLang]) || {
          short: String(activeLang).toUpperCase(),
          label: String(activeLang)
        };

      // Rellena etiqueta visible (no literal en HTML)
      langDom.current.textContent = meta.short;

      // Marca items
      langDom.menu.querySelectorAll("[data-lang]").forEach(function (b) {
        var isActive = b.getAttribute("data-lang") === activeLang;
        b.setAttribute("aria-checked", isActive ? "true" : "false");
      });

      // Cierra si estaba abierto al aplicar idioma
      setMenuOpen(langDom, false);
      return;
    }

    // Legacy selector (botones directos)
    langDom.legacyButtons.forEach(function (b) {
      var isActive = b && b.dataset && b.dataset.lang === activeLang;
      b.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function initLangSelector(applyLangFn) {
    var langDom = getLangDom();
    if (!langDom) return;

    // Si hay pro-structure, construimos items si aún no están
    if (langDom.isPro) {
      buildMenuItems(langDom);

      // Asegura overlay y click-to-close
      var overlay = getOrCreateLangOverlay();
      overlay.addEventListener("click", function () {
        setMenuOpen(langDom, false);
        langDom.trigger.focus();
      });

      // Toggle open/close
      langDom.trigger.addEventListener("click", function () {
        var open = langDom.trigger.getAttribute("aria-expanded") === "true";
        setMenuOpen(langDom, !open);

        if (!open) {
          var first = langDom.menu.querySelector("[data-lang]");
          if (first) first.focus();
        }
      });

      // Click fuera para cerrar (por seguridad adicional)
      document.addEventListener("click", function (e) {
        var open = langDom.trigger.getAttribute("aria-expanded") === "true";
        if (!open) return;

        if (!langDom.nav.contains(e.target) && e.target !== overlay) {
          setMenuOpen(langDom, false);
        }
      });

      // Escape para cerrar
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          var open = langDom.trigger.getAttribute("aria-expanded") === "true";
          if (open) {
            setMenuOpen(langDom, false);
            langDom.trigger.focus();
          }
        }
      });

      // Delegación click items
      langDom.menu.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("[data-lang]") : null;
        if (!btn) return;
        var code = btn.getAttribute("data-lang");
        if (typeof applyLangFn === "function") applyLangFn(code);
      });

      // Navegación teclado básica en menú
      langDom.menu.addEventListener("keydown", function (e) {
        var items = Array.prototype.slice.call(langDom.menu.querySelectorAll("[data-lang]"));
        if (!items.length) return;

        var idx = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          items[(idx + 1 + items.length) % items.length].focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length].focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          items[0].focus();
        } else if (e.key === "End") {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (e.key === "Enter" || e.key === " ") {
          // Space/Enter selecciona
          e.preventDefault();
          var el = document.activeElement;
          if (el && el.getAttribute && el.getAttribute("data-lang")) {
            if (typeof applyLangFn === "function") applyLangFn(el.getAttribute("data-lang"));
          }
        }
      });

      return;
    }

    // Legacy: click directo
    langDom.legacyButtons.forEach(function (b) {
      b.onclick = function () {
        if (typeof applyLangFn === "function") applyLangFn(b.dataset.lang);
      };
    });
  }

  root.getOrCreateLangOverlay = getOrCreateLangOverlay;
  root.setLangOverlayVisible = setLangOverlayVisible;
  root.getLangDom = getLangDom;
  root.buildMenuItems = buildMenuItems;
  root.setMenuOpen = setMenuOpen;
  root.updateLangUI = updateLangUI;
  root.initLangSelector = initLangSelector;
})();
