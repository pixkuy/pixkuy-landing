(function () {
  "use strict";

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

  function handoffPanelSelectionToContact(state, deps) {
    requireDeps(deps);
    const summary = buildCurrentContactSummaryPayload(state, deps);
    const owner = window.PixkuyAirportBookingForm;
    if (!summary || !owner || !owner.fromPanel(state, summary, deps.resolveFareKeyDisplayLabel(state.selectedFareKey))) return false;
    return !!window.PixkuyAirportDesktopBooking?.open();
  }

  window.PixkuyAirportTariffHandoff = {
    buildPanelToContactPrefill: buildPanelToContactPrefill,
    buildPanelSummaryPayload: buildPanelSummaryPayload,
    buildCurrentContactSummaryPayload: buildCurrentContactSummaryPayload,
    handoffPanelSelectionToContact: handoffPanelSelectionToContact
  };
})();
