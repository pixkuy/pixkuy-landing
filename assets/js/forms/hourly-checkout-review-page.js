/* assets/js/forms/hourly-checkout-review-page.js
   Hourly checkout review page.
   Responsabilidad:
   - leer snapshot desktop desde sessionStorage
   - pintar resumen de reserva
   - permitir volver a editar datos
   - iniciar checkout Booking API/Stripe solo desde esta página
*/

(function initHourlyCheckoutReviewPage(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var STORAGE_KEY = "pixkuy_hourly_checkout_review_snapshot";
  var CHECKOUT_ENDPOINT = "/v1/public/reservations/checkout";
  var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
  var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";
  var HOURLY_I18N_PATH = "assets/i18n/es/services-hourly.json";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  
    function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG || {};
    var hostname = window.location.hostname;
    var apiBaseUrl = normalizeText(config.apiBaseUrl);

    if (!apiBaseUrl && hostname === "192.168.0.14") {
      apiBaseUrl = "http://192.168.0.14:3002";
    } else if (
      !apiBaseUrl &&
      (
        hostname === "localhost" ||
        hostname === "127.0.0.1"
      )
    ) {
      apiBaseUrl = "http://localhost:3002";
    }

    return {
      apiBaseUrl: apiBaseUrl,
      publicSiteKey: normalizeText(config.publicSiteKey) || "local_pixkuy_site_key",
      recaptchaSiteKey: normalizeText(config.recaptchaSiteKey)
    };
  }

  function getNode(selector) {
    return document.querySelector(selector);
  }
  
    function getPathValue(source, path) {
    var parts = String(path || "").split(".");
    var cursor = source;
    var index;

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor : "";
  }

  function t(dictionary, path) {
    return getPathValue(dictionary, path);
  }

  function loadDictionary() {
    return window.fetch(HOURLY_I18N_PATH, {
      credentials: "same-origin"
    }).then(function parseDictionary(response) {
      if (!response.ok) {
        return {};
      }

      return response.json().catch(function () {
        return {};
      });
    }).catch(function () {
      return {};
    });
  }

  function setHidden(node, hidden) {
    if (!node) {
      return false;
    }

    node.hidden = Boolean(hidden);
    return true;
  }

  function setText(node, value) {
    if (!node) {
      return false;
    }

    node.textContent = value;
    return true;
  }

  function readSnapshot() {
    var raw;
    var parsed;

    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  }

  function writeBookingHandoff(input) {
    var token = normalizeText(input && input.bookingStatusToken);
    var checkoutUrl = normalizeText(input && input.checkoutUrl);

    if (!token || !checkoutUrl) {
      return false;
    }

    try {
      window.sessionStorage.setItem(
        BOOKING_CHECKOUT_STORAGE_PREFIX + token,
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

  function redirectToCheckout(checkoutUrl, bookingStatusToken) {
    var token = normalizeText(bookingStatusToken);
    var url = normalizeText(checkoutUrl);

    if (!token || !url) {
      return false;
    }

    if (!writeBookingHandoff({
      bookingStatusToken: token,
      checkoutUrl: url
    })) {
      return false;
    }

    window.location.replace(
      BOOKING_CHECKOUT_HANDOFF_PATH + "?token=" + encodeURIComponent(token)
    );

    return true;
  }

  function buildRow(label, value, modifier) {
    var safeLabel = normalizeText(label);
    var safeValue = normalizeText(value);
    var safeModifier = normalizeText(modifier);

    if (!safeLabel || !safeValue) {
      return "";
    }

    return [
      '<div class="booking-status__detail',
      safeModifier ? " booking-status__detail--" + escapeHtml(safeModifier) : "",
      '">',
      "<dt>",
      escapeHtml(safeLabel),
      "</dt>",
      "<dd>",
      escapeHtml(safeValue),
      "</dd>",
      "</div>"
    ].join("");
  }

  function buildVehicleRow(label, value) {
    var safeLabel = normalizeText(label);
    var safeValue = normalizeText(value);

    if (!safeLabel || !safeValue) {
      return "";
    }

    return [
      '<div class="booking-status__detail booking-status__detail--vehicle">',
      "<dt>",
      escapeHtml(safeLabel),
      "</dt>",
      "<dd>",
      '<span class="booking-status__vehicle-name">',
      escapeHtml(safeValue),
      "</span>",
      '<span class="booking-status__vehicle-media" aria-hidden="true">',
      '<img src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="" loading="lazy" decoding="async">',
      "</span>",
      "</dd>",
      "</div>"
    ].join("");
  }
  
  function formatPrice(snapshot) {
    var amount = normalizeText(snapshot.hourly_daily_price_label);
    var rawPrice = normalizeText(snapshot.hourly_daily_price);
    var currency = normalizeText(snapshot.hourly_daily_currency) || "MXN";
    var numericPrice;

    if (amount) {
      return amount;
    }

    if (!rawPrice) {
      return "";
    }

    numericPrice = Number(rawPrice);

    if (!Number.isFinite(numericPrice)) {
      return rawPrice + " " + currency;
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 0
      }).format(numericPrice) + " " + currency;
    } catch (error) {
      return String(numericPrice) + " " + currency;
    }
  }

  function formatDuration(snapshot) {
    var label = normalizeText(snapshot.hourly_daily_duration_label);
    var hours = normalizeText(snapshot.hourly_daily_duration_hours);

    if (label) {
      return label;
    }

    if (!hours) {
      return "";
    }

    return hours + "h";
  }

  function renderDetails(snapshot, dictionary) {
    var details = getNode("[data-hourly-checkout-review-details]");
    var base = "services.cards.hourly.panel.reviewPage.";

    if (!details) {
      return false;
    }

    details.innerHTML = [
      buildRow(t(dictionary, base + "details.service"), t(dictionary, base + "serviceValue"), "service"),
      buildRow(t(dictionary, base + "details.mode"), snapshot.hourly_daily_mode_label || snapshot.hourly_daily_mode, "mode"),
      buildRow(t(dictionary, base + "details.pickup"), snapshot.hourly_daily_pickup_label || snapshot.hourly_daily_pickup, "pickup"),
      buildRow(t(dictionary, base + "details.date"), snapshot.hourly_daily_date, "date"),
      buildRow(t(dictionary, base + "details.time"), snapshot.hourly_daily_start_time, "time"),
      buildRow(t(dictionary, base + "details.duration"), formatDuration(snapshot), "duration"),
      buildVehicleRow(t(dictionary, base + "details.vehicle"), t(dictionary, base + "vehicleValue")),
      buildRow(t(dictionary, base + "details.passengers"), t(dictionary, base + "passengersValue"), "passengers"),
      buildRow(t(dictionary, base + "details.price"), formatPrice(snapshot), "price"),
      buildRow(t(dictionary, "services.cards.hourly.mobileFlow.contactStep.fields.name"), snapshot.name, "customer-name"),
      buildRow(t(dictionary, "services.cards.hourly.mobileFlow.contactStep.fields.phone"), snapshot.phone, "customer-phone"),
      buildRow(t(dictionary, "services.cards.hourly.mobileFlow.contactStep.fields.email"), snapshot.email, "customer-email"),
      snapshot.hourly_daily_notes
        ? buildRow(t(dictionary, base + "details.notes"), snapshot.hourly_daily_notes, "notes")
        : ""
    ].join("");

    return true;
  }

  function renderLegal(snapshot, dictionary) {
    var legal = getNode("[data-hourly-checkout-review-legal]");
    var acceptedAt = normalizeText(snapshot.legal_acceptance_accepted_at);
    var base = "services.cards.hourly.panel.reviewPage.";

    if (!legal) {
      return false;
    }

    legal.innerHTML = [
      '<div class="hourly-checkout-review-screen__legal-card">',
      "<strong>",
      t(dictionary, base + "legalTitle"),
      "</strong>",
      "<p>",
      acceptedAt
        ? t(dictionary, base + "legalText")
        : t(dictionary, base + "legalTextFallback"),
      "</p>",
      "</div>"
    ].join("");

    return true;
  }
  
  function renderStaticCopy(dictionary) {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll("[data-hourly-checkout-review-copy]")
    );

    nodes.forEach(function renderCopy(node) {
      var path = node.getAttribute("data-hourly-checkout-review-copy");

      setText(node, t(dictionary, path));
    });

    return true;
  }

  function renderSnapshot(snapshot, dictionary) {
    var empty = getNode("[data-hourly-checkout-review-empty]");
    var content = getNode("[data-hourly-checkout-review-content]");

    renderStaticCopy(dictionary);

    if (!snapshot) {
      setHidden(empty, false);
      setHidden(content, true);
      return false;
    }

    renderDetails(snapshot, dictionary);
    renderLegal(snapshot, dictionary);

    setHidden(empty, true);
    setHidden(content, false);

    return true;
  }

  function parseMoneyMinorUnits(value) {
    var normalized = normalizeText(value).replace(/[^\d.]/g, "");
    var parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed * 100);
  }

  function parsePositiveInteger(value) {
    var normalized = normalizeText(value).replace(/[^\d]/g, "");
    var parsed = Number(normalized);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function buildPayload(snapshot) {
    var amountMinor = parseMoneyMinorUnits(snapshot.hourly_daily_price);
    var durationHours = parsePositiveInteger(snapshot.hourly_daily_duration_hours);
    var payload;

    if (!amountMinor || !durationHours) {
      return null;
    }

    payload = {
      service_type: "hourly_daily",
      hourly_daily_mode: snapshot.hourly_daily_mode,
      hourly_daily_pickup: snapshot.hourly_daily_pickup,
      hourly_daily_date: snapshot.hourly_daily_date,
      hourly_daily_start_time: snapshot.hourly_daily_start_time,
      hourly_daily_duration_hours: durationHours,
      hourly_daily_passengers: 6,
      hourly_daily_price: amountMinor,
      hourly_daily_currency: "MXN",
      request_summary: snapshot.request_summary || "",
      locale: snapshot.locale || "es",
      customer: {
        full_name: snapshot.name,
        email: snapshot.email,
        phone: snapshot.phone
      },
      form_payload_raw: snapshot.form_payload_raw || {}
    };

    [
      "hourly_daily_pickup_place_id",
      "legal_acceptance_accepted",
      "legal_acceptance_terms_version",
      "legal_acceptance_cancellation_policy_version",
      "legal_acceptance_privacy_version",
      "legal_acceptance_accepted_at",
      "legal_acceptance_channel",
      "legal_acceptance_terms_url",
      "legal_acceptance_cancellations_url",
      "legal_acceptance_privacy_url"
    ].forEach(function copyStringField(key) {
      if (normalizeText(snapshot[key])) {
        payload[key] = normalizeText(snapshot[key]);
      }
    });

    [
      "hourly_daily_pickup_lat",
      "hourly_daily_pickup_lng"
    ].forEach(function copyNumberField(key) {
      var value = Number(snapshot[key]);

      if (Number.isFinite(value)) {
        payload[key] = value;
      }
    });

    return payload;
  }

  function setBusy(isBusy) {
    var proceed = getNode("[data-hourly-checkout-review-proceed]");

    if (!proceed) {
      return false;
    }

    proceed.disabled = Boolean(isBusy);
    proceed.setAttribute("aria-disabled", isBusy ? "true" : "false");
    return true;
  }

  function showError(dictionary) {
    var errorNode = getNode("[data-hourly-checkout-review-error]");

    if (!errorNode) {
      return false;
    }

    setText(
      errorNode,
      t(dictionary, "services.cards.hourly.panel.reviewPage.error")
    );
    setHidden(errorNode, false);

    return true;
  }

  function waitForPublicConfigReady() {
    var loader = window.PixkuyBookingPublicConfig;

    if (
      !loader ||
      !loader.ready ||
      typeof loader.ready.then !== "function"
    ) {
      return Promise.resolve();
    }

    return loader.ready.catch(function ignorePublicConfigError() {
      return undefined;
    });
  }

  function getRecaptchaToken() {
    return waitForPublicConfigReady()
      .then(function executeRecaptchaAfterConfig() {
        var recaptcha = window.PixkuyRecaptchaEnterprise;

        if (!recaptcha || typeof recaptcha.execute !== "function") {
          return "";
        }

        return recaptcha.execute("hourly_checkout");
      })
      .then(function normalizeRecaptchaToken(token) {
        return normalizeText(token);
      })
      .catch(function ignoreRecaptchaError() {
        return "";
      });
  }

  function requestCheckout(snapshot) {
    var config = getConfig();
    var payload = buildPayload(snapshot);
    var apiBaseUrl;
    var checkoutUrl;

    if (!payload) {
      return Promise.reject(new Error("INVALID_CHECKOUT_REVIEW_PAYLOAD"));
    }

    apiBaseUrl = normalizeText(config.apiBaseUrl);
    checkoutUrl = apiBaseUrl
      ? apiBaseUrl.replace(/\/+$/, "") + CHECKOUT_ENDPOINT
      : CHECKOUT_ENDPOINT;

    return getRecaptchaToken()
      .then(function addRecaptchaToken(recaptchaToken) {
        if (normalizeText(recaptchaToken)) {
          payload.recaptchaToken = normalizeText(recaptchaToken);
        }

        return window.fetch(
          checkoutUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Pixkuy-Site-Key": config.publicSiteKey,
              "Idempotency-Key": "pixkuy-review-" + Date.now() + "-" + Math.random().toString(36).slice(2)
            },
            body: JSON.stringify(payload)
          }
        );
      })
      .then(function parseResponse(response) {
        return response.json().catch(function () {
          return {};
        }).then(function withBody(body) {
          return {
            ok: response.ok,
            statusCode: response.status,
            body: body
          };
        });
      });
  }

  function bindActions(snapshot, dictionary) {
    var proceed = getNode("[data-hourly-checkout-review-proceed]");
    var edit = getNode("[data-hourly-checkout-review-edit]");

    if (edit) {
      edit.setAttribute("href", "/#contact");

      edit.addEventListener("click", function onEditClick() {
        try {
          window.sessionStorage.setItem(
            "pixkuy_hourly_checkout_review_return",
            "1"
          );
        } catch (error) {
          // no-op
        }
      });
    }

    if (!proceed) {
      return false;
    }

    proceed.addEventListener("click", function onProceedClick() {
      setBusy(true);

      requestCheckout(snapshot)
        .then(function onCheckoutResult(result) {
          var checkoutUrl = result && result.body ? result.body.checkoutUrl : "";
          var bookingStatusToken = result && result.body ? result.body.bookingStatusToken : "";

          if (!result.ok || !checkoutUrl || !bookingStatusToken) {
            throw new Error("BOOKING_API_CHECKOUT_FAILED");
          }

          if (!redirectToCheckout(checkoutUrl, bookingStatusToken)) {
            throw new Error("BOOKING_CHECKOUT_HANDOFF_FAILED");
          }
        })
        .catch(function onCheckoutError() {
          setBusy(false);
          showError(dictionary);
        });
    });

    return true;
  }

  function init() {
    var snapshot = readSnapshot();

    loadDictionary().then(function onDictionaryLoaded(dictionary) {
      renderSnapshot(snapshot, dictionary);

      if (snapshot) {
        bindActions(snapshot, dictionary);
      }
    });

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);