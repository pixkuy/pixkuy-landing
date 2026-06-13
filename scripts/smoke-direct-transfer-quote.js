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

main().catch(function handleFatalError(error) {
  writeError(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});