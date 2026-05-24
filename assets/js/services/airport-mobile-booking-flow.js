/* assets/js/services/airport-mobile-booking-flow.js
   Airport / Hotel mobile booking flow.
   Responsabilidad:
   - abrir Airport / Hotel como vista móvil dedicada tipo route
   - mover el panel real #services-expand-airport a esa vista
   - reutilizar una sola fuente de verdad: motor Airport, tarifa, Places y handoff
   - no duplicar campos ni lógica
   - no presentar Airport como panel visual dentro de #services
*/

(function initAirportMobileBookingFlow(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const PANEL_SELECTOR = "#services-expand-airport";
  const AIRPORT_HERO_LINK_SELECTOR = '.hero-mobile-entry__action[href*="service=airport_hotel"]';
  const AIRPORT_CARD_SELECTOR = '.service-card [data-i18n="services.cards.airport.title"]';

  const BODY_FLOW_ATTR = "data-airport-mobile-flow";
  const BODY_SCREEN_ATTR = "data-airport-mobile-screen";

  const ROUTE_SELECTOR = "[data-airport-mobile-route]";
  const ROUTE_CONTENT_SELECTOR = "[data-airport-mobile-route-content]";
  const FLOW_SELECTOR = "[data-airport-mobile-flow]";
  const DIRECTION_SELECTOR = "[data-airport-mobile-direction-option]";
  const MOBILE_PASSENGERS_SELECTOR = "[data-airport-mobile-passengers]";
  const MOBILE_LUGGAGE_SELECTOR = "[data-airport-mobile-luggage]";
  const MOBILE_FARE_PENDING_SELECTOR = "[data-airport-mobile-fare-pending]";

  const DIRECTION_AIRPORT_TO_HOTEL = "airport_to_hotel";
  const DIRECTION_HOTEL_TO_AIRPORT = "hotel_to_airport";
  const IN_MOTION_RETURN_CONTEXT_KEY = "pixkuy_in_motion_scroll_cinema_return";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let observer = null;
  let routeNode = null;
  let routeContent = null;
  let originalPanelParent = null;
  let originalPanelNextSibling = null;
  let originalDestinationZoneParent = null;
  let originalDestinationZoneNextSibling = null;
  let isRouteOpen = false;
  let inMotionReturnContext = null;
  let hasDirectMobilePanelOpen = false;
  let mobileLuggageValue = "0";
  let mobileFareObserver = null;
  let mobileFareObservedNode = null;

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

  function getPanel() {
    return document.querySelector(PANEL_SELECTOR);
  }

  function getAirportCard() {
    const title = document.querySelector(AIRPORT_CARD_SELECTOR);

    return title ? title.closest(".service-card") : null;
  }

  function isPanelVisible(panel) {
    return Boolean(
      panel &&
        panel.hidden !== true &&
        panel.getAttribute("aria-hidden") !== "true"
    );
  }

  function isNodeVisible(node) {
    if (!node) {
      return false;
    }

    if (node.hidden === true || node.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return true;
  }

  function getCurrentDirection(panel) {
    const destinationAirportShell = panel
      ? panel.querySelector('[data-airport-endpoint-airport-root="1"]')
      : null;

    if (isNodeVisible(destinationAirportShell)) {
      return DIRECTION_HOTEL_TO_AIRPORT;
    }

    return DIRECTION_AIRPORT_TO_HOTEL;
  }
  
  function getDirectionButtons(panel) {
    return panel
      ? Array.from(panel.querySelectorAll(DIRECTION_SELECTOR))
      : [];
  }

  function getDirectionLabelParts(panel, direction) {
    const button = panel
      ? panel.querySelector(
          '[data-airport-mobile-direction-option="' + direction + '"]'
        )
      : null;
    const text = normalizeText(button ? button.textContent : "");
    const parts = text
      .split("→")
      .map(normalizeText)
      .filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    return {
      origin: parts[0],
      destination: parts[1]
    };
  }

  function syncRouteFieldLabels(panel, direction) {
    const labels = getDirectionLabelParts(panel, direction);
    const originLabel = panel
      ? panel.querySelector(
          '[data-airport-tariff-role="origin"] .services-expand__label'
        )
      : null;
    const destinationLabel = panel
      ? panel.querySelector(
          '[data-airport-tariff-role="destination"] .services-expand__label'
        )
      : null;

    if (!labels) {
      return false;
    }

    if (originLabel) {
      originLabel.textContent = labels.origin;
    }

    if (destinationLabel) {
      destinationLabel.textContent = labels.destination;
    }

    return true;
  }

  function getHotelFieldForDirection(panel, direction) {
    const role =
      direction === DIRECTION_HOTEL_TO_AIRPORT ? "origin" : "destination";

    return panel
      ? panel.querySelector('[data-airport-tariff-role="' + role + '"]')
      : null;
  }

  function getDestinationZoneNode(panel) {
    return panel
      ? panel.querySelector('[data-airport-destination-zone="1"]')
      : null;
  }

  function rememberOriginalDestinationZonePosition(zone) {
    if (!zone || originalDestinationZoneParent) {
      return false;
    }

    originalDestinationZoneParent = zone.parentNode;
    originalDestinationZoneNextSibling = zone.nextSibling;

    return true;
  }

  function moveDestinationZoneUnderHotel(panel) {
    const direction = getCurrentDirection(panel);
    const hotelField = getHotelFieldForDirection(panel, direction);
    const zone = getDestinationZoneNode(panel);
    const hotelRole =
      direction === DIRECTION_HOTEL_TO_AIRPORT ? "origin" : "destination";

    if (!hotelField || !zone) {
      return false;
    }

    rememberOriginalDestinationZonePosition(zone);

    zone.setAttribute("data-airport-mobile-zone-after", hotelRole);
    hotelField.insertAdjacentElement("afterend", zone);

    return true;
  }

  function restoreDestinationZonePosition() {
    const zone = document.querySelector('[data-airport-destination-zone="1"]');

    if (!zone || !originalDestinationZoneParent) {
      return false;
    }

    zone.removeAttribute("data-airport-mobile-zone-after");

    if (
      originalDestinationZoneNextSibling &&
      originalDestinationZoneNextSibling.parentNode === originalDestinationZoneParent
    ) {
      originalDestinationZoneParent.insertBefore(
        zone,
        originalDestinationZoneNextSibling
      );
    } else {
      originalDestinationZoneParent.appendChild(zone);
    }

    return true;
  }

  function syncDirectionButtons(panel) {
    const direction = getCurrentDirection(panel);
    const buttons = getDirectionButtons(panel);

    buttons.forEach(function syncButton(button) {
      const option = normalizeText(
        button.getAttribute("data-airport-mobile-direction-option")
      );
      const isActive = option === direction;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("data-airport-mobile-direction-active", isActive ? "true" : "false");
    });

    syncRouteFieldLabels(panel, direction);
    moveDestinationZoneUnderHotel(panel);

    return true;
  }

  function syncCopy(panel) {
    const back = panel.querySelector("[data-airport-mobile-flow-back]");
    const title = panel.querySelector("[data-airport-mobile-flow-title]");
    const helper = panel.querySelector("[data-airport-mobile-flow-helper]");
    const note = panel.querySelector("[data-airport-mobile-flow-note]");
    const cta = panel.querySelector(".services-expand__cta");
    const direction = panel.querySelector(".airport-mobile-flow__direction");
    const airportToHotel = panel.querySelector('[data-airport-mobile-direction-option="airport_to_hotel"]');
    const hotelToAirport = panel.querySelector('[data-airport-mobile-direction-option="hotel_to_airport"]');

    const backText = getI18nValue(
      "airportMobileFlow.back",
      getI18nValue("services.cards.airport.panel.back", "")
    );
    const titleText = getI18nValue(
      "airportMobileFlow.title",
      getI18nValue("contact.services.airportHotel", "")
    );
    const helperText = getI18nValue(
      "airportMobileFlow.helper",
      getI18nValue("services.cards.airport.text", "")
    );
    const noteText = getI18nValue(
      "airportMobileFlow.note",
      getI18nValue("hero.note", "")
    );
    const ctaText = getI18nValue("airportMobileFlow.cta.continue", "");
    const airportToHotelText = getI18nValue(
      "airportMobileFlow.direction.airportToHotel",
      getI18nValue("contact.services.airportHotelDirectionAirportToHotel", "")
    );
    const hotelToAirportText = getI18nValue(
      "airportMobileFlow.direction.hotelToAirport",
      getI18nValue("contact.services.airportHotelDirectionHotelToAirport", "")
    );
    const directionLabel = [airportToHotelText, hotelToAirportText]
      .filter(Boolean)
      .join(" / ");

    if (back && backText) {
      back.textContent = backText;
    }

    if (title && titleText) {
      title.textContent = titleText;
    }

    if (helper && helperText) {
      helper.textContent = helperText;
    }

    if (note && noteText) {
      note.textContent = noteText;
    }

    if (cta && ctaText) {
      cta.textContent = ctaText;
    }

    if (direction && directionLabel) {
      direction.setAttribute("aria-label", directionLabel);
    }

    if (airportToHotel && airportToHotelText) {
      airportToHotel.textContent = airportToHotelText;
    }

    if (hotelToAirport && hotelToAirportText) {
      hotelToAirport.textContent = hotelToAirportText;
    }
  }

  function buildRouteNode() {
    const route = document.createElement("section");
    const screen = document.createElement("div");
    const content = document.createElement("div");

    route.className = "airport-mobile-route";
    route.setAttribute("data-airport-mobile-route", "1");
    route.setAttribute("aria-hidden", "true");
    route.hidden = true;

    screen.className = "airport-mobile-route__screen";

    content.className = "airport-mobile-route__content";
    content.setAttribute("data-airport-mobile-route-content", "1");

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
    const direction = document.createElement("div");
    const airportToHotel = document.createElement("button");
    const hotelToAirport = document.createElement("button");

    flow.className = "airport-mobile-flow";
    flow.setAttribute("data-airport-mobile-flow", "1");

    backRow.className = "airport-mobile-flow__back-row";

    back.type = "button";
    back.className = "airport-mobile-flow__back";
    back.setAttribute("data-airport-mobile-flow-back", "1");

    header.className = "airport-mobile-flow__header";

    title.className = "airport-mobile-flow__title";
    title.setAttribute("data-airport-mobile-flow-title", "1");

    helper.className = "airport-mobile-flow__helper";
    helper.setAttribute("data-airport-mobile-flow-helper", "1");

    direction.className = "airport-mobile-flow__direction";
    direction.setAttribute("role", "group");
    direction.setAttribute("aria-label", "");

    airportToHotel.type = "button";
    airportToHotel.className = "airport-mobile-flow__direction-button";
    airportToHotel.setAttribute("data-airport-mobile-direction-option", DIRECTION_AIRPORT_TO_HOTEL);
    airportToHotel.setAttribute("aria-pressed", "true");

    hotelToAirport.type = "button";
    hotelToAirport.className = "airport-mobile-flow__direction-button";
    hotelToAirport.setAttribute("data-airport-mobile-direction-option", DIRECTION_HOTEL_TO_AIRPORT);
    hotelToAirport.setAttribute("aria-pressed", "false");

    backRow.appendChild(back);
    header.appendChild(title);
    header.appendChild(helper);
    direction.appendChild(airportToHotel);
    direction.appendChild(hotelToAirport);

    flow.appendChild(backRow);
    flow.appendChild(header);
    flow.appendChild(direction);

    return flow;
  }

  function ensureNote(panel) {
    const actions = panel.querySelector(".services-expand__actions");
    let note = panel.querySelector("[data-airport-mobile-flow-note]");

    if (!actions) {
      return null;
    }

    if (note) {
      return note;
    }

    note = document.createElement("p");
    note.className = "airport-mobile-flow__note";
    note.setAttribute("data-airport-mobile-flow-note", "1");

    actions.insertAdjacentElement("afterend", note);

    return note;
  }

  function ensureFlow(panel) {
    const form = panel.querySelector(".services-expand__form");
    let flow = panel.querySelector(FLOW_SELECTOR);

    if (!form) {
      return null;
    }

    if (!flow) {
      flow = buildFlowNode();
      form.insertAdjacentElement("beforebegin", flow);
    }

    ensureNote(panel);
    syncCopy(panel);
    syncDirectionButtons(panel);

    return flow;
  }

  function clickSwap(panel) {
    const swapButton = panel.querySelector("#airport-tariff-swap");

    if (!swapButton || typeof swapButton.click !== "function") {
      return false;
    }

    swapButton.click();

    window.requestAnimationFrame(function syncAfterSwap() {
      syncDirectionButtons(panel);
    });

    return true;
  }

  function bindDirection(panel) {
    const buttons = getDirectionButtons(panel);

    buttons.forEach(function bindButton(button) {
      if (button.dataset.airportMobileDirectionBound === "1") {
        return;
      }

      button.dataset.airportMobileDirectionBound = "1";

      button.addEventListener("click", function handleDirectionClick() {
        const nextDirection = normalizeText(
          button.getAttribute("data-airport-mobile-direction-option")
        );
        const currentDirection = getCurrentDirection(panel);

        if (!nextDirection || nextDirection === currentDirection) {
          syncDirectionButtons(panel);
          return;
        }

        clickSwap(panel);
      });
    });
  }
  
  function getAirportTariffApi() {
    const api = window.PixkuyAirportZoneTariff;

    return api && typeof api === "object" ? api : null;
  }
  
    function getAirportPrefillFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const airportId = normalizeText(params.get("airport_id"));
      const direction = normalizeText(params.get("airport_direction"));

      return {
        airportId,
        direction
      };
    } catch (error) {
      return {
        airportId: "",
        direction: ""
      };
    }
  }

  function applyAirportPrefillFromUrl(panel) {
    const api = getAirportTariffApi();
    const prefill = getAirportPrefillFromUrl();

    if (
      !panel ||
      !api ||
      typeof api.setAirportSelection !== "function" ||
      !prefill.airportId
    ) {
      return false;
    }

    api.setAirportSelection({
      airportId: prefill.airportId,
      direction: prefill.direction || getCurrentDirection(panel)
    });

    syncDirectionButtons(panel);

    return true;
  }

  function applyAirportDirectionPrefillFromUrl(panel) {
    const prefill = getAirportPrefillFromUrl();
    const direction = normalizeText(prefill.direction);

    if (
      !panel ||
      (
        direction !== DIRECTION_AIRPORT_TO_HOTEL &&
        direction !== DIRECTION_HOTEL_TO_AIRPORT
      )
    ) {
      return false;
    }

    if (getCurrentDirection(panel) !== direction) {
      clickSwap(panel);
    }

    syncDirectionButtons(panel);

    return true;
  }

  function getMobilePassengersNode(panel) {
    return panel ? panel.querySelector(MOBILE_PASSENGERS_SELECTOR) : null;
  }

  function getPassengerField(panel) {
    return panel
      ? panel.querySelector('[data-airport-tariff-role="passengers"]')
      : null;
  }

  function getPassengerSourceOptions(panel) {
    const passengerField = getPassengerField(panel);

    if (!passengerField) {
      return [];
    }

    return Array.from(
      passengerField.querySelectorAll("[data-airport-tariff-passenger-option]")
    )
      .map(function mapPassengerOption(button) {
        const fareKey = normalizeText(
          button.dataset.airportTariffFareKey ||
          button.dataset.airportTariffPassengerOption ||
          ""
        );
        const label = normalizeText(button.textContent);

        if (!fareKey || !label) {
          return null;
        }

        return {
          fareKey: fareKey,
          label: label
        };
      })
      .filter(Boolean);
  }

  function getSelectedPassengerFareKey() {
    const api = getAirportTariffApi();
    const state =
      api && typeof api.getState === "function" ? api.getState() : null;

    return state ? normalizeText(state.selectedFareKey) : "";
  }

  function getDefaultPassengerFareKey(options) {
    const safeOptions = Array.isArray(options) ? options : [];
    const preferred = safeOptions.find(function findPreferredPassenger(option) {
      return option && option.fareKey === "van_1_2";
    });
    const first = safeOptions.length ? safeOptions[0] : null;

    return normalizeText(
      preferred ? preferred.fareKey : (first ? first.fareKey : "")
    );
  }

  function ensureDefaultPassengerFareKey(panel, options) {
    const api = getAirportTariffApi();
    const selectedFareKey = getSelectedPassengerFareKey();
    const defaultFareKey = getDefaultPassengerFareKey(options);

    if (selectedFareKey || !defaultFareKey) {
      return selectedFareKey || defaultFareKey;
    }

    if (api && typeof api.setFareKeySelection === "function") {
      api.setFareKeySelection({
        fareKey: defaultFareKey
      });
    }

    return defaultFareKey;
  }

  function closeMobilePassengers() {
    return true;
  }

  function syncMobilePassengers(panel) {
    const node = getMobilePassengersNode(panel);
    const passengerField = getPassengerField(panel);
    const sourceLabel = passengerField
      ? passengerField.querySelector(".services-expand__label")
      : null;
    const label = node
      ? node.querySelector("[data-airport-mobile-passengers-label]")
      : null;
    const select = node
      ? node.querySelector("[data-airport-mobile-passengers-select]")
      : null;
    const options = getPassengerSourceOptions(panel);
    const selectedFareKey = ensureDefaultPassengerFareKey(panel, options);
    const fallbackLabel = normalizeText(sourceLabel ? sourceLabel.textContent : "");
    const passengerLabel = getI18nValue(
      "airportMobileFlow.fields.passengers",
      fallbackLabel
    );

    if (!node || !label || !select) {
      return false;
    }

    label.textContent = passengerLabel;
    select.setAttribute("aria-label", passengerLabel);
    select.innerHTML = "";

    options.forEach(function renderOption(option) {
      const item = document.createElement("option");

      item.value = option.fareKey;
      item.textContent = option.label;
      item.selected = option.fareKey === selectedFareKey;

      select.appendChild(item);
    });

    select.value = selectedFareKey || getDefaultPassengerFareKey(options);

    return true;
  }

  function selectMobilePassengerOption(panel, fareKey) {
    const api = getAirportTariffApi();
    const safeFareKey = normalizeText(fareKey);

    if (!api || typeof api.setFareKeySelection !== "function" || !safeFareKey) {
      return false;
    }

    api.setFareKeySelection({
      fareKey: safeFareKey
    });

    syncMobilePassengers(panel);

    return true;
  }

  function buildMobilePassengersNode() {
    const node = document.createElement("div");
    const label = document.createElement("span");
    const select = document.createElement("select");

    node.className = "airport-mobile-passengers";
    node.setAttribute("data-airport-mobile-passengers", "1");

    label.className = "airport-mobile-passengers__label";
    label.setAttribute("data-airport-mobile-passengers-label", "1");

    select.className = "airport-mobile-passengers__select";
    select.setAttribute("data-airport-mobile-passengers-select", "1");
    select.setAttribute("aria-label", "");

    node.appendChild(label);
    node.appendChild(select);

    return node;
  }

  function bindMobilePassengers(panel, node) {
    const select = node
      ? node.querySelector("[data-airport-mobile-passengers-select]")
      : null;

    if (!panel || !node || !select || node.dataset.airportMobilePassengersBound === "1") {
      return false;
    }

    node.dataset.airportMobilePassengersBound = "1";

    select.addEventListener("change", function onMobilePassengersChange() {
      selectMobilePassengerOption(panel, select.value);
    });

    return true;
  }

  function ensureMobilePassengers(panel) {
    const passengerField = getPassengerField(panel);
    let node = getMobilePassengersNode(panel);

    if (!panel || !passengerField) {
      return false;
    }

    if (!node) {
      node = buildMobilePassengersNode();
      passengerField.insertAdjacentElement("afterend", node);
    }

    bindMobilePassengers(panel, node);
    syncMobilePassengers(panel);

    return true;
  }

  function getMobileLuggageNode(panel) {
    return panel ? panel.querySelector(MOBILE_LUGGAGE_SELECTOR) : null;
  }

  function getMobileLuggageLabel() {
    return getI18nValue(
      "airportMobileFlow.fields.luggage",
      getI18nValue("contact.luggage", "")
    );
  }

  function buildMobileLuggageNode() {
    const node = document.createElement("div");
    const label = document.createElement("span");
    const select = document.createElement("select");
    let index;

    node.className = "airport-mobile-luggage";
    node.setAttribute("data-airport-mobile-luggage", "1");

    label.className = "airport-mobile-luggage__label";
    label.setAttribute("data-airport-mobile-luggage-label", "1");

    select.className = "airport-mobile-luggage__select";
    select.setAttribute("data-airport-mobile-luggage-select", "1");
    select.setAttribute("aria-label", getMobileLuggageLabel());

    for (index = 0; index <= 6; index += 1) {
      const option = document.createElement("option");
      const value = String(index);

      option.value = value;
      option.textContent = value;

      select.appendChild(option);
    }

    node.appendChild(label);
    node.appendChild(select);

    return node;
  }

  function syncMobileLuggage(panel) {
    const node = getMobileLuggageNode(panel);
    const label = node
      ? node.querySelector("[data-airport-mobile-luggage-label]")
      : null;
    const select = node
      ? node.querySelector("[data-airport-mobile-luggage-select]")
      : null;

    if (!node || !label || !select) {
      return false;
    }

    label.textContent = getMobileLuggageLabel();
    select.setAttribute("aria-label", getMobileLuggageLabel());
    select.value = mobileLuggageValue;

    return true;
  }

  function bindMobileLuggage(panel, node) {
    const select = node
      ? node.querySelector("[data-airport-mobile-luggage-select]")
      : null;

    if (!panel || !node || !select || node.dataset.airportMobileLuggageBound === "1") {
      return false;
    }

    node.dataset.airportMobileLuggageBound = "1";

    select.addEventListener("change", function onMobileLuggageChange() {
      mobileLuggageValue = normalizeText(select.value) || "0";
      syncMobileLuggage(panel);
    });

    return true;
  }
  
    function ensureMobileLuggage(panel) {
    const passengersNode = getMobilePassengersNode(panel);
    let node = getMobileLuggageNode(panel);

    if (!panel || !passengersNode) {
      return false;
    }

    if (!node) {
      node = buildMobileLuggageNode();
      passengersNode.insertAdjacentElement("afterend", node);
    }

    bindMobileLuggage(panel, node);
    syncMobileLuggage(panel);

    return true;
  }

  function getMobileFareNode(panel) {
    return panel ? panel.querySelector(".services-expand__fare") : null;
  }

  function getMobileFareField(panel) {
    return panel ? panel.querySelector(".services-expand__field--fare") : null;
  }

  function getMobileFarePendingNode(panel) {
    return panel ? panel.querySelector(MOBILE_FARE_PENDING_SELECTOR) : null;
  }

  function buildMobileFarePendingNode() {
    const node = document.createElement("p");

    node.className = "airport-mobile-fare-pending";
    node.setAttribute("data-airport-mobile-fare-pending", "1");
    node.hidden = true;

    return node;
  }

  function ensureMobileFarePendingNode(panel) {
    const field = getMobileFareField(panel);
    let node = getMobileFarePendingNode(panel);

    if (!field) {
      return null;
    }

    if (!node) {
      node = buildMobileFarePendingNode();
      field.appendChild(node);
    }

    return node;
  }

  function getMobileFareRawValue(fare) {
    const rawTextNodes = fare
      ? Array.from(fare.childNodes).filter(function filterRawTextNode(node) {
          return (
            node &&
            node.nodeType === window.Node.TEXT_NODE &&
            normalizeText(node.textContent)
          );
        })
      : [];
    const latestRawTextNode = rawTextNodes.length
      ? rawTextNodes[rawTextNodes.length - 1]
      : null;
    const amountNode = fare
      ? fare.querySelector("[data-airport-mobile-fare-amount]")
      : null;
    const currencyNode = fare
      ? fare.querySelector("[data-airport-mobile-fare-currency]")
      : null;

    if (latestRawTextNode) {
      return normalizeText(latestRawTextNode.textContent);
    }

    if (amountNode) {
      return [
        normalizeText(amountNode.textContent),
        normalizeText(currencyNode ? currencyNode.textContent : "")
      ].filter(Boolean).join(" ");
    }

    return normalizeText(fare ? fare.textContent : "");
  }

  function getMobileFareParts(value) {
    const rawValue = normalizeText(value).replace(/\s+/g, " ");
    const amount = normalizeText(rawValue.replace(/\bMXN\b/gi, ""));

    if (!amount || amount === "—") {
      return {
        amount: amount || "—",
        currency: ""
      };
    }

    return {
      amount: amount,
      currency: "MXN"
    };
  }
  
    function trackAirportMobileQuoteReady(panel, parts) {
    const analytics = window.PixkuyAnalytics;
    const direction = getCurrentDirection(panel);
    const passengerFareKey = getSelectedPassengerFareKey();
    const amount = parts && parts.amount ? normalizeText(parts.amount) : "";
    const currency = parts && parts.currency ? normalizeText(parts.currency) : "";
    const dedupeKey = [
      "airport_hotel",
      direction,
      passengerFareKey,
      mobileLuggageValue,
      amount,
      currency
    ].join("|");

    if (
      !analytics ||
      typeof analytics.trackOnce !== "function" ||
      !isMobileViewport() ||
      !isRouteOpen ||
      !amount ||
      !currency
    ) {
      return false;
    }

    return analytics.trackOnce("pixkuy_mobile_quote_ready", {
      service_type: "airport_hotel",
      flow_surface: "mobile_route",
      direction: direction,
      passenger_fare_key: passengerFareKey,
      luggage: mobileLuggageValue,
      price_label: amount,
      currency: currency
    }, dedupeKey);
  }

  function hasMobileHotelSelection(panel) {
    const zone = getDestinationZoneNode(panel);
    const zoneValue = zone
      ? zone.querySelector("[data-airport-destination-zone-value]")
      : null;

    if (!zone || zone.hidden === true || zone.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return Boolean(normalizeText(zoneValue ? zoneValue.textContent : ""));
  }

  function getMobileFieldValue(panel, selector) {
    const field = panel ? panel.querySelector(selector) : null;

    return normalizeText(field && "value" in field ? field.value : "");
  }

  function getMobileFareMissingFieldKeys(panel) {
    const missing = [];

    if (!hasMobileHotelSelection(panel)) {
      missing.push("hotel");
    }

    if (!getMobileFieldValue(panel, "[data-airport-tariff-date]")) {
      missing.push("date");
    }

    if (!getMobileFieldValue(panel, "[data-airport-tariff-time]")) {
      missing.push("time");
    }

    return missing;
  }
  
    function normalizeListSeparatorValue(value, fallback) {
    const raw = typeof value === "string" ? value : "";
    const separator = raw.trim();
    const spacedWordSeparators = [
      "y",
      "and",
      "und",
      "et",
      "e",
      "и",
      "및"
    ];

    if (!separator) {
      return fallback;
    }

    if (separator === ",") {
      return ", ";
    }

    if (separator === "、") {
      return "、";
    }

    if (spacedWordSeparators.indexOf(separator) >= 0) {
      return " " + separator + " ";
    }

    return separator;
  }

  function joinMobileFareMissingLabels(labels) {
    const safeLabels = Array.isArray(labels) ? labels.filter(Boolean) : [];
    const separator = normalizeListSeparatorValue(
      getI18nValue("airportMobileFlow.farePending.separator", ", "),
      ", "
    );
    const finalSeparator = normalizeListSeparatorValue(
      getI18nValue("airportMobileFlow.farePending.finalSeparator", " y "),
      " y "
    );

    if (safeLabels.length <= 1) {
      return safeLabels[0] || "";
    }

    if (safeLabels.length === 2) {
      return safeLabels[0] + finalSeparator + safeLabels[1];
    }

    return safeLabels.slice(0, -1).join(separator) +
      finalSeparator +
      safeLabels[safeLabels.length - 1];
  }

  function getMobileFarePendingText(panel) {
    const missingKeys = getMobileFareMissingFieldKeys(panel);
    const template = getI18nValue("airportMobileFlow.farePending.template", "");
    const labels = missingKeys.map(function mapMissingKey(key) {
      return getI18nValue("airportMobileFlow.farePending.fields." + key, "");
    });
    const fields = joinMobileFareMissingLabels(labels);

    if (!template || !fields) {
      return "";
    }

    return template.replace("{fields}", fields);
  }

  function disconnectMobileFareObserver() {
    if (mobileFareObserver) {
      mobileFareObserver.disconnect();
      mobileFareObserver = null;
    }

    if (mobileFareObservedNode) {
      delete mobileFareObservedNode.dataset.airportMobileFareObserved;
      mobileFareObservedNode = null;
    }

    return true;
  }

  function setMobileContinueAvailability(panel, isReady) {
    const cta = panel ? panel.querySelector(".services-expand__cta") : null;

    if (!cta) {
      return false;
    }

    cta.disabled = !isReady;
    cta.setAttribute("aria-disabled", isReady ? "false" : "true");
    cta.setAttribute("data-airport-mobile-continue-ready", isReady ? "true" : "false");

    return true;
  }

  function setMobileFarePendingState(panel, isPending) {
    const field = getMobileFareField(panel);
    const fare = getMobileFareNode(panel);
    const label = field ? field.querySelector(".services-expand__label") : null;
    const pending = ensureMobileFarePendingNode(panel);
    const pendingText = getMobileFarePendingText(panel);

    if (!field || !fare || !pending) {
      return false;
    }

    field.setAttribute(
      "data-airport-mobile-fare-state",
      isPending ? "pending" : "ready"
    );

    fare.hidden = isPending;
    pending.hidden = !isPending || !pendingText;

    if (label) {
      label.hidden = isPending;
    }

    pending.textContent = isPending ? pendingText : "";

    setMobileContinueAvailability(panel, !isPending);

    return true;
  }

  function syncMobileFare(panel) {
    const fare = getMobileFareNode(panel);
    const currentAmount = fare
      ? fare.querySelector("[data-airport-mobile-fare-amount]")
      : null;
    const currentCurrency = fare
      ? fare.querySelector("[data-airport-mobile-fare-currency]")
      : null;
    const parts = getMobileFareParts(getMobileFareRawValue(fare));
    const missingKeys = getMobileFareMissingFieldKeys(panel);
    const shouldShowPending = missingKeys.length > 0 || !parts.currency;
    const amount = document.createElement("span");
    const currency = document.createElement("span");

    if (!panel || !fare || !isMobileViewport() || !isRouteOpen) {
      return false;
    }

    if (shouldShowPending) {
      setMobileFarePendingState(panel, true);
      observeMobileFare(panel);
      return true;
    }

    setMobileFarePendingState(panel, false);
    trackAirportMobileQuoteReady(panel, parts);

    if (
      currentAmount &&
      currentCurrency &&
      normalizeText(currentAmount.textContent) === parts.amount &&
      normalizeText(currentCurrency.textContent) === parts.currency
    ) {
      return true;
    }

    disconnectMobileFareObserver();

    fare.textContent = "";

    amount.className = "services-expand__fare-amount";
    amount.setAttribute("data-airport-mobile-fare-amount", "1");
    amount.textContent = parts.amount;

    fare.appendChild(amount);

    if (parts.currency) {
      currency.className = "services-expand__fare-currency";
      currency.setAttribute("data-airport-mobile-fare-currency", "1");
      currency.textContent = parts.currency;

      fare.appendChild(currency);
    }

    observeMobileFare(panel);

    return true;
  }

  function observeMobileFare(panel) {
    const fare = getMobileFareNode(panel);

    if (!panel || !fare || fare.dataset.airportMobileFareObserved === "1") {
      return false;
    }

    mobileFareObservedNode = fare;
    fare.dataset.airportMobileFareObserved = "1";

    mobileFareObserver = new MutationObserver(function onFareMutation() {
      disconnectMobileFareObserver();
      syncMobileFare(panel);
    });

    mobileFareObserver.observe(fare, {
      childList: true,
      characterData: true,
      subtree: true
    });

    return true;
  }

  function bindMobileFareDependencies(panel) {
    if (!panel || panel.dataset.airportMobileFareDependenciesBound === "1") {
      return false;
    }

    panel.dataset.airportMobileFareDependenciesBound = "1";

    panel.addEventListener("input", function onMobileFareInput(event) {
      if (
        !event.target ||
        !event.target.matches("[data-airport-tariff-date], [data-airport-tariff-time]")
      ) {
        return;
      }

      window.requestAnimationFrame(function syncAfterInput() {
        syncMobileFare(panel);
      });
    });

    panel.addEventListener("change", function onMobileFareChange(event) {
      if (
        !event.target ||
        !event.target.matches(
          "[data-airport-tariff-date], [data-airport-tariff-time], [data-airport-mobile-passengers-select], [data-airport-mobile-luggage-select]"
        )
      ) {
        return;
      }

      window.requestAnimationFrame(function syncAfterChange() {
        syncMobileFare(panel);
      });
    });

    return true;
  }

  function ensureMobileFare(panel) {
    bindMobileFareDependencies(panel);
    syncMobileFare(panel);
    observeMobileFare(panel);

    return true;
  }

  function getAirportCatalogApi() {
    const api = window.PixkuyAirportTariffCatalog;

    return api && typeof api === "object" ? api : null;
  }

  function getAirportMobilePicker() {
    return document.querySelector("[data-airport-mobile-airport-picker]");
  }

  function buildAirportMobilePicker() {
    const picker = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const title = document.createElement("p");
    const close = document.createElement("button");
    const list = document.createElement("div");

    picker.className = "airport-mobile-airport-picker";
    picker.setAttribute("data-airport-mobile-airport-picker", "1");
    picker.setAttribute("aria-hidden", "true");
    picker.hidden = true;

    panel.className = "airport-mobile-airport-picker__panel";

    header.className = "airport-mobile-airport-picker__header";

    title.className = "airport-mobile-airport-picker__title";
    title.setAttribute("data-airport-mobile-airport-picker-title", "1");

    close.type = "button";
    close.className = "airport-mobile-airport-picker__close";
    close.setAttribute("data-airport-mobile-airport-picker-close", "1");

    list.className = "airport-mobile-airport-picker__list";
    list.setAttribute("data-airport-mobile-airport-picker-list", "1");

    header.appendChild(title);
    header.appendChild(close);
    panel.appendChild(header);
    panel.appendChild(list);
    picker.appendChild(panel);

    return picker;
  }

  function ensureAirportMobilePicker() {
    let picker = getAirportMobilePicker();

    if (picker) {
      return picker;
    }

    ensureRoute();

    picker = buildAirportMobilePicker();

    if (routeNode) {
      routeNode.appendChild(picker);
    } else {
      document.body.appendChild(picker);
    }

    bindAirportMobilePickerEvents(picker);

    return picker;
  }

  function getSelectedAirportIdForDirection(direction) {
    const api = getAirportTariffApi();
    const state =
      api && typeof api.getState === "function" ? api.getState() : null;

    if (!state) {
      return "";
    }

    if (direction === DIRECTION_HOTEL_TO_AIRPORT) {
      return normalizeText(state.destinationValue);
    }

    return normalizeText(state.originValue);
  }

  function renderAirportMobilePickerOptions(picker, direction) {
    const catalog = getAirportCatalogApi();
    const list = picker.querySelector("[data-airport-mobile-airport-picker-list]");
    const title = picker.querySelector("[data-airport-mobile-airport-picker-title]");
    const close = picker.querySelector("[data-airport-mobile-airport-picker-close]");
    const selectedAirportId = getSelectedAirportIdForDirection(direction);
    const airports =
      catalog && typeof catalog.getActiveItemsByType === "function"
        ? catalog.getActiveItemsByType("airport")
        : [];

    if (title) {
      title.textContent = getI18nValue("contact.services.airportHotelAirportLabel", "");
    }

    if (close) {
      close.textContent = getI18nValue("services.cards.airport.panel.back", "");
    }

    if (!list) {
      return false;
    }

    list.innerHTML = "";

    airports.forEach(function renderAirportOption(item) {
      const airportId = normalizeText(item && item.id);
      const label =
        catalog && typeof catalog.resolveItemLabel === "function"
          ? normalizeText(catalog.resolveItemLabel(item))
          : "";
      const option = document.createElement("button");
      const isSelected = airportId && airportId === selectedAirportId;

      if (!airportId || !label) {
        return;
      }

      option.type = "button";
      option.className = "airport-mobile-airport-picker__option";
      option.dataset.airportMobileAirportOption = airportId;
      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.textContent = label;

      list.appendChild(option);
    });

    return true;
  }

  function openAirportMobilePicker(panel) {
    const picker = ensureAirportMobilePicker();
    const direction = getCurrentDirection(panel);

    picker.dataset.airportMobileAirportPickerDirection = direction;

    renderAirportMobilePickerOptions(picker, direction);

    picker.hidden = false;
    picker.setAttribute("aria-hidden", "false");

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

  function closeAirportMobilePicker() {
    const picker = getAirportMobilePicker();

    if (!picker) {
      return false;
    }

    blurActiveElementInside(picker);

    picker.hidden = true;
    picker.setAttribute("aria-hidden", "true");
    picker.dataset.airportMobileAirportPickerDirection = "";

    return true;
  }

  function selectAirportFromMobilePicker(airportId) {
    const picker = getAirportMobilePicker();
    const api = getAirportTariffApi();
    const panel = getPanel();
    const direction =
      picker && picker.dataset
        ? normalizeText(picker.dataset.airportMobileAirportPickerDirection)
        : "";

    if (
      !airportId ||
      !api ||
      typeof api.setAirportSelection !== "function" ||
      !panel
    ) {
      return false;
    }

    const applied = api.setAirportSelection({
      airportId: airportId,
      direction: direction || getCurrentDirection(panel)
    });

    closeAirportMobilePicker();

    window.requestAnimationFrame(function syncAirportMobilePickerSelection() {
      const nextPanel = getPanel();

      if (nextPanel) {
        syncCopy(nextPanel);
        syncDirectionButtons(nextPanel);
      }
    });

    return applied;
  }

  function bindAirportMobilePickerEvents(picker) {
    if (!picker || picker.dataset.airportMobilePickerBound === "1") {
      return false;
    }

    picker.dataset.airportMobilePickerBound = "1";

    picker.addEventListener("click", function onPickerClick(event) {
      const close = event.target.closest("[data-airport-mobile-airport-picker-close]");
      const option = event.target.closest("[data-airport-mobile-airport-option]");
      const panel = event.target.closest(".airport-mobile-airport-picker__panel");

      if (close) {
        closeAirportMobilePicker();
        return;
      }

      if (option) {
        selectAirportFromMobilePicker(
          normalizeText(option.dataset.airportMobileAirportOption)
        );
        return;
      }

      if (!panel) {
        closeAirportMobilePicker();
      }
    });

    return true;
  }

  function getAirportShellControlFromTarget(target) {
    const control = target
      ? target.closest(".services-expand__control")
      : null;

    if (!control) {
      return null;
    }

    if (!control.closest(".services-expand__airport-shell")) {
      return null;
    }

    return control;
  }

  function bindAirportMobilePicker(panel) {
    if (!panel || panel.dataset.airportMobilePickerPanelBound === "1") {
      return false;
    }

    panel.dataset.airportMobilePickerPanelBound = "1";

    panel.addEventListener(
      "click",
      function onAirportControlClick(event) {
        const control = getAirportShellControlFromTarget(event.target);

        if (!isMobileViewport() || !isRouteOpen || !control) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        openAirportMobilePicker(panel);
      },
      true
    );

    panel.addEventListener(
      "keydown",
      function onAirportControlKeydown(event) {
        const control = getAirportShellControlFromTarget(event.target);

        if (!isMobileViewport() || !isRouteOpen || !control) {
          return;
        }

        if (
          event.key !== "Enter" &&
          event.key !== " " &&
          event.key !== "ArrowDown" &&
          event.key !== "ArrowUp"
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        openAirportMobilePicker(panel);
      },
      true
    );

    return true;
  }

  function getAirportMobileContactStepApi() {
    const api = window.PixkuyAirportMobileContactStep;

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

  function returnToDirectTransferRoute() {
    const api = window.PixkuyDirectTransferMobileBookingFlow;

    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "direct_transfer");
      url.searchParams.delete("return_to");
      url.searchParams.delete("airport_id");
      url.searchParams.delete("airport_direction");
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
    const context = getResolvedInMotionReturnContext();
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
      url.searchParams.delete("airport_id");
      url.searchParams.delete("airport_direction");
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

  function bindBack(panel) {
    const back = panel.querySelector("[data-airport-mobile-flow-back]");

    if (!back || back.dataset.airportMobileBackBound === "1") {
      return false;
    }

    back.dataset.airportMobileBackBound = "1";

    back.addEventListener("click", function onBackClick() {
      const contactStep = getAirportMobileContactStepApi();

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
        closeAirportRoute({ collapsePanel: true, updateUrl: false });
        returnToDirectTransferRoute();
        return;
      }

      if (shouldReturnToInMotionScrollCinema()) {
        inMotionReturnContext = getResolvedInMotionReturnContext();

        closeAirportRoute({ collapsePanel: true, updateUrl: false });

        window.requestAnimationFrame(function returnAfterAirportClose() {
          returnToInMotionScrollCinema();
        });

        return;
      }

      closeAirportRoute({ collapsePanel: true, updateUrl: true });
    });

    return true;
  }
  
    function trackAirportMobileContinueClick(panel) {
    const analytics = window.PixkuyAnalytics;

    if (
      !analytics ||
      typeof analytics.track !== "function" ||
      !isMobileViewport() ||
      !isRouteOpen
    ) {
      return false;
    }

    return analytics.track("pixkuy_continue_click", {
      service_type: "airport_hotel",
      flow_surface: "mobile_route",
      direction: getCurrentDirection(panel),
      passenger_fare_key: getSelectedPassengerFareKey(),
      luggage: mobileLuggageValue,
      currency: "MXN"
    });
  }


  function bindContinue(panel) {
    const cta = panel.querySelector(".services-expand__cta");

    if (!cta || cta.dataset.airportMobileContinueBound === "1") {
      return false;
    }

    cta.dataset.airportMobileContinueBound = "1";

    cta.addEventListener("click", function onContinueClick(event) {
      const contactStep = getAirportMobileContactStepApi();

      if (!isMobileViewport() || !isRouteOpen || !contactStep) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

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
        !contactStep.canOpen(panel)
      ) {
        syncMobileFare(panel);
        return;
      }

      if (typeof contactStep.open === "function") {
        if (contactStep.open(panel)) {
          trackAirportMobileContinueClick(panel);
        }
      }
    }, true);

    return true;
  }

  function rememberOriginalPanelPosition(panel) {
    if (originalPanelParent) {
      return;
    }

    originalPanelParent = panel.parentNode;
    originalPanelNextSibling = panel.nextSibling;
  }

  function movePanelToRoute(panel) {
    ensureRoute();

    if (!routeContent) {
      return false;
    }

    rememberOriginalPanelPosition(panel);

    if (panel.parentNode !== routeContent) {
      routeContent.appendChild(panel);
    }

    return true;
  }

  function restorePanelPosition(panel) {
    if (!panel || !originalPanelParent) {
      return false;
    }

    if (originalPanelNextSibling && originalPanelNextSibling.parentNode === originalPanelParent) {
      originalPanelParent.insertBefore(panel, originalPanelNextSibling);
      return true;
    }

    originalPanelParent.appendChild(panel);
    return true;
  }

  function openAirportPanelEngine(panel) {
    const airportCard = getAirportCard();

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

    if (airportCard && typeof airportCard.click === "function") {
      airportCard.click();
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

  function openAirportRoute() {
    const panel = getPanel();

    if (!isMobileViewport() || !panel) {
      return false;
    }

    inMotionReturnContext = getResolvedInMotionReturnContext();

    if (!openAirportPanelEngine(panel)) {
      return false;
    }

    ensureFlow(panel);
    bindDirection(panel);
    bindBack(panel);
    bindContinue(panel);
    bindAirportMobilePicker(panel);
    applyAirportDirectionPrefillFromUrl(panel);
    applyAirportPrefillFromUrl(panel);
    syncDirectionButtons(panel);

    if (!movePanelToRoute(panel)) {
      return false;
    }

    ensureMobilePassengers(panel);
    ensureMobileLuggage(panel);

    setRouteVisibility(true);

    if (window.PixkuyAnalytics && typeof window.PixkuyAnalytics.track === "function") {
      window.PixkuyAnalytics.track("pixkuy_mobile_route_open", {
        service_type: "airport_hotel",
        flow_surface: "mobile_route",
        entry_point: "mobile_home_or_deeplink"
      });
    }

    window.requestAnimationFrame(function syncAfterOpen() {
      syncCopy(panel);
      syncDirectionButtons(panel);
      ensureMobileFare(panel);
    });

    return true;
  }

  function closeAirportRoute(options) {
    const panel = getPanel();
    const settings = options || {};
    const airportCard = getAirportCard();

    closeAirportMobilePicker();

    const contactStep = getAirportMobileContactStepApi();

    if (contactStep && typeof contactStep.close === "function") {
      contactStep.close();
    }

    closeMobilePassengers(panel);
    disconnectMobileFareObserver();
    restoreDestinationZonePosition();
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
      airportCard &&
      typeof airportCard.click === "function"
    ) {
      airportCard.click();
    }

    if (settings.updateUrl === true) {
      removeAirportServiceFromUrl();
    }

    return true;
  }

  function removeAirportServiceFromUrl() {
    try {
      const url = new URL(window.location.href);
      const service = normalizeText(url.searchParams.get("service")).toLowerCase();

      if (service === "airport_hotel") {
        url.searchParams.delete("service");
      }

      if (url.hash === "#services") {
        url.hash = "";
      }

      window.history.replaceState({}, "", url.toString());
    } catch (error) {}
  }

  function pushAirportRouteUrl() {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set("service", "airport_hotel");
      url.hash = "";

      window.history.pushState({ airportMobileRoute: true }, "", url.toString());
    } catch (error) {}
  }

  function bindHeroEntry() {
    const link = document.querySelector(AIRPORT_HERO_LINK_SELECTOR);

    if (!link || link.dataset.airportMobileEntryBound === "1") {
      return false;
    }

    link.dataset.airportMobileEntryBound = "1";

    link.addEventListener("click", function onAirportHeroClick(event) {
      if (!isMobileViewport()) {
        return;
      }

      event.preventDefault();

      if (openAirportRoute()) {
        pushAirportRouteUrl();
      }
    });

    return true;
  }

  function syncActiveState() {
    const panel = getPanel();

    if (!isMobileViewport()) {
      if (isRouteOpen) {
        closeAirportRoute({ collapsePanel: false, updateUrl: false });
      }

      return false;
    }

    if (!panel || !isPanelVisible(panel)) {
      if (!isRouteOpen) {
        document.body.setAttribute(BODY_FLOW_ATTR, "false");
      }

      return false;
    }

    ensureFlow(panel);
    bindDirection(panel);
    bindBack(panel);
    bindContinue(panel);
    bindAirportMobilePicker(panel);
    syncDirectionButtons(panel);

    if (isRouteOpen) {
      ensureMobilePassengers(panel);
      ensureMobileLuggage(panel);
    }

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
      return normalizeText(params.get("service")).toLowerCase() === "airport_hotel";
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
        openAirportRoute();
      });
    }

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("hashchange", syncActiveState);
    window.addEventListener("popstate", function onPopState() {
      if (isRouteOpen && shouldReturnToInMotionScrollCinema()) {
        inMotionReturnContext = getResolvedInMotionReturnContext();

        closeAirportRoute({ collapsePanel: true, updateUrl: false });

        window.requestAnimationFrame(function returnAfterAirportClose() {
          returnToInMotionScrollCinema();
        });

        return;
      }

      if (isRouteOpen) {
        closeAirportRoute({ collapsePanel: true, updateUrl: false });
        return;
      }

      syncActiveState();
    });
    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      const panelAfterI18n = getPanel();

      if (panelAfterI18n) {
        syncCopy(panelAfterI18n);
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

  window.PixkuyAirportMobileBookingFlow = {
    open: openAirportRoute,
    close: closeAirportRoute,
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