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

    if (normalizeText(recaptchaToken)) {
      payload.recaptchaToken = normalizeText(recaptchaToken);
    }

    return payload;
  }

  function getRecaptchaToken(config) {
    var grecaptcha = window.grecaptcha;

    if (!config.recaptchaSiteKey) {
      return Promise.resolve("");
    }

    if (
      !grecaptcha ||
      !grecaptcha.enterprise ||
      typeof grecaptcha.enterprise.execute !== "function"
    ) {
      return Promise.resolve("");
    }

    return grecaptcha.enterprise.execute(config.recaptchaSiteKey, {
      action: RECAPTCHA_ACTION
    }).then(function (token) {
      return normalizeText(token);
    }).catch(function () {
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

  function showCheckoutError(form) {
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

    message = getI18nValue(
      "contact.validation.formIncomplete",
      "Revisa los datos del formulario."
    );

    if (fields && fields.formError) {
      fields.formError.textContent = message;
      fields.formError.hidden = false;
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

    if (!api.refreshReservationRequestValidationUX(fields)) {      
      return;
    }

    hideCheckoutError(form);
    setFormBusy(form, true);

    config = getConfig();
    idempotencyKey = createIdempotencyKey();

    getRecaptchaToken(config)
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
      .catch(function (error) {        
        setFormBusy(form, false);
        showCheckoutError(form);
      });
  }

  function init() {
    if (document.documentElement.dataset.hourlyBookingApiCheckoutBound === "1") {
      return false;
    }

    document.addEventListener("submit", handleSubmit, true);
    document.documentElement.dataset.hourlyBookingApiCheckoutBound = "1";

    return true;
  }

  init();
})(window, document);