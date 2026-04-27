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
const CDMX_UTC_OFFSET = "-06:00";
const MIN_LEAD_HOURS = 6;
const HORIZON_DAYS = 30;

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

  return `${date}T${time}:00${CDMX_UTC_OFFSET}`;
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

function calculatePrice(options) {
  const pricing = options.pricing;
  const variantId = options.variant;
  const passengerFareKey = options.passengerFareKey;
  const variant = pricing.variants && pricing.variants[variantId];
  const passengerFactor = pricing.passengerFactors && pricing.passengerFactors[passengerFareKey];

  if (!variant || !passengerFactor) {
    return null;
  }

  const hourlyReference = Number(pricing.hourlyReference);
  const durationFactor = Number(variant.durationFactor);
  const minimum = Number(variant.minimum);
  const passengerMultiplier = Number(passengerFactor.factor);
  const bufferMinutes = Number(variant.bufferMinutes || 0);
  const roundingStep = pricing.rounding ? Number(pricing.rounding.step) : 50;

  if (
    !Number.isFinite(hourlyReference) ||
    !Number.isFinite(durationFactor) ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(passengerMultiplier)
  ) {
    return null;
  }

  let billableHours;

  if (variantId === "round_trip") {
    billableHours =
      ((options.outboundDurationSeconds || 0) / 3600) +
      ((options.returnDurationSeconds || 0) / 3600) +
      (bufferMinutes / 60);
  } else if (variantId === "departure") {
    billableHours =
      ((options.returnDurationSeconds || 0) / 3600) +
      (bufferMinutes / 60);
  } else {
    billableHours = (options.outboundDurationSeconds || 0) / 3600;
  }

  if (!Number.isFinite(billableHours) || billableHours <= 0) {
    return null;
  }

  const basePrice = billableHours * hourlyReference * durationFactor;
  const withMinimum = Math.max(basePrice, minimum);
  const withPassengerFactor = withMinimum * passengerMultiplier;

  return ceilToStep(withPassengerFactor, roundingStep);
}

function buildQuotePayload(options) {
  return {
    ok: true,
    quote: {
      price: options.price,
      currency: options.pricing.currency || "MXN",
      variant: options.variant,
      passengerFareKey: options.passengerFareKey,
      outboundDurationSeconds: options.outboundRoute ? options.outboundRoute.durationSeconds : null,
      returnDurationSeconds: options.returnRoute ? options.returnRoute.durationSeconds : null,
      outboundDistanceMeters: options.outboundRoute ? options.outboundRoute.distanceMeters : null,
      returnDistanceMeters: options.returnRoute ? options.returnRoute.distanceMeters : null
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

  if (!isEventEligible(selectedEvent, selectedVenue)) {
    return fail(409, "EVENT_NOT_ELIGIBLE", "services.cards.events.states.priceUnavailable");
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
    returnDurationSeconds: returnRoute ? returnRoute.durationSeconds : 0
  });

  if (!price) {
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