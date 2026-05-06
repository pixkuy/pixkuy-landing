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

const DIRECT_TRANSFER_BOUNDS = {
  minLat: 19.0,
  maxLat: 19.85,
  minLng: -99.45,
  maxLng: -98.85
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
  kmRate: 10,
  minuteRate: 11,
  roundingStep: 50,
  passengerFactors: {
    van_1_2: 1,
    van_3_4: 1.15,
    van_5_6: 1.3
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

function isInsideDirectTransferBounds(address) {
  return Boolean(
    address &&
      address.lat >= DIRECT_TRANSFER_BOUNDS.minLat &&
      address.lat <= DIRECT_TRANSFER_BOUNDS.maxLat &&
      address.lng >= DIRECT_TRANSFER_BOUNDS.minLng &&
      address.lng <= DIRECT_TRANSFER_BOUNDS.maxLng
  );
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

  if (!isInsideDirectTransferBounds(originAddress) || !isInsideDirectTransferBounds(destinationAddress)) {
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

function calculatePrice(options) {
  const distanceKm = Number(options.distanceMeters) / 1000;
  const durationMinutes = Number(options.durationSeconds) / 60;
  const passengerFactor = PRICING.passengerFactors[options.passengerFareKey];

  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(durationMinutes) ||
    !Number.isFinite(passengerFactor)
  ) {
    return null;
  }

  const base = (distanceKm * PRICING.kmRate) + (durationMinutes * PRICING.minuteRate);
  const withPassengers = base * passengerFactor;

  return ceilToStep(withPassengers, PRICING.roundingStep);
}

function buildQuotePayload(options) {
  return {
    ok: true,
    quote: {
      price: options.price,
      currency: PRICING.currency,
      passengerFareKey: options.passengerFareKey,
      durationSeconds: options.route.durationSeconds,
      distanceMeters: options.route.distanceMeters,
      kmRate: PRICING.kmRate,
      minuteRate: PRICING.minuteRate,
      passengerFactor: PRICING.passengerFactors[options.passengerFareKey],
      roundingStep: PRICING.roundingStep
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

  const price = calculatePrice({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    passengerFareKey
  });

  if (!price) {
    return fail(503, "QUOTE_UNAVAILABLE", "directTransferMobileFlow.fare.unavailable");
  }

  return buildResponse(200, buildQuotePayload({
    route,
    price,
    passengerFareKey
  }));
};