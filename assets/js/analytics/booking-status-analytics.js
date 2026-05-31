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

  function trackConfirmedReservation(result) {
    var analytics = getAnalytics();
    var publicCode = normalizeText(result && result.publicCode);
    var payload;

    if (!analytics || !isConfirmedReservation(result) || !publicCode) {
      return false;
    }

    payload = buildPayload(result);

    analytics.trackOnce(
      "purchase",
      payload,
      publicCode
    );

    analytics.trackOnce(
      "pixkuy_booking_confirmed",
      payload,
      publicCode
    );

    return true;
  }

  function onBookingStatusReady(event) {
    var state = event && event.detail;
    var result = state && state.result;

    trackConfirmedReservation(result);
  }

  if (window.__pixkuyBookingStatusAnalyticsBound === true) {
    return;
  }

  window.__pixkuyBookingStatusAnalyticsBound = true;
  window.addEventListener("pixkuy:booking-status-ready", onBookingStatusReady);
})(window);