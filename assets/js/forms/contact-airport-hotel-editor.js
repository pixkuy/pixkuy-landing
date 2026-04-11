(function initContactAirportHotelEditorModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});
  const DEFAULT_DIRECTION = "airport_to_hotel";

  function debugLog() {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      const formFromNamespace = NAMESPACE.getReservationForm();
      debugLog("getReservationForm:namespace", {
        found: !!formFromNamespace
      });
      return formFromNamespace;
    }

    const fallbackForm = document.querySelector('form[name="contact"]');
    debugLog("getReservationForm:fallback", {
      found: !!fallbackForm
    });
    return fallbackForm;
  }

  function getCatalogApi() {
    const catalog = window.PIXKUY_AIRPORT_ZONE_CATALOG;
    const api = catalog && typeof catalog === "object" ? catalog : null;

    debugLog("getCatalogApi", {
      found: !!api,
      hasAirportsArray: !!(api && Array.isArray(api.airports)),
      airportsLength: api && Array.isArray(api.airports) ? api.airports.length : 0
    });

    return api;
  }

  function getLodgingTypesPolicy() {
    const policy = window.PixkuyAirportLodgingTypes;
    return policy && typeof policy === "object" ? policy : null;
  }

  function getDestinationBridge() {
    const bridge = window.PixkuyAirportDestination;
    return bridge && typeof bridge === "object" ? bridge : null;
  }

  function getTariffBridge() {
    const bridge = window.PixkuyAirportZoneTariff;
    return bridge && typeof bridge === "object" ? bridge : null;
  }

  function getTariffUtilsApi() {
    const api = window.PixkuyAirportTariffUtils;
    return api && typeof api === "object" ? api : null;
  }

  function getPanelSummaryApi() {
    return NAMESPACE && typeof NAMESPACE === "object"
      ? NAMESPACE
      : null;
  }

    function syncReservationRequestUiState(options) {
    const form = getReservationForm();
    const safeOptions =
      options && typeof options === "object" ? options : {};
    const skipValidation = safeOptions.skipValidation === true;

    if (!form || !NAMESPACE || typeof NAMESPACE !== "object") {
      return false;
    }

    if (
      typeof NAMESPACE.getReservationRequestFields !== "function" ||
      typeof NAMESPACE.syncReservationRequestState !== "function"
    ) {
      return false;
    }

    const fields = NAMESPACE.getReservationRequestFields(form);
    if (!fields || typeof fields !== "object") {
      return false;
    }

    NAMESPACE.syncReservationRequestState(fields);

    if (
      typeof NAMESPACE.contactServiceState === "object" &&
      typeof NAMESPACE.contactServiceState.getActiveServiceType === "function" &&
      NAMESPACE.contactServiceState.getActiveServiceType() === "airport_hotel"
    ) {
      const editorRoot = form.querySelector("[data-contact-airport-hotel-editor]");
      if (editorRoot && typeof NAMESPACE.getContactAirportHotelTripSnapshot === "function") {
        const snapshot = NAMESPACE.getContactAirportHotelTripSnapshot();

        if (snapshot) {
          if (fields.origin) {
            fields.origin.value = snapshot.origin || "";
          }

          if (fields.destination) {
            fields.destination.value = snapshot.destination || "";
          }

          if (fields.passengers) {
            fields.passengers.value = snapshot.passengerBucketLabel || "";
          }

          const directionField = form.querySelector('input[name="airport_hotel_direction"]');
          const airportField = form.querySelector('input[name="airport_hotel_airport"]');
          const hotelField = form.querySelector('input[name="airport_hotel_hotel"]');
          const fareKeyField = form.querySelector('input[name="passenger_fare_key"]');
          const bucketLabelField = form.querySelector('input[name="passenger_bucket_label"]');

          if (directionField) {
            directionField.value = snapshot.direction || "";
          }

          if (airportField) {
            airportField.value = snapshot.airport || "";
          }

          if (hotelField) {
            hotelField.value = snapshot.hotel || "";
          }

          if (fareKeyField) {
            fareKeyField.value = snapshot.passengerFareKey || "";
          }

          if (bucketLabelField) {
            bucketLabelField.value = snapshot.passengerBucketLabel || "";
          }
        }
      }
    }

    if (
      !skipValidation &&
      typeof NAMESPACE.refreshReservationRequestValidationUX === "function"
    ) {
      NAMESPACE.refreshReservationRequestValidationUX(fields);
    }

    return true;
  }
  
    function getContactServiceStateApi() {
    const api = NAMESPACE && NAMESPACE.contactServiceState;
    return api && typeof api === "object" ? api : null;
  }

  function hasSpecificAirportHotelDraft(editorState, nodes) {
    const hotelValue =
      nodes && nodes.hotelInput ? normalizeText(nodes.hotelInput.value) : "";
    const commonOrigin =
      nodes && nodes.commonOrigin ? normalizeText(nodes.commonOrigin.value) : "";
    const commonDestination =
      nodes && nodes.commonDestination
        ? normalizeText(nodes.commonDestination.value)
        : "";
    const bridgeState = getBridgeState();
    const hasResolvedLodging = !!(
      bridgeState &&
      (
        normalizeText(bridgeState.destinationPlaceLabel) ||
        normalizeText(bridgeState.lodgingEndpointLabel) ||
        normalizeText(bridgeState.resolvedZoneId) ||
        normalizeText(bridgeState.lodgingEndpointZoneId)
      )
    );
    const hasAirport = !!(
      editorState &&
      editorState.selectedAirport &&
      normalizeText(editorState.selectedAirport.id || editorState.selectedAirport.code || "")
    );

    return Boolean(
      hasAirport ||
      hotelValue ||
      hasResolvedLodging ||
      commonOrigin ||
      commonDestination
    );
  }
  
    function clearCommonTripFields(nodes) {
    if (!nodes || typeof nodes !== "object") {
      return false;
    }

    const fieldsToClear = [
      nodes.commonOrigin,
      nodes.commonDestination,
      nodes.commonPassengers,
      nodes.visibleOriginInput,
      nodes.visibleDestinationInput,
      nodes.originPlaceId,
      nodes.originLat,
      nodes.originLng,
      nodes.destinationPlaceId,
      nodes.destinationLat,
      nodes.destinationLng
    ];

    fieldsToClear.forEach(function (field) {
      if (!field || typeof field.value === "undefined") {
        return;
      }

      field.value = "";
    });

    return true;
  }

  function resetAirportHotelSpecificDraft(editorState, nodes) {
    const destinationBridge = getDestinationBridge();
    const panelSummaryApi = getPanelSummaryApi();

    editorState.direction = DEFAULT_DIRECTION;
    editorState.selectedAirport = null;

    closeAirportListbox(editorState, nodes);

    if (nodes.hotelInput) {
      nodes.hotelInput.value = "";
    }

    syncHotelClear(nodes);

    if (
      destinationBridge &&
      typeof destinationBridge.clearResolvedDestination === "function"
    ) {
      destinationBridge.clearResolvedDestination();
    }

    clearCommonTripFields(nodes);

    if (
      panelSummaryApi &&
      typeof panelSummaryApi.clearPanelHandoffSummary === "function"
    ) {
      panelSummaryApi.clearPanelHandoffSummary();
    }

    syncAirportTrigger(editorState, nodes);
    syncSideAwareLayout(editorState, nodes);

    return true;
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

  function getEditorNodes(form) {
    if (!form) {
      debugLog("getEditorNodes:no-form", {
        found: false
      });
      return null;
    }

    const root = form.querySelector("[data-contact-airport-hotel-editor]");
    if (!root) {
      debugLog("getEditorNodes:no-root", {
        found: false
      });
      return null;
    }

    const originField = root.querySelector('[data-contact-airport-hotel-role="origin"]');
    const destinationField = root.querySelector('[data-contact-airport-hotel-role="destination"]');

    const nodes = {
      root: root,
      originField: originField,
      destinationField: destinationField,
      originLabel: originField ? originField.querySelector(".services-expand__label") : null,
      destinationLabel: destinationField ? destinationField.querySelector(".services-expand__label") : null,
      airportTrigger: root.querySelector("[data-contact-airport-hotel-airport-trigger]"),
      airportShellOrigin: root.querySelector('[data-contact-airport-hotel-airport-shell="0"]'),
      airportShellDestination: root.querySelector('[data-contact-airport-hotel-future-airport-shell="1"]'),
      airportDisplayDestination: root.querySelector('[data-contact-airport-hotel-future-airport-display="1"]'),
      hotelRoot: root.querySelector("[data-contact-airport-hotel-hotel-root]"),
      hotelInput: root.querySelector("[data-contact-airport-hotel-hotel-input]"),
      hotelMount: root.querySelector("[data-contact-airport-hotel-hotel-mount]"),
      hotelClear: root.querySelector("[data-contact-airport-hotel-hotel-clear]"),
      hotelShellOrigin: root.querySelector('[data-contact-airport-hotel-future-lodging-shell="0"]'),
      swapButton: root.querySelector("[data-contact-airport-hotel-swap]"),
      passengersGroup: root.querySelector("[data-contact-airport-hotel-passengers-group]"),
      passengerOptionNodes: Array.from(
        root.querySelectorAll("[data-contact-airport-hotel-passenger-option]")
      ),
      commonOrigin: form.querySelector('input[name="origin"]'),
      commonDestination: form.querySelector('input[name="destination"]'),
      commonPassengers: form.querySelector('input[name="passengers"]'),
      airportHotelDirection: form.querySelector('input[name="airport_hotel_direction"]'),
      airportHotelAirport: form.querySelector('input[name="airport_hotel_airport"]'),
      airportHotelHotel: form.querySelector('input[name="airport_hotel_hotel"]'),
      passengerFareKey: form.querySelector('input[name="passenger_fare_key"]'),
      passengerBucketLabel: form.querySelector('input[name="passenger_bucket_label"]'),
      hiddenServiceLabel: form.querySelector('input[name="service_label"]'),
      hiddenRequestSummary: form.querySelector('input[name="request_summary"]'),
      hiddenAirportHotelTripSummary: form.querySelector('input[name="airport_hotel_trip_summary"]'),
      hiddenAirportHotelDirectionLabel: form.querySelector('input[name="airport_hotel_direction_label"]'),
      hiddenAirportHotelAirportLabel: form.querySelector('input[name="airport_hotel_airport_label"]'),
      hiddenAirportHotelHotelLabel: form.querySelector('input[name="airport_hotel_hotel_label"]'),
      hiddenAirportHotelZoneLabel: form.querySelector('input[name="airport_hotel_zone_label"]'),
      hiddenAirportHotelFareLabel: form.querySelector('input[name="airport_hotel_fare_label"]'),
      hiddenAirportHotelPassengerBucketLabel: form.querySelector('input[name="airport_hotel_passenger_bucket_label"]'),
      visibleOriginInput: form.querySelector('[data-place-input="origin"]'),
      visibleDestinationInput: form.querySelector('[data-place-input="destination"]'),
      originPlaceId: form.querySelector('input[name="origin_place_id"]'),
      originLat: form.querySelector('input[name="origin_lat"]'),
      originLng: form.querySelector('input[name="origin_lng"]'),
      destinationPlaceId: form.querySelector('input[name="destination_place_id"]'),
      destinationLat: form.querySelector('input[name="destination_lat"]'),
      destinationLng: form.querySelector('input[name="destination_lng"]')
    };

    debugLog("getEditorNodes:result", {
      hasRoot: !!nodes.root,
      hasOriginField: !!nodes.originField,
      hasDestinationField: !!nodes.destinationField,
      hasOriginLabel: !!nodes.originLabel,
      hasDestinationLabel: !!nodes.destinationLabel,
      hasAirportTrigger: !!nodes.airportTrigger,
      hasAirportShellOrigin: !!nodes.airportShellOrigin,
      hasAirportShellDestination: !!nodes.airportShellDestination,
      hasHotelRoot: !!nodes.hotelRoot,
      hasHotelInput: !!nodes.hotelInput,
      hasHotelMount: !!nodes.hotelMount,
      hasHotelClear: !!nodes.hotelClear,
      hasHotelShellOrigin: !!nodes.hotelShellOrigin,
      hasSwapButton: !!nodes.swapButton,
      hasCommonOrigin: !!nodes.commonOrigin,
      hasCommonDestination: !!nodes.commonDestination
    });

    return nodes;
  }

  function getAirportOptions() {
    const catalogApi = getCatalogApi();
    if (!catalogApi || !Array.isArray(catalogApi.airports)) {
      debugLog("getAirportOptions:no-catalog-airports", {
        returning: 0
      });
      return [];
    }

    const airports = catalogApi.airports.filter(function (airport) {
      return airport && airport.active === true;
    });

    debugLog("getAirportOptions:filtered", {
      totalCatalogAirports: catalogApi.airports.length,
      activeAirports: airports.length,
      airportIds: airports.map(function (airport) {
        return normalizeText(airport.id || airport.code || "");
      })
    });

    return airports;
  }
  
  function findAirportOptionById(airportId) {
    const safeAirportId = normalizeText(airportId);
    if (!safeAirportId) {
      return null;
    }

    const airports = getAirportOptions();
    return (
      airports.find(function (airport) {
        return normalizeText(airport && airport.id) === safeAirportId;
      }) || null
    );
  }
  
    function writeHiddenValue(field, value) {
    if (!field) {
      return;
    }

    field.value = typeof value === "string" ? value : "";
  }

  function isAirportHotelServiceActive(form) {
    const reservationForm = form || getReservationForm();
    const serviceTypeField = reservationForm
      ? reservationForm.querySelector('input[name="service_type"]')
      : null;

    return normalizeText(serviceTypeField && serviceTypeField.value) === "airport_hotel";
  }

  function getAirportHotelServiceLabel() {
    return getI18nValue(
      "contact.services.airportHotel",
      "Aeropuerto y hotel"
    );
  }

  function getAirportHotelDirectionLabel(direction) {
    const safeDirection = normalizeText(direction);

    if (safeDirection === "hotel_to_airport") {
      return "Hotel → Aeropuerto";
    }

    return "Aeropuerto → Hotel";
  }

  function getAirportHotelZoneLabel() {
    const form = getReservationForm();
    const zoneField = form ? form.querySelector('input[name="zone"]') : null;
    return normalizeText(zoneField && zoneField.value);
  }

  function getAirportHotelFareLabel() {
    const form = getReservationForm();
    const fareField = form ? form.querySelector('input[name="fare"]') : null;
    return normalizeText(fareField && fareField.value);
  }

  function buildAirportHotelTripSummary(snapshot) {
    const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    const parts = [];
    const directionLabel = getAirportHotelDirectionLabel(safeSnapshot.direction);
    const airportLabel = normalizeText(safeSnapshot.airport);
    const hotelLabel = normalizeText(safeSnapshot.hotel);
    const zoneLabel = getAirportHotelZoneLabel();
    const fareLabel = getAirportHotelFareLabel();
    const passengerBucketLabel = normalizeText(safeSnapshot.passengerBucketLabel);

    if (directionLabel) {
      parts.push("Trayecto: " + directionLabel);
    }

    if (airportLabel) {
      parts.push("Aeropuerto: " + airportLabel);
    }

    if (hotelLabel) {
      parts.push("Hotel: " + hotelLabel);
    }

    if (zoneLabel) {
      parts.push("Zona: " + zoneLabel);
    }

    if (passengerBucketLabel) {
      parts.push("Pasajeros: " + passengerBucketLabel);
    }

    if (fareLabel) {
      parts.push("Tarifa: " + fareLabel);
    }

    return parts.join(" | ");
  }

  function buildAirportButtonLabel(airport) {
    if (!airport) {
      return getI18nValue(
        "contact.services.airportHotelAirportPlaceholder",
        "Selecciona aeropuerto"
      );
    }

    if (typeof airport.label === "string" && airport.label.trim()) {
      return airport.label.trim();
    }

    if (typeof airport.labelKey === "string" && airport.labelKey.trim()) {
      return getI18nValue(airport.labelKey, airport.labelKey);
    }

    if (typeof airport.code === "string" && airport.code.trim()) {
      return airport.code.trim();
    }

    return getI18nValue(
      "contact.services.airportHotelAirportPlaceholder",
      "Selecciona aeropuerto"
    );
  }

  function setLabelNode(labelNode, text, targetId) {
    if (!labelNode) {
      return false;
    }

    labelNode.textContent = text || "";
    if (targetId) {
      labelNode.setAttribute("for", targetId);
    } else {
      labelNode.removeAttribute("for");
    }

    return true;
  }

  function moveNode(node, target) {
    if (!node || !target) {
      return false;
    }

    if (node.parentNode !== target) {
      target.appendChild(node);
    }

    return true;
  }

  function getBridgeState() {
    const bridge = getTariffBridge();
    if (!bridge || typeof bridge.getState !== "function") {
      return null;
    }

    return bridge.getState();
  }
  
    function getSelectedFareKeyFromBridge() {
    const bridgeState = getBridgeState();

    if (!bridgeState || typeof bridgeState !== "object") {
      return "";
    }

    return normalizeText(bridgeState.selectedFareKey);
  }

  function resolveFareKeyDisplayLabel(fareKey) {
    const utilsApi = getTariffUtilsApi();
    const safeFareKey = normalizeText(fareKey);

    if (
      !utilsApi ||
      typeof utilsApi.resolveFareKeyDisplayLabel !== "function" ||
      !safeFareKey
    ) {
      return "";
    }

    return normalizeText(utilsApi.resolveFareKeyDisplayLabel(safeFareKey));
  }

  function syncPassengerChipSelection(nodes, fareKey) {
    const safeFareKey = normalizeText(fareKey);

    if (!nodes || !Array.isArray(nodes.passengerOptionNodes)) {
      return false;
    }

    nodes.passengerOptionNodes.forEach(function (button) {
      const buttonFareKey = normalizeText(
        button && button.dataset ? button.dataset.contactAirportHotelFareKey : ""
      );
      const isActive = !!safeFareKey && buttonFareKey === safeFareKey;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.classList.toggle("is-active", isActive);
    });

    return true;
  }

  function syncPassengerSelectionFromBridge(nodes) {
    return syncPassengerChipSelection(nodes, getSelectedFareKeyFromBridge());
  }

  function resolveFareKeyFromPassengerCount(passengerValue) {
    const utilsApi = getTariffUtilsApi();
    const safeValue = normalizeText(passengerValue);
    const numericValue = Number(safeValue);

    let options;
    let match;

    if (
      !utilsApi ||
      typeof utilsApi.getPassengerFareOptions !== "function" ||
      !safeValue ||
      !Number.isFinite(numericValue)
    ) {
      return "";
    }

    options = utilsApi.getPassengerFareOptions();

    match =
      options.find(function (option) {
        return (
          option &&
          typeof option.minPassengers === "number" &&
          typeof option.maxPassengers === "number" &&
          numericValue >= option.minPassengers &&
          numericValue <= option.maxPassengers
        );
      }) || null;

    return match && typeof match.id === "string" ? normalizeText(match.id) : "";
  }

  function applyPassengerFareKeySelection(nodes, fareKey) {
    const bridge = getTariffBridge();
    const safeFareKey = normalizeText(fareKey);

    if (
      !bridge ||
      typeof bridge.setFareKeySelection !== "function" ||
      !safeFareKey
    ) {
      debugLog("applyPassengerFareKeySelection:skip", {
        hasBridge: !!bridge,
        hasMethod: !!(bridge && typeof bridge.setFareKeySelection === "function"),
        fareKey: safeFareKey
      });
      return false;
    }

    bridge.setFareKeySelection({ fareKey: safeFareKey });
    syncPassengerSelectionFromBridge(nodes);
    syncPanelSummaryFromTariffBridge();
    syncReservationRequestUiState({ skipValidation: true });

    debugLog("applyPassengerFareKeySelection:done", {
      fareKey: safeFareKey
    });

    return true;
  }

  function getActiveHotelSide(editorState) {
    const bridgeState = getBridgeState();

    if (bridgeState) {
      if (
        bridgeState.lodgingEndpointSide === "origin" ||
        bridgeState.lodgingEndpointSide === "destination"
      ) {
        return bridgeState.lodgingEndpointSide;
      }

      if (
        bridgeState.lodgingSearchSide === "origin" ||
        bridgeState.lodgingSearchSide === "destination"
      ) {
        return bridgeState.lodgingSearchSide;
      }
    }

    return editorState.direction === "hotel_to_airport"
      ? "origin"
      : "destination";
  }

  function syncSideAwareLayout(editorState, nodes) {
    if (
      !nodes ||
      !nodes.airportTrigger ||
      !nodes.originField ||
      !nodes.destinationField ||
      !nodes.hotelRoot ||
      !nodes.originLabel ||
      !nodes.destinationLabel
    ) {
      debugLog("syncSideAwareLayout:missing-nodes", {
        hasAirportTrigger: !!(nodes && nodes.airportTrigger),
        hasOriginField: !!(nodes && nodes.originField),
        hasDestinationField: !!(nodes && nodes.destinationField),
        hasHotelRoot: !!(nodes && nodes.hotelRoot),
        hasOriginLabel: !!(nodes && nodes.originLabel),
        hasDestinationLabel: !!(nodes && nodes.destinationLabel)
      });
      return false;
    }

    const hotelSide = getActiveHotelSide(editorState);
    const airportLabel = getI18nValue(
      "contact.services.airportHotelAirportLabel",
      "Aeropuerto"
    );
    const hotelLabel = getI18nValue(
      "contact.services.airportHotelHotelLabel",
      "Hotel"
    );

    // Los shells "future" no deben participar en el layout real actual.
    if (nodes.airportShellDestination) {
      nodes.airportShellDestination.hidden = true;
      nodes.airportShellDestination.setAttribute("aria-hidden", "true");
    }

    if (nodes.hotelShellOrigin) {
      nodes.hotelShellOrigin.hidden = true;
      nodes.hotelShellOrigin.setAttribute("aria-hidden", "true");
    }

    if (nodes.airportDisplayDestination) {
      nodes.airportDisplayDestination.hidden = true;
      nodes.airportDisplayDestination.setAttribute("aria-hidden", "true");
      nodes.airportDisplayDestination.setAttribute("tabindex", "-1");
    }

    if (hotelSide === "origin") {
      moveNode(nodes.hotelRoot, nodes.originField);
      moveNode(nodes.airportTrigger, nodes.destinationField);

      setLabelNode(
        nodes.originLabel,
        hotelLabel,
        nodes.hotelInput ? nodes.hotelInput.id : ""
      );
      setLabelNode(
        nodes.destinationLabel,
        airportLabel,
        nodes.airportTrigger ? nodes.airportTrigger.id : ""
      );
    } else {
      if (nodes.airportShellOrigin) {
        moveNode(nodes.airportTrigger, nodes.airportShellOrigin);
      } else {
        moveNode(nodes.airportTrigger, nodes.originField);
      }

      moveNode(nodes.hotelRoot, nodes.destinationField);

      setLabelNode(
        nodes.originLabel,
        airportLabel,
        nodes.airportTrigger ? nodes.airportTrigger.id : ""
      );
      setLabelNode(
        nodes.destinationLabel,
        hotelLabel,
        nodes.hotelInput ? nodes.hotelInput.id : ""
      );
    }

    nodes.hotelRoot.hidden = false;
    nodes.airportTrigger.hidden = false;

    debugLog("syncSideAwareLayout:done", {
      hotelSide: hotelSide,
      airportParentIsOriginField:
        nodes.airportTrigger.parentNode === nodes.originField,
      airportParentIsAirportShellOrigin:
        !!nodes.airportShellOrigin &&
        nodes.airportTrigger.parentNode === nodes.airportShellOrigin,
      airportParentIsDestinationField:
        nodes.airportTrigger.parentNode === nodes.destinationField,
      hotelParentIsOriginField:
        nodes.hotelRoot.parentNode === nodes.originField,
      hotelParentIsDestinationField:
        nodes.hotelRoot.parentNode === nodes.destinationField
    });

    return true;
  }
  function positionAirportListbox(editorState, nodes) {
    const panel = editorState.airportPanel;
    const trigger = nodes.airportTrigger;

    if (!panel || !trigger) {
      debugLog("positionAirportListbox:abort", {
        hasPanel: !!panel,
        hasTrigger: !!trigger
      });
      return false;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const panelWidth = Math.max(rect.width, 260);
    const maxLeft = Math.max(8, viewportWidth - panelWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const top = rect.bottom + 8;

    panel.style.position = "fixed";
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.width = panelWidth + "px";
    panel.style.zIndex = "9999";

    debugLog("positionAirportListbox:done", {
      left: left,
      top: top,
      width: panelWidth
    });

    return true;
  }

  function createAirportListbox(editorState, nodes) {
    const panel = document.createElement("div");
    panel.className = "place-autocomplete__panel";
    panel.setAttribute("data-contact-airport-hotel-airport-panel", "1");
    panel.setAttribute("role", "listbox");
    panel.hidden = true;

    const airports = getAirportOptions();

    debugLog("createAirportListbox:start", {
      airportsLength: airports.length
    });

    airports.forEach(function (airport) {
      const item = document.createElement("div");
      item.className = "place-autocomplete__item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "place-autocomplete__item-button";
      button.setAttribute("role", "option");
      button.setAttribute("data-airport-code", normalizeText(airport.code || airport.id || ""));
      button.setAttribute("aria-selected", "false");

      const title = document.createElement("span");
      title.className = "place-autocomplete__item-title";
      title.textContent = buildAirportButtonLabel(airport);

      button.appendChild(title);
      item.appendChild(button);
      panel.appendChild(item);

      button.addEventListener("click", function () {
        debugLog("airportOption:click", {
          airportId: normalizeText(airport.id || ""),
          airportCode: normalizeText(airport.code || ""),
          airportLabel: buildAirportButtonLabel(airport)
        });

        selectAirport(editorState, nodes, airport);
        closeAirportListbox(editorState, nodes);
      });
    });

    debugLog("createAirportListbox:done", {
      childCount: panel.childElementCount,
      hidden: panel.hidden
    });

    return panel;
  }

  function ensureAirportListbox(editorState, nodes) {
    if (!editorState.airportPanel) {
      debugLog("ensureAirportListbox:create", {
        hadPanelBefore: false
      });

      editorState.airportPanel = createAirportListbox(editorState, nodes);
      document.body.appendChild(editorState.airportPanel);
    } else {
      debugLog("ensureAirportListbox:reuse", {
        hadPanelBefore: true,
        childCount: editorState.airportPanel.childElementCount,
        hidden: editorState.airportPanel.hidden
      });
    }

    return editorState.airportPanel;
  }

  function syncAirportTrigger(editorState, nodes) {
    if (!nodes.airportTrigger) {
      debugLog("syncAirportTrigger:missing-trigger", {
        success: false
      });
      return false;
    }

    nodes.airportTrigger.textContent = buildAirportButtonLabel(editorState.selectedAirport);
    nodes.airportTrigger.setAttribute(
      "data-direction",
      editorState.direction === "hotel_to_airport" ? "hotel_to_airport" : "airport_to_hotel"
    );

    debugLog("syncAirportTrigger", {
      label: nodes.airportTrigger.textContent,
      direction: editorState.direction,
      hasSelectedAirport: !!editorState.selectedAirport
    });

    return true;
  }

  function syncTariffBridgeAirportSelection(editorState) {
    const bridge = getTariffBridge();
    const airportId =
      editorState &&
      editorState.selectedAirport &&
      typeof editorState.selectedAirport.id === "string"
        ? editorState.selectedAirport.id.trim()
        : "";

    if (
      !bridge ||
      typeof bridge.setAirportSelection !== "function" ||
      !airportId
    ) {
      debugLog("syncTariffBridgeAirportSelection:skip", {
        hasBridge: !!bridge,
        hasMethod: !!(bridge && typeof bridge.setAirportSelection === "function"),
        airportId: airportId
      });
      return false;
    }

    const result = bridge.setAirportSelection({
      airportId: airportId,
      direction: editorState.direction === "hotel_to_airport"
        ? "hotel_to_airport"
        : "airport_to_hotel"
    });

    debugLog("syncTariffBridgeAirportSelection:done", {
      airportId: airportId,
      direction: editorState.direction,
      result: result
    });

    return result;
  }

  function syncPanelSummaryFromTariffBridge() {
    const tariffBridge = getTariffBridge();
    const panelSummaryApi = getPanelSummaryApi();

    if (
      !tariffBridge ||
      typeof tariffBridge.getContactSummaryPayload !== "function" ||
      !panelSummaryApi ||
      typeof panelSummaryApi.setPanelHandoffSummary !== "function" ||
      typeof panelSummaryApi.clearPanelHandoffSummary !== "function"
    ) {
      debugLog("syncPanelSummaryFromTariffBridge:skip", {
        hasTariffBridge: !!tariffBridge,
        hasGetPayload: !!(tariffBridge && typeof tariffBridge.getContactSummaryPayload === "function"),
        hasPanelSummaryApi: !!panelSummaryApi,
        hasSetPanelHandoffSummary: !!(panelSummaryApi && typeof panelSummaryApi.setPanelHandoffSummary === "function"),
        hasClearPanelHandoffSummary: !!(panelSummaryApi && typeof panelSummaryApi.clearPanelHandoffSummary === "function")
      });
      return false;
    }

    const payload = tariffBridge.getContactSummaryPayload();

    debugLog("syncPanelSummaryFromTariffBridge:payload", {
      hasPayload: !!payload,
      payload: payload || null
    });

    if (!payload) {
      panelSummaryApi.clearPanelHandoffSummary();
      return false;
    }

    return panelSummaryApi.setPanelHandoffSummary(payload);
  }
  
  function rehydrateEditorFromTariffBridge(editorState, nodes) {
    const bridgeState = getBridgeState();
    if (!bridgeState || typeof bridgeState !== "object") {
      debugLog("rehydrateEditorFromTariffBridge:no-bridge-state", {
        success: false
      });
      return false;
    }

    const lodgingSide =
      bridgeState.lodgingEndpointSide === "origin" ||
      bridgeState.lodgingEndpointSide === "destination"
        ? bridgeState.lodgingEndpointSide
        : "";
    const nextDirection =
      lodgingSide === "origin" ? "hotel_to_airport" : "airport_to_hotel";
    const airportId =
      lodgingSide === "origin"
        ? normalizeText(bridgeState.destinationValue)
        : normalizeText(bridgeState.originValue);
    const airportOption = findAirportOptionById(airportId);
    const hotelLabel =
      normalizeText(bridgeState.lodgingEndpointLabel) ||
      normalizeText(bridgeState.destinationPlaceLabel);

    editorState.direction = nextDirection;
    editorState.selectedAirport = airportOption || null;

    if (nodes.hotelInput) {
      nodes.hotelInput.value = hotelLabel;
    }

    syncHotelClear(nodes);
    syncAirportTrigger(editorState, nodes);
    syncSideAwareLayout(editorState, nodes);
    syncPassengerSelectionFromBridge(nodes);
    syncPanelSummaryFromTariffBridge();
    syncReservationRequestUiState({ skipValidation: true });

    debugLog("rehydrateEditorFromTariffBridge:done", {
      direction: editorState.direction,
      airportId: airportId,
      hasAirportOption: !!airportOption,
      hotelLabel: hotelLabel
    });

    return true;
  }

  function selectAirport(editorState, nodes, airport) {
    editorState.selectedAirport = airport || null;

    debugLog("selectAirport", {
      airportId: airport ? normalizeText(airport.id || "") : "",
      airportCode: airport ? normalizeText(airport.code || "") : "",
      airportLabel: airport ? buildAirportButtonLabel(airport) : "",
      direction: editorState.direction
    });

    syncAirportTrigger(editorState, nodes);
    syncTariffBridgeAirportSelection(editorState);
    syncSideAwareLayout(editorState, nodes);
    syncPassengerSelectionFromBridge(nodes);
    syncPanelSummaryFromTariffBridge();
    syncReservationRequestUiState({ skipValidation: true });
  }

  function openAirportListbox(editorState, nodes) {
    const panel = ensureAirportListbox(editorState, nodes);
    if (!panel || !nodes.airportTrigger) {
      debugLog("openAirportListbox:abort", {
        hasPanel: !!panel,
        hasAirportTrigger: !!nodes.airportTrigger
      });
      return false;
    }

    positionAirportListbox(editorState, nodes);
    panel.hidden = false;
    nodes.airportTrigger.setAttribute("aria-expanded", "true");
    editorState.airportPanelOpen = true;

    debugLog("openAirportListbox:done", {
      hidden: panel.hidden,
      childCount: panel.childElementCount,
      ariaExpanded: nodes.airportTrigger.getAttribute("aria-expanded"),
      panelOpen: editorState.airportPanelOpen
    });

    return true;
  }

  function closeAirportListbox(editorState, nodes) {
    const panel = editorState.airportPanel;
    if (panel) {
      panel.hidden = true;
    }

    if (nodes.airportTrigger) {
      nodes.airportTrigger.setAttribute("aria-expanded", "false");
    }

    editorState.airportPanelOpen = false;

    debugLog("closeAirportListbox", {
      hasPanel: !!panel,
      hidden: panel ? panel.hidden : null,
      ariaExpanded: nodes.airportTrigger ? nodes.airportTrigger.getAttribute("aria-expanded") : null,
      panelOpen: editorState.airportPanelOpen
    });

    return true;
  }

  function toggleAirportListbox(editorState, nodes) {
    debugLog("toggleAirportListbox:before", {
      panelOpen: editorState.airportPanelOpen
    });

    if (editorState.airportPanelOpen) {
      return closeAirportListbox(editorState, nodes);
    }

    return openAirportListbox(editorState, nodes);
  }

  function syncHotelClear(nodes) {
    if (!nodes.hotelInput || !nodes.hotelClear) {
      debugLog("syncHotelClear:missing-nodes", {
        hasHotelInput: !!nodes.hotelInput,
        hasHotelClear: !!nodes.hotelClear
      });
      return false;
    }

    nodes.hotelClear.hidden = normalizeText(nodes.hotelInput.value) === "";

    debugLog("syncHotelClear", {
      hotelValue: normalizeText(nodes.hotelInput.value),
      clearHidden: nodes.hotelClear.hidden
    });

    return true;
  }

  function clearHotel(editorState, nodes) {
    if (!nodes.hotelInput) {
      debugLog("clearHotel:no-input", {
        success: false
      });
      return false;
    }

    nodes.hotelInput.value = "";
    syncHotelClear(nodes);

    const destinationBridge = getDestinationBridge();
    if (
      destinationBridge &&
      typeof destinationBridge.clearResolvedDestination === "function"
    ) {
      destinationBridge.clearResolvedDestination();
    }

    debugLog("clearHotel", {
      direction: editorState.direction
    });

    syncSideAwareLayout(editorState, nodes);
    syncPanelSummaryFromTariffBridge();
    syncReservationRequestUiState({ skipValidation: true });
    return true;
  }

  async function applySelectedHotel(editorState, nodes, detail) {
    const safeDetail =
      detail && typeof detail === "object" ? detail : {};
    const settleSelection =
      typeof safeDetail.settleSelection === "function"
        ? safeDetail.settleSelection
        : null;
    const label = normalizeText(safeDetail.label);
    const primaryType = normalizeText(safeDetail.primaryType).toLowerCase();
    const lat =
      typeof safeDetail.lat === "number" && Number.isFinite(safeDetail.lat)
        ? safeDetail.lat
        : null;
    const lng =
      typeof safeDetail.lng === "number" && Number.isFinite(safeDetail.lng)
        ? safeDetail.lng
        : null;
    const bridge = getDestinationBridge();
    const policy = getLodgingTypesPolicy();
    const previousHotelValue = nodes && nodes.hotelInput
      ? normalizeText(nodes.hotelInput.value)
      : "";
    let result = null;

    debugLog("applySelectedHotel:start", {
      label: label,
      primaryType: primaryType,
      lat: lat,
      lng: lng,
      hasBridge: !!bridge,
      hasResolveAndApplyDestination: !!(bridge && typeof bridge.resolveAndApplyDestination === "function"),
      hasPolicy: !!policy
    });

    if (!label || !nodes.hotelInput) {
      if (settleSelection) {
        settleSelection({
          accepted: false,
          reason: "invalid-selection-payload"
        });
      }

      debugLog("applySelectedHotel:abort", {
        hasLabel: !!label,
        hasHotelInput: !!nodes.hotelInput
      });
      return false;
    }

        if (
      !bridge ||
      typeof bridge.resolveAndApplyDestination !== "function" ||
      !policy ||
      typeof policy.isAcceptedLodgingPrimaryType !== "function" ||
      !policy.isAcceptedLodgingPrimaryType(primaryType) ||
      lat === null ||
      lng === null
    ) {
      if (settleSelection) {
        settleSelection({
          accepted: false,
          reason: "bridge-or-policy-unavailable"
        });
      }

      debugLog("applySelectedHotel:skip-bridge", {
        hasBridge: !!bridge,
        hasResolveAndApplyDestination: !!(bridge && typeof bridge.resolveAndApplyDestination === "function"),
        hasPolicy: !!policy,
        acceptsPrimaryType: !!(policy && typeof policy.isAcceptedLodgingPrimaryType === "function" && policy.isAcceptedLodgingPrimaryType(primaryType)),
        hasLat: lat !== null,
        hasLng: lng !== null
      });

      return false;
    }

    nodes.hotelInput.value = label;
    syncHotelClear(nodes);

    result = await bridge.resolveAndApplyDestination({
      placeLabel: label,
      primaryType: primaryType,
      lat: lat,
      lng: lng
    });

    debugLog("applySelectedHotel:resolved", {
      label: label,
      primaryType: primaryType,
      lat: lat,
      lng: lng,
      result: result || null
    });

    if (!result || result.ok !== true) {
      nodes.hotelInput.value = previousHotelValue;
      syncHotelClear(nodes);
      syncSideAwareLayout(editorState, nodes);
      syncPanelSummaryFromTariffBridge();

      if (settleSelection) {
        settleSelection({
          accepted: false,
          reason: result && typeof result.reason === "string"
            ? result.reason
            : "selection-rejected"
        });
      }

      debugLog("applySelectedHotel:rejected", {
        reason: result && typeof result.reason === "string" ? result.reason : "",
        restoredHotelValue: previousHotelValue
      });

      return false;
    }

    syncSideAwareLayout(editorState, nodes);
    syncPanelSummaryFromTariffBridge();
    syncReservationRequestUiState({ skipValidation: true });

    if (settleSelection) {
      settleSelection({
        accepted: true
      });
    }

    return true;
  }

  function swapDirection(editorState, nodes) {
    const bridge = getTariffBridge();

    editorState.direction =
      editorState.direction === "hotel_to_airport"
        ? "airport_to_hotel"
        : "hotel_to_airport";

    debugLog("swapDirection", {
      direction: editorState.direction,
      hasSwapTripDirection:
        !!(bridge && typeof bridge.swapTripDirection === "function")
    });

    if (bridge && typeof bridge.swapTripDirection === "function") {
      bridge.swapTripDirection();
      syncAirportTrigger(editorState, nodes);
      syncSideAwareLayout(editorState, nodes);
      syncPanelSummaryFromTariffBridge();
      syncPassengerSelectionFromBridge(nodes);
      syncReservationRequestUiState({ skipValidation: true });
      return true;
    }

    syncAirportTrigger(editorState, nodes);
    syncSideAwareLayout(editorState, nodes);
    syncTariffBridgeAirportSelection(editorState);
    syncPanelSummaryFromTariffBridge();
    syncPassengerSelectionFromBridge(nodes);
    syncReservationRequestUiState({ skipValidation: true });
    return true;
  }

  function bindEditorEvents(editorState, nodes) {
    if (!nodes.airportTrigger || !nodes.swapButton || !nodes.hotelInput) {
      debugLog("bindEditorEvents:missing-required-nodes", {
        hasAirportTrigger: !!nodes.airportTrigger,
        hasSwapButton: !!nodes.swapButton,
        hasHotelInput: !!nodes.hotelInput
      });
      return false;
    }

    if (nodes.root.dataset.contactAirportHotelEditorBound === "1") {
      debugLog("bindEditorEvents:already-bound", {
        alreadyBound: true
      });
      return true;
    }

    nodes.root.dataset.contactAirportHotelEditorBound = "1";

    debugLog("bindEditorEvents:binding", {
      airportTriggerId: nodes.airportTrigger.id || "",
      swapExists: !!nodes.swapButton,
      hotelInputId: nodes.hotelInput.id || ""
    });

    nodes.airportTrigger.addEventListener("click", function () {
      debugLog("airportTrigger:click", {
        currentText: normalizeText(nodes.airportTrigger.textContent),
        panelOpenBefore: editorState.airportPanelOpen
      });

      toggleAirportListbox(editorState, nodes);
    });

    nodes.swapButton.addEventListener("click", function () {
      debugLog("swapButton:click", {
        directionBefore: editorState.direction
      });

      swapDirection(editorState, nodes);
    });

    nodes.hotelInput.addEventListener("input", function () {
      debugLog("hotelInput:input", {
        value: normalizeText(nodes.hotelInput.value)
      });

      syncHotelClear(nodes);
    });
	
	    if (Array.isArray(nodes.passengerOptionNodes)) {
      nodes.passengerOptionNodes.forEach(function (button) {
        button.addEventListener("click", function () {
          const fareKey = normalizeText(
            button && button.dataset ? button.dataset.contactAirportHotelFareKey : ""
          );

          debugLog("passengerChip:click", {
            fareKey: fareKey
          });

          applyPassengerFareKeySelection(nodes, fareKey);
        });
      });
    }

    if (nodes.commonPassengers) {
      nodes.commonPassengers.addEventListener("input", function () {
        const derivedFareKey = resolveFareKeyFromPassengerCount(
          nodes.commonPassengers.value
        );

        debugLog("commonPassengers:input", {
          passengerValue: normalizeText(nodes.commonPassengers.value),
          derivedFareKey: derivedFareKey
        });

        if (!derivedFareKey) {
          syncPassengerChipSelection(nodes, "");
          return;
        }

        applyPassengerFareKeySelection(nodes, derivedFareKey);
      });
    }

    if (nodes.hotelClear) {
      nodes.hotelClear.addEventListener("click", function () {
        debugLog("hotelClear:click", {
          hotelValueBefore: normalizeText(nodes.hotelInput ? nodes.hotelInput.value : "")
        });

        clearHotel(editorState, nodes);
      });
    }

    document.addEventListener("click", function (event) {
      if (!editorState.airportPanelOpen) {
        return;
      }

      if (!nodes.root.contains(event.target) && !(editorState.airportPanel && editorState.airportPanel.contains(event.target))) {
        debugLog("document:outside-click-close-airport-panel", {
          panelOpenBefore: editorState.airportPanelOpen
        });

        closeAirportListbox(editorState, nodes);
      }
    });

    nodes.root.addEventListener("pixkuy:contact-airport-hotel-selected", function (event) {
      const detail = event && event.detail ? event.detail : null;

      debugLog("event:pixkuy-contact-airport-hotel-selected", {
        detail: detail || null
      });

      applySelectedHotel(editorState, nodes, detail).catch(function (error) {
        debugLog("applySelectedHotel:error", {
          message: error && error.message ? error.message : "",
          error: error || null
        });
      });
    });

    const form = getReservationForm();
    if (form) {
      form.addEventListener("pixkuy:contact-service-change", function (event) {
        const detail = event && event.detail ? event.detail : {};
        const previousServiceType = normalizeText(detail.previousServiceType);
        const nextServiceType = normalizeText(detail.nextServiceType);
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
          clearCommonTripFields(nodes);
          return;
        }

        if (
          previousServiceType !== "airport_hotel" &&
          nextServiceType === "airport_hotel"
        ) {
          window.setTimeout(function () {
            rehydrateEditorFromTariffBridge(editorState, nodes);
          }, 0);
        }
      });
    }

    window.addEventListener("resize", function () {
      if (!editorState.airportPanelOpen) {
        return;
      }

      positionAirportListbox(editorState, nodes);
    });

    window.addEventListener("scroll", function () {
      if (!editorState.airportPanelOpen) {
        return;
      }

      positionAirportListbox(editorState, nodes);
    }, true);

    return true;
  }
  
    function getAirportHotelTripSnapshot(editorState, nodes) {
    const hotelValue =
      nodes && nodes.hotelInput ? normalizeText(nodes.hotelInput.value) : "";
    const airportValue =
      editorState &&
      editorState.selectedAirport
        ? buildAirportButtonLabel(editorState.selectedAirport)
        : "";
    const direction =
      editorState && editorState.direction === "hotel_to_airport"
        ? "hotel_to_airport"
        : "airport_to_hotel";
    const selectedFareKey = getSelectedFareKeyFromBridge();
    const passengerBucketLabel = resolveFareKeyDisplayLabel(selectedFareKey);

    if (direction === "hotel_to_airport") {
      return {
        serviceType: "airport_hotel",
        direction: direction,
        origin: hotelValue,
        destination: airportValue,
        hotel: hotelValue,
        airport: airportValue,
        passengerFareKey: selectedFareKey,
        passengerBucketLabel: passengerBucketLabel
      };
    }

    return {
      serviceType: "airport_hotel",
      direction: direction,
      origin: airportValue,
      destination: hotelValue,
      hotel: hotelValue,
      airport: airportValue,
      passengerFareKey: selectedFareKey,
      passengerBucketLabel: passengerBucketLabel
    };
  }

   function syncAirportHotelPayloadFields(editorState, nodes) {
    const snapshot = getAirportHotelTripSnapshot(editorState, nodes);

    if (!nodes || !snapshot) {
      return false;
    }

    if (nodes.commonOrigin) {
      nodes.commonOrigin.value = snapshot.origin || "";
    }

    if (nodes.commonDestination) {
      nodes.commonDestination.value = snapshot.destination || "";
    }

    if (nodes.commonPassengers) {
      nodes.commonPassengers.value = snapshot.passengerBucketLabel || "";
    }

    if (nodes.airportHotelDirection) {
      nodes.airportHotelDirection.value = snapshot.direction || "";
    }

    if (nodes.airportHotelAirport) {
      nodes.airportHotelAirport.value = snapshot.airport || "";
    }

    if (nodes.airportHotelHotel) {
      nodes.airportHotelHotel.value = snapshot.hotel || "";
    }

    if (nodes.passengerFareKey) {
      nodes.passengerFareKey.value = snapshot.passengerFareKey || "";
    }

    if (nodes.passengerBucketLabel) {
      nodes.passengerBucketLabel.value = snapshot.passengerBucketLabel || "";
    }

    writeHiddenValue(
      nodes.hiddenAirportHotelTripSummary,
      buildAirportHotelTripSummary(snapshot)
    );
    writeHiddenValue(
      nodes.hiddenAirportHotelDirectionLabel,
      getAirportHotelDirectionLabel(snapshot.direction)
    );
    writeHiddenValue(
      nodes.hiddenAirportHotelAirportLabel,
      snapshot.airport || ""
    );
    writeHiddenValue(
      nodes.hiddenAirportHotelHotelLabel,
      snapshot.hotel || ""
    );
    writeHiddenValue(
      nodes.hiddenAirportHotelZoneLabel,
      getAirportHotelZoneLabel()
    );
    writeHiddenValue(
      nodes.hiddenAirportHotelFareLabel,
      getAirportHotelFareLabel()
    );
    writeHiddenValue(
      nodes.hiddenAirportHotelPassengerBucketLabel,
      snapshot.passengerBucketLabel || ""
    );

    if (isAirportHotelServiceActive(getReservationForm())) {
      writeHiddenValue(nodes.hiddenServiceLabel, getAirportHotelServiceLabel());
      writeHiddenValue(nodes.hiddenRequestSummary, buildAirportHotelTripSummary(snapshot));
    }

    return true;
  }

  function initContactAirportHotelEditor() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    debugLog("init:start", {
      hasForm: !!form,
      hasNodes: !!nodes
    });

    if (!form || !nodes) {
      debugLog("init:abort", {
        hasForm: !!form,
        hasNodes: !!nodes
      });
      return false;
    }

    const editorState = {
      direction: DEFAULT_DIRECTION,
      selectedAirport: null,
      airportPanel: null,
      airportPanelOpen: false
    };
    const contactServiceStateApi = getContactServiceStateApi();

    syncAirportTrigger(editorState, nodes);
    syncHotelClear(nodes);
    syncSideAwareLayout(editorState, nodes);
    syncPassengerSelectionFromBridge(nodes);
    syncAirportHotelPayloadFields(editorState, nodes);
    bindEditorEvents(editorState, nodes);

    if (
      contactServiceStateApi &&
      typeof contactServiceStateApi.registerSpecificDraftProbe === "function"
    ) {
      contactServiceStateApi.registerSpecificDraftProbe(
        "airport_hotel",
        function airportHotelDraftProbe() {
          return hasSpecificAirportHotelDraft(editorState, nodes);
        }
      );
    }

    /* airport_hotel preserva su draft al cambiar de servicio:
     no registrar reset destructivo */

    NAMESPACE.getContactAirportHotelTripSnapshot = function getContactAirportHotelTripSnapshot() {
      return getAirportHotelTripSnapshot(editorState, nodes);
    };

    debugLog("init:done", {
      direction: editorState.direction,
      panelOpen: editorState.airportPanelOpen,
      selectedAirport: editorState.selectedAirport
    });

    return true;
  }

  NAMESPACE.initContactAirportHotelEditor = initContactAirportHotelEditor;
})(window, document);