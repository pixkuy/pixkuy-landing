(function () {
  "use strict";

  const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 220;
const MAX_RESULTS = 6;
const INCLUDED_REGION_CODES = ["mx"];
const SEARCH_PRIMARY_TYPES = [
  "hotel",
  "lodging",
  "resort_hotel",
  "extended_stay_hotel",
  "bed_and_breakfast"
];
const GOOGLE_PLACES_READY_TIMEOUT_MS = 4000;
const GOOGLE_PLACES_READY_RETRY_MS = 120;

  let debounceTimer = null;
  let activeRequestId = 0;
  let currentSessionToken = "";
  let currentInput = null;
  const boundInputs = new Set();

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  
  function debugTrace() {
    return;
  }

  function debugCoverage() {
    return;
  }

  function getAutocompleteUi() {
    const ui = window.PixkuyAirportLodgingAutocomplete;
    if (!ui || typeof ui !== "object") {
      return null;
    }

    return ui;
  }
  
  function getDestinationBridge() {
  const bridge = window.PixkuyAirportDestination;
  if (!bridge || typeof bridge !== "object") {
    return null;
  }

  return bridge;
}

  function getLodgingPolicy() {
    const policy = window.PixkuyAirportLodgingTypes;
    if (!policy || typeof policy !== "object") {
      return null;
    }

    return policy;
  }
  
    function getCoverageApi() {
    const formsNamespace = window.PixkuyForms;
    if (!formsNamespace || typeof formsNamespace !== "object") {
      return null;
    }

    const coverage = formsNamespace.coverage;
    if (!coverage || typeof coverage !== "object") {
      return null;
    }

    return coverage;
  }

  function getCoverageDecisionForPoint(lat, lng) {
    const coverage = getCoverageApi();
    if (!coverage || typeof coverage.getCoverageDecision !== "function") {
      return null;
    }

    return coverage.getCoverageDecision({
      lat: lat,
      lng: lng
    });
  }

  function isPointWithinOperationalCoverage(lat, lng) {
    const decision = getCoverageDecisionForPoint(lat, lng);

    if (!decision || typeof decision !== "object") {
      return false;
    }

    return decision.allowed !== false;
  }
  
  
  
    function getSharedGooglePlacesApi() {
    const formsNamespace = window.PixkuyForms;
    if (!formsNamespace || typeof formsNamespace !== "object") {
      return null;
    }

    const api = formsNamespace.googlePlaces;
    if (!api || typeof api !== "object") {
      return null;
    }

    return api;
  }
  
    function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }
  
    function traceSharedGooglePlacesApiSnapshot(source) {
    const formsNamespace = window.PixkuyForms;
    const api =
      formsNamespace && typeof formsNamespace === "object"
        ? formsNamespace.googlePlaces
        : null;

    debugTrace("shared-api:snapshot", {
      source: source,
      hasPixkuyFormsNamespace: !!formsNamespace,
      exists: !!api,
      type: typeof api,
      keys: api && typeof api === "object" ? Object.keys(api) : [],
      hasLoadPlacesLibrary:
        !!(api && typeof api.loadPlacesLibrary === "function"),
      hasCreateAutocompleteController:
        !!(api && typeof api.createAutocompleteController === "function"),
      hasLoadGoogleMapsApi:
        !!(api && typeof api.loadGoogleMapsApi === "function")
    });
  }

  async function waitForSharedGooglePlacesApi() {
    const startedAt = Date.now();
    let lastSnapshotKey = "";

    debugTrace("waitForSharedGooglePlacesApi:start", {
      timeoutMs: GOOGLE_PLACES_READY_TIMEOUT_MS,
      retryMs: GOOGLE_PLACES_READY_RETRY_MS
    });
    traceSharedGooglePlacesApiSnapshot("wait-start");

    while (Date.now() - startedAt < GOOGLE_PLACES_READY_TIMEOUT_MS) {
      const api = getSharedGooglePlacesApi();

      const snapshot = {
        exists: !!api,
        hasLoadPlacesLibrary:
          !!(api && typeof api.loadPlacesLibrary === "function"),
        hasCreateAutocompleteController:
          !!(api && typeof api.createAutocompleteController === "function"),
        hasLoadGoogleMapsApi:
          !!(api && typeof api.loadGoogleMapsApi === "function")
      };

      const snapshotKey = JSON.stringify(snapshot);
      if (snapshotKey !== lastSnapshotKey) {
        lastSnapshotKey = snapshotKey;
        debugTrace("waitForSharedGooglePlacesApi:state-change", snapshot);
        traceSharedGooglePlacesApiSnapshot("wait-state-change");
      }

      if (
        api &&
        typeof api.loadPlacesLibrary === "function" &&
        typeof api.createAutocompleteController === "function"
      ) {
        debugTrace("waitForSharedGooglePlacesApi:ready", {
          elapsedMs: Date.now() - startedAt
        });
        return api;
      }

      await wait(GOOGLE_PLACES_READY_RETRY_MS);
    }

    debugTrace("waitForSharedGooglePlacesApi:timeout", {
      elapsedMs: Date.now() - startedAt
    });
    traceSharedGooglePlacesApiSnapshot("wait-timeout");

    throw new Error("shared-google-places-api-unavailable");
  }

  async function ensureSharedGooglePlacesReady() {
    const api = await waitForSharedGooglePlacesApi();

    debugTrace("ensureSharedGooglePlacesReady:api-ready", {
      hasLoadPlacesLibrary:
        typeof api.loadPlacesLibrary === "function",
      hasCreateAutocompleteController:
        typeof api.createAutocompleteController === "function",
      hasLoadGoogleMapsApi:
        typeof api.loadGoogleMapsApi === "function"
    });

    if (typeof api.loadPlacesLibrary === "function") {
      debugTrace("ensureSharedGooglePlacesReady:using-loader", {
        loader: "loadPlacesLibrary"
      });
      await api.loadPlacesLibrary();
      debugTrace("ensureSharedGooglePlacesReady:loader-ok", {
        loader: "loadPlacesLibrary"
      });
      return api;
    }

    debugTrace("ensureSharedGooglePlacesReady:loader-missing");
    throw new Error("shared-google-places-loader-unavailable");
  }

  async function createSessionToken() {
    const api = await ensureSharedGooglePlacesReady();
    const library = await api.loadPlacesLibrary();

    if (
      !library ||
      typeof library.AutocompleteSessionToken !== "function"
    ) {
      throw new Error("google-autocomplete-session-token-unavailable");
    }

    return new library.AutocompleteSessionToken();
  }

  async function ensureSessionToken() {
    if (!currentSessionToken) {
      currentSessionToken = await createSessionToken();
    }

    return currentSessionToken;
  }
  
  function resetSessionToken() {
    currentSessionToken = "";
  }

  function getActiveRootId() {
    const ui = getAutocompleteUi();
    if (!ui || typeof ui.getActiveRootId !== "function") {
      return "1";
    }

    const rootId = normalizeText(ui.getActiveRootId());
    return rootId || "1";
  }

  function getPanelInput(rootId) {
    const resolvedRootId = normalizeText(rootId) || getActiveRootId();
    return document.querySelector(
      '[data-airport-lodging-input="' + String(resolvedRootId) + '"]'
    );
  }

  function getPrimaryType(placeLike) {
    if (!placeLike || typeof placeLike !== "object") {
      return "";
    }

    if (typeof placeLike.primaryType === "string") {
      return placeLike.primaryType.trim().toLowerCase();
    }

    if (Array.isArray(placeLike.types) && placeLike.types.length > 0) {
      return typeof placeLike.types[0] === "string"
        ? placeLike.types[0].trim().toLowerCase()
        : "";
    }

    return "";
  }

  function getDisplayName(placeLike) {
    if (!placeLike || typeof placeLike !== "object") {
      return "";
    }

    if (
      placeLike.displayName &&
      typeof placeLike.displayName === "object" &&
      typeof placeLike.displayName.text === "string"
    ) {
      return normalizeText(placeLike.displayName.text);
    }

    if (typeof placeLike.displayName === "string") {
      return normalizeText(placeLike.displayName);
    }

    if (typeof placeLike.text === "string") {
      return normalizeText(placeLike.text);
    }

    return "";
  }

  function getFormattedAddress(placeLike) {
    if (!placeLike || typeof placeLike !== "object") {
      return "";
    }

    if (typeof placeLike.formattedAddress === "string") {
      return normalizeText(placeLike.formattedAddress);
    }

    if (typeof placeLike.secondaryText === "string") {
      return normalizeText(placeLike.secondaryText);
    }

    if (
      placeLike.structuredFormat &&
      typeof placeLike.structuredFormat === "object" &&
      typeof placeLike.structuredFormat.secondaryText === "string"
    ) {
      return normalizeText(placeLike.structuredFormat.secondaryText);
    }

    return "";
  }

  function buildVisibleLabel(displayName, formattedAddress) {
    const name = normalizeText(displayName);
    const address = normalizeText(formattedAddress);

    if (name && address) {
      return name + " — " + address;
    }

    if (name) {
      return name;
    }

    return address;
  }

  function normalizeSuggestionToItem(placeLike, coordinates) {
    if (!placeLike || !coordinates) {
      return null;
    }

    const primaryType = getPrimaryType(placeLike);
    const displayName = getDisplayName(placeLike);
    const formattedAddress = getFormattedAddress(placeLike);
    const label = buildVisibleLabel(displayName, formattedAddress);

    if (!label) {
      return null;
    }

    if (
      typeof coordinates.lat !== "number" ||
      !Number.isFinite(coordinates.lat) ||
      typeof coordinates.lng !== "number" ||
      !Number.isFinite(coordinates.lng)
    ) {
      return null;
    }

    return {
      label: label,
      primaryType: primaryType,
      lat: coordinates.lat,
      lng: coordinates.lng
    };
  }

  function isAcceptedPlace(placeLike) {
    const policy = getLodgingPolicy();
    if (!policy || typeof policy.isAcceptedLodgingPrimaryType !== "function") {
      return false;
    }

    const primaryType = getPrimaryType(placeLike);
    if (!primaryType) {
      return false;
    }

    return policy.isAcceptedLodgingPrimaryType(primaryType);
  }

  async function fetchSuggestions(query) {
    const api = await ensureSharedGooglePlacesReady();
    const library = await api.loadPlacesLibrary();
    const sessionToken = await ensureSessionToken();

    const request = {
  input: query,
  sessionToken: sessionToken,
  includedRegionCodes: INCLUDED_REGION_CODES,
  includedPrimaryTypes: SEARCH_PRIMARY_TYPES,
  locationRestriction: {
    west: -99.35,
    south: 19.15,
    east: -98.90,
    north: 19.65
  }
};

    debugTrace("fetchSuggestions:request", {
      query: query,
      hasSessionToken: !!sessionToken,
      sessionTokenConstructor:
        sessionToken && sessionToken.constructor ? sessionToken.constructor.name : "",
      request: request,
      hasAutocompleteSuggestion:
        !!(
          library &&
          library.AutocompleteSuggestion &&
          typeof library.AutocompleteSuggestion.fetchAutocompleteSuggestions === "function"
        )
    });

    if (
      !library ||
      !library.AutocompleteSuggestion ||
      typeof library.AutocompleteSuggestion.fetchAutocompleteSuggestions !== "function"
    ) {
      throw new Error("google-autocomplete-suggestion-api-unavailable");
    }

    const response =
      await library.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

    const suggestions =
      response && Array.isArray(response.suggestions) ? response.suggestions : [];

    debugTrace("fetchSuggestions:response", {
      totalSuggestions: suggestions.length
    });

    return suggestions
      .slice(0, MAX_RESULTS)
      .map(function (suggestion) {
        return suggestion && suggestion.placePrediction ? suggestion : {
          placePrediction: suggestion
        };
      });
  }

  async function fetchPlaceCoordinates(placeInstance) {
    if (!placeInstance || typeof placeInstance !== "object") {
      return null;
    }

    if (
      placeInstance.location &&
      typeof placeInstance.location.lat === "number" &&
      typeof placeInstance.location.lng === "number"
    ) {
      return {
        lat: placeInstance.location.lat,
        lng: placeInstance.location.lng
      };
    }

    if (
      typeof placeInstance.lat === "number" &&
      Number.isFinite(placeInstance.lat) &&
      typeof placeInstance.lng === "number" &&
      Number.isFinite(placeInstance.lng)
    ) {
      return {
        lat: placeInstance.lat,
        lng: placeInstance.lng
      };
    }

    return null;
  }

  async function resolveSuggestionToPlace(suggestion) {
    const api = await ensureSharedGooglePlacesReady();
    const placePrediction =
      suggestion && suggestion.placePrediction ? suggestion.placePrediction : suggestion;

    let place;

    if (!placePrediction || typeof placePrediction.toPlace !== "function") {
      throw new Error("google-suggestion-cannot-be-resolved");
    }

    place = placePrediction.toPlace();

    if (!place || typeof place.fetchFields !== "function") {
      throw new Error("google-place-details-api-unavailable");
    }

    await place.fetchFields({
      fields: ["displayName", "formattedAddress", "location", "primaryType", "types"]
    });

    if (typeof api.normalizePlace !== "function") {
      throw new Error("shared-google-places-normalizer-unavailable");
    }

    return api.normalizePlace(place, placePrediction);
  }

  async function transformSuggestionsToItems(suggestions) {
    const items = [];

    debugTrace("transformSuggestionsToItems:start", {
      totalSuggestions: Array.isArray(suggestions) ? suggestions.length : 0
    });

    for (let index = 0; index < suggestions.length; index += 1) {
      const suggestion = suggestions[index];

      if (!suggestion) {
        debugTrace("transformSuggestionsToItems:discard", {
          index: index,
          reason: "missing-suggestion"
        });
        continue;
      }

      const place = await resolveSuggestionToPlace(suggestion);
      const coordinates = await fetchPlaceCoordinates(place);
      if (!coordinates) {
        debugTrace("transformSuggestionsToItems:discard", {
          index: index,
          reason: "missing-coordinates"
        });
        continue;
      }

      if (!isAcceptedPlace(place)) {
        debugTrace("transformSuggestionsToItems:discard", {
          index: index,
          reason: "unsupported-primary-type",
          primaryType:
            place && typeof place.primaryType === "string" ? place.primaryType : ""
        });
        continue;
      }

      if (!isPointWithinOperationalCoverage(coordinates.lat, coordinates.lng)) {
        debugTrace("transformSuggestionsToItems:discard", {
          index: index,
          reason: "outside-operational-coverage",
          lat: coordinates.lat,
          lng: coordinates.lng
        });
        debugCoverage("outside-operational-coverage", {
          index: index,
          lat: coordinates.lat,
          lng: coordinates.lng,
          label:
            place && typeof place.label === "string"
              ? place.label
              : place && typeof place.displayName === "string"
                ? place.displayName
                : ""
        });
        continue;
      }

      const item = normalizeSuggestionToItem(place, coordinates);
      if (!item) {
        debugTrace("transformSuggestionsToItems:discard", {
          index: index,
          reason: "normalize-failed"
        });
        continue;
      }

      items.push(item);

      debugTrace("transformSuggestionsToItems:accepted", {
        index: index,
        label: item.label,
        primaryType: item.primaryType
      });

      if (items.length >= MAX_RESULTS) {
        break;
      }
    }

    debugTrace("transformSuggestionsToItems:end", {
      acceptedItems: items.length
    });

    return items;
  }

  async function runSearch(query, requestId) {
    const ui = getAutocompleteUi();
    if (!ui) {
      debugTrace("runSearch:ui-missing", {
        query: query,
        requestId: requestId
      });
      return;
    }

    debugTrace("runSearch:start", {
      query: query,
      requestId: requestId,
      activeRequestId: activeRequestId
    });

    try {
      ui.setLoading(true);

      const suggestions = await fetchSuggestions(query);
      const items = await transformSuggestionsToItems(suggestions);

      if (requestId !== activeRequestId) {
        debugTrace("runSearch:stale-request", {
          query: query,
          requestId: requestId,
          activeRequestId: activeRequestId
        });
        return;
      }

      ui.setLoading(false);
      ui.setResults(items);
      resetSessionToken();

      debugTrace("runSearch:success", {
        query: query,
        requestId: requestId,
        items: items.length
      });
    } catch (error) {
      if (requestId !== activeRequestId) {
        debugTrace("runSearch:stale-error", {
          query: query,
          requestId: requestId,
          activeRequestId: activeRequestId,
          error: error && error.message ? error.message : String(error)
        });
        return;
      }

      ui.setLoading(false);
      ui.clearResults();

      debugTrace("runSearch:error", {
        query: query,
        requestId: requestId,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  function clearSearch() {
    const ui = getAutocompleteUi();
    if (!ui) {
      return;
    }

    activeRequestId += 1;
    ui.setLoading(false);
    ui.clearResults();
    resetSessionToken();
  }
  
    async function applySelection(item) {
    const ui = getAutocompleteUi();
    if (!ui || !item) {
      debugTrace("applySelection:missing-ui-or-item", {
        hasUi: !!ui,
        hasItem: !!item
      });
      return;
    }

    debugTrace("applySelection:start", {
      label: item.label,
      lat: item.lat,
      lng: item.lng,
      primaryType: item.primaryType
    });

    clearSearch();
    ui.setQuery(item.label);

    const destinationBridge = getDestinationBridge();
    if (!destinationBridge || typeof destinationBridge.resolveAndApplyDestination !== "function") {
      debugTrace("applySelection:bridge-unavailable");
      return;
    }

    try {
      ui.setLoading(true);
      await destinationBridge.resolveAndApplyDestination(item);
      ui.setLoading(false);
      resetSessionToken();
      debugTrace("applySelection:success", {
        label: item.label
      });
    } catch (error) {
      ui.setLoading(false);
      ui.clearResults();
      debugTrace("applySelection:error", {
        label: item.label,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  function onInputChanged() {
    const ui = getAutocompleteUi();
    if (!ui) {
      debugTrace("onInputChanged:ui-missing");
      return;
    }

    const query = normalizeText(ui.getQuery());

    debugTrace("onInputChanged", {
      query: query,
      queryLength: query.length
    });

    window.clearTimeout(debounceTimer);

    if (query.length < MIN_QUERY_LENGTH) {
      debugTrace("onInputChanged:below-min-length", {
        query: query,
        minQueryLength: MIN_QUERY_LENGTH
      });
      clearSearch();
      return;
    }

    debounceTimer = window.setTimeout(function () {
      activeRequestId += 1;
      debugTrace("onInputChanged:debounced-run", {
        query: query,
        requestId: activeRequestId
      });
      runSearch(query, activeRequestId);
    }, DEBOUNCE_MS);
  }

  function bindInputListener(rootId) {
    const resolvedRootId = normalizeText(rootId) || getActiveRootId();
    const input = getPanelInput(resolvedRootId);
    if (!input) {
      return;
    }

    const bindingKey = String(resolvedRootId);
    if (boundInputs.has(bindingKey)) {
      if (currentInput !== input && document.activeElement === input) {
        currentInput = input;
      }
      return;
    }

    boundInputs.add(bindingKey);
    input.dataset.airportLodgingPlacesBound = "1";

    input.addEventListener("focus", function () {
      currentInput = input;
      ensureSharedGooglePlacesReady().catch(function () {
        return null;
      });
    });

    input.addEventListener("input", function () {
      currentInput = input;
      onInputChanged();
    });

    if (document.activeElement === input) {
      currentInput = input;
    }
  }

  function observeInputMount() {
    const observer = new MutationObserver(function () {
      bindInputListener("0");
      bindInputListener("1");

      const leftReady = !!getPanelInput("0");
      const rightReady = !!getPanelInput("1");

      if (leftReady && rightReady) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    bindInputListener("0");
    bindInputListener("1");
  }

  function initAirportLodgingPlaces() {
    const ui = getAutocompleteUi();
    const policy = getLodgingPolicy();

    if (!ui || !policy) {
      return;
    }

    if (typeof ui.setOnSelect === "function") {
      ui.setOnSelect(function (item) {
        applySelection(item);
      });
    }

    bindInputListener("0");
    bindInputListener("1");
    observeInputMount();
  }

  window.PixkuyAirportLodgingPlaces = {
    init: initAirportLodgingPlaces,
    clearSearch: clearSearch
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAirportLodgingPlaces, {
      once: true
    });
  } else {
    initAirportLodgingPlaces();
  }
})();