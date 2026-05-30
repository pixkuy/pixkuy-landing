(function () {
  "use strict";

  const CORRIDOR_ZONES = [
    {
      id: "airport_extended_corridor_taxco_guerrero",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_taxco_guerrero",
      active: true
    },
    {
      id: "airport_extended_corridor_morelia_michoacan",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_morelia_michoacan",
      active: true
    },
    {
      id: "airport_extended_corridor_sierra_norte_puebla",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_sierra_norte_puebla",
      active: true
    }
  ];

  const PRICEBOOK = {
    airport_extended_corridor_taxco_guerrero: {
      mex: [4200, 5000, 6500],
      nlu: [5200, 6200, 7800],
      tlc: [4200, 5000, 6500],
      pbc: [5200, 6300, 7900],
      qro: [9200, 10200, 12800]
    },
    airport_extended_corridor_morelia_michoacan: {
      mex: [6800, 7900, 9500],
      nlu: [7600, 8900, 10800],
      tlc: [6200, 7300, 8900],
      pbc: [8600, 10100, 12200],
      qro: [5300, 6400, 8000]
    },
    airport_extended_corridor_sierra_norte_puebla: {
      mex: [4200, 5000, 6500],
      nlu: [4000, 4800, 6300],
      tlc: [3900, 4700, 6200],
      pbc: [3800, 4600, 5800],
      qro: [5200, 6400, 7800]
    }
  };

  const FARE_KEYS = ["van_1_2", "van_3_4", "van_5_6"];

  function getCatalog() {
    const catalog = window.PIXKUY_AIRPORT_ZONE_CATALOG;
    return catalog && typeof catalog === "object" ? catalog : null;
  }

  function getPolicy() {
    const policy = window.PixkuyAirportExtendedRingsPolicy;
    return policy && typeof policy === "object" ? policy : null;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function hasZone(catalog, zoneId) {
    const safeZoneId = normalizeText(zoneId);

    return !!(
      catalog &&
      Array.isArray(catalog.zones) &&
      catalog.zones.find(function (zone) {
        return zone && zone.id === safeZoneId;
      })
    );
  }

  function findFare(catalog, airportId, zoneId, fareKey) {
    return (
      catalog.fares.find(function (fare) {
        return (
          fare &&
          fare.airportId === airportId &&
          fare.zoneId === zoneId &&
          normalizeText(fare.fareKey) === fareKey
        );
      }) || null
    );
  }

  function getFarePolicyMeta(airportId, zoneId) {
    const policy = getPolicy();

    if (!policy) {
      return {
        saleMode: "automatic",
        includesOvernight: false,
        includesEstimatedTolls: false,
        requiresOperationalConfirmation: false
      };
    }

    return {
      saleMode:
        typeof policy.getSaleModeForFare === "function"
          ? policy.getSaleModeForFare({ airportId: airportId, zoneId: zoneId })
          : "automatic",
      includesOvernight:
        typeof policy.requiresOvernight === "function"
          ? policy.requiresOvernight(zoneId)
          : false,
      includesEstimatedTolls:
        typeof policy.includesEstimatedTolls === "function"
          ? policy.includesEstimatedTolls(zoneId)
          : false,
      requiresOperationalConfirmation:
        typeof policy.requiresOperationalConfirmation === "function"
          ? policy.requiresOperationalConfirmation(zoneId)
          : false
    };
  }

  function isFareActiveForSaleMode(saleMode) {
    return normalizeText(saleMode) !== "unavailable";
  }

  function buildFare(airportId, zoneId, fareKey, price) {
    const meta = getFarePolicyMeta(airportId, zoneId);

    return {
      airportId: airportId,
      zoneId: zoneId,
      fareKey: fareKey,
      price: price,
      currency: "MXN",
      active: isFareActiveForSaleMode(meta.saleMode),
      extendedRing: true,
      extendedZoneType: "corridor",
      saleMode: meta.saleMode,
      includesOvernight: meta.includesOvernight,
      includesEstimatedTolls: meta.includesEstimatedTolls,
      requiresOperationalConfirmation: meta.requiresOperationalConfirmation
    };
  }

  function ensureCorridorZones(catalog) {
    if (!Array.isArray(catalog.zones)) {
      catalog.zones = [];
    }

    CORRIDOR_ZONES.forEach(function (zone) {
      if (!hasZone(catalog, zone.id)) {
        catalog.zones.push(Object.assign({}, zone));
      }
    });
  }

  function ensureCorridorFares(catalog) {
    if (!Array.isArray(catalog.fares)) {
      catalog.fares = [];
    }

    Object.keys(PRICEBOOK).forEach(function (zoneId) {
      const airportPrices = PRICEBOOK[zoneId];

      Object.keys(airportPrices).forEach(function (airportId) {
        const values = airportPrices[airportId];

        FARE_KEYS.forEach(function (fareKey, index) {
          const price = values[index];
          let fare = findFare(catalog, airportId, zoneId, fareKey);

          if (!fare) {
            catalog.fares.push(buildFare(airportId, zoneId, fareKey, price));
            return;
          }

          const meta = getFarePolicyMeta(airportId, zoneId);

          fare.price = price;
          fare.currency = "MXN";
          fare.active = isFareActiveForSaleMode(meta.saleMode);
          fare.extendedRing = true;
          fare.extendedZoneType = "corridor";
          fare.saleMode = meta.saleMode;
          fare.includesOvernight = meta.includesOvernight;
          fare.includesEstimatedTolls = meta.includesEstimatedTolls;
          fare.requiresOperationalConfirmation = meta.requiresOperationalConfirmation;
        });
      });
    });
  }

  function extendCatalog() {
    const catalog = getCatalog();

    if (!catalog) {
      return false;
    }

    ensureCorridorZones(catalog);
    ensureCorridorFares(catalog);

    return true;
  }

  window.PixkuyAirportExtendedCorridorsCatalog = {
    extendCatalog: extendCatalog
  };

  extendCatalog();
})();