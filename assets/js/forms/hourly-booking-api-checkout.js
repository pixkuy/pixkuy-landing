/* assets/js/forms/hourly-booking-api-checkout.js
   Hourly Booking API checkout bridge.
   Responsabilidad:
   - interceptar solo hourly_daily transaccional: hourly/full_day
   - llamar a Booking API y redirigir a Stripe Checkout
   - dejar intacto Netlify Forms para el resto de servicios
   - no tocar success modal, WhatsApp, Google Places ni analytics
*/

(function initHourlyBookingApiCheckout(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
var CHECKOUT_ENDPOINT = "/v1/public/reservations/checkout";
var RECAPTCHA_ACTION = "hourly_checkout";
var DEFAULT_HOURLY_PASSENGERS = 6;
var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";
var HOURLY_CHECKOUT_REVIEW_PATH = "/hourly-checkout-review.html";
var HOURLY_CHECKOUT_REVIEW_STORAGE_KEY = "pixkuy_hourly_checkout_review_snapshot";
var LEGAL_ACCEPTANCE_HOST_SELECTOR = "[data-hourly-checkout-legal-acceptance]";
var availabilityPrecheckSequence = 0;

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
    var api = window.PixkuyHourlyAvailabilityPrecheck;

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

  function isHourlyTransactionalData(data) {
    return Boolean(
      data &&
      data.serviceType === "hourly_daily" &&
      (
        data.hourlyDailyMode === "hourly" ||
        data.hourlyDailyMode === "full_day"
      )
    );
  }
  
  function isDesktopViewport() {
    return !(
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }
  
  function hasRequiredHourlyCheckoutData(data) {
    return Boolean(
      data &&
      isHourlyTransactionalData(data) &&
      normalizeText(data.name) &&
      normalizeText(data.email) &&
      normalizeText(data.phone) &&
      normalizeText(data.hourlyDailyPickup) &&
      normalizeText(data.hourlyDailyDate) &&
      normalizeText(data.hourlyDailyStartTime) &&
      normalizeText(data.hourlyDailyDurationHours) &&
      normalizeText(data.hourlyDailyPrice)
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

  function parsePositiveInteger(value) {
    var normalized = normalizeText(value).replace(/[^\d]/g, "");
    var parsed = Number(normalized);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
      "pixkuy-checkout",
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

  function buildRequestSummary(data) {
    var parts = [];

    if (data.hourlyDailyMode) {
      parts.push("mode: " + data.hourlyDailyMode);
    }

    if (data.hourlyDailyPickup) {
      parts.push("pickup: " + data.hourlyDailyPickup);
    }

    if (data.hourlyDailyDate) {
      parts.push("date: " + data.hourlyDailyDate);
    }

    if (data.hourlyDailyStartTime) {
      parts.push("time: " + data.hourlyDailyStartTime);
    }

    if (data.hourlyDailyDurationHours) {
      parts.push("duration: " + data.hourlyDailyDurationHours + "h");
    }

    if (data.hourlyDailyPrice) {
      parts.push("price: " + data.hourlyDailyPrice + " " + data.hourlyDailyCurrency);
    }

    return parts.join(" | ");
  }

  function buildCheckoutPayload(form, data, recaptchaToken) {
    var amountMinor = parseMoneyMinorUnitsFromMxn(data.hourlyDailyPrice);
    var durationHours = parsePositiveInteger(data.hourlyDailyDurationHours);
    var payload;

    if (!amountMinor || !durationHours) {
      return null;
    }

    payload = {
      service_type: "hourly_daily",
      hourly_daily_mode: data.hourlyDailyMode,
      hourly_daily_pickup: data.hourlyDailyPickup,
      hourly_daily_date: data.hourlyDailyDate,
      hourly_daily_start_time: data.hourlyDailyStartTime,
      hourly_daily_duration_hours: durationHours,
      hourly_daily_passengers: DEFAULT_HOURLY_PASSENGERS,
      hourly_daily_price: amountMinor,
      hourly_daily_currency: "MXN",
      request_summary: getFieldValue(form, "request_summary") || buildRequestSummary(data),
      locale: getDocumentLocale(),
      customer: {
        full_name: data.name,
        email: data.email,
        phone: data.phone
      },
      form_payload_raw: getFormPayloadRaw(form)
    };

    addOptionalString(payload, "hourly_daily_pickup_place_id", data.hourlyDailyPickupPlaceId);
    addOptionalNumber(payload, "hourly_daily_pickup_lat", data.hourlyDailyPickupLat);
    addOptionalNumber(payload, "hourly_daily_pickup_lng", data.hourlyDailyPickupLng);
    addLegalAcceptanceFields(payload, form);

    if (normalizeText(recaptchaToken)) {
      payload.recaptchaToken = normalizeText(recaptchaToken);
    }

    return payload;
  }
  
  function buildAvailabilityPrecheckDetail(data) {
    return {
      serviceType: "hourly_daily",
      hourly_daily_mode: data.hourlyDailyMode,
      hourly_daily_vehicle_type: data.hourlyDailyVehicleType,
      hourly_daily_pickup: data.hourlyDailyPickup,
      hourly_daily_pickup_place_id: data.hourlyDailyPickupPlaceId,
      hourly_daily_pickup_lat: data.hourlyDailyPickupLat,
      hourly_daily_pickup_lng: data.hourlyDailyPickupLng,
      hourly_daily_date: data.hourlyDailyDate,
      hourly_daily_start_time: data.hourlyDailyStartTime,
      hourly_daily_duration_hours: data.hourlyDailyDurationHours,
      hourly_daily_price: data.hourlyDailyPrice,
      hourly_daily_currency: data.hourlyDailyCurrency || "MXN"
    };
  }
  
    function buildCheckoutReviewSnapshot(form, data) {
    var snapshot = getFormPayloadRaw(form);

    snapshot.name = data.name;
    snapshot.email = data.email;
    snapshot.phone = data.phone;
    snapshot.service_type = "hourly_daily";
    snapshot.hourly_daily_mode = data.hourlyDailyMode;
    snapshot.hourly_daily_pickup = data.hourlyDailyPickup;
    snapshot.hourly_daily_date = data.hourlyDailyDate;
    snapshot.hourly_daily_start_time = data.hourlyDailyStartTime;
    snapshot.hourly_daily_duration_hours = data.hourlyDailyDurationHours;
    snapshot.hourly_daily_price = data.hourlyDailyPrice;
    snapshot.hourly_daily_currency = data.hourlyDailyCurrency || "MXN";
    snapshot.hourly_daily_notes =
      data.hourlyDailyNotes ||
      getFieldValue(form, "hourly_daily_notes") ||
      getFieldValue(form, "message");
    snapshot.hourly_daily_pickup_place_id = data.hourlyDailyPickupPlaceId || "";
    snapshot.hourly_daily_pickup_lat = data.hourlyDailyPickupLat || "";
    snapshot.hourly_daily_pickup_lng = data.hourlyDailyPickupLng || "";
    snapshot.request_summary = getFieldValue(form, "request_summary") || buildRequestSummary(data);
    snapshot.locale = getDocumentLocale();
    snapshot.form_payload_raw = getFormPayloadRaw(form);

    addLegalAcceptanceFields(snapshot, form);

    return snapshot;
  }

  function redirectToCheckoutReview(form, data) {
    try {
      window.sessionStorage.setItem(
        HOURLY_CHECKOUT_REVIEW_STORAGE_KEY,
        JSON.stringify(buildCheckoutReviewSnapshot(form, data))
      );
    } catch (error) {
      return false;
    }

    window.location.assign(HOURLY_CHECKOUT_REVIEW_PATH);
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

  function setFormBusy(form, isBusy) {
    var buttons;

    if (!form) {
      return false;
    }

    buttons = Array.prototype.slice.call(
      form.querySelectorAll(
        'button[type="submit"], [data-hourly-mobile-contact-submit]'
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
  
    function getAvailabilityErrorMessage(result, requestedLocalDate) {
    var code = normalizeText(result && result.code);
    var suggestion = window.PixkuySharedAvailabilitySuggestion;
    var baseMessage = getI18nValue(
      "services.cards.hourly.panel.availability.unavailable",
      "No hay disponibilidad para esa fecha y hora. Elige otra opción."
    );
    var nextAvailableTemplate = getI18nValue(
      "services.cards.hourly.panel.availability.nextAvailableSlot",
      "Siguiente hora disponible: {time}"
    );

    if (code === "HOURLY_MINIMUM_LEAD_TIME_NOT_MET") {
      baseMessage = getI18nValue(
        "services.cards.hourly.panel.availability.minimumLeadTime",
        baseMessage
      );
    }

    if (code === "PRICE_MISMATCH") {
      baseMessage = getI18nValue(
        "services.cards.hourly.panel.availability.priceMismatch",
        baseMessage
      );
    }

    var description = suggestion && typeof suggestion.describe === "function"
      ? suggestion.describe(result, {
          requestedLocalDate: requestedLocalDate,
          locale: getDocumentLocale(),
          template: nextAvailableTemplate
        })
      : { message: "" };

    return [baseMessage, description.message].filter(Boolean).join(" ");
  }

  function focusHourlyDailyTimeField(fields) {
    var timeField = fields ? fields.hourlyDailyVisibleTime : null;

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
    var mobileApi;

    if (!form) {
      return false;
    }

    fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;

    message = getAvailabilityErrorMessage(
      result,
      getFieldValue(form, "hourly_daily_date")
    );

    showCheckoutMessage(form, message, "availability");

    if (isDesktopViewport()) {
      focusHourlyDailyTimeField(fields);
    } else {
      mobileApi = window.PixkuyHourlyMobileContactStep;

      if (mobileApi && typeof mobileApi.showAvailabilityError === "function") {
        mobileApi.showAvailabilityError(result || {}, message);
      }
    }

    return true;
  }

  function getMobileCheckoutErrorNode() {
    return document.querySelector(
      '[data-hourly-mobile-contact-step][aria-hidden="false"] [data-hourly-mobile-contact-global-error]'
    );
  }

  function showCheckoutMessage(form, message, category) {
    var fields;
    var mobileError;
    var normalizedCategory = normalizeText(category);

    if (!form || !normalizeText(message)) {
      return false;
    }

    fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;
    mobileError = getMobileCheckoutErrorNode();

    if (fields && fields.formError) {
      fields.formError.textContent = message;
      fields.formError.hidden = false;
      fields.formError.setAttribute(
        "data-hourly-checkout-error-category",
        normalizedCategory
      );
    }

    if (mobileError) {
      mobileError.textContent = message;
      mobileError.hidden = false;
      mobileError.setAttribute(
        "data-hourly-checkout-error-category",
        normalizedCategory
      );
    }

    form.setAttribute(
      "data-hourly-checkout-error-category",
      normalizedCategory
    );
    return true;
  }

  function showCheckoutError(form) {
    var message;

    if (!form) {
      return false;
    }

    message = getI18nValue(
      "contact.validation.formIncomplete",
      "Revisa los datos del formulario."
    );

    return showCheckoutMessage(form, message, "validation");
  }

  function normalizeCheckoutFieldName(value) {
    var normalizedValue = Array.isArray(value) ? value.join(".") : value;
    var normalized = normalizeText(normalizedValue)
      .replace(/\[(?:"|')?([^\]"']+)(?:"|')?\]/g, ".$1")
      .split(".")
      .filter(Boolean)
      .pop();

    if (normalized === "full_name") {
      return "name";
    }

    if (normalized === "hourly_daily_pickup") {
      return "pickup";
    }

    if (normalized === "hourly_daily_date") {
      return "date";
    }

    if (normalized === "hourly_daily_start_time") {
      return "time";
    }

    return ["name", "phone", "email", "pickup", "date", "time"]
      .indexOf(normalized) >= 0
        ? normalized
        : "";
  }

  function getFirstCheckoutFieldName(body) {
    var safeBody = body && typeof body === "object" ? body : {};
    var errors = safeBody.errors;
    var fieldErrors = safeBody.issues && safeBody.issues.fieldErrors;
    var candidate =
      normalizeCheckoutFieldName(safeBody.field) ||
      normalizeCheckoutFieldName(safeBody.fieldName);
    var errorKeys;

    if (candidate) {
      return candidate;
    }

    if (Array.isArray(errors)) {
      errors.some(function findFieldError(error) {
        candidate = normalizeCheckoutFieldName(
          error && (error.field || error.path || error.name)
        );
        return Boolean(candidate);
      });
    } else if (errors && typeof errors === "object") {
      errorKeys = Object.keys(errors);
      errorKeys.some(function findErrorKey(key) {
        candidate = normalizeCheckoutFieldName(key);
        return Boolean(candidate);
      });
    }

    if (!candidate && fieldErrors && typeof fieldErrors === "object") {
      Object.keys(fieldErrors).some(function findIssueField(key) {
        candidate = normalizeCheckoutFieldName(key);
        return Boolean(candidate);
      });
    }

    return candidate || "";
  }

  function getCheckoutFieldErrorMessage(fieldName) {
    var keyByField = {
      name: "contact.validation.nameRequired",
      phone: "contact.validation.phoneRequired",
      email: "contact.validation.emailRequired",
      pickup: "contact.validation.hourlyDailyPickupRequired",
      date: "contact.validation.hourlyDailyDateRequired",
      time: "contact.validation.hourlyDailyTimeRequired"
    };
    var messageKey = keyByField[fieldName];

    if (!messageKey) {
      return getI18nValue(
        "contact.validation.formIncomplete",
        "Revisa los datos del formulario."
      );
    }

    return getI18nValue(
      messageKey,
      getI18nValue(
        "contact.validation.formIncomplete",
        "Revisa los datos del formulario."
      )
    );
  }

  function showCheckoutFieldResponseError(form, body) {
    var fieldName = getFirstCheckoutFieldName(body);
    var message = getCheckoutFieldErrorMessage(fieldName);
    var mobileApi = window.PixkuyHourlyMobileContactStep;

    showCheckoutMessage(form, message, "validation");

    if (
      fieldName &&
      mobileApi &&
      typeof mobileApi.showFieldError === "function" &&
      mobileApi.showFieldError(fieldName, message)
    ) {
      return true;
    }

    return showCheckoutError(form);
  }

  function showCheckoutOperationalError(form, category) {
    var isNetworkError = category === "network";
    var message = isNetworkError
      ? getI18nValue(
          "bookingStatus.requestError.lead",
          "No pudimos conectar con Booking API. Inténtalo de nuevo en unos instantes."
        )
      : getI18nValue(
          "bookingStatus.checkout.notice",
          "No se ha podido abrir el pago. Inténtalo de nuevo o contacta con Pixkuy."
        );

    return showCheckoutMessage(form, message, category);
  }

  function getCheckoutResultCode(result) {
    return normalizeText(result && result.body && result.body.code);
  }

  function isCheckoutValidationResult(result) {
    var statusCode = Number(result && result.statusCode);
    var code = getCheckoutResultCode(result);
    var body = result && result.body;

    return Boolean(
      (statusCode === 400 || statusCode === 422) &&
      (
        code.indexOf("INVALID_") === 0 ||
        code === "LEGAL_ACCEPTANCE_REQUIRED" ||
        code === "LEGAL_ACCEPTANCE_INVALID" ||
        (body && body.issues) ||
        (body && body.errors) ||
        (body && (body.field || body.fieldName))
      )
    );
  }

  function isCheckoutAvailabilityResult(result) {
    var code = getCheckoutResultCode(result);

    return [
      "HOURLY_DURATION_BELOW_BASE_HOURS",
      "HOURLY_MINIMUM_LEAD_TIME_NOT_MET",
      "NO_COMPATIBLE_VEHICLE",
      "PRICE_MISMATCH",
      "VEHICLE_NOT_AVAILABLE"
    ].indexOf(code) >= 0;
  }

  function showCheckoutResultError(form, result) {
    var code = getCheckoutResultCode(result);

    if (isCheckoutValidationResult(result)) {
      return showCheckoutFieldResponseError(form, result.body);
    }

    if (isCheckoutAvailabilityResult(result)) {
      return showAvailabilityError(form, {
        code: code,
        nextAvailableStartLocal:
          result && result.body && result.body.nextAvailableStartLocal
      });
    }

    return showCheckoutOperationalError(
      form,
      code.indexOf("STRIPE") >= 0 ? "payment" : "server"
    );
  }

  function hideCheckoutError(form) {
    var fields =
      window.PixkuyForms &&
      typeof window.PixkuyForms.getReservationRequestFields === "function"
        ? window.PixkuyForms.getReservationRequestFields(form)
        : null;
    var mobileError = getMobileCheckoutErrorNode();

    if (fields && fields.formError) {
      fields.formError.hidden = true;
      fields.formError.removeAttribute("data-hourly-checkout-error-category");
    }

    if (mobileError) {
      mobileError.hidden = true;
      mobileError.removeAttribute("data-hourly-checkout-error-category");
    }

    if (form) {
      form.removeAttribute("data-hourly-checkout-error-category");
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
    host.setAttribute("data-hourly-checkout-legal-acceptance", "1");
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
      instance.checkbox.__pixkuyLegalAcceptanceSubmitBound === true
    ) {
      return false;
    }

    instance.checkbox.__pixkuyLegalAcceptanceSubmitBound = true;

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
      channel: "web_hourly_checkout",
      checkboxId: "pixkuy-hourly-legal-acceptance"
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
    isRequired = isHourlyTransactionalData(data);

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
        !hasRequiredHourlyCheckoutData(data)
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
      !hasRequiredHourlyCheckoutData(data) ||
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
  
  function verifyAvailabilityBeforeCheckout(data) {
    var precheckApi = getAvailabilityPrecheckApi();

    if (!precheckApi) {
      return Promise.resolve({
        available: false,
        code: "PRECHECK_UNAVAILABLE"
      });
    }

    return precheckApi.precheck(buildAvailabilityPrecheckDetail(data));
  }

  function isAvailabilityRequestFailure(result) {
    var code = normalizeText(result && result.code);

    return code === "PRECHECK_REQUEST_FAILED" || code === "PRECHECK_UNAVAILABLE";
  }

  function getAvailabilityPrecheckContextKey(data) {
    var detail = buildAvailabilityPrecheckDetail(data);

    return JSON.stringify([
      normalizeText(detail.serviceType),
      normalizeText(detail.hourly_daily_mode),
      normalizeText(detail.hourly_daily_vehicle_type),
      normalizeText(detail.hourly_daily_pickup),
      normalizeText(detail.hourly_daily_pickup_place_id),
      normalizeText(String(detail.hourly_daily_pickup_lat || "")),
      normalizeText(String(detail.hourly_daily_pickup_lng || "")),
      normalizeText(detail.hourly_daily_date),
      normalizeText(detail.hourly_daily_start_time),
      normalizeText(String(detail.hourly_daily_duration_hours || "")),
      normalizeText(String(detail.hourly_daily_price || "")),
      normalizeText(detail.hourly_daily_currency)
    ]);
  }

  function isCurrentAvailabilityPrecheck(form, requestId, contextKey) {
    var api = getReservationApi();
    var fields = api && form ? api.getReservationRequestFields(form) : null;
    var currentData = fields ? api.getReservationRequestData(fields) : null;

    return Boolean(
      requestId === availabilityPrecheckSequence &&
      currentData &&
      contextKey === getAvailabilityPrecheckContextKey(currentData)
    );
  }

  function isAvailabilityContextField(target) {
    var name = normalizeText(target && target.name);

    return [
      "service_type",
      "hourly_daily_mode",
      "hourly_daily_vehicle_type",
      "hourly_daily_pickup",
      "hourly_daily_pickup_place_id",
      "hourly_daily_pickup_lat",
      "hourly_daily_pickup_lng",
      "hourly_daily_date",
      "hourly_daily_start_time",
      "hourly_daily_duration_hours",
      "hourly_daily_price",
      "hourly_daily_currency"
    ].indexOf(name) >= 0;
  }

  function invalidateAvailabilityPrecheckForEvent(event) {
    if (isAvailabilityContextField(event && event.target)) {
      availabilityPrecheckSequence += 1;
    }
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
    var availabilityRequestId;
    var availabilityContextKey;

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

    if (!isHourlyTransactionalData(data)) {
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

    if (!hasRequiredHourlyCheckoutData(data)) {
      showCheckoutError(form);
      return;
    }

    if (!validateLegalAcceptance(form)) {
      return;
    }

    hideCheckoutError(form);

    if (isDesktopViewport()) {
      availabilityRequestId = availabilityPrecheckSequence + 1;
      availabilityPrecheckSequence = availabilityRequestId;
      availabilityContextKey = getAvailabilityPrecheckContextKey(data);
      setFormBusy(form, true);

      verifyAvailabilityBeforeCheckout(data)
        .then(function onAvailabilityPrecheckResult(result) {
          if (!isCurrentAvailabilityPrecheck(
            form,
            availabilityRequestId,
            availabilityContextKey
          )) {
            setFormBusy(form, false);
            return;
          }

          if (isAvailabilityRequestFailure(result)) {
            setFormBusy(form, false);
            showCheckoutOperationalError(form, "network");
            return;
          }

          if (!result || result.available !== true) {
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
          if (!isCurrentAvailabilityPrecheck(
            form,
            availabilityRequestId,
            availabilityContextKey
          )) {
            setFormBusy(form, false);
            return;
          }

          setFormBusy(form, false);
          showCheckoutOperationalError(form, "network");
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
          throw new Error("INVALID_HOURLY_CHECKOUT_PAYLOAD");
        }

        return requestCheckout({
          config: config,
          idempotencyKey: idempotencyKey,
          payload: payload
        });
      })
      .then(function (result) {
  var checkoutUrl = result && result.body ? result.body.checkoutUrl : "";
  var bookingStatusToken = result && result.body ? result.body.bookingStatusToken : "";

  if (!result.ok || !checkoutUrl || !bookingStatusToken) {
    setFormBusy(form, false);
    showCheckoutResultError(form, result);
    return;
  }

  if (!redirectToCheckout(checkoutUrl, bookingStatusToken)) {
    setFormBusy(form, false);
    showCheckoutOperationalError(form, "payment");
  }
})
      .catch(function (error) {
        setFormBusy(form, false);
        if (error && error.message === "INVALID_HOURLY_CHECKOUT_PAYLOAD") {
          showCheckoutError(form);
          return;
        }

        showCheckoutOperationalError(form, "network");
      });
  }

  function init() {
    var form = getForm();

    if (document.documentElement.dataset.hourlyBookingApiCheckoutBound === "1") {
      return false;
    }

    document.addEventListener("submit", handleSubmit, true);

    document.addEventListener("input", function onDocumentInput(event) {
      invalidateAvailabilityPrecheckForEvent(event);
      scheduleLegalAcceptanceVisibilitySync(getForm());
    }, true);

    document.addEventListener("change", function onDocumentChange(event) {
      invalidateAvailabilityPrecheckForEvent(event);
      scheduleLegalAcceptanceVisibilitySync(getForm());
    }, true);

    document.addEventListener("click", function onDocumentClick() {
      scheduleLegalAcceptanceVisibilitySync(getForm());
    }, true);

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      scheduleLegalAcceptanceVisibilitySync(getForm());
    });

    scheduleLegalAcceptanceVisibilitySync(form);

    document.documentElement.dataset.hourlyBookingApiCheckoutBound = "1";

    return true;
  }

  init();
})(window, document);
