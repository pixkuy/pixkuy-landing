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

async function verifyAirportPresentationCertificate() {
  const storage = new Map(); let tripKey = "trip-1", clock = 1000, expiry;
  const context = {
    document:{documentElement:{lang:"en"},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},dispatchEvent(){}},
    location:{origin:"http://localhost:8888"},Response,URL,Date:{now(){return clock;},parse:Date.parse},
    sessionStorage:{getItem(key){return storage.get(key)||null;},setItem(key,value){storage.set(key,value);}},
    matchMedia(){return {matches:true};},addEventListener(){},setTimeout(fn){expiry=fn;},
    CustomEvent:class { constructor(type,options){this.type=type;this.detail=options?.detail;} },
    PixkuyAirportZoneTariff:{fleetContextKey(){return tripKey;}},
    fetch:async()=>new Response(JSON.stringify({fleetSelection:{model:"Vehicle"}})),
  };
  context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(root,"assets/js/services/fleet-selection-state.js"),"utf8"),context);
  const fleet=context.PixkuyFleetSelection;
  const chosen={modelId:"00000000-0000-4000-8000-000000000001",modelRevision:1,name:"Selected QA",photoUrl:null,passengersSupported:2};
  await fleet.acceptOffer("airport_transfer",{fleet:{version:1,status:"available",requestKey:"offer-1",models:[chosen]}},{},{fleetContextKey:tripKey});
  assert.equal(fleet.model("airport_transfer")?.name,"Selected QA");
  tripKey="trip-2"; assert.equal(fleet.model("airport_transfer"),null);
  tripKey="trip-1"; clock+=5*60*1000+1; assert.equal(fleet.model("airport_transfer"),null);
  expiry(); assert.equal(fleet.read("airport_transfer").offer,null);
  assert.equal(fleet.read("airport_transfer").selected.name,"Selected QA");
  await fleet.acceptOffer("airport_transfer",{fleet:{version:1,status:"available",requestKey:"offer-2",models:[chosen]},
    price:{quoteExpiresAt:new Date(clock+1000).toISOString()}},{},{fleetContextKey:tripKey});
  assert.equal(fleet.model("airport_transfer")?.name,"Selected QA");
  clock+=1001; assert.equal(fleet.model("airport_transfer"),null);
  process.stdout.write("AIRPORT_PRESENTATION_CERTIFICATE_SMOKE=PASS\n");
}

// B state tests reuse the existing VM fixture; no server, network or browser.
async function verifyFleetBAttemptState() {
  const storage = new Map(), sent = [];
  let failSend = true, responseBody = {bookingStatusToken:"synthetic-token",checkoutUrl:"https://stripe.invalid/synthetic"};
  const fleetContext = {
    document:{documentElement:{lang:"en"},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},dispatchEvent(){}},
    location:{origin:"http://localhost:8888"},Response,URL,crypto:require("node:crypto").webcrypto,
    matchMedia(){return {matches:false};},addEventListener(){},CustomEvent:class { constructor(type,options){this.type=type;this.detail=options?.detail;} },
    sessionStorage:{getItem(key){return storage.get(key)||null;},setItem(key,value){storage.set(key,value);}},
    fetch:async function(url,init){
      if (!init) return new Response(JSON.stringify({fleetSelection:{model:"Vehicle",choose:"Choose"}}));
      sent.push({url,headers:JSON.parse(JSON.stringify(init.headers)),payload:JSON.parse(init.body)});
      if (failSend) {failSend=false;throw new Error("SIMULATED_LOST_RESPONSE");}
      return new Response(JSON.stringify(responseBody),{status:responseBody.recovery?409:200});
    }
  };
  fleetContext.window=fleetContext;
  vm.runInNewContext(fs.readFileSync(path.join(root,"assets/js/services/fleet-selection-state.js"),"utf8"),fleetContext);
  const fleet=fleetContext.PixkuyFleetSelection;
  const chosen={modelId:"00000000-0000-4000-8000-000000000001",modelRevision:1,name:"Selected QA",photoUrl:null,passengersSupported:4};
  for(const service of ["airport_transfer","direct_transfer","hourly_daily"]){
    await fleet.acceptOffer(service,{fleet:{version:1,status:"available",requestKey:"synthetic",models:[chosen]}},{passengers:4});
    const original={service_type:service,customer:{full_name:"Synthetic",email:"synthetic@example.invalid"},passengers:4,notes:"Keep notes",recaptchaToken:"first"};
    failSend=true;
    await assert.rejects(fleet.fetchCheckout(service,"/checkout",{headers:{"X-Pixkuy-Site-Key":"synthetic"},body:JSON.stringify(original)}),/SIMULATED_LOST_RESPONSE/);
    const first=sent.at(-1),snapshot=fleet.snapshot(service,original);
    await fleet.fetchCheckout(service,"/checkout",{headers:{"X-Pixkuy-Site-Key":"synthetic"},body:JSON.stringify({...original,passengers:2,notes:"New draft",recaptchaToken:"renewed"})});
    const second=sent.at(-1);assert.equal(first.headers["Idempotency-Key"],second.headers["Idempotency-Key"]);
    assert.equal(second.payload.passengers,4);assert.equal(second.payload.notes,"Keep notes");assert.equal(second.payload.recaptchaToken,"renewed");
    assert.equal(fleet.read(service).draft.notes,"New draft");assert.equal(snapshot.fleet_model.name,chosen.name);
    assert.equal(fleet.snapshot(service,{...snapshot,fleet_model:{...chosen,name:"Frozen"}}).fleet_model.name,"Frozen");
  }
  storage.clear();responseBody={code:"FLEET_SELECTION_REQUIRED",recovery:{state:"not_committed",action:"refresh_form"}};
  await fleet.fetchCheckout("hourly_daily","/checkout",{headers:{},body:JSON.stringify({service_type:"hourly_daily",notes:"Legacy draft"})});
  const migrated=await fleet.acceptOffer("hourly_daily",{fleet:{version:1,status:"available",requestKey:"synthetic",models:[chosen]}},{passengers:4});
  assert.equal(migrated.checkoutAllowed,false);assert.equal(fleet.selection("hourly_daily"),null);
  assert.equal(fleet.read("hourly_daily").draft.notes,"Legacy draft");
  assert.throws(()=>fleet.hourlyPassengers(7),/FLEET_INVALID_PASSENGERS/);assert.throws(()=>fleet.hourlyPassengers(0),/FLEET_INVALID_PASSENGERS/);
  assert.equal(fleet.hourlyPassengers(4),4);
  fleetContext.sessionStorage.setItem=function(){throw new Error("STORAGE_BLOCKED");};
  assert.throws(()=>fleet.fetchCheckout("airport_transfer","/checkout",{headers:{},body:"{}"}),/STORAGE_BLOCKED/);
  process.stdout.write("FLEET_B_ATTEMPT_STATE_SMOKE=PASS\n");
}
verifyAirportPresentationCertificate().then(verifyFleetBAttemptState).catch(error=>{console.error(error);process.exitCode=1;});
