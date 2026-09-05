const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const MOBILE_SOURCE_PATH = path.join(
  ROOT,
  "assets/js/services/events-mobile-config-step.js"
);
const QUOTE_SOURCE_PATH = path.join(
  ROOT,
  "assets/js/services/events-special-quote.js"
);
const DESKTOP_SOURCE_PATH = path.join(
  ROOT,
  "assets/js/forms/contact-event-special-editor.js"
);
const TEST_HOOK_ANCHOR = "  window.PixkuyEventsMobileConfigStep = {";

function createRuntime() {
  const posts = [];
  const quoteSource = fs.readFileSync(QUOTE_SOURCE_PATH, "utf8");
  const mobileSource = fs.readFileSync(MOBILE_SOURCE_PATH, "utf8");
  const anchorMatches = mobileSource.split(TEST_HOOK_ANCHOR).length - 1;

  assert.equal(anchorMatches, 1, "mobile test hook anchor must be unique");

  const instrumentedMobileSource = mobileSource.replace(
    TEST_HOOK_ANCHOR,
    [
      "  window.__pixkuyEventsMobileQuoteTest = {",
      "    setContext: function setContext(payload, nextState, nextStep) {",
      "      currentPayload = payload;",
      "      state = nextState;",
      "      stepNode = nextStep || null;",
      "      resetQuoteState();",
      "    },",
      "    setVariant: function setVariant(variant) { state.selectedVariant = variant; },",
      "    getQuoteInput: getQuoteInput,",
      "    getReturnPickupDayOffset: getReturnPickupDayOffset,",
      "    requestQuoteIfReady: requestQuoteIfReady,",
      "    getQuoteState: function getQuoteState() {",
      "      return { state: currentQuoteState, result: currentQuoteResult };",
      "    }",
      "  };",
      "",
      TEST_HOOK_ANCHOR
    ].join("\n")
  );
  const window = {
    addEventListener: function addEventListener() {},
    matchMedia: function matchMedia() {
      return { matches: true };
    },
    PIXKUY_BOOKING_API_CONFIG: {
      apiBaseUrl: "",
      publicSiteKey: "local-test"
    },
    PixkuyBookingPublicConfig: {
      ready: Promise.resolve()
    },
    fetch: async function fetch(url, options) {
      const payload = JSON.parse(options.body);

      posts.push({ url, method: options.method, payload });

      return {
        ok: true,
        status: 200,
        json: async function json() {
          return {
            ok: true,
            snapshotVersion: payload.snapshotVersion,
            quote: {
              price: 550,
              currency: "MXN",
              outboundDurationSeconds: 1200,
              returnDurationSeconds: 1200
            }
          };
        }
      };
    }
  };
  const document = {
    querySelector: function querySelector() {
      return null;
    },
    body: {
      setAttribute: function setAttribute() {}
    }
  };
  const context = {
    AbortController,
    Intl,
    Map,
    Promise,
    console,
    document,
    setTimeout,
    window
  };

  vm.runInNewContext(quoteSource, context, { filename: QUOTE_SOURCE_PATH });
  vm.runInNewContext(instrumentedMobileSource, context, {
    filename: MOBILE_SOURCE_PATH
  });

  return {
    hooks: window.__pixkuyEventsMobileQuoteTest,
    posts,
    quoteModule: window.PixkuyServicesEventsSpecialQuote
  };
}

function createPayload() {
  return {
    venueId: "auditorio_nacional",
    group: {
      id: "festival_2027",
      venueId: "auditorio_nacional",
      events: [
        {
          id: "festival_2027",
          startsAt: "2027-01-01T20:00",
          venueId: "auditorio_nacional",
          snapshotVersion: 7
        }
      ]
    }
  };
}

function createState(variant) {
  return {
    selectedEventId: "festival_2027",
    selectedVariant: variant,
    selectedPassengerFareKey: "van_3_4",
    originAddress: "Origen seleccionado",
    originAddressPlace: {
      label: "Origen seleccionado",
      placeId: "origin-place",
      lat: 19.428,
      lng: -99.163
    },
    destinationAddress: "Destino seleccionado",
    destinationAddressPlace: {
      label: "Destino seleccionado",
      placeId: "destination-place",
      lat: 19.432,
      lng: -99.133
    },
    originPickupTime: "16:28",
    returnPickupTime: "01:28",
    returnPickupDayOffset: 1
  };
}

function createStep() {
  const cta = {
    attributes: {},
    disabled: true,
    setAttribute: function setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };

  return {
    cta,
    node: {
      querySelector: function querySelector(selector) {
        return selector === "[data-events-mobile-config-cta]" ? cta : null;
      },
      querySelectorAll: function querySelectorAll() {
        return [];
      }
    }
  };
}

async function flushQuote() {
  await new Promise(function wait(resolve) {
    setImmediate(resolve);
  });
}

async function assertCompleteVariant(variant) {
  const runtime = createRuntime();
  const state = createState(variant);
  const step = createStep();

  runtime.hooks.setContext(createPayload(), state, step.node);

  const input = runtime.hooks.getQuoteInput();
  const payload = runtime.quoteModule.buildQuotePayload(input);

  assert.equal(payload.eventId, "festival_2027");
  assert.equal(payload.venueId, "auditorio_nacional");
  assert.equal(input.snapshotVersion, 7);
  assert.equal(payload.snapshotVersion, 7);
  assert.equal(payload.variant, variant);
  assert.equal(payload.passengerFareKey, "van_3_4");
  assert.equal(runtime.quoteModule.isQuotePayloadComplete(payload), true);

  if (variant === "arrival" || variant === "round_trip") {
    assert.equal(payload.originAddress.label, "Origen seleccionado");
    assert.equal(payload.originAddress.placeId, "origin-place");
    assert.equal(payload.originAddress.lat, 19.428);
    assert.equal(payload.originAddress.lng, -99.163);
    assert.equal(payload.originPickupTime, "16:28");
  } else {
    assert.equal(payload.originAddress, undefined);
  }

  if (variant === "departure" || variant === "round_trip") {
    assert.equal(payload.destinationAddress.label, "Destino seleccionado");
    assert.equal(payload.destinationAddress.placeId, "destination-place");
    assert.equal(payload.destinationAddress.lat, 19.432);
    assert.equal(payload.destinationAddress.lng, -99.133);
    assert.equal(payload.returnPickupTime, "01:28");
    assert.equal(payload.returnPickupDayOffset, 1);
  } else {
    assert.equal(payload.destinationAddress, undefined);
  }

  assert.equal(runtime.hooks.requestQuoteIfReady(), true);
  await flushQuote();

  assert.equal(runtime.posts.length, 1);
  assert.equal(runtime.posts[0].method, "POST");
  assert.equal(runtime.posts[0].url, "/v1/public/special-events/quote");
  assert.equal(runtime.hooks.getQuoteState().state, "ready");
  assert.equal(step.cta.disabled, false);
  assert.equal(step.cta.attributes["aria-disabled"], "false");
}

async function run() {
  await assertCompleteVariant("arrival");
  await assertCompleteVariant("departure");
  await assertCompleteVariant("round_trip");

  const runtime = createRuntime();
  const state = createState("round_trip");
  const step = createStep();

  runtime.hooks.setContext(createPayload(), state, step.node);
  assert.equal(runtime.hooks.getReturnPickupDayOffset("23:28"), 0);
  assert.equal(runtime.hooks.getReturnPickupDayOffset("01:28"), 1);
  state.returnPickupTime = "23:28";
  assert.equal(
    runtime.quoteModule.buildQuotePayload(runtime.hooks.getQuoteInput())
      .returnPickupDayOffset,
    0
  );
  state.returnPickupTime = "01:28";
  assert.equal(
    runtime.quoteModule.buildQuotePayload(runtime.hooks.getQuoteInput())
      .returnPickupDayOffset,
    1
  );

  runtime.hooks.setVariant("arrival");
  assert.equal(runtime.hooks.getQuoteInput().destinationAddress, undefined);
  runtime.hooks.setVariant("round_trip");
  assert.equal(runtime.hooks.getQuoteInput().originAddress.placeId, "origin-place");
  assert.equal(
    runtime.hooks.getQuoteInput().destinationAddress.placeId,
    "destination-place"
  );

  state.destinationAddressPlace = null;
  runtime.hooks.setContext(createPayload(), state, step.node);
  assert.equal(runtime.hooks.requestQuoteIfReady(), true);
  await flushQuote();
  assert.equal(runtime.posts.length, 0);
  assert.equal(runtime.hooks.getQuoteState().result.code, "INCOMPLETE_QUOTE_PAYLOAD");
  assert.equal(step.cta.disabled, true);

  const desktopSource = fs.readFileSync(DESKTOP_SOURCE_PATH, "utf8");
  assert.match(
    desktopSource,
    /input\.snapshotVersion = selectedEvent\.snapshotVersion;/
  );

  console.log(
    JSON.stringify({
      status: "PASS",
      suite: "events-mobile-quote",
      variants: ["arrival", "departure", "round_trip"],
      externalCalls: 0,
      formSubmissions: 0
    })
  );
}

run().catch(function onFailure(error) {
  console.error(error);
  process.exitCode = 1;
});
