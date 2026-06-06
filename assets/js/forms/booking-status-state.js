/* assets/js/forms/booking-status-state.js
   Estado público Booking API.
   Responsabilidad:
   - cargar diccionario local
   - leer token público
   - consultar Booking API
   - normalizar estado
   No pinta UI.
*/

(function initBookingStatusState(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var STATUS_ENDPOINT = "/v1/public/reservations/status";
  var I18N_BASE = "/assets/i18n";
  var FALLBACK_LANG = "es";

  var readyCallbacks = [];
  var currentState = null;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeLangCode(value) {
    var normalized = normalizeText(value).toLowerCase().replace(/_/g, "-");

    if (
      normalized === "zh-hans" ||
      normalized === "zh-cn" ||
      normalized === "zh-hans-cn"
    ) {
      return "zh-hans";
    }

    if (normalized.indexOf("-") > -1) {
      return normalized.split("-")[0];
    }

    return normalized || FALLBACK_LANG;
  }

  function getActiveLang() {
    var params;
    var langParam;
    var storedLang;
    var fromUrl;
    var fromStorage;

    try {
      params = new URLSearchParams(window.location.search);
      langParam = normalizeText(params.get("lang"));

      if (langParam) {
        fromUrl = normalizeLangCode(langParam);

        if (fromUrl) {
          return fromUrl;
        }
      }
    } catch (error) {
      // no-op
    }

    try {
      storedLang = normalizeText(window.localStorage.getItem("lang"));

      if (storedLang) {
        fromStorage = normalizeLangCode(storedLang);

        if (fromStorage) {
          return fromStorage;
        }
      }
    } catch (error) {
      // no-op
    }

    return normalizeLangCode(window.navigator && window.navigator.language) || FALLBACK_LANG;
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_STATUS_CONFIG;
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

  function getToken() {
    var params;

    try {
      params = new URLSearchParams(window.location.search);
      return normalizeText(params.get("token"));
    } catch (error) {
      return "";
    }
  }

  function buildI18nUrl(lang) {
    return [
      I18N_BASE,
      encodeURIComponent(lang),
      "booking-status.json"
    ].join("/");
  }

  function fetchJson(url) {
    return window.fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP_" + response.status);
      }

      return response.json();
    });
  }

  function loadDictionary(preferredLang) {
    return fetchJson(buildI18nUrl(preferredLang))
      .then(function (dict) {
        return {
          lang: preferredLang,
          dict: dict
        };
      })
      .catch(function () {
        if (preferredLang === FALLBACK_LANG) {
          throw new Error("BOOKING_STATUS_I18N_NOT_AVAILABLE");
        }

        return fetchJson(buildI18nUrl(FALLBACK_LANG)).then(function (dict) {
          return {
            lang: FALLBACK_LANG,
            dict: dict
          };
        });
      })
      .then(function (result) {
        if (!result.dict || !result.dict.bookingStatus) {
          throw new Error("BOOKING_STATUS_I18N_INVALID");
        }

        return {
          lang: result.lang,
          dictionary: result.dict.bookingStatus
        };
      });
  }

  function buildStatusUrl(config, token) {
    return config.apiBaseUrl.replace(/\/+$/, "") +
      STATUS_ENDPOINT +
      "?token=" +
      encodeURIComponent(token);
  }

  function requestStatus(config, token) {
    return window.fetch(buildStatusUrl(config, token), {
      method: "GET",
      headers: {
        "X-Pixkuy-Site-Key": config.publicSiteKey
      }
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

  function getReservationStatus(body) {
    if (body && body.reservation && typeof body.reservation.status === "string") {
      return body.reservation.status;
    }

    if (body && typeof body.reservationStatus === "string") {
      return body.reservationStatus;
    }

    if (body && typeof body.status === "string") {
      return body.status;
    }

    return "";
  }

  function getPaymentStatus(body) {
    if (body && body.payment && typeof body.payment.status === "string") {
      return body.payment.status;
    }

    if (body && typeof body.paymentStatus === "string") {
      return body.paymentStatus;
    }

    return "";
  }
  
    function getServiceType(body) {
    if (body && body.reservation && typeof body.reservation.serviceType === "string") {
      return body.reservation.serviceType;
    }

    if (body && typeof body.serviceType === "string") {
      return body.serviceType;
    }

    return "";
  }

  function getPaymentAmountPaid(body) {
    if (body && body.payment && typeof body.payment.amountPaid === "number") {
      return body.payment.amountPaid;
    }

    return null;
  }

  function getPaymentAmountExpected(body) {
    if (body && body.payment && typeof body.payment.amountExpected === "number") {
      return body.payment.amountExpected;
    }

    return null;
  }

  function getPaymentCurrency(body) {
    if (body && body.payment && typeof body.payment.currency === "string") {
      return body.payment.currency;
    }

    return "";
  }

  function getPublicCode(body) {
    if (body && body.reservation && typeof body.reservation.publicCode === "string") {
      return body.reservation.publicCode;
    }

    if (body && typeof body.publicCode === "string") {
      return body.publicCode;
    }

    return "";
  }

  function getServiceStartLocalDate(body) {
    if (body && body.reservation && typeof body.reservation.serviceStartLocalDate === "string") {
      return body.reservation.serviceStartLocalDate;
    }

    if (body && typeof body.serviceStartLocalDate === "string") {
      return body.serviceStartLocalDate;
    }

    return "";
  }
  
    function getPickupAddress(body) {
    if (body && body.reservation && typeof body.reservation.pickupAddress === "string") {
      return body.reservation.pickupAddress;
    }

    return "";
  }
  
  function getDestinationAddress(body) {
    if (body && body.reservation && typeof body.reservation.destinationAddress === "string") {
      return body.reservation.destinationAddress;
    }

    return "";
  }

  function getDurationHours(body) {
    if (body && body.reservation && typeof body.reservation.durationHours === "number") {
      return body.reservation.durationHours;
    }

    return null;
  }

  function getPassengerCount(body) {
    if (body && body.reservation && typeof body.reservation.passengerCount === "number") {
      return body.reservation.passengerCount;
    }

    return null;
  }
  
  function getPassengerLabel(body) {
    if (body && body.reservation && typeof body.reservation.passengerLabel === "string") {
      return body.reservation.passengerLabel;
    }

    return "";
  }
  
  function getLuggageCount(body) {
    if (body && body.reservation && typeof body.reservation.luggageCount === "number") {
      return body.reservation.luggageCount;
    }

    return null;
  }

  function getVehicleDisplayName(body) {
    if (body && body.reservation && typeof body.reservation.vehicleDisplayName === "string") {
      return body.reservation.vehicleDisplayName;
    }

    return "";
  }
  
    function getCustomerFullName(body) {
    if (body && body.customer && typeof body.customer.fullName === "string") {
      return body.customer.fullName;
    }

    return "";
  }

  function getCustomerEmail(body) {
    if (body && body.customer && typeof body.customer.email === "string") {
      return body.customer.email;
    }

    return "";
  }

  function getCustomerPhone(body) {
    if (body && body.customer && typeof body.customer.phone === "string") {
      return body.customer.phone;
    }

    return "";
  }

  function getServiceStartLocalTime(body) {
    if (body && body.reservation && typeof body.reservation.serviceStartLocalTime === "string") {
      return body.reservation.serviceStartLocalTime;
    }

    if (body && typeof body.serviceStartLocalTime === "string") {
      return body.serviceStartLocalTime;
    }

    return "";
  }

  function resolveView(status, statusCode, ok) {
    if (statusCode === 404) {
      return "notFound";
    }

    if (statusCode === 410) {
      return "expired";
    }

    if (!ok) {
      return "requestError";
    }

    if (status === "confirmed") {
      return "confirmed";
    }

    if (status === "pending_payment") {
      return "pending";
    }

    if (status === "payment_mismatch" || status === "payment_after_expiry") {
      return "manualReview";
    }

    if (status === "hold_expired") {
      return "expired";
    }

    if (status === "cancelled_manual") {
      return "cancelled";
    }

    return "unknown";
  }

  function normalizeResult(input) {
    var body = input.body || {};
    var reservationStatus = getReservationStatus(body);

    return {
      view: resolveView(reservationStatus, input.statusCode, input.ok),
      reservationStatus: reservationStatus,
      paymentStatus: getPaymentStatus(body),
      serviceType: getServiceType(body),
      paymentAmountPaid: getPaymentAmountPaid(body),
      paymentAmountExpected: getPaymentAmountExpected(body),
      paymentCurrency: getPaymentCurrency(body),
      publicCode: getPublicCode(body),
      serviceStartLocalDate: getServiceStartLocalDate(body),
      serviceStartLocalTime: getServiceStartLocalTime(body),
      pickupAddress: getPickupAddress(body),
      destinationAddress: getDestinationAddress(body),
      durationHours: getDurationHours(body),
      passengerCount: getPassengerCount(body),
      passengerLabel: getPassengerLabel(body),
      luggageCount: getLuggageCount(body),
      vehicleDisplayName: getVehicleDisplayName(body),
      customerFullName: getCustomerFullName(body),
      customerEmail: getCustomerEmail(body),
      customerPhone: getCustomerPhone(body),
      raw: body
    };
  }

  function notifyReady(state) {
    currentState = state;

    readyCallbacks.forEach(function (callback) {
      callback(state);
    });

    window.dispatchEvent(new CustomEvent("pixkuy:booking-status-ready", {
      detail: state
    }));
  }

  function onReady(callback) {
    if (typeof callback !== "function") {
      return false;
    }

    if (currentState) {
      callback(currentState);
      return true;
    }

    readyCallbacks.push(callback);
    return true;
  }

  function buildMissingTokenResult() {
    return {
      view: "missingToken",
      reservationStatus: "",
      paymentStatus: "",
      serviceType: "",
      paymentAmountPaid: null,
      paymentAmountExpected: null,
      paymentCurrency: "",
      publicCode: "",
      serviceStartLocalDate: "",
      serviceStartLocalTime: "",
      pickupAddress: "",
      destinationAddress: "",
      durationHours: null,
      passengerCount: null,
      passengerLabel: "",
      luggageCount: null,
      vehicleDisplayName: "",
      customerFullName: "",
      customerEmail: "",
      customerPhone: "",
      raw: {}
    };
  }

  function buildRequestErrorResult() {
    return {
      view: "requestError",
      reservationStatus: "",
      paymentStatus: "",
      serviceType: "",
      paymentAmountPaid: null,
      paymentAmountExpected: null,
      paymentCurrency: "",
      publicCode: "",
      serviceStartLocalDate: "",
      serviceStartLocalTime: "",
      pickupAddress: "",
      destinationAddress: "",
      durationHours: null,
      passengerCount: null,
      passengerLabel: "",
      luggageCount: null,
      vehicleDisplayName: "",
      customerFullName: "",
      customerEmail: "",
      customerPhone: "",
      raw: {}
    };
  }

  function init() {
    var preferredLang = getActiveLang();
    var token = getToken();

    loadDictionary(preferredLang)
      .then(function (loaded) {
        var baseState = {
          lang: loaded.lang,
          dictionary: loaded.dictionary,
          token: token,
          result: null
        };

        document.documentElement.lang = loaded.lang;
        document.documentElement.removeAttribute("data-booking-status-i18n");

        if (loaded.dictionary.meta && loaded.dictionary.meta.successTitle) {
          document.title = loaded.dictionary.meta.successTitle;
        }

        if (!token) {
          notifyReady(Object.assign({}, baseState, {
            result: buildMissingTokenResult()
          }));
          return;
        }

        waitForPublicConfigReady()
          .then(function requestStatusAfterPublicConfig() {
            return requestStatus(getConfig(), token);
          })
          .then(function (result) {
            notifyReady(Object.assign({}, baseState, {
              result: normalizeResult(result)
            }));
          })
          .catch(function () {
            notifyReady(Object.assign({}, baseState, {
              result: buildRequestErrorResult()
            }));
          });
      })
      .catch(function () {
        document.documentElement.removeAttribute("data-booking-status-i18n");
      });
  }

  window.PixkuyBookingStatusState = {
    onReady: onReady
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);