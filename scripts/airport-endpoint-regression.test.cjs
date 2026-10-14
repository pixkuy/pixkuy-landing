'use strict';
// Real Airport panel handlers, precheck adapter, Fleet and suggestion module.
// Controlled DOM, catalog lookup and HTTP: no browser or live availability claim.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../../../pixkuy-booking-api/node_modules/typescript');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function harness(mobile=false){
 const fixture=read('scripts/airport-netlify-independence.test.cjs');
 const {Events,Element,Event}=vm.runInNewContext(fixture.slice(fixture.indexOf('class Events {'),fixture.indexOf('function storage('))+'\n({Events,Element,Event})',{assert});
 const document=new Events(),window=new Events(),requests=[],values=new Map();
 document.documentElement={lang:'es'};document.querySelector=()=>null;document.querySelectorAll=()=>[];
 document.createElement=t=>new Element(t,document);document.createTextNode=t=>{const n=document.createElement('text');n.textContent=t;return n;};
 Object.assign(window,{document,Response,AbortController,CustomEvent:Event,location:{origin:'https://controlled.invalid'},
   sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
   setTimeout:()=>1,clearTimeout(){},PIXKUY_BOOKING_API_CONFIG:{apiBaseUrl:'https://controlled.invalid',publicSiteKey:'synthetic'}});
 window.fetch=(url,init)=>!init?Promise.resolve(new Response('{}')):new Promise((resolve,reject)=>requests.push({payload:JSON.parse(init.body),resolve:(body,status=200)=>resolve(new Response(JSON.stringify(body),{status})),reject}));
 const box={window,document,URL,console};
 for(const module of ['fleet-selection-state','airport-transfer-availability-precheck','shared-availability-suggestion'])vm.runInNewContext(read('assets/js/services/'+module+'.js'),box);
 const state={originType:'airport',originValue:'mex',serviceDate:'2026-10-28',serviceTime:'08:51',destination:'nlu',mobileAvailabilityStatus:'idle'};
 const nodes={panel:document.createElement('div'),cta:document.createElement('button'),availabilityStatus:document.createElement('p'),dateInput:document.createElement('input'),timeInput:document.createElement('input')};
 nodes.dateInput.value=state.serviceDate;nodes.timeInput.value=state.serviceTime;
 nodes.dateInput.checkValidity=nodes.timeInput.checkValidity=()=>true;
 const text=read('assets/js/airport-zone-tariff.js'),ast=ts.createSourceFile('panel.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const names=['normalizeAirportPrecheckResult','getAirportNextAvailableMessage','getAirportAvailabilityMessage','isAirportConfirmedUnavailable','buildAirportTransferPrecheckDetail','buildAirportMobilePrecheckKey','runAirportTransferPrecheck','isAirportMobilePrecheckAllowed','setAirportMobileAvailabilityState','invalidateAirportMobileAvailability','syncAirportMobileAvailability','applyAirportNextAvailableSuggestion','setAirportUnavailableAvailabilityStatus','renderCtaState'];
 const found=[];function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))found.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);assert.equal(found.length,names.length);
 const bindings={window,document,airportMobilePrecheckRequestId:0,airportAutoTimer:null,airportAutoKey:'',normalizeText:v=>String(v||'').trim(),getDocumentLocale:()=> 'es',
   getAirportAvailabilityCopy:(_,fallback)=>fallback,isAirportMobileViewport:()=>mobile,
   getFinalAirportFarePrice:()=>1200,getSelectedFareKey:()=> 'van_1_2',getPassengerCountForFareKey:()=>2,
   getSelectedAirportId:s=>s.originValue,getAirportTransferDirection:()=> 'airport_to_destination',getZoneIdForFare:()=> 'airport_extended_corridor_teotihuacan',
   getAirportTransferNonAirportLocation:s=>({address:s.destination,place_id:s.destination,lat:19.73,lng:-99.02}),
   getAirportTransferAvailabilityPrecheckApi:()=>window.PixkuyAirportTransferAvailabilityPrecheck,
   // This boundary deliberately lets the authoritative server reject same-airport.
   isNonAirportLocationSelectedAirport:()=>false,setNonAirportLocationInvalidState(){},
   requireCtaApi:()=>({getCtaEligibility:()=>({canNavigate:true}),applyCtaState:cta=>{cta.disabled=false;}}),getCtaDeps:()=>({}),
   renderFare(){},ensureAirportAvailabilityStatusNode:n=>n.availabilityStatus,
   setAirportAvailabilityStatus:(n,message)=>{n.availabilityStatus.textContent=message;},clearAirportAvailabilityStatus:n=>{n.availabilityStatus.textContent='';},revealAirportAvailabilityStatus(){},
   syncTemporalDateInput(){},syncTemporalTimeInput(){},renderPanel:(n,s)=>api.renderCtaState(n,s)};
 const api=vm.runInNewContext(found.join('\n')+'\n({'+names.join(',')+'})',bindings);
 window.PixkuyAirportZoneTariff={fleetContextKey:()=>api.buildAirportMobilePrecheckKey(api.buildAirportTransferPrecheckDetail(state))};
 const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
 const query=()=>api.syncAirportMobileAvailability(nodes,state,true,true);
 return {api,state,nodes,requests,query,flush,window};
}
function response(code='',options={}){
 const available=!code;
 return {status:'ok',result:{checkoutAllowed:available,price:{available:!code.includes('LOCATION')&&!code.includes('FARE'),amountMinor:120000},
 availability:{available,status:available?'available':'unavailable',code,...options},
 fleet:{version:1,requestKey:'controlled',status:available?'available':'unavailable',models:available?[{modelId:'model',modelRevision:1,name:'Controlled'}]:[]}}};
}
for(const mobile of [false,true]){
 test((mobile?'mobile':'desktop')+': same airport is validation, not unavailable; valid destination recovers without residual state',async()=>{
   const h=harness(mobile);h.state.destination='mex';const first=h.query();
   h.requests[0].resolve(response('AIRPORT_TRANSFER_NON_AIRPORT_LOCATION_IS_SELECTED_AIRPORT'));await first;
   assert.equal(h.state.mobileAvailabilityStatus,'error');assert.equal(h.nodes.cta.disabled,true);
   const message=h.api.getAirportAvailabilityMessage(h.state.mobileAvailabilityResult,h.state.serviceDate);
   assert.match(message,/diferente del aeropuerto/);assert.doesNotMatch(message,/No hay disponibilidad/);
   h.state.destination='nlu';const second=h.query();h.requests[1].resolve(response());await second;
   assert.equal(h.state.mobileAvailabilityStatus,'available');assert.equal(h.nodes.cta.disabled,false);
   h.state.destination='mex';const third=h.query();h.requests[2].resolve(response('AIRPORT_TRANSFER_NON_AIRPORT_LOCATION_IS_SELECTED_AIRPORT'));await third;
   assert.equal(h.nodes.cta.disabled,true);
 });
 test((mobile?'mobile':'desktop')+': genuine unavailability retains suggestion and requires revalidation',async()=>{
   const h=harness(mobile),first=h.query();h.requests[0].resolve(response('NO_COMPATIBLE_VEHICLE',{nextAvailableStartLocal:'2026-10-28T11:15'}));await first;
   assert.equal(h.state.mobileAvailabilityStatus,'unavailable');assert.match(h.api.getAirportAvailabilityMessage(h.state.mobileAvailabilityResult,h.state.serviceDate),/11:15/);
   const link=h.nodes.availabilityStatus.querySelector('.shared-availability-suggestion__link');
   assert.ok(link);assert.match(link.textContent,/11:15/);
   link.dispatchEvent({type:'click',preventDefault(){}});await h.flush();
   assert.equal(h.nodes.cta.disabled,true);assert.equal(h.requests[1].payload.time,'11:15');
   h.requests[1].resolve(response());await h.flush();assert.equal(h.nodes.cta.disabled,false);
 });
 test((mobile?'mobile':'desktop')+': old offer and old rejection cannot overwrite the new destination',async()=>{
   const h=harness(mobile),old=h.query();h.state.destination='hotel';const current=h.query();
   h.requests[1].resolve(response());await current;h.requests[0].resolve(response('AIRPORT_TRANSFER_NON_AIRPORT_LOCATION_IS_SELECTED_AIRPORT'));await old;
   assert.equal(h.state.mobileAvailabilityStatus,'available');assert.equal(h.nodes.cta.disabled,false);
   h.state.destination='nlu';const prior=h.query();h.state.destination='mex';const invalid=h.query();
   h.requests[3].resolve(response('AIRPORT_TRANSFER_NON_AIRPORT_LOCATION_IS_SELECTED_AIRPORT'));await invalid;
   h.requests[2].resolve(response());await prior;assert.equal(h.state.mobileAvailabilityStatus,'error');assert.equal(h.nodes.cta.disabled,true);
 });
}
test('technical and fare errors never become confirmed unavailability',async()=>{
 for(const code of ['AIRPORT_TRANSFER_LOCATION_VALIDATION_UNAVAILABLE','AIRPORT_TRANSFER_FARE_NOT_FOUND','AIRPORT_TRANSFER_ZONE_NOT_TARIFFED','AIRPORT_TRANSFER_ROUTE_UNAVAILABLE','AIRPORT_OPERATIONAL_POINT_NOT_FOUND']){
   const h=harness(),pending=h.query();h.requests[0].resolve(response(code,{nextAvailableStartLocal:'2026-10-28T11:15'}));await pending;
   assert.equal(h.state.mobileAvailabilityStatus,'error',code);assert.equal(h.nodes.cta.disabled,true);
   assert.doesNotMatch(h.api.getAirportAvailabilityMessage(h.state.mobileAvailabilityResult,h.state.serviceDate),/No hay disponibilidad/,code);
   assert.equal(h.nodes.availabilityStatus.querySelector('.shared-availability-suggestion__link'),null,code);
 }
 const h=harness(),pending=h.query();h.requests[0].resolve({code:'GEOCODING_PROVIDER_HTTP_ERROR'},502);await pending;
 assert.equal(h.state.mobileAvailabilityStatus,'error');assert.equal(h.nodes.cta.disabled,true);
});
test('all nine locales contain same-airport, absent-fare and unavailable-sale copy',()=>{
 for(const locale of ['es','en','fr','de','it','pt','ru','ko','zh-hans'])
   for(const key of ['nonAirportLocationIsSelectedAirport','fareUnavailable','saleUnavailable'])
     assert.ok(JSON.parse(read('assets/i18n/'+locale+'.json')).services.cards.airport.panel.availability[key]);
});
