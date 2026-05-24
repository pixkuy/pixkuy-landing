/* assets/js/forms/booking-checkout-handoff.js
   Handoff controlado hacia Stripe Checkout.
   Responsabilidad:
   - abrir Stripe desde una URL propia de Pixkuy
   - convertir back del navegador desde Stripe en booking-cancelled
   No confirma reservas.
   No consulta status.
*/

(function initBookingCheckoutHandoff(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var STORAGE_PREFIX = "pixkuy_booking_checkout:";
  var I18N_BASE = "/assets/i18n";
  var FALLBACK_LANG = "es";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeLangCode(value) {
    var normalized = normalizeText(value).toLowerCase().replace(/_/g, "-");

    if (
      normalized === "zh-hans" ||
      normalized === "zh-cn" ||
      normalized === "zh-hans-cn"
    ) {
      return "zh-hans";
    }

    if (normalized.indexOf("-") > -1) {
      return normalized.split("-")[0];
    }

    return normalized || FALLBACK_LANG;
  }

  function getActiveLang() {
    var params;
    var langParam;
    var storedLang;
    var fromUrl;
    var fromStorage;

    try {
      params = new URLSearchParams(window.location.search);
      langParam = normalizeText(params.get("lang"));

      if (langParam) {
        fromUrl = normalizeLangCode(langParam);

        if (fromUrl) {
          return fromUrl;
        }
      }
    } catch (error) {
      // no-op
    }

    try {
      storedLang = normalizeText(window.localStorage.getItem("lang"));

      if (storedLang) {
        fromStorage = normalizeLangCode(storedLang);

        if (fromStorage) {
          return fromStorage;
        }
      }
    } catch (error) {
      // no-op
    }

    return normalizeLangCode(window.navigator && window.navigator.language) || FALLBACK_LANG;
  }

  function getToken() {
    var params;

    try {
      params = new URLSearchParams(window.location.search);
      return normalizeText(params.get("token"));
    } catch (error) {
      return "";
    }
  }

  function buildStorageKey(token) {
    return STORAGE_PREFIX + token;
  }

  function buildI18nUrl(lang) {
    return [
      I18N_BASE,
      encodeURIComponent(lang),
      "booking-status.json"
    ].join("/");
  }

  function fetchJson(url) {
    return window.fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP_" + response.status);
      }

      return response.json();
    });
  }

  function loadDictionary(preferredLang) {
    return fetchJson(buildI18nUrl(preferredLang))
      .then(function (dict) {
        return {
          lang: preferredLang,
          dict: dict
        };
      })
      .catch(function () {
        if (preferredLang === FALLBACK_LANG) {
          throw new Error("BOOKING_CHECKOUT_I18N_NOT_AVAILABLE");
        }

        return fetchJson(buildI18nUrl(FALLBACK_LANG)).then(function (dict) {
          return {
            lang: FALLBACK_LANG,
            dict: dict
          };
        });
      })
      .then(function (result) {
        if (!result.dict || !result.dict.bookingStatus) {
          throw new Error("BOOKING_CHECKOUT_I18N_INVALID");
        }

        return {
          lang: result.lang,
          dictionary: result.dict.bookingStatus
        };
      });
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

  function setText(selector, value) {
    var node = document.querySelector(selector);

    if (!node) {
      return false;
    }

    node.textContent = value || "";
    return true;
  }

  function setVisible(selector, isVisible) {
    var node = document.querySelector(selector);

    if (!node) {
      return false;
    }

    node.hidden = !isVisible;
    node.style.display = isVisible ? "" : "none";

    return true;
  }

  function render(dictionary, mode) {
    var isError = mode === "error";

    document.title = t(dictionary, "checkout.meta.title") || document.title;
    document.documentElement.removeAttribute("data-booking-checkout-i18n");

    setText("[data-booking-checkout-state]", t(dictionary, "checkout.state"));
    setText(
      "[data-booking-checkout-title]",
      isError
        ? t(dictionary, "checkout.errorTitle")
        : t(dictionary, "checkout.title")
    );
    setText(
      "[data-booking-checkout-lead]",
      isError
        ? t(dictionary, "checkout.errorLead")
        : t(dictionary, "checkout.lead")
    );
    setText("[data-booking-checkout-notice]", t(dictionary, "checkout.notice"));
    setText("[data-booking-checkout-new]", t(dictionary, "cancelled.actions.newBooking"));
    setText("[data-booking-checkout-whatsapp]", t(dictionary, "actions.whatsapp"));

    setVisible("[data-booking-checkout-notice]", isError);
    setVisible("[data-booking-checkout-new]", isError);
    setVisible("[data-booking-checkout-whatsapp]", isError);
  }

  function readHandoff(token) {
    var raw;

    try {
      raw = window.sessionStorage.getItem(buildStorageKey(token));
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeHandoff(token, value) {
    try {
      window.sessionStorage.setItem(
        buildStorageKey(token),
        JSON.stringify(value)
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearHandoff(token) {
    try {
      window.sessionStorage.removeItem(buildStorageKey(token));
      return true;
    } catch (error) {
      return false;
    }
  }

  function goToCancelled(token) {
    var target = token
      ? "/booking-cancelled.html?token=" + encodeURIComponent(token)
      : "/booking-cancelled.html";

    window.location.replace(target);
  }

  function isValidCheckoutUrl(value) {
    var url = normalizeText(value);

    return Boolean(
      url &&
      /^https:\/\/checkout\.stripe\.com\//.test(url)
    );
  }

  function continueToStripe(token, handoff) {
    var nextHandoff = Object.assign({}, handoff, {
      redirected: true,
      redirectedAt: new Date().toISOString()
    });

    writeHandoff(token, nextHandoff);
    window.location.assign(handoff.checkoutUrl);
  }

  function handleCheckoutPage(dictionary) {
    var token = getToken();
    var handoff = token ? readHandoff(token) : null;

    if (!token || !handoff || !isValidCheckoutUrl(handoff.checkoutUrl)) {
      render(dictionary, "error");
      return false;
    }

    if (handoff.redirected === true) {
      clearHandoff(token);
      goToCancelled(token);
      return true;
    }

    render(dictionary, "loading");

    window.setTimeout(function openStripeCheckout() {
      continueToStripe(token, handoff);
    }, 80);

    return true;
  }

  function init() {
    var preferredLang = getActiveLang();

    loadDictionary(preferredLang)
      .then(function (loaded) {
        document.documentElement.lang = loaded.lang;
        handleCheckoutPage(loaded.dictionary);
      })
      .catch(function () {
        document.documentElement.removeAttribute("data-booking-checkout-i18n");
      });
  }

  window.PixkuyBookingCheckoutHandoff = {
    storagePrefix: STORAGE_PREFIX
  };

  window.addEventListener("pageshow", function onPageShow(event) {
    if (event.persisted) {
      init();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);