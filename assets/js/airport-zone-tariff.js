(function () {
  "use strict";

  const SELECTORS = {
    panel: "#services-expand-airport",
    originField: '[data-airport-tariff-role="origin"]',
    destinationField: '[data-airport-tariff-role="destination"]',
    passengersField: '[data-airport-tariff-role="passengers"]',
    originControl: "#airport-tariff-origin",
    destinationControl: "#airport-tariff-destination",
    passengersControl: "#airport-tariff-passengers",
    swapButton: "#airport-tariff-swap",
    fareValue: ".services-expand__fare",
    cta: ".services-expand__cta"
  };

  const I18N_KEYS = {
    swapAriaLabel: "services.cards.airport.panel.swapAriaLabel",
    fareValue: "services.cards.airport.panel.fareValue"
  };

  const DROPDOWN_KEYS = {
    loading: "contact.places.loading",
    empty: "contact.places.empty",
    error: "contact.places.error"
  };

  const DEFAULT_STATE = {
    originType: "airport",
    destinationType: "zone",
    originValue: "",
    destinationValue: "",
    originLabel: "",
    destinationLabel: "",
    destinationMode: "manual-zone",
    destinationPlaceLabel: "",
    destinationLat: null,
    destinationLng: null,
    resolvedZoneId: "",
    resolvedZoneLabelKey: "",
    lodgingEndpointSide: "",
    lodgingSearchSide: "destination",
    lodgingEndpointLabel: "",
    lodgingEndpointLat: null,
    lodgingEndpointLng: null,
    lodgingEndpointZoneId: "",
    lodgingEndpointZoneLabelKey: "",
    selectedFareKey: "",
    serviceDate: "",
    serviceTime: "",
    openRole: "",
    activeIndex: -1
  };
  
  const utils = window.PixkuyAirportTariffUtils || null;

  function requireUtils() {
    if (!utils || typeof utils !== "object") {
      throw new Error("PixkuyAirportTariffUtils is not available");
    }

    return utils;
  }

  const catalogApi = window.PixkuyAirportTariffCatalog || null;

  function requireCatalogApi() {
    if (!catalogApi || typeof catalogApi !== "object") {
      throw new Error("PixkuyAirportTariffCatalog is not available");
    }

    return catalogApi;
  }

  const dropdownsApi = window.PixkuyAirportTariffDropdowns || null;

  function requireDropdownsApi() {
    if (!dropdownsApi || typeof dropdownsApi !== "object") {
      throw new Error("PixkuyAirportTariffDropdowns is not available");
    }

    return dropdownsApi;
  }

  const stateApi = window.PixkuyAirportTariffState || null;

  function requireStateApi() {
    if (!stateApi || typeof stateApi !== "object") {
      throw new Error("PixkuyAirportTariffState is not available");
    }

    return stateApi;
  }

  const handoffApi = window.PixkuyAirportTariffHandoff || null;

  function requireHandoffApi() {
    if (!handoffApi || typeof handoffApi !== "object") {
      throw new Error("PixkuyAirportTariffHandoff is not available");
    }

    return handoffApi;
  }

  const swapApi = window.PixkuyAirportTariffSwap || null;

  function requireSwapApi() {
    if (!swapApi || typeof swapApi !== "object") {
      throw new Error("PixkuyAirportTariffSwap is not available");
    }

    return swapApi;
  }
  
  const ctaApi = window.PixkuyAirportTariffCta || null;

  function requireCtaApi() {
    if (!ctaApi || typeof ctaApi !== "object") {
      throw new Error("PixkuyAirportTariffCta is not available");
    }

    return ctaApi;
  }

  const temporalPricingApi = window.PixkuyAirportTariffTemporalPricing || null;

  function getTemporalPricingApi() {
    if (!temporalPricingApi || typeof temporalPricingApi !== "object") {
      return null;
    }

    return temporalPricingApi;
  }

  function getStateDeps() {
    return {
      isFiniteNumber: isFiniteNumber,
      normalizeText: normalizeText,
      findItemById: findItemById,
      resolveItemLabel: resolveItemLabel,
      getZoneIdForFare: getZoneIdForFare,
      getZoneOptionById: getZoneOptionById,
      debugSwapTrace: debugSwapTrace
    };
  }

  function getHandoffDeps() {
    return {
      normalizeText: normalizeText,
      getActiveLodgingSide: getActiveLodgingSide,
      resolveDisplayLabel: resolveDisplayLabel,
      getZoneIdForFare: getZoneIdForFare,
      resolveFare: resolveFare,
      formatPrice: formatPrice,
      resolveFareKeyDisplayLabel: resolveFareKeyDisplayLabel,
      debugSwapTrace: debugSwapTrace
    };
  }
  
  function getSwapDeps() {
    return {
      normalizeText: normalizeText,
      applyLodgingEndpointState: applyLodgingEndpointState,
      clearLodgingEndpointState: clearLodgingEndpointState,
      debugSwapTrace: debugSwapTrace,
      isFiniteNumber: isFiniteNumber
    };
  }
  
  function getCtaDeps() {
    return {
      normalizeText: normalizeText,
      getSelectedFareKey: getSelectedFareKey,
      getZoneIdForFare: getZoneIdForFare,
      resolveFare: resolveFare,
      getTemporalPricingApi: getTemporalPricingApi
    };
  }

  function getZoneResolver() {
    const resolver = window.PixkuyZoneResolver;
    if (!resolver || typeof resolver !== "object") return null;
    return resolver;
  }

  function isFiniteNumber(value) {
    return requireUtils().isFiniteNumber(value);
  }

  function normalizeText(value) {
    return requireUtils().normalizeText(value);
  }

  function getSafariTimeSelectApi() {
    const api = window.PixkuySafariTimeSelect;

    return api && typeof api.mount === "function" ? api : null;
  }

  function getSafariDesktopTimeSelect(nodes) {
    return nodes && nodes.timeField
      ? nodes.timeField.querySelector("[data-airport-tariff-time-select]")
      : null;
  }

  function syncSafariDesktopTimeSelect(nodes, state) {
    const select = getSafariDesktopTimeSelect(nodes);
    const serviceTime =
      state && typeof state.serviceTime === "string"
        ? normalizeText(state.serviceTime)
        : "";

    if (!select) {
      return false;
    }

    if (select.value !== serviceTime) {
      select.value = serviceTime;
    }

    return true;
  }

  function ensureSafariDesktopTimeFallback(nodes) {
    const api = getSafariTimeSelectApi();
    const result = api && nodes && nodes.timeInput
      ? api.mount({
          input: nodes.timeInput,
          container: nodes.timeInput.parentNode,
          overlay: nodes.timeOverlay || null,
          selectSelector: "[data-airport-tariff-time-select]",
          className: "services-expand__control",
          label: "Hora",
          placeholder: "--:--",
          dataAttributeName: "data-airport-tariff-time-select",
          dataAttributeValue: "1",
          getValue: function getValue() {
            return nodes && nodes.timeInput
              ? normalizeText(nodes.timeInput.value)
              : "";
          },
          onValueChange: function onValueChange(value, nativeInput) {
            nativeInput.value = normalizeText(value);
            nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
            nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        })
      : null;

    return Boolean(result && result.mounted);
  }

  function hasZoneResolver() {
    return !!getZoneResolver();
  }

  function getZoneIdForFare(state) {
    return requireCatalogApi().getZoneIdForFare(state);
  }

  function getSelectedFareKey(state) {
    return requireStateApi().getSelectedFareKey(state, getStateDeps());
  }

  function getPassengersPlaceholderValue() {
    return requireUtils().getPassengersPlaceholderValue();
  }

  function setSelectedFareKeyState(state, payload) {
    return requireStateApi().setSelectedFareKeyState(
      state,
      payload,
      getStateDeps()
    );
  }

  function getPassengerFareOptions() {
    return requireUtils().getPassengerFareOptions();
  }

  function resolveFareKeyDisplayLabel(fareKey) {
    return requireUtils().resolveFareKeyDisplayLabel(fareKey);
  }

  function getZoneOptionById(zoneId) {
    return requireCatalogApi().getZoneOptionById(zoneId);
  }

  function syncResolvedZoneFromState(state) {
    return requireStateApi().syncResolvedZoneFromState(state, getStateDeps());
  }

  function clearLodgingEndpointState(state) {
    return requireStateApi().clearLodgingEndpointState(state, getStateDeps());
  }

  function getActiveLodgingSide(state) {
    return requireStateApi().getActiveLodgingSide(state, getStateDeps());
  }

  function applyLodgingEndpointState(state, payload) {
    return requireStateApi().applyLodgingEndpointState(
      state,
      payload,
      getStateDeps()
    );
  }

  function clearResolvedDestinationState(state) {
    return requireStateApi().clearResolvedDestinationState(
      state,
      getStateDeps()
    );
  }

  function applyAirportSelectionState(state, payload) {
    return requireStateApi().applyAirportSelectionState(
      state,
      payload,
      getStateDeps()
    );
  }

  function resetPanelToAirportEmptyState(state, clearedLodgingSide) {
    return requireStateApi().resetPanelToAirportEmptyState(
      state,
      clearedLodgingSide,
      getStateDeps()
    );
  }

  function hasResolvedDestination(state) {
    return requireStateApi().hasResolvedDestination(state, getStateDeps());
  }

  function applyResolvedDestinationState(state, payload) {
    return requireStateApi().applyResolvedDestinationState(
      state,
      payload,
      getStateDeps()
    );
  }

  async function preloadZoneResolver() {
    const resolver = getZoneResolver();
    if (!resolver || typeof resolver.loadZones !== "function") {
      return [];
    }

    try {
      return await resolver.loadZones(false);
    } catch (error) {
      return [];
    }
  }

  async function resolveZoneFromPoint(pointInput) {
    const resolver = getZoneResolver();
    if (!resolver || typeof resolver.resolveZoneFromPoint !== "function") {
      return null;
    }

    try {
      return await resolver.resolveZoneFromPoint(pointInput);
    } catch (error) {
      return null;
    }
  }

  function getPlaceholderKey(role, type) {
    return requireUtils().getPlaceholderKey(role, type);
  }

  function getPlaceholder(role, type) {
    return requireUtils().getPlaceholder(role, type);
  }

  function getSwapAriaLabel() {
    return requireUtils().getSwapAriaLabel(I18N_KEYS);
  }

  function getFareFallbackValue() {
    return requireUtils().getFareFallbackValue(I18N_KEYS);
  }

  function getDropdownStatusCopy(kind) {
    return requireUtils().getDropdownStatusCopy(kind, DROPDOWN_KEYS);
  }

  function hasI18nRuntimeReady() {
    return requireUtils().hasI18nRuntimeReady();
  }

  function debugSwapTrace() {
    return;
  }

  function refreshResolvedLabels(state) {
    const hasOriginLodgingEndpoint =
      state &&
      state.lodgingEndpointSide === "origin" &&
      typeof state.lodgingEndpointLabel === "string" &&
      state.lodgingEndpointLabel.trim().length > 0;

    if (hasOriginLodgingEndpoint) {
      state.originLabel = state.lodgingEndpointLabel.trim();
    } else if (state.originValue) {
      state.originLabel = resolveDisplayLabel(state.originType, state.originValue) || "";
    } else {
      state.originLabel = "";
    }

    if (hasResolvedDestination(state)) {
      state.destinationLabel = state.destinationPlaceLabel;
      return;
    }

    if (state.destinationValue) {
      state.destinationLabel = resolveDisplayLabel(
        state.destinationType,
        state.destinationValue
      ) || "";
      return;
    }

    state.destinationLabel = "";
  }

  function scheduleI18nLabelHydration(nodes, state, attempt) {
    const nextAttempt = typeof attempt === "number" ? attempt : 0;

    if (hasI18nRuntimeReady()) {
      refreshResolvedLabels(state);
      renderPanel(nodes, state);
      return;
    }

    if (nextAttempt >= 40) {
      return;
    }

    window.setTimeout(function () {
      scheduleI18nLabelHydration(nodes, state, nextAttempt + 1);
    }, 50);
  }

  function getPanelNodes(panel) {
  if (!panel) return null;

  const originField = panel.querySelector(SELECTORS.originField);
  const destinationField = panel.querySelector(SELECTORS.destinationField);
  const passengersField = panel.querySelector(SELECTORS.passengersField);
  const originControl = panel.querySelector(SELECTORS.originControl);
  const destinationControl = panel.querySelector(SELECTORS.destinationControl);
  const passengersControl = panel.querySelector(SELECTORS.passengersControl);
  const swapButton = panel.querySelector(SELECTORS.swapButton);
  const fareValue = panel.querySelector(SELECTORS.fareValue);
  const cta = panel.querySelector(SELECTORS.cta);
  const dateField = panel.querySelector('[data-airport-tariff-role="date"]');
  const dateInput = panel.querySelector('[data-airport-tariff-date]');
  const dateOverlay = panel.querySelector(".services-expand__date-overlay");
  const timeField = panel.querySelector('[data-airport-tariff-role="time"]');
  const timeInput = panel.querySelector('[data-airport-tariff-time]');
  const timeOverlay = panel.querySelector(".services-expand__time-overlay");
  const passengersSegmentedGroup = passengersField
    ? passengersField.querySelector("[data-airport-tariff-passengers-group]")
    : null;

  if (
    !originField ||
    !destinationField ||
    !passengersField ||
    !originControl ||
    !destinationControl ||
    !passengersControl ||
    !swapButton ||
    !fareValue ||
    !cta
  ) {
    return null;
  }

  return {
    panel,
    originField,
    destinationField,
    passengersField,
    originControl,
    destinationControl,
    passengersControl,
    passengersSegmentedGroup,
    swapButton,
    fareValue,
    cta,
    dateField,
    dateInput,
    dateOverlay,
    timeField,
    timeInput,
    timeOverlay
  };
}

function shouldUsePassengerChipUi(nodes) {
  if (!nodes || !nodes.passengersSegmentedGroup) {
    return false;
  }

  if (
    !window.PixkuyAirportTariffPassengers ||
    typeof window.PixkuyAirportTariffPassengers.getPassengerOptionNodes !== "function" ||
    typeof window.PixkuyAirportTariffPassengers.renderPassengerSelection !== "function" ||
    typeof window.PixkuyAirportTariffPassengers.bindPassengerSelection !== "function"
  ) {
    return false;
  }

  return true;
}

  function createState() {
    return {
      originType: DEFAULT_STATE.originType,
      destinationType: DEFAULT_STATE.destinationType,
      originValue: DEFAULT_STATE.originValue,
      destinationValue: DEFAULT_STATE.destinationValue,
      originLabel: DEFAULT_STATE.originLabel,
      destinationLabel: DEFAULT_STATE.destinationLabel,
      destinationMode: DEFAULT_STATE.destinationMode,
      destinationPlaceLabel: DEFAULT_STATE.destinationPlaceLabel,
      destinationLat: DEFAULT_STATE.destinationLat,
      destinationLng: DEFAULT_STATE.destinationLng,
      resolvedZoneId: DEFAULT_STATE.resolvedZoneId,
      resolvedZoneLabelKey: DEFAULT_STATE.resolvedZoneLabelKey,
      lodgingEndpointSide: DEFAULT_STATE.lodgingEndpointSide,
      lodgingSearchSide: DEFAULT_STATE.lodgingSearchSide,
      lodgingEndpointLabel: DEFAULT_STATE.lodgingEndpointLabel,
      lodgingEndpointLat: DEFAULT_STATE.lodgingEndpointLat,
      lodgingEndpointLng: DEFAULT_STATE.lodgingEndpointLng,
      lodgingEndpointZoneId: DEFAULT_STATE.lodgingEndpointZoneId,
      lodgingEndpointZoneLabelKey: DEFAULT_STATE.lodgingEndpointZoneLabelKey,
      selectedFareKey: DEFAULT_STATE.selectedFareKey,
      serviceDate: DEFAULT_STATE.serviceDate,
      serviceTime: DEFAULT_STATE.serviceTime,
      openRole: DEFAULT_STATE.openRole,
      activeIndex: DEFAULT_STATE.activeIndex
    };
  }

  function typeFromControl(control) {
    return control.dataset.airportTariffType === "airport" ? "airport" : "zone";
  }

  function setControlType(control, type) {
    control.dataset.airportTariffType = type;
  }

  function setFieldType(field, type) {
    field.dataset.airportTariffType = type;
  }

  function getActiveItemsByType(type) {
    return requireCatalogApi().getActiveItemsByType(type);
  }

  function findItemById(type, id) {
    return requireCatalogApi().findItemById(type, id);
  }

  function resolveItemLabel(item) {
    return requireCatalogApi().resolveItemLabel(item);
  }
  
  function resolveDisplayLabel(type, value) {
    return requireCatalogApi().resolveDisplayLabel(type, value);
  }

  function setControlDisplayValue(control, role, type, value, label) {
    const safeValue = typeof value === "string" ? value.trim() : "";
    const safeLabel = typeof label === "string" ? label.trim() : "";

    if (safeValue && safeLabel) {
      control.textContent = safeLabel;
      control.dataset.airportTariffValue = safeValue;
      control.removeAttribute("data-i18n");
      return;
    }

    control.textContent = getPlaceholder(role, type);
    control.dataset.airportTariffValue = safeValue;
    control.setAttribute("data-i18n", getPlaceholderKey(role, type));
  }

  function formatPrice(price, currency) {
    return requireUtils().formatPrice(price, currency);
  }

  function resolveFare(state) {
    return requireCatalogApi().resolveFare(state);
  }
  
    function getReservationMinimumDateLiteral() {
    const formsApi = window.PixkuyForms || {};
    const getMinimumDateTime =
      typeof formsApi.getReservationMinimumDateTime === "function"
        ? formsApi.getReservationMinimumDateTime
        : null;
    const formatDate =
      typeof formsApi.formatReservationDateForInput === "function"
        ? formsApi.formatReservationDateForInput
        : null;
    const minimumDateTime = getMinimumDateTime
      ? getMinimumDateTime()
      : null;

    if (!minimumDateTime || !formatDate) {
      return "";
    }

    return normalizeText(formatDate(minimumDateTime));
  }

  function syncTemporalDateInput(nodes, state) {
    const minimumDateLiteral = getReservationMinimumDateLiteral();
    const currentServiceDate =
      state && typeof state.serviceDate === "string"
        ? normalizeText(state.serviceDate)
        : "";

    if (!nodes || !nodes.dateInput) {
      return false;
    }

    if (minimumDateLiteral) {
      nodes.dateInput.setAttribute("min", minimumDateLiteral);
    } else {
      nodes.dateInput.removeAttribute("min");
    }

    if (minimumDateLiteral && currentServiceDate && currentServiceDate < minimumDateLiteral) {
      state.serviceDate = "";
    }

    if (nodes.dateInput.value !== (state.serviceDate || "")) {
      nodes.dateInput.value = state.serviceDate || "";
    }

    if (nodes.dateOverlay) {
      nodes.dateOverlay.hidden = Boolean(nodes.dateInput.value);
    }

    return true;
  }

  function syncTemporalDateFieldVisibility(nodes, state) {
    const temporalPricing = getTemporalPricingApi();
    const shouldShow =
      !!(
        temporalPricing &&
        typeof temporalPricing.shouldShowDateFieldInServices === "function" &&
        temporalPricing.shouldShowDateFieldInServices()
      );

    if (!nodes || !nodes.dateField || !nodes.dateInput) {
      return false;
    }

    nodes.dateField.hidden = !shouldShow;
    nodes.dateField.setAttribute("aria-hidden", shouldShow ? "false" : "true");

    if (nodes.timeField) {
      nodes.timeField.hidden = !shouldShow;
      nodes.timeField.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    }

    if (!shouldShow) {
      nodes.dateInput.value = "";
      if (state) {
        state.serviceDate = "";
        state.serviceTime = "";
      }

      if (nodes.dateOverlay) {
        nodes.dateOverlay.hidden = false;
      }

      if (nodes.timeInput) {
        nodes.timeInput.value = "";
      }

      if (nodes.timeOverlay) {
        nodes.timeOverlay.hidden = false;
      }
    }

    return true;
  }
  
  function syncTemporalTimeInput(nodes, state) {
    const currentServiceTime =
      state && typeof state.serviceTime === "string"
        ? normalizeText(state.serviceTime)
        : "";

    if (!nodes || !nodes.timeInput) {
      return false;
    }

    if (nodes.timeInput.value !== (currentServiceTime || "")) {
      nodes.timeInput.value = currentServiceTime || "";
    }

    syncSafariDesktopTimeSelect(nodes, state);

    if (nodes.timeOverlay) {
      if (getSafariDesktopTimeSelect(nodes)) {
        nodes.timeOverlay.hidden = true;
        nodes.timeOverlay.style.display = "none";
      } else {
        nodes.timeOverlay.hidden = Boolean(nodes.timeInput.value);
      }
    }

    return true;
  }

  function renderFare(nodes, state) {
    const fareKey = getSelectedFareKey(state);
    const fare = resolveFare(state);
    const temporalPricing = getTemporalPricingApi();
    const serviceDate =
      state && typeof state.serviceDate === "string"
        ? normalizeText(state.serviceDate)
        : "";

    if (!fareKey) {
      nodes.fareValue.textContent = getFareFallbackValue();
      nodes.fareValue.setAttribute("data-i18n", I18N_KEYS.fareValue);
      return;
    }

    if (!fare) {
      nodes.fareValue.textContent = getFareFallbackValue();
      nodes.fareValue.setAttribute("data-i18n", I18N_KEYS.fareValue);
      return;
    }

    if (
      temporalPricing &&
      typeof temporalPricing.shouldShowDateFieldInServices === "function" &&
      temporalPricing.shouldShowDateFieldInServices() &&
      !serviceDate
    ) {
      nodes.fareValue.textContent = getFareFallbackValue();
      nodes.fareValue.setAttribute("data-i18n", I18N_KEYS.fareValue);
      return;
    }

    const finalPrice =
      temporalPricing &&
      typeof temporalPricing.applyTemporalPricing === "function"
        ? temporalPricing.applyTemporalPricing(fare.price, serviceDate)
        : fare.price;

    if (typeof finalPrice !== "number" || !Number.isFinite(finalPrice)) {
      nodes.fareValue.textContent = getFareFallbackValue();
      nodes.fareValue.setAttribute("data-i18n", I18N_KEYS.fareValue);
      return;
    }

    const formattedPrice = formatPrice(finalPrice, fare.currency);
    nodes.fareValue.textContent = formattedPrice;
    nodes.fareValue.removeAttribute("data-i18n");
  }

  function renderCtaState(nodes, state) {
    const eligibility = requireCtaApi().getCtaEligibility(
      state,
      getCtaDeps()
    );

    requireCtaApi().applyCtaState(nodes.cta, eligibility);

    return eligibility;
  }

  function renderAccessibility(nodes) {
    const swapAriaLabel = getSwapAriaLabel();

    if (swapAriaLabel) {
      nodes.swapButton.setAttribute("aria-label", swapAriaLabel);
      nodes.swapButton.setAttribute("title", swapAriaLabel);
      return;
    }

    nodes.swapButton.removeAttribute("aria-label");
    nodes.swapButton.removeAttribute("title");
  }

  function renderControls(nodes, state) {
  const hasPassengerChips = shouldUsePassengerChipUi(nodes);

  setFieldType(nodes.originField, state.originType);
  setFieldType(nodes.destinationField, state.destinationType);
  setFieldType(nodes.passengersField, "fare-key");
  setControlType(nodes.originControl, state.originType);
  setControlType(nodes.destinationControl, state.destinationType);
  setControlType(nodes.passengersControl, "fare-key");

  setControlDisplayValue(
    nodes.originControl,
    "origin",
    state.originType,
    state.originValue,
    state.originLabel
  );

  nodes.destinationControl.textContent = "";
  nodes.destinationControl.dataset.airportTariffValue = "";
  nodes.destinationControl.removeAttribute("data-i18n");
  nodes.destinationControl.hidden = true;
  nodes.destinationControl.style.display = "none";
  nodes.destinationControl.setAttribute("aria-hidden", "true");
  nodes.destinationControl.setAttribute("tabindex", "-1");
  nodes.destinationControl.setAttribute("disabled", "disabled");

  if (
  hasPassengerChips &&
  typeof window.PixkuyAirportTariffPassengers.renderPassengerSelection === "function"
) {
  if (nodes.passengersSegmentedGroup) {
    nodes.passengersSegmentedGroup.hidden = false;
    nodes.passengersSegmentedGroup.removeAttribute("aria-hidden");
  }

  if (nodes.passengersControl) {
    nodes.passengersControl.hidden = true;
    nodes.passengersControl.style.display = "none";
    nodes.passengersControl.setAttribute("aria-hidden", "true");
    nodes.passengersControl.setAttribute("tabindex", "-1");
    nodes.passengersControl.setAttribute("disabled", "disabled");
  }

  window.PixkuyAirportTariffPassengers.renderPassengerSelection(
      nodes,
      state,
      {
        normalizeText: normalizeText,
        getSelectedFareKey: getSelectedFareKey,
        setSelectedFareKeyState: setSelectedFareKeyState
      }
    );
  } else if (nodes.passengersControl) {
  const fareKeyLabel = resolveFareKeyDisplayLabel(state.selectedFareKey);

  if (nodes.passengersSegmentedGroup) {
    nodes.passengersSegmentedGroup.hidden = true;
    nodes.passengersSegmentedGroup.setAttribute("aria-hidden", "true");
  }

    nodes.passengersControl.hidden = false;
    nodes.passengersControl.style.display = "";
    nodes.passengersControl.removeAttribute("aria-hidden");
    nodes.passengersControl.removeAttribute("tabindex");
    nodes.passengersControl.removeAttribute("disabled");

    if (fareKeyLabel) {
      nodes.passengersControl.textContent = fareKeyLabel;
      nodes.passengersControl.dataset.airportTariffValue = normalizeText(state.selectedFareKey);
      nodes.passengersControl.removeAttribute("data-i18n");
    } else {
      nodes.passengersControl.textContent = getPassengersPlaceholderValue();
      nodes.passengersControl.dataset.airportTariffValue = "";
      nodes.passengersControl.setAttribute(
        "data-i18n",
        "services.cards.airport.panel.passengersPlaceholder"
      );
    }
  }
}

  function renderPanel(nodes, state) {
    debugSwapTrace("renderPanel:before", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });

    refreshResolvedLabels(state);
    syncResolvedZoneFromState(state);

    debugSwapTrace("renderPanel:after-label-sync", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });

    renderControls(nodes, state);
    syncTemporalDateFieldVisibility(nodes, state);
    syncTemporalDateInput(nodes, state);
    syncTemporalTimeInput(nodes, state);
    ensureOriginDropdownAnchored(nodes, state);
    renderFare(nodes, state);
    renderCtaState(nodes, state);
    renderAccessibility(nodes);
  }

  function getEndpointsStateApi() {
    const api = window.PixkuyAirportEndpointsState;
    if (!api || typeof api !== "object") {
      return null;
    }

    if (typeof api.buildEndpointSnapshot !== "function") {
      return null;
    }

    if (typeof api.swapEndpointSnapshot !== "function") {
      return null;
    }

    if (typeof api.buildLegacyStateFromEndpointSnapshot !== "function") {
      return null;
    }

    return api;
  }

  function rerenderAirportDestinationUi() {
    const api = window.PixkuyAirportDestination;
    if (!api || typeof api !== "object") {
      return;
    }

    if (typeof api.renderDestinationUi !== "function") {
      return;
    }

    api.renderDestinationUi();
  }



  function buildCurrentContactSummaryPayload(state) {
    return requireHandoffApi().buildCurrentContactSummaryPayload(
      state,
      getHandoffDeps()
    );
  }

  function handoffPanelSelectionToContact(state) {
    return requireHandoffApi().handoffPanelSelectionToContact(
      state,
      getHandoffDeps()
    );
  }

  function swapState(state) {
    return requireSwapApi().swapState(
      state,
      getEndpointsStateApi(),
      getSwapDeps()
    );
  }

  function syncStateFromDom(nodes, state) {
    const activeLodgingSide = getActiveLodgingSide(state);
    const originControlValue = normalizeText(
      nodes.originControl && nodes.originControl.dataset
        ? nodes.originControl.dataset.airportTariffValue
        : ""
    );
    const destinationControlValue = normalizeText(
      nodes.destinationControl && nodes.destinationControl.dataset
        ? nodes.destinationControl.dataset.airportTariffValue
        : ""
    );
    const destinationControlHidden = !!(
      nodes.destinationControl &&
      (nodes.destinationControl.hidden ||
        nodes.destinationControl.getAttribute("aria-hidden") === "true" ||
        nodes.destinationControl.hasAttribute("disabled"))
    );

    debugSwapTrace("syncStateFromDom:before", {
      activeLodgingSide: activeLodgingSide,
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingSearchSide: state.lodgingSearchSide,
      originControlValue: originControlValue,
      destinationControlValue: destinationControlValue,
      destinationControlHidden: destinationControlHidden
    });

    if (activeLodgingSide !== "origin" && originControlValue) {
      state.originType = typeFromControl(nodes.originControl);
      state.originValue = originControlValue;
      state.originLabel =
        resolveDisplayLabel(state.originType, state.originValue) || "";
    }

    if (
      activeLodgingSide !== "destination" &&
      state.destinationMode !== "resolved-place" &&
      !destinationControlHidden
    ) {
      if (destinationControlValue) {
        state.destinationType = typeFromControl(nodes.destinationControl);
        state.destinationValue = destinationControlValue;
        state.destinationLabel =
          resolveDisplayLabel(state.destinationType, state.destinationValue) || "";
      }
    }

    syncResolvedZoneFromState(state);

    debugSwapTrace("syncStateFromDom:after", {
      activeLodgingSide: activeLodgingSide,
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingSearchSide: state.lodgingSearchSide,
      originControlValue: originControlValue,
      destinationControlValue: destinationControlValue,
      destinationControlHidden: destinationControlHidden
    });
  }
  
    function getAirportDeepLinkPayloadFromUrl() {
    var params;
    var service;
    var airportId;
    var direction;
    var isMobileViewport;

    try {
      isMobileViewport = Boolean(
        window &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(max-width: 720px)").matches
      );

      if (isMobileViewport) {
        return null;
      }

      params = new URLSearchParams(window.location.search || "");
      service = normalizeText(params.get("service")).toLowerCase();

      if (service !== "airport_hotel") {
        return null;
      }

      airportId = normalizeText(params.get("airport_id"));
      direction = normalizeText(params.get("airport_direction"));

      if (!airportId) {
        return null;
      }

      if (direction !== "hotel_to_airport") {
        direction = "airport_to_hotel";
      }

      return {
        airportId: airportId,
        direction: direction
      };
    } catch (error) {
      return null;
    }
  }

  function seedInitialState(state) {
    const airports = getActiveItemsByType("airport");
    const firstAirport = airports[0] || null;

    clearResolvedDestinationState(state);
    clearLodgingEndpointState(state);

    state.destinationValue = "";
    state.destinationLabel = "";
    state.resolvedZoneId = "";
    state.resolvedZoneLabelKey = "";
    state.selectedFareKey = "";

    if (firstAirport) {
      state.originValue = firstAirport.id;
      state.originLabel = resolveItemLabel(firstAirport);
    }

    syncResolvedZoneFromState(state);
  }

  function ensureFieldAnchoring(field) {
    if (!field) return;
    if (field.style.position !== "relative") {
      field.style.position = "relative";
    }
  }

  function getOriginDropdownHostField(nodes, state) {
    const activeLodgingSide = getActiveLodgingSide(state);
    return activeLodgingSide === "origin"
      ? nodes.destinationField
      : nodes.originField;
  }

  function ensureOriginDropdownAnchored(nodes, state) {
    if (!nodes || !nodes.originDropdown) {
      return;
    }

    const hostField = getOriginDropdownHostField(nodes, state);
    if (!hostField) {
      return;
    }

    ensureFieldAnchoring(hostField);

    if (nodes.originDropdown.parentNode !== hostField) {
      hostField.appendChild(nodes.originDropdown);
    }
  }

  function getDropdownBinding(state, role) {
    const activeLodgingSide = getActiveLodgingSide(state);

    if (role === "origin" && activeLodgingSide === "origin") {
      return {
        type: "airport",
        selectedValue: normalizeText(state.destinationValue),
        writesTo: "destination"
      };
    }

    return {
      type: role === "origin" ? state.originType : state.destinationType,
      selectedValue:
        role === "origin"
          ? normalizeText(state.originValue)
          : normalizeText(state.destinationValue),
      writesTo: role
    };
  }

  function getOptionsForRole(state, role) {
    const binding = getDropdownBinding(state, role);

    if (role === "passengers") {
      return getPassengerFareOptions();
    }

    const items = getActiveItemsByType(binding.type);

    return items.map(function (item) {
      return {
        id: item.id,
        type: binding.type,
        label: resolveItemLabel(item)
      };
    });
  }

  function buildDropdownOptions(nodes, state, role) {
    const binding = getDropdownBinding(state, role);
    const options = getOptionsForRole(state, role);
    const selectedValue =
      role === "passengers"
        ? normalizeText(state.selectedFareKey)
        : binding.selectedValue;

    if (!options.length) {
      return {
        type: binding.type,
        options: [],
        selectedIndex: -1
      };
    }

    const selectedIndex = options.findIndex(function (option) {
      return option.id === selectedValue;
    });

    return {
      type: options[0].type,
      options: options,
      selectedIndex: selectedIndex
    };
  }

  function closeDropdown(nodes, state) {
    const role = state.openRole;

    if (!role) {
      state.activeIndex = -1;
      return;
    }

    const control =
      role === "origin"
        ? nodes.originControl
        : role === "destination"
          ? nodes.destinationControl
          : nodes.passengersControl;
    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;

    requireDropdownsApi().closeDropdown({
      panel: panel,
      control: control
    });

    state.openRole = "";
    state.activeIndex = -1;
  }

  function updateActiveOption(nodes, state, role) {
    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;
    const control =
      role === "origin"
        ? nodes.originControl
        : role === "destination"
          ? nodes.destinationControl
          : nodes.passengersControl;

    requireDropdownsApi().updateActiveOption({
      panel: panel,
      control: control,
      activeIndex: state.activeIndex
    });
  }

  function renderDropdown(nodes, state, role) {
    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;
    const control =
      role === "origin"
        ? nodes.originControl
        : role === "destination"
          ? nodes.destinationControl
          : nodes.passengersControl;
    const dropdownState = buildDropdownOptions(nodes, state, role);

    const result = requireDropdownsApi().renderDropdown({
      panel: panel,
      control: control,
      role: role,
      options: dropdownState.options,
      selectedIndex: dropdownState.selectedIndex,
      getEmptyText: function () {
        return getDropdownStatusCopy("empty");
      }
    });

    state.activeIndex =
      result && typeof result.activeIndex === "number" ? result.activeIndex : -1;
  }

  function openDropdown(nodes, state, role) {
    if (state.openRole && state.openRole !== role) {
      closeDropdown(nodes, state);
    }

    if (role === "origin") {
      ensureOriginDropdownAnchored(nodes, state);
    }

    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;
    const control =
      role === "origin"
        ? nodes.originControl
        : role === "destination"
          ? nodes.destinationControl
          : nodes.passengersControl;

    renderDropdown(nodes, state, role);

    requireDropdownsApi().openDropdown({
      panel: panel,
      control: control
    });

    state.openRole = role;
  }

  function toggleDropdown(nodes, state, role) {
    const control =
      role === "origin"
        ? nodes.originControl
        : role === "destination"
          ? nodes.destinationControl
          : nodes.passengersControl;
    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;

    const result = requireDropdownsApi().toggleDropdown({
      isOpen: state.openRole === role,
      panel: panel,
      control: control
    });

    if (result && result.isOpen === false) {
      state.openRole = "";
      state.activeIndex = -1;
      return;
    }

    openDropdown(nodes, state, role);
  }

  function selectOption(nodes, state, role, optionType, optionValue, optionLabel) {
    const binding = getDropdownBinding(state, role);

    if (role === "passengers") {
      state.selectedFareKey = normalizeText(optionValue);
    } else if (binding.writesTo === "destination") {
      state.destinationType = optionType;
      state.destinationValue = optionValue;
      state.destinationLabel = optionLabel;
    } else if (role === "origin") {
      state.originType = optionType;
      state.originValue = optionValue;
      state.originLabel = optionLabel;
    } else {
      clearResolvedDestinationState(state);
      state.destinationType = optionType;
      state.destinationValue = optionValue;
      state.destinationLabel = optionLabel;
    }

    debugSwapTrace("selectOption:applied", {
      role: role,
      binding: binding,
      optionType: optionType,
      optionValue: optionValue,
      optionLabel: optionLabel,
      selectedFareKey: state.selectedFareKey,
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingSearchSide: state.lodgingSearchSide
    });

    renderPanel(nodes, state);
    rerenderAirportDestinationUi();
    closeDropdown(nodes, state);
  }

  function moveActiveIndex(nodes, state, direction) {
    const role = state.openRole;
    if (!role) return;

    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;
    const control =
      role === "origin"
        ? nodes.originControl
        : role === "destination"
          ? nodes.destinationControl
          : nodes.passengersControl;

    const result = requireDropdownsApi().moveActiveIndex({
      panel: panel,
      control: control,
      currentIndex: state.activeIndex,
      direction: direction
    });

    state.activeIndex =
      result && typeof result.activeIndex === "number" ? result.activeIndex : -1;
  }

  function commitActiveOption(nodes, state) {
    const role = state.openRole;
    if (!role) return;

    const panel =
      role === "origin"
        ? nodes.originDropdown
        : role === "destination"
          ? nodes.destinationDropdown
          : nodes.passengersDropdown;

    const payload = requireDropdownsApi().commitActiveOption({
      panel: panel,
      activeIndex: state.activeIndex
    });

    if (!payload) return;

    selectOption(
      nodes,
      state,
      payload.role || role,
      payload.optionType || "",
      payload.optionValue || "",
      payload.optionLabel || ""
    );
  }

  function isEventInsideDropdownArea(nodes, target) {
    return requireDropdownsApi().isEventInsideDropdownArea({
      target: target,
      originField: nodes.originField,
      destinationField: nodes.destinationField,
      passengersField: nodes.passengersField
    });
  }

  function buildDropdownDom(nodes) {
    const built = requireDropdownsApi().buildDropdownDom({
      ensureFieldAnchoring: ensureFieldAnchoring,
      originField: nodes.originField,
      destinationField: nodes.destinationField,
      passengersField: nodes.passengersField
    });

    nodes.originDropdown = built.originDropdown;
    nodes.destinationDropdown = built.destinationDropdown;
    nodes.passengersDropdown = built.passengersDropdown;
  }

  function bindControlToggle(nodes, state, control, role) {
    control.addEventListener("click", function () {
      syncStateFromDom(nodes, state);
      toggleDropdown(nodes, state, role);
    });

    control.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        syncStateFromDom(nodes, state);

        if (state.openRole !== role) {
          openDropdown(nodes, state, role);
          if (event.key === "ArrowUp") {
            const panel =
              role === "origin"
                ? nodes.originDropdown
                : role === "destination"
                  ? nodes.destinationDropdown
                  : nodes.passengersDropdown;
            const options = panel.querySelectorAll(".place-autocomplete__item-button");
            if (options.length) {
              state.activeIndex = options.length - 1;
              updateActiveOption(nodes, state, role);
            }
          }
          return;
        }

        moveActiveIndex(nodes, state, event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        syncStateFromDom(nodes, state);

        if (state.openRole !== role) {
          openDropdown(nodes, state, role);
          return;
        }

        commitActiveOption(nodes, state);
        return;
      }

      if (event.key === "Escape") {
        if (state.openRole === role) {
          event.preventDefault();
          closeDropdown(nodes, state);
        }
      }
    });
  }

  function bindOptionSelection(nodes, state) {
    function onOptionClick(event) {
      const button = event.target.closest(".place-autocomplete__item-button");
      if (!button) return;

      const role = button.dataset.airportTariffOptionRole || "";
      if (!role) return;

      selectOption(
        nodes,
        state,
        role,
        button.dataset.airportTariffOptionType || "",
        button.dataset.airportTariffOptionValue || "",
        button.dataset.airportTariffOptionLabel || ""
      );
    }

    nodes.originDropdown.addEventListener("click", onOptionClick);
    nodes.destinationDropdown.addEventListener("click", onOptionClick);
    nodes.passengersDropdown.addEventListener("click", onOptionClick);
  }

  function bindDocumentDismiss(nodes, state) {
    document.addEventListener("click", function (event) {
      if (!state.openRole) return;
      if (isEventInsideDropdownArea(nodes, event.target)) return;
      closeDropdown(nodes, state);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!state.openRole) return;
      closeDropdown(nodes, state);
    });
  }

  function bindEvents(nodes, state) {
  const hasPassengerChips = shouldUsePassengerChipUi(nodes);

  nodes.swapButton.addEventListener("click", function () {
    debugSwapTrace("swap:click:before-sync", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });

    syncStateFromDom(nodes, state);

    debugSwapTrace("swap:click:after-sync", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });

    swapState(state);

    debugSwapTrace("swap:click:after-swapState", {
      originType: state.originType,
      originValue: state.originValue,
      originLabel: state.originLabel,
      destinationType: state.destinationType,
      destinationValue: state.destinationValue,
      destinationLabel: state.destinationLabel,
      destinationMode: state.destinationMode,
      destinationPlaceLabel: state.destinationPlaceLabel,
      resolvedZoneId: state.resolvedZoneId,
      resolvedZoneLabelKey: state.resolvedZoneLabelKey,
      lodgingEndpointSide: state.lodgingEndpointSide,
      lodgingEndpointLabel: state.lodgingEndpointLabel,
      lodgingEndpointZoneId: state.lodgingEndpointZoneId
    });

    renderPanel(nodes, state);
    rerenderAirportDestinationUi();
    closeDropdown(nodes, state);
    return true;
  });

  nodes.cta.addEventListener("click", function (event) {
    if (nodes.dateInput) {
      state.serviceDate = normalizeText(nodes.dateInput.value);
      syncTemporalDateInput(nodes, state);
    }

    if (nodes.timeInput) {
      state.serviceTime = normalizeText(nodes.timeInput.value);
      syncTemporalTimeInput(nodes, state);
    }

    const eligibility = requireCtaApi().getCtaEligibility(
      state,
      getCtaDeps()
    );

    if (!eligibility.canNavigate) {
      event.preventDefault();
      return;
    }

    const handedOff = handoffPanelSelectionToContact(state);

    if (!handedOff) {
      event.preventDefault();
      renderCtaState(nodes, state);
      return;
    }

    event.preventDefault();
    closeDropdown(nodes, state);
  });

  bindControlToggle(nodes, state, nodes.originControl, "origin");
  bindControlToggle(nodes, state, nodes.destinationControl, "destination");

  if (
    hasPassengerChips &&
    typeof window.PixkuyAirportTariffPassengers.bindPassengerSelection === "function"
  ) {
    window.PixkuyAirportTariffPassengers.bindPassengerSelection(
      nodes,
      state,
      {
        onChange: function () {
          renderPanel(nodes, state);
          closeDropdown(nodes, state);
        }
      },
      {
        normalizeText: normalizeText,
        getSelectedFareKey: getSelectedFareKey,
        setSelectedFareKeyState: setSelectedFareKeyState
      }
    );
  } else {
    bindControlToggle(nodes, state, nodes.passengersControl, "passengers");
  }

  if (nodes.dateInput) {
    nodes.dateInput.addEventListener("input", function () {
      state.serviceDate = normalizeText(nodes.dateInput.value);
      syncTemporalDateInput(nodes, state);
      renderPanel(nodes, state);
    });

    nodes.dateInput.addEventListener("change", function () {
      state.serviceDate = normalizeText(nodes.dateInput.value);
      syncTemporalDateInput(nodes, state);
      renderPanel(nodes, state);
    });
  }

  if (nodes.timeInput) {
    nodes.timeInput.addEventListener("input", function () {
      state.serviceTime = normalizeText(nodes.timeInput.value);
      syncTemporalTimeInput(nodes, state);
      renderPanel(nodes, state);
    });

    nodes.timeInput.addEventListener("change", function () {
      state.serviceTime = normalizeText(nodes.timeInput.value);
      syncTemporalTimeInput(nodes, state);
      renderPanel(nodes, state);
    });
  }

  bindOptionSelection(nodes, state);
  bindDocumentDismiss(nodes, state);
}

  function initAirportZoneTariff() {
    const panel = document.querySelector(SELECTORS.panel);
    if (!panel) return;

    const nodes = getPanelNodes(panel);
    if (!nodes) return;

    const state = createState();

    ensureSafariDesktopTimeFallback(nodes);
    buildDropdownDom(nodes);
    seedInitialState(state);

    (function applyInitialAirportDeepLink() {
      var payload = getAirportDeepLinkPayloadFromUrl();

      if (!payload) {
        return;
      }

      applyAirportSelectionState(state, payload);
    })();

    renderPanel(nodes, state);
    bindEvents(nodes, state);
    scheduleI18nLabelHydration(nodes, state);
    preloadZoneResolver();

    window.PixkuyAirportZoneTariff = {
      panel: nodes.panel,
      originControl: nodes.originControl,
      destinationControl: nodes.destinationControl,
      passengersControl: nodes.passengersControl,
      swapButton: nodes.swapButton,
      fareValue: nodes.fareValue,
      cta: nodes.cta,
      originDropdown: nodes.originDropdown,
      destinationDropdown: nodes.destinationDropdown,
      passengersDropdown: nodes.passengersDropdown,
      hasZoneResolver: hasZoneResolver,
      preloadZoneResolver: preloadZoneResolver,
      resolveZoneFromPoint: resolveZoneFromPoint,
      setResolvedDestination: function (payload) {
        const applied = applyResolvedDestinationState(state, payload);
        if (!applied) {
          return false;
        }

        renderPanel(nodes, state);
        rerenderAirportDestinationUi();
        closeDropdown(nodes, state);
        return true;
      },
      setAirportSelection: function (payload) {
        const applied = applyAirportSelectionState(state, payload);
        if (!applied) {
          return false;
        }

        renderPanel(nodes, state);
        rerenderAirportDestinationUi();
        closeDropdown(nodes, state);
        return true;
      },
      clearResolvedDestination: function () {
        const clearedLodgingSide = getActiveLodgingSide(state);

        debugSwapTrace("clearResolvedDestination:before", {
          clearedLodgingSide: clearedLodgingSide,
          originType: state.originType,
          originValue: state.originValue,
          originLabel: state.originLabel,
          destinationType: state.destinationType,
          destinationValue: state.destinationValue,
          destinationLabel: state.destinationLabel,
          destinationMode: state.destinationMode,
          destinationPlaceLabel: state.destinationPlaceLabel,
          resolvedZoneId: state.resolvedZoneId,
          resolvedZoneLabelKey: state.resolvedZoneLabelKey,
          lodgingEndpointSide: state.lodgingEndpointSide,
          lodgingEndpointLabel: state.lodgingEndpointLabel,
          lodgingEndpointZoneId: state.lodgingEndpointZoneId
        });

        clearResolvedDestinationState(state);
        clearLodgingEndpointState(state);
        resetPanelToAirportEmptyState(state, clearedLodgingSide);
        syncResolvedZoneFromState(state);

        debugSwapTrace("clearResolvedDestination:after", {
          clearedLodgingSide: clearedLodgingSide,
          originType: state.originType,
          originValue: state.originValue,
          originLabel: state.originLabel,
          destinationType: state.destinationType,
          destinationValue: state.destinationValue,
          destinationLabel: state.destinationLabel,
          destinationMode: state.destinationMode,
          destinationPlaceLabel: state.destinationPlaceLabel,
          resolvedZoneId: state.resolvedZoneId,
          resolvedZoneLabelKey: state.resolvedZoneLabelKey,
          lodgingEndpointSide: state.lodgingEndpointSide,
          lodgingEndpointLabel: state.lodgingEndpointLabel,
          lodgingEndpointZoneId: state.lodgingEndpointZoneId
        });

        renderPanel(nodes, state);
        rerenderAirportDestinationUi();
        closeDropdown(nodes, state);
      },
      getState: function () {
        return {
          originType: state.originType,
          destinationType: state.destinationType,
          originValue: state.originValue,
          destinationValue: state.destinationValue,
          originLabel: state.originLabel,
          destinationLabel: state.destinationLabel,
          destinationMode: state.destinationMode,
          destinationPlaceLabel: state.destinationPlaceLabel,
          destinationLat: state.destinationLat,
          destinationLng: state.destinationLng,
          resolvedZoneId: state.resolvedZoneId,
          resolvedZoneLabelKey: state.resolvedZoneLabelKey,
          lodgingEndpointSide: state.lodgingEndpointSide,
          lodgingSearchSide: state.lodgingSearchSide,
          lodgingEndpointLabel: state.lodgingEndpointLabel,
          lodgingEndpointLat: state.lodgingEndpointLat,
          lodgingEndpointLng: state.lodgingEndpointLng,
          lodgingEndpointZoneId: state.lodgingEndpointZoneId,
          lodgingEndpointZoneLabelKey: state.lodgingEndpointZoneLabelKey,
          selectedFareKey: state.selectedFareKey,
          serviceDate: state.serviceDate,
          serviceTime: state.serviceTime,
          openRole: state.openRole,
          activeIndex: state.activeIndex
        };
      },
      getContactSummaryPayload: function () {
        return buildCurrentContactSummaryPayload(state);
      },
      setFareKeySelection: function (payload) {
        setSelectedFareKeyState(state, payload);
        renderPanel(nodes, state);
        closeDropdown(nodes, state);
        return true;
      },
      swapTripDirection: function () {
        debugSwapTrace("publicApi:swapTripDirection:before", {
          originType: state.originType,
          originValue: state.originValue,
          originLabel: state.originLabel,
          destinationType: state.destinationType,
          destinationValue: state.destinationValue,
          destinationLabel: state.destinationLabel,
          destinationMode: state.destinationMode,
          destinationPlaceLabel: state.destinationPlaceLabel,
          resolvedZoneId: state.resolvedZoneId,
          resolvedZoneLabelKey: state.resolvedZoneLabelKey,
          lodgingEndpointSide: state.lodgingEndpointSide,
          lodgingSearchSide: state.lodgingSearchSide,
          lodgingEndpointLabel: state.lodgingEndpointLabel,
          lodgingEndpointZoneId: state.lodgingEndpointZoneId
        });

        syncStateFromDom(nodes, state);
        swapState(state);
        renderPanel(nodes, state);
        rerenderAirportDestinationUi();
        closeDropdown(nodes, state);

        debugSwapTrace("publicApi:swapTripDirection:after", {
          originType: state.originType,
          originValue: state.originValue,
          originLabel: state.originLabel,
          destinationType: state.destinationType,
          destinationValue: state.destinationValue,
          destinationLabel: state.destinationLabel,
          destinationMode: state.destinationMode,
          destinationPlaceLabel: state.destinationPlaceLabel,
          resolvedZoneId: state.resolvedZoneId,
          resolvedZoneLabelKey: state.resolvedZoneLabelKey,
          lodgingEndpointSide: state.lodgingEndpointSide,
          lodgingSearchSide: state.lodgingSearchSide,
          lodgingEndpointLabel: state.lodgingEndpointLabel,
          lodgingEndpointZoneId: state.lodgingEndpointZoneId
        });

        return true;
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAirportZoneTariff, { once: true });
  } else {
    initAirportZoneTariff();
  }
})();