/* assets/js/services/mobile-topbar-menu.js
   Mobile topbar menu.
   Responsabilidad:
   - abrir/cerrar navegación global móvil tipo bottom sheet
   - coordinar navegación con routes móviles existentes mediante APIs públicas
   - no tocar motores de reservas, pricing, Places, formularios ni desktop
*/

(function initMobileTopbarMenu(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const BODY_OPEN_ATTR = "data-mobile-topbar-menu-open";

  const ROOT_SELECTOR = "[data-mobile-topbar-menu]";
  const TRIGGER_SELECTOR = "[data-mobile-topbar-menu-trigger]";
  const PANEL_SELECTOR = "[data-mobile-topbar-menu-panel]";
  const DISMISS_SELECTOR = "[data-mobile-topbar-menu-dismiss]";
  const ACTION_SELECTOR = "[data-mobile-topbar-menu-action]";

  const ROUTES = {
    airport: {
      service: "airport_hotel",
      stateKey: "airportMobileRoute",
      apiName: "PixkuyAirportMobileBookingFlow"
    },
    hourly: {
      service: "hourly_daily",
      stateKey: "hourlyMobileRoute",
      apiName: "PixkuyHourlyMobileBookingFlow"
    },
    direct: {
      service: "direct_transfer",
      stateKey: "directTransferMobileRoute",
      apiName: "PixkuyDirectTransferMobileBookingFlow"
    },
    tours: {
      service: "tour_private",
      stateKey: "toursMobileRoute",
      apiName: "PixkuyToursMobileBookingFlow"
    },
    events: {
      service: "event_special",
      stateKey: "eventsMobileRoute",
      apiName: "PixkuyEventsMobileBookingFlow"
    }
  };
  
  const SCREENS = {
    chauffeurs: {
      apiName: "PixkuyChauffeursMobileScreen"
    }
  };

  const ANCHORS = {
    inMotion: "pixkuy-in-motion",
    brands: "brand-collaborations",
    fleet: "fleet"
  };

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
  let previousFocus = null;
  let isBound = false;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function isReducedMotion() {
    return Boolean(
      window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function getRoot() {
    return document.querySelector(ROOT_SELECTOR);
  }

  function getTrigger() {
    return document.querySelector(TRIGGER_SELECTOR);
  }

  function getPanel() {
    const root = getRoot();

    return root ? root.querySelector(PANEL_SELECTOR) : null;
  }

  function isOpen() {
    const root = getRoot();

    return Boolean(
      root &&
        root.hidden !== true &&
        root.getAttribute("aria-hidden") === "false"
    );
  }

  function isContactSuccessModalOpen() {
    const modal = document.querySelector("[data-contact-success-modal]");

    return Boolean(
      modal &&
        modal.hidden !== true &&
        modal.getAttribute("aria-hidden") === "false"
    );
  }

  function getFocusableNodes() {
    const panel = getPanel();

    if (!panel) {
      return [];
    }

    return Array.from(
      panel.querySelectorAll(
        [
          "a[href]",
          "button:not([disabled])",
          "[tabindex]:not([tabindex='-1'])"
        ].join(",")
      )
    ).filter(function filterVisible(node) {
      return Boolean(
        node &&
          node.getClientRects().length > 0 &&
          node.getAttribute("aria-hidden") !== "true"
      );
    });
  }

  function focusFirstItem() {
    const panel = getPanel();
    const nodes = getFocusableNodes();
    const first = nodes[0] || panel;

    if (first && typeof first.focus === "function") {
      first.focus();
    }
  }

  function focusTrigger() {
    const trigger = getTrigger();

    if (trigger && typeof trigger.focus === "function") {
      trigger.focus();
    }
  }

  function closeLanguageSelector() {
    const modules = window.__pixkuyI18nModules || {};
    const langDom = typeof modules.getLangDom === "function"
      ? modules.getLangDom()
      : null;
    const trigger = document.getElementById("lang-trigger");

    if (
      langDom &&
      typeof modules.setMenuOpen === "function" &&
      langDom.trigger &&
      langDom.trigger.getAttribute("aria-expanded") === "true"
    ) {
      modules.setMenuOpen(langDom, false);
      return true;
    }

    if (trigger && trigger.getAttribute("aria-expanded") === "true") {
      trigger.click();
      return true;
    }

    return false;
  }

  function setOpen(nextOpen) {
    const root = getRoot();
    const trigger = getTrigger();

    if (!root || !trigger) {
      return false;
    }

    if (nextOpen && (!isMobileViewport() || isContactSuccessModalOpen())) {
      return false;
    }

    if (nextOpen) {
      closeLanguageSelector();
      previousFocus = document.activeElement;
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      trigger.setAttribute("aria-expanded", "true");
      document.body.setAttribute(BODY_OPEN_ATTR, "true");

      window.requestAnimationFrame(focusFirstItem);
      return true;
    }

    if (root.contains(document.activeElement) && document.activeElement.blur) {
      document.activeElement.blur();
    }

    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
    document.body.setAttribute(BODY_OPEN_ATTR, "false");

    if (
      previousFocus &&
      typeof previousFocus.focus === "function" &&
      document.contains(previousFocus)
    ) {
      previousFocus.focus();
    }

    previousFocus = null;
    return true;
  }

  function openMenu() {
    return setOpen(true);
  }

  function closeMenu() {
    return setOpen(false);
  }

  function getRouteApi(route) {
    const api = route && route.apiName ? window[route.apiName] : null;

    if (!api || typeof api !== "object") {
      throw new Error("[Pixkuy Mobile Topbar Menu] Missing route API: " + route.apiName);
    }

    if (typeof api.open !== "function" || typeof api.close !== "function") {
      throw new Error("[Pixkuy Mobile Topbar Menu] Incomplete route API: " + route.apiName);
    }

    return api;
  }

  function closeRoute(route) {
    const api = window[route.apiName];
    const isRouteOpen = Boolean(
      api &&
        typeof api.isOpen === "function" &&
        api.isOpen()
    );

    if (!isRouteOpen || typeof api.close !== "function") {
      return false;
    }

    api.close({
      collapsePanel: true,
      updateUrl: false
    });

    return true;
  }

  function closeAllRoutes(exceptRoute) {
    Object.keys(ROUTES).forEach(function closeRouteByKey(key) {
      const route = ROUTES[key];

      if (exceptRoute && route.apiName === exceptRoute.apiName) {
        return;
      }

      closeRoute(route);
    });
  }
  
  function getScreenApi(screen) {
    const api = screen && screen.apiName ? window[screen.apiName] : null;

    if (!api || typeof api !== "object") {
      throw new Error("[Pixkuy Mobile Topbar Menu] Missing screen API: " + screen.apiName);
    }

    if (typeof api.open !== "function" || typeof api.close !== "function") {
      throw new Error("[Pixkuy Mobile Topbar Menu] Incomplete screen API: " + screen.apiName);
    }

    return api;
  }

  function closeScreen(screen) {
    const api = window[screen.apiName];
    const isScreenOpen = Boolean(
      api &&
        typeof api.isOpen === "function" &&
        api.isOpen()
    );

    if (!isScreenOpen || typeof api.close !== "function") {
      return false;
    }

    api.close({
      updateUrl: false
    });

    return true;
  }

  function closeAllScreens(exceptScreen) {
    Object.keys(SCREENS).forEach(function closeScreenByKey(key) {
      const screen = SCREENS[key];

      if (exceptScreen && screen.apiName === exceptScreen.apiName) {
        return;
      }

      closeScreen(screen);
    });
  }

  function cleanRouteParams(url) {
    [
      "view",
      "step",
      "tour",
      "event",
      "return_to",
      "return_chapter",
      "return_time",
      "airport_id",
      "airport_direction"
    ].forEach(function deleteParam(name) {
      url.searchParams.delete(name);
    });
  }

  function pushServiceUrl(route) {
    const url = new URL(window.location.href);
    const state = {};

    cleanRouteParams(url);
    url.searchParams.set("service", route.service);
    url.hash = "";

    state[route.stateKey] = true;

    window.history.pushState(
      state,
      document.title,
      url.pathname + url.search + url.hash
    );
  }

  function openService(action) {
    const route = ROUTES[action];
    const api = route ? getRouteApi(route) : null;
    const result = api ? null : false;

    if (!route || !api) {
      return result;
    }

    closeMenu();
    closeAllScreens(null);
    closeAllRoutes(route);
    pushServiceUrl(route);

    return api.open();
  }

  function openScreen(action) {
    const screen = SCREENS[action];
    const api = screen ? getScreenApi(screen) : null;
    const result = api ? null : false;

    if (!screen || !api) {
      return result;
    }

    closeMenu();
    closeAllRoutes(null);
    closeAllScreens(screen);

    return api.open({
      updateUrl: true
    });
  }

  function pushAnchorUrl(anchorId) {
    const url = new URL(window.location.href);

    cleanRouteParams(url);
    url.searchParams.delete("service");
    url.hash = anchorId;

    window.history.pushState(
      {},
      document.title,
      url.pathname + url.search + url.hash
    );
  }

  function scrollToAnchor(anchorId) {
    const target = anchorId ? document.getElementById(anchorId) : null;

    if (!target || typeof target.scrollIntoView !== "function") {
      return false;
    }

    closeMenu();
    closeAllRoutes(null);
    closeAllScreens(null);
    pushAnchorUrl(anchorId);

    window.requestAnimationFrame(function scrollAfterClose() {
      target.scrollIntoView({
        behavior: isReducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    });

    return true;
  }

  function handleAction(action) {
    if (ROUTES[action]) {
      openService(action);
      return true;
    }

    if (SCREENS[action]) {
      openScreen(action);
      return true;
    }

    if (ANCHORS[action]) {
      scrollToAnchor(ANCHORS[action]);
      return true;
    }

    if (action === "whatsapp") {
      closeMenu();
      closeAllScreens(null);
      return true;
    }

    return false;
  }

  function handleTriggerClick() {
    if (isOpen()) {
      closeMenu();
      return;
    }

    openMenu();
  }

  function handleRootClick(event) {
    const dismiss = event.target.closest(DISMISS_SELECTOR);
    const actionNode = event.target.closest(ACTION_SELECTOR);
    const action = actionNode
      ? actionNode.getAttribute("data-mobile-topbar-menu-action")
      : "";

    if (
      actionNode &&
      actionNode.matches("a[href][data-mobile-topbar-menu-native='true']")
    ) {
      closeMenu();
      return;
    }

    if (actionNode && action !== "whatsapp") {
      event.preventDefault();
      handleAction(action);
      return;
    }

    if (actionNode && action === "whatsapp") {
      handleAction(action);
      return;
    }

    if (dismiss) {
      event.preventDefault();
      closeMenu();
    }
  }

  function handleDocumentKeydown(event) {
    const focusableNodes = getFocusableNodes();
    const first = focusableNodes[0];
    const last = focusableNodes[focusableNodes.length - 1];

    if (!isOpen()) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      focusTrigger();
      return;
    }

    if (event.key !== "Tab" || !focusableNodes.length) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleViewportChange() {
    if (!isMobileViewport() && isOpen()) {
      closeMenu();
    }
  }

  function bind() {
    const root = getRoot();
    const trigger = getTrigger();

    if (isBound || !root || !trigger) {
      return false;
    }

    isBound = true;

    trigger.addEventListener("click", handleTriggerClick);
    root.addEventListener("click", handleRootClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    window.addEventListener("pageshow", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", handleViewportChange);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(handleViewportChange);
    }

    setOpen(false);
    return true;
  }

  window.PixkuyMobileTopbarMenu = {
    open: openMenu,
    close: closeMenu,
    isOpen: isOpen,
    navigate: handleAction
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})(window, document);
