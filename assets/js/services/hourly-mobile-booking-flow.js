/* assets/js/services/hourly-mobile-booking-flow.js
   Hourly / Daily mobile booking flow.
   Responsabilidad:
   - abrir hourly_daily como vista móvil dedicada tipo route
   - mover el panel real #services-expand-hourly a esa vista
   - reutilizar una sola fuente de verdad: motor Hourly, pickup, pricing y handoff actual
   - no duplicar lógica de precio ni payload
   - no tocar #contact ni desktop
*/

(function initHourlyMobileBookingFlow(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const PANEL_SELECTOR = "#services-expand-hourly";
  const HOURLY_HERO_LINK_SELECTOR = '.hero-mobile-entry__action[href*="service=hourly_daily"]';
  const HOURLY_CARD_SELECTOR = '.service-card [data-i18n="services.cards.hourly.title"]';

  const BODY_FLOW_ATTR = "data-hourly-mobile-flow";
  const BODY_SCREEN_ATTR = "data-hourly-mobile-screen";

  const ROUTE_SELECTOR = "[data-hourly-mobile-route]";
  const ROUTE_CONTENT_SELECTOR = "[data-hourly-mobile-route-content]";
  const FLOW_SELECTOR = "[data-hourly-mobile-flow]";
  const BACK_SELECTOR = "[data-hourly-mobile-flow-back]";
  const MOBILE_DURATION_SELECT_SELECTOR = "[data-hourly-mobile-duration-select]";
  const MOBILE_LONG_TERM_SELECT_SELECTOR = "[data-hourly-mobile-long-term-select]";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let observer = null;
  let routeNode = null;
  let routeContent = null;
  let originalPanelParent = null;
  let originalPanelNextSibling = null;
  let isRouteOpen = false;
  let inMotionReturnContext = null;
  let hasDirectMobilePanelOpen = false;

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
  
    function getActiveHourlyMode(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const mode = config
      ? normalizeText(config.getAttribute("data-services-hourly-mode-active"))
      : "";

    return mode || "hourly";
  }

  function getModeHelperText(panel) {
    const mode = getActiveHourlyMode(panel);
    const fallback = getI18nValue(
      "services.cards.hourly.panel.text",
      getI18nValue("services.cards.hourly.text", "")
    );
    const helperPathByMode = {
      hourly: "services.cards.hourly.mobileFlow.helper.hourly",
      full_day: "services.cards.hourly.mobileFlow.helper.fullDay",
      custom_long_term: "services.cards.hourly.mobileFlow.helper.longTerm"
    };

    return getI18nValue(helperPathByMode[mode], fallback);
  }

  function getPanel() {
    return document.querySelector(PANEL_SELECTOR);
  }

  function getHourlyCard() {
    const title = document.querySelector(HOURLY_CARD_SELECTOR);

    return title ? title.closest(".service-card") : null;
  }

  function isPanelVisible(panel) {
    return Boolean(
      panel &&
        panel.hidden !== true &&
        panel.getAttribute("aria-hidden") !== "true"
    );
  }

  function buildRouteNode() {
    const route = document.createElement("section");
    const screen = document.createElement("div");
    const content = document.createElement("div");

    route.className = "hourly-mobile-route";
    route.setAttribute("data-hourly-mobile-route", "1");
    route.setAttribute("aria-hidden", "true");
    route.hidden = true;

    screen.className = "hourly-mobile-route__screen";

    content.className = "hourly-mobile-route__content";
    content.setAttribute("data-hourly-mobile-route-content", "1");

    screen.appendChild(content);
    route.appendChild(screen);

    return route;
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

    return routeNode;
  }

  function buildFlowNode() {
    const flow = document.createElement("section");
    const backRow = document.createElement("div");
    const back = document.createElement("button");
    const header = document.createElement("div");
    const title = document.createElement("h3");
    const helper = document.createElement("p");

    flow.className = "hourly-mobile-flow";
    flow.setAttribute("data-hourly-mobile-flow", "1");

    backRow.className = "hourly-mobile-flow__back-row";

    back.type = "button";
    back.className = "hourly-mobile-flow__back";
    back.setAttribute("data-hourly-mobile-flow-back", "1");

    header.className = "hourly-mobile-flow__header";

    title.className = "hourly-mobile-flow__title";
    title.setAttribute("data-hourly-mobile-flow-title", "1");

    helper.className = "hourly-mobile-flow__helper";
    helper.setAttribute("data-hourly-mobile-flow-helper", "1");

    backRow.appendChild(back);
    header.appendChild(title);
    header.appendChild(helper);

    flow.appendChild(backRow);
    flow.appendChild(header);

    return flow;
  }

  function syncCopy(panel) {
    const back = panel ? panel.querySelector("[data-hourly-mobile-flow-back]") : null;
    const title = panel ? panel.querySelector("[data-hourly-mobile-flow-title]") : null;
    const helper = panel ? panel.querySelector("[data-hourly-mobile-flow-helper]") : null;
    const cta = panel ? panel.querySelector("[data-services-hourly-cta]") : null;

    const backText = getI18nValue(
      "services.cards.airport.panel.back",
      "Volver"
    );
    const titleText = getI18nValue(
      "services.cards.hourly.panel.title",
      getI18nValue("contact.services.hourlyDaily", "Auto con conductor")
    );
    const helperText = getModeHelperText(panel);
    const ctaText = getI18nValue(
      "services.cards.hourly.mobileFlow.cta.continue",
      getI18nValue("services.cards.hourly.panel.cta", "")
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

    if (cta && ctaText) {
      cta.textContent = ctaText;
    }

    return true;
  }

  function ensureFlow(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    let flow = panel ? panel.querySelector(FLOW_SELECTOR) : null;

    if (!panel || !config) {
      return null;
    }

    if (!flow) {
      flow = buildFlowNode();
      config.insertAdjacentElement("beforebegin", flow);
    }

    syncCopy(panel);

    return flow;
  }
  
    function getMobileLongTermCta(panel) {
    return panel ? panel.querySelector("[data-services-hourly-cta]") : null;
  }

  function getMobileLongTermFieldValue(panel, selector) {
    const field = panel ? panel.querySelector(selector) : null;

    if (!field || typeof field.value !== "string") {
      return "";
    }

    return normalizeText(field.value);
  }

  function getMobileLongTermPickupValue(panel) {
    return (
      getMobileLongTermFieldValue(panel, '[data-place-input="hourly_daily_pickup"]') ||
      getMobileLongTermFieldValue(panel, "[data-services-hourly-pickup-input]")
    );
  }

  function getMobileLongTermSelectedValue(panel) {
    const select = panel ? panel.querySelector(MOBILE_LONG_TERM_SELECT_SELECTOR) : null;
    const selectValue = normalizeText(select && typeof select.value === "string" ? select.value : "");

    return selectValue || getActiveLongTermValue(panel);
  }

  function hasMobileLongTermRequiredFields(panel) {
    const mode = getActiveHourlyMode(panel);

    if (mode !== "custom_long_term") {
      return false;
    }

    return Boolean(
      getMobileLongTermPickupValue(panel) &&
      getMobileLongTermFieldValue(panel, "[data-services-hourly-date]") &&
      getMobileLongTermFieldValue(panel, "[data-services-hourly-time]") &&
      getMobileLongTermSelectedValue(panel)
    );
  }

  function syncMobileLongTermCta(panel) {
    const cta = getMobileLongTermCta(panel);
    const mode = getActiveHourlyMode(panel);
    const isReady = hasMobileLongTermRequiredFields(panel);

    if (!cta || mode !== "custom_long_term") {
      return false;
    }

    cta.disabled = !isReady;
    cta.setAttribute("aria-disabled", isReady ? "false" : "true");

    return true;
  }

  function bindMobileLongTermCtaSync(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const pickup = config ? config.querySelector('[data-place-input="hourly_daily_pickup"]') : null;
    const date = config ? config.querySelector("[data-services-hourly-date]") : null;
    const time = config ? config.querySelector("[data-services-hourly-time]") : null;
    const longTerm = config ? config.querySelector(MOBILE_LONG_TERM_SELECT_SELECTOR) : null;
    const fields = [pickup, date, time, longTerm].filter(Boolean);

    if (!config) {
      return false;
    }

    fields.forEach(function bindField(field) {
      if (!field || field.dataset.hourlyMobileLongTermCtaSyncBound === "1") {
        return;
      }

      field.dataset.hourlyMobileLongTermCtaSyncBound = "1";

      field.addEventListener("input", function onInput() {
        window.requestAnimationFrame(function syncAfterInput() {
          syncMobileLongTermCta(panel);
        });
      });

      field.addEventListener("change", function onChange() {
        window.requestAnimationFrame(function syncAfterChange() {
          syncMobileLongTermCta(panel);
        });
      });
    });

    syncMobileLongTermCta(panel);
    return true;
  }
  
  function getHourlyMobileContactStepApi() {
    const api = window.PixkuyHourlyMobileContactStep;

    return api && typeof api === "object" ? api : null;
  }
  
    function shouldReturnToDirectTransfer() {
    try {
      const params = new URLSearchParams(window.location.search || "");

      return normalizeText(params.get("return_to")).toLowerCase() === "direct_transfer";
    } catch (error) {
      return false;
    }
  }

  function shouldReturnToInMotionScrollCinema() {
    try {
      const params = new URLSearchParams(window.location.search || "");

      return normalizeText(params.get("return_to")).toLowerCase() === "in_motion_scroll_cinema";
    } catch (error) {
      return false;
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

  function returnToDirectTransferRoute() {
    const api = window.PixkuyDirectTransferMobileBookingFlow;

    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "direct_transfer");
      url.searchParams.delete("return_to");
      url.searchParams.delete("return_chapter");
      url.searchParams.delete("return_time");
      url.hash = "";

      window.history.replaceState(
        { directTransferMobileRoute: true },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}

    if (api && typeof api.open === "function") {
      api.open();
      return true;
    }

    return false;
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

  function isHourlyMobileContactStepOpen() {
    const contactStep = getHourlyMobileContactStepApi();

    return Boolean(
      contactStep &&
      typeof contactStep.isOpen === "function" &&
      contactStep.isOpen()
    );
  }


  function bindBack(panel) {
    const back = panel ? panel.querySelector(BACK_SELECTOR) : null;

    if (!back || back.dataset.hourlyMobileBackBound === "1") {
      return false;
    }

    back.dataset.hourlyMobileBackBound = "1";

    back.addEventListener("click", function onBackClick() {
      const contactStep = getHourlyMobileContactStepApi();

      if (
        contactStep &&
        typeof contactStep.isOpen === "function" &&
        contactStep.isOpen() &&
        typeof contactStep.close === "function"
      ) {
        contactStep.close();
        return;
      }

      if (shouldReturnToDirectTransfer()) {
        closeHourlyRoute({ collapsePanel: true, updateUrl: false });
        returnToDirectTransferRoute();
        return;
      }

      if (shouldReturnToInMotionScrollCinema()) {
        inMotionReturnContext = inMotionReturnContext || getInMotionReturnContextFromUrl();
        closeHourlyRoute({ collapsePanel: true, updateUrl: false });
        returnToInMotionScrollCinema();
        return;
      }

      closeHourlyRoute({ collapsePanel: true, updateUrl: true });
    });

    return true;
  }
  
    function getDurationField(panel) {
    return panel
      ? panel.querySelector(".services-hourly-panel__field--duration")
      : null;
  }

  function getDurationButtons(panel) {
    const field = getDurationField(panel);

    return field
      ? Array.from(field.querySelectorAll("[data-services-hourly-duration]"))
      : [];
  }

  function getActiveDurationValue(panel) {
    const buttons = getDurationButtons(panel);
    const activeButton = buttons.find(function findActive(button) {
      return button.classList.contains("is-active") ||
        button.getAttribute("aria-pressed") === "true";
    });

    return activeButton
      ? normalizeText(activeButton.getAttribute("data-services-hourly-duration"))
      : "";
  }
  
    function getDurationOptionLabel(button) {
    return normalizeText(button ? button.textContent : "");
  }

  function buildMobileDurationSelect(panel) {
    const field = getDurationField(panel);
    const buttons = getDurationButtons(panel);
    const existing = field ? field.querySelector(MOBILE_DURATION_SELECT_SELECTOR) : null;
    const label = field ? field.querySelector(".services-hourly-panel__label") : null;
    const select = existing || document.createElement("select");
    const activeValue = getActiveDurationValue(panel);

    if (!field || !buttons.length) {
      return null;
    }

    if (!existing) {
      select.className = "services-hourly-panel__mobile-duration-select";
      select.setAttribute("data-hourly-mobile-duration-select", "1");
      select.setAttribute("autocomplete", "off");

      if (label && label.id) {
        select.setAttribute("aria-labelledby", label.id);
      }
    }

    if (label && label.parentNode === field) {
      label.insertAdjacentElement("afterend", select);
    } else {
      const chips = field.querySelector(".services-hourly-panel__chips");

      if (chips && chips.parentNode === field) {
        field.insertBefore(select, chips);
      } else {
        field.appendChild(select);
      }
    }

    select.innerHTML = "";

    buttons.forEach(function appendDurationOption(button) {
      const value = normalizeText(button.getAttribute("data-services-hourly-duration"));
      const text = getDurationOptionLabel(button);
      const option = document.createElement("option");

      if (!value || !text) {
        return;
      }

      option.value = value;
      option.textContent = text;

      if (value === activeValue) {
        option.selected = true;
      }

      select.appendChild(option);
    });

    return select;
  }

  function syncMobileDurationSelect(panel) {
    const select = panel ? panel.querySelector(MOBILE_DURATION_SELECT_SELECTOR) : null;
    const activeValue = getActiveDurationValue(panel);

    if (select && activeValue && select.value !== activeValue) {
      select.value = activeValue;
    }

    return true;
  }

  function bindMobileDurationSelect(panel) {
    const select = buildMobileDurationSelect(panel);

    if (!select || select.dataset.hourlyMobileDurationSelectBound === "1") {
      return false;
    }

    select.dataset.hourlyMobileDurationSelectBound = "1";

    select.addEventListener("change", function onMobileDurationChange() {
      const value = normalizeText(select.value);
      const button = getDurationButtons(panel).find(function findButton(item) {
        return normalizeText(item.getAttribute("data-services-hourly-duration")) === value;
      });

      if (button && typeof button.click === "function") {
        button.click();
      }

      window.requestAnimationFrame(function syncAfterDurationClick() {
        syncMobileDurationSelect(panel);
      });
    });

    return true;
  }

  function ensureMobileDurationSelect(panel) {
    buildMobileDurationSelect(panel);
    bindMobileDurationSelect(panel);
    syncMobileDurationSelect(panel);

    return true;
  }
  
    function getLongTermField(panel) {
    return panel
      ? panel.querySelector(".services-hourly-panel__field--long-term")
      : null;
  }

  function getLongTermButtons(panel) {
    const field = getLongTermField(panel);

    return field
      ? Array.from(field.querySelectorAll("[data-services-hourly-long-term]"))
      : [];
  }

  function getActiveLongTermValue(panel) {
    const buttons = getLongTermButtons(panel);
    const activeButton = buttons.find(function findActive(button) {
      return button.classList.contains("is-active") ||
        button.getAttribute("aria-pressed") === "true";
    });

    return activeButton
      ? normalizeText(activeButton.getAttribute("data-services-hourly-long-term"))
      : "";
  }

  function buildMobileLongTermSelect(panel) {
    const field = getLongTermField(panel);
    const buttons = getLongTermButtons(panel);
    const existing = field ? field.querySelector(MOBILE_LONG_TERM_SELECT_SELECTOR) : null;
    const label = field ? field.querySelector(".services-hourly-panel__label") : null;
    const select = existing || document.createElement("select");
    const activeValue = getActiveLongTermValue(panel);

    if (!field || !buttons.length) {
      return null;
    }

    if (!existing) {
      select.className = "services-hourly-panel__mobile-duration-select services-hourly-panel__mobile-long-term-select";
      select.setAttribute("data-hourly-mobile-long-term-select", "1");
      select.setAttribute("autocomplete", "off");

      if (label && label.id) {
        select.setAttribute("aria-labelledby", label.id);
      }
    }

    if (label && label.parentNode === field) {
      label.insertAdjacentElement("afterend", select);
    } else {
      const chips = field.querySelector(".services-hourly-panel__chips");

      if (chips && chips.parentNode === field) {
        field.insertBefore(select, chips);
      } else {
        field.appendChild(select);
      }
    }

    select.innerHTML = "";

    buttons.forEach(function appendLongTermOption(button) {
      const value = normalizeText(button.getAttribute("data-services-hourly-long-term"));
      const text = normalizeText(button.textContent);
      const option = document.createElement("option");

      if (!value || !text) {
        return;
      }

      option.value = value;
      option.textContent = text;

      if (value === activeValue) {
        option.selected = true;
      }

      select.appendChild(option);
    });

    return select;
  }

  function syncMobileLongTermSelect(panel) {
    const select = panel ? panel.querySelector(MOBILE_LONG_TERM_SELECT_SELECTOR) : null;
    const activeValue = getActiveLongTermValue(panel);

    if (select && activeValue && select.value !== activeValue) {
      select.value = activeValue;
    }

    return true;
  }
  
    function syncLongTermSelectWithSourceButton(panel, value) {
    const safeValue = normalizeText(value);
    const button = getLongTermButtons(panel).find(function findButton(item) {
      return normalizeText(item.getAttribute("data-services-hourly-long-term")) === safeValue;
    });

    if (!button || typeof button.click !== "function") {
      return false;
    }

    button.click();
    return true;
  }
  
  function bindMobileLongTermSelect(panel) {
    const select = buildMobileLongTermSelect(panel);

    if (!select || select.dataset.hourlyMobileLongTermSelectBound === "1") {
      return false;
    }

    select.dataset.hourlyMobileLongTermSelectBound = "1";

    select.addEventListener("change", function onMobileLongTermChange() {
      const value = normalizeText(select.value);

      syncLongTermSelectWithSourceButton(panel, value);

      window.requestAnimationFrame(function syncAfterLongTermClick() {
        syncMobileLongTermSelect(panel);
        syncMobileLongTermCta(panel);
      });
    });

    return true;
  }

  function ensureMobileLongTermSelect(panel) {
    buildMobileLongTermSelect(panel);
    bindMobileLongTermSelect(panel);
    syncMobileLongTermSelect(panel);

    return true;
  }
  
    function moveMobileVehicleToFooter(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const layout = config ? config.querySelector(".services-hourly-panel__layout--mobile-hourly") : null;
    const footerRow = layout ? layout.querySelector(".services-hourly-panel__row--mobile-footer-spacer") : null;
    const price = footerRow ? footerRow.querySelector(".services-hourly-panel__price--inline") : null;
    const vehicleField = layout ? layout.querySelector(".services-hourly-panel__field--vehicle-mobile") : null;

    if (!layout || !footerRow || !price || !vehicleField) {
      return false;
    }

    vehicleField.setAttribute("data-hourly-mobile-vehicle-in-footer", "true");
    vehicleField.removeAttribute("data-hourly-mobile-vehicle-below-notes");

    if (vehicleField.parentNode !== footerRow) {
      footerRow.insertBefore(vehicleField, price);
    }

    return true;
  }

  
    function mergeMobileLongTermDisclaimers(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const modeActive = config
      ? normalizeText(config.getAttribute("data-services-hourly-mode-active"))
      : "";
    const meta = config
      ? config.querySelector("[data-services-hourly-mobile-meta-host]")
      : null;
    const groups = meta
      ? Array.from(meta.querySelectorAll(".services-hourly-panel__disclaimer-group"))
      : [];
    const primaryGroup = groups[0] || null;
    const primaryList = primaryGroup
      ? primaryGroup.querySelector(".services-hourly-panel__disclaimers")
      : null;

    if (modeActive !== "custom_long_term" || !meta || !primaryGroup || !primaryList || groups.length < 2) {
      return false;
    }

    groups.slice(1).forEach(function mergeGroup(group) {
      Array.from(group.querySelectorAll(".services-hourly-panel__disclaimers li")).forEach(function moveItem(item) {
        primaryList.appendChild(item);
      });

      group.remove();
    });

    return true;
  }
  
    function moveMobileDurationNextToDate(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const layout = config ? config.querySelector(".services-hourly-panel__layout--mobile-hourly") : null;
    const heroRow = layout ? layout.querySelector(".services-hourly-panel__row--mobile-hero") : null;
    const timeField = heroRow ? heroRow.querySelector(".services-hourly-panel__field--time-mobile") : null;
    const modeActive = config ? normalizeText(config.getAttribute("data-services-hourly-mode-active")) : "";
    const durationField = layout ? layout.querySelector(".services-hourly-panel__field--duration") : null;

    if (modeActive !== "hourly") {
      if (
        durationField &&
        durationField.getAttribute("data-hourly-mobile-duration-in-hero") === "true"
      ) {
        durationField.remove();
      }

      return false;
    }

    if (!layout || !heroRow || !durationField) {
      return false;
    }

    durationField.setAttribute("data-hourly-mobile-duration-in-hero", "true");

    if (durationField.parentNode !== heroRow) {
      if (timeField && timeField.parentNode === heroRow) {
        heroRow.insertBefore(durationField, timeField);
      } else {
        heroRow.appendChild(durationField);
      }
    }

    return true;
  }
  
    function moveMobileLongTermNextToDate(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const layout = config ? config.querySelector(".services-hourly-panel__layout--mobile-hourly") : null;
    const heroRow = layout ? layout.querySelector(".services-hourly-panel__row--mobile-hero") : null;
    const dateField = heroRow ? heroRow.querySelector(".services-hourly-panel__field--date-airport-mobile") : null;
    const modeActive = config ? normalizeText(config.getAttribute("data-services-hourly-mode-active")) : "";
    const longTermField = layout ? layout.querySelector(".services-hourly-panel__field--long-term") : null;

    if (modeActive !== "custom_long_term") {
      if (
        longTermField &&
        longTermField.getAttribute("data-hourly-mobile-long-term-in-hero") === "true"
      ) {
        longTermField.remove();
      }

      return false;
    }

    if (!layout || !heroRow || !longTermField) {
      return false;
    }

    longTermField.setAttribute("data-hourly-mobile-long-term-in-hero", "true");

    if (longTermField.parentNode !== heroRow) {
      if (dateField && dateField.parentNode === heroRow) {
        heroRow.insertBefore(longTermField, dateField);
      } else {
        heroRow.appendChild(longTermField);
      }
    }

    return true;
  }
  
    function useAirportNativeDateField(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;
    const dateField = config
      ? config.querySelector(".services-hourly-panel__field--date-mobile")
      : null;

    if (!dateField) {
      return false;
    }

    dateField.classList.remove("services-hourly-panel__field--date-mobile");
    dateField.classList.add("services-hourly-panel__field--date-airport-mobile");
    dateField.setAttribute("data-hourly-mobile-date-airport-native", "true");

    return true;
  }

  function rememberOriginalPanelPosition(panel) {
    if (originalPanelParent) {
      return true;
    }

    if (!panel || !panel.parentNode) {
      return false;
    }

    originalPanelParent = panel.parentNode;
    originalPanelNextSibling = panel.nextSibling;

    return true;
  }

  function movePanelToRoute(panel) {
    ensureRoute();

    if (!routeContent || !panel) {
      return false;
    }

    if (!rememberOriginalPanelPosition(panel)) {
      return false;
    }

    if (panel.parentNode !== routeContent) {
      routeContent.appendChild(panel);
    }

    return true;
  }

  function restorePanelPosition(panel) {
    if (!panel || !originalPanelParent) {
      return false;
    }

    if (
      originalPanelNextSibling &&
      originalPanelNextSibling.parentNode === originalPanelParent
    ) {
      originalPanelParent.insertBefore(panel, originalPanelNextSibling);
      return true;
    }

    originalPanelParent.appendChild(panel);
    return true;
  }

  function restoreHourlyConfig(panel) {
    const config = panel ? panel.querySelector("[data-services-hourly-config]") : null;

    if (!config) {
      return false;
    }

    config.hidden = false;
    config.removeAttribute("hidden");

    return true;
  }

  function openHourlyPanelEngine(panel) {
    const hourlyCard = getHourlyCard();

    if (isPanelVisible(panel)) {
      hasDirectMobilePanelOpen = false;
      return true;
    }

    if (isMobileViewport()) {
      panel.hidden = false;
      panel.setAttribute("aria-hidden", "false");
      hasDirectMobilePanelOpen = true;
      return true;
    }

    if (hourlyCard && typeof hourlyCard.click === "function") {
      hourlyCard.click();
    }

    hasDirectMobilePanelOpen = false;
    return isPanelVisible(panel);
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

  function openHourlyRoute() {
    const panel = getPanel();

    if (!isMobileViewport() || !panel) {
      return false;
    }

    inMotionReturnContext = getInMotionReturnContextFromUrl();

     /*
      Hourly tiene una sábana legacy; Airport no.
      Activamos el atributo antes de abrir el panel para que la sábana no robe el configMount.
    */
    document.body.setAttribute(BODY_SCREEN_ATTR, "true");
    document.body.setAttribute(BODY_FLOW_ATTR, "true");

    if (!openHourlyPanelEngine(panel)) {
      document.body.setAttribute(BODY_SCREEN_ATTR, "false");
      document.body.setAttribute(BODY_FLOW_ATTR, "false");
      return false;
    }

    restoreHourlyConfig(panel);
    ensureFlow(panel);
    bindBack(panel);
    bindMobileHourlySubmitIntercept();
    ensureMobileDurationSelect(panel);
    ensureMobileLongTermSelect(panel);
    bindMobileLongTermCtaSync(panel);
    syncMobileLongTermCta(panel);
    useAirportNativeDateField(panel);
    moveMobileDurationNextToDate(panel);
    moveMobileLongTermNextToDate(panel);
    moveMobileVehicleToFooter(panel);
    mergeMobileLongTermDisclaimers(panel);

    if (!movePanelToRoute(panel)) {
      document.body.setAttribute(BODY_SCREEN_ATTR, "false");
      document.body.setAttribute(BODY_FLOW_ATTR, "false");
      return false;
    }

    restoreHourlyConfig(panel);
    setRouteVisibility(true);

    if (window.PixkuyAnalytics && typeof window.PixkuyAnalytics.track === "function") {
      window.PixkuyAnalytics.track("pixkuy_mobile_route_open", {
        service_type: "hourly_daily",
        flow_surface: "mobile_route",
        entry_point: "mobile_home_or_deeplink"
      });
    }

    window.requestAnimationFrame(function syncAfterOpen() {
      restoreHourlyConfig(panel);
      syncCopy(panel);
      ensureMobileDurationSelect(panel);
      ensureMobileLongTermSelect(panel);
      bindMobileLongTermCtaSync(panel);
      syncMobileLongTermCta(panel);
      useAirportNativeDateField(panel);
      moveMobileDurationNextToDate(panel);
      moveMobileLongTermNextToDate(panel);
      moveMobileVehicleToFooter(panel);
      mergeMobileLongTermDisclaimers(panel);
    });

    return true;
  }
  
    function buildMobileHourlySubmitPayload(panel, detail) {
    const safeDetail = detail && typeof detail === "object" ? detail : {};
    const mode = getActiveHourlyMode(panel);
    const pickup = getMobileLongTermPickupValue(panel);
    const date = getMobileLongTermFieldValue(panel, "[data-services-hourly-date]");
    const time = getMobileLongTermFieldValue(panel, "[data-services-hourly-time]");
    const longTermValue = getMobileLongTermSelectedValue(panel);
    const notesField = panel ? panel.querySelector("[data-services-hourly-notes]") : null;
    const notes = normalizeText(notesField && typeof notesField.value === "string" ? notesField.value : "");

    if (mode !== "custom_long_term") {
      return safeDetail;
    }

    return Object.assign({}, safeDetail, {
      serviceType: "hourly_daily",
      hourly_daily_mode: "custom_long_term",
      hourly_daily_vehicle_type: normalizeText(safeDetail.hourly_daily_vehicle_type) || "executive_van",
      hourly_daily_pickup: normalizeText(safeDetail.hourly_daily_pickup) || pickup,
      hourly_daily_date: normalizeText(safeDetail.hourly_daily_date) || date,
      hourly_daily_start_time: normalizeText(safeDetail.hourly_daily_start_time) || time,
      hourly_daily_duration_hours: "",
      hourly_daily_custom_term: normalizeText(safeDetail.hourly_daily_custom_term) || longTermValue,
      hourly_daily_notes: normalizeText(safeDetail.hourly_daily_notes) || notes,
      hourly_daily_price: "",
      hourly_daily_currency: normalizeText(safeDetail.hourly_daily_currency) || "MXN",
      hourly_daily_km_included: "",
      hourly_daily_extra_km_price: normalizeText(safeDetail.hourly_daily_extra_km_price) || "35",
      hourly_daily_out_of_zone_supplement: normalizeText(safeDetail.hourly_daily_out_of_zone_supplement) || "4500"
    });
  }
  
    function trackMobileLongTermContinueClick(panel) {
    const analytics = window.PixkuyAnalytics;

    if (
      !analytics ||
      typeof analytics.track !== "function" ||
      getActiveHourlyMode(panel) !== "custom_long_term"
    ) {
      return false;
    }

    return analytics.track("pixkuy_continue_click", {
      service_type: "hourly_daily",
      flow_surface: "mobile_route",
      mode: "custom_long_term",
      duration_hours: "",
      price: "",
      currency: "MXN"
    });
  }
  
    function openMobileLongTermContactStep(panel) {
    const contactStep = getHourlyMobileContactStepApi();
    const cta = panel ? panel.querySelector("[data-services-hourly-cta]") : null;
    const mode = getActiveHourlyMode(panel);
    const detail = buildMobileHourlySubmitPayload(panel, {
      serviceType: "hourly_daily"
    });

    if (
      mode !== "custom_long_term" ||
      !panel ||
      !contactStep ||
      !cta ||
      cta.disabled ||
      cta.getAttribute("aria-disabled") === "true"
    ) {
      return false;
    }

    if (
      typeof contactStep.canOpen === "function" &&
      !contactStep.canOpen(detail)
    ) {
      syncActiveState();
      return false;
    }

    if (typeof contactStep.open === "function") {
      return contactStep.open(panel, detail);
    }

    return false;
  }
  
    function bindMobileLongTermContinue(panel) {
    const cta = panel ? panel.querySelector("[data-services-hourly-cta]") : null;

    if (!panel || !cta || cta.dataset.hourlyMobileLongTermContinueBound === "1") {
      return false;
    }

    cta.dataset.hourlyMobileLongTermContinueBound = "1";

    cta.addEventListener("click", function onLongTermContinueClick(event) {
      if (
        !isMobileViewport() ||
        !isRouteOpen ||
        getActiveHourlyMode(panel) !== "custom_long_term"
      ) {
        return;
      }

      if (cta.disabled || cta.getAttribute("aria-disabled") === "true") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (openMobileLongTermContactStep(panel)) {
        trackMobileLongTermContinueClick(panel);
      }
    }, true);

    return true;
  }

    function bindMobileHourlySubmitIntercept() {
    if (window.__hourlyMobileSubmitInterceptBound === true) {
      return true;
    }

    window.__hourlyMobileSubmitInterceptBound = true;

    window.addEventListener("pixkuy:hourly-daily-panel-submit", function onHourlyMobileSubmit(event) {
      const panel = getPanel();
      const contactStep = getHourlyMobileContactStepApi();
      const rawDetail = event && event.detail && typeof event.detail === "object"
        ? event.detail
        : null;
      const detail = buildMobileHourlySubmitPayload(panel, rawDetail);

      if (!isMobileViewport() || !isRouteOpen || !panel || !contactStep || !detail) {
        return;
      }

      event.preventDefault();

      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (
        typeof contactStep.isOpen === "function" &&
        contactStep.isOpen()
      ) {
        if (typeof contactStep.submit === "function") {
          contactStep.submit();
        }

        return;
      }

      if (
        typeof contactStep.canOpen === "function" &&
        !contactStep.canOpen(detail)
      ) {
        syncActiveState();
        return;
      }

      if (typeof contactStep.open === "function") {
        contactStep.open(panel, detail);
      }
    }, true);

    return true;
  }

  
  function closeHourlyRoute(options) {
    const panel = getPanel();
    const settings = options || {};
    const hourlyCard = getHourlyCard();

    const contactStep = getHourlyMobileContactStepApi();

    if (contactStep && typeof contactStep.close === "function") {
      contactStep.close();
    }

    restoreHourlyConfig(panel);
    setRouteVisibility(false);

    if (panel) {
      restorePanelPosition(panel);
    }

    if (
      hasDirectMobilePanelOpen &&
      panel &&
      isPanelVisible(panel)
    ) {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
      hasDirectMobilePanelOpen = false;
    } else if (
      settings.collapsePanel === true &&
      panel &&
      isPanelVisible(panel) &&
      hourlyCard &&
      typeof hourlyCard.click === "function"
    ) {
      hourlyCard.click();
    }

    if (settings.updateUrl === true) {
      removeHourlyServiceFromUrl();
    }

    return true;
  }

  function removeHourlyServiceFromUrl() {
    try {
      const url = new URL(window.location.href);
      const service = normalizeText(url.searchParams.get("service")).toLowerCase();

      if (service === "hourly_daily") {
        url.searchParams.delete("service");
      }

      if (url.hash === "#services") {
        url.hash = "";
      }

      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function pushHourlyRouteUrl() {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "hourly_daily");
      url.hash = "";

      window.history.pushState(
        { hourlyMobileRoute: true },
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}
  }

  function bindHeroEntry() {
    const link = document.querySelector(HOURLY_HERO_LINK_SELECTOR);

    if (!link || link.dataset.hourlyMobileEntryBound === "1") {
      return false;
    }

    link.dataset.hourlyMobileEntryBound = "1";

    link.addEventListener("click", function onHourlyHeroClick(event) {
      if (!isMobileViewport()) {
        return;
      }

      event.preventDefault();

      if (openHourlyRoute()) {
        pushHourlyRouteUrl();
      }
    });

    return true;
  }

  function syncActiveState() {
    const panel = getPanel();

    if (!isMobileViewport()) {
      if (isHourlyMobileContactStepOpen()) {
        const contactStep = getHourlyMobileContactStepApi();

        if (contactStep && typeof contactStep.close === "function") {
          contactStep.close();
        }
      }

      if (isRouteOpen) {
        closeHourlyRoute({ collapsePanel: false, updateUrl: false });
      }

      return false;
    }

    if (!panel || !isPanelVisible(panel)) {
      if (!isRouteOpen) {
        document.body.setAttribute(BODY_FLOW_ATTR, "false");
      }

      return false;
    }

    restoreHourlyConfig(panel);
    ensureFlow(panel);
    bindBack(panel);
    bindMobileHourlySubmitIntercept();
    bindMobileLongTermContinue(panel);
    ensureMobileDurationSelect(panel);
    ensureMobileLongTermSelect(panel);
    bindMobileLongTermCtaSync(panel);
    syncMobileLongTermCta(panel);
    useAirportNativeDateField(panel);
    moveMobileDurationNextToDate(panel);
    moveMobileLongTermNextToDate(panel);
    moveMobileVehicleToFooter(panel);
    mergeMobileLongTermDisclaimers(panel);

    return true;
  }


  function observePanel(panel) {
    if (!panel || observer) {
      return false;
    }

    observer = new MutationObserver(function onMutation() {
      syncActiveState();
    });

    observer.observe(panel, {
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "class"],
      subtree: true
    });

    return true;
  }

  function shouldOpenFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return normalizeText(params.get("service")).toLowerCase() === "hourly_daily";
    } catch (error) {
      return false;
    }
  }

  function init() {
    const panel = getPanel();

    if (!panel) {
      return false;
    }

    ensureRoute();
    observePanel(panel);
    bindHeroEntry();
    syncActiveState();

    if (isMobileViewport() && shouldOpenFromUrl()) {
      window.requestAnimationFrame(function openFromUrl() {
        openHourlyRoute();
      });
    }

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("hashchange", syncActiveState);
    window.addEventListener("popstate", function onPopState() {
      if (isRouteOpen) {
        const shouldReturnToInMotion = Boolean(inMotionReturnContext || getInMotionReturnContextFromUrl());

        closeHourlyRoute({ collapsePanel: true, updateUrl: false });

        if (shouldReturnToInMotion) {
          returnToInMotionScrollCinema();
          return;
        }

        return;
      }

      syncActiveState();
    });
	
	window.addEventListener("pixkuy:hourly-daily-panel-ui-sync", function onHourlyPanelUiSync() {
      const syncedPanel = getPanel();

      if (syncedPanel) {
        restoreHourlyConfig(syncedPanel);
        syncCopy(syncedPanel);
        ensureMobileDurationSelect(syncedPanel);
        ensureMobileLongTermSelect(syncedPanel);
        bindMobileLongTermCtaSync(syncedPanel);
        syncMobileLongTermCta(syncedPanel);
        useAirportNativeDateField(syncedPanel);
        moveMobileDurationNextToDate(syncedPanel);
        moveMobileLongTermNextToDate(syncedPanel);
        moveMobileVehicleToFooter(syncedPanel);
        mergeMobileLongTermDisclaimers(syncedPanel);
      }
    });

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      const panelAfterI18n = getPanel();

      if (panelAfterI18n) {
        restoreHourlyConfig(panelAfterI18n);
        syncCopy(panelAfterI18n);
        ensureMobileDurationSelect(panelAfterI18n);
        ensureMobileLongTermSelect(panelAfterI18n);
        bindMobileLongTermCtaSync(panelAfterI18n);
        syncMobileLongTermCta(panelAfterI18n);
        useAirportNativeDateField(panelAfterI18n);
        moveMobileDurationNextToDate(panelAfterI18n);
        moveMobileLongTermNextToDate(panelAfterI18n);
        moveMobileVehicleToFooter(panelAfterI18n);
        mergeMobileLongTermDisclaimers(panelAfterI18n);
      }

      syncActiveState();
    });

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncActiveState);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncActiveState);
    }

    return true;
  }

  window.PixkuyHourlyMobileBookingFlow = {
    open: openHourlyRoute,
    close: closeHourlyRoute,
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