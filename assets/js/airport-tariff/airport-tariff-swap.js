(function () {
  "use strict";

  function requireDeps(deps) {
    if (!deps || typeof deps !== "object") {
      throw new Error("PixkuyAirportTariffSwap deps are required");
    }

    const required = [
      "normalizeText",
      "applyLodgingEndpointState",
      "clearLodgingEndpointState",
      "debugSwapTrace",
      "isFiniteNumber"
    ];

    required.forEach(function (key) {
      if (typeof deps[key] !== "function") {
        throw new Error("Missing swap dependency: " + key);
      }
    });

    return deps;
  }

  function applySwappedStateSnapshot(state, snapshot, deps) {
    requireDeps(deps);

    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    state.originType =
      typeof snapshot.originType === "string"
        ? snapshot.originType
        : state.originType;
    state.destinationType =
      typeof snapshot.destinationType === "string"
        ? snapshot.destinationType
        : state.destinationType;
    state.originValue =
      typeof snapshot.originValue === "string" ? snapshot.originValue : "";
    state.destinationValue =
      typeof snapshot.destinationValue === "string"
        ? snapshot.destinationValue
        : "";
    state.originLabel =
      typeof snapshot.originLabel === "string" ? snapshot.originLabel : "";
    state.destinationLabel =
      typeof snapshot.destinationLabel === "string"
        ? snapshot.destinationLabel
        : "";
    state.destinationMode =
      typeof snapshot.destinationMode === "string"
        ? snapshot.destinationMode
        : "manual-zone";
    state.destinationPlaceLabel =
      typeof snapshot.destinationPlaceLabel === "string"
        ? snapshot.destinationPlaceLabel
        : "";
    state.destinationLat =
      typeof snapshot.destinationLat === "number" &&
      Number.isFinite(snapshot.destinationLat)
        ? snapshot.destinationLat
        : null;
    state.destinationLng =
      typeof snapshot.destinationLng === "number" &&
      Number.isFinite(snapshot.destinationLng)
        ? snapshot.destinationLng
        : null;
    state.resolvedZoneId =
      typeof snapshot.resolvedZoneId === "string" ? snapshot.resolvedZoneId : "";
    state.resolvedZoneLabelKey =
      typeof snapshot.resolvedZoneLabelKey === "string"
        ? snapshot.resolvedZoneLabelKey
        : "";

    if (
      !deps.applyLodgingEndpointState(state, {
        side:
          typeof snapshot.lodgingEndpointSide === "string"
            ? snapshot.lodgingEndpointSide
            : "",
        placeLabel:
          typeof snapshot.lodgingEndpointLabel === "string"
            ? snapshot.lodgingEndpointLabel
            : "",
        placeId:
          typeof snapshot.lodgingEndpointPlaceId === "string"
            ? snapshot.lodgingEndpointPlaceId
            : "",
        primaryType:
          typeof snapshot.lodgingEndpointPrimaryType === "string"
            ? snapshot.lodgingEndpointPrimaryType
            : "",
        lat: snapshot.lodgingEndpointLat,
        lng: snapshot.lodgingEndpointLng,
        zoneId:
          typeof snapshot.lodgingEndpointZoneId === "string"
            ? snapshot.lodgingEndpointZoneId
            : "",
        zoneLabelKey:
          typeof snapshot.lodgingEndpointZoneLabelKey === "string"
            ? snapshot.lodgingEndpointZoneLabelKey
            : ""
      })
    ) {
      deps.clearLodgingEndpointState(state);
    }

    if (
      state.lodgingEndpointSide === "origin" ||
      state.lodgingEndpointSide === "destination"
    ) {
      state.lodgingSearchSide = state.lodgingEndpointSide;
    } else if (
      snapshot.lodgingSearchSide === "origin" ||
      snapshot.lodgingSearchSide === "destination"
    ) {
      state.lodgingSearchSide = snapshot.lodgingSearchSide;
    }

    deps.debugSwapTrace("swap:applySwappedStateSnapshot", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId,
      lodgingSearchSide: state.lodgingSearchSide,
      snapshotLodgingSearchSide:
        typeof snapshot.lodgingSearchSide === "string"
          ? snapshot.lodgingSearchSide
          : ""
    });

    return true;
  }

  function buildLegacySwappedStateFromEndpoints(state, endpointsStateApi, deps) {
    requireDeps(deps);

    if (!endpointsStateApi) {
      deps.debugSwapTrace("swap:missing-endpoints-api", null);
      return null;
    }

    const endpointSnapshot = endpointsStateApi.buildEndpointSnapshot(state);
    deps.debugSwapTrace("swap:endpointSnapshot", endpointSnapshot);

    if (!endpointSnapshot) {
      return null;
    }

    const swappedEndpointSnapshot =
      endpointsStateApi.swapEndpointSnapshot(endpointSnapshot);
    deps.debugSwapTrace("swap:swappedEndpointSnapshot", swappedEndpointSnapshot);

    if (!swappedEndpointSnapshot) {
      return null;
    }

    const legacyState = endpointsStateApi.buildLegacyStateFromEndpointSnapshot(
      state,
      swappedEndpointSnapshot
    );
    deps.debugSwapTrace("swap:legacyState:before-lodging-rehydration", legacyState);

    if (!legacyState || typeof legacyState !== "object") {
      return null;
    }

    const swappedOriginLodging =
      swappedEndpointSnapshot.origin &&
      swappedEndpointSnapshot.origin.type === "lodging" &&
      swappedEndpointSnapshot.origin.lodging
        ? swappedEndpointSnapshot.origin.lodging
        : null;

    const swappedDestinationLodging =
      swappedEndpointSnapshot.destination &&
      swappedEndpointSnapshot.destination.type === "lodging" &&
      swappedEndpointSnapshot.destination.lodging
        ? swappedEndpointSnapshot.destination.lodging
        : null;

    const swappedLodging =
      swappedOriginLodging || swappedDestinationLodging || null;
    const swappedLodgingSide = swappedOriginLodging
      ? "origin"
      : swappedDestinationLodging
        ? "destination"
        : "";

    if (swappedLodging) {
      legacyState.lodgingEndpointSide = swappedLodgingSide;
      legacyState.lodgingEndpointLabel = deps.normalizeText(swappedLodging.label);
      legacyState.lodgingEndpointPlaceId = deps.normalizeText(swappedLodging.placeId);
      legacyState.lodgingEndpointPrimaryType = deps.normalizeText(swappedLodging.primaryType);
      legacyState.lodgingEndpointLat = swappedLodging.lat;
      legacyState.lodgingEndpointLng = swappedLodging.lng;
      legacyState.lodgingEndpointZoneId = deps.normalizeText(swappedLodging.zoneId);
      legacyState.lodgingEndpointZoneLabelKey = deps.normalizeText(
        swappedLodging.zoneLabelKey
      );
      legacyState.lodgingSearchSide = swappedLodgingSide;

      deps.debugSwapTrace("swap:legacyState:after-lodging-rehydration", legacyState);
      return legacyState;
    }

    legacyState.lodgingEndpointSide = "";
    legacyState.lodgingEndpointLabel = "";
    legacyState.lodgingEndpointPlaceId = "";
    legacyState.lodgingEndpointPrimaryType = "";
    legacyState.lodgingEndpointLat = null;
    legacyState.lodgingEndpointLng = null;
    legacyState.lodgingEndpointZoneId = "";
    legacyState.lodgingEndpointZoneLabelKey = "";

    deps.debugSwapTrace("swap:legacyState:no-lodging", legacyState);
    return legacyState;
  }

  function buildFallbackAirportEmptySwapSnapshot(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return null;
    }

    const originHasAirport =
      state.originType === "airport" && deps.normalizeText(state.originValue);
    const destinationHasAirport =
      state.destinationType === "airport" &&
      deps.normalizeText(state.destinationValue);

    const hasNoResolvedLodging =
      !deps.normalizeText(state.destinationPlaceLabel) &&
      !deps.normalizeText(state.lodgingEndpointLabel) &&
      !deps.normalizeText(state.lodgingEndpointZoneId) &&
      !deps.normalizeText(state.lodgingEndpointZoneLabelKey) &&
      !deps.isFiniteNumber(state.lodgingEndpointLat) &&
      !deps.isFiniteNumber(state.lodgingEndpointLng) &&
      !deps.normalizeText(state.destinationPlaceId) &&
      !deps.normalizeText(state.destinationLat) &&
      !deps.normalizeText(state.destinationLng);

    const originIsManualZoneFallback =
      state.originType === "zone" && hasNoResolvedLodging;

    const destinationIsManualZoneFallback =
      state.destinationType === "zone" && hasNoResolvedLodging;

    if (originHasAirport && destinationIsManualZoneFallback) {
      return {
        originType: "zone",
        originValue: "",
        originLabel: "",
        destinationType: "airport",
        destinationValue: deps.normalizeText(state.originValue),
        destinationLabel: deps.normalizeText(state.originLabel),
        destinationMode: "manual-zone",
        destinationPlaceLabel: "",
        destinationLat: null,
        destinationLng: null,
        resolvedZoneId: "",
        resolvedZoneLabelKey: "",
        lodgingEndpointSide: "",
        lodgingEndpointLabel: "",
        lodgingEndpointPlaceId: "",
        lodgingEndpointPrimaryType: "",
        lodgingEndpointLat: null,
        lodgingEndpointLng: null,
        lodgingEndpointZoneId: "",
        lodgingEndpointZoneLabelKey: "",
        lodgingSearchSide: "origin"
      };
    }

    if (destinationHasAirport && originIsManualZoneFallback) {
      return {
        originType: "airport",
        originValue: deps.normalizeText(state.destinationValue),
        originLabel: deps.normalizeText(state.destinationLabel),
        destinationType: "zone",
        destinationValue: "",
        destinationLabel: "",
        destinationMode: "manual-zone",
        destinationPlaceLabel: "",
        destinationLat: null,
        destinationLng: null,
        resolvedZoneId: "",
        resolvedZoneLabelKey: "",
        lodgingEndpointSide: "",
        lodgingEndpointLabel: "",
        lodgingEndpointPlaceId: "",
        lodgingEndpointPrimaryType: "",
        lodgingEndpointLat: null,
        lodgingEndpointLng: null,
        lodgingEndpointZoneId: "",
        lodgingEndpointZoneLabelKey: "",
        lodgingSearchSide: "destination"
      };
    }

    return null;
  }

  function swapState(state, endpointsStateApi, deps) {
    requireDeps(deps);

    deps.debugSwapTrace("swapState:entry", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingSearchSide: state.lodgingSearchSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });

    if (endpointsStateApi) {
      const swappedSnapshot = buildLegacySwappedStateFromEndpoints(
        state,
        endpointsStateApi,
        deps
      );

      if (applySwappedStateSnapshot(state, swappedSnapshot, deps)) {
        return;
      }
    }

    const fallbackSnapshot = buildFallbackAirportEmptySwapSnapshot(state, deps);
    deps.debugSwapTrace("swap:fallbackSnapshot", fallbackSnapshot);

    if (applySwappedStateSnapshot(state, fallbackSnapshot, deps)) {
      deps.debugSwapTrace("swapState:applied-fallbackSnapshot", {
        originType: state.originType,
        originValue: state.originValue,
        originLabel: state.originLabel,
        destinationType: state.destinationType,
        destinationValue: state.destinationValue,
        destinationLabel: state.destinationLabel,
        destinationMode: state.destinationMode,
        destinationPlaceLabel: state.destinationPlaceLabel,
        resolvedZoneId: state.resolvedZoneId,
        resolvedZoneLabelKey: state.resolvedZoneLabelKey,
        lodgingEndpointSide: state.lodgingEndpointSide,
        lodgingSearchSide: state.lodgingSearchSide,
        lodgingEndpointLabel: state.lodgingEndpointLabel,
        lodgingEndpointZoneId: state.lodgingEndpointZoneId
      });
      return;
    }

    const currentSide =
      state.lodgingEndpointSide === "origin" ||
      state.lodgingEndpointSide === "destination"
        ? state.lodgingEndpointSide
        : state.lodgingSearchSide === "origin" ||
            state.lodgingSearchSide === "destination"
          ? state.lodgingSearchSide
          : "destination";

    state.lodgingSearchSide = currentSide === "origin" ? "destination" : "origin";

    deps.debugSwapTrace("swapState:toggled-search-side-only", {
      currentSide: currentSide,
      nextSearchSide: state.lodgingSearchSide,
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingSearchSide: state.lodgingSearchSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });
  }

  window.PixkuyAirportTariffSwap = {
    applySwappedStateSnapshot: applySwappedStateSnapshot,
    buildLegacySwappedStateFromEndpoints: buildLegacySwappedStateFromEndpoints,
    buildFallbackAirportEmptySwapSnapshot: buildFallbackAirportEmptySwapSnapshot,
    swapState: swapState
  };
})();