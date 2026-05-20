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

  function getNotice(dictionary, result) {
    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_mismatch"
    ) {
      return tFallback(
        dictionary,
        "cancelled.mobile.manualReview.paymentMismatchNotice",
        "cancelled.manualReview.paymentMismatchNotice"
      ) || t(dictionary, "manualReview.paymentMismatchNotice");
    }

    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_after_expiry"
    ) {
      return tFallback(
        dictionary,
        "cancelled.mobile.manualReview.paymentAfterExpiryNotice",
        "cancelled.manualReview.paymentAfterExpiryNotice"
      ) || t(dictionary, "manualReview.paymentAfterExpiryNotice");
    }

    if (result.view === "manualReview") {
      return tFallback(
        dictionary,
        "cancelled.mobile.manualReview.defaultNotice",
        "cancelled.manualReview.defaultNotice"
      ) || t(dictionary, "manualReview.defaultNotice");
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
    setText(
      root,
      "[data-booking-status-public-code]",
      result.publicCode || emptyValue(dictionary)
    );
    setText(
      root,
      "[data-booking-status-payment]",
      paymentLabel(dictionary, result.paymentStatus)
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
  setText(root, "[data-booking-status-whatsapp]", t(dictionary, "actions.whatsapp"));

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
      '[data-booking-status-label="payment"]',
      tFallback(dictionary, "mobile.details.payment", "details.payment")
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

    if (
      result.view === "missingToken" ||
      result.view === "notFound" ||
      result.view === "requestError"
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