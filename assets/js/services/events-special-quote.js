(function initEventsSpecialQuoteModule(window) {
  "use strict";

  if (!window) return;

  const NAMESPACE = window.PixkuyServicesEventsSpecialQuote =
    window.PixkuyServicesEventsSpecialQuote || {};

  const ENDPOINT = "/v1/public/special-events/quote";
  const requestControllers = new Map();

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

    const label = normalizeText(value.label);
    const placeId = normalizeText(value.placeId);

    if (!label || !placeId) return null;

    const address = { label, placeId };

    if (lat !== null && lng !== null) {
      address.lat = lat;
      address.lng = lng;
    }

    return address;
  }

  function buildQuotePayload(input) {
    const safeInput = isObject(input) ? input : {};
    const variant = normalizeText(safeInput.variant);
    const payload = {
      eventId: normalizeText(safeInput.eventId),
      venueId: normalizeText(safeInput.venueId),
      snapshotVersion: Number(safeInput.snapshotVersion),
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
      !Number.isInteger(payload.snapshotVersion) ||
      payload.snapshotVersion < 1 ||
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

    const configLoader = window.PixkuyBookingPublicConfig;

    if (configLoader && configLoader.ready && typeof configLoader.ready.then === "function") {
      await configLoader.ready;
    }

    const config = window.PIXKUY_BOOKING_API_CONFIG;
    const safeConfig = config && typeof config === "object" ? config : {};
    const apiBaseUrl = normalizeText(safeConfig.apiBaseUrl).replace(/\/+$/, "");
    const publicSiteKey = normalizeText(safeConfig.publicSiteKey);

    if (!publicSiteKey) {
      return {
        ok: false,
        code: "PUBLIC_CONFIG_UNAVAILABLE",
        messageKey: "services.cards.events.panel.quoteUnavailable"
      };
    }

    const requestKey = normalizeText(input && input.requestKey) || "default";
    const previousController = requestControllers.get(requestKey);
    const controller = typeof window.AbortController === "function"
      ? new window.AbortController()
      : null;

    if (previousController) previousController.abort();
    if (controller) requestControllers.set(requestKey, controller);

    try {
      const response = await window.fetch(apiBaseUrl + ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pixkuy-Site-Key": publicSiteKey
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
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

      if (Number(data.snapshotVersion) !== payload.snapshotVersion) {
        return {
          ok: false,
          code: "EVENT_SNAPSHOT_CONFLICT",
          messageKey: "services.cards.events.panel.quoteUnavailable"
        };
      }

      return data;
    } finally {
      if (controller && requestControllers.get(requestKey) === controller) {
        requestControllers.delete(requestKey);
      }
    }
  }

  NAMESPACE.buildQuotePayload = buildQuotePayload;
  NAMESPACE.isQuotePayloadComplete = isQuotePayloadComplete;
  NAMESPACE.requestQuote = requestQuote;
})(window);
