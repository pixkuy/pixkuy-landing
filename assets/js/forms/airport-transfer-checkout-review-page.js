/* assets/js/forms/airport-transfer-checkout-review-page.js
   Airport Transfer checkout review page.
   Responsabilidad:
   - leer snapshot desktop Airport Transfer desde sessionStorage
   - pintar resumen de traslado
   - permitir volver a editar datos
   - iniciar checkout Booking API/Stripe solo desde esta página
   - copiar el formato visual real de Hourly sin tocar Hourly
*/

(function initAirportTransferCheckoutReviewPage(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var STORAGE_KEY = "pixkuy_airport_transfer_checkout_review_snapshot";
  var RETURN_KEY = "pixkuy_airport_transfer_checkout_review_return";
  var CHECKOUT_ENDPOINT = "/v1/public/reservations/checkout";
  var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
  var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getNode(selector) {
    return document.querySelector(selector);
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG || {};
    var hostname = window.location.hostname;
    var apiBaseUrl = normalizeText(config.apiBaseUrl);

    if (!apiBaseUrl && hostname === "192.168.0.14") {
      apiBaseUrl = "http://192.168.0.14:3002";
    } else if (
      !apiBaseUrl &&
      (
        hostname === "localhost" ||
        hostname === "127.0.0.1"
      )
    ) {
      apiBaseUrl = "http://localhost:3002";
    }

    return {
      apiBaseUrl: apiBaseUrl || DEFAULT_BOOKING_API_BASE_URL,
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY,
      recaptchaSiteKey: normalizeText(config.recaptchaSiteKey)
    };
  }

  function getPathValue(source, path) {
    var parts = String(path || "").split(".");
    var cursor = source;
    var index;

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor : "";
  }

  function t(path, fallback) {
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

    value = getPathValue(dict, path);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    return fallback || "";
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

  function setHidden(node, hidden) {
    if (!node) {
      return false;
    }

    node.hidden = Boolean(hidden);
    return true;
  }

  function setText(node, value) {
    if (!node) {
      return false;
    }

    node.textContent = value;
    return true;
  }

  function readSnapshot() {
    var raw;
    var parsed;

    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  }

  function writeBookingHandoff(input) {
    var token = normalizeText(input && input.bookingStatusToken);
    var checkoutUrl = normalizeText(input && input.checkoutUrl);

    if (!token || !checkoutUrl) {
      return false;
    }

    try {
      window.sessionStorage.setItem(
        BOOKING_CHECKOUT_STORAGE_PREFIX + token,
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
    var token = normalizeText(bookingStatusToken);
    var url = normalizeText(checkoutUrl);

    if (!token || !url) {
      return false;
    }

    if (!writeBookingHandoff({
      bookingStatusToken: token,
      checkoutUrl: url
    })) {
      return false;
    }

    window.location.replace(
      BOOKING_CHECKOUT_HANDOFF_PATH + "?token=" + encodeURIComponent(token)
    );

    return true;
  }

  function buildRow(label, value, modifier) {
    var safeLabel = normalizeText(label);
    var safeValue = normalizeText(value);
    var safeModifier = normalizeText(modifier);

    if (!safeLabel || !safeValue) {
      return "";
    }

    return [
      '<div class="booking-status__detail',
      safeModifier ? " booking-status__detail--" + escapeHtml(safeModifier) : "",
      '">',
      "<dt>",
      escapeHtml(safeLabel),
      "</dt>",
      "<dd>",
      escapeHtml(safeValue),
      "</dd>",
      "</div>"
    ].join("");
  }

  function buildVehicleRow(label, value) {
    var safeLabel = normalizeText(label);
    var safeValue = normalizeText(value);

    if (!safeLabel || !safeValue) {
      return "";
    }

    return [
      '<div class="booking-status__detail booking-status__detail--vehicle">',
      "<dt>",
      escapeHtml(safeLabel),
      "</dt>",
      "<dd>",
      '<span class="booking-status__vehicle-name">',
      escapeHtml(safeValue),
      "</span>",
      '<span class="booking-status__vehicle-media" aria-hidden="true">',
      '<img src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="" loading="lazy" decoding="async">',
      "</span>",
      "</dd>",
      "</div>"
    ].join("");
  }

  function getDirectionLabel(snapshot) {
    var direction = normalizeText(
      snapshot.airport_transfer_direction ||
        snapshot.airport_hotel_direction ||
        snapshot.direction
    );

    if (direction === "destination_to_airport" || direction === "hotel_to_airport") {
      return t(
        "contact.services.airportHotelDirectionHotelToAirport",
        "Destino → aeropuerto"
      );
    }

    return t(
      "contact.services.airportHotelDirectionAirportToHotel",
      "Aeropuerto → destino"
    );
  }

  function getApiDirection(snapshot) {
    var direction = normalizeText(
      snapshot.airport_transfer_direction ||
        snapshot.airport_hotel_direction ||
        snapshot.direction
    );

    if (direction === "hotel_to_airport" || direction === "destination_to_airport") {
      return "destination_to_airport";
    }

    return "airport_to_destination";
  }

  function getAirportLabel(snapshot) {
    return normalizeText(
      snapshot.airport_transfer_airport_label ||
        snapshot.airport_hotel_airport_label ||
        snapshot.airport_hotel_airport ||
        snapshot.airport ||
        snapshot.airportId
    );
  }

  function getDestinationLabel(snapshot) {
    return normalizeText(
      snapshot.airport_transfer_destination_label ||
        snapshot.airport_hotel_hotel_label ||
        snapshot.airport_hotel_hotel ||
        snapshot.airport_transfer_destination ||
        snapshot.destination ||
        snapshot.hotel
    );
  }

  function getZoneLabel(snapshot) {
    return normalizeText(
      snapshot.airport_transfer_zone_label ||
        snapshot.airport_hotel_zone_label ||
        snapshot.zoneLabel ||
        snapshot.zone ||
        snapshot.airport_transfer_zone_id
    );
  }

  function getPassengerLabel(snapshot) {
    return normalizeText(
      snapshot.airport_transfer_passenger_bucket_label ||
        snapshot.airport_hotel_passenger_bucket_label ||
        snapshot.passenger_bucket_label ||
        snapshot.passengerFareLabel ||
        snapshot.airport_transfer_passenger_fare_key
    );
  }

  function getPriceLabel(snapshot) {
    return normalizeText(
      snapshot.airport_transfer_price_label ||
        snapshot.airport_hotel_fare_label ||
        snapshot.fareLabel ||
        snapshot.airport_transfer_price ||
        snapshot.fare
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

  function getAmountMinor(snapshot) {
    var rawValue = normalizeText(
      snapshot.airport_transfer_price ||
        snapshot.fare ||
        snapshot.airport_transfer_price_label ||
        snapshot.airport_hotel_fare_label
    );

    if (!rawValue) {
      return null;
    }

    return parseMoneyMinorUnitsFromMxn(rawValue);
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

  function addLegalAcceptanceFields(payload, snapshot) {
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
      var value = normalizeText(snapshot[name]);

      if (value) {
        payload[name] = value;
      }
    });

    return payload;
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

  function getAirportTransferPassengerFareKey(snapshot) {
    return normalizeText(
      snapshot.airport_transfer_passenger_fare_key ||
        snapshot.passenger_fare_key ||
        snapshot.passengerFareKey
    );
  }

  function getAirportTransferPassengers(snapshot) {
    var explicitPassengers = parsePositiveInteger(
      snapshot.airport_transfer_passengers ||
        snapshot.passengers ||
        snapshot.passenger_count ||
        snapshot.passengerCount
    );
    var fareKey;

    if (explicitPassengers && explicitPassengers <= 6) {
      return explicitPassengers;
    }

    fareKey = getAirportTransferPassengerFareKey(snapshot);

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

  function getNonAirportLocation(snapshot) {
    var existingLocation = snapshot.airport_transfer_non_airport_location;
    var location;
    var placeId;
    var lat;
    var lng;

    if (existingLocation && typeof existingLocation === "object") {
      location = {
        address: normalizeText(existingLocation.address)
      };

      placeId = normalizeText(existingLocation.place_id || existingLocation.placeId);
      lat = parseOptionalFiniteNumber(existingLocation.lat);
      lng = parseOptionalFiniteNumber(existingLocation.lng);
    } else {
      location = {
        address: normalizeText(
          snapshot.airport_transfer_non_airport_address ||
            snapshot.airport_transfer_destination_label ||
            snapshot.airport_hotel_hotel_label ||
            snapshot.airport_hotel_hotel ||
            snapshot.airport_transfer_destination ||
            snapshot.destination ||
            snapshot.hotel
        )
      };

      placeId = normalizeText(
        snapshot.airport_transfer_non_airport_place_id ||
          snapshot.airport_transfer_destination_place_id ||
          snapshot.destination_place_id ||
          snapshot.destinationPlaceId ||
          snapshot.lodgingPlaceId
      );
      lat = parseOptionalFiniteNumber(
        snapshot.airport_transfer_non_airport_lat ||
          snapshot.airport_transfer_destination_lat ||
          snapshot.destination_lat ||
          snapshot.destinationLat ||
          snapshot.lodgingLat
      );
      lng = parseOptionalFiniteNumber(
        snapshot.airport_transfer_non_airport_lng ||
          snapshot.airport_transfer_destination_lng ||
          snapshot.destination_lng ||
          snapshot.destinationLng ||
          snapshot.lodgingLng
      );
    }

    if (!location.address) {
      return null;
    }

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

  function getRequestSummary(snapshot) {
    var existingSummary = normalizeText(snapshot.request_summary);
    var summaryParts;

    if (existingSummary) {
      return existingSummary;
    }

    summaryParts = [
      getDirectionLabel(snapshot),
      getAirportLabel(snapshot),
      getDestinationLabel(snapshot),
      normalizeText(snapshot.airport_transfer_date || snapshot.airport_hotel_date || snapshot.serviceDate),
      normalizeText(snapshot.airport_transfer_time || snapshot.airport_hotel_time || snapshot.serviceTime),
      getPassengerLabel(snapshot),
      getPriceLabel(snapshot)
    ].filter(function filterSummaryPart(value) {
      return normalizeText(value);
    });

    return summaryParts.join(" · ");
  }

  function isTechnicalAirportZoneId(value) {
    var zoneId = normalizeText(value);

    return Boolean(zoneId && /^[a-z0-9_]+$/.test(zoneId));
  }

  function getAirportTransferZoneId(snapshot) {
    var candidates = [
      snapshot.zoneId,
      snapshot.airport_transfer_zone_id,
      snapshot.airport_hotel_zone_id,
      snapshot.resolvedZoneId,
      snapshot.lodgingEndpointZoneId
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

  function buildPayload(snapshot) {
    var amountMinor = getAmountMinor(snapshot);
    var nonAirportLocation = getNonAirportLocation(snapshot);
    var passengerCount = getAirportTransferPassengers(snapshot);
    var passengerFareKey = getAirportTransferPassengerFareKey(snapshot);
    var requestSummary = getRequestSummary(snapshot);
    var zoneId = getAirportTransferZoneId(snapshot);
    var payload;

    if (!amountMinor || !nonAirportLocation || !passengerCount || !passengerFareKey || !requestSummary || !zoneId) {
      return null;
    }

    payload = {
      service_type: "airport_transfer",
      airport_transfer_direction: getApiDirection(snapshot),
      airport_transfer_airport_id: normalizeText(
        snapshot.airport_transfer_airport_id ||
          snapshot.airportId
      ),
      airport_transfer_origin: normalizeText(
        snapshot.airport_transfer_origin ||
          snapshot.origin
      ),
      airport_transfer_destination: normalizeText(
        snapshot.airport_transfer_destination ||
          snapshot.destination
      ),
      airport_transfer_zone_id: zoneId,
      airport_transfer_passenger_fare_key: passengerFareKey,
      airport_transfer_non_airport_location: nonAirportLocation,
      airport_transfer_date: normalizeText(
        snapshot.airport_transfer_date ||
          snapshot.airport_hotel_date ||
          snapshot.serviceDate
      ),
      airport_transfer_time: normalizeText(
        snapshot.airport_transfer_time ||
          snapshot.airport_hotel_time ||
          snapshot.serviceTime
      ),
      airport_transfer_passengers: passengerCount,
      airport_transfer_price: amountMinor,
      airport_transfer_currency: "MXN",
      request_summary: requestSummary,
      locale: normalizeText(snapshot.locale) || getDocumentLocale(),
      customer: {
        full_name: normalizeText(snapshot.name),
        email: normalizeText(snapshot.email),
        phone: normalizeText(snapshot.phone)
      },
      form_payload_raw:
        snapshot.form_payload_raw && typeof snapshot.form_payload_raw === "object"
          ? snapshot.form_payload_raw
          : {}
    };

    addOptionalString(
      payload,
      "airport_transfer_luggage",
      snapshot.airport_transfer_luggage || snapshot.luggage
    );
    addOptionalString(
      payload,
      "airport_transfer_origin_place_id",
      snapshot.airport_transfer_origin_place_id ||
        snapshot.origin_place_id ||
        snapshot.originPlaceId
    );
    addOptionalNumber(
      payload,
      "airport_transfer_origin_lat",
      snapshot.airport_transfer_origin_lat ||
        snapshot.origin_lat ||
        snapshot.originLat
    );
    addOptionalNumber(
      payload,
      "airport_transfer_origin_lng",
      snapshot.airport_transfer_origin_lng ||
        snapshot.origin_lng ||
        snapshot.originLng
    );
    addOptionalString(
      payload,
      "airport_transfer_destination_place_id",
      snapshot.airport_transfer_destination_place_id ||
        snapshot.destination_place_id ||
        snapshot.destinationPlaceId
    );
    addOptionalNumber(
      payload,
      "airport_transfer_destination_lat",
      snapshot.airport_transfer_destination_lat ||
        snapshot.destination_lat ||
        snapshot.destinationLat
    );
    addOptionalNumber(
      payload,
      "airport_transfer_destination_lng",
      snapshot.airport_transfer_destination_lng ||
        snapshot.destination_lng ||
        snapshot.destinationLng
    );
    addOptionalString(
      payload,
      "airport_transfer_direction_label",
      snapshot.airport_transfer_direction_label ||
        snapshot.airport_hotel_direction_label
    );
    addOptionalString(
      payload,
      "airport_transfer_airport_label",
      snapshot.airport_transfer_airport_label ||
        snapshot.airport_hotel_airport_label
    );
    addOptionalString(
      payload,
      "airport_transfer_destination_label",
      snapshot.airport_transfer_destination_label ||
        snapshot.airport_hotel_hotel_label
    );
    addOptionalString(
      payload,
      "airport_transfer_zone_label",
      snapshot.airport_transfer_zone_label ||
        snapshot.airport_hotel_zone_label
    );
    addOptionalString(
      payload,
      "airport_transfer_price_label",
      snapshot.airport_transfer_price_label ||
        snapshot.airport_hotel_fare_label
    );
    addOptionalString(
      payload,
      "airport_transfer_passenger_bucket_label",
      snapshot.airport_transfer_passenger_bucket_label ||
        snapshot.airport_hotel_passenger_bucket_label
    );
    addOptionalString(
      payload,
      "airport_transfer_notes",
      snapshot.message || snapshot.notes
    );
    addLegalAcceptanceFields(payload, snapshot);

    return payload;
  }

  function validateSnapshot(snapshot) {
    return Boolean(
      snapshot &&
      normalizeText(snapshot.name) &&
      normalizeText(snapshot.email) &&
      normalizeText(snapshot.phone) &&
      normalizeText(snapshot.airport_transfer_airport_id || snapshot.airportId) &&
      normalizeText(snapshot.airport_transfer_date || snapshot.airport_hotel_date || snapshot.serviceDate) &&
      normalizeText(snapshot.airport_transfer_time || snapshot.airport_hotel_time || snapshot.serviceTime) &&
      getAirportTransferZoneId(snapshot) &&
      getAirportTransferPassengerFareKey(snapshot) &&
      getNonAirportLocation(snapshot) &&
      getAirportTransferPassengers(snapshot) &&
      getRequestSummary(snapshot) &&
      getAmountMinor(snapshot)
    );
  }

  function renderStaticCopy() {
    var copyMap = {
      airportTransferCheckoutReview: {
        emptyTitle: t("bookingStatus.notFound.title", "No hay una reserva para revisar"),
        emptyText: t("bookingStatus.notFound.text", "Vuelve al formulario y configura de nuevo tu reserva."),
        emptyCta: t("services.cards.airport.ctaClosed", "Volver a traslados aeropuerto"),
        title: t("services.cards.airport.title", "Transfer Aeropuerto"),
        text: t("services.cards.airport.panel.text", ""),
        proceed: t(
          "services.cards.hourly.panel.review.proceed",
          t("services.cards.hourly.panel.reviewCta", "Continuar al pago")
        ),
        edit: t("services.cards.hourly.panel.review.edit", "Editar datos")
      }
    };

    Array.prototype.slice.call(
      document.querySelectorAll("[data-airport-transfer-checkout-review-copy]")
    ).forEach(function renderCopy(node) {
      var path = normalizeText(
        node.getAttribute("data-airport-transfer-checkout-review-copy")
      );

      setText(node, getPathValue(copyMap, path));
    });

    return true;
  }

  function renderDetails(snapshot) {
    var details = getNode("[data-airport-transfer-checkout-review-details]");

    if (!details) {
      return false;
    }

    details.innerHTML = [
      buildRow(t("contact.services.airportHotel", "Transfer Aeropuerto"), t("services.cards.airport.title", "Transfer Aeropuerto"), "service"),
      buildRow(t("contact.services.airportHotelSummaryTrip", "Trayecto"), getDirectionLabel(snapshot), "direction"),
      buildRow(t("contact.services.airportHotelSummaryAirport", "Aeropuerto"), getAirportLabel(snapshot), "airport"),
      buildRow(t("contact.services.airportHotelSummaryHotel", "Destino"), getDestinationLabel(snapshot), "destination"),
      buildRow(t("contact.services.airportHotelSummaryZone", "Zona"), getZoneLabel(snapshot), "zone"),
      buildRow(t("services.cards.airport.panel.dateLabel", "Fecha"), normalizeText(snapshot.airport_transfer_date || snapshot.airport_hotel_date || snapshot.serviceDate), "date"),
      buildRow(t("services.cards.airport.panel.timeLabel", "Hora"), normalizeText(snapshot.airport_transfer_time || snapshot.airport_hotel_time || snapshot.serviceTime), "time"),
      buildRow(t("contact.services.airportHotelSummaryPassengers", "Pasajeros"), getPassengerLabel(snapshot), "passengers"),
      snapshot.airport_transfer_luggage || snapshot.luggage
        ? buildRow(t("contact.luggage", "Equipaje"), normalizeText(snapshot.airport_transfer_luggage || snapshot.luggage), "luggage")
        : "",
      buildVehicleRow(t("fleet.intro.title", "Vehículo"), t("fleet.m9.title", "BYD M9")),
      buildRow(t("contact.services.airportHotelSummaryFare", "Precio"), getPriceLabel(snapshot), "price"),
      buildRow(t("contact.name", "Nombre"), snapshot.name, "customer-name"),
      buildRow(t("contact.phone", "Teléfono"), snapshot.phone, "customer-phone"),
      buildRow(t("contact.email", "Email"), snapshot.email, "customer-email"),
      snapshot.message || snapshot.notes
        ? buildRow(t("contact.notes", "Notas"), snapshot.message || snapshot.notes, "notes")
        : ""
    ].join("");

    return true;
  }

  function renderLegal(snapshot) {
    var legal = getNode("[data-airport-transfer-checkout-review-legal]");
    var acceptedAt = normalizeText(snapshot.legal_acceptance_accepted_at);

    if (!legal) {
      return false;
    }

    legal.innerHTML = [
      '<div class="hourly-checkout-review-screen__legal-card">',
      "<strong>",
      t("legal.links.terms", "Condiciones"),
      "</strong>",
      "<p>",
      acceptedAt
        ? t("legalAcceptance.accepted", "Condiciones aceptadas.")
        : t("legalAcceptance.required", "Acepta las condiciones antes de continuar."),
      "</p>",
      "</div>"
    ].join("");

    return true;
  }

  function renderSnapshot(snapshot) {
    var empty = getNode("[data-airport-transfer-checkout-review-empty]");
    var content = getNode("[data-airport-transfer-checkout-review-content]");

    renderStaticCopy();

    if (!snapshot) {
      setHidden(empty, false);
      setHidden(content, true);
      return false;
    }

    renderDetails(snapshot);
    renderLegal(snapshot);

    setHidden(empty, true);
    setHidden(content, false);

    return true;
  }

  function setBusy(isBusy) {
    var proceed = getNode("[data-airport-transfer-checkout-review-proceed]");

    if (!proceed) {
      return false;
    }

    proceed.disabled = Boolean(isBusy);
    proceed.setAttribute("aria-disabled", isBusy ? "true" : "false");
    return true;
  }

  function showError() {
    var errorNode = getNode("[data-airport-transfer-checkout-review-error]");

    if (!errorNode) {
      return false;
    }

    setText(
      errorNode,
      t("contact.validation.formIncomplete", "Revisa los datos del formulario.")
    );
    setHidden(errorNode, false);

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

        if (!recaptcha || typeof recaptcha.execute !== "function") {
          return "";
        }

        return recaptcha.execute("airport_transfer_checkout");
      })
      .then(function normalizeRecaptchaToken(token) {
        return normalizeText(token);
      })
      .catch(function ignoreRecaptchaError() {
        return "";
      });
  }

  function requestCheckout(snapshot) {
    var config = getConfig();
    var payload = buildPayload(snapshot);
    var apiBaseUrl;
    var checkoutUrl;

    if (!payload || !validateSnapshot(snapshot)) {
      return Promise.reject(new Error("INVALID_AIRPORT_TRANSFER_CHECKOUT_REVIEW_PAYLOAD"));
    }

    apiBaseUrl = normalizeText(config.apiBaseUrl);
    checkoutUrl = apiBaseUrl
      ? apiBaseUrl.replace(/\/+$/, "") + CHECKOUT_ENDPOINT
      : CHECKOUT_ENDPOINT;

    return getRecaptchaToken()
      .then(function addRecaptchaToken(recaptchaToken) {
        if (normalizeText(recaptchaToken)) {
          payload.recaptchaToken = normalizeText(recaptchaToken);
        }

        return window.fetch(
          checkoutUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Pixkuy-Site-Key": config.publicSiteKey,
              "Idempotency-Key": "pixkuy-airport-review-" + Date.now() + "-" + Math.random().toString(36).slice(2)
            },
            body: JSON.stringify(payload)
          }
        );
      })
      .then(function parseResponse(response) {
        return response.json().catch(function () {
          return {};
        }).then(function withBody(body) {
          return {
            ok: response.ok,
            statusCode: response.status,
            body: body
          };
        });
      });
  }

  function bindActions(snapshot) {
    var proceed = getNode("[data-airport-transfer-checkout-review-proceed]");
    var edit = getNode("[data-airport-transfer-checkout-review-edit]");

    if (edit) {
      edit.setAttribute("href", "/#contact");

      edit.addEventListener("click", function onEditClick() {
        try {
          window.sessionStorage.setItem(RETURN_KEY, "1");
        } catch (error) {
          // no-op
        }
      });
    }

    if (!proceed) {
      return false;
    }

    proceed.addEventListener("click", function onProceedClick() {
      setBusy(true);

      requestCheckout(snapshot)
        .then(function onCheckoutResult(result) {
          var checkoutUrl = result && result.body ? result.body.checkoutUrl : "";
          var bookingStatusToken = result && result.body ? result.body.bookingStatusToken : "";

          if (!result.ok || !checkoutUrl || !bookingStatusToken) {
            throw new Error("BOOKING_API_CHECKOUT_FAILED");
          }

          if (!redirectToCheckout(checkoutUrl, bookingStatusToken)) {
            throw new Error("BOOKING_CHECKOUT_HANDOFF_FAILED");
          }
        })
        .catch(function onCheckoutError() {
          setBusy(false);
          showError();
        });
    });

    return true;
  }

  function init() {
    var snapshot = readSnapshot();

    renderSnapshot(snapshot);

    if (snapshot) {
      bindActions(snapshot);
    }

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);