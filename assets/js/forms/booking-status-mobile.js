/* assets/js/forms/booking-status-mobile.js
   Render y UX móvil de booking-success.
   Responsabilidad:
   - pintar la vista móvil a partir de PixkuyBookingStatusState
   - replicar comportamiento UX tipo success sheet móvil
   - gestionar foco, cierre y bloqueo visual móvil
   No consulta API.
   No gestiona desktop.
   No toca Netlify Forms.
   No toca contact-success-modal.js.
*/

(function initBookingStatusMobile(window, document) {
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
    return document.querySelector("[data-booking-status-mobile]");
  }

  function getPanel() {
    return document.querySelector("[data-booking-status-mobile-panel]");
  }

  function getDesktopRoot() {
    return document.querySelector("[data-booking-status-desktop]");
  }

  function setDesktopHidden(hidden) {
    var desktopRoot = getDesktopRoot();

    if (!desktopRoot) {
      return false;
    }

    desktopRoot.hidden = Boolean(hidden);
    desktopRoot.setAttribute("aria-hidden", hidden ? "true" : "false");
    desktopRoot.style.display = hidden ? "none" : "";

    return true;
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

  function statusPaymentLabel(dictionary, result) {
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

    return "unknown";
  }

  function getMobileCopyPath(view) {
    return "mobile." + getCommonCopyPath(view);
  }

  function getCopy(dictionary, view, key) {
    return tFallback(
      dictionary,
      getMobileCopyPath(view) + "." + key,
      getCommonCopyPath(view) + "." + key
    );
  }

  function replaceToken(template, token, value) {
    return String(template || "").replace(token, value || "");
  }

  function compactParts(parts) {
    return parts.filter(function keepValue(value) {
      return Boolean(value);
    });
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
  
    function buildManualReviewMobileNotice(dictionary, result) {
    var baseNotice;
    var emailNotice = t(dictionary, "mobile.manualReview.emailNotice");
    var contactNotice = t(dictionary, "mobile.manualReview.contactNotice");
    var contactValue = compactParts([
      result.customerFullName,
      result.customerPhone
    ]).join(" · ");
    var lines = [];

    if (result.reservationStatus === "payment_mismatch") {
      baseNotice = tFallback(
        dictionary,
        "mobile.manualReview.paymentMismatchNotice",
        "manualReview.paymentMismatchNotice"
      );
    } else if (result.reservationStatus === "payment_after_expiry") {
      baseNotice = tFallback(
        dictionary,
        "mobile.manualReview.paymentAfterExpiryNotice",
        "manualReview.paymentAfterExpiryNotice"
      );
    } else {
      baseNotice = tFallback(
        dictionary,
        "mobile.manualReview.defaultNotice",
        "manualReview.defaultNotice"
      );
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


  function buildConfirmedMobileNotice(dictionary, result) {
    var emailNotice = t(dictionary, "mobile.confirmed.emailNotice");
    var contactNotice = t(dictionary, "mobile.confirmed.contactNotice");
    var timezoneNotice = t(dictionary, "mobile.confirmed.timezoneNotice");
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
      lines.push(timezoneNotice);
    }

    if (lines.length > 0) {
      return lines.join("\n");
    }

    return getCopy(dictionary, result.view, "notice");
  }

  function getNotice(dictionary, result) {
    if (result.view === "confirmed") {
      return buildConfirmedMobileNotice(dictionary, result);
    }

    if (result.view === "manualReview") {
      return buildManualReviewMobileNotice(dictionary, result);
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

    setDesktopHidden(true);

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
    setDesktopHidden(false);

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

    if (!root || root.dataset.bookingStatusMobileBound === "1") {
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

    root.dataset.bookingStatusMobileBound = "1";
    return true;
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
      statusPaymentLabel(dictionary, result)
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

    if (!root) {
      return false;
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
      tFallback(dictionary, "mobile.details.amount", "details.amount")
    );

    setText(root, "[data-booking-status-primary]", t(dictionary, "actions.primary"));
    setText(root, "[data-booking-status-whatsapp]", t(dictionary, "actions.whatsapp"));
    setAttribute(
      root,
      "[data-booking-status-whatsapp]",
      "href",
      buildMobileWhatsappHref(dictionary, result)
    );
    setAttribute(root, "[data-booking-status-whatsapp]", "target", "_self");

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
    open();

    return true;
  }

  window.PixkuyBookingStatusMobile = {
    open: open,
    close: close,
    isOpen: isOpen
  };

  if (window.PixkuyBookingStatusState) {
    window.PixkuyBookingStatusState.onReady(render);
  }
})(window, document);