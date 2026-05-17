/* assets/js/services/hourly-availability-precheck.js
   Hourly / Daily availability precheck.
   Responsabilidad:
   - consultar disponibilidad pública antes de continuar desde el panel Hourly
   - reutilizar PIXKUY_BOOKING_API_CONFIG
   - no crear reservas
   - no crear holds
   - no tocar Stripe
   - no tocar Netlify Forms
*/

(function initHourlyAvailabilityPrecheck(window) {
  "use strict";

  if (!window) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var PRECHECK_ENDPOINT = "/v1/public/reservations/hourly-availability-precheck";
  var DEFAULT_HOURLY_PASSENGERS = 6;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG;

    if (!config || typeof config !== "object") {
      return {
        apiBaseUrl: DEFAULT_BOOKING_API_BASE_URL,
        publicSiteKey: DEFAULT_PUBLIC_SITE_KEY
      };
    }

    return {
      apiBaseUrl: normalizeText(config.apiBaseUrl) || DEFAULT_BOOKING_API_BASE_URL,
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY
    };
  }

  function buildPrecheckUrl(config) {
    return config.apiBaseUrl.replace(/\/+$/, "") + PRECHECK_ENDPOINT;
  }

  function parsePositiveInteger(value) {
    var normalized = normalizeText(value).replace(/[^\d]/g, "");
    var parsed = Number(normalized);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function parseMoneyMinorUnitsFromMxn(value) {
  var normalized;
  var parsed;

  if (typeof value === "number") {
    parsed = value;
  } else {
    normalized = normalizeText(value).replace(/[^\d.]/g, "");
    parsed = Number(normalized);
  }

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

  function parseOptionalNumber(value) {
    var normalized = normalizeText(value);
    var parsed;

    if (!normalized) {
      return null;
    }

    parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  }

  function isTransactionalHourlyDetail(detail) {
    return Boolean(
      detail &&
        detail.serviceType === "hourly_daily" &&
        (
          detail.hourly_daily_mode === "hourly" ||
          detail.hourly_daily_mode === "full_day"
        )
    );
  }

  function buildPayload(detail) {
    var safeDetail = detail && typeof detail === "object" ? detail : {};
    var durationHours = parsePositiveInteger(safeDetail.hourly_daily_duration_hours);
    var amountMinor = parseMoneyMinorUnitsFromMxn(safeDetail.hourly_daily_price);
    var lat = parseOptionalNumber(safeDetail.hourly_daily_pickup_lat);
    var lng = parseOptionalNumber(safeDetail.hourly_daily_pickup_lng);
    var payload;

    if (!isTransactionalHourlyDetail(safeDetail)) {
      return null;
    }

    if (
      !safeDetail.hourly_daily_pickup ||
      !safeDetail.hourly_daily_date ||
      !safeDetail.hourly_daily_start_time ||
      !durationHours ||
      !amountMinor
    ) {
      return null;
    }

    payload = {
      service_type: "hourly_daily",
      hourly_daily_mode: safeDetail.hourly_daily_mode,
      hourly_daily_pickup: safeDetail.hourly_daily_pickup,
      hourly_daily_date: safeDetail.hourly_daily_date,
      hourly_daily_start_time: safeDetail.hourly_daily_start_time,
      hourly_daily_duration_hours: durationHours,
      hourly_daily_passengers: DEFAULT_HOURLY_PASSENGERS,
      hourly_daily_price: amountMinor,
      hourly_daily_currency: normalizeText(safeDetail.hourly_daily_currency) || "MXN"
    };

    if (normalizeText(safeDetail.hourly_daily_pickup_place_id)) {
      payload.hourly_daily_pickup_place_id = normalizeText(safeDetail.hourly_daily_pickup_place_id);
    }

    if (lat !== null) {
      payload.hourly_daily_pickup_lat = lat;
    }

    if (lng !== null) {
      payload.hourly_daily_pickup_lng = lng;
    }

    return payload;
  }

  function normalizeResult(response, body) {
    var availability = body && body.availability ? body.availability : {};
    var code =
      normalizeText(body && body.code) ||
      normalizeText(availability && availability.code) ||
      "";
    var nextAvailableStartLocal = normalizeText(
      availability && availability.nextAvailableStartLocal
    );

    return {
      ok: Boolean(response && response.ok),
      statusCode: response ? response.status : 0,
      raw: body || {},
      code: code,
      nextAvailableStartLocal: nextAvailableStartLocal,
      available: Boolean(
        response &&
          response.ok &&
          body &&
          body.checkoutAllowed === true &&
          availability &&
          availability.available === true
      )
    };
  }

  function precheck(detail) {
    var config = getConfig();
    var payload = buildPayload(detail);

    if (!isTransactionalHourlyDetail(detail)) {
      return Promise.resolve({
        available: true,
        skipped: true,
        code: "PRECHECK_SKIPPED",
        raw: {}
      });
    }

    if (!payload) {
      return Promise.resolve({
        available: false,
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
        skipped: false,
        code: "PRECHECK_REQUEST_FAILED",
        raw: {}
      };
    });
  }

  window.PixkuyHourlyAvailabilityPrecheck = {
    precheck: precheck,
    buildPayload: buildPayload,
    isTransactionalHourlyDetail: isTransactionalHourlyDetail
  };
})(window);