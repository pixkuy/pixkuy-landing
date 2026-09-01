/* assets/js/services/direct-transfer-airport-guard.js
   Direct Transfer airport guard.
   Reutiliza el catálogo Airport / Hotel activo; no mantiene una segunda lista.
*/

(function initDirectTransferAirportGuard(window) {
  "use strict";

  if (!window) {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeLocationComparisonValue(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function getCataloguedAirports() {
    const catalog = window.PIXKUY_AIRPORT_ZONE_CATALOG;
    const airports = catalog && Array.isArray(catalog.airports)
      ? catalog.airports
      : [];

    return airports.filter(function filterActiveAirport(airport) {
      return airport && airport.active === true && normalizeText(airport.id);
    });
  }

  function getI18nValue(path) {
    const modules = window.__pixkuyI18nModules || {};
    const dict = window.__pixkuyI18nDict || null;

    if (
      dict &&
      typeof modules.getValue === "function" &&
      normalizeText(path)
    ) {
      return normalizeText(modules.getValue(dict, path));
    }

    return "";
  }

  function getPlaceTypes(place) {
    const safePlace = place && typeof place === "object" ? place : {};
    const types = Array.isArray(safePlace.types) ? safePlace.types.slice() : [];
    const primaryType = normalizeText(
      safePlace.primaryType || safePlace.primary_type
    );

    if (primaryType) {
      types.push(primaryType);
    }

    return types.map(normalizeLocationComparisonValue).filter(Boolean);
  }

  function placeLooksLikeAirportOrTerminal(place) {
    return getPlaceTypes(place).some(function hasAirportType(type) {
      return type === "airport" || type === "airport_terminal";
    });
  }

  function getPlaceSearchText(place) {
    const safePlace = place && typeof place === "object" ? place : {};
    const addressComponents = Array.isArray(safePlace.addressComponents)
      ? safePlace.addressComponents
      : (Array.isArray(safePlace.address_components)
        ? safePlace.address_components
        : []);
    const componentsText = addressComponents.map(function mapComponent(component) {
      const safeComponent = component && typeof component === "object"
        ? component
        : {};

      return [
        safeComponent.longText,
        safeComponent.shortText,
        safeComponent.long_name,
        safeComponent.short_name
      ].map(normalizeText).filter(Boolean).join(" ");
    });

    return [
      safePlace.label,
      safePlace.displayName,
      safePlace.formattedAddress,
      safePlace.primaryText,
      safePlace.secondaryText,
      safePlace.text,
      safePlace.address,
      safePlace.iataCode,
      safePlace.iata_code
    ].concat(componentsText)
      .map(normalizeLocationComparisonValue)
      .filter(Boolean)
      .join(" | ");
  }

  function getExplicitIataCode(place) {
    return normalizeText(
      place && (place.iataCode || place.iata_code)
    ).toUpperCase();
  }

  function getExplicitAirportId(place) {
    return normalizeText(
      place && (place.airportId || place.airport_id)
    ).toLowerCase();
  }

  function hasCatalogIdentityInText(place, airport) {
    const text = getPlaceSearchText(place);
    const iata = normalizeLocationComparisonValue(airport && airport.iata);
    const label = normalizeLocationComparisonValue(
      getI18nValue(airport && airport.labelKey)
    );

    if (!placeLooksLikeAirportOrTerminal(place)) {
      return false;
    }

    return Boolean(
      (iata && text.split(/[^a-z0-9]+/).indexOf(iata) !== -1) ||
      (label && text.indexOf(label) !== -1) ||
      (
        label &&
        label.split(/\s+[—·-]\s+/).some(function containsLabelPart(part) {
          const normalizedPart = normalizeLocationComparisonValue(part);

          return normalizedPart.length >= 4 && text.indexOf(normalizedPart) !== -1;
        })
      )
    );
  }

  function getCataloguedAirportTransferId(place) {
    const explicitIataCode = getExplicitIataCode(place);
    const explicitAirportId = getExplicitAirportId(place);
    const airports = getCataloguedAirports();
    let index;
    let airport;

    if (!place || typeof place !== "object") {
      return "";
    }

    for (index = 0; index < airports.length; index += 1) {
      airport = airports[index];

      if (
        explicitAirportId === normalizeText(airport.id).toLowerCase() ||
        (
          explicitIataCode &&
          explicitIataCode === normalizeText(airport.iata).toUpperCase()
        ) ||
        hasCatalogIdentityInText(place, airport)
      ) {
        return normalizeText(airport.id);
      }
    }

    return "";
  }

  function isSelectedAirportTransferLocation(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const selectedAirportId = normalizeText(safeInput.airportId).toLowerCase();
    const matchedAirportId = getCataloguedAirportTransferId({
      airportId: selectedAirportId,
      formattedAddress: normalizeText(safeInput.address),
      placeId: normalizeText(safeInput.placeId),
      primaryType: normalizeText(safeInput.primaryType)
    });

    return Boolean(
      selectedAirportId && matchedAirportId === selectedAirportId
    );
  }

  function isCataloguedAirportTransferPlace(place) {
    return Boolean(getCataloguedAirportTransferId(place));
  }

  window.PixkuyDirectTransferAirportGuard = {
    getCataloguedAirportTransferId: getCataloguedAirportTransferId,
    isSelectedAirportTransferLocation: isSelectedAirportTransferLocation,
    isCataloguedAirportTransferPlace: isCataloguedAirportTransferPlace,
    getPlaceSearchText: getPlaceSearchText
  };
})(window);
