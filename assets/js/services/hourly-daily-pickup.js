(function initHourlyDailyPickupModule(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  var NAMESPACE = window.PixkuyServicesHourlyDailyPickup = window.PixkuyServicesHourlyDailyPickup || {};

  function noop() {}

  function isFunction(value) {
    return typeof value === 'function';
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
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

  function getPlacesApi() {
    return window.PixkuyForms &&
      window.PixkuyForms.googlePlaces &&
      typeof window.PixkuyForms.googlePlaces.createAutocompleteController === 'function'
      ? window.PixkuyForms.googlePlaces
      : null;
  }

  function buildPickupMarkup(options) {
    var safeOptions = isObject(options) ? options : {};
    var inputId = normalizeText(safeOptions.inputId) || 'services-hourly-pickup';
    var label = normalizeText(safeOptions.label);
    var placeholder = normalizeText(safeOptions.placeholder);
    var value = typeof safeOptions.value === 'string'
      ? safeOptions.value.replace(/"/g, '&quot;')
      : '';

    return '' +
      '<label class="services-hourly-panel__label" for="' + inputId + '">' + label + '</label>' +
      '<div class="place-autocomplete services-hourly-panel__pickup-autocomplete" data-place-autocomplete="hourly_daily_pickup" data-place-language-source="document" data-services-hourly-pickup-root>' +
        '<input' +
          ' id="' + inputId + '"' +
          ' type="text"' +
          ' class="services-hourly-panel__control"' +
          ' autocomplete="off"' +
          ' value="' + value + '"' +
          ' placeholder="' + placeholder.replace(/"/g, '&quot;') + '"' +
          ' name="hourly_daily_pickup"' +
          ' data-place-input="hourly_daily_pickup"' +
          ' data-services-hourly-pickup-input' +
        ' />' +
        '<button' +
          ' type="button"' +
          ' class="place-autocomplete__clear"' +
          ' data-place-clear="hourly_daily_pickup"' +
          ' aria-label="Clear pickup"' +
          ' hidden' +
        '>' +
          '<span aria-hidden="true">×</span>' +
        '</button>' +
        '<div' +
          ' class="place-autocomplete__mount"' +
          ' data-place-mount="hourly_daily_pickup"' +
          ' data-services-hourly-pickup-mount' +
          ' aria-hidden="true"' +
        '></div>' +
      '</div>';
  }

  function mount(options) {
    var safeOptions = isObject(options) ? options : {};
    var root = safeOptions.root || null;
    var input = safeOptions.input || null;
    var mountNode = safeOptions.mountNode || null;
    var autocompleteRoot = root && typeof root.querySelector === 'function'
      ? root.querySelector('[data-place-autocomplete="hourly_daily_pickup"]')
      : null;
    var autocompleteInput = root && typeof root.querySelector === 'function'
      ? root.querySelector('[data-place-input="hourly_daily_pickup"]')
      : null;
    var autocompleteMount = root && typeof root.querySelector === 'function'
      ? root.querySelector('[data-place-mount="hourly_daily_pickup"]')
      : null;
    var onManualInput = isFunction(safeOptions.onManualInput) ? safeOptions.onManualInput : noop;
    var onPlaceSelected = isFunction(safeOptions.onPlaceSelected) ? safeOptions.onPlaceSelected : noop;
    var onClearSelection = isFunction(safeOptions.onClearSelection) ? safeOptions.onClearSelection : noop;
    var onError = isFunction(safeOptions.onError) ? safeOptions.onError : noop;
    var placesApi = getPlacesApi();
    var controller;
    var destroyed = false;
    var handleInput;

    root = autocompleteRoot || root;
    input = autocompleteInput || input;
    mountNode = autocompleteMount || mountNode;

    if (!root || !input || !mountNode || !placesApi) {
      return null;
    }

    handleInput = function () {
      if (destroyed) {
        return;
      }

      onManualInput(input.value || '');
    };

    input.addEventListener('input', handleInput);

    controller = placesApi.createAutocompleteController({
      fieldName: 'hourly_daily_pickup',
      input: input,
      mountNode: mountNode,
      hiddenFields: {},
      language: normalizeGoogleLanguage(
        normalizeText(safeOptions.language) || getDocumentLanguage()
      ),
      region: 'mx',
      includedRegionCodes: ['mx'],
      onSelection: function (selectedPlace, meta) {
        var safeMeta = isObject(meta) ? meta : {};
        var shouldPreserveVisibleInput = safeMeta.preserveInputValue === true;

        if (!selectedPlace) {
          if (!shouldPreserveVisibleInput) {
            onClearSelection();
          }
          return;
        }

        onPlaceSelected(selectedPlace, safeMeta);
      },
      onError: function (error) {
        onError(error);
      }
    });

    controller.mount();

    return {
      destroy: function destroy() {
        if (destroyed) {
          return false;
        }

        destroyed = true;
        input.removeEventListener('input', handleInput);

        if (controller && typeof controller.destroy === 'function') {
          controller.destroy();
        }

        return true;
      }
    };
  }

  NAMESPACE.buildPickupMarkup = buildPickupMarkup;
  NAMESPACE.mount = mount;
})(window, document);