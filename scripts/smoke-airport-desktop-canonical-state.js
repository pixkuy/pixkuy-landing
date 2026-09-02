const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = {
  console,
  document: {
    documentElement: { lang: "en" },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    }
  },
  setTimeout,
  clearTimeout
};

context.window = context;
context.CustomEvent = function CustomEvent(type, init) {
  this.type = type;
  this.detail = init && init.detail;
};

function load(relativePath) {
  const absolutePath = path.join(root, relativePath);
  vm.runInNewContext(fs.readFileSync(absolutePath, "utf8"), context, {
    filename: absolutePath
  });
}

load("assets/js/data/airport-zone-catalog.js");
load("assets/js/services/direct-transfer-airport-guard.js");
load("assets/js/airport-tariff/airport-tariff-state.js");
load("assets/js/airport-tariff/airport-tariff-handoff.js");

const guard = context.PixkuyDirectTransferAirportGuard;
const stateApi = context.PixkuyAirportTariffState;
const handoffApi = context.PixkuyAirportTariffHandoff;
const hotel = {
  address:
    "Hotel NH Collection Mexico City Reforma — Liverpool 155, Juárez, Cuauhtémoc, CDMX",
  placeId: "ChIJ_NH_COLLECTION_REFORMA",
  primaryType: "lodging",
  lat: 19.4267,
  lng: -99.1658,
  zoneId: "reforma"
};

assert.equal(
  guard.isSelectedAirportTransferLocation({ airportId: "mex", ...hotel }),
  false,
  "MEX -> NH Collection Reforma must not collide with the selected airport"
);
assert.equal(
  guard.isSelectedAirportTransferLocation({ airportId: "mex", ...hotel }),
  false,
  "NH Collection Reforma -> MEX must not collide with the selected airport"
);
assert.equal(
  guard.isSelectedAirportTransferLocation({
    airportId: "mex",
    address: "Terminal 2, Aeropuerto Internacional de la Ciudad de México (MEX)",
    placeId: "ChIJ_MEX_TERMINAL_2",
    primaryType: "airport_terminal"
  }),
  true,
  "A real MEX terminal must remain blocked"
);

const catalog = context.PIXKUY_AIRPORT_ZONE_CATALOG;
const airport = catalog.airports.find((item) => item.id === "mex");
const zone = catalog.zones.find((item) => item.id === hotel.zoneId);
const stateDeps = {
  isFiniteNumber: Number.isFinite,
  normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  },
  findItemById(type, id) {
    return type === "airport"
      ? catalog.airports.find((item) => item.id === id) || null
      : null;
  },
  resolveItemLabel(item) {
    return item && item.id === "mex"
      ? "MEX — Mexico City International Airport"
      : "";
  },
  getZoneIdForFare(state) {
    return state.lodgingEndpointZoneId || state.resolvedZoneId || "";
  },
  getZoneOptionById(id) {
    return catalog.zones.find((item) => item.id === id) || null;
  }
};

function buildState(direction) {
  const isInverse = direction === "hotel_to_airport";
  const state = {
    originType: isInverse ? "zone" : "airport",
    destinationType: isInverse ? "airport" : "zone",
    originValue: isInverse ? "" : airport.id,
    destinationValue: isInverse ? airport.id : "",
    originLabel: isInverse ? "" : "MEX — Mexico City International Airport",
    destinationLabel: isInverse ? "MEX — Mexico City International Airport" : "",
    lodgingSearchSide: isInverse ? "origin" : "destination",
    lodgingEndpointSide: "",
    lodgingEndpointLabel: "",
    lodgingEndpointPlaceId: "",
    lodgingEndpointPrimaryType: "",
    lodgingEndpointLat: null,
    lodgingEndpointLng: null,
    lodgingEndpointZoneId: "",
    lodgingEndpointZoneLabelKey: "",
    resolvedZoneId: "",
    selectedFareKey: "van_1_2"
  };

  assert.equal(
    stateApi.applyLodgingEndpointState(
      state,
      {
        side: isInverse ? "origin" : "destination",
        placeLabel: hotel.address,
        placeId: hotel.placeId,
        primaryType: hotel.primaryType,
        lat: hotel.lat,
        lng: hotel.lng,
        zoneId: hotel.zoneId,
        zoneLabelKey: zone.labelKey
      },
      stateDeps
    ),
    true
  );

  return state;
}

const handoffDeps = {
  normalizeText: stateDeps.normalizeText,
  getActiveLodgingSide(state) {
    return stateApi.getActiveLodgingSide(state, stateDeps);
  },
  resolveDisplayLabel(type, id) {
    return type === "airport" && id === "mex"
      ? "MEX — Mexico City International Airport"
      : type === "zone" && id === hotel.zoneId
        ? "Reforma"
        : "";
  },
  getZoneIdForFare: stateDeps.getZoneIdForFare,
  resolveFare() {
    return { price: 775, currency: "MXN" };
  },
  formatPrice(value, currency) {
    return `${value} ${currency}`;
  },
  getActiveLodgingSideForSwap() {
    return "destination";
  },
  resolveFareKeyDisplayLabel() {
    return "1–2 passengers";
  },
  debugSwapTrace() {}
};

["airport_to_hotel", "hotel_to_airport"].forEach((direction) => {
  const state = buildState(direction);
  const prefill = handoffApi.buildPanelToContactPrefill(state, handoffDeps);

  assert.deepEqual(
    JSON.parse(JSON.stringify(prefill)),
    direction === "hotel_to_airport"
      ? {
          origin: hotel.address,
          destination: "MEX — Mexico City International Airport"
        }
      : {
          origin: "MEX — Mexico City International Airport",
          destination: hotel.address
        }
  );
  assert.equal(state.lodgingEndpointPlaceId, hotel.placeId);
  assert.equal(state.lodgingEndpointPrimaryType, hotel.primaryType);
  assert.equal(state.lodgingEndpointLat, hotel.lat);
  assert.equal(state.lodgingEndpointLng, hotel.lng);
  assert.equal(state.lodgingEndpointZoneId, hotel.zoneId);
});

const editorSource = fs.readFileSync(
  path.join(root, "assets/js/forms/contact-airport-hotel-editor.js"),
  "utf8"
);
const checkoutSource = fs.readFileSync(
  path.join(root, "assets/js/forms/airport-transfer-booking-api-checkout.js"),
  "utf8"
);
const inputHandler = editorSource.match(
  /nodes\.hotelInput\.addEventListener\("input", function \(\) \{[\s\S]*?\n\s*nodes\.serviceDateInput\.addEventListener/
);

assert.ok(inputHandler, "Airport hotel input handler must exist");
assert.match(
  inputHandler[0],
  /clearResolvedDestination/,
  "Free text must invalidate the prior canonical lodging selection"
);
assert.match(
  inputHandler[0],
  /syncAirportHotelPayloadFields/,
  "Canonical hidden fields must be synchronized after free-text invalidation"
);
assert.match(
  checkoutSource,
  /hasCanonicalAirportTransferNonAirportLocation\(data, form\)/,
  "Airport checkout must require a canonical non-airport location"
);
assert.match(
  checkoutSource,
  /normalizeText\(location\.place_id\)[\s\S]*Number\.isFinite\(location\.lat\)[\s\S]*Number\.isFinite\(location\.lng\)/,
  "Airport checkout must require Place ID and coordinates"
);

process.stdout.write("AIRPORT_DESKTOP_CANONICAL_STATE_SMOKE=PASS\n");
