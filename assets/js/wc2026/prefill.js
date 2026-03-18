/* WC2026 — Prefill & Reservation Request Lock
 * Ruta: assets/js/wc2026/prefill.js
 * Responsabilidad única:
 * - applyWc2026Prefill
 * - lockReservationRequestForm
 * - submit lock
 * - success status handling
 * Compatibilidad:
 * - mantiene form[name="contact"] por Netlify
 * - mantiene contact-message / contact-submit / contact-status
 * - no invade la capa assets/js/forms/*
 */
(function (window, document) {
  "use strict";

  function getReservationRequestForm() {
    return document.querySelector('form[name="contact"]');
  }

  function applyWc2026Prefill() {
    try {
      var ds = document && document.documentElement && document.documentElement.dataset;
      if (ds && ds.wc2026 === "off") return;

      var raw = window.sessionStorage.getItem("wc2026_prefill");
      if (!raw) return;

      var consumed = window.sessionStorage.getItem("wc2026_prefill_consumed");
      if (consumed === "1") return;

      var form = getReservationRequestForm();
      if (!form) return;

      var textarea =
        document.getElementById("contact-message") ||
        form.querySelector('textarea[name="message"]');

      if (textarea && !textarea.value) {
        textarea.value = "Interés en Planificación Mundial 2026.";
      }

      var sourceField = form.querySelector('input[name="lead_source"]');
      if (sourceField) {
        sourceField.value = "wc2026";
      }

      var contextField = form.querySelector('input[name="lead_context"]');
      if (contextField) {
        contextField.value = raw;
      }

      window.sessionStorage.setItem("wc2026_prefill_consumed", "1");

      if (
        window.PixkuyForms &&
        typeof window.PixkuyForms.getReservationRequestFields === "function" &&
        typeof window.PixkuyForms.syncReservationRequestState === "function"
      ) {
        var fields = window.PixkuyForms.getReservationRequestFields(form);
        window.PixkuyForms.syncReservationRequestState(fields);
      }
    } catch (e) {
      // no-op
    }
  }

  // QA-safe hook: allows manual application after toggling data-wc2026="on" without reload.
  // It remains inert when wc2026 is "off".
  window.__pixkuyWc2026ApplyPrefill = applyWc2026Prefill;

  function lockReservationRequestForm(options) {
    var form = getReservationRequestForm();
    if (!form) return;

    var submitButton =
      document.getElementById("contact-submit") ||
      form.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-disabled", "true");
    }

    form.setAttribute("aria-busy", "true");
    form.dataset.submitted = "1";

    if (options && options.showStatus) {
      var status = document.getElementById("contact-status");
      if (status) {
        status.hidden = false;
      }
    }
  }

  applyWc2026Prefill();

  (function bindSubmitLock() {
    try {
      var form = getReservationRequestForm();
      if (!form) return;

      form.addEventListener(
        "submit",
        function () {
          if (form.dataset.submitted === "1") return;
          lockReservationRequestForm({ showStatus: false });
        },
        { passive: true }
      );
    } catch (e) {
      // no-op
    }
  })();

  try {
    var params = new window.URLSearchParams(window.location.search || "");
    if (params.get("lead") === "ok") {
      lockReservationRequestForm({ showStatus: true });

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
})(window, document);