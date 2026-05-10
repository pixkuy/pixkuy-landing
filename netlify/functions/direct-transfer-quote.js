const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const VALID_PASSENGER_KEYS = new Set(["van_1_2", "van_3_4", "van_5_6"]);
/*
  Direct Transfer opera solo en CDMX/ZMVM.
  La hora del usuario se trata como hora local literal.
  Este offset no convierte la hora: solo serializa esa hora local en formato RFC3339 para Google Routes.
*/
const DIRECT_TRANSFER_OPERATIONAL_UTC_OFFSET = "-06:00";

const DIRECT_TRANSFER_COVERAGE = {
  centerLat: 19.36,
  centerLng: -99.16,
  primaryRadiusKm: 38,
  outerRadiusKm: 78
};

const CATALOGUED_AIRPORT_CODES = new Set(["MEX", "NLU", "TLC", "PBC", "QRO"]);

const CATALOGUED_AIRPORT_KEYWORDS = [
  "aeropuerto internacional de la ciudad de mexico",
  "aeropuerto internacional de la ciudad de méxico",
  "benito juarez international airport",
  "benito juárez international airport",
  "aicm",
  "aeropuerto internacional felipe angeles",
  "aeropuerto internacional felipe ángeles",
  "felipe angeles international airport",
  "felipe ángeles international airport",
  "aifa",
  "aeropuerto internacional de toluca",
  "toluca international airport",
  "licenciado adolfo lopez mateos international airport",
  "licenciado adolfo lópez mateos international airport",
  "aeropuerto internacional de puebla",
  "puebla international airport",
  "hermanos serdan international airport",
  "hermanos serdán international airport",
  "aeropuerto intercontinental de queretaro",
  "aeropuerto intercontinental de querétaro",
  "queretaro intercontinental airport",
  "querétaro intercontinental airport"
];

const PRICING = {
  currency: "MXN",
  roundingStep: 50,
  baseFee: 125,
  kmRate: 6.9,
  minuteRate: 4.25,
  minimum: 150,
  referenceMinutesPerKm: 2.35,
  congestionSoftCapMinutes: 18,
  capacityPremiums: {
    van_1_2: {
      minimum: 150
    },
    van_3_4: {
      minimum: 200
    },
    van_5_6: {
      minimum: 300
    }
  }
};

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
  if (!isObject(value)) return null;

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

function normalizeComparisonText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAddressComponentText(address) {
  return address.addressComponents
    .map(function mapComponent(component) {
      if (!component || typeof component !== "object") {
        return "";
      }

      return [
        component.shortText,
        component.short_name,
        component.longText,
        component.long_name
      ].map(normalizeText).filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" | ");
}

function getAddressSearchText(address) {
  return [
    address.label,
    address.placeId,
    address.countryCode,
    address.administrativeAreaLevel1,
    address.administrativeAreaLevel2,
    address.locality,
    address.iataCode,
    address.types.join(" "),
    getAddressComponentText(address)
  ].map(normalizeComparisonText).filter(Boolean).join(" | ");
}

function getDistanceKmBetweenCoordinates(left, right) {
  const earthRadiusKm = 6371;
  const leftLat = Number(left && left.lat);
  const leftLng = Number(left && left.lng);
  const rightLat = Number(right && right.lat);
  const rightLng = Number(right && right.lng);

  if (
    !Number.isFinite(leftLat) ||
    !Number.isFinite(leftLng) ||
    !Number.isFinite(rightLat) ||
    !Number.isFinite(rightLng)
  ) {
    return null;
  }

  const toRadians = Math.PI / 180;
  const deltaLat = (rightLat - leftLat) * toRadians;
  const deltaLng = (rightLng - leftLng) * toRadians;
  const lat1 = leftLat * toRadians;
  const lat2 = rightLat * toRadians;

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getDirectTransferCoverage(address) {
  const distanceKm = getDistanceKmBetweenCoordinates(
    {
      lat: DIRECT_TRANSFER_COVERAGE.centerLat,
      lng: DIRECT_TRANSFER_COVERAGE.centerLng
    },
    address
  );

  if (!Number.isFinite(distanceKm)) {
    return {
      isWithinCoverage: false,
      coverageId: "",
      pricingMode: ""
    };
  }

  if (distanceKm <= DIRECT_TRANSFER_COVERAGE.primaryRadiusKm) {
    return {
      isWithinCoverage: true,
      coverageId: "primary_area",
      pricingMode: "standard"
    };
  }

  if (distanceKm <= DIRECT_TRANSFER_COVERAGE.outerRadiusKm) {
    return {
      isWithinCoverage: true,
      coverageId: "extended_ring",
      pricingMode: "extended"
    };
  }

  return {
    isWithinCoverage: false,
    coverageId: "",
    pricingMode: ""
  };
}

function isInsideDirectTransferCoverage(address) {
  const coverage = getDirectTransferCoverage(address);

  return Boolean(coverage && coverage.isWithinCoverage === true);
}

function isCataloguedAirportAddress(address) {
  const text = getAddressSearchText(address);
  let index;

  if (address.iataCode && CATALOGUED_AIRPORT_CODES.has(address.iataCode)) {
    return true;
  }

  for (index = 0; index < CATALOGUED_AIRPORT_KEYWORDS.length; index += 1) {
    if (text.indexOf(normalizeComparisonText(CATALOGUED_AIRPORT_KEYWORDS[index])) !== -1) {
      return true;
    }
  }

  return false;
}

function getDirectTransferServerRestriction(originAddress, destinationAddress) {
  if (isCataloguedAirportAddress(originAddress) || isCataloguedAirportAddress(destinationAddress)) {
    return "DIRECT_TRANSFER_AIRPORT_ROUTE_NOT_ALLOWED";
  }

  if (!isInsideDirectTransferCoverage(originAddress) || !isInsideDirectTransferCoverage(destinationAddress)) {
    return "DIRECT_TRANSFER_OUT_OF_COVERAGE";
  }

  return "";
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

function ceilToStep(value, step) {
  const safeStep = Number.isFinite(Number(step)) && Number(step) > 0
    ? Number(step)
    : 50;

  return Math.ceil(value / safeStep) * safeStep;
}

function clamp(value, min, max) {
  const number = Number(value);
  const minValue = Number(min);
  const maxValue = Number(max);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue > maxValue) {
    return number;
  }

  return Math.min(Math.max(number, minValue), maxValue);
}

function smoothstep(value) {
  const number = clamp(value, 0, 1);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number * number * (3 - (2 * number));
}

function getExtendedPricingContext(originAddress, destinationAddress) {
  const originCoverage = getDirectTransferCoverage(originAddress);
  const destinationCoverage = getDirectTransferCoverage(destinationAddress);
  const isExtended = Boolean(
    (originCoverage && originCoverage.pricingMode === "extended") ||
      (destinationCoverage && destinationCoverage.pricingMode === "extended")
  );

  return {
    pricingMode: isExtended ? "extended" : "standard",
    originCoverage,
    destinationCoverage
  };
}

function isWeekdayMorningExtendedScarcitySlot(pickupDate, pickupTime) {
  const date = normalizeText(pickupDate);
  const time = normalizeText(pickupTime);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return false;
  }

  const day = new Date(date + "T12:00:00Z").getUTCDay();
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

  return day >= 1 && day <= 5 && minutes >= 390 && minutes <= 570;
}

function isWestExtendedCorridor(originAddress, destinationAddress) {
  const originCoverage = getDirectTransferCoverage(originAddress);
  const destinationCoverage = getDirectTransferCoverage(destinationAddress);
  const extendedAddress =
    originCoverage && originCoverage.pricingMode === "extended"
      ? originAddress
      : destinationCoverage && destinationCoverage.pricingMode === "extended"
        ? destinationAddress
        : null;

  if (!extendedAddress) {
    return false;
  }

  return Number(extendedAddress.lng) < DIRECT_TRANSFER_COVERAGE.centerLng;
}

function applyExtendedPricing(options) {
  const price = options.price;
  const passengerFareKey = normalizeText(options.passengerFareKey);
  const distanceKm = Number(options.route.distanceMeters) / 1000;
  const basePrice = Number(price && price.price);
  const scarcity =
    passengerFareKey === "van_5_6" &&
    isWestExtendedCorridor(options.originAddress, options.destinationAddress) &&
    isWeekdayMorningExtendedScarcitySlot(options.pickupDate, options.pickupTime)
      ? 1
      : 0;

  let extendedRaw = basePrice;

  if (!Number.isFinite(basePrice) || !Number.isFinite(distanceKm)) {
    return price;
  }

  if (passengerFareKey === "van_1_2") {
    extendedRaw = 775 + (0.30 * basePrice) + (4.00 * distanceKm);
  }

  if (passengerFareKey === "van_3_4") {
    extendedRaw = 1000 + (0.55 * basePrice) + (2.75 * distanceKm);
  }

  if (passengerFareKey === "van_5_6") {
    extendedRaw = 750 + (0.30 * basePrice) + (14.00 * distanceKm) + (450 * scarcity);
  }

  return Object.assign({}, price, {
    price: ceilToStep(extendedRaw, PRICING.roundingStep),
    extendedRaw: extendedRaw,
    extendedDistanceKm: distanceKm,
    extendedScarcity: scarcity
  });
}

function calculatePrice(options) {
  const distanceKm = Number(options.distanceMeters) / 1000;
  const durationMinutes = Number(options.durationSeconds) / 60;
  const capacityPricing = PRICING.capacityPremiums[options.passengerFareKey];

  if (
    !capacityPricing ||
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(durationMinutes)
  ) {
    return null;
  }

  const referenceMinutes = distanceKm * PRICING.referenceMinutesPerKm;
  const structuralMinutes = Math.min(durationMinutes, referenceMinutes);
  const congestionMinutes = Math.max(0, durationMinutes - referenceMinutes);
  const softenedCongestionMinutes = PRICING.congestionSoftCapMinutes *
    (1 - Math.exp(-congestionMinutes / PRICING.congestionSoftCapMinutes));
  const effectiveMinutes = structuralMinutes + softenedCongestionMinutes;

  const baseRaw =
    PRICING.baseFee +
    (distanceKm * PRICING.kmRate) +
    (effectiveMinutes * PRICING.minuteRate);

  const congestionStress = congestionMinutes / (congestionMinutes + 14);
  const fareScale = 1 - Math.exp(-baseRaw / 650);
  const congestionSignal = smoothstep(congestionStress);
  const fareSignal = smoothstep(fareScale);

  if (!Number.isFinite(congestionSignal) || !Number.isFinite(fareSignal)) {
    return null;
  }

  const marketStress = clamp(
    (0.78 * congestionSignal) + (0.22 * fareSignal),
    0,
    1
  );

  if (!Number.isFinite(marketStress)) {
    return null;
  }

  const premiumFiveSix = clamp(
    105 + (110 * Math.pow(marketStress, 0.85)),
    115,
    225
  );
  const premiumThreeFour = clamp(
    25 + (0.26 * premiumFiveSix),
    45,
    85
  );

  if (!Number.isFinite(premiumFiveSix) || !Number.isFinite(premiumThreeFour)) {
    return null;
  }

  let capacityPremium = 0;

  if (options.passengerFareKey === "van_3_4") {
    capacityPremium = premiumThreeFour;
  }

  if (options.passengerFareKey === "van_5_6") {
    capacityPremium = premiumFiveSix;
  }

  const withCapacity = baseRaw + capacityPremium;
  const withMinimum = Math.max(withCapacity, capacityPricing.minimum);

  return {
    price: ceilToStep(withMinimum, PRICING.roundingStep),
    baseRaw,
    referenceMinutes,
    congestionMinutes,
    softenedCongestionMinutes,
    effectiveMinutes,
    capacityPremium,
    marketStress
  };
}

function buildQuotePayload(options) {
  const capacityPricing = PRICING.capacityPremiums[options.passengerFareKey];

  return {
    ok: true,
    quote: {
      price: options.price.price,
      currency: PRICING.currency,
      passengerFareKey: options.passengerFareKey,
      durationSeconds: options.route.durationSeconds,
      distanceMeters: options.route.distanceMeters,
      baseFee: PRICING.baseFee,
      kmRate: PRICING.kmRate,
      minuteRate: PRICING.minuteRate,
      minimum: capacityPricing.minimum,
      roundingStep: PRICING.roundingStep,
      referenceMinutes: Math.round(options.price.referenceMinutes * 100) / 100,
      congestionMinutes: Math.round(options.price.congestionMinutes * 100) / 100,
      softenedCongestionMinutes: Math.round(options.price.softenedCongestionMinutes * 100) / 100,
      effectiveMinutes: Math.round(options.price.effectiveMinutes * 100) / 100,
      capacityPremium: Math.round(options.price.capacityPremium * 100) / 100,
      marketStress: Math.round(options.price.marketStress * 1000) / 1000,
      baseRaw: Math.round(options.price.baseRaw * 100) / 100,
      pricingMode: options.pricingContext && options.pricingContext.pricingMode
        ? options.pricingContext.pricingMode
        : "standard",
      extendedRaw: Number.isFinite(Number(options.price.extendedRaw))
        ? Math.round(options.price.extendedRaw * 100) / 100
        : null,
      extendedDistanceKm: Number.isFinite(Number(options.price.extendedDistanceKm))
        ? Math.round(options.price.extendedDistanceKm * 100) / 100
        : null,
      extendedScarcity: Number.isFinite(Number(options.price.extendedScarcity))
        ? Number(options.price.extendedScarcity)
        : 0
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

  const serverRestriction = getDirectTransferServerRestriction(originAddress, destinationAddress);

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

  const pricingContext = getExtendedPricingContext(originAddress, destinationAddress);
  let price = calculatePrice({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    passengerFareKey
  });

  if (pricingContext.pricingMode === "extended") {
    price = applyExtendedPricing({
      price,
      route,
      passengerFareKey,
      originAddress,
      destinationAddress,
      pickupDate,
      pickupTime
    });
  }

  if (!price || !Number.isFinite(Number(price.price))) {
    return fail(503, "QUOTE_UNAVAILABLE", "directTransferMobileFlow.fare.unavailable");
  }

  return buildResponse(200, buildQuotePayload({
    route,
    price,
    passengerFareKey,
    pricingContext
  }));
};