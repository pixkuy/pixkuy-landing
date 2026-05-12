/* assets/js/services/tours-mobile-booking-flow.js
   Tours mobile booking flow.
   Responsabilidad:
   - abrir tour_private como vista móvil dedicada tipo route
   - no tocar mobile-booking-entry.js
   - no tocar desktop
   - no tocar #contact
   - no usar la sábana legacy Tours como arquitectura principal
*/

(function initToursMobileBookingFlow(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const TOURS_HERO_LINK_SELECTOR = '.hero-mobile-entry__action[href*="service=tour_private"]';

  const BODY_FLOW_ATTR = "data-tours-mobile-flow";
  const BODY_SCREEN_ATTR = "data-tours-mobile-screen";

  const ROUTE_SELECTOR = "[data-tours-mobile-route]";
  const ROUTE_CONTENT_SELECTOR = "[data-tours-mobile-route-content]";
  const BACK_SELECTOR = "[data-tours-mobile-flow-back]";
  const STACK_SELECTOR = "[data-tours-mobile-stack]";
  const TOUR_CARD_SELECTOR = "[data-tours-mobile-tour]";

  const TOUR_IDS = [
    "teotihuacan",
    "teotihuacan_basilica",
    "xochimilco_coyoacan",
    "cholula_puebla",
    "san_miguel_allende"
  ];

  const TOUR_IMAGES = {
    teotihuacan: "assets/img/tours/teotihuacan_mobile.jpg",
    teotihuacan_basilica: "assets/img/tours/teotihuacan_basilica_mobile.jpg",
    xochimilco_coyoacan: "assets/img/tours/xochimilco_coyoacan_mobile.jpg",
    cholula_puebla: "assets/img/tours/cholula_puebla_mobile.jpg",
    san_miguel_allende: "assets/img/tours/san_miguel_allende_mobile.jpg"
  };

  const IN_MOTION_RETURN_CONTEXT_KEY = "pixkuy_in_motion_scroll_cinema_return";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let routeNode = null;
  let routeContent = null;
  let isRouteOpen = false;
  let inMotionReturnContext = null;
  let selectedTourId = TOUR_IDS[0];

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getTourText(tourId, field) {
    return getI18nValue(
      "services.cards.tours.panel.catalog." + tourId + "." + field,
      ""
    );
  }

  function getTourMeta(tourId) {
    return {
      id: tourId,
      title: getTourText(tourId, "title"),
      description: getTourText(tourId, "description"),
      duration: getTourText(tourId, "duration"),
      priceFrom: getTourText(tourId, "priceFrom"),
      imageAlt: getTourText(tourId, "imageAlt"),
      imageSrc: TOUR_IMAGES[tourId] || ""
    };
  }

  function buildTourCardMarkup(tourId) {
    const meta = getTourMeta(tourId);
    const isActive = selectedTourId === tourId;
    const priceFromLabel = getI18nValue(
      "services.cards.tours.panel.priceFromLabel",
      getI18nValue("services.cards.tours.priceLabel", "")
    );

    return [
      '<button type="button"',
      ' class="tours-mobile-stack-card' + (isActive ? ' is-active' : '') + '"',
      ' data-tours-mobile-tour="' + escapeHtml(tourId) + '"',
      ' aria-pressed="' + (isActive ? 'true' : 'false') + '">',
      '<span class="tours-mobile-stack-card__media">',
      '<img class="tours-mobile-stack-card__image"',
      ' src="' + escapeHtml(meta.imageSrc) + '"',
      ' alt="' + escapeHtml(meta.imageAlt) + '"',
      ' loading="lazy"',
      ' decoding="async" />',
      '</span>',
      '<span class="tours-mobile-stack-card__body">',
      '<span class="tours-mobile-stack-card__main">',
      '<strong class="tours-mobile-stack-card__title">' + escapeHtml(meta.title) + '</strong>',
      '<span class="tours-mobile-stack-card__duration">' + escapeHtml(meta.duration) + '</span>',
      '</span>',
      '<span class="tours-mobile-stack-card__price">',
      '<span class="tours-mobile-stack-card__price-label">' + escapeHtml(priceFromLabel) + '</span>',
      '<strong class="tours-mobile-stack-card__price-value">' + escapeHtml(meta.priceFrom) + '</strong>',
      '</span>',
      isActive
        ? '<span class="tours-mobile-stack-card__description">' + escapeHtml(meta.description) + '</span>'
        : '',
      isActive
        ? '<span class="cta tours-mobile-stack-card__action" data-tours-mobile-configure="' + escapeHtml(tourId) + '">' + escapeHtml(getI18nValue("airportMobileFlow.cta.continue", "Continuar")) + '</span>'
        : '',
      '</span>',
      '</button>'
    ].join("");
  }

  function renderTourStack() {
    const route = ensureRoute();
    const stack = route ? route.querySelector(STACK_SELECTOR) : null;

    if (!stack) {
      return false;
    }

    stack.innerHTML = TOUR_IDS.map(buildTourCardMarkup).join("");

    return true;
  }

  function selectTour(tourId) {
    if (TOUR_IDS.indexOf(tourId) === -1 || selectedTourId === tourId) {
      return false;
    }

    selectedTourId = tourId;
    renderTourStack();

    return true;
  }

  function getToursMobileConfigStepApi() {
    const api = window.PixkuyToursMobileConfigStep;

    return api && typeof api === "object" ? api : null;
  }
  
    function getTourFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const tourId = normalizeText(params.get("tour"));

      return TOUR_IDS.indexOf(tourId) !== -1 ? tourId : "";
    } catch (error) {
      return "";
    }
  }

  function getInMotionReturnContextFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const returnTo = normalizeText(params.get("return_to")).toLowerCase();

      if (returnTo !== "in_motion_scroll_cinema") {
        return null;
      }

      return {
        chapter: normalizeText(params.get("return_chapter")),
        time: normalizeText(params.get("return_time"))
      };
    } catch (error) {
      return null;
    }
  }

  function getStoredInMotionReturnContext() {
    try {
      const raw = window.sessionStorage.getItem(IN_MOTION_RETURN_CONTEXT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;

      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return {
        chapter: normalizeText(parsed.chapter),
        time: normalizeText(String(parsed.time || "")),
        scrollY: parsed.scrollY
      };
    } catch (error) {
      return null;
    }
  }

  function getResolvedInMotionReturnContext() {
    return (
      inMotionReturnContext ||
      getInMotionReturnContextFromUrl() ||
      getStoredInMotionReturnContext()
    );
  }

  function shouldReturnToInMotionScrollCinema() {
    return Boolean(getResolvedInMotionReturnContext());
  }

  function returnToInMotionScrollCinema() {
    const context = getResolvedInMotionReturnContext();
    const api = window.PixkuyInMotionScrollCinema;
    const target =
      document.querySelector("[data-in-motion-scroll-cinema]") ||
      document.querySelector("#pixkuy-in-motion");

    try {
      const url = new URL(window.location.href);

      url.searchParams.delete("service");
      url.searchParams.delete("step");
      url.searchParams.delete("tour");
      url.searchParams.delete("return_to");
      url.searchParams.delete("return_chapter");
      url.searchParams.delete("return_time");
      url.hash = "pixkuy-in-motion";

      window.history.replaceState(
        { inMotionScrollCinema: true },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}

    inMotionReturnContext = null;

    if (api && typeof api.returnTo === "function") {
      return api.returnTo(context || {});
    }

    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return true;
    }

    return false;
  }

  function pushToursConfigStepUrl(tourId) {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "tour_private");
      url.searchParams.set("step", "config");
      url.searchParams.set("tour", tourId);
      url.hash = "";

      window.history.pushState(
        {
          toursMobileRoute: true,
          toursMobileConfigStep: true,
          tourId: tourId
        },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}
  }

  function removeToursConfigStepFromUrl() {
    try {
      const url = new URL(window.location.href);

      url.searchParams.delete("step");
      url.searchParams.delete("tour");
      url.searchParams.set("service", "tour_private");
      url.hash = "";

      window.history.replaceState(
        {
          toursMobileRoute: true
        },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}
  }

  function isToursConfigStepOpen() {
    const configStep = getToursMobileConfigStepApi();

    return Boolean(
      configStep &&
      typeof configStep.isOpen === "function" &&
      configStep.isOpen()
    );
  }

  function closeToursConfigStep() {
    const configStep = getToursMobileConfigStepApi();

    if (configStep && typeof configStep.close === "function") {
      configStep.close();
      removeToursConfigStepFromUrl();
      return true;
    }

    return false;
  }

  function openToursConfigStep(tourId) {
    const configStep = getToursMobileConfigStepApi();

    if (!configStep || typeof configStep.open !== "function") {
      return false;
    }

    if (configStep.open(tourId)) {
      pushToursConfigStepUrl(tourId);
      return true;
    }

    return false;
  }

  function bindTourStack() {
    const route = ensureRoute();
    const stack = route ? route.querySelector(STACK_SELECTOR) : null;

    if (!stack || stack.dataset.toursMobileStackBound === "1") {
      return false;
    }

    stack.dataset.toursMobileStackBound = "1";

    stack.addEventListener("click", function onTourStackClick(event) {
      const card = event.target.closest(TOUR_CARD_SELECTOR);
      const tourId = card
        ? normalizeText(card.getAttribute("data-tours-mobile-tour"))
        : "";

      if (!tourId) {
        return;
      }

      if (event.target.closest("[data-tours-mobile-configure]")) {
        event.preventDefault();
        event.stopPropagation();
        openToursConfigStep(tourId);
        return;
      }

      runWithViewTransition(function updateSelectedTour() {
        selectTour(tourId);
      });
    });

    return true;
  }

  function buildRouteNode() {
    const route = document.createElement("section");
    const screen = document.createElement("div");
    const content = document.createElement("div");

    route.className = "tours-mobile-route";
    route.setAttribute("data-tours-mobile-route", "1");
    route.setAttribute("aria-hidden", "true");
    route.hidden = true;

    screen.className = "tours-mobile-route__screen";

    content.className = "tours-mobile-route__content";
    content.setAttribute("data-tours-mobile-route-content", "1");

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

    flow.className = "tours-mobile-flow";
    flow.setAttribute("data-tours-mobile-flow", "1");

    backRow.className = "tours-mobile-flow__back-row";

    back.type = "button";
    back.className = "tours-mobile-flow__back";
    back.setAttribute("data-tours-mobile-flow-back", "1");

    header.className = "tours-mobile-flow__header";

    title.className = "tours-mobile-flow__title";
    title.setAttribute("data-tours-mobile-flow-title", "1");

    helper.className = "tours-mobile-flow__helper";
    helper.setAttribute("data-tours-mobile-flow-helper", "1");

    stack.className = "tours-mobile-flow__stack";
    stack.setAttribute("data-tours-mobile-stack", "1");

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

    if (routeContent && !routeContent.querySelector("[data-tours-mobile-flow]")) {
      routeContent.appendChild(buildFlowNode());
    }

    return routeNode;
  }

  function syncCopy() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;
    const title = route ? route.querySelector("[data-tours-mobile-flow-title]") : null;
    const helper = route ? route.querySelector("[data-tours-mobile-flow-helper]") : null;

    const backText = getI18nValue(
      "services.cards.airport.panel.back",
      ""
    );
    const titleText = getI18nValue(
      "services.cards.tours.panel.title",
      getI18nValue("services.cards.tours.title", "")
    );
    const helperText = getI18nValue(
      "services.cards.tours.panel.text",
      getI18nValue("services.cards.tours.text", "")
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

    renderTourStack();

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


  function setRouteVisibility(isVisible) {
    ensureRoute();

    if (!routeNode) {
      return false;
    }

    if (!isVisible) {
      blurActiveElementInside(routeNode);
    }

    routeNode.hidden = !isVisible;
    routeNode.setAttribute("aria-hidden", isVisible ? "false" : "true");

    document.body.setAttribute(BODY_SCREEN_ATTR, isVisible ? "true" : "false");
    document.body.setAttribute(BODY_FLOW_ATTR, isVisible ? "true" : "false");

    isRouteOpen = isVisible;

    return true;
  }

  function openToursRoute() {
    const tourFromUrl = getTourFromUrl();

    if (!isMobileViewport()) {
      return false;
    }

    inMotionReturnContext = getResolvedInMotionReturnContext();

    if (tourFromUrl) {
      selectedTourId = tourFromUrl;
    }

    runWithViewTransition(function updateToursRoute() {
      ensureRoute();
      syncCopy();
      setRouteVisibility(true);
    });

    if (window.PixkuyAnalytics && typeof window.PixkuyAnalytics.track === "function") {
      window.PixkuyAnalytics.track("pixkuy_mobile_route_open", {
        service_type: "tour_private",
        flow_surface: "mobile_route",
        entry_point: "mobile_home_or_deeplink"
      });
    }

    return true;
  }

  function closeToursRoute(options) {
    const settings = options || {};
    const configStep = getToursMobileConfigStepApi();

    if (configStep && typeof configStep.close === "function") {
      configStep.close();
    }

    runWithViewTransition(function updateToursRouteClose() {
      setRouteVisibility(false);
    });

    if (settings.updateUrl === true) {
      removeToursServiceFromUrl();
    }

    return true;
  }
  
    function closeToursRouteForInMotionReturn() {
    const configStep = getToursMobileConfigStepApi();

    if (configStep && typeof configStep.close === "function") {
      configStep.close();
    }

    setRouteVisibility(false);

    return true;
  }

  function removeToursServiceFromUrl() {
    try {
      const url = new URL(window.location.href);
      const service = normalizeText(url.searchParams.get("service")).toLowerCase();

      if (service === "tour_private") {
        url.searchParams.delete("service");
      }

      if (url.hash === "#services") {
        url.hash = "";
      }

      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function pushToursRouteUrl() {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "tour_private");
      url.hash = "";

      window.history.pushState(
        { toursMobileRoute: true },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}
  }

  function bindBack() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;

    if (!back || back.dataset.toursMobileBackBound === "1") {
      return false;
    }

    back.dataset.toursMobileBackBound = "1";

    back.addEventListener("click", function onBackClick() {
      if (shouldReturnToInMotionScrollCinema()) {
        inMotionReturnContext = getResolvedInMotionReturnContext();

        closeToursRouteForInMotionReturn();

        window.requestAnimationFrame(function returnAfterToursClose() {
          returnToInMotionScrollCinema();
        });

        return;
      }
	  
      if (isToursConfigStepOpen()) {
        closeToursConfigStep();
        return;
      }

      closeToursRoute({ updateUrl: true });
    });

    return true;
  }

  function bindHeroEntry() {
    const link = document.querySelector(TOURS_HERO_LINK_SELECTOR);

    if (!link || link.dataset.toursMobileEntryBound === "1") {
      return false;
    }

    link.dataset.toursMobileEntryBound = "1";

    link.addEventListener("click", function onToursHeroClick(event) {
      if (!isMobileViewport()) {
        return;
      }

      event.preventDefault();

      if (openToursRoute()) {
        pushToursRouteUrl();
      }
    });

    return true;
  }

  function shouldOpenFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return normalizeText(params.get("service")).toLowerCase() === "tour_private";
    } catch (error) {
      return false;
    }
  }

  function syncActiveState() {
    if (!isMobileViewport()) {
      if (isRouteOpen) {
        closeToursRoute({ updateUrl: false });
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
    bindTourStack();
    renderTourStack();
    syncActiveState();

    if (isMobileViewport() && shouldOpenFromUrl()) {
      window.requestAnimationFrame(function openFromUrl() {
        openToursRoute();
      });
    }

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("hashchange", syncActiveState);
    window.addEventListener("popstate", function onPopState() {
      if (isRouteOpen && shouldReturnToInMotionScrollCinema()) {
        inMotionReturnContext = getResolvedInMotionReturnContext();

        closeToursRouteForInMotionReturn();

        window.requestAnimationFrame(function returnAfterToursClose() {
          returnToInMotionScrollCinema();
        });

        return;
      }

      if (isToursConfigStepOpen()) {
        closeToursConfigStep();
        return;
      }

      if (isRouteOpen) {
        closeToursRoute({ updateUrl: false });
        return;
      }

      syncActiveState();
    });
    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      syncCopy();
      syncActiveState();
    });

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncActiveState);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncActiveState);
    }

    return true;
  }

  window.PixkuyToursMobileBookingFlow = {
    open: openToursRoute,
    close: closeToursRoute,
    isOpen: function isOpen() {
      return isRouteOpen;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);