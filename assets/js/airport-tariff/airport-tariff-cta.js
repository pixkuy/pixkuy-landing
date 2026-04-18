(function () {
  "use strict";

  function requireDeps(deps) {
    if (!deps || typeof deps !== "object") {
      throw new Error("PixkuyAirportTariffCta deps are required");
    }

    const required = [
      "normalizeText",
      "getSelectedFareKey",
      "getZoneIdForFare",
      "resolveFare",
      "getTemporalPricingApi"
    ];

    required.forEach(function (key) {
      if (typeof deps[key] !== "function") {
        throw new Error("Missing CTA dependency: " + key);
      }
    });

    return deps;
  }

  function hasAirportSelected(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return false;
    }

    return (
      (state.originType === "airport" &&
        deps.normalizeText(state.originValue).length > 0) ||
      (state.destinationType === "airport" &&
        deps.normalizeText(state.destinationValue).length > 0)
    );
  }

  function hasPassengerSelection(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return false;
    }

    return deps.normalizeText(deps.getSelectedFareKey(state)).length > 0;
  }

  function hasResolvableZone(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return false;
    }

    return deps.normalizeText(deps.getZoneIdForFare(state)).length > 0;
  }

  function hasRealDestinationInput(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return false;
    }

    const lodgingSide =
      state.lodgingEndpointSide === "origin" ||
      state.lodgingEndpointSide === "destination"
        ? state.lodgingEndpointSide
        : "";

    const hasResolvedLodging =
      deps.normalizeText(state.lodgingEndpointLabel).length > 0 &&
      lodgingSide.length > 0;

    if (hasResolvedLodging) {
      return true;
    }

    return (
      state.destinationMode === "resolved-place" &&
      deps.normalizeText(state.destinationPlaceLabel).length > 0
    );
  }
  
    function hasValidTemporalServiceDate(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return false;
    }

    const temporalPricing = deps.getTemporalPricingApi();
    const serviceDate =
      typeof state.serviceDate === "string"
        ? deps.normalizeText(state.serviceDate)
        : "";

    if (
      !temporalPricing ||
      typeof temporalPricing.shouldShowDateFieldInServices !== "function"
    ) {
      return true;
    }

    if (!temporalPricing.shouldShowDateFieldInServices()) {
      return true;
    }

    return serviceDate.length > 0;
  }

  function hasResolvableFare(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return false;
    }

    const fare = deps.resolveFare(state);
    return !!(
      fare &&
      typeof fare === "object" &&
      typeof fare.price === "number" &&
      isFinite(fare.price)
    );
  }

  function getCtaEligibility(state, deps) {
    requireDeps(deps);

    const airportReady = hasAirportSelected(state, deps);
    const passengersReady = hasPassengerSelection(state, deps);
    const destinationReady = hasRealDestinationInput(state, deps);
    const zoneReady = hasResolvableZone(state, deps);
    const temporalDateReady = hasValidTemporalServiceDate(state, deps);
    const fareReady = hasResolvableFare(state, deps);

    const canNavigate =
      airportReady &&
      passengersReady &&
      destinationReady &&
      zoneReady &&
      temporalDateReady &&
      fareReady;

    return {
      airportReady: airportReady,
      passengersReady: passengersReady,
      destinationReady: destinationReady,
      zoneReady: zoneReady,
      temporalDateReady: temporalDateReady,
      fareReady: fareReady,
      canNavigate: canNavigate
    };
  }

  function applyCtaState(ctaNode, eligibility) {
    if (!ctaNode || !eligibility || typeof eligibility !== "object") {
      return;
    }

    const isEnabled = eligibility.canNavigate === true;

    ctaNode.disabled = !isEnabled;
    ctaNode.setAttribute("aria-disabled", isEnabled ? "false" : "true");
    ctaNode.dataset.airportTariffCtaState = isEnabled ? "enabled" : "disabled";
  }

  window.PixkuyAirportTariffCta = {
    getCtaEligibility: getCtaEligibility,
    applyCtaState: applyCtaState
  };
})();