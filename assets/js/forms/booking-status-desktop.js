/* assets/js/forms/booking-status-desktop.js
   Render desktop de booking-success.
   Responsabilidad:
   - pintar la vista desktop a partir de PixkuyBookingStatusState
   No consulta API.
   No gestiona móvil.
*/

(function initBookingStatusDesktop(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  function t(dictionary, path) {
    var parts = String(path || "").split(".");
    var cursor = dictionary;
    var index;

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor : "";
  }

  function getRoot() {
    return document.querySelector("[data-booking-status-desktop]");
  }

  function setText(root, selector, value) {
    var node = root ? root.querySelector(selector) : null;

    if (!node) {
      return false;
    }

    node.textContent = value || "";
    return true;
  }

  function setHidden(root, selector, hidden) {
    var node = root ? root.querySelector(selector) : null;

    if (!node) {
      return false;
    }

    node.hidden = Boolean(hidden);
    return true;
  }

  function showNotice(root, message, tone) {
    var notice = root ? root.querySelector("[data-booking-status-notice]") : null;

    if (!notice) {
      return false;
    }

    notice.textContent = message || "";
    notice.hidden = !message;
    notice.setAttribute("data-booking-status-tone", tone || "");

    return true;
  }

  function emptyValue(dictionary) {
    return t(dictionary, "details.empty") || "—";
  }

  function paymentLabel(dictionary, paymentStatus) {
    return t(dictionary, "paymentLabels." + paymentStatus) ||
      t(dictionary, "paymentLabels.notAvailable") ||
      emptyValue(dictionary);
  }
  
    function serviceLabel(dictionary, serviceType) {
    return t(dictionary, "serviceLabels." + serviceType) ||
      t(dictionary, "serviceLabels.notAvailable") ||
      emptyValue(dictionary);
  }

  function formatMoney(dictionary, amountMinor, currency) {
    var formatter;

    if (typeof amountMinor !== "number" || !currency) {
      return emptyValue(dictionary);
    }

    try {
      formatter = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 0
      });

      return formatter.format(amountMinor / 100) + " " + currency;
    } catch (error) {
      return String(amountMinor / 100) + " " + currency;
    }
  }

  function amountLabel(dictionary, result) {
    if (typeof result.paymentAmountPaid === "number") {
      return formatMoney(dictionary, result.paymentAmountPaid, result.paymentCurrency);
    }

    return formatMoney(dictionary, result.paymentAmountExpected, result.paymentCurrency);
  }
  
    function durationLabel(dictionary, value) {
    if (typeof value !== "number") {
      return emptyValue(dictionary);
    }

    if (value === 1) {
      return t(dictionary, "details.durationOneHour") || "1 hora";
    }

    return String(value) + " " + (t(dictionary, "details.durationHours") || "horas");
  }

  function passengerLabel(dictionary, value) {
    if (typeof value !== "number") {
      return emptyValue(dictionary);
    }

    if (value === 1) {
      return t(dictionary, "details.passengerOne") || "1 pasajero";
    }

    return String(value) + " " + (t(dictionary, "details.passengerMany") || "pasajeros");
  }

  function getCopyPath(view) {
    if (view === "missingToken") {
      return "missingToken";
    }

    if (view === "notFound") {
      return "notFound";
    }

    if (view === "requestError") {
      return "requestError";
    }

    if (view === "confirmed") {
      return "confirmed";
    }

    if (view === "pending") {
      return "pending";
    }

    if (view === "manualReview") {
      return "manualReview";
    }

    if (view === "expired") {
      return "expired";
    }

    return "unknown";
  }

  function getNotice(dictionary, result) {
    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_mismatch"
    ) {
      return t(dictionary, "manualReview.paymentMismatchNotice");
    }

    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_after_expiry"
    ) {
      return t(dictionary, "manualReview.paymentAfterExpiryNotice");
    }

    if (result.view === "manualReview") {
      return t(dictionary, "manualReview.defaultNotice");
    }

    return t(dictionary, getCopyPath(result.view) + ".notice");
  }

  function getTone(view) {
    if (view === "confirmed") {
      return "success";
    }

    if (view === "pending" || view === "manualReview") {
      return "warning";
    }

    return "error";
  }

  function renderDetails(root, dictionary, result) {
    setText(
      root,
      "[data-booking-status-public-code]",
      result.publicCode || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-service]",
      serviceLabel(dictionary, result.serviceType)
    );
    setText(
      root,
      "[data-booking-status-pickup]",
      result.pickupAddress || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-vehicle]",
      result.vehicleDisplayName || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-date]",
      result.serviceStartLocalDate || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-time]",
      result.serviceStartLocalTime || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-duration]",
      durationLabel(dictionary, result.durationHours)
    );
    setText(
      root,
      "[data-booking-status-passengers]",
      passengerLabel(dictionary, result.passengerCount)
    );
    setText(
      root,
      "[data-booking-status-payment]",
      paymentLabel(dictionary, result.paymentStatus)
    );
    setText(
      root,
      "[data-booking-status-amount]",
      amountLabel(dictionary, result)
    );
    setHidden(root, "[data-booking-status-details]", false);
  }

  function render(state) {
    var root = getRoot();
    var dictionary = state.dictionary;
    var result = state.result;
    var copyPath = getCopyPath(result.view);

    if (!root) {
      return false;
    }

    setText(root, "[data-booking-status-state]", t(dictionary, copyPath + ".state"));
    setText(root, "[data-booking-status-title]", t(dictionary, copyPath + ".title"));
    setText(root, "[data-booking-status-lead]", t(dictionary, copyPath + ".lead"));

    setText(root, '[data-booking-status-label="publicCode"]', t(dictionary, "details.publicCode"));
    setText(root, '[data-booking-status-label="service"]', t(dictionary, "details.service"));
    setText(root, '[data-booking-status-label="pickup"]', t(dictionary, "details.pickup"));
    setText(root, '[data-booking-status-label="vehicle"]', t(dictionary, "details.vehicle"));
    setText(root, '[data-booking-status-label="date"]', t(dictionary, "details.date"));
    setText(root, '[data-booking-status-label="time"]', t(dictionary, "details.time"));
    setText(root, '[data-booking-status-label="duration"]', t(dictionary, "details.duration"));
    setText(root, '[data-booking-status-label="passengers"]', t(dictionary, "details.passengers"));
    setText(root, '[data-booking-status-label="payment"]', t(dictionary, "details.payment"));
    setText(root, '[data-booking-status-label="amount"]', t(dictionary, "details.amount"));

    setText(root, "[data-booking-status-primary]", t(dictionary, "actions.primary"));
    setText(root, "[data-booking-status-whatsapp]", t(dictionary, "actions.whatsapp"));

    if (
      result.view === "missingToken" ||
      result.view === "notFound" ||
      result.view === "requestError"
    ) {
      setHidden(root, "[data-booking-status-details]", true);
    } else {
      renderDetails(root, dictionary, result);
    }

    showNotice(root, getNotice(dictionary, result), getTone(result.view));
    return true;
  }

  if (window.PixkuyBookingStatusState) {
    window.PixkuyBookingStatusState.onReady(render);
  }
})(window, document);