(function () {
  "use strict";

  const expandedPanel = document.getElementById("services-expand-events");
  const panelRoot = document.querySelector("[data-services-events-panel]");
  const catalogMount = document.querySelector("[data-services-events-catalog]");
  const emptyMount = document.querySelector("[data-services-events-empty]");
  const configMount = document.querySelector("[data-services-events-config]");

  if (!panelRoot || !catalogMount || !emptyMount || !configMount) return;

  const DATA_BASE = "assets/js/data";
  const MAX_VISIBLE_GROUPS = 10;
  const MIN_LEAD_HOURS = 6;
  const HORIZON_DAYS = 30;
  const CDMX_TIME_ZONE = "America/Mexico_City";
  const RETURN_PICKUP_NEXT_DAY_CUTOFF_MINUTES = 120;

  const state = {
    groups: [],
    venuesById: {},
    pricing: {},
    selectedGroupId: "",
    selectedEventId: "",
    selectedVariant: "arrival",
    selectedPassengerFareKey: "van_1_2",
    originAddress: "",
    originAddressPlace: null,
    destinationAddress: "",
    destinationAddressPlace: null,
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

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return "";

    return path.split(".").reduce((acc, key) => {
      if (!acc || typeof acc !== "object") return "";
      return acc[key];
    }, dict) || "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseLocalDateTimeToMinutes(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return null;
    }

    return (((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute;
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

    const parts = formatter.formatToParts(new Date()).reduce((acc, part) => {
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
    if (!event || event.active !== true) return false;
    if (!event.startsAt) return false;
    if (!event.posterSrc) return false;

    const venue = venuesById[event.venueId];
    if (!venue || venue.active !== true) return false;

    const eventMinutes = parseLocalDateTimeToMinutes(event.startsAt);
    if (eventMinutes === null) return false;

    const nowMinutes = getCdmxNowMinutes();
    const minVisibleMinutes = nowMinutes + (MIN_LEAD_HOURS * 60);
    const maxVisibleMinutes = nowMinutes + (HORIZON_DAYS * 24 * 60);

    return eventMinutes >= minVisibleMinutes && eventMinutes <= maxVisibleMinutes;
  }

  function sortEvents(a, b) {
    const aFeatured = a.featured === true ? 0 : 1;
    const bFeatured = b.featured === true ? 0 : 1;

    if (aFeatured !== bFeatured) return aFeatured - bFeatured;

    const aMinutes = parseLocalDateTimeToMinutes(a.startsAt);
    const bMinutes = parseLocalDateTimeToMinutes(b.startsAt);

    if (aMinutes !== bMinutes) return aMinutes - bMinutes;

    return Number(a.priority || 0) - Number(b.priority || 0);
  }

  function sortGroups(a, b) {
    const aFeatured = a.featured === true ? 0 : 1;
    const bFeatured = b.featured === true ? 0 : 1;

    if (aFeatured !== bFeatured) return aFeatured - bFeatured;

    const aFirst = a.events[0] ? parseLocalDateTimeToMinutes(a.events[0].startsAt) : 0;
    const bFirst = b.events[0] ? parseLocalDateTimeToMinutes(b.events[0].startsAt) : 0;

    if (aFirst !== bFirst) return aFirst - bFirst;

    return Number(a.priority || 0) - Number(b.priority || 0);
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

    return {
      venues: Array.isArray(results[0].venues) ? results[0].venues : [],
      events: Array.isArray(results[1].events) ? results[1].events : [],
      pricing: results[2] || {}
    };
  }

  function buildVenuesById(venues) {
    return venues.reduce((acc, venue) => {
      if (venue && venue.id) {
        acc[venue.id] = venue;
      }

      return acc;
    }, {});
  }

  function buildEventGroups(events, venuesById) {
    const groupsById = {};

    events
      .filter((event) => isEventEligible(event, venuesById))
      .sort(sortEvents)
      .forEach((event) => {
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
      .map((groupId) => {
        const group = groupsById[groupId];
        group.events = group.events.sort(sortEvents);
        return group;
      })
      .sort(sortGroups)
      .slice(0, MAX_VISIBLE_GROUPS);
  }

  function getEventTitle(entity) {
    return getI18nValue(entity.titleKey) || entity.id;
  }

  function getVenueName(venue) {
    return getI18nValue(venue.nameKey) || venue.id;
  }

  function getEventTypeLabel(type) {
    return getI18nValue("services.cards.events.types." + type) ||
      getI18nValue("services.cards.events.types.other") ||
      "Evento";
  }

  function formatEventDate(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) return raw;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = match[4];
    const minute = match[5];

    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dateLabel = new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(date);

    return dateLabel + ", " + hour + ":" + minute;
  }

  function getEventDateLabel(event) {
    return getI18nValue(event.dateLabelKey) || formatEventDate(event.startsAt);
  }

  function getGroupDateSummary(group) {
    return group.events.map((event) => getEventDateLabel(event)).join(" / ");
  }

  function formatCurrency(value, currency) {
    const currencyCode = currency || "MXN";

    if (typeof value !== "number") return "";

    try {
      const amount = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(value);

      return amount + " " + currencyCode;
    } catch (error) {
      return String(value) + " " + currencyCode;
    }
  }

  function getFromPrice(pricing) {
    const publicFromPrice = pricing.publicFromPrice || {};
    const variantId = publicFromPrice.variant || "arrival";
    const passengerFareKey = publicFromPrice.passengerFareKey || "van_1_2";
    const variant = pricing.variants && pricing.variants[variantId];
    const passengerFactor = pricing.passengerFactors && pricing.passengerFactors[passengerFareKey];
    const minimum = variant && typeof variant.minimum === "number" ? variant.minimum : 0;
    const factor = passengerFactor && typeof passengerFactor.factor === "number" ? passengerFactor.factor : 1;
    const step = pricing.rounding && typeof pricing.rounding.step === "number" ? pricing.rounding.step : 50;

    if (!minimum) return null;

    return Math.ceil((minimum * factor) / step) * step;
  }

  function getSelectedGroup() {
    return state.groups.find((group) => group.id === state.selectedGroupId) || null;
  }

  function getSelectedEvent(group) {
    if (!group) return null;

    return group.events.find((event) => event.id === state.selectedEventId) ||
      group.events[0] ||
      null;
  }

  function isMobileViewport() {
    return window.innerWidth <= 720;
  }

  function buildEventGroupCard(group) {
    const title = getEventTitle(group);
    const venue = state.venuesById[group.venueId];
    const venueName = venue ? getVenueName(venue) : "";
    const typeLabel = getEventTypeLabel(group.type);
    const dateSummary = getGroupDateSummary(group);
    const fromPrice = getFromPrice(state.pricing);
    const fromLabel = getI18nValue("services.cards.events.panel.priceFromLabel") || "Desde";
    const ctaLabel = getI18nValue("services.cards.events.panel.eventCta") || "Solicitar traslado";
    const posterAlt = getI18nValue("services.cards.events.panel.posterAlt") || "Cartel del evento";
    const isSelected = state.selectedGroupId === group.id;

    return `
      <article
        class="services-events-panel__event${isSelected ? " is-selected" : ""}"
        data-services-events-group="${escapeHtml(group.id)}"
        role="button"
        tabindex="0"
        aria-pressed="${isSelected ? "true" : "false"}"
      >
        <div class="services-events-panel__event-media">
          <picture>
            <source
              media="(max-width: 720px)"
              srcset="${escapeHtml(group.posterMobileSrc || group.posterSrc)}"
            />
            <img
              class="services-events-panel__event-image"
              src="${escapeHtml(group.posterSrc)}"
              alt="${escapeHtml(posterAlt + ": " + title)}"
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>

        <div class="services-events-panel__event-body">
          <p class="services-events-panel__event-type">${escapeHtml(typeLabel)}</p>
          <h4 class="services-events-panel__event-title">${escapeHtml(title)}</h4>

          <dl class="services-events-panel__event-meta">
            <div>
              <dt>${escapeHtml(getI18nValue("services.cards.events.panel.dateLabel") || "Fecha y hora")}</dt>
              <dd>${escapeHtml(dateSummary)}</dd>
            </div>
            <div>
              <dt>${escapeHtml(getI18nValue("services.cards.events.panel.venueLabel") || "Recinto")}</dt>
              <dd>${escapeHtml(venueName)}</dd>
            </div>
          </dl>

          <div class="services-events-panel__event-footer">
            <div class="services-events-panel__event-price">
              <span>${escapeHtml(fromLabel)}</span>
              <strong>${escapeHtml(formatCurrency(fromPrice, state.pricing.currency || "MXN"))}</strong>
            </div>

            <span class="services-events-panel__event-cta" aria-hidden="true">
              ${escapeHtml(ctaLabel)}
            </span>
          </div>
        </div>
      </article>
    `;
  }
  
    function getAvailableVariants() {
    const variants = state.pricing && state.pricing.variants ? state.pricing.variants : {};
    return ["arrival", "departure", "round_trip"].filter((variantId) => {
      return !!variants[variantId];
    });
  }

  function getVariantLabel(variantId) {
    const variant = state.pricing && state.pricing.variants
      ? state.pricing.variants[variantId]
      : null;

    if (variant && variant.labelKey) {
      return getI18nValue(variant.labelKey) || variantId;
    }

    return getI18nValue("services.cards.events.variants." + variantId) || variantId;
  }

  function buildVariantOptionsMarkup() {
    return getAvailableVariants().map((variantId) => {
      const isSelected = state.selectedVariant === variantId;

      return `
        <button
          type="button"
          class="services-events-panel__variant-option${isSelected ? " is-selected" : ""}"
          data-services-events-variant-option="${escapeHtml(variantId)}"
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          ${escapeHtml(getVariantLabel(variantId))}
        </button>
      `;
    }).join("");
  }
  
    function getAvailablePassengerFareKeys() {
    const passengerFactors = state.pricing && state.pricing.passengerFactors
      ? state.pricing.passengerFactors
      : {};

    return ["van_1_2", "van_3_4", "van_5_6"].filter((fareKey) => {
      return !!passengerFactors[fareKey];
    });
  }

  function getPassengerFareLabel(fareKey) {
    const passengerFactor = state.pricing && state.pricing.passengerFactors
      ? state.pricing.passengerFactors[fareKey]
      : null;

    if (passengerFactor && passengerFactor.labelKey) {
      return getI18nValue(passengerFactor.labelKey) || fareKey;
    }

    return getI18nValue("services.cards.events.passengerBuckets." + fareKey) || fareKey;
  }

  function getMobilePassengerFareLabel(fareKey) {
    return getI18nValue("services.cards.events.passengerBucketsMobile." + fareKey) ||
      getPassengerFareLabel(fareKey);
  }

  function buildPassengerOptionsMarkup() {
    return getAvailablePassengerFareKeys().map((fareKey) => {
      const isSelected = state.selectedPassengerFareKey === fareKey;

      return `
        <button
          type="button"
          class="services-events-panel__passenger-option${isSelected ? " is-selected" : ""}"
          data-services-events-passenger-option="${escapeHtml(fareKey)}"
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          ${escapeHtml(getPassengerFareLabel(fareKey))}
        </button>
      `;
    }).join("");
  }

  function buildDateOptionsMarkup(group) {
    return group.events.map((event) => {
      const isSelected = state.selectedEventId === event.id;

      return `
        <button
          type="button"
          class="services-events-panel__date-option${isSelected ? " is-selected" : ""}"
          data-services-events-date-option="${escapeHtml(event.id)}"
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          ${escapeHtml(getEventDateLabel(event))}
        </button>
      `;
    }).join("");
  }

  function buildMobileDateSelectMarkup(group) {
    return `
      <select
        class="services-events-panel__mobile-select"
        data-services-events-mobile-date
      >
        ${group.events.map((event) => `
          <option
            value="${escapeHtml(event.id)}"
            ${state.selectedEventId === event.id ? "selected" : ""}
          >${escapeHtml(getEventDateLabel(event))}</option>
        `).join("")}
      </select>
    `;
  }

  function buildMobileVariantSelectMarkup() {
    return `
      <select
        class="services-events-panel__mobile-select"
        data-services-events-mobile-variant
      >
        ${getAvailableVariants().map((variantId) => `
          <option
            value="${escapeHtml(variantId)}"
            ${state.selectedVariant === variantId ? "selected" : ""}
          >${escapeHtml(getVariantLabel(variantId))}</option>
        `).join("")}
      </select>
    `;
  }

  function buildMobilePassengerSelectMarkup() {
    return `
      <select
        class="services-events-panel__mobile-select"
        data-services-events-mobile-passengers
      >
        ${getAvailablePassengerFareKeys().map((fareKey) => `
          <option
            value="${escapeHtml(fareKey)}"
            ${state.selectedPassengerFareKey === fareKey ? "selected" : ""}
          >${escapeHtml(getMobilePassengerFareLabel(fareKey))}</option>
        `).join("")}
      </select>
    `;
  }
  
    function getAddressModule() {
    return window.PixkuyServicesEventsSpecialAddress &&
      typeof window.PixkuyServicesEventsSpecialAddress.buildAddressMarkup === "function"
      ? window.PixkuyServicesEventsSpecialAddress
      : null;
  }

  function getSingleAddressLabel() {
    if (state.selectedVariant === "departure") {
      return getI18nValue("services.cards.events.panel.addressDestinationLabel") ||
        getI18nValue("services.cards.events.panel.addressLabel") ||
        "Destino";
    }

    return getI18nValue("services.cards.events.panel.addressOriginLabel") ||
      getI18nValue("services.cards.events.panel.addressLabel") ||
      "Origen";
  }

  function getSingleAddressPlaceholder() {
    if (state.selectedVariant === "departure") {
      return getI18nValue("services.cards.events.panel.addressDestinationPlaceholder") ||
        getI18nValue("services.cards.events.panel.addressPlaceholder") ||
        "Escribe la dirección en Ciudad de México donde te llevaremos tras el evento";
    }

    return getI18nValue("services.cards.events.panel.addressOriginPlaceholder") ||
      getI18nValue("services.cards.events.panel.addressPlaceholder") ||
      "Escribe tu dirección de origen en Ciudad de México donde tenemos que recogerte";
  }

  function getRoundTripOriginLabel() {
    return getI18nValue("services.cards.events.panel.addressOriginLabel") ||
      getI18nValue("services.cards.events.panel.addressLabel") ||
      "Origen";
  }

  function getRoundTripDestinationLabel() {
    return getI18nValue("services.cards.events.panel.addressReturnDestinationLabel") ||
      getI18nValue("services.cards.events.panel.addressDestinationLabel") ||
      "Destino tras el evento";
  }

  function getRoundTripOriginPlaceholder() {
    return getI18nValue("services.cards.events.panel.addressOriginPlaceholder") ||
      getI18nValue("services.cards.events.panel.addressPlaceholder") ||
      "Escribe tu dirección de origen en Ciudad de México donde tenemos que recogerte";
  }

  function getRoundTripDestinationPlaceholder() {
    return getI18nValue("services.cards.events.panel.addressReturnDestinationPlaceholder") ||
      getI18nValue("services.cards.events.panel.addressDestinationPlaceholder") ||
      getI18nValue("services.cards.events.panel.addressPlaceholder") ||
      "Escribe la dirección en Ciudad de México donde te llevaremos después del evento";
  }

  function buildSingleAddressFieldMarkup() {
    const addressModule = getAddressModule();
    const isDeparture = state.selectedVariant === "departure";
    const fieldName = isDeparture
      ? "event_special_destination_address"
      : "event_special_origin_address";
    const inputId = isDeparture
      ? "services-events-destination-address"
      : "services-events-origin-address";
    const value = isDeparture
      ? state.destinationAddress
      : state.originAddress;

    if (!addressModule) return "";

    return `
      <div class="services-events-panel__route-row">
        <div
          class="services-events-panel__address-field"
          data-services-events-address-field
          data-services-events-address-role="${isDeparture ? "destination" : "origin"}"
        >
          ${addressModule.buildAddressMarkup({
            fieldName,
            inputId,
            label: getSingleAddressLabel(),
            placeholder: getSingleAddressPlaceholder(),
            value
          })}
        </div>

        ${buildTimeFieldMarkup({
          inputId: isDeparture
            ? "services-events-return-pickup-time"
            : "services-events-origin-pickup-time",
          field: isDeparture ? "return" : "origin",
          label: isDeparture ? getReturnPickupTimeLabel() : getOriginPickupTimeLabel(),
          value: isDeparture ? state.returnPickupTime : state.originPickupTime
        })}

        ${buildEstimatedArrivalMarkup(isDeparture ? "destination" : "origin")}
      </div>
    `;
  }

  function buildRoundTripAddressFieldsMarkup() {
    const addressModule = getAddressModule();

    if (!addressModule) return "";

    return `
      <div class="services-events-panel__round-trip-routes">
        <div class="services-events-panel__route-row">
          <div
            class="services-events-panel__address-field"
            data-services-events-address-field
            data-services-events-address-role="origin"
          >
            ${addressModule.buildAddressMarkup({
              fieldName: "event_special_origin_address",
              inputId: "services-events-origin-address",
              label: getRoundTripOriginLabel(),
              placeholder: getRoundTripOriginPlaceholder(),
              value: state.originAddress
            })}
          </div>

          ${buildTimeFieldMarkup({
            inputId: "services-events-origin-pickup-time",
            field: "origin",
            label: getOriginPickupTimeLabel(),
            value: state.originPickupTime
          })}

          ${buildEstimatedArrivalMarkup("origin")}
        </div>

        <div class="services-events-panel__route-row">
          <div
            class="services-events-panel__address-field"
            data-services-events-address-field
            data-services-events-address-role="destination"
          >
            ${addressModule.buildAddressMarkup({
              fieldName: "event_special_destination_address",
              inputId: "services-events-destination-address",
              label: getRoundTripDestinationLabel(),
              placeholder: getRoundTripDestinationPlaceholder(),
              value: state.destinationAddress
            })}
          </div>

          ${buildTimeFieldMarkup({
            inputId: "services-events-return-pickup-time",
            field: "return",
            label: getReturnPickupTimeLabel(),
            value: state.returnPickupTime
          })}

          ${buildEstimatedArrivalMarkup("destination")}
        </div>
      </div>
    `;
  }

  function buildAddressFieldMarkup() {
    if (state.selectedVariant === "round_trip") {
      return buildRoundTripAddressFieldsMarkup();
    }

    return buildSingleAddressFieldMarkup();
  }
  
    function getPickupTimePlaceholder() {
    return getI18nValue("services.cards.events.panel.pickupTimePlaceholder") || "--:--";
  }

  function getOriginPickupTimeLabel() {
    return getI18nValue("services.cards.events.panel.pickupTimeOriginLabel") ||
      "Hora de recogida en origen";
  }

  function getReturnPickupTimeLabel() {
    return getI18nValue("services.cards.events.panel.pickupTimeAfterEventLabel") ||
      "Hora de recogida tras el evento";
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

  function isValidTimeForField(field, value) {
    if (field !== "return") {
      return Boolean(normalizeTimeValue(value));
    }

    return isReturnPickupTimeAllowed(value);
  }
  
    function getTimeFieldName(target) {
    if (!target || typeof target.getAttribute !== "function") {
      return "";
    }

    return String(target.getAttribute("data-services-events-time") || "").trim();
  }

  function isTimeFieldTarget(target) {
    return Boolean(
      target &&
        typeof target.matches === "function" &&
        target.matches("[data-services-events-time]")
    );
  }

  function setNativeTimePickerActive(target) {
    const field = getTimeFieldName(target);

    if (!isMobileViewport() || !field) {
      return false;
    }

    nativeTimePickerState.activeField = field;
    nativeTimePickerState.pendingField = "";
    nativeTimePickerState.pendingValue = "";

    return true;
  }

  function setPendingNativeTimeValue(field, value) {
    const safeField = String(field || "").trim();

    if (!safeField) {
      return false;
    }

    nativeTimePickerState.pendingField = safeField;
    nativeTimePickerState.pendingValue = String(value || "").trim();

    return true;
  }

  function applyTimeValue(field, value, target) {
    const safeField = String(field || "").trim();
    const safeValue = isValidTimeForField(safeField, value)
      ? normalizeTimeValue(value)
      : "";

    if (!safeField) {
      return false;
    }

    if (safeField === "return") {
      state.returnPickupTime = safeValue;
      state.returnPickupDayOffset = safeValue ? getReturnPickupDayOffset(safeValue) : 0;
    } else {
      state.originPickupTime = safeValue;
    }

    if (target && typeof target.value === "string") {
      target.value = safeValue;
      syncTimeOverlay(target);
      syncReturnPickupLabel(target);
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
      ? configMount.querySelector('[data-services-events-time="' + field + '"]')
      : null;

    if (!field) {
      nativeTimePickerState.activeField = "";
      return false;
    }

    return applyTimeValue(field, value, target);
  }

  function handleTimeFieldInteraction(target) {
    const field = getTimeFieldName(target);

    if (!field) {
      return false;
    }

    syncTimeOverlay(target);

    if (
      isMobileViewport() &&
      field === "return"
    ) {
      nativeTimePickerState.activeField = field;
      setPendingNativeTimeValue(field, target.value);
      return true;
    }

    if (
      isMobileViewport() &&
      nativeTimePickerState.activeField === field
    ) {
      setPendingNativeTimeValue(field, target.value);
      return true;
    }

    return applyTimeValue(field, target.value, target);
  }

  function buildEstimatedArrivalTime(startTime, durationSeconds) {
    const time = normalizeTimeValue(startTime);
    const seconds = Number(durationSeconds);

    if (!time || !Number.isFinite(seconds) || seconds <= 0) {
      return "";
    }

    const parts = time.split(":");
    const baseMinutes = (Number(parts[0]) * 60) + Number(parts[1]);
    const addedMinutes = Math.ceil(seconds / 60);
    const totalMinutes = (baseMinutes + addedMinutes) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function getEstimatedArrivalLabel(role) {
    if (role === "destination") {
      return getI18nValue("services.cards.events.panel.estimatedDestinationArrivalLabel") ||
        "Llegada a destino estimada";
    }

    return getI18nValue("services.cards.events.panel.estimatedEventArrivalLabel") ||
      "Llegada al evento estimada";
  }

  function getEstimatedArrivalValue(role) {
    if (state.quoteStatus !== "ready" || !state.quote) {
      return getI18nValue("services.cards.events.panel.estimatedArrivalPending") || "Pendiente";
    }

    if (role === "destination") {
      return buildEstimatedArrivalTime(state.returnPickupTime, state.quote.returnDurationSeconds) ||
        getI18nValue("services.cards.events.panel.estimatedArrivalPending") ||
        "Pendiente";
    }

    return buildEstimatedArrivalTime(state.originPickupTime, state.quote.outboundDurationSeconds) ||
      getI18nValue("services.cards.events.panel.estimatedArrivalPending") ||
      "Pendiente";
  }

  function buildEstimatedArrivalMarkup(role) {
    return `
      <div
        class="services-events-panel__eta-field"
        data-services-events-eta="${escapeHtml(role)}"
      >
        <span class="services-events-panel__label">${escapeHtml(getEstimatedArrivalLabel(role))}</span>
        <strong class="services-events-panel__eta-value">${escapeHtml(getEstimatedArrivalValue(role))}</strong>
      </div>
    `;
  }

  function renderEstimatedArrivals() {
    const etaNodes = configMount.querySelectorAll("[data-services-events-eta]");

    etaNodes.forEach((node) => {
      const role = node.getAttribute("data-services-events-eta") || "origin";
      const valueNode = node.querySelector(".services-events-panel__eta-value");

      if (valueNode) {
        valueNode.textContent = getEstimatedArrivalValue(role);
      }
    });
  }

  function buildTimeFieldMarkup(options) {
    const safeOptions = options || {};
    const inputId = safeOptions.inputId || "";
    const value = safeOptions.value || "";
    const label = safeOptions.label || "";
    const field = safeOptions.field || "";

    return `
      <div class="services-events-panel__time-field">
        <label class="services-events-panel__label" for="${escapeHtml(inputId)}">${escapeHtml(label)}</label>

        <div class="services-events-panel__date-wrap">
          <input
            id="${escapeHtml(inputId)}"
            type="time"
            class="services-events-panel__control"
            data-services-events-time="${escapeHtml(field)}"
            value="${escapeHtml(value)}"
          />

          <span
            class="services-events-panel__date-overlay services-events-panel__time-overlay"
            aria-hidden="true"
            ${value ? "hidden" : ""}
          >${escapeHtml(getPickupTimePlaceholder())}</span>

          <span class="services-events-panel__date-icon services-events-panel__time-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>
              <polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
            </svg>
          </span>
        </div>
      </div>
    `;
  }

  function destroyAddressControllers() {
    state.addressControllers.forEach((controller) => {
      if (controller && typeof controller.destroy === "function") {
        controller.destroy();
      }
    });

    state.addressControllers = [];
  }

  function setAddressValue(role, value) {
    const safeValue = value || "";

    if (role === "destination") {
      state.destinationAddress = safeValue;
      state.destinationAddressPlace = null;
      setQuotePending();
      return;
    }

    state.originAddress = safeValue;
    state.originAddressPlace = null;
    setQuotePending();
  }

  function setAddressPlace(role, selectedPlace) {
    const label = selectedPlace && selectedPlace.label ? selectedPlace.label : "";

    if (role === "destination") {
      state.destinationAddress = label || state.destinationAddress;
      state.destinationAddressPlace = selectedPlace || null;
      requestQuoteIfReady();
      return;
    }

    state.originAddress = label || state.originAddress;
    state.originAddressPlace = selectedPlace || null;
    requestQuoteIfReady();
  }

  function clearAddress(role) {
    if (role === "destination") {
      state.destinationAddress = "";
      state.destinationAddressPlace = null;
      setQuotePending();
      return;
    }

    state.originAddress = "";
    state.originAddressPlace = null;
    setQuotePending();
  }

  function mountAddressControllerForRoot(addressModule, addressRoot) {
    const role = addressRoot.getAttribute("data-services-events-address-role") || "origin";
    const fieldName = role === "destination"
      ? "event_special_destination_address"
      : "event_special_origin_address";

    const controller = addressModule.mount({
      root: addressRoot,
      fieldName,
      onManualInput: function (value) {
        setAddressValue(role, value);
      },
      onPlaceSelected: function (selectedPlace) {
        setAddressPlace(role, selectedPlace);
      },
      onClearSelection: function () {
        clearAddress(role);
      },
      onError: function () {
        if (role === "destination") {
          state.destinationAddressPlace = null;
          return;
        }

        state.originAddressPlace = null;
      }
    });

    if (controller) {
      state.addressControllers.push(controller);
    }
  }

  function mountAddressControllers() {
    const addressModule = getAddressModule();
    const addressRoots = configMount.querySelectorAll("[data-services-events-address-field]");

    destroyAddressControllers();

    if (!addressModule || typeof addressModule.mount !== "function" || !addressRoots.length) {
      return;
    }

    addressRoots.forEach((addressRoot) => {
      mountAddressControllerForRoot(addressModule, addressRoot);
    });
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
    if (!place || typeof place !== "object") return null;

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

  function buildQuoteAddress(role) {
    const isDestination = role === "destination";
    const place = isDestination ? state.destinationAddressPlace : state.originAddressPlace;
    const fallbackLabel = isDestination ? state.destinationAddress : state.originAddress;

    if (!place || typeof place !== "object") return null;

    const lat = getPlaceCoordinate(place, "lat", "latitude");
    const lng = getPlaceCoordinate(place, "lng", "longitude");

    if (lat === null || lng === null) return null;

    return {
      label: place.label || place.formattedAddress || place.displayName || fallbackLabel,
      placeId: place.placeId || place.id || "",
      lat,
      lng
    };
  }

  function buildQuoteInput() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);

    if (!group || !selectedEvent) {
      return {};
    }

    const input = {
      eventId: selectedEvent.id,
      eventStartsAt: selectedEvent.startsAt || "",
      venueId: selectedEvent.venueId || group.venueId,
      variant: state.selectedVariant,
      passengerFareKey: state.selectedPassengerFareKey
    };

    if (state.selectedVariant === "arrival" || state.selectedVariant === "round_trip") {
      input.originAddress = buildQuoteAddress("origin");
      input.originPickupTime = state.originPickupTime;
    }

    if (state.selectedVariant === "departure" || state.selectedVariant === "round_trip") {
      input.destinationAddress = buildQuoteAddress("destination");
      input.returnPickupTime = isReturnPickupTimeAllowed(state.returnPickupTime)
        ? state.returnPickupTime
        : "";
      input.returnPickupDayOffset = getReturnPickupDayOffset(state.returnPickupTime);
    }

    return input;
  }

  function formatQuotePrice(quote) {
    if (!quote || typeof quote.price !== "number") return "";

    return formatCurrency(quote.price, quote.currency || state.pricing.currency || "MXN");
  }

  function buildQuoteStatusMarkup() {
    const finalPriceLabel = getI18nValue("services.cards.events.panel.finalPriceLabel") || "Precio final";
    const pendingLabel = getI18nValue("services.cards.events.panel.quotePending") || "Completa los datos para calcular el precio.";
    const loadingLabel = getI18nValue("services.cards.events.panel.quoteLoading") || "Calculando precio...";
    const unavailableLabel = getI18nValue(state.quoteMessageKey) ||
      getI18nValue("services.cards.events.panel.quoteUnavailable") ||
      "No podemos calcular el precio para esta ruta en este momento.";

    if (state.quoteStatus === "ready" && state.quote) {
      return `
        <div class="services-events-panel__quote-card services-events-panel__quote-card--ready">
          <span class="services-events-panel__quote-label">${escapeHtml(finalPriceLabel)}</span>
          <strong class="services-events-panel__quote-value">${escapeHtml(formatQuotePrice(state.quote))}</strong>
        </div>
      `;
    }

    if (state.quoteStatus === "loading") {
      return `
        <div class="services-events-panel__quote-card">
          <span class="services-events-panel__quote-label">${escapeHtml(loadingLabel)}</span>
        </div>
      `;
    }

    if (state.quoteStatus === "error") {
      return `
        <div class="services-events-panel__quote-card services-events-panel__quote-card--error">
          <span class="services-events-panel__quote-label">${escapeHtml(unavailableLabel)}</span>
        </div>
      `;
    }

    return `
      <div class="services-events-panel__quote-card">
        <span class="services-events-panel__quote-label">${escapeHtml(pendingLabel)}</span>
      </div>
    `;
  }

  function syncContinueCtaState() {
    const continueButton = configMount.querySelector("[data-services-events-continue]");
    const label = getI18nValue("services.cards.events.panel.continueCta") ||
      "Continuar solicitud";
    const disabledLabel = getI18nValue("services.cards.events.panel.ctaDisabled") ||
      "Completa los datos del evento para continuar.";
    const isReady = isReadyForContactHandoff();

    if (!continueButton) return;

    continueButton.disabled = !isReady;
    continueButton.setAttribute("aria-disabled", isReady ? "false" : "true");
    continueButton.setAttribute("title", isReady ? label : disabledLabel);
  }

  function renderQuoteStatus() {
    const quoteMount = configMount.querySelector("[data-services-events-quote]");

    if (!quoteMount) return;

    quoteMount.innerHTML = buildQuoteStatusMarkup();
    renderEstimatedArrivals();
    syncContinueCtaState();
  }
  
    function isReadyForContactHandoff() {
    return Boolean(
      state.quoteStatus === "ready" &&
      state.quote &&
      typeof state.quote === "object"
    );
  }

  function buildContinueCtaMarkup() {
    const label = getI18nValue("services.cards.events.panel.continueCta") ||
      "Continuar solicitud";
    const disabledLabel = getI18nValue("services.cards.events.panel.ctaDisabled") ||
      "Completa los datos del evento para continuar.";
    const isReady = isReadyForContactHandoff();

    return `
      <div class="services-events-panel__actions">
        <button
          type="button"
          class="services-expand__cta services-events-panel__continue-cta"
          data-services-events-continue
          ${isReady ? "" : "disabled"}
          aria-disabled="${isReady ? "false" : "true"}"
          title="${escapeHtml(isReady ? label : disabledLabel)}"
        >
          ${escapeHtml(label)}
        </button>
      </div>
    `;
  }

  function buildContactHandoffPayload() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);
    const venue = group && group.venueId ? state.venuesById[group.venueId] : null;
    const quote = state.quote && typeof state.quote === "object" ? state.quote : null;
    const originAddress = buildQuoteAddress("origin");
    const destinationAddress = buildQuoteAddress("destination");
    const estimatedEventArrivalTime = buildEstimatedArrivalTime(
      state.originPickupTime,
      quote && quote.outboundDurationSeconds
    );
    const estimatedDestinationArrivalTime = buildEstimatedArrivalTime(
      state.returnPickupTime,
      quote && quote.returnDurationSeconds
    );

    if (!group || !selectedEvent || !venue || !isReadyForContactHandoff()) {
      return null;
    }

    return {
      event_special_event_id: selectedEvent.id || "",
      event_special_event_label: getEventTitle(group),
      event_special_event_type: selectedEvent.type || group.type || "",
      event_special_event_starts_at: selectedEvent.startsAt || "",
      event_special_venue_id: selectedEvent.venueId || group.venueId || "",
      event_special_venue_label: getVenueName(venue),
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
      event_special_return_pickup_time: state.returnPickupTime,
      event_special_return_pickup_day_offset: String(state.returnPickupDayOffset || 0),
      event_special_return_pickup_label: getReturnPickupDisplayValue(state.returnPickupTime),
      event_special_estimated_event_arrival_time: estimatedEventArrivalTime,
      event_special_estimated_destination_arrival_time: estimatedDestinationArrivalTime,
      event_special_outbound_duration_seconds: quote.outboundDurationSeconds != null ? String(quote.outboundDurationSeconds) : "",
      event_special_return_duration_seconds: quote.returnDurationSeconds != null ? String(quote.returnDurationSeconds) : "",
      event_special_outbound_distance_meters: quote.outboundDistanceMeters != null ? String(quote.outboundDistanceMeters) : "",
      event_special_return_distance_meters: quote.returnDistanceMeters != null ? String(quote.returnDistanceMeters) : "",
      event_special_passenger_fare_key: state.selectedPassengerFareKey,
      event_special_passenger_bucket_label: getPassengerFareLabel(state.selectedPassengerFareKey),
      event_special_price: quote.price != null ? String(quote.price) : "",
      event_special_currency: quote.currency || state.pricing.currency || "MXN",
      event_special_notes: ""
    };
  }

  function dispatchContactHandoff() {
    const payload = buildContactHandoffPayload();

    if (!payload) {
      return false;
    }

    window.dispatchEvent(
      new CustomEvent("pixkuy:events-special-panel-submit", {
        detail: payload
      })
    );

    return true;
  }

  function setQuotePending() {
    state.quoteStatus = "pending";
    state.quote = null;
    state.quoteMessageKey = "services.cards.events.panel.quotePending";
    renderQuoteStatus();
  }

  function requestQuoteIfReady() {
    const quoteModule = getQuoteModule();

    if (!quoteModule) {
      state.quoteStatus = "error";
      state.quote = null;
      state.quoteMessageKey = "services.cards.events.panel.quoteUnavailable";
      renderQuoteStatus();
      return;
    }

    const quoteInput = buildQuoteInput();
    const quotePayload = typeof quoteModule.buildQuotePayload === "function"
      ? quoteModule.buildQuotePayload(quoteInput)
      : quoteInput;

    if (
      typeof quoteModule.isQuotePayloadComplete !== "function" ||
      !quoteModule.isQuotePayloadComplete(quotePayload)
    ) {
      setQuotePending();
      return;
    }

    const requestId = state.quoteRequestId + 1;
    state.quoteRequestId = requestId;
    state.quoteStatus = "loading";
    state.quote = null;
    state.quoteMessageKey = "services.cards.events.panel.quoteLoading";
    renderQuoteStatus();

    quoteModule.requestQuote(quoteInput)
      .then((result) => {
        if (state.quoteRequestId !== requestId) return;

        if (result && result.ok === true && result.quote) {
          state.quoteStatus = "ready";
          state.quote = result.quote;
          state.quoteMessageKey = "";
          renderQuoteStatus();
          return;
        }

        state.quoteStatus = "error";
        state.quote = null;
        state.quoteMessageKey = result && result.messageKey
          ? result.messageKey
          : "services.cards.events.panel.quoteUnavailable";
        renderQuoteStatus();
      })
      .catch(() => {
        if (state.quoteRequestId !== requestId) return;

        state.quoteStatus = "error";
        state.quote = null;
        state.quoteMessageKey = "services.cards.events.panel.quoteUnavailable";
        renderQuoteStatus();
      });
  }

  function buildConfigMarkup() {
    const group = getSelectedGroup();
    const selectedEvent = getSelectedEvent(group);

    if (!group || !selectedEvent) return "";

    const title = getEventTitle(group);
    const venue = state.venuesById[group.venueId];
    const venueName = venue ? getVenueName(venue) : "";
    const selectedEventLabel = getI18nValue("services.cards.events.panel.selectedEventLabel") || "Evento seleccionado";
    const dateLabel = getI18nValue("services.cards.events.panel.dateLabel") || "Fecha y hora";
    const venueLabel = getI18nValue("services.cards.events.panel.venueLabel") || "Recinto";
    const variantLabel = getI18nValue("services.cards.events.panel.variantLabel") || "Modalidad";
    const passengersLabel = getI18nValue("services.cards.events.panel.passengersLabel") || "Pasajeros";
    const configurationTitle = getI18nValue("services.cards.events.panel.configurationTitle") || "Configura tu traslado";

    return `
      <div class="services-events-panel__config-inner">
        <h4 class="services-events-panel__config-title">${escapeHtml(configurationTitle)}</h4>

        <div class="services-events-panel__selected">
          <div>
            <span class="services-events-panel__selected-label">${escapeHtml(selectedEventLabel)}</span>
            <strong class="services-events-panel__selected-title">${escapeHtml(title)}</strong>
          </div>

          <div>
            <span class="services-events-panel__selected-label">${escapeHtml(venueLabel)}</span>
            <strong class="services-events-panel__selected-title">${escapeHtml(venueName)}</strong>
          </div>

          <div
            class="services-events-panel__selected-quote"
            data-services-events-quote
            aria-live="polite"
          ></div>
        </div>

        ${isMobileViewport() ? `
          <div class="services-events-panel__mobile-controls">
            <div class="services-events-panel__mobile-field services-events-panel__mobile-field--date">
              <span class="services-events-panel__label">${escapeHtml(dateLabel)}</span>
              ${buildMobileDateSelectMarkup(group)}
            </div>

            <div class="services-events-panel__mobile-row">
              <div class="services-events-panel__mobile-field">
                <span class="services-events-panel__label">${escapeHtml(variantLabel)}</span>
                ${buildMobileVariantSelectMarkup()}
              </div>

              <div class="services-events-panel__mobile-field">
                <span class="services-events-panel__label">${escapeHtml(passengersLabel)}</span>
                ${buildMobilePassengerSelectMarkup()}
              </div>
            </div>
          </div>
        ` : `
          <div class="services-events-panel__date-field">
            <span class="services-events-panel__label">${escapeHtml(dateLabel)}</span>
            <div class="services-events-panel__date-options">
              ${buildDateOptionsMarkup(group)}
            </div>
          </div>

          <div class="services-events-panel__option-row">
            <div class="services-events-panel__variant-field">
              <span class="services-events-panel__label">${escapeHtml(variantLabel)}</span>
              <div class="services-events-panel__variant-options">
                ${buildVariantOptionsMarkup()}
              </div>
            </div>

            <div class="services-events-panel__passenger-field">
              <span class="services-events-panel__label">${escapeHtml(passengersLabel)}</span>
              <div class="services-events-panel__passenger-options">
                ${buildPassengerOptionsMarkup()}
              </div>
            </div>
          </div>
        `}

        ${buildAddressFieldMarkup()}

        ${buildContinueCtaMarkup()}
      </div>
    `;
  }

  function renderEmpty() {
    catalogMount.hidden = true;
    catalogMount.innerHTML = "";
    emptyMount.hidden = false;
    configMount.hidden = true;
    configMount.innerHTML = "";
  }

  function renderCatalog() {
    if (!state.groups.length) {
      renderEmpty();
      return;
    }

    catalogMount.innerHTML = state.groups.map(buildEventGroupCard).join("");
    catalogMount.setAttribute("data-services-events-count", String(state.groups.length));
    catalogMount.hidden = false;
    emptyMount.hidden = true;
  }

  function renderConfig() {
    const group = getSelectedGroup();

    if (!group) {
      destroyAddressControllers();
      configMount.hidden = true;
      configMount.innerHTML = "";
      return;
    }

    if (!state.selectedEventId && group.events[0]) {
      state.selectedEventId = group.events[0].id;
    }

    configMount.hidden = false;
    configMount.innerHTML = buildConfigMarkup();
    mountAddressControllers();
    renderQuoteStatus();
    requestQuoteIfReady();
  }

  function renderAll() {
    renderCatalog();
    renderConfig();
  }

  function renderConfigOnlyOnMobile() {
    if (window.innerWidth <= 720) {
      renderConfig();
      return true;
    }

    return false;
  }

  function selectGroup(groupId) {
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) return;

    state.selectedGroupId = group.id;
    state.selectedEventId = group.events[0] ? group.events[0].id : "";

    renderAll();
  }

  function selectEvent(eventId) {
    const group = getSelectedGroup();
    if (!group) return;

    const event = group.events.find((item) => item.id === eventId);
    if (!event) return;

    state.selectedEventId = event.id;

    if (renderConfigOnlyOnMobile()) {
      return;
    }

    renderAll();
  }
  
    function getRequestedEventFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return String(params.get("event") || "").trim();
    } catch (error) {
      return "";
    }
  }

  function findGroupByEventId(eventId) {
    const safeEventId = String(eventId || "").trim();

    if (!safeEventId) {
      return null;
    }

    return state.groups.find((group) => {
      return group.events.some((event) => event && event.id === safeEventId);
    }) || null;
  }

  function scrollEventGroupCardIntoView(groupId) {
    const safeGroupId = String(groupId || "").trim();
    let attempts = 0;
    const maxAttempts = 8;

    if (!safeGroupId) {
      return false;
    }

    function runScroll() {
      const card = catalogMount.querySelector(
        '[data-services-events-group="' + safeGroupId + '"]'
      );

      if (!card || typeof card.scrollIntoView !== "function") {
        attempts += 1;

        if (attempts < maxAttempts) {
          window.setTimeout(runScroll, 120);
        }

        return;
      }

      card.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runScroll);
    });

    return true;
  }

  function handleEventDeeplinkFocus() {
    const requestedEventId = getRequestedEventFromUrl();
    const targetGroup = findGroupByEventId(requestedEventId);

    if (!targetGroup) {
      return false;
    }

    return scrollEventGroupCardIntoView(targetGroup.id);
  }

  function selectEventFromExternalRequest(eventId) {
    const safeEventId = String(eventId || "").trim();
    let targetGroup = null;
    let targetEvent = null;

    if (!safeEventId) {
      return false;
    }

    state.groups.some((group) => {
      const event = group.events.find((item) => item && item.id === safeEventId);

      if (!event) {
        return false;
      }

      targetGroup = group;
      targetEvent = event;
      return true;
    });

    if (!targetGroup || !targetEvent) {
      return false;
    }

    state.selectedGroupId = targetGroup.id;
    state.selectedEventId = targetEvent.id;
    state.quoteStatus = "pending";
    state.quote = null;

    renderAll();

    return true;
  }
  
    function focusExpandedPanel() {
    if (!expandedPanel || expandedPanel.hidden) return;
    if (window.innerWidth <= 720) return;

    expandedPanel.setAttribute("tabindex", "-1");
    expandedPanel.focus({ preventScroll: true });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        expandedPanel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }
  
    function ensureConfigVisibleAfterGrowth() {
    if (!configMount || configMount.hidden) return;
    if (window.innerWidth <= 720) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const configRect = configMount.getBoundingClientRect();
        const bottomSafeOffset = 132;
        const bottomLimit = window.innerHeight - bottomSafeOffset;

        if (configRect.bottom <= bottomLimit) return;

        const delta = configRect.bottom - bottomLimit;
        const targetTop = Math.max(window.scrollY + delta + 18, 0);

        window.scrollTo({
          top: targetTop,
          behavior: "smooth"
        });
      });
    });
  }
  
  function syncTimeOverlay(input) {
    if (!input || typeof input.closest !== "function") return;

    const wrap = input.closest(".services-events-panel__date-wrap");
    const overlay = wrap ? wrap.querySelector(".services-events-panel__time-overlay") : null;

    if (!overlay) return;

    overlay.hidden = Boolean(input.value);
  }

  function syncReturnPickupLabel(input) {
    const field = getTimeFieldName(input);
    const dayOffset = field === "return" && state.returnPickupDayOffset === 1 ? "1" : "0";

    if (field !== "return" || !input || typeof input.setAttribute !== "function") {
      return false;
    }

    input.setAttribute("data-services-events-return-day-offset", dayOffset);
    input.setAttribute(
      "aria-label",
      dayOffset === "1"
        ? getReturnPickupTimeLabel() + " +1"
        : getReturnPickupTimeLabel()
    );

    return true;
  }

  function bindExpandedPanelObserver() {
    if (!expandedPanel || !("MutationObserver" in window)) return;

    const observer = new MutationObserver(() => {
      if (!expandedPanel.hidden) {
        focusExpandedPanel();
      }
    });

    observer.observe(expandedPanel, {
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden"]
    });
  }

  function bindEvents() {
    configMount.addEventListener("input", (event) => {
      const target = event.target;

      if (!isTimeFieldTarget(target)) return;

      handleTimeFieldInteraction(target);
    });
	
	    configMount.addEventListener("pointerdown", (event) => {
      const target = event.target;

      if (isTimeFieldTarget(target)) {
        setNativeTimePickerActive(target);
        return;
      }

      commitPendingNativeTimeValue();
    });

    configMount.addEventListener("focusin", (event) => {
      const target = event.target;

      if (isTimeFieldTarget(target)) {
        setNativeTimePickerActive(target);
      }
    });

    configMount.addEventListener("focusout", (event) => {
      const target = event.target;

      if (!isTimeFieldTarget(target)) {
        return;
      }

      window.setTimeout(() => {
        commitPendingNativeTimeValue();
      }, 0);
    });

    catalogMount.addEventListener("click", (event) => {
      const card = event.target.closest("[data-services-events-group]");
      if (!card) return;

      selectGroup(card.getAttribute("data-services-events-group") || "");
    });

    catalogMount.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      const card = event.target.closest("[data-services-events-group]");
      if (!card) return;

      event.preventDefault();
      selectGroup(card.getAttribute("data-services-events-group") || "");
    });

    configMount.addEventListener("change", (event) => {
      const target = event.target;

      if (!target || typeof target.matches !== "function") return;

      if (target.matches("[data-services-events-time]")) {
        handleTimeFieldInteraction(target);
        return;
      }

      if (target.matches("[data-services-events-mobile-date]")) {
        selectEvent(target.value || "");
        return;
      }

      if (target.matches("[data-services-events-mobile-variant]")) {
        const nextVariant = target.value || "";
        if (!nextVariant) return;

        state.selectedVariant = nextVariant;

        if (renderConfigOnlyOnMobile()) {
          return;
        }

        renderAll();
        ensureConfigVisibleAfterGrowth();
        return;
      }

      if (target.matches("[data-services-events-mobile-passengers]")) {
        const nextPassengerFareKey = target.value || "";
        if (!nextPassengerFareKey) return;

        state.selectedPassengerFareKey = nextPassengerFareKey;

        if (renderConfigOnlyOnMobile()) {
          return;
        }

        renderAll();
      }
    });

    configMount.addEventListener("click", (event) => {
      const continueButton = event.target.closest("[data-services-events-continue]");
      if (continueButton) {
        if (continueButton.disabled) {
          return;
        }

        dispatchContactHandoff();
        return;
      }

      const dateOption = event.target.closest("[data-services-events-date-option]");
      if (dateOption) {
        selectEvent(dateOption.getAttribute("data-services-events-date-option") || "");
        return;
      }

      const variantOption = event.target.closest("[data-services-events-variant-option]");
      if (variantOption) {
        const nextVariant = variantOption.getAttribute("data-services-events-variant-option") || "";
        if (!nextVariant) return;

        state.selectedVariant = nextVariant;

        if (renderConfigOnlyOnMobile()) {
          return;
        }

        renderAll();
        ensureConfigVisibleAfterGrowth();
        return;
      }

      const passengerOption = event.target.closest("[data-services-events-passenger-option]");
      if (passengerOption) {
        const nextPassengerFareKey = passengerOption.getAttribute("data-services-events-passenger-option") || "";
        if (!nextPassengerFareKey) return;

        state.selectedPassengerFareKey = nextPassengerFareKey;

        if (renderConfigOnlyOnMobile()) {
          return;
        }

        renderAll();
      }
    });
  }

  async function init() {
    try {
      const data = await loadData();

      state.venuesById = buildVenuesById(data.venues);
      state.pricing = data.pricing || {};
      state.groups = buildEventGroups(data.events, state.venuesById);

      if (state.selectedGroupId && !state.groups.some((group) => group.id === state.selectedGroupId)) {
        state.selectedGroupId = "";
        state.selectedEventId = "";
      }

      renderAll();
      handleEventDeeplinkFocus();
    } catch (error) {
      state.groups = [];
      state.selectedGroupId = "";
      state.selectedEventId = "";
      renderEmpty();
    }
  }

  bindEvents();
  bindExpandedPanelObserver();
  init();

  window.addEventListener("pixkuy:services-events-open", (event) => {
    const detail = event && event.detail && typeof event.detail === "object"
      ? event.detail
      : {};

    selectEventFromExternalRequest(detail.eventId);
  });

  window.addEventListener("pixkuy:i18n-applied", init);
})();