(function initEventsSpecialAddressModule(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  var NAMESPACE = window.PixkuyServicesEventsSpecialAddress = window.PixkuyServicesEventsSpecialAddress || {};
  var DEFAULT_FIELD_NAME = 'event_special_user_address';

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
  
  function getFieldName(options) {
    var safeOptions = isObject(options) ? options : {};
    return normalizeText(safeOptions.fieldName) || DEFAULT_FIELD_NAME;
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
  
  function ensureAutocompleteVisible(root) {
    if (!root || window.innerWidth <= 720) {
      return;
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var rect = root.getBoundingClientRect();
        var estimatedPanelHeight = 220;
        var bottomSafeOffset = 132;
        var bottomLimit = window.innerHeight - bottomSafeOffset;
        var projectedBottom = rect.bottom + estimatedPanelHeight;

        if (projectedBottom <= bottomLimit) {
          return;
        }

        window.scrollTo({
          top: Math.max(window.scrollY + projectedBottom - bottomLimit + 18, 0),
          behavior: 'smooth'
        });
      });
    });
  }

  function blurActiveElementInside(node) {
    var activeElement = document.activeElement;

    if (
      node &&
      activeElement &&
      typeof activeElement.blur === 'function' &&
      node.contains(activeElement)
    ) {
      activeElement.blur();
      return true;
    }

    return false;
  }

  function buildAddressMarkup(options) {
    var safeOptions = isObject(options) ? options : {};
    var fieldName = getFieldName(safeOptions);
    var inputId = normalizeText(safeOptions.inputId) || 'services-events-address';
    var label = normalizeText(safeOptions.label);
    var placeholder = normalizeText(safeOptions.placeholder);
    var value = typeof safeOptions.value === 'string'
      ? safeOptions.value.replace(/"/g, '&quot;')
      : '';

    return '' +
      '<label class="services-events-panel__label" for="' + inputId + '">' + label + '</label>' +
      '<div class="place-autocomplete services-events-panel__address-autocomplete" data-place-autocomplete="' + fieldName + '" data-place-language-source="document" data-services-events-address-root>' +
        '<input' +
          ' id="' + inputId + '"' +
          ' type="text"' +
          ' class="services-events-panel__control"' +
          ' autocomplete="off"' +
          ' value="' + value + '"' +
          ' placeholder="' + placeholder.replace(/"/g, '&quot;') + '"' +
          ' name="' + fieldName + '"' +
          ' data-place-input="' + fieldName + '"' +
          ' data-services-events-address-input' +
        ' />' +
        '<button' +
          ' type="button"' +
          ' class="place-autocomplete__clear"' +
          ' data-place-clear="' + fieldName + '"' +
          ' aria-label="Clear address"' +
          ' hidden' +
        '>' +
          '<span aria-hidden="true">&times;</span>' +
        '</button>' +
        '<div' +
          ' class="place-autocomplete__mount"' +
          ' data-place-mount="' + fieldName + '"' +
          ' data-services-events-address-mount' +
        '></div>' +
      '</div>';
  }

  function mount(options) {
    var safeOptions = isObject(options) ? options : {};
    var fieldName = getFieldName(safeOptions);
    var root = safeOptions.root || null;
    var input = safeOptions.input || null;
    var mountNode = safeOptions.mountNode || null;
    var autocompleteRoot = root && typeof root.querySelector === 'function'
      ? root.querySelector('[data-place-autocomplete="' + fieldName + '"]')
      : null;
    var autocompleteInput = root && typeof root.querySelector === 'function'
      ? root.querySelector('[data-place-input="' + fieldName + '"]')
      : null;
    var autocompleteMount = root && typeof root.querySelector === 'function'
      ? root.querySelector('[data-place-mount="' + fieldName + '"]')
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
      ensureAutocompleteVisible(root);
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('focus', function () {
      ensureAutocompleteVisible(root);
    });

    controller = placesApi.createAutocompleteController({
      fieldName: fieldName,
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

        blurActiveElementInside(mountNode);

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

  NAMESPACE.buildAddressMarkup = buildAddressMarkup;
  NAMESPACE.mount = mount;
})(window, document);