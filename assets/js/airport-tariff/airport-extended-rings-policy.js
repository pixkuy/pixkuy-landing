(function () {
  "use strict";

  const URBAN_ZONE_IDS = [
    "centro",
    "reforma",
    "polanco",
    "roma_condesa",
    "santa_fe",
    "coyoacan_del_valle_napoles",
    "sur",
    "norte",
    "aeropuerto_oriente"
  ];

  const RING_DEFINITIONS = [
    { id: "airport_extended_ring_25km", distanceKm: 25, band: "0-25", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_25km" },
    { id: "airport_extended_ring_50km", distanceKm: 50, band: "25-50", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_50km" },
    { id: "airport_extended_ring_75km", distanceKm: 75, band: "50-75", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_75km" },
    { id: "airport_extended_ring_90km", distanceKm: 90, band: "75-90", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_90km" },
    { id: "airport_extended_ring_115km", distanceKm: 115, band: "90-115", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_115km" },
    { id: "airport_extended_ring_140km", distanceKm: 140, band: "115-140", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_140km" },
    { id: "airport_extended_ring_200km", distanceKm: 200, band: "140-200", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_200km" },
    { id: "airport_extended_ring_300km", distanceKm: 300, band: "200-300", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_300km" },
    { id: "airport_extended_ring_400km", distanceKm: 400, band: "300-400", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_400km" },
    { id: "airport_extended_ring_550km", distanceKm: 550, band: "400-550", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_550km" },
    { id: "airport_extended_ring_700km", distanceKm: 700, band: "550-700", labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_ring_700km" }
  ];

  const CORRIDOR_DEFINITIONS = [
    {
      id: "airport_extended_corridor_taxco_guerrero",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_taxco_guerrero",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_morelia_michoacan",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_morelia_michoacan",
      includesEstimatedTolls: true,
      requiresOvernight: true
    },
    {
      id: "airport_extended_corridor_sierra_norte_puebla",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_sierra_norte_puebla",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_puebla_angelopolis",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_puebla_angelopolis",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_bajio_sma",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_bajio_sma",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_queretaro",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_queretaro",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_teotihuacan",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_teotihuacan",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_valle_de_bravo",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_valle_de_bravo",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_morelos_pachuca",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_morelos_pachuca",
      includesEstimatedTolls: true,
      requiresOvernight: false
    },
    {
      id: "airport_extended_corridor_toluca_cdmx",
      labelKey: "services.cards.airport.panel.catalog.zones.airport_extended_corridor_toluca_cdmx",
      includesEstimatedTolls: true,
      requiresOvernight: false
    }
  ];

  const CDMX_ANCHOR_AIRPORT_IDS = ["mex", "nlu"];
  const EXTERNAL_AIRPORT_IDS = ["tlc", "pbc", "qro"];

  const EXTENDED_AIRPORT_SEARCH_RESTRICTION = {
    west: -106.5,
    south: 13.0,
    east: -91.0,
    north: 26.0
  };

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeId(value) {
    return normalizeText(value).toLowerCase();
  }

  function cloneArray(items) {
    return Array.isArray(items) ? items.slice() : [];
  }

  function getUrbanZoneIds() {
    return cloneArray(URBAN_ZONE_IDS);
  }

  function getRingDefinitions() {
    return RING_DEFINITIONS.map(function (ring) {
      return Object.assign({}, ring);
    });
  }

  function getRingZoneIds() {
    return RING_DEFINITIONS.map(function (ring) {
      return ring.id;
    });
  }

  function getRingDefinition(zoneId) {
    const safeZoneId = normalizeId(zoneId);

    return (
      RING_DEFINITIONS.find(function (ring) {
        return ring.id === safeZoneId;
      }) || null
    );
  }

  function getCorridorDefinitions() {
    return CORRIDOR_DEFINITIONS.map(function (corridor) {
      return Object.assign({}, corridor);
    });
  }

  function getCorridorZoneIds() {
    return CORRIDOR_DEFINITIONS.map(function (corridor) {
      return corridor.id;
    });
  }

  function getCorridorDefinition(zoneId) {
    const safeZoneId = normalizeId(zoneId);

    return (
      CORRIDOR_DEFINITIONS.find(function (corridor) {
        return corridor.id === safeZoneId;
      }) || null
    );
  }

  function isExtendedCorridorZoneId(zoneId) {
    return !!getCorridorDefinition(zoneId);
  }

  function isExtendedOperationalZoneId(zoneId) {
    return isExtendedRingZoneId(zoneId) || isExtendedCorridorZoneId(zoneId);
  }

  function isUrbanZoneId(zoneId) {
    return URBAN_ZONE_IDS.indexOf(normalizeId(zoneId)) !== -1;
  }

  function isExtendedRingZoneId(zoneId) {
    return !!getRingDefinition(zoneId);
  }

  function isCdmxMetropolitanZoneId(zoneId) {
    const safeZoneId = normalizeId(zoneId);

    return (
      isUrbanZoneId(safeZoneId) ||
      safeZoneId === "airport_extended_ring_25km"
    );
  }

  function isCdmxAnchorAirportId(airportId) {
    return CDMX_ANCHOR_AIRPORT_IDS.indexOf(normalizeId(airportId)) !== -1;
  }

  function isExternalAirportId(airportId) {
    return EXTERNAL_AIRPORT_IDS.indexOf(normalizeId(airportId)) !== -1;
  }

  function requiresOvernight(zoneId) {
    const corridor = getCorridorDefinition(zoneId);

    if (corridor && corridor.requiresOvernight === true) {
      return true;
    }

    const ring = getRingDefinition(zoneId);

    return !!(ring && ring.distanceKm >= 300);
  }

  function includesEstimatedTolls(zoneId) {
    const corridor = getCorridorDefinition(zoneId);

    if (corridor && corridor.includesEstimatedTolls === true) {
      return true;
    }

    return requiresOvernight(zoneId);
  }

  function requiresOperationalConfirmation(zoneId) {
    const ring = getRingDefinition(zoneId);

    return !!(ring && ring.distanceKm >= 700);
  }

  function getSaleModeForFare(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const airportId = normalizeId(safeInput.airportId);
    const zoneId = normalizeId(safeInput.zoneId);

    if (!airportId || !zoneId) {
      return "unavailable";
    }

    if (!isExtendedOperationalZoneId(zoneId)) {
      return "automatic";
    }

    if (isCdmxAnchorAirportId(airportId)) {
      return requiresOperationalConfirmation(zoneId) ? "assisted" : "automatic";
    }

    if (isExternalAirportId(airportId)) {
      return isCdmxMetropolitanZoneId(zoneId) ? "automatic" : "unavailable";
    }

    return "unavailable";
  }

  function isFareRequestable(input) {
    return getSaleModeForFare(input) !== "unavailable";
  }

  function getAirportSearchLocationRestriction() {
    return Object.assign({}, EXTENDED_AIRPORT_SEARCH_RESTRICTION);
  }

  window.PixkuyAirportExtendedRingsPolicy = {
    getUrbanZoneIds: getUrbanZoneIds,
    getRingDefinitions: getRingDefinitions,
    getRingZoneIds: getRingZoneIds,
    getRingDefinition: getRingDefinition,
    getCorridorDefinitions: getCorridorDefinitions,
    getCorridorZoneIds: getCorridorZoneIds,
    getCorridorDefinition: getCorridorDefinition,
    isUrbanZoneId: isUrbanZoneId,
    isExtendedRingZoneId: isExtendedRingZoneId,
    isExtendedCorridorZoneId: isExtendedCorridorZoneId,
    isExtendedOperationalZoneId: isExtendedOperationalZoneId,
    isCdmxMetropolitanZoneId: isCdmxMetropolitanZoneId,
    isCdmxAnchorAirportId: isCdmxAnchorAirportId,
    isExternalAirportId: isExternalAirportId,
    requiresOvernight: requiresOvernight,
    includesEstimatedTolls: includesEstimatedTolls,
    requiresOperationalConfirmation: requiresOperationalConfirmation,
    getSaleModeForFare: getSaleModeForFare,
    isFareRequestable: isFareRequestable,
    getAirportSearchLocationRestriction: getAirportSearchLocationRestriction
  };
})();