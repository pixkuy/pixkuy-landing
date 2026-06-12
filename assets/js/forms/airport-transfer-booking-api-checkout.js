/* assets/js/forms/airport-transfer-booking-api-checkout.js
   Airport Transfer Booking API checkout bridge.
   Responsabilidad:
   - interceptar sólo airport_hotel transaccional
   - desktop: guardar snapshot y redirigir a airport-transfer-checkout-review.html
   - mobile: llamar Booking API y redirigir a Stripe Checkout
   - dejar intacto Netlify Forms para el resto de servicios
   - no tocar Hourly
*/

(function initAirportTransferBookingApiCheckout(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var CHECKOUT_ENDPOINT = "/v1/public/reservations/checkout";
  var RECAPTCHA_ACTION = "airport_transfer_checkout";
  var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
  var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";
  var AIRPORT_TRANSFER_CHECKOUT_REVIEW_PATH = "/airport-transfer-checkout-review.html";
  var AIRPORT_TRANSFER_CHECKOUT_REVIEW_STORAGE_KEY =
    "pixkuy_airport_transfer_checkout_review_snapshot";
  var LEGAL_ACCEPTANCE_HOST_SELECTOR =
    "[data-airport-transfer-checkout-legal-acceptance]";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG;
    var hasExplicitApiBaseUrl;

    if (!config || typeof config !== "object") {
      return {
        apiBaseUrl: DEFAULT_BOOKING_API_BASE_URL,
        publicSiteKey: DEFAULT_PUBLIC_SITE_KEY,
        recaptchaSiteKey: ""
      };
    }

    hasExplicitApiBaseUrl =
      Object.prototype.hasOwnProperty.call(config, "apiBaseUrl") &&
      typeof config.apiBaseUrl === "string";

    return {
      apiBaseUrl: hasExplicitApiBaseUrl
        ? normalizeText(config.apiBaseUrl)
        : DEFAULT_BOOKING_API_BASE_URL,
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY,
      recaptchaSiteKey: normalizeText(config.recaptchaSiteKey)
    };
  }

  function getReservationApi() {
    var api = window.PixkuyForms;

    if (
      !api ||
      typeof api.getReservationRequestFields !== "function" ||
      typeof api.getReservationRequestData !== "function" ||
      typeof api.refreshReservationRequestValidationUX !== "function"
    ) {
      return null;
    }

    return api;
  }

  function getAvailabilityPrecheckApi() {
    var api = window.PixkuyAirportTransferAvailabilityPrecheck;

    return api && typeof api.precheck === "function" ? api : null;
  }

  function getForm() {
    var api = window.PixkuyForms;

    if (api && typeof api.getReservationForm === "function") {
      return api.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function getField(form, name) {
    return form ? form.querySelector('[name="' + name + '"]') : null;
  }

  function getFieldValue(form, name) {
    var field = getField(form, name);

    return normalizeText(field && field.value);
  }

  function getDocumentLocale() {
    var lang =
      normalizeText(window.__pixkuyI18nLang) ||
      normalizeText(document.documentElement && document.documentElement.lang) ||
      "es";

    lang = lang.toLowerCase();

    if (lang === "zh-cn") {
      return "zh-hans";
    }

    return lang;
  }

  function getI18nValue(path, fallback) {
    var modules = window.__pixkuyI18nModules || {};
    var getValue = modules.getValue;
    var dict = window.__pixkuyI18nDict || null;
    var value;

    if (typeof getValue === "function" && dict) {
      value = getValue(dict, path);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return fallback || "";
  }

  function isAirportTransferTransactionalData(data) {
    return Boolean(
      data &&
      data.serviceType === "airport_hotel"
    );
  }

  function isDesktopViewport() {
    return !(
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }

  function hasRequiredAirportTransferCheckoutData(data) {
    return Boolean(
      data &&
      isAirportTransferTransactionalData(data) &&
      normalizeText(data.name) &&
      normalizeText(data.email) &&
      normalizeText(data.phone) &&
      normalizeText(data.airportHotelDate) &&
      normalizeText(data.airportHotelTime) &&
      normalizeText(data.zone) &&
      normalizeText(data.fare) &&
      normalizeText(data.passengerFareKey)
    );
  }

  function parseMoneyMinorUnitsFromMxn(value) {
    var normalized = normalizeText(value).replace(/[^\d.]/g, "");
    var parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed * 100);
  }

  function addOptionalString(payload, key, value) {
    var normalized = normalizeText(value);

    if (normalized) {
      payload[key] = normalized;
    }

    return payload;
  }

  function addOptionalNumber(payload, key, value) {
    var normalized = normalizeText(value);
    var parsed;

    if (!normalized) {
      return payload;
    }

    parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      payload[key] = parsed;
    }

    return payload;
  }

  function buildCheckoutUrl(config) {
    return config.apiBaseUrl.replace(/\/+$/, "") + CHECKOUT_ENDPOINT;
  }

  function createIdempotencyKey() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return [
      "pixkuy-airport-checkout",
      Date.now(),
      Math.random().toString(36).slice(2, 12)
    ].join("-");
  }

  function getFormPayloadRaw(form) {
    var payload = {};
    var data;

    if (!form || typeof window.FormData !== "function") {
      return payload;
    }

    data = new window.FormData(form);

    data.forEach(function copyValue(value, key) {
      if (typeof value === "string") {
        payload[key] = value;
      }
    });

    return payload;
  }

  function addLegalAcceptanceFields(payload, form) {
    [
      "legal_acceptance_accepted",
      "legal_acceptance_terms_version",
      "legal_acceptance_cancellation_policy_version",
      "legal_acceptance_privacy_version",
      "legal_acceptance_accepted_at",
      "legal_acceptance_channel",
      "legal_acceptance_terms_url",
      "legal_acceptance_cancellations_url",
      "legal_acceptance_privacy_url"
    ].forEach(function copyLegalField(name) {
      var value = getFieldValue(form, name);

      if (value) {
        payload[name] = value;
      }
    });

    return payload;
  }

  function getAirportTransferDirection(data, form) {
    return normalizeText(
      getFieldValue(form, "airport_hotel_direction") ||
        data.airportHotelDirection ||
        data.direction
    );
  }

  function getAirportTransferDirectionForApi(direction) {
    var safeDirection = normalizeText(direction);

    if (safeDirection === "hotel_to_airport") {
      return "destination_to_airport";
    }

    if (safeDirection === "destination_to_airport") {
      return "destination_to_airport";
    }

    return "airport_to_destination";
  }

  function getAirportId(form) {
    var snapshotApi = window.PixkuyForms &&
      typeof window.PixkuyForms.getContactAirportHotelSnapshot === "function"
        ? window.PixkuyForms.getContactAirportHotelSnapshot
        : null;
    var snapshot = snapshotApi ? snapshotApi() : null;

    return normalizeText(
      snapshot && snapshot.airportId
    );
  }

  function buildRequestSummary(data, form) {
    var parts = [];
    var direction = getAirportTransferDirection(data, form);
    var directionLabel = getFieldValue(form, "airport_hotel_direction_label");
    var airportLabel = getFieldValue(form, "airport_hotel_airport_label");
    var destinationLabel = getFieldValue(form, "airport_hotel_hotel_label");
    var zoneLabel = getFieldValue(form, "airport_hotel_zone_label");
    var fareLabel = getFieldValue(form, "airport_hotel_fare_label");
    var passengerLabel = getFieldValue(form, "airport_hotel_passenger_bucket_label");

    if (directionLabel || direction) {
      parts.push("trip: " + (directionLabel || direction));
    }

    if (airportLabel) {
      parts.push("airport: " + airportLabel);
    }

    if (destinationLabel) {
      parts.push("destination: " + destinationLabel);
    }

    if (zoneLabel) {
      parts.push("zone: " + zoneLabel);
    }

    if (data.airportHotelDate) {
      parts.push("date: " + data.airportHotelDate);
    }

    if (data.airportHotelTime) {
      parts.push("time: " + data.airportHotelTime);
    }

    if (passengerLabel || data.passengerFareKey) {
      parts.push("passengers: " + (passengerLabel || data.passengerFareKey));
    }

    if (fareLabel || data.fare) {
      parts.push("price: " + (fareLabel || data.fare));
    }

    return parts.join(" | ");
  }
  
    function getAirportTransferSnapshot() {
    var snapshotApi =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getContactAirportHotelSnapshot === "function"
        ? window.PixkuyForms.getContactAirportHotelSnapshot
        : null;

    return snapshotApi ? snapshotApi() : null;
  }

  function isTechnicalAirportZoneId(value) {
    var zoneId = normalizeText(value);

    return Boolean(zoneId && /^[a-z0-9_]+$/.test(zoneId));
  }

  function getAirportTransferZoneId(data) {
    var snapshot = getAirportTransferSnapshot();
    var candidates = [
      snapshot && snapshot.zoneId,
      data && data.zone,
      snapshot && snapshot.airport_transfer_zone_id,
      snapshot && snapshot.resolvedZoneId,
      snapshot && snapshot.lodgingEndpointZoneId
    ];
    var index;
    var candidate;

    for (index = 0; index < candidates.length; index += 1) {
      candidate = normalizeText(candidates[index]);

      if (isTechnicalAirportZoneId(candidate)) {
        return candidate;
      }
    }

    return "";
  }

  function parseOptionalFiniteNumber(value) {
    var parsed;

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  function parsePositiveInteger(value) {
    var parsed = parseOptionalFiniteNumber(value);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    parsed = Math.trunc(parsed);

    return parsed > 0 ? parsed : null;
  }

  function getAirportTransferPassengers(data) {
    var explicitPassengers = parsePositiveInteger(
      data && (
        data.airportTransferPassengers ||
        data.airport_transfer_passengers ||
        data.passengers ||
        data.passengerCount
      )
    );
    var fareKey = normalizeText(data && data.passengerFareKey);

    if (explicitPassengers && explicitPassengers <= 6) {
      return explicitPassengers;
    }

    if (fareKey === "van_1_2") {
      return 2;
    }

    if (fareKey === "van_3_4") {
      return 4;
    }

    if (fareKey === "van_5_6") {
      return 6;
    }

    return null;
  }

  function getNonAirportLocation(data, apiDirection) {
    var isDestinationToAirport = apiDirection === "destination_to_airport";
    var address = normalizeText(
      isDestinationToAirport ? data.origin : data.destination
    );
    var placeId = normalizeText(
      isDestinationToAirport ? data.originPlaceId : data.destinationPlaceId
    );
    var lat = parseOptionalFiniteNumber(
      isDestinationToAirport ? data.originLat : data.destinationLat
    );
    var lng = parseOptionalFiniteNumber(
      isDestinationToAirport ? data.originLng : data.destinationLng
    );
    var location;

    if (!address) {
      return null;
    }

    location = {
      address: address
    };

    if (placeId) {
      location.place_id = placeId;
    }

    if (Number.isFinite(lat)) {
      location.lat = lat;
    }

    if (Number.isFinite(lng)) {
      location.lng = lng;
    }

    return location;
  }

  function buildCheckoutPayload(form, data, recaptchaToken) {
    var amountMinor = parseMoneyMinorUnitsFromMxn(data.fare);
    var direction = getAirportTransferDirection(data, form);
    var apiDirection = getAirportTransferDirectionForApi(direction);
    var airportId = getAirportId(form);
    var zoneId = getAirportTransferZoneId(data);
    var passengers = getAirportTransferPassengers(data);
    var nonAirportLocation = getNonAirportLocation(data, apiDirection);
    var payload;

    if (!amountMinor || !zoneId || !passengers || !nonAirportLocation) {
      return null;
    }

    payload = {
      service_type: "airport_transfer",
      airport_transfer_direction: apiDirection,
      airport_transfer_airport_id: airportId,
      airport_transfer_origin: data.origin,
      airport_transfer_destination: data.destination,
      airport_transfer_zone_id: zoneId,
      airport_transfer_passenger_fare_key: data.passengerFareKey,
      airport_transfer_non_airport_location: nonAirportLocation,
      airport_transfer_date: data.airportHotelDate,
      airport_transfer_time: data.airportHotelTime,
      airport_transfer_passengers: passengers,
      airport_transfer_luggage: data.luggage,
      airport_transfer_price: amountMinor,
      airport_transfer_currency: "MXN",
      request_summary: getFieldValue(form, "request_summary") || buildRequestSummary(data, form),
      locale: getDocumentLocale(),
      customer: {
        full_name: data.name,
        email: data.email,
        phone: data.phone
      },
      form_payload_raw: getFormPayloadRaw(form)
    };

    addOptionalString(payload, "airport_transfer_origin_place_id", data.originPlaceId);
    addOptionalNumber(payload, "airport_transfer_origin_lat", data.originLat);
    addOptionalNumber(payload, "airport_transfer_origin_lng", data.originLng);
    addOptionalString(payload, "airport_transfer_destination_place_id", data.destinationPlaceId);
    addOptionalNumber(payload, "airport_transfer_destination_lat", data.destinationLat);
    addOptionalNumber(payload, "airport_transfer_destination_lng", data.destinationLng);
    addOptionalString(payload, "airport_transfer_direction_label", getFieldValue(form, "airport_hotel_direction_label"));
    addOptionalString(payload, "airport_transfer_airport_label", getFieldValue(form, "airport_hotel_airport_label"));
    addOptionalString(payload, "airport_transfer_destination_label", getFieldValue(form, "airport_hotel_hotel_label"));
    addOptionalString(payload, "airport_transfer_zone_label", getFieldValue(form, "airport_hotel_zone_label"));
    addOptionalString(payload, "airport_transfer_price_label", getFieldValue(form, "airport_hotel_fare_label"));
    addOptionalString(payload, "airport_transfer_passenger_bucket_label", getFieldValue(form, "airport_hotel_passenger_bucket_label"));
    addOptionalString(payload, "airport_transfer_notes", data.notes);
    addLegalAcceptanceFields(payload, form);

    if (normalizeText(recaptchaToken)) {
      payload.recaptchaToken = normalizeText(recaptchaToken);
    }

    return payload;
  }
  
    function buildAvailabilityPrecheckDetail(form, data) {
    var amountMinor = parseMoneyMinorUnitsFromMxn(data.fare);
    var direction = getAirportTransferDirection(data, form);
    var apiDirection = getAirportTransferDirectionForApi(direction);
    var zoneId = getAirportTransferZoneId(data);
    var passengers = getAirportTransferPassengers(data);
    var nonAirportLocation = getNonAirportLocation(data, apiDirection);

    if (!amountMinor || !zoneId || !passengers || !nonAirportLocation) {
      return null;
    }

    return {
      serviceType: "airport_transfer",
      airportId: getAirportId(form),
      direction: apiDirection,
      zoneId: zoneId,
      passengerFareKey: data.passengerFareKey,
      nonAirportLocation: nonAirportLocation,
      passengers: passengers,
      date: data.airportHotelDate,
      time: data.airportHotelTime,
      expectedAmountMinor: amountMinor,
      currency: "MXN",
      locale: getDocumentLocale()
    };
  }

  function buildCheckoutReviewSnapshot(form, data) {
    var snapshot = getFormPayloadRaw(form);
    var airportSnapshot =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getContactAirportHotelSnapshot === "function"
        ? window.PixkuyForms.getContactAirportHotelSnapshot()
        : null;

    snapshot.name = data.name;
    snapshot.email = data.email;
    snapshot.phone = data.phone;
    snapshot.service_type = "airport_transfer";
    snapshot.legacy_service_type = "airport_hotel";
    snapshot.airport_transfer_direction = getAirportTransferDirectionForApi(
      getAirportTransferDirection(data, form)
    );
    snapshot.airport_transfer_airport_id =
      airportSnapshot && airportSnapshot.airportId ? airportSnapshot.airportId : "";
    snapshot.airport_transfer_origin = data.origin;
    snapshot.airport_transfer_destination = data.destination;
    snapshot.airport_transfer_date = data.airportHotelDate;
    snapshot.airport_transfer_time = data.airportHotelTime;
    snapshot.airport_transfer_zone_id =
      airportSnapshot && airportSnapshot.zoneId ? airportSnapshot.zoneId : data.zone;
    snapshot.airport_transfer_passenger_fare_key = data.passengerFareKey;
    snapshot.airport_transfer_luggage = data.luggage;
    snapshot.airport_transfer_price = data.fare;
    snapshot.airport_transfer_currency = "MXN";
    snapshot.airport_transfer_origin_place_id = data.originPlaceId || "";
    snapshot.airport_transfer_origin_lat = data.originLat || "";
    snapshot.airport_transfer_origin_lng = data.originLng || "";
    snapshot.airport_transfer_destination_place_id = data.destinationPlaceId || "";
    snapshot.airport_transfer_destination_lat = data.destinationLat || "";
    snapshot.airport_transfer_destination_lng = data.destinationLng || "";
    snapshot.airport_transfer_direction_label =
      getFieldValue(form, "airport_hotel_direction_label");
    snapshot.airport_transfer_airport_label =
      getFieldValue(form, "airport_hotel_airport_label");
    snapshot.airport_transfer_destination_label =
      getFieldValue(form, "airport_hotel_hotel_label");
    snapshot.airport_transfer_zone_label =
      getFieldValue(form, "airport_hotel_zone_label");
    snapshot.airport_transfer_price_label =
      getFieldValue(form, "airport_hotel_fare_label");
    snapshot.airport_transfer_passenger_bucket_label =
      getFieldValue(form, "airport_hotel_passenger_bucket_label");
    snapshot.request_summary =
      getFieldValue(form, "request_summary") || buildRequestSummary(data, form);
    snapshot.locale = getDocumentLocale();
    snapshot.form_payload_raw = getFormPayloadRaw(form);

    if (airportSnapshot && typeof airportSnapshot === "object") {
      snapshot.direction = airportSnapshot.direction || "";
      snapshot.airportId = airportSnapshot.airportId || "";
      snapshot.zoneId = airportSnapshot.zoneId || "";
      snapshot.zoneLabel = airportSnapshot.zoneLabel || "";
      snapshot.fareLabel = airportSnapshot.fareLabel || "";
      snapshot.lodgingPlaceId = airportSnapshot.lodgingPlaceId || "";
      snapshot.lodgingPrimaryType = airportSnapshot.lodgingPrimaryType || "";
      snapshot.lodgingLat = airportSnapshot.lodgingLat || "";
      snapshot.lodgingLng = airportSnapshot.lodgingLng || "";
      snapshot.lodgingEndpointSide = airportSnapshot.lodgingEndpointSide || "";
    }

    addLegalAcceptanceFields(snapshot, form);

    return snapshot;
  }

  function redirectToCheckoutReview(form, data) {
    try {
      window.sessionStorage.setItem(
        AIRPORT_TRANSFER_CHECKOUT_REVIEW_STORAGE_KEY,
        JSON.stringify(buildCheckoutReviewSnapshot(form, data))
      );
    } catch (error) {
      return false;
    }

    window.location.assign(AIRPORT_TRANSFER_CHECKOUT_REVIEW_PATH);
    return true;
  }

  function waitForPublicConfigReady() {
    var loader = window.PixkuyBookingPublicConfig;

    if (
      !loader ||
      !loader.ready ||
      typeof loader.ready.then !== "function"
    ) {
      return Promise.resolve();
    }

    return loader.ready.catch(function ignorePublicConfigError() {
      return undefined;
    });
  }

  function getRecaptchaToken() {
    return waitForPublicConfigReady()
      .then(function executeRecaptchaAfterConfig() {
        var recaptcha = window.PixkuyRecaptchaEnterprise;

        if (
          !recaptcha ||
          typeof recaptcha.execute !== "function"
        ) {
          return "";
        }

        return recaptcha.execute(RECAPTCHA_ACTION);
      })
      .then(function normalizeRecaptchaToken(token) {
        return normalizeText(token);
      })
      .catch(function ignoreRecaptchaError() {
        return "";
      });
  }
  
    function getAvailabilityErrorMessage(result) {
    var normalized = result && result.raw && typeof result.raw === "object"
      ? result.raw
      : result;
    var resultNode = normalized && normalized.result && typeof normalized.result === "object"
      ? normalized.result
      : {};
    var availability = resultNode.availability && typeof resultNode.availability === "object"
      ? resultNode.availability
      : {};
    var nextAvailableStartLocal =
      normalizeText(result && result.nextAvailableStartLocal) ||
      normalizeText(resultNode.nextAvailableStartLocal) ||
      normalizeText(availability.nextAvailableStartLocal);
    var nextAvailableTime = "";
    var baseMessage = getI18nValue(
      "services.cards.airport.panel.availability.unavailable",
      "No hay disponibilidad para esa fecha y hora. Elige otra opción."
    );
    var nextAvailableTemplate = getI18nValue(
      "services.cards.airport.panel.availability.nextAvailableSlot",
      "Siguiente hora disponible: {time}"
    );

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nextAvailableStartLocal)) {
      nextAvailableTime = nextAvailableStartLocal.slice(11, 16);
    } else {
      nextAvailableTime = nextAvailableStartLocal;
    }

    if (nextAvailableTime) {
      return baseMessage + " " + nextAvailableTemplate.replace("{time}", nextAvailableTime);
    }

    return baseMessage;
  }

  function focusAirportTransferTimeField(form) {
    var fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;
    var timeField =
      fields && fields.airportHotelVisibleTime
        ? fields.airportHotelVisibleTime
        : getField(form, "airport_hotel_time");

    if (!timeField || typeof timeField.focus !== "function") {
      return false;
    }

    if (typeof timeField.scrollIntoView === "function") {
      timeField.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    window.setTimeout(function focusTimeFieldAfterScroll() {
      timeField.focus({
        preventScroll: true
      });
    }, 120);

    return true;
  }

  function showAvailabilityError(form, result) {
    var fields;
    var message;

    if (!form) {
      return false;
    }

    fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;

    message = getAvailabilityErrorMessage(result);

    if (fields && fields.formError) {
      fields.formError.textContent = message;
      fields.formError.hidden = false;
    }

    focusAirportTransferTimeField(form);

    return true;
  }

  function verifyAvailabilityBeforeCheckout(form, data) {
    var precheckApi = getAvailabilityPrecheckApi();
    var detail = buildAvailabilityPrecheckDetail(form, data);

    if (!precheckApi || !detail) {
      return Promise.resolve({
        available: false,
        checkoutAllowed: false,
        code: "PRECHECK_UNAVAILABLE"
      });
    }

    return precheckApi.precheck(detail);
  }

  function setFormBusy(form, isBusy) {
    var buttons;

    if (!form) {
      return false;
    }

    buttons = Array.prototype.slice.call(
      form.querySelectorAll(
        'button[type="submit"], [data-airport-mobile-contact-submit]'
      )
    );

    if (isBusy) {
      form.setAttribute("aria-busy", "true");
      form.setAttribute("data-booking-api-checkout-busy", "1");
    } else {
      form.setAttribute("aria-busy", "false");
      form.removeAttribute("data-booking-api-checkout-busy");
      form.removeAttribute("data-submitted");
    }

    buttons.forEach(function syncButton(button) {
      button.disabled = Boolean(isBusy);
      button.setAttribute("aria-disabled", isBusy ? "true" : "false");
    });

    return true;
  }

  function showCheckoutError(form) {
    var fields;
    var message;
    var mobileError;

    if (!form) {
      return false;
    }

    fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;

    message = getI18nValue(
      "contact.validation.formIncomplete",
      "Revisa los datos del formulario."
    );

    if (fields && fields.formError) {
      fields.formError.textContent = message;
      fields.formError.hidden = false;
    }

    mobileError = document.querySelector(
      '[data-airport-mobile-contact-step][aria-hidden="false"] [data-airport-mobile-contact-global-error]'
    );

    if (mobileError) {
      mobileError.textContent = message;
      mobileError.hidden = false;
    }

    return true;
  }

  function hideCheckoutError(form) {
    var fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;

    if (fields && fields.formError) {
      fields.formError.hidden = true;
    }

    return true;
  }

  function getLegalAcceptanceApi() {
    return window.PixkuyForms &&
      window.PixkuyForms.LegalAcceptance &&
      typeof window.PixkuyForms.LegalAcceptance.create === "function"
      ? window.PixkuyForms.LegalAcceptance
      : null;
  }

  function getLegalAcceptanceHost(form) {
    var existing = form
      ? form.querySelector(LEGAL_ACCEPTANCE_HOST_SELECTOR)
      : null;
    var actions;
    var host;

    if (existing) {
      return existing;
    }

    if (!form) {
      return null;
    }

    actions = form.querySelector(".form-actions");

    if (!actions || !actions.parentNode) {
      return null;
    }

    host = document.createElement("div");
    host.setAttribute("data-airport-transfer-checkout-legal-acceptance", "1");
    host.hidden = true;

    actions.parentNode.insertBefore(host, actions);

    return host;
  }

  function setLegalAcceptanceSubmitDisabled(form, isDisabled) {
    var buttons;

    if (!form) {
      return false;
    }

    buttons = Array.prototype.slice.call(
      form.querySelectorAll(
        'button[type="submit"]'
      )
    );

    buttons.forEach(function syncLegalButton(button) {
      button.disabled = Boolean(isDisabled);
      button.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    });

    return true;
  }

  function bindLegalAcceptanceSubmitState(form, instance) {
    if (
      !form ||
      !instance ||
      !instance.checkbox ||
      instance.checkbox.__pixkuyAirportLegalAcceptanceSubmitBound === true
    ) {
      return false;
    }

    instance.checkbox.__pixkuyAirportLegalAcceptanceSubmitBound = true;

    scheduleLegalAcceptanceVisibilitySync(form);

    instance.checkbox.addEventListener("change", function onLegalAcceptanceChange() {
      scheduleLegalAcceptanceVisibilitySync(form);
    });

    return true;
  }

  function getLegalAcceptanceInstance(form) {
    var host = getLegalAcceptanceHost(form);
    var api = getLegalAcceptanceApi();
    var existing;

    if (!host || !api) {
      return null;
    }

    existing = host.__pixkuyLegalAcceptanceInstance || null;

    if (existing && typeof existing.validate === "function") {
      return existing;
    }

    host.__pixkuyLegalAcceptanceInstance = api.create({
      container: host,
      form: form,
      channel: "web_airport_checkout",
      checkboxId: "pixkuy-airport-transfer-legal-acceptance"
    });

    bindLegalAcceptanceSubmitState(form, host.__pixkuyLegalAcceptanceInstance);

    return host.__pixkuyLegalAcceptanceInstance;
  }

  function hasSyncedLegalAcceptance(form) {
    return Boolean(
      getFieldValue(form, "legal_acceptance_accepted") === "true" &&
      getFieldValue(form, "legal_acceptance_terms_version") &&
      getFieldValue(form, "legal_acceptance_cancellation_policy_version") &&
      getFieldValue(form, "legal_acceptance_privacy_version") &&
      getFieldValue(form, "legal_acceptance_accepted_at") &&
      getFieldValue(form, "legal_acceptance_channel")
    );
  }

  function validateLegalAcceptance(form) {
    var instance;

    if (hasSyncedLegalAcceptance(form)) {
      return true;
    }

    instance = getLegalAcceptanceInstance(form);

    if (!instance || typeof instance.validate !== "function") {
      return false;
    }

    return instance.validate();
  }

  function getExistingLegalAcceptanceHost(form) {
    return form ? form.querySelector(LEGAL_ACCEPTANCE_HOST_SELECTOR) : null;
  }

  function isLegalAcceptanceInstanceAccepted(instance) {
    return Boolean(
      instance &&
      typeof instance.isAccepted === "function" &&
      instance.isAccepted()
    );
  }

  function isAirportMobileContactStepVisible() {
    var step = document.querySelector(
      '[data-airport-mobile-contact-step][aria-hidden="false"]'
    );

    return Boolean(step);
  }

  function syncLegalAcceptanceVisibility(form) {
    var api = getReservationApi();
    var fields;
    var data;
    var host;
    var instance;
    var isRequired;

    if (!form || !api) {
      return false;
    }

    fields = api.getReservationRequestFields(form);
    data = fields ? api.getReservationRequestData(fields) : null;
    isRequired = isAirportTransferTransactionalData(data) &&
      (
        isDesktopViewport() ||
        isAirportMobileContactStepVisible()
      );

    if (!isRequired) {
      host = getExistingLegalAcceptanceHost(form);

      if (host) {
        host.hidden = true;
      }

      setLegalAcceptanceSubmitDisabled(form, false);
      return true;
    }

    if (hasSyncedLegalAcceptance(form)) {
      host = getExistingLegalAcceptanceHost(form);

      if (host) {
        host.hidden = false;
      }

      setLegalAcceptanceSubmitDisabled(
        form,
        !hasRequiredAirportTransferCheckoutData(data)
      );

      return true;
    }

    instance = getLegalAcceptanceInstance(form);
    host = getExistingLegalAcceptanceHost(form);

    if (host) {
      host.hidden = false;
    }

    setLegalAcceptanceSubmitDisabled(
      form,
      !hasRequiredAirportTransferCheckoutData(data) ||
        !isLegalAcceptanceInstanceAccepted(instance)
    );

    return true;
  }

  function scheduleLegalAcceptanceVisibilitySync(form) {
    if (!form) {
      return false;
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(function syncOnFrame() {
        syncLegalAcceptanceVisibility(form);
      });
      return true;
    }

    window.setTimeout(function syncOnTimeout() {
      syncLegalAcceptanceVisibility(form);
    }, 0);

    return true;
  }

  function requestCheckout(input) {
    return window.fetch(buildCheckoutUrl(input.config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pixkuy-Site-Key": input.config.publicSiteKey,
        "Idempotency-Key": input.idempotencyKey
      },
      body: JSON.stringify(input.payload)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (body) {
        return {
          ok: response.ok,
          statusCode: response.status,
          body: body
        };
      });
    });
  }

  function getBookingCheckoutStorageKey(token) {
    return BOOKING_CHECKOUT_STORAGE_PREFIX + token;
  }

  function storeBookingCheckoutHandoff(input) {
    var token = normalizeText(input && input.bookingStatusToken);
    var checkoutUrl = normalizeText(input && input.checkoutUrl);

    if (!token || !checkoutUrl) {
      return false;
    }

    try {
      window.sessionStorage.setItem(
        getBookingCheckoutStorageKey(token),
        JSON.stringify({
          token: token,
          checkoutUrl: checkoutUrl,
          redirected: false,
          createdAt: new Date().toISOString()
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function redirectToCheckout(checkoutUrl, bookingStatusToken) {
    var url = normalizeText(checkoutUrl);
    var token = normalizeText(bookingStatusToken);
    var handoffUrl;

    if (!url || !token) {
      return false;
    }

    if (!storeBookingCheckoutHandoff({
      bookingStatusToken: token,
      checkoutUrl: url
    })) {
      return false;
    }

    handoffUrl = BOOKING_CHECKOUT_HANDOFF_PATH +
      "?token=" +
      encodeURIComponent(token);

    window.location.replace(handoffUrl);
    return true;
  }

  function handleSubmit(event) {
    var form = event.target;
    var api;
    var fields;
    var data;
    var config;
    var idempotencyKey;

    if (
      !form ||
      form.nodeType !== 1 ||
      !form.matches('form[name="contact"]')
    ) {
      return;
    }

    api = getReservationApi();

    if (!api) {
      return;
    }

    fields = api.getReservationRequestFields(form);
    data = fields ? api.getReservationRequestData(fields) : null;

    if (!isAirportTransferTransactionalData(data)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    if (form.getAttribute("data-booking-api-checkout-busy") === "1") {
      return;
    }

    syncLegalAcceptanceVisibility(form);

    if (!hasRequiredAirportTransferCheckoutData(data)) {
      showCheckoutError(form);
      return;
    }

    if (!validateLegalAcceptance(form)) {
      return;
    }

    hideCheckoutError(form);

    if (isDesktopViewport()) {
      setFormBusy(form, true);

      verifyAvailabilityBeforeCheckout(form, data)
        .then(function onAvailabilityPrecheckResult(result) {
          var isAllowed = Boolean(
            result &&
              (result.available === true || result.checkoutAllowed === true)
          );

          if (!isAllowed) {
            setFormBusy(form, false);
            showAvailabilityError(form, result);
            return;
          }

          if (!redirectToCheckoutReview(form, data)) {
            setFormBusy(form, false);
            showCheckoutError(form);
          }
        })
        .catch(function onAvailabilityPrecheckError() {
          setFormBusy(form, false);
          showCheckoutError(form);
        });

      return;
    }

    setFormBusy(form, true);

    config = getConfig();
    idempotencyKey = createIdempotencyKey();

    getRecaptchaToken()
      .then(function (recaptchaToken) {
        var payload = buildCheckoutPayload(form, data, recaptchaToken);

        if (!payload) {
          throw new Error("INVALID_AIRPORT_TRANSFER_CHECKOUT_PAYLOAD");
        }

        return requestCheckout({
          config: config,
          idempotencyKey: idempotencyKey,
          payload: payload
        });
      })
      .then(function (result) {
        var checkoutUrl = result && result.body ? result.body.checkoutUrl : "";
        var bookingStatusToken =
          result && result.body ? result.body.bookingStatusToken : "";

        if (!result.ok || !checkoutUrl || !bookingStatusToken) {
          throw new Error(
            result && result.body && result.body.code
              ? result.body.code
              : "BOOKING_API_CHECKOUT_FAILED"
          );
        }

        if (!redirectToCheckout(checkoutUrl, bookingStatusToken)) {
          throw new Error("BOOKING_CHECKOUT_HANDOFF_FAILED");
        }
      })
      .catch(function () {
        setFormBusy(form, false);
        showCheckoutError(form);
      });
  }

  function init() {
    var form = getForm();

    if (document.documentElement.dataset.airportTransferBookingApiCheckoutBound === "1") {
      return false;
    }

    document.addEventListener("submit", handleSubmit, true);

    document.addEventListener("input", function onDocumentInput() {
      scheduleLegalAcceptanceVisibilitySync(getForm());
    }, true);

    document.addEventListener("change", function onDocumentChange() {
      scheduleLegalAcceptanceVisibilitySync(getForm());
    }, true);

    document.addEventListener("click", function onDocumentClick() {
      scheduleLegalAcceptanceVisibilitySync(getForm());
    }, true);

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      scheduleLegalAcceptanceVisibilitySync(getForm());
    });

    scheduleLegalAcceptanceVisibilitySync(form);

    document.documentElement.dataset.airportTransferBookingApiCheckoutBound = "1";

    return true;
  }

  init();
})(window, document);