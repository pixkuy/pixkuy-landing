/* assets/js/forms/booking-cancelled-desktop.js
   Render desktop de booking-cancelled.
   Responsabilidad:
   - pintar la vista desktop a partir de PixkuyBookingStatusState
   - mostrar retry solo si Booking API lo permite
   No consulta status.
   No gestiona móvil.
   No confirma reservas.
*/

(function initBookingCancelledDesktop(window, document) {
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

  function tFallback(dictionary, primaryPath, fallbackPath) {
    return t(dictionary, primaryPath) || t(dictionary, fallbackPath);
  }

  function getRoot() {
    return document.querySelector("[data-booking-cancelled-desktop]");
  }

  function setText(root, selector, value) {
    var node = root ? root.querySelector(selector) : null;

    if (!node) {
      return false;
    }

    node.textContent = value || "";
    return true;
  }

  function setNodeText(node, value) {
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

  function passengerLabel(dictionary, result) {
    if (result && result.passengerLabel) {
      return result.passengerLabel;
    }

    if (!result || typeof result.passengerCount !== "number") {
      return emptyValue(dictionary);
    }

    if (result.passengerCount === 1) {
      return t(dictionary, "details.passengerOne") || "1 pasajero";
    }

    return String(result.passengerCount) + " " + (t(dictionary, "details.passengerMany") || "pasajeros");
  }
  
    function getVehicleThumbnailSrc(vehicleDisplayName) {
    var normalized = String(vehicleDisplayName || "").toLowerCase();

    if (normalized.indexOf("byd m9") > -1 || normalized.indexOf("m9") > -1) {
      return "assets/img/fleet/bydm9_xhoras001d.jpeg";
    }

    return "";
  }

  function syncVehicleThumbnail(root, result) {
    var vehicleNode = root ? root.querySelector("[data-booking-status-vehicle]") : null;
    var existing;
    var src;
    var image;
    var name;

    if (!vehicleNode) {
      return false;
    }

    existing = vehicleNode.querySelector("[data-booking-status-vehicle-thumb]");

    if (existing) {
      existing.remove();
    }

    vehicleNode.classList.remove("booking-status__vehicle-value");

    if (!result || !result.vehicleDisplayName) {
      return false;
    }

    name = document.createElement("span");
    name.className = "booking-status__vehicle-name";
    name.textContent = result.vehicleDisplayName;

    vehicleNode.textContent = "";
    vehicleNode.appendChild(name);

    src = getVehicleThumbnailSrc(result.vehicleDisplayName);

    if (!src) {
      return false;
    }

    image = document.createElement("img");
    image.className = "booking-status__vehicle-thumb";
    image.setAttribute("data-booking-status-vehicle-thumb", "1");
    image.setAttribute("src", src);
    image.setAttribute("alt", "");
    image.setAttribute("aria-hidden", "true");
    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");

    vehicleNode.classList.add("booking-status__vehicle-value");
    vehicleNode.appendChild(image);

    return true;
  }

  function getCommonCopyPath(view) {
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

    if (view === "cancelled") {
      return "cancelled";
    }

    return "unknown";
  }

  function getCancelledCopyPath(view) {
    return "cancelled." + getCommonCopyPath(view);
  }

  function getCopy(dictionary, view, key) {
    return tFallback(
      dictionary,
      getCancelledCopyPath(view) + "." + key,
      getCommonCopyPath(view) + "." + key
    );
  }

  function getNotice(dictionary, result) {
    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_mismatch"
    ) {
      return tFallback(
        dictionary,
        "cancelled.manualReview.paymentMismatchNotice",
        "manualReview.paymentMismatchNotice"
      );
    }

    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_after_expiry"
    ) {
      return tFallback(
        dictionary,
        "cancelled.manualReview.paymentAfterExpiryNotice",
        "manualReview.paymentAfterExpiryNotice"
      );
    }

    if (result.view === "manualReview") {
      return tFallback(
        dictionary,
        "cancelled.manualReview.defaultNotice",
        "manualReview.defaultNotice"
      );
    }

    return getCopy(dictionary, result.view, "notice");
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

  function canRetryCheckout(result) {
  return Boolean(
    result &&
    result.view === "pending" &&
    result.raw &&
    result.raw.actions &&
    result.raw.actions.canRetryCheckout === true
  );
}

  function hasCustomerDetails(result) {
    return Boolean(
      result &&
      (
        result.customerFullName ||
        result.customerPhone ||
        result.customerEmail
      )
    );
  }

  function syncCustomerDetailsVisibility(root, result) {
    var isVisible = hasCustomerDetails(result);

    setHidden(root, ".booking-status__detail--customer-name", !isVisible);
    setHidden(root, ".booking-status__detail--customer-phone", !isVisible);
    setHidden(root, ".booking-status__detail--customer-email", !isVisible);

    return true;
  }

  function hasRenderableReservationDetails(result) {
    return Boolean(
      result &&
      (
        result.publicCode ||
        result.pickupAddress ||
        result.vehicleDisplayName ||
        result.serviceStartLocalDate ||
        result.serviceStartLocalTime ||
        typeof result.durationHours === "number" ||
        typeof result.passengerCount === "number" ||
        typeof result.paymentAmountPaid === "number" ||
        typeof result.paymentAmountExpected === "number" ||
        result.customerFullName ||
        result.customerPhone ||
        result.customerEmail
      )
    );
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
      "[data-booking-status-destination]",
      result.destinationAddress || emptyValue(dictionary)
    );
    setHidden(
      root,
      ".booking-status__detail--destination",
      !result.destinationAddress
    );
    setText(
      root,
      "[data-booking-status-vehicle]",
      result.vehicleDisplayName || emptyValue(dictionary)
    );
    syncVehicleThumbnail(root, result);
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
      passengerLabel(dictionary, result)
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
    setText(
      root,
      "[data-booking-status-customer-name]",
      result.customerFullName || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-customer-phone]",
      result.customerPhone || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-customer-email]",
      result.customerEmail || emptyValue(dictionary)
    );
    syncCustomerDetailsVisibility(root, result);
    setHidden(root, "[data-booking-status-details]", false);
  }

  function setActionVisible(node, isVisible) {
  if (!node) {
    return false;
  }

  node.hidden = !isVisible;
  node.style.display = isVisible ? "" : "none";
  node.setAttribute("aria-hidden", isVisible ? "false" : "true");

  return true;
}

function syncActions(root, dictionary, result) {
  var retry = root ? root.querySelector("[data-booking-cancelled-retry]") : null;
  var newBooking = root ? root.querySelector("[data-booking-cancelled-new]") : null;
  var home = root ? root.querySelector("[data-booking-cancelled-home]") : null;
  var canRetry = canRetryCheckout(result);

  setNodeText(retry, t(dictionary, "cancelled.actions.retry"));
  setNodeText(newBooking, t(dictionary, "cancelled.actions.newBooking"));
  setNodeText(home, t(dictionary, "cancelled.actions.home"));
  setText(root, "[data-booking-status-whatsapp]", t(dictionary, "actions.whatsapp"));

  setActionVisible(retry, canRetry);
  setActionVisible(newBooking, !canRetry);
  setActionVisible(home, true);

  if (retry) {
    retry.disabled = !canRetry;
    retry.setAttribute("aria-disabled", canRetry ? "false" : "true");
  }

  return true;
}

  function bindRetry(root, state) {
    var retry = root ? root.querySelector("[data-booking-cancelled-retry]") : null;

    if (!retry || retry.dataset.bookingCancelledRetryBound === "1") {
      return false;
    }

    retry.dataset.bookingCancelledRetryBound = "1";

    retry.addEventListener("click", function onRetryClick(event) {
      var retryApi = window.PixkuyBookingCancelledRetry;

      event.preventDefault();

      if (
        !retryApi ||
        typeof retryApi.retry !== "function" ||
        retry.disabled
      ) {
        return;
      }

      retry.disabled = true;
      retry.setAttribute("aria-disabled", "true");
      setNodeText(retry, t(state.dictionary, "cancelled.retry.loading"));
      showNotice(
        root,
        t(state.dictionary, "cancelled.retry.loadingNotice"),
        "warning"
      );

      retryApi.retry(state.token).catch(function onRetryError() {
        retry.disabled = false;
        retry.setAttribute("aria-disabled", "false");
        setNodeText(retry, t(state.dictionary, "cancelled.actions.retry"));
        showNotice(
          root,
          t(state.dictionary, "cancelled.retry.error"),
          "error"
        );
      });
    });

    return true;
  }

  function render(state) {
    var root = getRoot();
    var dictionary = state.dictionary;
    var result = state.result;

    if (!root) {
      return false;
    }

    if (dictionary.meta && dictionary.meta.cancelledTitle) {
      document.title = dictionary.meta.cancelledTitle;
    }

    setText(root, "[data-booking-status-state]", "");
    setHidden(root, "[data-booking-status-state]", true);
    setText(root, "[data-booking-status-title]", getCopy(dictionary, result.view, "title"));
    setText(root, "[data-booking-status-lead]", getCopy(dictionary, result.view, "lead"));

    setText(root, '[data-booking-status-label="publicCode"]', t(dictionary, "details.publicCode"));
    setText(root, '[data-booking-status-label="service"]', t(dictionary, "details.service"));
    setText(root, '[data-booking-status-label="pickup"]', t(dictionary, "details.pickup"));
    setText(root, '[data-booking-status-label="destination"]', t(dictionary, "details.destination"));
    setText(root, '[data-booking-status-label="vehicle"]', t(dictionary, "details.vehicle"));
    setText(root, '[data-booking-status-label="date"]', t(dictionary, "details.date"));
    setText(root, '[data-booking-status-label="time"]', t(dictionary, "details.time"));
    setText(root, '[data-booking-status-label="duration"]', t(dictionary, "details.duration"));
    setText(root, '[data-booking-status-label="passengers"]', t(dictionary, "details.passengers"));
    setText(root, '[data-booking-status-label="payment"]', t(dictionary, "details.payment"));
    setText(
      root,
      '[data-booking-status-label="amount"]',
      tFallback(dictionary, "cancelled.details.amount", "details.amount")
    );
	setText(root, '[data-booking-status-label="customerName"]', t(dictionary, "details.customerName"));
    setText(root, '[data-booking-status-label="customerPhone"]', t(dictionary, "details.customerPhone"));
    setText(root, '[data-booking-status-label="customerEmail"]', t(dictionary, "details.customerEmail"));

    if (
      result.view === "missingToken" ||
      result.view === "notFound" ||
      result.view === "requestError" ||
      !hasRenderableReservationDetails(result)
    ) {
      setHidden(root, "[data-booking-status-details]", true);
    } else {
      renderDetails(root, dictionary, result);
    }

    syncActions(root, dictionary, result);
    bindRetry(root, state);
    showNotice(root, getNotice(dictionary, result), getTone(result.view));

    return true;
  }

  if (window.PixkuyBookingStatusState) {
    window.PixkuyBookingStatusState.onReady(render);
  }
})(window, document);