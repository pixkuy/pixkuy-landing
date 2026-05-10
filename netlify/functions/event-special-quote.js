const fs = require("fs");
const path = require("path");

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const DATA_DIR_CANDIDATES = [
  path.join(process.cwd(), "assets", "js", "data"),
  path.join(__dirname, "..", "..", "assets", "js", "data")
];

const VALID_VARIANTS = new Set(["arrival", "departure", "round_trip"]);
const VALID_PASSENGER_KEYS = new Set(["van_1_2", "van_3_4", "van_5_6"]);

/*
  Events opera en CDMX/ZMVM.
  Las horas del evento y de recogida se tratan como horas locales literales.
  Este offset no convierte la hora: solo serializa esa hora local en formato RFC3339 para Google Routes.
*/
const OPERATIONAL_CDMX_UTC_OFFSET = "-06:00";

const MIN_LEAD_HOURS = 6;
const HORIZON_DAYS = 30;

const DIRECT_TRANSFER_EQUIVALENT_PRICING = {
  currency: "MXN",
  roundingStep: 50,
  baseFee: 125,
  kmRate: 6.9,
  minuteRate: 4.25,
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

const EVENT_PRICING_RULES = {
  arrival: {
    van_1_2: {
      multiplier: 1.25,
      surcharge: 100,
      minimum: 550
    },
    van_3_4: {
      multiplier: 1.22,
      surcharge: 125,
      minimum: 650
    },
    van_5_6: {
      multiplier: 1.18,
      surcharge: 150,
      minimum: 750
    }
  },
  departure: {
    van_1_2: {
      multiplier: 1.55,
      surcharge: 300,
      minimum: 850
    },
    van_3_4: {
      multiplier: 1.45,
      surcharge: 325,
      minimum: 950
    },
    van_5_6: {
      multiplier: 1.35,
      surcharge: 350,
      minimum: 1100
    }
  },
  round_trip: {
    van_1_2: {
      multiplier: 1.3,
      surcharge: 400,
      minimum: 1250
    },
    van_3_4: {
      multiplier: 1.25,
      surcharge: 450,
      minimum: 1450
    },
    van_5_6: {
      multiplier: 1.2,
      surcharge: 500,
      minimum: 1650
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

function readJsonFile(fileName) {
  const dataDir = DATA_DIR_CANDIDATES.find((candidate) => {
    return fs.existsSync(path.join(candidate, fileName));
  });

  if (!dataDir) {
    throw new Error("DATA_FILE_NOT_FOUND:" + fileName);
  }

  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));
}

function loadSharedData() {
  const venues = readJsonFile("events-special-venues.json");
  const catalog = readJsonFile("events-special-catalog.json");
  const pricing = readJsonFile("events-special-pricing.json");

  return {
    venues: Array.isArray(venues.venues) ? venues.venues : [],
    events: Array.isArray(catalog.events) ? catalog.events : [],
    pricing: isObject(pricing) ? pricing : {}
  };
}

function buildVenuesById(venues) {
  return venues.reduce((acc, venue) => {
    if (venue && venue.id) {
      acc[venue.id] = venue;
    }

    return acc;
  }, {});
}

function parseLocalDateTimeToMinutes(value) {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return (((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute;
}

function getCdmxNowParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }

    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function getCdmxNowMinutes() {
  const now = getCdmxNowParts();

  return (((now.year * 12 + now.month) * 31 + now.day) * 24 + now.hour) * 60 + now.minute;
}

function isEventEligible(event, venue) {
  if (!event || event.active !== true) return false;
  if (!event.startsAt) return false;
  if (!event.posterSrc) return false;
  if (!venue || venue.active !== true) return false;

  const eventMinutes = parseLocalDateTimeToMinutes(event.startsAt);
  if (eventMinutes === null) return false;

  const nowMinutes = getCdmxNowMinutes();
  const minVisibleMinutes = nowMinutes + (MIN_LEAD_HOURS * 60);
  const maxVisibleMinutes = nowMinutes + (HORIZON_DAYS * 24 * 60);

  return eventMinutes >= minVisibleMinutes && eventMinutes <= maxVisibleMinutes;
}

function normalizeCoordinate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
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
    lng
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

function buildWaypointFromVenue(venue) {
  const point = venue && venue.operationalPoint;
  const lat = point ? normalizeCoordinate(point.lat) : null;
  const lng = point ? normalizeCoordinate(point.lng) : null;

  if (lat === null || lng === null) {
    return null;
  }

  return {
    location: {
      latLng: {
        latitude: lat,
        longitude: lng
      }
    }
  };
}

function getEventLocalDate(event) {
  const startsAt = normalizeText(event && event.startsAt);
  const match = startsAt.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}$/);

  return match ? match[1] : "";
}

function normalizeDayOffset(value) {
  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0 || offset > 1) {
    return 0;
  }

  return offset;
}

function addDaysToLocalDate(dateValue, dayOffset) {
  const raw = normalizeText(dateValue);
  const offset = normalizeDayOffset(dayOffset);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  if (offset === 0) {
    return raw;
  }

  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + offset,
    12,
    0,
    0
  ));

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function buildDepartureTime(event, pickupTime, dayOffset) {
  const eventDate = getEventLocalDate(event);
  const date = addDaysToLocalDate(eventDate, dayOffset);
  const time = normalizeText(pickupTime);

  if (!date || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return "";
  }

  return `${date}T${time}:00${OPERATIONAL_CDMX_UTC_OFFSET}`;
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
      trafficModel: options.trafficModel || "PESSIMISTIC",
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

function calculateDirectTransferEquivalentPrice(options) {
  const distanceKm = Number(options.distanceMeters) / 1000;
  const durationMinutes = Number(options.durationSeconds) / 60;
  const capacityPricing = DIRECT_TRANSFER_EQUIVALENT_PRICING.capacityPremiums[options.passengerFareKey];

  if (
    !capacityPricing ||
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(durationMinutes)
  ) {
    return null;
  }

  const referenceMinutes = distanceKm * DIRECT_TRANSFER_EQUIVALENT_PRICING.referenceMinutesPerKm;
  const structuralMinutes = Math.min(durationMinutes, referenceMinutes);
  const congestionMinutes = Math.max(0, durationMinutes - referenceMinutes);
  const softenedCongestionMinutes = DIRECT_TRANSFER_EQUIVALENT_PRICING.congestionSoftCapMinutes *
    (1 - Math.exp(-congestionMinutes / DIRECT_TRANSFER_EQUIVALENT_PRICING.congestionSoftCapMinutes));
  const effectiveMinutes = structuralMinutes + softenedCongestionMinutes;

  const baseRaw =
    DIRECT_TRANSFER_EQUIVALENT_PRICING.baseFee +
    (distanceKm * DIRECT_TRANSFER_EQUIVALENT_PRICING.kmRate) +
    (effectiveMinutes * DIRECT_TRANSFER_EQUIVALENT_PRICING.minuteRate);

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
    price: ceilToStep(withMinimum, DIRECT_TRANSFER_EQUIVALENT_PRICING.roundingStep),
    baseRaw,
    referenceMinutes,
    congestionMinutes,
    softenedCongestionMinutes,
    effectiveMinutes,
    capacityPremium,
    marketStress
  };
}

function getEventPricingRule(variant, passengerFareKey) {
  const variantRules = EVENT_PRICING_RULES[variant];

  if (!variantRules) {
    return null;
  }

  return variantRules[passengerFareKey] || null;
}

function applyEventPricingRule(options) {
  const rule = getEventPricingRule(options.variant, options.passengerFareKey);
  const roundingStep = options.roundingStep;
  const directTransferBasePrice = Number(options.directTransferBasePrice);

  if (!rule || !Number.isFinite(directTransferBasePrice)) {
    return null;
  }

  const multiplier = Number(rule.multiplier);
  const surcharge = Number(rule.surcharge);
  const minimum = Number(rule.minimum);

  if (
    !Number.isFinite(multiplier) ||
    !Number.isFinite(surcharge) ||
    !Number.isFinite(minimum)
  ) {
    return null;
  }

  const multipliedPrice = directTransferBasePrice * multiplier;
  const surchargePrice = directTransferBasePrice + surcharge;
  const rawEventPrice = Math.max(multipliedPrice, surchargePrice, minimum);

  return {
    price: ceilToStep(rawEventPrice, roundingStep),
    directTransferBasePrice,
    eventPricingMultiplier: multiplier,
    eventPricingSurcharge: surcharge,
    eventPricingMinimum: minimum,
    eventPricingRaw: rawEventPrice
  };
}

function buildRouteTiming(durationSeconds, distanceMeters) {
  const durationMinutes = Number(durationSeconds) / 60;
  const distanceKm = Number(distanceMeters) / 1000;

  if (!Number.isFinite(durationMinutes) || !Number.isFinite(distanceKm)) {
    return null;
  }

  const referenceMinutes = distanceKm * 2.2;
  const structuralMinutes = Math.min(durationMinutes, referenceMinutes);
  const congestionMinutes = Math.max(0, durationMinutes - referenceMinutes);
  const softenedCongestionMinutes = 22 * (1 - Math.exp(-congestionMinutes / 22));
  const effectiveMinutes = structuralMinutes + softenedCongestionMinutes;

  return {
    durationMinutes,
    distanceKm,
    referenceMinutes,
    congestionMinutes,
    softenedCongestionMinutes,
    effectiveMinutes
  };
}

function getEmptyRouteTiming() {
  return {
    durationMinutes: 0,
    distanceKm: 0,
    referenceMinutes: 0,
    congestionMinutes: 0,
    softenedCongestionMinutes: 0,
    effectiveMinutes: 0
  };
}

function calculatePrice(options) {
  const pricing = options.pricing;
  const variantId = options.variant;
  const passengerFareKey = options.passengerFareKey;
  const variant = pricing.variants && pricing.variants[variantId];
  const roundingStep = pricing.rounding ? Number(pricing.rounding.step) : 50;

  if (!variant || !getEventPricingRule(variantId, passengerFareKey)) {
    return null;
  }

  let outboundTiming = getEmptyRouteTiming();
  let returnTiming = getEmptyRouteTiming();
  let outboundDirectTransferPrice = null;
  let returnDirectTransferPrice = null;

  if (options.outboundDurationSeconds) {
    outboundTiming = buildRouteTiming(
      options.outboundDurationSeconds,
      options.outboundDistanceMeters
    );

    if (!outboundTiming) {
      return null;
    }

    outboundDirectTransferPrice = calculateDirectTransferEquivalentPrice({
      distanceMeters: options.outboundDistanceMeters,
      durationSeconds: options.outboundDurationSeconds,
      passengerFareKey
    });

    if (!outboundDirectTransferPrice) {
      return null;
    }
  }

  if (options.returnDurationSeconds) {
    returnTiming = buildRouteTiming(
      options.returnDurationSeconds,
      options.returnDistanceMeters
    );

    if (!returnTiming) {
      return null;
    }

    returnDirectTransferPrice = calculateDirectTransferEquivalentPrice({
      distanceMeters: options.returnDistanceMeters,
      durationSeconds: options.returnDurationSeconds,
      passengerFareKey
    });

    if (!returnDirectTransferPrice) {
      return null;
    }
  }

  let directTransferBasePrice;
  let operationalMinutes;
  let operationalCongestionMinutes;
  let directTransferOutboundPrice = 0;
  let directTransferReturnPrice = 0;

  if (variantId === "round_trip") {
    if (!outboundDirectTransferPrice || !returnDirectTransferPrice) {
      return null;
    }

    directTransferOutboundPrice = outboundDirectTransferPrice.price;
    directTransferReturnPrice = returnDirectTransferPrice.price;
    directTransferBasePrice = directTransferOutboundPrice + directTransferReturnPrice;
    operationalMinutes =
      outboundTiming.effectiveMinutes +
      returnTiming.effectiveMinutes +
      Number(variant.bufferMinutes || 0);
    operationalCongestionMinutes =
      outboundTiming.congestionMinutes +
      returnTiming.congestionMinutes;
  } else if (variantId === "departure") {
    if (!returnDirectTransferPrice) {
      return null;
    }

    directTransferReturnPrice = returnDirectTransferPrice.price;
    directTransferBasePrice = directTransferReturnPrice;
    operationalMinutes =
      returnTiming.effectiveMinutes +
      Number(variant.bufferMinutes || 0);
    operationalCongestionMinutes = returnTiming.congestionMinutes;
  } else {
    if (!outboundDirectTransferPrice) {
      return null;
    }

    directTransferOutboundPrice = outboundDirectTransferPrice.price;
    directTransferBasePrice = directTransferOutboundPrice;
    operationalMinutes = outboundTiming.effectiveMinutes;
    operationalCongestionMinutes = outboundTiming.congestionMinutes;
  }

  if (!Number.isFinite(operationalMinutes) || operationalMinutes <= 0) {
    return null;
  }

  const eventPrice = applyEventPricingRule({
    variant: variantId,
    passengerFareKey,
    directTransferBasePrice,
    roundingStep
  });

  if (!eventPrice) {
    return null;
  }

  return {
    price: eventPrice.price,
    basePrice: directTransferBasePrice,
    routeBase: eventPrice.eventPricingRaw,
    operationalMinutes,
    operationalCongestionMinutes,
    eventStress: 0,
    capacityPremium: 0,
    outboundEffectiveMinutes: outboundTiming.effectiveMinutes,
    returnEffectiveMinutes: returnTiming.effectiveMinutes,
    directTransferBasePrice: eventPrice.directTransferBasePrice,
    directTransferOutboundPrice,
    directTransferReturnPrice,
    eventPricingMultiplier: eventPrice.eventPricingMultiplier,
    eventPricingSurcharge: eventPrice.eventPricingSurcharge,
    eventPricingMinimum: eventPrice.eventPricingMinimum,
    eventPricingRaw: eventPrice.eventPricingRaw
  };
}

function buildQuotePayload(options) {
  return {
    ok: true,
    quote: {
      price: options.price.price,
      currency: options.pricing.currency || "MXN",
      variant: options.variant,
      passengerFareKey: options.passengerFareKey,
      outboundDurationSeconds: options.outboundRoute ? options.outboundRoute.durationSeconds : null,
      returnDurationSeconds: options.returnRoute ? options.returnRoute.durationSeconds : null,
      outboundDistanceMeters: options.outboundRoute ? options.outboundRoute.distanceMeters : null,
      returnDistanceMeters: options.returnRoute ? options.returnRoute.distanceMeters : null,
      basePrice: Math.round(options.price.basePrice * 100) / 100,
      routeBase: Math.round(options.price.routeBase * 100) / 100,
      operationalMinutes: Math.round(options.price.operationalMinutes * 100) / 100,
      operationalCongestionMinutes: Math.round(options.price.operationalCongestionMinutes * 100) / 100,
      eventStress: Math.round(options.price.eventStress * 1000) / 1000,
      capacityPremium: Math.round(options.price.capacityPremium * 100) / 100,
      outboundEffectiveMinutes: Math.round(options.price.outboundEffectiveMinutes * 100) / 100,
      returnEffectiveMinutes: Math.round(options.price.returnEffectiveMinutes * 100) / 100,
      directTransferBasePrice: Math.round(options.price.directTransferBasePrice * 100) / 100,
      directTransferOutboundPrice: Math.round(options.price.directTransferOutboundPrice * 100) / 100,
      directTransferReturnPrice: Math.round(options.price.directTransferReturnPrice * 100) / 100,
      eventPricingMultiplier: Math.round(options.price.eventPricingMultiplier * 1000) / 1000,
      eventPricingSurcharge: Math.round(options.price.eventPricingSurcharge * 100) / 100,
      eventPricingMinimum: Math.round(options.price.eventPricingMinimum * 100) / 100,
      eventPricingRaw: Math.round(options.price.eventPricingRaw * 100) / 100
    }
  };
}

exports.handler = async function handler(event) {
  if (!event || event.httpMethod !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "services.cards.events.states.error");
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return fail(400, "INVALID_JSON", "services.cards.events.states.error");
  }

  const eventId = normalizeText(payload.eventId);
  const venueId = normalizeText(payload.venueId);
  const variant = normalizeText(payload.variant);
  const passengerFareKey = normalizeText(payload.passengerFareKey);

  if (
    !eventId ||
    !venueId ||
    !VALID_VARIANTS.has(variant) ||
    !VALID_PASSENGER_KEYS.has(passengerFareKey)
  ) {
    return fail(400, "INVALID_REQUEST", "services.cards.events.states.priceUnavailable");
  }

  let sharedData;

  try {
    sharedData = loadSharedData();
  } catch (error) {
    return fail(503, "CONFIGURATION_ERROR", "services.cards.events.states.priceUnavailable");
  }

  const venuesById = buildVenuesById(sharedData.venues);
  const selectedEvent = sharedData.events.find((item) => item && item.id === eventId);
  const selectedVenue = venuesById[venueId];

  if (!selectedEvent) {
    return fail(404, "EVENT_NOT_FOUND", "services.cards.events.states.priceUnavailable");
  }

  if (!selectedVenue) {
    return fail(404, "VENUE_NOT_FOUND", "services.cards.events.states.priceUnavailable");
  }

  if (selectedVenue.active !== true) {
    return fail(409, "VENUE_INACTIVE", "services.cards.events.states.priceUnavailable");
  }

  if (selectedEvent.venueId !== venueId) {
    return fail(400, "EVENT_VENUE_MISMATCH", "services.cards.events.states.priceUnavailable");
  }

  if (selectedEvent.active !== true) {
    return fail(409, "EVENT_INACTIVE", "services.cards.events.states.priceUnavailable");
  }

  const venueWaypoint = buildWaypointFromVenue(selectedVenue);

  if (!venueWaypoint) {
    return fail(503, "VENUE_CONFIGURATION_ERROR", "services.cards.events.states.priceUnavailable");
  }

  const originAddress = normalizeAddress(payload.originAddress);
  const destinationAddress = normalizeAddress(payload.destinationAddress);
  const originPickupTime = normalizeText(payload.originPickupTime);
  const returnPickupTime = normalizeText(payload.returnPickupTime);
  const returnPickupDayOffset = normalizeDayOffset(payload.returnPickupDayOffset);

  if (variant === "arrival" && (!originAddress || !originPickupTime)) {
    return fail(400, "INVALID_REQUEST", "services.cards.events.states.priceUnavailable");
  }

  if (variant === "departure" && (!destinationAddress || !returnPickupTime)) {
    return fail(400, "INVALID_REQUEST", "services.cards.events.states.priceUnavailable");
  }

  if (
    variant === "round_trip" &&
    (!originAddress || !destinationAddress || !originPickupTime || !returnPickupTime)
  ) {
    return fail(400, "INVALID_REQUEST", "services.cards.events.states.priceUnavailable");
  }

  let outboundRoute = null;
  let returnRoute = null;

  try {
    if (variant === "arrival" || variant === "round_trip") {
      const departureTime = buildDepartureTime(selectedEvent, originPickupTime);

      if (!departureTime) {
        return fail(400, "INVALID_REQUEST", "services.cards.events.states.priceUnavailable");
      }

      outboundRoute = await computeRoute({
        origin: buildWaypointFromAddress(originAddress),
        destination: venueWaypoint,
        departureTime,
        trafficModel: "PESSIMISTIC"
      });
    }

    if (variant === "departure" || variant === "round_trip") {
      const departureTime = buildDepartureTime(selectedEvent, returnPickupTime, returnPickupDayOffset);

      if (!departureTime) {
        return fail(400, "INVALID_REQUEST", "services.cards.events.states.priceUnavailable");
      }

      returnRoute = await computeRoute({
        origin: venueWaypoint,
        destination: buildWaypointFromAddress(destinationAddress),
        departureTime,
        trafficModel: "PESSIMISTIC"
      });
    }
  } catch (error) {
    const errorMessage = error && error.message ? error.message : "";

    if (errorMessage === "GOOGLE_ROUTES_API_KEY_MISSING") {
      return fail(503, "GOOGLE_ROUTES_API_KEY_MISSING", "services.cards.events.states.priceUnavailable");
    }

    return fail(503, "ROUTE_UNAVAILABLE", "services.cards.events.states.priceUnavailable");
  }

  const price = calculatePrice({
    pricing: sharedData.pricing,
    variant,
    passengerFareKey,
    outboundDurationSeconds: outboundRoute ? outboundRoute.durationSeconds : 0,
    returnDurationSeconds: returnRoute ? returnRoute.durationSeconds : 0,
    outboundDistanceMeters: outboundRoute ? outboundRoute.distanceMeters : 0,
    returnDistanceMeters: returnRoute ? returnRoute.distanceMeters : 0
  });

  if (!price || !Number.isFinite(Number(price.price))) {
    return fail(503, "QUOTE_UNAVAILABLE", "services.cards.events.states.priceUnavailable");
  }

  return buildResponse(200, buildQuotePayload({
    pricing: sharedData.pricing,
    variant,
    passengerFareKey,
    outboundRoute,
    returnRoute,
    price
  }));
};