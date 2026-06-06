(function () {
  "use strict";

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isDesktopViewport() {
    return !(
      window &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }
  
  function debugTrace() {
    return;
  }
  
    function getRuntimeDict() {
    const dict = window.__pixkuyI18nDict;
    return dict && typeof dict === "object" ? dict : null;
  }

  function getI18nValue(path) {
    const dict = getRuntimeDict();
    if (!dict || !path) {
      return "";
    }

    const segments = String(path).split(".");
    let current = dict;

    for (let index = 0; index < segments.length; index += 1) {
      const key = segments[index];
      if (!current || typeof current !== "object" || !(key in current)) {
        return "";
      }
      current = current[key];
    }

    return typeof current === "string" ? current.trim() : "";
  }

  function getResolvedZoneLabel(state) {
    if (!state || typeof state !== "object") {
      return "";
    }

    const directLabel = normalizeText(state.resolvedZoneLabel);
    if (directLabel) {
      return directLabel;
    }

    const labelKey = normalizeText(state.resolvedZoneLabelKey);
    if (!labelKey) {
      return "";
    }

    return getI18nValue(labelKey);
  }
  
    function getVisibleZoneLabel(state) {
  if (!state || typeof state !== "object") {
    return "";
  }

  if (hasResolvedDestinationState(state)) {
    return getResolvedZoneLabel(state);
  }

  const originType = normalizeText(state.originType);
  const destinationType = normalizeText(state.destinationType);
  const originLabel = normalizeText(state.originLabel);
  const destinationLabel = normalizeText(state.destinationLabel);

  if (destinationType === "zone" && destinationLabel) {
    return destinationLabel;
  }

  if (originType === "zone" && originLabel) {
    return originLabel;
  }

  return "";
}

  function getTariffBridge() {
    const bridge = window.PixkuyAirportZoneTariff;
    if (!bridge || typeof bridge !== "object") {
      return null;
    }

    return bridge;
  }

  function getZoneResolver() {
  const resolver = window.PixkuyZoneResolver;
  if (!resolver || typeof resolver !== "object") {
    return null;
  }

  return resolver;
}

function getLodgingTypesPolicy() {
  const policy = window.PixkuyAirportLodgingTypes;
  if (!policy || typeof policy !== "object") {
    return null;
  }

  return policy;
}

function hasReadyDependencies() {
  const tariffBridge = getTariffBridge();
  const zoneResolver = getZoneResolver();
  const lodgingTypesPolicy = getLodgingTypesPolicy();

  return !!(
    tariffBridge &&
    typeof tariffBridge.setResolvedDestination === "function" &&
    typeof tariffBridge.clearResolvedDestination === "function" &&
    typeof tariffBridge.getState === "function" &&
    zoneResolver &&
    typeof zoneResolver.resolveZoneFromPoint === "function" &&
    typeof zoneResolver.loadZones === "function" &&
    lodgingTypesPolicy &&
    typeof lodgingTypesPolicy.isAcceptedLodgingPrimaryType === "function" &&
    typeof lodgingTypesPolicy.getRejectedReason === "function"
  );
}

function getActiveRootId(state) {
  const explicitLodgingSide = normalizeText(
    state && typeof state === "object" ? state.lodgingEndpointSide : ""
  );

  if (
    explicitLodgingSide === "origin" ||
    explicitLodgingSide === "destination"
  ) {
    return sideToRootId(explicitLodgingSide);
  }

  const resolvedLodging = getResolvedLodgingEndpointState(state);
  if (
    resolvedLodging &&
    (resolvedLodging.side === "origin" ||
      resolvedLodging.side === "destination")
  ) {
    return sideToRootId(resolvedLodging.side);
  }

  return sideToRootId(getLodgingSearchSide(state));
}

function getUiRenderSnapshot(state) {
  const resolvedLodging = getResolvedLodgingEndpointState(state);
  const airportEndpoint = getAirportEndpointState(state);
  const lodgingSearchSide = getLodgingSearchSide(state);
  const activeRootId = getActiveRootId(state);
  const activeSide = rootIdToSide(activeRootId);
  const inactiveRootId = activeRootId === "0" ? "1" : "0";

  return {
    activeRootId: activeRootId,
    inactiveRootId: inactiveRootId,
    activeSide: activeSide,
    lodgingSearchSide: lodgingSearchSide,
    hasResolvedLodging: !!resolvedLodging,
    resolvedLodgingSide:
      resolvedLodging &&
      (resolvedLodging.side === "origin" ||
        resolvedLodging.side === "destination")
        ? resolvedLodging.side
        : "",
    airportSide:
      airportEndpoint &&
      (airportEndpoint.side === "origin" ||
        airportEndpoint.side === "destination")
        ? airportEndpoint.side
        : "",
    airportValue: airportEndpoint ? normalizeText(airportEndpoint.value) : "",
    airportLabel: airportEndpoint ? normalizeText(airportEndpoint.label) : "",
    lodgingEndpointSide: normalizeText(
      state && typeof state === "object" ? state.lodgingEndpointSide : ""
    ),
    lodgingEndpointLabel: normalizeText(
      state && typeof state === "object" ? state.lodgingEndpointLabel : ""
    )
  };
}

function getPanelNodes(rootId) {
  const state = getTariffState();
  const preferredRootId = normalizeText(rootId) || getActiveRootId(state);

  const root =
    document.querySelector(
      '[data-airport-destination-root="' + preferredRootId + '"]'
    ) ||
    document.querySelector('[data-airport-destination-root="1"]');

  if (!root) {
    return null;
  }

  const rootKey = root.getAttribute("data-airport-destination-root");
  const search = root.querySelector(
    '[data-airport-destination-search="' + rootKey + '"]'
  );
  const mount = root.querySelector(
    '[data-airport-destination-mount="' + rootKey + '"]'
  );
  const resolved = root.querySelector(
    '[data-airport-destination-resolved="' + rootKey + '"]'
  );
  const label = root.querySelector(
    '[data-airport-destination-label="' + rootKey + '"]'
  );
  const clear = root.querySelector(
    '[data-airport-destination-clear="' + rootKey + '"]'
  );
  const manualControl =
    rootKey === "1"
      ? root.querySelector('[data-airport-tariff-control="destination"]') ||
        root.querySelector("#airport-tariff-destination")
      : null;

  if (!search || !mount || !resolved || !label || !clear) {
    return null;
  }

  const zone =
    document.querySelector('[data-airport-destination-zone="' + rootKey + '"]') ||
    document.querySelector('[data-airport-destination-zone="1"]');
  const zoneValue =
    document.querySelector(
      '[data-airport-destination-zone-value="' + rootKey + '"]'
    ) ||
    document.querySelector('[data-airport-destination-zone-value="1"]');

  if (!zone || !zoneValue) {
    return null;
  }

  return {
    root: root,
    rootKey: rootKey,
    side: rootIdToSide(rootKey),
    search: search,
    mount: mount,
    resolved: resolved,
    label: label,
    clear: clear,
    zone: zone,
    zoneValue: zoneValue,
    manualControl: manualControl
  };
}

function getTariffState() {
  const bridge = getTariffBridge();
  if (!bridge || typeof bridge.getState !== "function") {
    return null;
  }

  try {
    return bridge.getState();
  } catch (error) {
    return null;
  }
}

function getEndpointsStateApi() {
  const api = window.PixkuyAirportEndpointsState;
  if (!api || typeof api !== "object") {
    return null;
  }

  if (typeof api.getResolvedLodgingEndpoint !== "function") {
    return null;
  }

  return api;
}

function getAirportZoneCatalog() {
  const catalog = window.PIXKUY_AIRPORT_ZONE_CATALOG;
  return catalog && typeof catalog === "object" ? catalog : null;
}

function findAirportCatalogItem(airportId) {
  const safeAirportId = normalizeText(airportId);
  const catalog = getAirportZoneCatalog();

  if (!safeAirportId || !catalog || !Array.isArray(catalog.airports)) {
    return null;
  }

  return (
    catalog.airports.find(function (item) {
      return (
        item &&
        item.active === true &&
        normalizeText(item.id) === safeAirportId
      );
    }) || null
  );
}

function getAirportLabelFromCatalog(airportId) {
  const airportItem = findAirportCatalogItem(airportId);
  if (!airportItem) {
    return "";
  }

  const labelKey = normalizeText(airportItem.labelKey);
  if (!labelKey) {
    return "";
  }

  return getI18nValue(labelKey, "");
}

function getAirportEndpointState(state) {
  const endpointsStateApi = getEndpointsStateApi();

  if (
    endpointsStateApi &&
    typeof endpointsStateApi.getAirportEndpoint === "function"
  ) {
    const endpoint = endpointsStateApi.getAirportEndpoint(state);
    if (endpoint) {
      return endpoint;
    }
  }

  if (!state || typeof state !== "object") {
    return null;
  }

  if (
    normalizeText(state.originType) === "airport" &&
    normalizeText(state.originValue)
  ) {
    return {
      side: "origin",
      type: "airport",
      value: normalizeText(state.originValue),
      label: normalizeText(state.originLabel)
    };
  }

  if (
    normalizeText(state.destinationType) === "airport" &&
    normalizeText(state.destinationValue)
  ) {
    return {
      side: "destination",
      type: "airport",
      value: normalizeText(state.destinationValue),
      label: normalizeText(state.destinationLabel)
    };
  }

  return null;
}

function getVisibleAirportLabel(state) {
  const airportEndpoint = getAirportEndpointState(state);
  if (!airportEndpoint) {
    return "";
  }

  const airportId = normalizeText(airportEndpoint.value);
  const catalogLabel = getAirportLabelFromCatalog(airportId);
  if (catalogLabel) {
    return catalogLabel;
  }

  return normalizeText(airportEndpoint.label);
}

function getAutocompleteApi() {
  const api = window.PixkuyAirportLodgingAutocomplete;
  return api && typeof api === "object" ? api : null;
}

let lastRenderedActiveRootId = "";

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

function blurAirportDestinationNodes(nodes) {
  if (!nodes) {
    return false;
  }

  return (
    blurActiveElementInside(nodes.mount) ||
    blurActiveElementInside(nodes.search) ||
    blurActiveElementInside(nodes.root)
  );
}

function sideToRootId(side) {
  return side === "origin" ? "0" : "1";
}

function rootIdToSide(rootId) {
  return String(rootId) === "0" ? "origin" : "destination";
}

function getAirportShellNodes(rootId) {
  const resolvedRootId = normalizeText(rootId) || "1";
  const shell = document.querySelector(
    '[data-airport-endpoint-airport-root="' + String(resolvedRootId) + '"]'
  );

  if (!shell) {
    return null;
  }

  const button =
    shell.querySelector('[data-airport-tariff-control="origin"]') ||
    shell.querySelector('[data-airport-tariff-airport-display="1"]');

  if (!button) {
    return null;
  }

  return {
    rootId: String(resolvedRootId),
    shell: shell,
    button: button
  };
}

function getRealAirportControl() {
  return document.querySelector("#airport-tariff-origin");
}

function getFixedFareZoneNodes() {
  const zone = document.querySelector('[data-airport-destination-zone="1"]');
  const zoneValue = document.querySelector('[data-airport-destination-zone-value="1"]');

  if (!zone || !zoneValue) {
    return null;
  }

  return {
    zone: zone,
    zoneValue: zoneValue
  };
}

function forwardAirportMirrorKeydown(event, realControl) {
  if (!event || !realControl) {
    return;
  }

  const key = event.key;

  if (
    key !== "ArrowDown" &&
    key !== "ArrowUp" &&
    key !== "Enter" &&
    key !== " " &&
    key !== "Escape"
  ) {
    return;
  }

  event.preventDefault();

  realControl.focus();

  const forwardedEvent = new KeyboardEvent("keydown", {
    key: key,
    code: event.code || "",
    bubbles: true,
    cancelable: true
  });

  realControl.dispatchEvent(forwardedEvent);
}

function getLodgingSearchSide(state) {
  if (!state || typeof state !== "object") {
    return "destination";
  }

  const side = normalizeText(state.lodgingSearchSide);
  return side === "origin" || side === "destination"
    ? side
    : "destination";
}

function getResolvedLodgingEndpointState(state) {
  const endpointsStateApi = getEndpointsStateApi();

  if (endpointsStateApi) {
    const endpoint = endpointsStateApi.getResolvedLodgingEndpoint(state);
    if (endpoint) {
      return endpoint;
    }
  }

  if (
    !state ||
    state.destinationMode !== "resolved-place" ||
    !normalizeText(state.destinationPlaceLabel) ||
    !normalizeText(state.resolvedZoneId)
  ) {
    return null;
  }

  return {
    side: "destination",
    rootId: "1",
    type: "lodging",
    label: normalizeText(state.destinationPlaceLabel),
    lat: isFiniteNumber(state.destinationLat) ? state.destinationLat : null,
    lng: isFiniteNumber(state.destinationLng) ? state.destinationLng : null,
    zoneId: normalizeText(state.resolvedZoneId),
    zoneLabelKey: normalizeText(state.resolvedZoneLabelKey)
  };
}

function hasResolvedLodgingEndpointState(state) {
  return !!getResolvedLodgingEndpointState(state);
}

function hasResolvedDestinationState(state) {
  return hasResolvedLodgingEndpointState(state);
}

function setResolvedLodgingEndpoint(payload) {
  const tariffBridge = getTariffBridge();
  if (
    !tariffBridge ||
    typeof tariffBridge.setResolvedDestination !== "function"
  ) {
    return false;
  }

  return !!tariffBridge.setResolvedDestination(payload);
}

function clearResolvedLodgingEndpoint() {
  const tariffBridge = getTariffBridge();
  if (
    !tariffBridge ||
    typeof tariffBridge.clearResolvedDestination !== "function"
  ) {
    return false;
  }

  tariffBridge.clearResolvedDestination();
  return true;
}

function setHidden(node, shouldHide) {
  if (!node) return;

  if (shouldHide) {
    blurActiveElementInside(node);
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
    return;
  }

  node.hidden = false;
  node.setAttribute("aria-hidden", "false");
}

function ensureDesktopActiveLodgingFieldVisible(activeNodes) {
  if (!isDesktopViewport() || !activeNodes) {
    return;
  }

  const field = activeNodes.root
    ? activeNodes.root.closest('[data-airport-tariff-role]')
    : null;

  if (field) {
    field.hidden = false;
    field.removeAttribute("aria-hidden");
    field.style.display = "";
  }

  if (activeNodes.root) {
    activeNodes.root.hidden = false;
    activeNodes.root.style.display = "";
  }

  if (activeNodes.search) {
    activeNodes.search.hidden = false;
    activeNodes.search.style.display = "";
  }

  if (activeNodes.mount) {
    activeNodes.mount.hidden = false;
    activeNodes.mount.style.display = "";
    activeNodes.mount.setAttribute("aria-hidden", "false");
  }
}

function bindAirportMirrorProxy(rootId) {
  const airportNodes = getAirportShellNodes(rootId);
  if (!airportNodes || airportNodes.rootId !== "1") {
    return;
  }

  const mirrorButton = airportNodes.button;
  if (!mirrorButton || mirrorButton.dataset.airportMirrorProxyBound === "1") {
    return;
  }

  mirrorButton.dataset.airportMirrorProxyBound = "1";

  mirrorButton.addEventListener("click", function (event) {
    const realControl = getRealAirportControl();
    if (!realControl) {
      return;
    }

    event.preventDefault();
    realControl.focus();
    realControl.click();
  });

  mirrorButton.addEventListener("keydown", function (event) {
    const realControl = getRealAirportControl();
    if (!realControl) {
      return;
    }

    forwardAirportMirrorKeydown(event, realControl);
  });
}

function renderAirportShells(state, activeRootId) {
  const leftAirport = getAirportShellNodes("0");
  const rightAirport = getAirportShellNodes("1");
  const activeAirportRootId = activeRootId === "0" ? "1" : "0";
  const activeAirportNodes =
    activeAirportRootId === "0" ? leftAirport : rightAirport;
  const inactiveAirportNodes =
    activeAirportRootId === "0" ? rightAirport : leftAirport;

  const airportLabel = getVisibleAirportLabel(state);

  if (activeAirportNodes) {
    activeAirportNodes.shell.hidden = false;

    if (activeAirportNodes.rootId === "0") {
      activeAirportNodes.button.removeAttribute("aria-hidden");
      activeAirportNodes.button.removeAttribute("tabindex");
      activeAirportNodes.button.removeAttribute("disabled");
    } else {
      activeAirportNodes.button.textContent = airportLabel || "";
      activeAirportNodes.button.removeAttribute("aria-hidden");
      activeAirportNodes.button.removeAttribute("tabindex");
      activeAirportNodes.button.removeAttribute("disabled");
      bindAirportMirrorProxy(activeAirportNodes.rootId);
    }
  }

  if (inactiveAirportNodes) {
    inactiveAirportNodes.shell.hidden = true;

    if (inactiveAirportNodes.rootId === "0") {
      inactiveAirportNodes.button.removeAttribute("aria-hidden");
      inactiveAirportNodes.button.removeAttribute("tabindex");
      inactiveAirportNodes.button.removeAttribute("disabled");
    } else {
      inactiveAirportNodes.button.textContent = "";
      inactiveAirportNodes.button.setAttribute("aria-hidden", "true");
      inactiveAirportNodes.button.setAttribute("tabindex", "-1");
      inactiveAirportNodes.button.setAttribute("disabled", "disabled");
    }
  }
}

function renderDestinationUi() {
  const state = getTariffState();
  const uiSnapshot = getUiRenderSnapshot(state);
  const activeRootId = uiSnapshot.activeRootId;
  const activeNodes = getPanelNodes(activeRootId);
  const inactiveRootId = uiSnapshot.inactiveRootId;
  const inactiveNodes = getPanelNodes(inactiveRootId);
  const autocompleteApi = getAutocompleteApi();

  debugTrace("renderDestinationUi:before", {
    uiSnapshot: uiSnapshot,
    state: state
  });

  if (!activeNodes) {
    debugTrace("renderDestinationUi:abort-no-active-nodes", {
      uiSnapshot: uiSnapshot,
      state: state
    });
    return;
  }

  const resolvedLodging = getResolvedLodgingEndpointState(state);
  const hasResolved = !!resolvedLodging;
  const placeLabel = hasResolved ? normalizeText(resolvedLodging.label) : "";
  const zoneLabel = getVisibleZoneLabel(state);
  const fixedFareZoneNodes = getFixedFareZoneNodes();
  const showSearch = !hasResolved;
  const activeSide = uiSnapshot.activeSide;

  renderAirportShells(state, activeRootId);

  activeNodes.root.hidden = false;
  activeNodes.root.dataset.airportDestinationMode = hasResolved
    ? "resolved-place"
    : "hotel-search";
  activeNodes.root.dataset.airportDestinationActiveSide = activeSide;

  if (!showSearch) {
    blurAirportDestinationNodes(activeNodes);
  }

  setHidden(activeNodes.search, !showSearch);
  setHidden(activeNodes.mount, !showSearch);
  setHidden(activeNodes.resolved, !hasResolved);

  if (!hasResolved && activeSide === "origin") {
    ensureDesktopActiveLodgingFieldVisible(activeNodes);
  }

  if (activeNodes.manualControl) {
    activeNodes.manualControl.hidden = true;
    activeNodes.manualControl.setAttribute("aria-hidden", "true");
    activeNodes.manualControl.setAttribute("tabindex", "-1");
    activeNodes.manualControl.setAttribute("disabled", "disabled");
  }

  activeNodes.label.textContent = placeLabel;

  if (fixedFareZoneNodes) {
    setHidden(fixedFareZoneNodes.zone, !zoneLabel);
    fixedFareZoneNodes.zoneValue.textContent = zoneLabel;
  }

  if (inactiveNodes) {
    blurAirportDestinationNodes(inactiveNodes);

    inactiveNodes.root.hidden = true;
    inactiveNodes.root.dataset.airportDestinationMode = "inactive";
    inactiveNodes.root.dataset.airportDestinationActiveSide =
      rootIdToSide(inactiveRootId);

    setHidden(inactiveNodes.search, true);
    setHidden(inactiveNodes.mount, true);
    setHidden(inactiveNodes.resolved, true);

    inactiveNodes.label.textContent = "";
  }

  if (autocompleteApi && typeof autocompleteApi.setActiveRoot === "function") {
    autocompleteApi.setActiveRoot(activeRootId);
  }

  debugTrace("renderDestinationUi:after", {
    activeRootId: activeRootId,
    inactiveRootId: inactiveRootId,
    activeSide: activeSide,
    hasResolved: hasResolved,
    placeLabel: placeLabel,
    zoneLabel: zoneLabel,
    showSearch: showSearch,
    activeRootHidden: !!(activeNodes.root && activeNodes.root.hidden),
    inactiveRootHidden: !!(
      inactiveNodes &&
      inactiveNodes.root &&
      inactiveNodes.root.hidden
    ),
    activeRootMode:
      activeNodes.root &&
      activeNodes.root.dataset
        ? activeNodes.root.dataset.airportDestinationMode
        : "",
    inactiveRootMode:
      inactiveNodes &&
      inactiveNodes.root &&
      inactiveNodes.root.dataset
        ? inactiveNodes.root.dataset.airportDestinationMode
        : "",
    activeResolvedHidden: !!(activeNodes.resolved && activeNodes.resolved.hidden),
    activeSearchHidden: !!(activeNodes.search && activeNodes.search.hidden),
    activeMountHidden: !!(activeNodes.mount && activeNodes.mount.hidden),
    activeLabelText: activeNodes.label ? normalizeText(activeNodes.label.textContent) : "",
    inactiveLabelText:
      inactiveNodes && inactiveNodes.label
        ? normalizeText(inactiveNodes.label.textContent)
        : "",
    lastRenderedActiveRootId: lastRenderedActiveRootId
  });

  lastRenderedActiveRootId = activeRootId;
}

function bindClearActionForRoot(rootId) {
  const nodes = getPanelNodes(rootId);
  if (!nodes) {
    return;
  }

  if (nodes.clear.dataset.airportDestinationBound === "1") {
    return;
  }

  nodes.clear.dataset.airportDestinationBound = "1";

  nodes.clear.addEventListener("click", function () {
    clearResolvedDestination();
    renderDestinationUi();
  });
}

function bindClearAction() {
  bindClearActionForRoot("0");
  bindClearActionForRoot("1");
}

  async function preload() {
    const zoneResolver = getZoneResolver();
    if (!zoneResolver || typeof zoneResolver.loadZones !== "function") {
      return [];
    }

    try {
      return await zoneResolver.loadZones(false);
    } catch (error) {
      return [];
    }
  }

  function normalizePoint(lat, lng) {
    const safeLat = typeof lat === "number" && Number.isFinite(lat) ? lat : null;
    const safeLng = typeof lng === "number" && Number.isFinite(lng) ? lng : null;

    if (safeLat === null || safeLng === null) {
      return null;
    }

    return {
      lat: safeLat,
      lng: safeLng
    };
  }

  function buildResolvedPayload(input, resolvedZone) {
  const placeLabel = normalizeText(input.placeLabel);
  const placeId = normalizeText(input.placeId);
  const primaryType = normalizeText(input.primaryType);
  const point = normalizePoint(input.lat, input.lng);

  if (!placeLabel || !point || !resolvedZone || !resolvedZone.zoneId) {
    return null;
  }

  return {
    placeLabel: placeLabel,
    placeId: placeId,
    primaryType: primaryType,
    lat: point.lat,
    lng: point.lng,
    zoneId: normalizeText(resolvedZone.zoneId)
  };
}

  async function resolveZoneForDestination(input) {
    const zoneResolver = getZoneResolver();
    if (!zoneResolver || typeof zoneResolver.resolveZoneFromPoint !== "function") {
      return null;
    }

    const point = normalizePoint(input.lat, input.lng);
    if (!point) {
      return null;
    }

    try {
      return await zoneResolver.resolveZoneFromPoint(point);
    } catch (error) {
      return null;
    }
  }
  
    function getExtendedAirportPolicy() {
    const policy = window.PixkuyAirportExtendedRingsPolicy;

    return policy && typeof policy === "object" ? policy : null;
  }

  function getAirportIdFromTariffState(state) {
    if (!state || typeof state !== "object") {
      return "";
    }

    if (
      state.originType === "airport" &&
      typeof state.originValue === "string" &&
      state.originValue.trim()
    ) {
      return state.originValue.trim().toLowerCase();
    }

    if (
      state.destinationType === "airport" &&
      typeof state.destinationValue === "string" &&
      state.destinationValue.trim()
    ) {
      return state.destinationValue.trim().toLowerCase();
    }

    return "";
  }

  function getExtendedRingSaleMode(state, zoneId) {
    const policy = getExtendedAirportPolicy();

    if (
      !policy ||
      typeof policy.getSaleModeForFare !== "function" ||
      typeof policy.isExtendedRingZoneId !== "function"
    ) {
      return "automatic";
    }

    if (!policy.isExtendedRingZoneId(zoneId)) {
      return "automatic";
    }

    return policy.getSaleModeForFare({
      airportId: getAirportIdFromTariffState(state),
      zoneId: zoneId
    });
  }

  async function applyResolvedDestination(input) {
  const tariffBridge = getTariffBridge();
  const lodgingTypesPolicy = getLodgingTypesPolicy();

  debugTrace("applyResolvedDestination:start", {
    input: input,
    hasTariffBridge: !!tariffBridge,
    hasTariffBridgeGetState:
      !!tariffBridge && typeof tariffBridge.getState === "function",
    hasLodgingTypesPolicy: !!lodgingTypesPolicy
  });

  if (
    !tariffBridge ||
    typeof tariffBridge.getState !== "function"
  ) {
    debugTrace("applyResolvedDestination:fail", {
      reason: "tariff-bridge-unavailable"
    });

    return {
      ok: false,
      reason: "tariff-bridge-unavailable"
    };
  }

  if (
    !lodgingTypesPolicy ||
    typeof lodgingTypesPolicy.isAcceptedLodgingPrimaryType !== "function" ||
    typeof lodgingTypesPolicy.getRejectedReason !== "function"
  ) {
    debugTrace("applyResolvedDestination:fail", {
      reason: "lodging-policy-unavailable"
    });

    return {
      ok: false,
      reason: "lodging-policy-unavailable"
    };
  }

  const placeLabel = normalizeText(input && input.placeLabel);
  const placeId = normalizeText(input && input.placeId);
  const primaryType = normalizeText(input && input.primaryType);
  const point = normalizePoint(input && input.lat, input && input.lng);

  debugTrace("applyResolvedDestination:normalized-input", {
    placeLabel: placeLabel,
    primaryType: primaryType,
    point: point
  });

  if (!placeLabel || !primaryType || !point) {
    debugTrace("applyResolvedDestination:fail", {
      reason: "invalid-input",
      placeLabel: placeLabel,
      primaryType: primaryType,
      point: point
    });

    return {
      ok: false,
      reason: "invalid-input"
    };
  }

  if (!lodgingTypesPolicy.isAcceptedLodgingPrimaryType(primaryType)) {
    const rejectedReason = lodgingTypesPolicy.getRejectedReason(primaryType);

    debugTrace("applyResolvedDestination:fail", {
      reason: rejectedReason,
      primaryType: primaryType
    });

    return {
      ok: false,
      reason: rejectedReason,
      rejectedPrimaryType: primaryType
    };
  }

  const resolvedZone = await resolveZoneForDestination({
    lat: point.lat,
    lng: point.lng
  });

  debugTrace("applyResolvedDestination:resolved-zone", {
    resolvedZone: resolvedZone
  });

  if (!resolvedZone || !resolvedZone.zoneId) {
    debugTrace("applyResolvedDestination:fail", {
      reason: "zone-not-found",
      resolvedZone: resolvedZone
    });

    return {
      ok: false,
      reason: "zone-not-found",
      resolvedZone: null
    };
  }

  const tariffState = tariffBridge.getState();
  const extendedRingSaleMode = getExtendedRingSaleMode(
    tariffState,
    resolvedZone.zoneId
  );

  if (extendedRingSaleMode === "unavailable") {
    debugTrace("applyResolvedDestination:fail", {
      reason: "extended-ring-unavailable",
      resolvedZone: resolvedZone,
      saleMode: extendedRingSaleMode,
      airportId: getAirportIdFromTariffState(tariffState)
    });

    return {
      ok: false,
      reason: "extended-ring-unavailable",
      resolvedZone: resolvedZone,
      saleMode: extendedRingSaleMode
    };
  }

  const payload = buildResolvedPayload(
    {
      placeLabel: placeLabel,
      placeId: placeId,
      primaryType: primaryType,
      lat: point.lat,
      lng: point.lng
    },
    resolvedZone
  );

  debugTrace("applyResolvedDestination:payload", {
    payload: payload
  });

  if (!payload) {
    debugTrace("applyResolvedDestination:fail", {
      reason: "invalid-payload"
    });

    return {
      ok: false,
      reason: "invalid-payload"
    };
  }

  const applied = setResolvedLodgingEndpoint(payload);

  debugTrace("applyResolvedDestination:setResolvedLodgingEndpoint", {
    applied: applied,
    payload: payload,
    state:
      typeof tariffBridge.getState === "function"
        ? tariffBridge.getState()
        : null
  });

  if (!applied) {
    debugTrace("applyResolvedDestination:fail", {
      reason: "tariff-bridge-rejected",
      resolvedZone: resolvedZone
    });

    return {
      ok: false,
      reason: "tariff-bridge-rejected",
      resolvedZone: resolvedZone
    };
  }

  const successResult = {
    ok: true,
    reason: "",
    resolvedZone: resolvedZone,
    payload: payload,
    state:
      typeof tariffBridge.getState === "function"
        ? tariffBridge.getState()
        : null
  };

  debugTrace("applyResolvedDestination:success", successResult);

  return successResult;
}

  function clearResolvedDestination() {
  const cleared = clearResolvedLodgingEndpoint();
  if (!cleared) {
    return false;
  }

  renderDestinationUi();
  return true;
}

  async function resolveAndApplyDestination(input) {
  debugTrace("resolveAndApplyDestination:start", {
    input: input
  });

  await preload();

  const result = await applyResolvedDestination(input);

  debugTrace("resolveAndApplyDestination:result", {
    result: result
  });

  if (result && result.ok) {
    renderDestinationUi();
  }

  return result;
}

  function initAirportDestination() {
  if (!hasReadyDependencies()) {
    return;
  }

  bindClearAction();
  bindAirportMirrorProxy("1");
  renderDestinationUi();
}

window.PixkuyAirportDestination = {
  hasReadyDependencies: hasReadyDependencies,
  preload: preload,
  resolveZoneForDestination: resolveZoneForDestination,
  getResolvedLodgingEndpointState: getResolvedLodgingEndpointState,
  hasResolvedLodgingEndpointState: hasResolvedLodgingEndpointState,
  setResolvedLodgingEndpoint: setResolvedLodgingEndpoint,
  clearResolvedLodgingEndpoint: clearResolvedLodgingEndpoint,
  applyResolvedDestination: applyResolvedDestination,
  resolveAndApplyDestination: resolveAndApplyDestination,
  clearResolvedDestination: clearResolvedDestination,
  renderDestinationUi: renderDestinationUi,
  init: initAirportDestination
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAirportDestination, {
    once: true
  });
} else {
  initAirportDestination();
}
})();