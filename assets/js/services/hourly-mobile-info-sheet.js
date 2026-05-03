/* assets/js/services/hourly-mobile-info-sheet.js
   Hourly / Daily mobile info sheet.
   Responsabilidad:
   - convertir los bloques Incluye / Suplementos posibles en triggers móviles
   - mostrar su contenido en una sábana informativa
   - leer el contenido ya renderizado por hourly-daily-panel.js
   - no tocar pricing, payload, #contact ni desktop
*/

(function initHourlyMobileInfoSheet(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const BODY_SCREEN_ATTR = "data-hourly-mobile-screen";
  const INFO_SHEET_ACTIVE_ATTR = "data-hourly-mobile-info-sheet-active";

  const GROUP_SELECTOR =
    ".hourly-mobile-route .services-hourly-panel__disclaimer-group";

  const SHEET_SELECTOR = "[data-hourly-mobile-info-sheet]";
  const SHEET_TITLE_SELECTOR = "[data-hourly-mobile-info-sheet-title]";
  const SHEET_LIST_SELECTOR = "[data-hourly-mobile-info-sheet-list]";
  const SHEET_CLOSE_SELECTOR = "[data-hourly-mobile-info-sheet-close]";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let sheetNode = null;

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
    let value;

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      value = getValue(dict, path);

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

  function isHourlyMobileRouteActive() {
    return (
      isMobileViewport() &&
      document.body.getAttribute(BODY_SCREEN_ATTR) === "true"
    );
  }

  function buildSheetNode() {
    const sheet = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const title = document.createElement("p");
    const close = document.createElement("button");
    const body = document.createElement("div");
    const list = document.createElement("ul");

    sheet.className = "hourly-mobile-info-sheet";
    sheet.setAttribute("data-hourly-mobile-info-sheet", "1");
    sheet.setAttribute("aria-hidden", "true");
    sheet.hidden = true;

    panel.className = "hourly-mobile-info-sheet__panel";

    header.className = "hourly-mobile-info-sheet__header";

    title.className = "hourly-mobile-info-sheet__title";
    title.setAttribute("data-hourly-mobile-info-sheet-title", "1");

    close.type = "button";
    close.className = "hourly-mobile-info-sheet__close";
    close.setAttribute("data-hourly-mobile-info-sheet-close", "1");

    body.className = "hourly-mobile-info-sheet__body";

    list.className = "hourly-mobile-info-sheet__list";
    list.setAttribute("data-hourly-mobile-info-sheet-list", "1");

    header.appendChild(title);
    header.appendChild(close);

    body.appendChild(list);

    panel.appendChild(header);
    panel.appendChild(body);

    sheet.appendChild(panel);

    return sheet;
  }

  function ensureSheetNode() {
    if (sheetNode) {
      return sheetNode;
    }

    sheetNode = document.querySelector(SHEET_SELECTOR);

    if (!sheetNode) {
      sheetNode = buildSheetNode();
      document.body.appendChild(sheetNode);
    }

    bindSheetEvents();
    syncCopy();

    return sheetNode;
  }

  function syncCopy() {
    const close = sheetNode
      ? sheetNode.querySelector(SHEET_CLOSE_SELECTOR)
      : null;
    const closeText = getI18nValue(
      "services.cards.airport.panel.back",
      "Volver"
    );

    if (close) {
      close.textContent = closeText;
      close.setAttribute("aria-label", closeText);
    }

    return true;
  }

  function extractGroupPayload(group) {
    const titleNode = group
      ? group.querySelector(".services-hourly-panel__disclaimer-title")
      : null;
    const itemNodes = group
      ? Array.from(group.querySelectorAll(".services-hourly-panel__disclaimers li"))
      : [];

    return {
      title: normalizeText(titleNode ? titleNode.textContent : ""),
      items: itemNodes
        .map(function mapItem(item) {
          return normalizeText(item.textContent);
        })
        .filter(Boolean)
    };
  }

  function renderSheet(payload) {
    const sheet = ensureSheetNode();
    const title = sheet ? sheet.querySelector(SHEET_TITLE_SELECTOR) : null;
    const list = sheet ? sheet.querySelector(SHEET_LIST_SELECTOR) : null;

    if (!sheet || !title || !list || !payload || !payload.title) {
      return false;
    }

    title.textContent = payload.title;
    list.innerHTML = "";

    payload.items.forEach(function appendItem(text) {
      const item = document.createElement("li");

      item.textContent = text;
      list.appendChild(item);
    });

    return true;
  }

  function openSheet(group) {
    const payload = extractGroupPayload(group);
    const sheet = ensureSheetNode();

    if (!isHourlyMobileRouteActive() || !sheet || !payload.title || !payload.items.length) {
      return false;
    }

    renderSheet(payload);

    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    document.body.setAttribute(INFO_SHEET_ACTIVE_ATTR, "true");

    return true;
  }

  function closeSheet() {
    const sheet = ensureSheetNode();

    if (!sheet) {
      return false;
    }

    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    document.body.setAttribute(INFO_SHEET_ACTIVE_ATTR, "false");

    return true;
  }

  function isOpen() {
    return Boolean(
      sheetNode &&
      sheetNode.hidden !== true &&
      sheetNode.getAttribute("aria-hidden") !== "true"
    );
  }

  function bindSheetEvents() {
    if (!sheetNode || sheetNode.dataset.hourlyMobileInfoSheetBound === "1") {
      return false;
    }

    sheetNode.dataset.hourlyMobileInfoSheetBound = "1";

    sheetNode.addEventListener("click", function onSheetClick(event) {
      const close = event.target.closest(SHEET_CLOSE_SELECTOR);

      if (!close) {
        return;
      }

      event.preventDefault();
      closeSheet();
    });

    return true;
  }

  function bindGroupDelegates() {
    document.addEventListener("click", function onDisclaimerClick(event) {
      const group = event.target.closest(GROUP_SELECTOR);

      if (!group || !isHourlyMobileRouteActive()) {
        return;
      }

      event.preventDefault();
      openSheet(group);
    });

    document.addEventListener("keydown", function onKeydown(event) {
      if (event.key !== "Escape" || !isOpen()) {
        return;
      }

      event.preventDefault();
      closeSheet();
    });

    return true;
  }

  function syncActiveState() {
    if (!isHourlyMobileRouteActive() && isOpen()) {
      closeSheet();
    }

    return true;
  }

  function init() {
    ensureSheetNode();
    bindGroupDelegates();
    syncActiveState();

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("pixkuy:i18n-applied", syncCopy);

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

  window.PixkuyHourlyMobileInfoSheet = {
    open: openSheet,
    close: closeSheet,
    isOpen: isOpen,
    syncCopy: syncCopy
  };
})(window, document);