/* assets/js/forms/booking-cancelled-mobile.js
   Render y UX móvil de booking-cancelled.
   Responsabilidad:
   - pintar la vista móvil a partir de PixkuyBookingStatusState
   - mostrar retry solo si Booking API lo permite
   - gestionar foco, cierre y bloqueo visual móvil
   No consulta status.
   No gestiona desktop.
   No confirma reservas.
*/

(function initBookingCancelledMobile(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var MOBILE_QUERY = "(max-width: 720px)";
  var LOCK_CLASS = "booking-status-mobile-lock";
  var previousFocus = null;

  function isMobileViewport() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia(MOBILE_QUERY).matches
    );
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
    return document.querySelector("[data-booking-cancelled-mobile]");
  }

  function getPanel() {
    return document.querySelector("[data-booking-cancelled-mobile-panel]");
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
  
  function setAttribute(root, selector, name, value) {
    var node = root ? root.querySelector(selector) : null;

    if (!node) {
      return false;
    }

    node.setAttribute(name, value);
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

  function cancelledPaymentLabel(dictionary, result) {
    if (result && result.view === "manualReview") {
      return t(dictionary, "paymentLabels.pending_manual_review") ||
        t(dictionary, "paymentLabels.notAvailable") ||
        emptyValue(dictionary);
    }

    return paymentLabel(dictionary, result ? result.paymentStatus : "");
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
    var totalMinutes;
    var hours;
    var minutes;
    var parts = [];

    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return emptyValue(dictionary);
    }

    totalMinutes = Math.round(value * 60);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;

    if (hours === 1) {
      parts.push(t(dictionary, "details.durationOneHour") || "1 hora");
    } else if (hours > 1) {
      parts.push(String(hours) + " " + (t(dictionary, "details.durationHours") || "horas"));
    }

    if (minutes > 0) {
      parts.push(String(minutes).padStart(2, "0") + " min");
    }

    return parts.length ? parts.join(" ") : "0 min";
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

  function shouldShowLuggage(result) {
    return Boolean(
      result &&
      result.serviceType === "airport_transfer" &&
      typeof result.luggageCount === "number"
    );
  }

  function luggageLabel(dictionary, result) {
    if (!shouldShowLuggage(result)) {
      return emptyValue(dictionary);
    }

    if (result.luggageCount === 1) {
      return t(dictionary, "details.luggageOne") || "1 maleta";
    }

    return String(result.luggageCount) + " " + (t(dictionary, "details.luggageMany") || "maletas");
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

    if (!vehicleNode) {
      return false;
    }

    existing = vehicleNode.querySelector("[data-booking-status-vehicle-thumb]");

    if (existing) {
      existing.remove();
    }

    vehicleNode.classList.remove("booking-status-mobile__vehicle-value");

    src = getVehicleThumbnailSrc(result && result.vehicleDisplayName);

    if (!src) {
      return false;
    }

    image = document.createElement("img");
    image.className = "booking-status-mobile__vehicle-thumb";
    image.setAttribute("data-booking-status-vehicle-thumb", "1");
    image.setAttribute("src", src);
    image.setAttribute("alt", "");
    image.setAttribute("aria-hidden", "true");
    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");

    vehicleNode.classList.add("booking-status-mobile__vehicle-value");
    vehicleNode.appendChild(image);

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
        typeof result.luggageCount === "number" ||
        typeof result.paymentAmountPaid === "number" ||
        typeof result.paymentAmountExpected === "number"
      )
    );
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
    return "cancelled.mobile." + getCommonCopyPath(view);
  }

  function getCopy(dictionary, view, key) {
    return tFallback(
      dictionary,
      getCancelledCopyPath(view) + "." + key,
      "cancelled." + getCommonCopyPath(view) + "." + key
    ) || t(dictionary, getCommonCopyPath(view) + "." + key);
  }

  function replaceToken(template, token, value) {
    return String(template || "").replace(token, value || "");
  }

  function compactParts(parts) {
    return parts.filter(function keepValue(value) {
      return Boolean(value);
    });
  }
  
  function buildPendingCancelledMobileNotice(dictionary, result) {
    var baseNotice = getCopy(dictionary, result.view, "notice");
    var emailNotice = t(dictionary, "cancelled.mobile.pending.emailNotice");
    var contactNotice = t(dictionary, "cancelled.mobile.pending.contactNotice");
    var contactValue = compactParts([
      result.customerFullName,
      result.customerPhone
    ]).join(" · ");
    var lines = [];

    if (baseNotice) {
      lines.push(baseNotice);
    }

    if (result.customerEmail && emailNotice) {
      lines.push(replaceToken(emailNotice, "{{email}}", result.customerEmail));
    }

    if (contactValue && contactNotice) {
      lines.push(replaceToken(contactNotice, "{{contact}}", contactValue));
    }

    if (lines.length > 0) {
      return lines.join("\n");
    }

    return getCopy(dictionary, result.view, "notice");
  }


  function buildConfirmedCancelledMobileNotice(dictionary, result) {
    var emailNotice = t(dictionary, "cancelled.mobile.confirmed.emailNotice");
    var contactNotice = t(dictionary, "cancelled.mobile.confirmed.contactNotice");
    var timezoneNotice = t(dictionary, "cancelled.mobile.confirmed.timezoneNotice");
    var contactValue = compactParts([
      result.customerFullName,
      result.customerPhone
    ]).join(" · ");
    var lines = [];

    if (result.customerEmail && emailNotice) {
      lines.push(replaceToken(emailNotice, "{{email}}", result.customerEmail));
    }

    if (contactValue && contactNotice) {
      lines.push(replaceToken(contactNotice, "{{contact}}", contactValue));
    }

    if (timezoneNotice) {
      if (lines.length > 0) {
        lines.push("");
      }

      lines.push(timezoneNotice);
    }

    if (lines.length > 0) {
      return lines.join("\n");
    }

    return getCopy(dictionary, result.view, "notice");
  }
  
  function buildManualReviewCancelledMobileNotice(dictionary, result) {
    var baseNotice;
    var emailNotice = t(dictionary, "cancelled.mobile.manualReview.emailNotice");
    var contactNotice = t(dictionary, "cancelled.mobile.manualReview.contactNotice");
    var contactValue = compactParts([
      result.customerFullName,
      result.customerPhone
    ]).join(" · ");
    var lines = [];

    if (result.reservationStatus === "payment_mismatch") {
      baseNotice = tFallback(
        dictionary,
        "cancelled.mobile.manualReview.paymentMismatchNotice",
        "cancelled.manualReview.paymentMismatchNotice"
      ) || t(dictionary, "manualReview.paymentMismatchNotice");
    } else if (result.reservationStatus === "payment_after_expiry") {
      baseNotice = tFallback(
        dictionary,
        "cancelled.mobile.manualReview.paymentAfterExpiryNotice",
        "cancelled.manualReview.paymentAfterExpiryNotice"
      ) || t(dictionary, "manualReview.paymentAfterExpiryNotice");
    } else {
      baseNotice = tFallback(
        dictionary,
        "cancelled.mobile.manualReview.defaultNotice",
        "cancelled.manualReview.defaultNotice"
      ) || t(dictionary, "manualReview.defaultNotice");
    }

    if (baseNotice) {
      lines.push(baseNotice);
    }

    if (result.customerEmail && emailNotice) {
      lines.push(replaceToken(emailNotice, "{{email}}", result.customerEmail));
    }

    if (contactValue && contactNotice) {
      lines.push(replaceToken(contactNotice, "{{contact}}", contactValue));
    }

    if (lines.length > 0) {
      return lines.join("\n");
    }

    return getCopy(dictionary, result.view, "notice");
  }


  function buildMobileWhatsappMessage(dictionary, result) {
    var template = t(dictionary, "mobile.whatsappMessage") ||
      "Hola Pixkuy, necesito ayuda con mi reserva {{publicCode}}.";
    var message = replaceToken(
      template,
      "{{publicCode}}",
      result.publicCode || ""
    );

    return message.trim();
  }

  function buildMobileWhatsappHref(dictionary, result) {
    return "whatsapp://send?phone=5215528837400&text=" +
      encodeURIComponent(buildMobileWhatsappMessage(dictionary, result));
  }

  function getNotice(dictionary, result) {
    if (result.view === "confirmed") {
      return buildConfirmedCancelledMobileNotice(dictionary, result);
    }

    if (result.view === "pending") {
      return buildPendingCancelledMobileNotice(dictionary, result);
    }

    if (result.view === "manualReview") {
      return buildManualReviewCancelledMobileNotice(dictionary, result);
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

  function blurActiveElementInside(node) {
    var activeElement = document.activeElement;

    if (
      node &&
      activeElement &&
      typeof activeElement.blur === "function" &&
      node.contains(activeElement)
    ) {
      activeElement.blur();
      return true;
    }

    return false;
  }

  function isOpen() {
    var root = getRoot();

    return Boolean(
      root &&
      root.getAttribute("aria-hidden") !== "true" &&
      root.hidden !== true
    );
  }

  function open() {
    var root = getRoot();
    var panel = getPanel();

    if (!root || !isMobileViewport()) {
      return false;
    }

    previousFocus = document.activeElement;

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add(LOCK_CLASS);

    window.setTimeout(function focusMobilePanel() {
      if (panel && typeof panel.focus === "function") {
        panel.focus();
      }
    }, 0);

    return true;
  }

  function close() {
    var root = getRoot();

    if (!root) {
      return false;
    }

    blurActiveElementInside(root);

    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove(LOCK_CLASS);

    if (
      previousFocus &&
      typeof previousFocus.focus === "function" &&
      document.contains(previousFocus)
    ) {
      previousFocus.focus();
    }

    previousFocus = null;

    window.location.assign("/");
    return true;
  }

  function bindMobile(dictionary) {
    var root = getRoot();
    var controls;

    if (!root || root.dataset.bookingCancelledMobileBound === "1") {
      return false;
    }

    controls = Array.prototype.slice.call(
      root.querySelectorAll("[data-booking-status-mobile-close]")
    );

    controls.forEach(function bindCloseControl(control) {
      var closeLabel = t(dictionary, "mobile.close");

      if (closeLabel) {
        control.setAttribute("aria-label", closeLabel);
      }

      control.addEventListener("click", function onCloseClick(event) {
        event.preventDefault();
        close();
      });
    });

    document.addEventListener("keydown", function onKeydown(event) {
      if (
        event.key === "Escape" &&
        isMobileViewport() &&
        isOpen()
      ) {
        event.preventDefault();
        close();
      }
    });

    root.dataset.bookingCancelledMobileBound = "1";
    return true;
  }

  function renderDetails(root, dictionary, result) {
    var details = root ? root.querySelector("[data-booking-status-details]") : null;

    if (details) {
      details.setAttribute("data-booking-status-service-type", result.serviceType || "");
    }

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
      "[data-booking-status-destination-row]",
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
      "[data-booking-status-luggage]",
      luggageLabel(dictionary, result)
    );
    setHidden(
      root,
      "[data-booking-status-luggage-row]",
      !shouldShowLuggage(result)
    );
    setText(
      root,
      "[data-booking-status-payment]",
      cancelledPaymentLabel(dictionary, result)
    );
    setText(
      root,
      "[data-booking-status-amount]",
      amountLabel(dictionary, result)
    );
	    setText(
      root,
      "[data-booking-status-notes]",
      result.customerNotes || emptyValue(dictionary)
    );
    setHidden(
      root,
      "[data-booking-status-notes-row]",
      !result.customerNotes
    );
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
  var canRetry = canRetryCheckout(result);

  setNodeText(retry, t(dictionary, "cancelled.actions.retry"));
  setNodeText(newBooking, t(dictionary, "cancelled.actions.newBooking"));
  setText(root, "[data-booking-cancelled-home]", t(dictionary, "cancelled.actions.home"));
  setAttribute(root, "[data-booking-cancelled-home]", "href", "/");
  setText(root, "[data-booking-status-whatsapp]", t(dictionary, "actions.whatsapp"));
  setAttribute(
    root,
    "[data-booking-status-whatsapp]",
    "href",
    buildMobileWhatsappHref(dictionary, result)
  );
  setAttribute(root, "[data-booking-status-whatsapp]", "target", "_self");

  setActionVisible(retry, canRetry);
  setActionVisible(newBooking, !canRetry);

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

    bindMobile(dictionary);

    setText(root, "[data-booking-status-state]", getCopy(dictionary, result.view, "state"));
    setText(root, "[data-booking-status-title]", getCopy(dictionary, result.view, "title"));
    setText(root, "[data-booking-status-lead]", getCopy(dictionary, result.view, "lead"));

    setText(
      root,
      '[data-booking-status-label="publicCode"]',
      tFallback(dictionary, "mobile.details.publicCode", "details.publicCode")
    );
    setText(
      root,
      '[data-booking-status-label="service"]',
      tFallback(dictionary, "mobile.details.service", "details.service")
    );
    setText(
      root,
      '[data-booking-status-label="pickup"]',
      tFallback(dictionary, "mobile.details.pickup", "details.pickup")
    );
    setText(
      root,
      '[data-booking-status-label="destination"]',
      tFallback(dictionary, "mobile.details.destination", "details.destination")
    );
    setText(
      root,
      '[data-booking-status-label="vehicle"]',
      tFallback(dictionary, "mobile.details.vehicle", "details.vehicle")
    );
    setText(
      root,
      '[data-booking-status-label="date"]',
      tFallback(dictionary, "mobile.details.date", "details.date")
    );
    setText(
      root,
      '[data-booking-status-label="time"]',
      tFallback(dictionary, "mobile.details.time", "details.time")
    );
    setText(
      root,
      '[data-booking-status-label="duration"]',
      tFallback(dictionary, "mobile.details.duration", "details.duration")
    );
    setText(
      root,
      '[data-booking-status-label="passengers"]',
      tFallback(dictionary, "mobile.details.passengers", "details.passengers")
    );
    setText(
      root,
      '[data-booking-status-label="luggage"]',
      tFallback(dictionary, "mobile.details.luggage", "details.luggage") || "Maletas"
    );
    setText(
      root,
      '[data-booking-status-label="payment"]',
      tFallback(dictionary, "mobile.details.payment", "details.payment")
    );
    setText(
      root,
      '[data-booking-status-label="amount"]',
      result.view === "confirmed"
        ? tFallback(dictionary, "mobile.details.amount", "details.amount")
        : tFallback(dictionary, "cancelled.details.amount", "details.amount")
    );
	setText(
      root,
      '[data-booking-status-label="notes"]',
      tFallback(dictionary, "mobile.details.notes", "details.notes")
    );

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
    open();

    return true;
  }

  window.PixkuyBookingCancelledMobile = {
    open: open,
    close: close,
    isOpen: isOpen
  };

  if (window.PixkuyBookingStatusState) {
    window.PixkuyBookingStatusState.onReady(render);
  }
})(window, document);