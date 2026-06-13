const {
  resolveCoverageFromPoint
} = require("./_shared/direct-transfer/directTransferGeojsonResolver");

const {
  getDirectTransferAirportRestriction
} = require("./_shared/direct-transfer/directTransferAirportGuard");

const {
  calculateDirectTransferPricingV2
} = require("./_shared/direct-transfer/directTransferPricingV2");

const {
  resolveAirportCeilingForDirectTransfer
} = require("./_shared/direct-transfer/directTransferAirportCeiling");

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const VALID_PASSENGER_KEYS = new Set(["van_1_2", "van_3_4", "van_5_6"]);

/*
  Direct Transfer opera con hora local literal de CDMX.
  Este offset no convierte la hora: solo serializa esa hora local en formato RFC3339 para Google Routes.
*/
const DIRECT_TRANSFER_OPERATIONAL_UTC_OFFSET = "-06:00";

function buildResponse(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  };
}

function fail(statusCode, code, messageKey) {
  return buildResponse(statusCode, {
    ok: false,
    code,
    messageKey
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCoordinate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function normalizeArray(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function normalizeAddress(value) {
  if (!isObject(value)) {
    return null;
  }

  const lat = normalizeCoordinate(value.lat);
  const lng = normalizeCoordinate(value.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    label: normalizeText(value.label),
    placeId: normalizeText(value.placeId),
    lat,
    lng,
    countryCode: normalizeText(value.countryCode || value.regionCode),
    administrativeAreaLevel1: normalizeText(
      value.administrativeAreaLevel1 ||
        value.adminAreaLevel1 ||
        value.state ||
        value.region
    ),
    administrativeAreaLevel2: normalizeText(
      value.administrativeAreaLevel2 ||
        value.adminAreaLevel2 ||
        value.county
    ),
    locality: normalizeText(value.locality || value.city),
    iataCode: normalizeText(value.iataCode).toUpperCase(),
    types: normalizeArray(value.types, 12),
    addressComponents: normalizeArray(value.addressComponents, 16)
  };
}

function buildWaypointFromAddress(address) {
  return {
    location: {
      latLng: {
        latitude: address.lat,
        longitude: address.lng
      }
    }
  };
}

function buildDepartureTime(pickupDate, pickupTime) {
  const date = normalizeText(pickupDate);
  const time = normalizeText(pickupTime);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return "";
  }

  return `${date}T${time}:00${DIRECT_TRANSFER_OPERATIONAL_UTC_OFFSET}`;
}

function parseDurationSeconds(value) {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d+(?:\.\d+)?)s$/);

  if (!match) {
    return null;
  }

  const seconds = Number(match[1]);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.ceil(seconds);
}

async function computeRoute(options) {
  const apiKey = normalizeText(process.env.GOOGLE_ROUTES_API_KEY);

  if (!apiKey) {
    throw new Error("GOOGLE_ROUTES_API_KEY_MISSING");
  }

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
    },
    body: JSON.stringify({
      origin: options.origin,
      destination: options.destination,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      trafficModel: "PESSIMISTIC",
      departureTime: options.departureTime,
      computeAlternativeRoutes: false,
      languageCode: "es-MX",
      units: "METRIC"
    })
  });

  if (!response.ok) {
    throw new Error("GOOGLE_ROUTES_HTTP_" + response.status);
  }

  const data = await response.json();
  const route = data && Array.isArray(data.routes) ? data.routes[0] : null;
  const durationSeconds = route ? parseDurationSeconds(route.duration) : null;
  const distanceMeters = route && Number.isFinite(Number(route.distanceMeters))
    ? Number(route.distanceMeters)
    : null;

  if (!durationSeconds || distanceMeters === null) {
    throw new Error("ROUTE_UNAVAILABLE");
  }

  return {
    durationSeconds,
    distanceMeters
  };
}

function resolveAddressCoverage(address) {
  return resolveCoverageFromPoint({
    lat: address.lat,
    lng: address.lng
  });
}

function getDirectTransferCoverageRestriction(originCoverage, destinationCoverage) {
  if (
    !originCoverage ||
    originCoverage.isWithinCoverage !== true ||
    !destinationCoverage ||
    destinationCoverage.isWithinCoverage !== true
  ) {
    return "DIRECT_TRANSFER_OUT_OF_COVERAGE";
  }

  return "";
}

function getDirectTransferServerRestriction(originAddress, destinationAddress, originCoverage, destinationCoverage) {
  const airportRestriction = getDirectTransferAirportRestriction(
    originAddress,
    destinationAddress
  );

  if (airportRestriction) {
    return airportRestriction;
  }

  return getDirectTransferCoverageRestriction(originCoverage, destinationCoverage);
}

function getPricingMode(originCoverage, destinationCoverage) {
  const originMode = normalizeText(originCoverage && originCoverage.pricingMode);
  const destinationMode = normalizeText(destinationCoverage && destinationCoverage.pricingMode);

  if (originMode && originMode !== "standard") {
    return originMode;
  }

  if (destinationMode && destinationMode !== "standard") {
    return destinationMode;
  }

  return originMode || destinationMode || "standard";
}

function roundNumber(value, decimals) {
  const number = Number(value);
  const factor = Math.pow(10, Number(decimals) || 0);

  if (!Number.isFinite(number) || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }

  return Math.round(number * factor) / factor;
}

function buildQuotePayload(options) {
  const ceiling = options.airportCeiling || {};
  const pricing = options.pricing || {};
  const route = options.route || {};
  const originCoverage = options.originCoverage || {};
  const destinationCoverage = options.destinationCoverage || {};
  const pricingMode = getPricingMode(originCoverage, destinationCoverage);

  return {
    ok: true,
    quote: {
      price: pricing.price,
      currency: pricing.currency || ceiling.currency || "MXN",
      passengerFareKey: options.passengerFareKey,
      durationSeconds: route.durationSeconds,
      distanceMeters: route.distanceMeters,
      pricingVersion: "direct_transfer_v2",
      pricingMode,
      roundingStep: pricing.roundingStep,
      route: {
        durationSeconds: route.durationSeconds,
        distanceMeters: route.distanceMeters
      },
      originCoverage: {
        isWithinCoverage: originCoverage.isWithinCoverage === true,
        coverageId: normalizeText(originCoverage.coverageId),
        pricingMode: normalizeText(originCoverage.pricingMode),
        priority: Number.isFinite(Number(originCoverage.priority))
          ? Number(originCoverage.priority)
          : 0,
        shape: normalizeText(originCoverage.shape)
      },
      destinationCoverage: {
        isWithinCoverage: destinationCoverage.isWithinCoverage === true,
        coverageId: normalizeText(destinationCoverage.coverageId),
        pricingMode: normalizeText(destinationCoverage.pricingMode),
        priority: Number.isFinite(Number(destinationCoverage.priority))
          ? Number(destinationCoverage.priority)
          : 0,
        shape: normalizeText(destinationCoverage.shape)
      },
      marketRaw: pricing.marketRaw,
      marketOneTwoRaw: pricing.marketOneTwoRaw,
      technicalFloor: pricing.technicalFloor,
      technicalRaw: pricing.technicalRaw,
      capacityMinimum: pricing.capacityMinimum,
      rawBeforeCeiling: pricing.rawBeforeCeiling,
      rawAfterCeiling: pricing.rawAfterCeiling,
      passengerMultiplier: pricing.passengerMultiplier,
      distanceRate: pricing.distanceRate,
      distanceKm: pricing.distanceKm,
      durationMinutes: pricing.durationMinutes,
      slowdownMinutes: pricing.slowdownMinutes,
      longTailKm: pricing.longTailKm,
      distanceStress: pricing.distanceStress,
      airportCeiling: pricing.airportCeiling,
      airportCeilingApplied: pricing.airportCeilingApplied === true,
      airportFare: ceiling.airportFare === null || ceiling.airportFare === undefined
        ? null
        : Number(ceiling.airportFare),
      airportEquivalentZoneId: normalizeText(ceiling.airportEquivalentZoneId),
      airportEquivalentZoneType: normalizeText(ceiling.airportEquivalentZoneType),
      airportEquivalentSource: normalizeText(ceiling.airportEquivalentSource),
      airportCeilingMultiplier: ceiling.airportCeilingMultiplier === undefined
        ? null
        : roundNumber(ceiling.airportCeilingMultiplier, 4),
      airportCeilingRoundingStep: ceiling.airportCeilingRoundingStep === undefined
        ? null
        : Number(ceiling.airportCeilingRoundingStep),
      technicalFloorBreachedByCeiling: pricing.technicalFloorBreachedByCeiling === true
    }
  };
}

exports.handler = async function handler(event) {
  if (!event || event.httpMethod !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "directTransferMobileFlow.fare.unavailable");
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return fail(400, "INVALID_JSON", "directTransferMobileFlow.fare.unavailable");
  }

  const originAddress = normalizeAddress(payload.originAddress);
  const destinationAddress = normalizeAddress(payload.destinationAddress);
  const pickupDate = normalizeText(payload.pickupDate);
  const pickupTime = normalizeText(payload.pickupTime);
  const passengerFareKey = normalizeText(payload.passengerFareKey);

  if (
    !originAddress ||
    !destinationAddress ||
    !pickupDate ||
    !pickupTime ||
    !VALID_PASSENGER_KEYS.has(passengerFareKey)
  ) {
    return fail(400, "INVALID_REQUEST", "directTransferMobileFlow.fare.unavailable");
  }

  const departureTime = buildDepartureTime(pickupDate, pickupTime);

  if (!departureTime) {
    return fail(400, "INVALID_DEPARTURE_TIME", "directTransferMobileFlow.fare.unavailable");
  }

  let originCoverage;
  let destinationCoverage;

  try {
    originCoverage = resolveAddressCoverage(originAddress);
    destinationCoverage = resolveAddressCoverage(destinationAddress);
  } catch (error) {
    return fail(503, "DIRECT_TRANSFER_COVERAGE_CONFIGURATION_ERROR", "directTransferMobileFlow.fare.unavailable");
  }

  const serverRestriction = getDirectTransferServerRestriction(
    originAddress,
    destinationAddress,
    originCoverage,
    destinationCoverage
  );

  if (serverRestriction) {
    return fail(400, serverRestriction, "directTransferMobileFlow.fare.unavailable");
  }

  let route;

  try {
    route = await computeRoute({
      origin: buildWaypointFromAddress(originAddress),
      destination: buildWaypointFromAddress(destinationAddress),
      departureTime
    });
  } catch (error) {
    const errorMessage = error && error.message ? error.message : "";

    if (errorMessage === "GOOGLE_ROUTES_API_KEY_MISSING") {
      return fail(503, "GOOGLE_ROUTES_API_KEY_MISSING", "directTransferMobileFlow.fare.unavailable");
    }

    return fail(503, "ROUTE_UNAVAILABLE", "directTransferMobileFlow.fare.unavailable");
  }

  let airportCeiling;

  try {
    airportCeiling = resolveAirportCeilingForDirectTransfer({
      passengerFareKey,
      distanceMeters: route.distanceMeters,
      originCoverage,
      destinationCoverage,
      coverages: [
        originCoverage,
        destinationCoverage
      ]
    });
  } catch (error) {
    return fail(503, "AIRPORT_EQUIVALENT_CONFIGURATION_ERROR", "directTransferMobileFlow.fare.unavailable");
  }

  const pricing = calculateDirectTransferPricingV2({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    passengerFareKey,
    airportCeiling: airportCeiling.airportCeiling
  });

  if (!pricing || !Number.isFinite(Number(pricing.price))) {
    return fail(503, "QUOTE_UNAVAILABLE", "directTransferMobileFlow.fare.unavailable");
  }

  return buildResponse(200, buildQuotePayload({
    route,
    pricing,
    airportCeiling,
    passengerFareKey,
    originCoverage,
    destinationCoverage
  }));
};