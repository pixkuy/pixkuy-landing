const vm = require("vm");

const {
  readDataFile
} = require("./directTransferDataLoader");

const {
  floorToStep
} = require("./directTransferPricingV2");

const AIRPORT_EQUIVALENT_AIRPORT_ID = "mex";
const AIRPORT_CEILING_MULTIPLIER = 0.95;
const AIRPORT_CEILING_ROUNDING_STEP = 50;

const AIRPORT_CATALOG_FILES = [
  "airport-zone-catalog.js",
  "airport-extended-rings-catalog.js",
  "airport-extended-corridors-catalog.js"
];

const RING_DEFINITIONS = [
  { zoneId: "airport_extended_ring_25km", distanceKm: 25 },
  { zoneId: "airport_extended_ring_50km", distanceKm: 50 },
  { zoneId: "airport_extended_ring_75km", distanceKm: 75 },
  { zoneId: "airport_extended_ring_90km", distanceKm: 90 },
  { zoneId: "airport_extended_ring_115km", distanceKm: 115 },
  { zoneId: "airport_extended_ring_140km", distanceKm: 140 },
  { zoneId: "airport_extended_ring_200km", distanceKm: 200 },
  { zoneId: "airport_extended_ring_300km", distanceKm: 300 },
  { zoneId: "airport_extended_ring_400km", distanceKm: 400 },
  { zoneId: "airport_extended_ring_550km", distanceKm: 550 },
  { zoneId: "airport_extended_ring_700km", distanceKm: 700 }
];

let cachedAirportCatalog = null;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value) {
  return normalizeText(value).toLowerCase();
}

function toPositiveNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function getDistanceKm(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const explicitDistanceKm = toPositiveNumber(safeInput.distanceKm);
  const routeDistanceKm = toPositiveNumber(safeInput.routeDistanceKm);
  const distanceMeters = toPositiveNumber(safeInput.distanceMeters);

  if (explicitDistanceKm !== null) {
    return explicitDistanceKm;
  }

  if (routeDistanceKm !== null) {
    return routeDistanceKm;
  }

  return distanceMeters === null ? null : distanceMeters / 1000;
}

function getFareKey(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const fareKey = normalizeText(safeInput.passengerFareKey);

  return (
    fareKey === "van_1_2" ||
    fareKey === "van_3_4" ||
    fareKey === "van_5_6"
  )
    ? fareKey
    : "";
}

function createAirportCatalogSandbox() {
  const windowObject = {};

  return {
    window: windowObject,
    console: {
      log: function log() {},
      warn: function warn() {},
      error: function error() {}
    }
  };
}

function runCatalogFileInSandbox(fileName, sandbox) {
  const source = readDataFile(fileName);

  vm.runInNewContext(source, sandbox, {
    filename: fileName,
    timeout: 1000
  });

  return true;
}

function isValidCatalog(catalog) {
  return Boolean(
    catalog &&
      typeof catalog === "object" &&
      Array.isArray(catalog.airports) &&
      Array.isArray(catalog.zones) &&
      Array.isArray(catalog.fares)
  );
}

function loadAirportCatalog(forceReload) {
  if (cachedAirportCatalog && forceReload !== true) {
    return cachedAirportCatalog;
  }

  const sandbox = createAirportCatalogSandbox();

  AIRPORT_CATALOG_FILES.forEach(function runCatalog(fileName) {
    runCatalogFileInSandbox(fileName, sandbox);
  });

  if (!isValidCatalog(sandbox.window.PIXKUY_AIRPORT_ZONE_CATALOG)) {
    throw new Error("AIRPORT_EQUIVALENT_CATALOG_UNAVAILABLE");
  }

  cachedAirportCatalog = sandbox.window.PIXKUY_AIRPORT_ZONE_CATALOG;

  return cachedAirportCatalog;
}

function getActiveZoneIds(catalog) {
  if (!catalog || !Array.isArray(catalog.zones)) {
    return new Set();
  }

  return new Set(
    catalog.zones
      .filter(function filterActiveZone(zone) {
        return zone && zone.active === true && normalizeId(zone.id);
      })
      .map(function mapZone(zone) {
        return normalizeId(zone.id);
      })
  );
}

function getZoneType(zoneId) {
  const safeZoneId = normalizeId(zoneId);

  if (!safeZoneId) {
    return "";
  }

  if (safeZoneId.indexOf("airport_extended_corridor_") === 0) {
    return "corridor";
  }

  if (safeZoneId.indexOf("airport_extended_ring_") === 0) {
    return "ring";
  }

  return "urban";
}

function resolveAirportFareForZoneId(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const catalog = safeInput.catalog || loadAirportCatalog(false);
  const zoneId = normalizeId(safeInput.zoneId);
  const passengerFareKey = getFareKey(safeInput);

  if (!zoneId || !passengerFareKey || !Array.isArray(catalog.fares)) {
    return null;
  }

  return (
    catalog.fares.find(function findFare(fare) {
      return (
        fare &&
        fare.active === true &&
        normalizeId(fare.airportId) === AIRPORT_EQUIVALENT_AIRPORT_ID &&
        normalizeId(fare.zoneId) === zoneId &&
        normalizeText(fare.fareKey) === passengerFareKey &&
        Number.isFinite(Number(fare.price)) &&
        Number(fare.price) > 0
      );
    }) || null
  );
}

function resolveRingZoneIdByDistanceKm(distanceKm) {
  const distance = toPositiveNumber(distanceKm);

  if (distance === null) {
    return "";
  }

  const ring = RING_DEFINITIONS.find(function findRing(definition) {
    return distance <= definition.distanceKm;
  });

  return ring ? ring.zoneId : "";
}

function appendCandidate(candidates, activeZoneIds, value, source) {
  const zoneId = normalizeId(value);

  if (!zoneId || !activeZoneIds.has(zoneId)) {
    return false;
  }

  if (
    candidates.some(function hasCandidate(candidate) {
      return candidate.zoneId === zoneId;
    })
  ) {
    return false;
  }

  candidates.push({
    zoneId,
    source: normalizeText(source) || "coverage",
    zoneType: getZoneType(zoneId)
  });

  return true;
}

function appendCoverageCandidate(candidates, activeZoneIds, coverage, source) {
  if (!coverage || typeof coverage !== "object") {
    return false;
  }

  return appendCandidate(
    candidates,
    activeZoneIds,
    coverage.coverageId,
    source
  );
}

function collectCoverageZoneCandidates(input, catalog) {
  const safeInput = input && typeof input === "object" ? input : {};
  const activeZoneIds = getActiveZoneIds(catalog);
  const candidates = [];

  appendCandidate(candidates, activeZoneIds, safeInput.zoneId, "zone_id");
  appendCandidate(candidates, activeZoneIds, safeInput.coverageId, "coverage_id");

  appendCoverageCandidate(
    candidates,
    activeZoneIds,
    safeInput.coverage,
    "coverage"
  );

  appendCoverageCandidate(
    candidates,
    activeZoneIds,
    safeInput.originCoverage,
    "origin_coverage"
  );

  appendCoverageCandidate(
    candidates,
    activeZoneIds,
    safeInput.destinationCoverage,
    "destination_coverage"
  );

  if (Array.isArray(safeInput.coverageIds)) {
    safeInput.coverageIds.forEach(function eachCoverageId(coverageId) {
      appendCandidate(candidates, activeZoneIds, coverageId, "coverage_ids");
    });
  }

  if (Array.isArray(safeInput.coverages)) {
    safeInput.coverages.forEach(function eachCoverage(coverage) {
      appendCoverageCandidate(
        candidates,
        activeZoneIds,
        coverage,
        "coverages"
      );
    });
  }

  return candidates;
}

function buildAirportCeilingFromFare(fare, meta) {
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  const price = Number(fare && fare.price);
  const rawCeiling = price * AIRPORT_CEILING_MULTIPLIER;
  const ceiling = floorToStep(rawCeiling, AIRPORT_CEILING_ROUNDING_STEP);

  if (!Number.isFinite(price) || price <= 0 || !ceiling || ceiling <= 0) {
    return null;
  }

  return {
    airportId: AIRPORT_EQUIVALENT_AIRPORT_ID,
    airportFare: price,
    airportCeiling: ceiling,
    airportCeilingRaw: rawCeiling,
    airportCeilingMultiplier: AIRPORT_CEILING_MULTIPLIER,
    airportCeilingRoundingStep: AIRPORT_CEILING_ROUNDING_STEP,
    airportEquivalentZoneId: normalizeId(fare.zoneId),
    airportEquivalentZoneType: getZoneType(fare.zoneId),
    airportEquivalentSource: normalizeText(safeMeta.source),
    currency: normalizeText(fare.currency) || "MXN"
  };
}

function selectHighestFareCandidate(candidates, input, catalog) {
  const passengerFareKey = getFareKey(input);
  let best = null;

  candidates.forEach(function eachCandidate(candidate) {
    const fare = resolveAirportFareForZoneId({
      catalog,
      zoneId: candidate.zoneId,
      passengerFareKey
    });

    if (!fare) {
      return;
    }

    if (!best || Number(fare.price) > Number(best.fare.price)) {
      best = {
        fare,
        candidate
      };
    }
  });

  return best;
}

function resolveAirportCeilingFromCoverage(input, catalog) {
  const candidates = collectCoverageZoneCandidates(input, catalog);
  const best = selectHighestFareCandidate(candidates, input, catalog);

  if (!best) {
    return null;
  }

  return buildAirportCeilingFromFare(best.fare, {
    source: best.candidate.source
  });
}

function resolveAirportCeilingFromDistance(input, catalog) {
  const distanceKm = getDistanceKm(input);
  const passengerFareKey = getFareKey(input);
  const ringZoneId = resolveRingZoneIdByDistanceKm(distanceKm);

  if (!ringZoneId || !passengerFareKey) {
    return null;
  }

  const fare = resolveAirportFareForZoneId({
    catalog,
    zoneId: ringZoneId,
    passengerFareKey
  });

  if (!fare) {
    return null;
  }

  return buildAirportCeilingFromFare(fare, {
    source: "distance_ring"
  });
}

function resolveAirportCeilingForDirectTransfer(input) {
  const passengerFareKey = getFareKey(input);

  if (!passengerFareKey) {
    return {
      airportCeiling: null,
      airportCeilingApplied: false,
      airportEquivalentZoneId: "",
      airportEquivalentZoneType: "",
      airportEquivalentSource: "",
      airportFare: null,
      currency: "MXN"
    };
  }

  const catalog = loadAirportCatalog(false);
  const coverageCeiling = resolveAirportCeilingFromCoverage(input, catalog);
  const distanceCeiling = resolveAirportCeilingFromDistance(input, catalog);
  const selected = coverageCeiling || distanceCeiling;

  if (!selected) {
    return {
      airportCeiling: null,
      airportCeilingApplied: false,
      airportEquivalentZoneId: "",
      airportEquivalentZoneType: "",
      airportEquivalentSource: "",
      airportFare: null,
      currency: "MXN"
    };
  }

  return Object.assign(
    {
      airportCeilingApplied: false
    },
    selected
  );
}

module.exports = {
  AIRPORT_EQUIVALENT_AIRPORT_ID,
  AIRPORT_CEILING_MULTIPLIER,
  AIRPORT_CEILING_ROUNDING_STEP,
  AIRPORT_CATALOG_FILES,
  RING_DEFINITIONS,
  loadAirportCatalog,
  resolveAirportFareForZoneId,
  resolveRingZoneIdByDistanceKm,
  resolveAirportCeilingForDirectTransfer
};