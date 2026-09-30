/* assets/js/analytics/booking-status-analytics.js
   Booking status analytics bridge.
   Responsabilidad:
   - escuchar el estado público ya resuelto de una reserva
   - medir reserva confirmada en GA4 mediante PixkuyAnalytics
   - no consultar Booking API
   - no pintar UI
   - no confirmar reservas
   - no tocar Stripe, webhook, Calendar ni Availability
*/

(function initBookingStatusAnalytics(window) {
  "use strict";

  if (!window) {
    return;
  }
  
  var lastConfirmedResult = null;
  var queuedAnalytics = Object.create(null);

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeAmount(value) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      return null;
    }

    return value / 100;
  }

  function normalizeCurrency(value) {
    var currency = normalizeText(value).toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : "";
  }

  function getAnalytics() {
    var analytics = window.PixkuyAnalytics;

    if (
      !analytics ||
      typeof analytics.trackOnce !== "function"
    ) {
      return null;
    }

    return analytics;
  }
  
  function getGoogleAdsConversions() {
    var conversions = window.PixkuyGoogleAdsConversions;

    if (
      !conversions ||
      typeof conversions.trackPaidReservationConversion !== "function"
    ) {
      return null;
    }

    return conversions;
  }


  function isConfirmedReservation(result) {
    return Boolean(
      result &&
        result.view === "confirmed" &&
        result.reservationStatus === "confirmed" &&
        result.paymentStatus === "paid" &&
        normalizeAmount(result.paymentAmountPaid) !== null &&
        normalizeCurrency(result.paymentCurrency)
    );
  }

  function buildPayload(result) {
    var value = normalizeAmount(result.paymentAmountPaid);
    var publicCode = normalizeText(result.publicCode);
    var payload = {
      transaction_id: publicCode,
      service_type: normalizeText(result.serviceType) || "unknown",
      public_code: publicCode,
      reservation_status: normalizeText(result.reservationStatus),
      payment_status: normalizeText(result.paymentStatus),
      currency: normalizeCurrency(result.paymentCurrency)
    };

    if (value !== null) {
      payload.value = value;
    }

    return payload;
  }

  function trackPaidReservationGoogleAdsConversion(payload, publicCode) {
    var googleAdsConversions = getGoogleAdsConversions();

    if (
      !googleAdsConversions ||
      typeof payload.value !== "number" ||
      !normalizeText(payload.currency)
    ) {
      return false;
    }

    return googleAdsConversions.trackPaidReservationConversion({
      transaction_id: publicCode,
      value: payload.value,
      currency: payload.currency
    });
  }

  function trackConfirmedReservation(result) {
    var analytics = getAnalytics();
    var publicCode = normalizeText(result && result.publicCode);
    var payload;
    var didTrack = false;

    if (!isConfirmedReservation(result) || !publicCode) {
      lastConfirmedResult = null;
      return false;
    }

    lastConfirmedResult = result;
    payload = buildPayload(result);

    if (analytics) {
      didTrack = queueAnalyticsOnce(analytics,
        "purchase",
        payload,
        publicCode
      ) || didTrack;

      didTrack = queueAnalyticsOnce(analytics,
        "pixkuy_booking_confirmed",
        payload,
        publicCode
      ) || didTrack;
    }

    didTrack = trackPaidReservationGoogleAdsConversion(payload, publicCode) || didTrack;

    return didTrack;
  }

  function queueAnalyticsOnce(analytics, eventName, payload, publicCode) {
    var key = "pixkuy_booking_analytics_queued:" + eventName + ":" + publicCode;
    if (queuedAnalytics[key]) return false;
    try {
      if (window.sessionStorage.getItem(key) === "queued") return false;
    } catch (error) {
      // In-memory deduplication still covers this page.
    }
    if (!analytics.trackOnce(eventName, payload, publicCode)) return false;
    queuedAnalytics[key] = true;
    try {
      window.sessionStorage.setItem(key, "queued");
    } catch (error) {
      // Queued is not an acknowledgement from Google.
    }
    return true;
  }

  function onBookingStatusReady(event) {
    var state = event && event.detail;
    var result = state && state.result;

    trackConfirmedReservation(result);
  }

  function onAnalyticsConsentReady() {
    if (!lastConfirmedResult) {
      return;
    }

    trackConfirmedReservation(lastConfirmedResult);
  }

  if (window.__pixkuyBookingStatusAnalyticsBound === true) {
    return;
  }

  window.__pixkuyBookingStatusAnalyticsBound = true;
  window.addEventListener("pixkuy:booking-status-ready", onBookingStatusReady);
  window.addEventListener("pixkuy:analytics-consent-ready", onAnalyticsConsentReady);
})(window);