(function (window, document) {
  "use strict";
  var PREFIX = "pixkuy_fleet_b:";
  var AIRPORT_REPLACEMENT_EDIT_KEY = "pixkuy_airport_pending_edit_v1";
  var services = ["airport_transfer", "direct_transfer", "hourly_daily"];
  var dictionaries = {};
  var sequences = {};
  var inflightPrechecks = {};
  var editingService = "";
  var airportCertificate = null;
  var hourlyCertificate = null;
  var HOURLY_EDIT_KEY = "pixkuy_hourly_pending_edit_v1";
  var AIRPORT_OFFER_MAX_AGE_MS = 5 * 60 * 1000;
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function createAttemptKey() {
    var secure = window.crypto;
    if (secure && typeof secure.randomUUID === "function") return secure.randomUUID();
    if (!secure || typeof secure.getRandomValues !== "function") throw new Error("FLEET_SECURE_RANDOM_UNAVAILABLE");
    var bytes = secure.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.from(bytes, function (value) { return value.toString(16).padStart(2, "0"); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }
  function read(service) {
    var raw = window.sessionStorage.getItem(PREFIX + service);
    return raw ? JSON.parse(raw) : { version: 1, selected: null, offer: null, attempt: null, explicit: false };
  }
  function write(service, state) {
    var value = JSON.stringify(state);
    window.sessionStorage.setItem(PREFIX + service, value);
    if (window.sessionStorage.getItem(PREFIX + service) !== value) throw new Error("FLEET_STORAGE_UNAVAILABLE");
  }
  function language() { return (document.documentElement.lang || "es").toLowerCase(); }
  function text(key) { return (dictionaries[language()] || dictionaries.es || {})[key] || key; }
  function loadLabels() {
    var lang = language();
    if (dictionaries[lang]) return Promise.resolve();
    return window.fetch("assets/i18n/" + lang + ".json").then(function (response) {
      if (!response.ok) throw new Error("FLEET_TRANSLATION_UNAVAILABLE");
      return response.json();
    }).then(function (body) { dictionaries[lang] = body.fleetSelection; });
  }
  function replacementEditing() {
    try {
      var value = JSON.parse(window.sessionStorage.getItem(AIRPORT_REPLACEMENT_EDIT_KEY) || "null");
      return Boolean(value && value.version === 1 && value.token && value.editRevision && value.idempotencyKey);
    } catch (_) {
      return false;
    }
  }
  function pending(state) {
    var attempt=state.attempt;
    return attempt && attempt.state !== "not_committed" &&
      !(attempt.payload && attempt.payload.service_type==="airport_transfer" && replacementEditing());
  }
  function hourlyEdit() {
    try { var edit=JSON.parse(window.sessionStorage.getItem(HOURLY_EDIT_KEY)||"null");
      return edit && edit.version===1 && edit.token && edit.editRevision && edit.idempotencyKey ? edit : null;
    } catch(_){return null;}
  }
  function hourlyOfferStatus() {
    var state=read("hourly_daily");
    return {valid:!!(hourlyCertificate && state.offer && state.offer.models.length &&
      hourlyCertificate.requestKey===state.offer.requestKey && Date.now()<hourlyCertificate.validUntil),
      validUntil:hourlyCertificate?hourlyCertificate.validUntil:0};
  }
  function selection(service) {
    var state = read(service);
    return state.selected ? { version: 1, model_id: state.selected.modelId, model_revision: state.selected.modelRevision } : null;
  }
  function airportOfferCertified(state) {
    if (editingService === "airport_transfer") return true;
    var airport = window.PixkuyAirportZoneTariff;
    var key = airport && airport.fleetContextKey && airport.fleetContextKey();
    return !!(key && airportCertificate && airportCertificate.key === key &&
      airportCertificate.requestKey === (state.offer && state.offer.requestKey) &&
      Date.now() < airportCertificate.validUntil);
  }
  function airportOfferStatus() {
    var state = read("airport_transfer");
    var airport = window.PixkuyAirportZoneTariff;
    var key = airport && airport.fleetContextKey && airport.fleetContextKey();
    var result = state.precheck && state.precheck.body && state.precheck.body.result;
    var valid = Boolean(key && state.offer && state.offer.models.length &&
      result && result.checkoutAllowed === true && result.availability && result.availability.available === true && airportCertificate &&
      airportCertificate.key === key && airportCertificate.requestKey === state.offer.requestKey &&
      Date.now() < airportCertificate.validUntil);
    return {
      valid: valid,
      validUntil: airportCertificate ? airportCertificate.validUntil : 0,
      contextKey: key || "",
      requestKey: state.offer && state.offer.requestKey || ""
    };
  }
  function expireAirportOfferIfNeeded() {
    if (!airportCertificate || Date.now() < airportCertificate.validUntil) return false;
    if (pending(read("airport_transfer"))) return false;
    invalidateOffer("airport_transfer");
    document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-offer-expired", { detail: { service: "airport_transfer" } }));
    return true;
  }
  function model(service) {
    var state = read(service);
    return (service === "airport_transfer" || service === "hourly_daily" && !pending(state)) && !validSelection(state, service) ? null : state.selected;
  }
  function snapshot(service, value, options) {
    var state = read(service);
    var result = Object.assign({}, value);
    var refresh = options && options.refreshSelection;
    var chosen = refresh ? selection(service) : value.fleet_selection || selection(service);
    if (chosen) { result.fleet_selection = chosen; result.fleet_model = refresh ? state.selected : value.fleet_model || state.selected; }
    return result;
  }
  function hourlyPassengers(value) {
    var number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 6) throw new Error("FLEET_INVALID_PASSENGERS");
    return number;
  }
  function modelPhoto(selected) {
    if (!selected || !selected.photoUrl) return "";
    var base = (window.PIXKUY_BOOKING_API_CONFIG || {}).apiBaseUrl || window.location.origin;
    var url = new URL(selected.photoUrl, base);
    var siteKey = (window.PIXKUY_BOOKING_API_CONFIG || {}).publicSiteKey;
    if (siteKey) url.searchParams.set("site_key", siteKey);
    return url.toString();
  }
  function gallery(service) {
    var selected = model(service);
    if (!selected) return null;
    var photo = modelPhoto(selected);
    var urls = Array.isArray(selected.photoUrls) && selected.photoUrls.length ? selected.photoUrls : selected.photoUrl ? [selected.photoUrl] : [];
    if (!photo || !urls.length) return null;
    return { id: selected.modelId, label: selected.name, openLabel: selected.name, closeLabel: text("close"),
      previousLabel: text("previous"), nextLabel: text("next"), imageAlt: selected.name,
      images: urls.map(function (url, index) {
        return { id: selected.modelId + ":" + index, src: modelPhoto({ photoUrl: url }) };
      }) };
  }
  function host(service) {
    var roots = {
      airport_transfer: "#services-expand-airport",
      direct_transfer: "#services-expand-direct",
      hourly_daily: "[data-services-hourly-config]"
    };
    var form = document.querySelector('form[name="contact"]');
    var type = form && form.querySelector('[name="service_type"]');
    var formService = type && (type.value === "airport_hotel" ? "airport_transfer" : type.value);
    if (editingService === service && formService === service) {
      var editors = {airport_transfer:"[data-contact-airport-hotel-editor]",direct_transfer:"[data-contact-direct-transfer-editor]",hourly_daily:"[data-contact-hourly-daily-editor]"};
      return form.querySelector(editors[service]);
    }
    var mobileDirect = service === "direct_transfer" && document.querySelector("[data-direct-transfer-mobile-config-step]");
    if (mobileDirect && !mobileDirect.hidden && window.matchMedia("(max-width: 720px)").matches) return mobileDirect;
    var parent = document.querySelector(roots[service]);
    if (service === "hourly_daily" && parent && parent.getAttribute("data-services-hourly-mode-active") === "custom_long_term") return null;
    return parent;
  }
  function placeControl(parent, control) {
    if (parent.id === "services-expand-airport" && window.matchMedia("(min-width: 721px)").matches) {
      var desktopFare = parent.querySelector(".airport-desktop-vehicle > .services-expand__field--fare");
      if (desktopFare) {
        desktopFare.parentNode.insertBefore(control, desktopFare);
        return;
      }
    }
    if (parent.id === "services-expand-airport" && window.matchMedia("(max-width: 720px)").matches) {
      var tripTime = parent.querySelector(".services-expand__field--time");
      var footer = parent.querySelector(".airport-mobile-fare-footer");
      if (tripTime && footer && tripTime.parentNode === footer.parentNode) {
        if (tripTime.nextElementSibling !== control) tripTime.parentNode.insertBefore(control, tripTime.nextSibling);
        if (control.nextElementSibling !== footer) control.parentNode.insertBefore(footer, control.nextSibling);
        return;
      }
    }
    var anchor = parent.querySelector(".airport-mobile-fare-footer, .direct-transfer-mobile-config-step__footer, .services-expand__actions, .services-direct-transfer-panel__actions, .services-hourly-panel__row--cta, .services-hourly-panel__row--mobile-footer-spacer");
    if (!anchor && parent.closest('form[name="contact"]')) {
      parent.insertBefore(control, parent.firstChild);
      return;
    }
    if (!anchor) {
      var button = parent.querySelector("[data-direct-transfer-panel-cta]");
      anchor = button && button.parentNode;
    }
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(control, anchor);
    else parent.appendChild(control);
  }
  function validSelection(state, service) {
    return !!((service !== "airport_transfer" || airportOfferCertified(state)) && (service !== "hourly_daily" || hourlyOfferStatus().valid) && state.selected && state.offer && state.offer.models.some(function (item) {
      return item.modelId === state.selected.modelId && item.modelRevision === state.selected.modelRevision;
    }));
  }
  function editFromReview(service) {
    if (services.indexOf(service) < 0 || !document.querySelector('form[name="contact"]')) return false;
    // Continuing from Airport's vehicle step confirms even its sole offered model.
    // A later replacement must use the existing explicit-choice contract.
    if (service === "airport_transfer") {
      var confirmed = read(service);
      if (confirmed.selected) {
        confirmed.selectedByUser = true;
        write(service, confirmed);
      }
    }
    editingService = service;
    services.forEach(function (item) { render(item); syncFormPresentation(item); });
    var hourlyHost = host("hourly_daily");
    if (hourlyHost) mountHourlyPassengers(hourlyHost);
    return true;
  }
  function enterPanel(service) {
    editingService = "";
    services.forEach(function (item) { render(item); syncFormPresentation(item); });
    if (host("hourly_daily")) mountHourlyPassengers(host("hourly_daily"));
  }
  function canContinue(service, before) {
    var state = read(service);
    if (pending(state)) return true;
    var ready = validSelection(state, service) && before && before.model_id === state.selected.modelId && before.model_revision === state.selected.modelRevision;
    if (!ready) {
      var select = render(service);
      if (select) { select.focus(); select.scrollIntoView({block:"nearest"}); }
    }
    return !!ready;
  }
  function continuationControls(service) {
    var parent = host(service);
    if (!parent) return [];
    var controls = Array.from(parent.querySelectorAll('.services-expand__cta, [data-direct-transfer-panel-cta], [data-direct-transfer-mobile-config-cta], [data-services-hourly-cta]')).filter(function (node) { return !node.closest('[data-fleet-selection]'); });
    if (parent.closest('form[name="contact"]')) controls.push(document.getElementById("contact-submit"));
    return controls.filter(Boolean);
  }
  function syncContinuation(service, state) {
    var blocked = !!(state.offer && state.offer.models.length && !validSelection(state, service) && !pending(state));
    var parent = host(service);
    if (parent) parent.toggleAttribute("data-fleet-choice-required", blocked);
    continuationControls(service).forEach(function (cta) {
      if (blocked) {
        if (!cta.hasAttribute("data-fleet-was-disabled")) cta.setAttribute("data-fleet-was-disabled", String(cta.disabled));
        cta.disabled = true; cta.setAttribute("aria-disabled", "true");
      } else if (cta.hasAttribute("data-fleet-was-disabled")) {
        cta.disabled = cta.getAttribute("data-fleet-was-disabled") === "true";
        cta.setAttribute("aria-disabled", String(cta.disabled)); cta.removeAttribute("data-fleet-was-disabled");
      }
    });
  }
  function render(service) {
    var state = read(service);
    if ((service === "airport_transfer" && !airportOfferCertified(state)) ||
        (service === "hourly_daily" && !hourlyOfferStatus().valid && !pending(state))) state = Object.assign({}, state, { offer: null });
    var parent = host(service);
    var field = null;
    document.querySelectorAll('[data-fleet-selection="' + service + '"]').forEach(function (node) {
      if (parent && parent.contains(node) && !field) field = node;
      else node.parentNode.removeChild(node);
    });
    syncContinuation(service, state);
    if (!parent || (state.offer && !state.offer.models.length && !state.attempt) || (!state.offer && !state.attempt) || (state.offer && state.offer.models.length === 1 && validSelection(state, service) && !state.attempt)) {
      if (field) field.parentNode.removeChild(field);
      return null;
    }
    var models = state.offer ? state.offer.models : [];
    var confirmSingle = models.length === 1 && !validSelection(state, service) && !pending(state);
    var fieldTag = confirmSingle ? "DIV" : "FIELDSET";
    if (field && field.tagName !== fieldTag) { field.remove(); field = null; }
    if (!field) {
      field = document.createElement(fieldTag);
      field.className = "form-group fleet-selection";
      field.setAttribute("data-fleet-selection", service);
      placeControl(parent, field);
    }
    placeControl(parent, field);
    while (field.firstChild) field.removeChild(field.firstChild);
    var legend = document.createElement("legend");
    legend.textContent = text("model");
    if (!confirmSingle) field.appendChild(legend);
    var select = document.createElement(confirmSingle ? "button" : "div");
    if (!confirmSingle) select.className = "fleet-selection__choices";
    if (confirmSingle) {
      select.type = "button";
      select.className = "services-expand__cta";
      select.textContent = text("confirmModel") + ": " + models[0].name;
    }
    select.setAttribute("aria-label", confirmSingle ? text("confirmModel") + ": " + models[0].name : text("model"));
    if (!confirmSingle) models.forEach(function (item) {
      var label = document.createElement("label"); label.className = "fleet-selection__choice";
      var radio = document.createElement("input"); radio.type = "radio";
      radio.name = "fleet-model-" + service; radio.value = item.modelId;
      radio.checked = !!(state.selected && state.selected.modelId === item.modelId);
      radio.disabled = !!pending(state);
      var name = document.createElement("span"); name.textContent = item.name;
      // passengersSupported is a request count, not accredited capacity.
      label.appendChild(radio); label.appendChild(name); select.appendChild(label);
    });
    select.disabled = !!pending(state) || !models.length;
    field.appendChild(select);
    var message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = pending(state) ? text("recover") : state.explicit && models.length ? text("changed") : validSelection(state, service) ? "" : models.length ? text("choose") : text("none");
    if (confirmSingle) {
      message.id = "fleet-model-change-" + service;
      select.setAttribute("aria-describedby", message.id);
      field.insertBefore(message, select);
    } else field.appendChild(message);
    if (state.attempt) {
      if (pending(state)) {
        var recover = document.createElement("button"); recover.type = "button";
        recover.textContent = text("retry"); field.appendChild(recover);
        recover.addEventListener("click", function () {
          recover.disabled = true;
          recoverAttempt(service).catch(function () { message.textContent = text("uncertain"); })
            .finally(function () { recover.disabled = false; });
        });
      } else if (!(service === "airport_transfer" && replacementEditing() && models.length)) {
        message.textContent = text("refresh");
        var edit = document.createElement("a"); edit.href = "/#contact"; edit.textContent = text("edit");
        var desktopEdit = service === "airport_transfer" && window.PixkuyAirportDesktopBooking && window.PixkuyAirportDesktopBooking.pendingEdit();
        if (desktopEdit) {
          edit.href = "#airport/traslado";
          edit.className = "airport-booking__link";
          edit.textContent = window.PixkuyAirportDesktopView.t("backTrip");
        }
        edit.addEventListener("click", function () {
          var flags = {airport_transfer:"pixkuy_airport_checkout_review_return",hourly_daily:"pixkuy_hourly_checkout_review_return",direct_transfer:"pixkuy_direct_transfer_checkout_review_return"};
          window.sessionStorage.setItem(flags[service], "1");
        }); field.appendChild(edit);
      }
    }
    select.addEventListener(confirmSingle ? "click" : "change", function (event) {
      var current = read(service);
      if (pending(current) || !current.offer || current.offer.requestKey !== state.offer.requestKey) return;
      var choice = confirmSingle ? models[0].modelId : event.target.value;
      current.selected = current.offer.models.find(function (item) { return item.modelId === choice; }) || null;
      current.selectedByUser = !!current.selected;
      current.explicit = false;
      write(service, current);
      message.textContent = validSelection(current, service) ? "" : text("choose");
      syncPresentation(service);
      document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-model-selected", { detail: { service: service, model: current.selected } }));
      syncContinuation(service, current);
      if (confirmSingle) {
        render(service);
        window.setTimeout(function () {
          var cta = continuationControls(service)[0];
          if (cta) cta.focus();
        }, 0);
      }
    });
    // The offer is received; the promise still waits for an explicit choice.
    if (!validSelection(state, service) && models.length && !pending(state)) {
      document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-choice-required", { detail: {
        service: service, surface: parent.closest('form[name="contact"]') ? "form" : "panel"
      } }));
    }
    return confirmSingle ? select : select.querySelector("input:checked, input");
  }
  function acceptOffer(service, body, payload, options) {
    var result = body.result || body;
    var offer = result.fleet;
    if (!offer || offer.version !== 1 || !Array.isArray(offer.models)) return Promise.resolve(body);
    var state = read(service);
    if (pending(state)) return Promise.resolve(body);
    var sequence = sequences[service];
    var prior = state.selected;
    offer = copy(offer);
    offer.models = offer.models.filter(function (item, index, models) {
      return models.findIndex(function (other) { return other.modelId === item.modelId; }) === index;
    });
    if (offer.status !== "available" || result.checkoutAllowed === false || (result.availability && result.availability.available === false)) offer.models = [];
    state.offer = offer;
    state.precheck = { body: copy(body), payload: copy(payload) };
    if (service === "airport_transfer" && options && options.fleetContextKey) {
      var quoteExpiry = result.price && Date.parse(result.price.quoteExpiresAt);
      var validUntil = Date.now() + AIRPORT_OFFER_MAX_AGE_MS;
      if (Number.isFinite(quoteExpiry)) validUntil = Math.min(validUntil, quoteExpiry);
      airportCertificate = { key: options.fleetContextKey, requestKey: offer.requestKey,
        validUntil: validUntil };
      var certificate = airportCertificate;
      window.setTimeout(function () {
        if (airportCertificate !== certificate) return;
        expireAirportOfferIfNeeded();
      }, Math.max(1, validUntil - Date.now() + 1));
    }
    if(service==="hourly_daily"){
      hourlyCertificate={requestKey:offer.requestKey,validUntil:Date.now()+5*60*1000};
      var hourlyProof=hourlyCertificate;
      window.setTimeout(function(){
        if(hourlyCertificate!==hourlyProof || pending(read(service)))return;
        invalidateOffer(service);
        document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-offer-expired",{detail:{service:service}}));
      },5*60*1000+1);
    }
    if (prior) {
      state.selected = offer.models.find(function (item) { return item.modelId === prior.modelId && item.modelRevision === prior.modelRevision; }) ||
        (service === "airport_transfer" && !offer.models.length ? prior : null);
      if (!state.selected && state.selectedByUser !== false) state.explicit = true;
    }
    if (!state.selected && !state.explicit && offer.models.length === 1) {
      state.selected = offer.models[0];
      state.selectedByUser = false;
    }
    write(service, state);
    document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-offer-accepted", { detail: { service: service } }));
    return loadLabels().then(function () {
      if (sequences[service] !== sequence) throw new Error("FLEET_STALE_OFFER");
      var select = render(service);
      syncPresentation(service);
      if (state.selected || !offer.models.length || pending(state) || options && options.interactive === false) return body;
      if (!select) { result.checkoutAllowed = false; result.code = "FLEET_MODEL_SELECTION_REQUIRED"; return body; }
      // Resume the same precheck when the explicit choice arrives. Leaving this
      // control settles the pending flow safely and preserves the draft.
      return new Promise(function (resolve) {
        var settled = false;
        function finish(allowed) {
          if (settled) return; settled = true;
          document.removeEventListener("pixkuy:fleet-model-selected", chosen);
          document.removeEventListener("click", leave); document.removeEventListener("input", leave);
          document.removeEventListener("keydown", escape);
          document.removeEventListener("pixkuy:fleet-offer-invalidated", invalidated);
          window.removeEventListener("resize", resized);
          if (!allowed) { result.checkoutAllowed = false; result.code = "FLEET_MODEL_SELECTION_REQUIRED"; }
          resolve(body);
        }
        function chosen(event) { if (event.detail.service === service && event.detail.model) finish(true); }
        function leave(event) { if (!event.target.closest('[data-fleet-selection="' + service + '"]')) finish(false); }
        function escape(event) { if (event.key === "Escape") finish(false); }
        function invalidated(event) { if (event.detail.service === service) finish(false); }
        function resized() {
          var currentHost = host(service);
          var currentSelect = currentHost && currentHost.querySelector('[data-fleet-selection="' + service + '"] input, [data-fleet-selection="' + service + '"] button');
          if (!currentSelect || currentSelect.offsetParent === null) finish(false);
        }
        document.addEventListener("pixkuy:fleet-model-selected", chosen);
        document.addEventListener("pixkuy:fleet-offer-invalidated", invalidated);
        if (!options || options.interactive !== false) {
          document.addEventListener("click", leave); document.addEventListener("input", leave); document.addEventListener("keydown", escape);
          window.addEventListener("resize", resized);
          select.focus(); select.scrollIntoView({ block: "nearest" });
        }
      });
    });
  }
  function fetchPrecheck(service, url, init, options) {
    var payload = JSON.parse(init.body);
    var state = read(service);
    if (pending(state) && state.precheck) return Promise.resolve(new window.Response(JSON.stringify(state.precheck.body), { status: 200, headers: { "Content-Type": "application/json" } }));
    payload.fleet_contract_version = 1;
    if(service==="hourly_daily" && hourlyEdit()){
      var editing=hourlyEdit();
      payload.pending_edit={bookingStatusToken:editing.token,editRevision:editing.editRevision};
    }
    var selected = selection(service);
    if (selected) payload.fleet_selection = selected;
    var requestKey = url + "|" + JSON.stringify(payload);
    var inflight = inflightPrechecks[service];
    if (inflight && inflight.key === requestKey && inflight.sequence === sequences[service]) {
      return inflight.promise.then(function (response) { return response.clone(); });
    }
    invalidateOffer(service);
    var sequence = sequences[service];
    // Bound only network + body delivery, never the user's model selection.
    var timeoutMs = options && options.transportTimeoutMs;
    var abort = timeoutMs ? new window.AbortController() : null;
    var timer;
    var transport = new Promise(function (resolve, reject) {
      if (timeoutMs) timer = window.setTimeout(function () {
        abort.abort();
        reject(new Error("FLEET_PRECHECK_TIMEOUT"));
      }, timeoutMs);
      window.fetch(url, Object.assign({}, init, { body: JSON.stringify(payload) }, abort ? { signal: abort.signal } : {}))
        .then(function (response) {
          return response.clone().json().then(function (body) { return { response: response, body: body }; });
        }).then(resolve, reject);
    }).finally(function () { if (timer) window.clearTimeout(timer); });
    var request = transport.then(function (result) {
      var response = result.response, body = result.body;
        if (sequences[service] !== sequence) throw new Error("FLEET_STALE_OFFER");
        if (response.status >= 500) {
          var error = new Error(body && body.code || "FLEET_PRECHECK_FAILED");
          error.httpStatus = response.status;
          throw error;
        }
        if (!response.ok) return response;
        return acceptOffer(service, body, payload, options).then(function (accepted) {
          if (sequences[service] !== sequence) throw new Error("FLEET_STALE_OFFER");
          return new window.Response(JSON.stringify(accepted), { status: response.status, headers: { "Content-Type": "application/json" } });
        });
    });
    inflightPrechecks[service] = { key: requestKey, sequence: sequence, promise: request };
    return request.then(function (response) { return response.clone(); }).finally(function () {
      if (inflightPrechecks[service] && inflightPrechecks[service].promise === request) delete inflightPrechecks[service];
    });
  }
  function fetchCheckout(service, url, init) {
    var state = read(service);
    var payload = JSON.parse(init.body);
    state.draft = copy(payload);
    if(service==="hourly_daily" && !pending(state) && hourlyEdit()){
      var edit=hourlyEdit();
      url=url.replace(/\/checkout$/, "/replace-checkout");
      init=Object.assign({},init,{headers:Object.assign({},init.headers,{
        "X-Pixkuy-Booking-Token":edit.token,"X-Pixkuy-Edit-Revision":edit.editRevision})});
    }
    if (!pending(state)) {
      var selected = selection(service);
      if ((!selected || state.explicit) && state.offer) return Promise.reject(new Error("FLEET_MODEL_SELECTION_REQUIRED"));
      if (selected) payload.fleet_selection = payload.fleet_selection || selected;
      if (selected && (payload.fleet_selection.model_id !== selected.model_id || payload.fleet_selection.model_revision !== selected.model_revision)) return Promise.reject(new Error("FLEET_REVIEW_SELECTION_CHANGED"));
      state.attempt = { state: "pending", key: service==="hourly_daily" && hourlyEdit() ? hourlyEdit().idempotencyKey : createAttemptKey(), payload: copy(payload), url: url, headers: copy(init.headers || {}) };
    }
    var attempt = state.attempt;
    var sent = copy(attempt.payload);
    // Only transport evidence is renewable; commercial fields/key stay exactly frozen.
    if (sent.fleet_selection && payload.recaptchaToken) sent.recaptchaToken = payload.recaptchaToken;
    write(service, state); // Refuse the send when recoverable storage cannot be proved.
    var headers = Object.assign({}, service==="hourly_daily"?attempt.headers:init.headers, { "Idempotency-Key": attempt.key });
    if(service==="hourly_daily")url=attempt.url;
    return window.fetch(url, Object.assign({}, init, { headers: headers, body: JSON.stringify(sent) })).then(function (response) {
      return response.clone().json().then(function (body) {
        var current = read(service);
        if (!current.attempt || current.attempt.key !== attempt.key) throw new Error("FLEET_ATTEMPT_CONFLICT");
        current.attempt.response = copy(body);
        if (body.recovery && body.recovery.state === "not_committed") {
          current.attempt.state = "not_committed";
          current.explicit = true; current.selected = null;
        } else if (body.bookingStatusToken) {
          current.attempt.state = "committed";
          if (service === "airport_transfer" || service === "hourly_daily") current.reservationToken = body.bookingStatusToken;
        }
        write(service, current);
        render(service);
        return response;
      });
    });
  }
  function recoverAttempt(service, onReservationStatus) {
    var state = read(service), attempt = state.attempt;
    if (!attempt || !attempt.url) return Promise.reject(new Error("FLEET_ORIGINAL_ATTEMPT_REQUIRED"));
    return fetchCheckout(service, attempt.url, { method: "POST", headers: attempt.headers, body: JSON.stringify(attempt.payload) })
      .then(function (response) { return response.json(); }).then(function (body) {
        if (["RECAPTCHA_TOKEN_REQUIRED","RECAPTCHA_TOKEN_INVALID"].indexOf(body.code) < 0) return body;
        var recaptcha = window.PixkuyRecaptchaEnterprise;
        if (!recaptcha || !attempt.payload.fleet_selection) return body;
        var actions = {airport_transfer:"airport_transfer_checkout",direct_transfer:"direct_transfer_checkout",hourly_daily:"hourly_checkout"};
        return recaptcha.execute(actions[service]).then(function (token) {
          return fetchCheckout(service,attempt.url,{method:"POST",headers:attempt.headers,body:JSON.stringify(Object.assign({},attempt.payload,{recaptchaToken:token}))});
        }).then(function(response){return response.json();});
      }).then(function (body) {
        var token = body.bookingStatusToken;
        if (token && body.checkoutUrl) {
          window.sessionStorage.setItem("pixkuy_booking_checkout:" + token, JSON.stringify({token:token, checkoutUrl:body.checkoutUrl, redirected:false, createdAt:new Date().toISOString()}));
          window.location.assign("/booking-checkout.html?token=" + encodeURIComponent(token));
        } else if (token && body.recovery && body.recovery.action === "reservation_status") (onReservationStatus || function (value) { window.location.assign("/booking-success.html?token=" + encodeURIComponent(value)); })(token);
        else if (!body.recovery || body.recovery.state !== "not_committed") throw new Error("FLEET_ASSISTED_RECOVERY_REQUIRED");
        return body;
      });
  }
  function completeAttempt(service, token) {
    var state = read(service), attempt = state.attempt;
    var responseToken = attempt && attempt.response && attempt.response.bookingStatusToken;
    if (!token || !attempt || attempt.state !== "committed" || responseToken !== token) return false;
    state.attempt = null;
    write(service, state);
    window.sessionStorage.removeItem("pixkuy_booking_checkout:" + token);
    document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-attempt-completed", {detail:{service:service, token:token}}));
    render(service); syncPresentation(service);
    return true;
  }
  function bindReservation(service, token) {
    if (["airport_transfer","hourly_daily"].indexOf(service)<0 || !token) return false;
    var state = read(service);
    state.reservationToken = token;
    write(service, state);
    return true;
  }
  // Called only after the public status confirms payment. A superseded checkout
  // attempt is not a paid reservation; pending edit/recovery keeps its context.
  function completeReservation(service, token, resolvedExpired) {
    if (["airport_transfer","hourly_daily"].indexOf(service)<0 || !token) return false;
    var state = read(service);
    var attempt = state.attempt;
    var owner = state.reservationToken || attempt && attempt.response && attempt.response.bookingStatusToken;
    if (owner !== token) return false;
    var edit;
    try { edit = JSON.parse(window.sessionStorage.getItem(service==="hourly_daily"?HOURLY_EDIT_KEY:AIRPORT_REPLACEMENT_EDIT_KEY) || "null"); }
    catch (_) { return false; }
    if (edit && edit.token !== token) return false;
    if (!resolvedExpired && attempt && (attempt.state !== "committed" || !attempt.response || attempt.response.bookingStatusToken !== token)) return false;
    sequences[service] = (sequences[service] || 0) + 1;
    delete inflightPrechecks[service];
    if(service==="hourly_daily")hourlyCertificate=null;
    else airportCertificate = null;
    editingService = "";
    write(service, {version:1, selected:null, offer:null, attempt:null, explicit:false});
    (service==="hourly_daily" ? ["pixkuy_hourly_checkout_review_snapshot","pixkuy_hourly_checkout_review_return",
      HOURLY_EDIT_KEY,"pixkuy_booking_checkout:"+token] : ["pixkuy_airport_transfer_checkout_review_snapshot", "pixkuy_airport_transfer_checkout_review_return",
      AIRPORT_REPLACEMENT_EDIT_KEY, "pixkuy_booking_checkout:" + token]).forEach(function (key) {
      window.sessionStorage.removeItem(key);
    });
    document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-offer-invalidated", {detail:{service:service}}));
    document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-attempt-completed", {detail:{service:service, token:token}}));
    render(service); syncPresentation(service);
    return true;
  }
  function syncImage(media, selected, imageClass, keepContainer) {
    if (!media) return;
    var image = media.querySelector("img");
    var photo = modelPhoto(selected);
    if (!photo) {
      if (image) image.parentNode.removeChild(image);
      media.hidden = !keepContainer;
      return;
    }
    media.hidden = false;
    if (!image) {
      image = document.createElement("img"); image.className = imageClass;
      image.loading = "lazy"; image.decoding = "async"; media.appendChild(image);
    }
    image.alt = selected.name;
    image.onerror = function () {
      if (image.parentNode === media) media.removeChild(image);
      media.hidden = !keepContainer;
      if (media.hasAttribute("data-airport-desktop-vehicle-gallery-trigger")) {
        media.removeAttribute("data-airport-desktop-vehicle-gallery-trigger");
        media.removeAttribute("role"); media.removeAttribute("tabindex"); media.removeAttribute("aria-label");
      }
    };
    if (image.getAttribute("src") !== photo) image.setAttribute("src", photo);
  }
  function syncFormPresentation(service) {
    var form = document.querySelector('form[name="contact"]');
    if (!form || service === "direct_transfer") return; // Direct v0023 owns its existing card.
    var type = form.querySelector('[name="service_type"]');
    var active = type && (type.value === service || (service === "airport_transfer" && type.value === "airport_hotel"));
    var root = form.querySelector(service === "airport_transfer" ? "[data-contact-airport-hotel-editor]" : "[data-contact-hourly-daily-editor]");
    if (!root) return;
    var row = root.querySelector("[data-fleet-model-summary]");
    var selected = model(service);
    if (service === "hourly_daily") {
      var label = root.querySelector(".contact-hourly-daily-editor__vehicle-label");
      if (label) { label.removeAttribute("data-i18n"); label.textContent = selected ? selected.name : text("model"); }
      syncImage(root.querySelector("[data-contact-hourly-daily-vehicle-media]"), selected, "contact-hourly-daily-editor__vehicle-image");
    }
    if (!active || !selected) { if (row) row.parentNode.removeChild(row); return; }
    if (!row) {
      row = document.createElement("p"); row.className = "form-group";
      row.setAttribute("data-fleet-model-summary", service);
      root.insertBefore(row, root.firstChild);
    }
    row.textContent = text("model") + ": " + selected.name;
    if (service === "hourly_daily") row.textContent += " · " + text("passengers") + ": " + passengerLabel(passengers());
  }
  function syncPresentation(service) {
    var galleries = {airport_transfer:["PixkuyAirportMobileVehicleGallery"],direct_transfer:["PixkuyDirectTransferDesktopVehicleGallery","PixkuyDirectTransferMobileVehicleGallery"],hourly_daily:["PixkuyHourlyDesktopVehicleGallery","PixkuyHourlyMobileVehicleGallery"]};
    galleries[service].forEach(function (name) { if (window[name]) window[name].sync(); });
    syncFormPresentation(service);
    var roots = {airport_transfer:"#services-expand-airport",direct_transfer:"#services-expand-direct",hourly_daily:"[data-services-hourly-config]"};
    var parent = document.querySelector(roots[service]), selected = model(service);
    if (service === "hourly_daily" && parent && parent.getAttribute("data-services-hourly-mode-active") === "custom_long_term") return;
    if (service === "direct_transfer") {
      var mobile = document.querySelector("[data-direct-transfer-mobile-config-step]");
      if (mobile) {
        syncImage(mobile.querySelector(".direct-transfer-mobile-config-step__vehicle"), selected, "direct-transfer-mobile-config-step__vehicle-image");
        var footer = mobile.querySelector(".direct-transfer-mobile-config-step__footer");
        var label = mobile.querySelector("[data-fleet-mobile-model-name]");
        if (!selected) { if (label) label.remove(); }
        else if (footer) {
          if (!label) {
            label = document.createElement("p"); label.className = "direct-transfer-mobile-config-step__model-name";
            label.setAttribute("data-fleet-mobile-model-name", ""); footer.insertBefore(label, footer.querySelector("[data-direct-transfer-mobile-config-cta]"));
          }
          label.textContent = selected.name;
        }
      }
    }
    if (!parent) return;
    var state = read(service);
    var presentation = pending(state) || validSelection(state, service) ? selected : null;
    [parent, mobile].filter(Boolean).forEach(function (node) {
      node.setAttribute("data-fleet-presentation", presentation ? "selected" : "empty");
      node.setAttribute("data-fleet-photo", modelPhoto(presentation) ? "true" : "false");
      if (!modelPhoto(presentation)) node.querySelectorAll('[data-direct-transfer-desktop-vehicle-gallery-trigger], [data-direct-transfer-mobile-vehicle-gallery-trigger], [data-hourly-desktop-vehicle-gallery-trigger], [data-airport-desktop-vehicle-gallery-trigger]').forEach(function (trigger) {
        trigger.removeAttribute("role"); trigger.removeAttribute("tabindex"); trigger.removeAttribute("aria-label");
      });
    });
    if (service === "airport_transfer") {
      var mobileFooter = parent.querySelector(".airport-mobile-fare-footer");
      var mobileName = parent.querySelector("[data-fleet-airport-model-name]");
      if (presentation && !modelPhoto(presentation) && mobileFooter) {
        if (!mobileName) {
          mobileName = document.createElement("p"); mobileName.setAttribute("data-fleet-airport-model-name", "");
          mobileFooter.appendChild(mobileName);
        }
        mobileName.textContent = presentation.name;
      } else if (mobileName) mobileName.remove();
      var row = parent.querySelector("[data-fleet-single-model]");
      var current = read(service);
      var showSingle = window.matchMedia("(min-width: 721px)").matches && validSelection(current, service);
      if (!showSingle) { if (row) row.remove(); }
      else {
        if (!row) {
          row = document.createElement("div"); row.className = "airport-single-model";
          row.setAttribute("data-fleet-single-model", "");
          row.appendChild(document.createElement("span"));
          row.appendChild(document.createElement("p"));
        }
        var fare = parent.querySelector(".services-expand__field--fare");
        var desktopVehicle = parent.querySelector(".airport-desktop-vehicle");
        if (desktopVehicle && fare && fare.parentNode === desktopVehicle) desktopVehicle.insertBefore(row, fare);
        else if (fare) fare.appendChild(row);
        else parent.appendChild(row);
        row.querySelector("p").textContent = selected.name;
        var imageHost = row.querySelector("span");
        syncImage(imageHost, selected, "airport-single-model__image");
        if (modelPhoto(selected) && imageHost.querySelector("img")) {
          var desktopGallery = desktopVehicle && window.matchMedia("(min-width: 721px)").matches;
          var galleryLabel = imageHost.querySelector(".airport-single-model__gallery-label");
          if (desktopGallery) {
            if (!galleryLabel) {
              galleryLabel = document.createElement("span");
              galleryLabel.className = "airport-single-model__gallery-label";
              galleryLabel.setAttribute("data-i18n", "eventPackages.vehicleGalleryOpen");
              galleryLabel.setAttribute("aria-hidden", "true");
              imageHost.appendChild(galleryLabel);
            }
            galleryLabel.textContent = (window.__pixkuyI18nDict || {}).eventPackages?.vehicleGalleryOpen || "Ver galería";
          } else galleryLabel?.remove();
          imageHost.setAttribute("data-airport-desktop-vehicle-gallery-trigger", "");
          imageHost.setAttribute("role", "button"); imageHost.setAttribute("tabindex", "0");
          imageHost.setAttribute("aria-label", desktopGallery ? galleryLabel.textContent + ": " + selected.name : text("model") + ": " + selected.name);
        } else {
          imageHost.querySelector(".airport-single-model__gallery-label")?.remove();
          imageHost.removeAttribute("data-airport-desktop-vehicle-gallery-trigger");
          imageHost.removeAttribute("role"); imageHost.removeAttribute("tabindex"); imageHost.removeAttribute("aria-label");
        }
      }
    }
    var names = service === "hourly_daily" ? ".services-hourly-panel__vehicle-name" : service === "direct_transfer" ? ".services-direct-transfer-panel__vehicle > span" : "[data-airport-vehicle-name]";
    parent.querySelectorAll(names).forEach(function (node) { node.textContent = selected ? selected.name : text("model"); });
    var media = service === "hourly_daily" ? ".services-hourly-panel__vehicle-media" : service === "direct_transfer" ? ".services-direct-transfer-panel__vehicle" : "[data-airport-vehicle-media]";
    var imageClass = service === "hourly_daily" ? "services-hourly-panel__vehicle-image" : "services-direct-transfer-panel__vehicle-image";
    parent.querySelectorAll(media).forEach(function (node) { syncImage(node, selected, imageClass, service === "direct_transfer"); });
  }
  function invalidateOffer(service) {
    var state = read(service);
    if (pending(state)) return;
    if (service === "airport_transfer") airportCertificate = null;
    if (service === "hourly_daily") hourlyCertificate = null;
    sequences[service] = (sequences[service] || 0) + 1;
    state.offer = null;
    write(service, state);
    document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-offer-invalidated", {detail:{service:service}}));
    render(service);
    syncPresentation(service);
  }
  // Capture trip edits before panel handlers can start a new precheck.
  var airportEditValues = new WeakMap();
  function invalidateTripEdit(event) {
    var target = event.target;
    if (!target || !target.closest || target.closest('[data-fleet-selection]')) return;
    if (event.type === "click") {
      if (!target.closest('[data-airport-tariff-passenger-option], [data-airport-tariff-swap], [data-airport-destination-clear], [data-direct-transfer-panel-passenger-option], [data-direct-transfer-panel-address-clear], [data-direct-transfer-mobile-address-clear], [data-contact-airport-hotel-passenger-option], [data-contact-airport-hotel-swap], [data-contact-airport-hotel-hotel-clear], [data-contact-hourly-daily-mode-option], [data-contact-hourly-daily-duration-option], [data-contact-direct-transfer-passenger-option], [data-contact-direct-transfer-origin-clear], [data-contact-direct-transfer-destination-clear]')) return;
    } else if (!target.matches('input:not([type="hidden"]):not([type="checkbox"]), select')) return;
    if (target.closest("[data-services-hourly-config]")) return;
    // The Direct input event already invalidated the quote for this value.
    // Its later change/blur must not discard the resulting fleet offer.
    if (event.type !== "click" && target.matches("[data-direct-transfer-mobile-config-field]")) {
      if (airportEditValues.get(target) === target.value) return;
      airportEditValues.set(target, target.value);
    }
    if (target.closest("#services-expand-airport")) {
      if (event.type !== "click") {
        if (airportEditValues.get(target) === target.value) return;
        airportEditValues.set(target, target.value);
      } else {
        var chip = target.closest("[data-airport-tariff-passenger-option]");
        if (chip && chip.getAttribute("aria-pressed") === "true") return;
      }
    }
    var roots = {
      airport_transfer: '#services-expand-airport, [data-contact-airport-hotel-editor]',
      direct_transfer: '#services-expand-direct, [data-direct-transfer-mobile-config-step], [data-contact-direct-transfer-editor]',
      hourly_daily: '[data-services-hourly-config], [data-contact-hourly-daily-editor]'
    };
    services.forEach(function (service) {
      if (target.closest(roots[service])) invalidateOffer(service);
    });
  }
  document.addEventListener("input", invalidateTripEdit, true);
  document.addEventListener("change", invalidateTripEdit, true);
  document.addEventListener("click", invalidateTripEdit, true);
  function minimumDate() {
    var parts = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(Date.now() + 24 * 60 * 60 * 1000));
    return ["year","month","day"].map(function (key) { return parts.find(function (part) { return part.type === key; }).value; }).join("-");
  }
  // Same capacity upper bounds as Airport getPassengerCountForFareKey (2/4/6).
  // Labels are ranges; Hourly pricing never consumes a fare key.
  function passengerBand(value) {
    var count=hourlyPassengers(value);
    return [{label:"1–2",maxPassengers:2},{label:"3–4",maxPassengers:4},{label:"5–6",maxPassengers:6}].find(function(band){return count<=band.maxPassengers;});
  }
  function passengerLabel(value) { return passengerBand(value).label; }
  function passengers() { return passengerBand(read("hourly_daily").passengers || 2).maxPassengers; }
  function setPassengers(value) {
    var number = passengerBand(value).maxPassengers, state = read("hourly_daily");
    state.passengers = number; write("hourly_daily", state);
    document.querySelectorAll('[name="hourly_daily_passengers"], [data-fleet-hourly-passengers]').forEach(function (field) { field.value = String(number); });
    syncFormPresentation("hourly_daily");
    return number;
  }
  function mountHourlyPassengers(parent) {
    parent = host("hourly_daily") || parent;
    if (!parent) return;
    document.querySelectorAll("[data-fleet-hourly-passengers]").forEach(function (node) {
      if (!parent.contains(node) && node.parentNode && node.parentNode.parentNode) node.parentNode.parentNode.removeChild(node.parentNode);
    });
    if (parent.querySelector("[data-fleet-hourly-passengers]")) return;
    var label = document.createElement("label");
    label.className = "services-hourly-panel__field services-hourly-panel__field--passengers";
    var title = document.createElement("span"); title.setAttribute("data-fleet-passengers-label", ""); title.textContent = text("passengers"); label.appendChild(title);
    loadLabels().then(function () { title.textContent = text("passengers"); });
    var control = document.createElement("select"); control.className = "services-hourly-panel__control";
    control.setAttribute("data-fleet-hourly-passengers", "");
    var state = read("hourly_daily");
    [2,4,6].forEach(function(n) { var option = document.createElement("option"); option.value = String(n); option.textContent = passengerLabel(n); control.appendChild(option); });
    control.value = String(passengerBand(state.passengers || 2).maxPassengers);
    function sync() {
      setPassengers(control.value);
      document.dispatchEvent(new window.CustomEvent("pixkuy:fleet-passengers-changed", {detail:{service:"hourly_daily"}}));
    }
    control.addEventListener("change", sync); label.appendChild(control);
    var top=parent.querySelector('.services-hourly-panel__row--top');
    var notes=parent.querySelector('.services-hourly-panel__row--mobile-notes');
    if(top)top.appendChild(label);else if(notes)notes.before(label);else placeControl(parent,label);
    setPassengers(control.value);
  }
  window.PixkuyFleetSelection = { read: read, selection: selection, model: model, snapshot: snapshot, gallery: gallery, photo: modelPhoto,
    fetchPrecheck: fetchPrecheck, fetchCheckout: fetchCheckout, recoverAttempt: recoverAttempt, completeAttempt: completeAttempt, createAttemptKey: createAttemptKey,
    bindReservation: bindReservation, completeReservation: completeReservation,
    airportOfferStatus: airportOfferStatus,
    hourlyOfferStatus: hourlyOfferStatus,
    hourlyEdit: hourlyEdit, expireAirportOfferIfNeeded: expireAirportOfferIfNeeded,
    syncPresentation: syncPresentation, acceptOffer: acceptOffer, render: render,
    minimumDate: minimumDate, hourlyPassengers: hourlyPassengers, passengerLabel: passengerLabel, passengers: passengers, setPassengers: setPassengers, invalidateOffer: invalidateOffer, canContinue: canContinue, syncFormPresentation: syncFormPresentation,
    mountHourlyPassengers: mountHourlyPassengers, editFromReview: editFromReview, enterPanel: enterPanel };
  document.addEventListener("pixkuy:contact-service-change", function (event) {
    if (editingService && event.detail) {
      var next = event.detail.nextServiceType;
      editingService = next === "airport_hotel" ? "airport_transfer" : services.indexOf(next) >= 0 ? next : "";
    }
    services.forEach(function (service) { render(service); syncFormPresentation(service); });
    var hourlyHost = host("hourly_daily");
    if (hourlyHost) mountHourlyPassengers(hourlyHost);
  });
  window.addEventListener("resize", function () {
    services.forEach(function (service) { render(service); syncPresentation(service); });
  });
  window.addEventListener("pageshow", function () {
    services.forEach(function (service) { render(service); syncPresentation(service); });
  });
  if (window.addEventListener) window.addEventListener("pixkuy:i18n-applied", function (event) {
    if (event.detail && event.detail.dict && event.detail.dict.fleetSelection) dictionaries[language()] = event.detail.dict.fleetSelection;
    loadLabels().then(function () {
      services.forEach(function(service){render(service);syncPresentation(service);});
      document.querySelectorAll("[data-fleet-passengers-label]").forEach(function (node) { node.textContent = text("passengers"); });
    });
  });
  if (document) loadLabels().then(function () { services.forEach(function (service) { render(service); syncPresentation(service); }); }).catch(function () { /* Existing form remains; checkout fails closed if state cannot be saved. */ });
})(window, document);
