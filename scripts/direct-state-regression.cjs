'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
// Reuse the existing offline DOM boundary. No browser/rendering claim.
const support=fs.readFileSync(path.join(__dirname,'airport-netlify-independence.test.cjs'),'utf8');
const {Events,Element,Event,storage}=vm.runInNewContext(support.slice(support.indexOf('class Events'),support.indexOf('function runtime'))+'\n({Events,Element,Event,storage})',{assert});
const document=new Events();document.createElement=t=>new Element(t,document);document.createTextNode=t=>Object.assign(document.createElement('text'),{textContent:t});
document.body=document.createElement('body');document.documentElement=document.createElement('html');document.documentElement.lang='es';
document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
const window=Object.assign(new Events(),{document,sessionStorage:storage(),localStorage:storage(),location:{href:'https://local.pixkuy.test/',pathname:'/',search:'',hash:'',origin:'https://local.pixkuy.test'},
  FormData:class{constructor(f){this.f=f;}forEach(fn){for(const n of this.f.elements)if(n.name&&!n.disabled)fn(String(n.value),n.name);}},
  matchMedia:()=>Object.assign(new Events(),{matches:true}),innerWidth:1440,Event,CustomEvent:Event,crypto:require('node:crypto').webcrypto,
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,requestAnimationFrame:()=>1,MutationObserver:class{observe(){}},
  libphonenumber:require('../../../pixkuy_frontend/node_modules/libphonenumber-js'),fetch(url){
    assert(/^assets\/i18n\/[a-z-]+\.json$/.test(url)||url==='assets/js/data/direct-transfer-coverage.geojson','Network forbidden: '+url);
    return Promise.resolve(new Response(fs.readFileSync(path.join(root,url)),{status:200}));
  }});
const sandbox=vm.createContext({window,document,sessionStorage:window.sessionStorage,location:window.location,Event,CustomEvent:Event,URL,URLSearchParams,console,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout});
for(const file of ['data/airport-zone-catalog','services/direct-transfer-airport-guard','services/direct-transfer-coverage','forms/legal-acceptance','services/fleet-selection-state','services/direct-transfer-transactional-state','forms/direct-transfer-booking-form','forms/direct-transfer-pending-edit'])vm.runInContext(fs.readFileSync(path.join(root,'assets/js/'+file+'.js'),'utf8'),sandbox,{filename:file,timeout:1500});
assert.equal(document.querySelector('form[name="contact"]'),null);assert.equal(window.PixkuyForms.getReservationRequestData,undefined);
assert.equal(window.PixkuyFleetSelection.editFromReview('direct_transfer'),true,'Direct Fleet editing must not require the legacy form');
const own=window.PixkuyDirectBookingForm,state=window.PixkuyDirectTransferTransactionalState,legal=window.PixkuyForms.LegalAcceptance;
const trip={direct_transfer_origin_address:'Origen',direct_transfer_origin_place_id:'origin',direct_transfer_origin_lat:'19.4',direct_transfer_origin_lng:'-99.1',direct_transfer_origin_types:['street_address'],direct_transfer_destination_address:'Destino',direct_transfer_destination_place_id:'destination',direct_transfer_destination_lat:'19.5',direct_transfer_destination_lng:'-99.2',direct_transfer_date:'2027-01-15',direct_transfer_time:'10:45',direct_transfer_passenger_fare_key:'van_1_2',direct_transfer_price:'800',direct_transfer_amount_minor:'80000',direct_transfer_currency:'MXN',direct_transfer_pricing_version:'controlled',direct_transfer_quote_fingerprint:'a'.repeat(64),direct_transfer_quote_expires_at:'2027-01-15T10:00:00Z',direct_transfer_quote_accepted_at:'2026-10-13T08:00:00Z',direct_transfer_notes:'Notas de configuración'};
own.setTrip(trip);own.contact({name:'Persona sintética',phone:'+525512345678',email:'direct@example.invalid'});
const snapshot=()=>state.buildSnapshot(own.getReservationForm(),own.getReservationRequestData());
assert(own.validate(true));assert.equal(state.buildCheckoutPayload(snapshot()),null,'Consent missing');
legal.syncAcceptedFields(own.getReservationForm(),legal.buildSnapshot('web_direct_transfer_checkout'));
const payload=state.buildCheckoutPayload(snapshot());assert(payload);assert.equal(payload.customer.full_name,'Persona sintética');assert.equal(payload.direct_transfer_notes,trip.direct_transfer_notes);assert.equal(payload.direct_transfer_origin.types[0],'street_address');assert.equal(payload.direct_transfer_price,80000);
const requestedBand={...snapshot(),direct_transfer_passenger_fare_key:'van_3_4',fleet_model:{passengersSupported:6,maxPassengers:6}};
assert.equal(state.buildPrecheckPayload(requestedBand).passengers,4,'Vehicle metadata must not replace the requested passenger band');
own.contact({email:''});assert.equal(own.validate(true),false);assert.equal(state.buildCheckoutPayload(snapshot()),null,'Incomplete contact');own.contact({email:'direct@example.invalid'});
own.patch({direct_transfer_origin_lat:''});assert.equal(state.buildPrecheckPayload(snapshot()),null);assert.equal(state.buildCheckoutPayload(snapshot()),null,'Incomplete context');own.patch({direct_transfer_origin_lat:trip.direct_transfer_origin_lat});
own.patch({direct_transfer_notes:''});assert.equal(snapshot().direct_transfer_notes,'','Explicit empty notes');
const saved=snapshot();own.contact({name:'Changed'});own.restore(saved);assert.equal(own.raw().name,saved.name);assert(legal.readEvidence(own.getReservationForm(),'web_direct_transfer_checkout'));
for(const patch of [{direct_transfer_origin_place_id:''},{direct_transfer_passenger_fare_key:'unknown'},{direct_transfer_date:'2027-02-30'},{direct_transfer_time:'24:00'},{direct_transfer_date:'2020-01-01'}]){
  const invalid={...saved,...patch};assert.equal(state.buildPrecheckPayload(invalid),null);assert.equal(state.buildCheckoutPayload(invalid),null);
}
assert.equal(state.buildCheckoutPayload({...saved,legal_acceptance_terms_version:'obsolete'}),null);
assert(state.buildCheckoutPayload({...saved,legal_acceptance_channel:'web_direct_transfer_mobile_checkout'}),'Current mobile legal evidence');
assert.equal(window.PixkuyDirectTransferAirportGuard.getCataloguedAirportTransferId({iataCode:'MEX',types:['airport']}),'mex');
for(const lang of ['es','en','fr','de','it','pt','ru','ko','zh-hans']){
  const common=JSON.parse(fs.readFileSync(path.join(root,'assets/i18n',lang,'airport-desktop-booking.json'),'utf8'));
  for(const key of ['reviewCta','dataTitle','yourTrip','contact','notes','amountTitle','estimatedDuration','bookAnother','edit','name','phone','email'])assert(common[key],lang+':'+key);
  const dictionary=JSON.parse(fs.readFileSync(path.join(root,'assets/i18n',lang+'.json'),'utf8'));
  assert(dictionary.fleetSelection.model,lang+':fleetSelection.model');
  const contact=dictionary.contact;
  for(const key of ['name','phone','email','notes'])assert(contact[key],lang+':contact.'+key);
}
async function coverageRace(){
  const ts=require('../../../pixkuy-booking-api/node_modules/typescript');
  const file='assets/js/services/direct-transfer-panel.js',source=fs.readFileSync(path.join(root,file),'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),names=['normalizeText','getSelectedPlaceLabel','setAddressValue','setAddressPlace'],parts=[];
  function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))parts.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);assert.equal(parts.length,names.length);
  const state={},jobs=[];let queries=0;
  const api=vm.runInNewContext(parts.join('\n')+'\n({setAddressValue,setAddressPlace})',{state,addressRevisions:{origin:0,destination:0},
    resolveDirectTransferCoverage:()=>new Promise(resolve=>jobs.push(resolve)),clearAvailabilityStatus(){},resetQuote(){},requestQuoteIfReady(){queries++;}});
  const old=api.setAddressPlace('origin',{label:'Old'}),current=api.setAddressPlace('origin',{label:'Current'});
  jobs[1]({allowed:true});await current;jobs[0]({allowed:true});await old;
  assert.equal(state.origin,'Current');assert.equal(queries,1);
  const late=api.setAddressPlace('origin',{label:'Cleared'});api.setAddressValue('origin','');jobs[2]({allowed:true});await late;
  assert.equal(state.origin,'');assert.equal(state.originPlace,null);assert.equal(queries,1);
}
async function run(){
  await coverageRace();
  await unavailablePricePresentation();
  const compiler=require('../../../pixkuy-booking-api/node_modules/typescript');
  const bridgeFile='assets/js/forms/direct-transfer-booking-api-checkout.js';
  const bridgeAst=compiler.createSourceFile(bridgeFile,fs.readFileSync(path.join(root,bridgeFile),'utf8'),compiler.ScriptTarget.Latest,true);
  const bridgeFunctions=[];
  function extractBridge(n){if(compiler.isFunctionDeclaration(n)&&['syncCanonicalQuoteToForm','getCanonicalQuoteContextKey'].includes(n.name?.text))bridgeFunctions.push(n.getText(bridgeAst));compiler.forEachChild(n,extractBridge);}extractBridge(bridgeAst);assert.equal(bridgeFunctions.length,2);
  const syncQuote=vm.runInNewContext(bridgeFunctions.join('\n')+'\nsyncCanonicalQuoteToForm',{window,normalizeText:v=>typeof v==='string'?v.trim():''});
  own.setTrip({...trip,direct_transfer_passenger_fare_key:'van_3_4'});
  assert.equal(syncQuote({...own.raw(),direct_transfer_passenger_fare_key:'van_5_6',direct_transfer_price:'9000'}),false);
  assert.equal(own.raw().direct_transfer_price,trip.direct_transfer_price,'Quote from a different band must not overwrite Data');
  assert.equal(syncQuote({...own.raw(),direct_transfer_price:'7500'}),true);
  assert.equal(own.raw().direct_transfer_price,'7500','Current-context revalidation remains active');
  const ownerFile='assets/js/forms/direct-transfer-desktop-booking.js';
  const ownerAst=compiler.createSourceFile(ownerFile,fs.readFileSync(path.join(root,ownerFile),'utf8'),compiler.ScriptTarget.Latest,true);
  const ownerFunctions=[];
  function extractOwner(n){if(compiler.isFunctionDeclaration(n)&&['desktop','active','snapshot','save','refreshQuote'].includes(n.name?.text))ownerFunctions.push(n.getText(ownerAst));compiler.forEachChild(n,extractOwner);}extractOwner(ownerAst);assert.equal(ownerFunctions.length,5);
  let renderedQuote=null;
  const ownerBoundary={window,own,state,form:own.getReservationForm(),hydrated:true,pending:null,
    location:{hash:'#direct/datos'},base:{media:{matches:true}},
    mount:{querySelector(selector){assert.equal(selector,'.airport-booking__summary');return {replaceWith(value){renderedQuote=value;}};}},
    summary:()=>snapshot()};
  window.PixkuyDirectDesktopBooking=vm.runInNewContext(ownerFunctions.join('\n')+'\n({refreshQuote})',ownerBoundary);
  state.writeReviewSnapshot(snapshot());
  const proofBeforeUpdate=JSON.stringify(legal.readEvidence(own.getReservationForm(),'web_direct_transfer_checkout'));
  assert.equal(syncQuote({...own.raw(),direct_transfer_price:'900',direct_transfer_amount_minor:'90000',direct_transfer_quote_fingerprint:'b'.repeat(64),direct_transfer_quote_accepted_at:''}),true);
  assert.equal(state.readReviewSnapshot().direct_transfer_price,'900','Updated quote is persisted before another gesture or F5');
  assert.equal(state.readReviewSnapshot().direct_transfer_quote_fingerprint,'b'.repeat(64));
  assert.equal(state.readReviewSnapshot().direct_transfer_quote_accepted_at,'','Updated quote must remain unaccepted');
  assert.equal(state.buildCheckoutPayload(snapshot()),null,'Updated quote cannot prepare checkout before acceptance/revalidation');
  assert.equal(renderedQuote.direct_transfer_price,'900','Summary receives the current amount');
  assert.equal(JSON.stringify(legal.readEvidence(own.getReservationForm(),'web_direct_transfer_checkout')),proofBeforeUpdate);
  own.patch({direct_transfer_price:'obsolete'});own.restore(state.readReviewSnapshot());
  assert.equal(own.raw().direct_transfer_price,'900','Recovery must not resurrect the rejected quote');
  assert.equal(own.raw().direct_transfer_passenger_fare_key,'van_3_4');
  ownerBoundary.base.media.matches=false;renderedQuote=null;
  window.innerWidth=390;
  assert.equal(syncQuote({...own.raw(),direct_transfer_price:'7600'}),true,'Mobile own-context quote remains writable');
  assert.equal(own.raw().direct_transfer_price,'7600');
  assert.equal(renderedQuote,null,'Desktop refresh must not render on mobile');
  assert.equal(state.readReviewSnapshot().direct_transfer_price,'900','Desktop refresh must not overwrite the mobile draft');
  assert.equal(syncQuote({...own.raw(),direct_transfer_passenger_fare_key:'van_5_6',direct_transfer_price:'9000'}),false,'Mobile also rejects another band');
  window.innerWidth=1440;
  const coverage=window.PixkuyDirectTransferCoverage;
  assert((await coverage.resolveCoverageFromPoint({lat:19.418,lng:-99.169})).coverageId);
  assert.equal((await coverage.resolveCoverageFromPoint({lat:40.4,lng:-3.7})).isWithinCoverage,false);
  const morelia=await coverage.resolveCoverageFromPoint({lat:19.705632,lng:-101.1950164});
  assert.equal(morelia.isWithinCoverage,true);
  const ts=require('../../../pixkuy-booking-api/node_modules/typescript');
  const ast=ts.createSourceFile('panel.js',fs.readFileSync(path.join(root,'assets/js/services/direct-transfer-panel.js'),'utf8'),ts.ScriptTarget.Latest,true);
  let requestSource;function findRequest(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='requestQuoteIfReady')requestSource=n.getText(ast);ts.forEachChild(n,findRequest);}findRequest(ast);assert(requestSource);
  const hiddenPanelRequest=vm.runInNewContext(requestSource+'\nrequestQuoteIfReady',{window:{location:{hash:'#direct/datos'}},getQuoteApi(){assert.fail('Hidden Configuration must not initialize a quote request');}});
  assert.equal(hiddenPanelRequest(),false);
  let restrictionSource;function find(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='getDirectTransferRestrictionType')restrictionSource=n.getText(ast);ts.forEachChild(n,find);}find(ast);assert(restrictionSource);
  const restored={originPlace:{},destinationPlace:{},originCoverage:null,destinationCoverage:null};
  const restriction=vm.runInNewContext(restrictionSource+'\ngetDirectTransferRestrictionType',{state:restored,isCataloguedAirportTransferPlace:p=>window.PixkuyDirectTransferAirportGuard.isCataloguedAirportTransferPlace(p)});
  assert.equal(restriction(),'','Unresolved restored coverage is not a rejection');
  restored.originCoverage={isWithinCoverage:true};restored.destinationCoverage=morelia;
  assert.equal(restriction(),'','Morelia is covered by the real local catalogue');
  restored.destinationCoverage={isWithinCoverage:false};assert.equal(restriction(),'out_of_coverage');
  restored.destinationPlace={iataCode:'MEX',types:['airport']};assert.equal(restriction(),'airport');
  console.log(JSON.stringify({result:'PASS',cases:['own controls and serializer without legacy DOM/readers','real phone parser','negative contact, context, civil date and current desktop/mobile consent','location metadata and notes preserved','historical snapshot/consent restored','late coverage cannot replace current/cleared Place','real airport guard and local GeoJSON coverage','nine existing dictionaries','requested passenger band is independent of vehicle capacity','canonical quote requires matching own context at desktop/mobile widths','hidden Configuration cannot start a quote in Data','updated unaccepted quote is saved and passed to summary; restore preserves it','desktop quote refresh does not render or persist on mobile'],limits:['Offline DOM, not visual','No real availability, SQL, Stripe or communication','Real bridge/owner functions extracted from AST; summary render spy is not visual validation','Width assertions do not traverse mobile navigation']},null,2));
}
async function unavailablePricePresentation(){
  window.Response=Response;
  const ts=require('../../../pixkuy-booking-api/node_modules/typescript');
  function functions(file,names){
    const ast=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true),parts=[];
    function visit(n){if((ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n))&&names.includes(n.name?.text))parts.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
    assert.equal(parts.length,names.length);return parts.join('\n');
  }
  const panel=functions('assets/js/services/direct-transfer-panel.js',['normalizeText','getSelectedPlaceLabel','setAddressPlace','getFareText','formatCurrencyAmount','formatPriceLabel','isRecoverableCanonicalQuoteCode','onCanonicalPrice','syncView']);
  const bridge=functions('assets/js/forms/direct-transfer-booking-api-checkout.js',['getPrecheckPrice','parsePositiveIntegerValue','notifyCanonicalPriceChanged','getCanonicalQuoteContextKey','setPanelPrecheckMessage']);
  const state={quote:{price:9650,currency:'MXN'},origin:'NH',destination:'Acapulco',passengerFareKey:'van_3_4'};
  const fare=document.createElement('div'),value=document.createElement('span'),message=document.createElement('p'),cta=document.createElement('button');
  const nodes={'.services-direct-transfer-panel__fare':fare,'.services-direct-transfer-panel__fare-value':value,'[data-direct-transfer-panel-fare-message]':message,'[data-direct-transfer-panel-cta]':cta,'[data-direct-transfer-panel-availability]':document.createElement('p')};
  const edit={serviceEditing:true,token:'synthetic-edit-token',revision:'2026-10-16T08:08:01.485Z',idempotencyKey:'same-edit-key'};
  window.sessionStorage.setItem('pixkuy_direct_pending_edit_v1',JSON.stringify(edit));
  let inputOrigin;
  const snapshot={direct_transfer_date:'2027-01-12',direct_transfer_time:'11:37',direct_transfer_passenger_fare_key:'van_3_4',direct_transfer_origin_place_id:'four-seasons',direct_transfer_origin_lat:'19.4232659',direct_transfer_origin_lng:'-99.1743713',direct_transfer_destination_place_id:'acapulco',direct_transfer_destination_lat:'16.8639515',direct_transfer_destination_lng:'-99.8822807',direct_transfer_price:'9650',direct_transfer_currency:'MXN',direct_transfer_quote_fingerprint:'a'.repeat(64),direct_transfer_pricing_version:'canonical',direct_transfer_quote_accepted_at:''};
  const boundary={window,document,state,Intl,DEFAULT_CURRENCY:'MXN',addressRevisions:{origin:0,destination:0},
    configMount:{querySelector:s=>nodes[s]||null,querySelectorAll:()=>[]},saveConfiguration(){},syncSafariDesktopTimeSelect(){},clearAvailabilityStatus(){},
    getI18nValue:(_key,fallback)=>fallback,getPendingFareText:()=>'',getDirectTransferRestrictionType:()=>'',areSameLocations:()=>false,
    getPrecheckErrorMessage:()=> 'No hay vehículos disponibles',getNextAvailableTimeLabel:()=> '11:48',getNextAvailableStartLocal:()=> '2027-01-12T11:48',
    resolveDirectTransferCoverage:async()=>({isWithinCoverage:true}),requestQuoteIfReady:()=>{inputOrigin=state.originPlace;},
    buildPanelQuoteDetail:()=>({contextKey:api.getCanonicalQuoteContextKey(snapshot)})};
  boundary.document={querySelector(selector){assert.equal(selector,'[data-services-direct-transfer-panel]');return boundary.configMount;}};
  const api=vm.runInNewContext(panel+'\n'+bridge+'\n({setAddressPlace,onCanonicalPrice,notifyCanonicalPriceChanged,getCanonicalQuoteContextKey,getFareText,setPanelPrecheckMessage})',boundary);
  window.addEventListener('pixkuy:direct-transfer-canonical-price',api.onCanonicalPrice);
  await api.setAddressPlace('origin',{label:'Four Seasons',placeId:'four-seasons',lat:19.4232659,lng:-99.1743713});
  assert.equal(inputOrigin.placeId,'four-seasons');assert.equal(window.sessionStorage.getItem('pixkuy_direct_pending_edit_v1'),JSON.stringify(edit));
  let sent;const priorFetch=window.fetch;
  window.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({status:'ok',result:{checkoutAllowed:false,price:{available:true,amountMinor:965000},fleet:{version:1,status:'unavailable',models:[]},availability:{available:false,code:'NO_COMPATIBLE_VEHICLE',nextAvailableStartLocal:'2027-01-12T11:48'}}}));};
  await window.PixkuyFleetSelection.fetchPrecheck('direct_transfer','https://local.pixkuy.test/v1/public/reservations/direct-transfer-availability-precheck',{method:'POST',body:JSON.stringify({originAddress:inputOrigin})},{interactive:false});
  assert.deepEqual(JSON.parse(JSON.stringify(sent.pending_edit)),{token:edit.token,editRevision:edit.revision});
  window.fetch=priorFetch;
  function canonical(available,allowed,code){
    const result={body:{result:{price:{available,amountMinor:965000}}}};
    api.notifyCanonicalPriceChanged(snapshot,false,allowed,code,result);
    api.setPanelPrecheckMessage('Availability status',allowed?'success':'error',result);
  }
  canonical(true,false,'NO_COMPATIBLE_VEHICLE');
  assert.equal(message.hidden,true,'valid tariff must not be presented as price failure');assert.match(value.textContent,/9,650/);assert.equal(cta.disabled,true);
  assert.equal(fare.hidden,false,'the final availability writer must preserve the current tariff');
  assert.equal(fare.getAttribute('data-direct-transfer-panel-fare-state'),'success','valid amount must not receive price-error styling');
  assert.equal(state.quote.quoteAcceptedAt,'','unavailable quote is not accepted');
  const before=JSON.stringify(state.quote);api.onCanonicalPrice({detail:{price:999,checkoutAllowed:true,contextKey:'old-route'}});assert.equal(JSON.stringify(state.quote),before);
  canonical(true,true,'VEHICLE_AVAILABLE');assert.equal(cta.disabled,false,'only canonical revalidation enables continuation');
  canonical(false,false,'DIRECT_TRANSFER_PRICE_UNAVAILABLE');assert.equal(cta.disabled,true);assert.match(message.textContent,/No pudimos calcular/);
  assert.equal(fare.hidden,true,'unavailable tariff must not resurrect an old amount');
  api.setPanelPrecheckMessage('Technical error','error');assert.equal(fare.hidden,true);
  const mobile=functions('assets/js/services/direct-transfer-mobile-config-step.js',['normalizeText','hasCanonicalMobileQuote','isCanonicalRequoteCode','buildCanonicalMobileQuote','applyCanonicalPriceState']);
  const applyMobile=vm.runInNewContext(mobile+'\napplyCanonicalPriceState');
  for(const allowed of [false,true]){
    const detail={price:9650,amountMinor:965000,currency:'MXN',pricingVersion:'canonical',quoteFingerprint:'a'.repeat(64),quoteExpiresAt:'2027-01-12T17:40:00Z',checkoutAllowed:allowed,code:allowed?'VEHICLE_AVAILABLE':'NO_COMPATIBLE_VEHICLE',nextAvailableStartLocal:'2027-01-12T11:48'};
    const before=applyMobile({},detail),after=applyMobile({},{...detail,priceAvailable:true});
    assert.equal(JSON.stringify(after),JSON.stringify(before),'added price signal preserves the mobile contract');
    assert.equal(after.precheckAllowed,allowed);
  }
  window.removeEventListener('pixkuy:direct-transfer-canonical-price',api.onCanonicalPrice);window.sessionStorage.removeItem('pixkuy_direct_pending_edit_v1');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
