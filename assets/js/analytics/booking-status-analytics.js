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
        result.reservationStatus === "confirmed"
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
      return false;
    }

    lastConfirmedResult = result;
    payload = buildPayload(result);

    if (analytics) {
      didTrack = analytics.trackOnce(
        "purchase",
        payload,
        publicCode
      ) || didTrack;

      didTrack = analytics.trackOnce(
        "pixkuy_booking_confirmed",
        payload,
        publicCode
      ) || didTrack;
    }

    didTrack = trackPaidReservationGoogleAdsConversion(payload, publicCode) || didTrack;

    return didTrack;
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