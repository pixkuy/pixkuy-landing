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

  function logPlacesBoot() {}
  
  function bootWhatsappHandoff() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initWhatsappHandoff,
      'initWhatsappHandoff'
    );
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

  function focusFormField(form, fieldName) {
    var nextElements;
    var nextInput;

    nextElements = getPlaceFieldElements(form, fieldName);
    nextInput = nextElements && nextElements.input;

    if (!nextInput && form && fieldName) {
      nextInput = form.querySelector('[name="' + fieldName + '"]');
    }

    if (!nextInput || typeof nextInput.focus !== 'function') {
      return false;
    }

    window.setTimeout(function () {
      nextInput.focus();

      if (typeof nextInput.select === 'function') {
        nextInput.select();
      }
    }, 0);

    return true;
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
        includedRegionCodes: ['mx'],
        onSelection: function onSelection(selectedPlace) {
          if (!selectedPlace) {
            return;
          }

          if (fieldName === 'origin') {
            focusFormField(form, 'destination');
            return;
          }

          if (fieldName === 'destination') {
            focusFormField(form, 'passengers');
          }
        }
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

  logPlacesBoot('field-bootstrap-start', {
    fieldName: fieldName
  });

  formsNamespace = window.PixkuyForms || {};
  elements = getPlaceFieldElements(form, fieldName);

  logPlacesBoot('field-elements-resolved', {
    fieldName: fieldName,
    hasElements: Boolean(elements),
    hasInput: Boolean(elements && elements.input),
    hasMountNode: Boolean(elements && elements.mountNode)
  });

  if (!elements || !elements.input || !elements.mountNode) {
    logPlacesBoot('field-bootstrap-skip-missing-elements', {
      fieldName: fieldName
    });
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

    logPlacesBoot('startMount-called', {
      fieldName: fieldName,
      hasStarted: hasStarted,
      activeElementId: document.activeElement && document.activeElement.id ? document.activeElement.id : '',
      activeElementTag: document.activeElement && document.activeElement.tagName ? document.activeElement.tagName : ''
    });

    if (hasStarted) {
      logPlacesBoot('startMount-skip-already-started', {
        fieldName: fieldName
      });
      return;
    }

    hasStarted = true;
    cleanupListeners();

    liveLanguage = getDocumentLanguage();

    logPlacesBoot('startMount-bootGooglePlacesField', {
      fieldName: fieldName,
      liveLanguage: liveLanguage
    });

    bootGooglePlacesField(form, fieldName, liveLanguage);
  }

  input.addEventListener('focus', function onPlaceFieldFocus() {
    logPlacesBoot('input-focus-event', {
      fieldName: fieldName,
      value: input.value || ''
    });
    startMount();
  }, { once: true });

  logPlacesBoot('focus-listener-registered', {
    fieldName: fieldName
  });

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

  logPlacesBoot('bootGooglePlacesOnFocus-start', {
    readyState: document.readyState,
    hasPixkuyForms: Boolean(window.PixkuyForms),
    hasGooglePlaces: Boolean(window.PixkuyForms && window.PixkuyForms.googlePlaces)
  });

  if (!window.PixkuyForms || !window.PixkuyForms.googlePlaces) {
    logPlacesBoot('bootGooglePlacesOnFocus-skip-missing-api', null);
    return false;
  }

  form = document.querySelector('form[name="contact"]');

  logPlacesBoot('bootGooglePlacesOnFocus-form', {
    hasForm: Boolean(form)
  });

  if (!form) {
    return false;
  }

  bootGooglePlacesOnFocusField(form, 'origin');
  bootGooglePlacesOnFocusField(form, 'destination');

  return true;
}

    function bootForms() {
    logPlacesBoot('bootForms-start', {
      readyState: document.readyState
    });

    bootReservationRequestForm();
    bootWhatsappHandoff();
    bootGooglePlacesOnFocus();

    logPlacesBoot('bootForms-end', {
      readyState: document.readyState
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootForms);
  } else {
    bootForms();
  }
})(window, document);