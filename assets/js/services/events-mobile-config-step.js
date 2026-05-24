/* assets/js/services/events-mobile-config-step.js
   Events mobile config step.
   Responsabilidad:
   - mostrar la segunda pantalla móvil de configuración de event_special
   - capturar modalidad, pasajeros, direcciones y horas
   - usar el módulo existente de dirección Events
   - solicitar quote real mediante el módulo Events Special Quote
   - abrir el Contact Step móvil con payload event_special_*
   - no enviar Netlify directamente
   - no tocar #contact ni desktop
*/

(function initEventsMobileConfigStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const ROUTE_SELECTOR = "[data-events-mobile-route]";
  const CONFIG_STEP_SELECTOR = "[data-events-mobile-config-step]";
  const CONFIG_BACK_SELECTOR = "[data-events-mobile-config-back]";
  const CONFIG_FIELD_SELECTOR = "[data-events-mobile-config-field]";
  const CONFIG_ADDRESS_CLEAR_SELECTOR = "[data-events-mobile-address-clear]";
  const CONFIG_PRICE_SELECTOR = "[data-events-mobile-config-price]";
  const CONFIG_POSTER_TRIGGER_SELECTOR = "[data-events-mobile-poster-trigger]";

  const BODY_CONFIG_ATTR = "data-events-mobile-config-screen";
  const BODY_POSTER_VIEWER_ATTR = "data-events-mobile-poster-viewer-active";

  const DEFAULT_VARIANT = "arrival";
  const DEFAULT_PASSENGER_FARE_KEY = "van_1_2";
  const RETURN_PICKUP_NEXT_DAY_CUTOFF_MINUTES = 120;

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let stepNode = null;
  let currentPayload = null;
  let addressControllers = [];
  let quoteRequestId = 0;
  let lastQuoteSignature = "";
  let currentQuoteState = "pending";
  let currentQuoteResult = null;
  let posterViewerNode = null;
  let posterPreviousFocus = null;
  let state = {
    selectedEventId: "",
    selectedVariant: DEFAULT_VARIANT,
    selectedPassengerFareKey: DEFAULT_PASSENGER_FARE_KEY,
    originAddress: "",
    originAddressPlace: null,
    destinationAddress: "",
    destinationAddressPlace: null,
    originPickupTime: "",
    returnPickupTime: "",
    returnPickupDayOffset: 0
  };

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

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

  function getI18nValue(path, fallback) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = String(path || "").split(".");
    let cursor = dict;
    let index;

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      const value = getValue(dict, path);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function getAddressModule() {
    const api = window.PixkuyServicesEventsSpecialAddress;

    return api &&
      typeof api.buildAddressMarkup === "function" &&
      typeof api.mount === "function"
      ? api
      : null;
  }

  function getRoute() {
    return document.querySelector(ROUTE_SELECTOR);
  }

  function getStep() {
    return stepNode || document.querySelector(CONFIG_STEP_SELECTOR);
  }

  function getGroup() {
    return currentPayload && currentPayload.group ? currentPayload.group : null;
  }

  function getPricing() {
    return currentPayload && currentPayload.pricing ? currentPayload.pricing : {};
  }

  function getVenueName() {
    return normalizeText(currentPayload && currentPayload.venueName);
  }

  function getVenueAddress() {
    const venueId = getSelectedVenueId();

    return venueId
      ? getI18nValue("services.cards.events.venues." + venueId + ".address", "")
      : "";
  }

  function getEventTitle(entity) {
    if (!entity) {
      return "";
    }

    return getI18nValue(entity.titleKey, entity.id || "");
  }

  function formatEventDate(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) {
      return raw;
    }

    const date = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        12,
        0,
        0
      )
    );
    const dateLabel = new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(date);

    return dateLabel + ", " + match[4] + ":" + match[5];
  }

  function getEventDateLabel(event) {
    if (!event) {
      return "";
    }

    return getI18nValue(event.dateLabelKey, formatEventDate(event.startsAt));
  }

  function getEventDateParts(event) {
    const raw = String((event && event.startsAt) || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    const fallbackLabel = getEventDateLabel(event);

    if (!match) {
      return {
        weekday: "",
        day: "",
        month: "",
        time: "",
        label: fallbackLabel
      };
    }

    const date = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        12,
        0,
        0
      )
    );

    return {
      weekday: new Intl.DateTimeFormat("es-MX", {
        weekday: "short"
      }).format(date),
      day: String(Number(match[3])),
      month: new Intl.DateTimeFormat("es-MX", {
        month: "short"
      }).format(date),
      time: match[4] + ":" + match[5],
      label: fallbackLabel
    };
  }

  function getSelectedEvent() {
    const group = getGroup();

    if (!group || !Array.isArray(group.events) || !group.events.length) {
      return null;
    }

    return group.events.find(function findEvent(event) {
      return event && event.id === state.selectedEventId;
    }) || group.events[0] || null;
  }

  function getAvailableVariants() {
    const pricing = getPricing();
    const variants = pricing && pricing.variants ? pricing.variants : {};

    return ["arrival", "departure", "round_trip"].filter(function filterVariant(variantId) {
      return Boolean(variants[variantId]);
    });
  }

  function getVariantLabel(variantId) {
    const pricing = getPricing();
    const variants = pricing && pricing.variants ? pricing.variants : {};
    const variant = variants[variantId];

    if (variant && variant.labelKey) {
      return getI18nValue(variant.labelKey, variantId);
    }

    return getI18nValue("services.cards.events.variants." + variantId, variantId);
  }

  function getAvailablePassengerFareKeys() {
    const pricing = getPricing();
    const passengerFactors = pricing && pricing.passengerFactors
      ? pricing.passengerFactors
      : {};

    return ["van_1_2", "van_3_4", "van_5_6"].filter(function filterFareKey(fareKey) {
      return Boolean(passengerFactors[fareKey]);
    });
  }

  function getPassengerFareLabel(fareKey) {
    const pricing = getPricing();
    const passengerFactors = pricing && pricing.passengerFactors
      ? pricing.passengerFactors
      : {};
    const factor = passengerFactors[fareKey];

    if (factor && factor.labelKey) {
      return getI18nValue(factor.labelKey, fareKey);
    }

    return getI18nValue("services.cards.events.passengerBuckets." + fareKey, fareKey);
  }

  function formatMoneyAmount(value) {
    const number = Number(value || 0);

    if (!number) {
      return "";
    }

    return new Intl.NumberFormat("es-MX", {
      maximumFractionDigits: 0
    }).format(number);
  }

  function buildMoneyMarkup(value) {
    const amount = formatMoneyAmount(value);

    if (!amount) {
      return "";
    }

    return [
      '<span class="events-mobile-config-step__fare-amount">',
      escapeHtml(amount),
      '</span>',
      '<span class="events-mobile-config-step__fare-currency">MXN</span>'
    ].join("");
  }

  function getQuoteModule() {
    const api = window.PixkuyServicesEventsSpecialQuote;

    return api && typeof api.requestQuote === "function" ? api : null;
  }

  function resetQuoteState() {
    quoteRequestId += 1;
    lastQuoteSignature = "";
    currentQuoteState = "pending";
    currentQuoteResult = null;

    return true;
  }

  function normalizeCoordinate(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  function readMaybeFunction(value) {
    return typeof value === "function" ? value() : value;
  }

  function getPlaceCoordinate(place, primaryKey, fallbackKey) {
    const safePlace = place && typeof place === "object" ? place : {};
    const directValue = normalizeCoordinate(safePlace[primaryKey]);

    if (directValue !== null) {
      return directValue;
    }

    if (fallbackKey) {
      const fallbackValue = normalizeCoordinate(safePlace[fallbackKey]);

      if (fallbackValue !== null) {
        return fallbackValue;
      }
    }

    if (safePlace.location && typeof safePlace.location === "object") {
      const locationValue = normalizeCoordinate(readMaybeFunction(safePlace.location[primaryKey]));

      if (locationValue !== null) {
        return locationValue;
      }

      if (fallbackKey) {
        const locationFallbackValue = normalizeCoordinate(
          readMaybeFunction(safePlace.location[fallbackKey])
        );

        if (locationFallbackValue !== null) {
          return locationFallbackValue;
        }
      }
    }

    if (safePlace.geometry && safePlace.geometry.location) {
      const geometryValue = normalizeCoordinate(
        readMaybeFunction(safePlace.geometry.location[primaryKey])
      );

      if (geometryValue !== null) {
        return geometryValue;
      }

      if (fallbackKey) {
        const geometryFallbackValue = normalizeCoordinate(
          readMaybeFunction(safePlace.geometry.location[fallbackKey])
        );

        if (geometryFallbackValue !== null) {
          return geometryFallbackValue;
        }
      }
    }

    return null;
  }

  function normalizePlaceForQuote(place, fallbackLabel) {
    const safePlace = place && typeof place === "object" ? place : {};
    const lat = getPlaceCoordinate(safePlace, "lat", "latitude");
    const lng = getPlaceCoordinate(safePlace, "lng", "longitude");
    const label = normalizeText(
      safePlace.label ||
        safePlace.formattedAddress ||
        safePlace.displayName ||
        fallbackLabel
    );

    if (lat === null || lng === null) {
      return null;
    }

    return {
      label,
      placeId: normalizeText(safePlace.placeId || safePlace.place_id || safePlace.id),
      lat,
      lng
    };
  }

  function getSelectedVenueId() {
    const group = getGroup();
    const selectedEvent = getSelectedEvent();

    return normalizeText(
      (selectedEvent && selectedEvent.venueId) ||
        (group && group.venueId) ||
        (currentPayload && currentPayload.venueId) ||
        (currentPayload && currentPayload.venue && currentPayload.venue.id)
    );
  }

  function getQuoteInput() {
    const selectedEvent = getSelectedEvent();
    const input = {
      eventId: normalizeText(selectedEvent && selectedEvent.id),
      eventStartsAt: normalizeText(selectedEvent && selectedEvent.startsAt),
      venueId: getSelectedVenueId(),
      variant: state.selectedVariant,
      passengerFareKey: state.selectedPassengerFareKey
    };

    if (state.selectedVariant === "arrival" || state.selectedVariant === "round_trip") {
      input.originAddress = normalizePlaceForQuote(
        state.originAddressPlace,
        state.originAddress
      );
      input.originPickupTime = state.originPickupTime;
    }

    if (state.selectedVariant === "departure" || state.selectedVariant === "round_trip") {
      input.destinationAddress = normalizePlaceForQuote(
        state.destinationAddressPlace,
        state.destinationAddress
      );
      input.returnPickupTime = normalizeReturnPickupTimeValue(state.returnPickupTime);
      input.returnPickupDayOffset = getReturnPickupDayOffset(state.returnPickupTime);
    }

    return input;
  }

  function getQuoteSignature(input) {
    const safeInput = input && typeof input === "object" ? input : {};

    return JSON.stringify({
      eventId: safeInput.eventId || "",
      eventStartsAt: safeInput.eventStartsAt || "",
      venueId: safeInput.venueId || "",
      variant: safeInput.variant || "",
      passengerFareKey: safeInput.passengerFareKey || "",
      originAddress: safeInput.originAddress || null,
      originPickupTime: safeInput.originPickupTime || "",
      destinationAddress: safeInput.destinationAddress || null,
      returnPickupTime: safeInput.returnPickupTime || "",
      returnPickupDayOffset: safeInput.returnPickupDayOffset || 0
    });
  }

  function getQuotePayload(quoteResult) {
    const safeResult = quoteResult && typeof quoteResult === "object" ? quoteResult : {};
    const quote = safeResult.quote && typeof safeResult.quote === "object"
      ? safeResult.quote
      : safeResult;

    return quote && typeof quote === "object" ? quote : {};
  }

  function getQuotePrice(quoteResult) {
    const quote = getQuotePayload(quoteResult);
    const value = Number(
      quote.price ||
        quote.finalPrice ||
        quote.priceMxn ||
        quote.amount
    );

    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  
    function trackEventMobileQuoteReady() {
    const analytics = window.PixkuyAnalytics;
    const group = getGroup();
    const selectedEvent = getSelectedEvent();
    const quote = getQuotePayload(currentQuoteResult);
    const price = getQuotePrice(currentQuoteResult);
    const currency = normalizeText(quote.currency) || normalizeText(getPricing().currency) || "MXN";
    const dedupeKey = [
      "event_special",
      selectedEvent ? selectedEvent.id || "" : "",
      state.selectedVariant,
      state.selectedPassengerFareKey,
      state.originAddress,
      state.destinationAddress,
      state.originPickupTime,
      state.returnPickupTime,
      price,
      currency
    ].join("|");

    if (
      !analytics ||
      typeof analytics.trackOnce !== "function" ||
      !isMobileViewport() ||
      currentQuoteState !== "ready" ||
      !price
    ) {
      return false;
    }

    return analytics.trackOnce("pixkuy_mobile_quote_ready", {
      service_type: "event_special",
      flow_surface: "mobile_route",
      event_id: selectedEvent ? selectedEvent.id || "" : "",
      event_group_id: group ? group.id || "" : "",
      venue_id: getSelectedVenueId(),
      variant: state.selectedVariant,
      passenger_fare_key: state.selectedPassengerFareKey,
      price: price,
      currency: currency
    }, dedupeKey);
  }

  function renderQuoteUi() {
    const step = getStep();
    const fare = step ? step.querySelector(CONFIG_PRICE_SELECTOR) : null;
    const fareBox = fare ? fare.closest(".events-mobile-config-step__fare") : null;
    const label = fareBox ? fareBox.querySelector(".events-mobile-config-step__fare-label") : null;
    const pending = fareBox ? fareBox.querySelector("[data-events-mobile-config-fare-pending]") : null;
    const cta = step ? step.querySelector("[data-events-mobile-config-cta]") : null;
    const price = getQuotePrice(currentQuoteResult);
    const hasReadyPrice = currentQuoteState === "ready" && price > 0;
    const loadingText = getI18nValue("services.cards.events.panel.quoteLoading", "");
    const errorText = getI18nValue(
      currentQuoteResult && currentQuoteResult.messageKey,
      getI18nValue("services.cards.events.panel.quoteUnavailable", "")
    );
    const pendingText = getFarePendingText();

    if (fareBox) {
      fareBox.setAttribute(
        "data-events-mobile-fare-state",
        hasReadyPrice ? "ready" : currentQuoteState
      );
    }

    if (label) {
      label.hidden = !hasReadyPrice;
    }

    if (fare) {
      fare.hidden = !hasReadyPrice;
      fare.innerHTML = hasReadyPrice ? buildMoneyMarkup(price) : "";
    }

    if (pending) {
      if (hasReadyPrice) {
        pending.hidden = true;
        pending.textContent = "";
      } else if (currentQuoteState === "loading") {
        pending.hidden = false;
        pending.textContent = loadingText;
      } else if (currentQuoteState === "error") {
        pending.hidden = false;
        pending.textContent = errorText;
      } else {
        pending.hidden = !pendingText;
        pending.textContent = pendingText;
      }
    }

    if (cta) {
      cta.disabled = !hasReadyPrice;
      cta.setAttribute("aria-disabled", hasReadyPrice ? "false" : "true");
    }

    syncRouteEtaUi();

    return true;
  }

  function getRouteEtaText(role) {
    const quote = getQuotePayload(currentQuoteResult);
    let label;
    let time;

    if (currentQuoteState !== "ready") {
      return "";
    }

    if (role === "destination") {
      label = getI18nValue("services.cards.events.panel.estimatedDestinationArrivalLabel", "");
      time = buildEstimatedArrivalTime(
        normalizeReturnPickupTimeValue(state.returnPickupTime),
        quote.returnDurationSeconds
      );

      return label && time ? label + ": " + time : "";
    }

    label = getI18nValue("services.cards.events.panel.estimatedEventArrivalLabel", "");
    time = buildEstimatedArrivalTime(
      state.originPickupTime,
      quote.outboundDurationSeconds
    );

    return label && time ? label + ": " + time : "";
  }

  function syncRouteEtaUi() {
    const step = getStep();

    if (!step) {
      return false;
    }

    step.querySelectorAll("[data-events-mobile-route-eta]").forEach(function syncEta(node) {
      const role = normalizeText(node.getAttribute("data-events-mobile-route-eta"));
      const text = getRouteEtaText(role);

      node.textContent = text;
      node.hidden = !text;
    });

    return true;
  }

  function requestQuoteIfReady() {
    const quoteModule = getQuoteModule();
    const quoteInput = getQuoteInput();
    const quoteSignature = getQuoteSignature(quoteInput);
    const requestId = quoteRequestId + 1;

    if (!canRequestQuote()) {
      resetQuoteState();
      renderQuoteUi();
      return false;
    }

    if (!quoteModule) {
      quoteRequestId = requestId;
      lastQuoteSignature = quoteSignature;
      currentQuoteState = "error";
      currentQuoteResult = {
        messageKey: "services.cards.events.panel.quoteUnavailable"
      };
      renderQuoteUi();
      return false;
    }

    if (quoteSignature === lastQuoteSignature && currentQuoteState !== "pending") {
      renderQuoteUi();
      return true;
    }

    quoteRequestId = requestId;
    lastQuoteSignature = quoteSignature;
    currentQuoteState = "loading";
    currentQuoteResult = null;
    renderQuoteUi();

    quoteModule.requestQuote(quoteInput)
      .then(function onQuoteResult(result) {
        if (quoteRequestId !== requestId) {
          return;
        }

        if (!result || result.ok !== true || !getQuotePrice(result)) {
          currentQuoteState = "error";
          currentQuoteResult = result || {
            messageKey: "services.cards.events.panel.quoteUnavailable"
          };
          renderQuoteUi();
          return;
        }

        currentQuoteState = "ready";
        currentQuoteResult = result;
        renderQuoteUi();
        trackEventMobileQuoteReady();
      })
      .catch(function onQuoteError() {
        if (quoteRequestId !== requestId) {
          return;
        }

        currentQuoteState = "error";
        currentQuoteResult = {
          messageKey: "services.cards.events.panel.quoteUnavailable"
        };
        renderQuoteUi();
      });

    return true;
  }

  function getFareMissingFieldKeys() {
    const missing = [];

    if (shouldShowOriginFields()) {
      if (!state.originAddress) {
        missing.push("origin");
      }

      if (!state.originPickupTime) {
        missing.push("originTime");
      }
    }

    if (shouldShowDestinationFields()) {
      if (!state.destinationAddress) {
        missing.push("destination");
      }

      if (!normalizeReturnPickupTimeValue(state.returnPickupTime)) {
        missing.push("returnTime");
      }
    }

    return missing;
  }
  
  function normalizeListSeparatorValue(value, fallback) {
    const raw = typeof value === "string" ? value : "";
    const separator = raw.trim();
    const spacedWordSeparators = [
      "y",
      "and",
      "und",
      "et",
      "e",
      "и",
      "및"
    ];

    if (!separator) {
      return fallback;
    }

    if (separator === ",") {
      return ", ";
    }

    if (separator === "、") {
      return "、";
    }

    if (spacedWordSeparators.indexOf(separator) >= 0) {
      return " " + separator + " ";
    }

    return separator;
  }

  function joinFareMissingLabels(labels) {
    const safeLabels = Array.isArray(labels) ? labels.filter(Boolean) : [];
    const separator = normalizeListSeparatorValue(
      getI18nValue("services.cards.events.mobileFarePending.separator", ", "),
      ", "
    );
    const finalSeparator = normalizeListSeparatorValue(
      getI18nValue("services.cards.events.mobileFarePending.finalSeparator", " y "),
      " y "
    );

    if (safeLabels.length <= 1) {
      return safeLabels[0] || "";
    }

    if (safeLabels.length === 2) {
      return safeLabels[0] + finalSeparator + safeLabels[1];
    }

    return safeLabels.slice(0, -1).join(separator) +
      finalSeparator +
      safeLabels[safeLabels.length - 1];
  }

  function getFarePendingText() {
    const missingKeys = getFareMissingFieldKeys();
    const template = getI18nValue(
      "services.cards.events.mobileFarePending.template",
      ""
    );
    const labels = missingKeys.map(function mapMissingKey(key) {
      return getI18nValue(
        "services.cards.events.mobileFarePending.fields." + key,
        ""
      );
    });
    const fields = joinFareMissingLabels(labels);

    if (!template || !fields) {
      return "";
    }

    return template.replace("{fields}", fields);
  }

  function canRequestQuote() {
    return getFareMissingFieldKeys().length === 0;
  }

  function buildEstimatedArrivalTime(startTime, durationSeconds) {
    const time = normalizeTimeValue(startTime);
    const seconds = Number(durationSeconds);
    let parts;
    let baseMinutes;
    let addedMinutes;
    let totalMinutes;
    let hours;
    let minutes;

    if (!time || !Number.isFinite(seconds) || seconds <= 0) {
      return "";
    }

    parts = time.split(":");
    baseMinutes = (Number(parts[0]) * 60) + Number(parts[1]);
    addedMinutes = Math.ceil(seconds / 60);
    totalMinutes = (baseMinutes + addedMinutes) % (24 * 60);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;

    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function getReturnPickupDisplayValue(value) {
    const time = normalizeReturnPickupTimeValue(value);

    if (!time) {
      return "";
    }

    return getReturnPickupDayOffset(time) === 1 ? time + " +1" : time;
  }

  function getSelectedVenueLabel() {
    return getVenueName();
  }

  function getContactStepApi() {
    const api = window.PixkuyEventsMobileContactStep;

    return api && typeof api.open === "function" ? api : null;
  }

  function buildContactHandoffPayload() {
    const group = getGroup();
    const selectedEvent = getSelectedEvent();
    const quote = getQuotePayload(currentQuoteResult);
    const quotePrice = getQuotePrice(currentQuoteResult);
    const originAddress = normalizePlaceForQuote(
      state.originAddressPlace,
      state.originAddress
    );
    const destinationAddress = normalizePlaceForQuote(
      state.destinationAddressPlace,
      state.destinationAddress
    );

    if (
      !group ||
      !selectedEvent ||
      currentQuoteState !== "ready" ||
      !quotePrice
    ) {
      return null;
    }

    return {
      event_special_event_id: normalizeText(selectedEvent.id),
      event_special_event_label: getEventTitle(group),
      event_special_event_type: normalizeText(selectedEvent.type || group.type),
      event_special_event_starts_at: normalizeText(selectedEvent.startsAt),
      event_special_venue_id: getSelectedVenueId(),
      event_special_venue_label: getSelectedVenueLabel(),
      event_special_variant: state.selectedVariant,
      event_special_variant_label: getVariantLabel(state.selectedVariant),
      event_special_origin_address: originAddress ? originAddress.label : "",
      event_special_origin_address_place_id: originAddress ? originAddress.placeId : "",
      event_special_origin_address_lat: originAddress && originAddress.lat !== null ? String(originAddress.lat) : "",
      event_special_origin_address_lng: originAddress && originAddress.lng !== null ? String(originAddress.lng) : "",
      event_special_destination_address: destinationAddress ? destinationAddress.label : "",
      event_special_destination_address_place_id: destinationAddress ? destinationAddress.placeId : "",
      event_special_destination_address_lat: destinationAddress && destinationAddress.lat !== null ? String(destinationAddress.lat) : "",
      event_special_destination_address_lng: destinationAddress && destinationAddress.lng !== null ? String(destinationAddress.lng) : "",
      event_special_origin_pickup_time: state.originPickupTime,
      event_special_return_pickup_time: normalizeReturnPickupTimeValue(state.returnPickupTime),
      event_special_return_pickup_day_offset: String(getReturnPickupDayOffset(state.returnPickupTime) || 0),
      event_special_return_pickup_label: getReturnPickupDisplayValue(state.returnPickupTime),
      event_special_estimated_event_arrival_time: buildEstimatedArrivalTime(
        state.originPickupTime,
        quote.outboundDurationSeconds
      ),
      event_special_estimated_destination_arrival_time: buildEstimatedArrivalTime(
        normalizeReturnPickupTimeValue(state.returnPickupTime),
        quote.returnDurationSeconds
      ),
      event_special_outbound_duration_seconds: quote.outboundDurationSeconds != null ? String(quote.outboundDurationSeconds) : "",
      event_special_return_duration_seconds: quote.returnDurationSeconds != null ? String(quote.returnDurationSeconds) : "",
      event_special_outbound_distance_meters: quote.outboundDistanceMeters != null ? String(quote.outboundDistanceMeters) : "",
      event_special_return_distance_meters: quote.returnDistanceMeters != null ? String(quote.returnDistanceMeters) : "",
      event_special_passenger_fare_key: state.selectedPassengerFareKey,
      event_special_passenger_bucket_label: getPassengerFareLabel(state.selectedPassengerFareKey),
      event_special_price: String(quotePrice),
      event_special_currency: normalizeText(quote.currency) || normalizeText(getPricing().currency) || "MXN",
      event_special_notes: ""
    };
  }
  
    function trackEventMobileContinueClick() {
    const analytics = window.PixkuyAnalytics;
    const group = getGroup();
    const selectedEvent = getSelectedEvent();
    const quote = getQuotePayload(currentQuoteResult);
    const price = getQuotePrice(currentQuoteResult);
    const currency = normalizeText(quote.currency) || normalizeText(getPricing().currency) || "MXN";

    if (
      !analytics ||
      typeof analytics.track !== "function" ||
      !isMobileViewport() ||
      currentQuoteState !== "ready" ||
      !price
    ) {
      return false;
    }

    return analytics.track("pixkuy_continue_click", {
      service_type: "event_special",
      flow_surface: "mobile_route",
      event_id: selectedEvent ? selectedEvent.id || "" : "",
      event_group_id: group ? group.id || "" : "",
      venue_id: getSelectedVenueId(),
      variant: state.selectedVariant,
      passenger_fare_key: state.selectedPassengerFareKey,
      price: price,
      currency: currency
    });
  }

  function openContactStep() {
    const contactStep = getContactStepApi();
    const step = getStep();
    const payload = buildContactHandoffPayload();

    if (!contactStep || !step || !payload) {
      return false;
    }

    return contactStep.open(step, payload);
  }

  function syncFareAndCta() {
    requestQuoteIfReady();

    return true;
  }

  function shouldShowOriginFields() {
    return state.selectedVariant === "arrival" || state.selectedVariant === "round_trip";
  }

  function shouldShowDestinationFields() {
    return state.selectedVariant === "departure" || state.selectedVariant === "round_trip";
  }

  function normalizeTimeValue(value) {
    const raw = String(value || "").trim();
    return /^\d{2}:\d{2}$/.test(raw) ? raw : "";
  }

  function timeToMinutes(value) {
    const time = normalizeTimeValue(value);
    const parts = time ? time.split(":") : [];

    if (parts.length !== 2) {
      return null;
    }

    return (Number(parts[0]) * 60) + Number(parts[1]);
  }

  function getSelectedEventStartTime() {
    const selectedEvent = getSelectedEvent();
    const raw = selectedEvent && selectedEvent.startsAt
      ? String(selectedEvent.startsAt)
      : "";
    const match = raw.match(/T(\d{2}:\d{2})$/);

    return match ? match[1] : "";
  }

  function getReturnPickupDayOffset(value) {
    const pickupMinutes = timeToMinutes(value);
    const eventStartMinutes = timeToMinutes(getSelectedEventStartTime());

    if (pickupMinutes === null || eventStartMinutes === null) {
      return 0;
    }

    if (
      pickupMinutes <= RETURN_PICKUP_NEXT_DAY_CUTOFF_MINUTES &&
      pickupMinutes <= eventStartMinutes
    ) {
      return 1;
    }

    return 0;
  }

  function isReturnPickupTimeAllowed(value) {
    const pickupMinutes = timeToMinutes(value);
    const eventStartMinutes = timeToMinutes(getSelectedEventStartTime());

    if (pickupMinutes === null || eventStartMinutes === null) {
      return false;
    }

    return pickupMinutes > eventStartMinutes || getReturnPickupDayOffset(value) === 1;
  }

  function normalizeReturnPickupTimeValue(value) {
    const time = normalizeTimeValue(value);

    if (!time) {
      return "";
    }

    return isReturnPickupTimeAllowed(time) ? time : "";
  }

  function destroyAddressControllers() {
    addressControllers.forEach(function destroyController(controller) {
      if (controller && typeof controller.destroy === "function") {
        controller.destroy();
      }
    });

    addressControllers = [];
  }

  function setAddressValue(role, value) {
    if (role === "destination") {
      state.destinationAddress = normalizeText(value);
      state.destinationAddressPlace = null;
      return true;
    }

    state.originAddress = normalizeText(value);
    state.originAddressPlace = null;
    return true;
  }

  function setAddressPlace(role, selectedPlace) {
    const label = selectedPlace && selectedPlace.label
      ? selectedPlace.label
      : "";

    if (role === "destination") {
      state.destinationAddress = normalizeText(label) || state.destinationAddress;
      state.destinationAddressPlace = selectedPlace || null;
      return true;
    }

    state.originAddress = normalizeText(label) || state.originAddress;
    state.originAddressPlace = selectedPlace || null;
    return true;
  }

  function clearAddress(role) {
    return setAddressValue(role, "");
  }

  function getAddressInput(role) {
    const step = getStep();

    return step
      ? step.querySelector('[data-events-mobile-address-input][data-events-mobile-address-role="' + role + '"]')
      : null;
  }

  function syncAddressClearState(role) {
    const step = getStep();
    const input = getAddressInput(role);
    const clear = step
      ? step.querySelector('[data-events-mobile-address-clear="' + role + '"]')
      : null;
    const hasValue = Boolean(normalizeText(input && input.value));

    if (clear) {
      clear.hidden = !hasValue;
    }

    return true;
  }

  function syncAllAddressClearState() {
    syncAddressClearState("origin");
    syncAddressClearState("destination");

    return true;
  }

  function syncAddressStateFromInput(input) {
    const role = normalizeText(input && input.getAttribute("data-events-mobile-address-role"));
    const value = input ? input.value : "";

    if (role !== "origin" && role !== "destination") {
      return false;
    }

    setAddressValue(role, value);
    syncAddressClearState(role);

    return true;
  }

  function clearAddressField(role) {
    const input = getAddressInput(role);

    clearAddress(role);

    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.blur();
    }

    syncAddressClearState(role);
    syncFareAndCta();

    return true;
  }

  function buildDateOptionsMarkup() {
    const group = getGroup();
    const events = group && Array.isArray(group.events) ? group.events : [];

    return events.map(function mapEvent(event) {
      const isSelected = event.id === state.selectedEventId;

      return [
        '<option value="' + escapeHtml(event.id) + '"',
        isSelected ? ' selected' : '',
        '>',
        escapeHtml(getEventDateLabel(event)),
        '</option>'
      ].join("");
    }).join("");
  }

  function buildDateCardMarkup(selectedEvent, dateLabel) {
    const parts = getEventDateParts(selectedEvent);

    return [
      '<label class="events-mobile-config-step__date-card" for="events-mobile-date" aria-label="' + escapeHtml(parts.label || dateLabel) + '">',
      '<span class="events-mobile-config-step__date-card-top">',
      '<span class="events-mobile-config-step__date-card-month">' + escapeHtml(parts.month || dateLabel) + '</span>',
      '</span>',
      '<span class="events-mobile-config-step__date-card-body">',
      '<span class="events-mobile-config-step__date-card-day">' + escapeHtml(parts.day || "—") + '</span>',
      '</span>',
      '<span class="events-mobile-config-step__date-card-bottom">',
      '<span class="events-mobile-config-step__date-card-weekday">' + escapeHtml(parts.weekday) + '</span>',
      '<span class="events-mobile-config-step__date-card-time">' + escapeHtml(parts.time || parts.label) + '</span>',
      '</span>',
      '<select id="events-mobile-date" class="events-mobile-config-step__date-select" data-events-mobile-config-field="date" aria-label="' + escapeHtml(dateLabel) + '">',
      buildDateOptionsMarkup(),
      '</select>',
      '</label>'
    ].join("");
  }

  function buildVariantOptionsMarkup() {
    return getAvailableVariants().map(function mapVariant(variantId) {
      const isSelected = variantId === state.selectedVariant;

      return [
        '<button type="button"',
        ' class="events-mobile-config-step__variant-option"',
        ' data-events-mobile-variant-option="' + escapeHtml(variantId) + '"',
        ' aria-pressed="' + (isSelected ? 'true' : 'false') + '">',
        escapeHtml(getVariantLabel(variantId)),
        '</button>'
      ].join("");
    }).join("");
  }

  function buildPassengerOptionsMarkup() {
    return getAvailablePassengerFareKeys().map(function mapFareKey(fareKey) {
      const isSelected = fareKey === state.selectedPassengerFareKey;

      return [
        '<option value="' + escapeHtml(fareKey) + '"',
        isSelected ? ' selected' : '',
        '>',
        escapeHtml(getPassengerFareLabel(fareKey)),
        '</option>'
      ].join("");
    }).join("");
  }

  function getAddressPlaceholder(role) {
    if (role === "destination") {
      return getI18nValue(
        "services.cards.events.panel.addressReturnDestinationPlaceholder",
        getI18nValue("services.cards.events.panel.addressDestinationPlaceholder", "")
      );
    }

    return getI18nValue(
      "services.cards.events.panel.addressOriginPlaceholder",
      getI18nValue("services.cards.events.panel.addressPlaceholder", "")
    );
  }

  function buildAddressMarkup(role) {
    const inputId = role === "destination"
      ? "events-mobile-destination-address"
      : "events-mobile-origin-address";
    const value = role === "destination"
      ? state.destinationAddress
      : state.originAddress;
    const placeholder = getAddressPlaceholder(role);

    return [
      '<div class="place-autocomplete events-mobile-address-compact" data-events-mobile-address-shell="' + escapeHtml(role) + '">',
      '<input',
      ' id="' + escapeHtml(inputId) + '"',
      ' type="text"',
      ' class="events-mobile-config-step__control events-mobile-config-step__control--address"',
      ' data-events-mobile-address-input',
      ' data-events-mobile-address-role="' + escapeHtml(role) + '"',
      ' autocomplete="off"',
      ' spellcheck="false"',
      ' readonly',
      ' value="' + escapeHtml(value) + '"',
      ' placeholder="' + escapeHtml(placeholder) + '"',
      ' />',
      '<button type="button" class="place-autocomplete__clear" data-events-mobile-address-clear="' + escapeHtml(role) + '"' + (value ? '' : ' hidden') + '>',
      '<span aria-hidden="true">×</span>',
      '</button>',
      '<div class="place-autocomplete__mount" data-events-mobile-address-compact-mount aria-hidden="true"></div>',
      '</div>'
    ].join("");
  }

  function getRouteGroupLabel(role) {
    if (role === "destination") {
      return getI18nValue(
        "services.cards.events.panel.addressReturnDestinationPickupLabel",
        ""
      );
    }

    return getI18nValue(
      "services.cards.events.panel.addressOriginPickupLabel",
      ""
    );
  }

  function buildTimeFieldMarkup(role) {
    const isDestination = role === "destination";
    const inputId = isDestination
      ? "events-mobile-return-pickup-time"
      : "events-mobile-origin-pickup-time";
    const value = isDestination
      ? state.returnPickupTime
      : state.originPickupTime;
    const label = isDestination
      ? getI18nValue("services.cards.events.panel.pickupTimeAfterEventLabel", "")
      : getI18nValue("services.cards.events.panel.pickupTimeOriginLabel", "");
    const labelMarkup = '<label class="visually-hidden" for="' + escapeHtml(inputId) + '">' + escapeHtml(label) + '</label>';

    return [
      '<div class="events-mobile-config-step__field events-mobile-config-step__field--time">',
      labelMarkup,
      '<div class="events-mobile-config-step__time-wrap" data-events-mobile-time-state="' + (value ? 'value' : 'empty') + '">',
      '<input',
      ' id="' + escapeHtml(inputId) + '"',
      ' type="time"',
      ' class="events-mobile-config-step__control events-mobile-config-step__control--time"',
      ' data-events-mobile-config-time="' + (isDestination ? 'return' : 'origin') + '"',
      ' value="' + escapeHtml(value) + '"',
      ' />',
      '<span class="events-mobile-config-step__time-overlay" aria-hidden="true">--:--</span>',
      '<span class="events-mobile-config-step__time-icon" aria-hidden="true">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>',
      '<polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>',
      '</svg>',
      '</span>',
      '</div>',
      '</div>'
    ].join("");
  }

  function buildRouteGroupMarkup(role) {
    const groupLabel = getRouteGroupLabel(role);

    return [
      '<div class="events-mobile-config-step__route-group" data-events-mobile-config-route="' + escapeHtml(role) + '">',
      groupLabel
        ? '<div class="events-mobile-config-step__route-label">' + escapeHtml(groupLabel) + '</div>'
        : '',
      '<div class="events-mobile-config-step__route-fields">',
      '<div class="events-mobile-config-step__address" data-events-mobile-config-address-role="' + escapeHtml(role) + '">',
      buildAddressMarkup(role),
      '</div>',
      buildTimeFieldMarkup(role),
      '</div>',
      '<p class="events-mobile-config-step__route-eta" data-events-mobile-route-eta="' + escapeHtml(role) + '" hidden></p>',
      '</div>'
    ].join("");
  }

  function buildStepMarkup() {
    const group = getGroup();
    const selectedEvent = getSelectedEvent();
    const title = getEventTitle(group);
    const venueName = getVenueName();
    const venueAddress = getVenueAddress();
    const poster = group ? group.posterMobileSrc || group.posterSrc || "" : "";
    const posterAlt = getI18nValue("services.cards.events.panel.posterAlt", "");
    const backText = getI18nValue("services.cards.events.mobileFlow.back", "");
    const dateLabel = getI18nValue("services.cards.events.panel.dateLabel", "");
    const variantLabel = getI18nValue("services.cards.events.panel.variantLabel", "");
    const passengersLabel = getI18nValue("services.cards.events.panel.passengersLabel", "");
    const priceLabel = getI18nValue("services.cards.events.panel.priceLabel", "");
    const ctaText = getI18nValue("services.cards.events.mobileFlow.continue", "");

    if (!group || !selectedEvent) {
      return "";
    }

    return [
      '<section class="events-mobile-config-step" data-events-mobile-config-step aria-hidden="true" hidden>',
      '<div class="events-mobile-config-step__screen">',
      '<div class="events-mobile-config-step__content">',
      '<div class="events-mobile-config-step__back-row">',
      '<button type="button" class="events-mobile-config-step__back" data-events-mobile-config-back>' + escapeHtml(backText) + '</button>',
      '</div>',

      '<div class="events-mobile-config-step__summary">',
      '<div class="events-mobile-config-step__image-button" role="button" tabindex="0" data-events-mobile-poster-trigger aria-label="' + escapeHtml(posterAlt + ": " + title) + '">',
      '<img class="events-mobile-config-step__image" src="' + escapeHtml(poster) + '" alt="' + escapeHtml(posterAlt + ": " + title) + '" loading="lazy" decoding="async" />',
      '</div>',
      '<div class="events-mobile-config-step__summary-copy">',
      '<h3 class="events-mobile-config-step__title">' + escapeHtml(title) + '</h3>',
      '<p class="events-mobile-config-step__venue">' + escapeHtml(venueName) + '</p>',
      venueAddress
        ? '<p class="events-mobile-config-step__venue-address">' + escapeHtml(venueAddress) + '</p>'
        : '',
      '</div>',
      buildDateCardMarkup(selectedEvent, dateLabel),
      '</div>',

      '<div class="events-mobile-config-step__fields">',
      '<div class="events-mobile-config-step__variant-tabs" role="group" aria-label="' + escapeHtml(variantLabel) + '">',
      buildVariantOptionsMarkup(),
      '</div>',

      '<div class="events-mobile-config-step__field">',
      '<label class="events-mobile-config-step__label" for="events-mobile-passengers">' + escapeHtml(passengersLabel) + '</label>',
      '<select id="events-mobile-passengers" class="events-mobile-config-step__control" data-events-mobile-config-field="passengers">',
      buildPassengerOptionsMarkup(),
      '</select>',
      '</div>',

      shouldShowOriginFields() ? buildRouteGroupMarkup("origin") : '',
      shouldShowDestinationFields() ? buildRouteGroupMarkup("destination") : '',
      '</div>',

      '<div class="events-mobile-config-step__footer">',
      '<div class="events-mobile-config-step__vehicle">',
      '<img class="events-mobile-config-step__vehicle-image" src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="" loading="lazy" decoding="async" aria-hidden="true" />',
      '</div>',
      '<div class="events-mobile-config-step__fare" data-events-mobile-fare-state="pending">',
      '<span class="events-mobile-config-step__fare-label" hidden>' + escapeHtml(priceLabel) + '</span>',
      '<strong class="events-mobile-config-step__fare-value" data-events-mobile-config-price hidden>' + buildMoneyMarkup(0) + '</strong>',
      '<p class="events-mobile-config-step__fare-pending" data-events-mobile-config-fare-pending>' + escapeHtml(getFarePendingText()) + '</p>',
      '</div>',
      '<button type="button" class="cta events-mobile-config-step__cta" data-events-mobile-config-cta disabled aria-disabled="true">' + escapeHtml(ctaText) + '</button>',
      '</div>',

      '</div>',
      '</div>',
      '</section>'
    ].join("");
  }

  function mountAddressControllers() {
    const step = getStep();
    const addressModule = getAddressModule();
    const roots = step
      ? Array.from(step.querySelectorAll("[data-events-mobile-config-address-field]"))
      : [];

    destroyAddressControllers();

    if (!addressModule || !roots.length) {
      return false;
    }

    roots.forEach(function mountAddressRoot(root) {
      const role = root.getAttribute("data-events-mobile-config-address-role") || "origin";
      const fieldName = role === "destination"
        ? "events_mobile_destination_address"
        : "events_mobile_origin_address";

      const controller = addressModule.mount({
        root,
        fieldName,
        onManualInput: function onManualInput(value) {
          setAddressValue(role, value);
        },
        onPlaceSelected: function onPlaceSelected(selectedPlace) {
          setAddressPlace(role, selectedPlace);
        },
        onClearSelection: function onClearSelection() {
          clearAddress(role);
        },
        onError: function onError() {
          if (role === "destination") {
            state.destinationAddressPlace = null;
            return;
          }

          state.originAddressPlace = null;
        }
      });

      if (controller) {
        addressControllers.push(controller);
      }
    });

    return true;
  }

  function syncTimeOverlayState(input) {
    const wrap = input ? input.closest(".events-mobile-config-step__time-wrap") : null;

    if (!wrap) {
      return false;
    }

    wrap.setAttribute(
      "data-events-mobile-time-state",
      normalizeTimeValue(input.value) ? "value" : "empty"
    );

    return true;
  }

  function syncStateFromFields() {
    const step = getStep();
    const date = step ? step.querySelector('[data-events-mobile-config-field="date"]') : null;
    const variant = step ? step.querySelector('[data-events-mobile-variant-option][aria-pressed="true"]') : null;
    const passengers = step ? step.querySelector('[data-events-mobile-config-field="passengers"]') : null;
    const originTime = step ? step.querySelector('[data-events-mobile-config-time="origin"]') : null;
    const returnTime = step ? step.querySelector('[data-events-mobile-config-time="return"]') : null;

    state.selectedEventId = normalizeText(date && date.value) || state.selectedEventId;
    state.selectedVariant = normalizeText(
      variant && variant.getAttribute("data-events-mobile-variant-option")
    ) || state.selectedVariant;
    state.selectedPassengerFareKey = normalizeText(passengers && passengers.value) || state.selectedPassengerFareKey;
    state.originPickupTime = normalizeTimeValue(originTime && originTime.value);
    state.returnPickupTime = normalizeReturnPickupTimeValue(returnTime && returnTime.value);
    state.returnPickupDayOffset = getReturnPickupDayOffset(state.returnPickupTime);

    if (returnTime && returnTime.value && !state.returnPickupTime) {
      returnTime.value = "";
    }

    return true;
  }

  function syncSelectedEventUi() {
    const step = getStep();
    const selectedEvent = getSelectedEvent();
    const dateCard = step ? step.querySelector(".events-mobile-config-step__date-card") : null;
    const venue = step ? step.querySelector(".events-mobile-config-step__venue") : null;
    const dateSelect = step ? step.querySelector('[data-events-mobile-config-field="date"]') : null;
    const dateLabel = getI18nValue("services.cards.events.panel.dateLabel", "");

    if (!step || !selectedEvent) {
      return false;
    }

    if (dateCard) {
      const wrapper = document.createElement("div");

      wrapper.innerHTML = buildDateCardMarkup(selectedEvent, dateLabel);

      if (wrapper.firstElementChild) {
        dateCard.replaceWith(wrapper.firstElementChild);
      }
    }

    if (venue) {
      venue.textContent = getVenueName();
    }

    if (dateSelect) {
      dateSelect.value = state.selectedEventId;
    }

    return true;
  }

  function getPosterViewerPayload() {
    const group = getGroup();
    const title = getEventTitle(group);
    const poster = group ? group.posterMobileSrc || group.posterSrc || "" : "";
    const posterAlt = getI18nValue("services.cards.events.panel.posterAlt", "");

    if (!poster) {
      return null;
    }

    return {
      src: poster,
      alt: posterAlt + ": " + title
    };
  }

  function buildPosterViewerNode() {
    const root = document.createElement("section");
    const backdrop = document.createElement("button");
    const panel = document.createElement("div");
    const close = document.createElement("button");
    const image = document.createElement("img");

    root.className = "events-mobile-poster-viewer";
    root.setAttribute("data-events-mobile-poster-viewer", "1");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.hidden = true;

    backdrop.type = "button";
    backdrop.className = "events-mobile-poster-viewer__backdrop";
    backdrop.setAttribute("data-events-mobile-poster-viewer-close", "1");
    backdrop.setAttribute("aria-label", getI18nValue("services.cards.events.panel.posterCloseLabel", ""));

    panel.className = "events-mobile-poster-viewer__panel";
    panel.setAttribute("role", "document");

    close.type = "button";
    close.className = "events-mobile-poster-viewer__close";
    close.setAttribute("data-events-mobile-poster-viewer-close", "1");
    close.setAttribute("aria-label", getI18nValue("services.cards.events.panel.posterCloseLabel", ""));
    close.textContent = "×";

    image.className = "events-mobile-poster-viewer__image";
    image.setAttribute("data-events-mobile-poster-viewer-image", "1");
    image.decoding = "async";

    panel.appendChild(close);
    panel.appendChild(image);
    root.appendChild(backdrop);
    root.appendChild(panel);

    return root;
  }

  function ensurePosterViewerNode() {
    if (posterViewerNode) {
      return posterViewerNode;
    }

    posterViewerNode = document.querySelector("[data-events-mobile-poster-viewer]");

    if (!posterViewerNode) {
      posterViewerNode = buildPosterViewerNode();
      document.body.appendChild(posterViewerNode);
    }

    posterViewerNode.addEventListener("click", function onPosterViewerClick(event) {
      if (!event.target.closest("[data-events-mobile-poster-viewer-close]")) {
        return;
      }

      event.preventDefault();
      closePosterViewer();
    });

    return posterViewerNode;
  }

  function syncPosterViewer() {
    const payload = getPosterViewerPayload();
    const viewer = ensurePosterViewerNode();
    const image = viewer ? viewer.querySelector("[data-events-mobile-poster-viewer-image]") : null;

    if (!payload || !image) {
      return false;
    }

    image.src = payload.src;
    image.alt = payload.alt;

    return true;
  }

  function openPosterViewer() {
    const payload = getPosterViewerPayload();
    const viewer = ensurePosterViewerNode();
    const close = viewer ? viewer.querySelector("[data-events-mobile-poster-viewer-close]") : null;

    if (!payload || !viewer || !isMobileViewport()) {
      return false;
    }

    posterPreviousFocus = document.activeElement;
    syncPosterViewer();

    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");
    document.body.setAttribute(BODY_POSTER_VIEWER_ATTR, "true");

    if (close && typeof close.focus === "function") {
      close.focus({ preventScroll: true });
    }

    return true;
  }

  function closePosterViewer() {
    const viewer = posterViewerNode || document.querySelector("[data-events-mobile-poster-viewer]");

    if (!viewer) {
      return false;
    }

    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");
    document.body.setAttribute(BODY_POSTER_VIEWER_ATTR, "false");

    if (
      posterPreviousFocus &&
      typeof posterPreviousFocus.focus === "function" &&
      document.contains(posterPreviousFocus)
    ) {
      posterPreviousFocus.focus({ preventScroll: true });
    }

    posterPreviousFocus = null;

    return true;
  }

  function isPosterViewerOpen() {
    const viewer = posterViewerNode || document.querySelector("[data-events-mobile-poster-viewer]");

    return Boolean(
      viewer &&
        viewer.hidden !== true &&
        viewer.getAttribute("aria-hidden") !== "true"
    );
  }

  function syncVariantOptionsUi() {
    const step = getStep();

    if (!step) {
      return false;
    }

    step.querySelectorAll("[data-events-mobile-variant-option]").forEach(function syncVariantOption(button) {
      const variantId = normalizeText(button.getAttribute("data-events-mobile-variant-option"));
      const isActive = variantId === state.selectedVariant;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    return true;
  }

  function syncRouteGroupsUi() {
    const step = getStep();
    const fields = step ? step.querySelector(".events-mobile-config-step__fields") : null;
    const passengerField = step ? step.querySelector("#events-mobile-passengers") : null;
    const passengerWrapper = passengerField ? passengerField.closest(".events-mobile-config-step__field") : null;
    const html = [
      shouldShowOriginFields() ? buildRouteGroupMarkup("origin") : '',
      shouldShowDestinationFields() ? buildRouteGroupMarkup("destination") : ''
    ].join("");

    if (!fields || !passengerWrapper) {
      return false;
    }

    fields.querySelectorAll("[data-events-mobile-config-route]").forEach(function removeRouteGroup(routeGroup) {
      routeGroup.remove();
    });

    passengerWrapper.insertAdjacentHTML("afterend", html);
    syncAllAddressClearState();
    syncFareAndCta();

    return true;
  }

  function renderStep() {
    const route = getRoute();
    const wasOpen = isOpen();

    if (!route) {
      return false;
    }

    destroyAddressControllers();

    if (!stepNode) {
      stepNode = document.createElement("div");
      route.appendChild(stepNode);
    }

    stepNode.outerHTML = buildStepMarkup();
    stepNode = route.querySelector(CONFIG_STEP_SELECTOR);

    if (wasOpen && stepNode) {
      stepNode.hidden = false;
      stepNode.setAttribute("aria-hidden", "false");
    }

    bindStepEvents();
    mountAddressControllers();
    syncAllAddressClearState();
    syncFareAndCta();

    return true;
  }

  function blurActiveElementInside(node) {
    const activeElement = document.activeElement;

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

  function setStepVisibility(isVisible) {
    const step = getStep();

    if (!step) {
      return false;
    }

    if (!isVisible) {
      blurActiveElementInside(step);
    }

    step.hidden = !isVisible;
    step.setAttribute("aria-hidden", isVisible ? "false" : "true");
    document.body.setAttribute(BODY_CONFIG_ATTR, isVisible ? "true" : "false");

    return true;
  }

  function open(route, payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const group = safePayload.group || null;
    const variants = safePayload.pricing && safePayload.pricing.variants
      ? safePayload.pricing.variants
      : {};
    const passengerFactors = safePayload.pricing && safePayload.pricing.passengerFactors
      ? safePayload.pricing.passengerFactors
      : {};

    if (!isMobileViewport() || !route || !group) {
      return false;
    }

    currentPayload = safePayload;
    resetQuoteState();

    state = {
      selectedEventId: group.events && group.events[0] ? group.events[0].id : "",
      selectedVariant: variants[DEFAULT_VARIANT] ? DEFAULT_VARIANT : Object.keys(variants)[0] || DEFAULT_VARIANT,
      selectedPassengerFareKey: passengerFactors[DEFAULT_PASSENGER_FARE_KEY]
        ? DEFAULT_PASSENGER_FARE_KEY
        : Object.keys(passengerFactors)[0] || DEFAULT_PASSENGER_FARE_KEY,
      originAddress: "",
      originAddressPlace: null,
      destinationAddress: "",
      destinationAddressPlace: null,
      originPickupTime: "",
      returnPickupTime: "",
      returnPickupDayOffset: 0
    };

    renderStep();
    setStepVisibility(true);

    return true;
  }

  function close() {
    destroyAddressControllers();
    setStepVisibility(false);
    return true;
  }

  function isOpen() {
    const step = getStep();

    return Boolean(
      step &&
        step.hidden !== true &&
        step.getAttribute("aria-hidden") !== "true"
    );
  }

  function bindStepEvents() {
    const step = getStep();

    if (!step || step.dataset.eventsMobileConfigBound === "1") {
      return false;
    }

    step.dataset.eventsMobileConfigBound = "1";

    step.addEventListener("click", function onConfigClick(event) {
      const back = event.target.closest(CONFIG_BACK_SELECTOR);
      const posterTrigger = event.target.closest(CONFIG_POSTER_TRIGGER_SELECTOR);
      const variantOption = event.target.closest("[data-events-mobile-variant-option]");
      const addressClear = event.target.closest(CONFIG_ADDRESS_CLEAR_SELECTOR);
      const cta = event.target.closest("[data-events-mobile-config-cta]");

      if (posterTrigger) {
        event.preventDefault();
        openPosterViewer();
        return;
      }

      if (back) {
        event.preventDefault();
        close();
        return;
      }

      if (addressClear) {
        event.preventDefault();
        event.stopPropagation();
        clearAddressField(normalizeText(addressClear.getAttribute("data-events-mobile-address-clear")));
        return;
      }

      if (cta) {
        event.preventDefault();

        if (cta.disabled || cta.getAttribute("aria-disabled") === "true") {
          return;
        }

        if (openContactStep()) {
          trackEventMobileContinueClick();
        }

        return;
      }

      if (variantOption) {
        event.preventDefault();
        state.selectedVariant = normalizeText(
          variantOption.getAttribute("data-events-mobile-variant-option")
        ) || state.selectedVariant;
        syncVariantOptionsUi();
        syncRouteGroupsUi();
      }
    });

    step.addEventListener("pixkuy:events-mobile-address-place", function onAddressPlace(event) {
      const detail = event.detail || {};
      const role = normalizeText(detail.role);
      const selectedPlace = detail.selectedPlace || null;

      if (role !== "origin" && role !== "destination") {
        return;
      }

      setAddressPlace(role, selectedPlace);
      syncAddressClearState(role);
      syncFareAndCta();
    });

    step.addEventListener("input", function onConfigInput(event) {
      if (
        event.target &&
        event.target.matches('[data-events-mobile-config-time]')
      ) {
        syncStateFromFields();
        syncTimeOverlayState(event.target);
        return;
      }

       if (
        event.target &&
        event.target.matches("[data-events-mobile-address-input]")
      ) {
        syncAddressStateFromInput(event.target);
        syncFareAndCta();
      }
    });

    step.addEventListener("keydown", function onConfigKeydown(event) {
      const posterTrigger = event.target && event.target.closest
        ? event.target.closest(CONFIG_POSTER_TRIGGER_SELECTOR)
        : null;

      if (isPosterViewerOpen() && event.key === "Escape") {
        event.preventDefault();
        closePosterViewer();
        return;
      }

      if (!posterTrigger || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }

      event.preventDefault();
      openPosterViewer();
    });

    step.addEventListener("change", function onConfigChange(event) {
     if (
        event.target &&
        event.target.matches(CONFIG_FIELD_SELECTOR + ', [data-events-mobile-config-time]')
      ) {
        syncStateFromFields();

        if (event.target.matches('[data-events-mobile-config-field="date"]')) {
          syncSelectedEventUi();
        }

        if (event.target.matches('[data-events-mobile-config-time]')) {
          syncTimeOverlayState(event.target);
        }

        syncFareAndCta();
      }
    });

    return true;
  }

  window.PixkuyEventsMobileConfigStep = {
    open,
    close,
    isOpen
  };

  window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
    if (isOpen()) {
      renderStep();
      setStepVisibility(true);
    }
  });
})(window, document);