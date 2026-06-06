(function () {
  "use strict";

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  
    function getOppositeSide(side) {
    const safeSide = normalizeText(side);

    if (safeSide === "origin") {
      return "destination";
    }

    if (safeSide === "destination") {
      return "origin";
    }

    return "";
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  
    function debugTrace() {
    return;
  }

  function clonePlainState(state) {
    if (!state || typeof state !== "object") {
      return {};
    }

    return Object.assign({}, state);
  }
  
    function isAirportLabelContaminatedByLodging(state, candidateLabel) {
    const safeLabel = normalizeText(candidateLabel);

    if (!state || typeof state !== "object" || !safeLabel) {
      return false;
    }

    const neutralLodgingLabel = normalizeText(state.lodgingEndpointLabel);
    if (neutralLodgingLabel && neutralLodgingLabel === safeLabel) {
      return true;
    }

    const legacyResolvedLabel = normalizeText(state.destinationPlaceLabel);
    if (
      normalizeText(state.destinationMode) === "resolved-place" &&
      legacyResolvedLabel &&
      legacyResolvedLabel === safeLabel
    ) {
      return true;
    }

    return false;
  }

  function getAirportEndpoint(state) {
    if (!state || typeof state !== "object") {
      return null;
    }

    const originCandidate =
      state.originType === "airport" && normalizeText(state.originValue)
        ? {
            side: "origin",
            type: "airport",
            value: normalizeText(state.originValue),
            label: normalizeText(state.originLabel)
          }
        : null;

    const destinationCandidate =
      state.destinationType === "airport" && normalizeText(state.destinationValue)
        ? {
            side: "destination",
            type: "airport",
            value: normalizeText(state.destinationValue),
            label: normalizeText(state.destinationLabel)
          }
        : null;

    const neutralLodgingSide = normalizeText(state.lodgingEndpointSide);

    debugTrace("getAirportEndpoint:candidates", {
      originCandidate: originCandidate,
      destinationCandidate: destinationCandidate,
      lodgingEndpointSide: neutralLodgingSide,
      lodgingEndpointLabel: normalizeText(state.lodgingEndpointLabel),
      destinationMode: normalizeText(state.destinationMode),
      destinationPlaceLabel: normalizeText(state.destinationPlaceLabel)
    });

    function sanitizeAirportCandidateLabel(candidate) {
      if (!candidate) {
        return candidate;
      }

      if (!isAirportLabelContaminatedByLodging(state, candidate.label)) {
        return candidate;
      }

      const sanitized = Object.assign({}, candidate, {
        label: ""
      });

      debugTrace("getAirportEndpoint:label-contaminated", {
        side: candidate.side,
        value: candidate.value,
        originalLabel: candidate.label,
        sanitizedLabel: sanitized.label
      });

      return sanitized;
    }

    function normalizeAirportCandidateSide(candidate) {
      if (!candidate) {
        return candidate;
      }

      if (
        (neutralLodgingSide === "origin" ||
          neutralLodgingSide === "destination") &&
        candidate.side === neutralLodgingSide
      ) {
        const normalized = Object.assign({}, candidate, {
          side: getOppositeSide(neutralLodgingSide)
        });

        debugTrace("getAirportEndpoint:side-normalized-from-neutral-lodging", {
          originalSide: candidate.side,
          normalizedSide: normalized.side,
          value: candidate.value,
          lodgingEndpointSide: neutralLodgingSide
        });

        return normalized;
      }

      return candidate;
    }

    const sanitizedOriginCandidate = normalizeAirportCandidateSide(
      sanitizeAirportCandidateLabel(originCandidate)
    );
    const sanitizedDestinationCandidate = normalizeAirportCandidateSide(
      sanitizeAirportCandidateLabel(destinationCandidate)
    );

    const result = sanitizedOriginCandidate || sanitizedDestinationCandidate || null;

    debugTrace("getAirportEndpoint:result", result);

    return result;
  }
  
  function getResolvedLodgingEndpoint(state) {
    if (!state || typeof state !== "object") {
      debugTrace("getResolvedLodgingEndpoint:invalid-state", state);
      return null;
    }

    const neutralSide = normalizeText(state.lodgingEndpointSide);
    const neutralLabel = normalizeText(state.lodgingEndpointLabel);
    const neutralZoneId = normalizeText(state.lodgingEndpointZoneId);
    const neutralZoneLabelKey = normalizeText(state.lodgingEndpointZoneLabelKey);

    debugTrace("getResolvedLodgingEndpoint:neutral-input", {
      lodgingEndpointSide: neutralSide,
      lodgingEndpointLabel: neutralLabel,
      lodgingEndpointZoneId: neutralZoneId,
      lodgingEndpointZoneLabelKey: neutralZoneLabelKey,
      lodgingEndpointLat: state.lodgingEndpointLat,
      lodgingEndpointLng: state.lodgingEndpointLng
    });

    if (
      (neutralSide === "origin" || neutralSide === "destination") &&
      neutralLabel &&
      neutralZoneId &&
      isFiniteNumber(state.lodgingEndpointLat) &&
      isFiniteNumber(state.lodgingEndpointLng)
    ) {
      const neutralResult = {
        side: neutralSide,
        type: "lodging",
        label: neutralLabel,
        placeId: normalizeText(state.lodgingEndpointPlaceId),
        primaryType: normalizeText(state.lodgingEndpointPrimaryType),
        lat: state.lodgingEndpointLat,
        lng: state.lodgingEndpointLng,
        zoneId: neutralZoneId,
        zoneLabelKey: neutralZoneLabelKey
      };

      debugTrace("getResolvedLodgingEndpoint:neutral-result", neutralResult);
      return neutralResult;
    }

    const placeLabel = normalizeText(state.destinationPlaceLabel);
    const zoneId = normalizeText(state.resolvedZoneId);
    const zoneLabelKey = normalizeText(state.resolvedZoneLabelKey);

    debugTrace("getResolvedLodgingEndpoint:legacy-input", {
      destinationMode: normalizeText(state.destinationMode),
      destinationPlaceLabel: placeLabel,
      resolvedZoneId: zoneId,
      resolvedZoneLabelKey: zoneLabelKey,
      destinationLat: state.destinationLat,
      destinationLng: state.destinationLng
    });

    if (
      state.destinationMode !== "resolved-place" ||
      !placeLabel ||
      !zoneId ||
      !isFiniteNumber(state.destinationLat) ||
      !isFiniteNumber(state.destinationLng)
    ) {
      debugTrace("getResolvedLodgingEndpoint:no-result", {
        destinationMode: normalizeText(state.destinationMode),
        placeLabel: placeLabel,
        zoneId: zoneId,
        destinationLat: state.destinationLat,
        destinationLng: state.destinationLng
      });
      return null;
    }

    const legacyResult = {
      side: "destination",
      type: "lodging",
      label: placeLabel,
      placeId: normalizeText(state.lodgingEndpointPlaceId),
      primaryType: normalizeText(state.lodgingEndpointPrimaryType),
      lat: isFiniteNumber(state.destinationLat) ? state.destinationLat : null,
      lng: isFiniteNumber(state.destinationLng) ? state.destinationLng : null,
      zoneId: zoneId,
      zoneLabelKey: zoneLabelKey
    };

    debugTrace("getResolvedLodgingEndpoint:legacy-result", legacyResult);
    return legacyResult;
  }
  
  function hasAirportAndResolvedLodging(state) {
    return !!getAirportEndpoint(state) && !!getResolvedLodgingEndpoint(state);
  }

  function buildEndpointSnapshot(state) {
    const airport = getAirportEndpoint(state);
    const lodging = getResolvedLodgingEndpoint(state);

    if (!airport || !lodging) {
      debugTrace("buildEndpointSnapshot:missing-endpoint", {
        airport: airport,
        lodging: lodging
      });
      return null;
    }

    const airportSide = normalizeText(airport.side);
    const lodgingSide = normalizeText(lodging.side);

    debugTrace("buildEndpointSnapshot:input", {
      airportSide: airportSide,
      airport: airport,
      lodgingSide: lodgingSide,
      lodging: lodging
    });

    const validAirportSide =
      airportSide === "origin" || airportSide === "destination";
    const validLodgingSide =
      lodgingSide === "origin" || lodgingSide === "destination";

    if (!validAirportSide || !validLodgingSide) {
      debugTrace("buildEndpointSnapshot:invalid-side", {
        airportSide: airportSide,
        lodgingSide: lodgingSide
      });
      return null;
    }

    if (airportSide === lodgingSide) {
      debugTrace("buildEndpointSnapshot:conflicting-sides", {
        airportSide: airportSide,
        lodgingSide: lodgingSide,
        airport: airport,
        lodging: lodging
      });
      return null;
    }

    const snapshot = {
      origin: {
        type: airportSide === "origin" ? "airport" : "lodging",
        airport: airportSide === "origin" ? airport : null,
        lodging: lodgingSide === "origin" ? lodging : null
      },
      destination: {
        type: airportSide === "destination" ? "airport" : "lodging",
        airport: airportSide === "destination" ? airport : null,
        lodging: lodgingSide === "destination" ? lodging : null
      },
      derived: {
        zoneId: normalizeText(lodging.zoneId),
        zoneLabelKey: normalizeText(lodging.zoneLabelKey)
      }
    };

    debugTrace("buildEndpointSnapshot:result", snapshot);

    return snapshot;
  }
  
  function swapEndpointSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    return {
      origin: snapshot.destination
        ? Object.assign({}, snapshot.destination)
        : null,
      destination: snapshot.origin
        ? Object.assign({}, snapshot.origin)
        : null,
      derived: snapshot.derived ? Object.assign({}, snapshot.derived) : null
    };
  }

  function applyAirportToOrigin(state, airportEndpoint) {
    state.originType = "airport";
    state.originValue = airportEndpoint ? normalizeText(airportEndpoint.value) : "";
    state.originLabel = airportEndpoint ? normalizeText(airportEndpoint.label) : "";
  }

  function applyAirportToDestination(state, airportEndpoint) {
    state.destinationType = "airport";
    state.destinationValue = airportEndpoint
      ? normalizeText(airportEndpoint.value)
      : "";
    state.destinationLabel = airportEndpoint
      ? normalizeText(airportEndpoint.label)
      : "";
  }

  function applyResolvedLodgingToDestination(state, lodgingEndpoint) {
    state.destinationType = "zone";
    state.destinationValue = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.zoneId)
      : "";
    state.destinationLabel = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.label)
      : "";
    state.destinationMode = lodgingEndpoint ? "resolved-place" : "manual-zone";
    state.destinationPlaceLabel = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.label)
      : "";
    state.destinationLat =
      lodgingEndpoint && isFiniteNumber(lodgingEndpoint.lat)
        ? lodgingEndpoint.lat
        : null;
    state.destinationLng =
      lodgingEndpoint && isFiniteNumber(lodgingEndpoint.lng)
        ? lodgingEndpoint.lng
        : null;
    state.resolvedZoneId = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.zoneId)
      : "";
    state.resolvedZoneLabelKey = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.zoneLabelKey)
      : "";
  }

  function clearDestinationResolvedState(state) {
    state.destinationMode = "manual-zone";
    state.destinationPlaceLabel = "";
    state.destinationLat = null;
    state.destinationLng = null;
    state.resolvedZoneId = "";
    state.resolvedZoneLabelKey = "";
  }
  
    function applyResolvedLodgingToOrigin(state, lodgingEndpoint) {
    state.originType = "zone";
    state.originValue = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.zoneId)
      : "";
    state.originLabel = lodgingEndpoint
      ? normalizeText(lodgingEndpoint.label)
      : "";
  }

  function buildLegacyStateFromEndpointSnapshot(currentState, snapshot) {
    const nextState = clonePlainState(currentState);

    if (!snapshot || !snapshot.origin || !snapshot.destination) {
      debugTrace("buildLegacyStateFromEndpointSnapshot:invalid-snapshot", snapshot);
      return null;
    }

    debugTrace("buildLegacyStateFromEndpointSnapshot:input", {
      originType: snapshot.origin.type,
      destinationType: snapshot.destination.type,
      originAirport: snapshot.origin.airport || null,
      originLodging: snapshot.origin.lodging || null,
      destinationAirport: snapshot.destination.airport || null,
      destinationLodging: snapshot.destination.lodging || null
    });

    if (
      snapshot.origin.type === "lodging" &&
      snapshot.origin.lodging &&
      snapshot.destination.type === "airport" &&
      snapshot.destination.airport
    ) {
      applyResolvedLodgingToDestination(nextState, null);
      clearDestinationResolvedState(nextState);

      applyAirportToDestination(nextState, snapshot.destination.airport);
      applyResolvedLodgingToOrigin(nextState, snapshot.origin.lodging);

      nextState.destinationMode = "manual-zone";
      nextState.destinationPlaceLabel = normalizeText(snapshot.origin.lodging.label);
      nextState.destinationLat = snapshot.origin.lodging.lat;
      nextState.destinationLng = snapshot.origin.lodging.lng;
      nextState.resolvedZoneId = normalizeText(snapshot.origin.lodging.zoneId);
      nextState.resolvedZoneLabelKey = normalizeText(
        snapshot.origin.lodging.zoneLabelKey
      );

      debugTrace(
        "buildLegacyStateFromEndpointSnapshot:branch-lodging-origin-airport-destination",
        nextState
      );

      return nextState;
    }

    if (
      snapshot.origin.type === "airport" &&
      snapshot.origin.airport &&
      snapshot.destination.type === "lodging" &&
      snapshot.destination.lodging
    ) {
      applyAirportToOrigin(nextState, snapshot.origin.airport);
      applyResolvedLodgingToDestination(nextState, snapshot.destination.lodging);

      debugTrace(
        "buildLegacyStateFromEndpointSnapshot:branch-airport-origin-lodging-destination",
        nextState
      );

      return nextState;
    }

    debugTrace("buildLegacyStateFromEndpointSnapshot:unsupported-shape", {
      originType: snapshot.origin.type,
      destinationType: snapshot.destination.type,
      snapshot: snapshot
    });

    return null;
  }
  
  function buildSwappedAirportLodgingState(currentState) {
    const snapshot = buildEndpointSnapshot(currentState);

    if (!snapshot) {
      return null;
    }

    return buildLegacyStateFromEndpointSnapshot(
      currentState,
      swapEndpointSnapshot(snapshot)
    );
  }

  window.PixkuyAirportEndpointsState = {
    getAirportEndpoint: getAirportEndpoint,
    getResolvedLodgingEndpoint: getResolvedLodgingEndpoint,
    hasAirportAndResolvedLodging: hasAirportAndResolvedLodging,
    buildEndpointSnapshot: buildEndpointSnapshot,
    swapEndpointSnapshot: swapEndpointSnapshot,
    buildLegacyStateFromEndpointSnapshot: buildLegacyStateFromEndpointSnapshot,
    buildSwappedAirportLodgingState: buildSwappedAirportLodgingState
  };
})();