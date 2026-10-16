"use strict";
// Unit tests of real modules/declarations. DOM, database and provider boundaries are doubles;
// these results do not certify a browser layout or PostgreSQL concurrency.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ts=require(process.env.PIXKUY_TYPESCRIPT_MODULE||'../../../pixkuy-booking-api/node_modules/typescript');
const source=rel=>{
 const before=process.env.PIXKUY_HOURLY_PRECHECK_PREIMAGE;
 const file=before&&rel.startsWith('assets/')&&fs.existsSync(path.join(before,rel))?path.join(before,rel):path.join(root,rel);
 return fs.readFileSync(file,'utf8');
};
function declarations(rel,names,bindings){
 const text=source(rel),ast=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),found=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name&&names.includes(n.name.text))found.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
 assert.equal(found.length,names.length);return vm.runInNewContext(found.join('\n')+'\n({'+names.join(',')+'})',bindings);
}
const panel='assets/js/services/hourly-daily-panel.js',draftPath='assets/js/forms/hourly-booking-draft.js';
// Focused offline precheck boundary: real panel handlers, pickup adapter,
// pricing, Fleet transport/certificates and suggestion code. DOM/Places I/O and
// HTTP are controlled; no browser, socket, booking writer or real availability.
function hourlyPrecheckHarness(mobile=false){
 const fixture=source('scripts/airport-netlify-independence.test.cjs');
 const {Events,Element,Event}=vm.runInNewContext(fixture.slice(fixture.indexOf('class Events {'),fixture.indexOf('function storage('))+'\n({Events,Element,Event})',{assert});
 const document=new Events(),window=new Events(),timers=new Map(),requests=[],storage=new Map();let timerId=0,places;
 document.documentElement={lang:'es'};document.querySelector=()=>null;document.querySelectorAll=()=>[];
 document.createElement=tag=>new Element(tag,document);document.createTextNode=text=>({textContent:text,remove(){}});
 const config=document.createElement('div'),pickup=document.createElement('input'),pickupRoot=document.createElement('div'),mount=document.createElement('div');
 const cta=document.createElement('button'),status=document.createElement('p'),price=document.createElement('p');
 const nodes={'[data-services-hourly-cta]':cta,'[data-services-hourly-availability]':status,'.services-hourly-panel__price':price,
  '[data-services-hourly-pickup-root]':pickupRoot,'[data-place-input="hourly_daily_pickup"]':pickup,'[data-place-mount="hourly_daily_pickup"]':mount};
 config.querySelector=s=>nodes[s]||null;config.querySelectorAll=()=>[];pickupRoot.querySelector=()=>null;
 window.document=document;window.location={origin:'https://local.pixkuy.test'};window.innerWidth=mobile?390:1440;
 window.matchMedia=()=>({matches:!mobile});window.Response=Response;window.CustomEvent=Event;
 window.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 window.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;};window.clearTimeout=id=>timers.delete(id);
 window.PIXKUY_BOOKING_API_CONFIG={apiBaseUrl:'',publicSiteKey:'offline-fixture'};
 window.PixkuyForms={googlePlaces:{createAutocompleteController:options=>{places=options;return {mount(){},destroy(){}};}}};
 window.fetch=(url,init)=>{
  if(!init)return Promise.resolve(new Response(JSON.stringify({fleetSelection:{}})));
  assert.equal(url,'/v1/public/reservations/hourly-availability-precheck');
  return new Promise((resolve,reject)=>requests.push({payload:JSON.parse(init.body),resolve:(body,status=200)=>resolve(new Response(JSON.stringify(body),{status})),reject}));
 };
 const box={window,document,URL,CustomEvent:Event,console};
 for(const file of ['hourly-daily-pricing','fleet-selection-state','hourly-availability-precheck','hourly-daily-pickup','shared-availability-suggestion'])
  vm.runInNewContext(source('assets/js/services/'+file+'.js'),box);
 // Use the production default state, rather than injecting a complete trip.
 const ast=ts.createSourceFile(panel,source(panel),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let stateText;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='state')stateText=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);
 const MODES={HOURLY:'hourly',FULL_DAY:'full_day',LONG_TERM:'custom_long_term'};
 const state=vm.runInNewContext('('+stateText+')',{MODES});
 const noop=()=>{},bindings={...box,state,MODES,configMount:config,panelRoot:{dataset:{}},pickupControllerHandle:null,
  availabilityBlockReason:'',availabilityBusy:false,lastAvailabilityResult:null,availabilityRequestSequence:0,activeAvailabilityContextKey:'',automaticHourlyCheck:null,
  HOURLY_PRICING_API:window.PixkuyHourlyDailyPricing,HOURLY_PRICING_CONSTANTS:window.PixkuyHourlyDailyPricing.constants,
  HOURLY_DURATION_OPTIONS:window.PixkuyHourlyDailyPricing.getDurationOptions().filter(x=>x<12),
  isMobileHourlyViewport:()=>mobile,shouldShowDateFieldInServices:()=>true,isMobileModeSwitchWithoutRemount:()=>false,
  getReservationMinimumDateLiteral:()=> '2026-10-14',trackHourlyQuoteReady:noop,trackHourlyContinueClick:noop,syncSafariDesktopTimeSelect:noop};
 const functions=['normalizeText','getI18nValue','getLabels','getComputedPrice','syncDerivedState','isServicesDateAtOrAfterMinimum','isConfigComplete',
  'isHourlyContinueBlockedByAvailability','shouldDisableHourlyContinue','setAvailabilityBlock','clearAvailabilityBlock','syncAvailabilityPricePresentation',
  'invalidateAvailabilityState','getHourlyCtaText','formatCurrency','destroyPickupController','mountPickupController','syncLiveFieldValues',
  'getHourlyAvailabilityPrecheckApi','isTransactionalHourlyMode','getNextAvailableTimeLabel','getNextAvailableMessage','getAvailabilityMessage',
  'isAvailabilityRequestFailure','getHourlyAvailabilityContextKey','isCurrentHourlyAvailabilityRequest','restoreAvailabilityStatusPlacement',
  'placeUnavailableStatusInMobileFooter','setAvailabilityStatus','setUnavailableAvailabilityStatus','clearAvailabilityStatus','setHourlyContinueBusy',
  'buildHourlySubmitDetail','runHourlyAvailabilityPrecheck','applyNextAvailableSuggestion','bindEvents','renderAll'];
 const api=declarations(panel,functions,bindings);
 // Only markup/layout is replaced. All state transitions and request builders
 // are production functions, including the remount after changing mode.
 bindings.renderConfig=()=>{api.syncDerivedState();api.mountPickupController();api.syncLiveFieldValues();};
 api.renderAll();api.bindEvents();
 const flush=async()=>{for(let i=0;i<25;i++)await new Promise(resolve=>setImmediate(resolve));};
 const tick=async()=>{for(const [id,timer] of [...timers])if(timer.ms===350){timers.delete(id);timer.fn();}await flush();};
 const field=(type,value)=>{const target=document.createElement('input');target.setAttribute('data-services-hourly-'+type,'');target.value=value;config.dispatchEvent({type:'input',target});};
 const choose=mode=>config.dispatchEvent({type:'click',target:{closest:s=>s==='[data-services-hourly-mode]'?{getAttribute:()=>mode}:null}});
 const select=()=>places.onSelection({label:'Las Suites Campos Elíseos, Campos Elíseos 470, Polanco',placeId:'offline-place',lat:19.43,lng:-99.20},{});
 const fill=async(order=['pickup','date','time'])=>{for(const step of order){if(step==='pickup')select();else field(step,step==='date'?'2026-11-05':'10:45');await tick();}};
 return {api,state,cta,status,price,requests,window,field,choose,select,fill,tick,flush,timers};
}
function hourlyFixture(available,next){return {status:'ok',checkoutAllowed:available,
 availability:{available,status:available?'available':'unavailable',...(next?{nextAvailableStartLocal:next}:{})},
 fleet:{version:1,requestKey:'controlled-offer',status:available?'available':'unavailable',models:available?[{modelId:'controlled-model',modelRevision:1,name:'Controlled vehicle'}]:[]}};}
test('Hourly restored Data: panel debounce cannot supersede its runtime-config wait',async()=>{
 for(const mobile of [true,false])for(const mode of ['hourly','full_day']){
  const h=hourlyPrecheckHarness(mobile);let release,active=true;
  // Route ownership is the narrow collaborator here. The browser regression
  // traverses the real form, draft restoration and isActive implementation.
  h.window.PixkuyHourlyBookingFlow={isActive:()=>active};
  h.window.PixkuyBookingPublicConfig={ready:new Promise(resolve=>release=resolve)};
  h.choose(mode);h.select();h.field('date','2027-01-29');h.field('time','21:48');
  const dataRequest=h.window.PixkuyHourlyAvailabilityPrecheck.precheck(h.api.buildHourlySubmitDetail(),{interactive:false});
  await h.tick();assert.equal(h.requests.length,0,'config not ready; no transport');
  release();await h.flush();assert.equal(h.requests.length,1);
  h.requests[0].resolve(hourlyFixture(true));assert.equal((await dataRequest).available,true,'Data request must not be superseded by the hidden panel');
  assert(h.window.PixkuyFleetSelection.hourlyOfferStatus().valid);
  // Back returns ownership to Configuration; its normal debounce still works.
  active=false;h.field('time','22:18');await h.tick();assert.equal(h.requests.length,2);
  h.requests[1].resolve(hourlyFixture(true));await h.flush();assert.equal(h.cta.disabled,false);
 }
});

test('Hourly pending edit: precheck waits for the real runtime config loader before resolving URL and site',async()=>{
 const h=hourlyPrecheckHarness();let release;const calls=[];
 h.window.PIXKUY_BOOKING_API_CONFIG={apiBaseUrl:'',publicSiteKey:'initial-site'};
 h.window.fetch=(url,init)=>{
  if(url==='/.netlify/functions/booking-public-config')return new Promise(resolve=>release=resolve);
  calls.push({url,init});return Promise.resolve(new Response(JSON.stringify(hourlyFixture(true))));
 };
 vm.runInNewContext(source('assets/js/forms/booking-public-config.js'),{window:h.window});
 h.select();h.field('date','2026-11-05');h.field('time','10:45');
 const pending=h.window.PixkuyHourlyAvailabilityPrecheck.precheck(h.api.buildHourlySubmitDetail(),{interactive:false});
 await h.flush();assert.equal(calls.length,0,'must not POST to Landing before config arrives');
 release(new Response(JSON.stringify({ok:true,bookingApi:{apiBaseUrl:'https://booking.example.invalid'},publicSite:{siteKey:'runtime-site'}})));
 const result=await pending;assert.equal(result.available,true);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://booking.example.invalid/v1/public/reservations/hourly-availability-precheck');
 assert.equal(calls[0].init.headers['X-Pixkuy-Site-Key'],'runtime-site');
});
test('Hourly pending edit: only unchanged service uses contact endpoint; all commercial changes replace',async()=>{
 const baseline={service_type:'hourly_daily',hourly_daily_mode:'hourly',hourly_daily_pickup:'Synthetic',hourly_daily_pickup_place_id:'place',hourly_daily_pickup_lat:19.4,hourly_daily_pickup_lng:-99.1,hourly_daily_date:'2027-01-13',hourly_daily_start_time:'10:00',hourly_daily_duration_hours:2,hourly_daily_passengers:2,hourly_daily_price:150000,hourly_daily_currency:'MXN',hourly_daily_notes:'Keep',fleet_selection:{model_id:'model',model_revision:1}};
 const changes=[{customer:{full_name:'Edited',email:'contact@example.invalid',phone:'+525500000000'},locale:'en'},
  {hourly_daily_pickup:'Other'},{hourly_daily_pickup_place_id:'other'},{hourly_daily_pickup_lat:19.5},{hourly_daily_pickup_lng:-99.2},
  {hourly_daily_date:'2027-01-14'},{hourly_daily_start_time:'11:00'},{hourly_daily_duration_hours:3},{hourly_daily_passengers:4},
  {hourly_daily_price:200000},{hourly_daily_currency:'USD'},{hourly_daily_notes:''},{hourly_daily_mode:'full_day'},
  {fleet_selection:{model_id:'model',model_revision:2}}];
 for(const [index,change] of changes.entries()){
  const h=hourlyPrecheckHarness();await h.flush();const calls=[];
  h.window.sessionStorage.setItem('pixkuy_hourly_pending_edit_v1',JSON.stringify({version:1,token:'synthetic',editRevision:'2026-10-13T10:00:00.000Z',idempotencyKey:'existing-key',contactOnly:true,serviceBaseline:baseline}));
  h.window.fetch=(url,init)=>{calls.push({url,body:JSON.parse(init.body),headers:init.headers});return Promise.resolve(new Response(JSON.stringify({recovery:{state:'unknown'}})));};
  const payload={...baseline,...change};delete payload.hourly_daily_notes;payload.form_payload_raw={hourly_daily_notes:change.hourly_daily_notes??baseline.hourly_daily_notes};
  await h.window.PixkuyFleetSelection.fetchCheckout('hourly_daily','/v1/public/reservations/checkout',{method:'POST',headers:{},body:JSON.stringify(payload)});
  assert.equal(calls.length,1);assert(calls[0].url.endsWith(index===0?'/update-contact':'/replace-checkout'),JSON.stringify(change));
  assert.equal(calls[0].headers['X-Pixkuy-Booking-Token'],'synthetic');assert.equal(calls[0].headers['Idempotency-Key'],'existing-key');
  await h.window.PixkuyFleetSelection.fetchCheckout('hourly_daily','/wrong/checkout',{method:'POST',headers:{},body:JSON.stringify({...baseline,hourly_daily_price:999999})});
  assert.deepEqual(calls[1],calls[0],'uncertain attempt freezes endpoint, token, key and payload');
 }
});
test('Hourly pending edit: config wait cannot resurrect invalidated or superseded context',async()=>{
 for(const nextRequest of [false,true]){
  const h=hourlyPrecheckHarness();let release;
  h.window.PixkuyBookingPublicConfig={ready:new Promise(resolve=>release=resolve)};
  h.select();h.field('date','2026-11-05');h.field('time','10:45');
  const first=h.window.PixkuyHourlyAvailabilityPrecheck.precheck(h.api.buildHourlySubmitDetail(),{interactive:false});
  h.field('time','11:00');
  const next=nextRequest?h.window.PixkuyHourlyAvailabilityPrecheck.precheck(h.api.buildHourlySubmitDetail(),{interactive:false}):null;
  release();await h.flush();assert.equal((await first).available,false);
  assert.equal(h.requests.length,nextRequest?1:0);
  if(next){assert.equal(h.requests[0].payload.hourly_daily_start_time,'11:00');h.requests[0].resolve(hourlyFixture(true));assert.equal((await next).available,true);}
  else assert.equal(h.window.PixkuyFleetSelection.hourlyOfferStatus().valid,false);
 }
});
test('Hourly precheck: first entry orders build the same complete request; pending is not available',async()=>{
 for(const mobile of [false,true])for(const order of [['pickup','date','time'],['time','date','pickup']]){
  const h=hourlyPrecheckHarness(mobile);await h.fill(order);assert.equal(h.requests.length,1);assert(h.cta.disabled);
  const p=h.requests[0].payload;assert.equal(p.hourly_daily_mode,'hourly');assert.equal(p.hourly_daily_duration_hours,2);assert.equal(p.hourly_daily_price,150000);
  assert.equal(p.hourly_daily_pickup_place_id,'offline-place');assert.equal(p.hourly_daily_pickup_lat,19.43);assert.equal(p.hourly_daily_passengers,2);
  h.requests[0].resolve(hourlyFixture(true));await h.flush();assert.equal(h.cta.disabled,false);assert.match(h.status.textContent,/confirmada/);
 }
});
test('Hourly precheck: HTTP and malformed responses never become genuine unavailability',async()=>{
 for(const [status,body] of [[400,{code:'INVALID_PICKUP_COORDINATES'}],[404,{code:'HOURLY_SERVICE_POLICY_NOT_FOUND'}],[429,{message:'Rate limit'}],[200,{}],[409,{code:'CHECKOUT_REPLACEMENT_STALE'}],[503,{code:'FLEET_AVAILABILITY_UNDETERMINED'}]]){
  const h=hourlyPrecheckHarness();await h.fill();
  const normalized=h.window.PixkuyHourlyAvailabilityPrecheck.precheck(h.api.buildHourlySubmitDetail(),{interactive:false});
  h.requests[0].resolve(body,status);const result=await normalized;await h.flush();
  assert.match(h.status.textContent,/No pudimos confirmar/,'HTTP '+status);assert(h.cta.disabled,'technical failure must not unlock Continue');assert(h.price.hidden);
  assert.match(h.api.getAvailabilityMessage(result),/No pudimos confirmar/,'translation/remount must preserve error classification');
  if(status<500)assert.equal(result.code,body.code||'','retain authority/error code for existing consumers');
  for(const consumer of ['assets/js/forms/hourly-booking-api-checkout.js','assets/js/services/hourly-mobile-contact-step.js']){
   const classify=declarations(consumer,['isAvailabilityRequestFailure'],{normalizeText:v=>typeof v==='string'?v.trim():''}).isAvailabilityRequestFailure;
   assert(classify(result),consumer);assert.equal(classify({ok:false,code:'PRICE_MISMATCH'}),false);
  }
 }
});
test('Hourly precheck: network failure remains blocked and incomplete context sends no request',async()=>{
 const h=hourlyPrecheckHarness();h.field('date','2026-11-05');h.field('time','10:45');await h.tick();
 assert.equal(h.requests.length,0);assert(h.cta.disabled);assert.equal(h.status.textContent,'');
 const invalid=await h.window.PixkuyHourlyAvailabilityPrecheck.precheck(h.api.buildHourlySubmitDetail());
 assert.equal(invalid.code,'INVALID_PRECHECK_PAYLOAD');assert.equal(h.requests.length,0);
 h.select();await h.tick();h.requests[0].reject(new Error('Controlled transport failure'));await h.flush();
 assert.match(h.status.textContent,/No pudimos confirmar/);assert(h.cta.disabled);assert(h.price.hidden);
});
test('Hourly precheck: supplied alternative is shown and applied only after current revalidation',async()=>{
 const h=hourlyPrecheckHarness();await h.fill();h.requests[0].resolve(hourlyFixture(false,'2026-11-06T11:17'));await h.flush();
 assert(h.cta.disabled);assert.match(h.status.textContent,/No hay disponibilidad/);assert.equal(h.status.children.at(-1).getAttribute('data-services-hourly-next-available'),'2026-11-06T11:17');
 const applying=h.api.applyNextAvailableSuggestion('2026-11-06T11:17');await h.flush();assert.equal(h.requests.length,2);
 h.requests[1].resolve(hourlyFixture(false,'2026-11-06T11:23'));await h.flush();
 assert.equal(h.state.tripDate,'2026-11-06');assert.equal(h.state.startTime,'11:23');assert(h.cta.disabled);assert.equal(h.requests.length,3);
 await h.tick();assert.equal(h.requests.length,3,'the explicit recheck owns the pending debounce');
 h.requests[2].resolve(hourlyFixture(true));await applying;await h.flush();assert.equal(h.cta.disabled,false);
});
test('Hourly precheck: unavailable without alternative stays blocked; price mismatch stays distinct',async()=>{
 for(const mismatch of [false,true]){
  const h=hourlyPrecheckHarness();await h.fill();h.requests[0].resolve(mismatch?{code:'PRICE_MISMATCH'}:hourlyFixture(false),mismatch?409:200);await h.flush();
  assert.match(h.status.textContent,mismatch?/tarifa ha cambiado/:/No hay disponibilidad/);assert(h.cta.disabled);assert.equal(h.status.children.length,0);
 }
});
test('Hourly precheck: out-of-order mode responses cannot restore a foreign offer',async()=>{
 const h=hourlyPrecheckHarness();await h.fill();h.choose('full_day');assert(h.cta.disabled);await h.tick();h.choose('hourly');assert(h.cta.disabled);await h.tick();
 assert.deepEqual(h.requests.map(r=>[r.payload.hourly_daily_mode,r.payload.hourly_daily_duration_hours]),[['hourly',2],['full_day',12],['hourly',2]]);
 h.requests[1].resolve(hourlyFixture(true));h.requests[0].resolve(hourlyFixture(false));await h.flush();assert(h.cta.disabled);assert.equal(h.window.PixkuyFleetSelection.hourlyOfferStatus().valid,false);
 h.requests[2].resolve(hourlyFixture(true));await h.flush();assert.equal(h.cta.disabled,false);assert.equal(h.window.PixkuyFleetSelection.read('hourly_daily').precheck.payload.hourly_daily_mode,'hourly');
 h.choose('full_day');assert(h.cta.disabled,'mode switch must immediately block old offer');
});

for(const attemptState of ['pending','committed'])test('Mobile lot: '+attemptState+' attempt never certifies a different modality',async()=>{
 const h=hourlyPrecheckHarness(true);await h.fill();
 const fleet=h.window.PixkuyFleetSelection,key='pixkuy_fleet_b:hourly_daily',state=fleet.read('hourly_daily');
 state.attempt={state:attemptState,key:'same-attempt',payload:h.requests[0].payload,...(attemptState==='committed'?{response:{bookingStatusToken:'synthetic-known'}}:{})};
 if(attemptState==='committed')state.reservationToken='synthetic-known';
 state.precheck={payload:h.requests[0].payload,body:hourlyFixture(true)};
 h.window.sessionStorage.setItem(key,JSON.stringify(state));const original=JSON.stringify(state.attempt);
 h.choose('full_day');await h.tick();assert.equal(h.requests.length,1);
 h.requests[0].resolve(hourlyFixture(true));await h.flush();
 assert(h.cta.disabled);assert(h.price.hidden);assert(!/Disponibilidad confirmada/.test(h.status.textContent));
 await assert.rejects(fleet.fetchPrecheck('hourly_daily','/v1/public/reservations/hourly-availability-precheck',{method:'POST',body:JSON.stringify(h.api.buildHourlySubmitDetail())}),/FLEET_ATTEMPT_RECOVERY_REQUIRED/);
 assert.equal(JSON.stringify(fleet.read('hourly_daily').attempt),original);assert.equal(h.requests.length,1);
});
test('Hourly precheck: an old suggestion refresh cannot change the current mode',async()=>{
 const h=hourlyPrecheckHarness();await h.fill();h.requests[0].resolve(hourlyFixture(false,'2026-11-06T11:17'));await h.flush();
 const applying=h.api.applyNextAvailableSuggestion('2026-11-06T11:17');await h.flush();h.choose('full_day');await h.tick();
 h.requests[2].resolve(hourlyFixture(true));await h.flush();h.requests[1].resolve(hourlyFixture(false,'2026-11-06T11:23'));await applying;await h.flush();
 assert.equal(h.state.mode,'full_day');assert.equal(h.state.tripDate,'2026-11-05');assert.equal(h.state.startTime,'10:45');assert.equal(h.cta.disabled,false);
 assert.equal(h.window.PixkuyFleetSelection.read('hourly_daily').precheck.payload.hourly_daily_mode,'full_day');
});
test('Hourly precheck: error then full day then hourly uses three context-specific responses',async()=>{
 // This is a possible controlled sequence, not the missing historical response.
 const h=hourlyPrecheckHarness();await h.fill();h.requests[0].resolve({code:'INVALID_PICKUP_COORDINATES'},400);await h.flush();
 assert.match(h.status.textContent,/No pudimos confirmar/);
 h.choose('full_day');await h.tick();h.requests[1].resolve(hourlyFixture(true));await h.flush();assert.equal(h.cta.disabled,false);
 h.choose('hourly');assert(h.cta.disabled);assert.equal(h.window.PixkuyFleetSelection.hourlyOfferStatus().valid,false);
 await h.tick();assert.equal(h.requests.length,3);assert.equal(h.requests[2].payload.hourly_daily_duration_hours,2);
 h.requests[2].resolve(hourlyFixture(true));await h.flush();assert.equal(h.cta.disabled,false);
 assert.equal(h.window.PixkuyFleetSelection.read('hourly_daily').precheck.payload.hourly_daily_duration_hours,2);
});
test('Long-term mobile clear: actual clear click persists empty pickup through mode transitions',()=>{
 const noop=()=>{},normalizeText=v=>typeof v==='string'?v.trim():'';
 // DOM/rendering and external Places I/O are boundaries; event handlers, facade,
 // pickup adapter, panel transitions and session serialization are real code.
 const element=()=>({value:'',dataset:{},listeners:{},addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(f=>f!==fn);},dispatchEvent(e){for(const fn of this.listeners[e.type]||[])fn(e);return true;},focus:noop,setAttribute:noop});
 const config=element(),mount=element(),pickupRoot=element(),clear=element();let input=element(),facade,mobile;
 const storage=new Map(),state={mode:'hourly',pickup:'',pickupPlaceId:'',pickupLat:'',pickupLng:'',tripDate:'2027-01-28',startTime:'10:00',durationHours:4,hourlyDurationHours:4,notes:'Hourly agenda',currency:'MXN'};
 const sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const longBindings={state:{version:1,contact:{}},ordinary:null,KEY:'controlled-long-term',desktop:()=>false,active:()=>false,configSteps:noop,sessionStorage};
 const long=declarations('assets/js/forms/long-term-request.js',['snapshot','received','read','save','panelChanged','switchMode'],longBindings);
 config.querySelector=s=>s.includes('pickup-root')?pickupRoot:s.includes('data-place-input')?input:s.includes('data-place-mount')?mount:null;
 pickupRoot.querySelector=s=>s.includes('data-place-autocomplete')?pickupRoot:s.includes('data-place-input')?input:s.includes('data-place-mount')?mount:null;
 const window={PixkuyForms:{googlePlaces:{}},PixkuyLongTermRequest:long,PixkuyFleetSelection:{passengers:()=>2,hourlyEdit:()=>null,setPassengers:noop},dispatchEvent:noop};
 const document={documentElement:{lang:'en'}};
 window.PixkuyForms.googlePlaces.createAutocompleteController=options=>{
  facade={input:options.input,mountNode:options.mountNode,hiddenFields:{},state:{selectedPlace:null},options:{},onSelection:options.onSelection};
  const facadeApi=declarations('assets/js/forms/google-places.js',['clearSelectedPlace','handleManualInput','createMobileStrategy'],{
   controller:facade,strategyController:null,root:pickupRoot,isFunction:v=>typeof v==='function',getString:v=>String(v||''),clearHiddenFields:noop,syncReservationRequestUiFromInput:noop,syncControllerUiState:noop,
   mobileFactory:options=>{mobile={input:options.input,mountNode:options.mountNode,root:pickupRoot,callbacks:options,bound:{},state:{},options:{}};return mobile;}
  });
  facadeApi.createMobileStrategy();
  const mobileApi=declarations('assets/js/forms/google-places-mobile.js',['bindInputEvents','setManualValue'],{
   document,window,clearPendingTimer:noop,resetAbortController:noop,resetSessionToken:noop,closeSuggestions:noop,syncClearButtonVisibility:noop,getClearButtonNode:()=>clear
  });
  return {mount(){clear.listeners={};mobileApi.bindInputEvents(mobile);},destroy:noop};
 };
 vm.runInNewContext(source('assets/js/services/hourly-daily-pickup.js'),{window,document});
 const bindings={state,window,document,CustomEvent,normalizeText,configMount:config,panelRoot:{dataset:{}},pickupControllerHandle:null,
  MODES:{HOURLY:'hourly',FULL_DAY:'full_day',LONG_TERM:'custom_long_term'},HOURLY_DURATION_OPTIONS:[2,4,6],LONG_TERM_OPTIONS:['week','fortnight','monthly','custom'],
  HOURLY_PRICING_CONSTANTS:{fullDayHours:12,extraKmPrice:0,outOfZoneSupplement:0},HOURLY_PRICING_API:{getIncludedKilometers:()=>0},
  isMobileHourlyViewport:()=>true,isMobileModeSwitchWithoutRemount:()=>true,invalidateAvailabilityState:noop,syncDerivedState:noop,
  getLabels:()=>({}),shouldDisableHourlyContinue:()=>false,formatCurrency:()=>'',syncSafariDesktopTimeSelect:noop,syncAvailabilityPricePresentation:noop,trackHourlyQuoteReady:noop,
  shouldShowDateFieldInServices:()=>true};
 const api=declarations(panel,['mountPickupController','destroyPickupController','buildHourlySubmitDetail','syncLiveFieldValues','applyContactHourlyDailySync','bindEvents','renderAll','isConfigComplete'],bindings);
 bindings.renderConfig=()=>{input=element();input.value=state.pickup;api.mountPickupController();};
 api.renderAll();api.bindEvents();
 const choose=mode=>config.dispatchEvent({type:'click',target:{closest:s=>s==='[data-services-hourly-mode]'?{getAttribute:()=>mode}:null}});
 input.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-pickup-selected',{detail:{selectedPlace:{label:'Selected hotel',placeId:'fixture-place',lat:19.4,lng:-99.1}}}));
 choose('custom_long_term');assert.equal(state.pickup,'Selected hotel');assert.equal(state.pickupPlaceId,'fixture-place');
 // The visible mobile x assigns input.value, then invokes the facade callbacks;
 // it does NOT dispatch a native input event. This was missing in the prior test.
 clear.dispatchEvent({type:'click',preventDefault:noop});
 assert.equal(input.value,'');
 const afterClear=JSON.parse(storage.get('controlled-long-term')).config;
 choose('hourly');assert.equal(state.pickup,'Selected hotel');assert.equal(state.pickupPlaceId,'fixture-place');assert.equal(state.notes,'Hourly agenda');
 choose('custom_long_term');
 assert.equal(state.pickup,'','mode transition must not resurrect the cleared pickup');
 for(const key of ['pickup','pickupPlaceId','pickupLat','pickupLng']){assert.equal(state[key],'',key);assert.equal(afterClear[key],'','persisted '+key);}
 assert.equal(api.isConfigComplete(),false);
 longBindings.state=long.read();longBindings.ordinary=longBindings.state.ordinary;
 choose('hourly');choose('custom_long_term');assert.equal(state.pickup,'','session recovery preserves the explicit empty');
 // Existing non-empty manual text must still be preserved by the adapter.
 input.value='Unselected query';facade.onSelection(null,{preserveInputValue:true});assert.equal(input.value,'Unselected query');
 // Desktop clear callback (no preserve flag) still clears normally.
 facade.onSelection(null,{});assert.equal(state.pickup,'');assert.equal(state.pickupPlaceId,'');
});
test('Post-retirement: desktop return expands once, focuses notes and ignores obsolete navigation',()=>{
 for(const focusNotes of [false,true]){
  const frames=[],scrolls=[],focus=[],expands=[],value={hourly_daily_mode:'full_day',name:'Keep contact',legal_acceptance_accepted:true};let route='datos',synced;
  const target={getBoundingClientRect:()=>({top:500,height:80}),focus:options=>focus.push(options)};
  const bindings={navigationVersion:0,reviewed:'old',notice:'old',snapshot:value,keyboardNavigation:false,attempt:()=>null,editing:()=>null,contactEdit:()=>false,save(){},
   go:next=>{route=next;bindings.navigationVersion++;},step:()=>route,draft:{syncPanel:v=>synced=v},view:{media:{matches:true}},
   document:{documentElement:{clientHeight:900},querySelector:s=>s.endsWith(' h3')?{focus(){},setAttribute(){},removeAttribute(){},tabIndex:0}:target},
   window:{innerHeight:900,scrollY:100,requestAnimationFrame:fn=>frames.push(fn),scrollTo:options=>scrolls.push(options),PixkuyServicesExpand:{open:(key,options)=>expands.push({key,options})}}};
  const trip=declarations('assets/js/forms/hourly-booking-flow.js',['trip','openConfiguration'],bindings).trip;
  trip(focusNotes);assert.equal(route,'servicio');assert.equal(synced,value);assert.equal(expands.length,1);assert.equal(expands[0].key,'hourly');assert.equal(expands[0].options.scroll,false);assert.equal(frames.length,1);
  frames.shift()();assert.equal(scrolls.length,1);assert.equal(scrolls[0].behavior,'instant');assert.equal(focus.length,focusNotes?1:0);if(focusNotes)assert(focus[0].preventScroll);
  trip(focusNotes);route='datos';bindings.navigationVersion++;frames.shift()();assert.equal(scrolls.length,1);assert.equal(value.name,'Keep contact');assert(value.legal_acceptance_accepted);
 }
});
test('Post-retirement: saving contact preserves configuration notes and review checkout snapshot',()=>{
 const form={elements:{message:{value:''},hourly_daily_notes:{value:'Agenda conservada'}}};
 const build=declarations('assets/js/forms/hourly-booking-api-checkout.js',['buildCheckoutReviewSnapshot'],{
  getFormPayloadRaw:f=>({hourly_daily_notes:f.elements.hourly_daily_notes.value,message:f.elements.message.value}),
  getFieldValue:(f,k)=>f.elements[k]?.value||'',buildRequestSummary:()=>'',getDocumentLocale:()=> 'es',addLegalAcceptanceFields(){},
  window:{PixkuyFleetSelection:{hourlyPassengers:Number,snapshot:(_,v)=>v}}
 }).buildCheckoutReviewSnapshot;
 let saved;const bindings={form,hydrated:true,suspended:false,restoringDraft:false,renderedStep:'datos',mount:{contains:f=>f===form},snapshot:null,editing:()=>null,
  api:{draft:()=>build(form,{hourlyDailyNotes:form.elements.hourly_daily_notes.value,hourlyDailyMode:'hourly',hourlyDailyPassengers:4,name:'Contact'})},
  draft:{save:value=>{saved=value;return value;}}};
 declarations('assets/js/forms/hourly-booking-flow.js',['save'],bindings).save();
 assert.equal(saved.hourly_daily_notes,'Agenda conservada');assert.equal(saved.form_payload_raw.hourly_daily_notes,'Agenda conservada');assert.equal(saved.name,'Contact');
});
test('Post-retirement: first long-term pickup seed preserves ownership, reset and receipt',()=>{
 const detail={hourly_daily_mode:'full_day',hourly_daily_pickup:'Selected hotel',hourly_daily_pickup_place_id:'place-test',hourly_daily_pickup_lat:'19.4',hourly_daily_pickup_lng:'-99.1',hourly_daily_date:'2027-01-28',hourly_daily_start_time:'09:00',hourly_daily_notes:'Do not copy agenda',hourly_daily_passengers:4,name:'Do not copy contact'};
 for(const mobile of [false,true])for(const kind of ['first','own','cleared','reset','received']){
  const storage=new Map(),initial={version:1,contact:{name:'Existing contact'},consent:{accepted:false}};let opened=0,exited;
  if(kind==='own'||kind==='cleared')initial.config={pickup:kind==='own'?'Own hotel':'',pickupPlaceId:kind==='own'?'own-id':'',pickupLat:'',pickupLng:'',notes:'Own agenda'};
  if(kind==='reset'||kind==='received'){initial.receipt={state:'received',reference:'CONTROLLED'};initial.attempt={key:'immutable'};}
  const bindings={state:initial,ordinary:null,busy:false,KEY:'controlled',desktop:()=>!mobile,
   sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},open:()=>opened++,panelChanged(){},showStatus(){throw Error('storage failure');},releaseSentPanel(){},exitTo:hash=>exited=hash};
  const api=declarations('assets/js/forms/long-term-request.js',['snapshot','received','save','switchMode','anotherService'],bindings);
  if(kind==='reset'){
   api.anotherService();assert.equal(exited,'services');assert.equal(JSON.parse(storage.get('controlled:received:CONTROLLED')).attempt.key,'immutable');
   bindings.state=JSON.parse(storage.get('controlled'));assert(bindings.state.pickupSeedDisabled);assert.equal(Object.keys(bindings.state.contact).length,0);
  }
  const out=api.switchMode('full_day','custom_long_term',detail);
  if(kind==='received'){assert.equal(opened,1);assert.equal(bindings.state.attempt.key,'immutable');continue;}
  assert.equal(out.pickup,kind==='first'?'Selected hotel':kind==='own'?'Own hotel':'');
  if(kind==='first'){assert.equal(out.pickupPlaceId,'place-test');assert.equal(out.pickupLat,'19.4');assert.equal(out.pickupLng,'-99.1');}
  assert.equal(out.tripDate,'');assert.equal(out.startTime,'');assert.equal(out.notes,kind==='own'||kind==='cleared'?'Own agenda':'');assert.equal(out.name,undefined);assert.equal(out.consent,undefined);
  if(kind!=='reset'){assert.equal(bindings.state.contact.name,'Existing contact');assert.equal(bindings.state.consent.accepted,false);}
 }
});
test('Post-retirement: both desktop transactional CTAs use Data; mobile and long-term keep their copy',()=>{
 for(const mode of ['hourly','full_day','custom_long_term'])for(const mobile of [false,true])for(const complete of [false,true]){
  const fn=declarations(panel,['getHourlyCtaText'],{state:{mode},MODES:{HOURLY:'hourly',FULL_DAY:'full_day',LONG_TERM:'custom_long_term'},isConfigComplete:()=>complete,isHourlyContinueBlockedByAvailability:()=>false,isMobileHourlyViewport:()=>mobile,getI18nValue:key=>key.endsWith('dataCta')?'DATA':'LONG_TERM'}).getHourlyCtaText;
  assert.equal(fn({cta:'ORIGINAL',ctaDisabled:'INCOMPLETE'}),!complete?'INCOMPLETE':mode==='custom_long_term'?'LONG_TERM':mobile?'ORIGINAL':'DATA');
 }
 for(const lang of ['es','en','fr','de','it','pt','ru','ko','zh-hans'])assert(JSON.parse(source('assets/i18n/'+lang+'/services-hourly.json')).services.cards.hourly.panel.dataCta);
});
test('Post-retirement: configuration-only progress overrides list collision; desktop-only notes action',()=>{
 const postcss=require('../../../pixkuy_frontend/node_modules/postcss'),css=postcss.parse(source('assets/css/long-term-request.css')),rules=[];
 css.walkRules(rule=>{if(rule.selector.includes('.long-term-request__steps--config')&&rule.selector.includes('airport-booking__step'))rules.push(rule);});
 assert.equal(rules.length,2);for(const rule of rules)assert.equal(rule.parent.params,'(min-width:721px)');
 const marker=rules.find(r=>r.selector.includes('step-marker')),content=rules.find(r=>r.selector.includes('step-content'));
 assert(marker.nodes.some(d=>d.prop==='display'&&d.value==='inline-grid'));assert(content.nodes.some(d=>d.prop==='display'&&d.value==='inline-flex'));assert(content.nodes.some(d=>d.prop==='background'&&d.value==='transparent'));
 const flow=source('assets/js/forms/hourly-booking-flow.js');assert.match(flow,/desktopBlock\("notes",notes,contactEdit\(\)\?null:function\(\)\{trip\(true\);\}\)/);
 assert.doesNotMatch(flow,/hourly_daily_notes\.value=form\.elements\.message\.value/);
});
test('Netlify retirement: owned controls initialize without legacy form or initializer',()=>{
 // Minimal element boundary for the actual provider, not a browser/layout test.
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.listeners={};this.value='';}
  append(...nodes){this.children.push(...nodes);}
  appendChild(n){this.append(n);return n;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  setCustomValidity(value){this.validationMessage=value;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
  get elements(){const nodes=this.descendants().filter(n=>['input','textarea','button'].includes(n.tag));nodes.namedItem=k=>nodes.find(n=>n.name===k)||null;for(const n of nodes)if(n.name)nodes[n.name]=n;return nodes;}
  querySelectorAll(s){return this.descendants().filter(n=>{const m=/^\[([^=]+)(?:="([^"]*)")?\]$/.exec(s);return m&&n.attrs[m[1]]!==undefined&&(m[2]===undefined||n.attrs[m[1]]===m[2]);});}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 const document={body:new Element('body'),createElement:tag=>new Element(tag),querySelector(){throw Error('Unexpected legacy document lookup');}},events={};
 const window={addEventListener:(name,fn)=>events[name]=fn,libphonenumber:{parsePhoneNumberFromString:v=>({number:v,isValid:()=>/^\+5255\d{8}$/.test(v)})}};
 vm.runInNewContext(source('assets/js/forms/legal-acceptance.js'),{window,document});
 assert.deepEqual(Object.keys(window.PixkuyForms),['LegalAcceptance']);
 vm.runInNewContext(source('assets/js/forms/hourly-booking-form.js'),{window,document});
 const provider=window.PixkuyHourlyBookingForm,form=provider.getReservationForm();
 assert.equal(form.name,'hourly-booking');assert.equal(form.className,'form');assert.equal(form.attrs['data-netlify'],undefined);
 assert.equal(form.elements.namedItem('form-name'),null);assert(!provider.refreshReservationRequestValidationUX());
 assert.equal(form.elements.message.type,'hidden');assert.equal(form.querySelector('[data-hourly-booking-field="message"]'),null);
 for(const mode of ['hourly','full_day']){
  provider.restore({...snapshot,hourly_daily_mode:mode,name:'Synthetic Person',phone:'+52 55 1234 5678',email:'test@example.invalid'});
  assert(provider.refreshReservationRequestValidationUX());
  const data=provider.getReservationRequestData();assert.equal(data.serviceType,'hourly_daily');assert.equal(data.hourlyDailyMode,mode);assert.equal(data.phone,'+525512345678');
  const api=declarations('assets/js/forms/hourly-booking-api-checkout.js',['getForm','getReservationApi','isHourlyTransactionalData','buildAvailabilityPrecheckDetail'],{window:{...window,PixkuyFleetSelection:{hourlyPassengers:Number}}});
  assert.equal(api.getForm(),form);assert.equal(api.getReservationApi(),provider);assert(api.isHourlyTransactionalData(data));
  assert.equal(api.buildAvailabilityPrecheckDetail(data).hourly_daily_passengers,4);
 }
 for(const locale of ['es','en','fr','de','it','pt','ru','ko','zh-hans']){
  window.__pixkuyI18nDict={contact:{name:locale+' name',phone:locale+' phone',email:locale+' email',notes:locale+' notes',submit:locale+' submit',validation:{}}};
  events['pixkuy:i18n-applied']();assert.equal(form.elements.name.placeholder,locale+' name');assert.equal(form.elements.name.value,'Synthetic Person');
 }
 provider.restore({email:'invalid'});assert(!provider.refreshReservationRequestValidationUX());
 assert.equal(form.elements.legal_acceptance_accepted.value,'');
 provider.restore({hourly_daily_notes:'Agenda desde Configuración'});assert.equal(provider.getReservationRequestData().hourlyDailyNotes,'Agenda desde Configuración');
 assert.equal(form.elements.message.value,'Agenda desde Configuración');
 provider.restore({name:'Changed contact'});assert.equal(form.elements.hourly_daily_notes.value,'Agenda desde Configuración');
 provider.restore({hourly_daily_notes:'',message:'old alias'});assert.equal(form.elements.message.value,'');assert.equal(provider.getReservationRequestData().hourlyDailyNotes,'');
 let prevented=false;form.listeners.submit({preventDefault(){prevented=true;}});assert(prevented);
});
test('Netlify retirement: legacy links preserve language and target the owned route',()=>{
 for(const returning of [false,true]){
  const location=new URL('https://local.pixkuy.test/?lang=en&service=hourly_daily#contact');let target;
  const window={location,sessionStorage:{getItem:()=>returning?'1':null},history:{state:{keep:true},replaceState:(state,_,url)=>{assert(state.keep);target=new URL(url);}}};
  const fn=declarations('assets/js/services-expand.js',['getRequestedServiceFromUrl'],{window,URL,URLSearchParams,mobileQuery:{matches:false}}).getRequestedServiceFromUrl;
  assert.equal(fn(),'hourly');assert.equal(target.searchParams.get('lang'),'en');assert.equal(target.hash,returning?'#hourly/datos':'#hourly/servicio');
 }
});
test('Netlify retirement: fresh configuration handoff does not invalidate its certified offer',()=>{
 let restored,saved=false,destination;const form={elements:{message:{value:''},hourly_daily_notes:{value:'Keep notes'}}};
 const value={service_type:'hourly_daily',hourly_daily_mode:'hourly',hourly_daily_price:'5400'};
 const fn=declarations('assets/js/forms/hourly-booking-flow.js',['openData'],{
  hydrated:false,suspended:false,renderedStep:'servicio',reviewed:'',form,
  window:{PixkuyHourlyBookingForm:{restore:v=>{restored=v;}}},
  draft:{restore(){throw Error('Fresh offer invalidated by draft sync');}},save:flag=>saved=flag,go:step=>destination=step
 }).openData;
 assert(fn(value));assert.equal(restored,value);assert(saved);assert.equal(destination,'datos');assert.equal(form.elements.message.value,'Keep notes');
});
test('Netlify retirement: no legacy controls/imports; standalone scripts precede consumers',()=>{
 const html=source('index.html');
 assert.doesNotMatch(html,/name="hourly_daily_|data-contact-service-(?:trigger|panel)="hourly_daily"|contact-hourly-daily-editor\.js|40-contact-hourly-daily\.css/);
 for(const name of ['tour_private','event_special','direct_transfer','other'])assert(html.includes('data-contact-service-trigger="'+name+'"'));
 const before=(a,b)=>assert(html.indexOf(a)>=0&&html.indexOf(a)<html.indexOf(b));
 before('legal-acceptance.js','hourly-booking-form.js');before('hourly-booking-form.js','hourly-booking-api-checkout.js');before('whatsapp-contact.js','long-term-request.js');
 assert.doesNotMatch(html.match(/<script[^>]+hourly-booking-form\.js[^>]*>/)[0],/defer|async/);
 for(const file of ['hourly-booking-form','hourly-booking-draft','hourly-booking-flow','hourly-booking-api-checkout','long-term-request']){
  assert.doesNotMatch(source('assets/js/forms/'+file+'.js'),/form\[name=["']contact|PixkuyForms\??\.(?:getReservation|contactServiceState|applyContactHourly)/);
 }
});
const snapshot={service_type:'hourly_daily',hourly_daily_mode:'hourly',hourly_daily_duration_hours:3,hourly_daily_vehicle_type:'executive_van',
 hourly_daily_pickup:'Synthetic pickup',hourly_daily_pickup_place_id:'synthetic',hourly_daily_pickup_lat:'19.42',hourly_daily_pickup_lng:'-99.16',
 hourly_daily_date:'2027-01-13',hourly_daily_start_time:'10:00',hourly_daily_notes:'preserve notes',hourly_daily_passengers:4,hourly_daily_currency:'MXN'};
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
function styleDeclaration(){
 const values=new Map();return {setProperty:(k,v)=>values.set(k,String(v)),getPropertyValue:k=>values.get(k)||'',
 removeProperty(k){const prior=values.get(k)||'';values.delete(k);return prior;}};
}
function draftFixture(mode='hourly'){
 const state={},fields={},storage=new Map(),events=[];let passengers=1,renders=0;
 for(const k of Object.keys(snapshot))fields[k]={value:''};fields.message={value:''};
 const form={elements:{namedItem:k=>fields[k]}};
 const document={querySelector:()=>form,getElementById:()=>null};
 const window={sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 PixkuyHourlyBookingForm:{getReservationForm:()=>form,getReservationRequestFields:()=>fields,syncReservationRequestState:()=>{}},
 PixkuyFleetSelection:{setPassengers:v=>{passengers=Number(v);},passengers:()=>passengers,hourlyEdit:()=>null},
 dispatchEvent:e=>{events.push(e);apply(e.detail.snapshot);}};
 const apply=declarations(panel,['applyContactHourlyDailySync'],{window,state,normalizeText:v=>v==null?'':String(v).trim(),
 MODES:{HOURLY:'hourly',FULL_DAY:'full_day',LONG_TERM:'long_term'},HOURLY_DURATION_OPTIONS:[2,3,4,5,6,7,8,9,10,11],LONG_TERM_OPTIONS:[],
 HOURLY_PRICING_CONSTANTS:{fullDayHours:12},isMobileHourlyViewport:()=>false,invalidateAvailabilityState:()=>{},renderAll:()=>{renders++;}}).applyContactHourlyDailySync;
 vm.runInNewContext(source(draftPath),{window,document,CustomEvent,Event:CustomEvent});
 const value={...snapshot,hourly_daily_mode:mode};window.PixkuyHourlyBookingDraft.save(value);
 return {window,state,fields,events,value,renders:()=>renders};
}
for(const mode of ['hourly','full_day'])test('restore '+mode+' connects persisted form -> existing panel contract -> passengers',()=>{
 const f=draftFixture(mode),api=f.window.PixkuyHourlyBookingDraft;
 assert(api.restore(api.read()));assert.equal(f.state.mode,mode);assert.equal(f.state.durationHours,mode==='full_day'?12:3);
 assert.equal(f.state.pickup,snapshot.hourly_daily_pickup);assert.equal(f.state.tripDate,snapshot.hourly_daily_date);
 assert.equal(f.state.pickupPlaceId,'synthetic');assert.equal(f.state.notes,'preserve notes');assert.equal(f.window.PixkuyFleetSelection.passengers(),4);
 assert.equal(f.fields.message.value,'preserve notes');assert.equal(f.events[0].detail.snapshot.mode,mode);
 api.syncPanel({...f.value,hourly_daily_start_time:'12:00'});assert.equal(f.state.startTime,'12:00');assert.equal(f.renders(),2);
 api.restore({...f.value,hourly_daily_notes:'',message:'Obsolete alias'});assert.equal(f.fields.message.value,'');assert.equal(f.fields.hourly_daily_notes.value,'');
});
for(const scenario of ['changed','none','error','request-failure','context-changed','available'])test('next availability refresh '+scenario,async()=>{
 const state={tripDate:'2027-01-13',startTime:'10:00',notes:'keep',passengers:4,model:'keep'},applied=[],rechecked=[];let key='original',error=0;
 const fresh={available:scenario==='available',nextAvailableStartLocal:scenario==='none'?null:'2027-01-13T12:30'};
 const fn=declarations(panel,['applyNextAvailableSuggestion'],{state,
 buildHourlySubmitDetail:()=>({...state}),getHourlyAvailabilityContextKey:()=>key,
 getHourlyAvailabilityPrecheckApi:()=>({precheck:async()=>{if(scenario==='error')throw Error('offline');if(scenario==='context-changed')key='changed';return fresh;}}),
 isAvailabilityRequestFailure:()=>scenario==='request-failure',setAvailabilityStatus:(_,kind)=>{if(kind==='error')error++;},getLabels:()=>({availability:{error:'error',available:'available'}}),
 clearAvailabilityBlock:()=>{},setAvailabilityBlock:()=>{},setUnavailableAvailabilityStatus:()=>{},invalidateAvailabilityState:()=>{},syncDerivedState:()=>{},syncLiveFieldValues:()=>{},
 runHourlyAvailabilityPrecheck:async value=>{rechecked.push(value);return true;},
 window:{PixkuySharedAvailabilitySuggestion:{apply:async input=>{applied.push(input.nextAvailableStartLocal);input.applyDateTime({date:'2027-01-13',time:'12:30'});return input.recheck();}}}
 }).applyNextAvailableSuggestion;
 await fn('2027-01-13T11:00');assert.equal(applied.length,scenario==='changed'?1:0);
 if(scenario==='changed'){assert.equal(applied[0],fresh.nextAvailableStartLocal);assert.equal(rechecked[0].startTime,'12:30');}
 else assert.equal(state.startTime,'10:00');
 assert.equal(state.notes,'keep');assert.equal(state.passengers,4);assert.equal(state.model,'keep');
 assert.equal(error,['error','request-failure'].includes(scenario)?1:0);
});
const statusFile='assets/js/forms/booking-status-state.js';
for(const file of ['assets/js/forms/booking-status-mobile.js','assets/js/forms/booking-status-desktop.js'])test(file+' uses paid evidence, never expected as missing paid amount',()=>{
 const api=declarations(file,['formatMoney','amountLabel'],{Intl,emptyValue:()=> '—'});
 const base={paymentAmountExpected:80000,paymentCurrency:'MXN',paymentAmountPaid:null};
 assert.equal(api.amountLabel({}, {...base,paymentStatus:'paid'}),'—');
 assert(api.amountLabel({}, {...base,paymentStatus:'pending'}).includes('800'));
 assert(api.amountLabel({}, {...base,paymentStatus:'mismatch',paymentAmountPaid:90000}).includes('900'));
});
// Execute the real normalizer and its real pure accessors, not an alternate status implementation.
const statusNames=['normalizeText','normalizeResult','resolveView',...Array.from(source(statusFile).matchAll(/function (get(?:ReservationStatus|PaymentStatus|ServiceType|PaymentAmountPaid|PaymentAmountExpected|PaymentCurrency|PublicCode|ServiceStartLocalDate|ServiceStartLocalTime|PickupAddress|DestinationAddress|DurationHours|PassengerCount|PassengerLabel|LuggageCount|CustomerNotes|VehicleDisplayName|CustomerFullName|CustomerEmail|CustomerPhone))\(/g),m=>m[1])];
for(const storage of ['absent','throws','cleared'])test('Hourly public 410 independent of '+storage+' browser context',()=>{
 const window=storage==='absent'?{}:{sessionStorage:{getItem:()=>{if(storage==='throws')throw Error('disabled');return null;}}};
 const normalize=declarations(statusFile,statusNames,{window}).normalizeResult;
 const result=normalize({statusCode:410,ok:false,body:{code:'BOOKING_STATUS_TOKEN_EXPIRED',serviceType:'hourly_daily'}});
 assert.equal(result.view,'requestError');assert.equal(result.accessExpired,true);assert.equal(result.serviceType,'hourly_daily');assert.equal(result.reservationStatus,'');
 assert.equal(normalize({statusCode:410,ok:false,body:{}}).accessExpired,false);
 for(const serviceType of ['airport_transfer','direct_transfer']){
   const access=normalize({statusCode:410,ok:false,body:{code:'BOOKING_STATUS_TOKEN_EXPIRED',serviceType}});
   assert.equal(access.accessExpired,true);assert.equal(access.view,'requestError');assert.equal(access.reservationStatus,'');
 }
 assert.equal(normalize({statusCode:200,ok:true,body:{reservation:{serviceType:'hourly_daily',status:'hold_expired'}}}).view,'expired');
});
test('real Hourly view/flow: Review -> Data -> Configuration without browser history',async()=>{
 // Use the same DOM boundary as the two-module integration, with one initial
 // history entry. Navigation still runs the real view and flow implementations.
 const f=combinedFlowFixture({initial:'#hourly/revision'});await f.ready();
 assert.equal(f.window.location.hash,'#hourly/revision');
 const reviewMount=f.document.querySelector('.hourly-booking--mobile');
 assert.equal(reviewMount.querySelectorAll('.hourly-mobile-flow__back').length,1);
 assert.equal(reviewMount.querySelector('.hourly-mobile-flow__back').textContent,'editTrip');
 assert.equal(f.document.querySelectorAll('button').filter(n=>n.textContent==='edit').length,0);
 f.back();assert.equal(f.window.location.hash,'#hourly/datos');
 f.back();assert.equal(f.window.location.hash,'#hourly/servicio');assert.equal(f.syncCount(),1);assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());
 // The installed shared expiry gate intentionally accepts review only from Data.
 // Re-enter through that real public entrypoint before checking responsive parity.
 assert.equal(f.window.PixkuyHourlyBookingFlow.review({...snapshot}),false);
 assert.equal(f.window.location.hash,'#hourly/servicio');
 f.window.PixkuyHourlyBookingFlow.openData();f.window.PixkuyHourlyBookingFlow.review({...snapshot});f.width(true);assert.equal(f.window.location.hash,'#hourly/revision');
 f.width(false);assert.equal(f.window.location.hash,'#hourly/revision');
});


// Integration at the module boundary: BOTH actual flow modules, in index.html order.
// Synthetic DOM/history/media/RAF only; no browser layout, provider, or alternative product app.
function combinedFlowFixture({origin='ordinary',initial='#hourly/servicio',loading=true,hasService=true}={}){
 const callbacks={},docCallbacks={},raf=[],registrations=[],mediaListeners=[],returns=[];
 const matches=(node,selector)=>{
  if(selector.includes(' ')){const parts=selector.split(/\s+/),last=parts.pop();return matches(node,last)&&!!node.parentNode?.closest(parts.join(' '));}
  if(selector.includes(':'))return false;
  if(selector.startsWith('#'))return node.id===selector.slice(1);
  if(selector.startsWith('.'))return node.className.split(/\s+/).includes(selector.slice(1));
  const attr=/^(?:([a-z]+))?\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
  if(attr)return (!attr[1]||node.tagName===attr[1])&&node.attrs.has(attr[2])&&(attr[3]===undefined||node.attrs.get(attr[2])===attr[3]);
  return node.tagName===selector;
 };
 class Node{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs=new Map();this.dataset={};this.events={};this.className='';this.scrollTop=0;this.style=styleDeclaration();this.classList={add:(c)=>{if(!this.className.split(' ').includes(c))this.className+=' '+c;},remove:(c)=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ');},contains:c=>this.className.split(' ').includes(c)};}
  setAttribute(k,v){this.attrs.set(k,String(v));if(k==='id')this.id=v;if(k==='class')this.className=v;}
  getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}
  hasAttribute(k){return this.attrs.has(k);}
  removeAttribute(k){this.attrs.delete(k);}
  appendChild(n){n.remove();this.children.push(n);n.parentNode=this;return n;}
  append(...nodes){nodes.forEach(n=>this.appendChild(n));}
  prepend(...nodes){for(const n of [...nodes].reverse())this.insertBefore(n,this.children[0]);}
  replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
  insertBefore(n,ref){n.remove();const i=this.children.indexOf(ref);this.children.splice(i<0?this.children.length:i,0,n);n.parentNode=this;}
  insertAdjacentElement(pos,n){assert.equal(pos,'beforebegin');this.before(n);}
  before(n){this.parentNode.insertBefore(n,this);}
  after(n){this.parentNode.insertBefore(n,this.nextSibling);}
  get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
  remove(){if(this.parentNode){const p=this.parentNode;p.children=p.children.filter(n=>n!==this);this.parentNode=null;}}
  querySelectorAll(selector){const result=[];for(const n of this.children){if(selector.split(',').some(s=>matches(n,s.trim())))result.push(n);result.push(...n.querySelectorAll(selector));}return result;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){return matches(this,s)?this:this.parentNode?.closest(s)||null;}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}
  addEventListener(k,f){(this.events[k]??=[]).push(f);}
  click(){for(const fn of this.events.click||[])fn({preventDefault(){},stopPropagation(){}});}
  focus(){document.activeElement=this;}
  scrollIntoView(){}
 }
 const body=new Node('body'),panel=new Node('section'),config=new Node(),form=new Node('form'),submit=new Node('button');
 panel.setAttribute('id','services-expand-hourly');panel.hidden=true;config.setAttribute('data-services-hourly-config','');panel.append(config);body.append(panel);
 form.setAttribute('name','hourly-booking');submit.setAttribute('id','hourly-contact-submit');submit.textContent='Continue';form.append(submit);body.append(form);
 const fields={};for(const key of [...Object.keys(snapshot),'name','phone','email','message']){
  const field=new Node(key==='message'?'textarea':'input');field.value=snapshot[key]||'';fields[key]=field;form.append(field);
 }
 for(const key of ['phone','message']){const label=new Node('label');label.setAttribute('for','hourly-contact-'+key);label.textContent=key;form.append(label);}
 form.elements={...fields,namedItem:key=>fields[key]||null};
 const document={body,documentElement:{lang:'es',style:styleDeclaration()},readyState:loading?'loading':'interactive',title:'Synthetic',activeElement:null,
 createElement:tag=>new Node(tag),createComment:()=>new Node('comment'),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),
 addEventListener:(k,f)=>{(docCallbacks[k]??=[]).push(f);}};
 let current=new URL('http://localhost/?'+(hasService?'service=hourly_daily':'')+(origin==='motion'?'&return_to=in_motion_scroll_cinema&return_chapter=chapter2&return_time=42':'')+initial);
 const locations=[current.href];let index=0;
 const desktop={matches:false,addEventListener:(_,f)=>mediaListeners.push(f)},mobile={matches:true,addEventListener:(_,f)=>mediaListeners.push(f)};
 let sync=0;const storage=new Map(),owners=[];
 const window={location:current,scrollY:0,scrollTo:({top})=>{window.scrollY=top;},matchMedia:()=>mobile,requestAnimationFrame:f=>{raf.push(f);},addEventListener:(k,f)=>{(callbacks[k]??=[]).push(f);if(k==='popstate')registrations.push(f.name);},
 dispatchEvent:e=>{for(const f of callbacks[e.type]||[])f(e);},fetch:async()=>({ok:true,json:async()=>({hourlyBooking:{},services:{cards:{hourly:{mobileFlow:{contactStep:{summary:{}}}}}}})}),
 sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
 PixkuyHourlyBookingForm:{getReservationForm:()=>form},
 history:{pushState:(_,__,url)=>{current=new URL(url,current);window.location=current;locations.splice(++index,Infinity,current.href);},replaceState:(_,__,url)=>{current=new URL(url,current);window.location=current;locations[index]=current.href;}},
 PixkuyInMotionScrollCinema:{returnTo:ctx=>{returns.push(ctx);return true;}},
 PixkuyHourlyBookingDraft:{save:v=>v,restore:()=>true,syncPanel(){sync++;},read:()=>({...snapshot})},
 PixkuyHourlyCheckout:{draft:()=>({...snapshot}),sync(){},setBusy(){}},PixkuyFleetSelection:{hourlyOfferStatus:()=>({valid:true}),read:()=>({}),hourlyEdit:()=>null,model:()=>null,photo:()=>null,passengerLabel:n=>String(n)}};
 window.PixkuyAirportDesktopView={ready:Promise.resolve(),media:desktop,t:k=>k,node:(tag,cls,text)=>{const n=new Node(tag);n.className=cls||'';n.textContent=text||'';return n;},field:()=>new Node('div'),date:v=>v,money:v=>v,vehicle:()=>new Node('div'),icon:()=>new Node('span'),locationField:()=>new Node('div'),
 shell:(_,back)=>{const n=new Node('section'),identity=new Node('div'),button=new Node('button');identity.className='airport-booking__identity';button.addEventListener('click',back);identity.append(button);n.append(identity);return n;},action:(label,fn)=>{const n=new Node('button');n.textContent=label;n.addEventListener('click',fn);return n;}};
 const sandbox={window,document,get location(){return window.location;},CustomEvent,Event:CustomEvent,URL,URLSearchParams,MutationObserver:class{observe(){}disconnect(){}},console};
 const modules=['assets/js/services/hourly-mobile-booking-flow.js','assets/js/forms/hourly-booking-view.js','assets/js/forms/hourly-booking-flow.js'];
 const html=source('index.html');assert(html.indexOf(modules[0])<html.indexOf(modules[2]));
 for(const mod of modules)vm.runInNewContext(source(mod),sandbox,{filename:mod});
 if(loading){document.readyState='interactive';for(const f of docCallbacks.DOMContentLoaded||[])f();}
 function flush(){for(let count=0;raf.length&&count<50;count++)raf.shift()();assert.equal(raf.length,0);}
 flush();
 return {window,document,panel,returns,registrations,flush,syncCount:()=>sync,
  async ready(){await window.PixkuyHourlyBookingView.ready;await Promise.resolve();flush();},
  seedOrigin(){locations.unshift('http://localhost/'+(origin==='motion'?'#pixkuy-in-motion':'#services'));index++;},
  history(delta){index+=delta;assert(index>=0&&index<locations.length);window.location=new URL(locations[index]);current=window.location;window.dispatchEvent(new CustomEvent('popstate'));window.dispatchEvent(new CustomEvent('hashchange'));flush();},
  width(wide){desktop.matches=wide;mobile.matches=!wide;for(const f of mediaListeners)f();window.dispatchEvent(new CustomEvent('resize'));flush();},
  back(){const b=body.querySelector('.hourly-booking--mobile')?.querySelector('.hourly-mobile-flow__back');assert(b);b.click();flush();},
  exit(){const b=panel.querySelector('[data-hourly-mobile-flow-back]');assert(b);b.click();flush();}
 };
}
for(const origin of ['ordinary','motion'])for(const loading of [true,false])test(`combined mobile flows history/width/origin ${origin}, deferred legacy init=${loading}`,async()=>{
 const f=combinedFlowFixture({origin,loading});await f.ready();
 assert.deepEqual(f.registrations,loading?['render','onPopState']:['onPopState','render']);
 assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());
 f.window.PixkuyHourlyBookingFlow.openData();f.window.PixkuyHourlyBookingFlow.review({...snapshot});
 f.history(-1);assert.equal(f.window.location.hash,'#hourly/datos');assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.returns.length,0);
 f.history(-1);assert.equal(f.window.location.hash,'#hourly/servicio');assert.equal(f.returns.length,0);assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());
 assert.equal(f.document.querySelector('[data-hourly-mobile-route-content]').getAttribute('data-hourly-booking-step'),null);
 f.history(1);f.history(1);assert.equal(f.window.location.hash,'#hourly/revision');assert.equal(f.returns.length,0);
 const content=f.document.querySelector('[data-hourly-mobile-route-content]');assert.equal(content.getAttribute('data-hourly-booking-step'),'revision');
 content.scrollTop=240;f.window.dispatchEvent(new CustomEvent("pixkuy:hourly-booking-copy"));assert.equal(content.scrollTop,240);f.width(true);assert.equal(f.returns.length,0);f.width(false);assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.window.location.hash,'#hourly/revision');
 f.back();assert.equal(f.window.location.hash,'#hourly/datos');f.back();assert.equal(f.window.location.hash,'#hourly/servicio');assert.equal(f.returns.length,0);
 f.exit();assert(!f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.returns.length,origin==='motion'?1:0);
 if(origin==='motion'){assert.equal(f.returns[0].chapter,'chapter2');assert.equal(f.returns[0].time,'42');}
 assert(!/^#hourly\//.test(f.window.location.hash));
});
for(const origin of ['ordinary','motion'])for(const initial of ['#hourly/datos','#hourly/revision'])test(`combined mobile reload ${origin} ${initial}`,async()=>{
 const f=combinedFlowFixture({origin,initial});await f.ready();assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.window.location.hash,initial);assert.equal(f.returns.length,0);
 assert.equal(f.document.querySelector('[data-hourly-mobile-route-content]').getAttribute('data-hourly-booking-step'),initial.split('/')[1]);
 f.width(true);f.width(false);assert.equal(f.window.location.hash,initial);assert.equal(f.returns.length,0);
});
test('mobile scrolling/header scope is static evidence only',()=>{
 const css=source('assets/css/hourly-booking-flow.css'),legacy=source('assets/css/53-hourly-mobile-booking-flow.css');
 assert.match(css,/:not\(\.mobile-topbar\):not\(\.mobile-topbar-menu\)/);
 const block=legacy.match(/\.hourly-mobile-route__content\[data-hourly-booking-step\]\{([^}]+)\}/)[1];
 // Approved document scroller: iphone-acceptance-r1, followed by the mobile
 // Data/menu acceptance and HOURLY-EXPIRY-TRANSPORT-20261006 user declaration.
 assert.match(legacy,/\.hourly-mobile-route:has\(\[data-hourly-booking-step\]\) \.hourly-mobile-route__screen,\s*\.hourly-mobile-route__content\[data-hourly-booking-step\]/);
 assert.match(block,/overflow:visible/);assert.match(block,/height:auto/);assert.match(block,/min-height:0/);
 assert.doesNotMatch(block,/(?:height:100dvh|overflow-y:auto|overflow:hidden)/);
 const config=legacy.match(/\.hourly-mobile-route__content\{([^}]+)\}/)[1];
 assert.match(config,/overflow-y:auto/);assert.match(config,/height:var\(--hourly-viewport-height, 100dvh\)/);assert.match(config,/safe-area-inset-bottom/);
 assert.match(legacy,/body\.hourly-booking-active\[data-hourly-mobile-screen="true"\],[\s\S]*?position:relative;[\s\S]*?height:auto;[\s\S]*?overflow:visible;/);
});

for(const origin of ['ordinary','motion'])test(`combined mobile configuration exit by history and Forward ${origin}`,async()=>{
 const f=combinedFlowFixture({origin});await f.ready();f.seedOrigin();f.history(-1);
 assert(!f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.returns.length,origin==='motion'?1:0);
 f.history(1);assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.window.location.hash,'#hourly/servicio');
 assert.equal(f.returns.length,origin==='motion'?1:0);
});
test('combined mobile configuration reload via hash without service query',async()=>{
 const f=combinedFlowFixture({hasService:false});await f.ready();assert(f.window.PixkuyHourlyMobileBookingFlow.isOpen());assert.equal(f.returns.length,0);
});


// Focused pending-edit refinements. Actual status projection, legal policy,
// draft adapter and pending entry; only storage/status rows are synthetic.
function pendingLegalFixture(){
 const window={sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},performance:{now:()=>0},location:{assign:url=>{window.destination=url;}}},document={},storage=new Map();
 vm.runInNewContext(source('assets/js/forms/legal-acceptance.js'),{window,document});
 vm.runInNewContext(source('assets/js/forms/hourly-booking-draft.js'),{window,document});
 const legal=window.PixkuyForms.LegalAcceptance,policy=legal.buildSnapshot('web_hourly_checkout');
 const accepted=Object.fromEntries(Object.entries(legal.fieldNames).map(([key,field])=>[field,String(policy[key])]));
 const apiFile=process.env.PIXKUY_STATUS_PREIMAGE||path.resolve(root,'../../pixkuy-booking-api/src/modules/public-api/publicReservationStatusRepository.ts');
 const text=fs.readFileSync(apiFile,'utf8'),ast=ts.createSourceFile(apiFile,text,ts.ScriptTarget.Latest,true),nodes=[];
 function visit(n){if(ts.isVariableDeclaration(n)&&['toTimeString','buildEditableHourlyDraft'].includes(n.name.getText(ast)))nodes.push('const '+n.getText(ast)+';');ts.forEachChild(n,visit);}visit(ast);
 assert.equal(nodes.length,2);
 const project=vm.runInNewContext(ts.transpileModule(nodes.join('\n')+'\nbuildEditableHourlyDraft;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText);
 const row={service_type:'hourly_daily',hourly_mode:'hourly',pickup_address:'Synthetic pickup',public_model_id:'fixture',public_model_name:'Fixture',public_model_revision:1,service_start_local_time:'10:00:00',amount_expected:150000,form_payload_raw:accepted};
 return {window,storage,accepted,row,project,store:window.PixkuyHourlyBookingDraft};
}
test('Pending refinements: status preserves only recorded legal evidence and current policy guards',()=>{
 const f=pendingLegalFixture(),projected=f.project(f.row);
 for(const [key,value] of Object.entries(f.accepted))assert.equal(projected[key],value,key);
 assert.equal(f.store.fromPublic(projected).legal_acceptance_accepted,'true');
 assert.equal(f.store.fromPublic(f.project({...f.row,form_payload_raw:{}})).legal_acceptance_accepted,false);
 for(const invalid of [{legal_acceptance_terms_version:'obsolete'},{legal_acceptance_accepted_at:''},{legal_acceptance_channel:'other'}])
  assert.equal(f.store.fromPublic(f.project({...f.row,form_payload_raw:{...f.accepted,...invalid}})).legal_acceptance_accepted,false);
 assert.equal(f.project({...f.row,form_payload_raw:{...f.accepted,legal_acceptance_secret:'excluded'}}).legal_acceptance_secret,undefined);
 for(const revoked of ['',false,'false'])assert.equal(f.store.fromPublic(projected,{...f.accepted,legal_acceptance_accepted:revoked}).legal_acceptance_accepted,false);
});
test('Pending refinements: same-reservation service-edit draft precedes committed evidence; foreign drafts never supply consent',()=>{
 for(const receipt of [false,true])for(const local of ['accepted','revoked','foreign']){
  const f=pendingLegalFixture(),token='synthetic-token',prior={token,contactOnly:false},current={reservationToken:token,attempt:receipt?{state:'committed',payload:f.accepted,response:{bookingStatusToken:token}}:null};
  f.store.save({...f.accepted,legal_acceptance_accepted:local==='revoked'?'':'true',hourlyPendingToken:local==='foreign'?'foreign':token});
  f.window.PixkuyFleetSelection={read:()=>current,hourlyEdit:()=>prior,createAttemptKey:()=> 'captured-id'};
  const draft=f.project({...f.row,form_payload_raw:{}}),state={token,result:{publicCode:'SYNTHETIC',raw:{edit:{allowed:true,revision:'r1',draft},payment:{amountExpected:150000,currency:'MXN'},hold:{expiresAt:'2027-01-01'},serverNow:'2026-10-14'}}};
  const api=declarations('assets/js/forms/booking-cancelled-edit.js',['beginHourly','ownsAttempt'],{window:f.window,hourlyStatusReceivedAt:0});
  assert(api.beginHourly(state,false));
  assert.equal(f.store.read().legal_acceptance_accepted,local==='accepted'||local==='foreign'&&receipt?'true':false,local+' receipt='+receipt);
  assert.equal(f.window.destination,'/?service=hourly_daily#hourly/datos');
 }
});
test('Pending refinements: hourly description exists in nine locales and full-day remains distinct',()=>{
 for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
  const copy=JSON.parse(source('assets/i18n/'+lang+'/services-hourly.json')).hourlyBooking;
  assert(copy.confirmedServiceHourly);assert.notEqual(copy.confirmedServiceHourly,copy.confirmedServiceFullDay);
  if(lang==='en')assert.equal(copy.confirmedServiceHourly,'Private chauffeur by the hour');
 }
});

test('Pending refinements: legacy scrollers defer only to pending Hourly desktop routes',()=>{
 for(const mobile of [false,true])for(const editing of [false,true])for(const hash of ['#hourly/datos','#hourly/revision','#hourly/servicio','#services']){
  const location={hash,search:'?service=hourly_daily'},fleet={hourlyEdit:()=>editing?{}:null};
  const own=!mobile&&editing&&hash.startsWith('#hourly/');
  const deep=declarations(panel,['isHourlyDailyDeepLink'],{window:{location,PixkuyFleetSelection:fleet},URLSearchParams,isMobileHourlyViewport:()=>mobile});
  assert.equal(deep.isHourlyDailyDeepLink(),!own);
  for(const service of ['hourly','airport','direct']){
   const frames=[],scrolls=[];
   const bindings={mobileQuery:{matches:mobile},expand:{hidden:false},document:{documentElement:{clientHeight:844}},
    getDesktopServiceDeepLinkTarget:()=>({hidden:false,offsetHeight:200,getBoundingClientRect:()=>({top:500})}),
    window:{location,PixkuyFleetSelection:fleet,innerHeight:844,scrollY:0,requestAnimationFrame:fn=>frames.push(fn),setTimeout(){},scrollTo:v=>scrolls.push(v)}};
   declarations('assets/js/services-expand.js',['scrollDesktopServiceDeepLinkTargetIntoView'],bindings).scrollDesktopServiceDeepLinkTargetIntoView(service);
   while(frames.length)frames.shift()();
   assert.equal(scrolls.length,mobile||own&&service==='hourly'?0:1);
  }
 }
});
