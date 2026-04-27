(function initEventsSpecialQuoteModule(window) {
  "use strict";

  if (!window) return;

  const NAMESPACE = window.PixkuyServicesEventsSpecialQuote =
    window.PixkuyServicesEventsSpecialQuote || {};

  const ENDPOINT = "/.netlify/functions/event-special-quote";

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
      label: normalizeText(value.label),
      placeId: normalizeText(value.placeId),
      lat,
      lng
    };
  }

  function buildQuotePayload(input) {
    const safeInput = isObject(input) ? input : {};
    const variant = normalizeText(safeInput.variant);
    const payload = {
      eventId: normalizeText(safeInput.eventId),
      eventStartsAt: normalizeText(safeInput.eventStartsAt),
      venueId: normalizeText(safeInput.venueId),
      variant,
      passengerFareKey: normalizeText(safeInput.passengerFareKey)
    };

    if (variant === "arrival" || variant === "round_trip") {
      payload.originAddress = normalizeAddress(safeInput.originAddress);
      payload.originPickupTime = normalizeText(safeInput.originPickupTime);
    }

    if (variant === "departure" || variant === "round_trip") {
      payload.destinationAddress = normalizeAddress(safeInput.destinationAddress);
      payload.returnPickupTime = normalizeText(safeInput.returnPickupTime);
      payload.returnPickupDayOffset = String(safeInput.returnPickupDayOffset) === "1" ? 1 : 0;
    }

    return payload;
  }

  function isQuotePayloadComplete(payload) {
    if (!isObject(payload)) return false;

    if (
      !payload.eventId ||
      !payload.venueId ||
      !payload.variant ||
      !payload.passengerFareKey
    ) {
      return false;
    }

    if (payload.variant === "arrival") {
      return Boolean(payload.originAddress && payload.originPickupTime);
    }

    if (payload.variant === "departure") {
      return Boolean(payload.destinationAddress && payload.returnPickupTime);
    }

    if (payload.variant === "round_trip") {
      return Boolean(
        payload.originAddress &&
        payload.destinationAddress &&
        payload.originPickupTime &&
        payload.returnPickupTime
      );
    }

    return false;
  }

  async function requestQuote(input) {
    const payload = buildQuotePayload(input);

    if (!isQuotePayloadComplete(payload)) {
      return {
        ok: false,
        code: "INCOMPLETE_QUOTE_PAYLOAD",
        messageKey: "services.cards.events.panel.quotePending"
      };
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || data.ok !== true) {
      return {
        ok: false,
        code: data && data.code ? data.code : "QUOTE_UNAVAILABLE",
        messageKey: data && data.messageKey
          ? data.messageKey
          : "services.cards.events.panel.quoteUnavailable"
      };
    }

    return data;
  }

  NAMESPACE.buildQuotePayload = buildQuotePayload;
  NAMESPACE.isQuotePayloadComplete = isQuotePayloadComplete;
  NAMESPACE.requestQuote = requestQuote;
})(window);