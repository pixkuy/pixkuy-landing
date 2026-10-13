/* assets/js/forms/direct-transfer-booking-api-checkout.js
   Direct Transfer Booking API checkout bridge.
   Responsabilidad:
   - interceptar solo direct_transfer transaccional
   - desktop panel: precheck y handoff a Datos propios de Direct
   - Datos desktop/móvil: validar y preparar la Revisión transaccional
   - preservar Netlify Forms para servicios no transaccionales
*/

(function initDirectTransferBookingApiCheckout(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var CHECKOUT_ENDPOINT = "/v1/public/reservations/checkout";
  var PRECHECK_ENDPOINT = "/v1/public/reservations/direct-transfer-availability-precheck";
  var RECAPTCHA_ACTION = "direct_transfer_checkout";
  var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
  var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";
  var DIRECT_TRANSFER_CHECKOUT_REVIEW_PATH = "/direct-transfer-checkout-review.html";
  var LEGAL_ACCEPTANCE_HOST_SELECTOR =
    "[data-direct-transfer-checkout-legal-acceptance]";
  var API_CONFIG_ERROR_CODE = "DIRECT_TRANSFER_BOOKING_API_CONFIG_INVALID";
  var PANEL_SUBMIT_EVENT = "pixkuy:direct-transfer-panel-submit";
  var PROVISIONAL_QUOTE_EVENT = "pixkuy:direct-transfer-provisional-quote";
  var PANEL_PRECHECKED_FLAG = "__pixkuyDirectTransferPrechecked";
  var canonicalPrecheckRequestId = 0;
  var canonicalPrecheckContextKey = "";

  function getStateApi() {
    var api = window.PixkuyDirectTransferTransactionalState;

    return api && typeof api === "object" ? api : null;
  }

  function normalizeText(value) {
    var api = getStateApi();

    if (api && typeof api.normalizeText === "function") {
      return api.normalizeText(value);
    }

    return typeof value === "string" ? value.trim() : "";
  }

  function isHttpsPage() {
    return Boolean(window.location && window.location.protocol === "https:");
  }

  function getDefaultApiBaseUrl() {
    return isHttpsPage() ? "" : DEFAULT_BOOKING_API_BASE_URL;
  }

  function isInsecureApiBaseUrl(apiBaseUrl) {
    return Boolean(
      isHttpsPage() &&
        /^http:\/\//i.test(normalizeText(apiBaseUrl))
    );
  }

  function assertSafeApiBaseUrl(apiBaseUrl) {
    var normalized = normalizeText(apiBaseUrl);

    if (isInsecureApiBaseUrl(normalized)) {
      return "";
    }

    return normalized;
  }

  function isApiConfigurationError(error) {
    return Boolean(
      error &&
        (
          error.message === API_CONFIG_ERROR_CODE ||
          error.code === API_CONFIG_ERROR_CODE
        )
    );
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG;
    var hasExplicitApiBaseUrl;

    if (!config || typeof config !== "object") {
      return {
        apiBaseUrl: getDefaultApiBaseUrl(),
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
        : getDefaultApiBaseUrl(),
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY,
      recaptchaSiteKey: normalizeText(config.recaptchaSiteKey)
    };
  }

  function getReservationApi() {
    var api = window.PixkuyDirectBookingForm;

    if (
      !api ||
      typeof api.getReservationRequestFields !== "function" ||
      typeof api.getReservationRequestData !== "function"
    ) {
      return null;
    }

    return api;
  }

  function getForm() {
    var api = window.PixkuyDirectBookingForm;

    if (api && typeof api.getReservationForm === "function") {
      return api.getReservationForm();
    }

    return null;
  }

  function getFieldValue(form, name) {
    var api = getStateApi();

    if (api && typeof api.getFieldValue === "function") {
      return api.getFieldValue(form, name);
    }

    return "";
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

  function getApiConfigurationErrorMessage() {
    return getI18nValue(
      "contact.validation.bookingApiConfiguration",
      "Booking API configuration is not available for this page."
    );
  }

  function getMinimumLeadTimeMessage() {
    return getI18nValue(
      "services.cards.hourly.panel.availability.minimumLeadTime",
      "Necesitamos al menos 24 horas de antelación para confirmar este servicio."
    );
  }

  function getNextAvailableTimeLabel(result) {
    var suggestion = window.PixkuySharedAvailabilitySuggestion;

    return suggestion && typeof suggestion.describe === "function"
      ? suggestion.describe(result).label
      : "";
  }

  function getNextAvailableStartLocal(result) {
    var suggestion = window.PixkuySharedAvailabilitySuggestion;

    return suggestion && typeof suggestion.extract === "function"
      ? suggestion.extract(result).nextAvailableStartLocal
      : "";
  }

  function getNextAvailableMessage(result) {
    var suggestion = window.PixkuySharedAvailabilitySuggestion;

    return suggestion && typeof suggestion.describe === "function"
      ? suggestion.describe(result, {
          template: getI18nValue(
            "services.cards.hourly.panel.availability.nextAvailableSlot",
            "Siguiente hora disponible: {time}"
          )
        }).message
      : "";
  }

  function getAvailabilityConfirmedMessage() {
    return getI18nValue(
      "services.cards.hourly.panel.availability.available",
      "Disponibilidad confirmada. Puedes continuar."
    );
  }

  function getMexicoCityNowParts() {
    var formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23"
    });
    var parts = formatter.formatToParts(new Date()).reduce(function reduceParts(acc, part) {
      if (part && part.type && part.value) {
        acc[part.type] = part.value;
      }

      return acc;
    }, {});

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute)
    };
  }

  function getFallbackNowParts() {
    var now = new Date();

    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes()
    };
  }

  function getCivilTimestamp(parts) {
    var safeParts = parts && typeof parts === "object" ? parts : {};
    var year = Number(safeParts.year);
    var month = Number(safeParts.month);
    var day = Number(safeParts.day);
    var hour = Number(safeParts.hour);
    var minute = Number(safeParts.minute);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return NaN;
    }

    return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  }

  function getMexicoCityNowCivilTimestamp() {
    var timestamp = NaN;

    try {
      timestamp = getCivilTimestamp(getMexicoCityNowParts());
    } catch (error) {
      timestamp = NaN;
    }

    if (Number.isFinite(timestamp)) {
      return timestamp;
    }

    return getCivilTimestamp(getFallbackNowParts());
  }

  function getDirectTransferMinimumCivilTimestamp() {
    return getMexicoCityNowCivilTimestamp() + (24 * 60 * 60 * 1000);
  }

  function getSelectedDateTimeCivilTimestamp(dateValue, timeValue) {
    var date = normalizeText(dateValue);
    var time = normalizeText(timeValue);
    var dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    var timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

    if (!dateMatch || !timeMatch) {
      return NaN;
    }

    return Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0
    );
  }

  function hasDirectTransferMinimumLeadTime(dateValue, timeValue) {
    var stateApi = getStateApi();
    var selected = getSelectedDateTimeCivilTimestamp(dateValue, timeValue);

    if (
      stateApi &&
      typeof stateApi.validateDirectTransferMinimumLeadTime === "function"
    ) {
      return stateApi.validateDirectTransferMinimumLeadTime(
        dateValue,
        timeValue
      ).valid === true;
    }

    if (!Number.isFinite(selected)) {
      return false;
    }

    return selected >= getDirectTransferMinimumCivilTimestamp();
  }

  function isSnapshotAtOrAfterMinimumLeadTime(snapshot) {
    var safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};

    return hasDirectTransferMinimumLeadTime(
      safeSnapshot.direct_transfer_date,
      safeSnapshot.direct_transfer_time
    );
  }

  function isDesktopViewport() {
    return !(
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }

  function isDirectTransferTransactionalData(data) {
    return Boolean(data && data.serviceType === "direct_transfer");
  }

  function buildApiUrl(config, endpoint) {
    var apiBaseUrl = assertSafeApiBaseUrl(config && config.apiBaseUrl);

    return apiBaseUrl
      ? apiBaseUrl.replace(/\/+$/, "") + endpoint
      : endpoint;
  }

  function buildCheckoutUrl(config) {
    return buildApiUrl(config, CHECKOUT_ENDPOINT);
  }

  function buildPrecheckUrl(config) {
    return buildApiUrl(config, PRECHECK_ENDPOINT);
  }

  function createIdempotencyKey() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return [
      "pixkuy-direct-transfer-checkout",
      Date.now(),
      Math.random().toString(36).slice(2, 12)
    ].join("-");
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

        return recaptcha.execute(RECAPTCHA_ACTION);
      })
      .then(function normalizeRecaptchaToken(token) {
        return normalizeText(token);
      })
      .catch(function ignoreRecaptchaError() {
        return "";
      });
  }

  function setButtonsBusy(form, isBusy) {
    var buttons = [];

    if (form) {
      buttons = buttons.concat(
        Array.prototype.slice.call(form.querySelectorAll('button[type="submit"]'))
      );
    }

    buttons = buttons.concat(
      Array.prototype.slice.call(
        document.querySelectorAll("[data-direct-transfer-mobile-contact-submit]")
      )
    );

    if (form) {
      if (isBusy) {
        form.setAttribute("aria-busy", "true");
        form.setAttribute("data-booking-api-checkout-busy", "1");
      } else {
        form.setAttribute("aria-busy", "false");
        form.removeAttribute("data-booking-api-checkout-busy");
        form.removeAttribute("data-submitted");
      }
    }

    buttons.forEach(function syncButton(button) {
      button.disabled = Boolean(isBusy);
      button.setAttribute("aria-disabled", isBusy ? "true" : "false");
    });

    return true;
  }

  function showCheckoutError(form, message) {
    var fields =
      window.PixkuyForms &&
      typeof window.PixkuyDirectBookingForm.getReservationRequestFields === "function"
        ? window.PixkuyDirectBookingForm.getReservationRequestFields(form)
        : null;
    var errorText = normalizeText(message) || getI18nValue(
      "contact.validation.formIncomplete",
      "Revisa los datos del formulario."
    );
    var mobileError = document.querySelector(
      '[data-direct-transfer-mobile-contact-step][aria-hidden="false"] [data-direct-transfer-mobile-contact-global-error]'
    );

    if (fields && fields.formError) {
      fields.formError.textContent = errorText;
      fields.formError.hidden = false;
    }

    if (mobileError) {
      mobileError.textContent = errorText;
      mobileError.hidden = false;
    }

    return true;
  }

  function hideCheckoutError(form) {
    var fields =
      window.PixkuyForms &&
      typeof window.PixkuyDirectBookingForm.getReservationRequestFields === "function"
        ? window.PixkuyDirectBookingForm.getReservationRequestFields(form)
        : null;
    var mobileError = document.querySelector(
      '[data-direct-transfer-mobile-contact-step][aria-hidden="false"] [data-direct-transfer-mobile-contact-global-error]'
    );

    if (fields && fields.formError) {
      fields.formError.hidden = true;
    }

    if (mobileError) {
      mobileError.hidden = true;
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
    host.setAttribute("data-direct-transfer-checkout-legal-acceptance", "1");
    host.hidden = true;

    actions.parentNode.insertBefore(host, actions);

    return host;
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

    var restoredProof = api.readEvidence(form, "web_direct_transfer_checkout");
    host.__pixkuyLegalAcceptanceInstance = api.create({
      container: host,
      form: form,
      channel: "web_direct_transfer_checkout",
      checkboxId: "pixkuy-direct-transfer-legal-acceptance"
    });
    host.__pixkuyLegalAcceptanceInstance.restore(restoredProof);

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
    var mobileBridge;

    if (hasSyncedLegalAcceptance(form)) {
      return true;
    }

    if (!isDesktopViewport()) {
      mobileBridge = window.PixkuyDirectTransferMobileTransactionalBridge;

      return Boolean(
        mobileBridge &&
          typeof mobileBridge.validateLegalAcceptance === "function" &&
          mobileBridge.validateLegalAcceptance()
      );
    }

    instance = getLegalAcceptanceInstance(form);

    if (!instance || typeof instance.validate !== "function") {
      return false;
    }

    return instance.validate();
  }

  function isLegalAcceptanceInstanceAccepted(instance) {
    return Boolean(
      instance &&
        typeof instance.isAccepted === "function" &&
        instance.isAccepted()
    );
  }

  function syncLegalAcceptanceVisibility(form) {
    if (window.PixkuyDirectPendingEdit?.activeData() && isDesktopViewport()) {
      window.PixkuyDirectDesktopBooking?.refreshPending();
      return true;
    }
    var api = getReservationApi();
    var fields;
    var data;
    var stateApi = getStateApi();
    var snapshot;
    var host;
    var instance;
    var required;

    if (!form || !api || !stateApi || !isDesktopViewport()) {
      return false;
    }

    fields = api.getReservationRequestFields(form);
    data = fields ? api.getReservationRequestData(fields) : null;
    required = isDirectTransferTransactionalData(data);

    if (!required) {
      host = form.querySelector(LEGAL_ACCEPTANCE_HOST_SELECTOR);

      if (host) {
        host.hidden = true;
      }

      return true;
    }

    snapshot = stateApi.buildSnapshot(form, data);
    instance = getLegalAcceptanceInstance(form);
    host = form.querySelector(LEGAL_ACCEPTANCE_HOST_SELECTOR);

    if (host) {
      host.hidden = false;
    }

    Array.prototype.slice.call(form.querySelectorAll('button[type="submit"]'))
      .forEach(function syncSubmit(button) {
        button.disabled = form.getAttribute("data-booking-api-checkout-busy") === "1" || !api.validate(false) || !stateApi.isSnapshotReadyForPrecheck(snapshot) ||
          !isLegalAcceptanceInstanceAccepted(instance);
        button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
      });

    return true;
  }

  function requestCheckout(input) {
    var url;

    try {
      url = buildCheckoutUrl(input.config);
    } catch (error) {
      return Promise.reject(error);
    }

    return window.PixkuyFleetSelection.fetchCheckout("direct_transfer", url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pixkuy-Site-Key": input.config.publicSiteKey,
        "Idempotency-Key": input.idempotencyKey
      },
      body: JSON.stringify(input.payload)
    }).then(function parseResponse(response) {
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

  function requestPrecheck(input) {
    var url;

    try {
      url = buildPrecheckUrl(input.config);
    } catch (error) {
      return Promise.reject(error);
    }

    return window.PixkuyFleetSelection.fetchPrecheck("direct_transfer", url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pixkuy-Site-Key": input.config.publicSiteKey
      },
      body: JSON.stringify(input.payload)
    }).then(function parseResponse(response) {
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

  function isPrecheckAllowed(result) {
    var body = result && result.body;
    var precheck = body && body.result && typeof body.result === "object"
      ? body.result
      : {};

    return Boolean(
      result &&
        result.ok &&
        precheck.checkoutAllowed === true
    );
  }

  function getPrecheckCode(result) {
    var body = result && result.body;
    var precheck = body && body.result && typeof body.result === "object"
      ? body.result
      : {};
    var availability = precheck.availability && typeof precheck.availability === "object"
      ? precheck.availability
      : {};

    return normalizeText(precheck.code) ||
      normalizeText(precheck.reason) ||
      normalizeText(availability.code) ||
      normalizeText(body && body.code) ||
      normalizeText(body && body.errorCode);
  }

  function getPrecheckPrice(result) {
    var body = result && result.body;
    var precheck = body && body.result && typeof body.result === "object"
      ? body.result
      : {};
    var price = precheck.price && typeof precheck.price === "object"
      ? precheck.price
      : {};

    return price;
  }

  function parsePositiveIntegerValue(value) {
    var parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    parsed = Math.trunc(parsed);

    return parsed > 0 ? parsed : null;
  }

  function formatMxnAmount(value) {
    var amount = Number(value);

    if (!Number.isFinite(amount)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: 0
      }).format(Math.round(amount));
    } catch (error) {
      return String(Math.round(amount));
    }
  }

  function formatMxnPriceLabelFromMinor(amountMinor) {
    return [
      "$",
      formatMxnAmount(Number(amountMinor) / 100),
      " ",
      getI18nValue("directTransferMobileFlow.fare.readySuffix", "MXN")
    ].join("");
  }



  function syncCanonicalQuoteToForm(snapshot) {
    var current = window.PixkuyDirectBookingForm.raw();
    if (getCanonicalQuoteContextKey(current) !== getCanonicalQuoteContextKey(snapshot)) return false;
    window.PixkuyDirectBookingForm.patch(Object.fromEntries(Object.entries(snapshot || {}).filter(function(entry){ return /^direct_transfer_(price|amount|currency|duration|distance|pricing|quote)/.test(entry[0]); })));
    window.PixkuyDirectDesktopBooking?.refreshQuote();
    return true;
  }

  function getCanonicalQuoteContextKey(snapshot) {
    var safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};

    return [
      safeSnapshot.direct_transfer_date,
      safeSnapshot.direct_transfer_time,
      safeSnapshot.direct_transfer_passenger_fare_key,
      safeSnapshot.direct_transfer_origin_place_id,
      safeSnapshot.direct_transfer_origin_lat,
      safeSnapshot.direct_transfer_origin_lng,
      safeSnapshot.direct_transfer_destination_place_id,
      safeSnapshot.direct_transfer_destination_lat,
      safeSnapshot.direct_transfer_destination_lng
    ].map(normalizeText).join("|");
  }

  function notifyCanonicalPriceChanged(snapshot, accepted, checkoutAllowed, code, result) {
    var precheckPrice = getPrecheckPrice(result);
    var amountMinor = parsePositiveIntegerValue(precheckPrice.amountMinor) ||
      parsePositiveIntegerValue(precheckPrice.actualAmountMinor);

    window.dispatchEvent(
      new window.CustomEvent("pixkuy:direct-transfer-canonical-price", {
        detail: {
          accepted: accepted === true,
          checkoutAllowed: checkoutAllowed === true,
          code: normalizeText(code),
          availabilityMessage: getPrecheckErrorMessage(result),
          nextAvailableTime: getNextAvailableTimeLabel(result),
          nextAvailableStartLocal: getNextAvailableStartLocal(result),
          contextKey: getCanonicalQuoteContextKey(snapshot),
          price: Number(snapshot && snapshot.direct_transfer_price),
          amountMinor: amountMinor,
          currency: normalizeText(snapshot && snapshot.direct_transfer_currency),
          priceLabel: normalizeText(snapshot && snapshot.direct_transfer_price_label),
          durationSeconds: Number(snapshot && snapshot.direct_transfer_duration_seconds),
          distanceMeters: Number(snapshot && snapshot.direct_transfer_distance_meters),
          pricingVersion: normalizeText(snapshot && snapshot.direct_transfer_pricing_version),
          quoteFingerprint: normalizeText(snapshot && snapshot.direct_transfer_quote_fingerprint),
          quoteExpiresAt: normalizeText(snapshot && snapshot.direct_transfer_quote_expires_at),
          quoteAcceptedAt: normalizeText(snapshot && snapshot.direct_transfer_quote_accepted_at)
        }
      })
    );
  }

  function applyPrecheckPriceToSnapshot(snapshot, result, accepted) {
    var price = getPrecheckPrice(result);
    var amountMinor = parsePositiveIntegerValue(price.amountMinor) ||
      parsePositiveIntegerValue(price.actualAmountMinor);
    var amountMajor;
    var durationSeconds;
    var distanceMeters;
    var stateApi = getStateApi();

    if (
      !snapshot ||
      !amountMinor ||
      !stateApi ||
      typeof stateApi.applyCanonicalQuote !== "function" ||
      !stateApi.applyCanonicalQuote(
        snapshot,
        price,
        accepted === true ? new Date().toISOString() : ""
      )
    ) {
      return false;
    }

    amountMajor = amountMinor / 100;
    snapshot.direct_transfer_price = Number.isInteger(amountMajor)
      ? String(amountMajor)
      : amountMajor.toFixed(2);
    snapshot.direct_transfer_currency = "MXN";
    snapshot.direct_transfer_price_label = formatMxnPriceLabelFromMinor(amountMinor);

    durationSeconds = parsePositiveIntegerValue(price.durationSeconds);
    distanceMeters = parsePositiveIntegerValue(price.distanceMeters);

    if (durationSeconds) {
      snapshot.direct_transfer_duration_seconds = String(durationSeconds);
    }

    if (distanceMeters) {
      snapshot.direct_transfer_distance_meters = String(distanceMeters);
    }

    syncCanonicalQuoteToForm(snapshot);
    notifyCanonicalPriceChanged(
      snapshot,
      accepted,
      isPrecheckAllowed(result),
      getPrecheckCode(result),
      result
    );

    return true;
  }

  function handoffPanelSnapshotToContact(snapshot) {
    var owner=window.PixkuyDirectDesktopBooking;
    if (!owner) return false;
    return owner.open(snapshot);
  }

  function applyPanelSnapshotToContact(snapshot) {
    if (handoffPanelSnapshotToContact(snapshot)) {
      return true;
    }

    setPanelPrecheckMessage(getPrecheckErrorMessage(null), "error");
    return false;
  }

  function getPrecheckErrorMessage(result) {
    var body = result && result.body;
    var precheck = body && body.result && typeof body.result === "object"
      ? body.result
      : {};
    var nextAvailableMessage = getNextAvailableMessage(result);
    var commercialUnavailable = !!(precheck.fleet && precheck.fleet.status === "unavailable") ||
      !!(precheck.availability && precheck.availability.available === false);
    var baseMessage = getI18nValue(
      commercialUnavailable ? "fleetSelection.none" : "fleetSelection.technical",
      commercialUnavailable ? "No hay vehículos disponibles en este horario." : "No pudimos comprobar disponibilidad. Inténtalo de nuevo."
    );
    var code = getPrecheckCode(result);

    if (code === "DIRECT_TRANSFER_MINIMUM_LEAD_TIME_NOT_MET") {
      return [
        getMinimumLeadTimeMessage(),
        nextAvailableMessage
      ].filter(Boolean).join(" ");
    }

    if (code === "DIRECT_TRANSFER_PRICE_MISMATCH") {
      return getI18nValue(
        "directTransferMobileFlow.fare.priceUpdated",
        ""
      );
    }

    if (code === "DIRECT_TRANSFER_QUOTE_STALE") {
      return getI18nValue("directTransferMobileFlow.fare.quoteStale", "");
    }

    if (code === "DIRECT_TRANSFER_PRICING_VERSION_MISMATCH") {
      return getI18nValue("directTransferMobileFlow.fare.requoteRequired", "");
    }

    if (code === "DIRECT_TRANSFER_QUOTE_FINGERPRINT_MISMATCH") {
      return getI18nValue("directTransferMobileFlow.fare.quoteTampered", "");
    }

    if (nextAvailableMessage) {
      return baseMessage + " " + nextAvailableMessage;
    }

    return baseMessage;
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

    if (!url || !token) {
      return false;
    }

    if (!storeBookingCheckoutHandoff({
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

  function redirectToCheckoutReview(snapshot) {
    snapshot = window.PixkuyFleetSelection.snapshot("direct_transfer", snapshot, {refreshSelection:true});
    var stateApi = getStateApi();

    if (!stateApi || typeof stateApi.writeReviewSnapshot !== "function") {
      return false;
    }

    var saved = stateApi.readReviewSnapshot();
    if (saved && saved.mobileDraft && !isDesktopViewport()) snapshot.mobileDraft = saved.mobileDraft;

    if (!stateApi.writeReviewSnapshot(snapshot)) {
      return false;
    }

    window.location.assign(DIRECT_TRANSFER_CHECKOUT_REVIEW_PATH + "?lang=" + encodeURIComponent(document.documentElement.lang || "es"));
    return true;
  }

  function getPanelLocationSnapshot(detail, role) {
    var location = detail && detail[role + "Address"] &&
      typeof detail[role + "Address"] === "object"
      ? detail[role + "Address"]
      : {};
    var prefix = role === "destination"
      ? "direct_transfer_destination_"
      : "direct_transfer_origin_";
    var snapshot = {};

    snapshot[prefix + "address"] = normalizeText(
      location.label ||
        location.address ||
        location.formattedAddress ||
        detail[prefix + "address"]
    );
    snapshot[prefix + "place_id"] = normalizeText(
      location.placeId ||
        location.place_id ||
        location.id ||
        detail[prefix + "place_id"]
    );
    snapshot[prefix + "lat"] = normalizeText(
      location.lat != null ? String(location.lat) : detail[prefix + "lat"]
    );
    snapshot[prefix + "lng"] = normalizeText(
      location.lng != null ? String(location.lng) : detail[prefix + "lng"]
    );
    snapshot[prefix + "country_code"] = normalizeText(
      location.countryCode || location.country_code
    );
    snapshot[prefix + "administrative_area_level_1"] = normalizeText(
      location.administrativeAreaLevel1 ||
        location.administrative_area_level_1
    );
    snapshot[prefix + "administrative_area_level_2"] = normalizeText(
      location.administrativeAreaLevel2 ||
        location.administrative_area_level_2
    );
    snapshot[prefix + "locality"] = normalizeText(location.locality);
    snapshot[prefix + "iata_code"] = normalizeText(
      location.iataCode || location.iata_code
    );
    snapshot[prefix + "types"] = Array.isArray(location.types)
      ? location.types
      : [];
    snapshot[prefix + "address_components"] = Array.isArray(location.addressComponents)
      ? location.addressComponents
      : (
        Array.isArray(location.address_components)
          ? location.address_components
          : []
      );

    return snapshot;
  }

  function buildPanelSnapshot(detail) {
    var stateApi = getStateApi();
    var snapshot = Object.assign(
      {},
      getPanelLocationSnapshot(detail, "origin"),
      getPanelLocationSnapshot(detail, "destination")
    );

    snapshot.service_type = "direct_transfer";
    snapshot.direct_transfer_date = normalizeText(detail.direct_transfer_date);
    snapshot.direct_transfer_time = normalizeText(detail.direct_transfer_time);
    snapshot.direct_transfer_passenger_fare_key = normalizeText(
      detail.direct_transfer_passenger_fare_key
    );
    snapshot.direct_transfer_passenger_bucket_label = normalizeText(
      detail.direct_transfer_passenger_bucket_label
    );
    snapshot.direct_transfer_price = normalizeText(detail.direct_transfer_price);
    snapshot.direct_transfer_amount_minor = normalizeText(
      detail.quote && detail.quote.amountMinor != null
        ? String(detail.quote.amountMinor)
        : ""
    );
    snapshot.direct_transfer_currency =
      normalizeText(detail.direct_transfer_currency) || "MXN";
    snapshot.direct_transfer_price_label = normalizeText(
      detail.direct_transfer_price_label
    );
    snapshot.direct_transfer_duration_seconds = normalizeText(
      detail.direct_transfer_duration_seconds
    );
    snapshot.direct_transfer_distance_meters = normalizeText(
      detail.direct_transfer_distance_meters
    );
    snapshot.direct_transfer_notes = normalizeText(detail.direct_transfer_notes);
    snapshot.direct_transfer_vehicle_label =
      normalizeText(detail.direct_transfer_vehicle_label) || "BYD M9";
    snapshot.direct_transfer_pricing_version = normalizeText(
      detail.quote && detail.quote.pricingVersion
    );
    snapshot.direct_transfer_quote_fingerprint = normalizeText(
      detail.quote && detail.quote.quoteFingerprint
    );
    snapshot.direct_transfer_quote_expires_at = normalizeText(
      detail.quote && detail.quote.quoteExpiresAt
    );
    snapshot.direct_transfer_quote_accepted_at = normalizeText(
      detail.quote && detail.quote.quoteAcceptedAt
    );
    snapshot.locale = stateApi && typeof stateApi.getDocumentLocale === "function"
      ? stateApi.getDocumentLocale()
      : normalizeText(document.documentElement && document.documentElement.lang);

    return snapshot;
  }

  function handleProvisionalQuote(event) {
    var detail = event && event.detail && typeof event.detail === "object"
      ? event.detail
      : null;
    var stateApi = getStateApi();
    var requestId = canonicalPrecheckRequestId + 1;
    var contextKey = normalizeText(detail && detail.contextKey);
    var compareCanonicalQuote;
    var snapshot;
    var payload;

    if (!detail || !stateApi || typeof stateApi.buildPrecheckPayload !== "function") {
      return;
    }
    if (detail.surface === "panel" && /^#direct\/datos(?:\/|$)/.test(window.location.hash)) return;

    snapshot = buildPanelSnapshot(detail);
    compareCanonicalQuote = Boolean(
      typeof stateApi.hasCanonicalQuoteBinding === "function" &&
      stateApi.hasCanonicalQuoteBinding(detail.quote)
    );
    payload = stateApi.buildPrecheckPayload(snapshot, {
      compareCanonicalQuote: compareCanonicalQuote
    });

    if (!payload) {
      return;
    }

    canonicalPrecheckRequestId = requestId;
    canonicalPrecheckContextKey = contextKey;

    waitForPublicConfigReady()
      .then(function requestCanonicalPrecheck() {
        if (detail.surface === "panel" && /^#direct\/datos(?:\/|$)/.test(window.location.hash)) return null;
        return requestPrecheck({
          config: getConfig(),
          payload: payload
        });
      })
      .then(function onCanonicalPrecheckResult(result) {
        if (!result || (detail.surface === "panel" && /^#direct\/datos(?:\/|$)/.test(window.location.hash))) return;
        var suggestion = window.PixkuySharedAvailabilitySuggestion;

        if (!suggestion || !suggestion.isCurrentRequest({
          requestId: requestId,
          currentRequestId: canonicalPrecheckRequestId,
          contextKey: contextKey,
          currentContextKey: canonicalPrecheckContextKey,
          liveContextKey: detail.surface === "panel" ? window.PixkuyDirectTransferPanel.contextKey() : canonicalPrecheckContextKey
        })) {
          return;
        }

        if (!applyPrecheckPriceToSnapshot(snapshot, result, false)) {
          notifyCanonicalPriceChanged(
            snapshot,
            false,
            false,
            getPrecheckCode(result),
            result
          );

          if (detail.surface === "panel") {
            setPanelPrecheckMessage(getPrecheckErrorMessage(result), "error", result);
          }
          return;
        }

        if (detail.surface === "panel") {
          setPanelPrecheckMessage(
            isPrecheckAllowed(result)
              ? getAvailabilityConfirmedMessage()
              : getPrecheckErrorMessage(result),
            isPrecheckAllowed(result) ? "success" : "error",
            result
          );
        }
      })
      .catch(function onCanonicalPrecheckError(error) {
        var suggestion = window.PixkuySharedAvailabilitySuggestion;

        if (!suggestion || !suggestion.isCurrentRequest({
          requestId: requestId,
          currentRequestId: canonicalPrecheckRequestId,
          contextKey: contextKey,
          currentContextKey: canonicalPrecheckContextKey,
          liveContextKey: detail.surface === "panel" ? window.PixkuyDirectTransferPanel.contextKey() : canonicalPrecheckContextKey
        })) {
          return;
        }

        notifyCanonicalPriceChanged(
          snapshot,
          false,
          false,
          "DIRECT_TRANSFER_PRECHECK_FAILED",
          null
        );

        if (detail.surface !== "panel") {
          return;
        }

        setPanelPrecheckMessage(
          isApiConfigurationError(error)
            ? getApiConfigurationErrorMessage()
            : getPrecheckErrorMessage(null),
          "error"
        );
      });
  }

  function setPanelPrecheckMessage(message, state, result) {
    var panel = document.querySelector("[data-services-direct-transfer-panel]");
    var statusNode = panel
      ? panel.querySelector("[data-direct-transfer-panel-availability]")
      : null;
    var fare = panel
      ? panel.querySelector(".services-direct-transfer-panel__fare")
      : null;
    var value = panel
      ? panel.querySelector(".services-direct-transfer-panel__fare-value")
      : null;

    if (fare && state) {
      fare.setAttribute("data-direct-transfer-panel-fare-state", state);
      // Keep one explanation beside the action, including the valid suggestion.
      fare.hidden = (state === "error" || state === "choice") && !!statusNode;
    }

    if (statusNode) {
      var suggestion = window.PixkuySharedAvailabilitySuggestion;
      var description = suggestion && typeof suggestion.describe === "function"
        ? suggestion.describe(result, {
            template: getI18nValue(
              "services.cards.hourly.panel.availability.nextAvailableSlot",
              "Siguiente hora disponible: {time}"
            )
          })
        : { message: "", nextAvailableStartLocal: "" };
      var baseMessage = description.message && (message || "").endsWith(description.message)
        ? (message || "").slice(0, -description.message.length).trim()
        : (message || "");

      if (
        state === "error" &&
        description.nextAvailableStartLocal &&
        suggestion &&
        typeof suggestion.render === "function"
      ) {
        suggestion.render({
          container: statusNode,
          result: result,
          baseMessage: baseMessage,
          template: getI18nValue(
            "services.cards.hourly.panel.availability.nextAvailableSlot",
            "Siguiente hora disponible: {time}"
          ),
          onApply: function onApplyDirectTransferSuggestion(value) {
            var appliedDateTime = null;

            suggestion.apply({
              nextAvailableStartLocal: value,
              invalidate: function invalidateDirectTransferSuggestion() {
                canonicalPrecheckRequestId += 1;
              },
              applyDateTime: function applyDirectTransferDateTime(applied) {
                appliedDateTime = applied;
              },
              setPendingUi: function setDirectTransferPendingUi() {
                setPanelPrecheckMessage(
                  getI18nValue(
                    "directTransferMobileFlow.fare.loading",
                    "Checking availability..."
                  ),
                  "loading"
                );
              },
              recheck: function recheckDirectTransferSuggestion() {
                if (!appliedDateTime) {
                  return false;
                }

                window.dispatchEvent(new CustomEvent(
                  "pixkuy:direct-transfer-next-available-applied",
                  {
                    detail: {
                      nextAvailableStartLocal: appliedDateTime.value,
                      date: appliedDateTime.date,
                      time: appliedDateTime.time
                    }
                  }
                ));

                return true;
              }
            });
          }
        });
      } else {
        statusNode.textContent = message || "";
      }
      statusNode.hidden = !message;

      if (state) {
        statusNode.setAttribute("data-availability-tone", state);
      } else {
        statusNode.removeAttribute("data-availability-tone");
      }

      return true;
    }

    if (value && message) {
      value.textContent = message;
    }

    return Boolean(value);
  }

  document.addEventListener("pixkuy:fleet-choice-required", function (event) {
    if (event.detail.service !== "direct_transfer" || event.detail.surface !== "panel") return;
    setPanelPrecheckMessage("", "choice");
  });

  function handlePanelSubmit(event) {
    var detail = event && event.detail && typeof event.detail === "object"
      ? event.detail
      : null;
    var stateApi = getStateApi();
    var snapshot;
    var payload;

    if (!detail || detail[PANEL_PRECHECKED_FLAG] === true) {
      return;
    }

    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    if (!stateApi || typeof stateApi.buildPrecheckPayload !== "function") {
      setPanelPrecheckMessage(getPrecheckErrorMessage(null), "error");
      return;
    }

    window.PixkuyFleetSelection.enterPanel("direct_transfer");
    snapshot = buildPanelSnapshot(detail);
    var selectionBeforePrecheck = window.PixkuyFleetSelection.selection("direct_transfer");

    payload = stateApi.buildPrecheckPayload(snapshot);

    if (!payload) {
      setPanelPrecheckMessage(getPrecheckErrorMessage(null), "error");
      return;
    }

    setPanelPrecheckMessage(
      getI18nValue("directTransferMobileFlow.fare.loading", "Checking availability..."),
      "loading"
    );

    waitForPublicConfigReady()
      .then(function requestPanelPrecheck() {
        return requestPrecheck({
          config: getConfig(),
          payload: payload
        });
      })
      .then(function onPanelPrecheckResult(result) {
        if (getCanonicalQuoteContextKey(snapshot) !== window.PixkuyDirectTransferPanel.contextKey()) return;
        if (isPrecheckAllowed(result)) {
          applyPrecheckPriceToSnapshot(snapshot, result, true);
          setPanelPrecheckMessage(
            getAvailabilityConfirmedMessage(),
            "success"
          );
          if (!window.PixkuyFleetSelection.canContinue("direct_transfer", selectionBeforePrecheck)) return;
          applyPanelSnapshotToContact(snapshot);
          return;
        }

        if (applyPrecheckPriceToSnapshot(snapshot, result, false)) {
          setPanelPrecheckMessage(getPrecheckErrorMessage(result), "error", result);
          return;
        }

        setPanelPrecheckMessage(getPrecheckErrorMessage(result), "error", result);
      })
      .catch(function onPanelPrecheckError(error) {
        if (getCanonicalQuoteContextKey(snapshot) !== window.PixkuyDirectTransferPanel.contextKey()) return;
        setPanelPrecheckMessage(
          isApiConfigurationError(error)
            ? getApiConfigurationErrorMessage()
            : getPrecheckErrorMessage(null),
          "error"
        );
      });
  }

  function restoreCheckoutReviewReturn() {
    var stateApi=getStateApi(), own=window.PixkuyDirectBookingForm;
    if (!stateApi || !own || window.sessionStorage.getItem(stateApi.returnKey)!=="1") return false;
    var snapshot=stateApi.readReviewSnapshot();if (!snapshot) return false;
    own.restore(snapshot);
    window.PixkuyFleetSelection.editFromReview("direct_transfer");
    window.sessionStorage.removeItem(stateApi.returnKey);
    return true;
  }

  function handleSubmit(event) {
    var form = event.target;
    var reservationApi;
    var stateApi;
    var fields;
    var data;
    var snapshot;
    var config;

    if (
      !form ||
      form.nodeType !== 1 ||
      form !== getForm()
    ) {
      return;
    }

    reservationApi = getReservationApi();
    stateApi = getStateApi();

    // The existing pending editor owns replacement authorization and timing.
    if (isDesktopViewport() && window.PixkuyDirectPendingEdit?.activeData()) return;

    if (!reservationApi || !stateApi) {
      return;
    }

    fields = reservationApi.getReservationRequestFields(form);
    data = fields ? reservationApi.getReservationRequestData(fields) : null;

    if (!isDirectTransferTransactionalData(data)) {
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

    if (!reservationApi.validate(true)) { showCheckoutError(form); return; }
    syncLegalAcceptanceVisibility(form);

    snapshot = stateApi.buildSnapshot(form, data);

    if (!stateApi.isSnapshotReadyForPrecheck(snapshot)) {
      showCheckoutError(form);
      return;
    }

    if (!isSnapshotAtOrAfterMinimumLeadTime(snapshot)) {
      showCheckoutError(form, getMinimumLeadTimeMessage());
      return;
    }

    if (!validateLegalAcceptance(form)) {
      return;
    }

    snapshot = stateApi.buildSnapshot(form, data);

    if (
      !stateApi.isSnapshotReadyForPrecheck(snapshot) ||
      (
        typeof stateApi.hasLegalAcceptance === "function" &&
        !stateApi.hasLegalAcceptance(snapshot)
      )
    ) {
      showCheckoutError(form);
      return;
    }

    if (!isSnapshotAtOrAfterMinimumLeadTime(snapshot)) {
      showCheckoutError(form, getMinimumLeadTimeMessage());
      return;
    }

    hideCheckoutError(form);
    setButtonsBusy(form, true);

    config = getConfig();
    {
      var ownRevision = reservationApi.revision();
      var mobileOwner = !isDesktopViewport() && window.PixkuyDirectTransferMobileContactStep;
      var mobileRevision = mobileOwner && mobileOwner.revision();
      var precheckPayload = stateApi.buildPrecheckPayload(snapshot);

      if (!precheckPayload) {
        setButtonsBusy(form, false);
        showCheckoutError(form);
        return;
      }

      requestPrecheck({
        config: config,
        payload: precheckPayload
      })
        .then(function onPrecheckResult(result) {
          if (reservationApi.revision() !== ownRevision || (mobileOwner && (!mobileOwner.isOpen() || mobileOwner.revision() !== mobileRevision))) {
            setButtonsBusy(form, false);
            return;
          }
          if (isPrecheckAllowed(result)) {
            applyPrecheckPriceToSnapshot(snapshot, result, true);

            if (!redirectToCheckoutReview(snapshot)) {
              setButtonsBusy(form, false);
              showCheckoutError(form);
            }

            return;
          }

          if (applyPrecheckPriceToSnapshot(snapshot, result, false)) {
            setButtonsBusy(form, false);
            showCheckoutError(form, getPrecheckErrorMessage(result));
            return;
          }

          setButtonsBusy(form, false);
          showCheckoutError(form, getPrecheckErrorMessage(result));
        })
        .catch(function onPrecheckError(error) {
          setButtonsBusy(form, false);
          showCheckoutError(
            form,
            isApiConfigurationError(error) ? getApiConfigurationErrorMessage() : ""
          );
        });

      return;
    }

  }

  function init() {
    if (document.documentElement.dataset.directTransferBookingApiCheckoutBound === "1") {
      return false;
    }

    window.addEventListener(PANEL_SUBMIT_EVENT, handlePanelSubmit);
    window.addEventListener(PROVISIONAL_QUOTE_EVENT, handleProvisionalQuote);
    document.addEventListener("submit", handleSubmit, true);

    document.addEventListener("input", function onDocumentInput() {
      syncLegalAcceptanceVisibility(getForm());
    }, true);

    document.addEventListener("change", function onDocumentChange() {
      syncLegalAcceptanceVisibility(getForm());
    }, true);

    document.addEventListener("click", function onDocumentClick() {
      syncLegalAcceptanceVisibility(getForm());
    }, true);

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      syncLegalAcceptanceVisibility(getForm());
    });

    window.setTimeout(function restoreReturnAfterInit() {
      restoreCheckoutReviewReturn(0);
    }, 0);

    document.documentElement.dataset.directTransferBookingApiCheckoutBound = "1";

    return true;
  }

  window.PixkuyDirectBookingCheckout = {
    refreshFormState: function () {
      return syncLegalAcceptanceVisibility(getForm());
    }
  };

  init();
})(window, document);
