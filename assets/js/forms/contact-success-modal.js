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
    }

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContactSuccessModal);
  } else {
    initContactSuccessModal();
  }
})(window, document);