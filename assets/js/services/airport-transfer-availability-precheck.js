/* assets/js/services/airport-transfer-availability-precheck.js
   Airport Transfer availability precheck.
   Responsabilidad:
   - consultar el precheck público de Airport Transfer antes de continuar
   - reutilizar PIXKUY_BOOKING_API_CONFIG
   - validar precio/policy/stale quote según backend actual
   - no crear reservas
   - no crear holds
   - no tocar Stripe
   - no tocar Netlify Forms
*/

(function initAirportTransferAvailabilityPrecheck(window) {
  "use strict";

  if (!window) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var PRECHECK_ENDPOINT = "/v1/public/reservations/airport-transfer-availability-precheck";
  var DEFAULT_CURRENCY = "MXN";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG;
    var hasExplicitApiBaseUrl;

    if (!config || typeof config !== "object") {
      return {
        apiBaseUrl: DEFAULT_BOOKING_API_BASE_URL,
        publicSiteKey: DEFAULT_PUBLIC_SITE_KEY
      };
    }

    hasExplicitApiBaseUrl =
      Object.prototype.hasOwnProperty.call(config, "apiBaseUrl") &&
      typeof config.apiBaseUrl === "string";

    return {
      apiBaseUrl: hasExplicitApiBaseUrl
        ? normalizeText(config.apiBaseUrl)
        : DEFAULT_BOOKING_API_BASE_URL,
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY
    };
  }

  function buildPrecheckUrl(config) {
    return config.apiBaseUrl.replace(/\/+$/, "") + PRECHECK_ENDPOINT;
  }

  function normalizeDirection(value) {
    var direction = normalizeText(value);

    if (direction === "airport_to_destination") {
      return direction;
    }

    if (direction === "destination_to_airport") {
      return direction;
    }

    if (direction === "airport_to_hotel") {
      return "airport_to_destination";
    }

    if (direction === "hotel_to_airport") {
      return "destination_to_airport";
    }

    return "";
  }

  function parsePositiveMoneyMinor(value) {
    var parsed;

    if (typeof value === "number") {
      parsed = value;
    } else {
      parsed = Number(normalizeText(value).replace(/[^\d]/g, ""));
    }

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  
    function parsePositiveInteger(value) {
    var parsed;

    if (typeof value === "number") {
      parsed = value;
    } else {
      parsed = Number(normalizeText(value).replace(/[^\d]/g, ""));
    }

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function parseFiniteNumber(value) {
    var parsed;

    if (typeof value === "number") {
      parsed = value;
    } else {
      parsed = Number(normalizeText(value));
    }

    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildNonAirportLocation(detail) {
    var source =
      detail && detail.nonAirportLocation && typeof detail.nonAirportLocation === "object"
        ? detail.nonAirportLocation
        : {};
    var address = normalizeText(source.address);
    var placeId = normalizeText(source.place_id || source.placeId);
    var lat = parseFiniteNumber(source.lat);
    var lng = parseFiniteNumber(source.lng);
    var location;

    if (!address || lat === null || lng === null) {
      return null;
    }

    location = {
      address: address,
      lat: lat,
      lng: lng
    };

    if (placeId) {
      location.place_id = placeId;
    }

    return location;
  }

  function isAirportTransferPrecheckDetail(detail) {
    return Boolean(
      detail &&
        normalizeText(detail.serviceType) === "airport_transfer"
    );
  }

  function buildPayload(detail) {
    var safeDetail = detail && typeof detail === "object" ? detail : {};
    var airportId = normalizeText(safeDetail.airportId).toLowerCase();
    var direction = normalizeDirection(safeDetail.direction);
    var zoneId = normalizeText(safeDetail.zoneId);
    var passengerFareKey = normalizeText(safeDetail.passengerFareKey);
    var date = normalizeText(safeDetail.date);
    var time = normalizeText(safeDetail.time);
    var expectedAmountMinor = parsePositiveMoneyMinor(safeDetail.expectedAmountMinor);
    var nonAirportLocation = buildNonAirportLocation(safeDetail);
    var passengers = parsePositiveInteger(safeDetail.passengers);
    var currency = normalizeText(safeDetail.currency) || DEFAULT_CURRENCY;
    var locale = normalizeText(safeDetail.locale) || "es";

    if (!isAirportTransferPrecheckDetail(safeDetail)) {
      return null;
    }

    if (
      !airportId ||
      !direction ||
      !zoneId ||
      !passengerFareKey ||
      !nonAirportLocation ||
      !passengers ||
      passengers > 6 ||
      !date ||
      !time ||
      !expectedAmountMinor
    ) {
      return null;
    }

    return {
      serviceType: "airport_transfer",
      airportId: airportId,
      direction: direction,
      zoneId: zoneId,
      passengerFareKey: passengerFareKey,
      nonAirportLocation: nonAirportLocation,
      passengers: passengers,
      date: date,
      time: time,
      expectedAmountMinor: expectedAmountMinor,
      currency: currency,
      locale: locale
    };
  }

  function normalizeResult(response, body) {
    var result = body && body.result ? body.result : {};
    var price = result && result.price ? result.price : {};
    var availability = result && result.availability ? result.availability : {};
    var pricingVersion = normalizeText(price && price.pricingVersion);
    var quoteFingerprint = normalizeText(price && price.quoteFingerprint);
    var code =
      normalizeText(body && body.code) ||
      normalizeText(result && result.code) ||
      normalizeText(availability && availability.code) ||
      normalizeText(price && price.reason) ||
      "";
    var nextAvailableStartLocal = normalizeText(
      availability && availability.nextAvailableStartLocal
    );
    var checkoutAllowed = Boolean(
      response &&
        response.ok &&
        body &&
        (
          body.precheckAllowed === true ||
          body.checkoutAllowed === true ||
          result.precheckAllowed === true ||
          result.checkoutAllowed === true
        )
    );
    var priceAvailable = Boolean(price && price.available === true);
    var availabilityAvailable = Boolean(
      availability &&
        (
          availability.available === true ||
          availability.status === "available"
        )
    );
    var available = Boolean(
      checkoutAllowed &&
        priceAvailable &&
        availabilityAvailable
    );

    return {
      ok: Boolean(response && response.ok),
      statusCode: response ? response.status : 0,
      raw: body || {},
      code: code,
      nextAvailableStartLocal: nextAvailableStartLocal,
      available: available,
      checkoutAllowed: checkoutAllowed,
      pricingVersion: pricingVersion,
      quoteFingerprint: quoteFingerprint
    };
  }

  function precheck(detail) {
    var config = getConfig();
    var payload = buildPayload(detail);

    if (!isAirportTransferPrecheckDetail(detail)) {
      return Promise.resolve({
        available: true,
        checkoutAllowed: true,
        skipped: true,
        code: "PRECHECK_SKIPPED",
        raw: {}
      });
    }

    if (!payload) {
      return Promise.resolve({
        available: false,
        checkoutAllowed: false,
        skipped: false,
        code: "INVALID_PRECHECK_PAYLOAD",
        raw: {}
      });
    }

    return window.fetch(buildPrecheckUrl(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pixkuy-Site-Key": config.publicSiteKey
      },
      body: JSON.stringify(payload)
    }).then(function handleResponse(response) {
      return response.json().catch(function () {
        return {};
      }).then(function handleBody(body) {
        return normalizeResult(response, body);
      });
    }).catch(function () {
      return {
        available: false,
        checkoutAllowed: false,
        skipped: false,
        code: "PRECHECK_REQUEST_FAILED",
        raw: {}
      };
    });
  }

  window.PixkuyAirportTransferAvailabilityPrecheck = {
    precheck: precheck,
    buildPayload: buildPayload,
    isAirportTransferPrecheckDetail: isAirportTransferPrecheckDetail
  };
})(window);
