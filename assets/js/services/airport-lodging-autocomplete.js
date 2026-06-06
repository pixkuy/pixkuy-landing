(function () {
  "use strict";

  const SELECTORS = {
    root: '[data-airport-destination-root]',
    manualControl: "#airport-tariff-destination"
  };

  const DEFAULT_ROOT_ID = "1";

  const I18N_KEYS = {
  placeholder: "services.cards.airport.panel.hotelPlaceholder",
  statusLoading: "services.cards.airport.panel.hotelStatusLoading",
  statusEmpty: "services.cards.airport.panel.hotelStatusEmpty",
  statusError: "services.cards.airport.panel.hotelStatusError",
  statusInvalid: "services.cards.airport.panel.hotelStatusInvalid"
};

  const state = {
    isOpen: false,
    isLoading: false,
    activeIndex: -1,
    query: "",
    items: [],
    selectedItem: null
  };
  
  let lastResolvedClearAt = 0;

  function normalizeText(value) {
    return typeof value === "string" ? value : "";
  }

  function isDesktopViewport() {
    return !(
      window &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }

  function getAirportTariffBridge() {
    const bridge = window.PixkuyAirportZoneTariff;

    return bridge && typeof bridge === "object" ? bridge : null;
  }

  function getInitialRootIdFromTariffState() {
    const bridge = getAirportTariffBridge();
    let tariffState = null;
    let side = "";

    if (!isDesktopViewport()) {
      return DEFAULT_ROOT_ID;
    }

    if (!bridge || typeof bridge.getState !== "function") {
      return DEFAULT_ROOT_ID;
    }

    try {
      tariffState = bridge.getState();
    } catch (error) {
      return DEFAULT_ROOT_ID;
    }

    side = normalizeText(
      tariffState && (
        tariffState.lodgingEndpointSide ||
        tariffState.lodgingSearchSide
      )
    ).trim();

    return side === "origin" ? "0" : DEFAULT_ROOT_ID;
  }

  function debugTrace() {
    return;
  }

function getI18nValue(path, fallback) {
  const dict = window.__pixkuyI18nDict;
  if (!dict || !path) {
    return fallback;
  }

  const parts = path.split(".");
  let cursor = dict;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return fallback;
    }

    cursor = cursor[part];
  }

  return typeof cursor === "string" ? cursor : fallback;
}

function syncInputPlaceholder(input) {
  if (!input) {
    return false;
  }

  input.setAttribute("data-i18n-placeholder", I18N_KEYS.placeholder);
  input.setAttribute(
    "placeholder",
    getI18nValue(I18N_KEYS.placeholder, "")
  );

  return true;
}

function getStatusText(kind) {
  if (kind === "loading") {
    return getI18nValue(I18N_KEYS.statusLoading, "");
  }

  if (kind === "empty") {
    return getI18nValue(I18N_KEYS.statusEmpty, "");
  }

  if (kind === "error") {
    return getI18nValue(I18N_KEYS.statusError, "");
  }

  if (kind === "invalid") {
    return getI18nValue(I18N_KEYS.statusInvalid, "");
  }

  return "";
}

function dispatchLodgingAutocompleteUpdate(nodes, dom, kind) {
  const detail = {
    kind: normalizeText(kind),
    rootId: nodes && nodes.rootId ? nodes.rootId : DEFAULT_ROOT_ID,
    query: normalizeText(state.query),
    items: Array.isArray(state.items) ? state.items.slice() : [],
    activeIndex: state.activeIndex,
    input:
      dom && dom.input ? dom.input : null
  };

  window.dispatchEvent(
    new CustomEvent("pixkuy:airport-lodging-autocomplete-updated", {
      detail: detail
    })
  );
}
  function getAirportDestinationBridge() {
    const bridge = window.PixkuyAirportDestination;
    if (!bridge || typeof bridge !== "object") {
      return null;
    }

    return bridge;
  }

  function getLodgingPolicy() {
    const policy = window.PixkuyAirportLodgingTypes;
    if (!policy || typeof policy !== "object") {
      return null;
    }

    return policy;
  }

  function getRootIdFromCandidate(candidate) {
    const normalized = normalizeText(candidate);
    return normalized || DEFAULT_ROOT_ID;
  }

  function getRootNode(rootId) {
    return document.querySelector(
      '[data-airport-destination-root="' + String(rootId) + '"]'
    );
  }
  
  function getAllRootIds() {
  const roots = document.querySelectorAll(SELECTORS.root);
  const ids = [];

  roots.forEach(function (root) {
    const rootId = normalizeText(
      root && typeof root.getAttribute === "function"
        ? root.getAttribute("data-airport-destination-root")
        : ""
    );

    if (!rootId) {
      return;
    }

    if (ids.indexOf(rootId) >= 0) {
      return;
    }

    ids.push(rootId);
  });

  return ids.length ? ids : [DEFAULT_ROOT_ID];
}

function clearDomValue(dom) {
  if (!dom || !dom.input) {
    return;
  }

  if (dom.input.value !== "") {
    dom.input.value = "";
  }

  syncSearchClearVisibility(dom);
}

function clearRootUi(rootId) {
  const nodes = getPanelNodes(rootId);
  if (!nodes) {
    return;
  }

  const dom = ensureSearchDom(nodes);
  if (!dom) {
    return;
  }

  clearDomValue(dom);
  clearResults(nodes, dom);
  renderStatus(dom, "idle");
}

function clearAllRootUis() {
  getAllRootIds().forEach(function (rootId) {
    clearRootUi(rootId);
  });
}

  function getPanelNodes(rootId) {
    const resolvedRootId = getRootIdFromCandidate(rootId);
    const root = getRootNode(resolvedRootId);

    if (!root) {
      return null;
    }

    const search = root.querySelector(
      '[data-airport-destination-search="' + String(resolvedRootId) + '"]'
    );
    const mount = root.querySelector(
      '[data-airport-destination-mount="' + String(resolvedRootId) + '"]'
    );
    const resolved = root.querySelector(
      '[data-airport-destination-resolved="' + String(resolvedRootId) + '"]'
    );
    const label = root.querySelector(
      '[data-airport-destination-label="' + String(resolvedRootId) + '"]'
    );
    const clearResolved = root.querySelector(
      '[data-airport-destination-clear="' + String(resolvedRootId) + '"]'
    );
    const manualControl =
      resolvedRootId === DEFAULT_ROOT_ID
        ? root.querySelector(SELECTORS.manualControl)
        : null;

    if (!search || !mount || !resolved || !label || !clearResolved) {
      return null;
    }

    return {
      rootId: resolvedRootId,
      root: root,
      search: search,
      mount: mount,
      resolved: resolved,
      label: label,
      clearResolved: clearResolved,
      manualControl: manualControl
    };
  }

  function hasResolvedDestinationVisible(nodes) {
    return !!nodes && nodes.root.dataset.airportDestinationMode === "resolved-place";
  }

  function ensureSearchDom(nodes) {
    if (!nodes || !nodes.mount) {
      return null;
    }

    const rootId = nodes.rootId || DEFAULT_ROOT_ID;

    let input = nodes.mount.querySelector(
      '[data-airport-lodging-input="' + String(rootId) + '"]'
    );
    let panel = nodes.mount.querySelector(
      '[data-airport-lodging-panel="' + String(rootId) + '"]'
    );
    let status = nodes.mount.querySelector(
      '[data-airport-lodging-status="' + String(rootId) + '"]'
    );

    if (!input) {
      input = document.createElement("input");
      input.type = "text";
      input.className = "services-expand__control";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("data-airport-lodging-input", String(rootId));
      input.setAttribute("data-i18n-placeholder", I18N_KEYS.placeholder);
      input.setAttribute(
        "placeholder",
        getI18nValue(I18N_KEYS.placeholder, "")
      );
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-haspopup", "listbox");
      nodes.mount.appendChild(input);
    }
	
    syncInputPlaceholder(input);

    let clearSearch = nodes.mount.querySelector(
      '[data-airport-lodging-clear-search="' + String(rootId) + '"]'
    );

    if (!clearSearch) {
      clearSearch = document.createElement("button");
      clearSearch.type = "button";
      clearSearch.className = "services-expand__control-clear";
      clearSearch.hidden = true;
      clearSearch.setAttribute(
        "data-airport-lodging-clear-search",
        String(rootId)
      );
      clearSearch.setAttribute("aria-label", "Limpiar búsqueda");
      clearSearch.textContent = "×";
      nodes.mount.appendChild(clearSearch);
    }

    if (!panel) {
      panel = document.createElement("div");
      panel.className = "place-autocomplete__panel";
      panel.hidden = true;
      panel.style.width = "100%";
      panel.style.minWidth = "0";
      panel.setAttribute("data-airport-lodging-panel", String(rootId));
      panel.setAttribute("role", "listbox");
      panel.setAttribute("tabindex", "-1");
      panel.id = "airport-lodging-panel-" + String(rootId);
      nodes.mount.appendChild(panel);
    }

    if (!status) {
      status = document.createElement("div");
      status.className = "place-autocomplete__status";
      status.hidden = true;
      status.setAttribute("data-airport-lodging-status", String(rootId));
      nodes.mount.appendChild(status);
    }

    return {
      input: input,
      panel: panel,
      status: status,
      clearSearch: clearSearch
    };
  }

  function setHidden(node, shouldHide) {
    if (!node) return;
    node.hidden = !!shouldHide;
  }

  function resetState() {
    state.isOpen = false;
    state.isLoading = false;
    state.activeIndex = -1;
    state.query = "";
    state.items = [];
  }
  
  function syncSearchClearVisibility(dom) {
    if (!dom || !dom.clearSearch || !dom.input) {
      return;
    }

    const hasValue = normalizeText(dom.input.value).trim().length > 0;
    dom.clearSearch.hidden = !hasValue;
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

  function blurAutocompleteFocus(nodes, dom) {
    if (dom) {
      if (blurActiveElementInside(dom.panel)) {
        return true;
      }

      if (blurActiveElementInside(dom.input)) {
        return true;
      }

      if (blurActiveElementInside(dom.clearSearch)) {
        return true;
      }
    }

    return nodes ? blurActiveElementInside(nodes.mount) : false;
  }

  function closePanel(nodes, dom) {
    if (!nodes || !dom) {
      return;
    }

    state.isOpen = false;
    state.activeIndex = -1;
    setHidden(dom.panel, true);
    dom.panel.innerHTML = "";
    dom.input.setAttribute("aria-expanded", "false");
    dom.input.removeAttribute("aria-activedescendant");
  }

  function openPanel(nodes, dom) {
    if (!nodes || !dom) {
      return;
    }

    state.isOpen = true;
    setHidden(dom.panel, false);
    dom.input.setAttribute("aria-expanded", "true");

    debugTrace("openPanel:after", {
      rootId: nodes && nodes.rootId ? nodes.rootId : "",
      stateQuery: state.query,
      hasSelectedItem: !!state.selectedItem,
      itemsLength: Array.isArray(state.items) ? state.items.length : null,
      panelHidden: dom && dom.panel ? !!dom.panel.hidden : null,
      searchHidden: nodes && nodes.search ? !!nodes.search.hidden : null,
      mountHidden: nodes && nodes.mount ? !!nodes.mount.hidden : null
    });
  }

  function renderStatus(dom, kind) {
  const text = getStatusText(kind);

  if (!dom || !dom.status) {
    return;
  }

  if (!text) {
    dom.status.hidden = true;
    dom.status.textContent = "";
    return;
  }

  dom.status.hidden = false;
  dom.status.textContent = text;
}

  function createItemNode(item, index) {
    const row = document.createElement("div");
    row.className = "place-autocomplete__item";
    row.setAttribute("role", "presentation");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-autocomplete__item-button";
    button.setAttribute("role", "option");
    button.id = "airport-lodging-option-" + String(index);
    button.dataset.airportLodgingIndex = String(index);
    button.dataset.airportLodgingLabel = item.label;
    button.dataset.airportLodgingPrimaryType = item.primaryType || "";
    button.dataset.airportLodgingLat = String(item.lat);
    button.dataset.airportLodgingLng = String(item.lng);
    button.setAttribute("aria-selected", index === state.activeIndex ? "true" : "false");

    if (index === state.activeIndex) {
      button.classList.add("is-active");
    }

    const title = document.createElement("span");
    title.className = "place-autocomplete__item-title";
    title.textContent = item.label;

    button.appendChild(title);
    row.appendChild(button);

    return row;
  }

  function renderItems(nodes, dom) {
    dom.panel.innerHTML = "";

    if (!Array.isArray(state.items) || !state.items.length) {
      closePanel(nodes, dom);
      renderStatus(dom, "empty");
      return;
    }

    if (state.activeIndex < 0 || state.activeIndex >= state.items.length) {
      state.activeIndex = 0;
    }

    dispatchLodgingAutocompleteUpdate(nodes, dom, "results");

    for (let index = 0; index < state.items.length; index += 1) {
      dom.panel.appendChild(createItemNode(state.items[index], index));
    }

    const activeButton = dom.panel.querySelector(
      '[data-airport-lodging-index="' + String(state.activeIndex) + '"]'
    );

    if (activeButton) {
      dom.input.setAttribute("aria-activedescendant", activeButton.id);
    }

    renderStatus(dom, "idle");
    openPanel(nodes, dom);
  }

  function setResults(nodes, dom, items) {
    state.items = Array.isArray(items) ? items.slice() : [];
    state.activeIndex = state.items.length ? 0 : -1;
    renderItems(nodes, dom);
  }

  function clearResults(nodes, dom) {
    const rootId = nodes && nodes.rootId ? nodes.rootId : "";
    const panelHiddenBefore =
      dom && dom.panel ? !!dom.panel.hidden : null;
    const searchHiddenBefore =
      nodes && nodes.search ? !!nodes.search.hidden : null;
    const mountHiddenBefore =
      nodes && nodes.mount ? !!nodes.mount.hidden : null;

    state.items = [];
    state.activeIndex = -1;
    closePanel(nodes, dom);
    renderStatus(dom, "idle");
    syncSearchClearVisibility(dom);

    debugTrace("clearResults:after", {
      rootId: rootId,
      stateQuery: state.query,
      hasSelectedItem: !!state.selectedItem,
      isOpen: state.isOpen,
      panelHiddenBefore: panelHiddenBefore,
      panelHiddenAfter: dom && dom.panel ? !!dom.panel.hidden : null,
      searchHiddenBefore: searchHiddenBefore,
      searchHiddenAfter: nodes && nodes.search ? !!nodes.search.hidden : null,
      mountHiddenBefore: mountHiddenBefore,
      mountHiddenAfter: nodes && nodes.mount ? !!nodes.mount.hidden : null,
      itemsLength: Array.isArray(state.items) ? state.items.length : null
    });
  }

  function syncQuery(dom, value) {
    const nextValue = normalizeText(value);
    state.query = nextValue;
    if (dom && dom.input && dom.input.value !== nextValue) {
      dom.input.value = nextValue;
    }
    syncSearchClearVisibility(dom);
  }

  function moveActiveIndex(dom, direction) {
    if (!Array.isArray(state.items) || !state.items.length) {
      return;
    }

    const maxIndex = state.items.length - 1;
    const nextIndex = Math.max(0, Math.min(maxIndex, state.activeIndex + direction));
    state.activeIndex = nextIndex;

    const buttons = dom.panel.querySelectorAll(".place-autocomplete__item-button");
    buttons.forEach(function (button, index) {
      const isActive = index === state.activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) {
        dom.input.setAttribute("aria-activedescendant", button.id);
        if (typeof button.scrollIntoView === "function") {
          button.scrollIntoView({ block: "nearest" });
        }
      }
    });
  }

  async function applySelection(nodes, dom, item) {
    const bridge = getAirportDestinationBridge();
    if (!bridge || typeof bridge.resolveAndApplyDestination !== "function") {
      return;
    }

    blurAutocompleteFocus(nodes, dom);

    const result = await bridge.resolveAndApplyDestination({
      placeLabel: item.label,
      placeId: normalizeText(item.placeId),
      primaryType: item.primaryType,
      lat: item.lat,
      lng: item.lng
    });

    if (result && result.ok) {
      state.selectedItem = item;
      syncQuery(dom, item.label);
      clearResults(nodes, dom);
      return;
    }

    if (
      result &&
      (
        result.reason === "unsupported-primary-type" ||
        result.reason === "extended-ring-unavailable"
      )
    ) {
      renderStatus(dom, "invalid");
      return;
    }

    renderStatus(dom, "error");
  }

  function getActiveItem() {
    if (!Array.isArray(state.items) || !state.items.length) {
      return null;
    }

    if (state.activeIndex < 0 || state.activeIndex >= state.items.length) {
      return null;
    }

    return state.items[state.activeIndex];
  }

  function bindPanelClick(nodes, dom) {
    if (dom.panel.dataset.airportLodgingBound === "1") {
      return;
    }

    dom.panel.dataset.airportLodgingBound = "1";

    dom.panel.addEventListener("click", function (event) {
      const button = event.target.closest(".place-autocomplete__item-button");
      if (!button) {
        return;
      }

      const index = Number(button.dataset.airportLodgingIndex);
      if (!Number.isInteger(index) || index < 0 || index >= state.items.length) {
        return;
      }

      applySelection(nodes, dom, state.items[index]);
    });
  }

  function bindInput(nodes, dom) {
    if (dom.input.dataset.airportLodgingBound === "1") {
      return;
    }

    dom.input.dataset.airportLodgingBound = "1";

    dom.input.addEventListener("input", function () {
      const nextValue = dom.input ? dom.input.value : "";

      if (state.selectedItem) {
        debugTrace("input:clear-selected-item", {
          rootId: nodes.rootId,
          previousLabel: state.selectedItem.label || "",
          nextValue: nextValue
        });
        state.selectedItem = null;
      }

      syncQuery(dom, nextValue);
      renderStatus(dom, "idle");
      clearResults(nodes, dom);
      syncSearchClearVisibility(dom);
    });

    dom.input.addEventListener("focus", function () {
      if (hasResolvedDestinationVisible(nodes)) {
        return;
      }

      nodes.search.hidden = false;
    });

    dom.input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!state.isOpen) {
          renderItems(nodes, dom);
          return;
        }
        moveActiveIndex(dom, 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!state.isOpen) {
          renderItems(nodes, dom);
          return;
        }
        moveActiveIndex(dom, -1);
        return;
      }

      if (event.key === "Enter") {
        const activeItem = getActiveItem();
        if (!activeItem) {
          return;
        }

        event.preventDefault();
        applySelection(nodes, dom, activeItem);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearResults(nodes, dom);
      }
    });
  }

    function bindDocumentDismiss() {
    if (document.documentElement.dataset.airportLodgingDismissBound === "1") {
      return;
    }

    document.documentElement.dataset.airportLodgingDismissBound = "1";

    document.addEventListener("click", function (event) {
      const api = window.PixkuyAirportLodgingAutocomplete;
      if (!api || typeof api.getActiveNodes !== "function") {
        return;
      }

      const activeNodes = api.getActiveNodes();
      const activeDom =
        api && typeof api.getActiveDom === "function" ? api.getActiveDom() : null;

      if (!activeNodes || !activeDom) {
        return;
      }

      const target = event.target;
      if (activeNodes.root.contains(target)) {
        return;
      }

      clearResults(activeNodes, activeDom);
    });
  }
  
  function bindSearchClear(nodes, dom) {
    if (
      !dom ||
      !dom.clearSearch ||
      dom.clearSearch.dataset.airportLodgingSearchClearBound === "1"
    ) {
      return;
    }

    dom.clearSearch.dataset.airportLodgingSearchClearBound = "1";

    function runSearchClear(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      state.selectedItem = null;
      syncQuery(dom, "");
      clearResults(nodes, dom);
      renderStatus(dom, "idle");

      if (dom.input) {
        dom.input.focus({ preventScroll: true });
      }
    }

    dom.clearSearch.addEventListener("pointerdown", runSearchClear);
    dom.clearSearch.addEventListener("click", runSearchClear);
  }

  function bindResolvedClear(nodes, dom) {
    if (nodes.clearResolved.dataset.airportLodgingClearBound === "1") {
      return;
    }

    nodes.clearResolved.dataset.airportLodgingClearBound = "1";

    function runResolvedClear(event, source) {
      const bridge = getAirportDestinationBridge();
      const now = Date.now();

      if (now - lastResolvedClearAt < 350) {
        debugTrace("resolved-clear:deduped", {
          source: source,
          rootId: nodes.rootId,
          elapsedMs: now - lastResolvedClearAt
        });
        return;
      }

      lastResolvedClearAt = now;

      debugTrace("resolved-clear:trigger", {
        source: source,
        rootId: nodes.rootId,
        currentQuery: state.query,
        inputValue: dom && dom.input ? dom.input.value : "",
        selectedItem: state.selectedItem
          ? {
              label: state.selectedItem.label || "",
              primaryType: state.selectedItem.primaryType || ""
            }
          : null
      });

      if (!bridge || typeof bridge.clearResolvedDestination !== "function") {
        debugTrace("resolved-clear:bridge-missing", {
          source: source,
          hasBridge: !!bridge
        });
        return;
      }

      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      bridge.clearResolvedDestination();

      state.selectedItem = null;
      resetState();
      clearAllRootUis();
      syncQuery(dom, "");
      clearResults(nodes, dom);
      renderStatus(dom, "idle");

      window.requestAnimationFrame(function () {
        const api = window.PixkuyAirportLodgingAutocomplete;
        const activeNodes =
          api && typeof api.getActiveNodes === "function"
            ? api.getActiveNodes()
            : nodes;
        const activeDom =
          api && typeof api.getActiveDom === "function"
            ? api.getActiveDom()
            : dom;

        debugTrace("resolved-clear:after-raf", {
          source: source,
          requestedRootId: nodes.rootId,
          activeRootId:
            activeNodes && activeNodes.rootId ? activeNodes.rootId : "",
          stateQuery: state.query,
          hasActiveInput: !!(activeDom && activeDom.input),
          activeInputValue:
            activeDom && activeDom.input ? activeDom.input.value : "",
          activeSearchHidden:
            activeNodes && activeNodes.search
              ? !!activeNodes.search.hidden
              : null
        });

        if (!activeNodes || !activeDom || !activeDom.input) {
          return;
        }

        clearAllRootUis();
        syncQuery(activeDom, "");
        clearResults(activeNodes, activeDom);
        renderStatus(activeDom, "idle");
        activeNodes.search.hidden = false;
        activeDom.input.focus({ preventScroll: true });
      });
    }

    nodes.clearResolved.addEventListener("pointerdown", function (event) {
      runResolvedClear(event, "pointerdown");
    });

    nodes.clearResolved.addEventListener("click", function (event) {
      runResolvedClear(event, "click");
    });
  }
  
  function renderFromTariffState(nodes, dom) {
    const bridge = window.PixkuyAirportZoneTariff;
    const tariffState =
      bridge && typeof bridge.getState === "function" ? bridge.getState() : null;

    const hasResolved =
      tariffState &&
      tariffState.destinationMode === "resolved-place" &&
      normalizeText(tariffState.destinationPlaceLabel);

    nodes.search.hidden = !!hasResolved;

    if (!hasResolved && dom.input && !dom.input.value) {
      syncQuery(dom, "");
    }
  }
  
  function getResolvedVisibleLabel(nodes) {
    if (!nodes || !nodes.label) {
      return "";
    }

    return normalizeText(nodes.label.textContent).trim();
  }

  function getApi(nodes, dom) {
  let activeNodes = nodes;
  let activeDom = dom;

  function resolveNodes(rootId) {
    const nextNodes = getPanelNodes(rootId);
    if (!nextNodes) {
      return null;
    }

    const nextDom = ensureSearchDom(nextNodes);
    if (!nextDom) {
      return null;
    }

    bindPanelClick(nextNodes, nextDom);
    bindInput(nextNodes, nextDom);
    bindSearchClear(nextNodes, nextDom);
    bindResolvedClear(nextNodes, nextDom);

    activeNodes = nextNodes;
    activeDom = nextDom;

    if (hasResolvedDestinationVisible(activeNodes)) {
      const resolvedLabel = getResolvedVisibleLabel(activeNodes);
      const committedLabel = resolvedLabel || normalizeText(state.query);

      if (committedLabel) {
        state.query = committedLabel;
        state.selectedItem = {
          label: committedLabel,
          primaryType:
            state.selectedItem &&
            typeof state.selectedItem.primaryType === "string"
              ? state.selectedItem.primaryType
              : "lodging"
        };
      }

      if (
        committedLabel &&
        activeDom.input &&
        activeDom.input.value !== committedLabel
      ) {
        activeDom.input.value = committedLabel;
      }

      clearResults(activeNodes, activeDom);
      renderStatus(activeDom, "idle");

      debugTrace("setActiveRoot:rehydrate-resolved", {
        requestedRootId: rootId,
        activeRootId: activeNodes && activeNodes.rootId ? activeNodes.rootId : "",
        resolvedLabel: resolvedLabel,
        committedLabel: committedLabel,
        hasSelectedItemAfter: !!state.selectedItem
      });
    } else if (!state.selectedItem && !normalizeText(state.query)) {
      clearDomValue(activeDom);
      clearResults(activeNodes, activeDom);
      renderStatus(activeDom, "idle");
    } else if (
      activeDom.input &&
      activeDom.input.value !== normalizeText(state.query)
    ) {
      activeDom.input.value = normalizeText(state.query);
    }

    debugTrace("setActiveRoot:resolved", {
      requestedRootId: rootId,
      activeRootId: activeNodes && activeNodes.rootId ? activeNodes.rootId : "",
      stateQuery: state.query,
      inputValue:
        activeDom && activeDom.input ? activeDom.input.value : "",
      hasSelectedItem: !!state.selectedItem,
      isOpen: state.isOpen,
      itemsLength: Array.isArray(state.items) ? state.items.length : null,
      panelHidden:
        activeDom && activeDom.panel ? !!activeDom.panel.hidden : null,
      searchHidden:
        activeNodes && activeNodes.search ? !!activeNodes.search.hidden : null,
      mountHidden:
        activeNodes && activeNodes.mount ? !!activeNodes.mount.hidden : null,
      resolvedHidden:
        activeNodes && activeNodes.resolved ? !!activeNodes.resolved.hidden : null,
      rootHidden:
        activeNodes && activeNodes.root ? !!activeNodes.root.hidden : null
    });

    return {
      nodes: nextNodes,
      dom: nextDom
    };
  }

  return {
    setActiveRoot: function (rootId) {
      return resolveNodes(rootId);
    },
    getActiveRootId: function () {
      return activeNodes && activeNodes.rootId ? activeNodes.rootId : DEFAULT_ROOT_ID;
    },
    getActiveNodes: function () {
      return activeNodes;
    },
    getActiveDom: function () {
      return activeDom;
    },
    setLoading: function (isLoading) {
      state.isLoading = !!isLoading;
      renderStatus(activeDom, isLoading ? "loading" : "idle");
    },
    setResults: function (items) {
      setResults(activeNodes, activeDom, items);
    },
    clearResults: function () {
      clearResults(activeNodes, activeDom);
    },
    getQuery: function () {
      return state.query;
    },
    getSelectedItem: function () {
      return state.selectedItem;
    },
    getItems: function () {
      return Array.isArray(state.items) ? state.items.slice() : [];
    },
    selectItemAtIndex: function (index) {
      const normalizedIndex = Number(index);
      const item =
        Number.isInteger(normalizedIndex) &&
        normalizedIndex >= 0 &&
        normalizedIndex < state.items.length
          ? state.items[normalizedIndex]
          : null;

      if (!item || !activeNodes || !activeDom) {
        return false;
      }

      applySelection(activeNodes, activeDom, item);
      return true;
    }
  };
}

  function initAirportLodgingAutocomplete() {
    const nodes = getPanelNodes(getInitialRootIdFromTariffState());
    if (!nodes) {
      return;
    }

    const bridge = getAirportDestinationBridge();
    const policy = getLodgingPolicy();

    if (!bridge || !policy) {
      return;
    }

    const dom = ensureSearchDom(nodes);
    if (!dom) {
      return;
    }

    bindPanelClick(nodes, dom);
    bindInput(nodes, dom);
    bindDocumentDismiss();
    bindSearchClear(nodes, dom);
    bindResolvedClear(nodes, dom);
    renderFromTariffState(nodes, dom);
    syncSearchClearVisibility(dom);
    syncInputPlaceholder(dom.input);

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      const api = window.PixkuyAirportLodgingAutocomplete;
      const activeDom =
        api && typeof api.getActiveDom === "function" ? api.getActiveDom() : dom;

      if (activeDom && activeDom.input) {
        syncInputPlaceholder(activeDom.input);
      }
    });

    window.PixkuyAirportLodgingAutocomplete = getApi(nodes, dom);

    if (isDesktopViewport()) {
      window.requestAnimationFrame(function syncInitialDesktopRoot() {
        const api = window.PixkuyAirportLodgingAutocomplete;
        const nextRootId = getInitialRootIdFromTariffState();
        const destinationBridge = getAirportDestinationBridge();

        if (api && typeof api.setActiveRoot === "function") {
          api.setActiveRoot(nextRootId);
        }

        if (
          destinationBridge &&
          typeof destinationBridge.renderDestinationUi === "function"
        ) {
          destinationBridge.renderDestinationUi();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAirportLodgingAutocomplete, {
      once: true
    });
  } else {
    initAirportLodgingAutocomplete();
  }
})();