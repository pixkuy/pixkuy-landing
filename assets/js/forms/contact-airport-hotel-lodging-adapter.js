(function initContactAirportHotelLodgingAdapterModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});
  const MIN_QUERY_LENGTH = 3;
  const DEBOUNCE_MS = 220;
  const MAX_RESULTS = 6;
  const INCLUDED_REGION_CODES = ["mx"];
  const LOCATION_RESTRICTION = {
    west: -99.35,
    south: 19.15,
    east: -98.90,
    north: 19.65
  };

  // Subconjunto corto y seguro para el request a Places.
  // El filtrado fino real sigue haciéndose después con PixkuyAirportLodgingTypes.
  const SEARCH_PRIMARY_TYPES = [
    "hotel",
    "lodging"
  ];

  let debounceTimer = null;
  let activeRequestId = 0;
  let currentSessionToken = null;
  let isCommittingSelection = false;

  function debugLog() {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      return NAMESPACE.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function getGooglePlacesApi() {
    const api = NAMESPACE.googlePlaces;
    return api && typeof api === "object" ? api : null;
  }

  function getLodgingTypesPolicy() {
    const policy = window.PixkuyAirportLodgingTypes;
    return policy && typeof policy === "object" ? policy : null;
  }
  
    function getCoverageApi() {
    const coverage = NAMESPACE.coverage;
    return coverage && typeof coverage === "object" ? coverage : null;
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

  function getEditorNodes(form) {
    if (!form) {
      return null;
    }

    const root = form.querySelector("[data-contact-airport-hotel-editor]");
    if (!root) {
      return null;
    }

    const hotelRoot = root.querySelector("[data-contact-airport-hotel-hotel-root]");
    const hotelInput = root.querySelector("[data-contact-airport-hotel-hotel-input]");
    const hotelMount = root.querySelector("[data-contact-airport-hotel-hotel-mount]");
    const hotelClear = root.querySelector("[data-contact-airport-hotel-hotel-clear]");

    if (!hotelRoot || !hotelInput || !hotelMount || !hotelClear) {
      debugLog("getEditorNodes:missing", {
        hasHotelRoot: !!hotelRoot,
        hasHotelInput: !!hotelInput,
        hasHotelMount: !!hotelMount,
        hasHotelClear: !!hotelClear
      });
      return null;
    }

    return {
      root: root,
      hotelRoot: hotelRoot,
      hotelInput: hotelInput,
      hotelMount: hotelMount,
      hotelClear: hotelClear
    };
  }

  function getI18nValue(path, fallback) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) {
      return fallback || "";
    }

    const parts = String(path).split(".");
    let cursor = dict;

    for (let index = 0; index < parts.length; index += 1) {
      const key = parts[index];

      if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
        return fallback || "";
      }

      cursor = cursor[key];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function ensureDom(nodes) {
    let panel = nodes.hotelMount.querySelector("[data-contact-airport-hotel-hotel-panel]");
    let status = nodes.hotelMount.querySelector("[data-contact-airport-hotel-hotel-status]");

    if (!panel) {
      panel = document.createElement("div");
      panel.className = "place-autocomplete__panel";
      panel.hidden = true;
      panel.setAttribute("role", "listbox");
      panel.setAttribute("data-contact-airport-hotel-hotel-panel", "1");
      nodes.hotelMount.appendChild(panel);
    }

    if (!status) {
      status = document.createElement("div");
      status.className = "place-autocomplete__status";
      status.hidden = true;
      status.setAttribute("data-contact-airport-hotel-hotel-status", "1");
      nodes.hotelMount.appendChild(status);
    }

    return {
      panel: panel,
      status: status
    };
  }

  function setStatus(dom, kind) {
    if (!dom || !dom.status) {
      return;
    }

    let text = "";
    let className = "place-autocomplete__status";

    if (kind === "loading") {
      text = getI18nValue(
        "services.cards.airport.panel.hotelStatusLoading",
        "Buscando alojamientos…"
      );
      className += " is-loading";
    } else if (kind === "empty") {
      text = getI18nValue(
        "services.cards.airport.panel.hotelStatusEmpty",
        "No se han encontrado alojamientos."
      );
      className += " is-empty";
    } else if (kind === "error") {
      text = getI18nValue(
        "services.cards.airport.panel.hotelStatusError",
        "No se ha podido cargar la búsqueda."
      );
      className += " is-error";
    }

    if (!text) {
      dom.status.hidden = true;
      dom.status.textContent = "";
      dom.status.className = "place-autocomplete__status";
      return;
    }

    dom.status.hidden = false;
    dom.status.textContent = text;
    dom.status.className = className;
  }

  function closePanel(nodes, dom) {
    if (!nodes || !dom || !dom.panel) {
      return false;
    }

    dom.panel.hidden = true;
    dom.panel.innerHTML = "";
    nodes.hotelRoot.classList.remove("is-open");
    nodes.hotelInput.setAttribute("aria-expanded", "false");
    nodes.hotelInput.removeAttribute("aria-activedescendant");
    return true;
  }

  function openPanel(nodes, dom) {
    if (!nodes || !dom || !dom.panel) {
      return false;
    }

    dom.panel.hidden = false;
    nodes.hotelRoot.classList.add("is-open");
    nodes.hotelInput.setAttribute("aria-expanded", "true");
    return true;
  }

  function clearResults(nodes, dom) {
    if (!dom || !dom.panel) {
      return false;
    }

    dom.panel.innerHTML = "";
    closePanel(nodes, dom);
    return true;
  }

  async function ensurePlacesLibrary() {
    const api = getGooglePlacesApi();

    if (!api || typeof api.loadPlacesLibrary !== "function") {
      throw new Error("shared-google-places-api-unavailable");
    }

    return api.loadPlacesLibrary();
  }

  async function ensureSessionToken() {
    if (currentSessionToken) {
      return currentSessionToken;
    }

    const library = await ensurePlacesLibrary();

    if (!library || typeof library.AutocompleteSessionToken !== "function") {
      throw new Error("google-autocomplete-session-token-unavailable");
    }

    currentSessionToken = new library.AutocompleteSessionToken();
    return currentSessionToken;
  }

  function resetSessionToken() {
    currentSessionToken = null;
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

  function buildVisibleLabel(placeLike) {
    const displayName =
      placeLike &&
      typeof placeLike.displayName === "string"
        ? normalizeText(placeLike.displayName)
        : "";

    const formattedAddress =
      placeLike &&
      typeof placeLike.formattedAddress === "string"
        ? normalizeText(placeLike.formattedAddress)
        : "";

    if (displayName && formattedAddress) {
      return displayName + " — " + formattedAddress;
    }

    return displayName || formattedAddress;
  }

  async function fetchSuggestions(query) {
    const api = getGooglePlacesApi();
    const library = await ensurePlacesLibrary();
    const sessionToken = await ensureSessionToken();

    if (
      !library ||
      !library.AutocompleteSuggestion ||
      typeof library.AutocompleteSuggestion.fetchAutocompleteSuggestions !== "function"
    ) {
      throw new Error("google-autocomplete-suggestion-api-unavailable");
    }

    debugLog("fetchSuggestions:request", {
      query: query,
      includedRegionCodes: INCLUDED_REGION_CODES.slice(),
      includedPrimaryTypes: SEARCH_PRIMARY_TYPES.slice(),
      locationRestriction: LOCATION_RESTRICTION
    });

    const response =
      await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: sessionToken,
        includedRegionCodes: INCLUDED_REGION_CODES,
        includedPrimaryTypes: SEARCH_PRIMARY_TYPES,
        locationRestriction: LOCATION_RESTRICTION
      });

    const suggestions =
      response && Array.isArray(response.suggestions) ? response.suggestions : [];

    if (!api || typeof api.normalizePlace !== "function") {
      throw new Error("shared-google-places-normalizer-unavailable");
    }

    const items = [];
    const policy = getLodgingTypesPolicy();

    for (let index = 0; index < suggestions.length; index += 1) {
      const suggestion = suggestions[index];
      const prediction = suggestion && suggestion.placePrediction ? suggestion.placePrediction : suggestion;

      if (!prediction || typeof prediction.toPlace !== "function") {
        continue;
      }

      const place = prediction.toPlace();

      if (!place || typeof place.fetchFields !== "function") {
        continue;
      }

      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location", "primaryType", "types"]
      });

      const normalized = api.normalizePlace(place, prediction);
      const primaryType = getPrimaryType(normalized);

      if (
        !policy ||
        typeof policy.isAcceptedLodgingPrimaryType !== "function" ||
        !policy.isAcceptedLodgingPrimaryType(primaryType)
      ) {
        continue;
      }

      const label = buildVisibleLabel(normalized);
      const lat =
        normalized &&
        typeof normalized.lat === "number" &&
        Number.isFinite(normalized.lat)
          ? normalized.lat
          : null;
      const lng =
        normalized &&
        typeof normalized.lng === "number" &&
        Number.isFinite(normalized.lng)
          ? normalized.lng
          : null;

      if (!label || lat === null || lng === null) {
        continue;
      }

      if (!isPointWithinOperationalCoverage(lat, lng)) {
        continue;
      }

      items.push({
        label: label,
        primaryType: primaryType,
        lat: lat,
        lng: lng
      });

      if (items.length >= MAX_RESULTS) {
        break;
      }
    }

    debugLog("fetchSuggestions:result", {
      suggestionsLength: suggestions.length,
      itemsLength: items.length
    });

    return items;
  }
  
    function createSelectionSettlement(nodes, dom, item) {
    let settled = false;
    let fallbackTimer = null;

    function cleanup() {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    }

    function settle(result) {
      if (settled) {
        return false;
      }

      settled = true;
      cleanup();

      const accepted = !!(result && result.accepted === true);

      if (accepted) {
        setStatus(dom, "");
        clearResults(nodes, dom);
        resetSessionToken();
        return true;
      }

      openPanel(nodes, dom);
      setStatus(dom, "");
      if (nodes && nodes.hotelInput) {
        nodes.hotelInput.focus();
      }

      debugLog("selection:settle-rejected", {
        label: item && item.label ? item.label : "",
        reason: result && typeof result.reason === "string" ? result.reason : ""
      });

      return false;
    }

    fallbackTimer = window.setTimeout(function () {
      settle({ accepted: true, reason: "fallback-timeout" });
    }, 400);

    return {
      settle: settle
    };
  }

  function renderResults(nodes, dom, items) {
    if (!dom || !dom.panel) {
      return false;
    }

    dom.panel.innerHTML = "";

    if (!Array.isArray(items) || !items.length) {
      clearResults(nodes, dom);
      setStatus(dom, "empty");
      return false;
    }

    items.forEach(function (item, index) {
      const row = document.createElement("div");
      row.className = "place-autocomplete__item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "place-autocomplete__item-button";
      button.setAttribute("role", "option");
      button.setAttribute("data-contact-airport-hotel-option-index", String(index));

      const title = document.createElement("span");
      title.className = "place-autocomplete__item-title";
      title.textContent = item.label;

      button.appendChild(title);
      row.appendChild(button);
      dom.panel.appendChild(row);
	  
	        button.addEventListener("click", function () {
        const settlement = createSelectionSettlement(nodes, dom, item);

        window.clearTimeout(debounceTimer);
        activeRequestId += 1;

        isCommittingSelection = true;

        nodes.root.dispatchEvent(
          new CustomEvent("pixkuy:contact-airport-hotel-selected", {
            bubbles: true,
            detail: {
              label: item.label,
              primaryType: item.primaryType,
              lat: item.lat,
              lng: item.lng,
              settleSelection: settlement.settle
            }
          })
        );

        isCommittingSelection = false;
      });


    });

    setStatus(dom, "");
    openPanel(nodes, dom);
    return true;
  }

  async function runSearch(nodes, dom, query, requestId) {
    try {
      setStatus(dom, "loading");
      const items = await fetchSuggestions(query);

      if (requestId !== activeRequestId) {
        return;
      }

      renderResults(nodes, dom, items);
      resetSessionToken();
    } catch (error) {
      if (requestId !== activeRequestId) {
        return;
      }

      debugLog("runSearch:error", {
        message: error && error.message ? error.message : "",
        name: error && error.name ? error.name : "",
        error: error || null
      });

      clearResults(nodes, dom);
      setStatus(dom, "error");
    }
  }

  function syncHotelClear(nodes) {
    if (!nodes.hotelInput || !nodes.hotelClear) {
      return false;
    }

    nodes.hotelClear.hidden = normalizeText(nodes.hotelInput.value) === "";
    return true;
  }
  
    function resetAdapterState(nodes, dom) {
    window.clearTimeout(debounceTimer);
    activeRequestId += 1;
    resetSessionToken();
    isCommittingSelection = false;

    if (nodes && nodes.hotelInput) {
      nodes.hotelInput.value = "";
      nodes.hotelInput.removeAttribute("aria-activedescendant");
      nodes.hotelInput.setAttribute("aria-expanded", "false");
    }

    syncHotelClear(nodes);
    clearResults(nodes, dom);
    setStatus(dom, "");

    debugLog("resetAdapterState:done", {
      activeRequestId: activeRequestId,
      hotelValue: nodes && nodes.hotelInput ? normalizeText(nodes.hotelInput.value) : "",
      hasSessionToken: !!currentSessionToken
    });

    return true;
  }

  function bindHotelAutocomplete(nodes, dom) {
    if (!nodes || !dom || nodes.hotelInput.dataset.contactAirportHotelAutocompleteBound === "1") {
      return false;
    }

    nodes.hotelInput.dataset.contactAirportHotelAutocompleteBound = "1";
    nodes.hotelInput.setAttribute("aria-autocomplete", "list");
    nodes.hotelInput.setAttribute("aria-expanded", "false");
    nodes.hotelInput.setAttribute("aria-haspopup", "listbox");

    nodes.hotelInput.addEventListener("focus", function () {
      if (normalizeText(nodes.hotelInput.value).length >= MIN_QUERY_LENGTH) {
        activeRequestId += 1;
        runSearch(nodes, dom, normalizeText(nodes.hotelInput.value), activeRequestId);
      }
    });

    nodes.hotelInput.addEventListener("input", function () {
      const query = normalizeText(nodes.hotelInput.value);
      syncHotelClear(nodes);
      window.clearTimeout(debounceTimer);

      debugLog("hotelInput:input", {
        query: query,
        length: query.length,
        isCommittingSelection: isCommittingSelection
      });

      if (isCommittingSelection) {
        clearResults(nodes, dom);
        setStatus(dom, "");
        return;
      }

      if (query.length < MIN_QUERY_LENGTH) {
        clearResults(nodes, dom);
        setStatus(dom, "");
        return;
      }

      debounceTimer = window.setTimeout(function () {
        activeRequestId += 1;
        runSearch(nodes, dom, query, activeRequestId);
      }, DEBOUNCE_MS);
    });

    nodes.hotelClear.addEventListener("click", function () {
      nodes.hotelInput.value = "";
      syncHotelClear(nodes);
      clearResults(nodes, dom);
      setStatus(dom, "");
      nodes.hotelInput.focus();
    });

    document.addEventListener("click", function (event) {
      if (!nodes.hotelRoot.contains(event.target)) {
        clearResults(nodes, dom);
      }
    });

    const form = getReservationForm();
    if (form) {
      form.addEventListener("pixkuy:contact-service-change", function (event) {
        const detail = event && event.detail ? event.detail : {};
        const nextServiceType = normalizeText(detail.nextServiceType);
        const previousServiceType = normalizeText(detail.previousServiceType);
        const source = normalizeText(detail.source);

        debugLog("event:pixkuy-contact-service-change", {
          previousServiceType: previousServiceType,
          nextServiceType: nextServiceType,
          source: source
        });

        if (
          previousServiceType === "airport_hotel" &&
          nextServiceType !== "airport_hotel"
        ) {
          window.setTimeout(function () {
            resetAdapterState(nodes, dom);
          }, 0);
        }
      });
    }

    return true;
  }

  function initContactAirportHotelLodgingAdapter() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    if (!form || !nodes) {
      debugLog("init:abort", {
        hasForm: !!form,
        hasNodes: !!nodes
      });
      return false;
    }

    const dom = ensureDom(nodes);
    bindHotelAutocomplete(nodes, dom);

    debugLog("init:done", {
      hasPanel: !!(dom && dom.panel),
      hasStatus: !!(dom && dom.status)
    });

    return true;
  }

  NAMESPACE.initContactAirportHotelLodgingAdapter =
    initContactAirportHotelLodgingAdapter;
})(window, document);