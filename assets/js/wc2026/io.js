/* WC2026 — Visibility & IntersectionObserver
 * Ruta: assets/js/wc2026/io.js
 * Extraído sin cambios funcionales desde assets/js/wc2026.js
 * Responsabilidad única:
 * - isInitiallyVisibleForReveal
 * - initIntersectionObserver
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

  function isInitiallyVisibleForReveal(wc) {
    if (!wc) return false;
    if (!wc.sectionEl) return false;

    var rect;
    try {
      rect = wc.sectionEl.getBoundingClientRect();
    } catch (e) {
      return false;
    }

    if (!rect || !rect.height) return false;

    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vh) return false;

    // Visible portion in pixels
    var visiblePx = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    if (visiblePx <= 0) return false;

    var ratio = visiblePx / rect.height;

    // Match IO threshold intent (0.35)
    return ratio >= 0.35;
  }

  function initIntersectionObserver(wc) {
    if (!wc) return;

    var self = wc;

    // Must be inert when OFF
    if (typeof self.isEnabled === "function" && !self.isEnabled()) return;

    // No replay, no duplicate observers
    if (self.io) return;
    if (!self.sectionEl) return;

    // Observer per contract
    try {
      self.io = new IntersectionObserver(
        function (entries) {
          if (!entries || !entries.length) return;
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e && e.isIntersecting) {
              // Move WAITING → REVEALING, disconnect immediately
              try {
                self.io.disconnect();
              } catch (err) {}
              self.io = null;

              if (typeof self.beginReveal === "function") {
                self.beginReveal();
              }
              return;
            }
          }
        },
        {
          threshold: 0.35,
          rootMargin: "0px 0px -15% 0px"
        }
      );

      self.io.observe(self.sectionEl);
    } catch (e) {
      // If IO fails, degrade safely (premium static)
      var msg = "";
      try {
        msg = e && e.message ? String(e.message) : String(e);
      } catch (e2) {
        msg = "IO_EXCEPTION";
      }
      if (typeof self.forceDegraded === "function") {
        self.forceDegraded("IO_EXCEPTION:" + msg);
      }
    }
  }

  root.io = {
    isInitiallyVisibleForReveal: isInitiallyVisibleForReveal,
    initIntersectionObserver: initIntersectionObserver
  };
})();
