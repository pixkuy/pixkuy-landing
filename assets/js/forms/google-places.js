(function (window, document) {
  'use strict';

  var NAMESPACE = window.PixkuyForms = window.PixkuyForms || {};
  var coverageApi = NAMESPACE.coverage || null;
  var loaderPromise = null;
  var placesLibraryPromise = null;
  var placesLibraryModule = null;

  var SCRIPT_ID = 'pixkuy-google-maps-js';
  var DEFAULT_LANGUAGE = 'es';
  var DEFAULT_REGION = 'mx';
  var DEFAULT_SCRIPT_VERSION = 'weekly';
  var DEFAULT_PLACE_FIELDS = [
    'displayName',
    'formattedAddress',
    'location',
    'addressComponents',
    'types'
  ];
  var DEFAULT_LOCATION_RESTRICTION = {
  north: 21.2000,
  south: 18.8000,
  west: -101.1000,
  east: -98.2000
};
  
  function isFunction(value) {
    return typeof value === 'function';
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function getString(value) {
    return isNonEmptyString(value) ? value.trim() : '';
  }

  function normalizeLanguage(value) {
    return getString(value || DEFAULT_LANGUAGE).toLowerCase();
  }

  function normalizeRegion(value) {
    return getString(value || DEFAULT_REGION).toLowerCase();
  }

  function getArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toUrlSearch(params) {
    var searchParams = new window.URLSearchParams();
    var keys = Object.keys(params || {});
    var index;
    var key;
    var value;

    for (index = 0; index < keys.length; index += 1) {
      key = keys[index];
      value = params[key];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      searchParams.set(key, value);
    }

    return searchParams.toString();
  }

  function getGoogleMapsApiKey(config) {
    if (isObject(config) && isNonEmptyString(config.apiKey)) {
      return config.apiKey.trim();
    }

    if (isNonEmptyString(window.PIXKUY_GOOGLE_MAPS_API_KEY)) {
      return window.PIXKUY_GOOGLE_MAPS_API_KEY.trim();
    }

    if (isNonEmptyString(window.GOOGLE_MAPS_API_KEY)) {
      return window.GOOGLE_MAPS_API_KEY.trim();
    }

    return '';
  }

  function buildGoogleMapsScriptUrl(config, callbackName) {
  var apiKey = getGoogleMapsApiKey(config);
  var language = normalizeLanguage(config && config.language);
  var region = normalizeRegion(config && config.region);
  var version = getString(config && config.version) || DEFAULT_SCRIPT_VERSION;

  if (!apiKey) {
    return '';
  }

  return 'https://maps.googleapis.com/maps/api/js?' + toUrlSearch({
    key: apiKey,
    v: version,
    loading: 'async',
    language: language,
    region: region,
    callback: callbackName
  });
}

  function loadGoogleMapsApi(config) {
  var existingScript;
  var callbackName = '__pixkuyGoogleMapsInit';

  if (window.google && window.google.maps && isFunction(window.google.maps.importLibrary)) {
    return Promise.resolve(window.google.maps);
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  existingScript = document.getElementById(SCRIPT_ID);

  loaderPromise = new Promise(function (resolve, reject) {
    var script;
    var settled = false;
    var scriptUrl = buildGoogleMapsScriptUrl(config, callbackName);

    if (!scriptUrl) {
      reject(new Error('Missing Google Maps API key.'));
      return;
    }

    function cleanup() {
      if (window[callbackName] === handleCallback) {
        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
      }

      if (script) {
        script.removeEventListener('error', handleError);
      }
    }

    function resolveIfReady() {
      if (window.google && window.google.maps && isFunction(window.google.maps.importLibrary)) {
        settled = true;
        cleanup();
        resolve(window.google.maps);
        return true;
      }

      return false;
    }

    function handleCallback() {
      if (resolveIfReady()) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error('Google Maps API callback fired without importLibrary.'));
    }

    function handleError() {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error('Failed to load Google Maps API.'));
    }

    window[callbackName] = handleCallback;

    if (existingScript) {
      script = existingScript;

      if (window.google && window.google.maps && isFunction(window.google.maps.importLibrary)) {
        settled = true;
        cleanup();
        resolve(window.google.maps);
        return;
      }

      script.addEventListener('error', handleError, { once: true });
      return;
    }

    script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return loaderPromise;
}

  function loadPlacesLibrary(config) {
    if (placesLibraryModule) {
  return Promise.resolve(placesLibraryModule);
}

if (placesLibraryPromise) {
  return placesLibraryPromise;
}

    placesLibraryPromise = loadGoogleMapsApi(config).then(function () {

  return window.google.maps.importLibrary('places').then(function (library) {
    placesLibraryModule = library;
    return library;
  });
});

    return placesLibraryPromise;
  }

  function getLatValue(location) {
    if (!location) {
      return null;
    }

    if (typeof location.lat === 'number') {
      return location.lat;
    }

    if (isFunction(location.lat)) {
      return location.lat();
    }

    return null;
  }

  function getLngValue(location) {
    if (!location) {
      return null;
    }

    if (typeof location.lng === 'number') {
      return location.lng;
    }

    if (isFunction(location.lng)) {
      return location.lng();
    }

    return null;
  }

  function mapAddressComponents(addressComponents) {
    return getArray(addressComponents).map(function (component) {
      return {
        longText: getString(component && (component.longText || component.long_name)),
        shortText: getString(component && (component.shortText || component.short_name)),
        types: getArray(component && component.types)
      };
    });
  }

  function getAddressComponentValue(addressComponents, type, preferredKey) {
    var components = getArray(addressComponents);
    var index;
    var component;
    var types;

    for (index = 0; index < components.length; index += 1) {
      component = components[index] || {};
      types = getArray(component.types);

      if (types.indexOf(type) !== -1) {
        if (preferredKey === 'short') {
          return getString(component.shortText || component.short_name || component.longText || component.long_name);
        }

        return getString(component.longText || component.long_name || component.shortText || component.short_name);
      }
    }

    return '';
  }

  function getAirportIataFromAddressComponents(addressComponents) {
    return getAddressComponentValue(addressComponents, 'airport', 'short').toUpperCase();
  }

  function buildAirportDisplayName(displayName, formattedAddress, iataCode) {
    var name = getString(displayName);
    var address = getString(formattedAddress);
    var code = getString(iataCode).toUpperCase();

    if (code && name && name.toUpperCase().indexOf('(' + code + ')') === -1) {
      name += ' (' + code + ')';
    }

    if (name && address && address.toLowerCase().indexOf(name.toLowerCase()) === -1) {
      return name + ', ' + address;
    }

    return name || address;
  }

  function buildGenericDisplayLabel(displayName, formattedAddress) {
    var name = getString(displayName);
    var address = getString(formattedAddress);

    if (name && address && address.toLowerCase().indexOf(name.toLowerCase()) === -1) {
      return name + ', ' + address;
    }

    return name || address;
  }

  function normalizePlace(place, prediction) {
    var json = isFunction(place && place.toJSON) ? place.toJSON() : {};
    var addressComponents = mapAddressComponents(
      json.addressComponents || place.addressComponents || []
    );
    var displayName = getString(
      (json.displayName && (json.displayName.text || json.displayName)) ||
      (place.displayName && (place.displayName.text || place.displayName))
    );
    var formattedAddress = getString(json.formattedAddress || place.formattedAddress);
    var location = json.location || place.location || null;
    var types = getArray(json.types || place.types);
    var countryCode = getAddressComponentValue(addressComponents, 'country', 'short').toLowerCase();
    var administrativeAreaLevel1 = getAddressComponentValue(addressComponents, 'administrative_area_level_1');
    var locality = getAddressComponentValue(addressComponents, 'locality');
    var iataCode = getAirportIataFromAddressComponents(addressComponents);
    var primaryText = getString(prediction && prediction.text && prediction.text.text);
    var secondaryText = '';
    var label;

    if (prediction && prediction.structuredFormat) {
      primaryText = getString(
        prediction.structuredFormat.mainText &&
        prediction.structuredFormat.mainText.text
      ) || primaryText;

      secondaryText = getString(
        prediction.structuredFormat.secondaryText &&
        prediction.structuredFormat.secondaryText.text
      );
    }

    label = types.indexOf('airport') !== -1 || iataCode
      ? buildAirportDisplayName(displayName || primaryText, formattedAddress || secondaryText, iataCode)
      : buildGenericDisplayLabel(displayName || primaryText, formattedAddress || secondaryText);

    return {
      label: label,
      displayName: displayName || primaryText,
      formattedAddress: formattedAddress || secondaryText,
      primaryText: primaryText,
      secondaryText: secondaryText,
      text: getString(prediction && prediction.text && prediction.text.text),
      placeId: getString(json.id || place.id || (prediction && prediction.placeId)),
      lat: getLatValue(location),
      lng: getLngValue(location),
      location: {
        lat: getLatValue(location),
        lng: getLngValue(location)
      },
      addressComponents: addressComponents,
      types: types,
      countryCode: countryCode,
      administrativeAreaLevel1: administrativeAreaLevel1,
      locality: locality,
      iataCode: iataCode
    };
  }

  function writeHiddenValue(input, value) {
    if (!input) {
      return;
    }

    input.value = value === null || value === undefined ? '' : String(value);
  }

  function getPlaceContainer(input) {
    if (!input || !isFunction(input.closest)) {
      return null;
    }

    return input.closest('[data-place-autocomplete]');
  }

  function setPlaceContainerState(input, stateName, enabled) {
    var container = getPlaceContainer(input);

    if (!container || !isNonEmptyString(stateName)) {
      return;
    }

    container.classList.toggle(stateName, Boolean(enabled));
  }

  function setPlaceContainerStates(input, states) {
    var stateName;

    if (!input || !states || typeof states !== 'object') {
      return;
    }

    for (stateName in states) {
      if (Object.prototype.hasOwnProperty.call(states, stateName)) {
        setPlaceContainerState(input, stateName, states[stateName]);
      }
    }
  }

  function syncControllerUiState(controller, partialState) {
    var widget;
    var isReady;
    var isOpen;
    var isLoading;
    var isFallback;

    if (!controller || !controller.input || !controller.state) {
      return;
    }

    if (partialState && typeof partialState === 'object') {
      if (Object.prototype.hasOwnProperty.call(partialState, 'isReady')) {
        controller.state.isReady = Boolean(partialState.isReady);
      }

      if (Object.prototype.hasOwnProperty.call(partialState, 'isOpen')) {
        controller.state.isOpen = Boolean(partialState.isOpen);
      }

      if (Object.prototype.hasOwnProperty.call(partialState, 'isLoading')) {
        controller.state.isLoading = Boolean(partialState.isLoading);
      }

      if (Object.prototype.hasOwnProperty.call(partialState, 'isFallback')) {
        controller.state.isFallback = Boolean(partialState.isFallback);
      }
    }

    widget = controller.state.widget;
    isReady = Boolean(controller.state.isReady);
    isOpen = Boolean(controller.state.isOpen && isReady && !controller.state.isFallback);
    isLoading = Boolean(controller.state.isLoading);
    isFallback = Boolean(controller.state.isFallback);

    setPlaceContainerStates(controller.input, {
      'is-loading': isLoading,
      'is-ready': isReady,
      'is-open': isOpen,
      'is-fallback': isFallback
    });

    if (widget && typeof widget.setAttribute === 'function') {
      widget.setAttribute('data-place-ready', isReady ? '1' : '0');
      widget.setAttribute('data-place-open', isOpen ? '1' : '0');
      widget.setAttribute('data-place-fallback', isFallback ? '1' : '0');
    }
  }

  function syncWidgetValueToLegacyInput(widget, input) {
    var widgetValue = '';

    if (!input) {
      return;
    }

    if (widget && 'value' in widget) {
      try {
        widgetValue = widget.value || '';
      } catch (error) {
        widgetValue = '';
      }
    }

    input.value = widgetValue;
  }
  
  function focusWidgetInnerInput(widget) {
    var innerInput = null;

    function collapseSelectionToEnd(targetInput) {
      var end;

      if (!targetInput || typeof targetInput.value !== 'string' || !isFunction(targetInput.setSelectionRange)) {
        return false;
      }

      try {
        end = targetInput.value.length;
        targetInput.setSelectionRange(end, end);
        return true;
      } catch (error) {
        return false;
      }
    }

    if (!widget) {
      return false;
    }

    try {
      innerInput = widget.shadowRoot && widget.shadowRoot.querySelector('input');
    } catch (error) {
      innerInput = null;
    }

    if (innerInput && isFunction(innerInput.focus)) {
      try {
        innerInput.focus();
        collapseSelectionToEnd(innerInput);

        window.requestAnimationFrame(function () {
          collapseSelectionToEnd(innerInput);

          window.setTimeout(function () {
            collapseSelectionToEnd(innerInput);
          }, 0);
        });

        return true;
      } catch (error) {
        return false;
      }
    }

    if (isFunction(widget.focus)) {
      try {
        widget.focus();
        return true;
      } catch (error) {
        return false;
      }
    }

    return false;
  }
  
  function syncReservationRequestUiFromInput(input) {
    var formsNamespace;
    var form;
    var fields;

    if (!input) {
      return;
    }

    formsNamespace = window.PixkuyForms || {};
    form = input.form || (isFunction(input.closest) ? input.closest('form') : null);

    if (!form) {
      return;
    }

    if (
      isFunction(formsNamespace.getReservationRequestFields) &&
      isFunction(formsNamespace.syncReservationRequestState)
    ) {
      fields = formsNamespace.getReservationRequestFields(form);

      if (fields) {
        formsNamespace.syncReservationRequestState(fields);

        if (isFunction(formsNamespace.refreshReservationRequestValidationUX)) {
          formsNamespace.refreshReservationRequestValidationUX(fields, input.name);
        }
      }
    }
  }

  function clearHiddenFields(hiddenFields) {
    if (!isObject(hiddenFields)) {
      return;
    }

    writeHiddenValue(hiddenFields.placeId, '');
    writeHiddenValue(hiddenFields.lat, '');
    writeHiddenValue(hiddenFields.lng, '');
  }

  function writePlaceToHiddenFields(hiddenFields, place) {
    if (!isObject(hiddenFields)) {
      return;
    }

    writeHiddenValue(hiddenFields.placeId, place && place.placeId);
    writeHiddenValue(hiddenFields.lat, place && place.lat);
    writeHiddenValue(hiddenFields.lng, place && place.lng);
  }

  function resolveCoverageApi(options) {
    if (isObject(options) && isObject(options.coverageApi)) {
      return options.coverageApi;
    }

    return NAMESPACE.coverage || coverageApi || null;
  }

  function getCoverageDecision(place, options) {
    var api = resolveCoverageApi(options);

    if (!api || !isFunction(api.getCoverageDecision)) {
      return {
        isWithinCoverage: true,
        isAllowedPrimaryArea: false,
        isAllowedAirport: false,
        countryCode: '',
        administrativeAreaLevel1: '',
        airportIataCode: ''
      };
    }

    return api.getCoverageDecision(place);
  }

  function attachManualEditReset(widget, controller) {
    if (!widget || !controller) {
      return function () {};
    }

    function handleManualEdit() {
      syncWidgetValueToLegacyInput(widget, controller.input);
      syncReservationRequestUiFromInput(controller.input);

      if (!controller.state.selectedPlace) {
        syncControllerUiState(controller, {
          isOpen: true,
          isFallback: false
        });
        return;
      }

      controller.clearSelection({
        preserveInputValue: true,
        reason: 'manual-edit'
      });

      syncControllerUiState(controller, {
        isOpen: true,
        isFallback: false
      });
    }

    widget.addEventListener('input', handleManualEdit);

    return function detach() {
      widget.removeEventListener('input', handleManualEdit);
    };
  }

  function createWidgetElement(options) {
    var library = placesLibraryModule;
    var element;
    var language = normalizeLanguage(options && options.language);
    var region = normalizeRegion(options && options.region);
    var locationRestriction = (options && options.locationRestriction) || DEFAULT_LOCATION_RESTRICTION;
    var includedRegionCodes = getArray(options && options.includedRegionCodes);

    if (!library || !library.PlaceAutocompleteElement) {
  
  throw new Error('Places library not ready or PlaceAutocompleteElement unavailable.');
}

    element = new library.PlaceAutocompleteElement({});
    element.setAttribute('requested-language', language);
    element.setAttribute('requested-region', region);

    if (locationRestriction) {
      element.locationRestriction = locationRestriction;
    }

    if (includedRegionCodes.length) {
      element.includedRegionCodes = includedRegionCodes;
    }

    return element;
  }

  function createAutocompleteController(options) {
    var controller = {
      options: options || {},
      state: {
        widget: null,
        selectedPlace: null,
        isReady: false,
        isOpen: false,
        isLoading: false,
        isFallback: false,
        isDestroyed: false
      },
      detachManualEditListener: null,
      detachSelectListener: null,
      mountNode: options && options.mountNode ? options.mountNode : null,
      input: options && options.input ? options.input : null,
      hiddenFields: isObject(options && options.hiddenFields) ? options.hiddenFields : {},
      onReady: isFunction(options && options.onReady) ? options.onReady : function () {},
      onSelection: isFunction(options && options.onSelection) ? options.onSelection : function () {},
      onCoverageReject: isFunction(options && options.onCoverageReject) ? options.onCoverageReject : function () {},
      onManualFallback: isFunction(options && options.onManualFallback) ? options.onManualFallback : function () {},
      onError: isFunction(options && options.onError) ? options.onError : function () {}
    };

    controller.clearSelection = function clearSelection(meta) {
      clearHiddenFields(controller.hiddenFields);
      controller.state.selectedPlace = null;
      controller.state.isOpen = false;

      if (!meta || !meta.preserveInputValue) {
        if (controller.state.widget && 'value' in controller.state.widget) {
          try {
            controller.state.widget.value = '';
          } catch (error) {
            // no-op
          }
        }
      }

      syncWidgetValueToLegacyInput(controller.state.widget, controller.input);
      syncReservationRequestUiFromInput(controller.input);

      syncControllerUiState(controller, {
        isOpen: false
      });

      controller.onSelection(null, meta || {});
    };

    controller.destroy = function destroy() {
      controller.state.isDestroyed = true;

      if (isFunction(controller.detachManualEditListener)) {
        controller.detachManualEditListener();
        controller.detachManualEditListener = null;
      }

      if (isFunction(controller.detachSelectListener)) {
        controller.detachSelectListener();
        controller.detachSelectListener = null;
      }

      if (controller.state.widget && controller.state.widget.parentNode) {
        controller.state.widget.parentNode.removeChild(controller.state.widget);
      }

      controller.state.widget = null;
      controller.state.selectedPlace = null;
      controller.state.isReady = false;
      controller.state.isOpen = false;
      controller.state.isLoading = false;
      controller.state.isFallback = false;

      if (controller.input) {
        controller.input.removeAttribute('tabindex');
        controller.input.removeAttribute('aria-hidden');
        controller.input.readOnly = false;
      }

      syncControllerUiState(controller, {
        isReady: false,
        isOpen: false,
        isLoading: false,
        isFallback: false
      });
    };

    controller.mount = function mount() {
      var initialQuery = getString(controller.input && controller.input.value);
	  
	  if (!controller.mountNode || !controller.input) {
         controller.onError(new Error('Missing mountNode or input for Google Places controller.'));
         return Promise.resolve(false);
}

      controller.state.isDestroyed = false;
      controller.state.isLoading = true;
      controller.state.isFallback = false;
      controller.state.isOpen = false;

      syncControllerUiState(controller, {
        isLoading: true,
        isFallback: false,
        isOpen: false
      });

      return loadPlacesLibrary(controller.options).then(function () {
        var widget = createWidgetElement(controller.options);
		
        function handleSelect(event) {
          var placePrediction = event && (event.placePrediction || (event.detail && event.detail.placePrediction));
          var place;
          var normalizedPlace;
          var coverageDecision;

          if (!placePrediction || !isFunction(placePrediction.toPlace)) {
               controller.onError(new Error('Google Places selection did not include a valid place prediction.'));
              return;
}

          place = placePrediction.toPlace();
          
place.fetchFields({
  fields: controller.options.placeFields || DEFAULT_PLACE_FIELDS
}).then(function () {
            normalizedPlace = normalizePlace(place, placePrediction);
            coverageDecision = getCoverageDecision(normalizedPlace, controller.options);
					
            if (!coverageDecision.isWithinCoverage) {
              controller.clearSelection({
                preserveInputValue: false,
                reason: 'out-of-coverage',
                place: normalizedPlace,
                coverageDecision: coverageDecision
              });

              controller.onCoverageReject(normalizedPlace, coverageDecision);
              return;
            }

            controller.state.selectedPlace = normalizedPlace;
            writePlaceToHiddenFields(controller.hiddenFields, normalizedPlace);

            controller.state.isOpen = false;
            controller.state.isFallback = false;

            if (controller.state.widget && 'value' in controller.state.widget) {
              try {
                controller.state.widget.value = normalizedPlace.label;
              } catch (error) {
                // no-op
              }
            }

            syncWidgetValueToLegacyInput(controller.state.widget, controller.input);
            syncReservationRequestUiFromInput(controller.input);

            syncControllerUiState(controller, {
              isReady: true,
              isOpen: false,
              isFallback: false
            });

            controller.onSelection(normalizedPlace, {
              reason: 'google-select',
              coverageDecision: coverageDecision
            });
          }).catch(function (error) {
            controller.onError(error);
          });
        }
		
		controller.mountNode.innerHTML = '';
        controller.mountNode.appendChild(widget);			
        controller.state.widget = widget;					
        controller.state.isReady = true;
        controller.state.isLoading = false;
        controller.state.isFallback = false;
        controller.state.isOpen = false;

        if (initialQuery && 'value' in widget) {
  try {
    widget.value = initialQuery;   
  } catch (error) {    
  }
}

syncWidgetValueToLegacyInput(widget, controller.input);

syncControllerUiState(controller, {
  isReady: true,
  isLoading: false,
  isFallback: false,
  isOpen: Boolean(initialQuery)
});

window.requestAnimationFrame(function () {
  window.requestAnimationFrame(function () {
    focusWidgetInnerInput(widget);
  });
});

        widget.addEventListener('gmp-select', handleSelect);
        controller.detachSelectListener = function detachSelectListener() {
          widget.removeEventListener('gmp-select', handleSelect);
        };

        function handleWidgetFocus() {
  if (controller.input) {
    controller.input.setAttribute('tabindex', '-1');
    controller.input.setAttribute('aria-hidden', 'true');
    controller.input.readOnly = true;
  }

  syncControllerUiState(controller, {
    isOpen: true,
    isFallback: false
  });
}

        function handleWidgetBlur() {
  window.setTimeout(function () {
    if (controller.state.isDestroyed) {
      return;
    }

    if (!controller.state.selectedPlace && controller.input) {
      controller.input.removeAttribute('tabindex');
      controller.input.removeAttribute('aria-hidden');
      controller.input.readOnly = false;
    }

    syncControllerUiState(controller, {
      isOpen: false
    });
  }, 120);
}

        function handleWidgetInput() {
          syncControllerUiState(controller, {
            isOpen: true,
            isFallback: false
          });
        }

        widget.addEventListener('focusin', handleWidgetFocus);
        widget.addEventListener('focusout', handleWidgetBlur);
        widget.addEventListener('input', handleWidgetInput);

        controller.detachManualEditListener = (function () {
          var detachReset = attachManualEditReset(widget, controller);

          return function detachAll() {
            detachReset();
            widget.removeEventListener('focusin', handleWidgetFocus);
            widget.removeEventListener('focusout', handleWidgetBlur);
            widget.removeEventListener('input', handleWidgetInput);
          };
        })();

controller.onReady(widget);
return true;
      }).catch(function (error) {
        controller.state.isReady = false;
        controller.state.isLoading = false;
        controller.state.isFallback = true;
        controller.state.isOpen = false;				 

        if (controller.input) {
          controller.input.removeAttribute('tabindex');
          controller.input.removeAttribute('aria-hidden');
          controller.input.readOnly = false;
        }

        syncControllerUiState(controller, {
          isReady: false,
          isLoading: false,
          isFallback: true,
          isOpen: false
        });

        controller.onManualFallback(error);
        return false;
      });
    };

    return controller;
  }

  NAMESPACE.googlePlaces = {
    DEFAULT_LOCATION_RESTRICTION: DEFAULT_LOCATION_RESTRICTION,
    loadGoogleMapsApi: loadGoogleMapsApi,
    loadPlacesLibrary: loadPlacesLibrary,
    normalizePlace: normalizePlace,
    clearHiddenFields: clearHiddenFields,
    writePlaceToHiddenFields: writePlaceToHiddenFields,
    getCoverageDecision: getCoverageDecision,
    createAutocompleteController: createAutocompleteController
  };
})(window, document);