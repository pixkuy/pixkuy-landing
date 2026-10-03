/* Run against the user's existing local runner. No server or real business writes. */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");
const controlledFixtures = require('./airport-controlled-fixtures.cjs');
// Explicit test configuration only: never inherit the runner DATABASE_URL.
// Supply PIXKUY_AIRPORT_TEST_DATABASE_URL through the authorized test environment.
// It must match airportPendingEditIntegration.mjs; no database is provisioned here.
// --check-config validates locally without opening a browser or any connection.
function readTestDatabaseUrl() {
  const value = (process.env.PIXKUY_AIRPORT_TEST_DATABASE_URL || "").trim();
  if (!value) throw new Error("PIXKUY_AIRPORT_TEST_DATABASE_URL_REQUIRED: configure the test connection explicitly; no connection attempted.");
  let database;
  try { database = new URL(value); }
  catch { throw new Error("PIXKUY_AIRPORT_TEST_DATABASE_URL_INVALID: expected a PostgreSQL URL; no connection attempted."); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      database.hostname !== "127.0.0.1" || database.port !== "35433" ||
      database.pathname !== "/pixkuy_booking" || database.search || database.hash) {
    throw new Error("PIXKUY_AIRPORT_TEST_DATABASE_URL_SCOPE: only the existing test target 127.0.0.1:35433/pixkuy_booking without query or fragment is allowed; no connection attempted.");
  }
  return value;
}
const mobilePhase1 = process.argv.includes("--mobile-phase1");
const mobilePhase2 = process.argv.includes("--mobile-phase2");
const manualAcceptance = mobilePhase2 && process.argv.includes('--manual-acceptance');
const manualWebkit = manualAcceptance && process.argv.includes('--manual-webkit');
const mobileIntegrated = mobilePhase2 && process.argv.includes('--mobile-integrated');
const iphoneFourFixes = mobileIntegrated && process.argv.includes('--iphone-four-fixes');
const confirmedCopy = mobileIntegrated && process.argv.includes('--confirmed-copy');
const returnHierarchy = mobileIntegrated && process.argv.includes('--return-mobile-hierarchy');
const integratedBefore = mobileIntegrated && process.argv.includes('--integrated-before');
const integratedWebkit = mobileIntegrated && process.argv.includes('--integrated-webkit');
const integratedLan = mobileIntegrated && process.argv.includes('--integrated-lan');
const integratedMatrix = mobileIntegrated && process.argv.includes('--integrated-matrix');
const integratedFleet = mobileIntegrated && process.argv.includes('--integrated-fleet');
const mobileSharedOnly = mobilePhase2 && process.argv.includes("--shared-only");
const desktopSelectionOnly = mobilePhase2 && process.argv.includes("--desktop-selection-only");
const visualRestore = mobilePhase2 && process.argv.includes("--visual-restore");
const mobileRefinement = mobilePhase2 && process.argv.includes("--mobile-refinement");
const reviewCompact = mobileRefinement && process.argv.includes("--review-compact");
const reviewUncertainty = reviewCompact && process.argv.includes("--review-uncertainty");
const refinementBefore = mobileRefinement && process.argv.includes("--refinement-before");
const refinementWebkit = mobileRefinement && process.argv.includes("--refinement-webkit");
const mobileFixtures = mobilePhase1 || mobilePhase2;
const mobileBaseline = process.argv.includes("--mobile-baseline");
if (mobilePhase2) assert(process.argv.slice(2).every(value=>['--mobile-phase2','--manual-acceptance','--manual-webkit','--shared-only','--desktop-selection-only','--visual-restore','--mobile-refinement','--refinement-before','--refinement-webkit','--review-compact','--review-state-only','--review-uncertainty','--mobile-integrated','--integrated-before','--integrated-webkit','--integrated-lan','--integrated-matrix','--integrated-fleet','--iphone-four-fixes','--four-fixes-desktop-only','--return-mobile-hierarchy','--confirmed-copy'].includes(value)) && [mobileSharedOnly,desktopSelectionOnly,visualRestore,mobileRefinement,mobileIntegrated].filter(Boolean).length<=1 && (!process.argv.includes('--refinement-before') || mobileRefinement) && (!process.argv.includes('--refinement-webkit') || mobileRefinement) && (!process.argv.includes('--review-compact') || mobileRefinement) && (!process.argv.includes('--review-state-only') || reviewCompact) && (!process.argv.includes('--review-uncertainty') || reviewUncertainty && !refinementWebkit && !process.argv.includes('--review-state-only')) && (!process.argv.some(v=>v.startsWith('--integrated-')) || mobileIntegrated), 'Phase 2 cannot combine with other modes');
if (manualAcceptance) assert(process.argv.slice(2).every(value=>['--mobile-phase2','--manual-acceptance','--manual-webkit','--return-mobile-hierarchy','--confirmed-copy'].includes(value)), 'Manual acceptance cannot combine with other modes');
if (process.argv.includes('--manual-webkit')) assert(manualAcceptance, 'Manual WebKit requires manual acceptance');
if (mobilePhase1 || mobileBaseline) {
  assert(mobilePhase1 && process.argv.slice(2).every(value => ["--mobile-phase1", "--mobile-baseline"].includes(value)), "Mobile fixtures cannot combine with transactional modes");
}
const testDatabaseUrl = mobileFixtures ? null : readTestDatabaseUrl();
const origin = integratedLan || manualAcceptance ? 'http://192.168.0.14:8888' : process.env.PIXKUY_TEST_ORIGIN || "http://localhost:8888";
assert(["localhost", "127.0.0.1",...(integratedLan || manualAcceptance?['192.168.0.14']:[])].includes(new URL(origin).hostname), "Existing local/LAN runner only");
const refinementOnly = process.argv.includes("--refinement");
const leadSuggestionOnly = process.argv.includes("--lead-time-suggestion");
const continuationOnly = process.argv.includes("--continuation");
const stripeEditOnly = process.argv.includes("--stripe-edit");
const checkoutRegressionOnly = process.argv.includes("--checkout-regression");
const resultDeltaOnly = process.argv.includes("--result-delta");
const sequenceOnly = process.argv.includes("--new-booking") || process.argv.includes("--new-booking-baseline");
const httpEditOnly=sequenceOnly || resultDeltaOnly || process.argv.some(value=>['--http-edit-baseline','--http-edit','--http-edit-lost','--http-edit-rejected'].includes(value));
const isolatedApi='http://127.0.0.1:35434';
const holdEditOnly = httpEditOnly || process.argv.some(value=>['--hold-edit','--hold-edit-baseline','--hold-edit-conflict'].includes(value));
function airportSql(command) {
  assert(!mobileFixtures, "Mobile fixtures forbid database access");
  return JSON.parse(execFileSync(process.execPath,['--import','tsx','scripts/internal/airportPendingEditIntegration.mjs'],{
    cwd:path.resolve(__dirname,'../../../pixkuy-booking-api'),input:JSON.stringify(command),encoding:'utf8',
    env:{...process.env,NODE_ENV:'test',DATABASE_URL:testDatabaseUrl,DOTENV_CONFIG_PATH:path.resolve(__dirname,'../../../nonexistent-test-env')}
  }));
}
const output = reviewCompact ? path.resolve(__dirname, "../../../evidence/airport-mobile-review-compact-20261002/browser", refinementWebkit ? "webkit" : ".", process.argv.includes("--review-state-only") ? "state-only" : refinementBefore ? "before" : "after") : mobileRefinement ? path.resolve(__dirname, "../../../evidence/airport-mobile-refinement-20261002/browser", refinementWebkit ? "webkit" : ".", refinementBefore ? "before" : "after") : visualRestore ? path.resolve(__dirname, "../../../evidence/airport-mobile-visual-restore-20260930/browser") : mobilePhase2 ? path.resolve(__dirname, "../../../evidence/airport-mobile-phase2-20260930/browser") : mobilePhase1 ? path.resolve(__dirname, "../../../evidence/airport-mobile-phase1-20260930", mobileBaseline ? "before" : "after") : leadSuggestionOnly ? path.resolve(__dirname, "../../../.tmp/airport-suggestion") : sequenceOnly ? path.resolve(__dirname, "../../../evidence/airport-new-booking-20260928") : resultDeltaOnly ? path.resolve(__dirname, "../../../evidence/airport-result-delta-20260928") : stripeEditOnly
  ? path.resolve(__dirname, "../../../evidence/airport-desktop-stripe-edit-20260928/landing")
  : continuationOnly
  ? path.resolve(__dirname, "../../../evidence/airport-desktop-continuation-20260928/landing")
  : refinementOnly
    ? path.resolve(__dirname, "../../../evidence/airport-desktop-refinement-20260928/landing")
    : path.join(os.tmpdir(), "pixkuy-airport-desktop-20260928");

// Exercise the live Booking contract, with no sockets or external providers.
function airportBackendContract(operation, payload, fleet, clock) {
  assert(!mobileFixtures, "Mobile fixtures forbid backend operations");
  const script = `
    import net from 'node:net';
    import {readFileSync} from 'node:fs';
    net.Socket.prototype.connect = function(){ throw new Error('TEST_NETWORK_FORBIDDEN'); };
    globalThis.fetch = async()=>{ throw new Error('TEST_NETWORK_FORBIDDEN'); };
    const {operation,payload,fleet,clock}=JSON.parse(readFileSync(0,'utf8'));
    const {airportTransferCheckoutSchema,getAirportTransferCapacityRequirement}=await import('./src/modules/airport-transfer/checkout/airportTransferCheckoutSchema.ts');
    if(operation==='precheck') {
      const {publicAirportTransferAvailabilityPrecheckSchema}=await import('./src/modules/public-api/airport-transfer/publicAirportTransferAvailabilityPrecheckSchema.ts');
      const {precheckAirportTransferAvailability}=await import('./src/modules/public-api/airport-transfer/publicAirportTransferAvailabilityPrecheckService.ts');
      const input=publicAirportTransferAvailabilityPrecheckSchema.parse(payload);
      const body=await precheckAirportTransferAvailability(input,{companyId:'synthetic-company',...(clock?{now:new Date(clock.now)}:{}),resolvePlaceDetails:async()=>({formattedAddress:input.nonAirportLocation.address,placeId:input.nonAirportLocation.place_id,lat:input.nonAirportLocation.lat,lng:input.nonAirportLocation.lng,provider:'google_places',types:['lodging']}),precheckOperationalAvailability:async()=>clock?.occupied?{available:false,status:'unavailable',checkoutAllowed:false,code:'NO_COMPATIBLE_VEHICLE'}:{available:true,status:'available',checkoutAllowed:true,fleet}});
      process.stdout.write(JSON.stringify(body));
    } else {
      const {prepareAirportTransferCheckout}=await import('./src/modules/airport-transfer/checkout/prepareAirportTransferCheckoutUseCase.ts');
      const {buildAirportTransferFormPayloadRaw}=await import('./src/modules/airport-transfer/checkout/airportTransferReservationRepository.ts');
      const parsed=airportTransferCheckoutSchema.parse(payload);
      const prepared=await prepareAirportTransferCheckout({body:parsed});
      const stored=buildAirportTransferFormPayloadRaw(parsed);
      const {createPublicAirportTransferCheckout}=await import('./src/modules/public-api/airport-transfer/publicAirportTransferCheckoutService.ts');
      let delegated=0;
      let capacityRequirement;
      const boundary=async(input)=>{
        if(Object.hasOwn(input.payload,'airport_transfer_passengers')) throw new Error('INVENTED_HEADCOUNT');
        delegated++;
        return {statusCode:200,body:{status:'ok'}};
      };
      const result=await createPublicAirportTransferCheckout({
        request:{body:payload,headers:{'idempotency-key':'synthetic-regression-attempt'}},
        publicSite:{companyId:'synthetic-company',publicSiteId:'synthetic-site',siteName:'Synthetic',environment:'test',allowedOrigins:['http://localhost:8888']},publicOrigin:'http://localhost:8888',
        verifyRecaptcha:async()=>{},
        resolvePlaceDetails:async()=>({formattedAddress:parsed.airport_transfer_non_airport_location.address,placeId:parsed.airport_transfer_non_airport_location.place_id,lat:parsed.airport_transfer_non_airport_location.lat,lng:parsed.airport_transfer_non_airport_location.lng,provider:'google_places',types:['lodging']}),
        listFleetCandidates:async(_company,capacity)=>{capacityRequirement=capacity;return [{id:'synthetic-unit',modelId:parsed.fleet_selection.model_id,modelRevision:1,active:true,maxPassengers:6}];},
        prepareIdempotencyRequest:async()=>({scope:{companyId:'synthetic-company',publicSiteId:'synthetic-site',idempotencyKeyHash:'synthetic-key',requestHash:'synthetic-hash'},cachedResponse:null}),
        createPendingReservation:boundary,
        ...(operation==='replace'?{replacement:{bookingStatusToken:'synthetic-airport-token',editRevision:'2026-09-28T10:00:00.000Z',replacePendingCheckout:boundary}}:{})
      });
      process.stdout.write(JSON.stringify({statusCode:result.statusCode,ready:prepared.body.checkoutReady===true && delegated===1,code:prepared.body.code,exactCountPresent:Object.hasOwn(stored,'airport_transfer_passengers'),capacityRequirement}));
    }
  `;
  return JSON.parse(execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{
    cwd:path.resolve(__dirname,'../../../pixkuy-booking-api'),
    input:JSON.stringify({operation,payload,fleet,clock}),encoding:'utf8',
    env:{...process.env,NODE_ENV:'test',DOTENV_CONFIG_PATH:path.join(os.tmpdir(),'pixkuy-no-dotenv-regression'),DATABASE_URL:testDatabaseUrl}
  }));
}

async function run() {
  const { chromium, webkit, devices } = require(process.env.PIXKUY_PLAYWRIGHT_MODULE || "../../../pixkuy_frontend/node_modules/playwright");
  const runOutput = confirmedCopy ? path.resolve(__dirname,'../../../evidence/airport-confirmed-photo-20261003/browser',integratedWebkit?'webkit':'chromium',integratedBefore?'before':'after') : returnHierarchy ? path.resolve(__dirname,'../../../evidence/airport-return-hierarchy-20261003/browser',integratedWebkit?'webkit':'chromium',integratedBefore?'before':'after') : iphoneFourFixes ? path.resolve(__dirname,'../../../evidence/airport-iphone-four-fixes-20261003/browser',integratedWebkit?'webkit':'chromium',integratedBefore?'before':'after') : mobileIntegrated ? path.resolve(__dirname,'../../../evidence/airport-mobile-lan-integrated-20261002/browser',integratedWebkit?'webkit':'chromium',integratedLan?'lan':'localhost',integratedFleet?'fleet':integratedMatrix?'matrix':integratedBefore?'before':'after') : reviewUncertainty ? path.resolve(__dirname,'../../../evidence/airport-mobile-review-recovery-20261002/browser',refinementBefore?'before':'after') : output;
  await fs.mkdir(runOutput, {recursive:true});
  const browser = await (refinementWebkit || integratedWebkit || manualWebkit ? webkit : chromium).launch({headless:true,...(!refinementWebkit && !integratedWebkit && !manualWebkit && (httpEditOnly || mobileFixtures)?{args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE 192.168.0.14','--no-proxy-server']}: {})});
  const context = await browser.newContext({...refinementWebkit || integratedWebkit || manualWebkit?devices['iPhone 13']:{},viewport:{width:1440,height:1000}, locale:"es-ES", serviceWorkers:"block"});
  if (manualAcceptance) {
    try { await (process.argv.includes('--confirmed-copy') ? require('./airport-confirmed-copy-regression').manualConfirmed : process.argv.includes('--return-mobile-hierarchy') ? require('./airport-return-hierarchy-regression').manualPending : require('./airport-manual-acceptance-regression.cjs'))({browser,context,origin,webkit:manualWebkit}); }
    finally { await browser.close(); }
    return;
  }
  let writes = 0;
  let prechecks = 0;
  let suggestionClock = {now:'2026-09-30T08:54:59.900Z',occupied:false};
  const suggestionCalls=[];
  let mode = "available";
  let status = "pending_payment";
  let canRetry = false;
  let canModify = false;
  let retries = 0;
  let replacements = 0;
  let replacementResult = "success";
  let lastReplacement = null;
  let service = "airport_transfer";
  let price = 80000;
  let loseCheckout = false;
  let delayPrecheck = 0;
  let delayCheckout = 0;
  let statusFailure = false;
  let lastPrecheckPayload = null;
  const sent = [];
  const model = {modelId:"00000000-0000-4000-8000-000000000001",modelRevision:1,name:"BYD M9",photoUrl:origin+"/assets/img/fleet/bydm9_xhoras001d.jpeg",passengersSupported:2};
  let models = [model];
  let mobileDelay = () => 0;
  const mobileRequests = [];
  const mobileCheckouts = [];
  const mobileReplacements = [];
  let mobileStatuses = 0;
  let mobilePrice = null;
  let mobileNext = null;
  let mobileCode = 'NO_AVAILABILITY';
  let mobileCheckoutMode = 'not_committed';
  let recoverStatus = false;
  const errors = [];
  await context.addInitScript(()=>{
    window.__qaErrors=[];
    const realNow=Date.now.bind(Date);let clockOffset=0;
    Date.now=()=>realNow()+clockOffset;
    window.__advanceAirportClock=milliseconds=>{clockOffset+=milliseconds;return Date.now();};
    window.addEventListener('error',e=>window.__qaErrors.push({message:e.message,file:e.filename,line:e.lineno}));
    window.addEventListener('pixkuy:booking-status-ready',e=>{window.__qaBookingStatus=e.detail;});
  });
  // Do not intercept the isolated API, even with route.continue(): Chromium
  // must exercise its own cross-origin preflight and HTTP response handling.
  await context.route(url=>!httpEditOnly || url.origin!==isolatedApi, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, code=200) => route.fulfill({status:code,contentType:"application/json",body:JSON.stringify(body)});
    if (mobilePhase2 && url.pathname === '/v1/public/reservations/checkout' && request.method() === 'POST') {
      mobileCheckouts.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
      // Transport boundary only: no backend, reservation, hold or payment created.
      await new Promise(resolve=>setTimeout(resolve,200));
      if((reviewUncertainty || mobileIntegrated) && mobileCheckoutMode === 'lost') return route.abort('failed');
      if(mobileIntegrated && mobileCheckoutMode === 'timeout') return route.abort('timedout');
      if((reviewUncertainty || mobileIntegrated) && mobileCheckoutMode === 'unknown') return json({code:'CHECKOUT_STATE_UNCERTAIN',recovery:{state:'unknown',preserveData:true}},503);
      if((reviewUncertainty || mobileIntegrated) && mobileCheckoutMode === 'status') return json({bookingStatusToken:'synthetic-recovery-only',recovery:{state:'authoritative_status',action:'reservation_status'}});
      if(mobileIntegrated && mobileCheckoutMode === 'success') return json(controlledFixtures.checkout());
      return json({code:'CONTROLLED_CHECKOUT_NOT_COMMITTED',recovery:{state:'not_committed',preserveData:true}},409);
    }
    if(mobileIntegrated && url.pathname.endsWith('/replace-checkout') && request.method()==='POST') {
      mobileReplacements.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
      if(mobileCheckoutMode==='lost')return route.abort('failed');
      if(mobileCheckoutMode==='unknown')return json({code:'CHECKOUT_STATE_UNCERTAIN',recovery:{state:'unknown',preserveData:true}},503);
      return json({replacement:true,bookingStatusToken:'synthetic-integrated-only',checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic-replacement'});
    }
    if(mobileIntegrated && url.pathname.endsWith('/retry-checkout') && request.method()==='POST') {
      retries++;return json({paymentAttempt:{checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic-retry'}});
    }
    if (mobileFixtures && !['GET','HEAD'].includes(request.method()) && url.pathname !== '/v1/public/reservations/airport-transfer-availability-precheck') { writes++; return route.abort(); }
    if (mobileFixtures && url.hostname === 'checkout.stripe.com') {
      // Intercept provider navigation locally: never continue to Stripe.
      if (mobileIntegrated && request.method()==='GET' && /^\/c\/pay\/synthetic(?:-integrated-only|-replacement|-retry)$/.test(url.pathname) && !url.search) {
        return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled payment boundary</title>'});
      }
      return route.abort();
    }
    if (mobileFixtures && url.pathname === '/.netlify/functions/booking-public-config') return json({ok:true,bookingApi:{apiBaseUrl:origin},publicSite:{siteKey:'local_pixkuy_site_key'}});
    if(leadSuggestionOnly && !['GET','HEAD'].includes(request.method()) && !url.pathname.endsWith('/airport-transfer-availability-precheck')) { writes++; return route.abort(); }
    if (url.protocol === "file:") return route.continue();
    if (url.hostname === 'checkout.stripe.com') return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled payment boundary</title>'});
    if (url.hostname === "unpkg.com" && url.pathname.includes("libphonenumber-js")) return route.fulfill({contentType:"application/javascript",path:path.resolve(__dirname,"../../../pixkuy_frontend/node_modules/libphonenumber-js/bundle/libphonenumber-max.js")});
    if (url.pathname.endsWith("/runtime-config")) return json({bookingApi:{apiBaseUrl:httpEditOnly?isolatedApi:origin},publicSite:{siteKey:"local_pixkuy_site_key"}});
    if(httpEditOnly && url.pathname==='/.netlify/functions/booking-public-config') return json({ok:true,bookingApi:{apiBaseUrl:isolatedApi},publicSite:{siteKey:'local_pixkuy_site_key'}});
    if(httpEditOnly && url.origin===isolatedApi) return route.continue();
    if(httpEditOnly && url.pathname.startsWith('/v1/')) return route.abort();
    if (url.pathname === "/v1/public/reservations/airport-transfer-availability-precheck") {
      prechecks++;
      if (mobileFixtures) {
        // Capture the response at dispatch so late A cannot inherit B's fixture.
        const payload = request.postDataJSON();
        const record = {id:prechecks,time:payload.time,date:payload.date,airport:payload.airportId,direction:payload.direction,zone:payload.zoneId,band:payload.passengerFareKey,capacity:payload.passengers,mode,models:models.map(item=>item.modelId),settled:false};
        mobileRequests.push(record);
        lastPrecheckPayload = payload;
        const available = mode === 'available' && models.length > 0;
        const body = controlledFixtures.precheck(payload,{models,requestNumber:prechecks,available});
        if (mobilePrice && mobilePrice !== payload.expectedAmountMinor) body.result={checkoutAllowed:false,price:{available:false,reason:'AIRPORT_TRANSFER_PRICE_MISMATCH',actualAmountMinor:mobilePrice,expectedAmountMinor:payload.expectedAmountMinor}};
        if (mobileNext) body.result.availability={available:false,status:'unavailable',code:mobileCode,nextAvailableStartLocal:mobileNext};
        const wait = mobileDelay(payload, record.id);
        if (wait) await new Promise(resolve=>setTimeout(resolve,wait));
        record.settled = true;
        if(mobileIntegrated && record.mode === 'invalid') return json({});
        if(mobileIntegrated && record.mode === 'pending') return json({result:{checkoutAllowed:false,availability:{status:'pending',available:false,code:'AVAILABILITY_PENDING'}}});
        if(mobileIntegrated && record.mode === 'network') return route.abort('internetdisconnected');
        return record.mode === 'technical' ? json({code:'FLEET_AVAILABILITY_UNDETERMINED'},503) : json(body);
      }
      if (delayPrecheck) await new Promise(resolve=>setTimeout(resolve,delayPrecheck));
      if (mode === "technical") return json({code:"FLEET_AVAILABILITY_UNDETERMINED"},503);
      const payload=request.postDataJSON();
      lastPrecheckPayload=payload;
      if(leadSuggestionOnly) {
        const body=airportBackendContract('precheck',payload,{version:1,status:'available',requestKey:'suggestion-'+prechecks,models:[{...model,passengersSupported:4}],selectedModelEligible:true},suggestionClock);
        suggestionCalls.push({now:suggestionClock.now,date:payload.date,time:payload.time,allowed:body.result.checkoutAllowed,code:body.result.availability?.code,next:body.result.availability?.nextAvailableStartLocal});
        await new Promise(resolve=>setTimeout(resolve,150));
        return json(body);
      }
      if(holdEditOnly) return json(await airportSql({operation:'precheck',payload}));
      if (checkoutRegressionOnly) price=payload.expectedAmountMinor;
      const available=mode!=="unavailable";
      // This legacy mode has controlled persistence. Authorized pending-edit
      // availability is exercised against SQL by --hold-edit, never by this fixture.
      if (checkoutRegressionOnly && !payload.pending_edit) {
        const body=airportBackendContract('precheck',payload,{version:1,status:'available',requestKey:'offer-'+prechecks,models,selectedModelEligible:true});
        assert.equal(Object.hasOwn(body.result,'request'),false,'Real precheck never echoes request');
        return json(body);
      }
      let quote={pricingVersion:"test-v1",quoteFingerprint:"a".repeat(64)};
      if(checkoutRegressionOnly && payload.pending_edit) {
        const original=sent[0].body;
        for(const [field,key] of Object.entries({airportId:'airport_transfer_airport_id',direction:'airport_transfer_direction',zoneId:'airport_transfer_zone_id',passengerFareKey:'airport_transfer_passenger_fare_key',date:'airport_transfer_date',time:'airport_transfer_time',expectedAmountMinor:'airport_transfer_price'})) assert.equal(payload[field],original[key],'Controlled note/contact edit keeps the original quoted trip');
        quote={pricingVersion:original.airport_transfer_pricing_version,quoteFingerprint:original.airport_transfer_quote_fingerprint};
      }
      if (payload.expectedAmountMinor !== price) return json({result:{checkoutAllowed:false,price:{available:false,reason:"AIRPORT_TRANSFER_PRICE_MISMATCH",expectedAmountMinor:payload.expectedAmountMinor,actualAmountMinor:price}}});
      return json({status:'ok',result:{serviceType:'airport_transfer',airportId:payload.airportId,direction:payload.direction,zoneId:payload.zoneId,passengerFareKey:payload.passengerFareKey,date:payload.date,time:payload.time,locale:payload.locale,checkoutAllowed:available,price:{available:true,amountMinor:price,expectedAmountMinor:price,...quote},availability:{available,status:available?'available':'unavailable',availabilityBlockReason:available?null:'NO_AVAILABILITY',...(available?{}:{code:'NO_AVAILABILITY'})},fleet:{version:1,status:available?"available":"unavailable",requestKey:"offer-"+prechecks,models:available?models:[],selectedModelEligible:true}}});
    }
    if (url.pathname.endsWith("/retry-checkout")) {
      retries++;
      assert.equal(request.postDataJSON().token,'synthetic-airport-token','Retry uses original reservation token');
      return json({paymentAttempt:{checkoutUrl:"https://checkout.stripe.com/c/pay/synthetic"}});
    }
    if (url.pathname.endsWith("/replace-checkout")) {
      replacements++;
      lastReplacement = {headers:request.headers(),body:request.postDataJSON()};
      if(holdEditOnly) { const result=airportSql({operation:'replace',...lastReplacement}); return json(result.body,result.statusCode); }
      if(checkoutRegressionOnly) {
        const contract=airportBackendContract('replace',lastReplacement.body);
        assert.equal(contract.ready,true,'Real replacement entrypoint accepts band-only draft: '+JSON.stringify(contract));
        assert.equal(contract.exactCountPresent,false);
        assert.equal(contract.capacityRequirement,4);
      }
      if (replacementResult === "paid") return json({status:"error",code:"CHECKOUT_ALREADY_COMPLETED",recovery:{state:"authoritative_status",action:"reservation_status",preserveData:true}},409);
      if (replacementResult === "uncertain") return json({status:"error",code:"CHECKOUT_STATE_UNCERTAIN",recovery:{state:"committed",action:"reservation_status",preserveData:true}},503);
      return json({status:"ok",serviceType:"airport_transfer",replacement:true,bookingStatusToken:"synthetic-airport-token",checkoutUrl:"https://checkout.stripe.com/c/pay/replacement"});
    }
    if (url.pathname.endsWith("/checkout")) {
      writes++;
      sent.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
      if (checkoutRegressionOnly) {
        const contract=airportBackendContract('checkout',request.postDataJSON());
        assert.equal(contract.ready,true,contract.code || 'Real backend accepts the checkout payload');
        assert.equal(contract.exactCountPresent,false,'Band-only checkout persists no invented headcount');
        assert.equal(contract.capacityRequirement,4,'Capacity check covers the full 3–4 band');
      }
      if(delayCheckout) await new Promise(resolve=>setTimeout(resolve,delayCheckout));
      if(loseCheckout){loseCheckout=false;return route.abort();}
      if(recoverStatus) return json({bookingStatusToken:"synthetic-airport-token",recovery:{action:"reservation_status"}});
      return json({bookingStatusToken:"synthetic-airport-token",checkoutUrl:"https://checkout.stripe.com/c/pay/synthetic"});
    }
    if (url.pathname.includes("/status")) {
      if(mobileIntegrated) {
        mobileStatuses++;
        const source=mobileCheckouts.findLast(entry=>entry.body.airport_transfer_airport_id)?.body || {};
        const selected=models[0] || model;
        const amount=source.airport_transfer_price || 80000;
        return json(controlledFixtures.status({source,selected,amount,service,state:status,canModify,canRetry}));
      }
      if(holdEditOnly) return json(airportSql({operation:'status'}));
      if (statusFailure) return route.abort();
      const statusBody = {reservation:{serviceType:service,status,publicCode:"PKY-TEST",pickupAddress:"MEX — Aeropuerto Internacional Ciudad de México",destinationAddress:"Hotel MX Condesa — Salamanca 35, Roma Norte",serviceStartLocalDate:"2026-10-05",serviceStartLocalTime:"22:03",passengerCount:2,passengerLabel:"1–2",luggageCount:2,vehicleDisplayName:"BYD M9",customerNotes:"Vuelo AM123. Dos maletas."},customer:{fullName:"Ana García",email:"ana@example.com",phone:"+34612345678"},payment:{status:status==="confirmed"?"paid":"pending",amountExpected:price,amountPaid:status==="confirmed"?price:null,currency:"MXN"},actions:{canRetryCheckout:canRetry,canModify:canModify},edit:{allowed:canModify,revision:"2026-09-28T10:00:00.000Z",draft:canModify?{service_type:"airport_transfer",airport_transfer_airport_id:"mex",airport_transfer_direction:"airport_to_destination",airport_transfer_zone_id:"roma_condesa",airport_transfer_passenger_fare_key:"van_1_2",airport_transfer_destination_label:"Hotel MX Condesa — Salamanca 35, Roma Norte",airport_transfer_airport_label:"MEX — Aeropuerto Internacional Ciudad de México",airport_transfer_passenger_bucket_label:"1–2 pasajeros",airport_transfer_non_airport_location:{address:"Salamanca 35, Roma Norte, Ciudad de México",place_id:"synthetic-place",lat:19.418,lng:-99.169},airport_transfer_date:"2026-10-05",airport_transfer_time:"22:03",airport_transfer_passengers:2,airport_transfer_luggage:2,airport_transfer_price:price,airport_transfer_currency:"MXN",airport_transfer_pricing_version:"test-v1",airport_transfer_quote_fingerprint:"a".repeat(64),airport_transfer_notes:"Vuelo AM123. Dos maletas.",request_summary:"MEX a Hotel MX Condesa",locale:"es",customer:{full_name:"Ana García",email:"ana@example.com",phone:"+34612345678"},fleet_selection:{version:1,model_id:model.modelId,model_revision:model.modelRevision},fleet_model:{id:model.modelId,name:model.name,revision:model.modelRevision,photoUrl:model.photoUrl,amountMinor:price,currency:"MXN"},legal_acceptance_accepted:"true",legal_acceptance_terms_version:"test",legal_acceptance_cancellation_policy_version:"test",legal_acceptance_privacy_version:"test",legal_acceptance_accepted_at:"2026-09-28T09:00:00.000Z",legal_acceptance_channel:"web_airport_checkout"}:null}}; if (stripeEditOnly && statusBody.edit.draft) { statusBody.reservation.passengerCount=null; delete statusBody.edit.draft.airport_transfer_passengers; } if (checkoutRegressionOnly && statusBody.edit.draft && sent.length) { const source=sent[0].body; for(const key of [...Object.keys(statusBody.edit.draft),...Object.keys(source).filter(key=>key.startsWith("legal_acceptance_"))]) { if(Object.hasOwn(source,key)) statusBody.edit.draft[key]=source[key]; } delete statusBody.edit.draft.airport_transfer_passengers; statusBody.edit.draft.airport_transfer_passenger_bucket_label="3–4 pasajeros"; statusBody.reservation.passengerCount=null; statusBody.reservation.passengerLabel="3–4"; } return json(statusBody);
    }
    if (request.resourceType() === "script" && url.pathname.startsWith("/.netlify/functions/")) return route.abort();
    if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/.netlify/functions/")) return json({items:[],ok:true});
    if (!['GET','HEAD'].includes(request.method())) { writes++; return route.abort(); }
    if (url.origin === origin) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const httpReplies=[];
  const httpRequests=[];
  page.on('request',request=>{
    if(httpEditOnly && request.url()===isolatedApi+'/v1/public/reservations/replace-checkout' && request.method()==='POST') httpRequests.push({body:request.postDataJSON(),headers:request.headers()});
  });
  page.on('response',async response=>{
    if(httpEditOnly && response.url()===isolatedApi+'/v1/public/reservations/replace-checkout' && response.request().method()==='POST') {
      const body=await response.json().catch(()=>({}));
      httpReplies.push({status:response.status(),code:body.code || null,validCheckout:typeof body.checkoutUrl==='string' && new URL(body.checkoutUrl).hostname==='checkout.stripe.com',body});
    }
  });
  page.setDefaultTimeout(10000);
  async function capture(name) {
    await page.evaluate(async()=>{await Promise.race([Promise.all(Array.from(document.querySelectorAll('.airport-booking__photo, .airport-booking__logo')).map(img=>img.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,2000))]);window.scrollTo({top:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    const viewport=page.viewportSize();
    const height=await page.locator('.airport-booking').evaluate(el=>Math.min(1800,Math.ceil(el.scrollHeight+48)));
    await page.setViewportSize({width:viewport.width,height:Math.max(viewport.height,height)});
    await page.locator('.airport-booking__photo').first().scrollIntoViewIfNeeded().catch(()=>{});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:path.join(output,name),fullPage:false});
    await page.setViewportSize(viewport);
  }
  async function runContinuation() {
    async function waitForPrecheck(after) {
      for (let attempt=0;attempt<80 && prechecks<=after;attempt++) await page.waitForTimeout(50);
      assert.equal(prechecks,after+1,"Offer expiry performs one deduplicated precheck");
    }
    async function expireOffer(nextMode) {
      mode=nextMode;
      const before=prechecks;
      await page.evaluate(()=>{
        window.__advanceAirportClock(301000);
        window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitForPrecheck(before);
      await page.waitForFunction(()=>{
        const notice=document.querySelector('.airport-booking__notice');
        return !notice || notice.textContent!==window.PixkuyAirportDesktopView.t('checking');
      });
    }
    async function verifyLegalLinks(scope) {
      const links=page.locator(scope+' a[href]');
      assert.equal(await links.count(),3,scope+' keeps the three legal documents');
      for(let index=0;index<3;index++){
        const link=links.nth(index);
        const href=await link.getAttribute('href');
        const modeName=href.includes('cancellations')?'cancellations':href.includes('privacy')?'privacy':'terms';
        await link.evaluate(node=>{node.focus({preventScroll:true});window.__legalReturnY=window.scrollY;node.click();});
        const overlay=page.locator('#pixkuy-legal-overlay[data-open="1"]');
        await overlay.waitFor({state:'visible'});
        assert.equal(await overlay.locator('[data-legal-mode="'+modeName+'"]:not([aria-selected="false"])').count(),1,'Overlay opens the requested document');
        assert.equal(await page.evaluate(()=>document.querySelector('.airport-booking').inert),true,'Legal overlay makes the route inert');
        assert.equal(await overlay.locator('[data-legal-mode="terms"]').innerText(),'Bedingungen','Legal overlay uses the selected language');
        const body=overlay.locator('[data-legal-body="1"]');
        assert(await body.evaluate(node=>node.clientHeight>0 && node.scrollHeight>=node.clientHeight),'Legal document is visible and scrollable');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await overlay.evaluate(node=>node.contains(document.activeElement)),true,'Focus remains trapped in the legal dialog');
        await page.keyboard.press('Escape');
        await overlay.waitFor({state:'hidden'});
        assert.equal(await link.evaluate(node=>document.activeElement===node),true,'Closing legal restores focus to its trigger');
        assert.equal(await page.evaluate(()=>window.scrollY),await page.evaluate(()=>window.__legalReturnY),'Closing legal preserves the route scroll position');
        assert.equal(new URL(page.url()).hash.includes('airport/'),true,'Closing legal preserves the Airport route');
        assert.equal(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked(),true,'Closing legal preserves consent');
      }
    }

    await page.goto(origin+'/?service=airport_hotel#services');
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    await page.locator('[data-consent-reject]').click({timeout:1500}).catch(()=>{});
    await page.locator('#lang-trigger').click();
    await page.locator('[data-lang="de"]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='de');
    await page.evaluate(()=>{
      window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel MX Condesa — Salamanca 35, Roma Norte',zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});
    });
    await page.locator('[data-airport-tariff-role="date"] input').fill('2026-10-05');
    await page.locator('[data-airport-tariff-role="time"] input').fill('22:03');
    await page.locator('[data-airport-tariff-role="passengers"] [data-airport-tariff-fare-key="van_1_2"]').click();
    const cta=page.locator('#services-expand-airport .services-expand__cta');
    await page.waitForFunction(()=>!document.querySelector('#services-expand-airport .services-expand__cta').disabled);
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    await cta.click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('.airport-booking__logo').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.scrollY),0,'Entering Data resets the document to its real start');
    assert.equal(await page.locator('.airport-booking__logo').isVisible(),true,'Data exposes the Pixkuy brand at entry');
    assert.equal(await page.locator('.airport-booking__progress').isVisible(),true,'Data exposes progress at entry');
    assert.equal(await page.locator('.lang').isHidden(),true,'Data hides the global language selector');
    assert.equal(await page.locator('.airport-booking__identity > *').count(),1,'Data header contains only the brand');
    assert.equal(await page.locator('.airport-booking__back-action').count(),0,'Data has no redundant footer navigation');
    await page.locator('#contact-name').fill('Ana García');
    await page.locator('#contact-phone').fill('+34612345678');
    await page.locator('#contact-email').fill('ana@example.com');
    await page.locator('#contact-luggage').fill('2');
    await page.locator('#contact-message').fill('Flug AM123. Zwei Koffer.');
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    await capture('datos-entry.png');
    await page.evaluate(()=>window.scrollTo({top:240,behavior:'instant'}));
    await verifyLegalLinks('[data-airport-transfer-checkout-legal-acceptance] .legal-acceptance__links');

    await page.locator('#contact-name').focus();
    await page.evaluate(()=>window.scrollTo({top:180,behavior:'instant'}));
    const dataScroll=await page.evaluate(()=>window.scrollY);
    await expireOffer('available');
    await page.waitForFunction(()=>!document.querySelector('.airport-booking__notice'));
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García','Same-offer refresh preserves passenger data');
    assert.equal(await page.locator('#contact-name').evaluate(node=>document.activeElement===node),true,'Same-offer refresh preserves field focus');
    assert.equal(await page.evaluate(()=>window.scrollY),dataScroll,'Same-offer refresh preserves reading position');
    assert.equal(new URL(page.url()).hash,'#airport/datos','Same-offer refresh preserves the route');
    assert.equal(writes,0,'Background refresh creates no reservation or hold');

    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    await page.locator('.airport-booking__logo').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.scrollY),0,'Entering Review resets the document to its real start');
    assert.equal(await page.locator('.airport-booking__logo').isVisible(),true,'Review exposes the brand at entry');
    assert.equal(await page.locator('.lang').isHidden(),true,'Review hides the global language selector');
    assert.equal(await page.locator('.airport-booking__back-action').count(),0,'Review has no redundant return action');
    assert.equal(await page.locator('.airport-booking__progress li').nth(1).locator('button').count(),1,'Progress retains the Data navigation action');
    await capture('revision-entry.png');
    await page.evaluate(()=>window.scrollTo({top:260,behavior:'instant'}));
    await verifyLegalLinks('.airport-booking__conditions .legal-acceptance__links');
    await page.locator('.airport-booking__conditions a').first().evaluate(node=>node.click());
    await page.locator('#pixkuy-legal-overlay[data-open="1"]').waitFor({state:'visible'});
    await page.screenshot({path:path.join(output,'legal-overlay.png'),fullPage:false});
    await page.keyboard.press('Escape');

    price=85000;
    await expireOffer('available');
    await page.getByRole('button',{name:/neues Angebot|oferta/i}).waitFor();
    assert.equal(writes,0,'A price change requires explicit acceptance without creating a hold');
    await page.getByRole('button',{name:/neues Angebot|oferta/i}).click();
    assert.equal(new URL(page.url()).hash,'#airport/datos','Accepting the new price returns to editable Data');
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);

    await expireOffer('unavailable');
    assert.equal(await page.locator('.airport-booking__notice').innerText(),await page.evaluate(()=>window.PixkuyAirportDesktopView.t('unavailable')),'Commercial unavailability has its own state');
    assert.equal(writes,0,'Commercial unavailability creates no reservation or hold');
    mode='available';
    await page.locator('.airport-booking__summary button').last().click();
    await page.waitForFunction(()=>!document.querySelector('.airport-booking__notice'));
    await expireOffer('technical');
    assert.equal(await page.locator('.airport-booking__notice').innerText(),await page.evaluate(()=>window.PixkuyAirportDesktopView.t('technical')),'Technical failure remains distinct');
    assert.equal(writes,0,'Technical failure creates no reservation or hold');
    mode='available';
    await page.locator('.airport-booking__summary button').last().click();
    await page.waitForFunction(()=>!document.querySelector('.airport-booking__notice'));

    await page.locator('.airport-booking__progress li').first().locator('button').click();
    await page.waitForURL(/#airport\/traslado$/);
    await page.waitForFunction(()=>!document.querySelector('#services-expand-airport .services-expand__cta').disabled);
    assert((await page.locator('#services-expand-airport .services-expand__fare').innerText()).includes('850'),'Returning to Services restores the verified fare');
    assert.equal(await page.evaluate(()=>Boolean(window.PixkuyFleetSelection.model('airport_transfer'))),true,'Returning to Services restores the selected model');
    assert.equal(await page.locator('.lang').isVisible(),true,'Services restores the language selector');
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'de','Services preserves the selected language');
    await page.screenshot({path:path.join(output,'services-fare-restored.png'),fullPage:false});
    await page.locator('#services-expand-airport .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    const beforePending=prechecks;
    await page.evaluate(()=>{
      const state=window.PixkuyFleetSelection.read('airport_transfer');
      state.attempt={state:'committed',key:'pending-priority',payload:{},url:'/v1/public/reservations/checkout',headers:{},response:{bookingStatusToken:'pending-priority-token'}};
      sessionStorage.setItem('pixkuy_fleet_b:airport_transfer',JSON.stringify(state));
      window.__advanceAirportClock(301000);
      window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy'));
    });
    await page.waitForTimeout(250);
    assert.equal(prechecks,beforePending,'A pending payment attempt takes priority over offer refresh');
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt.key),'pending-priority','Offer expiry preserves the pending attempt');
    await page.evaluate(()=>{
      const state=window.PixkuyFleetSelection.read('airport_transfer');
      state.attempt=null;
      sessionStorage.setItem('pixkuy_fleet_b:airport_transfer',JSON.stringify(state));
    });
    await page.locator('.airport-booking__progress li').first().locator('button').click();
    await page.waitForURL(/#airport\/traslado$/);
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.lang==='de');
    assert.equal(await page.locator('.lang').isVisible(),true,'Reload preserves language and restores the selector on Landing');
    assert.equal(writes,0,'The continuation matrix never creates a reservation or hold');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log(JSON.stringify({result:'PASS',mode:'continuation',prechecks,controlledCheckouts:writes,output}));
  }
  async function runStripeEdit() {
    async function configureTrip(direction) {
      await page.evaluate((value)=>{
        window.PixkuyAirportZoneTariff.setAirportSelection({airportId:"mex",direction:value});
        window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:"Hotel MX Condesa — Salamanca 35, Roma Norte",zoneId:"roma_condesa",placeId:"synthetic-place",primaryType:"lodging",lat:19.418,lng:-99.169});
      },direction);
      await page.locator('[data-airport-tariff-role="date"] input').fill("2026-10-05");
      await page.locator('[data-airport-tariff-role="time"] input').fill("22:03");
      await page.locator('[data-airport-tariff-role="passengers"] [data-airport-tariff-fare-key="van_1_2"]').click();
      await page.waitForFunction(()=>!document.querySelector('#services-expand-airport .services-expand__cta').disabled);
    }
    async function assertDropdown(name, role) {
      const control=page.locator('[data-airport-tariff-role="'+role+'"] .services-expand__airport-shell .services-expand__control:visible').first();
      await control.click();
      const panel=page.locator('[data-airport-tariff-dropdown="origin"]');
      await panel.waitFor({state:"visible"});
      const computed=await panel.evaluate(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect(),point={x:r.left+r.width/2,y:Math.min(r.bottom-8,r.top+32)},target=document.elementFromPoint(point.x,point.y),targetField=target?.closest('[data-airport-tariff-role]'),parentField=node.closest('[data-airport-tariff-role]');return{background:s.backgroundColor,opacity:s.opacity,zIndex:s.zIndex,parentZ:parentField&&getComputedStyle(parentField).zIndex,parentRole:parentField?.dataset.airportTariffRole,targetZ:targetField&&getComputedStyle(targetField).zIndex,targetRole:targetField?.dataset.airportTariffRole,top:r.top,bottom:r.bottom,hit:target?.closest('[data-airport-tariff-dropdown]')===node,hitTarget:target?.className||target?.tagName,point};});
      assert.notEqual(computed.background,"rgba(0, 0, 0, 0)","Dropdown has a solid painted background");
      assert.equal(computed.opacity,"1","Dropdown is opaque");
      assert.equal(computed.hit,true,"Dropdown receives pointer hits above lower fields: "+JSON.stringify(computed));
      await page.screenshot({path:path.join(output,name),fullPage:false});
      await control.press("Enter");
      assert.equal(await control.getAttribute("aria-expanded"),"false","Enter selects and closes the dropdown");
      await control.click(); await page.keyboard.press("Escape");
      assert.equal(await control.getAttribute("aria-expanded"),"false","Escape closes the dropdown");
      await control.click(); await page.locator('body').click({position:{x:4,y:4}});
      assert.equal(await control.getAttribute("aria-expanded"),"false","Outside click closes the dropdown");
    }

    await page.goto(origin+"/?service=airport_hotel#services");
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    await page.locator('[data-consent-reject]').click({timeout:1500}).catch(()=>{});
    await configureTrip("airport_to_hotel");
    await assertDropdown("selector-abierto-1440.png", "origin");
    await page.setViewportSize({width:1024,height:900});
    await assertDropdown("selector-abierto-1024.png", "origin");
    await page.setViewportSize({width:1440,height:1000});
    await configureTrip("hotel_to_airport");
    await assertDropdown("selector-abierto-regreso.png", "destination");

    canRetry=true;canModify=true;status="pending_payment";
    await page.goto(origin+"/booking-cancelled.html?token=synthetic-airport-token");
    await page.waitForFunction(()=>window.__qaBookingStatus);
    assert.equal(await page.evaluate(()=>window.__qaBookingStatus.result.raw.actions.canModify),true,"Status exposes canonical edit permission");
    const modifyDiagnostic=await page.evaluate(()=>({view:window.__qaBookingStatus.result.view,serviceType:window.__qaBookingStatus.result.serviceType,editAllowed:window.__qaBookingStatus.result.raw.edit?.allowed,scriptLoaded:Array.from(document.scripts).some(script=>script.src.endsWith('/assets/js/forms/booking-cancelled-edit.js'))}));
    assert.equal(modifyDiagnostic.view+":"+modifyDiagnostic.serviceType+":"+modifyDiagnostic.editAllowed+":"+modifyDiagnostic.scriptLoaded,"pending:airport_transfer:true:true","Modify action prerequisites are loaded: "+JSON.stringify(modifyDiagnostic));
    await page.getByRole('button',{name:'Modificar datos',exact:true}).waitFor();
    const writesBeforeEdit=writes;
    const prechecksBeforeEdit=prechecks;
    await page.getByRole('button',{name:'Modificar datos',exact:true}).click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('#contact-name').waitFor({state:'visible'});
    assert.equal(writes,writesBeforeEdit,"Opening the editor performs no booking or payment write");
    assert.equal(await page.locator('#contact-name').inputValue(),"Ana García","Canonical contact is restored");
    assert.equal(await page.locator('#contact-message').inputValue(),"Vuelo AM123. Dos maletas.","Canonical notes are restored");
    assert.equal(await page.locator('#contact-luggage').inputValue(),"2","Canonical luggage is restored");
    assert.equal(prechecks,prechecksBeforeEdit,"Opening the editor does not revalidate or mutate the pending checkout");
    assert.equal(await page.locator('.airport-booking__notice').innerText(),await page.evaluate(()=>window.PixkuyAirportDesktopView.t('unverified')),'Original offer is clearly shown as an unverified reference');
    assert((await page.locator('.airport-booking__summary').innerText()).includes('800 MXN'),'Original price remains visible while the edit is unverified');
    await capture("edicion-desde-pago-incompleto.png");
    await page.getByRole('button',{name:'Volver al estado del pago sin aplicar cambios',exact:true}).click();
    await page.waitForURL(/booking-cancelled/);
    assert.equal(replacements,0,'Leaving edit mode applies no replacement');
    await page.getByRole('button',{name:'Modificar datos',exact:true}).click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('#contact-name').fill("Ana García López");
    await page.locator('#contact-message').fill("Vuelo AM456. Dos maletas.");
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    assert.equal(await page.getByText(/sustituiremos el enlace de pago pendiente/i).count(),0);
    await capture("revision-sustitucion-pago.png");
    const legalLink=page.locator('.airport-booking__conditions a').first();
    await legalLink.click();
    const legalOverlay=page.locator('#pixkuy-legal-overlay[data-open="1"]');
    await legalOverlay.waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await legalOverlay.waitFor({state:'hidden'});
    await page.locator('.airport-booking__progress li').first().getByRole('button',{name:'Traslado',exact:true}).click();
    await page.waitForURL(/#airport\/traslado$/);
    await assertDropdown("selector-despues-edicion-legal.png", "origin");
    await page.locator('#services-expand-airport .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    assert.equal(await page.getByText(/sustituiremos el enlace de pago pendiente/i).count(),0);
    const replaceButton=page.getByRole('button',{name:'Guardar cambios y continuar al pago',exact:true});
    await replaceButton.evaluate(button=>{button.click();button.click();});
    await page.waitForURL(/booking-checkout/);
    assert.equal(replacements,1,"Double click creates one replacement request");
    assert.equal(lastReplacement.headers['x-pixkuy-booking-token'],'synthetic-airport-token','Replacement uses the canonical public token');
    assert.equal(lastReplacement.headers['x-pixkuy-edit-revision'],'2026-09-28T10:00:00.000Z','Replacement binds the authoritative revision');
    assert.equal(lastReplacement.body.customer.full_name,'Ana García López','Edited contact reaches the canonical replacement payload');
    assert.equal(lastReplacement.body.airport_transfer_notes,'Vuelo AM456. Dos maletas.','Edited notes reach the canonical replacement payload');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('pixkuy_airport_pending_edit_v1')),null,'Successful replacement clears edit mode');

    async function reopenPendingEdit() {
      status='pending_payment';canModify=true;
      await page.goto(origin+'/booking-cancelled.html?token=synthetic-airport-token');
      await page.getByRole('button',{name:'Modificar datos',exact:true}).click();
      await page.waitForURL(/#airport\/datos$/);
      await page.locator('#contact-submit').click();
      await page.waitForURL(/#airport\/revision$/);
    }
    replacementResult='paid';
    await reopenPendingEdit();
    status='confirmed';
    await page.getByRole('button',{name:'Guardar cambios y continuar al pago',exact:true}).click();
    await page.waitForURL(/booking-success/);
    await page.getByRole('heading',{name:'Su reserva está confirmada',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('pixkuy_airport_pending_edit_v1')),null,'Authoritative paid state closes edit mode');

    replacementResult='uncertain';
    await reopenPendingEdit();
    await page.getByRole('button',{name:'Guardar cambios y continuar al pago',exact:true}).click();
    await page.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).waitFor();
    assert.equal(new URL(page.url()).hash,'#airport/revision');
    assert.notEqual(await page.evaluate(()=>sessionStorage.getItem('pixkuy_airport_pending_edit_v1')),null,'Uncertain replacement preserves the recoverable draft');
    assert.equal(replacements,3,'Success, authoritative paid and uncertainty each use one controlled replacement request');
    assert.equal(errors.length,0,errors.join("\n"));
    console.log(JSON.stringify({result:"PASS",mode:"stripe-edit",prechecks,controlledReplacements:replacements,output}));
  }
  async function runRefinement() {
    await page.goto(origin+"/?service=airport_hotel#services");
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    await page.locator('[data-consent-reject]').click({timeout:1500}).catch(()=>{});
    await page.evaluate(()=>{
      window.PixkuyAirportZoneTariff.setAirportSelection({airportId:"mex",direction:"airport_to_hotel"});
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:"Hotel MX Condesa — Salamanca 35, Roma Norte",zoneId:"roma_condesa",placeId:"synthetic-place",primaryType:"lodging",lat:19.418,lng:-99.169});
    });
    await page.locator('[data-airport-tariff-role="date"] input').fill("2026-10-05");
    await page.locator('[data-airport-tariff-role="time"] input').fill("22:03");
    await page.locator('[data-airport-tariff-role="passengers"] [data-airport-tariff-fare-key="van_1_2"]').click();
    await page.locator('#services-expand-airport .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    assert.equal(await page.locator('.airport-booking h1').evaluate(el=>document.activeElement===el),true,'Programmatic focus reaches the data heading');
    await page.locator('#contact-name').fill("Ana García");
    await page.locator('#contact-phone').fill("+34612345678");
    await page.locator('#contact-email').fill("ana@example.com");
    await page.locator('#contact-luggage').fill("2");
    await page.locator('#contact-message').fill("Vuelo AM123. Dos maletas.");
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    assert.equal(await page.locator('.airport-booking__progress li').count(),4,'Data shows four connected steps');
    assert.equal(await page.locator('.airport-booking__progress [aria-current="step"] .airport-booking__step-marker').innerText(),"2",'Data is the current numbered step');
    assert.equal(await page.locator('.airport-booking__progress [aria-current="step"] .airport-booking__step-label').innerText(),"Datos",'Data current step keeps its translated label');
    await capture("datos-final-1440.png");
    await page.setViewportSize({width:1024,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Data has no 1024 overflow');
    await capture("datos-final-1024.png");
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    assert.equal(await page.locator('.airport-booking__progress .is-complete').count(),2,'Review exposes completed trip and data steps');
    assert.equal(await page.locator('.airport-booking__progress [aria-current="step"] .airport-booking__step-marker').innerText(),"3",'Review is the current numbered step');
    assert.equal(await page.locator('.airport-booking__progress [aria-current="step"] .airport-booking__step-label').innerText(),"Revisión",'Review current step keeps its translated label');
    const progressData=page.locator('.airport-booking__progress li').nth(1).getByRole('button',{name:'Datos',exact:true});
    assert.equal(await progressData.count(),1,'Completed Data step remains available for permitted navigation');
    await progressData.click();
    await page.waitForURL(/#airport\/datos$/);
    await page.goBack();
    await page.waitForURL(/#airport\/revision$/);
    assert.equal(await page.locator('.airport-booking__block-heading button[aria-label^="Editar:"]').count(),3,'Review has three specifically named edit actions');
    assert.equal(await page.locator('.airport-booking__conditions a').count(),3,'Review preserves the three legal links');
    assert.equal(await page.locator('.airport-booking__conditions button').count(),0,'Legal acceptance has no loose edit action');
    assert.equal(await page.locator('.airport-booking__back-action').count(),0,'Review omits the redundant secondary back action');
    const legalHrefs=await page.locator('.airport-booking__conditions a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
    assert(legalHrefs.every(Boolean),'Legal links retain their real destinations');
    await capture("revision-final-1440.png");
    assert.equal(await page.locator('.lang').isHidden(),true,'Review hides the language selector');
    assert.equal(await page.locator('.airport-booking__progress li').count(),4,'Review preserves step semantics');
    await page.setViewportSize({width:1024,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Review has no 1024 overflow');
    await capture("revision-final-1024.png");
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole("button",{name:"Continuar al pago",exact:true}).click();
    await page.waitForURL(/booking-checkout/);
    assert.equal(writes,1,'Directed flow creates exactly one controlled checkout');
    status="confirmed";
    await page.goto(origin+"/booking-success.html?token=synthetic-airport-token");
    await page.getByRole('heading',{name:"Su reserva está confirmada",exact:true}).waitFor();
    assert.equal(await page.locator('.airport-booking__progress .is-complete').count(),4,'Confirmed result shows four completed steps');
    assert.equal(await page.locator('.airport-booking__progress [aria-current="step"]').count(),0,'Confirmed result has no editable current step');
    assert.equal(await page.getByRole('button',{name:'Volver al inicio',exact:true}).count(),2,'Confirmed result exposes contextual and visible Home actions');
    assert.equal(await page.getByRole('link',{name:/Contacto · Pixkuy/}).count(),1,'Confirmed result exposes the existing contact action');
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt),null,'Authoritative paid result completes the exact attempt');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('pixkuy_booking_checkout:synthetic-airport-token')),null,'Exact checkout handoff is cleared');
    await capture("confirmacion-final-1440.png");
    await page.setViewportSize({width:1024,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Confirmation has no 1024 overflow');
    await capture("confirmacion-final-1024.png");
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Volver al inicio',exact:true}).last().click();
    await page.waitForURL(url=>url.pathname==='/' && url.hash==='');
    await page.locator('[data-service-expand-trigger="airport"]').click();
    await page.locator('#services-expand-airport:not([hidden])').waitFor();
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt),null,'Opening Airport after Home is not blocked by the completed attempt');
    assert.equal(await page.locator('[data-fleet-selection="airport_transfer"]').count(),0,'Completed attempt exposes no recovery control');

    delayCheckout=500;
    await page.evaluate(selected=>{
      const payload={fleet_selection:{version:1,model_id:selected.modelId,model_revision:selected.modelRevision}};
      sessionStorage.setItem('pixkuy_fleet_b:airport_transfer',JSON.stringify({version:1,selected,offer:{version:1,status:'available',requestKey:'late-old',models:[selected]},attempt:null,explicit:false}));
      window.__lateAttempt=window.PixkuyFleetSelection.fetchCheckout('airport_transfer','/v1/public/reservations/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(()=>({ok:true}),error=>({ok:false,message:error.message}));
    },model);
    await page.waitForTimeout(80);
    await page.evaluate(selected=>{
      const payload={fleet_selection:{version:1,model_id:selected.modelId,model_revision:selected.modelRevision}};
      sessionStorage.setItem('pixkuy_fleet_b:airport_transfer',JSON.stringify({version:1,selected,offer:{version:1,status:'available',requestKey:'new-offer',models:[selected]},attempt:{state:'committed',key:'new-attempt',payload,url:'/v1/public/reservations/checkout',headers:{},response:{bookingStatusToken:'new-token'}},explicit:false}));
    },model);
    const late=await page.evaluate(()=>window.__lateAttempt);
    assert.deepEqual(late,{ok:false,message:'FLEET_ATTEMPT_CONFLICT'},'Late response from the old request is rejected');
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt.key),'new-attempt','Late response cannot clear or replace the new attempt');
    delayCheckout=0;

    await page.evaluate(()=>sessionStorage.setItem('pixkuy_booking_checkout:new-token',JSON.stringify({token:'new-token',checkoutUrl:'https://checkout.stripe.com/c/pay/new',redirected:false,createdAt:new Date().toISOString()})));
    status="confirmed";
    await page.goto(origin+"/booking-success.html?token=old-token");
    await page.getByRole('heading',{name:"Su reserva está confirmada",exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt.key),'new-attempt','Confirmed result for another token cannot clear the new attempt');
    assert.notEqual(await page.evaluate(()=>sessionStorage.getItem('pixkuy_booking_checkout:new-token')),null,'Confirmed result for another token preserves the new handoff');

    await page.evaluate(selected=>{
      const payload={fleet_selection:{version:1,model_id:selected.modelId,model_revision:selected.modelRevision}};
      sessionStorage.setItem('pixkuy_fleet_b:airport_transfer',JSON.stringify({version:1,selected,offer:{version:1,status:'available',requestKey:'pending-offer',models:[selected]},attempt:{state:'committed',key:'pending-attempt',payload,url:'/v1/public/reservations/checkout',headers:{},response:{bookingStatusToken:'pending-token'}},explicit:false}));
    },model);
    status="pending_payment";
    await page.goto(origin+"/booking-success.html?token=pending-token");
    await page.getByRole('heading',{name:"Estamos verificando su pago",exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt.key),'pending-attempt','Pending result preserves the recoverable attempt');
    await capture("pago-pendiente-final.png");
    statusFailure=true;
    await page.reload();
    await page.locator('[data-booking-status-desktop] [data-booking-status-title]').getByText('No pudimos consultar el estado',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt.key),'pending-attempt','Status error preserves the recoverable attempt');
    statusFailure=false;

    service='direct_transfer';status='confirmed';
    await page.goto(origin+"/booking-success.html?token=other-service-token");
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.airport-booking').count(),0,'Other services retain their existing result layout');
    service='airport_transfer';
    await page.setViewportSize({width:390,height:844});
    await page.goto(origin+"/booking-success.html?token=pending-token");
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.airport-booking').count(),0,'Airport keeps the existing mobile result layout');

    const emailPath=path.resolve(__dirname,"../../../evidence/airport-desktop-refinement-20260928/email/airport-confirmation-preview.html");
    const emailPage=await context.newPage();
    await emailPage.setViewportSize({width:900,height:1100});
    await emailPage.goto(pathToFileURL(emailPath).href);
    assert((await emailPage.locator('body').innerText()).includes('3–4 pasajeros'),'Local email preview renders the canonical passenger band');
    await emailPage.screenshot({path:path.resolve(path.dirname(emailPath),'airport-confirmation-preview.png'),fullPage:true});
    await emailPage.close();
    assert.equal(errors.length,0,errors.join("\n"));
    console.log(JSON.stringify({result:"PASS",mode:"refinement",prechecks,controlledCheckouts:writes,output}));
  }
  page.on("pageerror", error => errors.push(error.stack || error.message));
  try {
    if (mobilePhase2) {
      const phase2Output=mobileIntegrated || reviewUncertainty?runOutput:visualRestore?path.resolve(output,'../../airport-mobile-visual-restore-20260930/browser'):mobileSharedOnly?path.join(output,'shared-regressions'):desktopSelectionOnly?path.join(output,'desktop-selection'):output;
      await fs.mkdir(phase2Output,{recursive:true});
      await require(mobileSharedOnly || integratedFleet?'./airport-mobile-phase1-regression':'./airport-mobile-phase2-regression')({page,context,origin,output:phase2Output,baseline:false,desktopSelectionOnly,visualRestore,mobileRefinement,refinementBefore,refinementWebkit,reviewCompact,mobileIntegrated:mobileIntegrated && !integratedMatrix,integratedBefore,integratedWebkit,model,errors,
        fixture(value) { mode=value.mode || 'available'; models=value.models || [model]; mobileDelay=value.delay || (()=>0); mobilePrice=value.price || null; mobileNext=value.next || null; mobileCode=value.code || 'NO_AVAILABILITY'; mobileCheckoutMode=value.checkout || 'not_committed'; if(value.status)status=value.status; if(value.service)service=value.service; if(value.canModify!==undefined)canModify=value.canModify; if(value.canRetry!==undefined)canRetry=value.canRetry; },
        stats() { return {prechecks,writes,requests:mobileRequests,checkouts:mobileCheckouts,replacements:mobileReplacements,statuses:mobileStatuses,retries}; }
      });
      return;
    }
    if (mobilePhase1) {
      await require('./airport-mobile-phase1-regression')({page,context,origin,output,baseline:mobileBaseline,model,errors,
        fixture(value) { mode=value.mode || 'available'; models=value.models || [model]; mobileDelay=value.delay || (()=>0); },
        stats() { return {prechecks,writes,requests:mobileRequests}; }
      });
      return;
    }
    if(leadSuggestionOnly) {
      const results=[];
      for(const scenario of [
        {name:'immediate-minute-boundary',initial:'2026-09-30T08:54:59.900Z',click:'2026-09-30T08:55:00.100Z',date:'2026-10-01',time:'02:00'},
        {name:'aged-twenty-minutes',initial:'2026-09-30T08:54:10Z',click:'2026-09-30T09:14:10Z',date:'2026-10-01',time:'02:00'},
        {name:'aged-midnight',initial:'2026-10-01T05:58:50Z',click:'2026-10-01T06:03:10Z',date:'2026-10-01',time:'23:00'},
        {name:'occupied-at-click',initial:'2026-09-30T08:54:10Z',click:'2026-09-30T09:14:10Z',date:'2026-10-01',time:'02:00',occupied:true}
      ]) {
        suggestionClock={now:scenario.initial,occupied:false};
        await page.clock.setFixedTime(new Date(scenario.initial));
        await page.goto(origin+'/?service=airport_hotel&lang=en#services',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.PixkuyAirportZoneTariff);
        await page.locator('[data-consent-reject]').click({timeout:500}).catch(()=>{});
        await page.evaluate(()=>{
          window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
          window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel NH Collection Mexico City Reforma',zoneId:'reforma',placeId:'suggestion-test',primaryType:'lodging',lat:19.4253,lng:-99.1656});
        });
        await page.locator('[data-airport-tariff-role="date"] input').fill(scenario.date);
        await page.locator('[data-airport-tariff-role="time"] input').fill(scenario.time);
        await page.locator('[data-airport-tariff-role="passengers"] [data-airport-tariff-fare-key="van_3_4"]').click();
        const link=page.locator('[data-airport-tariff-availability] .shared-availability-suggestion__link');
        await link.waitFor();
        const offered=await link.innerText();
        suggestionClock={now:scenario.click,occupied:!!scenario.occupied};
        await page.clock.setFixedTime(new Date(scenario.click));
        const before=prechecks;
        await link.click();
        assert.equal(await page.locator('#services-expand-airport .services-expand__cta').isDisabled(),true,'Continue stays disabled while refreshing/revalidating');
        await page.waitForFunction(()=>['available','unavailable','error'].includes(document.querySelector('#services-expand-airport').getAttribute('data-airport-mobile-availability-state')));
        const latest=suggestionCalls.at(-1);
        const observed={name:scenario.name,offered,latest,date:await page.locator('[data-airport-tariff-role="date"] input').inputValue(),time:await page.locator('[data-airport-tariff-role="time"] input').inputValue(),disabled:await page.locator('#services-expand-airport .services-expand__cta').isDisabled(),requests:prechecks-before};
        results.push(observed);
        await fs.writeFile(path.join(output,'lead-time-suggestion.json'),JSON.stringify(results,null,2));
        assert.equal(observed.disabled,!!scenario.occupied,JSON.stringify(observed));
        if(!scenario.occupied) {
          assert.equal(observed.requests,2,'One refresh and one validation, with no repeated suggestion loop');
          assert.equal(latest.allowed,true);
          assert.ok(Date.parse(observed.date+'T'+observed.time+':00-06:00')-Date.parse(scenario.click)>=86400000,'Selected instant respects full 24h including seconds');
          assert.equal(observed.date,latest.date);assert.equal(observed.time,latest.time);
        } else {
          assert.equal(latest.code,'AIRPORT_TRANSFER_MINIMUM_LEAD_TIME_NOT_MET');
          assert.equal(latest.next,undefined,'No selectable suggestion when operational availability rejects it');
        }
        assert.equal(writes,0);
        await page.locator('#services-expand-airport').screenshot({path:path.join(output,scenario.name+'.png')});
      }
      console.log(JSON.stringify({result:'PASS',mode:'lead-time-suggestion',results,writes,provider:'controlled operational availability; real backend schema/service',output}));
      return;
    }
    if(sequenceOnly) {
      await context.unrouteAll();
      const network=await context.newCDPSession(page);
      await network.send('Fetch.enable',{patterns:[{urlPattern:'https://checkout.stripe.com/*'},{urlPattern:origin+'/.netlify/functions/booking-public-config'},{urlPattern:'https://unpkg.com/*libphonenumber-js*'}]});
      const phoneLibrary=await fs.readFile(path.resolve(__dirname,'../../../pixkuy_frontend/node_modules/libphonenumber-js/bundle/libphonenumber-max.js'));
      network.on('Fetch.requestPaused',async event=>{
        const config=event.request.url.includes('/booking-public-config');
        const phone=event.request.url.includes('unpkg.com');
        const body=phone?phoneLibrary:config?JSON.stringify({ok:true,bookingApi:{apiBaseUrl:isolatedApi},publicSite:{siteKey:'local_pixkuy_site_key'}}):'<!doctype html><title>Controlled payment boundary</title>';
        await network.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:phone?'application/javascript':config?'application/json':'text/html'}],body:Buffer.from(body).toString('base64')});
      });
      const actualCheckouts=[]; const availability=[];
      page.on('response',async response=>{
        if(response.url()===isolatedApi+'/v1/public/reservations/checkout' && response.request().method()==='POST') actualCheckouts.push({body:await response.json(),payload:response.request().postDataJSON(),key:response.request().headers()['idempotency-key'],headers:response.request().headers()});
        if(response.url().includes(isolatedApi+'/v1/public/reservations/airport-transfer-availability-precheck') && response.request().method()==='POST') availability.push({payload:response.request().postDataJSON(),body:await response.json(),headers:response.request().headers()});
      });
      async function configure(date) {
        await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
        await page.locator('[data-consent-reject]').click({timeout:800}).catch(()=>{});
        await page.evaluate(()=>{
          window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
          window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel NH Collection Mexico City Reforma',zoneId:'reforma',placeId:'isolated-reforma-place',primaryType:'lodging',lat:19.4253,lng:-99.1656});
          window.PixkuyRecaptchaEnterprise={execute:async()=> 'isolated-recaptcha'};
        });
        await page.locator('[data-airport-tariff-role="date"] input').fill(date);
        await page.locator('[data-airport-tariff-role="time"] input').fill('10:00');
        await page.locator('[data-airport-tariff-fare-key="van_3_4"]').click();
        await page.waitForFunction(date=>{const state=window.PixkuyFleetSelection.read('airport_transfer');return state.offer && state.precheck?.payload.date===date && window.PixkuyFleetSelection.airportOfferStatus().valid;},date);
      }
      async function continueToCheckout() {
        await page.locator('#services-expand-airport .services-expand__cta').filter({hasNot:page.locator('[data-fleet-selection]')}).last().click();
        await page.waitForURL(/#airport\/datos$/);
        await page.locator('#contact-name').fill('Pasajero Sintético');
        await page.locator('#contact-phone').fill('+34612345678');
        await page.locator('#contact-email').fill('sequence@example.invalid');
        await page.locator('#contact-luggage').fill('5');
        await page.locator('#contact-message').fill('Nota de secuencia aislada');
        await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
        await page.locator('#contact-submit').click();
        await page.waitForURL(/#airport\/revision$/);
        await page.getByRole('button',{name:'Continuar al pago',exact:true}).click();
        await page.waitForURL('https://checkout.stripe.com/**');
        return actualCheckouts.at(-1);
      }
      await page.goto(origin+'/?service=airport_hotel#services');
      await configure('2027-01-12');
      await page.getByRole('radio',{name:'Ford Explorer',exact:true}).check();
      const first=await continueToCheckout();
      assert(first.body.checkoutUrl && first.body.bookingStatusToken,'A reached the controlled checkout');
      const event=airportSql({operation:'sequence',action:'payment',sessionId:first.body.paymentAttempt.providerSessionId});
      const paid=await context.request.post(isolatedApi+'/v1/webhooks/stripe',{headers:{'content-type':'application/json','stripe-signature':event.signature},data:event.payload});
      const paymentResult=await paid.json();
      assert.equal(paymentResult.processingOutcome,'confirmed',JSON.stringify(paymentResult));
      await page.goto(origin+'/booking-success.html?token='+encodeURIComponent(first.body.bookingStatusToken));
      await page.getByRole('heading',{name:'Su reserva está confirmada',exact:true}).waitFor();
      const completed=await page.evaluate(()=>({fleet:window.PixkuyFleetSelection.read('airport_transfer'),draft:!!sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot'),edit:!!sessionStorage.getItem('pixkuy_airport_pending_edit_v1')}));
      const confirmedA=airportSql({operation:'sequence',action:'rows'})[0];
      assert.equal(confirmedA.status,'confirmed');
      assert.equal(confirmedA.payment_status,'paid');
      await page.getByRole('button',{name:'Volver al inicio',exact:true}).first().click();
      await page.waitForURL(origin+'/');
      await page.goto(origin+'/?service=airport_hotel#services');
      await configure('2027-01-21');
      const stateB=await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer'));
      await page.screenshot({path:path.join(output,'after-paid-new-booking.png'),fullPage:true});
      console.log(JSON.stringify({mode:process.argv.includes('--new-booking-baseline')?'new-booking-baseline':'new-booking-fixed',aConfirmed:true,postConfirmation:{attempt:!!completed.fleet.attempt,selected:completed.fleet.selected?.name,offer:!!completed.fleet.offer,precheck:!!completed.fleet.precheck,draft:completed.draft,edit:completed.edit},b:{selected:stateB.selected?.name,explicit:stateB.explicit,models:stateB.offer?.models.map(x=>x.name)},availability:availability.map(x=>({date:x.payload.date,selected:!!x.payload.fleet_selection,models:x.body.result?.fleet?.models.map(m=>m.name)}))}));
      if(process.argv.includes('--new-booking-baseline')) {
        airportSql({operation:'sequence',action:'block-ford',payload:first.payload});
        await page.locator('[data-airport-tariff-role="time"] input').fill('10:01');
        await page.locator('[data-airport-tariff-role="time"] input').fill('10:00');
        await page.getByRole('button',{name:'Confirmar modelo: BYD M9',exact:true}).waitFor();
        const warning=await page.locator('[data-fleet-selection="airport_transfer"]').innerText();
        assert(warning.includes('El modelo elegido ya no está disponible'));
        const fare=await page.evaluate(()=>window.PixkuyAirportZoneTariff.fareValue.textContent);
        const disabled=await page.evaluate(()=>window.PixkuyAirportZoneTariff.cta.disabled);
        await page.screenshot({path:path.join(output,'baseline-consumed-ford-warning.png'),fullPage:true});
        await page.getByRole('button',{name:'Confirmar modelo: BYD M9',exact:true}).click();
        await page.waitForFunction(()=>!window.PixkuyAirportZoneTariff.cta.disabled);
        console.log(JSON.stringify({result:'REPRODUCED',cause:'consumed explicit selection retained',realSqlThirdPartyConflict:true,previousModel:'Ford Explorer',nextModel:'BYD M9',fare,disabled,explicitConfirmationRecovers:true}));
        return;
      }
      assert.equal(completed.fleet.selected,null,'Paid selection is consumed');
      assert(!completed.fleet.attempt && !completed.fleet.offer && !completed.fleet.precheck && !completed.fleet.draft && !completed.fleet.reservationToken && !completed.draft && !completed.edit,'Only the confirmed reservation commercial context is closed');
      assert.equal(stateB.selected,null,'A new two-model draft requires its own selection');
      assert(availability.filter(x=>x.payload.date==='2027-01-21').every(x=>!x.payload.fleet_selection && !x.payload.pending_edit),'B sends no consumed selection or edit authority');
      assert(!(await page.locator('[data-fleet-selection="airport_transfer"]').innerText()).includes('El modelo elegido ya no está disponible'));
      await page.getByRole('radio',{name:'Ford Explorer',exact:true}).check();
      // Real HTTP response for the previous trip arrives after the newer one.
      const slowRequest=page.waitForRequest(r=>r.method()==='POST' && r.url().includes('availability-precheck') && r.postDataJSON()?.date==='2027-01-20');
      const slowReply=page.waitForResponse(r=>r.request().method()==='POST' && r.url().includes('availability-precheck') && r.request().postDataJSON()?.date==='2027-01-20');
      await page.locator('[data-airport-tariff-role="date"] input').fill('2027-01-20');
      await slowRequest;
      await page.locator('[data-airport-tariff-role="date"] input').fill('2027-01-21');
      await page.waitForFunction(()=>window.PixkuyFleetSelection.read('airport_transfer').precheck?.payload.date==='2027-01-21' && window.PixkuyFleetSelection.airportOfferStatus().valid);
      await (await slowReply).finished();
      assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').precheck.payload.date),'2027-01-21','Late prior trip response cannot overwrite B');
      airportSql({operation:'sequence',action:'block-ford',payload:first.payload});
      await page.locator('[data-airport-tariff-role="time"] input').fill('10:01');
      await page.locator('[data-airport-tariff-role="time"] input').fill('10:00');
      await page.getByRole('button',{name:'Confirmar modelo: BYD M9',exact:true}).waitFor();
      assert(await page.evaluate(()=>window.PixkuyAirportZoneTariff.cta.disabled),'A real loss of B selection still requires confirmation');
      await page.getByRole('button',{name:'Confirmar modelo: BYD M9',exact:true}).click();
      await page.waitForFunction(()=>!window.PixkuyAirportZoneTariff.cta.disabled);
      await page.screenshot({path:path.join(output,'new-b-valid-offer.png'),fullPage:true});
      const second=await continueToCheckout();
      assert.notEqual(second.body.bookingStatusToken,first.body.bookingStatusToken);
      assert.notEqual(second.key,first.key);
      assert.notEqual(second.body.paymentAttempt.providerSessionId,first.body.paymentAttempt.providerSessionId);
      assert(!second.headers['x-pixkuy-booking-token'] && !second.headers['x-pixkuy-edit-revision'],'B checkout is new, not a replacement');
      assert.equal(second.payload.airport_transfer_passenger_fare_key,'van_3_4');
      assert(!Object.hasOwn(second.payload,'airport_transfer_passengers'),'No exact headcount is invented');
      assert.equal(actualCheckouts.length,2,'One creation each for A and B');
      const rows=airportSql({operation:'sequence',action:'rows'});
      assert.equal(rows.length,2); assert.deepEqual(rows[0],confirmedA,'A and its original occupancy remain intact');
      assert.notEqual(rows[1].id,rows[0].id); assert.equal(rows[1].attempts,1);
      assert(rows.every(row=>row.sent_notifications===0));
      // Visiting A again must not retire B's pending checkout or its editor.
      await page.goto(origin+'/booking-success.html?token='+encodeURIComponent(first.body.bookingStatusToken));
      await page.getByRole('heading',{name:'Su reserva está confirmada',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt.key),second.key);
      const originalAvailability=availability.find(x=>x.payload.date==='2027-01-12');
      const overlap=await page.evaluate(async ({url,payload,siteKey})=>{const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-pixkuy-site-key':siteKey},body:JSON.stringify(payload)});return {status:response.status,body:await response.json()};},{url:isolatedApi+'/v1/public/reservations/airport-transfer-availability-precheck',payload:originalAvailability.payload,siteKey:originalAvailability.headers['x-pixkuy-site-key']});
      assert.equal(overlap.status,200);
      assert.deepEqual(overlap.body.result.fleet.models.map(model=>model.name),['BYD M9'],'A paid Ford remains occupied in its real interval');
      await page.goto(origin+'/booking-cancelled.html?token='+encodeURIComponent(second.body.bookingStatusToken));
      await page.getByRole('button',{name:'Modificar datos',exact:true}).click();
      await page.waitForURL(/#airport\/datos$/);
      await page.locator('#contact-message').fill('Nota B conservada tras recarga');
      const editBefore=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')));
      assert.equal(editBefore.token,second.body.bookingStatusToken);
      await page.reload();
      await page.locator('#contact-message').waitFor({state:'visible'});
      assert.equal(await page.locator('#contact-message').inputValue(),'Nota B conservada tras recarga');
      assert.equal(await page.locator('#contact-luggage').inputValue(),'5');
      assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1'))),editBefore);
      await page.evaluate(()=>{window.PixkuyRecaptchaEnterprise={execute:async()=> 'isolated-recaptcha'};});
      await page.locator('#contact-submit').click();
      await page.waitForURL(/#airport\/revision$/);
      assert((await page.locator('.airport-booking').innerText()).includes('BYD M9'));
      await page.screenshot({path:path.join(output,'pending-b-restored-review.png'),fullPage:true});
      assert.equal(actualCheckouts.length,2,'Recovery/reload creates no further reservation');
      assert.deepEqual(airportSql({operation:'sequence',action:'rows'}),rows,'Recovery and review do not mutate either hold');
      const replacedReply=page.waitForResponse(r=>r.url()===isolatedApi+'/v1/public/reservations/replace-checkout' && r.request().method()==='POST');
      await page.getByRole('button',{name:'Guardar cambios y continuar al pago',exact:true}).click();
      const replacedHttp=await replacedReply;
      assert.equal(replacedHttp.status(),200);
      const replaced=await replacedHttp.json();
      await page.waitForURL('https://checkout.stripe.com/**');
      assert.equal(replaced.bookingStatusToken,second.body.bookingStatusToken);
      const afterReplacement=airportSql({operation:'sequence',action:'rows'});
      assert.deepEqual(afterReplacement[0],confirmedA);
      assert.equal(afterReplacement[1].id,rows[1].id);
      assert.equal(afterReplacement[1].hold_id,rows[1].hold_id);
      assert.equal(afterReplacement[1].expires_at,rows[1].expires_at);
      assert.equal(afterReplacement[1].attempts,2);
      const bEvent=airportSql({operation:'sequence',action:'payment',sessionId:replaced.paymentAttempt.providerSessionId});
      const bPaid=await context.request.post(isolatedApi+'/v1/webhooks/stripe',{headers:{'content-type':'application/json','stripe-signature':bEvent.signature},data:bEvent.payload});
      assert.equal((await bPaid.json()).processingOutcome,'confirmed');
      await page.goto(origin+'/booking-success.html?token='+encodeURIComponent(second.body.bookingStatusToken));
      await page.getByRole('heading',{name:'Su reserva está confirmada',exact:true}).waitFor();
      const bCompleted=await page.evaluate(()=>({fleet:window.PixkuyFleetSelection.read('airport_transfer'),edit:sessionStorage.getItem('pixkuy_airport_pending_edit_v1'),snapshot:sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot')}));
      assert(!bCompleted.fleet.selected && !bCompleted.fleet.offer && !bCompleted.fleet.reservationToken && !bCompleted.edit && !bCompleted.snapshot,'A paid replacement closes its own context too');
      assert.equal(errors.length,0,errors.join('\n'));
      const evidence={result:'PASS',mode:'new-booking',sameBrowser:true,storageClearedByTest:false,realHttp:true,nativeCors:true,sql:true,checkouts:2,replacements:1,distinctReservations:true,distinctIdempotency:true,aUnchanged:true,paidOccupancyRespected:true,realBModelChangeConfirmed:true,lateResponseIgnored:true,pendingEditorReload:true,paidReplacementContextClosed:true,holdUnchanged:true,finalCheckoutHost:new URL(second.body.checkoutUrl).hostname,providerAndAppClock:'fixed; known expiry boundary remains open',output};
      await fs.writeFile(path.join(output,'sequence-result.json'),JSON.stringify(evidence,null,2)+'\n');
      console.log(JSON.stringify(evidence));
      return;
    }
    if(resultDeltaOnly) {
      const url=origin+'/booking-cancelled.html?token=isolated-airport-edit-token&lang=es';
      let queries=0;
      page.on('request',request=>{if(request.url().startsWith(isolatedApi+'/v1/public/reservations/status')) queries++;});
      const before=airportSql({operation:'metrics'});
      for(const width of [1440,1024]) {
        await page.setViewportSize({width,height:1000});
        for(const vehicle of ['BYD M9','Ford Explorer']) {
          airportSql({operation:'result-fixture',model:vehicle});
          await page.goto(url);
          await page.locator('.airport-booking--result').waitFor();
          await page.locator('[data-consent-reject]').click({timeout:800}).catch(()=>{});
          const photo=page.locator('.airport-booking__photo');
          await photo.evaluate(img=>img.decode());
          assert.equal(await photo.getAttribute('alt'),vehicle);
          const projected=airportSql({operation:'status'});
          assert((await photo.getAttribute('src')).includes(projected.reservation.vehiclePhotoUrl));
          const pay=page.getByRole('button',{name:'Continuar al pago',exact:true});
          const edit=page.getByRole('button',{name:'Modificar datos',exact:true});
          const check=page.locator('[data-airport-check-status]');
          const boxes=await Promise.all([pay,edit,check].map(x=>x.boundingBox()));
          assert(boxes[1].y>=boxes[0].y+boxes[0].height+10 && boxes[2].y>=boxes[1].y+boxes[1].height+10);
          await pay.focus(); await page.keyboard.press('Tab'); assert(await edit.evaluate(el=>el===document.activeElement));
          await page.keyboard.press('Tab'); assert(await check.evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle!=='none'));
          const queryStart=queries;
          await check.evaluate(el=>{el.click();el.click();});
          assert.equal(await check.textContent(),'Comprobando…');
          assert(await check.isDisabled());
          await page.waitForFunction(()=>document.querySelector('[data-airport-check-status]')?.textContent==='Comprobar estado del pago');
          assert.equal(queries,queryStart+1,'Double click produces one status GET');
          assert((await page.locator('.airport-booking__lead').textContent()).includes('Puede continuar con el pago de su reserva'));
          const rows=await page.locator('.airport-booking__detail--half').evaluateAll(rows=>rows.map(x=>x.getBoundingClientRect().y));
          assert.equal(rows[0],rows[1]); assert.equal(rows[2],rows[3]);
          assert(!(await page.locator('.airport-booking').innerText()).includes('Maletas (opcional)'));
          await capture(`pending-${vehicle.split(' ')[0].toLowerCase()}-${width}.png`);
        }
        airportSql({operation:'result-fixture',model:'Ford Explorer',state:'confirmed'});
        await page.goto(origin+'/booking-success.html?token=isolated-airport-edit-token&lang=es');
        await page.locator('.airport-booking--result').waitFor();
        await page.locator('.airport-booking__photo').evaluate(img=>img.decode());
        assert.equal(await page.locator('.airport-booking__payment-actions button').count(),0);
        await capture(`confirmed-${width}.png`);
      }
      for(const photo of ['missing','broken']) {
        airportSql({operation:'result-fixture',model:'Ford Explorer',photo});
        await page.goto(url); await page.locator('.airport-booking--result').waitFor();
        await page.waitForFunction(()=>!document.querySelector('.airport-booking__photo'));
        assert.equal(await page.locator('.airport-booking__vehicle h3').textContent(),'Ford Explorer');
        await capture(`photo-${photo}.png`);
      }
      airportSql({operation:'result-fixture',state:'hold_expired'});
      await page.goto(url); await page.locator('.airport-booking--result').waitFor();
      assert.equal(await page.getByRole('button',{name:'Continuar al pago',exact:true}).count(),0);
      await capture('expired-1024.png');
      airportSql({operation:'result-fixture'});
      await page.goto(url); await page.locator('.airport-booking--result').waitFor();
      // Transport failure, without fabricating a successful status response.
      await context.setOffline(true);
      await page.locator('[data-airport-check-status]').click();
      await page.getByText('No hemos podido comprobar el estado del pago. Inténtelo de nuevo.',{exact:true}).waitFor();
      assert(await page.locator('[data-airport-check-status]').isEnabled());
      await capture('status-error-1024.png');
      await context.setOffline(false);
      await page.setViewportSize({width:390,height:844});
      await page.goto(url); await page.locator('[data-booking-cancelled-mobile]').waitFor({state:'visible'});
      assert.equal(await page.locator('.airport-booking').count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      await page.screenshot({path:path.join(output,'pending-mobile-390.png'),fullPage:true});
      assert.deepEqual(airportSql({operation:'metrics'}),before,'Status checks create no payment or hold');
      assert.equal(writes+retries+replacements,0);
      console.log(JSON.stringify({result:'PASS',mode:'result-delta',sql:true,http:true,widths:[1440,1024,390],photos:['BYD','Ford labelled storage fixture','missing','broken'],states:['pending','checking','confirmed','expired','error'],keyboard:true,duplicateCheckPrevented:true,noPaymentWrites:true}));
      return;
    }
    if(holdEditOnly) {
      const initial=airportSql({operation:'status'});
      const initialMetrics=httpEditOnly?airportSql({operation:'metrics'}):null;
      const editedNotes=initial.reservation.customerNotes+' editada';
      assert(initial.edit.allowed);
      assert.equal(initial.reservation.passengerCount,null);
      await page.goto(origin+'/booking-cancelled.html?token=isolated-airport-edit-token');
      await page.getByRole('button',{name:'Modificar datos',exact:true}).click();
      await page.waitForURL(/#airport\/datos$/);
      await page.locator('#contact-message').waitFor({state:'visible'});
      await page.locator('[data-consent-reject]').click({timeout:1500}).catch(()=>{});
      assert.equal(await page.locator('#contact-message').inputValue(),initial.reservation.customerNotes);
      assert.equal(await page.locator('#contact-luggage').inputValue(),'5');
      assert.equal(prechecks,0);
      if(!process.argv.includes('--hold-edit-baseline')) {
        await page.waitForFunction(()=>window.PixkuyAirportDesktopView.t('notesHelp')!=='notesHelp');
        const editor=await page.locator('.airport-booking').innerText();
        assert(!editor.includes('notesHelp'));
        assert(editor.includes('Importe original'));
        assert(editor.includes('no amplía el plazo de pago original'));
        assert(editor.includes('Aeropuerto Internacional Benito Juárez'));
        assert(!editor.includes('MEX — MEX'));
      }
      await page.locator('#contact-message').fill(editedNotes);
      if(process.argv.includes('--contact-email')) await page.locator('#contact-email').fill('edited@example.invalid');
      if(httpEditOnly) await page.evaluate(()=>{window.PixkuyRecaptchaEnterprise={execute:async()=> 'isolated-recaptcha'};});
      await page.locator('#contact-submit').click();
      if(process.argv.includes('--hold-edit-conflict')) {
        await page.waitForURL(/#airport\/traslado$/);
        await page.getByRole('button',{name:'Confirmar modelo: Ford Explorer',exact:true}).waitFor();
        const selector=await page.locator('[data-fleet-selection="airport_transfer"]').innerText();
        assert(!selector.includes('Volver al formulario'));
        assert(!selector.includes('Los datos se conservan. Vuelve al formulario'));
        assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').selected),null);
        assert.equal(replacements,0);
        console.log(JSON.stringify({result:'PASS',mode:'hold-edit-conflict',sql:true,thirdPartyHoldBlocks:true,explicitChoiceRequired:true,noAutomaticFord:true,presentation:true}));
        return;
      }
      if(process.argv.includes('--hold-edit-baseline')) {
        await page.waitForURL(/#airport\/traslado$/);
        await page.getByRole('button',{name:'Confirmar modelo: Ford Explorer',exact:true}).waitFor();
        assert.equal((await airportSql({operation:'status'})).hold.expiresAt,initial.hold.expiresAt);
        console.log(JSON.stringify({result:'REPRODUCED',mode:'hold-edit',sql:true,prechecks,route:'traslado',offered:'Ford Explorer',holdUnchanged:true,checkouts:writes,replacements}));
        return;
      }
      await page.waitForURL(/#airport\/revision$/);
      assert((await page.locator('.airport-booking').innerText()).includes('BYD M9'));
      if(httpEditOnly) {
        await context.unrouteAll();
        const network=await context.newCDPSession(page);
        await network.send('Fetch.enable',{patterns:[{urlPattern:'https://checkout.stripe.com/*'},{urlPattern:origin+'/.netlify/functions/booking-public-config'}]});
        network.on('Fetch.requestPaused',async event=>{
          const config=event.request.url.includes('/booking-public-config');
          const body=config?JSON.stringify({ok:true,bookingApi:{apiBaseUrl:isolatedApi},publicSite:{siteKey:'local_pixkuy_site_key'}}):'<!doctype html><title>Controlled payment boundary</title>';
          await network.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:config?'application/json':'text/html'}],body:Buffer.from(body).toString('base64')});
        });
      }
      if(process.argv.includes('--http-edit-rejected')) await page.evaluate(unavailable=>{window.PixkuyRecaptchaEnterprise.execute=async()=> unavailable?'isolated-recaptcha-unavailable':'isolated-recaptcha-reject';},process.argv.includes('--provider-unavailable'));
      await page.getByRole('button',{name:/Confirmar cambios y sustituir pago|Guardar cambios y continuar al pago/,exact:true}).click();
      if(process.argv.includes('--http-edit-baseline')) {
        await page.getByText('No podemos confirmar el resultado del intento. Consulte su estado antes de iniciar otro pago.',{exact:true}).waitFor();
        const after=airportSql({operation:'status'});
        assert.equal(after.edit.revision,initial.edit.revision);
        assert.equal(after.reservation.customerNotes,initial.reservation.customerNotes);
        console.log(JSON.stringify({result:'REPRODUCED',mode:'http-cors',route:'revision',changesSaved:false,revisionUnchanged:true,amountVisible:await page.locator('.airport-booking__total').count()>0}));
        return;
      }
      if(process.argv.includes('--http-edit-rejected')) {
        await page.getByText('No se han podido guardar los cambios. Consulte el estado de la reserva antes de continuar.',{exact:true}).waitFor();
        assert((await page.locator('.airport-booking__total').innerText()).includes('1025'));
        const expectedStatus=process.argv.includes('--provider-unavailable')?502:403;
        const expectedCode=process.argv.includes('--provider-unavailable')?'RECAPTCHA_VERIFICATION_FAILED':'RECAPTCHA_TOKEN_INVALID';
        assert.equal(httpReplies[0].status,expectedStatus);
        assert.equal(httpReplies[0].code,expectedCode);
        assert.equal((await airportSql({operation:'status'})).edit.revision,initial.edit.revision);
        assert.equal(await page.evaluate(()=>!!JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')).attempt),false);
        console.log(JSON.stringify({result:'PASS',mode:'http-known-rejection',status:expectedStatus,code:expectedCode,unchanged:true,amountVisible:true}));
        return;
      }
      if(process.argv.includes('--http-edit-lost')) {
        await page.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).waitFor();
        assert((await page.locator('.airport-booking__total').innerText()).includes('1025'));
        const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')));
        assert(stored.attempt);
        const saved=airportSql({operation:'status'});
        assert.notEqual(saved.edit.revision,initial.edit.revision,'Response was lost after the SQL modification');
        await page.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).click();
      }
      await page.waitForURL('https://checkout.stripe.com/**');
      const final=airportSql({operation:'verify',expectedNotes:editedNotes,...(initialMetrics?{expectedExpired:initialMetrics.expired_attempts+1}:{})});
      assert.equal(final.holdExpiresAt,initial.hold.expiresAt);
      assert.notEqual(final.editRevision,initial.edit.revision);
      assert.equal(writes,0);
      if(!httpEditOnly) assert.equal(replacements,1);
      if(httpEditOnly) {
        const finalMetrics=airportSql({operation:'metrics'});
        assert.equal(finalMetrics.reservation_id,initialMetrics.reservation_id);
        assert.equal(finalMetrics.hold_id,initialMetrics.hold_id);
        assert.equal(finalMetrics.provider_sessions,initialMetrics.provider_sessions+1,'Only one provider session is created, including after recovery');
        assert.equal(httpRequests.length,process.argv.includes('--http-edit-lost')?2:1);
        assert.equal(httpReplies.at(-1).status,200);
        assert.equal(httpReplies.at(-1).validCheckout,true);
        assert.equal(Object.hasOwn(httpRequests[0].body,'airport_transfer_passengers'),false);
        if(httpRequests.length===2) {
          assert.deepEqual(httpRequests[0],httpRequests[1],'Lost response replays the same payload, reference, revision and idempotency key');
        }
      }
      console.log(JSON.stringify({result:'PASS',mode:httpEditOnly?'http-edit':'hold-edit',sql:true,httpPosts:httpRequests.length,httpStatus:httpReplies.at(-1)?.status,validCheckoutUrl:httpReplies.at(-1)?.validCheckout,finalNavigation:new URL(page.url()).hostname,recoveredLostResponse:process.argv.includes('--http-edit-lost'),...final}));
      return;
    }
    if (stripeEditOnly) {
      await runStripeEdit();
      return;
    }
    if (checkoutRegressionOnly) {
      models = [{...model, passengersSupported:4}];
      await page.goto(origin+'/?service=airport_hotel#services');
      await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
      await page.locator('[data-consent-reject]').click({timeout:1500}).catch(()=>{});
      await page.evaluate(()=>{
        window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
        window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel NH Collection Mexico City Reforma',zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});
      });
      await page.locator('[data-airport-tariff-role="date"] input').fill('2027-01-19');
      await page.locator('[data-airport-tariff-role="time"] input').fill('15:18');
      await page.locator('[data-airport-tariff-fare-key="van_3_4"]').click();
      await page.locator('#services-expand-airport .services-expand__cta').click();
      await page.waitForURL(/#airport\/datos$/);
      await page.locator('#contact-name').fill('Pasajero Sintético');
      await page.locator('#contact-phone').fill('+34612345678');
      await page.locator('#contact-email').fill('synthetic@example.com');
      await page.locator('#contact-luggage').fill('5');
      await page.locator('#contact-message').fill('una nota reconocible');
      await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
      await page.locator('#contact-submit').click();
      await page.waitForURL(/#airport\/revision$/);
      assert.equal(await page.evaluate(()=>Object.hasOwn(JSON.parse(sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot')),'airport_transfer_passengers')),false);
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('pixkuy_airport_pending_edit_v1')),null,'A new reservation is not an edit');
      // A changed invalid canonical control must be explained, never silently redirected.
      await page.evaluate(()=>{document.querySelector('#contact-phone').value='+123';});
      await page.getByRole('button',{name:'Continuar al pago',exact:true}).click();
      await page.waitForURL(/#airport\/datos$/);
      assert.equal(writes,0,'Invalid contact does not create checkout');
      assert.equal(await page.locator('#contact-phone').getAttribute('aria-invalid'),'true');
      assert.equal(await page.locator('#contact-phone').evaluate(el=>document.activeElement===el),true,'Invalid field receives focus');
      assert.equal(await page.locator('#contact-message').inputValue(),'una nota reconocible');
      const errorVisible=await page.locator('#contact-phone').evaluate(el=>{
        const ids=(el.getAttribute('aria-describedby')||'').split(/\s+/);
        return ids.some(id=>{const error=document.getElementById(id);return error && error.textContent.trim() && error.getClientRects().length;});
      });
      assert(errorVisible,'Invalid phone has a visible explanation by the field');
      await page.locator('#contact-phone').fill('+34612345678');
      await page.locator('#contact-submit').click();
      await page.waitForURL(/#airport\/revision$/);
      await page.getByRole('button',{name:'Editar: Contacto',exact:true}).click();
      await page.waitForURL(/#airport\/datos\/name$/);
      let nativeAutofill=false;
      const cdp=await context.newCDPSession(page);
      try {
        await cdp.send('DOM.enable');
        const {root}=await cdp.send('DOM.getDocument');
        const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#contact-name'});
        const {node}=await cdp.send('DOM.describeNode',{nodeId});
        await cdp.send('Autofill.trigger',{fieldId:node.backendNodeId,address:{fields:[{name:'NAME_FULL',value:'Pasajero Autocompletado'},{name:'EMAIL_ADDRESS',value:'autofill@example.com'},{name:'PHONE_HOME_WHOLE_NUMBER',value:'+34612345678'}]}});
        nativeAutofill=await page.locator('#contact-name').inputValue()==='Pasajero Autocompletado';
      } catch (_) { /* Native address autofill is unavailable in some headless builds. */ }
      await cdp.detach();
      if (!nativeAutofill) await page.locator('#contact-name').evaluate(el=>{el.value='Pasajero Autocompletado';});
      await page.locator('#contact-submit').click();
      await page.waitForURL(/#airport\/revision$/);
      assert((await page.locator('.airport-booking').innerText()).includes('Pasajero Autocompletado'),'Review reads live controls even without an input event');
      await page.getByRole('button',{name:'Continuar al pago',exact:true}).evaluate(button=>{button.click();button.click();});
      await page.waitForURL(/booking-checkout|checkout\.stripe\.com/);
      assert.equal(writes,1);
      assert.equal(replacements,0);
      assert.equal(sent[0].body.airport_transfer_passenger_fare_key,'van_3_4');
      assert.equal(Object.hasOwn(sent[0].body,'airport_transfer_passengers'),false);
      assert.equal(sent[0].body.airport_transfer_notes,'una nota reconocible');
      assert.equal(Number(sent[0].body.airport_transfer_luggage),5);
      assert.equal(sent[0].body.customer.full_name,'Pasajero Autocompletado');
      await page.waitForURL(/checkout\.stripe\.com/);
      canModify=true; canRetry=true;
      await page.goto(origin+'/booking-cancelled.html?token=synthetic-airport-token');
      await page.getByRole('button',{name:'Modificar datos',exact:true}).click();
      await page.waitForURL(/#airport\/datos$/);
      assert.equal(await page.locator('#contact-message').inputValue(),'una nota reconocible');
      assert.equal(await page.locator('#contact-luggage').inputValue(),'5');
      assert((await page.locator('.airport-booking__summary').innerText()).includes('3–4'));
      await page.locator('#contact-message').fill('una nota reconocible modificada');
      await page.locator('#contact-submit').click();
      await page.waitForURL(/#airport\/revision$/);
      await page.getByRole('button',{name:'Guardar cambios y continuar al pago',exact:true}).evaluate(button=>{button.click();button.click();});
      await page.waitForURL(/checkout\.stripe\.com/);
      assert.equal(replacements,1,'Exactly one replacement after return from Stripe');
      assert.equal(writes,1,'Replacement creates no second reservation checkout');
      assert.equal(Object.hasOwn(lastReplacement.body,'airport_transfer_passengers'),false);
      assert.equal(lastReplacement.body.airport_transfer_notes,'una nota reconocible modificada');
      assert.equal(lastReplacement.headers['x-pixkuy-booking-token'],'synthetic-airport-token');
      assert.equal(lastReplacement.headers['x-pixkuy-edit-revision'],'2026-09-28T10:00:00.000Z');
      console.log(JSON.stringify({result:'PASS',mode:'checkout-regression',checkoutRequests:writes,replacements,backendContract:'real new-booking schema/precheck/prepare/public checkout; controlled persistence and pending availability; SQL edit coverage: --hold-edit',nativeAutofill,liveControlsWithoutInputEvents:!nativeAutofill}));
      return;
    }
    if (continuationOnly) {
      await runContinuation();
      return;
    }
    if (refinementOnly) {
      await runRefinement();
      return;
    }
    await page.goto(origin+"/?service=airport_hotel#services");
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    await page.locator('[data-consent-reject]').click({timeout:1500}).catch(()=>{});
    await page.evaluate(()=>{
      window.PixkuyAirportZoneTariff.setAirportSelection({airportId:"mex",direction:"airport_to_hotel"});
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:"Hotel MX Condesa — Salamanca 35, Roma Norte",zoneId:"roma_condesa",placeId:"synthetic-place",primaryType:"lodging",lat:19.418,lng:-99.169});
    });
    await page.locator('[data-airport-tariff-role="date"] input').fill("2026-10-05");
    await page.locator('[data-airport-tariff-role="time"] input').fill("22:03");
    await page.locator('[data-airport-tariff-role="passengers"] [data-airport-tariff-fare-key="van_1_2"]').click();
    await page.waitForTimeout(1000);
    const galleryTrigger=page.locator('#services-expand-airport [data-airport-desktop-vehicle-gallery-trigger]').first();
    await galleryTrigger.focus(); await galleryTrigger.press('Enter');
    await page.locator('.direct-transfer-desktop-vehicle-gallery:not([hidden])').waitFor();
    await page.keyboard.press('Escape');
    assert(await galleryTrigger.evaluate(el=>el===document.activeElement),'Gallery restores keyboard focus');
    const dateField=page.locator('[data-airport-tariff-role="date"] input');
    await dateField.focus(); await dateField.press('ArrowLeft'); await dateField.press('ArrowLeft'); await dateField.press('ArrowLeft'); await dateField.press('ArrowRight'); await dateField.press('ArrowRight');
    await page.keyboard.type('2026');
    await dateField.press('Tab');
    assert.equal(await dateField.inputValue(),'2026-10-05','Partial year accepts real keystrokes');
    await page.locator('#services-expand-airport .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/, {timeout:10000});
    assert.equal(writes,0,"Entering data creates no booking");
    await page.locator('#contact-name').fill("Ana García");
    await page.locator('#contact-phone').fill("+34612345678");
    await page.locator('#contact-email').fill("ana@example.com");
    await page.locator('#contact-luggage').fill("2");
    await page.locator('#contact-message').fill("Vuelo AM123. Dos maletas.");
    assert.equal(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked(),false,"Conditions are not prechecked");
    await page.locator('#contact-phone').fill('+123');
    await page.locator('#contact-email').focus();
    assert.equal(await page.locator('#contact-phone').getAttribute('aria-invalid'),'true','Real phone validator rejects invalid number');
    await page.locator('#contact-phone').fill('+34612345678');
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    await capture("datos-1440.png");
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    assert.equal(writes,0,"Review creates no booking");
    await capture("revision-1440.png");
    const savedReview = await page.evaluate(()=>sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot'));
    await page.locator('.airport-booking__progress li').nth(1).locator('button').click();
    assert.equal(await page.locator('#contact-name').inputValue(),"Ana García");
    await page.goBack();
    await page.waitForURL(/#airport\/revision$/);
    assert.equal(await page.locator('.lang').isHidden(),true,'Dedicated view hides the language selector');
    await page.setViewportSize({width:1024,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"No desktop overflow");
    await capture("revision-1024.png");
    await page.setViewportSize({width:390,height:844});
    await page.locator('.airport-booking').waitFor({state:'detached'});
    assert.equal(await page.locator('.airport-booking').count(),0,"No desktop route on mobile");
    assert.equal(await page.locator('#contact-name').inputValue(),"Ana García");
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('.airport-booking').waitFor({state:'visible'});
    mode='unavailable';
    await page.getByRole('button',{name:'Continuar al pago',exact:true}).click();
    await page.getByText('No hay disponibilidad para este traslado.',{exact:false}).waitFor();
    assert.equal(writes,0,'Commercial unavailability does not create checkout');
    await capture('sin-disponibilidad.png');
    mode='available';
    await page.getByRole('button',{name:'Reintentar comprobación',exact:true}).click();
    await page.getByRole('button',{name:'Continuar al pago',exact:true}).waitFor();
    assert.equal(writes,0,'Checking availability again is not payment authorization');
    await page.reload();
    await page.getByRole('heading',{name:'Revise su reserva',exact:true}).waitFor();
    assert.equal(writes,0,"Reload creates no checkout");
    assert(await page.locator('.airport-booking').innerText().then(x=>x.includes('Ana García')),"Reload preserves passenger");
    await page.getByRole('button',{name:'Reintentar comprobación',exact:true}).click();
    await page.getByRole('button',{name:'Continuar al pago',exact:true}).waitFor();
    assert.equal(writes,0,"Reload requires and completes an explicit fresh check before payment");
    await page.evaluate(()=>{
      window.__advanceAirportClock(301000);
      window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
      document.dispatchEvent(new CustomEvent('pixkuy:fleet-offer-expired',{detail:{service:'airport_transfer'}}));
    });
    await page.getByRole('button',{name:'Reintentar comprobación',exact:true}).waitFor();
    mode="technical";
    await page.getByRole("button",{name:"Reintentar comprobación",exact:true}).click();
    await page.getByText("No hemos podido comprobar la disponibilidad.",{exact:false}).waitFor();
    assert.equal(writes,0,"Technical error creates no checkout");
    await capture("error-tecnico.png");
    mode="available";
    price=85000;
    await page.getByRole("button",{name:"Reintentar comprobación",exact:true}).click();
    await page.getByRole("button",{name:"Aceptar nueva oferta",exact:true}).waitFor();
    assert.equal(writes,0,"Price change requires acceptance before creating checkout");
    await capture('oferta-modificada.png');
    await page.getByRole("button",{name:"Aceptar nueva oferta",exact:true}).click();
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    await page.getByRole("button",{name:"Continuar al pago",exact:true}).click();
    await page.waitForURL(/booking-checkout/);
    assert.equal(writes,1,"Exactly one checkout creation");
    status="confirmed";
    await page.goto(origin+"/booking-success.html?token=synthetic-airport-token");
    await page.getByRole('heading',{name:"Su reserva está confirmada",exact:true}).waitFor();
    await capture("confirmacion.png");
    status="pending_payment";
    await page.reload();
    await page.getByRole('heading',{name:"Estamos verificando su pago",exact:true}).waitFor();
    await capture("pago-pendiente.png");
    assert.equal(await page.getByRole('button',{name:'Continuar al pago',exact:true}).count(),0,'Pending verification cannot pay again');
    canRetry=true;
    await page.goto(origin+"/booking-cancelled.html?token=synthetic-airport-token");
    await page.getByRole('heading',{name:"El pago no se ha completado",exact:true}).waitFor();
    await capture("pago-no-completado.png");
    await page.getByRole('button',{name:'Continuar al pago',exact:true}).click();
    await page.waitForURL(/booking-checkout/);
    assert.equal(retries,1,'Backend permission allows retry of original reservation');
    status="hold_expired";canRetry=false;
    await page.goto(origin+"/booking-cancelled.html?token=synthetic-airport-token");
    await page.getByRole('heading',{name:'El intento ha caducado',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Continuar al pago',exact:true}).count(),0,"Expired attempt cannot resume payment");
    await capture('intento-caducado.png');
    for (service of ['direct_transfer','hourly_daily']) {
      status='confirmed';await page.reload();
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.airport-booking').count(),0,service+' keeps shared layout');
    }
    service='airport_transfer';
    await page.setViewportSize({width:390,height:844});
    await page.reload();await page.waitForTimeout(250);
    assert.equal(await page.locator('.airport-booking').count(),0,'Airport result retains mobile layout');
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(origin);
    await page.evaluate(value=>{sessionStorage.setItem('pixkuy_airport_transfer_checkout_review_snapshot',value);sessionStorage.removeItem('pixkuy_fleet_b:airport_transfer');},savedReview);
    price=80000;
    await page.goto(origin+'/?scenario=recovery#airport/datos');
    await page.locator('#contact-name').waitFor({state:'visible'});
    delayPrecheck=700;
    await page.locator('#contact-submit').click();
    await page.locator('.airport-booking__progress li').first().locator('button').click();
    await page.waitForTimeout(900);
    assert.equal(new URL(page.url()).hash,'#airport/traslado','Late precheck cannot reopen review');
    delayPrecheck=0;
    await page.goBack();
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    loseCheckout=true;
    const beforeLoss=writes;
    await page.getByRole('button',{name:'Continuar al pago',exact:true}).evaluate(button=>{button.click();button.click();});
    await page.getByRole('button',{name:'Comprobar estado del pago',exact:true}).waitFor();
    assert.equal(writes,beforeLoss+1,'Double click sends one creation attempt');
    recoverStatus=true;
    await page.getByRole('button',{name:'Comprobar estado del pago',exact:true}).click();
    await page.waitForURL(/booking-success/);
    assert.deepEqual(sent.at(-1),sent.at(-2),'Uncertain recovery replays original payload and idempotency key');
    const beforeModels=writes;
    recoverStatus=false;
    models=[model,{...model,modelId:'00000000-0000-4000-8000-000000000002',name:'Modelo comercial con denominación larga para comprobar legibilidad y selección explícita',photoUrl:null}];
    await page.goto(origin);
    await page.evaluate(()=>{sessionStorage.removeItem('pixkuy_fleet_b:airport_transfer');sessionStorage.removeItem('pixkuy_airport_transfer_checkout_review_snapshot');});
    await page.goto(origin+'/?service=airport_hotel&scenario=models#services');
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    await page.evaluate(()=>{
      window.PixkuyAirportZoneTariff.setAirportSelection({airportId:"mex",direction:"airport_to_hotel"});
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:"Hotel con nombre largo — Dirección extensa, colonia Roma Norte, Ciudad de México",zoneId:"roma_condesa",placeId:"synthetic-place",primaryType:"lodging",lat:19.418,lng:-99.169});
    });
    await page.locator('[data-airport-tariff-role="date"] input').fill("2026-10-05");
    await page.locator('[data-airport-tariff-role="time"] input').fill("22:03");
    await page.locator('[data-airport-tariff-role="passengers"] [data-airport-tariff-fare-key="van_1_2"]').click();
    const choices=page.locator('#services-expand-airport [data-fleet-selection] input[type=radio]');
    await choices.first().waitFor();
    assert.equal(await choices.count(),2,'Multiple models require explicit selection');
    assert.equal(await page.locator('#services-expand-airport [data-fleet-selection] input:checked').count(),0);
    await choices.nth(1).check();
    await page.locator('#services-expand-airport .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    assert.equal(await page.locator('.airport-booking__photo').count(),0,'No invented image for model without photo');
    await page.locator('#contact-name').fill("Ana García");
    await page.locator('#contact-phone').fill("+34612345678");
    await page.locator('#contact-email').fill("ana@example.com");
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    await page.setViewportSize({width:1024,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Long model and address fit 1024');
    await capture('modelo-largo-sin-foto.png');
    await page.setViewportSize({width:1440,height:1000});
    models=[model];
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/traslado$/);
    const confirmation=page.locator('#services-expand-airport [data-fleet-selection] button').first();
    await confirmation.waitFor();
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer')),null,'Disappeared explicit model cannot silently substitute');
    await confirmation.click();
    await page.locator('#services-expand-airport .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García','Explicit replacement keeps passenger data');
    assert.equal(writes,beforeModels,'Model replacement creates no checkout');
    assert.equal(errors.length,0,errors.join("\n"));
    console.log(JSON.stringify({result:"PASS",prechecks,controlledCheckouts:writes,controlledRetries:retries,output}));
  } catch(error) {
    if (checkoutRegressionOnly || leadSuggestionOnly) throw error;
    await page.screenshot({path:path.join(output,"diagnostico.png"),fullPage:false}).catch(()=>{});
    if (reviewUncertainty || mobileIntegrated) { console.error(JSON.stringify({prechecks,controlledCheckouts:mobileCheckouts.length,writes,errors:errors.length})); throw error; }
    console.error(JSON.stringify(await page.evaluate(()=>({runtime:window.__qaErrors,service:document.querySelector('[name="service_type"]')?.value}))));
    console.error(JSON.stringify({url:page.url(),errors,prechecks,controlledCheckouts:writes,lastPrecheckPayload,offerStatus:await page.evaluate(()=>window.PixkuyFleetSelection&&window.PixkuyFleetSelection.airportOfferStatus()).catch(()=>null),panelState:await page.locator('#services-expand-airport').getAttribute('data-airport-mobile-availability-state').catch(()=>null),fleet:await page.evaluate(()=>window.PixkuyFleetSelection&&window.PixkuyFleetSelection.read('airport_transfer')).catch(()=>null),diagnostic:await page.locator('.airport-booking, #services-expand-airport').allTextContents().then(x=>x.join('\n').slice(0,2500)).catch(()=>"")}));
    throw error;
  } finally { await browser.close(); }
}
if (process.argv.includes("--check-config")) {
  console.log(JSON.stringify({configuration:"valid",connectionsAttempted:0,scenariosExecuted:0}));
} else {
  run().catch(error=>{console.error(error.stack);process.exitCode=1;});
}
