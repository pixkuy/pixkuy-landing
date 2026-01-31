/* WC2026 — Reveal Orchestration (cleanup + reveal lifecycle)
 * Ruta: assets/js/wc2026/reveal.js
 * Extraído sin cambios funcionales desde assets/js/wc2026.js
 * Responsabilidad única:
 * - cleanup
 * - forceDegraded
 * - finalizeRevealed
 * - beginReveal
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

  function cleanup(wc) {
    if (!wc) return;

    // Disconnect observer
    if (wc.io) {
      try {
        wc.io.disconnect();
      } catch (e) {}
      wc.io = null;
    }

    // Remove listeners
    if (wc.onVisChange) {
      document.removeEventListener("visibilitychange", wc.onVisChange);
      wc.onVisChange = null;
    }

    if (wc.stadiumLayerEl && wc.onTransitionEnd) {
      wc.stadiumLayerEl.removeEventListener("transitionend", wc.onTransitionEnd);
      wc.onTransitionEnd = null;
    }

    if (wc.revealTimeoutId) {
      clearTimeout(wc.revealTimeoutId);
      wc.revealTimeoutId = null;
    }
  }

  function forceDegraded(wc, reason) {
    if (!wc) return;
    if (wc.state === wc.STATE.DEGRADED) return;

    wc.degradeReason = reason || "UNKNOWN";

    // Mirror to DOM for quick inspection (no dependency)
    try {
      if (wc.sectionEl) wc.sectionEl.setAttribute("data-wc2026-degraded-reason", wc.degradeReason);
    } catch (e) {}

    if (typeof wc.transitionTo === "function") {
      wc.transitionTo(wc.STATE.DEGRADED);
    }
    cleanup(wc);
    wc.hasRevealedOnce = true;
  }

  function finalizeRevealed(wc) {
    if (!wc) return;
    if (wc.state === wc.STATE.REVEALED) return;

    if (typeof wc.transitionTo === "function") {
      wc.transitionTo(wc.STATE.REVEALED);
    }
    cleanup(wc);
    wc.hasRevealedOnce = true;
  }

  function beginReveal(wc) {
    if (!wc) return;

    // One-time reveal only
    if (wc.hasRevealedOnce) return;

    // If we cannot animate (missing layer), degrade safely
    if (!wc.stadiumLayerEl) {
      forceDegraded(wc, "MISSING_STADIUM_LAYER");
      return;
    }

    if (typeof wc.transitionTo === "function") {
      wc.transitionTo(wc.STATE.REVEALING);
    }

    var self = wc;

    // Complete via transitionend on stadium layer + deterministic timeout fallback
    // (950ms desktop / 750ms mobile)
    var isMobile = (window.innerWidth || 0) <= 720;
    var timeoutMs = isMobile ? 750 : 950;

    wc.onTransitionEnd = function (ev) {
      // Only accept transition from the stadium layer itself
      if (!ev) return;
      if (ev.target !== self.stadiumLayerEl) return;
      finalizeRevealed(self);
    };
    self.stadiumLayerEl.addEventListener("transitionend", wc.onTransitionEnd);

    wc.revealTimeoutId = setTimeout(function () {
      finalizeRevealed(self);
    }, timeoutMs);

    // Visibility change safety: prevent stuck intermediate states
    wc.onVisChange = function () {
      if (document.visibilityState && document.visibilityState !== "visible") {
        if (self.state === self.STATE.REVEALING) {
          finalizeRevealed(self);
        }
      }
    };
    document.addEventListener("visibilitychange", wc.onVisChange);
  }

  root.reveal = {
    cleanup: cleanup,
    forceDegraded: forceDegraded,
    finalizeRevealed: finalizeRevealed,
    beginReveal: beginReveal
  };
})();
