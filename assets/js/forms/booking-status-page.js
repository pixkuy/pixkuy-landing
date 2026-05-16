/* assets/js/forms/booking-status-page.js
   Página pública de estado Booking API.
   Responsabilidad:
   - cargar textos desde diccionario i18n local
   - leer token público de la URL
   - consultar estado público de reserva
   - pintar estado de booking-success
   No hace:
   - confirmar reservas
   - reintentar checkout
   - enviar emails
   - tocar Netlify Forms
   - tocar modal legacy
*/

(function initBookingStatusPage(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var STATUS_ENDPOINT = "/v1/public/reservations/status";
  var I18N_BASE = "/assets/i18n";
  var FALLBACK_LANG = "es";

  var dictionary = null;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeLangCode(value) {
    var normalized = normalizeText(value).toLowerCase().replace(/_/g, "-");

    if (normalized === "zh-cn" || normalized === "zh_hans" || normalized === "zh-hans-cn") {
      return "zh-hans";
    }

    if (normalized.indexOf("-") > -1) {
      return normalized.split("-")[0];
    }

    return normalized || FALLBACK_LANG;
  }

  function getActiveLang() {
    var params;
    var fromUrl;
    var fromStorage;
    var fromNavigator;

    try {
      params = new URLSearchParams(window.location.search);
      fromUrl = normalizeLangCode(params.get("lang"));
      if (fromUrl) {
        return fromUrl;
      }
    } catch (error) {
      // no-op
    }

    try {
      fromStorage = normalizeLangCode(window.localStorage.getItem("lang"));
      if (fromStorage) {
        return fromStorage;
      }
    } catch (error) {
      // no-op
    }

    fromNavigator = normalizeLangCode(window.navigator && window.navigator.language);
    return fromNavigator || FALLBACK_LANG;
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

  function buildStatusUrl(config, token) {
    var base = config.apiBaseUrl.replace(/\/+$/, "");
    var query = "?token=" + encodeURIComponent(token);

    return base + STATUS_ENDPOINT + query;
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

  function loadDictionary() {
    var lang = getActiveLang();

    return fetchJson(buildI18nUrl(lang))
      .catch(function () {
        if (lang === FALLBACK_LANG) {
          throw new Error("BOOKING_STATUS_I18N_NOT_AVAILABLE");
        }

        return fetchJson(buildI18nUrl(FALLBACK_LANG));
      })
      .then(function (dict) {
        dictionary = dict && dict.bookingStatus ? dict.bookingStatus : null;

        if (!dictionary) {
          throw new Error("BOOKING_STATUS_I18N_INVALID");
        }

        document.documentElement.lang = lang;
        document.documentElement.removeAttribute("data-booking-status-i18n");

        return dictionary;
      });
  }

  function t(path) {
    var parts = String(path || "").split(".");
    var cursor = dictionary;
    var index;

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor : "";
  }

  function emptyValue() {
    return t("details.empty") || "";
  }

  function getNode(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    var node = getNode(selector);

    if (!node) {
      return false;
    }

    node.textContent = value || "";
    return true;
  }

  function setHidden(selector, hidden) {
    var node = getNode(selector);

    if (!node) {
      return false;
    }

    node.hidden = Boolean(hidden);
    return true;
  }

  function showNotice(message, tone) {
    var notice = getNode("[data-booking-status-notice]");

    if (!notice) {
      return false;
    }

    notice.textContent = message || "";
    notice.hidden = !message;
    notice.setAttribute("data-booking-status-tone", tone || "");

    return true;
  }

  function syncStaticCopy() {
    var title = t("meta.successTitle");

    if (title) {
      document.title = title;
    }

    setText("[data-booking-status-state]", t("loading.state"));
    setText("[data-booking-status-title]", t("loading.title"));
    setText("[data-booking-status-lead]", t("loading.lead"));

    setText('[data-booking-status-label="publicCode"]', t("details.publicCode"));
    setText('[data-booking-status-label="payment"]', t("details.payment"));
    setText('[data-booking-status-label="date"]', t("details.date"));
    setText('[data-booking-status-label="time"]', t("details.time"));

    setText("[data-booking-status-public-code]", emptyValue());
    setText("[data-booking-status-payment]", emptyValue());
    setText("[data-booking-status-date]", emptyValue());
    setText("[data-booking-status-time]", emptyValue());

    setText("[data-booking-status-primary]", t("actions.primary"));
    setText("[data-booking-status-whatsapp]", t("actions.whatsapp"));
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

  function getServiceStartLocalTime(body) {
    if (body && body.reservation && typeof body.reservation.serviceStartLocalTime === "string") {
      return body.reservation.serviceStartLocalTime;
    }

    if (body && typeof body.serviceStartLocalTime === "string") {
      return body.serviceStartLocalTime;
    }

    return "";
  }

  function formatStatusLabel(status) {
    var normalized = normalizeText(status);
    var label = t("paymentLabels." + normalized);

    return label || t("paymentLabels.notAvailable") || emptyValue();
  }

  function renderDetails(body) {
    setText("[data-booking-status-public-code]", getPublicCode(body) || emptyValue());
    setText("[data-booking-status-payment]", formatStatusLabel(getPaymentStatus(body)));
    setText("[data-booking-status-date]", getServiceStartLocalDate(body) || emptyValue());
    setText("[data-booking-status-time]", getServiceStartLocalTime(body) || emptyValue());
    setHidden("[data-booking-status-details]", false);
  }

  function renderConfirmed(body) {
    setText("[data-booking-status-state]", t("confirmed.state"));
    setText("[data-booking-status-title]", t("confirmed.title"));
    setText("[data-booking-status-lead]", t("confirmed.lead"));

    renderDetails(body);
    showNotice(t("confirmed.notice"), "success");
  }

  function renderPending(body) {
    setText("[data-booking-status-state]", t("pending.state"));
    setText("[data-booking-status-title]", t("pending.title"));
    setText("[data-booking-status-lead]", t("pending.lead"));

    renderDetails(body);
    showNotice(t("pending.notice"), "warning");
  }

  function renderManualReview(body, status) {
    setText("[data-booking-status-state]", t("manualReview.state"));
    setText("[data-booking-status-title]", t("manualReview.title"));
    setText("[data-booking-status-lead]", t("manualReview.lead"));

    renderDetails(body);

    if (status === "payment_mismatch") {
      showNotice(t("manualReview.paymentMismatchNotice"), "warning");
      return;
    }

    if (status === "payment_after_expiry") {
      showNotice(t("manualReview.paymentAfterExpiryNotice"), "warning");
      return;
    }

    showNotice(t("manualReview.defaultNotice"), "warning");
  }

  function renderExpired(body) {
    setText("[data-booking-status-state]", t("expired.state"));
    setText("[data-booking-status-title]", t("expired.title"));
    setText("[data-booking-status-lead]", t("expired.lead"));

    renderDetails(body);
    showNotice(t("expired.notice"), "error");
  }

  function renderUnknown(body) {
    setText("[data-booking-status-state]", t("unknown.state"));
    setText("[data-booking-status-title]", t("unknown.title"));
    setText("[data-booking-status-lead]", t("unknown.lead"));

    renderDetails(body);
    showNotice(t("unknown.notice"), "error");
  }

  function renderStatus(body) {
    var status = getReservationStatus(body);

    if (status === "confirmed") {
      renderConfirmed(body);
      return;
    }

    if (status === "pending_payment") {
      renderPending(body);
      return;
    }

    if (status === "payment_mismatch" || status === "payment_after_expiry") {
      renderManualReview(body, status);
      return;
    }

    if (status === "hold_expired") {
      renderExpired(body);
      return;
    }

    renderUnknown(body);
  }

  function renderMissingToken() {
    setText("[data-booking-status-state]", t("missingToken.state"));
    setText("[data-booking-status-title]", t("missingToken.title"));
    setText("[data-booking-status-lead]", t("missingToken.lead"));
    setHidden("[data-booking-status-details]", true);
    showNotice(t("missingToken.notice"), "error");
  }

  function renderNotFound() {
    setText("[data-booking-status-state]", t("notFound.state"));
    setText("[data-booking-status-title]", t("notFound.title"));
    setText("[data-booking-status-lead]", t("notFound.lead"));
    setHidden("[data-booking-status-details]", true);
    showNotice(t("notFound.notice"), "error");
  }

  function renderRequestError() {
    setText("[data-booking-status-state]", t("requestError.state"));
    setText("[data-booking-status-title]", t("requestError.title"));
    setText("[data-booking-status-lead]", t("requestError.lead"));
    setHidden("[data-booking-status-details]", true);
    showNotice(t("requestError.notice"), "error");
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

  function runStatusFlow() {
    var token = getToken();
    var config;

    if (!token) {
      renderMissingToken();
      return false;
    }

    config = getConfig();

    requestStatus(config, token)
      .then(function (result) {
        if (result.statusCode === 404) {
          renderNotFound();
          return;
        }

        if (!result.ok) {
          renderRequestError();
          return;
        }

        renderStatus(result.body);
      })
      .catch(function () {
        renderRequestError();
      });

    return true;
  }

  function init() {
    loadDictionary()
      .then(function () {
        syncStaticCopy();
        runStatusFlow();
      })
      .catch(function () {
        document.documentElement.removeAttribute("data-booking-status-i18n");
      });

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);