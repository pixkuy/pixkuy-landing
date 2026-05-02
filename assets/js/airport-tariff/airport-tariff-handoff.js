(function () {
  "use strict";

  const MOBILE_QUERY = "(max-width: 720px)";

  function requireDeps(deps) {
    if (!deps || typeof deps !== "object") {
      throw new Error("PixkuyAirportTariffHandoff deps are required");
    }

    const required = [
      "normalizeText",
      "getActiveLodgingSide",
      "resolveDisplayLabel",
      "getZoneIdForFare",
      "resolveFare",
      "formatPrice",
      "resolveFareKeyDisplayLabel",
      "debugSwapTrace"
    ];

    required.forEach(function (key) {
      if (typeof deps[key] !== "function") {
        throw new Error("Missing handoff dependency: " + key);
      }
    });

    return deps;
  }

  function getReservationFormApi() {
    const formsNamespace = window.PixkuyForms;
    if (!formsNamespace || typeof formsNamespace !== "object") {
      return null;
    }

    if (
      typeof formsNamespace.getReservationForm !== "function" ||
      typeof formsNamespace.getReservationRequestFields !== "function" ||
      typeof formsNamespace.syncReservationRequestState !== "function"
    ) {
      return null;
    }

    return formsNamespace;
  }

  function getGooglePlacesFacade() {
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

  function getPanelHandoffSummaryApi() {
    const formsNamespace = window.PixkuyForms;
    if (!formsNamespace || typeof formsNamespace !== "object") {
      return null;
    }

    if (
      typeof formsNamespace.setPanelHandoffSummary !== "function" ||
      typeof formsNamespace.clearPanelHandoffSummary !== "function"
    ) {
      return null;
    }

    return formsNamespace;
  }
  
  function isMobileViewport() {
    return Boolean(
      window &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(MOBILE_QUERY).matches
    );
  }


  function getContactFields() {
    const formsApi = getReservationFormApi();
    let form;
    let fields;

    if (!formsApi) {
      return null;
    }

    form = formsApi.getReservationForm();
    if (!form) {
      return null;
    }

    fields = formsApi.getReservationRequestFields(form);
    if (!fields || typeof fields !== "object") {
      return null;
    }

    return fields;
  }

  function setInputValueAndDispatch(input, value, deps) {
    requireDeps(deps);

    if (!input) {
      return;
    }

    input.value = value;

    deps.debugSwapTrace("handoff:setInputValueSilently", {
      fieldName:
        input && typeof input.name === "string" ? input.name : "",
      fieldId:
        input && typeof input.id === "string" ? input.id : "",
      value:
        typeof value === "string" ? value : ""
    });
  }

  function clearPlaceHiddenFieldsForHandoff(fields) {
    const placesApi = getGooglePlacesFacade();

    if (!placesApi || typeof placesApi.clearHiddenFields !== "function") {
      return;
    }

    placesApi.clearHiddenFields({
      placeId: fields.originPlaceId,
      lat: fields.originLat,
      lng: fields.originLng
    });

    placesApi.clearHiddenFields({
      placeId: fields.destinationPlaceId,
      lat: fields.destinationLat,
      lng: fields.destinationLng
    });
  }

  function syncContactFormAfterPanelPrefill(fields) {
    const formsApi = getReservationFormApi();

    if (!formsApi || !fields) {
      return;
    }

    formsApi.syncReservationRequestState(fields);

    if (typeof formsApi.refreshReservationRequestValidationUX === "function") {
      formsApi.refreshReservationRequestValidationUX(fields, "origin");
      formsApi.refreshReservationRequestValidationUX(fields, "destination");
    }
  }

  function buildPanelToContactPrefill(state, deps) {
    requireDeps(deps);

    const activeLodgingSide = deps.getActiveLodgingSide(state);
    const airportValue =
      state.originType === "airport"
        ? deps.normalizeText(state.originValue)
        : state.destinationType === "airport"
          ? deps.normalizeText(state.destinationValue)
          : "";

    const airportLabelFromCatalog = airportValue
      ? deps.resolveDisplayLabel("airport", airportValue)
      : "";

    const airportLabel =
      deps.normalizeText(airportLabelFromCatalog) ||
      (state.originType === "airport"
        ? deps.normalizeText(state.originLabel)
        : state.destinationType === "airport"
          ? deps.normalizeText(state.destinationLabel)
          : "");

    const lodgingLabel =
      deps.normalizeText(state.lodgingEndpointLabel) ||
      deps.normalizeText(state.destinationPlaceLabel);

    if (!airportLabel || !lodgingLabel) {
      return null;
    }

    if (activeLodgingSide === "origin") {
      return {
        origin: lodgingLabel,
        destination: airportLabel
      };
    }

    return {
      origin: airportLabel,
      destination: lodgingLabel
    };
  }

  function buildPanelSummaryPayload(state, prefill, deps) {
    requireDeps(deps);

    const zoneId = deps.getZoneIdForFare(state);
    const zoneLabel = zoneId ? deps.resolveDisplayLabel("zone", zoneId) : "";
    const fare = deps.resolveFare(state);
    const temporalPricing =
      window && window.PixkuyAirportTariffTemporalPricing
        ? window.PixkuyAirportTariffTemporalPricing
        : null;
    const serviceDate =
      state && typeof state.serviceDate === "string"
        ? deps.normalizeText(state.serviceDate)
        : "";
    const finalPrice =
      fare &&
      typeof fare.price === "number" &&
      temporalPricing &&
      typeof temporalPricing.applyTemporalPricing === "function"
        ? temporalPricing.applyTemporalPricing(fare.price, serviceDate)
        : fare && typeof fare.price === "number"
          ? fare.price
          : null;
    const fareLabel =
      typeof finalPrice === "number" && fare && fare.currency
        ? deps.formatPrice(finalPrice, fare.currency)
        : "";

    if (!prefill || !zoneLabel || !fareLabel) {
      return null;
    }

    return {
      origin: prefill.origin,
      destination: prefill.destination,
      zone: zoneLabel,
      fare: fareLabel,
      serviceDate: serviceDate,
      serviceTime:
        state && typeof state.serviceTime === "string"
          ? deps.normalizeText(state.serviceTime)
          : ""
    };
  }

  function buildCurrentContactSummaryPayload(state, deps) {
    requireDeps(deps);

    const prefill = buildPanelToContactPrefill(state, deps);
    return buildPanelSummaryPayload(state, prefill, deps);
  }

  function scrollToContactForm(fields) {
    const form = fields && fields.form ? fields.form : document.getElementById("contact");
    const targetField =
      fields && fields.name
        ? fields.name
        : fields && fields.origin
          ? fields.origin
          : null;

    if (form && typeof form.scrollIntoView === "function") {
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    window.setTimeout(function () {
      if (targetField && typeof targetField.focus === "function") {
        targetField.focus();
      }
    }, 120);
  }

  function handoffPanelSelectionToContact(state, deps) {
    requireDeps(deps);

    if (isMobileViewport()) {
      return false;
    }

    const fields = getContactFields();
    const prefill = buildPanelToContactPrefill(state, deps);
    const panelSummaryApi = getPanelHandoffSummaryApi();
    const summaryPayload = buildPanelSummaryPayload(state, prefill, deps);
    const formsNamespace = window.PixkuyForms || {};
    const contactServiceStateApi =
      formsNamespace.contactServiceState &&
      typeof formsNamespace.contactServiceState === "object"
        ? formsNamespace.contactServiceState
        : null;

    if (!fields || !prefill) {
      return false;
    }

    deps.debugSwapTrace("handoffPanelSelectionToContact:start", {
      prefill: prefill,
      hasSummaryPayload: !!summaryPayload
    });

    if (
      contactServiceStateApi &&
      typeof contactServiceStateApi.setActiveServiceType === "function"
    ) {
      contactServiceStateApi.setActiveServiceType("airport_hotel", {
        skipConfirm: true,
        source: "airport-panel-handoff"
      });
    }

    if (panelSummaryApi) {
      panelSummaryApi.clearPanelHandoffSummary();
    }

    setInputValueAndDispatch(fields.origin, prefill.origin, deps);
    setInputValueAndDispatch(fields.destination, prefill.destination, deps);

    clearPlaceHiddenFieldsForHandoff(fields);
    syncContactFormAfterPanelPrefill(fields);

    if (panelSummaryApi && summaryPayload) {
      panelSummaryApi.setPanelHandoffSummary(summaryPayload);
    }

    if (fields && fields.form) {
      fields.form.dispatchEvent(
        new CustomEvent("pixkuy:airport-hotel-panel-handoff", {
          bubbles: true,
          detail: {
            serviceDate:
              state && typeof state.serviceDate === "string"
                ? deps.normalizeText(state.serviceDate)
                : "",
            serviceTime:
              state && typeof state.serviceTime === "string"
                ? deps.normalizeText(state.serviceTime)
                : "",
            passengerFareKey:
              state && typeof state.selectedFareKey === "string"
                ? deps.normalizeText(state.selectedFareKey)
                : "",
            passengerBucketLabel:
              state && typeof state.selectedFareKey === "string"
                ? deps.normalizeText(
                    typeof deps.resolveFareKeyDisplayLabel === "function"
                      ? deps.resolveFareKeyDisplayLabel(state.selectedFareKey)
                      : ""
                  )
                : ""
          }
        })
      );
    }

    deps.debugSwapTrace("handoffPanelSelectionToContact:after-prefill", {
      originValue: fields.origin ? fields.origin.value : "",
      destinationValue: fields.destination ? fields.destination.value : "",
      originPlaceId: fields.originPlaceId ? fields.originPlaceId.value : "",
      destinationPlaceId: fields.destinationPlaceId
        ? fields.destinationPlaceId.value
        : "",
      serviceType: fields.serviceType ? fields.serviceType.value : "",
      hasSummaryPayload: !!summaryPayload
    });

    scrollToContactForm(fields);

    return true;
  }

  window.PixkuyAirportTariffHandoff = {
    getReservationFormApi: getReservationFormApi,
    getGooglePlacesFacade: getGooglePlacesFacade,
    getPanelHandoffSummaryApi: getPanelHandoffSummaryApi,
    getContactFields: getContactFields,
    setInputValueAndDispatch: setInputValueAndDispatch,
    clearPlaceHiddenFieldsForHandoff: clearPlaceHiddenFieldsForHandoff,
    syncContactFormAfterPanelPrefill: syncContactFormAfterPanelPrefill,
    buildPanelToContactPrefill: buildPanelToContactPrefill,
    buildPanelSummaryPayload: buildPanelSummaryPayload,
    buildCurrentContactSummaryPayload: buildCurrentContactSummaryPayload,
    scrollToContactForm: scrollToContactForm,
    handoffPanelSelectionToContact: handoffPanelSelectionToContact
  };
})();