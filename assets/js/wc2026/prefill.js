/* WC2026 — Prefill & Contact Form Lock
 * Ruta: assets/js/wc2026/prefill.js
 * Extraído 1:1 desde index.html (sin cambios funcionales)
 * Responsabilidad única:
 * - applyWc2026Prefill
 * - lockContactForm
 * - submit lock
 * - success status handling
 */
(function () {
  "use strict";

  function applyWc2026Prefill() {
    try {
      var ds = document && document.documentElement && document.documentElement.dataset;
      if (ds && ds.wc2026 === "off") return;

      var raw = sessionStorage.getItem("wc2026_prefill");
      if (!raw) return;

      var consumed = sessionStorage.getItem("wc2026_prefill_consumed");
      if (consumed === "1") return;

      var form = document.querySelector('form[name="contact"]');
      if (!form) return;

      var ta = document.getElementById("contact-message") || form.querySelector('textarea[name="message"]');
      if (ta && !ta.value) {
        ta.value = "Interés en Planificación Mundial 2026.";
      }

      var src = form.querySelector('input[name="lead_source"]');
      if (src) src.value = "wc2026";

      var ctx = form.querySelector('input[name="lead_context"]');
      if (ctx) ctx.value = raw;

      sessionStorage.setItem("wc2026_prefill_consumed", "1");
    } catch (e) {
      // no-op
    }
  }

  // QA-safe hook: allows manual application after toggling data-wc2026="on" without reload.
  // It remains inert when wc2026 is "off".
  window.__pixkuyWc2026ApplyPrefill = applyWc2026Prefill;

  function lockContactForm(options) {
    var form = document.querySelector('form[name="contact"]');
    if (!form) return;

    var btn = document.getElementById("contact-submit") || form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    form.setAttribute("aria-busy", "true");
    form.dataset.submitted = "1";

    if (options && options.showStatus) {
      var el = document.getElementById("contact-status");
      if (el) el.hidden = false;
    }
  }

  applyWc2026Prefill();

  // 1) Prevent double submit (no extra deps, no copy changes)
  (function bindSubmitLock() {
    try {
      var form = document.querySelector('form[name="contact"]');
      if (!form) return;

      form.addEventListener(
        "submit",
        function () {
          if (form.dataset.submitted === "1") return;
          lockContactForm({ showStatus: false });
        },
        { passive: true }
      );
    } catch (e) {
      // no-op
    }
  })();

  // 2) Show success status on return and keep submit disabled to avoid re-sends on refresh/back
  try {
    var params = new URLSearchParams(window.location.search || "");
    if (params.get("lead") === "ok") {
      lockContactForm({ showStatus: true });

      params.delete("lead");
      var cleanQuery = params.toString();
      var cleanUrl =
        window.location.pathname +
        (cleanQuery ? "?" + cleanQuery : "") +
        window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  } catch (e) {
    // no-op
  }
})();
