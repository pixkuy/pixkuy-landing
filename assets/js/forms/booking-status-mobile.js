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

  function getNotice(dictionary, result) {
    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_mismatch"
    ) {
      return tFallback(
        dictionary,
        "mobile.manualReview.paymentMismatchNotice",
        "manualReview.paymentMismatchNotice"
      );
    }

    if (
      result.view === "manualReview" &&
      result.reservationStatus === "payment_after_expiry"
    ) {
      return tFallback(
        dictionary,
        "mobile.manualReview.paymentAfterExpiryNotice",
        "manualReview.paymentAfterExpiryNotice"
      );
    }

    if (result.view === "manualReview") {
      return tFallback(
        dictionary,
        "mobile.manualReview.defaultNotice",
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