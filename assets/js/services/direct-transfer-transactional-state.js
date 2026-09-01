/* assets/js/services/direct-transfer-transactional-state.js
   Direct Transfer transactional state helpers.
   Responsabilidad:
   - normalizar snapshot Direct Transfer desde form/review
   - construir payload checkout/precheck Booking API
   - compartir storage keys entre bridge y review page
   - no llamar Booking API, Stripe, reCAPTCHA ni Netlify
*/

(function initDirectTransferTransactionalState(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var STORAGE_KEY = "pixkuy_direct_transfer_checkout_review_snapshot";
  var RETURN_KEY = "pixkuy_direct_transfer_checkout_review_return";
  var DEFAULT_CURRENCY = "MXN";
  var MINIMUM_LEAD_TIME_MINUTES = 24 * 60;
  var BOOKING_TIMEZONE = "America/Mexico_City";

  var LEGAL_FIELD_NAMES = [
    "legal_acceptance_accepted",
    "legal_acceptance_terms_version",
    "legal_acceptance_cancellation_policy_version",
    "legal_acceptance_privacy_version",
    "legal_acceptance_accepted_at",
    "legal_acceptance_channel",
    "legal_acceptance_terms_url",
    "legal_acceptance_cancellations_url",
    "legal_acceptance_privacy_url"
  ];

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function formatDateTimePart(value) {
    return String(value).padStart(2, "0");
  }

  function getComparableLocalMinutes(dateValue, timeValue) {
    var dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeText(dateValue));
    var timeMatch = /^(\d{2}):(\d{2})$/.exec(normalizeText(timeValue));

    if (!dateMatch || !timeMatch) {
      return null;
    }

    return Math.floor(Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0
    ) / 60000);
  }

  function getCurrentMexicoCityLocalValues(now) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BOOKING_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now instanceof Date ? now : new Date());
    var values = {};

    parts.forEach(function storePart(part) {
      if (part && part.type && part.value) {
        values[part.type] = part.value;
      }
    });

    return {
      date: [values.year, values.month, values.day].join("-"),
      time: [values.hour, values.minute].join(":")
    };
  }

  function formatComparableMinutes(value) {
    var date = new Date(value * 60000);

    return [
      date.getUTCFullYear(),
      "-",
      formatDateTimePart(date.getUTCMonth() + 1),
      "-",
      formatDateTimePart(date.getUTCDate()),
      "T",
      formatDateTimePart(date.getUTCHours()),
      ":",
      formatDateTimePart(date.getUTCMinutes())
    ].join("");
  }

  function getDirectTransferMinimumLeadTimeBoundary(now) {
    var current = getCurrentMexicoCityLocalValues(now);
    var currentMinutes = getComparableLocalMinutes(current.date, current.time);

    if (!Number.isFinite(currentMinutes)) {
      return "";
    }

    return formatComparableMinutes(currentMinutes + MINIMUM_LEAD_TIME_MINUTES);
  }

  function validateDirectTransferMinimumLeadTime(dateValue, timeValue, now) {
    var selectedMinutes = getComparableLocalMinutes(dateValue, timeValue);
    var boundary = getDirectTransferMinimumLeadTimeBoundary(now);
    var boundaryMinutes = boundary
      ? getComparableLocalMinutes(boundary.slice(0, 10), boundary.slice(11, 16))
      : null;

    return {
      valid: Number.isFinite(selectedMinutes) &&
        Number.isFinite(boundaryMinutes) &&
        selectedMinutes >= boundaryMinutes,
      earliestAllowedStartLocal: boundary,
      minimumLeadTimeMinutes: MINIMUM_LEAD_TIME_MINUTES,
      timezone: BOOKING_TIMEZONE
    };
  }

  function getDirectTransferMinimumDateValue(now) {
    return getDirectTransferMinimumLeadTimeBoundary(now).slice(0, 10);
  }

  function getDirectTransferMinimumTimeValue(dateValue, now) {
    var boundary = getDirectTransferMinimumLeadTimeBoundary(now);

    return normalizeText(dateValue) === boundary.slice(0, 10)
      ? boundary.slice(11, 16)
      : "";
  }

  function hasCanonicalQuoteBinding(quote) {
    var safeQuote = quote && typeof quote === "object" ? quote : {};

    return Boolean(
      Number(safeQuote.price) > 0 &&
      normalizeText(safeQuote.pricingVersion) &&
      normalizeText(safeQuote.quoteFingerprint) &&
      normalizeText(safeQuote.quoteExpiresAt)
    );
  }

  function getField(form, name) {
    return form ? form.querySelector('[name="' + name + '"]') : null;
  }

  function getFieldValue(form, name) {
    var field = getField(form, name);

    return normalizeText(field && field.value);
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

  function parseMoneyMinorUnitsFromMxn(value) {
    var normalized = normalizeText(value).replace(/[^\d.]/g, "");
    var parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed * 100);
  }

  function getPassengerCount(fareKey) {
    var safeFareKey = normalizeText(fareKey);

    if (safeFareKey === "van_3_4") {
      return 4;
    }

    if (safeFareKey === "van_5_6") {
      return 6;
    }

    if (safeFareKey === "van_1_2") {
      return 2;
    }

    return null;
  }

  function getDocumentLocale() {
    var lang =
      normalizeText(window.__pixkuyI18nLang) ||
      normalizeText(document.documentElement && document.documentElement.lang) ||
      "es";

    lang = lang.toLowerCase().replace(/_/g, "-");

    if (
      lang === "zh-cn" ||
      lang === "zh-hans-cn"
    ) {
      return "zh-hans";
    }

    if (lang.indexOf("-") > -1 && lang !== "zh-hans") {
      lang = lang.split("-")[0];
    }

    if (
      [
        "es",
        "en",
        "de",
        "fr",
        "it",
        "pt",
        "ru",
        "ko",
        "zh-hans"
      ].indexOf(lang) === -1
    ) {
      return "es";
    }

    return lang;
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

  function addLegalAcceptanceFields(target, source) {
    var safeSource = source && typeof source === "object" ? source : {};

    LEGAL_FIELD_NAMES.forEach(function copyLegalField(name) {
      var value = normalizeText(safeSource[name]);

      if (value) {
        target[name] = value;
      }
    });

    return target;
  }

  function getPassengerBucketLabel(form, snapshot) {
    return normalizeText(
      getFieldValue(form, "direct_transfer_passenger_bucket_label") ||
        snapshot.direct_transfer_passenger_bucket_label
    );
  }

  function getPriceLabel(form, snapshot) {
    return normalizeText(
      getFieldValue(form, "direct_transfer_price_label") ||
        snapshot.direct_transfer_price_label
    );
  }

  function buildRequestSummary(snapshot) {
    var existingSummary = normalizeText(snapshot.request_summary);
    var parts;

    if (existingSummary) {
      return existingSummary;
    }

    parts = [
      snapshot.direct_transfer_origin_address,
      snapshot.direct_transfer_destination_address,
      snapshot.direct_transfer_date,
      snapshot.direct_transfer_time,
      snapshot.direct_transfer_passenger_bucket_label,
      snapshot.direct_transfer_vehicle_label,
      snapshot.direct_transfer_price_label
    ].map(normalizeText).filter(Boolean);

    return parts.join(" | ");
  }

  function buildSnapshot(form, data) {
    var snapshot = getFormPayloadRaw(form);
    var safeData = data && typeof data === "object" ? data : {};

    snapshot.name = normalizeText(safeData.name) || getFieldValue(form, "name");
    snapshot.email = normalizeText(safeData.email) || getFieldValue(form, "email");
    snapshot.phone = normalizeText(safeData.phone) || getFieldValue(form, "phone");
    snapshot.service_type = "direct_transfer";

    snapshot.direct_transfer_origin_address =
      normalizeText(safeData.directTransferOriginAddress) ||
      getFieldValue(form, "direct_transfer_origin_address");
    snapshot.direct_transfer_origin_place_id =
      normalizeText(safeData.directTransferOriginPlaceId) ||
      getFieldValue(form, "direct_transfer_origin_place_id");
    snapshot.direct_transfer_origin_lat =
      getFieldValue(form, "direct_transfer_origin_lat") ||
      getFieldValue(form, "origin_lat");
    snapshot.direct_transfer_origin_lng =
      getFieldValue(form, "direct_transfer_origin_lng") ||
      getFieldValue(form, "origin_lng");

    snapshot.direct_transfer_destination_address =
      normalizeText(safeData.directTransferDestinationAddress) ||
      getFieldValue(form, "direct_transfer_destination_address");
    snapshot.direct_transfer_destination_place_id =
      normalizeText(safeData.directTransferDestinationPlaceId) ||
      getFieldValue(form, "direct_transfer_destination_place_id");
    snapshot.direct_transfer_destination_lat =
      getFieldValue(form, "direct_transfer_destination_lat") ||
      getFieldValue(form, "destination_lat");
    snapshot.direct_transfer_destination_lng =
      getFieldValue(form, "direct_transfer_destination_lng") ||
      getFieldValue(form, "destination_lng");

    snapshot.direct_transfer_date =
      normalizeText(safeData.directTransferDate) ||
      getFieldValue(form, "direct_transfer_date");
    snapshot.direct_transfer_time =
      normalizeText(safeData.directTransferTime) ||
      getFieldValue(form, "direct_transfer_time");
    snapshot.direct_transfer_passenger_fare_key =
      normalizeText(safeData.directTransferPassengerFareKey) ||
      getFieldValue(form, "direct_transfer_passenger_fare_key");
    snapshot.direct_transfer_passenger_bucket_label =
      getPassengerBucketLabel(form, snapshot);
    snapshot.direct_transfer_price =
      normalizeText(safeData.directTransferPrice) ||
      getFieldValue(form, "direct_transfer_price");
    snapshot.direct_transfer_amount_minor =
      normalizeText(safeData.directTransferAmountMinor) ||
      getFieldValue(form, "direct_transfer_amount_minor");
    snapshot.direct_transfer_currency =
      normalizeText(safeData.directTransferCurrency) ||
      getFieldValue(form, "direct_transfer_currency") ||
      DEFAULT_CURRENCY;
    snapshot.direct_transfer_pricing_version =
      normalizeText(safeData.directTransferPricingVersion) ||
      getFieldValue(form, "direct_transfer_pricing_version");
    snapshot.direct_transfer_quote_fingerprint =
      normalizeText(safeData.directTransferQuoteFingerprint) ||
      getFieldValue(form, "direct_transfer_quote_fingerprint");
    snapshot.direct_transfer_quote_expires_at =
      normalizeText(safeData.directTransferQuoteExpiresAt) ||
      getFieldValue(form, "direct_transfer_quote_expires_at");
    snapshot.direct_transfer_quote_accepted_at =
      normalizeText(safeData.directTransferQuoteAcceptedAt) ||
      getFieldValue(form, "direct_transfer_quote_accepted_at");
    snapshot.direct_transfer_price_label = getPriceLabel(form, snapshot);
    snapshot.direct_transfer_duration_seconds =
      getFieldValue(form, "direct_transfer_duration_seconds");
    snapshot.direct_transfer_distance_meters =
      getFieldValue(form, "direct_transfer_distance_meters");
    snapshot.direct_transfer_vehicle_label =
      getFieldValue(form, "direct_transfer_vehicle_label") ||
      "BYD M9";
    snapshot.direct_transfer_notes =
      getFieldValue(form, "direct_transfer_notes") ||
      normalizeText(safeData.notes) ||
      getFieldValue(form, "message");
    snapshot.request_summary = buildRequestSummary(snapshot);
    snapshot.locale = getDocumentLocale();
    snapshot.form_payload_raw = getFormPayloadRaw(form);

    addLegalAcceptanceFields(snapshot, snapshot.form_payload_raw);

    return snapshot;
  }

  function getSnapshotLocation(snapshot, role) {
    var safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    var prefix = role === "destination"
      ? "direct_transfer_destination_"
      : "direct_transfer_origin_";
    var address = normalizeText(safeSnapshot[prefix + "address"]);
    var lat = parseOptionalFiniteNumber(safeSnapshot[prefix + "lat"]);
    var lng = parseOptionalFiniteNumber(safeSnapshot[prefix + "lng"]);
    var placeId = normalizeText(safeSnapshot[prefix + "place_id"]);
    var location;

    if (!address || lat === null || lng === null) {
      return null;
    }

    location = {
      address: address,
      lat: lat,
      lng: lng,
      country_code: normalizeText(safeSnapshot[prefix + "country_code"]),
      administrative_area_level_1: normalizeText(
        safeSnapshot[prefix + "administrative_area_level_1"]
      ),
      administrative_area_level_2: normalizeText(
        safeSnapshot[prefix + "administrative_area_level_2"]
      ),
      locality: normalizeText(safeSnapshot[prefix + "locality"]),
      iata_code: normalizeText(safeSnapshot[prefix + "iata_code"]),
      types: Array.isArray(safeSnapshot[prefix + "types"])
        ? safeSnapshot[prefix + "types"]
        : [],
      address_components: Array.isArray(safeSnapshot[prefix + "address_components"])
        ? safeSnapshot[prefix + "address_components"]
        : []
    };

    if (placeId) {
      location.place_id = placeId;
    }

    return location;
  }

  function buildPrecheckLocation(apiLocation) {
    if (!apiLocation) {
      return null;
    }

    return {
      label: apiLocation.address,
      placeId: normalizeText(apiLocation.place_id),
      lat: apiLocation.lat,
      lng: apiLocation.lng,
      countryCode: normalizeText(apiLocation.country_code),
      administrativeAreaLevel1: normalizeText(apiLocation.administrative_area_level_1),
      administrativeAreaLevel2: normalizeText(apiLocation.administrative_area_level_2),
      locality: normalizeText(apiLocation.locality),
      iataCode: normalizeText(apiLocation.iata_code),
      types: Array.isArray(apiLocation.types) ? apiLocation.types : [],
      addressComponents: Array.isArray(apiLocation.address_components)
        ? apiLocation.address_components
        : []
    };
  }

  function buildCheckoutPayload(snapshot, options) {
    var safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    var safeOptions = options && typeof options === "object" ? options : {};
    var origin = getSnapshotLocation(safeSnapshot, "origin");
    var destination = getSnapshotLocation(safeSnapshot, "destination");
    var fareKey = normalizeText(safeSnapshot.direct_transfer_passenger_fare_key);
    var passengers = parsePositiveInteger(safeSnapshot.direct_transfer_passengers) ||
      getPassengerCount(fareKey);
    var amountMinor =
      parsePositiveInteger(safeSnapshot.direct_transfer_amount_minor) ||
      parseMoneyMinorUnitsFromMxn(safeSnapshot.direct_transfer_price);
    var payload;
    var durationSeconds;
    var distanceMeters;
    var pricingVersion = normalizeText(
      safeSnapshot.direct_transfer_pricing_version
    );
    var quoteFingerprint = normalizeText(
      safeSnapshot.direct_transfer_quote_fingerprint
    );
    var quoteExpiresAt = normalizeText(
      safeSnapshot.direct_transfer_quote_expires_at
    );
    var quoteAcceptedAt = normalizeText(
      safeSnapshot.direct_transfer_quote_accepted_at
    );

    if (
      !origin ||
      !destination ||
      !fareKey ||
      !passengers ||
      !amountMinor ||
      !normalizeText(safeSnapshot.direct_transfer_date) ||
      !normalizeText(safeSnapshot.direct_transfer_time) ||
      !normalizeText(safeSnapshot.name) ||
      !normalizeText(safeSnapshot.email) ||
      !normalizeText(safeSnapshot.phone) ||
      !pricingVersion ||
      !quoteFingerprint ||
      !quoteExpiresAt ||
      !quoteAcceptedAt ||
      normalizeText(safeSnapshot.direct_transfer_currency) !== DEFAULT_CURRENCY
    ) {
      return null;
    }

    payload = {
      service_type: "direct_transfer",
      direct_transfer_origin: origin,
      direct_transfer_destination: destination,
      direct_transfer_date: normalizeText(safeSnapshot.direct_transfer_date),
      direct_transfer_time: normalizeText(safeSnapshot.direct_transfer_time),
      direct_transfer_passenger_fare_key: fareKey,
      direct_transfer_passengers: passengers,
      direct_transfer_price: amountMinor,
      direct_transfer_currency: DEFAULT_CURRENCY,
      direct_transfer_pricing_version: pricingVersion,
      direct_transfer_quote_fingerprint: quoteFingerprint,
      direct_transfer_quote_expires_at: quoteExpiresAt,
      direct_transfer_quote_accepted_at: quoteAcceptedAt,
      direct_transfer_vehicle_label:
        normalizeText(safeSnapshot.direct_transfer_vehicle_label) || "BYD M9",
      direct_transfer_notes: normalizeText(safeSnapshot.direct_transfer_notes),
      request_summary: buildRequestSummary(safeSnapshot),
      locale: normalizeText(safeSnapshot.locale) || getDocumentLocale(),
      customer: {
        full_name: normalizeText(safeSnapshot.name),
        email: normalizeText(safeSnapshot.email),
        phone: normalizeText(safeSnapshot.phone)
      },
      form_payload_raw:
        safeSnapshot.form_payload_raw &&
        typeof safeSnapshot.form_payload_raw === "object"
          ? safeSnapshot.form_payload_raw
          : {}
    };

    durationSeconds = parsePositiveInteger(
      safeSnapshot.direct_transfer_duration_seconds
    );
    distanceMeters = parsePositiveInteger(
      safeSnapshot.direct_transfer_distance_meters
    );

    if (durationSeconds) {
      payload.direct_transfer_duration_seconds = durationSeconds;
    }

    if (distanceMeters) {
      payload.direct_transfer_distance_meters = distanceMeters;
    }

    addLegalAcceptanceFields(payload, safeSnapshot);

    if (safeOptions.recaptchaToken) {
      payload.recaptchaToken = normalizeText(safeOptions.recaptchaToken);
    }

    return payload;
  }

  function hasLegalAcceptance(snapshot) {
    var safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};

    return Boolean(
      normalizeText(safeSnapshot.legal_acceptance_accepted) === "true" &&
        normalizeText(safeSnapshot.legal_acceptance_terms_version) &&
        normalizeText(safeSnapshot.legal_acceptance_cancellation_policy_version) &&
        normalizeText(safeSnapshot.legal_acceptance_privacy_version) &&
        normalizeText(safeSnapshot.legal_acceptance_accepted_at) &&
        normalizeText(safeSnapshot.legal_acceptance_channel)
    );
  }

  function buildPrecheckPayload(snapshot, options) {
    var safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    var safeOptions = options && typeof options === "object" ? options : {};
    var compareCanonicalQuote = safeOptions.compareCanonicalQuote !== false;
    var origin = getSnapshotLocation(safeSnapshot, "origin");
    var destination = getSnapshotLocation(safeSnapshot, "destination");
    var fareKey = normalizeText(safeSnapshot.direct_transfer_passenger_fare_key);
    var passengers = parsePositiveInteger(safeSnapshot.direct_transfer_passengers) ||
      getPassengerCount(fareKey);
    var amountMinor =
      parsePositiveInteger(safeSnapshot.direct_transfer_amount_minor) ||
      parseMoneyMinorUnitsFromMxn(safeSnapshot.direct_transfer_price);
    var currency = normalizeText(safeSnapshot.direct_transfer_currency) ||
      DEFAULT_CURRENCY;

    if (
      !origin ||
      !destination ||
      !fareKey ||
      !passengers ||
      (compareCanonicalQuote && !amountMinor) ||
      !normalizeText(safeSnapshot.direct_transfer_date) ||
      !normalizeText(safeSnapshot.direct_transfer_time) ||
      currency !== DEFAULT_CURRENCY
    ) {
      return null;
    }

    var payload = {
      serviceType: "direct_transfer",
      originAddress: buildPrecheckLocation(origin),
      destinationAddress: buildPrecheckLocation(destination),
      pickupDate: normalizeText(safeSnapshot.direct_transfer_date),
      pickupTime: normalizeText(safeSnapshot.direct_transfer_time),
      passengerFareKey: fareKey,
      passengers: passengers,
      currency: DEFAULT_CURRENCY,
      locale: normalizeText(safeSnapshot.locale) || getDocumentLocale()
    };

    if (compareCanonicalQuote && amountMinor) {
      payload.expectedAmountMinor = amountMinor;
    }

    if (
      compareCanonicalQuote &&
      normalizeText(safeSnapshot.direct_transfer_pricing_version)
    ) {
      payload.pricingVersion = normalizeText(
        safeSnapshot.direct_transfer_pricing_version
      );
    }

    if (
      compareCanonicalQuote &&
      normalizeText(safeSnapshot.direct_transfer_quote_fingerprint)
    ) {
      payload.quoteFingerprint = normalizeText(
        safeSnapshot.direct_transfer_quote_fingerprint
      );
    }

    if (
      compareCanonicalQuote &&
      normalizeText(safeSnapshot.direct_transfer_quote_expires_at)
    ) {
      payload.quoteExpiresAt = normalizeText(
        safeSnapshot.direct_transfer_quote_expires_at
      );
    }

    return payload;
  }

  function isSnapshotComplete(snapshot) {
    return Boolean(buildCheckoutPayload(snapshot));
  }

  function isSnapshotReadyForPrecheck(snapshot) {
    return Boolean(buildPrecheckPayload(snapshot));
  }

  function applyCanonicalQuote(snapshot, price, acceptedAt) {
    var safePrice = price && typeof price === "object" ? price : {};
    var amountMinor = parsePositiveInteger(
      safePrice.amountMinor || safePrice.actualAmountMinor
    );
    var amountMajor;

    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      !amountMinor ||
      !normalizeText(safePrice.pricingVersion) ||
      !normalizeText(safePrice.quoteFingerprint) ||
      !normalizeText(safePrice.quoteExpiresAt)
    ) {
      return false;
    }

    amountMajor = amountMinor / 100;
    snapshot.direct_transfer_price = Number.isInteger(amountMajor)
      ? String(amountMajor)
      : amountMajor.toFixed(2);
    snapshot.direct_transfer_amount_minor = String(amountMinor);
    snapshot.direct_transfer_currency = DEFAULT_CURRENCY;
    snapshot.direct_transfer_pricing_version = normalizeText(
      safePrice.pricingVersion
    );
    snapshot.direct_transfer_quote_fingerprint = normalizeText(
      safePrice.quoteFingerprint
    );
    snapshot.direct_transfer_quote_expires_at = normalizeText(
      safePrice.quoteExpiresAt
    );
    snapshot.direct_transfer_quote_accepted_at = normalizeText(acceptedAt);

    if (parsePositiveInteger(safePrice.durationSeconds)) {
      snapshot.direct_transfer_duration_seconds = String(
        parsePositiveInteger(safePrice.durationSeconds)
      );
    }

    if (parsePositiveInteger(safePrice.distanceMeters)) {
      snapshot.direct_transfer_distance_meters = String(
        parsePositiveInteger(safePrice.distanceMeters)
      );
    }

    return true;
  }

  function invalidateCanonicalQuoteAcceptance(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    snapshot.direct_transfer_quote_accepted_at = "";
    return true;
  }

  function writeReviewSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readReviewSnapshot() {
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

    return parsed && typeof parsed === "object" ? parsed : null;
  }

  window.PixkuyDirectTransferTransactionalState = {
    storageKey: STORAGE_KEY,
    returnKey: RETURN_KEY,
    legalFieldNames: LEGAL_FIELD_NAMES.slice(),
    normalizeText: normalizeText,
    getDirectTransferMinimumLeadTimeBoundary: getDirectTransferMinimumLeadTimeBoundary,
    getDirectTransferMinimumDateValue: getDirectTransferMinimumDateValue,
    getDirectTransferMinimumTimeValue: getDirectTransferMinimumTimeValue,
    validateDirectTransferMinimumLeadTime: validateDirectTransferMinimumLeadTime,
    hasCanonicalQuoteBinding: hasCanonicalQuoteBinding,
    getFieldValue: getFieldValue,
    getDocumentLocale: getDocumentLocale,
    getFormPayloadRaw: getFormPayloadRaw,
    buildRequestSummary: buildRequestSummary,
    buildSnapshot: buildSnapshot,
    buildCheckoutPayload: buildCheckoutPayload,
    buildPrecheckPayload: buildPrecheckPayload,
    hasLegalAcceptance: hasLegalAcceptance,
    isSnapshotComplete: isSnapshotComplete,
    isSnapshotReadyForPrecheck: isSnapshotReadyForPrecheck,
    applyCanonicalQuote: applyCanonicalQuote,
    invalidateCanonicalQuoteAcceptance: invalidateCanonicalQuoteAcceptance,
    writeReviewSnapshot: writeReviewSnapshot,
    readReviewSnapshot: readReviewSnapshot,
    getPassengerCount: getPassengerCount,
    parseMoneyMinorUnitsFromMxn: parseMoneyMinorUnitsFromMxn
  };
})(window, document);
