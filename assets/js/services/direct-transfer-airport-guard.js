/* assets/js/services/direct-transfer-airport-guard.js
   Direct Transfer airport guard.
   Responsabilidad:
   - clasificar si un Place es realmente un aeropuerto catalogado para Direct Transfer
   - devolver el airportId usado por Airport / Hotel
   - evitar falsos positivos por placeId, cobertura geográfica o abreviaturas territoriales
   - no calcular cobertura Direct Transfer
   - no calcular pricing
   - no tocar Google Places shared
*/

(function initDirectTransferAirportGuard(window) {
  "use strict";

  if (!window) {
    return;
  }

  const CATALOGUED_AIRPORTS = [
    {
      id: "nlu",
      iataCode: "NLU",
      keywords: [
        "aifa",
        "aeropuerto internacional felipe angeles",
        "felipe angeles international airport"
      ]
    },
    {
      id: "tlc",
      iataCode: "TLC",
      keywords: [
        "aeropuerto internacional de toluca",
        "toluca international airport",
        "licenciado adolfo lopez mateos international airport"
      ]
    },
    {
      id: "pbc",
      iataCode: "PBC",
      keywords: [
        "aeropuerto internacional de puebla",
        "puebla international airport",
        "hermanos serdan international airport"
      ]
    },
    {
      id: "qro",
      iataCode: "QRO",
      keywords: [
        "aeropuerto intercontinental de queretaro",
        "aeropuerto intercontinental de querétaro",
        "aeropuerto internacional de queretaro",
        "aeropuerto internacional de querétaro",
        "queretaro intercontinental airport",
        "querétaro intercontinental airport",
        "queretaro international airport",
        "querétaro international airport"
      ]
    },
    {
      id: "mex",
      iataCode: "MEX",
      keywords: [
        "aicm",
        "aeropuerto internacional de la ciudad de mexico",
        "benito juarez international airport"
      ]
    }
  ];

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

  function getPlaceTypes(place) {
    const safePlace = place && typeof place === "object" ? place : {};
    const types = Array.isArray(safePlace.types) ? safePlace.types : [];

    return types.map(normalizeLocationComparisonValue).filter(Boolean);
  }

  function placeLooksLikeAirport(place) {
    const types = getPlaceTypes(place);
    const text = getPlaceSearchText(place);

    return (
      types.indexOf("airport") !== -1 ||
      text.indexOf("airport") !== -1 ||
      text.indexOf("aeropuerto") !== -1 ||
      text.indexOf("aicm") !== -1 ||
      text.indexOf("aifa") !== -1
    );
  }

  function getPlaceSearchText(place) {
    const safePlace = place && typeof place === "object" ? place : {};

    return [
      safePlace.label,
      safePlace.displayName,
      safePlace.formattedAddress,
      safePlace.primaryText,
      safePlace.secondaryText,
      safePlace.text,
      safePlace.address,
      safePlace.iataCode
    ].map(normalizeLocationComparisonValue).filter(Boolean).join(" | ");
  }

  function getExplicitIataCode(place) {
    return normalizeText(place && place.iataCode).toUpperCase();
  }

  function getCataloguedAirportTransferId(place) {
    const explicitIataCode = getExplicitIataCode(place);
    const text = getPlaceSearchText(place);
    const looksLikeAirport = placeLooksLikeAirport(place);
    let index;
    let keywordIndex;
    let airport;

    if (!place || typeof place !== "object") {
      return "";
    }

    for (index = 0; index < CATALOGUED_AIRPORTS.length; index += 1) {
      airport = CATALOGUED_AIRPORTS[index];

      if (explicitIataCode === airport.iataCode) {
        return airport.id;
      }

      if (!looksLikeAirport) {
        continue;
      }

      for (keywordIndex = 0; keywordIndex < airport.keywords.length; keywordIndex += 1) {
        if (text.indexOf(normalizeLocationComparisonValue(airport.keywords[keywordIndex])) !== -1) {
          return airport.id;
        }
      }
    }

    return "";
  }

  function isSelectedAirportTransferLocation(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const selectedAirportId = normalizeText(safeInput.airportId).toLowerCase();
    const primaryType = normalizeText(safeInput.primaryType);
    const matchedAirportId = getCataloguedAirportTransferId({
      formattedAddress: normalizeText(safeInput.address),
      placeId: normalizeText(safeInput.placeId),
      types: primaryType ? [primaryType] : []
    });

    return Boolean(
      selectedAirportId && matchedAirportId === selectedAirportId
    );
  }

  function isCataloguedAirportTransferPlace(place) {
    return Boolean(getCataloguedAirportTransferId(place));
  }

  window.PixkuyDirectTransferAirportGuard = {
    getCataloguedAirportTransferId,
    isSelectedAirportTransferLocation,
    isCataloguedAirportTransferPlace,
    getPlaceSearchText
  };
})(window);