/* Netlify lead transport. A submit attempt is not a receipt.
   Uses Netlify's URL-encoded AJAX contract; never retries a POST automatically.
   Only a successful HTTP response prepares a receipt for UI and measurement.
   This is not confirmation of spam moderation, email delivery or Google Ads receipt. */
(function (window, document) {
  "use strict";

  var RECEIPT_KEY = "pixkuy_netlify_lead_receipt_v1";
  var MODAL_KEY = "pixkuy_contact_success_pending";
  var receipt = null;
  var submitting = false;
  var errorSelector = "[data-netlify-receipt-error]";

  function getConfirmedReceiptId() {
    var stored = receipt;
    if (!stored) {
      try {
        stored = JSON.parse(window.sessionStorage.getItem(RECEIPT_KEY) || "null");
      } catch (error) {
        return "";
      }
    }
    return stored && stored.status === "received" &&
      typeof stored.submissionId === "string" ? stored.submissionId.trim() : "";
  }

  function showReceiptError(form) {
    var copy = window.__pixkuyI18nDict && window.__pixkuyI18nDict.contactSuccess;
    var message = copy && copy.receiptError ||
      "No pudimos confirmar la recepción. Tus datos siguen aquí. La solicitud no se ha reenviado.";
    var buttons = document.querySelectorAll(
      '#contact-submit, [data-tours-mobile-contact-submit], [data-events-mobile-contact-submit], [data-hourly-mobile-contact-submit]'
    );
    Array.from(buttons).forEach(function (button) {
      var host = button.parentNode;
      var errorNode = host.querySelector(errorSelector);
      if (!errorNode) {
        errorNode = document.createElement("p");
        errorNode.className = "form-error";
        errorNode.setAttribute("data-netlify-receipt-error", "");
        errorNode.setAttribute("data-i18n", "contactSuccess.receiptError");
        errorNode.setAttribute("role", "alert");
        host.appendChild(errorNode);
      }
      errorNode.textContent = message;
      errorNode.hidden = false;
    });
    form.setAttribute("aria-busy", "false");
  }

  async function submitLead(event) {
    var form = event.target;
    if (event.defaultPrevented || !form || !form.matches('form[name="contact"]')) return;
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    var timeout;
    var confirmed = false;
    try {
      var data = new FormData(form);
      var submissionId = String(data.get("submission_id") || "").trim();
      if (!submissionId || data.get("form-name") !== "contact") {
        throw new Error("NETLIFY_SUBMISSION_METADATA_REQUIRED");
      }
      if (getConfirmedReceiptId() === submissionId) return;
      Array.from(document.querySelectorAll(errorSelector)).forEach(function (node) { node.hidden = true; });
      var controller = new AbortController();
      timeout = window.setTimeout(function () { controller.abort(); }, 15000);
      var response = await window.fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: new URLSearchParams(data).toString()
      });
      if (!response || !response.ok || response.status < 200 || response.status >= 300) {
        throw new Error("NETLIFY_RECEIPT_NOT_CONFIRMED");
      }
      confirmed = true;
      receipt = { status: "received", submissionId: submissionId };
      var persisted = false;
      try {
        window.sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
        window.sessionStorage.setItem(MODAL_KEY, submissionId);
        persisted = true;
      } catch (error) {
        // The current page can still confirm receipt without browser storage.
      }
      form.setAttribute("aria-busy", "false");
      if (persisted) {
        // Preserve the existing post-submit page reset and mobile confirmation.
        try {
          window.location.assign(form.getAttribute("action") || "/?lead=ok#contact");
          return;
        } catch (error) {
          // Navigation unavailable: use the same confirmation modal in place.
        }
      }
      window.dispatchEvent(new CustomEvent("pixkuy:lead-received"));
    } catch (error) {
      if (!confirmed) {
        // An ambiguous network outcome is not success. Only a human may resubmit.
        if (window.PixkuySubmissionGuard) window.PixkuySubmissionGuard.releaseFailedSubmit(form);
        showReceiptError(form);
      }
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
    }
  }

  window.PixkuyNetlifyLeadSubmission = { getConfirmedReceiptId: getConfirmedReceiptId };
  // Bubble on document: all form validation/package handlers can cancel first.
  // Transactional checkout handlers stop propagation in capture phase.
  document.addEventListener("submit", submitLead);
})(window, document);
