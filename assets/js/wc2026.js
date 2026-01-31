/* WC2026 Editorial Motion (Event Mode)
 * Phase 4: State machine + IntersectionObserver reveal + Kill switch + cleanup
 * Phase 6: First-click tracking + prefill store (only first click)
 * Constraints:
 * - Must be inert when kill switch is OFF
 * - No external deps
 * - ES5+ compatible
 */
(function () {
  "use strict";

  // Prevent double-init if the script is accidentally included more than once.
  if (window.__pixkuyWC2026 && window.__pixkuyWC2026.__inited) return;

  // Hard requirements (NO fallbacks): internal modules MUST be loaded before this entrypoint.
  var __m = window.__pixkuyWC2026Modules;
  if (!__m) {
    throw new Error(
      "[WC2026] Missing window.__pixkuyWC2026Modules. Ensure assets/js/wc2026/*.js are loaded BEFORE assets/js/wc2026.js"
    );
  }

  function __req(modName, fnName) {
    var mod = __m[modName];
    if (!mod) {
      throw new Error("[WC2026] Missing module: __pixkuyWC2026Modules." + modName);
    }
    var fn = mod[fnName];
    if (typeof fn !== "function") {
      throw new Error("[WC2026] Missing function: __pixkuyWC2026Modules." + modName + "." + fnName + "()");
    }
    return fn;
  }

  // Resolve required functions once (fail fast).
  var __env_computeDeviceClass = __req("env", "computeDeviceClass");
  var __env_computeAxis = __req("env", "computeAxis");
  var __env_shouldDegrade = __req("env", "shouldDegrade");

  var __dom_locateDom = __req("dom", "locateDom");
  var __dom_setClass = __req("dom", "setClass");
  var __dom_applyAxisClasses = __req("dom", "applyAxisClasses");

  var __track_bindAssetError = __req("track", "bindAssetError");
  var __track_bindFirstClick = __req("track", "bindFirstClick");

  var __reveal_cleanup = __req("reveal", "cleanup");
  var __reveal_forceDegraded = __req("reveal", "forceDegraded");
  var __reveal_finalizeRevealed = __req("reveal", "finalizeRevealed");
  var __reveal_beginReveal = __req("reveal", "beginReveal");

  var __io_isInitiallyVisibleForReveal = __req("io", "isInitiallyVisibleForReveal");
  var __io_initIntersectionObserver = __req("io", "initIntersectionObserver");

  var WC2026 = {
    __inited: true,

    // State enum (S0-S4 mapping)
    STATE: {
      OFF: "S0_OFF",
      WAITING: "S1_WAITING",
      REVEALING: "S2_REVEALING",
      REVEALED: "S3_REVEALED",
      DEGRADED: "S4_DEGRADED",
    },

    // Runtime flags (never null; omit in payloads later if unavailable)
    deviceClass: undefined,
    axis: undefined,
    assetError: false,

    // Debug/runtime observability (does not affect behavior)
    degradeReason: null,

    // DOM refs
    sectionEl: null,
    stadiumLayerEl: null,
    stadiumImgEl: null,
    ctaEl: null,

    // Observers/listeners
    io: null,
    onVisChange: null,
    onTransitionEnd: null,
    revealTimeoutId: null,

    // Internal state
    state: null,
    hasRevealedOnce: false,
    hasTrackedClick: false,

    // Kill switch (must be effective)
    isEnabled: function () {
      // Contract: dataset.wc2026 === "off" OR WC2026_ENABLED === false disables all.
      var ds = document && document.documentElement && document.documentElement.dataset;
      if (ds && ds.wc2026 === "off") return false;
      if (window.WC2026_ENABLED === false) return false;
      return true;
    },

    // Find DOM deterministically
    locateDom: function () {
      return __dom_locateDom(this);
    },

    computeDeviceClass: function () {
      return __env_computeDeviceClass();
    },

    computeAxis: function () {
      return __env_computeAxis();
    },

    shouldDegrade: function () {
      return __env_shouldDegrade();
    },

    setClass: function (cls, on) {
      __dom_setClass(this, cls, on);
    },

    applyAxisClasses: function () {
      __dom_applyAxisClasses(this);
    },

    transitionTo: function (next) {
      if (this.state === next) return;

      // Clear state classes (CSS defines visuals)
      this.setClass("wc2026--waiting", false);
      this.setClass("wc2026--revealing", false);
      this.setClass("wc2026--revealed", false);
      this.setClass("wc2026--degraded", false);

      this.state = next;

      if (next === this.STATE.WAITING) this.setClass("wc2026--waiting", true);
      if (next === this.STATE.REVEALING) this.setClass("wc2026--revealing", true);
      if (next === this.STATE.REVEALED) this.setClass("wc2026--revealed", true);
      if (next === this.STATE.DEGRADED) this.setClass("wc2026--degraded", true);
    },

    cleanup: function () {
      __reveal_cleanup(this);
    },

    forceDegraded: function (reason) {
      __reveal_forceDegraded(this, reason);
    },

    finalizeRevealed: function () {
      __reveal_finalizeRevealed(this);
    },

    beginReveal: function () {
      __reveal_beginReveal(this);
    },

    bindAssetError: function () {
      __track_bindAssetError(this);
    },

    // Phase 6: first-click tracking + prefill store (only first click)
    bindFirstClick: function () {
      __track_bindFirstClick(this);
    },

    // Option B: if the section is already sufficiently visible at load,
    // trigger reveal immediately (still one-time and still respects degrade/kill switch).
    isInitiallyVisibleForReveal: function () {
      return __io_isInitiallyVisibleForReveal(this);
    },

    initIntersectionObserver: function () {
      __io_initIntersectionObserver(this);
    },

    init: function () {
      // Always hard-exit if feature is OFF
      if (!this.isEnabled()) return;

      // DOM must exist
      if (!this.locateDom()) return;

      // Compute once per load
      this.deviceClass = this.computeDeviceClass();
      this.axis = this.computeAxis();
      this.applyAxisClasses();

      // Asset error binding (safe even if later)
      this.bindAssetError();

      // Phase 6: bind CTA click tracking/prefill store
      this.bindFirstClick();

      // Degrade gating must happen before IO
      if (this.shouldDegrade()) {
        this.forceDegraded("SHOULD_DEGRADE");
        return;
      }

      // Baseline state: WAITING (no motion until intersect OR already visible at load)
      this.transitionTo(this.STATE.WAITING);

      // Option B: if already visible at load, reveal immediately.
      if (this.isInitiallyVisibleForReveal()) {
        this.beginReveal();
        return;
      }

      // Otherwise, IO reveal
      this.initIntersectionObserver();
    },
  };

  // Expose only a minimal debug handle (optional); no behaviour should depend on it.
  window.__pixkuyWC2026 = WC2026;

  // Init after DOM is ready (script is expected to load at end of <body>)
  // Still safe if included earlier.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      WC2026.init();
    });
  } else {
    WC2026.init();
  }
})();
