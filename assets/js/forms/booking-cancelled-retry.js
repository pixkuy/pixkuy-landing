/* assets/js/forms/booking-cancelled-retry.js
   Retry público de Checkout para booking-cancelled.
   Responsabilidad:
   - llamar al endpoint público de retry
   - redirigir a Stripe Checkout si Booking API lo permite
   No pinta UI.
   No consulta status.
   No confirma reservas.
*/

(function initBookingCancelledRetry(window) {
  "use strict";

  if (!window) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
var RETRY_ENDPOINT = "/v1/public/reservations/retry-checkout";
var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_STATUS_CONFIG;
    var hasExplicitApiBaseUrl;

    if (!config || typeof config !== "object") {
      return {
        apiBaseUrl: DEFAULT_BOOKING_API_BASE_URL,
        publicSiteKey: DEFAULT_PUBLIC_SITE_KEY
      };
    }

    hasExplicitApiBaseUrl =
      Object.prototype.hasOwnProperty.call(config, "apiBaseUrl") &&
      typeof config.apiBaseUrl === "string";

    return {
      apiBaseUrl: hasExplicitApiBaseUrl
        ? normalizeText(config.apiBaseUrl)
        : DEFAULT_BOOKING_API_BASE_URL,
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY
    };
  }

  function buildRetryUrl(config) {
    return config.apiBaseUrl.replace(/\/+$/, "") + RETRY_ENDPOINT;
  }

  function getCheckoutUrl(body) {
    if (
      body &&
      body.paymentAttempt &&
      typeof body.paymentAttempt.checkoutUrl === "string"
    ) {
      return body.paymentAttempt.checkoutUrl.trim();
    }

    return "";
  }
  
  function getBookingCheckoutStorageKey(token) {
  return BOOKING_CHECKOUT_STORAGE_PREFIX + token;
}

function storeBookingCheckoutHandoff(input) {
  var token = normalizeText(input && input.bookingStatusToken);
  var checkoutUrl = normalizeText(input && input.checkoutUrl);

  if (!token || !checkoutUrl) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      getBookingCheckoutStorageKey(token),
      JSON.stringify({
        token: token,
        checkoutUrl: checkoutUrl,
        redirected: false,
        createdAt: new Date().toISOString()
      })
    );
    return true;
  } catch (error) {
    return false;
  }
}

function redirectToBookingCheckout(input) {
  var token = normalizeText(input && input.bookingStatusToken);
  var checkoutUrl = normalizeText(input && input.checkoutUrl);
  var handoffUrl;

  if (!token || !checkoutUrl) {
    return false;
  }

  if (!storeBookingCheckoutHandoff({
    bookingStatusToken: token,
    checkoutUrl: checkoutUrl
  })) {
    return false;
  }

  handoffUrl = BOOKING_CHECKOUT_HANDOFF_PATH +
    "?token=" +
    encodeURIComponent(token);

  window.location.replace(handoffUrl);
  return true;
}

  function retry(token) {
    var config = getConfig();
    var safeToken = normalizeText(token);

    if (!safeToken) {
      return Promise.reject(new Error("BOOKING_STATUS_TOKEN_REQUIRED"));
    }

    return window.fetch(buildRetryUrl(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pixkuy-Site-Key": config.publicSiteKey
      },
      body: JSON.stringify({
        token: safeToken
      })
    }).then(function parseRetryResponse(response) {
      return response.json().catch(function () {
        return {};
      }).then(function handleRetryBody(body) {
        var checkoutUrl = getCheckoutUrl(body);

        if (!response.ok || !checkoutUrl) {
  throw new Error(
    body && typeof body.code === "string"
      ? body.code
      : "CHECKOUT_RETRY_FAILED"
  );
}

if (!redirectToBookingCheckout({
  bookingStatusToken: safeToken,
  checkoutUrl: checkoutUrl
})) {
  throw new Error("BOOKING_CHECKOUT_HANDOFF_FAILED");
}

return body;
      });
    });
  }

  window.PixkuyBookingCancelledRetry = {
    retry: retry
  };
})(window);