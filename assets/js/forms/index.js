(function (window, document) {
  'use strict';

  function safeInit(fn) {
    if (typeof fn !== 'function') {
      return false;
    }

    try {
      return fn();
    } catch (error) {
      return false;
    }
  }

  function bootReservationRequestForm() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(window.PixkuyForms.initReservationRequestForm);
  }

  function bootForms() {
    bootReservationRequestForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootForms);
  } else {
    bootForms();
  }
})(window, document);