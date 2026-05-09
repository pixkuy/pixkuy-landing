/* assets/js/services/direct-transfer-mobile-booking-flow.js
   Direct transfer mobile booking flow.
   Responsabilidad:
   - abrir direct_transfer como vista móvil dedicada tipo route
   - crear shell inicial de pantalla móvil
   - abrir el Config Step móvil propio
   - cerrar Config Step y Contact Step al cerrar la route
   - no tocar desktop
   - no tocar #contact visual
   - no usar Google Places ni quote desde la route
*/

(function initDirectTransferMobileBookingFlow(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const DIRECT_TRANSFER_HERO_LINK_SELECTOR = '.hero-mobile-entry__action[href*="service=direct_transfer"]';

  const BODY_FLOW_ATTR = "data-direct-transfer-mobile-flow";
  const BODY_SCREEN_ATTR = "data-direct-transfer-mobile-screen";

  const ROUTE_SELECTOR = "[data-direct-transfer-mobile-route]";
  const ROUTE_CONTENT_SELECTOR = "[data-direct-transfer-mobile-route-content]";
  const BACK_SELECTOR = "[data-direct-transfer-mobile-flow-back]";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let routeNode = null;
let routeContent = null;
let isRouteOpen = false;
let inMotionReturnContext = null;

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

  function getConfigStepApi() {
    const api = window.PixkuyDirectTransferMobileConfigStep;

    return api && typeof api === "object" ? api : null;
  }

  function getContactStepApi() {
    const api = window.PixkuyDirectTransferMobileContactStep;

    return api && typeof api === "object" ? api : null;
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

  function returnToInMotionScrollCinema() {
    const context = inMotionReturnContext || getInMotionReturnContextFromUrl();
    const api = window.PixkuyInMotionScrollCinema;
    const target =
      document.querySelector("[data-in-motion-scroll-cinema]") ||
      document.querySelector("#pixkuy-in-motion");

    try {
      const url = new URL(window.location.href);

      url.searchParams.delete("service");
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

  function buildRouteNode() {
    const route = document.createElement("section");
    const screen = document.createElement("div");
    const content = document.createElement("div");

    route.className = "direct-transfer-mobile-route";
    route.setAttribute("data-direct-transfer-mobile-route", "1");
    route.setAttribute("aria-hidden", "true");
    route.hidden = true;

    screen.className = "direct-transfer-mobile-route__screen";

    content.className = "direct-transfer-mobile-route__content";
    content.setAttribute("data-direct-transfer-mobile-route-content", "1");

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
    const placeholder = document.createElement("p");

    flow.className = "direct-transfer-mobile-flow";
    flow.setAttribute("data-direct-transfer-mobile-flow", "1");

    backRow.className = "direct-transfer-mobile-flow__back-row";

    back.type = "button";
    back.className = "direct-transfer-mobile-flow__back";
    back.setAttribute("data-direct-transfer-mobile-flow-back", "1");

    header.className = "direct-transfer-mobile-flow__header";

    title.className = "direct-transfer-mobile-flow__title";
    title.setAttribute("data-direct-transfer-mobile-flow-title", "1");

    helper.className = "direct-transfer-mobile-flow__helper";
    helper.setAttribute("data-direct-transfer-mobile-flow-helper", "1");

    placeholder.className = "direct-transfer-mobile-flow__placeholder";
    placeholder.setAttribute("data-direct-transfer-mobile-flow-placeholder", "1");
    placeholder.hidden = true;

    backRow.appendChild(back);
    header.appendChild(title);
    header.appendChild(helper);

    flow.appendChild(backRow);
    flow.appendChild(header);
    flow.appendChild(placeholder);

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

    if (routeContent && !routeContent.querySelector("[data-direct-transfer-mobile-flow]")) {
      routeContent.appendChild(buildFlowNode());
    }

    return routeNode;
  }

  function syncCopy() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;
    const title = route ? route.querySelector("[data-direct-transfer-mobile-flow-title]") : null;
    const helper = route ? route.querySelector("[data-direct-transfer-mobile-flow-helper]") : null;

    const backText = getI18nValue(
      "directTransferMobileFlow.back",
      "Volver"
    );
    const titleText = getI18nValue(
      "directTransferMobileFlow.title",
      "Traslados directos"
    );
    const helperText = getI18nValue(
      "directTransferMobileFlow.helper",
      "Elige origen, destino, fecha y hora."
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

  function openConfigStep() {
    const configStep = getConfigStepApi();

    if (!configStep || typeof configStep.open !== "function") {
      return false;
    }

    return configStep.open(routeNode);
  }

  function closeConfigStep() {
    const configStep = getConfigStepApi();

    if (configStep && typeof configStep.close === "function") {
      configStep.close();
      return true;
    }

    return false;
  }

  function closeContactStep() {
    const contactStep = getContactStepApi();

    if (contactStep && typeof contactStep.close === "function") {
      contactStep.close();
      return true;
    }

    return false;
  }

  function openDirectTransferRoute() {
    if (!isMobileViewport()) {
      return false;
    }

    inMotionReturnContext = getInMotionReturnContextFromUrl();

    ensureRoute();
    syncCopy();
    setRouteVisibility(true);
    openConfigStep();

    return true;
  }

  function closeDirectTransferRoute(options) {
    const settings = options || {};

    closeContactStep();
    closeConfigStep();
    setRouteVisibility(false);

    if (settings.updateUrl === true) {
      removeDirectTransferServiceFromUrl();
    }

    return true;
  }

  function removeDirectTransferServiceFromUrl() {
    try {
      const url = new URL(window.location.href);
      const service = normalizeText(url.searchParams.get("service")).toLowerCase();

      if (service === "direct_transfer") {
        url.searchParams.delete("service");
      }

      if (url.hash === "#services") {
        url.hash = "";
      }

      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function pushDirectTransferRouteUrl() {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "direct_transfer");
      url.hash = "";

      window.history.pushState(
        { directTransferMobileRoute: true },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}
  }

  function bindBack() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;

    if (!back || back.dataset.directTransferMobileBackBound === "1") {
      return false;
    }

    back.dataset.directTransferMobileBackBound = "1";

    back.addEventListener("click", function onBackClick() {
      if (inMotionReturnContext) {
        closeDirectTransferRoute({ updateUrl: false });
        returnToInMotionScrollCinema();
        return;
      }

      closeDirectTransferRoute({ updateUrl: true });
    });

    return true;
  }

  function bindHeroEntry() {
    const link = document.querySelector(DIRECT_TRANSFER_HERO_LINK_SELECTOR);

    if (!link || link.dataset.directTransferMobileEntryBound === "1") {
      return false;
    }

    link.dataset.directTransferMobileEntryBound = "1";

    link.addEventListener("click", function onDirectTransferHeroClick(event) {
      if (!isMobileViewport()) {
        return;
      }

      event.preventDefault();

      if (openDirectTransferRoute()) {
        pushDirectTransferRouteUrl();
      }
    });

    return true;
  }

  function shouldOpenFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return normalizeText(params.get("service")).toLowerCase() === "direct_transfer";
    } catch (error) {
      return false;
    }
  }

  function syncActiveState() {
    if (!isMobileViewport()) {
      if (isRouteOpen) {
        closeDirectTransferRoute({ updateUrl: false });
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
    syncActiveState();

    if (isMobileViewport() && shouldOpenFromUrl()) {
      window.requestAnimationFrame(function openFromUrl() {
        openDirectTransferRoute();
      });
    }

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("hashchange", syncActiveState);

    window.addEventListener("popstate", function onPopState() {
      if (isRouteOpen) {
        const shouldReturnToInMotion = Boolean(inMotionReturnContext);

        closeDirectTransferRoute({ updateUrl: false });

        if (shouldReturnToInMotion) {
          returnToInMotionScrollCinema();
          return;
        }

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

  window.PixkuyDirectTransferMobileBookingFlow = {
    open: openDirectTransferRoute,
    close: closeDirectTransferRoute,
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