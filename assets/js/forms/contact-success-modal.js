/* assets/js/forms/contact-success-modal.js
   Confirmación post-submit.
   Responsabilidad:
   - detectar ?lead=ok tras redirección Netlify
   - abrir confirmación transaccional
   - gestionar cierre, foco y bloqueo de scroll
   No modifica:
   - submit del formulario
   - Netlify Forms
   - WhatsApp handoff
   - Google Ads conversion
*/

(function (window, document) {
  "use strict";

  var LOCK_CLASS = "contact-success-modal-lock";
  var MODAL_SUCCESS_SIGNAL_KEY = "pixkuy_contact_success_pending";
  var LEAD_SUCCESS_SIGNAL_KEY = "pixkuy_lead_success";
  var LEAD_SUCCESS_CONTEXT_STORAGE_KEY = "pixkuy_lead_success_context";
  var LEAD_SUCCESS_TRACKED_STORAGE_KEY = "pixkuy_lead_success_tracked";
  var MOBILE_QUERY = "(max-width: 720px)";
  var previousFocus = null;

  function hasLeadSuccessParam() {
    var params;

    try {
      params = new URLSearchParams(window.location.search);
      return params.get("lead") === "ok";
    } catch (error) {
      return false;
    }
  }
  
    
    
  function hasModalSuccessSignal() {
    try {
      return window.sessionStorage.getItem(MODAL_SUCCESS_SIGNAL_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function setSuccessSignals() {
    try {
      window.sessionStorage.setItem(MODAL_SUCCESS_SIGNAL_KEY, "1");
      window.sessionStorage.setItem(LEAD_SUCCESS_SIGNAL_KEY, "1");
    } catch (error) {
      // no-op
    }
  }

  function clearModalSuccessSignal() {
    try {
      window.sessionStorage.removeItem(MODAL_SUCCESS_SIGNAL_KEY);
    } catch (error) {
      // no-op
    }
  }

  function shouldOpenModal() {
    return hasLeadSuccessParam() || hasModalSuccessSignal();
  }

  function getModal() {
    return document.querySelector("[data-contact-success-modal]");
  }

  function getPanel(modal) {
    return modal ? modal.querySelector("[data-contact-success-panel]") : null;
  }

  function getCloseControls(modal) {
    if (!modal) return [];
    return Array.from(modal.querySelectorAll("[data-contact-success-close]"));
  }

  function blurActiveElementInside(node) {
    var activeElement = document.activeElement;

    if (
      node &&
      activeElement &&
      typeof activeElement.blur === "function" &&
      node.contains(activeElement)
    ) {
      activeElement.blur();
      return true;
    }

    return false;
  }

  function setOpen(modal, open) {
    var panel;

    if (!modal) {
      return false;
    }

    panel = getPanel(modal);

    if (open) {
      previousFocus = document.activeElement;
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add(LOCK_CLASS);

      window.setTimeout(function () {
        if (panel && typeof panel.focus === "function") {
          panel.focus();
        }
      }, 0);

      return true;
    }

    blurActiveElementInside(modal);

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove(LOCK_CLASS);

    if (
      previousFocus &&
      typeof previousFocus.focus === "function" &&
      document.contains(previousFocus)
    ) {
      previousFocus.focus();
    }

    previousFocus = null;
    return true;
  }

  function isMobileViewport() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia(MOBILE_QUERY).matches
    );
  }

  function getCleanSuccessUrl() {
    var url;

    try {
      url = new URL(window.location.href);
      url.searchParams.delete("lead");
      url.searchParams.delete("pixkuyLocalSuccess");
      url.hash = "";

      return url.pathname + url.search + url.hash;
    } catch (error) {
      return window.location.pathname || "/";
    }
  }

  function returnToMobileInitialScreen() {
    var cleanUrl = getCleanSuccessUrl();

    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, document.title, cleanUrl);
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth"
    });

    return true;
  }

  function focusContactSection() {
    var contact = document.getElementById("contact");

    if (!contact) {
      return false;
    }

    if (!contact.hasAttribute("tabindex")) {
      contact.setAttribute("tabindex", "-1");
    }

    contact.focus({ preventScroll: true });
    contact.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    return true;
  }

  function closeModal() {
    setOpen(getModal(), false);

    if (isMobileViewport()) {
      returnToMobileInitialScreen();
      return;
    }

    focusContactSection();
  }

  function bindModal(modal) {
    var controls;

    if (!modal || modal.dataset.contactSuccessBound === "1") {
      return false;
    }

    controls = getCloseControls(modal);

    controls.forEach(function (control) {
      control.addEventListener("click", function () {
        closeModal();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        modal.hidden === false
      ) {
        event.preventDefault();
        closeModal();
      }
    });

    modal.dataset.contactSuccessBound = "1";
    return true;
  }

  function applyAriaLabels(modal) {
    var nodes;
    var modules;
    var getValue;
    var dict;

    if (!modal) return false;

    modules = window.__pixkuyI18nModules || {};
    getValue = modules.getValue;
    dict = window.__pixkuyI18nDict || null;

    if (typeof getValue !== "function" || !dict) {
      return false;
    }

    nodes = modal.querySelectorAll("[data-i18n-aria-label]");
    Array.from(nodes).forEach(function (node) {
      var key = node.getAttribute("data-i18n-aria-label");
      var value = getValue(dict, key);

      if (typeof value === "string" && value.trim()) {
        node.setAttribute("aria-label", value.trim());
      }
    });

    return true;
  }
  
    function getStoredLeadSuccessContext() {
    var raw;
    var parsed;

    try {
      raw = window.sessionStorage.getItem(LEAD_SUCCESS_CONTEXT_STORAGE_KEY);
    } catch (error) {
      return {};
    }

    if (!raw) {
      return {};
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return {};
    }

    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function clearLeadSuccessContext() {
    try {
      window.sessionStorage.removeItem(LEAD_SUCCESS_CONTEXT_STORAGE_KEY);
    } catch (error) {
      // no-op
    }
  }

  function getLeadSuccessTrackedKey() {
    return [
      LEAD_SUCCESS_TRACKED_STORAGE_KEY,
      window.location ? window.location.pathname : "",
      window.location ? window.location.search : ""
    ].join(":");
  }

  function hasTrackedLeadSuccess() {
    try {
      return window.sessionStorage.getItem(getLeadSuccessTrackedKey()) === "1";
    } catch (error) {
      return false;
    }
  }

  function markLeadSuccessTracked() {
    try {
      window.sessionStorage.setItem(getLeadSuccessTrackedKey(), "1");
      return true;
    } catch (error) {
      return false;
    }
  }

  function getLeadSuccessPayload() {
    var context = getStoredLeadSuccessContext();
    var payload = {};

    [
      "service_type",
      "viewport",
      "flow_surface",
      "direction",
      "passenger_fare_key",
      "currency",
      "tour_id",
      "has_guide",
      "mode",
      "event_id",
      "venue_id",
      "variant"
    ].forEach(function copyTextKey(key) {
      if (typeof context[key] === "string" && context[key].trim()) {
        payload[key] = context[key].trim();
      }
    });

    [
      "price",
      "duration_hours",
      "distance_meters",
      "duration_seconds",
      "outbound_distance_meters",
      "return_distance_meters",
      "outbound_duration_seconds",
      "return_duration_seconds"
    ].forEach(function copyNumberKey(key) {
      if (typeof context[key] === "number" && Number.isFinite(context[key]) && context[key] > 0) {
        payload[key] = context[key];
      }
    });

    return payload;
  }

  function trackLeadSuccessIfNeeded() {
    var analytics = window.PixkuyAnalytics;
    var payload;

    if (hasTrackedLeadSuccess()) {
      return false;
    }

    if (!analytics || typeof analytics.track !== "function") {
      return false;
    }

    payload = getLeadSuccessPayload();

    if (!payload.service_type) {
      payload.service_type = "unknown";
    }

    if (!analytics.track("pixkuy_lead_success", payload)) {
      return false;
    }

    markLeadSuccessTracked();
    clearLeadSuccessContext();

    return true;
  }

  function scheduleLeadSuccessTracking() {
    window.setTimeout(trackLeadSuccessIfNeeded, 0);
    window.setTimeout(trackLeadSuccessIfNeeded, 250);
    window.setTimeout(trackLeadSuccessIfNeeded, 1000);

    window.addEventListener("pixkuy:analytics-consent-ready", trackLeadSuccessIfNeeded, {
      once: true
    });

    window.addEventListener("pixkuy:i18n-applied", trackLeadSuccessIfNeeded, {
      once: true
    });

    return true;
  }

  function bindSubmitSuccessSignal() {
    var form = document.querySelector('form[name="contact"]');

    if (!form || form.dataset.contactSuccessSubmitBound === "1") {
      return false;
    }

    form.addEventListener("submit", function (event) {
      if (event.defaultPrevented) {
        return;
      }

      setSuccessSignals();
    });

    form.dataset.contactSuccessSubmitBound = "1";
    return true;
  }
     
  function initContactSuccessModal() {
    var modal = getModal();

    if (!modal) {
      return false;
    }

    bindModal(modal);
    bindSubmitSuccessSignal();
    applyAriaLabels(modal);

    window.addEventListener("pixkuy:i18n-applied", function () {
      applyAriaLabels(modal);
    });

    if (shouldOpenModal()) {
      clearModalSuccessSignal();
      setOpen(modal, true);
      scheduleLeadSuccessTracking();
    }

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContactSuccessModal);
  } else {
    initContactSuccessModal();
  }
})(window, document);