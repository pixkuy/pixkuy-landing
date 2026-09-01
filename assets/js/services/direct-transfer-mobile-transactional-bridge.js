/* assets/js/services/direct-transfer-mobile-transactional-bridge.js
   Direct Transfer mobile transactional bridge.
   Responsabilidad:
   - montar aceptacion legal dentro del Contact Step movil real
   - leer los campos reales data-direct-transfer-mobile-contact-field
   - mantener CTA movil bloqueada hasta aceptar condiciones
   - no enviar Booking API ni Stripe
*/

(function initDirectTransferMobileTransactionalBridge(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var MOBILE_QUERY = "(max-width: 720px)";
  var CONTACT_STEP_SELECTOR = "[data-direct-transfer-mobile-contact-step]";
  var CONTACT_FIELD_SELECTOR = "[data-direct-transfer-mobile-contact-field]";
  var LEGAL_HOST_SELECTOR = "[data-direct-transfer-mobile-checkout-legal-acceptance]";
  var SUBMIT_SELECTOR = "[data-direct-transfer-mobile-contact-submit]";

  var mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
  var observer = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getVisibleContactStep() {
    var step = document.querySelector(
      CONTACT_STEP_SELECTOR + '[aria-hidden="false"]'
    );

    if (!step || step.hidden === true) {
      return null;
    }

    return step;
  }

  function getReservationForm() {
    var api = window.PixkuyForms;

    if (api && typeof api.getReservationForm === "function") {
      return api.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function getLegalAcceptanceApi() {
    return window.PixkuyForms &&
      window.PixkuyForms.LegalAcceptance &&
      typeof window.PixkuyForms.LegalAcceptance.create === "function"
      ? window.PixkuyForms.LegalAcceptance
      : null;
  }

  function getContactField(step, name) {
    return step
      ? step.querySelector(
          CONTACT_FIELD_SELECTOR + '[data-direct-transfer-mobile-contact-field="' + name + '"]'
        )
      : null;
  }

  function getSubmit(step) {
    return step ? step.querySelector(SUBMIT_SELECTOR) : null;
  }

  function hasFilledContactData(step) {
    var name = normalizeText(getContactField(step, "name") &&
      getContactField(step, "name").value);
    var phone = normalizeText(getContactField(step, "phone") &&
      getContactField(step, "phone").value);
    var email = normalizeText(getContactField(step, "email") &&
      getContactField(step, "email").value);

    return Boolean(name && phone && email);
  }

  function ensureLegalHost(step) {
    var existing = step ? step.querySelector(LEGAL_HOST_SELECTOR) : null;
    var actions = step ? step.querySelector(".direct-transfer-mobile-contact-step__actions") : null;
    var host;

    if (existing) {
      return existing;
    }

    if (!step || !actions || !actions.parentNode) {
      return null;
    }

    host = document.createElement("div");
    host.className = "direct-transfer-mobile-contact-step__legal";
    host.setAttribute("data-direct-transfer-mobile-checkout-legal-acceptance", "1");

    actions.parentNode.insertBefore(host, actions);

    return host;
  }

  function getLegalAcceptanceInstance(step) {
    var host = ensureLegalHost(step);
    var api = getLegalAcceptanceApi();
    var form = getReservationForm();
    var existing;

    if (!host || !api || !form) {
      return null;
    }

    existing = host.__pixkuyLegalAcceptanceInstance || null;

    if (existing && typeof existing.validate === "function") {
      return existing;
    }

    host.__pixkuyLegalAcceptanceInstance = api.create({
      container: host,
      form: form,
      channel: "web_direct_transfer_mobile_checkout",
      checkboxId: "pixkuy-direct-transfer-mobile-legal-acceptance"
    });

    return host.__pixkuyLegalAcceptanceInstance;
  }

  function isAccepted(instance) {
    return Boolean(
      instance &&
        typeof instance.isAccepted === "function" &&
        instance.isAccepted()
    );
  }

  function syncSubmitState() {
    var step;
    var submit;
    var instance;
    var readyByContactStep;
    var isReady;

    if (!isMobileViewport()) {
      return false;
    }

    step = getVisibleContactStep();

    if (!step) {
      return false;
    }

    submit = getSubmit(step);
    instance = getLegalAcceptanceInstance(step);

    if (!submit || !instance) {
      return false;
    }

    readyByContactStep =
      submit.getAttribute("data-direct-transfer-mobile-contact-submit-ready") === "true" ||
      hasFilledContactData(step);
    isReady = Boolean(readyByContactStep && isAccepted(instance));

    submit.disabled = !isReady;
    submit.setAttribute("aria-disabled", isReady ? "false" : "true");

    return true;
  }

  function validateLegalAcceptance() {
    var step = getVisibleContactStep();
    var instance = step ? getLegalAcceptanceInstance(step) : null;

    if (!instance || typeof instance.validate !== "function") {
      syncSubmitState();
      return false;
    }

    if (!instance.validate()) {
      syncSubmitState();
      return false;
    }

    syncSubmitState();
    return true;
  }

  function handleSubmitClick(event) {
    var submit = event.target && event.target.closest
      ? event.target.closest(SUBMIT_SELECTOR)
      : null;

    if (!submit || !getVisibleContactStep()) {
      return;
    }

    if (validateLegalAcceptance()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function bindObserver() {
    if (observer || typeof window.MutationObserver !== "function") {
      return false;
    }

    observer = new window.MutationObserver(function onMutations() {
      syncSubmitState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "data-direct-transfer-mobile-contact-submit-ready"]
    });

    return true;
  }

  function init() {
    if (document.documentElement.dataset.directTransferMobileTransactionalBridgeBound === "1") {
      return false;
    }

    document.addEventListener("click", handleSubmitClick, true);
    document.addEventListener("input", syncSubmitState, true);
    document.addEventListener("change", syncSubmitState, true);
    window.addEventListener("pixkuy:i18n-applied", syncSubmitState);
    window.addEventListener("resize", syncSubmitState);
    bindObserver();
    syncSubmitState();

    document.documentElement.dataset.directTransferMobileTransactionalBridgeBound = "1";

    return true;
  }

  window.PixkuyDirectTransferMobileTransactionalBridge = {
    sync: syncSubmitState,
    validateLegalAcceptance: validateLegalAcceptance
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
