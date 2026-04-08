(function () {
  "use strict";

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getI18nValue(path, fallback) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) {
      return fallback;
    }

    const parts = path.split(".");
    let cursor = dict;

    for (const part of parts) {
      if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
        return fallback;
      }
      cursor = cursor[part];
    }

    return typeof cursor === "string" ? cursor : fallback;
  }

  function getPlaceholderKey(role, type) {
    if (role === "origin" && type === "airport") {
      return "services.cards.airport.panel.originAirportPlaceholder";
    }

    if (role === "origin" && type === "zone") {
      return "services.cards.airport.panel.originZonePlaceholder";
    }

    if (role === "destination" && type === "airport") {
      return "services.cards.airport.panel.destinationAirportPlaceholder";
    }

    return "services.cards.airport.panel.destinationZonePlaceholder";
  }

  function getPlaceholder(role, type) {
    return getI18nValue(getPlaceholderKey(role, type), "");
  }

  function getSwapAriaLabel(i18nKeys) {
    if (
      !i18nKeys ||
      typeof i18nKeys !== "object" ||
      typeof i18nKeys.swapAriaLabel !== "string"
    ) {
      return "";
    }

    return getI18nValue(i18nKeys.swapAriaLabel, "");
  }

  function getFareFallbackValue(i18nKeys) {
    if (
      !i18nKeys ||
      typeof i18nKeys !== "object" ||
      typeof i18nKeys.fareValue !== "string"
    ) {
      return "";
    }

    return getI18nValue(i18nKeys.fareValue, "");
  }

  function getDropdownStatusCopy(kind, dropdownKeys) {
    if (!dropdownKeys || typeof dropdownKeys !== "object") {
      return "";
    }

    if (kind === "loading") {
      return getI18nValue(dropdownKeys.loading, "");
    }

    if (kind === "error") {
      return getI18nValue(dropdownKeys.error, "");
    }

    return getI18nValue(dropdownKeys.empty, "");
  }

  function formatPrice(price, currency) {
    if (typeof price !== "number" || !Number.isFinite(price)) return "";
    if (currency !== "MXN") return "";

    return "$" + String(price) + " MXN";
  }

  function getFarePendingSelectionValue() {
    return getI18nValue(
      "services.cards.airport.panel.fareValuePendingPassengers",
      ""
    );
  }

  function getPassengersPlaceholderValue() {
    return getI18nValue(
      "services.cards.airport.panel.passengersPlaceholder",
      ""
    );
  }

  function getPassengerFareOptions() {
    return [
      { id: "van_1_2", type: "fare-key", label: "1–2", minPassengers: 1, maxPassengers: 2 },
      { id: "van_3_4", type: "fare-key", label: "3–4", minPassengers: 3, maxPassengers: 4 },
      { id: "van_5_6", type: "fare-key", label: "5–6", minPassengers: 5, maxPassengers: 6 }
    ];
  }

  function getPassengerFareOptionByKey(fareKey) {
    const safeFareKey = normalizeText(fareKey);
    const options = getPassengerFareOptions();

    return (
      options.find(function (option) {
        return normalizeText(option.id) === safeFareKey;
      }) || null
    );
  }

  function resolveFareKeyDisplayLabel(fareKey) {
    const match = getPassengerFareOptionByKey(fareKey);
    return match ? match.label : "";
  }

  function resolvePassengerRangeForFareKey(fareKey) {
    const match = getPassengerFareOptionByKey(fareKey);

    if (!match) {
      return null;
    }

    return {
      minPassengers: match.minPassengers,
      maxPassengers: match.maxPassengers
    };
  }

  function hasI18nRuntimeReady() {
    return (
      !!window.__pixkuyI18nDict &&
      typeof window.__pixkuyI18nDict === "object"
    );
  }

  window.PixkuyAirportTariffUtils = {
    isFiniteNumber: isFiniteNumber,
    normalizeText: normalizeText,
    getI18nValue: getI18nValue,
    getPlaceholderKey: getPlaceholderKey,
    getPlaceholder: getPlaceholder,
    getSwapAriaLabel: getSwapAriaLabel,
    getFareFallbackValue: getFareFallbackValue,
    getDropdownStatusCopy: getDropdownStatusCopy,
    formatPrice: formatPrice,
    getFarePendingSelectionValue: getFarePendingSelectionValue,
    getPassengersPlaceholderValue: getPassengersPlaceholderValue,
    getPassengerFareOptions: getPassengerFareOptions,
    getPassengerFareOptionByKey: getPassengerFareOptionByKey,
    resolveFareKeyDisplayLabel: resolveFareKeyDisplayLabel,
    resolvePassengerRangeForFareKey: resolvePassengerRangeForFareKey,
    hasI18nRuntimeReady: hasI18nRuntimeReady
  };
})();