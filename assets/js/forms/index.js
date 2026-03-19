(function (window, document) {
  'use strict';

  function safeInit(fn, label) {
    if (typeof fn !== 'function') {
      return false;
    }

    try {
      return fn();
    } catch (error) {
      console.error('[Pixkuy][forms]', label || 'safeInit', error);
      return false;
    }
  }

  function bootReservationRequestForm() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initReservationRequestForm,
      'initReservationRequestForm'
    );
  }

  function getDocumentLanguage() {
    var language = document.documentElement && document.documentElement.lang;

    if (typeof language === 'string' && language.trim()) {
      return language.trim().toLowerCase();
    }

    return 'es';
  }

  function normalizeGoogleLanguage(language) {
    var value = String(language || 'es').trim().toLowerCase();

    if (value === 'zh-hans') {
      return 'zh-CN';
    }

    return value;
  }

  function getPlaceFieldElements(form, fieldName) {
    if (!form || !fieldName) {
      return null;
    }

    return {
      input: form.querySelector('[data-place-input="' + fieldName + '"]'),
      mountNode: form.querySelector('[data-place-mount="' + fieldName + '"]'),
      hiddenFields: {
        placeId: form.querySelector('input[name="' + fieldName + '_place_id"]'),
        lat: form.querySelector('input[name="' + fieldName + '_lat"]'),
        lng: form.querySelector('input[name="' + fieldName + '_lng"]')
      }
    };
  }

  function bootGooglePlacesField(form, fieldName, language) {
    var formsNamespace;
    var googlePlacesApi;
    var elements;

    formsNamespace = window.PixkuyForms || {};
    googlePlacesApi = formsNamespace.googlePlaces;
    elements = getPlaceFieldElements(form, fieldName);

    if (
      !googlePlacesApi ||
      typeof googlePlacesApi.createAutocompleteController !== 'function' ||
      !elements ||
      !elements.input ||
      !elements.mountNode
    ) {
      return false;
    }

    return safeInit(function () {
      var controller = googlePlacesApi.createAutocompleteController({
        input: elements.input,
        mountNode: elements.mountNode,
        hiddenFields: elements.hiddenFields,
        language: normalizeGoogleLanguage(language),
        region: 'mx',
        includedRegionCodes: ['mx']
      });

      if (!formsNamespace.placeControllers) {
        formsNamespace.placeControllers = {};
      }

      formsNamespace.placeControllers[fieldName] = controller;
      return controller.mount();
    }, 'bootGooglePlacesField:' + fieldName);
  }

  function bootGooglePlacesOnFocusField(form, fieldName) {
  var formsNamespace;
  var elements;
  var input;
  var hasStarted;
  var detachFocusListener;

  formsNamespace = window.PixkuyForms || {};
  elements = getPlaceFieldElements(form, fieldName);

  if (!elements || !elements.input || !elements.mountNode) {
    return false;
  }

  input = elements.input;
  hasStarted = false;
  detachFocusListener = null;

  function cleanupListeners() {
    if (typeof detachFocusListener === 'function') {
      detachFocusListener();
      detachFocusListener = null;
    }
  }

  function startMount() {
    var liveLanguage;

    if (hasStarted) {
      return;
    }

    hasStarted = true;
    cleanupListeners();

    liveLanguage = getDocumentLanguage();
    bootGooglePlacesField(form, fieldName, liveLanguage);
  }

  input.addEventListener('focus', startMount, { once: true });

  detachFocusListener = function detachFocusListenerFn() {
    input.removeEventListener('focus', startMount, { once: true });
  };

  if (!formsNamespace.placeBootstrapState) {
    formsNamespace.placeBootstrapState = {};
  }

  formsNamespace.placeBootstrapState[fieldName] = {
    mode: 'on-focus',
    started: function () {
      return hasStarted;
    }
  };

  return true;
}

  function bootGooglePlacesOnFocus() {
  var form;

  if (!window.PixkuyForms || !window.PixkuyForms.googlePlaces) {
    return false;
  }

  form = document.querySelector('form[name="contact"]');

  if (!form) {
    return false;
  }

  bootGooglePlacesOnFocusField(form, 'origin');
  bootGooglePlacesOnFocusField(form, 'destination');

  return true;
}

  function bootForms() {
    bootReservationRequestForm();
    bootGooglePlacesOnFocus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootForms);
  } else {
    bootForms();
  }
})(window, document);