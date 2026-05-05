/* assets/js/services/events-mobile-booking-flow.js
   Events mobile booking flow.
   Responsabilidad:
   - abrir event_special como vista móvil dedicada tipo route
   - mostrar stack/lista real de eventos elegibles
   - usar textos desde services-events.json
   - no tocar desktop
   - no tocar #contact
   - no usar la sábana legacy Events como arquitectura principal
*/

(function initEventsMobileBookingFlow(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const EVENTS_HERO_LINK_SELECTOR = '.hero-mobile-entry__action[href*="service=event_special"]';

  const BODY_FLOW_ATTR = "data-events-mobile-flow";
  const BODY_SCREEN_ATTR = "data-events-mobile-screen";

  const ROUTE_SELECTOR = "[data-events-mobile-route]";
  const ROUTE_CONTENT_SELECTOR = "[data-events-mobile-route-content]";
  const BACK_SELECTOR = "[data-events-mobile-flow-back]";
  const STACK_SELECTOR = "[data-events-mobile-stack]";
  const EVENT_CARD_SELECTOR = "[data-events-mobile-event-group]";
  const CONTINUE_SELECTOR = "[data-events-mobile-continue]";

  const DATA_BASE = "assets/js/data";
  const MAX_VISIBLE_GROUPS = 10;
  const MIN_LEAD_HOURS = 6;
  const HORIZON_DAYS = 30;
  const CDMX_TIME_ZONE = "America/Mexico_City";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let routeNode = null;
  let routeContent = null;
  let isRouteOpen = false;
  let selectedGroupId = "";
  let groups = [];
  let venuesById = {};
  let pricing = {};
  let isLoading = false;
  let hasLoaded = false;

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

  function isDevHost() {
    if (typeof location === "undefined") {
      return false;
    }

    return (
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname.endsWith(".test")
    );
  }

  async function fetchJson(path) {
    const fetchOptions = isDevHost() ? { cache: "no-store" } : { cache: "default" };
    const response = await fetch(path, fetchOptions);

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " loading " + path);
    }

    return response.json();
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

  function isEventEligible(event, safeVenuesById) {
    const venue = event && event.venueId ? safeVenuesById[event.venueId] : null;
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
    const aFeatured = a && a.featured === true ? 0 : 1;
    const bFeatured = b && b.featured === true ? 0 : 1;
    const aMinutes = parseLocalDateTimeToMinutes(a && a.startsAt);
    const bMinutes = parseLocalDateTimeToMinutes(b && b.startsAt);

    if (aFeatured !== bFeatured) {
      return aFeatured - bFeatured;
    }

    if (aMinutes !== bMinutes) {
      return aMinutes - bMinutes;
    }

    return Number((a && a.priority) || 0) - Number((b && b.priority) || 0);
  }

  function sortGroups(a, b) {
    const aFeatured = a && a.featured === true ? 0 : 1;
    const bFeatured = b && b.featured === true ? 0 : 1;
    const aFirst = a && a.events && a.events[0]
      ? parseLocalDateTimeToMinutes(a.events[0].startsAt)
      : 0;
    const bFirst = b && b.events && b.events[0]
      ? parseLocalDateTimeToMinutes(b.events[0].startsAt)
      : 0;

    if (aFeatured !== bFeatured) {
      return aFeatured - bFeatured;
    }

    if (aFirst !== bFirst) {
      return aFirst - bFirst;
    }

    return Number((a && a.priority) || 0) - Number((b && b.priority) || 0);
  }

  function buildVenuesById(venues) {
    return venues.reduce(function reduceVenues(acc, venue) {
      if (venue && venue.id) {
        acc[venue.id] = venue;
      }

      return acc;
    }, {});
  }

  function buildEventGroups(events, safeVenuesById) {
    const groupsById = {};

    events
      .filter(function filterEligible(event) {
        return isEventEligible(event, safeVenuesById);
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
      getI18nValue("services.cards.events.types.other", "")
    );
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

  function getGroupDateSummary(group) {
    return group && Array.isArray(group.events)
      ? group.events.map(getEventDateLabel).filter(Boolean).join(" / ")
      : "";
  }

  function formatCurrency(value, currency) {
    const currencyCode = normalizeText(currency) || "MXN";

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(value) + " " + currencyCode;
    } catch (error) {
      return String(value) + " " + currencyCode;
    }
  }

  function getFromPrice() {
    const publicFromPrice = pricing && pricing.publicFromPrice ? pricing.publicFromPrice : {};
    const variants = pricing && pricing.variants ? pricing.variants : {};
    const passengerFactors = pricing && pricing.passengerFactors ? pricing.passengerFactors : {};
    const rounding = pricing && pricing.rounding ? pricing.rounding : {};
    const variantId = publicFromPrice.variant || "arrival";
    const passengerFareKey = publicFromPrice.passengerFareKey || "van_1_2";
    const variant = variants[variantId];
    const passengerFactor = passengerFactors[passengerFareKey];
    const minimum = variant && typeof variant.minimum === "number" ? variant.minimum : 0;
    const factor = passengerFactor && typeof passengerFactor.factor === "number"
      ? passengerFactor.factor
      : 1;
    const step = typeof rounding.step === "number" ? rounding.step : 50;

    if (!minimum) {
      return null;
    }

    return Math.ceil((minimum * factor) / step) * step;
  }

  async function loadEventsData() {
    const results = await Promise.all([
      fetchJson(DATA_BASE + "/events-special-venues.json"),
      fetchJson(DATA_BASE + "/events-special-catalog.json"),
      fetchJson(DATA_BASE + "/events-special-pricing.json")
    ]);
    const venues = Array.isArray(results[0].venues) ? results[0].venues : [];
    const events = Array.isArray(results[1].events) ? results[1].events : [];
    const loadedPricing = results[2] && typeof results[2] === "object" ? results[2] : {};
    const nextVenuesById = buildVenuesById(venues);

    venuesById = nextVenuesById;
    pricing = loadedPricing;
    groups = buildEventGroups(events, nextVenuesById);

    if (!selectedGroupId && groups[0]) {
      selectedGroupId = groups[0].id;
    }

    if (selectedGroupId && !groups.some(function hasSelectedGroup(group) {
      return group.id === selectedGroupId;
    })) {
      selectedGroupId = groups[0] ? groups[0].id : "";
    }

    hasLoaded = true;

    return true;
  }

  function getSelectedGroup() {
    return groups.find(function findGroup(group) {
      return group.id === selectedGroupId;
    }) || groups[0] || null;
  }

  function getSelectedEvent(group) {
    const safeGroup = group || getSelectedGroup();

    return safeGroup && safeGroup.events && safeGroup.events[0]
      ? safeGroup.events[0]
      : null;
  }

  function buildEventCardMarkup(group) {
    const isActive = group && group.id === selectedGroupId;
    const venue = group && group.venueId ? venuesById[group.venueId] : null;
    const title = getEventTitle(group);
    const type = getEventTypeLabel(group.type);
    const venueName = getVenueName(venue);
    const dateSummary = getGroupDateSummary(group);
    const fromPrice = getFromPrice();
    const fromLabel = getI18nValue("services.cards.events.panel.priceFromLabel", "");
    const ctaLabel = getI18nValue("services.cards.events.mobileFlow.continue", "");
    const posterAlt = getI18nValue("services.cards.events.panel.posterAlt", "");
    const poster = group.posterMobileSrc || group.posterSrc || "";

    return [
      '<button type="button"',
      ' class="events-mobile-stack-card' + (isActive ? ' is-active' : '') + '"',
      ' data-events-mobile-event-group="' + escapeHtml(group.id) + '"',
      ' aria-pressed="' + (isActive ? 'true' : 'false') + '">',
      '<span class="events-mobile-stack-card__media">',
      '<img class="events-mobile-stack-card__image"',
      ' src="' + escapeHtml(poster) + '"',
      ' alt="' + escapeHtml(posterAlt + ": " + title) + '"',
      ' loading="lazy"',
      ' decoding="async" />',
      '</span>',
      '<span class="events-mobile-stack-card__body">',
      '<span class="events-mobile-stack-card__main">',
      '<span class="events-mobile-stack-card__type">' + escapeHtml(type) + '</span>',
      '<strong class="events-mobile-stack-card__title">' + escapeHtml(title) + '</strong>',
      '<span class="events-mobile-stack-card__date">' + escapeHtml(dateSummary) + '</span>',
      '</span>',
      '<span class="events-mobile-stack-card__price">',
      '<span class="events-mobile-stack-card__price-label">' + escapeHtml(fromLabel) + '</span>',
      '<strong class="events-mobile-stack-card__price-value">' + escapeHtml(formatCurrency(fromPrice, pricing.currency || "MXN")) + '</strong>',
      '</span>',
      isActive
        ? '<span class="events-mobile-stack-card__venue">' + escapeHtml(venueName) + '</span>'
        : '',
      isActive
        ? '<span class="cta events-mobile-stack-card__action" data-events-mobile-continue="' + escapeHtml(group.id) + '">' + escapeHtml(ctaLabel) + '</span>'
        : '',
      '</span>',
      '</button>'
    ].join("");
  }

  function buildStackMarkup() {
    if (isLoading) {
      return [
        '<div class="events-mobile-flow__state">',
        escapeHtml(getI18nValue("services.cards.events.mobileFlow.loading", "")),
        '</div>'
      ].join("");
    }

    if (!groups.length) {
      return [
        '<div class="events-mobile-flow__state">',
        escapeHtml(getI18nValue("services.cards.events.mobileFlow.empty", "")),
        '</div>'
      ].join("");
    }

    return groups.map(buildEventCardMarkup).join("");
  }

  function renderStack() {
    const route = ensureRoute();
    const stack = route ? route.querySelector(STACK_SELECTOR) : null;

    if (!stack) {
      return false;
    }

    stack.innerHTML = buildStackMarkup();

    return true;
  }

  function selectGroup(groupId) {
    const safeGroupId = normalizeText(groupId);
    const group = groups.find(function findGroup(groupItem) {
      return groupItem.id === safeGroupId;
    });

    if (!group || selectedGroupId === group.id) {
      return false;
    }

    selectedGroupId = group.id;
    renderStack();

    return true;
  }

  function runWithViewTransition(update) {
    if (
      document &&
      typeof document.startViewTransition === "function" &&
      typeof update === "function"
    ) {
      document.startViewTransition(update);
      return true;
    }

    if (typeof update === "function") {
      update();
    }

    return false;
  }

  function getEventsMobileConfigStepApi() {
    const api = window.PixkuyEventsMobileConfigStep;

    return api && typeof api === "object" ? api : null;
  }

  function buildRouteNode() {
    const route = document.createElement("section");
    const screen = document.createElement("div");
    const content = document.createElement("div");

    route.className = "events-mobile-route";
    route.setAttribute("data-events-mobile-route", "1");
    route.setAttribute("aria-hidden", "true");
    route.hidden = true;

    screen.className = "events-mobile-route__screen";

    content.className = "events-mobile-route__content";
    content.setAttribute("data-events-mobile-route-content", "1");

    screen.appendChild(content);
    route.appendChild(screen);

    return route;
  }

  function buildFlowNode() {
    const flow = document.createElement("section");
    const backRow = document.createElement("div");
    const back = document.createElement("button");
    const header = document.createElement("div");
    const title = document.createElement("h3");
    const helper = document.createElement("p");
    const stack = document.createElement("div");

    flow.className = "events-mobile-flow";
    flow.setAttribute("data-events-mobile-flow", "1");

    backRow.className = "events-mobile-flow__back-row";

    back.type = "button";
    back.className = "events-mobile-flow__back";
    back.setAttribute("data-events-mobile-flow-back", "1");

    header.className = "events-mobile-flow__header";

    title.className = "events-mobile-flow__title";
    title.setAttribute("data-events-mobile-flow-title", "1");

    helper.className = "events-mobile-flow__helper";
    helper.setAttribute("data-events-mobile-flow-helper", "1");

    stack.className = "events-mobile-flow__stack";
    stack.setAttribute("data-events-mobile-stack", "1");

    backRow.appendChild(back);
    header.appendChild(title);
    header.appendChild(helper);

    flow.appendChild(backRow);
    flow.appendChild(header);
    flow.appendChild(stack);

    return flow;
  }

  function ensureRoute() {
    if (routeNode && routeContent) {
      return routeNode;
    }

    routeNode = document.querySelector(ROUTE_SELECTOR);

    if (!routeNode) {
      routeNode = buildRouteNode();
      document.body.appendChild(routeNode);
    }

    routeContent = routeNode.querySelector(ROUTE_CONTENT_SELECTOR);

    if (routeContent && !routeContent.querySelector("[data-events-mobile-flow]")) {
      routeContent.appendChild(buildFlowNode());
    }

    return routeNode;
  }

  function syncCopy() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;
    const title = route ? route.querySelector("[data-events-mobile-flow-title]") : null;
    const helper = route ? route.querySelector("[data-events-mobile-flow-helper]") : null;

    const backText = getI18nValue(
      "services.cards.events.mobileFlow.back",
      ""
    );
    const titleText = getI18nValue(
      "services.cards.events.mobileFlow.title",
      getI18nValue("services.cards.events.panel.title", "")
    );
    const helperText = getI18nValue(
      "services.cards.events.panel.intro",
      getI18nValue("services.cards.events.text", "")
    );

    if (back && backText) {
      back.textContent = backText;
    }

    if (title && titleText) {
      title.textContent = titleText;
    }

    if (helper && helperText) {
      helper.textContent = helperText;
    }

    renderStack();

    return true;
  }

  function setRouteVisibility(isVisible) {
    ensureRoute();

    if (!routeNode) {
      return false;
    }

    routeNode.hidden = !isVisible;
    routeNode.setAttribute("aria-hidden", isVisible ? "false" : "true");

    document.body.setAttribute(BODY_SCREEN_ATTR, isVisible ? "true" : "false");
    document.body.setAttribute(BODY_FLOW_ATTR, isVisible ? "true" : "false");

    isRouteOpen = isVisible;

    return true;
  }

  async function ensureDataLoaded() {
    if (hasLoaded || isLoading) {
      return hasLoaded;
    }

    isLoading = true;
    renderStack();

    try {
      await loadEventsData();
    } catch (error) {
      groups = [];
      selectedGroupId = "";
    }

    isLoading = false;
    renderStack();

    return hasLoaded;
  }

  async function openEventsRoute() {
    if (!isMobileViewport()) {
      return false;
    }

    ensureRoute();
    syncCopy();

    runWithViewTransition(function updateEventsRoute() {
      setRouteVisibility(true);
    });

    await ensureDataLoaded();
    syncCopy();

    return true;
  }

  function closeEventsRoute(options) {
    const settings = options || {};
    const configStep = getEventsMobileConfigStepApi();

    if (configStep && typeof configStep.close === "function") {
      configStep.close();
    }

    runWithViewTransition(function updateEventsRouteClose() {
      setRouteVisibility(false);
    });

    if (settings.updateUrl === true) {
      removeEventsServiceFromUrl();
    }

    return true;
  }

  function removeEventsServiceFromUrl() {
    try {
      const url = new URL(window.location.href);
      const service = normalizeText(url.searchParams.get("service")).toLowerCase();

      if (service === "event_special") {
        url.searchParams.delete("service");
      }

      if (url.hash === "#services") {
        url.hash = "";
      }

      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function pushEventsRouteUrl() {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "event_special");
      url.hash = "";

      window.history.pushState(
        { eventsMobileRoute: true },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}
  }

  function openLegacyEventsConfig(groupId) {
    const group = groups.find(function findGroup(groupItem) {
      return groupItem.id === groupId;
    });
    const event = getSelectedEvent(group);
    const servicesSection = document.getElementById("services");
    const eventsTrigger = document.querySelector('[data-service-expand-trigger="events"]');

    if (!group || !event || !event.id) {
      return false;
    }

    closeEventsRoute({ updateUrl: false });

    if (servicesSection && typeof servicesSection.scrollIntoView === "function") {
      servicesSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    if (
      eventsTrigger &&
      eventsTrigger.getAttribute("aria-expanded") !== "true" &&
      typeof eventsTrigger.click === "function"
    ) {
      eventsTrigger.click();
    }

    window.dispatchEvent(
      new CustomEvent("pixkuy:services-events-open", {
        detail: {
          eventId: event.id,
          source: "events_mobile_route"
        }
      })
    );

    window.requestAnimationFrame(function retryAfterFrame() {
      window.requestAnimationFrame(function retryAfterSecondFrame() {
        window.dispatchEvent(
          new CustomEvent("pixkuy:services-events-open", {
            detail: {
              eventId: event.id,
              source: "events_mobile_route"
            }
          })
        );
      });
    });

    return true;
  }

  function openEventsConfigStep(groupId) {
    const group = groups.find(function findGroup(groupItem) {
      return groupItem.id === groupId;
    });
    const configStep = getEventsMobileConfigStepApi();
    const venue = group && group.venueId ? venuesById[group.venueId] : null;

    if (!group) {
      return false;
    }

    if (!configStep || typeof configStep.open !== "function") {
      return openLegacyEventsConfig(groupId);
    }

    return configStep.open(routeNode, {
      group,
      venueName: getVenueName(venue),
      pricing
    });
  }

  function bindStack() {
    const route = ensureRoute();
    const stack = route ? route.querySelector(STACK_SELECTOR) : null;

    if (!stack || stack.dataset.eventsMobileStackBound === "1") {
      return false;
    }

    stack.dataset.eventsMobileStackBound = "1";

    stack.addEventListener("click", function onEventsStackClick(event) {
      const continueButton = event.target.closest(CONTINUE_SELECTOR);
      const card = event.target.closest(EVENT_CARD_SELECTOR);
      const groupId = card
        ? normalizeText(card.getAttribute("data-events-mobile-event-group"))
        : "";

      if (!groupId) {
        return;
      }

      if (continueButton) {
        event.preventDefault();
        event.stopPropagation();
        openEventsConfigStep(groupId);
        return;
      }

      runWithViewTransition(function updateSelectedEvent() {
        selectGroup(groupId);
      });
    });

    return true;
  }

  function bindBack() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;

    if (!back || back.dataset.eventsMobileBackBound === "1") {
      return false;
    }

    back.dataset.eventsMobileBackBound = "1";

    back.addEventListener("click", function onBackClick() {
      closeEventsRoute({ updateUrl: true });
    });

    return true;
  }

  function bindHeroEntry() {
    const link = document.querySelector(EVENTS_HERO_LINK_SELECTOR);

    if (!link || link.dataset.eventsMobileEntryBound === "1") {
      return false;
    }

    link.dataset.eventsMobileEntryBound = "1";

    link.addEventListener("click", function onEventsHeroClick(event) {
      if (!isMobileViewport()) {
        return;
      }

      event.preventDefault();

      openEventsRoute().then(function afterOpen(opened) {
        if (opened !== false) {
          pushEventsRouteUrl();
        }
      });
    });

    return true;
  }

  function shouldOpenFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const service = normalizeText(params.get("service")).toLowerCase();
      const eventId = normalizeText(params.get("event"));

      return service === "event_special" && !eventId;
    } catch (error) {
      return false;
    }
  }

  function syncActiveState() {
    if (!isMobileViewport()) {
      if (isRouteOpen) {
        closeEventsRoute({ updateUrl: false });
      }

      return false;
    }

    if (isRouteOpen) {
      syncCopy();
    }

    return true;
  }

  function init() {
    ensureRoute();
    bindBack();
    bindHeroEntry();
    bindStack();
    renderStack();
    syncActiveState();

    if (isMobileViewport() && shouldOpenFromUrl()) {
      window.requestAnimationFrame(function openFromUrl() {
        openEventsRoute();
      });
    }

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("hashchange", syncActiveState);

    window.addEventListener("popstate", function onPopState() {
      if (isRouteOpen) {
        closeEventsRoute({ updateUrl: false });
        return;
      }

      syncActiveState();
    });

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      hasLoaded = false;
      isLoading = false;

      if (isRouteOpen) {
        ensureDataLoaded().then(function syncAfterI18n() {
          syncCopy();
        });
      }
    });

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncActiveState);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncActiveState);
    }

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);