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

  function bootContactServiceState() {
    if (
      !window.PixkuyForms ||
      !window.PixkuyForms.contactServiceState
    ) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.contactServiceState.init,
      'contactServiceState.init'
    );
  }

  function bootContactServiceSwitcher() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initContactServiceSwitcher,
      'initContactServiceSwitcher'
    );
  }

  function bootContactAirportHotelEditor() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initContactAirportHotelEditor,
      'initContactAirportHotelEditor'
    );
  }

  function bootContactAirportHotelLodgingAdapter() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initContactAirportHotelLodgingAdapter,
      'initContactAirportHotelLodgingAdapter'
    );
  }

  function bootContactTourPrivateEditor() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initContactTourPrivateEditor,
      'initContactTourPrivateEditor'
    );
  }
  
  function bootPanelHandoffSummary() {
    if (!window.PixkuyForms) {
      return false;
    }

    return safeInit(
      window.PixkuyForms.initPanelHandoffSummary,
      'initPanelHandoffSummary'
    );
  }

  function getContactServiceStateApi() {
    if (
      !window.PixkuyForms ||
      !window.PixkuyForms.contactServiceState
    ) {
      return null;
    }

    return window.PixkuyForms.contactServiceState;
  }

  function getReservationForm() {
    if (
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationForm === 'function'
    ) {
      return window.PixkuyForms.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function scrollToContactSection(form) {
    var section;

    if (form && typeof form.closest === 'function') {
      section = form.closest('#contact');
    }

    if (!section) {
      section = document.getElementById('contact');
    }

    if (!section || typeof section.scrollIntoView !== 'function') {
      return false;
    }

    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    return true;
  }

  function focusTourPrivatePrimaryField(form) {
    var target;

    if (!form) {
      return false;
    }

    target =
      form.querySelector('[data-contact-tour-private-pickup]') ||
      form.querySelector('[data-contact-tour-private-tour]') ||
      form.querySelector('#contact-name');

    if (!target || typeof target.focus !== 'function') {
      return false;
    }

    window.setTimeout(function () {
      target.focus();

      if (typeof target.select === 'function') {
        target.select();
      }
    }, 0);

    return true;
  }

  function bindToursPanelHandoff() {
    var formsNamespace;
    var serviceStateApi;

    if (!window.PixkuyForms) {
      return false;
    }

    formsNamespace = window.PixkuyForms;
    serviceStateApi = getContactServiceStateApi();

    if (
      !serviceStateApi ||
      typeof serviceStateApi.setActiveServiceType !== 'function' ||
      typeof formsNamespace.applyContactTourPrivateHandoff !== 'function'
    ) {
      return false;
    }

    if (formsNamespace.__tourPrivateHandoffBound === true) {
      return true;
    }

    window.addEventListener('pixkuy:tours-panel-submit', function (event) {
      var detail;
      var form;
      var result;

      detail = event && event.detail && typeof event.detail === 'object'
        ? event.detail
        : null;

      if (detail && typeof detail === 'object') {
        detail.tour_private_date = typeof detail.tour_private_date === 'string'
          ? detail.tour_private_date.trim()
          : '';
      }

      if (!detail) {
        return;
      }

      form = getReservationForm();

      if (!form) {
        return;
      }

      result = serviceStateApi.setActiveServiceType('tour_private', {
        source: 'tours-panel-handoff'
      });

      if (!result || result.ok !== true) {
        return;
      }

      formsNamespace.applyContactTourPrivateHandoff(detail);
      scrollToContactSection(form);
      focusTourPrivatePrimaryField(form);
    });

    formsNamespace.__tourPrivateHandoffBound = true;
    return true;
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
    var hiddenFieldBaseName;

    if (!form || !fieldName) {
      return null;
    }

    hiddenFieldBaseName = fieldName === 'tour_private_pickup'
      ? 'tour_private_pickup'
      : fieldName;

    return {
      input: form.querySelector('[data-place-input="' + fieldName + '"]'),
      mountNode: form.querySelector('[data-place-mount="' + fieldName + '"]'),
      hiddenFields: {
        placeId: form.querySelector('input[name="' + hiddenFieldBaseName + '_place_id"]'),
        lat: form.querySelector('input[name="' + hiddenFieldBaseName + '_lat"]'),
        lng: form.querySelector('input[name="' + hiddenFieldBaseName + '_lng"]')
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

    if (!nextInput && form && fieldName) {
      nextInput = form.querySelector('#' + fieldName);
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
        fieldName: fieldName,
        input: elements.input,
        mountNode: elements.mountNode,
        hiddenFields: elements.hiddenFields,
        language: normalizeGoogleLanguage(language),
        region: 'mx',
        includedRegionCodes: ['mx'],
        onSelection: function onSelection(selectedPlace, meta) {
          var safeMeta = meta && typeof meta === 'object' ? meta : {};
          var shouldPreserveVisibleInput = safeMeta.preserveInputValue === true;

          if (!selectedPlace) {
            if (
              fieldName === 'tour_private_pickup' &&
              typeof formsNamespace.clearContactTourPrivatePickupPlace === 'function' &&
              !shouldPreserveVisibleInput
            ) {
              formsNamespace.clearContactTourPrivatePickupPlace();
            }
            return;
          }

          if (fieldName === 'tour_private_pickup') {
            if (typeof formsNamespace.setContactTourPrivatePickupPlace === 'function') {
              formsNamespace.setContactTourPrivatePickupPlace(selectedPlace);
            }
            focusFormField(form, 'contact-tour-private-date');
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

  function startMount() {
    var liveLanguage;
    var existingController;

    existingController =
      formsNamespace.placeControllers &&
      formsNamespace.placeControllers[fieldName]
        ? formsNamespace.placeControllers[fieldName]
        : null;

    logPlacesBoot('startMount-called', {
      fieldName: fieldName,
      hasStarted: hasStarted,
      hasExistingController: Boolean(existingController),
      activeElementId: document.activeElement && document.activeElement.id ? document.activeElement.id : '',
      activeElementTag: document.activeElement && document.activeElement.tagName ? document.activeElement.tagName : ''
    });

    if (
      existingController &&
      typeof existingController.close === 'function'
    ) {
      existingController.close();
      hasStarted = true;
      return;
    }

    liveLanguage = getDocumentLanguage();

    logPlacesBoot('startMount-bootGooglePlacesField', {
      fieldName: fieldName,
      liveLanguage: liveLanguage
    });

    hasStarted = true;
    bootGooglePlacesField(form, fieldName, liveLanguage);
  }

  input.addEventListener('focus', function onPlaceFieldFocus() {
    logPlacesBoot('input-focus-event', {
      fieldName: fieldName,
      value: input.value || ''
    });
    startMount();
  });

  logPlacesBoot('focus-listener-registered', {
    fieldName: fieldName
  });

  if (!formsNamespace.placeBootstrapState) {
    formsNamespace.placeBootstrapState = {};
  }

  formsNamespace.placeBootstrapState[fieldName] = {
    mode: 'on-focus',
    started: function () {
      return hasStarted;
    },
    reset: function () {
      hasStarted = false;
    }
  };

  return true;
}

   function bootGooglePlacesOnFocus() {
  var form;
  var formsNamespace;

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
  formsNamespace = window.PixkuyForms || {};

  logPlacesBoot('bootGooglePlacesOnFocus-form', {
    hasForm: Boolean(form)
  });

  if (!form) {
    return false;
  }

  bootGooglePlacesOnFocusField(form, 'origin');
  bootGooglePlacesOnFocusField(form, 'destination');
  bootGooglePlacesOnFocusField(form, 'tour_private_pickup');

  if (!formsNamespace.__placeControllerServiceCleanupBound) {
    form.addEventListener('pixkuy:contact-service-change', function (event) {
      var detail;
      var previousServiceType;
      var nextServiceType;
      var controller;
      var bootstrapState;

      detail = event && event.detail ? event.detail : {};
      previousServiceType = String(detail.previousServiceType || '').trim();
      nextServiceType = String(detail.nextServiceType || '').trim();

      if (
        previousServiceType === 'tour_private' &&
        nextServiceType !== 'tour_private'
      ) {
        controller =
          formsNamespace.placeControllers &&
          formsNamespace.placeControllers.tour_private_pickup
            ? formsNamespace.placeControllers.tour_private_pickup
            : null;

        if (controller && typeof controller.destroy === 'function') {
          window.setTimeout(function () {
            controller.destroy();

            if (formsNamespace.placeControllers) {
              delete formsNamespace.placeControllers.tour_private_pickup;
            }

            bootstrapState =
              formsNamespace.placeBootstrapState &&
              formsNamespace.placeBootstrapState.tour_private_pickup
                ? formsNamespace.placeBootstrapState.tour_private_pickup
                : null;

            if (bootstrapState && typeof bootstrapState.reset === 'function') {
              bootstrapState.reset();
            }
          }, 0);
        }
      }
    });

    formsNamespace.__placeControllerServiceCleanupBound = true;
  }

  return true;
}

    function bootForms() {
    logPlacesBoot('bootForms-start', {
      readyState: document.readyState
    });

    bootReservationRequestForm();
    bootContactServiceState();
    bootContactServiceSwitcher();
    bootContactAirportHotelEditor();
    bootContactAirportHotelLodgingAdapter();
    bootContactTourPrivateEditor();
    bootPanelHandoffSummary();
    bindToursPanelHandoff();
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