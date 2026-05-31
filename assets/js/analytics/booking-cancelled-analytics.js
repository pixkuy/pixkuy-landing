/* assets/js/analytics/booking-cancelled-analytics.js
   Booking cancelled analytics bridge.
   Responsabilidad:
   - medir llegada a booking-cancelled
   - medir intención de retry checkout
   - medir retry exitoso/fallido envolviendo la API pública existente
   - no consultar Booking API directamente
   - no pintar UI
   - no confirmar reservas
   - no tocar Stripe, webhook, Calendar ni Availability
*/

(function initBookingCancelledAnalytics(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeAmount(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.round(value) / 100;
  }

  function normalizeCurrency(value) {
    return normalizeText(value).toUpperCase() || "MXN";
  }

  function getAnalytics() {
    var analytics = window.PixkuyAnalytics;

    if (
      !analytics ||
      typeof analytics.track !== "function" ||
      typeof analytics.trackOnce !== "function"
    ) {
      return null;
    }

    return analytics;
  }

  function canRetryCheckout(result) {
    return Boolean(
      result &&
        result.raw &&
        result.raw.actions &&
        result.raw.actions.canRetryCheckout === true
    );
  }

  function buildPayload(result) {
    var value = normalizeAmount(result && result.paymentAmountPaid);
    var expectedValue = normalizeAmount(result && result.paymentAmountExpected);
    var publicCode = normalizeText(result && result.publicCode);
    var payload = {
      transaction_id: publicCode,
      service_type: normalizeText(result && result.serviceType) || "unknown",
      public_code: publicCode,
      reservation_status: normalizeText(result && result.reservationStatus),
      booking_status_view: normalizeText(result && result.view),
      payment_status: normalizeText(result && result.paymentStatus),
      currency: normalizeCurrency(result && result.paymentCurrency),
      can_retry_checkout: canRetryCheckout(result)
    };

    if (value !== null) {
      payload.value = value;
    }

    if (expectedValue !== null) {
      payload.expected_value = expectedValue;
    }

    return payload;
  }

  function getDedupeKey(result, fallback) {
    return normalizeText(result && result.publicCode) ||
      normalizeText(result && result.raw && result.raw.publicCode) ||
      normalizeText(fallback);
  }

  function trackCancelledPage(state) {
    var analytics = getAnalytics();
    var result = state && state.result;
    var dedupeKey = getDedupeKey(result, state && state.token);

    if (!analytics || !result || !dedupeKey) {
      return false;
    }

    return analytics.trackOnce(
      "pixkuy_checkout_cancelled_page",
      buildPayload(result),
      dedupeKey
    );
  }

  function trackRetryClick(state) {
    var analytics = getAnalytics();
    var result = state && state.result;

    if (!analytics || !result) {
      return false;
    }

    return analytics.track(
      "pixkuy_checkout_retry_click",
      buildPayload(result)
    );
  }

  function trackRetrySuccess(state) {
    var analytics = getAnalytics();
    var result = state && state.result;

    if (!analytics || !result) {
      return false;
    }

    return analytics.track(
      "pixkuy_checkout_retry_success",
      buildPayload(result)
    );
  }

  function trackRetryError(state, error) {
    var analytics = getAnalytics();
    var result = state && state.result;
    var payload;

    if (!analytics || !result) {
      return false;
    }

    payload = buildPayload(result);
    payload.error_code = normalizeText(error && error.message) || "retry_error";

    return analytics.track(
      "pixkuy_checkout_retry_error",
      payload
    );
  }

  function wrapRetryApi(state) {
    var retryApi = window.PixkuyBookingCancelledRetry;
    var originalRetry;

    if (
      !retryApi ||
      typeof retryApi.retry !== "function" ||
      retryApi.__pixkuyCancelledAnalyticsWrapped === true
    ) {
      return false;
    }

    originalRetry = retryApi.retry;

    retryApi.retry = function retryWithAnalytics(token) {
      trackRetryClick(state);

      return originalRetry.call(retryApi, token)
        .then(function onRetrySuccess(result) {
          trackRetrySuccess(state);
          return result;
        })
        .catch(function onRetryError(error) {
          trackRetryError(state, error);
          throw error;
        });
    };

    retryApi.__pixkuyCancelledAnalyticsWrapped = true;
    return true;
  }

  function onBookingStatusReady(event) {
    var state = event && event.detail;

    trackCancelledPage(state);
    wrapRetryApi(state);
  }

  if (window.__pixkuyBookingCancelledAnalyticsBound === true) {
    return;
  }

  window.__pixkuyBookingCancelledAnalyticsBound = true;
  window.addEventListener("pixkuy:booking-status-ready", onBookingStatusReady);
})(window, document);