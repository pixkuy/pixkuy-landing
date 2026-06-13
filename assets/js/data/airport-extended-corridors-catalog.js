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
    },
    {
      id: "airport_extended_corridor_puebla_angelopolis",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_puebla_angelopolis",
      active: true
    },
    {
      id: "airport_extended_corridor_bajio_sma",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_bajio_sma",
      active: true
    },
    {
      id: "airport_extended_corridor_queretaro",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_queretaro",
      active: true
    },
    {
      id: "airport_extended_corridor_teotihuacan",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_teotihuacan",
      active: true
    },
    {
      id: "airport_extended_corridor_valle_de_bravo",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_valle_de_bravo",
      active: true
    },
    {
      id: "airport_extended_corridor_morelos_pachuca",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_morelos_pachuca",
      active: true
    },
    {
      id: "airport_extended_corridor_toluca_cdmx",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_toluca_cdmx",
      active: true
    }
  ];

  const PRICEBOOK = {
    airport_extended_corridor_taxco_guerrero: {
      mex: [3300, 4600, 5800],
      nlu: [4300, 5500, 7000],
      tlc: [3300, 4500, 5800],
      pbc: [4800, 5900, 7400],
      qro: [8700, 9700, 12000]
    },
    airport_extended_corridor_morelia_michoacan: {
      mex: [6200, 7900, 9500],
      nlu: [7000, 8900, 10800],
      tlc: [5800, 7300, 8900],
      pbc: [8100, 10100, 12200],
      qro: [4900, 6400, 8000]
    },
    airport_extended_corridor_sierra_norte_puebla: {
      mex: [4200, 5000, 6500],
      nlu: [4000, 4800, 6300],
      tlc: [3900, 4700, 6200],
      pbc: [3800, 4600, 5800],
      qro: [5200, 6400, 7800]
    },
    airport_extended_corridor_puebla_angelopolis: {
      mex: [2700, 3800, 4800],
      nlu: [3300, 4500, 5600],
      tlc: [3400, 4600, 5700],
      pbc: [1700, 2300, 2900],
      qro: [4800, 6000, 7400]
    },
    airport_extended_corridor_bajio_sma: {
      mex: [5200, 7400, 9000],
      nlu: [4700, 6900, 8500],
      tlc: [4900, 6800, 8300],
      pbc: [7400, 9200, 11400],
      qro: [2900, 4100, 5300]
    },
    airport_extended_corridor_queretaro: {
      mex: [3500, 5000, 6500],
      nlu: [3300, 5000, 6500],
      tlc: [3400, 4900, 6400],
      pbc: [5600, 7100, 8800],
      qro: [1500, 2200, 2900]
    },
    airport_extended_corridor_teotihuacan: {
      mex: [1200, 2200, 3000],
      nlu: [1000, 1900, 2600],
      tlc: [2300, 3100, 4100],
      pbc: [3600, 4700, 5900],
      qro: [4800, 6000, 7400]
    },
    airport_extended_corridor_valle_de_bravo: {
      mex: [3200, 4700, 5800],
      nlu: [3700, 5200, 6500],
      tlc: [2900, 4400, 5600],
      pbc: [6100, 7800, 9600],
      qro: [6500, 8200, 10000]
    },
    airport_extended_corridor_morelos_pachuca: {
      mex: [1850, 2700, 3400],
      nlu: [2400, 3300, 4300],
      tlc: [2200, 3200, 4200],
      pbc: [3400, 4500, 5700],
      qro: [4100, 5400, 6800]
    },
    airport_extended_corridor_toluca_cdmx: {
      mex: [1400, 2000, 2600],
      nlu: [2500, 3500, 4500],
      tlc: [900, 1400, 1900],
      pbc: [3700, 4900, 6100],
      qro: [3700, 4900, 6100]
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