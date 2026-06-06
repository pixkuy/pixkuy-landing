(function () {
  "use strict";

  function requireDeps(deps) {
    if (!deps || typeof deps !== "object") {
      throw new Error("PixkuyAirportTariffState deps are required");
    }

    const required = [
      "isFiniteNumber",
      "normalizeText",
      "findItemById",
      "resolveItemLabel",
      "getZoneIdForFare",
      "getZoneOptionById"
    ];

    required.forEach(function (key) {
      if (typeof deps[key] !== "function") {
        throw new Error("Missing state dependency: " + key);
      }
    });

    return deps;
  }

  function getSelectedFareKey(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return "";
    }

    return deps.normalizeText(state.selectedFareKey);
  }

  function setSelectedFareKeyState(state, payload, deps) {
    requireDeps(deps);

    const fareKey =
      payload && typeof payload.fareKey === "string"
        ? payload.fareKey.trim()
        : "";

    state.selectedFareKey = fareKey;
    return !!fareKey;
  }

  function syncResolvedZoneFromState(state, deps) {
    requireDeps(deps);

    const zoneId = deps.getZoneIdForFare(state);
    const zoneItem = deps.getZoneOptionById(zoneId);

    state.resolvedZoneId = zoneId || "";
    state.resolvedZoneLabelKey =
      zoneItem && zoneItem.labelKey ? zoneItem.labelKey : "";
  }

  function clearLodgingEndpointState(state, deps) {
    requireDeps(deps);

    state.lodgingEndpointSide = "";
    state.lodgingEndpointLabel = "";
    state.lodgingEndpointPlaceId = "";
    state.lodgingEndpointPrimaryType = "";
    state.lodgingEndpointLat = null;
    state.lodgingEndpointLng = null;
    state.lodgingEndpointZoneId = "";
    state.lodgingEndpointZoneLabelKey = "";
  }

  function getActiveLodgingSide(state, deps) {
    requireDeps(deps);

    if (!state || typeof state !== "object") {
      return "destination";
    }

    if (
      state.lodgingEndpointSide === "origin" ||
      state.lodgingEndpointSide === "destination"
    ) {
      return state.lodgingEndpointSide;
    }

    if (
      state.lodgingSearchSide === "origin" ||
      state.lodgingSearchSide === "destination"
    ) {
      return state.lodgingSearchSide;
    }

    return "destination";
  }

  function applyLodgingEndpointState(state, payload, deps) {
    requireDeps(deps);

    if (!payload || typeof payload !== "object") {
      return false;
    }

    const side =
      typeof payload.side === "string" ? payload.side.trim() : "";
    const placeLabel =
      typeof payload.placeLabel === "string" ? payload.placeLabel.trim() : "";
    const placeId =
      typeof payload.placeId === "string" ? payload.placeId.trim() : "";
    const primaryType =
      typeof payload.primaryType === "string" ? payload.primaryType.trim() : "";
    const zoneId =
      typeof payload.zoneId === "string" ? payload.zoneId.trim() : "";
    const zoneLabelKey =
      typeof payload.zoneLabelKey === "string"
        ? payload.zoneLabelKey.trim()
        : "";
    const lat = payload.lat;
    const lng = payload.lng;

    if (
      (side !== "origin" && side !== "destination") ||
      !placeLabel ||
      !zoneId ||
      !deps.isFiniteNumber(lat) ||
      !deps.isFiniteNumber(lng)
    ) {
      return false;
    }

    state.lodgingEndpointSide = side;
    state.lodgingEndpointLabel = placeLabel;
    state.lodgingEndpointPlaceId = placeId;
    state.lodgingEndpointPrimaryType = primaryType;
    state.lodgingEndpointLat = lat;
    state.lodgingEndpointLng = lng;
    state.lodgingEndpointZoneId = zoneId;
    state.lodgingEndpointZoneLabelKey = zoneLabelKey;

    return true;
  }

  function clearResolvedDestinationState(state, deps) {
    requireDeps(deps);

    state.destinationMode = "manual-zone";
    state.destinationPlaceLabel = "";
    state.destinationLat = null;
    state.destinationLng = null;
    state.resolvedZoneId = "";
    state.resolvedZoneLabelKey = "";
  }

  function applyAirportSelectionState(state, payload, deps) {
    requireDeps(deps);

    if (!payload || typeof payload !== "object") {
      return false;
    }

    const airportId =
      typeof payload.airportId === "string" ? payload.airportId.trim() : "";
    const direction =
      typeof payload.direction === "string" ? payload.direction.trim() : "";

    if (!airportId) {
      return false;
    }

    const airportItem = deps.findItemById("airport", airportId);
    if (!airportItem) {
      return false;
    }

    const airportLabel = deps.resolveItemLabel(airportItem) || "";
    const hasResolvedLodging =
      typeof state.lodgingEndpointSide === "string" &&
      (state.lodgingEndpointSide === "origin" ||
        state.lodgingEndpointSide === "destination") &&
      typeof state.lodgingEndpointLabel === "string" &&
      state.lodgingEndpointLabel.trim().length > 0 &&
      typeof state.lodgingEndpointZoneId === "string" &&
      state.lodgingEndpointZoneId.trim().length > 0 &&
      deps.isFiniteNumber(state.lodgingEndpointLat) &&
      deps.isFiniteNumber(state.lodgingEndpointLng);

    if (!hasResolvedLodging) {
      clearResolvedDestinationState(state, deps);
      clearLodgingEndpointState(state, deps);

      if (direction === "hotel_to_airport") {
        state.originType = "zone";
        state.originValue = "";
        state.originLabel = "";

        state.destinationType = "airport";
        state.destinationValue = airportId;
        state.destinationLabel = airportLabel;

        state.lodgingSearchSide = "origin";
      } else {
        state.originType = "airport";
        state.originValue = airportId;
        state.originLabel = airportLabel;

        state.destinationType = "zone";
        state.destinationValue = "";
        state.destinationLabel = "";

        state.lodgingSearchSide = "destination";
      }

      syncResolvedZoneFromState(state, deps);
      return true;
    }

    state.destinationMode = "resolved-place";
    state.destinationPlaceLabel = deps.normalizeText(state.lodgingEndpointLabel);
    state.destinationLat = state.lodgingEndpointLat;
    state.destinationLng = state.lodgingEndpointLng;
    state.resolvedZoneId = deps.normalizeText(state.lodgingEndpointZoneId);
    state.resolvedZoneLabelKey = deps.normalizeText(
      state.lodgingEndpointZoneLabelKey
    );

    if (direction === "hotel_to_airport") {
      state.originType = "zone";
      state.originValue = state.resolvedZoneId;
      state.originLabel = state.destinationPlaceLabel;

      state.destinationType = "airport";
      state.destinationValue = airportId;
      state.destinationLabel = airportLabel;

      state.lodgingEndpointSide = "origin";
      state.lodgingSearchSide = "origin";
    } else {
      state.originType = "airport";
      state.originValue = airportId;
      state.originLabel = airportLabel;

      state.destinationType = "zone";
      state.destinationValue = state.resolvedZoneId;
      state.destinationLabel = state.destinationPlaceLabel;

      state.lodgingEndpointSide = "destination";
      state.lodgingSearchSide = "destination";
    }

    syncResolvedZoneFromState(state, deps);
    return true;
  }

  function resetPanelToAirportEmptyState(state, clearedLodgingSide, deps) {
    requireDeps(deps);

    const safeClearedSide =
      clearedLodgingSide === "origin" ? "origin" : "destination";

    const originAirportValue =
      state.originType === "airport"
        ? deps.normalizeText(state.originValue)
        : "";
    const originAirportLabel =
      state.originType === "airport"
        ? deps.normalizeText(state.originLabel)
        : "";
    const destinationAirportValue =
      state.destinationType === "airport"
        ? deps.normalizeText(state.destinationValue)
        : "";
    const destinationAirportLabel =
      state.destinationType === "airport"
        ? deps.normalizeText(state.destinationLabel)
        : "";

    const preservedAirportValue =
      safeClearedSide === "origin"
        ? destinationAirportValue
        : originAirportValue;
    const preservedAirportLabel =
      safeClearedSide === "origin"
        ? destinationAirportLabel
        : originAirportLabel;

    if (safeClearedSide === "origin") {
      state.originType = "zone";
      state.originValue = "";
      state.originLabel = "";

      state.destinationType = "airport";
      state.destinationValue = preservedAirportValue;
      state.destinationLabel = preservedAirportLabel;

      state.lodgingSearchSide = "origin";
    } else {
      state.originType = "airport";
      state.originValue = preservedAirportValue;
      state.originLabel = preservedAirportLabel;

      state.destinationType = "zone";
      state.destinationValue = "";
      state.destinationLabel = "";

      state.lodgingSearchSide = "destination";
    }

    state.destinationMode = "manual-zone";
    state.destinationPlaceLabel = "";
    state.destinationLat = null;
    state.destinationLng = null;
    state.resolvedZoneId = "";
    state.resolvedZoneLabelKey = "";

    state.lodgingEndpointSide = "";
    state.lodgingEndpointLabel = "";
    state.lodgingEndpointPlaceId = "";
    state.lodgingEndpointPrimaryType = "";
    state.lodgingEndpointLat = null;
    state.lodgingEndpointLng = null;
    state.lodgingEndpointZoneId = "";
    state.lodgingEndpointZoneLabelKey = "";
  }

  function hasResolvedDestination(state, deps) {
    requireDeps(deps);

    return (
      state.destinationMode === "resolved-place" &&
      typeof state.destinationPlaceLabel === "string" &&
      state.destinationPlaceLabel.trim().length > 0 &&
      deps.isFiniteNumber(state.destinationLat) &&
      deps.isFiniteNumber(state.destinationLng) &&
      typeof state.resolvedZoneId === "string" &&
      state.resolvedZoneId.trim().length > 0
    );
  }

  function applyResolvedDestinationState(state, payload, deps) {
    requireDeps(deps);

    if (!payload || typeof payload !== "object") {
      return false;
    }

    const placeLabel =
      typeof payload.placeLabel === "string" ? payload.placeLabel.trim() : "";
    const zoneId =
      typeof payload.zoneId === "string" ? payload.zoneId.trim() : "";
    const lat = payload.lat;
    const lng = payload.lng;
    const activeLodgingSide = getActiveLodgingSide(state, deps);
    const debugSwapTrace =
      deps && typeof deps.debugSwapTrace === "function"
        ? deps.debugSwapTrace
        : null;

    if (debugSwapTrace) {
      debugSwapTrace("applyResolvedDestinationState:before-guards", {
        activeLodgingSide: activeLodgingSide,
        payload: {
          placeLabel:
            payload && typeof payload.placeLabel === "string"
              ? payload.placeLabel
              : "",
          zoneId:
            payload && typeof payload.zoneId === "string"
              ? payload.zoneId
              : "",
          lat: payload ? payload.lat : null,
          lng: payload ? payload.lng : null
        },
        stateBefore: {
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
        }
      });
    }

    if (
      !placeLabel ||
      !zoneId ||
      !deps.isFiniteNumber(lat) ||
      !deps.isFiniteNumber(lng)
    ) {
      return false;
    }

    const zoneItem = deps.getZoneOptionById(zoneId);
    if (!zoneItem) {
      return false;
    }

    if (debugSwapTrace) {
      debugSwapTrace("applyResolvedDestinationState:after-zone-resolution", {
        activeLodgingSide: activeLodgingSide,
        zoneId: zoneId,
        zoneLabelKey: zoneItem && zoneItem.labelKey ? zoneItem.labelKey : "",
        stateBeforeApply: {
          originType: state.originType,
          originValue: state.originValue,
          originLabel: state.originLabel,
          destinationType: state.destinationType,
          destinationValue: state.destinationValue,
          destinationLabel: state.destinationLabel,
          lodgingEndpointSide: state.lodgingEndpointSide,
          lodgingSearchSide: state.lodgingSearchSide
        }
      });
    }

    state.destinationMode = "resolved-place";
    state.destinationPlaceLabel = placeLabel;
    state.destinationLat = lat;
    state.destinationLng = lng;
    state.resolvedZoneId = zoneId;
    state.resolvedZoneLabelKey = zoneItem.labelKey || "";

    if (activeLodgingSide === "origin") {
      const preservedAirportValue =
        state.destinationType === "airport"
          ? deps.normalizeText(state.destinationValue)
          : "";
      const preservedAirportLabel =
        state.destinationType === "airport"
          ? deps.normalizeText(state.destinationLabel)
          : "";

      if (debugSwapTrace) {
        debugSwapTrace(
          "applyResolvedDestinationState:origin-branch:preserve-airport",
          {
            preservedAirportValue: preservedAirportValue,
            preservedAirportLabel: preservedAirportLabel,
            destinationTypeBefore: state.destinationType,
            destinationValueBefore: state.destinationValue,
            destinationLabelBefore: state.destinationLabel
          }
        );
      }

      state.originType = "zone";
      state.originValue = zoneId;
      state.originLabel = placeLabel;

      state.destinationType = "airport";
      state.destinationValue = preservedAirportValue;
      state.destinationLabel = preservedAirportLabel;
    } else {
      const preservedAirportValue =
        state.originType === "airport"
          ? deps.normalizeText(state.originValue)
          : "";
      const preservedAirportLabel =
        state.originType === "airport"
          ? deps.normalizeText(state.originLabel)
          : "";

      if (debugSwapTrace) {
        debugSwapTrace(
          "applyResolvedDestinationState:destination-branch:preserve-airport",
          {
            preservedAirportValue: preservedAirportValue,
            preservedAirportLabel: preservedAirportLabel,
            originTypeBefore: state.originType,
            originValueBefore: state.originValue,
            originLabelBefore: state.originLabel
          }
        );
      }

      state.destinationType = "zone";
      state.destinationValue = zoneId;
      state.destinationLabel = placeLabel;

      state.originType = "airport";
      state.originValue = preservedAirportValue;
      state.originLabel = preservedAirportLabel;
    }

    state.lodgingSearchSide = activeLodgingSide;

    applyLodgingEndpointState(
      state,
      {
        side: activeLodgingSide,
        placeLabel: placeLabel,
        placeId:
          typeof payload.placeId === "string" ? payload.placeId.trim() : "",
        primaryType:
          typeof payload.primaryType === "string" ? payload.primaryType.trim() : "",
        lat: lat,
        lng: lng,
        zoneId: zoneId,
        zoneLabelKey: zoneItem.labelKey || ""
      },
      deps
    );

    return true;
  }

  window.PixkuyAirportTariffState = {
    getSelectedFareKey: getSelectedFareKey,
    setSelectedFareKeyState: setSelectedFareKeyState,
    syncResolvedZoneFromState: syncResolvedZoneFromState,
    clearLodgingEndpointState: clearLodgingEndpointState,
    getActiveLodgingSide: getActiveLodgingSide,
    applyLodgingEndpointState: applyLodgingEndpointState,
    clearResolvedDestinationState: clearResolvedDestinationState,
    applyAirportSelectionState: applyAirportSelectionState,
    resetPanelToAirportEmptyState: resetPanelToAirportEmptyState,
    hasResolvedDestination: hasResolvedDestination,
    applyResolvedDestinationState: applyResolvedDestinationState
  };
})();