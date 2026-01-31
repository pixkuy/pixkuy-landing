/* WC2026 — DOM Wiring (locate + class helpers)
 * Ruta: assets/js/wc2026/dom.js
 * Extraído sin cambios funcionales desde assets/js/wc2026.js
 * Responsabilidad única:
 * - locateDom (refs)
 * - setClass
 * - applyAxisClasses
 * ES5+ compatible, sin dependencias externas
 */
(function () {
  "use strict";

  // Namespace compartido para módulos WC2026 (interno)
  var root = window.__pixkuyWC2026Modules;
  if (!root) {
    root = {};
    window.__pixkuyWC2026Modules = root;
  }

  /**
   * Encuentra el DOM y rellena refs en el objeto wc (mutación controlada).
   * Copia 1:1 de la lógica original.
   * @param {Object} wc - instancia WC2026 (objeto runtime)
   * @returns {boolean}
   */
  function locateDom(wc) {
    if (!wc) return false;

    // Prefer stable id if present; fallback to section selector
    var el = document.getElementById("wc2026");
    if (!el) {
      var list = document.querySelectorAll("section.wc2026");
      el = list && list[0] ? list[0] : null;
    }
    if (!el) return false;

    wc.sectionEl = el;

    // Stadium layer: used for transitionend and state classes
    wc.stadiumLayerEl = el.querySelector(".wc2026-stadium") || null;

    // Stadium img
    wc.stadiumImgEl = el.querySelector('img[data-wc2026-stadium="1"]') || null;

    // CTA (Phase 6: first-click tracking + prefill store)
    wc.ctaEl = el.querySelector('[data-wc2026-cta="1"]') || null;

    return true;
  }

  /**
   * Añade/quita clase en wc.sectionEl.
   * @param {Object} wc
   * @param {string} cls
   * @param {boolean} on
   */
  function setClass(wc, cls, on) {
    if (!wc || !wc.sectionEl) return;
    if (on) wc.sectionEl.classList.add(cls);
    else wc.sectionEl.classList.remove(cls);
  }

  /**
   * Aplica clases de eje según wc.axis ("x" | "y").
   * Copia 1:1 de la lógica original.
   * @param {Object} wc
   */
  function applyAxisClasses(wc) {
    if (!wc) return;

    // Clear both then apply chosen
    setClass(wc, "wc2026--axis-x", false);
    setClass(wc, "wc2026--axis-y", false);

    if (wc.axis === "y") setClass(wc, "wc2026--axis-y", true);
    else setClass(wc, "wc2026--axis-x", true);
  }

  root.dom = {
    locateDom: locateDom,
    setClass: setClass,
    applyAxisClasses: applyAxisClasses
  };
})();
