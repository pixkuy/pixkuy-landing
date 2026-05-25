/* assets/js/forms/booking-public-config.js
   Public runtime config loader.
   Responsabilidad:
   - cargar configuración pública desde Netlify Functions
   - fusionarla en window.PIXKUY_BOOKING_API_CONFIG
   - no exponer secretos
*/

(function initPixkuyBookingPublicConfig(window) {
  "use strict";

  if (!window || !window.fetch) {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG;

    return config && typeof config === "object" ? config : {};
  }

  function mergePublicConfig(payload) {
    var siteKey = normalizeText(
      payload &&
      payload.recaptchaEnterprise &&
      payload.recaptchaEnterprise.siteKey
    );

    if (!siteKey) {
      return;
    }

    window.PIXKUY_BOOKING_API_CONFIG = Object.assign({}, getConfig(), {
      recaptchaSiteKey: siteKey
    });
  }

  function load() {
    return window.fetch("/.netlify/functions/booking-public-config", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    })
      .then(function parseResponse(response) {
        if (!response || !response.ok) {
          return null;
        }

        return response.json();
      })
      .then(function applyPayload(payload) {
        if (!payload || payload.ok !== true) {
          return;
        }

        mergePublicConfig(payload);
      })
      .catch(function ignoreConfigError() {
        // Backend remains the source of truth. If reCAPTCHA is required and
        // config is unavailable, checkout fails closed at Booking API.
      });
  }

  window.PixkuyBookingPublicConfig = {
    load: load
  };

  window.PixkuyBookingPublicConfig.ready = load();
})(window);