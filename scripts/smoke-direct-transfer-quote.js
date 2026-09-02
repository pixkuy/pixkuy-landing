const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DEFAULT_BASE_URL = "http://localhost:8888";
const DEFAULT_PICKUP_DATE = "2026-07-15";
const DEFAULT_PICKUP_TIME = "10:00";
const REQUEST_TIMEOUT_MS = 45000;

const baseUrl = String(
  process.env.PIXKUY_DIRECT_TRANSFER_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, "");

const endpointUrl = `${baseUrl}/.netlify/functions/direct-transfer-quote`;

const cdmxCentro = {
  label: "Centro Histórico, Ciudad de México",
  placeId: "smoke_origin_cdmx_centro",
  lat: 19.4326,
  lng: -99.1332,
  countryCode: "MX",
  locality: "Ciudad de México",
  types: ["locality"]
};

const romaNorte = {
  label: "Roma Norte, Ciudad de México",
  placeId: "smoke_destination_roma_norte",
  lat: 19.4195,
  lng: -99.1653,
  countryCode: "MX",
  locality: "Ciudad de México",
  types: ["neighborhood"]
};

const colimaRomaNorte = {
  label: "Colima 71, Roma Norte, Ciudad de México",
  placeId: "smoke_origin_colima_roma_norte",
  lat: 19.4192,
  lng: -99.1629,
  countryCode: "MX",
  locality: "Ciudad de México",
  types: ["street_address"]
};

const estadioCiudadMexico = {
  label: "Estadio Ciudad de México, Santa Úrsula Coapa, Ciudad de México",
  placeId: "smoke_destination_estadio_ciudad_de_mexico",
  lat: 19.3029,
  lng: -99.1505,
  countryCode: "MX",
  locality: "Ciudad de México",
  types: ["stadium"]
};

const pueblaCentro = {
  label: "Puebla Centro, Puebla",
  placeId: "smoke_destination_puebla_centro",
  lat: 19.0414,
  lng: -98.2063,
  countryCode: "MX",
  locality: "Puebla",
  types: ["locality"]
};

const oaxacaCentro = {
  label: "Oaxaca Centro, Oaxaca",
  placeId: "smoke_destination_oaxaca_centro",
  lat: 17.0732,
  lng: -96.7266,
  countryCode: "MX",
  locality: "Oaxaca de Juárez",
  types: ["locality"]
};

const acapulcoCentro = {
  label: "Acapulco Centro, Guerrero",
  placeId: "smoke_destination_acapulco_centro",
  lat: 16.8531,
  lng: -99.8237,
  countryCode: "MX",
  locality: "Acapulco",
  types: ["locality"]
};

const moreliaCentro = {
  label: "Morelia Centro, Michoacán",
  placeId: "smoke_destination_morelia_centro",
  lat: 19.7008,
  lng: -101.1844,
  countryCode: "MX",
  locality: "Morelia",
  types: ["locality"]
};

const taxcoCentro = {
  label: "Taxco Centro, Guerrero",
  placeId: "smoke_destination_taxco_centro",
  lat: 18.5565,
  lng: -99.6059,
  countryCode: "MX",
  locality: "Taxco",
  types: ["locality"]
};

const puertoVallartaCentro = {
  label: "Puerto Vallarta Centro, Jalisco",
  placeId: "smoke_destination_puerto_vallarta_centro",
  lat: 20.6534,
  lng: -105.2253,
  countryCode: "MX",
  locality: "Puerto Vallarta",
  types: ["locality"]
};

const queretaroCentro = {
  label: "Centro Histórico, Santiago de Querétaro, Querétaro",
  placeId: "smoke_destination_queretaro_centro",
  lat: 20.5888,
  lng: -100.3899,
  countryCode: "MX",
  administrativeAreaLevel1: "Querétaro",
  locality: "Santiago de Querétaro",
  types: ["locality"]
};

const qroAirport = {
  label: "Aeropuerto Internacional de Querétaro, Carretera Estatal 200, Querétaro",
  placeId: "smoke_destination_qro_airport_without_iata",
  lat: 20.6173,
  lng: -100.1857,
  countryCode: "MX",
  administrativeAreaLevel1: "Querétaro",
  locality: "Querétaro",
  types: ["airport"]
};

const mexAirport = {
  label: "Aeropuerto Internacional Benito Juárez, Ciudad de México (MEX)",
  placeId: "smoke_origin_mex_airport",
  lat: 19.4361,
  lng: -99.0719,
  countryCode: "MX",
  locality: "Ciudad de México",
  iataCode: "MEX",
  types: ["airport"]
};

const cancunCentro = {
  label: "Cancún Centro, Quintana Roo",
  placeId: "smoke_destination_cancun_centro",
  lat: 21.1619,
  lng: -86.8515,
  countryCode: "MX",
  locality: "Cancún",
  types: ["locality"]
};

function writeLine(value) {
  process.stdout.write(`${String(value)}\n`);
}

function writeError(value) {
  process.stderr.write(`${String(value)}\n`);
}

function buildPayload(originAddress, destinationAddress, passengerFareKey) {
  return {
    originAddress,
    destinationAddress,
    pickupDate: DEFAULT_PICKUP_DATE,
    pickupTime: DEFAULT_PICKUP_TIME,
    passengerFareKey
  };
}

function getCoreCases() {
  return [
    {
      name: "CDMX urban standard 1-2 regression",
      expectedStatus: 200,
      payload: buildPayload(colimaRomaNorte, estadioCiudadMexico, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "standard",
        pricingModel: "standard_legacy",
        priceMin: 250,
        priceMax: 650,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "CDMX urban standard 3-4 regression",
      expectedStatus: 200,
      payload: buildPayload(colimaRomaNorte, estadioCiudadMexico, "van_3_4"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "standard",
        pricingModel: "standard_legacy",
        priceMin: 300,
        priceMax: 750,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "CDMX urban standard 5-6 regression",
      expectedStatus: 200,
      payload: buildPayload(colimaRomaNorte, estadioCiudadMexico, "van_5_6"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "standard",
        pricingModel: "standard_legacy",
        priceMin: 350,
        priceMax: 950,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Puebla corridor 1-2",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, pueblaCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        originCoverageId: "centro",
        destinationCoverageId: "airport_extended_corridor_puebla_angelopolis",
        airportCeilingApplied: true,
        priceEqualsAirportCeiling: true,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Oaxaca ring 400 1-2",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, oaxacaCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        originCoverageId: "centro",
        destinationCoverageId: "airport_extended_ring_400km",
        airportCeilingApplied: true,
        priceEqualsAirportCeiling: true,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Queretaro city corridor 1-2 regression",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, queretaroCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        originCoverageId: "centro",
        destinationCoverageId: "airport_extended_corridor_queretaro",
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "QRO airport blocked",
      expectedStatus: 400,
      payload: buildPayload(cdmxCentro, qroAirport, "van_1_2"),
      expect: {
        ok: false,
        code: "DIRECT_TRANSFER_AIRPORT_ROUTE_NOT_ALLOWED"
      }
    },
    {
	  name: "MEX airport blocked",
      expectedStatus: 400,
      payload: buildPayload(mexAirport, romaNorte, "van_1_2"),
      expect: {
        ok: false,
        code: "DIRECT_TRANSFER_AIRPORT_ROUTE_NOT_ALLOWED"
      }
    },
    {
      name: "Cancun out of coverage",
      expectedStatus: 400,
      payload: buildPayload(cdmxCentro, cancunCentro, "van_1_2"),
      expect: {
        ok: false,
        code: "DIRECT_TRANSFER_OUT_OF_COVERAGE"
      }
    },
    {
      name: "Invalid passenger bucket",
      expectedStatus: 400,
      payload: buildPayload(cdmxCentro, pueblaCentro, "van_7_8"),
      expect: {
        ok: false,
        code: "INVALID_REQUEST"
      }
    },
    {
      name: "Invalid JSON",
      expectedStatus: 400,
      rawBody: "{",
      expect: {
        ok: false,
        code: "INVALID_JSON"
      }
    }
  ];
}

function getFullCases() {
  return [
    {
      name: "Puebla corridor 5-6",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, pueblaCentro, "van_5_6"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        destinationCoverageId: "airport_extended_corridor_puebla_angelopolis",
        priceEqualsAirportCeiling: true,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Oaxaca ring 400 5-6",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, oaxacaCentro, "van_5_6"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        destinationCoverageId: "airport_extended_ring_400km",
        priceEqualsAirportCeiling: true,
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Acapulco ring 300",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, acapulcoCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        destinationCoverageId: "airport_extended_ring_300km",
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Morelia corridor",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, moreliaCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        destinationCoverageId: "airport_extended_corridor_morelia_michoacan",
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Taxco corridor",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, taxcoCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        destinationCoverageId: "airport_extended_corridor_taxco_guerrero",
        technicalFloorBreachedByCeiling: false
      }
    },
    {
      name: "Puerto Vallarta ring 700",
      expectedStatus: 200,
      payload: buildPayload(cdmxCentro, puertoVallartaCentro, "van_1_2"),
      expect: {
        ok: true,
        pricingVersion: "direct_transfer_v2",
        pricingMode: "extended",
        pricingModel: "extended_v2",
        destinationCoverageId: "airport_extended_ring_700km",
        technicalFloorBreachedByCeiling: false
      }
    }
  ];
}

function getCases() {
  if (process.argv.includes("--full")) {
    return getCoreCases().concat(getFullCases());
  }

  return getCoreCases();
}

async function postToEndpoint(testCase) {
  const controller = new AbortController();
  const timeout = setTimeout(function abortRequest() {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: typeof testCase.rawBody === "string"
        ? testCase.rawBody
        : JSON.stringify(testCase.payload),
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;

    try {
      body = JSON.parse(text);
    } catch (error) {
      body = null;
    }

    return {
      status: response.status,
      text,
      body
    };
  } finally {
    clearTimeout(timeout);
  }
}

function addFailure(failures, message) {
  failures.push(message);
}

function assertEqual(failures, label, actual, expected) {
  if (actual !== expected) {
    addFailure(
      failures,
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertPositiveNumber(failures, label, value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    addFailure(failures, `${label}: expected positive number, got ${JSON.stringify(value)}`);
  }
}

function assertPriceRange(failures, quote, expect) {
  const price = Number(quote && quote.price);
  const priceMin = Number(expect && expect.priceMin);
  const priceMax = Number(expect && expect.priceMax);

  if (!Number.isFinite(price)) {
    addFailure(failures, `quote.price must be finite, got ${JSON.stringify(quote && quote.price)}`);
    return;
  }

  if (Number.isFinite(priceMin) && price < priceMin) {
    addFailure(failures, `quote.price below expected minimum: ${price} < ${priceMin}`);
  }

  if (Number.isFinite(priceMax) && price > priceMax) {
    addFailure(failures, `quote.price above expected maximum: ${price} > ${priceMax}`);
  }
}

function assertQuoteInvariants(failures, quote) {
  assertPositiveNumber(failures, "quote.price", quote.price);
  assertPositiveNumber(failures, "quote.distanceMeters", quote.distanceMeters);
  assertPositiveNumber(failures, "quote.durationSeconds", quote.durationSeconds);

  if (quote.airportCeiling !== null && quote.airportCeiling !== undefined) {
    assertPositiveNumber(failures, "quote.airportCeiling", quote.airportCeiling);

    if (Number(quote.price) > Number(quote.airportCeiling)) {
      addFailure(
        failures,
        `quote.price must not exceed airportCeiling: ${quote.price} > ${quote.airportCeiling}`
      );
    }
  }

  if (
    quote.airportFare !== null &&
    quote.airportFare !== undefined &&
    Number.isFinite(Number(quote.airportFare)) &&
    Number.isFinite(Number(quote.price)) &&
    Number(quote.price) >= Number(quote.airportFare)
  ) {
    addFailure(
      failures,
      `quote.price must be lower than airportFare: ${quote.price} >= ${quote.airportFare}`
    );
  }

  if (quote.airportCeilingApplied === true) {
    assertEqual(
      failures,
      "quote.price when airport ceiling is applied",
      Number(quote.price),
      Number(quote.airportCeiling)
    );
  }
}

function assertOkCase(failures, responseBody, expect) {
  const quote = responseBody && responseBody.quote ? responseBody.quote : null;

  assertEqual(failures, "body.ok", responseBody && responseBody.ok, true);

  if (!quote || typeof quote !== "object") {
    addFailure(failures, "body.quote is missing");
    return;
  }

  assertQuoteInvariants(failures, quote);
  assertPriceRange(failures, quote, expect || {});

  if (expect.pricingVersion) {
    assertEqual(failures, "quote.pricingVersion", quote.pricingVersion, expect.pricingVersion);
  }

  if (expect.pricingModel) {
    assertEqual(failures, "quote.pricingModel", quote.pricingModel, expect.pricingModel);
  }

  if (expect.originCoverageId) {
    assertEqual(
      failures,
      "quote.originCoverage.coverageId",
      quote.originCoverage && quote.originCoverage.coverageId,
      expect.originCoverageId
    );
  }

  if (expect.destinationCoverageId) {
    assertEqual(
      failures,
      "quote.destinationCoverage.coverageId",
      quote.destinationCoverage && quote.destinationCoverage.coverageId,
      expect.destinationCoverageId
    );
  }

  if (expect.pricingMode) {
    assertEqual(failures, "quote.pricingMode", quote.pricingMode, expect.pricingMode);
  }

  if (typeof expect.airportCeilingApplied === "boolean") {
    assertEqual(
      failures,
      "quote.airportCeilingApplied",
      quote.airportCeilingApplied,
      expect.airportCeilingApplied
    );
  }

  if (expect.priceEqualsAirportCeiling === true) {
    assertEqual(
      failures,
      "quote.price equals airportCeiling",
      Number(quote.price),
      Number(quote.airportCeiling)
    );
  }

  if (typeof expect.technicalFloorBreachedByCeiling === "boolean") {
    assertEqual(
      failures,
      "quote.technicalFloorBreachedByCeiling",
      quote.technicalFloorBreachedByCeiling,
      expect.technicalFloorBreachedByCeiling
    );
  }
}

function assertErrorCase(failures, responseBody, expect) {
  assertEqual(failures, "body.ok", responseBody && responseBody.ok, false);

  if (expect.code) {
    assertEqual(failures, "body.code", responseBody && responseBody.code, expect.code);
  }
}

async function runCase(testCase) {
  const failures = [];
  let result;

  try {
    result = await postToEndpoint(testCase);
  } catch (error) {
    return {
      ok: false,
      name: testCase.name,
      failures: [
        `request failed: ${error && error.message ? error.message : String(error)}`
      ]
    };
  }

  assertEqual(failures, "HTTP status", result.status, testCase.expectedStatus);

  if (!result.body) {
    addFailure(failures, `response is not JSON: ${result.text.slice(0, 240)}`);
  } else if (testCase.expectedStatus >= 200 && testCase.expectedStatus < 300) {
    assertOkCase(failures, result.body, testCase.expect || {});
  } else {
    assertErrorCase(failures, result.body, testCase.expect || {});
  }

  return {
    ok: failures.length === 0,
    name: testCase.name,
    failures
  };
}

async function main() {
  const testCases = getCases();
  let failed = 0;

  writeLine(`Direct Transfer quote smoke`);
  writeLine(`Endpoint: ${endpointUrl}`);
  writeLine(`Cases: ${testCases.length}`);
  writeLine("");

  for (let index = 0; index < testCases.length; index += 1) {
    const testCase = testCases[index];
    const result = await runCase(testCase);

    if (result.ok) {
      writeLine(`OK ${index + 1}/${testCases.length} ${testCase.name}`);
      continue;
    }

    failed += 1;
    writeLine(`FAIL ${index + 1}/${testCases.length} ${testCase.name}`);
    result.failures.forEach(function eachFailure(failure) {
      writeLine(`  - ${failure}`);
    });
  }

  writeLine("");

  if (failed > 0) {
    writeError(`Direct Transfer smoke failed: ${failed}/${testCases.length}`);
    process.exitCode = 1;
    return;
  }

  writeLine(`Direct Transfer smoke OK: ${testCases.length}/${testCases.length}`);
}

function loadLandingQuoteContracts() {
  const listeners = {};
  const documentListeners = {};
  const redirects = [];
  const storage = {};
  const document = {
    documentElement: {
      lang: "es",
      dataset: {},
      removeAttribute: function removeAttribute() {}
    },
    readyState: "complete",
    title: "Pixkuy",
    createElement: function createElement() {
      return {
        type: "",
        name: "",
        value: "",
        setAttribute: function setAttribute() {},
        dispatchEvent: function dispatchEvent() {
          return true;
        }
      };
    },
    querySelector: function querySelector() {
      return null;
    },
    querySelectorAll: function querySelectorAll() {
      return [];
    },
    addEventListener: function addEventListener(type, listener) {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push(listener);
    },
    dispatchEvent: function dispatchEvent(event) {
      (documentListeners[event.type] || []).forEach(function notify(listener) {
        listener(event);
      });
      return !event.defaultPrevented;
    }
  };
  class LocalCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    }
  }
  class LocalEvent {
    constructor(type, init) {
      this.type = type;
      this.bubbles = Boolean(init && init.bubbles);
      this.cancelable = Boolean(init && init.cancelable);
      this.defaultPrevented = false;
    }

    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true;
      }
    }

    stopPropagation() {}

    stopImmediatePropagation() {
      this.immediatePropagationStopped = true;
    }
  }
  class LocalFormData {
    constructor(form) {
      this.fields = form && form.__pixkuyFields ? form.__pixkuyFields : {};
    }

    forEach(callback) {
      Object.keys(this.fields).forEach((name) => {
        callback(this.fields[name].value, name);
      });
    }
  }
  const window = {
    document,
    CustomEvent: LocalCustomEvent,
    Event: LocalEvent,
    FormData: LocalFormData,
    matchMedia: function matchMedia() {
      return { matches: true };
    },
    addEventListener: function addEventListener(type, listener) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    dispatchEvent: function dispatchEvent(event) {
      (listeners[event.type] || []).forEach(function notify(listener) {
        listener(event);
      });
      return true;
    },
    location: {
      protocol: "http:",
      replace: function replace(url) {
        redirects.push({ method: "replace", url });
      },
      assign: function assign(url) {
        redirects.push({ method: "assign", url });
      }
    },
    sessionStorage: {
      setItem: function setItem(key, value) {
        storage[key] = String(value);
      },
      getItem: function getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key)
          ? storage[key]
          : null;
      },
      removeItem: function removeItem(key) {
        delete storage[key];
      }
    },
    localStorage: {
      getItem: function getItem() {
        return "es";
      }
    },
    navigator: { language: "es-MX" },
    crypto: {
      randomUUID: function randomUUID() {
        return "00000000-0000-4000-8000-000000000005";
      }
    },
    setTimeout: function setTimeoutWithoutBootstrap() {
      return 0;
    },
    clearTimeout: function clearTimeoutWithoutBootstrap() {}
  };
  const context = {
    window,
    document,
    CustomEvent: LocalCustomEvent,
    Event: LocalEvent,
    Date,
    Intl,
    URLSearchParams,
    setTimeout,
    clearTimeout
  };
  const transactionalPath = path.resolve(
    __dirname,
    "../assets/js/services/direct-transfer-transactional-state.js"
  );
  const mobilePath = path.resolve(
    __dirname,
    "../assets/js/services/direct-transfer-mobile-config-step.js"
  );
  const mobileContactPath = path.resolve(
    __dirname,
    "../assets/js/services/direct-transfer-mobile-contact-step.js"
  );
  const checkoutPath = path.resolve(
    __dirname,
    "../assets/js/forms/direct-transfer-booking-api-checkout.js"
  );

  vm.runInNewContext(
    fs.readFileSync(transactionalPath, "utf8"),
    context,
    { filename: transactionalPath }
  );
  vm.runInNewContext(
    fs.readFileSync(mobilePath, "utf8"),
    context,
    { filename: mobilePath }
  );
  vm.runInNewContext(
    fs.readFileSync(mobileContactPath, "utf8"),
    context,
    { filename: mobileContactPath }
  );
  vm.runInNewContext(
    fs.readFileSync(checkoutPath, "utf8"),
    context,
    { filename: checkoutPath }
  );

  return {
    transactional: window.PixkuyDirectTransferTransactionalState,
    mobile: window.PixkuyDirectTransferMobileQuoteContract,
    mobileContact: window.PixkuyDirectTransferMobileContactContract,
    window,
    document,
    redirects,
    storage,
    context
  };
}

function createMobileUiNode(value) {
  const attributes = {};
  const listeners = {};
  let html = "";
  let text = "";
  const node = {
    value: value || "",
    dataset: {},
    hidden: false,
    disabled: false,
    querySelector: function querySelector() { return null; },
    addEventListener: function addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute: function setAttribute(name, nextValue) { attributes[name] = String(nextValue); },
    getAttribute: function getAttribute(name) { return attributes[name] || null; },
    removeAttribute: function removeAttribute(name) { delete attributes[name]; },
    matches: function matches(selector) {
      return selector === "[data-direct-transfer-mobile-config-field]" ||
        (selector === "[data-direct-transfer-mobile-address-input]" && Boolean(attributes["data-direct-transfer-mobile-address-role"]));
    },
    closest: function closest() { return null; },
    contains: function contains() { return false; },
    __listeners: listeners
  };

  Object.defineProperty(node, "innerHTML", {
    get: function getInnerHtml() { return html; },
    set: function setInnerHtml(nextValue) { html = String(nextValue); text = html.replace(/<[^>]*>/g, ""); }
  });
  Object.defineProperty(node, "textContent", {
    get: function getTextContent() { return text; },
    set: function setTextContent(nextValue) { text = String(nextValue); html = ""; }
  });

  return node;
}

async function runMobileUiConsumerSmoke() {
  const windowListeners = {};
  const origin = createMobileUiNode("Hotel NH Collection Mexico City Reforma");
  const destination = createMobileUiNode("Puerto Vallarta, Jalisco");
  const date = createMobileUiNode("2027-01-13");
  const time = createMobileUiNode("14:08");
  const passengers = createMobileUiNode("van_1_2");
  const fare = createMobileUiNode();
  const fareValue = createMobileUiNode();
  const cta = createMobileUiNode();
  const sameRoute = createMobileUiNode();
  const restrictionText = createMobileUiNode();
  const restrictionActions = createMobileUiNode();
  const restriction = createMobileUiNode();
  const estimateDistanceValue = createMobileUiNode();
  const estimateDurationValue = createMobileUiNode();
  const estimateDistance = createMobileUiNode();
  const estimateDuration = createMobileUiNode();
  const estimate = createMobileUiNode();
  const originClear = createMobileUiNode();
  const destinationClear = createMobileUiNode();
  const step = createMobileUiNode();
  const route = createMobileUiNode();
  const pendingFetches = [];
  const canonicalEvents = [];

  origin.setAttribute("data-direct-transfer-mobile-config-field", "origin");
  origin.setAttribute("data-direct-transfer-mobile-address-role", "origin");
  destination.setAttribute("data-direct-transfer-mobile-config-field", "destination");
  destination.setAttribute("data-direct-transfer-mobile-address-role", "destination");
  date.setAttribute("data-direct-transfer-mobile-config-field", "date");
  time.setAttribute("data-direct-transfer-mobile-config-field", "time");
  passengers.setAttribute("data-direct-transfer-mobile-config-field", "passengers");
  restriction.querySelector = function queryRestriction(selector) {
    return selector.includes("restriction-text") ? restrictionText : restrictionActions;
  };
  estimateDistance.querySelector = function queryDistance() { return estimateDistanceValue; };
  estimateDuration.querySelector = function queryDuration() { return estimateDurationValue; };
  const selectorMap = {
    '[data-direct-transfer-mobile-config-field="origin"]': origin,
    '[data-direct-transfer-mobile-config-field="destination"]': destination,
    '[data-direct-transfer-mobile-config-field="date"]': date,
    '[data-direct-transfer-mobile-config-field="time"]': time,
    '[data-direct-transfer-mobile-config-field="passengers"]': passengers,
    '[data-direct-transfer-mobile-address-input][data-direct-transfer-mobile-address-role="origin"]': origin,
    '[data-direct-transfer-mobile-address-input][data-direct-transfer-mobile-address-role="destination"]': destination,
    '[data-direct-transfer-mobile-address-clear="origin"]': originClear,
    '[data-direct-transfer-mobile-address-clear="destination"]': destinationClear,
    '[data-direct-transfer-mobile-same-route-error]': sameRoute,
    '[data-direct-transfer-mobile-restriction-notice]': restriction,
    '[data-direct-transfer-mobile-fare]': fare,
    '[data-direct-transfer-mobile-fare-value]': fareValue,
    '[data-direct-transfer-mobile-estimate]': estimate,
    '[data-direct-transfer-mobile-estimate-distance]': estimateDistance,
    '[data-direct-transfer-mobile-estimate-duration]': estimateDuration,
    '[data-direct-transfer-mobile-config-cta]': cta
  };
  step.querySelector = function queryStep(selector) { return selectorMap[selector] || null; };
  route.appendChild = function appendChild() { return true; };
  route.querySelector = function queryRoute() { return step; };

  class LocalCustomEvent {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  }
  class LocalEvent {
    constructor(type, init) { this.type = type; this.bubbles = Boolean(init && init.bubbles); }
  }
  const document = {
    documentElement: { lang: "es", dataset: {} },
    body: createMobileUiNode(),
    activeElement: null,
    createElement: function createElement() { return createMobileUiNode(); },
    querySelector: function querySelector(selector) {
      return selector === "[data-direct-transfer-mobile-config-step]" ? step : null;
    },
    addEventListener: function addEventListener() { return undefined; }
  };
  const window = {
    document,
    CustomEvent: LocalCustomEvent,
    Event: LocalEvent,
    Intl,
    location: { protocol: "file:", hostname: "", href: "file:///index.html", search: "" },
    matchMedia: function matchMedia() { return { matches: true }; },
    addEventListener: function addEventListener(type, listener) {
      windowListeners[type] = windowListeners[type] || [];
      windowListeners[type].push(listener);
    },
    dispatchEvent: function dispatchEvent(event) {
      (windowListeners[event.type] || []).forEach(function notify(listener) { listener(event); });
      return true;
    },
    setTimeout: function setTimeoutImmediately(callback) { return setTimeout(callback, 0); },
    clearTimeout,
    sessionStorage: { getItem: function getItem() { return null; }, removeItem: function removeItem() {} },
    PixkuyDirectTransferAirportGuard: {
      getCataloguedAirportTransferId: function getCataloguedAirportTransferId() { return ""; },
      isCataloguedAirportTransferPlace: function isCataloguedAirportTransferPlace() { return false; }
    },
    PixkuyDirectTransferCoverage: {
      resolveCoverageFromPoint: function resolveCoverageFromPoint() { return Promise.resolve({ isWithinCoverage: true }); }
    },
    PixkuyDirectTransferQuote: {
      requestQuote: function requestQuote() {
        return Promise.resolve({
          ok: true,
          quote: {
            price: 16600,
            currency: "MXN",
            pricingVersion: "direct_transfer_v2",
            distanceMeters: 839000,
            durationSeconds: 48360
          }
        });
      }
    },
    PIXKUY_BOOKING_API_CONFIG: { apiBaseUrl: "", publicSiteKey: "offline-smoke" },
    fetch: function fetch() {
      return new Promise(function waitForFixture(resolve) { pendingFetches.push(resolve); });
    }
  };
  const context = { window, document, CustomEvent: LocalCustomEvent, Event: LocalEvent, Date, Intl, setTimeout, clearTimeout };
  [
    "../assets/js/i18n/catalog.js",
    "../assets/js/services/shared-availability-suggestion.js",
    "../assets/js/services/direct-transfer-transactional-state.js",
    "../assets/js/forms/direct-transfer-booking-api-checkout.js",
    "../assets/js/services/direct-transfer-mobile-config-step.js"
  ].forEach(function loadModule(relativePath) {
    const absolutePath = path.resolve(__dirname, relativePath);
    vm.runInNewContext(fs.readFileSync(absolutePath, "utf8"), context, { filename: absolutePath });
  });
  window.addEventListener("pixkuy:direct-transfer-canonical-price", function capture(event) { canonicalEvents.push(event.detail); });

  function flush() {
    return new Promise(function flushTurn(resolve) { setTimeout(resolve, 0); });
  }
  async function waitForFetchCount(count) {
    for (let index = 0; index < 20 && pendingFetches.length < count; index += 1) { await flush(); }
  }
  function resolvePrecheck(index, body, ok) {
    pendingFetches[index]({ ok: ok !== false, status: ok === false ? 409 : 200, json: function json() { return Promise.resolve(body); } });
  }
  function dispatchPlace(role, selectedPlace) {
    step.__listeners["pixkuy:direct-transfer-mobile-address-place"]({ detail: { role, selectedPlace } });
  }

  window.PixkuyDirectTransferMobileConfigStep.open(route);
  dispatchPlace("origin", { label: origin.value, placeId: "fixture_reforma", lat: 19.4269, lng: -99.1677 });
  await flush();
  dispatchPlace("destination", { label: destination.value, placeId: "fixture_puerto_vallarta", lat: 20.6534, lng: -105.2253 });
  await waitForFetchCount(1);
  const loadingOnSuccess = fareValue.textContent;
  resolvePrecheck(0, { result: { checkoutAllowed: true, code: "VEHICLE_AVAILABLE", price: {
    amountMinor: 1660000,
    currency: "MXN",
    pricingVersion: "direct_transfer_v2_booking_authority_v1",
    quoteFingerprint: "a".repeat(64),
    quoteExpiresAt: "2027-01-13T16:44:00.000Z",
    distanceMeters: 839000,
    durationSeconds: 48360
  } } }, true);
  await flush();
  await flush();
  const success = { fareState: fare.getAttribute("data-direct-transfer-mobile-fare-state"), markup: fareValue.innerHTML, ctaDisabled: cta.disabled, detail: canonicalEvents[0] };

  async function requestUnavailableScenario(input) {
    date.value = input.date;
    time.value = input.time;
    step.__listeners.change({ target: date });
    await waitForFetchCount(input.fetchIndex + 1);
    const ctaDisabledDuringPrecheck = cta.disabled;
    resolvePrecheck(input.fetchIndex, { result: {
      checkoutAllowed: false,
      date: input.date,
      locale: "es",
      availability: {
        available: false,
        code: input.code,
        nextAvailableStartLocal: "2027-01-15T15:30"
      }
    } }, false);
    await flush();
    await flush();

    return {
      date: input.date,
      time: input.time,
      ctaDisabledDuringPrecheck,
      ctaDisabled: cta.disabled,
      fareState: fare.getAttribute("data-direct-transfer-mobile-fare-state"),
      fareText: fareValue.textContent,
      detail: canonicalEvents[canonicalEvents.length - 1]
    };
  }

  const availabilityMatrix = [];
  availabilityMatrix.push(await requestUnavailableScenario({
    date: "2027-01-13",
    time: "14:48",
    code: "VEHICLE_NOT_AVAILABLE",
    fetchIndex: 1
  }));
  availabilityMatrix.push(await requestUnavailableScenario({
    date: "2027-01-14",
    time: "14:48",
    code: "VEHICLE_NOT_AVAILABLE",
    fetchIndex: 2
  }));
  availabilityMatrix.push(await requestUnavailableScenario({
    date: "2027-01-15",
    time: "14:48",
    code: "PREVIOUS_TRANSITION_NOT_FEASIBLE",
    fetchIndex: 3
  }));
  const errorState = availabilityMatrix[0].fareState;

  date.value = "2026-01-15";
  time.value = "14:08";
  step.__listeners.change({ target: date });
  const pastDate = {
    fareState: fare.getAttribute("data-direct-transfer-mobile-fare-state"),
    fareText: fareValue.textContent,
    ctaDisabled: cta.disabled,
    fetchCount: pendingFetches.length,
    canonicalEventCount: canonicalEvents.length
  };

  const minimumBoundary = window.PixkuyDirectTransferTransactionalState
    .getDirectTransferMinimumLeadTimeBoundary();
  const insideLeadTime = new Date(Date.parse(minimumBoundary + ":00Z") - 60000);
  date.value = [
    insideLeadTime.getUTCFullYear(),
    String(insideLeadTime.getUTCMonth() + 1).padStart(2, "0"),
    String(insideLeadTime.getUTCDate()).padStart(2, "0")
  ].join("-");
  time.value = [
    String(insideLeadTime.getUTCHours()).padStart(2, "0"),
    String(insideLeadTime.getUTCMinutes()).padStart(2, "0")
  ].join(":");
  step.__listeners.change({ target: time });
  const leadTime = {
    fareState: fare.getAttribute("data-direct-transfer-mobile-fare-state"),
    fareText: fareValue.textContent,
    ctaDisabled: cta.disabled,
    fetchCount: pendingFetches.length,
    canonicalEventCount: canonicalEvents.length
  };

  date.value = "2027-01-15";
  time.value = "15:30";
  step.__listeners.change({ target: date });
  await waitForFetchCount(5);
  const requoteLoading = {
    fareState: fare.getAttribute("data-direct-transfer-mobile-fare-state"),
    ctaDisabled: cta.disabled,
    fetchCount: pendingFetches.length
  };
  resolvePrecheck(4, { result: { checkoutAllowed: true, code: "VEHICLE_AVAILABLE", price: {
    amountMinor: 1660000,
    currency: "MXN",
    pricingVersion: "direct_transfer_v2_booking_authority_v1",
    quoteFingerprint: "b".repeat(64),
    quoteExpiresAt: "2027-01-13T16:49:00.000Z",
    distanceMeters: 839000,
    durationSeconds: 48360
  } } }, true);
  await flush();
  await flush();
  const requoteSuccess = {
    fareState: fare.getAttribute("data-direct-transfer-mobile-fare-state"),
    ctaDisabled: cta.disabled,
    detail: canonicalEvents[4]
  };

  time.value = "15:31";
  step.__listeners.change({ target: time });
  await waitForFetchCount(6);
  window.PixkuyDirectTransferMobileConfigStep.close();
  const cancelStateBeforeResponse = fare.getAttribute("data-direct-transfer-mobile-fare-state");
  resolvePrecheck(5, { result: { checkoutAllowed: true, code: "VEHICLE_AVAILABLE", price: {
    amountMinor: 1660000,
    currency: "MXN",
    pricingVersion: "direct_transfer_v2_booking_authority_v1",
    quoteFingerprint: "c".repeat(64),
    quoteExpiresAt: "2027-01-13T16:54:00.000Z"
  } } }, true);
  await flush();
  await flush();

  return {
    loadingOnSuccess,
    success,
    errorState,
    errorDetail: availabilityMatrix[0].detail,
    availabilityMatrix,
    pastDate,
    leadTime,
    requoteLoading,
    requoteSuccess,
    cancelStateBeforeResponse,
    cancelStateAfterResponse: fare.getAttribute("data-direct-transfer-mobile-fare-state")
  };
}

function buildOfflinePrecheckSnapshot() {
  return {
    service_type: "direct_transfer",
    direct_transfer_origin_address: "Hotel NH Collection Mexico City Reforma",
    direct_transfer_origin_place_id: "fixture_nh_reforma",
    direct_transfer_origin_lat: "19.4269",
    direct_transfer_origin_lng: "-99.1677",
    direct_transfer_origin_country_code: "MX",
    direct_transfer_destination_address: "Puerto Vallarta, Jalisco",
    direct_transfer_destination_place_id: "fixture_puerto_vallarta",
    direct_transfer_destination_lat: "20.6534",
    direct_transfer_destination_lng: "-105.2253",
    direct_transfer_destination_country_code: "MX",
    direct_transfer_date: "2027-01-13",
    direct_transfer_time: "08:29",
    direct_transfer_passenger_fare_key: "van_1_2",
    direct_transfer_passengers: "2",
    direct_transfer_price: "16600",
    direct_transfer_currency: "MXN",
    direct_transfer_pricing_version: "direct_transfer_v2",
    direct_transfer_quote_fingerprint: "",
    direct_transfer_quote_expires_at: "",
    locale: "es"
  };
}

async function runOfflineStateSmoke() {
  const failures = [];
  const availabilityFormatterContext = { window: {}, Date, Intl };
  const availabilityFormatterPath = path.resolve(
    __dirname,
    "../assets/js/i18n/catalog.js"
  );

  vm.runInNewContext(
    fs.readFileSync(availabilityFormatterPath, "utf8"),
    availabilityFormatterContext,
    { filename: availabilityFormatterPath }
  );

  const formatNextAvailabilityLabel =
    availabilityFormatterContext.window.__pixkuyI18nModules
      .formatNextAvailabilityLabel;
  const localizedLaterAvailability = {
    es: "15/01/2027 a las 15:30",
    en: "01/15/2027 at 15:30",
    ru: "15.01.2027 в 15:30",
    fr: "15/01/2027 à 15:30",
    pt: "15/01/2027 às 15:30",
    it: "15/01/2027 alle 15:30",
    de: "15.01.2027 um 15:30",
    ko: "2027. 01. 15. 15:30",
    "zh-hans": "2027/01/15 15:30"
  };

  assertEqual(
    failures,
    "same-day next availability keeps time only",
    formatNextAvailabilityLabel({
      requestedLocalDate: "2027-01-13T13:29",
      nextAvailableStartLocal: "2027-01-13T15:30",
      locale: "es"
    }),
    "15:30"
  );
  assertEqual(
    failures,
    "next-day availability includes localized date and time",
    formatNextAvailabilityLabel({
      requestedLocalDate: "2027-01-13T13:29",
      nextAvailableStartLocal: "2027-01-14T15:30",
      locale: "es"
    }),
    "14/01/2027 a las 15:30"
  );
  assertEqual(
    failures,
    "month boundary preserves local calendar date",
    formatNextAvailabilityLabel({
      requestedLocalDate: "2027-01-31T23:00",
      nextAvailableStartLocal: "2027-02-01T02:00",
      locale: "es"
    }),
    "01/02/2027 a las 02:00"
  );
  assertEqual(
    failures,
    "year boundary preserves local calendar date",
    formatNextAvailabilityLabel({
      requestedLocalDate: "2027-12-31T23:00",
      nextAvailableStartLocal: "2028-01-01T02:00",
      locale: "es"
    }),
    "01/01/2028 a las 02:00"
  );
  Object.keys(localizedLaterAvailability).forEach(
    function validateNextAvailabilityLocale(locale) {
      assertEqual(
        failures,
        `localized next availability ${locale}`,
        formatNextAvailabilityLabel({
          requestedLocalDate: "2027-01-13T13:29",
          nextAvailableStartLocal: "2027-01-15T15:30",
          locale: locale
        }),
        localizedLaterAvailability[locale]
      );
    }
  );
  const availabilityFormatterSource = fs.readFileSync(
    availabilityFormatterPath,
    "utf8"
  );
  assertEqual(
    failures,
    "local next availability never parses the timestamp in browser timezone",
    availabilityFormatterSource.includes("new Date(nextValue)"),
    false
  );
  assertEqual(
    failures,
    "localized date formatter pins synthetic date to UTC",
    availabilityFormatterSource.includes('timeZone: "UTC"'),
    true
  );
  // PRODUCTION_MANUAL_ORACLE_2026-08-30=16600_MXN
  const productionManualOracleMxn = 16600;
  const productionManualOracleMinor = 1660000;
  const contracts = loadLandingQuoteContracts();
  const transactional = contracts.transactional;
  const mobile = contracts.mobile;
  const mobileContact = contracts.mobileContact;
  const provisionalQuote = {
    price: productionManualOracleMxn,
    amountMinor: null,
    currency: "MXN",
    pricingVersion: "",
    provisionalPricingVersion: "direct_transfer_v2",
    quoteFingerprint: "",
    quoteExpiresAt: ""
  };
  const snapshot = buildOfflinePrecheckSnapshot();
  const compareProvisional = transactional.hasCanonicalQuoteBinding(provisionalQuote);
  const initialPayload = transactional.buildPrecheckPayload(snapshot, {
    compareCanonicalQuote: compareProvisional
  });
  const canonicalPrice = {
    available: true,
    amountMinor: productionManualOracleMinor,
    currency: "MXN",
    pricingVersion: "direct_transfer_v2_booking_authority_v1",
    quoteFingerprint: "a".repeat(64),
    quoteExpiresAt: "2027-01-13T16:44:00.000Z",
    durationSeconds: 48360,
    distanceMeters: 839000
  };
  const mobileUi = await runMobileUiConsumerSmoke();

  assertEqual(failures, "real mobile UI shows loading during canonical precheck", mobileUi.loadingOnSuccess, "Calculando precio…");
  assertEqual(failures, "real mobile UI exits loading on success", mobileUi.success.fareState, "ready");
  assertEqual(failures, "real mobile UI paints 16,600 MXN", /16[.,]600/.test(mobileUi.success.markup), true);
  assertEqual(failures, "real mobile UI enables CTA after canonical precheck", mobileUi.success.ctaDisabled, false);
  assertEqual(failures, "real mobile UI preserves canonical amount minor", mobileUi.success.detail.amountMinor, productionManualOracleMinor);
  assertEqual(failures, "real mobile UI preserves canonical pricing version", mobileUi.success.detail.pricingVersion, canonicalPrice.pricingVersion);
  assertEqual(failures, "real mobile UI preserves canonical fingerprint", mobileUi.success.detail.quoteFingerprint, canonicalPrice.quoteFingerprint);
  assertEqual(failures, "real mobile UI preserves canonical expiry", mobileUi.success.detail.quoteExpiresAt, canonicalPrice.quoteExpiresAt);
  assertEqual(failures, "real mobile UI exits loading on error", mobileUi.errorState, "error");
  assertEqual(
    failures,
    "real Direct mobile consumer shows later local date and time",
    mobileUi.errorDetail && mobileUi.errorDetail.availabilityMessage,
    "No pudimos confirmar disponibilidad para este traslado. Siguiente hora disponible: 15/01/2027 a las 15:30"
  );
  assertEqual(failures, "real mobile availability matrix has A B and C", mobileUi.availabilityMatrix.length, 3);
  mobileUi.availabilityMatrix.forEach(function assertUnavailableMobileScenario(scenario) {
    const label = scenario.date + " " + scenario.time;
    const expectedAvailabilityMessage = scenario.date === "2027-01-15"
      ? "No pudimos confirmar disponibilidad para este traslado. Siguiente hora disponible: 15:30"
      : "No pudimos confirmar disponibilidad para este traslado. Siguiente hora disponible: 15/01/2027 a las 15:30";
    assertEqual(failures, label + " disables CTA during precheck", scenario.ctaDisabledDuringPrecheck, true);
    assertEqual(failures, label + " exits as unavailable", scenario.fareState, "error");
    assertEqual(failures, label + " keeps CTA disabled", scenario.ctaDisabled, true);
    assertEqual(failures, label + " renders no canonical price", /16[.,]600/.test(scenario.fareText), false);
    assertEqual(
      failures,
      label + " preserves localized next availability",
      scenario.detail && scenario.detail.availabilityMessage,
      expectedAvailabilityMessage
    );
  });
  assertEqual(failures, "past date leaves real mobile UI in error", mobileUi.pastDate.fareState, "error");
  assertEqual(failures, "past date disables real mobile CTA", mobileUi.pastDate.ctaDisabled, true);
  assertEqual(failures, "past date does not request a new quote", mobileUi.pastDate.fetchCount, 4);
  assertEqual(failures, "past date does not reuse canonical precheck", mobileUi.pastDate.canonicalEventCount, 4);
  assertEqual(
    failures,
    "past date uses the approved minimum lead-time message",
    mobileUi.pastDate.fareText,
    "Necesitamos al menos 24 horas de antelación para confirmar este servicio."
  );
  assertEqual(failures, "past date clears the prior canonical price", /16[.,]600/.test(mobileUi.pastDate.fareText), false);
  assertEqual(failures, "inside lead time leaves real mobile UI in error", mobileUi.leadTime.fareState, "error");
  assertEqual(failures, "inside lead time disables real mobile CTA", mobileUi.leadTime.ctaDisabled, true);
  assertEqual(failures, "inside lead time does not request a new quote", mobileUi.leadTime.fetchCount, 4);
  assertEqual(failures, "inside lead time does not reuse canonical precheck", mobileUi.leadTime.canonicalEventCount, 4);
  assertEqual(
    failures,
    "inside lead time keeps desktop message parity",
    mobileUi.leadTime.fareText,
    "Necesitamos al menos 24 horas de antelación para confirmar este servicio."
  );
  assertEqual(failures, "valid date requires a fresh quote", mobileUi.requoteLoading.fareState, "loading");
  assertEqual(failures, "valid date keeps CTA disabled during fresh precheck", mobileUi.requoteLoading.ctaDisabled, true);
  assertEqual(failures, "valid date performs one fresh precheck", mobileUi.requoteLoading.fetchCount, 5);
  assertEqual(failures, "fresh valid quote returns real mobile UI to ready", mobileUi.requoteSuccess.fareState, "ready");
  assertEqual(failures, "fresh valid precheck re-enables real mobile CTA", mobileUi.requoteSuccess.ctaDisabled, false);
  assertEqual(failures, "fresh valid quote gets a new fingerprint", mobileUi.requoteSuccess.detail.quoteFingerprint, "b".repeat(64));
  assertEqual(failures, "fresh valid quote preserves canonical minor units", mobileUi.requoteSuccess.detail.amountMinor, productionManualOracleMinor);
  assertEqual(failures, "fresh valid quote preserves canonical pricing version", mobileUi.requoteSuccess.detail.pricingVersion, canonicalPrice.pricingVersion);
  assertEqual(failures, "real mobile UI cancellation exits loading", mobileUi.cancelStateBeforeResponse, "pending");
  assertEqual(failures, "cancelled canonical response stays obsolete", mobileUi.cancelStateAfterResponse, "pending");

  assertEqual(failures, "provisional quote is not canonical", compareProvisional, false);
  assertEqual(
    failures,
    "initial precheck omits provisional amount",
    Object.prototype.hasOwnProperty.call(initialPayload, "expectedAmountMinor"),
    false
  );
  assertEqual(
    failures,
    "initial precheck omits provisional pricing version",
    Object.prototype.hasOwnProperty.call(initialPayload, "pricingVersion"),
    false
  );
  assertEqual(
    failures,
    "desktop snapshot accepts canonical quote",
    transactional.applyCanonicalQuote(snapshot, canonicalPrice, ""),
    true
  );
  assertEqual(
    failures,
    "desktop canonical price matches production manual oracle",
    snapshot.direct_transfer_price,
    String(productionManualOracleMxn)
  );
  assertEqual(
    failures,
    "desktop initial canonical price matches Landing provisional oracle",
    snapshot.direct_transfer_price,
    String(provisionalQuote.price)
  );

  const canonicalPayload = transactional.buildPrecheckPayload(snapshot);
  assertEqual(
    failures,
    "canonical payload uses canonical minor units",
    canonicalPayload.expectedAmountMinor,
    productionManualOracleMinor
  );
  assertEqual(
    failures,
    "canonical payload uses canonical fingerprint",
    canonicalPayload.quoteFingerprint,
    canonicalPrice.quoteFingerprint
  );

  const provisionalMobileState = {
    quoteStatus: "loading",
    quoteState: "provisional",
    quote: provisionalQuote,
    quoteErrorCode: "",
    quoteErrorMessage: "",
    precheckAllowed: false,
    quoteReviewRequired: false
  };
  const initialCanonicalDetail = {
    checkoutAllowed: true,
    code: "VEHICLE_AVAILABLE",
    availabilityMessage: "",
    price: productionManualOracleMxn,
    amountMinor: productionManualOracleMinor,
    currency: "MXN",
    pricingVersion: canonicalPrice.pricingVersion,
    quoteFingerprint: canonicalPrice.quoteFingerprint,
    quoteExpiresAt: canonicalPrice.quoteExpiresAt,
    durationSeconds: canonicalPrice.durationSeconds,
    distanceMeters: canonicalPrice.distanceMeters,
    quoteAcceptedAt: ""
  };
  const initialMobileReady = mobile.applyCanonicalPriceState(
    provisionalMobileState,
    initialCanonicalDetail
  );

  assertEqual(
    failures,
    "mobile initial canonical quote can continue",
    mobile.canContinueCanonicalPriceState(initialMobileReady),
    true
  );
  assertEqual(
    failures,
    "mobile displays production manual oracle",
    initialMobileReady.quote.price,
    productionManualOracleMxn
  );
  assertEqual(failures, "mobile initial quote has no requote message", initialMobileReady.quoteErrorMessage, "");

  const changedCanonicalDetail = {
    checkoutAllowed: false,
    code: "DIRECT_TRANSFER_PRICE_MISMATCH",
    availabilityMessage: "El precio cambió. Revísalo y continúa de nuevo para aceptarlo.",
    price: 16700,
    amountMinor: 1670000,
    currency: "MXN",
    pricingVersion: canonicalPrice.pricingVersion,
    quoteFingerprint: "b".repeat(64),
    quoteExpiresAt: "2027-01-13T16:49:00.000Z",
    durationSeconds: canonicalPrice.durationSeconds,
    distanceMeters: canonicalPrice.distanceMeters,
    quoteAcceptedAt: ""
  };
  const changedCanonical = mobile.applyCanonicalPriceState(
    initialMobileReady,
    changedCanonicalDetail
  );

  assertEqual(
    failures,
    "real canonical change blocks continue",
    mobile.canContinueCanonicalPriceState(changedCanonical),
    false
  );
  assertEqual(
    failures,
    "real canonical change permits reacceptance",
    mobile.canReacceptCanonicalPriceState(changedCanonical),
    true
  );
  assertEqual(failures, "requote retains new canonical price", changedCanonical.quote.price, 16700);
  assertEqual(
    failures,
    "requote never restores previous canonical price",
    changedCanonical.quote.price === provisionalQuote.price,
    false
  );

  const reacceptedCanonical = mobile.applyCanonicalPriceState(
    changedCanonical,
    Object.assign({}, changedCanonicalDetail, {
      checkoutAllowed: true,
      code: "VEHICLE_AVAILABLE",
      availabilityMessage: ""
    })
  );
  assertEqual(
    failures,
    "reaccepted canonical quote can continue",
    mobile.canContinueCanonicalPriceState(reacceptedCanonical),
    true
  );
  assertEqual(failures, "reaccept updates amount", reacceptedCanonical.quote.amountMinor, 1670000);
  assertEqual(
    failures,
    "reaccept updates pricing version",
    reacceptedCanonical.quote.pricingVersion,
    changedCanonicalDetail.pricingVersion
  );
  assertEqual(
    failures,
    "reaccept updates fingerprint",
    reacceptedCanonical.quote.quoteFingerprint,
    changedCanonicalDetail.quoteFingerprint
  );

  const invalidated = mobile.resetCanonicalPriceState(initialMobileReady);
  assertEqual(failures, "input change invalidates canonical quote", invalidated.quote, null);
  assertEqual(
    failures,
    "input change blocks continue",
    mobile.canContinueCanonicalPriceState(invalidated),
    false
  );

  const rejected = mobile.applyCanonicalPriceState(provisionalMobileState, {
    checkoutAllowed: false,
    code: "DIRECT_TRANSFER_VEHICLE_UNAVAILABLE",
    availabilityMessage: "No hay disponibilidad para esa fecha y hora."
  });
  assertEqual(failures, "rejected precheck exits loading", rejected.quoteStatus, "error");
  assertEqual(
    failures,
    "rejected precheck keeps specific error",
    rejected.quoteErrorMessage,
    "No hay disponibilidad para esa fecha y hora."
  );

  const boundaryNow = new Date("2026-08-30T12:00:00.000Z");
  assertEqual(
    failures,
    "under 24 hours remains blocked",
    transactional.validateDirectTransferMinimumLeadTime("2026-08-31", "05:59", boundaryNow).valid,
    false
  );
  assertEqual(
    failures,
    "exact 24-hour boundary remains allowed",
    transactional.validateDirectTransferMinimumLeadTime("2026-08-31", "06:00", boundaryNow).valid,
    true
  );

  const mobileContactPayload = {
    originAddress: {
      label: "Hotel NH Collection Mexico City Reforma",
      placeId: "fixture_nh_reforma",
      lat: 19.4269,
      lng: -99.1677
    },
    destinationAddress: {
      label: "Puerto Vallarta, Jalisco",
      placeId: "fixture_puerto_vallarta",
      lat: 20.6534,
      lng: -105.2253
    },
    date: "2027-01-13",
    time: "08:29",
    passengerFareKey: "van_1_2",
    passengerBucketLabel: "1–2",
    priceLabel: "$16,600 MXN",
    vehicleLabel: "BYD M9",
    quote: {
      price: productionManualOracleMxn,
      amountMinor: productionManualOracleMinor,
      currency: "MXN",
      durationSeconds: canonicalPrice.durationSeconds,
      distanceMeters: canonicalPrice.distanceMeters,
      pricingVersion: canonicalPrice.pricingVersion,
      quoteFingerprint: canonicalPrice.quoteFingerprint,
      quoteExpiresAt: canonicalPrice.quoteExpiresAt,
      quoteAcceptedAt: ""
    }
  };
  const mobileContactSnapshot = mobileContact.buildSnapshotFromPayload(mobileContactPayload);

  assertEqual(failures, "mobile contact preserves canonical amount minor", mobileContactSnapshot.direct_transfer_amount_minor, String(productionManualOracleMinor));
  assertEqual(failures, "mobile contact preserves numeric origin latitude", mobileContactSnapshot.direct_transfer_origin_lat, "19.4269");
  assertEqual(failures, "mobile contact preserves numeric origin longitude", mobileContactSnapshot.direct_transfer_origin_lng, "-99.1677");
  assertEqual(failures, "mobile contact preserves numeric destination latitude", mobileContactSnapshot.direct_transfer_destination_lat, "20.6534");
  assertEqual(failures, "mobile contact preserves numeric destination longitude", mobileContactSnapshot.direct_transfer_destination_lng, "-105.2253");
  assertEqual(failures, "mobile contact preserves pricing version", mobileContactSnapshot.direct_transfer_pricing_version, canonicalPrice.pricingVersion);
  assertEqual(failures, "mobile contact preserves quote fingerprint", mobileContactSnapshot.direct_transfer_quote_fingerprint, canonicalPrice.quoteFingerprint);
  assertEqual(failures, "mobile contact preserves quote expiry", mobileContactSnapshot.direct_transfer_quote_expires_at, canonicalPrice.quoteExpiresAt);
  assertEqual(failures, "valid canonical mobile contact snapshot can continue", mobileContact.hasCompleteDirectTransferSnapshot(mobileContactSnapshot), true);

  const integratedFields = {};
  const integratedAttributes = {};
  let dispatchedSubmit = null;
  const integratedForm = {
    nodeType: 1,
    __pixkuyFields: integratedFields,
    matches: function matches(selector) {
      return selector === 'form[name="contact"]';
    },
    querySelector: function querySelector(selector) {
      const prefix = '[name="';
      const suffix = '"]';

      if (!selector.startsWith(prefix) || !selector.endsWith(suffix)) {
        return null;
      }

      const name = selector.slice(prefix.length, -suffix.length);

      if (!integratedFields[name] && name !== "direct_transfer_amount_minor") {
        integratedFields[name] = contracts.document.createElement("input");
        integratedFields[name].name = name;
      }

      return integratedFields[name] || null;
    },
    appendChild: function appendChild(field) {
      integratedFields[field.name] = field;
      return field;
    },
    querySelectorAll: function querySelectorAll() {
      return [];
    },
    setAttribute: function setAttribute(name, value) {
      integratedAttributes[name] = String(value);
    },
    getAttribute: function getAttribute(name) {
      return integratedAttributes[name] || null;
    },
    removeAttribute: function removeAttribute(name) {
      delete integratedAttributes[name];
    },
    dispatchEvent: function dispatchEvent(event) {
      dispatchedSubmit = event;
      event.target = integratedForm;

      if (integratedForm.__dispatchToDocument) {
        contracts.document.dispatchEvent(event);
      }

      return true;
    }
  };
  const integratedFormError = { hidden: true, textContent: "" };
  contracts.window.PixkuyForms = {
    getReservationForm: function getReservationForm() {
      return integratedForm;
    },
    getReservationRequestFields: function getReservationRequestFields() {
      return { formError: integratedFormError };
    },
    getReservationRequestData: function getReservationRequestData() {
      return { serviceType: "direct_transfer" };
    },
    syncReservationRequestState: function syncReservationRequestState() {
      return true;
    }
  };

  assertEqual(
    failures,
    "real mobile contact handoff fills the reservation form",
    mobileContact.fillReservationForm(
      mobileContactSnapshot,
      {
        name: "Ana Pérez",
        phone: "+525512345678",
        email: "ana@example.com",
        notes: ""
      },
      { skipLegacyValidation: true }
    ),
    true
  );

  Object.assign(integratedFields, {
    legal_acceptance_accepted: { name: "legal_acceptance_accepted", value: "true" },
    legal_acceptance_terms_version: { name: "legal_acceptance_terms_version", value: "2026-08-01" },
    legal_acceptance_cancellation_policy_version: { name: "legal_acceptance_cancellation_policy_version", value: "2026-08-01" },
    legal_acceptance_privacy_version: { name: "legal_acceptance_privacy_version", value: "2026-08-01" },
    legal_acceptance_accepted_at: { name: "legal_acceptance_accepted_at", value: "2027-01-12T12:00:00.000Z" },
    legal_acceptance_channel: { name: "legal_acceptance_channel", value: "web_direct_transfer_mobile_checkout" }
  });

  const integratedSnapshot = transactional.buildSnapshot(integratedForm, {});
  const integratedPrecheckPayload = transactional.buildPrecheckPayload(integratedSnapshot);

  assertEqual(failures, "integrated handoff snapshot keeps canonical amount minor", integratedSnapshot.direct_transfer_amount_minor, String(productionManualOracleMinor));
  assertEqual(failures, "integrated precheck amount matches canonical binding", integratedPrecheckPayload.expectedAmountMinor, productionManualOracleMinor);
  assertEqual(failures, "integrated precheck pricing version matches canonical binding", integratedPrecheckPayload.pricingVersion, canonicalPrice.pricingVersion);
  assertEqual(failures, "integrated precheck fingerprint matches canonical binding", integratedPrecheckPayload.quoteFingerprint, canonicalPrice.quoteFingerprint);
  assertEqual(failures, "integrated precheck expiry matches canonical binding", integratedPrecheckPayload.quoteExpiresAt, canonicalPrice.quoteExpiresAt);
  assertEqual(failures, "integrated precheck origin place ID matches handoff", integratedPrecheckPayload.originAddress.placeId, mobileContactPayload.originAddress.placeId);
  assertEqual(failures, "integrated precheck destination place ID matches handoff", integratedPrecheckPayload.destinationAddress.placeId, mobileContactPayload.destinationAddress.placeId);
  assertEqual(failures, "integrated precheck service date matches handoff", integratedPrecheckPayload.pickupDate, mobileContactPayload.date);
  assertEqual(failures, "integrated precheck service time matches handoff", integratedPrecheckPayload.pickupTime, mobileContactPayload.time);
  assertEqual(failures, "integrated precheck passenger bucket matches handoff", integratedPrecheckPayload.passengerFareKey, mobileContactPayload.passengerFareKey);

  const desktopCompatibleSnapshot = Object.assign({}, integratedSnapshot);
  delete desktopCompatibleSnapshot.direct_transfer_amount_minor;
  assertEqual(
    failures,
    "legacy desktop snapshot keeps existing major-to-minor fallback",
    transactional.buildPrecheckPayload(desktopCompatibleSnapshot).expectedAmountMinor,
    productionManualOracleMinor
  );

  const initialAcceptedAt = "2027-01-12T12:01:00.000Z";
  assertEqual(
    failures,
    "initial canonical precheck updates the full binding atomically",
    transactional.applyCanonicalQuote(integratedSnapshot, canonicalPrice, initialAcceptedAt),
    true
  );
  const integratedCheckoutPayload = transactional.buildCheckoutPayload(integratedSnapshot);
  assertEqual(failures, "integrated checkout receives canonical amount minor", integratedCheckoutPayload.direct_transfer_price, productionManualOracleMinor);
  assertEqual(failures, "integrated checkout receives canonical pricing version", integratedCheckoutPayload.direct_transfer_pricing_version, canonicalPrice.pricingVersion);
  assertEqual(failures, "integrated checkout receives canonical fingerprint", integratedCheckoutPayload.direct_transfer_quote_fingerprint, canonicalPrice.quoteFingerprint);
  assertEqual(failures, "integrated checkout receives canonical expiry", integratedCheckoutPayload.direct_transfer_quote_expires_at, canonicalPrice.quoteExpiresAt);
  assertEqual(failures, "integrated checkout receives accepted binding timestamp", integratedCheckoutPayload.direct_transfer_quote_accepted_at, initialAcceptedAt);

  const changedBinding = {
    amountMinor: 1670000,
    pricingVersion: "direct_transfer_v3_fixture",
    quoteFingerprint: "b".repeat(64),
    quoteExpiresAt: "2027-01-13T17:00:00.000Z",
    durationSeconds: canonicalPrice.durationSeconds,
    distanceMeters: canonicalPrice.distanceMeters
  };
  assertEqual(failures, "real requote invalidates prior acceptance", transactional.applyCanonicalQuote(integratedSnapshot, changedBinding, ""), true);
  assertEqual(failures, "unaccepted real requote cannot build checkout payload", transactional.buildCheckoutPayload(integratedSnapshot), null);
  assertEqual(failures, "real requote can be accepted", transactional.applyCanonicalQuote(integratedSnapshot, changedBinding, "2027-01-12T12:02:00.000Z"), true);
  const changedCheckoutPayload = transactional.buildCheckoutPayload(integratedSnapshot);
  assertEqual(failures, "accepted requote checkout uses new amount", changedCheckoutPayload.direct_transfer_price, changedBinding.amountMinor);
  assertEqual(failures, "accepted requote checkout uses new version", changedCheckoutPayload.direct_transfer_pricing_version, changedBinding.pricingVersion);
  assertEqual(failures, "accepted requote checkout uses new fingerprint", changedCheckoutPayload.direct_transfer_quote_fingerprint, changedBinding.quoteFingerprint);
  assertEqual(failures, "accepted requote checkout uses new expiry", changedCheckoutPayload.direct_transfer_quote_expires_at, changedBinding.quoteExpiresAt);

  const tamperedAmountPayload = transactional.buildPrecheckPayload(Object.assign({}, integratedSnapshot, {
    direct_transfer_amount_minor: "1660001"
  }));
  const tamperedVersionPayload = transactional.buildPrecheckPayload(Object.assign({}, integratedSnapshot, {
    direct_transfer_pricing_version: "tampered_version"
  }));
  const tamperedFingerprintPayload = transactional.buildPrecheckPayload(Object.assign({}, integratedSnapshot, {
    direct_transfer_quote_fingerprint: "c".repeat(64)
  }));
  const tamperedRoutePayload = transactional.buildPrecheckPayload(Object.assign({}, integratedSnapshot, {
    direct_transfer_destination_lat: "20.7"
  }));
  assertEqual(failures, "tampered amount remains visible to canonical mismatch validation", tamperedAmountPayload.expectedAmountMinor, 1660001);
  assertEqual(failures, "tampered version remains visible to canonical mismatch validation", tamperedVersionPayload.pricingVersion, "tampered_version");
  assertEqual(failures, "tampered fingerprint remains visible to canonical mismatch validation", tamperedFingerprintPayload.quoteFingerprint, "c".repeat(64));
  assertEqual(failures, "tampered route remains visible to canonical fingerprint validation", tamperedRoutePayload.destinationAddress.lat, 20.7);

  const validContact = mobileContact.getContactValidity({
    name: "Ana Pérez",
    phone: "+525512345678",
    email: "ana@example.com",
    notes: ""
  });
  assertEqual(failures, "valid mobile contact name", validContact.name, true);
  assertEqual(failures, "valid mobile contact phone", validContact.phone, true);
  assertEqual(failures, "valid mobile contact email", validContact.email, true);
  assertEqual(failures, "empty optional mobile contact notes", validContact.notes, true);
  assertEqual(failures, "empty mobile contact name has specific invalid condition", mobileContact.getContactValidity({ name: "", phone: "+525512345678", email: "ana@example.com" }).name, false);
  assertEqual(failures, "invalid mobile contact phone has specific invalid condition", mobileContact.getContactValidity({ name: "Ana", phone: "123", email: "ana@example.com" }).phone, false);
  assertEqual(failures, "invalid mobile contact email has specific invalid condition", mobileContact.getContactValidity({ name: "Ana", phone: "+525512345678", email: "ana" }).email, false);

  const snapshotWithoutCanonicalBinding = mobileContact.buildSnapshotFromPayload(
    Object.assign({}, mobileContactPayload, {
      quote: { price: productionManualOracleMxn, currency: "MXN" }
    })
  );
  assertEqual(failures, "mobile contact without canonical quote binding cannot continue", mobileContact.hasCompleteDirectTransferSnapshot(snapshotWithoutCanonicalBinding), false);

  contracts.window.PixkuyDirectTransferMobileTransactionalBridge = {
    validateLegalAcceptance: function validateRejectedLegalAcceptance() {
      return false;
    }
  };
  assertEqual(failures, "missing legal acceptance is rejected by specific legal bridge", mobileContact.validateLegalAcceptance(), false);
  contracts.window.PixkuyDirectTransferMobileTransactionalBridge.validateLegalAcceptance = function validateAcceptedLegalAcceptance() {
    return true;
  };
  assertEqual(failures, "valid legal acceptance passes", mobileContact.validateLegalAcceptance(), true);

  const checkoutRequests = [];
  const checkoutResponses = [
    {
      ok: true,
      status: 200,
      body: {
        result: {
          checkoutAllowed: true,
          code: "VEHICLE_AVAILABLE",
          price: canonicalPrice
        }
      }
    },
    {
      ok: true,
      status: 200,
      body: {
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_direct",
        bookingStatusToken: "direct_test_status_token"
      }
    }
  ];
  contracts.window.PIXKUY_BOOKING_API_CONFIG = {
    apiBaseUrl: "",
    publicSiteKey: "offline_direct_smoke"
  };
  contracts.window.fetch = function fetchCheckoutContract(url, options) {
    const next = checkoutResponses.shift();

    checkoutRequests.push({
      url,
      options,
      body: JSON.parse(options.body)
    });

    return Promise.resolve({
      ok: next.ok,
      status: next.status,
      json: function json() {
        return Promise.resolve(next.body);
      }
    });
  };
  const checkoutFetch = contracts.window.fetch;

  contracts.document.documentElement.dataset = {};
  assertEqual(failures, "mobile contact cannot bypass absent checkout bridge", mobileContact.dispatchTransactionalCheckoutSubmit(integratedForm), false);
  contracts.document.documentElement.dataset.directTransferBookingApiCheckoutBound = "1";
  integratedForm.__dispatchToDocument = true;
  assertEqual(failures, "valid integrated mobile contact reaches transactional checkout bridge", mobileContact.dispatchTransactionalCheckoutSubmit(integratedForm), true);
  assertEqual(failures, "transactional checkout dispatches submit", dispatchedSubmit && dispatchedSubmit.type, "submit");
  assertEqual(failures, "transactional checkout submit bubbles", dispatchedSubmit && dispatchedSubmit.bubbles, true);
  assertEqual(failures, "transactional checkout submit is cancelable", dispatchedSubmit && dispatchedSubmit.cancelable, true);
  await new Promise(function flushCheckoutContract(resolve) {
    setImmediate(resolve);
  });
  assertEqual(failures, "mobile contact requests precheck and checkout exactly once", checkoutRequests.length, 2);
  assertEqual(failures, "mobile contact precheck uses canonical amount", checkoutRequests[0] && checkoutRequests[0].body.expectedAmountMinor, productionManualOracleMinor);
  assertEqual(failures, "mobile checkout preserves canonical amount", checkoutRequests[1] && checkoutRequests[1].body.direct_transfer_price, productionManualOracleMinor);
  assertEqual(failures, "mobile checkout preserves canonical version", checkoutRequests[1] && checkoutRequests[1].body.direct_transfer_pricing_version, canonicalPrice.pricingVersion);
  assertEqual(failures, "mobile checkout preserves canonical fingerprint", checkoutRequests[1] && checkoutRequests[1].body.direct_transfer_quote_fingerprint, canonicalPrice.quoteFingerprint);
  assertEqual(failures, "mobile checkout preserves canonical expiry", checkoutRequests[1] && checkoutRequests[1].body.direct_transfer_quote_expires_at, canonicalPrice.quoteExpiresAt);
  assertEqual(failures, "mobile checkout uses common Airport and Hourly handoff", contracts.redirects[0] && contracts.redirects[0].url, "/booking-checkout.html?token=direct_test_status_token");
  assertEqual(failures, "mobile checkout does not navigate to Direct review", contracts.redirects.some(function hasDirectReview(entry) {
    return entry.url === "/direct-transfer-checkout-review.html";
  }), false);
  const storedCheckoutHandoff = JSON.parse(
    contracts.storage["pixkuy_booking_checkout:direct_test_status_token"] || "null"
  );
  assertEqual(failures, "mobile checkout stores the exact Stripe test URL", storedCheckoutHandoff && storedCheckoutHandoff.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_test_direct");

  contracts.window.location.search = "?token=direct_test_status_token";
  contracts.window.fetch = function fetchOfflineCheckoutDictionary() {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function json() {
        return Promise.resolve({ bookingStatus: {} });
      }
    });
  };
  contracts.window.setTimeout = function runCheckoutHandoffImmediately(callback) {
    callback();
    return 0;
  };
  const checkoutHandoffPath = path.resolve(
    __dirname,
    "../assets/js/forms/booking-checkout-handoff.js"
  );
  vm.runInNewContext(
    fs.readFileSync(checkoutHandoffPath, "utf8"),
    contracts.context,
    { filename: checkoutHandoffPath }
  );
  await new Promise(function flushStripeHandoff(resolve) {
    setImmediate(resolve);
  });
  assertEqual(failures, "common handoff redirects to the exact Stripe test URL", contracts.redirects[contracts.redirects.length - 1].url, "https://checkout.stripe.com/c/pay/cs_test_direct");
  contracts.window.fetch = checkoutFetch;
  contracts.window.setTimeout = function setTimeoutWithoutBootstrap() {
    return 0;
  };

  const changedCanonicalPrice = {
    amountMinor: 1670000,
    pricingVersion: "direct_transfer_v3_fixture",
    quoteFingerprint: "b".repeat(64),
    quoteExpiresAt: "2027-01-13T17:00:00.000Z",
    durationSeconds: canonicalPrice.durationSeconds,
    distanceMeters: canonicalPrice.distanceMeters
  };
  const canonicalEvents = [];
  contracts.window.addEventListener("pixkuy:direct-transfer-canonical-price", function captureCanonicalEvent(event) {
    canonicalEvents.push(event.detail);
  });
  contracts.window.__pixkuyI18nDict = {};
  contracts.window.__pixkuyI18nModules = {
    getValue: function getValue(dict, key) {
      return key === "directTransferMobileFlow.fare.priceUpdated"
        ? "El precio cambió. Revisa y vuelve a aceptar."
        : "";
    }
  };
  integratedForm.removeAttribute("data-booking-api-checkout-busy");
  integratedFormError.hidden = true;
  checkoutResponses.push({
    ok: true,
    status: 409,
    body: {
      result: {
        checkoutAllowed: false,
        code: "DIRECT_TRANSFER_PRICE_MISMATCH",
        price: changedCanonicalPrice
      }
    }
  });
  const redirectsBeforeMismatch = contracts.redirects.length;
  const requestsBeforeMismatch = checkoutRequests.length;
  assertEqual(failures, "mobile mismatch reuses the real transactional submit", mobileContact.dispatchTransactionalCheckoutSubmit(integratedForm), true);
  await new Promise(function flushMismatchContract(resolve) {
    setImmediate(resolve);
  });
  const mismatchDetail = canonicalEvents[canonicalEvents.length - 1];
  assertEqual(failures, "mobile mismatch stays on contact instead of navigating", contracts.redirects.length, redirectsBeforeMismatch);
  assertEqual(failures, "mobile mismatch performs only the final precheck", checkoutRequests.length, requestsBeforeMismatch + 1);
  assertEqual(failures, "mobile mismatch exposes the new canonical amount", mismatchDetail && mismatchDetail.amountMinor, changedCanonicalPrice.amountMinor);
  assertEqual(failures, "mobile mismatch invalidates acceptance", mismatchDetail && mismatchDetail.quoteAcceptedAt, "");
  assertEqual(failures, "mobile mismatch releases the contact CTA", integratedForm.getAttribute("data-booking-api-checkout-busy"), null);
  assertEqual(failures, "mobile mismatch shows its specific recoverable message", integratedFormError.textContent, "El precio cambió. Revisa y vuelve a aceptar.");
  assertEqual(failures, "contact state consumes the real canonical mismatch atomically", mobileContact.applyCanonicalQuoteToSnapshot(mobileContactSnapshot, mismatchDetail), true);
  assertEqual(failures, "contact state keeps the changed canonical amount", mobileContactSnapshot.direct_transfer_amount_minor, String(changedCanonicalPrice.amountMinor));
  assertEqual(failures, "contact state keeps the changed canonical version", mobileContactSnapshot.direct_transfer_pricing_version, changedCanonicalPrice.pricingVersion);
  assertEqual(failures, "contact state keeps the changed canonical fingerprint", mobileContactSnapshot.direct_transfer_quote_fingerprint, changedCanonicalPrice.quoteFingerprint);
  assertEqual(failures, "contact state keeps the changed canonical expiry", mobileContactSnapshot.direct_transfer_quote_expires_at, changedCanonicalPrice.quoteExpiresAt);
  assertEqual(
    failures,
    "changed canonical binding is written back before reacceptance",
    mobileContact.fillReservationForm(
      mobileContactSnapshot,
      {
        name: "Ana Pérez",
        phone: "+525512345678",
        email: "ana@example.com",
        notes: ""
      },
      { skipLegacyValidation: true }
    ),
    true
  );
  Object.assign(integratedFields, {
    legal_acceptance_accepted: { name: "legal_acceptance_accepted", value: "true" },
    legal_acceptance_terms_version: { name: "legal_acceptance_terms_version", value: "2026-08-01" },
    legal_acceptance_cancellation_policy_version: { name: "legal_acceptance_cancellation_policy_version", value: "2026-08-01" },
    legal_acceptance_privacy_version: { name: "legal_acceptance_privacy_version", value: "2026-08-01" },
    legal_acceptance_accepted_at: { name: "legal_acceptance_accepted_at", value: "2027-01-12T12:05:00.000Z" },
    legal_acceptance_channel: { name: "legal_acceptance_channel", value: "web_direct_transfer_mobile_checkout" }
  });
  checkoutResponses.push(
    {
      ok: true,
      status: 200,
      body: {
        result: {
          checkoutAllowed: true,
          code: "VEHICLE_AVAILABLE",
          price: changedCanonicalPrice
        }
      }
    },
    {
      ok: true,
      status: 200,
      body: {
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_direct_reaccepted",
        bookingStatusToken: "direct_test_reaccepted_token"
      }
    }
  );
  assertEqual(failures, "same contact screen can reaccept and submit again", mobileContact.dispatchTransactionalCheckoutSubmit(integratedForm), true);
  await new Promise(function flushReacceptedContract(resolve) {
    setImmediate(resolve);
  });
  const reacceptedCheckout = checkoutRequests[checkoutRequests.length - 1];
  assertEqual(failures, "reaccepted checkout uses changed canonical amount", reacceptedCheckout && reacceptedCheckout.body.direct_transfer_price, changedCanonicalPrice.amountMinor);
  assertEqual(failures, "reaccepted checkout uses changed canonical version", reacceptedCheckout && reacceptedCheckout.body.direct_transfer_pricing_version, changedCanonicalPrice.pricingVersion);
  assertEqual(failures, "reaccepted checkout uses changed canonical fingerprint", reacceptedCheckout && reacceptedCheckout.body.direct_transfer_quote_fingerprint, changedCanonicalPrice.quoteFingerprint);
  assertEqual(failures, "reaccepted checkout uses changed canonical expiry", reacceptedCheckout && reacceptedCheckout.body.direct_transfer_quote_expires_at, changedCanonicalPrice.quoteExpiresAt);
  assertEqual(failures, "reaccepted checkout resumes the common handoff", contracts.redirects[contracts.redirects.length - 1].url, "/booking-checkout.html?token=direct_test_reaccepted_token");

  integratedForm.removeAttribute("data-booking-api-checkout-busy");
  checkoutResponses.push({
    ok: false,
    status: 503,
    body: { code: "BOOKING_API_UNAVAILABLE" }
  });
  const redirectsBeforeError = contracts.redirects.length;
  assertEqual(failures, "mobile API error uses the real transactional submit", mobileContact.dispatchTransactionalCheckoutSubmit(integratedForm), true);
  await new Promise(function flushErrorContract(resolve) {
    setImmediate(resolve);
  });
  assertEqual(failures, "mobile API error stays on contact", contracts.redirects.length, redirectsBeforeError);
  assertEqual(failures, "mobile API error releases the contact CTA", integratedForm.getAttribute("data-booking-api-checkout-busy"), null);

  const contactSource = fs.readFileSync(
    path.resolve(__dirname, "../assets/js/services/direct-transfer-mobile-contact-step.js"),
    "utf8"
  );
  const legalBridgeSource = fs.readFileSync(
    path.resolve(__dirname, "../assets/js/services/direct-transfer-mobile-transactional-bridge.js"),
    "utf8"
  );
  const legalAcceptanceSource = fs.readFileSync(
    path.resolve(__dirname, "../assets/js/forms/legal-acceptance.js"),
    "utf8"
  );
  const directCheckoutSource = fs.readFileSync(
    path.resolve(__dirname, "../assets/js/forms/direct-transfer-booking-api-checkout.js"),
    "utf8"
  ).split("\r\n").join("\n");
  [
    {
      label: "Airport panel",
      path: "../assets/js/airport-zone-tariff.js",
      requestedDateAnchor: "state.serviceDate"
    },
    {
      label: "Airport checkout",
      path: "../assets/js/forms/airport-transfer-booking-api-checkout.js",
      requestedDateAnchor: "data && data.airportHotelDate"
    },
    {
      label: "Direct checkout",
      path: "../assets/js/forms/direct-transfer-booking-api-checkout.js",
      requestedDateAnchor: "suggestion.describe(result)"
    },
    {
      label: "Hourly panel",
      path: "../assets/js/services/hourly-daily-panel.js",
      requestedDateAnchor: "state.tripDate"
    },
    {
      label: "Hourly checkout",
      path: "../assets/js/forms/hourly-booking-api-checkout.js",
      requestedDateAnchor: 'getFieldValue(form, "hourly_daily_date")'
    }
  ].forEach(function validateSharedNextAvailabilityConsumer(consumer) {
    const source = fs.readFileSync(
      path.resolve(__dirname, consumer.path),
      "utf8"
    );

    assertEqual(
      failures,
      `${consumer.label} delegates next availability display to shared formatter`,
      source.includes("PixkuySharedAvailabilitySuggestion") && source.includes("suggestion.describe"),
      true
    );
    assertEqual(
      failures,
      `${consumer.label} preserves the requested local date context`,
      source.includes(consumer.requestedDateAnchor),
      true
    );
  });
  const mobileCheckoutSource = directCheckoutSource.slice(
    directCheckoutSource.indexOf("  function runMobileCheckout("),
    directCheckoutSource.indexOf("  function handleSubmit(")
  );
  const desktopCheckoutSource = directCheckoutSource.slice(
    directCheckoutSource.indexOf("    if (isDesktopViewport())"),
    directCheckoutSource.indexOf("    runMobileCheckout(")
  );
  const contactCss = fs.readFileSync(
    path.resolve(__dirname, "../assets/css/75-direct-transfer-mobile-contact-step.css"),
    "utf8"
  ).split("\r\n").join("\n");

  assertEqual(failures, "Direct mobile CTA reuses Airport checkout key", contactSource.includes('getI18nValue("airportMobileContactStep.cta.submit", "")'), true);
  assertEqual(failures, "Direct mobile bypasses unrelated legacy required controls", contactSource.includes("skipLegacyValidation: true"), true);
  assertEqual(failures, "Direct mobile does not use generic requestSubmit path", contactSource.includes("form.requestSubmit()"), false);
  assertEqual(failures, "legal bridge validates the dedicated acceptance component", legalBridgeSource.includes("instance.validate()"), true);
  assertEqual(failures, "legal acceptance renders a dedicated visible error", legalAcceptanceSource.includes('error.className = "form-error legal-acceptance__error"'), true);
  assertEqual(failures, "canonical precheck sync writes amount minor with the complete binding", directCheckoutSource.includes('"direct_transfer_price",\n      "direct_transfer_amount_minor",\n      "direct_transfer_currency"'), true);
  assertEqual(failures, "mobile handler no longer references Direct review", mobileCheckoutSource.includes("redirectToCheckoutReview"), false);
  assertEqual(failures, "mobile handler creates checkout before common handoff", mobileCheckoutSource.includes("requestCheckout({") && mobileCheckoutSource.includes("redirectToCheckout(checkoutUrl, bookingStatusToken)"), true);
  assertEqual(failures, "desktop Direct review branch remains intact", desktopCheckoutSource.includes("redirectToCheckoutReview(snapshot)"), true);
  assertEqual(failures, "Direct review HTML remains present", fs.existsSync(path.resolve(__dirname, "../direct-transfer-checkout-review.html")), true);
  assertEqual(failures, "Direct review controller remains present", fs.existsSync(path.resolve(__dirname, "../assets/js/forms/direct-transfer-checkout-review-page.js")), true);
  assertEqual(failures, "Direct mobile summary disables vertical scrolling", contactCss.includes("overflow-y:hidden;"), true);
  assertEqual(failures, "Direct mobile route occupies a separate summary row", contactCss.includes('data-direct-transfer-mobile-contact-summary-row="estimate"]{\n    grid-column:1 / -1;'), true);
  assertEqual(failures, "Direct mobile price aligns vertically with route only", contactCss.includes('data-direct-transfer-mobile-contact-summary-row="price"]{\n    grid-column:2;\n    grid-row:5;\n    text-align:left;'), true);

  ["de", "en", "es", "fr", "it", "ko", "pt", "ru", "zh-hans"].forEach(function validateCheckoutCtaLocale(locale) {
    const airportCatalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../assets/i18n/${locale}/airport-mobile-contact-step.json`), "utf8"));
    const hourlyCatalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../assets/i18n/${locale}/services-hourly.json`), "utf8"));
    assertEqual(
      failures,
      `mobile checkout CTA parity ${locale}`,
      airportCatalog.airportMobileContactStep.cta.submit,
      hourlyCatalog.services.cards.hourly.mobileFlow.contactStep.cta.submit
    );
  });

  if (failures.length > 0) {
    failures.forEach(function eachFailure(failure) {
      writeError(`FAIL ${failure}`);
    });
    writeError(`Direct Transfer offline state smoke failed: ${failures.length}`);
    process.exitCode = 1;
    return;
  }

  writeLine("Direct Transfer offline state and mobile contact smoke OK");
}

if (process.argv.includes("--offline-state")) {
  runOfflineStateSmoke().catch(function handleOfflineStateFatalError(error) {
    writeError(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
} else {
  main().catch(function handleFatalError(error) {
    writeError(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}
