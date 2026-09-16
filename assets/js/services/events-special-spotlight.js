/* assets/js/services/events-special-spotlight.js
   Event Spotlight flotante global.
   Módulo aislado: consume catálogo Events, pinta una tarjeta no modal y emite contratos desacoplados.
*/

(function () {
  "use strict";

  const MIN_LEAD_HOURS = 6;
  const SESSION_EVENT_KEY = "pixkuy_events_spotlight_event_id";
  const SHOW_DELAY_MS = 3250;
  const MOBILE_QUERY = "(max-width: 720px)";

  let hasInitialized = false;
  let wasManuallyDismissed = false;
  let hasBoundVisibilityListeners = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getI18nValue(path) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = path ? String(path).split(".") : [];
    let cursor = dict;
    let index;

    if (!path) {
      return "";
    }

    if (typeof getValue === "function" && dict) {
      return getValue(dict, path) || "";
    }

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor.trim() : "";
  }

  function getSessionValue(key) {
    try {
      return window.sessionStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function setSessionValue(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getEventStartTime(event) {
    const timestamp = Date.parse(event && event.startsAtUtc);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function buildVenuesById(venues) {
    return venues.reduce(function reduceVenues(acc, venue) {
      if (venue && venue.id) {
        acc[venue.id] = venue;
      }

      return acc;
    }, {});
  }

  function isEventEligible(event, venuesById) {
    const venue = event && event.venueId ? venuesById[event.venueId] : null;
    const eventStartTime = getEventStartTime(event);
    return Boolean(
      event &&
        event.active === true &&
        event.startsAtUtc &&
        event.posterSrc &&
        venue &&
        venue.active === true &&
        eventStartTime !== null &&
        eventStartTime >= Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000
    );
  }

  function sortEvents(a, b) {
    const aFeatured = a && a.featured === true ? 0 : 1;
    const bFeatured = b && b.featured === true ? 0 : 1;
    const aMinutes = getEventStartTime(a) ?? Number.MAX_SAFE_INTEGER;
    const bMinutes = getEventStartTime(b) ?? Number.MAX_SAFE_INTEGER;

    if (aFeatured !== bFeatured) {
      return aFeatured - bFeatured;
    }

    const priorityDelta = Number((a && a.priority) || 0) - Number((b && b.priority) || 0);
    return priorityDelta !== 0 ? priorityDelta : aMinutes - bMinutes;
  }

  function getEventTitle(event) {
    return String((event && event.title) || "").trim() || getI18nValue(event && event.titleKey) || "";
  }

  function getEventDateLabel(event) {
    return String((event && event.dateLabel) || "").trim() || getI18nValue(event && event.dateLabelKey) || "";
  }

  function getEventGroupId(event) {
    return event && (event.eventGroupId || event.id) ? String(event.eventGroupId || event.id).trim() : "";
  }

  function getEventGroupItems(event, events) {
    const groupId = getEventGroupId(event);

    if (!groupId || !Array.isArray(events)) {
      return event ? [event] : [];
    }

    return events
      .filter(function filterGroupItem(item) {
        return getEventGroupId(item) === groupId;
      })
      .sort(sortEvents);
  }

  function formatCompactDateList(values) {
    if (!values.length) {
      return "";
    }

    if (values.length === 1) {
      return values[0];
    }

    if (values.length === 2) {
      return values[0] + " y " + values[1];
    }

    return values.slice(0, -1).join(", ") + " y " + values[values.length - 1];
  }

  function parseEventDateParts(event) {
    const raw = String((event && event.startsAt) || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) {
      return null;
    }

    return {
      year: match[1],
      month: match[2],
      day: String(Number(match[3])),
      time: match[4] + ":" + match[5],
      date: new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0))
    };
  }

  function getCompactEventGroupDateSummary(event, events) {
    const currentLang = String(window.__pixkuyI18nLang || "es").toLowerCase();
    const items = getEventGroupItems(event, events);
    const parts = items
      .map(parseEventDateParts)
      .filter(Boolean);

    if (currentLang !== "es") {
      return "";
    }
    const first = parts[0];
    const sameMonthAndTime = Boolean(
      first &&
        parts.length &&
        parts.every(function hasSameMonthAndTime(part) {
          return part.year === first.year &&
            part.month === first.month &&
            part.time === first.time;
        })
    );
    let monthLabel;

    if (!sameMonthAndTime) {
      return "";
    }

    monthLabel = new Intl.DateTimeFormat("es-MX", {
      month: "long"
    }).format(first.date);

    return formatCompactDateList(parts.map(function mapDay(part) {
      return part.day;
    })) + " de " + monthLabel + " · " + first.time;
  }

  function getEventGroupDateSummary(event, events) {
    const compact = getCompactEventGroupDateSummary(event, events);
    const items = getEventGroupItems(event, events);
    const labels = items
      .map(function mapDateLabel(item) {
        return getEventDateLabel(item);
      })
      .filter(Boolean);

    return compact || labels.join(" / ");
  }

  function getVenueName(event, venuesById) {
    const venue = event && event.venueId ? venuesById[event.venueId] : null;

    return String((event && event.venueName) || "").trim() ||
      String((venue && venue.name) || "").trim() ||
      getI18nValue(venue && venue.nameKey) ||
      "";
  }

  function getEventImage(event) {
    if (
      window.matchMedia &&
      window.matchMedia(MOBILE_QUERY).matches &&
      event.posterMobileSrc
    ) {
      return event.posterMobileSrc;
    }

    return event.posterSrc || event.posterMobileSrc || "";
  }

  async function loadEventsData() {
    const source = window.PixkuyServicesEventsCatalogSource;

    if (!source || typeof source.loadCatalog !== "function") {
      throw new Error("SPECIAL_EVENT_CATALOG_SOURCE_UNAVAILABLE");
    }

    return source.loadCatalog();
  }

  function pickSpotlightEvent(events, venuesById) {
    const eligible = events
      .filter(function filterEligible(event) {
        return isEventEligible(event, venuesById);
      })
      .sort(sortEvents);
    const previousEventId = getSessionValue(SESSION_EVENT_KEY);
    const featured = eligible.filter(function filterFeatured(event) {
      return event.featured === true;
    });
    const pool = featured;
    const withoutPrevious = pool.filter(function filterPrevious(event) {
      return event.id !== previousEventId;
    });
    const candidates = withoutPrevious.length ? withoutPrevious : pool;
    const index = candidates.length > 1
      ? Math.floor(Math.random() * candidates.length)
      : 0;
    const selectedEvent = candidates[index] || null;

    if (selectedEvent && selectedEvent.id) {
      setSessionValue(SESSION_EVENT_KEY, selectedEvent.id);
    }

    return selectedEvent;
  }

  function removeExistingSpotlight() {
    const existing = document.querySelector("[data-events-special-spotlight]");

    if (existing) {
      existing.remove();
    }
  }

  function getSpotlightRoot() {
    return document.querySelector("[data-events-special-spotlight]");
  }

  function isContactInViewport() {
    const contact = document.getElementById("contact");
    let rect;

    if (!contact || typeof contact.getBoundingClientRect !== "function") {
      return false;
    }

    rect = contact.getBoundingClientRect();

    return rect.top < window.innerHeight * 0.72 && rect.bottom > window.innerHeight * 0.18;
  }

  function isEventsPanelOpen() {
    const eventsPanel = document.getElementById("services-expand-events");
    const servicesExpand = document.getElementById("services-expand");

    return Boolean(
      eventsPanel &&
        servicesExpand &&
        !eventsPanel.hidden &&
        !servicesExpand.hidden &&
        eventsPanel.getAttribute("aria-hidden") !== "true" &&
        servicesExpand.getAttribute("aria-hidden") !== "true"
    );
  }

  function syncSpotlightVisibility() {
    const root = getSpotlightRoot();

    if (!root || wasManuallyDismissed) {
      return false;
    }

    root.hidden =
      shouldHoldMobileSpotlightUntilHeroPassed() ||
      isContactInViewport() ||
      isEventsPanelOpen();

    return true;
  }

  function dismissSpotlight(root) {
    wasManuallyDismissed = true;

    if (root) {
      root.remove();
    }
  }

  function isMobileViewport() {
    return Boolean(window.matchMedia && window.matchMedia(MOBILE_QUERY).matches);
  }

  function shouldHoldMobileSpotlightUntilHeroPassed() {
    const hero = document.querySelector(".screen.hero");
    let rect;

    if (!isMobileViewport()) {
      return false;
    }

    if (!hero || typeof hero.getBoundingClientRect !== "function") {
      return false;
    }

    rect = hero.getBoundingClientRect();

    return rect.bottom > 0;
  }

  function scrollEventsTargetIntoView() {
    const eventsPanel = document.getElementById("services-expand-events");
    const eventsTrigger = document.querySelector('[data-service-expand-trigger="events"]');
    const target = eventsPanel && !eventsPanel.hidden ? eventsPanel : eventsTrigger;

    if (!target || typeof target.getBoundingClientRect !== "function") {
      return false;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const targetTop = Math.max(window.scrollY + rect.top - 12, 0);

        window.scrollTo({
          top: targetTop,
          behavior: "smooth"
        });
      });
    });

    return true;
  }

  function dispatchEventsOpenRequest(eventId) {
    window.dispatchEvent(
      new CustomEvent("pixkuy:services-events-open", {
        detail: {
          eventId: eventId,
          source: "events_spotlight"
        }
      })
    );
  }

  function openEventsForEvent(eventId) {
    const safeEventId = String(eventId || "").trim();
    const servicesSection = document.getElementById("services");
    const eventsTrigger = document.querySelector('[data-service-expand-trigger="events"]');

    if (!safeEventId) {
      return false;
    }

    if (!isMobileViewport() && servicesSection && typeof servicesSection.scrollIntoView === "function") {
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

    dispatchEventsOpenRequest(safeEventId);

    window.requestAnimationFrame(function retryAfterFirstRenderFrame() {
      window.requestAnimationFrame(function retryAfterSecondRenderFrame() {
        dispatchEventsOpenRequest(safeEventId);

        if (isMobileViewport()) {
          scrollEventsTargetIntoView();
        }
      });
    });

    window.setTimeout(function retryAfterPanelAnimation() {
      dispatchEventsOpenRequest(safeEventId);

      if (isMobileViewport()) {
        scrollEventsTargetIntoView();
      }
    }, 260);

    return true;
  }

  function buildSpotlightMarkup(event, venuesById, events) {
    const packages = event?.offerKind === "packages" ? window.PixkuyEventPackagesConfig : null;
    const label = packages ? packages.t("title") : getI18nValue("services.cards.events.spotlight.label");
    const cta = packages ? packages.t("choose") : getI18nValue("services.cards.events.spotlight.cta");
    const close = packages ? packages.t("close") : getI18nValue("services.cards.events.spotlight.close");
    const metaFallback = getI18nValue("services.cards.events.spotlight.metaFallback");
    const title = packages ? packages.eventTitle(event) : getEventTitle(event);
    const dateLabel = packages ? packages.eventDates(event) : getEventGroupDateSummary(event, events);
    const venueName = packages ? packages.eventVenue(event) : getVenueName(event, venuesById);
    // Package catalog snapshots contain published media, never Admin draft previews.
    const image = getEventImage(packages ? { posterSrc: event.snapshot.media?.main?.url } : event);
    const meta = dateLabel || metaFallback;

    if (!event || !event.id || !title || !image || !label || !cta || !close) {
      return "";
    }

    return (
      '<aside class="events-special-spotlight" data-events-special-spotlight hidden>' +
        '<div class="events-special-spotlight__inner">' +
          '<div class="events-special-spotlight__media">' +
            '<img' +
              ' class="events-special-spotlight__image"' +
              ' src="' + escapeHtml(image) + '"' +
              ' alt="' + escapeHtml(title) + '"' +
              ' loading="lazy"' +
              ' decoding="async"' +
            ' />' +
          "</div>" +

          '<div class="events-special-spotlight__body">' +
            '<div class="events-special-spotlight__top">' +
              '<p class="events-special-spotlight__label">' + escapeHtml(label) + "</p>" +
              '<button' +
                ' type="button"' +
                ' class="events-special-spotlight__close"' +
                ' data-events-special-spotlight-close' +
                ' aria-label="' + escapeHtml(close) + '"' +
              '>' +
                '<span aria-hidden="true">×</span>' +
              "</button>" +
            "</div>" +

            '<h3 class="events-special-spotlight__title">' + escapeHtml(title) + "</h3>" +
            '<p class="events-special-spotlight__meta">' + escapeHtml(meta) + "</p>" +
            (venueName ? '<p class="events-special-spotlight__venue">' + escapeHtml(venueName) + "</p>" : "") +

            '<button' +
              ' type="button"' +
              ' class="events-special-spotlight__cta"' +
              ' data-events-special-spotlight-cta' +
              ' data-events-special-spotlight-event-id="' + escapeHtml(event.id) + '"' +
            ">" +
              escapeHtml(cta) +
            "</button>" +
          "</div>" +
        "</div>" +
      "</aside>"
    );
  }

  function mountSpotlight(event, venuesById, events, options) {
    const wrapper = document.createElement("div");
    let root;

    removeExistingSpotlight();

    wrapper.innerHTML = buildSpotlightMarkup(event, venuesById, events);
    root = wrapper.firstElementChild;

    if (!root) {
      return false;
    }

    if (event.offerKind === "packages") {
      root.querySelector("img").addEventListener("error", () => root.remove(), { once: true });
    }

    root.addEventListener("click", function handleSpotlightClick(clickEvent) {
      const closeButton = clickEvent.target.closest("[data-events-special-spotlight-close]");
      const ctaButton = clickEvent.target.closest("[data-events-special-spotlight-cta]");

      if (closeButton) {
        dismissSpotlight(root);
        return;
      }

      if (ctaButton) {
        if (event.offerKind === "packages" && window.PixkuyEventPackagesConfig) {
          void window.PixkuyEventPackagesConfig.open(event.id);
          dismissSpotlight(root);
          return;
        }
        openEventsForEvent(ctaButton.getAttribute("data-events-special-spotlight-event-id") || "");
        dismissSpotlight(root);
      }
    });

    document.body.appendChild(root);

    if (!hasBoundVisibilityListeners) {
      window.addEventListener("scroll", syncSpotlightVisibility, { passive: true });
      window.addEventListener("resize", syncSpotlightVisibility);
      hasBoundVisibilityListeners = true;
    }

    if (options && options.showImmediately === true) {
      window.requestAnimationFrame(function deferImmediateVisibilitySync() {
        window.requestAnimationFrame(function runImmediateVisibilitySync() {
          if (!document.body.contains(root) || wasManuallyDismissed) {
            return;
          }

          syncSpotlightVisibility();
        });
      });

      return true;
    }

    window.setTimeout(function showSpotlight() {
      if (!document.body.contains(root) || wasManuallyDismissed) {
        return;
      }

      syncSpotlightVisibility();
    }, SHOW_DELAY_MS);

    return true;
  }

  async function initEventsSpecialSpotlight() {
    let data;
    let venuesById;
    let selectedEvent;

    if (hasInitialized) {
      return false;
    }

    hasInitialized = true;

    try {
      if (window.PixkuyEventPackagesApi && window.PixkuyEventPackagesConfig) {
        const packageCatalog = await window.PixkuyEventPackagesApi.load().catch(() => null);
        const featured = packageCatalog && packageCatalog.events.find(item => item.snapshot.featured);
        if (featured) return mountSpotlight(featured, {}, []);
      }
      data = await loadEventsData();
      venuesById = buildVenuesById(data.venues);
      selectedEvent = pickSpotlightEvent(data.events, venuesById);

      if (!selectedEvent) {
        return false;
      }

      return mountSpotlight(selectedEvent, venuesById, data.events);
    } catch (error) {
      return false;
    }
  }

  function refreshSpotlightAfterI18n() {
    if (wasManuallyDismissed) {
      return false;
    }

    hasInitialized = false;
    return initEventsSpecialSpotlight();
  }

  window.PixkuyServicesEventsSpotlight = {
    init: initEventsSpecialSpotlight,
    refresh: refreshSpotlightAfterI18n
  };

  window.addEventListener("pixkuy:i18n-applied", refreshSpotlightAfterI18n);

  if (window.__pixkuyI18nDict) {
    initEventsSpecialSpotlight();
  }
})();
