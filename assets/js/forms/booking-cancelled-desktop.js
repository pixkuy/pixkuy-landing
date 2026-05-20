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

    setText(root, "[data-booking-status-state]", getCopy(dictionary, result.view, "state"));
    setText(root, "[data-booking-status-title]", getCopy(dictionary, result.view, "title"));
    setText(root, "[data-booking-status-lead]", getCopy(dictionary, result.view, "lead"));

    setText(root, '[data-booking-status-label="publicCode"]', t(dictionary, "details.publicCode"));
    setText(root, '[data-booking-status-label="payment"]', t(dictionary, "details.payment"));
    setText(root, '[data-booking-status-label="date"]', t(dictionary, "details.date"));
    setText(root, '[data-booking-status-label="time"]', t(dictionary, "details.time"));

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

    return true;
  }

  if (window.PixkuyBookingStatusState) {
    window.PixkuyBookingStatusState.onReady(render);
  }
})(window, document);