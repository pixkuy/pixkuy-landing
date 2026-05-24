(function initContactEventSpecialEditorModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});
  const SERVICE_TYPE = "event_special";
  const DEFAULT_CURRENCY = "MXN";
  const DATA_BASE = "assets/js/data";
  const MAX_VISIBLE_GROUPS = 10;
  const MIN_LEAD_HOURS = 6;
  const HORIZON_DAYS = 30;
  const CDMX_TIME_ZONE = "America/Mexico_City";
  const RETURN_PICKUP_NEXT_DAY_CUTOFF_MINUTES = 120;

  const state = {
    loaded: false,
    loading: false,
    groups: [],
    venuesById: {},
    pricing: {},
    selectedGroupId: "",
    selectedEventId: "",
    selectedVariant: "arrival",
    selectedPassengerFareKey: "van_1_2",
    originAddress: "",
    originPlaceId: "",
    originLat: "",
    originLng: "",
    originPlace: null,
    destinationAddress: "",
    destinationPlaceId: "",
    destinationLat: "",
    destinationLng: "",
    destinationPlace: null,
    originPickupTime: "",
    returnPickupTime: "",
    returnPickupDayOffset: 0,
    quoteStatus: "pending",
    quote: null,
    quoteMessageKey: "services.cards.events.panel.quotePending",
    quoteRequestId: 0,
    addressControllers: []
  };

  const nativeTimePickerState = {
    activeField: "",
    pendingField: "",
    pendingValue: ""
  };

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      return NAMESPACE.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function getI18nValue(path, fallback) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = path ? String(path).split(".") : [];
    let cursor = dict;
    let index;

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      return getValue(dict, path) || fallback || "";
    }

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function getDocumentLanguage() {
    const language = document.documentElement && document.documentElement.lang;

    if (typeof language === "string" && language.trim()) {
      return language.trim().toLowerCase();
    }

    return "es";
  }

  function parseLocalDateTimeToMinutes(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) {
      return null;
    }

    return (
      (((Number(match[1]) * 12 + Number(match[2])) * 31 + Number(match[3])) * 24 +
        Number(match[4])) *
        60 +
      Number(match[5])
    );
  }

  function getCdmxNowParts() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: CDMX_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = formatter.formatToParts(new Date()).reduce(function reduceParts(acc, part) {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }

      return acc;
    }, {});

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute)
    };
  }

  function getCdmxNowMinutes() {
    const now = getCdmxNowParts();

    return (((now.year * 12 + now.month) * 31 + now.day) * 24 + now.hour) * 60 + now.minute;
  }

  function isEventEligible(event, venuesById) {
    const venue = event && event.venueId ? venuesById[event.venueId] : null;
    const eventMinutes = event ? parseLocalDateTimeToMinutes(event.startsAt) : null;
    const nowMinutes = getCdmxNowMinutes();
    const minVisibleMinutes = nowMinutes + MIN_LEAD_HOURS * 60;
    const maxVisibleMinutes = nowMinutes + HORIZON_DAYS * 24 * 60;

    return Boolean(
      event &&
        event.active === true &&
        event.startsAt &&
        event.posterSrc &&
        venue &&
        venue.active === true &&
        eventMinutes !== null &&
        eventMinutes >= minVisibleMinutes &&
        eventMinutes <= maxVisibleMinutes
    );
  }

  function sortEvents(a, b) {
    const aFeatured = a.featured === true ? 0 : 1;
    const bFeatured = b.featured === true ? 0 : 1;
    const aMinutes = parseLocalDateTimeToMinutes(a.startsAt);
    const bMinutes = parseLocalDateTimeToMinutes(b.startsAt);

    if (aFeatured !== bFeatured) {
      return aFeatured - bFeatured;
    }

    if (aMinutes !== bMinutes) {
      return aMinutes - bMinutes;
    }

    return Number(a.priority || 0) - Number(b.priority || 0);
  }

  function sortGroups(a, b) {
    const aFeatured = a.featured === true ? 0 : 1;
    const bFeatured = b.featured === true ? 0 : 1;
    const aFirst = a.events[0] ? parseLocalDateTimeToMinutes(a.events[0].startsAt) : 0;
    const bFirst = b.events[0] ? parseLocalDateTimeToMinutes(b.events[0].startsAt) : 0;

    if (aFeatured !== bFeatured) {
      return aFeatured - bFeatured;
    }

    if (aFirst !== bFirst) {
      return aFirst - bFirst;
    }

    return Number(a.priority || 0) - Number(b.priority || 0);
  }

  function buildVenuesById(venues) {
    return venues.reduce(function reduceVenues(acc, venue) {
      if (venue && venue.id) {
        acc[venue.id] = venue;
      }

      return acc;
    }, {});
  }

  function buildEventGroups(events, venuesById) {
    const groupsById = {};

    events
      .filter(function filterEligible(event) {
        return isEventEligible(event, venuesById);
      })
      .sort(sortEvents)
      .forEach(function appendEvent(event) {
        const groupId = event.eventGroupId || event.id;

        if (!groupsById[groupId]) {
          groupsById[groupId] = {
            id: groupId,
            titleKey: event.titleKey,
            type: event.type,
            venueId: event.venueId,
            posterSrc: event.posterSrc,
            posterMobileSrc: event.posterMobileSrc || event.posterSrc,
            featured: event.featured === true,
            priority: Number(event.priority || 0),
            events: []
          };
        }

        groupsById[groupId].events.push(event);

        if (event.featured === true) {
          groupsById[groupId].featured = true;
        }

        if (Number(event.priority || 0) < groupsById[groupId].priority) {
          groupsById[groupId].priority = Number(event.priority || 0);
        }
      });

    return Object.keys(groupsById)
      .map(function mapGroup(groupId) {
        const group = groupsById[groupId];
        group.events = group.events.sort(sortEvents);
        return group;
      })
      .sort(sortGroups)
      .slice(0, MAX_VISIBLE_GROUPS);
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " loading " + path);
    }

    return response.json();
  }

  async function loadData() {
    const results = await Promise.all([
      fetchJson(DATA_BASE + "/events-special-venues.json"),
      fetchJson(DATA_BASE + "/events-special-catalog.json"),
      fetchJson(DATA_BASE + "/events-special-pricing.json")
    ]);
    const venues = Array.isArray(results[0].venues) ? results[0].venues : [];
    const events = Array.isArray(results[1].events) ? results[1].events : [];
    const pricing = isObject(results[2]) ? results[2] : {};
    const venuesById = buildVenuesById(venues);
    const groups = buildEventGroups(events, venuesById);

    return {
      groups: groups,
      venuesById: venuesById,
      pricing: pricing
    };
  }

  function getSelectedGroup() {
    return state.groups.find(function findGroup(group) {
      return group.id === state.selectedGroupId;
    }) || null;
  }

  function getSelectedEvent(group) {
    const safeGroup = group || getSelectedGroup();

    if (!safeGroup) {
      return null;
    }

    return safeGroup.events.find(function findEvent(event) {
      return event.id === state.selectedEventId;
    }) || safeGroup.events[0] || null;
  }

  function getSelectedVenue(group, event) {
    const safeGroup = group || getSelectedGroup();
    const safeEvent = event || getSelectedEvent(safeGroup);
    const venueId = safeEvent && safeEvent.venueId ? safeEvent.venueId : safeGroup && safeGroup.venueId;

    return venueId ? state.venuesById[venueId] || null : null;
  }

  function getEventTitle(entity) {
    if (!entity) {
      return "";
    }

    return getI18nValue(entity.titleKey, entity.id || "");
  }

  function getVenueName(venue) {
    if (!venue) {
      return "";
    }

    return getI18nValue(venue.nameKey, venue.id || "");
  }

  function getEventTypeLabel(type) {
    return getI18nValue(
      "services.cards.events.types." + type,
      getI18nValue("services.cards.events.types.other", "Evento")
    );
  }

  function formatEventDate(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    const date = match
      ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0))
      : null;
    const dateLabel = date
      ? new Intl.DateTimeFormat("es-MX", {
          weekday: "short",
          day: "numeric",
          month: "short"
        }).format(date)
      : raw;

    if (!match) {
      return raw;
    }

    return dateLabel + ", " + match[4] + ":" + match[5];
  }

  function getEventDateLabel(event) {
    if (!event) {
      return "";
    }

    return getI18nValue(event.dateLabelKey, formatEventDate(event.startsAt));
  }

  function getAvailableVariants() {
    const variants = state.pricing && state.pricing.variants ? state.pricing.variants : {};

    return ["arrival", "departure", "round_trip"].filter(function filterVariant(variantId) {
      return Boolean(variants[variantId]);
    });
  }

  function getVariantLabel(variantId) {
    const variants = state.pricing && state.pricing.variants ? state.pricing.variants : {};
    const variant = variants[variantId];

    if (variant && variant.labelKey) {
      return getI18nValue(variant.labelKey, variantId);
    }

    return getI18nValue("services.cards.events.variants." + variantId, variantId);
  }

  function getAvailablePassengerFareKeys() {
    const passengerFactors = state.pricing && state.pricing.passengerFactors
      ? state.pricing.passengerFactors
      : {};

    return ["van_1_2", "van_3_4", "van_5_6"].filter(function filterFareKey(fareKey) {
      return Boolean(passengerFactors[fareKey]);
    });
  }

  function getPassengerFareLabel(fareKey) {
    const passengerFactors = state.pricing && state.pricing.passengerFactors
      ? state.pricing.passengerFactors
      : {};
    const passengerFactor = passengerFactors[fareKey];

    if (passengerFactor && passengerFactor.labelKey) {
      return getI18nValue(passengerFactor.labelKey, fareKey);
    }

    return getI18nValue("services.cards.events.passengerBuckets." + fareKey, fareKey);
  }

  function formatCurrency(value, currency) {
    const currencyCode = normalizeText(currency) || DEFAULT_CURRENCY;
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(numericValue) + " " + currencyCode;
    } catch (error) {
      return String(numericValue) + " " + currencyCode;
    }
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
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const raw = selectedEvent && selectedEvent.startsAt ? String(selectedEvent.startsAt) : "";
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

  function getReturnPickupDisplayValue(value) {
    const time = normalizeTimeValue(value);

    if (!time) {
      return "";
    }

    return getReturnPickupDayOffset(time) === 1 ? time + " +1" : time;
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
    baseMinutes = Number(parts[0]) * 60 + Number(parts[1]);
    addedMinutes = Math.ceil(seconds / 60);
    totalMinutes = (baseMinutes + addedMinutes) % (24 * 60);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;

    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function getServiceLabel() {
    return getI18nValue(
      "contact.services.eventSpecial.label",
      "Eventos y ocasiones especiales"
    );
  }

  function isEventSpecialServiceActive(form) {
    const reservationForm = form || getReservationForm();
    const serviceTypeField = reservationForm
      ? reservationForm.querySelector('input[name="service_type"]')
      : null;

    return normalizeText(serviceTypeField && serviceTypeField.value) === SERVICE_TYPE;
  }

  function getAddressModule() {
    return window.PixkuyServicesEventsSpecialAddress &&
      typeof window.PixkuyServicesEventsSpecialAddress.buildAddressMarkup === "function" &&
      typeof window.PixkuyServicesEventsSpecialAddress.mount === "function"
      ? window.PixkuyServicesEventsSpecialAddress
      : null;
  }

  function getQuoteModule() {
    return window.PixkuyServicesEventsSpecialQuote &&
      typeof window.PixkuyServicesEventsSpecialQuote.requestQuote === "function"
      ? window.PixkuyServicesEventsSpecialQuote
      : null;
  }

  function extractCoordinate(value) {
    if (typeof value === "function") {
      return extractCoordinate(value());
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getPlaceCoordinate(place, primaryKey, fallbackKey) {
    if (!place || typeof place !== "object") {
      return null;
    }

    if (place[primaryKey] != null) {
      return extractCoordinate(place[primaryKey]);
    }

    if (place[fallbackKey] != null) {
      return extractCoordinate(place[fallbackKey]);
    }

    if (place.location && place.location[primaryKey] != null) {
      return extractCoordinate(place.location[primaryKey]);
    }

    if (place.location && place.location[fallbackKey] != null) {
      return extractCoordinate(place.location[fallbackKey]);
    }

    return null;
  }

  function normalizeSelectedPlace(place, fallbackLabel) {
    const safePlace = isObject(place) ? place : null;
    const lat = safePlace ? getPlaceCoordinate(safePlace, "lat", "latitude") : null;
    const lng = safePlace ? getPlaceCoordinate(safePlace, "lng", "longitude") : null;

    if (!safePlace || lat === null || lng === null) {
      return null;
    }

    return {
      label: normalizeText(
        safePlace.label ||
          safePlace.formattedAddress ||
          safePlace.displayName ||
          fallbackLabel
      ),
      placeId: normalizeText(safePlace.placeId || safePlace.id || ""),
      lat: lat,
      lng: lng
    };
  }

  function getOriginQuoteAddress() {
    if (!state.originPlace) {
      return null;
    }

    return normalizeSelectedPlace(state.originPlace, state.originAddress);
  }

  function getDestinationQuoteAddress() {
    if (!state.destinationPlace) {
      return null;
    }

    return normalizeSelectedPlace(state.destinationPlace, state.destinationAddress);
  }

  function buildQuoteInput() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const input = {};

    if (!group || !selectedEvent) {
      return input;
    }

    input.eventId = selectedEvent.id || "";
    input.eventStartsAt = selectedEvent.startsAt || "";
    input.venueId = selectedEvent.venueId || group.venueId || "";
    input.variant = state.selectedVariant;
    input.passengerFareKey = state.selectedPassengerFareKey;

    if (state.selectedVariant === "arrival" || state.selectedVariant === "round_trip") {
      input.originAddress = getOriginQuoteAddress();
      input.originPickupTime = state.originPickupTime;
    }

    if (state.selectedVariant === "departure" || state.selectedVariant === "round_trip") {
      input.destinationAddress = getDestinationQuoteAddress();
      input.returnPickupTime = isReturnPickupTimeAllowed(state.returnPickupTime)
        ? state.returnPickupTime
        : "";
      input.returnPickupDayOffset = getReturnPickupDayOffset(state.returnPickupTime);
    }

    return input;
  }

  function requestQuoteIfReady() {
    const quoteModule = getQuoteModule();
    const quoteInput = buildQuoteInput();
    const quotePayload = quoteModule && typeof quoteModule.buildQuotePayload === "function"
      ? quoteModule.buildQuotePayload(quoteInput)
      : quoteInput;
    const nodes = getEditorNodes(getReservationForm());
    const requestId = state.quoteRequestId + 1;

    if (!quoteModule) {
      state.quoteStatus = "error";
      state.quote = null;
      state.quoteMessageKey = "services.cards.events.panel.quoteUnavailable";
      syncView(nodes);
      return;
    }

    if (
      typeof quoteModule.isQuotePayloadComplete !== "function" ||
      !quoteModule.isQuotePayloadComplete(quotePayload)
    ) {
      state.quoteStatus = "pending";
      state.quote = null;
      state.quoteMessageKey = "services.cards.events.panel.quotePending";
      syncView(nodes);
      return;
    }

    state.quoteRequestId = requestId;
    state.quoteStatus = "loading";
    state.quote = null;
    state.quoteMessageKey = "services.cards.events.panel.quoteLoading";
    syncView(nodes);

    quoteModule.requestQuote(quoteInput)
      .then(function handleQuote(result) {
        if (state.quoteRequestId !== requestId) {
          return;
        }

        if (result && result.ok === true && result.quote) {
          state.quoteStatus = "ready";
          state.quote = result.quote;
          state.quoteMessageKey = "";
          render();
          return;
        }

        state.quoteStatus = "error";
        state.quote = null;
        state.quoteMessageKey = result && result.messageKey
          ? result.messageKey
          : "services.cards.events.panel.quoteUnavailable";
        render();
      })
      .catch(function handleQuoteError() {
        if (state.quoteRequestId !== requestId) {
          return;
        }

        state.quoteStatus = "error";
        state.quote = null;
        state.quoteMessageKey = "services.cards.events.panel.quoteUnavailable";
        render();
      });
  }

  function getEstimatedEventArrivalTime() {
    if (!state.quote || state.quoteStatus !== "ready") {
      return "";
    }

    return buildEstimatedArrivalTime(state.originPickupTime, state.quote.outboundDurationSeconds);
  }

  function getEstimatedDestinationArrivalTime() {
    if (!state.quote || state.quoteStatus !== "ready") {
      return "";
    }

    return buildEstimatedArrivalTime(state.returnPickupTime, state.quote.returnDurationSeconds);
  }

  function getPriceLabelValue() {
    if (!state.quote || state.quoteStatus !== "ready" || state.quote.price == null) {
      return "";
    }

    return formatCurrency(state.quote.price, state.quote.currency || state.pricing.currency || DEFAULT_CURRENCY);
  }

  function getEditorNodes(form) {
    const root = form ? form.querySelector("[data-contact-event-special-editor]") : null;

    if (!root) {
      return null;
    }

    return {
      root: root,
      hiddenServiceLabel: form.querySelector('input[name="service_label"]'),
      hiddenRequestSummary: form.querySelector('input[name="request_summary"]'),
      hiddenTripSummary: form.querySelector('input[name="event_special_trip_summary"]'),
      hiddenEventLabel: form.querySelector('input[name="event_special_event_label"]'),
      hiddenVenueLabel: form.querySelector('input[name="event_special_venue_label"]'),
      hiddenVariantLabel: form.querySelector('input[name="event_special_variant_label"]'),
      hiddenOriginLabel: form.querySelector('input[name="event_special_origin_label"]'),
      hiddenDestinationLabel: form.querySelector('input[name="event_special_destination_label"]'),
      hiddenPassengerBucketLabel: form.querySelector('input[name="event_special_passenger_bucket_label"]'),
      hiddenPriceLabel: form.querySelector('input[name="event_special_price_label"]'),
      hiddenEventId: form.querySelector('input[name="event_special_event_id"]'),
      hiddenEventType: form.querySelector('input[name="event_special_event_type"]'),
      hiddenEventStartsAt: form.querySelector('input[name="event_special_event_starts_at"]'),
      hiddenVenueId: form.querySelector('input[name="event_special_venue_id"]'),
      hiddenVariant: form.querySelector('input[name="event_special_variant"]'),
      hiddenOriginAddress: form.querySelector('input[name="event_special_origin_address"]'),
      hiddenOriginPlaceId: form.querySelector('input[name="event_special_origin_address_place_id"]'),
      hiddenOriginLat: form.querySelector('input[name="event_special_origin_address_lat"]'),
      hiddenOriginLng: form.querySelector('input[name="event_special_origin_address_lng"]'),
      hiddenDestinationAddress: form.querySelector('input[name="event_special_destination_address"]'),
      hiddenDestinationPlaceId: form.querySelector('input[name="event_special_destination_address_place_id"]'),
      hiddenDestinationLat: form.querySelector('input[name="event_special_destination_address_lat"]'),
      hiddenDestinationLng: form.querySelector('input[name="event_special_destination_address_lng"]'),
      hiddenOriginPickupTime: form.querySelector('input[name="event_special_origin_pickup_time"]'),
      hiddenReturnPickupTime: form.querySelector('input[name="event_special_return_pickup_time"]'),
      hiddenReturnPickupDayOffset: form.querySelector('input[name="event_special_return_pickup_day_offset"]'),
      hiddenReturnPickupLabel: form.querySelector('input[name="event_special_return_pickup_label"]'),
      hiddenEstimatedEventArrivalTime: form.querySelector('input[name="event_special_estimated_event_arrival_time"]'),
      hiddenEstimatedDestinationArrivalTime: form.querySelector('input[name="event_special_estimated_destination_arrival_time"]'),
      hiddenOutboundDurationSeconds: form.querySelector('input[name="event_special_outbound_duration_seconds"]'),
      hiddenReturnDurationSeconds: form.querySelector('input[name="event_special_return_duration_seconds"]'),
      hiddenOutboundDistanceMeters: form.querySelector('input[name="event_special_outbound_distance_meters"]'),
      hiddenReturnDistanceMeters: form.querySelector('input[name="event_special_return_distance_meters"]'),
      hiddenPassengerFareKey: form.querySelector('input[name="event_special_passenger_fare_key"]'),
      hiddenPrice: form.querySelector('input[name="event_special_price"]'),
      hiddenCurrency: form.querySelector('input[name="event_special_currency"]'),
      hiddenNotes: form.querySelector('input[name="event_special_notes"]')
    };
  }

  function hasCriticalNodes(nodes) {
    return Boolean(
      nodes &&
        nodes.root &&
        nodes.hiddenServiceLabel &&
        nodes.hiddenRequestSummary &&
        nodes.hiddenTripSummary &&
        nodes.hiddenEventLabel &&
        nodes.hiddenVenueLabel &&
        nodes.hiddenVariantLabel &&
        nodes.hiddenOriginLabel &&
        nodes.hiddenDestinationLabel &&
        nodes.hiddenPassengerBucketLabel &&
        nodes.hiddenPriceLabel &&
        nodes.hiddenEventId &&
        nodes.hiddenEventType &&
        nodes.hiddenEventStartsAt &&
        nodes.hiddenVenueId &&
        nodes.hiddenVariant &&
        nodes.hiddenOriginAddress &&
        nodes.hiddenOriginPlaceId &&
        nodes.hiddenOriginLat &&
        nodes.hiddenOriginLng &&
        nodes.hiddenDestinationAddress &&
        nodes.hiddenDestinationPlaceId &&
        nodes.hiddenDestinationLat &&
        nodes.hiddenDestinationLng &&
        nodes.hiddenOriginPickupTime &&
        nodes.hiddenReturnPickupTime &&
        nodes.hiddenReturnPickupDayOffset &&
        nodes.hiddenReturnPickupLabel &&
        nodes.hiddenEstimatedEventArrivalTime &&
        nodes.hiddenEstimatedDestinationArrivalTime &&
        nodes.hiddenOutboundDurationSeconds &&
        nodes.hiddenReturnDurationSeconds &&
        nodes.hiddenOutboundDistanceMeters &&
        nodes.hiddenReturnDistanceMeters &&
        nodes.hiddenPassengerFareKey &&
        nodes.hiddenPrice &&
        nodes.hiddenCurrency &&
        nodes.hiddenNotes
    );
  }

  function writeHiddenValue(field, value) {
    if (!field) {
      return;
    }

    field.value = typeof value === "string" ? value : "";
  }

  function clearHiddenFields(nodes) {
    writeHiddenValue(nodes.hiddenTripSummary, "");
    writeHiddenValue(nodes.hiddenEventLabel, "");
    writeHiddenValue(nodes.hiddenVenueLabel, "");
    writeHiddenValue(nodes.hiddenVariantLabel, "");
    writeHiddenValue(nodes.hiddenOriginLabel, "");
    writeHiddenValue(nodes.hiddenDestinationLabel, "");
    writeHiddenValue(nodes.hiddenPassengerBucketLabel, "");
    writeHiddenValue(nodes.hiddenPriceLabel, "");
    writeHiddenValue(nodes.hiddenEventId, "");
    writeHiddenValue(nodes.hiddenEventType, "");
    writeHiddenValue(nodes.hiddenEventStartsAt, "");
    writeHiddenValue(nodes.hiddenVenueId, "");
    writeHiddenValue(nodes.hiddenVariant, "");
    writeHiddenValue(nodes.hiddenOriginAddress, "");
    writeHiddenValue(nodes.hiddenOriginPlaceId, "");
    writeHiddenValue(nodes.hiddenOriginLat, "");
    writeHiddenValue(nodes.hiddenOriginLng, "");
    writeHiddenValue(nodes.hiddenDestinationAddress, "");
    writeHiddenValue(nodes.hiddenDestinationPlaceId, "");
    writeHiddenValue(nodes.hiddenDestinationLat, "");
    writeHiddenValue(nodes.hiddenDestinationLng, "");
    writeHiddenValue(nodes.hiddenOriginPickupTime, "");
    writeHiddenValue(nodes.hiddenReturnPickupTime, "");
    writeHiddenValue(nodes.hiddenReturnPickupDayOffset, "");
    writeHiddenValue(nodes.hiddenReturnPickupLabel, "");
    writeHiddenValue(nodes.hiddenEstimatedEventArrivalTime, "");
    writeHiddenValue(nodes.hiddenEstimatedDestinationArrivalTime, "");
    writeHiddenValue(nodes.hiddenOutboundDurationSeconds, "");
    writeHiddenValue(nodes.hiddenReturnDurationSeconds, "");
    writeHiddenValue(nodes.hiddenOutboundDistanceMeters, "");
    writeHiddenValue(nodes.hiddenReturnDistanceMeters, "");
    writeHiddenValue(nodes.hiddenPassengerFareKey, "");
    writeHiddenValue(nodes.hiddenPrice, "");
    writeHiddenValue(nodes.hiddenCurrency, "");
    writeHiddenValue(nodes.hiddenNotes, "");
  }

  function buildTripSummary() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const venue = getSelectedVenue(group, selectedEvent);
    const eventLabel = group ? getEventTitle(group) : "";
    const dateLabel = selectedEvent ? getEventDateLabel(selectedEvent) : "";
    const venueLabel = venue ? getVenueName(venue) : "";
    const variantLabel = getVariantLabel(state.selectedVariant);
    const passengerLabel = getPassengerFareLabel(state.selectedPassengerFareKey);
    const priceLabel = getPriceLabelValue();
    const parts = [];

    if (eventLabel) {
      parts.push("Evento: " + eventLabel);
    }

    if (dateLabel) {
      parts.push("Fecha y hora: " + dateLabel);
    }

    if (venueLabel) {
      parts.push("Recinto: " + venueLabel);
    }

    if (variantLabel) {
      parts.push("Modalidad: " + variantLabel);
    }

    if (state.originAddress) {
      parts.push("Origen: " + state.originAddress);
    }

    if (state.destinationAddress) {
      parts.push("Destino tras el evento: " + state.destinationAddress);
    }

    if (state.originPickupTime) {
      parts.push("Hora de recogida en origen: " + state.originPickupTime);
    }

    if (state.returnPickupTime) {
      parts.push("Hora recogida tras evento: " + getReturnPickupDisplayValue(state.returnPickupTime));
    }

    if (passengerLabel) {
      parts.push("Pasajeros: " + passengerLabel);
    }

    if (priceLabel) {
      parts.push("Precio: " + priceLabel);
    }

    return parts.join(" | ");
  }

  function syncHiddenFields(nodes) {
    const form = getReservationForm();
    const isActive = isEventSpecialServiceActive(form);
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const venue = getSelectedVenue(group, selectedEvent);
    const originQuoteAddress = getOriginQuoteAddress();
    const destinationQuoteAddress = getDestinationQuoteAddress();
    const eventLabel = group ? getEventTitle(group) : "";
    const venueLabel = venue ? getVenueName(venue) : "";
    const variantLabel = getVariantLabel(state.selectedVariant);
    const passengerLabel = getPassengerFareLabel(state.selectedPassengerFareKey);
    const priceLabel = getPriceLabelValue();
    const tripSummary = buildTripSummary();

    if (!isActive) {
      clearHiddenFields(nodes);
      return true;
    }

    writeHiddenValue(nodes.hiddenServiceLabel, getServiceLabel());
    writeHiddenValue(nodes.hiddenRequestSummary, tripSummary);
    writeHiddenValue(nodes.hiddenTripSummary, tripSummary);
    writeHiddenValue(nodes.hiddenEventLabel, eventLabel);
    writeHiddenValue(nodes.hiddenVenueLabel, venueLabel);
    writeHiddenValue(nodes.hiddenVariantLabel, variantLabel);
    writeHiddenValue(nodes.hiddenOriginLabel, state.originAddress);
    writeHiddenValue(nodes.hiddenDestinationLabel, state.destinationAddress);
    writeHiddenValue(nodes.hiddenPassengerBucketLabel, passengerLabel);
    writeHiddenValue(nodes.hiddenPriceLabel, priceLabel);
    writeHiddenValue(nodes.hiddenEventId, selectedEvent ? selectedEvent.id || "" : "");
    writeHiddenValue(nodes.hiddenEventType, selectedEvent ? selectedEvent.type || group.type || "" : "");
    writeHiddenValue(nodes.hiddenEventStartsAt, selectedEvent ? selectedEvent.startsAt || "" : "");
    writeHiddenValue(nodes.hiddenVenueId, selectedEvent ? selectedEvent.venueId || group.venueId || "" : "");
    writeHiddenValue(nodes.hiddenVariant, state.selectedVariant);
    writeHiddenValue(nodes.hiddenOriginAddress, state.originAddress);
    writeHiddenValue(nodes.hiddenOriginPlaceId, originQuoteAddress ? originQuoteAddress.placeId : state.originPlaceId);
    writeHiddenValue(nodes.hiddenOriginLat, originQuoteAddress ? String(originQuoteAddress.lat) : state.originLat);
    writeHiddenValue(nodes.hiddenOriginLng, originQuoteAddress ? String(originQuoteAddress.lng) : state.originLng);
    writeHiddenValue(nodes.hiddenDestinationAddress, state.destinationAddress);
    writeHiddenValue(nodes.hiddenDestinationPlaceId, destinationQuoteAddress ? destinationQuoteAddress.placeId : state.destinationPlaceId);
    writeHiddenValue(nodes.hiddenDestinationLat, destinationQuoteAddress ? String(destinationQuoteAddress.lat) : state.destinationLat);
    writeHiddenValue(nodes.hiddenDestinationLng, destinationQuoteAddress ? String(destinationQuoteAddress.lng) : state.destinationLng);
    writeHiddenValue(nodes.hiddenOriginPickupTime, state.originPickupTime);
    writeHiddenValue(nodes.hiddenReturnPickupTime, state.returnPickupTime);
    writeHiddenValue(nodes.hiddenReturnPickupDayOffset, String(state.returnPickupDayOffset || 0));
    writeHiddenValue(nodes.hiddenReturnPickupLabel, getReturnPickupDisplayValue(state.returnPickupTime));
    writeHiddenValue(nodes.hiddenEstimatedEventArrivalTime, getEstimatedEventArrivalTime());
    writeHiddenValue(nodes.hiddenEstimatedDestinationArrivalTime, getEstimatedDestinationArrivalTime());
    writeHiddenValue(nodes.hiddenOutboundDurationSeconds, state.quote && state.quote.outboundDurationSeconds != null ? String(state.quote.outboundDurationSeconds) : "");
    writeHiddenValue(nodes.hiddenReturnDurationSeconds, state.quote && state.quote.returnDurationSeconds != null ? String(state.quote.returnDurationSeconds) : "");
    writeHiddenValue(nodes.hiddenOutboundDistanceMeters, state.quote && state.quote.outboundDistanceMeters != null ? String(state.quote.outboundDistanceMeters) : "");
    writeHiddenValue(nodes.hiddenReturnDistanceMeters, state.quote && state.quote.returnDistanceMeters != null ? String(state.quote.returnDistanceMeters) : "");
    writeHiddenValue(nodes.hiddenPassengerFareKey, state.selectedPassengerFareKey);
    writeHiddenValue(nodes.hiddenPrice, state.quote && state.quote.price != null ? String(state.quote.price) : "");
    writeHiddenValue(nodes.hiddenCurrency, state.quote && state.quote.price != null ? state.quote.currency || state.pricing.currency || DEFAULT_CURRENCY : "");
    writeHiddenValue(nodes.hiddenNotes, "");

    return true;
  }

  function syncReservationRequestState() {
    const form = getReservationForm();

    if (
      !form ||
      typeof NAMESPACE.getReservationRequestFields !== "function" ||
      typeof NAMESPACE.syncReservationRequestState !== "function"
    ) {
      return false;
    }

    NAMESPACE.syncReservationRequestState(
      NAMESPACE.getReservationRequestFields(form)
    );

    return true;
  }

  function destroyAddressControllers() {
    state.addressControllers.forEach(function destroyController(controller) {
      if (controller && typeof controller.destroy === "function") {
        controller.destroy();
      }
    });

    state.addressControllers = [];
  }

  function setAddressPlace(role, selectedPlace) {
    const normalizedPlace = normalizeSelectedPlace(selectedPlace, "");

    if (role === "destination") {
      state.destinationPlace = selectedPlace || null;
      state.destinationAddress = normalizedPlace && normalizedPlace.label ? normalizedPlace.label : state.destinationAddress;
      state.destinationPlaceId = normalizedPlace ? normalizedPlace.placeId : "";
      state.destinationLat = normalizedPlace ? String(normalizedPlace.lat) : "";
      state.destinationLng = normalizedPlace ? String(normalizedPlace.lng) : "";
      requestQuoteIfReady();
      return;
    }

    state.originPlace = selectedPlace || null;
    state.originAddress = normalizedPlace && normalizedPlace.label ? normalizedPlace.label : state.originAddress;
    state.originPlaceId = normalizedPlace ? normalizedPlace.placeId : "";
    state.originLat = normalizedPlace ? String(normalizedPlace.lat) : "";
    state.originLng = normalizedPlace ? String(normalizedPlace.lng) : "";
    requestQuoteIfReady();
  }

  function setAddressValue(role, value) {
    if (role === "destination") {
      state.destinationAddress = typeof value === "string" ? value : "";
      state.destinationPlace = null;
      state.destinationPlaceId = "";
      state.destinationLat = "";
      state.destinationLng = "";
      state.quoteStatus = "pending";
      state.quote = null;
      syncView(getEditorNodes(getReservationForm()));
      return;
    }

    state.originAddress = typeof value === "string" ? value : "";
    state.originPlace = null;
    state.originPlaceId = "";
    state.originLat = "";
    state.originLng = "";
    state.quoteStatus = "pending";
    state.quote = null;
    syncView(getEditorNodes(getReservationForm()));
  }

  function clearAddress(role) {
    setAddressValue(role, "");
  }

  function getAddressFieldLabel(role) {
    if (role === "destination") {
      return getI18nValue(
        "contact.services.eventSpecial.destinationLabel",
        "Destino tras el evento"
      );
    }

    return getI18nValue(
      "contact.services.eventSpecial.originLabel",
      "Origen"
    );
  }

  function getAddressPlaceholder(role) {
    if (role === "destination") {
      return getI18nValue(
        "contact.services.eventSpecial.destinationPlaceholder",
        "DirecciÃ³n donde te llevaremos despuÃ©s del evento"
      );
    }

    return getI18nValue(
      "services.cards.events.panel.addressOriginPlaceholder",
      "Escribe tu direcciÃ³n de origen en Ciudad de MÃ©xico donde tenemos que recogerte"
    );
  }

  function mountAddressControllers(root) {
    const addressModule = getAddressModule();
    const addressRoots = root ? Array.from(root.querySelectorAll("[data-contact-event-special-address-field]")) : [];

    destroyAddressControllers();

    if (!addressModule || !addressRoots.length) {
      return false;
    }

    addressRoots.forEach(function mountAddress(addressRoot) {
      const role = addressRoot.getAttribute("data-contact-event-special-address-role") || "origin";
      const fieldName = role === "destination"
        ? "contact_event_special_destination_address"
        : "contact_event_special_origin_address";

      const controller = addressModule.mount({
        root: addressRoot,
        fieldName: fieldName,
        language: getDocumentLanguage(),
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
            state.destinationPlace = null;
            state.destinationPlaceId = "";
            state.destinationLat = "";
            state.destinationLng = "";
            return;
          }

          state.originPlace = null;
          state.originPlaceId = "";
          state.originLat = "";
          state.originLng = "";
        }
      });

      if (controller) {
        state.addressControllers.push(controller);
      }
    });

    return true;
  }

  function shouldShowOriginFields() {
    return state.selectedVariant === "arrival" || state.selectedVariant === "round_trip";
  }

  function shouldShowDestinationFields() {
    return state.selectedVariant === "departure" || state.selectedVariant === "round_trip";
  }

  function buildEventOptionsMarkup() {
    return state.groups.map(function mapGroup(group) {
      const isSelected = group.id === state.selectedGroupId;

      return (
        '<option value="' +
        escapeHtml(group.id) +
        '"' +
        (isSelected ? " selected" : "") +
        ">" +
        escapeHtml(getEventTitle(group)) +
        "</option>"
      );
    }).join("");
  }

  function buildDateOptionsMarkup(group) {
    if (!group) {
      return "";
    }

    return group.events.map(function mapEvent(event) {
      const isSelected = event.id === state.selectedEventId;

      return (
        '<option value="' +
        escapeHtml(event.id) +
        '"' +
        (isSelected ? " selected" : "") +
        ">" +
        escapeHtml(getEventDateLabel(event)) +
        "</option>"
      );
    }).join("");
  }

  function buildVariantOptionsMarkup() {
    return getAvailableVariants().map(function mapVariant(variantId) {
      const isSelected = variantId === state.selectedVariant;

      return (
        '<option value="' +
        escapeHtml(variantId) +
        '"' +
        (isSelected ? " selected" : "") +
        ">" +
        escapeHtml(getVariantLabel(variantId)) +
        "</option>"
      );
    }).join("");
  }

  function buildPassengerOptionsMarkup() {
    return getAvailablePassengerFareKeys().map(function mapPassenger(fareKey) {
      const isSelected = fareKey === state.selectedPassengerFareKey;

      return (
        '<option value="' +
        escapeHtml(fareKey) +
        '"' +
        (isSelected ? " selected" : "") +
        ">" +
        escapeHtml(getPassengerFareLabel(fareKey)) +
        "</option>"
      );
    }).join("");
  }

  function buildAddressMarkup(role) {
    const addressModule = getAddressModule();
    const value = role === "destination" ? state.destinationAddress : state.originAddress;

    if (!addressModule) {
      return "";
    }

    return addressModule.buildAddressMarkup({
      fieldName: role === "destination"
        ? "contact_event_special_destination_address"
        : "contact_event_special_origin_address",
      inputId: role === "destination"
        ? "contact-event-special-destination-address"
        : "contact-event-special-origin-address",
      label: getAddressFieldLabel(role),
      placeholder: getAddressPlaceholder(role),
      value: value
    });
  }

  function buildTimeFieldMarkup(options) {
    const safeOptions = options || {};
    const inputId = safeOptions.inputId || "";
    const value = safeOptions.value || "";
    const label = safeOptions.label || "";
    const field = safeOptions.field || "";

    return (
      '<div class="form-field form-field--time">' +
        '<label for="' + escapeHtml(inputId) + '" class="visually-hidden">' + escapeHtml(label) + "</label>" +
        '<input' +
          ' id="' + escapeHtml(inputId) + '"' +
          ' type="time"' +
          ' value="' + escapeHtml(value) + '"' +
          ' autocomplete="off"' +
          ' data-contact-event-special-time="' + escapeHtml(field) + '"' +
        " />" +
        '<span class="form-field-overlay form-field-overlay--time" aria-hidden="true">--:--</span>' +
        '<span class="form-field-icon form-field-icon--time" aria-hidden="true">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">' +
            '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>' +
            '<polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
          "</svg>" +
        "</span>" +
      "</div>"
    );
  }

  function getRouteEtaValue(type) {
    const isDestination = type === "destination";
    const pendingLabel = getI18nValue(
      "services.cards.events.panel.estimatedArrivalPending",
      "Pendiente"
    );

    if (state.quoteStatus !== "ready" || !state.quote) {
      return pendingLabel;
    }

    return isDestination
      ? getEstimatedDestinationArrivalTime() || pendingLabel
      : getEstimatedEventArrivalTime() || pendingLabel;
  }

  function buildRouteEtaMarkup(type) {
    const isDestination = type === "destination";
    const label = isDestination
      ? getI18nValue("contact.services.eventSpecial.estimatedDestinationArrivalLabel", "Llegada a destino estimada")
      : getI18nValue("contact.services.eventSpecial.estimatedEventArrivalLabel", "Llegada al evento estimada");
    const pickupLead = getI18nValue(
      "contact.services.eventSpecial.estimatedDestinationPickupLead",
      "Recogida en el recinto"
    );
    const value = getRouteEtaValue(type);

    if (isDestination) {
      return (
        '<p class="contact-event-special-editor__route-eta" data-contact-event-special-route-eta="' + escapeHtml(type) + '">' +
          '<span class="contact-event-special-editor__route-eta-lead">' + escapeHtml(pickupLead) + '</span>' +
          '<span>' + escapeHtml("Â· " + label) + '</span>' +
          '<strong>' + escapeHtml(value) + '</strong>' +
        '</p>'
      );
    }

    return (
      '<p class="contact-event-special-editor__route-eta" data-contact-event-special-route-eta="' + escapeHtml(type) + '">' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<strong>' + escapeHtml(value) + '</strong>' +
      '</p>'
    );
  }

    function isMobileSelectedAddressSummaryEnabled() {
    return Boolean(
      window &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 720px)").matches
    );
  }

  function getSelectedAddressSummaryValue(type) {
    const isDestination = type === "destination";
    const address = isDestination ? state.destinationAddress : state.originAddress;
    const placeId = isDestination ? state.destinationPlaceId : state.originPlaceId;

    if (!address || !placeId) {
      return "";
    }

    return address;
  }

  function buildSelectedAddressSummaryMarkup(type) {
    return (
      '<p class="contact-event-special-editor__selected-address" ' +
        'data-contact-event-special-selected-address="' + escapeHtml(type) + '" ' +
        'style="display:none"' +
      '></p>'
    );
  }

  function syncSelectedAddressSummaries(root) {
    const summaryNodes = root
      ? Array.from(root.querySelectorAll("[data-contact-event-special-selected-address]"))
      : [];
    const isMobile = isMobileSelectedAddressSummaryEnabled();

    summaryNodes.forEach(function syncSummaryNode(node) {
      const type = node.getAttribute("data-contact-event-special-selected-address") || "origin";
      const value = getSelectedAddressSummaryValue(type);

      node.textContent = value;
      node.setAttribute("title", value);
      node.style.display = isMobile && value ? "" : "none";
    });

    return true;
  }

  function buildQuoteCardMarkup() {
    const priceLabel = getI18nValue("contact.services.eventSpecial.priceLabel", "Precio");
    const pendingLabel = getI18nValue("services.cards.events.panel.quotePending", "Completa los datos para calcular el precio.");
    const loadingLabel = getI18nValue("services.cards.events.panel.quoteLoading", "Calculando precio...");
    const unavailableLabel = getI18nValue(
      state.quoteMessageKey,
      getI18nValue("services.cards.events.panel.quoteUnavailable", "No podemos calcular el precio para esta ruta en este momento.")
    );
    const priceValue = getPriceLabelValue();

    if (state.quoteStatus === "ready" && priceValue) {
      return (
        '<div class="contact-panel-fare contact-event-special-editor__fare" data-contact-event-special-price>' +
          '<p class="contact-panel-fare__label">' + escapeHtml(priceLabel) + "</p>" +
          '<strong class="contact-panel-fare__value" data-contact-event-special-price-value>' + escapeHtml(priceValue) + "</strong>" +
        "</div>"
      );
    }

    if (state.quoteStatus === "loading") {
      return (
        '<div class="contact-panel-fare contact-event-special-editor__fare">' +
          '<p class="contact-panel-fare__label">' + escapeHtml(loadingLabel) + "</p>" +
        "</div>"
      );
    }

    if (state.quoteStatus === "error") {
      return (
        '<div class="contact-panel-fare contact-event-special-editor__fare contact-event-special-editor__fare--error">' +
          '<p class="contact-panel-fare__label">' + escapeHtml(unavailableLabel) + "</p>" +
        "</div>"
      );
    }

    return (
      '<div class="contact-panel-fare contact-event-special-editor__fare">' +
        '<p class="contact-panel-fare__label">' + escapeHtml(pendingLabel) + "</p>" +
      "</div>"
    );
  }

  function buildRootMarkup() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const venue = getSelectedVenue(group, selectedEvent);
    const eventTitle = group ? getEventTitle(group) : "";
    const eventType = group ? getEventTypeLabel(group.type) : "";
    const venueName = venue ? getVenueName(venue) : "";
    const selectedDate = selectedEvent ? getEventDateLabel(selectedEvent) : "";
    const posterSrc = group ? group.posterSrc : "";
    const posterAlt = eventTitle
      ? getI18nValue("services.cards.events.panel.posterAlt", "Cartel del evento") + ": " + eventTitle
      : getI18nValue("services.cards.events.panel.posterAlt", "Cartel del evento");

    if (state.loading) {
      return (
        '<div class="contact-event-special-editor__loading">' +
          '<p class="muted small">' + escapeHtml(getI18nValue("services.cards.events.panel.quoteLoading", "Cargando eventos...")) + "</p>" +
        "</div>"
      );
    }

    if (!state.groups.length) {
      return (
        '<div class="contact-event-special-editor__empty">' +
          '<p class="muted small">' + escapeHtml(getI18nValue("services.cards.events.panel.empty", "No hay eventos disponibles por ahora.")) + "</p>" +
        "</div>"
      );
    }

    return (
      '<div class="contact-event-special-editor__header">' +
        '<p class="muted small" data-contact-event-special-helper>' +
          escapeHtml(getI18nValue("contact.services.eventSpecial.helper", "Revisa el evento, la modalidad y los datos del traslado antes de enviar la solicitud.")) +
        "</p>" +
      "</div>" +

      '<div class="contact-event-special-editor__layout">' +
        '<aside class="contact-event-special-editor__summary">' +
          '<div class="contact-event-special-editor__media">' +
            '<img' +
              ' class="contact-event-special-editor__image"' +
              ' src="' + escapeHtml(posterSrc) + '"' +
              ' alt="' + escapeHtml(posterAlt) + '"' +
              ' loading="lazy"' +
              ' decoding="async"' +
            ' />' +
          "</div>" +

          '<div class="contact-event-special-editor__summary-body">' +
            '<p class="contact-event-special-editor__eyebrow">' + escapeHtml(eventType) + "</p>" +
            '<h3 class="contact-event-special-editor__title">' + escapeHtml(eventTitle) + "</h3>" +
            '<dl class="contact-event-special-editor__meta">' +
              "<div>" +
                '<dt>' + escapeHtml(getI18nValue("contact.services.eventSpecial.dateLabel", "Fecha y hora")) + "</dt>" +
                '<dd>' + escapeHtml(selectedDate) + "</dd>" +
              "</div>" +
              "<div>" +
                '<dt>' + escapeHtml(getI18nValue("contact.services.eventSpecial.venueLabel", "Recinto")) + "</dt>" +
                '<dd>' + escapeHtml(venueName) + "</dd>" +
              "</div>" +
            "</dl>" +
          "</div>" +
        "</aside>" +

        '<div class="contact-event-special-editor__fields">' +
          '<div class="contact-event-special-editor__control-grid contact-event-special-editor__control-grid--event">' +
            '<div class="form-field">' +
              '<label class="visually-hidden" for="contact-event-special-event">' + escapeHtml(getI18nValue("contact.services.eventSpecial.eventLabel", "Evento")) + "</label>" +
              '<select id="contact-event-special-event" data-contact-event-special-event>' +
                buildEventOptionsMarkup() +
              "</select>" +
            "</div>" +

            '<div class="form-field">' +
              '<label class="visually-hidden" for="contact-event-special-date">' + escapeHtml(getI18nValue("contact.services.eventSpecial.dateLabel", "Fecha y hora")) + "</label>" +
              '<select id="contact-event-special-date" data-contact-event-special-date>' +
                buildDateOptionsMarkup(group) +
              "</select>" +
            "</div>" +
          "</div>" +

          '<div class="contact-event-special-editor__control-grid">' +
            '<div class="form-field">' +
              '<label class="visually-hidden" for="contact-event-special-variant">' + escapeHtml(getI18nValue("contact.services.eventSpecial.variantLabel", "Modalidad")) + "</label>" +
              '<select id="contact-event-special-variant" data-contact-event-special-variant>' +
                buildVariantOptionsMarkup() +
              "</select>" +
            "</div>" +

            '<div class="form-field">' +
              '<label class="visually-hidden" for="contact-event-special-passengers">' + escapeHtml(getI18nValue("contact.services.eventSpecial.passengersLabel", "Pasajeros")) + "</label>" +
              '<select id="contact-event-special-passengers" data-contact-event-special-passengers>' +
                buildPassengerOptionsMarkup() +
              "</select>" +
            "</div>" +
          "</div>" +

          (shouldShowOriginFields()
            ? '<div class="contact-event-special-editor__route-group">' +
                '<div class="contact-event-special-editor__route">' +
                  '<div class="form-field form-field--place contact-event-special-editor__address" data-contact-event-special-address-field data-contact-event-special-address-role="origin">' +
                    buildAddressMarkup("origin") +
                  "</div>" +
                  buildTimeFieldMarkup({
                    inputId: "contact-event-special-origin-pickup-time",
                    field: "origin",
                    label: getI18nValue("contact.services.eventSpecial.originPickupTimeLabel", "Hora de recogida en origen"),
                    value: state.originPickupTime
                  }) +
                "</div>" +
                buildSelectedAddressSummaryMarkup("origin") +
                buildRouteEtaMarkup("origin") +
              "</div>"
            : "") +

          (shouldShowDestinationFields()
            ? '<div class="contact-event-special-editor__route-group">' +
                '<div class="contact-event-special-editor__route">' +
                  '<div class="form-field form-field--place contact-event-special-editor__address" data-contact-event-special-address-field data-contact-event-special-address-role="destination">' +
                    buildAddressMarkup("destination") +
                  "</div>" +
                  buildTimeFieldMarkup({
                    inputId: "contact-event-special-return-pickup-time",
                    field: "return",
                    label: getI18nValue("contact.services.eventSpecial.returnPickupTimeLabel", "Hora recogida tras evento"),
                    value: state.returnPickupTime
                  }) +
                "</div>" +
                buildSelectedAddressSummaryMarkup("destination") +
                buildRouteEtaMarkup("destination") +
              "</div>"
            : "") +

          '<div class="contact-event-special-editor__price-spacer" aria-hidden="true"></div>' +
          buildQuoteCardMarkup() +
        "</div>" +
      "</div>"
    );
  }

  function syncView(nodes) {
    const safeNodes = nodes || getEditorNodes(getReservationForm());

    if (!hasCriticalNodes(safeNodes)) {
      return false;
    }

    syncHiddenFields(safeNodes);
    syncSelectedAddressSummaries(safeNodes.root);
    syncReservationRequestState();

    return true;
  }

  function render() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    destroyAddressControllers();
    nodes.root.innerHTML = buildRootMarkup();
    mountAddressControllers(nodes.root);
    syncView(nodes);

    return true;
  }

  function selectGroup(groupId) {
    const group = state.groups.find(function findGroup(group) {
      return group.id === groupId;
    });

    if (!group) {
      return false;
    }

    state.selectedGroupId = group.id;
    state.selectedEventId = group.events[0] ? group.events[0].id : "";
    state.quoteStatus = "pending";
    state.quote = null;
    render();
    requestQuoteIfReady();

    return true;
  }

  function selectEvent(eventId) {
    const group = getSelectedGroup();
    const event = group
      ? group.events.find(function findEvent(item) {
          return item.id === eventId;
        })
      : null;

    if (!event) {
      return false;
    }

    state.selectedEventId = event.id;
    state.quoteStatus = "pending";
    state.quote = null;
    render();
    requestQuoteIfReady();

    return true;
  }

  function selectVariant(variant) {
    if (getAvailableVariants().indexOf(variant) === -1) {
      return false;
    }

    state.selectedVariant = variant;
    state.quoteStatus = "pending";
    state.quote = null;
    render();
    requestQuoteIfReady();

    return true;
  }

  function selectPassengerFareKey(fareKey) {
    if (getAvailablePassengerFareKeys().indexOf(fareKey) === -1) {
      return false;
    }

    state.selectedPassengerFareKey = fareKey;
    state.quoteStatus = "pending";
    state.quote = null;
    render();
    requestQuoteIfReady();

    return true;
  }

    function getTimeFieldName(target) {
    if (!target || typeof target.getAttribute !== "function") {
      return "";
    }

    return normalizeText(target.getAttribute("data-contact-event-special-time"));
  }

  function isTimeFieldTarget(target) {
    return Boolean(
      target &&
        typeof target.matches === "function" &&
        target.matches("[data-contact-event-special-time]")
    );
  }

  function setNativeTimePickerActive(target) {
    const field = getTimeFieldName(target);

    if (!field) {
      return false;
    }

    nativeTimePickerState.activeField = field;
    nativeTimePickerState.pendingField = "";
    nativeTimePickerState.pendingValue = "";

    return true;
  }

  function setPendingNativeTimeValue(field, value) {
    const safeField = normalizeText(field);
    const safeValue = normalizeTimeValue(value);

    if (!safeField || !safeValue) {
      return false;
    }

    nativeTimePickerState.pendingField = safeField;
    nativeTimePickerState.pendingValue = safeValue;

    return true;
  }

  function applyNativeTimeValue(field, value, target) {
    const safeField = normalizeText(field);
    const safeValue = normalizeTimeValue(value);
    let nextValue = "";

    if (!safeField) {
      return false;
    }

    if (safeField === "return") {
      nextValue = isReturnPickupTimeAllowed(safeValue) ? safeValue : "";
      state.returnPickupTime = nextValue;
      state.returnPickupDayOffset = nextValue
        ? getReturnPickupDayOffset(nextValue)
        : 0;
    } else {
      nextValue = safeValue;
      state.originPickupTime = nextValue;
    }

    if (target && typeof target.value === "string") {
      target.value = nextValue;
    }

    nativeTimePickerState.activeField = "";
    nativeTimePickerState.pendingField = "";
    nativeTimePickerState.pendingValue = "";

    requestQuoteIfReady();

    return true;
  }

  function commitPendingNativeTimeValue() {
    const field = nativeTimePickerState.pendingField;
    const value = nativeTimePickerState.pendingValue;
    const target = field
      ? getReservationForm().querySelector('[data-contact-event-special-time="' + field + '"]')
      : null;

    if (!field || !value) {
      nativeTimePickerState.activeField = "";
      return false;
    }

    return applyNativeTimeValue(field, value, target);
  }

  function handleNativeTimeFieldChange(target) {
    const field = getTimeFieldName(target);
    const value = target && typeof target.value === "string" ? target.value : "";

    if (!field) {
      return false;
    }

    if (nativeTimePickerState.activeField === field) {
      setPendingNativeTimeValue(field, value);
      return true;
    }

    applyNativeTimeValue(field, value, target);
    return true;
  }

  function bindEvents(root) {
    if (!root || root.dataset.contactEventSpecialEditorBound === "1") {
      return false;
    }

    root.dataset.contactEventSpecialEditorBound = "1";

    root.addEventListener("pointerdown", function handlePointerDown(event) {
      const target = event.target;

      if (isTimeFieldTarget(target)) {
        setNativeTimePickerActive(target);
        return;
      }

      commitPendingNativeTimeValue();
    });

    root.addEventListener("focusin", function handleFocusIn(event) {
      const target = event.target;

      if (isTimeFieldTarget(target)) {
        setNativeTimePickerActive(target);
      }
    });

    root.addEventListener("focusout", function handleFocusOut(event) {
      const target = event.target;

      if (!isTimeFieldTarget(target)) {
        return;
      }

      window.setTimeout(function commitAfterNativePickerClose() {
        commitPendingNativeTimeValue();
      }, 0);
    });

    root.addEventListener("change", function handleChange(event) {
      const target = event.target;

      if (!target || typeof target.matches !== "function") {
        return;
      }

      if (target.matches("[data-contact-event-special-event]")) {
        selectGroup(target.value || "");
        return;
      }

      if (target.matches("[data-contact-event-special-date]")) {
        selectEvent(target.value || "");
        return;
      }

      if (target.matches("[data-contact-event-special-variant]")) {
        selectVariant(target.value || "");
        return;
      }

      if (target.matches("[data-contact-event-special-passengers]")) {
        selectPassengerFareKey(target.value || "");
        return;
      }

      if (target.matches("[data-contact-event-special-time]")) {
        handleNativeTimeFieldChange(target);
        return;
      }
    });

    return true;
  }

  function resetState() {
    state.selectedGroupId = state.groups[0] ? state.groups[0].id : "";
    state.selectedEventId = state.groups[0] && state.groups[0].events[0] ? state.groups[0].events[0].id : "";
    state.selectedVariant = getAvailableVariants()[0] || "arrival";
    state.selectedPassengerFareKey = getAvailablePassengerFareKeys()[0] || "van_1_2";
    state.originAddress = "";
    state.originPlaceId = "";
    state.originLat = "";
    state.originLng = "";
    state.originPlace = null;
    state.destinationAddress = "";
    state.destinationPlaceId = "";
    state.destinationLat = "";
    state.destinationLng = "";
    state.destinationPlace = null;
    state.originPickupTime = "";
    state.returnPickupTime = "";
    state.returnPickupDayOffset = 0;
    state.quoteStatus = "pending";
    state.quote = null;
    state.quoteMessageKey = "services.cards.events.panel.quotePending";
  }

  function hasSpecificDraftData() {
    return Boolean(
      state.originAddress ||
        state.destinationAddress ||
        state.originPickupTime ||
        state.returnPickupTime ||
        state.quote
    );
  }

  function applyHandoff(payload) {
    const safePayload = isObject(payload) ? payload : {};
    const groupId = normalizeText(safePayload.event_special_event_id).replace(/_\d{4}_\d{2}_\d{2}$/, "");
    const matchingGroup = state.groups.find(function findGroup(group) {
      return group.events.some(function hasEvent(event) {
        return event.id === safePayload.event_special_event_id;
      });
    });
    const group = matchingGroup || (groupId ? state.groups.find(function findById(item) { return item.id === groupId; }) : null);
    const event = group
      ? group.events.find(function findEvent(item) {
          return item.id === safePayload.event_special_event_id;
        }) || group.events[0]
      : null;

    if (group) {
      state.selectedGroupId = group.id;
    }

    if (event) {
      state.selectedEventId = event.id;
    }

    state.selectedVariant = normalizeText(safePayload.event_special_variant) || state.selectedVariant;
    state.selectedPassengerFareKey = normalizeText(safePayload.event_special_passenger_fare_key) || state.selectedPassengerFareKey;
    state.originAddress = normalizeText(safePayload.event_special_origin_address);
    state.originPlaceId = normalizeText(safePayload.event_special_origin_address_place_id);
    state.originLat = normalizeText(safePayload.event_special_origin_address_lat);
    state.originLng = normalizeText(safePayload.event_special_origin_address_lng);
    state.destinationAddress = normalizeText(safePayload.event_special_destination_address);
    state.destinationPlaceId = normalizeText(safePayload.event_special_destination_address_place_id);
    state.destinationLat = normalizeText(safePayload.event_special_destination_address_lat);
    state.destinationLng = normalizeText(safePayload.event_special_destination_address_lng);
    state.originPickupTime = normalizeText(safePayload.event_special_origin_pickup_time);
    state.returnPickupTime = normalizeText(safePayload.event_special_return_pickup_time);
    state.returnPickupDayOffset = normalizeText(safePayload.event_special_return_pickup_day_offset) === "1"
      ? 1
      : getReturnPickupDayOffset(state.returnPickupTime);

    if (safePayload.event_special_price) {
      state.quoteStatus = "ready";
      state.quote = {
        price: Number(safePayload.event_special_price),
        currency: normalizeText(safePayload.event_special_currency) || DEFAULT_CURRENCY,
        outboundDurationSeconds: Number(safePayload.event_special_outbound_duration_seconds) || null,
        returnDurationSeconds: Number(safePayload.event_special_return_duration_seconds) || null,
        outboundDistanceMeters: Number(safePayload.event_special_outbound_distance_meters) || null,
        returnDistanceMeters: Number(safePayload.event_special_return_distance_meters) || null
      };
    } else {
      state.quoteStatus = "pending";
      state.quote = null;
    }

    render();
    syncReservationRequestState();

    return true;
  }

  function getTripSnapshot() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const venue = getSelectedVenue(group, selectedEvent);

    return {
      serviceType: SERVICE_TYPE,
      eventId: selectedEvent ? selectedEvent.id || "" : "",
      eventLabel: group ? getEventTitle(group) : "",
      eventType: selectedEvent ? selectedEvent.type || group.type || "" : "",
      eventStartsAt: selectedEvent ? selectedEvent.startsAt || "" : "",
      venueId: selectedEvent ? selectedEvent.venueId || group.venueId || "" : "",
      venueLabel: venue ? getVenueName(venue) : "",
      variant: state.selectedVariant,
      variantLabel: getVariantLabel(state.selectedVariant),
      originAddress: state.originAddress,
      originPlaceId: state.originPlaceId,
      originLat: state.originLat,
      originLng: state.originLng,
      destinationAddress: state.destinationAddress,
      destinationPlaceId: state.destinationPlaceId,
      destinationLat: state.destinationLat,
      destinationLng: state.destinationLng,
      originPickupTime: state.originPickupTime,
      returnPickupTime: state.returnPickupTime,
      returnPickupDayOffset: String(state.returnPickupDayOffset || 0),
      returnPickupLabel: getReturnPickupDisplayValue(state.returnPickupTime),
      estimatedEventArrivalTime: getEstimatedEventArrivalTime(),
      estimatedDestinationArrivalTime: getEstimatedDestinationArrivalTime(),
      passengerFareKey: state.selectedPassengerFareKey,
      passengerBucketLabel: getPassengerFareLabel(state.selectedPassengerFareKey),
      price: state.quote && state.quote.price != null ? String(state.quote.price) : "",
      currency: state.quote && state.quote.currency ? state.quote.currency : ""
    };
  }

  function bindI18nLanguageSync(root) {
    if (!root || root.__eventSpecialI18nLangSyncBound === "1") {
      return false;
    }

    root.__eventSpecialI18nLangSyncBound = "1";

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      if (!document.body.contains(root)) {
        return;
      }

      render();
    });

    return true;
  }

  function registerStateHooks() {
    const serviceStateApi = NAMESPACE.contactServiceState;

    if (!serviceStateApi || typeof serviceStateApi !== "object") {
      return false;
    }

    if (typeof serviceStateApi.registerSpecificDraftProbe === "function") {
      serviceStateApi.registerSpecificDraftProbe(
        SERVICE_TYPE,
        hasSpecificDraftData
      );
    }

    return true;
  }

  async function initContactEventSpecialEditor() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    if (!state.loaded && !state.loading) {
      state.loading = true;
      render();

      try {
        const data = await loadData();

        state.groups = data.groups;
        state.venuesById = data.venuesById;
        state.pricing = data.pricing;
        state.loaded = true;
        state.loading = false;
        resetState();
      } catch (error) {
        state.groups = [];
        state.venuesById = {};
        state.pricing = {};
        state.loaded = false;
        state.loading = false;
      }
    }

    bindEvents(nodes.root);
    bindI18nLanguageSync(nodes.root);
    registerStateHooks();
    render();

    return true;
  }

  NAMESPACE.initContactEventSpecialEditor = initContactEventSpecialEditor;
  NAMESPACE.getContactEventSpecialSnapshot = getTripSnapshot;
  NAMESPACE.applyContactEventSpecialHandoff = applyHandoff;
})(window, document);
