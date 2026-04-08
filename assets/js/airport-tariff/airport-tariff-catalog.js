(function () {
  "use strict";

  function getCatalog() {
    const catalog = window.PIXKUY_AIRPORT_ZONE_CATALOG;
    if (!catalog || typeof catalog !== "object") {
      return null;
    }

    return catalog;
  }

  function getActiveItemsByType(type) {
    const catalog = getCatalog();
    if (!catalog) return [];

    const source = type === "airport" ? catalog.airports : catalog.zones;
    if (!Array.isArray(source)) return [];

    return source.filter(function (item) {
      return item && item.active === true;
    });
  }

  function findItemById(type, id) {
    if (!id) return null;

    const items = getActiveItemsByType(type);
    return (
      items.find(function (item) {
        return item.id === id;
      }) || null
    );
  }

  function resolveItemLabel(item) {
    if (!item || !item.labelKey) return "";

    const utils = window.PixkuyAirportTariffUtils || null;
    if (!utils || typeof utils.getI18nValue !== "function") {
      return "";
    }

    return utils.getI18nValue(item.labelKey, "");
  }

  function resolveDisplayLabel(type, value) {
    const item = findItemById(type, value);
    return resolveItemLabel(item);
  }

  function getZoneOptionById(zoneId) {
    if (!zoneId) return null;

    const catalog = getCatalog();
    if (!catalog || !Array.isArray(catalog.zones)) return null;

    return (
      catalog.zones.find(function (zone) {
        return zone && zone.active === true && zone.id === zoneId;
      }) || null
    );
  }

  function getZoneIdForFare(state) {
    if (!state || typeof state !== "object") {
      return "";
    }

    if (state.resolvedZoneId) {
      return state.resolvedZoneId;
    }

    if (state.originType === "zone") {
      return state.originValue;
    }

    if (state.destinationType === "zone") {
      return state.destinationValue;
    }

    return "";
  }

  function resolveFare(state) {
    const catalog = getCatalog();
    const utils = window.PixkuyAirportTariffUtils || null;

    if (!catalog || !Array.isArray(catalog.fares) || !utils) return null;
    if (!state || !state.originValue || !state.destinationValue) return null;

    const airportId =
      state.originType === "airport" ? state.originValue : state.destinationValue;
    const zoneId = getZoneIdForFare(state);
    const fareKey =
      typeof state.selectedFareKey === "string"
        ? utils.normalizeText(state.selectedFareKey)
        : "";

    if (!airportId || !zoneId || !fareKey) return null;

    return (
      catalog.fares.find(function (fare) {
        return (
          fare &&
          fare.active === true &&
          fare.airportId === airportId &&
          fare.zoneId === zoneId &&
          utils.normalizeText(fare.fareKey) === fareKey
        );
      }) || null
    );
  }

  window.PixkuyAirportTariffCatalog = {
    getCatalog: getCatalog,
    getActiveItemsByType: getActiveItemsByType,
    findItemById: findItemById,
    resolveItemLabel: resolveItemLabel,
    resolveDisplayLabel: resolveDisplayLabel,
    getZoneOptionById: getZoneOptionById,
    getZoneIdForFare: getZoneIdForFare,
    resolveFare: resolveFare
  };
})();