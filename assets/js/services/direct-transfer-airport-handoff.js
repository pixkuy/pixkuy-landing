/* assets/js/services/direct-transfer-airport-handoff.js
   Direct Transfer -> Airport Transfer handoff bridge.
   Responsabilidad:
   - construir el contexto de handoff desde Direct Transfer hacia Airport Transfer
   - conservar el endpoint no aeroportuario seleccionado por el usuario
   - aplicar el handoff sobre Airport usando APIs públicas existentes
   - persistir contexto temporal para el salto móvil entre routes
   NO incluir:
   - clasificación de aeropuertos
   - cálculo de pricing
   - resolución geográfica propia
   - checkout
   - submit de formularios
   - cambios en Google Places shared
*/

(function initDirectTransferAirportHandoff(window) {
  "use strict";

  if (!window) {
    return;
  }

  const STORAGE_KEY = "pixkuy_direct_transfer_airport_handoff";
  const STORAGE_TTL_MS = 5 * 60 * 1000;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getPlaceLabel(place) {
    const safePlace = place && typeof place === "object" ? place : {};

    return normalizeText(
      safePlace.label ||
        safePlace.formattedAddress ||
        safePlace.displayName ||
        safePlace.text ||
        safePlace.address
    );
  }

  function getPlaceId(place) {
    const safePlace = place && typeof place === "object" ? place : {};

    return normalizeText(safePlace.placeId || safePlace.place_id || safePlace.id);
  }

  function getPlaceCoordinate(place, key) {
    const safePlace = place && typeof place === "object" ? place : {};
    const location = safePlace.location && typeof safePlace.location === "object"
      ? safePlace.location
      : {};
    const value = safePlace[key] !== undefined && safePlace[key] !== null
      ? safePlace[key]
      : location[key];
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  function getPlacePrimaryType(place) {
    const safePlace = place && typeof place === "object" ? place : {};
    const explicitPrimaryType = normalizeText(
      safePlace.primaryType ||
        safePlace.primary_type ||
        safePlace.primaryTypeDisplayName
    );
    const types = Array.isArray(safePlace.types) ? safePlace.types : [];
    let index;
    let type;

    if (explicitPrimaryType) {
      return explicitPrimaryType;
    }

    for (index = 0; index < types.length; index += 1) {
      type = normalizeText(types[index]);

      if (type && type !== "airport") {
        return type;
      }
    }

    return normalizeText(types[0]);
  }

  function getNonAirportPlace(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const direction = normalizeText(safeInput.direction);

    if (direction === "hotel_to_airport") {
      return safeInput.originPlace || null;
    }

    if (direction === "airport_to_hotel") {
      return safeInput.destinationPlace || null;
    }

    return null;
  }

  function buildLodgingPayload(place) {
    const placeLabel = getPlaceLabel(place);
    const lat = getPlaceCoordinate(place, "lat");
    const lng = getPlaceCoordinate(place, "lng");
    const primaryType = getPlacePrimaryType(place);

    if (!placeLabel || lat === null || lng === null || !primaryType) {
      return null;
    }

    return {
      placeLabel: placeLabel,
      placeId: getPlaceId(place),
      primaryType: primaryType,
      lat: lat,
      lng: lng
    };
  }

  function buildHandoffPayload(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const airportId = normalizeText(safeInput.airportId);
    const direction = normalizeText(safeInput.direction);
    const lodging = buildLodgingPayload(getNonAirportPlace(safeInput));

    if (
      !airportId ||
      (
        direction !== "airport_to_hotel" &&
        direction !== "hotel_to_airport"
      )
    ) {
      return null;
    }

    return {
      airportId: airportId,
      direction: direction,
      lodging: lodging,
      createdAt: Date.now()
    };
  }

  function getAirportTariffApi() {
    const api = window.PixkuyAirportZoneTariff;

    return api && typeof api === "object" ? api : null;
  }

  function getAirportDestinationApi() {
    const api = window.PixkuyAirportDestination;

    return api && typeof api === "object" ? api : null;
  }

  function applyToAirport(input) {
    const payload = input && input.lodging ? input : buildHandoffPayload(input);
    const tariffApi = getAirportTariffApi();
    const destinationApi = getAirportDestinationApi();
    let airportApplied = false;

    if (
      !payload ||
      !tariffApi ||
      typeof tariffApi.setAirportSelection !== "function"
    ) {
      return Promise.resolve(false);
    }

    try {
      airportApplied = tariffApi.setAirportSelection({
        airportId: payload.airportId,
        direction: payload.direction
      });
    } catch (error) {
      return Promise.resolve(false);
    }

    if (
      !airportApplied ||
      !payload.lodging ||
      !destinationApi ||
      typeof destinationApi.resolveAndApplyDestination !== "function"
    ) {
      return Promise.resolve(Boolean(airportApplied));
    }

    return destinationApi.resolveAndApplyDestination(payload.lodging)
      .then(function onResolvedDestinationApplied(result) {
        return Boolean((result && result.ok === true) || airportApplied);
      })
      .catch(function onResolvedDestinationError() {
        return Boolean(airportApplied);
      });
  }

  function storePendingHandoff(input) {
    const payload = buildHandoffPayload(input);

    if (!payload || !payload.lodging) {
      return false;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function consumePendingHandoff() {
    let raw;
    let payload;
    const now = Date.now();

    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !Number.isFinite(Number(payload.createdAt)) ||
      now - Number(payload.createdAt) > STORAGE_TTL_MS
    ) {
      return null;
    }

    return payload;
  }

  window.PixkuyDirectTransferAirportHandoff = {
    buildHandoffPayload: buildHandoffPayload,
    applyToAirport: applyToAirport,
    storePendingHandoff: storePendingHandoff,
    consumePendingHandoff: consumePendingHandoff
  };
})(window);