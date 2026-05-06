/* assets/js/services/direct-transfer-quote.js
   Direct Transfer quote client.
   Responsabilidad:
   - construir payload de direct_transfer
   - llamar a Function server-side direct-transfer-quote
   - no calcular precio en frontend
   - no tocar Google Routes directamente
*/

(function initDirectTransferQuoteModule(window) {
  "use strict";

  if (!window) return;

  const NAMESPACE = window.PixkuyDirectTransferQuote =
    window.PixkuyDirectTransferQuote || {};

  const ENDPOINT = "/.netlify/functions/direct-transfer-quote";

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeCoordinate(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeAddress(value) {
    if (!isObject(value)) return null;

    const lat = normalizeCoordinate(value.lat);
    const lng = normalizeCoordinate(value.lng);

    if (lat === null || lng === null) return null;

    return {
      label: normalizeText(value.label || value.formattedAddress || value.displayName),
      placeId: normalizeText(value.placeId || value.place_id || value.id),
      lat,
      lng,
      countryCode: normalizeText(value.countryCode || value.regionCode),
      administrativeAreaLevel1: normalizeText(
        value.administrativeAreaLevel1 ||
          value.adminAreaLevel1 ||
          value.state ||
          value.region
      ),
      administrativeAreaLevel2: normalizeText(
        value.administrativeAreaLevel2 ||
          value.adminAreaLevel2 ||
          value.county
      ),
      locality: normalizeText(value.locality || value.city),
      iataCode: normalizeText(value.iataCode),
      types: Array.isArray(value.types) ? value.types.slice(0, 12) : [],
      addressComponents: Array.isArray(value.addressComponents)
        ? value.addressComponents.slice(0, 16)
        : []
    };
  }

  function buildQuotePayload(input) {
    const safeInput = isObject(input) ? input : {};

    return {
      originAddress: normalizeAddress(safeInput.originAddress),
      destinationAddress: normalizeAddress(safeInput.destinationAddress),
      pickupDate: normalizeText(safeInput.pickupDate),
      pickupTime: normalizeText(safeInput.pickupTime),
      passengerFareKey: normalizeText(safeInput.passengerFareKey)
    };
  }

  function isQuotePayloadComplete(payload) {
    return Boolean(
      isObject(payload) &&
        payload.originAddress &&
        payload.destinationAddress &&
        payload.pickupDate &&
        payload.pickupTime &&
        payload.passengerFareKey
    );
  }

  async function requestQuote(input) {
    const payload = buildQuotePayload(input);

    if (!isQuotePayloadComplete(payload)) {
      return {
        ok: false,
        code: "INCOMPLETE_QUOTE_PAYLOAD",
        messageKey: "directTransferMobileFlow.fare.pending"
      };
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(function parseFailure() {
      return null;
    });

    if (!response.ok || !data || data.ok !== true) {
      return {
        ok: false,
        code: data && data.code ? data.code : "QUOTE_UNAVAILABLE",
        messageKey: data && data.messageKey
          ? data.messageKey
          : "directTransferMobileFlow.fare.unavailable"
      };
    }

    return data;
  }

  NAMESPACE.buildQuotePayload = buildQuotePayload;
  NAMESPACE.isQuotePayloadComplete = isQuotePayloadComplete;
  NAMESPACE.requestQuote = requestQuote;
})(window);