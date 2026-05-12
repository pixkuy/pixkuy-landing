/* assets/js/analytics/pixkuy-analytics.js
   Pixkuy analytics layer.
   Responsabilidad:
   - ofrecer una API común para eventos de negocio Pixkuy
   - normalizar payloads antes de enviarlos a GA4
   - respetar consentimiento actual
   - no cargar Google tags
   - no gestionar banners
   - no tocar WhatsApp handoff
   - no tocar Netlify Forms
*/

(function initPixkuyAnalytics(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var CONSENT_STORAGE_KEY = "pixkuy_google_ads_consent";
  var ACCEPTED = "accepted";
  var MAX_QUEUE_SIZE = 40;
  var queue = [];
  var onceKeys = {};

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getStoredConsent() {
    try {
      return window.localStorage.getItem(CONSENT_STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function hasConsent() {
    return getStoredConsent() === ACCEPTED;
  }

  function hasGtag() {
    return typeof window.gtag === "function";
  }

  function getViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 720px)").matches
      ? "mobile"
      : "desktop";
  }

  function getLanguage() {
    return normalizeText(window.__pixkuyI18nLang) ||
      normalizeText(document.documentElement && document.documentElement.lang) ||
      "es";
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function sanitizeKey(key) {
    return String(key || "")
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .slice(0, 40);
  }

  function sanitizeValue(value) {
    if (typeof value === "string") {
      return value.trim().slice(0, 160);
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : "";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return "";
  }

  function sanitizePayload(payload) {
    var safePayload = isPlainObject(payload) ? payload : {};
    var output = {};
    var keys = Object.keys(safePayload);

    keys.forEach(function sanitizeEntry(key) {
      var safeKey = sanitizeKey(key);
      var safeValue;

      if (!safeKey) {
        return;
      }

      safeValue = sanitizeValue(safePayload[key]);

      if (safeValue === "") {
        return;
      }

      output[safeKey] = safeValue;
    });

    return output;
  }

  function buildBasePayload(payload) {
    return Object.assign(
      {
        viewport: getViewport(),
        lang: getLanguage(),
        page_path: window.location ? window.location.pathname : "",
        page_hash: window.location ? window.location.hash : ""
      },
      sanitizePayload(payload)
    );
  }
  
    function getServiceTypeFromHref(href) {
    var url;
    var serviceType;

    try {
      url = new URL(href, window.location.href);
      serviceType = normalizeText(url.searchParams.get("service"));
    } catch (error) {
      return "";
    }

    return serviceType;
  }

  function isMobileServiceEntryLink(link) {
    return Boolean(
      link &&
        link.classList &&
        link.classList.contains("hero-mobile-entry__action") &&
        link.closest(".hero-mobile-entry__actions")
    );
  }

  function enqueue(eventName, payload) {
    if (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift();
    }

    queue.push({
      eventName: eventName,
      payload: payload
    });

    return true;
  }

  function send(eventName, payload) {
    if (!eventName || !hasConsent()) {
      return false;
    }

    if (!hasGtag()) {
      enqueue(eventName, payload);
      return true;
    }

    window.gtag("event", eventName, payload);
    return true;
  }

  function track(eventName, payload) {
    var safeEventName = normalizeText(eventName);
    var eventPayload;

    if (!safeEventName || !hasConsent()) {
      return false;
    }

    eventPayload = buildBasePayload(payload);

    return send(safeEventName, eventPayload);
  }
  
  function trackOnce(eventName, payload, dedupeKey) {
    var safeEventName = normalizeText(eventName);
    var safeDedupeKey = normalizeText(dedupeKey);
    var key;

    if (!safeEventName || !safeDedupeKey || !hasConsent()) {
      return false;
    }

    key = safeEventName + ":" + safeDedupeKey;

    if (onceKeys[key] === true) {
      return false;
    }

    if (!track(safeEventName, payload)) {
      return false;
    }

    onceKeys[key] = true;
    return true;
  }

  function flush() {
    var pending;

    if (!hasConsent() || !hasGtag() || !queue.length) {
      return false;
    }

    pending = queue.slice();
    queue = [];

    pending.forEach(function flushQueuedEvent(item) {
      if (!item || !item.eventName) {
        return;
      }

      window.gtag("event", item.eventName, item.payload || {});
    });

    return true;
  }

  function bindMobileServiceEntryTracking() {
    if (document.documentElement.dataset.pixkuyMobileServiceEntryTrackingBound === "1") {
      return false;
    }

    document.addEventListener("click", function onMobileServiceEntryClick(event) {
      var link = event.target && typeof event.target.closest === "function"
        ? event.target.closest("a")
        : null;
      var serviceType;

      if (!isMobileServiceEntryLink(link)) {
        return;
      }

      serviceType = getServiceTypeFromHref(link.getAttribute("href") || "");

      if (!serviceType) {
        return;
      }

      track("pixkuy_mobile_service_click", {
        service_type: serviceType,
        entry_point: "mobile_home",
        flow_surface: "mobile_entry"
      });
    });

    document.documentElement.dataset.pixkuyMobileServiceEntryTrackingBound = "1";
    return true;
  }

  window.PixkuyAnalytics = {
    track: track,
    trackOnce: trackOnce,
    flush: flush,
    hasConsent: hasConsent
  };

  bindMobileServiceEntryTracking();

  window.addEventListener("pixkuy:analytics-consent-ready", flush);
  window.addEventListener("pixkuy:i18n-applied", flush);
})(window, document);