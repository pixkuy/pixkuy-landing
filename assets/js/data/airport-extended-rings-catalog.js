(function () {
  "use strict";

  const RING_ZONES = [
    { id: "airport_extended_ring_25km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_25km", active: true },
    { id: "airport_extended_ring_50km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_50km", active: true },
    { id: "airport_extended_ring_75km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_75km", active: true },
    { id: "airport_extended_ring_90km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_90km", active: true },
    { id: "airport_extended_ring_115km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_115km", active: true },
    { id: "airport_extended_ring_140km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_140km", active: true },
    { id: "airport_extended_ring_200km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_200km", active: true },
    { id: "airport_extended_ring_300km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_300km", active: true },
    { id: "airport_extended_ring_400km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_400km", active: true },
    { id: "airport_extended_ring_550km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_550km", active: true },
    { id: "airport_extended_ring_700km", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_700km", active: true }
  ];

  const PRICEBOOK = {
    airport_extended_ring_25km: {
      mex: [1250, 1550, 1850],
      nlu: [1750, 2150, 2600],
      tlc: [1800, 2200, 2650],
      pbc: [2750, 3300, 3900],
      qro: [3400, 4300, 5350]
    },
    airport_extended_ring_50km: {
      mex: [1850, 2250, 3000],
      nlu: [1800, 2200, 2850],
      tlc: [1900, 2300, 3000],
      pbc: [2950, 3500, 4100],
      qro: [3500, 4400, 5500]
    },
    airport_extended_ring_75km: {
      mex: [2500, 3000, 4200],
      nlu: [2350, 2850, 3900],
      tlc: [2450, 2950, 4100],
      pbc: [3200, 3850, 5000],
      qro: [3600, 4500, 5700]
    },
    airport_extended_ring_90km: {
      mex: [3100, 3600, 5200],
      nlu: [2900, 3500, 4900],
      tlc: [3000, 3600, 5000],
      pbc: [3500, 4200, 5400],
      qro: [3900, 4800, 6200]
    },
    airport_extended_ring_115km: {
      mex: [4000, 4700, 6300],
      nlu: [3800, 4600, 6100],
      tlc: [3900, 4700, 6200],
      pbc: [3800, 4600, 5800],
      qro: [4200, 5200, 6600]
    },
    airport_extended_ring_140km: {
      mex: [4400, 5200, 6800],
      nlu: [4000, 4800, 6300],
      tlc: [4000, 4800, 6200],
      pbc: [3900, 4700, 5900],
      qro: [4400, 5400, 6800]
    },
    airport_extended_ring_200km: {
      mex: [5200, 6200, 7800],
      nlu: [5100, 6100, 7700],
      tlc: [5000, 6000, 7600],
      pbc: [5200, 6300, 7900],
      qro: [5300, 6400, 8000]
    },
    airport_extended_ring_300km: {
      mex: [9200, 10200, 12800],
      nlu: [9900, 11000, 13800],
      tlc: [9700, 10800, 13500],
      pbc: [10400, 11700, 14500],
      qro: [12000, 13500, 16500]
    },
    airport_extended_ring_400km: {
      mex: [10300, 11500, 13900],
      nlu: [10900, 12300, 14800],
      tlc: [10700, 12100, 14600],
      pbc: [10900, 12300, 14800],
      qro: [12800, 14600, 17500]
    },
    airport_extended_ring_550km: {
      mex: [12700, 14300, 17200],
      nlu: [13300, 15000, 18100],
      tlc: [13100, 14800, 17900],
      pbc: [13500, 15300, 18400],
      qro: [15200, 17200, 20800]
    },
    airport_extended_ring_700km: {
      mex: [17500, 19800, 23900],
      nlu: [18200, 20700, 25000],
      tlc: [18000, 20400, 24600],
      pbc: [18500, 21100, 25400],
      qro: [19700, 22500, 27200]
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
      saleMode: meta.saleMode,
      includesOvernight: meta.includesOvernight,
      includesEstimatedTolls: meta.includesEstimatedTolls,
      requiresOperationalConfirmation: meta.requiresOperationalConfirmation
    };
  }

  function ensureRingZones(catalog) {
    if (!Array.isArray(catalog.zones)) {
      catalog.zones = [];
    }

    RING_ZONES.forEach(function (zone) {
      if (!hasZone(catalog, zone.id)) {
        catalog.zones.push(Object.assign({}, zone));
      }
    });
  }

  function ensureRingFares(catalog) {
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

    ensureRingZones(catalog);
    ensureRingFares(catalog);

    return true;
  }

  function getPricebook() {
    return JSON.parse(JSON.stringify(PRICEBOOK));
  }

  window.PixkuyAirportExtendedRingsCatalog = {
    extendCatalog: extendCatalog,
    getPricebook: getPricebook
  };

  extendCatalog();
})();