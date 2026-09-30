/* General contact form — post-redirect status.
 * Kept at its existing path to preserve script ordering.
 * Does not govern the global submit lock.
 */
(function (window, document) {
  "use strict";

  function getReservationRequestForm() {
    return document.querySelector('form[name="contact"]');
  }

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

  try {
    var params = new window.URLSearchParams(window.location.search || "");
    if (params.get("lead") === "ok") {
      // The URL is navigation only. A receipt must come from the Netlify POST.
      var receipts = window.PixkuyNetlifyLeadSubmission;
      var receiptId = receipts && receipts.getConfirmedReceiptId();
      if (receiptId && window.sessionStorage.getItem("pixkuy_contact_success_pending") === receiptId) {
        lockReservationRequestForm({ showStatus: true });
      }

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