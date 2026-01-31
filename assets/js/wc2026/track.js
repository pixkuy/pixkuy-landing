/* WC2026 — Tracking & Asset Error Bindings
 * Ruta: assets/js/wc2026/track.js
 * Extraído sin cambios funcionales desde assets/js/wc2026.js
 * Responsabilidad única:
 * - bindAssetError
 * - bindFirstClick
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
   * Bindea el listener de error de la imagen del estadio.
   * @param {Object} wc
   */
  function bindAssetError(wc) {
    if (!wc) return;
    if (!wc.stadiumImgEl) return;

    var self = wc;

    // If already bound, do nothing
    if (self.stadiumImgEl.__wc2026Bound) return;
    self.stadiumImgEl.__wc2026Bound = true;

    self.stadiumImgEl.addEventListener("error", function () {
      self.assetError = true;
      if (typeof self.forceDegraded === "function") {
        self.forceDegraded("ASSET_ERROR");
      }
    });
  }

  /**
   * Phase 6: first-click tracking + prefill store (only first click)
   * @param {Object} wc
   */
  function bindFirstClick(wc) {
    if (!wc) return;
    if (!wc.ctaEl) return;

    var self = wc;

    // Bind once per page load
    if (self.ctaEl.__wc2026ClickBound) return;
    self.ctaEl.__wc2026ClickBound = true;

    self.ctaEl.addEventListener(
      "click",
      function () {
        if (self.hasTrackedClick) return;

        // Idempotency across repeated clicks and even repeated navigations in same tab session
        try {
          var existing = sessionStorage.getItem("wc2026_prefill");
          if (existing) {
            self.hasTrackedClick = true;
            return;
          }
        } catch (e) {
          // ignore read errors; we still attempt set below
        }

        self.hasTrackedClick = true;

        try {
          var payload = {
            source: "wc2026",
            ts: Date.now(),
            deviceClass: self.deviceClass,
            axis: self.axis
          };
          sessionStorage.setItem("wc2026_prefill", JSON.stringify(payload));
        } catch (e2) {
          // no-op (storage unavailable)
        }
      },
      { passive: true }
    );
  }

  root.track = {
    bindAssetError: bindAssetError,
    bindFirstClick: bindFirstClick
  };
})();
