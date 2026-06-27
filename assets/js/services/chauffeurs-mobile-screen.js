/* assets/js/services/chauffeurs-mobile-screen.js
   Chauffeurs mobile trust screen.
   Responsabilidad:
   - abrir Choferes profesionales como pantalla móvil informativa tipo route
   - no tocar flows de reserva, pricing, Places, checkout, WhatsApp runtime ni desktop
   - usar ?view=chauffeurs para no competir con ?service=...
   - mantener la pantalla como módulo público de confianza operativa, no como servicio reservable
*/

(function initChauffeursMobileScreen(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const VIEW_PARAM = "chauffeurs";
  const HERO_IMAGE_SRC = "assets/img/chauffeurs/chauffeurs-mobile-hero.webp";

  const BODY_SCREEN_ATTR = "data-chauffeurs-mobile-screen";

  const ROUTE_SELECTOR = "[data-chauffeurs-mobile-route]";
  const ROUTE_CONTENT_SELECTOR = "[data-chauffeurs-mobile-route-content]";
  const BACK_SELECTOR = "[data-chauffeurs-mobile-back]";
  const TITLE_SELECTOR = "[data-chauffeurs-mobile-title]";
  const BODY_SELECTOR = "[data-chauffeurs-mobile-body]";
  const MEDIA_IMAGE_SELECTOR = "[data-chauffeurs-mobile-media-image]";
  const PROOFS_SELECTOR = "[data-chauffeurs-mobile-proofs]";
  const CLOSURE_SELECTOR = "[data-chauffeurs-mobile-closure]";
  const TRUST_SELECTOR = "[data-chauffeurs-mobile-trust]";

  const ROUTE_PARAMS_TO_DELETE = [
    "service",
    "step",
    "tour",
    "event",
    "return_to",
    "return_chapter",
    "return_time",
    "airport_id",
    "airport_direction"
  ];

  const PROOF_IDS = [
    "assigned",
    "operations",
    "service",
    "privacy",
    "documents",
    "insurance"
  ];

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let routeNode = null;
  let routeContent = null;
  let isScreenOpen = false;
  let pendingOpenAfterI18n = false;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  
  function hasI18nReady() {
    return Boolean(window.__pixkuyI18nDict && typeof window.__pixkuyI18nDict === "object");
  }

  function getI18nValue(path) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = String(path || "").split(".");
    let cursor = dict;
    let index;

    if (!path || !dict) {
      return "";
    }

    if (typeof getValue === "function") {
      const value = getValue(dict, path);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (Array.isArray(value)) {
        return value;
      }
    }

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    if (typeof cursor === "string" && cursor.trim()) {
      return cursor.trim();
    }

    if (Array.isArray(cursor)) {
      return cursor;
    }

    return "";
  }

  function requireI18nString(path) {
    const value = getI18nValue(path);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    throw new Error("[Pixkuy Chauffeurs Mobile Screen] Missing i18n key: " + path);
  }

  function requireI18nStringList(path) {
    const value = getI18nValue(path);
    const list = Array.isArray(value)
      ? value.map(normalizeText).filter(Boolean)
      : [];

    if (list.length) {
      return list;
    }

    throw new Error("[Pixkuy Chauffeurs Mobile Screen] Missing i18n list: " + path);
  }

  function runWithViewTransition(update) {
    let transition;

    if (
      document &&
      typeof document.startViewTransition === "function" &&
      typeof update === "function"
    ) {
      transition = document.startViewTransition(update);

      if (transition && transition.ready && typeof transition.ready.catch === "function") {
        transition.ready.catch(function ignoreSkippedViewTransition() {});
      }

      if (transition && transition.finished && typeof transition.finished.catch === "function") {
        transition.finished.catch(function ignoreSkippedViewTransition() {});
      }

      return true;
    }

    if (typeof update === "function") {
      update();
    }

    return false;
  }

  function getUrl() {
    return new URL(window.location.href);
  }

  function cleanConflictingRouteParams(url) {
    ROUTE_PARAMS_TO_DELETE.forEach(function deleteParam(name) {
      url.searchParams.delete(name);
    });
  }

  function pushChauffeursUrl() {
    const url = getUrl();

    cleanConflictingRouteParams(url);
    url.searchParams.set("view", VIEW_PARAM);
    url.hash = "";

    window.history.pushState(
      { chauffeursMobileScreen: true },
      document.title,
      url.pathname + url.search + url.hash
    );

    return true;
  }

  function removeChauffeursUrl() {
    const url = getUrl();

    if (normalizeText(url.searchParams.get("view")).toLowerCase() === VIEW_PARAM) {
      url.searchParams.delete("view");
    }

    window.history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash
    );

    return true;
  }

  function shouldOpenFromUrl() {
    const params = new URLSearchParams(window.location.search || "");
    const view = normalizeText(params.get("view")).toLowerCase();
    const service = normalizeText(params.get("service")).toLowerCase();

    return view === VIEW_PARAM && !service;
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

  function setText(node, value) {
    if (!node || typeof value !== "string") {
      return false;
    }

    if (node.textContent !== value) {
      node.textContent = value;
    }

    return true;
  }

  function buildRouteNode() {
    const route = document.createElement("section");
    const screen = document.createElement("div");
    const content = document.createElement("div");

    route.className = "chauffeurs-mobile-route";
    route.setAttribute("data-chauffeurs-mobile-route", "1");
    route.setAttribute("aria-hidden", "true");
    route.hidden = true;

    screen.className = "chauffeurs-mobile-route__screen";

    content.className = "chauffeurs-mobile-route__content";
    content.setAttribute("data-chauffeurs-mobile-route-content", "1");

    screen.appendChild(content);
    route.appendChild(screen);

    return route;
  }

  function buildScreenNode() {
    const flow = document.createElement("section");
    const backRow = document.createElement("div");
    const back = document.createElement("button");
    const media = document.createElement("figure");
    const image = document.createElement("img");
    const header = document.createElement("div");
    const title = document.createElement("h3");
    const body = document.createElement("p");
    const proofs = document.createElement("div");
    const closure = document.createElement("p");
    const trust = document.createElement("ul");

    flow.className = "chauffeurs-mobile-screen";
    flow.setAttribute("data-chauffeurs-mobile-screen-root", "1");

    backRow.className = "chauffeurs-mobile-screen__back-row";

    back.type = "button";
    back.className = "chauffeurs-mobile-screen__back";
    back.setAttribute("data-chauffeurs-mobile-back", "1");

    media.className = "chauffeurs-mobile-screen__media";

    image.className = "chauffeurs-mobile-screen__image";
    image.setAttribute("data-chauffeurs-mobile-media-image", "1");
    image.loading = "lazy";
    image.decoding = "async";

    header.className = "chauffeurs-mobile-screen__header";

    title.className = "chauffeurs-mobile-screen__title";
    title.setAttribute("data-chauffeurs-mobile-title", "1");

    body.className = "chauffeurs-mobile-screen__body";
    body.setAttribute("data-chauffeurs-mobile-body", "1");

    proofs.className = "chauffeurs-mobile-screen__proofs";
    proofs.setAttribute("data-chauffeurs-mobile-proofs", "1");

    closure.className = "chauffeurs-mobile-screen__closure";
    closure.setAttribute("data-chauffeurs-mobile-closure", "1");

    trust.className = "chauffeurs-mobile-screen__trust";
    trust.setAttribute("data-chauffeurs-mobile-trust", "1");

    backRow.appendChild(back);
    media.appendChild(image);
    header.appendChild(title);
    header.appendChild(body);

    flow.appendChild(backRow);
    flow.appendChild(media);
    flow.appendChild(header);
    flow.appendChild(proofs);
    flow.appendChild(closure);
    flow.appendChild(trust);

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

    if (routeContent && !routeContent.querySelector("[data-chauffeurs-mobile-screen-root]")) {
      routeContent.appendChild(buildScreenNode());
    }

    return routeNode;
  }

  function renderProofs() {
    const route = ensureRoute();
    const proofs = route ? route.querySelector(PROOFS_SELECTOR) : null;

    if (!proofs) {
      return false;
    }

    proofs.textContent = "";

    PROOF_IDS.forEach(function renderProof(proofId) {
      const item = document.createElement("article");
      const title = document.createElement("h4");
      const text = document.createElement("p");

      item.className = "chauffeurs-mobile-screen__proof";
      title.className = "chauffeurs-mobile-screen__proof-title";
      text.className = "chauffeurs-mobile-screen__proof-text";

      title.textContent = requireI18nString(
        "chauffeursMobileScreen.proofs." + proofId + ".title"
      );
      text.textContent = requireI18nString(
        "chauffeursMobileScreen.proofs." + proofId + ".text"
      );

      item.appendChild(title);
      item.appendChild(text);
      proofs.appendChild(item);
    });

    return true;
  }

  function renderTrustList() {
    const route = ensureRoute();
    const trust = route ? route.querySelector(TRUST_SELECTOR) : null;
    const items = requireI18nStringList("chauffeursMobileScreen.trust");

    if (!trust) {
      return false;
    }

    trust.textContent = "";

    items.forEach(function renderTrustItem(value) {
      const item = document.createElement("li");

      item.className = "chauffeurs-mobile-screen__trust-item";
      item.textContent = value;

      trust.appendChild(item);
    });

    return true;
  }

  function syncCopy() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;
    const title = route ? route.querySelector(TITLE_SELECTOR) : null;
    const body = route ? route.querySelector(BODY_SELECTOR) : null;
    const image = route ? route.querySelector(MEDIA_IMAGE_SELECTOR) : null;
    const closure = route ? route.querySelector(CLOSURE_SELECTOR) : null;

    setText(back, requireI18nString("chauffeursMobileScreen.back"));
    setText(title, requireI18nString("chauffeursMobileScreen.title"));
    setText(body, requireI18nString("chauffeursMobileScreen.body"));
    setText(closure, requireI18nString("chauffeursMobileScreen.closure"));

    if (image) {
      image.src = HERO_IMAGE_SRC;
      image.alt = requireI18nString("chauffeursMobileScreen.imageAlt");
    }

    renderProofs();
    renderTrustList();

    return true;
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

    isScreenOpen = isVisible;

    return true;
  }

  function openChauffeursScreen(options) {
    const settings = options || {};

    if (!isMobileViewport()) {
      return false;
    }

    if (settings.updateUrl === true) {
      pushChauffeursUrl();
    }

    if (!hasI18nReady()) {
      pendingOpenAfterI18n = shouldOpenFromUrl();
      return true;
    }

    runWithViewTransition(function updateChauffeursScreen() {
      ensureRoute();
      syncCopy();
      setRouteVisibility(true);
    });

    if (window.PixkuyAnalytics && typeof window.PixkuyAnalytics.track === "function") {
      window.PixkuyAnalytics.track("pixkuy_mobile_route_open", {
        view: "chauffeurs",
        flow_surface: "mobile_route",
        entry_point: "mobile_topbar_menu_or_deeplink"
      });
    }

    window.requestAnimationFrame(function focusAfterOpen() {
      const route = ensureRoute();
      const back = route ? route.querySelector(BACK_SELECTOR) : null;

      if (back && typeof back.focus === "function") {
        back.focus();
      }
    });

    return true;
  }

  function closeChauffeursScreen(options) {
    const settings = options || {};

    pendingOpenAfterI18n = false;

    runWithViewTransition(function updateChauffeursScreenClose() {
      setRouteVisibility(false);
    });

    if (settings.updateUrl === true) {
      removeChauffeursUrl();
    }

    return true;
  }

  function bindBack() {
    const route = ensureRoute();
    const back = route ? route.querySelector(BACK_SELECTOR) : null;

    if (!back || back.dataset.chauffeursMobileBackBound === "1") {
      return false;
    }

    back.dataset.chauffeursMobileBackBound = "1";

    back.addEventListener("click", function onBackClick() {
      closeChauffeursScreen({ updateUrl: true });
    });

    return true;
  }

  function syncActiveState() {
    if (!isMobileViewport()) {
      if (isScreenOpen) {
        closeChauffeursScreen({ updateUrl: false });
      }

      return false;
    }

    if (isScreenOpen) {
      syncCopy();
    }

    return true;
  }

  function init() {
    ensureRoute();
    bindBack();
    syncActiveState();

    if (isMobileViewport() && shouldOpenFromUrl()) {
      window.requestAnimationFrame(function openFromUrl() {
        openChauffeursScreen({ updateUrl: false });
      });
    }

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("hashchange", syncActiveState);

    window.addEventListener("popstate", function onPopState() {
      if (!shouldOpenFromUrl()) {
        pendingOpenAfterI18n = false;
      }

      if (isScreenOpen) {
        closeChauffeursScreen({ updateUrl: false });
        return;
      }

      syncActiveState();
    });

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      if (
        isMobileViewport() &&
        shouldOpenFromUrl() &&
        (
          pendingOpenAfterI18n ||
          !isScreenOpen
        )
      ) {
        pendingOpenAfterI18n = false;
        openChauffeursScreen({ updateUrl: false });
        return;
      }

      pendingOpenAfterI18n = false;

      if (isScreenOpen) {
        syncCopy();
      }
    });

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncActiveState);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncActiveState);
    }

    return true;
  }

  window.PixkuyChauffeursMobileScreen = {
    open: openChauffeursScreen,
    close: closeChauffeursScreen,
    isOpen: function isOpen() {
      return isScreenOpen;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);