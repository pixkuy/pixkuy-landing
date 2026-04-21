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
  
    function getCoverageApi() {
    var namespace = window.PixkuyForms || {};
    return namespace.coverage || null;
  }

   function getCoverageDecisionSafe(place, options) {
    var resolvedCoverageApi = resolveCoverageApi(options);

    if (!resolvedCoverageApi || !isFunction(resolvedCoverageApi.getCoverageDecision)) {
      throw new Error('Coverage API is not available.');
    }

    return resolvedCoverageApi.getCoverageDecision(place);
  }
  
  function appendFacadeDebug() {}
  
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

    if (name && address) {
      if (address.toLowerCase().indexOf(name.toLowerCase()) === -1) {
        return name + ', ' + address;
      }

      return address;
    }

    return address || name;
  }

  function getVisibleSelectedPlaceLabel(place) {
    var displayName = getString(place && place.displayName);
    var formattedAddress = getString(place && place.formattedAddress);
    var label = getString(place && place.label);

    if (displayName && formattedAddress) {
      if (formattedAddress.toLowerCase().indexOf(displayName.toLowerCase()) === -1) {
        return displayName + ', ' + formattedAddress;
      }

      return formattedAddress;
    }

    return label || formattedAddress || displayName;
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

    function adaptMobileAutocompleteSuggestion(rawSuggestion) {
    var suggestion;
    var placePrediction;
    var structuredFormat;
    var mainText;
    var secondaryText;
    var textValue;
    var placeId;

    suggestion = isObject(rawSuggestion) ? rawSuggestion : {};
    placePrediction = isObject(suggestion.placePrediction) ? suggestion.placePrediction : suggestion;
    structuredFormat = isObject(placePrediction.structuredFormat)
      ? placePrediction.structuredFormat
      : (isObject(placePrediction.structuredFormatting) ? placePrediction.structuredFormatting : {});

    mainText = getString(
      structuredFormat.mainText && structuredFormat.mainText.text
        ? structuredFormat.mainText.text
        : (structuredFormat.mainText || '')
    );

    secondaryText = getString(
      structuredFormat.secondaryText && structuredFormat.secondaryText.text
        ? structuredFormat.secondaryText.text
        : (structuredFormat.secondaryText || '')
    );

    textValue = getString(
      placePrediction.text && placePrediction.text.text
        ? placePrediction.text.text
        : (placePrediction.text || '')
    );

    placeId = getString(
      placePrediction.placeId ||
      suggestion.placeId ||
      suggestion.id
    );

    return {
      placePrediction: placePrediction,
      placeId: placeId,
      text: {
        text: textValue || mainText
      },
      structuredFormat: {
        mainText: {
          text: mainText || textValue
        },
        secondaryText: {
          text: secondaryText
        }
      },
      displayName: mainText || textValue,
      secondaryText: secondaryText
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
  
    function shouldUseMobileAutocompleteStrategy() {
    var hasCoarsePointer;
    var hasTouchPoints;
    var isNarrowViewport;

    hasCoarsePointer = false;
    hasTouchPoints = false;
    isNarrowViewport = false;

    try {
      hasCoarsePointer = Boolean(
        window.matchMedia &&
        window.matchMedia('(pointer: coarse)').matches
      );
    } catch (error) {
      hasCoarsePointer = false;
    }

    try {
      hasTouchPoints = Boolean(
        navigator &&
        typeof navigator.maxTouchPoints === 'number' &&
        navigator.maxTouchPoints > 0
      );
    } catch (error) {
      hasTouchPoints = false;
    }

    try {
      isNarrowViewport = Boolean(
        window.matchMedia &&
        window.matchMedia('(max-width: 720px)').matches
      );
    } catch (error) {
      isNarrowViewport = false;
    }

    return Boolean(isNarrowViewport && (hasCoarsePointer || hasTouchPoints));
  }

  function getDesktopAutocompleteControllerFactory() {
    if (!window.PixkuyForms || typeof window.PixkuyForms.createDesktopPlacesAutocompleteController !== 'function') {
      return null;
    }

    return window.PixkuyForms.createDesktopPlacesAutocompleteController;
  }

  function getMobileAutocompleteControllerFactory() {
    if (!window.PixkuyForms || typeof window.PixkuyForms.createMobilePlacesAutocompleteController !== 'function') {
      return null;
    }

    return window.PixkuyForms.createMobilePlacesAutocompleteController;
  }
  
  function getProgrammaticAutocompleteControllerFactory() {
    if (!window.PixkuyForms || typeof window.PixkuyForms.createProgrammaticPlacesController !== 'function') {
      return null;
    }

    return window.PixkuyForms.createProgrammaticPlacesController;
  }
  
  function syncReservationRequestUiFromInput(input) {
    var formsNamespace;
    var form;
    var fields;
    var validationFieldName;

    if (!input) {
      return;
    }

    formsNamespace = window.PixkuyForms || {};
    form = input.form || (isFunction(input.closest) ? input.closest('form') : null);

    if (!form) {
      return;
    }

    validationFieldName = getString(input.name);

    if (!validationFieldName && isFunction(input.getAttribute)) {
      validationFieldName = getString(input.getAttribute('data-place-input'));
    }

    if (
      isFunction(formsNamespace.getReservationRequestFields) &&
      isFunction(formsNamespace.syncReservationRequestState)
    ) {
      fields = formsNamespace.getReservationRequestFields(form);

      if (fields) {
        formsNamespace.syncReservationRequestState(fields);

        if (
          validationFieldName &&
          isFunction(formsNamespace.refreshReservationRequestValidationUX)
        ) {
          formsNamespace.refreshReservationRequestValidationUX(fields, validationFieldName);
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
  
    function resolveLocationRestriction(options) {
    if (isObject(options) && isObject(options.locationRestriction)) {
      return options.locationRestriction;
    }

    return DEFAULT_LOCATION_RESTRICTION;
  }
  
    function buildSuggestionCoverageProbe(suggestion) {
    var placePrediction;
    var structuredFormat;
    var mainText;
    var secondaryText;
    var combinedText;
    var lowerCombinedText;
    var iataMatch;

    placePrediction = isObject(suggestion && suggestion.placePrediction)
      ? suggestion.placePrediction
      : (isObject(suggestion) ? suggestion : {});

    structuredFormat = isObject(placePrediction.structuredFormat)
      ? placePrediction.structuredFormat
      : (isObject(placePrediction.structuredFormatting) ? placePrediction.structuredFormatting : {});

    mainText = getString(
      structuredFormat.mainText && structuredFormat.mainText.text
        ? structuredFormat.mainText.text
        : (structuredFormat.mainText || '')
    );

    secondaryText = getString(
      structuredFormat.secondaryText && structuredFormat.secondaryText.text
        ? structuredFormat.secondaryText.text
        : (structuredFormat.secondaryText || '')
    );

    combinedText = (mainText + ' ' + secondaryText).trim();
    lowerCombinedText = combinedText.toLowerCase();
    iataMatch = lowerCombinedText.match(/\b(mex|nlu|aifa|tol|tlc|pbc|qro)\b/i);

    return {
      label: combinedText,
      displayName: mainText,
      formattedAddress: secondaryText,
      primaryText: mainText,
      secondaryText: secondaryText,
      text: combinedText,
      placeId: getString(placePrediction.placeId || suggestion && suggestion.placeId || suggestion && suggestion.id),
      countryCode: (
        lowerCombinedText.indexOf('mex') !== -1 ||
        lowerCombinedText.indexOf('méxico') !== -1 ||
        lowerCombinedText.indexOf('mexico') !== -1
      ) ? 'mx' : '',
      administrativeAreaLevel1: secondaryText,
      locality: secondaryText,
      iataCode: iataMatch ? iataMatch[1].toUpperCase() : '',
      types: []
    };
  }

  function isSuggestionWithinCoverage(suggestion, options) {
    var probePlace;
    var decision;

    try {
      probePlace = buildSuggestionCoverageProbe(suggestion);
      decision = getCoverageDecisionSafe(probePlace, options);
      return Boolean(decision && decision.isWithinCoverage);
    } catch (error) {
      return true;
    }
  }


    function buildMobileAutocompleteDebugMessage(error) {
    var message = getString(error && error.message);

    if (!message) {
      message = 'Unknown mobile autocomplete error.';
    }

    return '[DEBUG Places móvil] ' + message;
  }

    function createAutocompleteController(options) {
    var controller;
    var strategyController;
    var root;
    var desktopFactory;
    var mobileFactory;
    var useMobileStrategy;

    options = options || {};

    controller = {
      options: options,
      state: {
        widget: null,
        selectedPlace: null,
        isReady: false,
        isOpen: false,
        isLoading: false,
        isFallback: false,
        isDestroyed: false
      },
      mountNode: options.mountNode || null,
      input: options.input || null,
      fieldName: getString(options.fieldName),
      hiddenFields: isObject(options.hiddenFields) ? options.hiddenFields : {},
      onReady: isFunction(options.onReady) ? options.onReady : function () {},
      onSelection: isFunction(options.onSelection) ? options.onSelection : function () {},
      onCoverageReject: isFunction(options.onCoverageReject) ? options.onCoverageReject : function () {},
      onManualFallback: isFunction(options.onManualFallback) ? options.onManualFallback : function () {},
      onError: isFunction(options.onError) ? options.onError : function () {}
    };

        root = getPlaceContainer(controller.input) || controller.mountNode;
    useMobileStrategy = false;

    function syncFacadeUiState(partialState) {
      syncControllerUiState(controller, partialState);
    }

    function clearSelectedPlace(meta) {
      var nextMeta = meta || {};
      var shouldPreserveInputValue = nextMeta.preserveInputValue === true;

      clearHiddenFields(controller.hiddenFields);
      controller.state.selectedPlace = null;
      controller.state.isOpen = false;

      if (
        strategyController &&
        isFunction(strategyController.clearVisibleValue) &&
        !shouldPreserveInputValue
      ) {
        strategyController.clearVisibleValue();
      } else if (controller.input && !shouldPreserveInputValue) {
        controller.input.value = '';
      }

      syncReservationRequestUiFromInput(controller.input);
      syncControllerUiState(controller, {
        isOpen: false
      });
      controller.onSelection(null, nextMeta);
    }
	
    function handleManualInput(value) {
      if (controller.input && typeof value === 'string' && controller.input.value !== value) {
        controller.input.value = value;
      }

      clearSelectedPlace({
        preserveInputValue: true,
        reason: 'manual-edit'
      });
    }

    function handleResolvedPlace(normalizedPlace, meta) {
      var coverageDecision;
      var nextMeta;

      appendFacadeDebug('coverage-place-input', {
        fieldName: controller.input && controller.input.name ? controller.input.name : '',
        label: normalizedPlace && normalizedPlace.label ? normalizedPlace.label : '',
        displayName: normalizedPlace && normalizedPlace.displayName ? normalizedPlace.displayName : '',
        formattedAddress: normalizedPlace && normalizedPlace.formattedAddress ? normalizedPlace.formattedAddress : '',
        countryCode: normalizedPlace && normalizedPlace.countryCode ? normalizedPlace.countryCode : '',
        administrativeAreaLevel1: normalizedPlace && normalizedPlace.administrativeAreaLevel1 ? normalizedPlace.administrativeAreaLevel1 : '',
        locality: normalizedPlace && normalizedPlace.locality ? normalizedPlace.locality : '',
        iataCode: normalizedPlace && normalizedPlace.iataCode ? normalizedPlace.iataCode : '',
        types: normalizedPlace && Array.isArray(normalizedPlace.types) ? normalizedPlace.types : []
      });

      coverageDecision = getCoverageDecisionSafe(normalizedPlace, controller.options);

      appendFacadeDebug('coverage-decision', {
        fieldName: controller.input && controller.input.name ? controller.input.name : '',
        label: normalizedPlace && normalizedPlace.label ? normalizedPlace.label : '',
        isWithinCoverage: Boolean(coverageDecision && coverageDecision.isWithinCoverage),
        matchedRule: coverageDecision && coverageDecision.matchedRule ? coverageDecision.matchedRule : '',
        reason: coverageDecision && coverageDecision.reason ? coverageDecision.reason : ''
      });

            if (!coverageDecision.isWithinCoverage) {
        appendFacadeDebug('coverage-reject', {
          fieldName: controller.input && controller.input.name ? controller.input.name : '',
          label: normalizedPlace && normalizedPlace.label ? normalizedPlace.label : '',
          matchedRule: coverageDecision && coverageDecision.matchedRule ? coverageDecision.matchedRule : '',
          reason: coverageDecision && coverageDecision.reason ? coverageDecision.reason : ''
        });

        clearSelectedPlace({
          preserveInputValue: false,
          reason: 'out-of-coverage',
          place: normalizedPlace,
          coverageDecision: coverageDecision
        });

        controller.onCoverageReject(normalizedPlace, coverageDecision);
        return;
      }
	  
	  

      controller.state.selectedPlace = normalizedPlace;
      controller.state.isFallback = false;
      controller.state.isOpen = false;

      if (controller.input && normalizedPlace) {
        controller.input.value = getVisibleSelectedPlaceLabel(normalizedPlace);
      }

      writePlaceToHiddenFields(controller.hiddenFields, normalizedPlace);
      syncReservationRequestUiFromInput(controller.input);

      syncControllerUiState(controller, {
        isReady: true,
        isOpen: false,
        isFallback: false
      });

      nextMeta = meta || {};
      nextMeta.coverageDecision = coverageDecision;

      controller.onSelection(normalizedPlace, nextMeta);
    }
     
	        function handleControllerError(error) {
      clearSelectedPlace({
        preserveInputValue: true,
        reason: 'controller-error'
      });
      syncReservationRequestUiFromInput(controller.input);
      controller.onError(error);
    }
	
    function createMobileStrategy() {
      if (!isFunction(mobileFactory)) {
        throw new Error('Mobile Places controller factory is unavailable.');
      }

      return mobileFactory({
        root: root,
        input: controller.input,
        mountNode: controller.mountNode,
        fieldName: getString(controller.input && controller.input.name),
        debounceMs: 180,
        minQueryLength: 2,
        createSessionToken: function () {
          return loadPlacesLibrary(controller.options).then(function (library) {
            if (!library || !isFunction(library.AutocompleteSessionToken)) {
              throw new Error('Google AutocompleteSessionToken API is unavailable.');
            }

            return new library.AutocompleteSessionToken();
          });
        },
        fetchSuggestions: function (requestContext) {
          return loadPlacesLibrary(controller.options).then(function (library) {
            var request;
            var fetchPromise;

            if (!library || !library.AutocompleteSuggestion || !isFunction(library.AutocompleteSuggestion.fetchAutocompleteSuggestions)) {
              throw new Error('Google AutocompleteSuggestion API is unavailable.');
            }

                       request = {
              input: getString(requestContext && requestContext.input),
              language: normalizeLanguage(controller.options.language),
              region: normalizeRegion(controller.options.region),
              includedRegionCodes: ['mx']
            };

            if (requestContext && requestContext.sessionToken) {
              request.sessionToken = requestContext.sessionToken;
            }

            request.locationRestriction = resolveLocationRestriction(controller.options);
			
			            appendFacadeDebug('mobile-fetch-request', {
              fieldName: controller.input && controller.input.name ? controller.input.name : '',
              input: request.input,
              locationRestriction: request.locationRestriction || null,
              includedRegionCodes: request.includedRegionCodes || []
            });

            fetchPromise = library.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

            return Promise.resolve(fetchPromise).then(function (response) {
              var suggestions;

              suggestions = response && Array.isArray(response.suggestions)
                ? response.suggestions
                : [];

              appendFacadeDebug('mobile-fetch-filtered', {
                fieldName: controller.input && controller.input.name ? controller.input.name : '',
                rawCount: suggestions.length,
                filteredCount: suggestions.length
              });

              return suggestions.map(adaptMobileAutocompleteSuggestion);
            });
          });
        },
        resolveSuggestionToPlace: function (requestContext) {
          var suggestion = requestContext && requestContext.suggestion;
          var placePrediction;
          var place;

          placePrediction = suggestion && suggestion.placePrediction ? suggestion.placePrediction : suggestion;

          if (!placePrediction || !isFunction(placePrediction.toPlace)) {
            throw new Error('Google mobile suggestion cannot be resolved.');
          }

          place = placePrediction.toPlace();

          if (!place || !isFunction(place.fetchFields)) {
            throw new Error('Google place details API is unavailable.');
          }

          return Promise.resolve(place.fetchFields({
            fields: controller.options.placeFields || DEFAULT_PLACE_FIELDS
          })).then(function () {
            return normalizePlace(place, placePrediction);
          });
        },
        onPlaceSelected: function (normalizedPlace, meta) {
          handleResolvedPlace(normalizedPlace, meta || {
            reason: 'google-mobile-select'
          });
        },
        onClearSelection: function () {
          clearSelectedPlace({
            preserveInputValue: true,
            reason: 'clear-selection'
          });
        },
        onManualInput: handleManualInput,
        onError: function (error) {
          controller.onError(error);
        },
        onUiStateChange: function (state) {
          syncFacadeUiState(state);
        }
      });
    }

    function createDesktopStrategy() {
      if (!isFunction(desktopFactory)) {
        throw new Error('Desktop Places controller factory is unavailable.');
      }

      return desktopFactory({
        root: root,
        input: controller.input,
        mountNode: controller.mountNode,
        fieldName: controller.fieldName || getString(controller.input && controller.input.name),
        inputId: controller.input && controller.input.id ? controller.input.id : '',
        language: normalizeLanguage(controller.options.language),
        placeholder: controller.input && controller.input.getAttribute ? (controller.input.getAttribute('placeholder') || '') : '',
        loadPlacesLibrary: function () {
          return loadPlacesLibrary(controller.options);
        },
        resolvePlaceFromSelection: function (requestContext) {
          var selection = requestContext && requestContext.selection;
          var place;

          if (!selection || !isFunction(selection.toPlace)) {
            throw new Error('Google desktop selection cannot be resolved.');
          }

          place = selection.toPlace();

          if (!place || !isFunction(place.fetchFields)) {
            throw new Error('Google place details API is unavailable.');
          }

          return Promise.resolve(place.fetchFields({
            fields: controller.options.placeFields || DEFAULT_PLACE_FIELDS
          })).then(function () {
            return normalizePlace(place, selection);
          });
        },
        onPlaceSelected: function (normalizedPlace, meta) {
          handleResolvedPlace(normalizedPlace, meta || {
            reason: 'google-desktop-select'
          });
        },
        onClearSelection: function () {
          clearSelectedPlace({
            preserveInputValue: true,
            reason: 'clear-selection'
          });
        },
        onManualInput: handleManualInput,
        onError: function (error) {
          controller.onError(error);
        },
        onUiStateChange: function (state) {
          syncFacadeUiState(state);
        }
      });
    }

    function createDesktopProgrammaticStrategy() {
      if (!isFunction(desktopFactory)) {
        throw new Error('Desktop Places controller factory is unavailable.');
      }

      return desktopFactory({
        root: root,
        input: controller.input,
        mountNode: controller.mountNode,
        fieldName: controller.fieldName || getString(controller.input && controller.input.name),
        getAutocompleteSessionToken: function () {
          return loadPlacesLibrary(controller.options).then(function (library) {
            if (!library || !isFunction(library.AutocompleteSessionToken)) {
              throw new Error('Google AutocompleteSessionToken API is unavailable.');
            }

            return new library.AutocompleteSessionToken();
          });
        },
        fetchSuggestions: function (requestContext) {
          return loadPlacesLibrary(controller.options).then(function (library) {
            var request;
            var fetchPromise;

            if (!library || !library.AutocompleteSuggestion || !isFunction(library.AutocompleteSuggestion.fetchAutocompleteSuggestions)) {
              throw new Error('Google AutocompleteSuggestion API is unavailable.');
            }

            request = {
              input: getString(requestContext && requestContext.query),
              language: normalizeLanguage(controller.options.language),
              region: normalizeRegion(controller.options.region),
              includedRegionCodes: ['mx']
            };

            if (requestContext && requestContext.sessionToken) {
              request.sessionToken = requestContext.sessionToken;
            }

            request.locationRestriction = resolveLocationRestriction(controller.options);

            fetchPromise = library.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

            return Promise.resolve(fetchPromise).then(function (response) {
              var suggestions;

              suggestions = response && Array.isArray(response.suggestions)
                ? response.suggestions
                : [];

              return suggestions.map(adaptMobileAutocompleteSuggestion);
            });
          });
        },
        resolveSuggestionToPlace: function (requestContext) {
          var suggestion = requestContext && requestContext.suggestion;
          var placePrediction;
          var place;

          placePrediction = suggestion && suggestion.placePrediction ? suggestion.placePrediction : suggestion;

          if (!placePrediction || !isFunction(placePrediction.toPlace)) {
            throw new Error('Google programmatic desktop suggestion cannot be resolved.');
          }

          place = placePrediction.toPlace();

          if (!place || !isFunction(place.fetchFields)) {
            throw new Error('Google place details API is unavailable.');
          }

          return Promise.resolve(place.fetchFields({
            fields: controller.options.placeFields || DEFAULT_PLACE_FIELDS
          })).then(function () {
            return normalizePlace(place, placePrediction);
          });
        },
        onPlaceSelected: function (normalizedPlace, meta) {
          handleResolvedPlace(normalizedPlace, meta || {
            reason: 'google-desktop-programmatic-select'
          });
        },
        onCoverageReject: function (payload) {
          controller.onCoverageReject(payload);
        },
        onError: function (error) {
          handleControllerError(error);
        },
        onUiStateChange: function (state) {
          syncFacadeUiState(state);
        }
      });
    }
    controller.clearSelection = function clearSelection(meta) {
      clearSelectedPlace(meta);
    };

    controller.destroy = function destroy() {
      controller.state.isDestroyed = true;

      if (strategyController && isFunction(strategyController.destroy)) {
        strategyController.destroy();
      }

      strategyController = null;
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

    controller.close = function close() {
      if (strategyController && isFunction(strategyController.close)) {
        strategyController.close();
        return;
      }

      syncControllerUiState(controller, {
        isOpen: false
      });
    };

        controller.mount = function mount() {
      appendFacadeDebug('facade-mount-start', {
        fieldName: controller.input && controller.input.name ? controller.input.name : '',
        hasMountNode: Boolean(controller.mountNode),
        hasInput: Boolean(controller.input)
      });

      if (!controller.mountNode || !controller.input) {
        appendFacadeDebug('facade-mount-missing-deps', {
          fieldName: controller.input && controller.input.name ? controller.input.name : '',
          hasMountNode: Boolean(controller.mountNode),
          hasInput: Boolean(controller.input)
        });
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

      useMobileStrategy = shouldUseMobileAutocompleteStrategy();
	  
            desktopFactory = getDesktopAutocompleteControllerFactory();
      mobileFactory = getMobileAutocompleteControllerFactory();

      appendFacadeDebug('facade-strategy-decision', {
        fieldName: controller.input && controller.input.name ? controller.input.name : '',
        useMobileStrategy: Boolean(useMobileStrategy),
        hasDesktopFactory: Boolean(desktopFactory),
        hasMobileFactory: Boolean(mobileFactory),
        viewportWidth: window.innerWidth || null,
        maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : null
      });

            try {
        appendFacadeDebug('facade-strategy-create', {
          fieldName: controller.input && controller.input.name ? controller.input.name : '',
          strategy: useMobileStrategy ? 'mobile' : 'desktop'
        });

        strategyController = useMobileStrategy
          ? createMobileStrategy()
          : createDesktopProgrammaticStrategy();
      } catch (error) {
        appendFacadeDebug('facade-strategy-create-error', {
          fieldName: controller.input && controller.input.name ? controller.input.name : '',
          strategy: useMobileStrategy ? 'mobile' : 'desktop',
          message: error && error.message ? error.message : 'unknown'
        });
        controller.state.isReady = false;
        controller.state.isLoading = false;
        controller.state.isFallback = true;
        controller.state.isOpen = false;

        syncControllerUiState(controller, {
          isReady: false,
          isLoading: false,
          isFallback: true,
          isOpen: false
        });

        handleControllerError(error);
        controller.onManualFallback(error);
        return Promise.resolve(false);
      }

            return Promise.resolve(strategyController.mount()).then(function () {
        appendFacadeDebug('facade-strategy-mount-ok', {
          fieldName: controller.input && controller.input.name ? controller.input.name : '',
          strategy: useMobileStrategy ? 'mobile' : 'desktop'
        });

        controller.state.widget = strategyController.state && strategyController.state.widget
          ? strategyController.state.widget
          : null;

        if (controller.state.widget) {
          controller.onReady(controller.state.widget);
        } else {
          controller.onReady(strategyController);
        }

        return !controller.state.isFallback;
               }).catch(function (error) {
        appendFacadeDebug('facade-strategy-mount-error', {
          fieldName: controller.input && controller.input.name ? controller.input.name : '',
          strategy: useMobileStrategy ? 'mobile' : 'desktop',
          message: error && error.message ? error.message : 'unknown'
        });

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

        handleControllerError(error);
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
    getCoverageDecision: getCoverageDecisionSafe,
    createAutocompleteController: createAutocompleteController
  };
})(window, document);