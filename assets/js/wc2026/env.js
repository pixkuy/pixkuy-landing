/* WC2026 — Environment & Capability Detection
 * Ruta: assets/js/wc2026/env.js
 * Extraído sin cambios funcionales desde assets/js/wc2026.js
 * Responsabilidad única:
 * - deviceClass
 * - axis
 * - degrade gating
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

  function computeDeviceClass() {
    var nav = window.navigator || {};
    var saveData = !!(nav.connection && nav.connection.saveData === true);
    var dm = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
    var hc = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;

    // low if saveData === true OR deviceMemory <= 4 OR hardwareConcurrency <= 4
    if (saveData || (dm !== undefined && dm <= 4) || (hc !== undefined && hc <= 4)) {
      return "low";
    }

    // mid if not low and deviceMemory ∈ [5..7]
    if (dm !== undefined && dm >= 5 && dm <= 7) {
      return "mid";
    }

    // high if deviceMemory >= 8 OR (no deviceMemory and hardwareConcurrency >= 8 and saveData=false)
    if (
      (dm !== undefined && dm >= 8) ||
      (dm === undefined && hc !== undefined && hc >= 8 && !saveData)
    ) {
      return "high";
    }

    // Default: mid (conservative)
    return "mid";
  }

  function computeAxis() {
    // DTCF §6.4 rule: viewportW <= 720 → axis-y, else axis-x
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    return w <= 720 ? "y" : "x";
  }

  function shouldDegrade() {
    var nav = window.navigator || {};
    var saveData = !!(nav.connection && nav.connection.saveData === true);
    var dm = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
    var hc = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;

    var reduceMotion = false;
    try {
      reduceMotion = !!(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      reduceMotion = false;
    }

    var h = window.innerHeight || document.documentElement.clientHeight || 0;

    // Degrade gating (idéntico al original):
    // prefers-reduced-motion: reduce
    // saveData === true
    // deviceMemory <= 4
    // hardwareConcurrency <= 4
    // innerHeight < 520
    if (reduceMotion) return true;
    if (saveData) return true;
    if (dm !== undefined && dm <= 4) return true;
    if (hc !== undefined && hc <= 4) return true;
    if (h > 0 && h < 520) return true;

    return false;
  }

  root.env = {
    computeDeviceClass: computeDeviceClass,
    computeAxis: computeAxis,
    shouldDegrade: shouldDegrade
  };
})();
