/* assets/js/forms/direct-transfer-checkout-review-page.js
   Direct Transfer checkout review page.
   Responsabilidad:
   - leer snapshot desktop Direct Transfer desde sessionStorage
   - pintar resumen de traslado
   - permitir volver a editar datos
   - iniciar checkout Booking API/Stripe solo desde esta pagina
*/

(function initDirectTransferCheckoutReviewPage(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DEFAULT_BOOKING_API_BASE_URL = "http://localhost:3002";
  var DEFAULT_PUBLIC_SITE_KEY = "local_pixkuy_site_key";
  var CHECKOUT_ENDPOINT = "/v1/public/reservations/checkout";
  var PRECHECK_ENDPOINT = "/v1/public/reservations/direct-transfer-availability-precheck";
  var BOOKING_CHECKOUT_HANDOFF_PATH = "/booking-checkout.html";
  var BOOKING_CHECKOUT_STORAGE_PREFIX = "pixkuy_booking_checkout:";
  var I18N_BASE = "assets/i18n";
  var I18N_FILE = "direct-transfer-checkout.json";
  var FALLBACK_LANG = "en";
  var API_CONFIG_ERROR_CODE = "DIRECT_TRANSFER_BOOKING_API_CONFIG_INVALID";
  var currentDictionary = {};
  var checkoutBusy = false;
  function pendingAttempt() {
    var attempt = window.PixkuyFleetSelection.read("direct_transfer").attempt;
    return attempt && attempt.state !== "not_committed";
  }
  function closedCheckoutAttempt() {
    var attempt = window.PixkuyFleetSelection.read("direct_transfer").attempt;
    var response = attempt && attempt.response;
    return rejectedExpiredAttempt() || attempt && attempt.state === "committed" && response && response.bookingStatusToken &&
      response.code === "CHECKOUT_PAYMENT_WINDOW_CLOSED" && response.recovery &&
      response.recovery.state === "committed" && response.recovery.action === "reservation_status";
  }
  function rejectedExpiredAttempt() {
    var attempt = window.PixkuyFleetSelection.read("direct_transfer").attempt;
    var response = attempt && attempt.response;
    return Boolean(attempt && attempt.state === "not_committed" && response &&
      ["BOOKING_STATUS_TOKEN_EXPIRED", "CHECKOUT_PAYMENT_WINDOW_CLOSED"].indexOf(response.code) !== -1 &&
      response.recovery && response.recovery.state === "not_committed" && response.recovery.action === "reservation_status");
  }
  function syncRecovery() {
    var proceed = getNode("[data-direct-transfer-checkout-review-proceed]");
    var edit = getNode("[data-direct-transfer-checkout-review-edit]");
    var pending = pendingAttempt();
    if (proceed && pending) proceed.textContent = t(currentDictionary, "recover", "");
    if (edit) { edit.hidden = !!pending; edit.setAttribute("aria-disabled", pending ? "true" : "false"); }
    if (pending) showError(currentDictionary, {code:"CHECKOUT_STATE_UNCERTAIN"});
    if (rejectedExpiredAttempt()) {
      if (proceed) { proceed.disabled = true; proceed.setAttribute("aria-disabled", "true"); }
      showError(currentDictionary, {});
    }
  }

  function getStateApi() {
    var api = window.PixkuyDirectTransferTransactionalState;

    return api && typeof api === "object" ? api : null;
  }

  function normalizeText(value) {
    var api = getStateApi();

    if (api && typeof api.normalizeText === "function") {
      return api.normalizeText(value);
    }

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

  function isHttpsPage() {
    return Boolean(window.location && window.location.protocol === "https:");
  }

  function isInsecureApiBaseUrl(apiBaseUrl) {
    return Boolean(
      isHttpsPage() &&
        /^http:\/\//i.test(normalizeText(apiBaseUrl))
    );
  }

  function assertSafeApiBaseUrl(apiBaseUrl) {
    var normalized = normalizeText(apiBaseUrl);

    if (isInsecureApiBaseUrl(normalized)) {
      throw new Error(API_CONFIG_ERROR_CODE);
    }

    return normalized;
  }

  function isApiConfigurationError(error) {
    return Boolean(
      error &&
        (
          error.message === API_CONFIG_ERROR_CODE ||
          error.code === API_CONFIG_ERROR_CODE
        )
    );
  }

  function getNode(selector) {
    return document.querySelector(selector);
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
      apiBaseUrl = DEFAULT_BOOKING_API_BASE_URL;
    }

    return {
      apiBaseUrl: apiBaseUrl || DEFAULT_BOOKING_API_BASE_URL,
      publicSiteKey: normalizeText(config.publicSiteKey) || DEFAULT_PUBLIC_SITE_KEY,
      recaptchaSiteKey: normalizeText(config.recaptchaSiteKey)
    };
  }

  function buildCheckoutUrl(config) {
    var apiBaseUrl = normalizeText(config && config.apiBaseUrl);

    if (isInsecureApiBaseUrl(apiBaseUrl)) {
      apiBaseUrl = "";
    }

    return apiBaseUrl
      ? apiBaseUrl.replace(/\/+$/, "") + CHECKOUT_ENDPOINT
      : CHECKOUT_ENDPOINT;
  }

  function buildPrecheckUrl(config) {
    var apiBaseUrl = normalizeText(config && config.apiBaseUrl);

    if (isInsecureApiBaseUrl(apiBaseUrl)) {
      apiBaseUrl = "";
    }

    return apiBaseUrl
      ? apiBaseUrl.replace(/\/+$/, "") + PRECHECK_ENDPOINT
      : PRECHECK_ENDPOINT;
  }

  function normalizeLangCode(value) {
    var normalized = normalizeText(value).toLowerCase().replace(/_/g, "-");

    if (
      normalized === "zh-cn" ||
      normalized === "zh-hans-cn"
    ) {
      return "zh-hans";
    }

    if (normalized.indexOf("-") > -1 && normalized !== "zh-hans") {
      return normalized.split("-")[0];
    }

    return normalized || "es";
  }

  function getPreferredLang() {
    var params;
    var langParam;
    var storedLang;

    try {
      params = new URLSearchParams(window.location.search || "");
      langParam = normalizeText(params.get("lang"));

      if (langParam) {
        return normalizeLangCode(langParam);
      }
    } catch (error) {
      // no-op
    }

    try {
      storedLang = normalizeText(window.localStorage.getItem("lang"));

      if (storedLang) {
        return normalizeLangCode(storedLang);
      }
    } catch (error) {
      // no-op
    }

    return normalizeLangCode(
      document.documentElement.lang ||
      window.navigator && window.navigator.language
    );
  }

  function buildI18nUrl(lang) {
    return [
      I18N_BASE,
      encodeURIComponent(lang),
      I18N_FILE
    ].join("/");
  }

  function fetchJson(url) {
    return window.fetch(url, {
      credentials: "same-origin",
      cache: "no-store"
    }).then(function parseResponse(response) {
      if (!response.ok) {
        throw new Error("HTTP_" + response.status);
      }

      return response.json();
    });
  }

  function loadDictionary() {
    var preferred = getPreferredLang();

    return fetchJson(buildI18nUrl(preferred))
      .catch(function fallbackToEnglish() {
        if (preferred === FALLBACK_LANG) {
          return {};
        }

        return fetchJson(buildI18nUrl(FALLBACK_LANG)).catch(function emptyDict() {
          return {};
        });
      })
      .then(function unwrapDictionary(dict) {
        return dict && dict.directTransferCheckout
          ? dict.directTransferCheckout
          : {};
      });
  }

  function t(dict, path, fallback) {
    var parts = String(path || "").split(".");
    var cursor = dict;
    var index;

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
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

    node.textContent = value || "";
    return true;
  }

  function readSnapshot() {
    var api = getStateApi();

    return api && typeof api.readReviewSnapshot === "function"
      ? api.readReviewSnapshot()
      : null;
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

  function buildVehicleRow(label, value, selectedModel) {
    var safeLabel = normalizeText(label);
    var safeValue = normalizeText(value);
    var photo = selectedModel ? window.PixkuyFleetSelection.photo(selectedModel) : "";

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
      photo ? '<span class="booking-status__vehicle-media" aria-hidden="true"><img src="' + escapeHtml(photo) + '" alt="" decoding="async"></span>' : "",
      "</dd>",
      "</div>"
    ].join("");
  }

  function formatPrice(snapshot) {
    if(window.PixkuyBookingPresentation)return window.PixkuyBookingPresentation.money(Number(snapshot.direct_transfer_amount_minor),snapshot.direct_transfer_currency || 'MXN');
    var label = normalizeText(snapshot.direct_transfer_price_label);
    var amount = Number(snapshot.direct_transfer_price);
    var currency = normalizeText(snapshot.direct_transfer_currency) || "MXN";

    if (label) {
      return label;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 0
      }).format(amount) + " " + currency;
    } catch (error) {
      return String(Math.round(amount)) + " " + currency;
    }
  }

  function formatEstimate(snapshot, dictionary) {
    if(window.PixkuyBookingPresentation)return window.PixkuyBookingPresentation.distanceTime(snapshot.direct_transfer_distance_meters,snapshot.direct_transfer_duration_seconds);
    var distance = Number(snapshot.direct_transfer_distance_meters);
    var seconds = Number(snapshot.direct_transfer_duration_seconds);
    var parts = [];
    var kilometers;
    var minutes;

    if (Number.isFinite(distance) && distance > 0) {
      kilometers = distance / 1000;
      parts.push(
        String(
          kilometers >= 10
            ? Math.round(kilometers)
            : Math.round(kilometers * 10) / 10
        ).replace(".", ",") + " " + t(dictionary, "units.km", "km")
      );
    }

    if (Number.isFinite(seconds) && seconds > 0) {
      minutes = Math.max(1, Math.round(seconds / 60));
      parts.push(
        String(minutes) + " " + t(dictionary, "units.minutes", "min")
      );
    }

    return parts.join(t(dictionary, "estimateSeparator", " | "));
  }

  function getPassengerLabel(snapshot, dictionary) {
    var fareKey = normalizeText(snapshot.direct_transfer_passenger_fare_key);

    return normalizeText(snapshot.direct_transfer_passenger_bucket_label) ||
      t(dictionary, "passengerBuckets." + fareKey, fareKey);
  }

  function desktopEdit(field) {
    if(checkoutBusy || pendingAttempt())return;
    if(window.PixkuyDirectPendingEdit?.route() && field !== 'contact'){window.PixkuyDirectPendingEdit.configure();return;}
    window.sessionStorage.setItem(getStateApi().returnKey,"1");
    location.assign("/?service=direct_transfer&lang="+encodeURIComponent(getPreferredLang())+(field==="notes"?"#direct/servicio/notes":field==="trip"?"#direct/servicio":"#direct/datos"));
  }
  function renderDesktopDetails(snapshot) {
    var base=window.PixkuyAirportDesktopView,view=window.PixkuyDirectDesktopView,content=getNode("[data-direct-transfer-checkout-review-content]");
    var editing=window.PixkuyDirectPendingEdit?.route();
    var root=document.querySelector('[data-direct-desktop-review]');
    if(!root){
      root=base.shell(2,function(){desktopEdit('trip');},function(){getNode('[data-direct-transfer-checkout-review-edit]').click();},{showBack:false});
      root.classList.add('direct-booking');root.setAttribute('data-direct-desktop-review','');document.body.appendChild(root);root.appendChild(content);
    } else {
      var header=base.shell(2,function(){desktopEdit('trip');},function(){getNode('[data-direct-transfer-checkout-review-edit]').click();},{showBack:false});
      ['.airport-booking__header','.airport-booking__step-caption','.airport-booking__progress'].forEach(function(selector){root.querySelector(selector).replaceWith(header.querySelector(selector));});
    }
    document.body.classList.add('direct-booking-active');
    content.classList.remove('booking-status__content');

    var details=getNode('[data-direct-transfer-checkout-review-details]');details.hidden=true;
    var layout=content.querySelector('[data-direct-review-layout]');
    if(layout){['#direct-transfer-checkout-review-title','[data-direct-transfer-checkout-review-copy="text"]','[data-direct-transfer-checkout-review-legal]','[data-direct-transfer-checkout-review-error]','.booking-status__actions'].forEach(function(selector){var node=layout.querySelector(selector);if(node)content.appendChild(node);});layout.remove();}
    layout=base.node('div','airport-booking__layout');layout.setAttribute('data-direct-review-layout','');
    var left=base.node('div','airport-booking__main');
    var title=getNode('#direct-transfer-checkout-review-title'),lead=getNode('[data-direct-transfer-checkout-review-copy="text"]');
    title.className='';lead.className='airport-booking__lead';left.append(title,lead);
    left.appendChild(view.block('yourTrip',view.trip(snapshot),editing?null:function(){desktopEdit('trip');}));
    var contact=base.node('dl','airport-booking__details');['name','phone','email'].forEach(function(k){contact.appendChild(base.field(base.t(k),snapshot[k]));});
    left.appendChild(view.block('contact',contact,function(){getNode('[data-direct-transfer-checkout-review-edit]').click();}));
    left.appendChild(view.block('notes',base.node('p','',snapshot.direct_transfer_notes||'—'),editing?null:function(){desktopEdit('notes');}));
    left.appendChild(getNode('[data-direct-transfer-checkout-review-legal]'));
    var aside=view.summary(snapshot);layout.append(left,aside);details.after(layout);
    ['[data-direct-transfer-checkout-review-error]','.booking-status__actions'].forEach(function(selector){var node=content.querySelector(selector);if(node)aside.appendChild(node);});
    var proceed=getNode('[data-direct-transfer-checkout-review-proceed]');if(proceed)proceed.className='cta airport-booking__primary';
    var edit=getNode('[data-direct-transfer-checkout-review-edit]');if(edit)edit.className='airport-booking__link';
    return true;
  }

  function renderDetails(snapshot, dictionary) {
    if (window.matchMedia("(min-width:721px)").matches) return renderDesktopDetails(snapshot);
    var details = getNode("[data-direct-transfer-checkout-review-details]");
    var notes = normalizeText(snapshot.direct_transfer_notes || snapshot.message);
    var estimate = formatEstimate(snapshot, dictionary);

    if (!details) {
      return false;
    }

    details.innerHTML = [
      buildRow(t(dictionary, "details.service", "Servicio"), t(dictionary, "serviceValue", "Direct transfer"), "service"),
      buildRow(t(dictionary, "details.origin", "Origen"), snapshot.direct_transfer_origin_address, "origin"),
      buildRow(t(dictionary, "details.destination", "Destino"), snapshot.direct_transfer_destination_address, "destination"),
      buildRow(t(dictionary, "details.date", "Fecha"), window.PixkuyBookingPresentation.date(snapshot.direct_transfer_date), "date"),
      buildRow(t(dictionary, "details.time", "Hora"), snapshot.direct_transfer_time, "time"),
      buildRow(t(dictionary, "details.passengers", "Pasajeros"), getPassengerLabel(snapshot, dictionary), "passengers"),
      buildVehicleRow(t(dictionary, "details.vehicle", "Vehiculo"), (snapshot.fleet_model ? snapshot.fleet_model.name : normalizeText(snapshot.direct_transfer_vehicle_label) || t(dictionary, "vehicleValue", "BYD M9")), snapshot.fleet_model),
      estimate ? buildRow(t(dictionary, "details.estimate", "Ruta"), estimate, "estimate") : "",
      buildRow(t(dictionary, "details.price", "Precio"), formatPrice(snapshot), "price"),
      buildRow(t(dictionary, "details.name", "Nombre"), snapshot.name, "customer-name"),
      buildRow(t(dictionary, "details.phone", "Telefono"), snapshot.phone, "customer-phone"),
      buildRow(t(dictionary, "details.email", "Email"), snapshot.email, "customer-email"),
      notes ? buildRow(t(dictionary, "details.notes", "Notas"), notes, "notes") : ""
    ].join("");

    document.querySelectorAll('[data-direct-review-contact],[data-direct-review-total]').forEach(function (node) { node.remove(); });
    var edit = getNode("[data-direct-transfer-checkout-review-edit]");
    var actions = getNode("[data-direct-transfer-checkout-review-content] .booking-status__actions");
    if (window.matchMedia("(max-width:720px)").matches) {
      var contact = document.createElement("dl");
      contact.className = "booking-status__details direct-transfer-checkout-review__contact";
      contact.setAttribute("data-direct-review-contact", "");
      var heading=document.createElement('h2');heading.textContent=t(dictionary,'contactTitle','');contact.appendChild(heading);
      details.querySelectorAll('[class*="--customer-"],.booking-status__detail--notes').forEach(function (row) { contact.appendChild(row); });
      details.after(contact);
      var total = document.createElement("dl");
      total.className = "direct-transfer-checkout-review__total";
      total.setAttribute("data-direct-review-total", "");
      total.appendChild(details.querySelector('.booking-status__detail--price'));
      getNode("[data-direct-transfer-checkout-review-legal]").after(total);
      if (edit) getNode("[data-direct-transfer-checkout-review-content]").prepend(edit);
    } else if (edit && actions) actions.appendChild(edit);
    return true;
  }

  function renderLegal(snapshot, dictionary) {
    var legal = getNode("[data-direct-transfer-checkout-review-legal]");
    var acceptedAt = normalizeText(snapshot.legal_acceptance_accepted_at);

    if (!legal) {
      return false;
    }

    legal.innerHTML = [
      '<div class="direct-transfer-checkout-review__legal-card">',
      "<strong>",
      escapeHtml(t(dictionary, acceptedAt ? "acceptedTitle" : "legalTitle", "Condiciones")),
      "</strong>",
      "<p>",
      escapeHtml(
        acceptedAt
          ? t(dictionary, "legalText", "Legal terms accepted before payment.")
          : t(dictionary, "legalTextFallback", "Legal terms are required before payment.")
      ),
      "</p>",
      "</div>"
    ].join("");

    var desktop=window.matchMedia("(min-width:721px)").matches;
    legal.classList.toggle('booking-status__notice',!desktop);
    legal.classList.toggle('airport-booking__conditions',desktop);
    if(desktop){
      var base=window.PixkuyAirportDesktopView,status=base.node('p','airport-booking__conditions-status');
      status.append(base.icon('check'),base.node('span','',base.t(acceptedAt?'accepted':'conditions')));
      legal.replaceChildren(status);
    }
    legal.classList.toggle('direct-transfer-checkout-review__legal--accepted',!!acceptedAt);
    var links=desktop?window.PixkuyAirportDesktopView.node('div','legal-acceptance__links'):legal;
    if(desktop)legal.appendChild(links);
    var copy = window.__pixkuyI18nDict && window.__pixkuyI18nDict.terms && window.__pixkuyI18nDict.terms.acceptance;
    if (copy) [ ['terms','viewTerms'], ['cancellations','viewCancellations'], ['privacy','viewPrivacy'] ].forEach(function (entry, index) {
      if(index&&!desktop)links.appendChild(document.createTextNode(' · '));
      var link=document.createElement('a');link.href='legal/'+entry[0]+'.html?lang='+encodeURIComponent(getPreferredLang());
      link.textContent=copy[entry[1]];if(desktop)link.prepend(window.PixkuyAirportDesktopView.icon('document'));links.appendChild(link);
    });

    return true;
  }

  function renderStaticCopy(dictionary) {
    Array.prototype.slice.call(
      document.querySelectorAll("[data-direct-transfer-checkout-review-copy]")
    ).forEach(function renderCopy(node) {
      var path = normalizeText(
        node.getAttribute("data-direct-transfer-checkout-review-copy")
      );

      setText(node, t(dictionary, path, ""));
    });

    return true;
  }

  function renderSnapshot(snapshot, dictionary) {
    currentDictionary = dictionary;
    var empty = getNode("[data-direct-transfer-checkout-review-empty]");
    var content = getNode("[data-direct-transfer-checkout-review-content]");
    var stateApi = getStateApi();

    renderStaticCopy(dictionary);

    if (
      !snapshot ||
      !stateApi ||
      !stateApi.isSnapshotReadyForPrecheck(snapshot) ||
      (
        typeof stateApi.hasLegalAcceptance === "function" &&
        !stateApi.hasLegalAcceptance(snapshot)
      )
    ) {
      setHidden(empty, false);
      setHidden(content, true);
      return false;
    }

    renderDetails(snapshot, dictionary);
    renderLegal(snapshot, dictionary);

    setHidden(empty, true);
    setHidden(content, false);
    syncRecovery();

    return true;
  }

  function setBusy(isBusy) {
    checkoutBusy = Boolean(isBusy);
    var proceed = getNode("[data-direct-transfer-checkout-review-proceed]");

    if (!proceed) {
      return false;
    }

    proceed.disabled = Boolean(isBusy);
    proceed.setAttribute("aria-disabled", isBusy ? "true" : "false");
    return true;
  }

  function getApiConfigurationErrorMessage(dictionary) {
    return t(
      dictionary,
      "configurationError",
      "Booking API configuration is not available for this page."
    );
  }

  function showError(dictionary, error) {
    var errorNode = getNode("[data-direct-transfer-checkout-review-error]");
    var code = normalizeText(error && (error.code || error.message));
    var message;

    var precheck = error && error.result && error.result.body && error.result.body.result;
    if (closedCheckoutAttempt()) {
      // Preserve the attempt and its recovery action, but do not turn a known
      // terminal response into an unknown outcome (including after reload).
      message = window.PixkuyAirportDesktopView.t("paymentWindowClosed");
    } else if (pendingAttempt() || code === "CHECKOUT_STATE_UNCERTAIN") {
      message = t(dictionary, "uncertain", "");
    } else if (isApiConfigurationError(error)) {
      message = getApiConfigurationErrorMessage(dictionary);
    } else if (error && (error.httpStatus >= 500 || error.result && error.result.statusCode >= 500 || error.name === "TypeError")) {
      message = t(dictionary, "availabilityTechnical", "");
    } else if (code === "DIRECT_TRANSFER_QUOTE_UPDATED") {
      message = t(dictionary, "quote.updated", "");
    } else if (code === "DIRECT_TRANSFER_PRICE_MISMATCH") {
      message = t(dictionary, "quote.priceUpdated", "");
    } else if (code === "DIRECT_TRANSFER_QUOTE_STALE") {
      message = t(dictionary, "quote.stale", "");
    } else if (
      code === "DIRECT_TRANSFER_PRICING_VERSION_MISMATCH" ||
      code === "DIRECT_TRANSFER_REQUOTE_REQUIRED" ||
      code === "DIRECT_TRANSFER_QUOTE_REQUIRED" ||
      code === "DIRECT_TRANSFER_QUOTE_ACCEPTANCE_INVALID"
    ) {
      message = t(dictionary, "quote.requoteRequired", "");
    } else if (code === "DIRECT_TRANSFER_QUOTE_FINGERPRINT_MISMATCH") {
      message = t(dictionary, "quote.tampered", "");
    } else if (precheck && ((precheck.fleet && precheck.fleet.status === "unavailable") ||
      (precheck.availability && precheck.availability.available === false))) {
      message = t(dictionary, "availabilityUnavailable", "");
    } else {
      message = t(dictionary, "error", "Review the transfer details before continuing.");
    }

    if (!errorNode) {
      return false;
    }

    setText(errorNode, message);
    if (error && error.before && error.after) {
      [
        ["price", formatPrice(error.before), formatPrice(error.after)],
        ["estimate", quoteRouteLabel(error.before), quoteRouteLabel(error.after)],
        ["vehicle", normalizeText(error.before.fleet_model && error.before.fleet_model.name), normalizeText(error.after.fleet_model && error.after.fleet_model.name)]
      ].forEach(function (entry) {
        if (entry[1] === entry[2]) return;
        var difference = document.createElement("p");
        difference.textContent = t(dictionary, "details." + entry[0], "") + ": " + entry[1] + " → " + entry[2];
        errorNode.appendChild(difference);
      });
    }
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

        return recaptcha.execute("direct_transfer_checkout");
      })
      .then(function normalizeRecaptchaToken(token) {
        return normalizeText(token);
      })
      .catch(function ignoreRecaptchaError() {
        return "";
      });
  }

  function getPrecheckCode(result) {
    var body = result && result.body;
    var precheck = body && body.result && typeof body.result === "object"
      ? body.result
      : {};
    var availability = precheck.availability && typeof precheck.availability === "object"
      ? precheck.availability
      : {};

    return normalizeText(availability.code) ||
      normalizeText(body && body.code) ||
      "DIRECT_TRANSFER_REQUOTE_REQUIRED";
  }

  function getPrecheckPrice(result) {
    var body = result && result.body;
    var precheck = body && body.result && typeof body.result === "object"
      ? body.result
      : {};

    return precheck.price && typeof precheck.price === "object"
      ? precheck.price
      : {};
  }

  function isPrecheckAllowed(result) {
    return Boolean(
      result &&
      result.ok &&
      result.body &&
      result.body.result &&
      result.body.result.checkoutAllowed === true
    );
  }

  function requestPrecheck(snapshot, options) {
    var stateApi = getStateApi();
    var config = getConfig();
    var payload = stateApi && stateApi.buildPrecheckPayload(snapshot, options);

    if (!payload) {
      return Promise.reject(new Error("DIRECT_TRANSFER_REQUOTE_REQUIRED"));
    }

    return window.PixkuyFleetSelection.fetchPrecheck("direct_transfer", buildPrecheckUrl(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pixkuy-Site-Key": config.publicSiteKey
      },
      body: JSON.stringify(payload)
    }).then(function parsePrecheckResponse(response) {
      return response.json().catch(function () {
        return {};
      }).then(function withPrecheckBody(body) {
        return {
          ok: response.ok,
          statusCode: response.status,
          body: body
        };
      });
    });
  }

  function quoteRouteLabel(snapshot) {
    var locale = getPreferredLang();
    return new Intl.NumberFormat(locale, {style:"unit", unit:"meter"}).format(Number(snapshot.direct_transfer_distance_meters)) + " · " +
      new Intl.NumberFormat(locale, {style:"unit", unit:"second"}).format(Number(snapshot.direct_transfer_duration_seconds));
  }

  // Expiry is a certificate lifetime, not a travel condition. The backend's
  // fingerprint still includes it (and duration); never synthesize that hash.
  function quoteConditions(snapshot) {
    var context = getStateApi().buildPrecheckPayload(snapshot, {compareCanonicalQuote:false});
    if (context) delete context.locale;
    return JSON.stringify([context, Number(snapshot.direct_transfer_amount_minor), snapshot.direct_transfer_currency,
      snapshot.direct_transfer_pricing_version, Number(snapshot.direct_transfer_distance_meters),
      Number(snapshot.direct_transfer_duration_seconds), snapshot.fleet_selection && snapshot.fleet_selection.model_id,
      snapshot.fleet_selection && snapshot.fleet_selection.model_revision]);
  }

  function quoteExpired(snapshot) {
    return !(Date.parse(snapshot.direct_transfer_quote_expires_at) > Date.now());
  }

  function prepareDesktopQuote(snapshot, assertCurrent) {
    var renewing = quoteExpired(snapshot);
    return requestPrecheck(snapshot, {compareCanonicalQuote:!renewing}).then(function (result) {
      assertCurrent();
      // The server can observe expiry before the local clock. One fresh quote
      // request, with full route/availability evaluation, never a retry loop.
      if (!renewing && getPrecheckCode(result) === "DIRECT_TRANSFER_QUOTE_STALE") {
        return requestPrecheck(snapshot, {compareCanonicalQuote:false}).then(function (fresh) { assertCurrent(); return fresh; });
      }
      return result;
    });
  }

  function requestCheckout(snapshot, assertCurrent, recaptchaToken) {
    var stateApi = getStateApi();

    if (
      !stateApi ||
      !stateApi.isSnapshotComplete(snapshot) ||
      (
        typeof stateApi.hasLegalAcceptance === "function" &&
        !stateApi.hasLegalAcceptance(snapshot)
      )
    ) {
      return Promise.reject(new Error("INVALID_DIRECT_TRANSFER_CHECKOUT_REVIEW_PAYLOAD"));
    }

    return (recaptchaToken === undefined ? getRecaptchaToken() : Promise.resolve(recaptchaToken))
      .then(function addRecaptchaToken(recaptchaToken) {
        if (assertCurrent) {
          assertCurrent();
          if (quoteExpired(snapshot)) throw new Error("DIRECT_TRANSFER_QUOTE_STALE");
        }
        var config = getConfig();
        var checkoutUrl = buildCheckoutUrl(config);
        var payload = stateApi.buildCheckoutPayload(snapshot, {
          recaptchaToken: recaptchaToken
        });

        if (!payload) {
          throw new Error("INVALID_DIRECT_TRANSFER_CHECKOUT_REVIEW_PAYLOAD");
        }

        return window.PixkuyFleetSelection.fetchCheckout("direct_transfer", checkoutUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Pixkuy-Site-Key": config.publicSiteKey,
            "Idempotency-Key": window.PixkuyFleetSelection.createAttemptKey()
          },
          body: JSON.stringify(payload)
        });
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
    var proceed = getNode("[data-direct-transfer-checkout-review-proceed]");
    var edit = getNode("[data-direct-transfer-checkout-review-edit]");
    var stateApi = getStateApi();

    if (edit) {
      edit.setAttribute("href", snapshot.mobileDraft ? "/?service=direct_transfer&lang=" + encodeURIComponent(getPreferredLang()) : "/?service=direct_transfer&lang=" + encodeURIComponent(getPreferredLang()) + "#direct/datos");

      edit.addEventListener("click", function onEditClick(event) {
        if (checkoutBusy || pendingAttempt()) { event.preventDefault(); return; }
        if (!stateApi) {
          return;
        }

        try {
          window.sessionStorage.setItem(stateApi.returnKey, "1");
        } catch (error) {
          // no-op
        }
      });
    }

    if (!proceed) {
      return false;
    }

    proceed.addEventListener("click", function onProceedClick() {
      if (checkoutBusy) return;
      if (rejectedExpiredAttempt()) { syncRecovery(); return; }
      setBusy(true);
      if (pendingAttempt()) {
        window.PixkuyFleetSelection.recoverAttempt("direct_transfer")
          .catch(function (error) { showError(currentDictionary, error); })
          .finally(function () { setBusy(false); syncRecovery(); });
        return;
      }
      var desktop = window.matchMedia("(min-width:721px)").matches;
      if (desktop) {
        snapshot = readSnapshot();
        if (!snapshot) {
          setBusy(false);
          showError(currentDictionary, new Error("INVALID_DIRECT_TRANSFER_CHECKOUT_REVIEW_PAYLOAD"));
          return;
        }
      }
      var reviewedAmount = Number(snapshot.direct_transfer_amount_minor);
      var reviewedModel = snapshot.fleet_selection && snapshot.fleet_selection.model_id;
      var before = JSON.parse(JSON.stringify(snapshot));
      var stored = JSON.stringify(readSnapshot());
      var route = window.location.href;
      var checkoutToken;
      function assertCurrent() {
        if (window.location.href !== route || JSON.stringify(readSnapshot()) !== stored || pendingAttempt()) {
          throw new Error("FLEET_STALE_OFFER");
        }
      }
      setHidden(getNode("[data-direct-transfer-checkout-review-error]"), true);
      // Obtain transport credentials before renewal so their delay cannot age
      // the newly issued quote. Mobile retains its existing transition.
      (desktop ? getRecaptchaToken() : Promise.resolve()).then(function (token) {
        checkoutToken = token;
        if (desktop) assertCurrent();
        return desktop ? prepareDesktopQuote(snapshot, assertCurrent) : requestPrecheck(snapshot);
      })
        .then(function onReviewPrecheck(result) {
          if (desktop) assertCurrent();
          var price = getPrecheckPrice(result);
          var accepted = isPrecheckAllowed(result);
          if (desktop) snapshot = JSON.parse(JSON.stringify(snapshot));

          if (
            !stateApi ||
            typeof stateApi.applyCanonicalQuote !== "function" ||
            !stateApi.applyCanonicalQuote(
              snapshot,
              price,
              accepted && !desktop ? new Date().toISOString() : ""
            )
          ) {
            var missingQuoteError = new Error(getPrecheckCode(result));
            missingQuoteError.code = getPrecheckCode(result);
            missingQuoteError.result = result;
            throw missingQuoteError;
          }

          var fleetState = window.PixkuyFleetSelection.read("direct_transfer");
          if (accepted && (!fleetState.attempt || fleetState.attempt.state === "not_committed")) {
            snapshot = window.PixkuyFleetSelection.snapshot("direct_transfer", snapshot, {refreshSelection:true});
          }
          snapshot.direct_transfer_price_label = "";
          snapshot.direct_transfer_price_label = formatPrice(snapshot);
          var conditionsChanged = desktop ? quoteConditions(before) !== quoteConditions(snapshot) :
            reviewedAmount !== Number(snapshot.direct_transfer_amount_minor) || reviewedModel !== (snapshot.fleet_selection && snapshot.fleet_selection.model_id);
          if (desktop && accepted && !conditionsChanged) snapshot.direct_transfer_quote_accepted_at = new Date().toISOString();
          if (!stateApi.writeReviewSnapshot(snapshot)) throw new Error("HANDOFF_STORAGE_REQUIRED");
          stored = JSON.stringify(readSnapshot());
          renderDetails(snapshot, currentDictionary);

          // Operational duration/distance and model revision remain conditions,
          // even when the payable amount happens to stay the same.
          if (accepted && conditionsChanged) {
            var changed = new Error(desktop ? "DIRECT_TRANSFER_QUOTE_UPDATED" : "DIRECT_TRANSFER_REQUOTE_REQUIRED");
            changed.code = changed.message;
            if (desktop) { changed.before = before; changed.after = snapshot; }
            throw changed;
          }

          if (!accepted) {
            var precheckError = new Error(getPrecheckCode(result));
            precheckError.code = getPrecheckCode(result);
            precheckError.result = result;
            throw precheckError;
          }

          return requestCheckout(snapshot, desktop ? assertCurrent : null, checkoutToken);
        })
        .then(function onCheckoutResult(result) {
          var checkoutUrl = result && result.body ? result.body.checkoutUrl : "";
          var bookingStatusToken =
            result && result.body ? result.body.bookingStatusToken : "";

          if (!result.ok || !checkoutUrl || !bookingStatusToken) {
            throw new Error("BOOKING_API_CHECKOUT_FAILED");
          }

          if (!redirectToCheckout(checkoutUrl, bookingStatusToken)) {
            throw new Error("BOOKING_CHECKOUT_HANDOFF_FAILED");
          }
        })
        .catch(function onCheckoutError(error) {
          setBusy(false);
          showError(currentDictionary, error);
          syncRecovery();
        });
    });

    return true;
  }

  function init() {
    window.addEventListener('pixkuy:airport-desktop-copy',function(){
      if(!window.PixkuyDirectPendingEdit?.route() && readSnapshot()) renderSnapshot(readSnapshot(),currentDictionary);
    });
    if(window.PixkuyDirectPendingEdit?.route()){
      window.PixkuyDirectPendingEdit.mount({renderDetails,renderLegal,renderStaticCopy,loadDictionary,redirectToCheckout});return true;
    }
    var snapshot = readSnapshot();
    window.matchMedia("(max-width:720px)").addEventListener("change", function () {
      if (snapshot) renderSnapshot(readSnapshot() || snapshot, currentDictionary);
    });

    window.addEventListener("pixkuy:i18n-applied", function refreshReviewLanguage() {
      var lang = getPreferredLang();
      loadDictionary().then(function renderCurrentLanguage(dictionary) {
        if (lang === getPreferredLang()) renderSnapshot(readSnapshot() || snapshot, dictionary);
      });
    });

    window.PixkuyAirportDesktopView.ready.then(loadDictionary).then(function onDictionaryLoaded(dictionary) {
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
