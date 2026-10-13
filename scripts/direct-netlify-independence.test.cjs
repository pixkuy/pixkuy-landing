'use strict';
// Focused offline continuation: actual Direct owner, legal, state, desktop/mobile
// controllers and HTTP bridge. Established DOM adapter; no browser/layout claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const support=fs.readFileSync(path.join(__dirname,'airport-netlify-independence.test.cjs'),'utf8');
const {Events,Element,Event:BaseEvent,storage}=vm.runInNewContext(support.slice(support.indexOf('class Events'),support.indexOf('function runtime'))+'\n({Events,Element,Event,storage})',{assert});
class Event extends BaseEvent {stopPropagation(){this.stopped=true;}stopImmediatePropagation(){this.stopped=true;this.immediate=true;}}
class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-10-13T10:00:00Z']));}static now(){return Date.parse('2026-10-13T10:00:00Z');}}
Element.prototype.dispatchEvent=function(e){e.target??=this;const doc=this.ownerDocument;
  for(const f of doc.listeners[e.type]||[]){f(e);if(e.immediate)return !e.defaultPrevented;}
  let node=this;while(node){for(const f of node.listeners[e.type]||[]){f(e);if(e.immediate)break;}if(e.stopped)break;node=e.bubbles?node.parentNode:null;}return !e.defaultPrevented;};
const plain=v=>JSON.parse(JSON.stringify(v));
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const model={modelId:'synthetic-model',modelRevision:1,name:'Synthetic vehicle',passengersSupported:4};
const price={available:true,amountMinor:80000,currency:'MXN',pricingVersion:'offline',quoteFingerprint:'a'.repeat(64),quoteExpiresAt:'2027-01-18T12:00:00Z',durationSeconds:1800,distanceMeters:12000};
const panelPayload={originAddress:{label:'Synthetic origin',placeId:'origin',lat:19.4,lng:-99.1},destinationAddress:{label:'Synthetic destination',placeId:'destination',lat:19.5,lng:-99.2},
  date:'2027-01-19',time:'10:00',passengerFareKey:'van_3_4',passengerBucketLabel:'3–4',notes:'Independent notes',quote:{...price,price:800,quoteAcceptedAt:'2026-10-13T10:00:00Z'}};
const legacyModules=['forms/reservation-request','forms/contact-service-state','forms/contact-service-switcher','forms/submission-guard','forms/index'];
async function runtime({mobile=false,dom=false,controllers=false,saved={}}={}){
  const document=new Events();document.readyState='complete';document.title='Offline';document.createElement=t=>new Element(t,document);
  document.createTextNode=t=>Object.assign(document.createElement('text'),{textContent:t,nodeValue:t});
  document.body=document.createElement('body');document.documentElement=document.createElement('html');document.documentElement.lang='es';
  document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);document.getElementById=id=>document.querySelector('#'+id);
  const node=(tag,cls,text)=>Object.assign(document.createElement(tag),{className:cls||'',textContent:text||''});
  if(dom){const old=node('form');old.name='contact';document.body.append(old);
    // Actual remaining markup attributes/controls, flattened by this DOM adapter.
    // No Direct trip/contact is injected here; this is not a layout test.
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),form=html.match(/<form\s[^>]*name="contact"[\s\S]*?<\/form>/);assert(form);
    for(const tag of form[0].matchAll(/<([a-z][\w-]*)\b[^>]*>/g)){if(tag[1]==='form')continue;const input=node(tag[1]);for(const a of tag[0].matchAll(/([\w-]+)="([^"]*)"/g))input.setAttribute(a[1],a[2]);old.append(input);}
    assert(!old.elements.some(n=>n.name?.startsWith('direct_transfer_')));
    old.elements.namedItem('name').value='LEGACY MUST NOT LEAK';
  }
  let href='https://local.pixkuy.test/?service=direct_transfer#services';const redirects=[],requests=[],timers=[];
  const location={get href(){return href;},get hash(){return new URL(href).hash;},get search(){return new URL(href).search;},get pathname(){return new URL(href).pathname;},origin:'https://local.pixkuy.test',assign:v=>{href=new URL(v,href).href;redirects.push(href);},replace:v=>{href=new URL(v,href).href;redirects.push(href);}};
  const window=Object.assign(new Events(),{document,location,history:{state:null,pushState(s,_,v){this.state=s;href=new URL(v,href).href;},replaceState(s,_,v){this.state=s;href=new URL(v,href).href;}},
    innerWidth:mobile?390:1440,innerHeight:844,matchMedia:q=>Object.assign(new Events(),{matches:q.includes('max-width')?mobile:!mobile}),
    sessionStorage:storage(saved),localStorage:storage(),crypto:require('node:crypto').webcrypto,scrollTo(){},queueMicrotask,Event,CustomEvent:Event,Response,
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame:()=>1,
    libphonenumber:require('../../../pixkuy_frontend/node_modules/libphonenumber-js'),
    FormData:class{constructor(form){assert.equal(form.name,'direct-booking','Only Direct form may be serialized');this.form=form;}forEach(fn){for(const n of this.form.elements)if(n.name&&!n.disabled)fn(String(n.value),n.name);}},
    PIXKUY_BOOKING_API_CONFIG:{apiBaseUrl:'https://local.pixkuy.test',publicSiteKey:'synthetic'},
    async fetch(url,init={}){
      if(/^assets\/i18n\/[a-z-]+\.json$/.test(url))return new Response(fs.readFileSync(path.join(root,url)));
      assert.equal(url,'https://local.pixkuy.test/v1/public/reservations/direct-transfer-availability-precheck','No network/Netlify/checkout/email allowed in Data test');
      requests.push(JSON.parse(init.body));return new Response(JSON.stringify({status:'ok',result:{checkoutAllowed:true,price,availability:{available:true},fleet:{version:1,status:'available',models:[model],selectedModelEligible:true,requestKey:'synthetic'}}}));
    }});
  const sandbox=vm.createContext({window,document,location,history:window.history,sessionStorage:window.sessionStorage,Event,CustomEvent:Event,URL,URLSearchParams,Response,Intl,Date:Clock,console,
    fetch:(...args)=>window.fetch(...args),setTimeout:window.setTimeout,clearTimeout:window.clearTimeout});
  const load=file=>{
    let source=fs.readFileSync(path.join(root,'assets/js',file+'.js'),'utf8');
    if(file==='forms/direct-transfer-booking-api-checkout'){
      const end='})(window, document);';assert.equal(source.split(end).length,2);
      source=source.replace(end,'window.__directHandoff={snapshot:buildPanelSnapshot,open:handoffPanelSnapshotToContact};\n'+end);
    }
    return vm.runInContext(source,sandbox,{filename:file,timeout:1200});
  };
  if(controllers)for(const f of legacyModules)load(f);
  for(const f of ['services/booking-presentation','forms/legal-acceptance','services/fleet-selection-state','services/direct-transfer-transactional-state','forms/direct-transfer-booking-form','forms/direct-transfer-booking-api-checkout'])load(f);
  const own=window.PixkuyDirectBookingForm,state=window.PixkuyDirectTransferTransactionalState,legal=window.PixkuyForms.LegalAcceptance;
  window.PixkuyAirportDesktopView={media:{matches:!mobile},ready:Promise.resolve(),node,t:k=>k,shell:()=>node('main'),action:(text,fn)=>{const b=node('button','',text);b.addEventListener('click',fn);return b;},focusRouteHeading:n=>n.focus(),deadline:()=>node('p')};
  window.PixkuyDirectDesktopView={summary:()=>node('aside','airport-booking__summary'),trip:()=>node('section'),block:()=>node('section')};
  const config=node('section');config.setAttribute('data-services-direct-transfer-config','');document.body.append(config);
  load('forms/direct-transfer-pending-edit');load('forms/direct-transfer-desktop-booking');
  load('services/direct-transfer-mobile-config-step');load('services/direct-transfer-mobile-contact-step');load('services/direct-transfer-mobile-transactional-bridge');await settle();
  return {window,document,load,own,state,legal,config,requests,redirects,sandbox,timers,node};
}
async function check(options){
  const r=await runtime(options),{window:w,document:d,own,state,legal,config}=r;
  assert.equal(!!d.querySelector('form[name="contact"]'),!!options.dom);
  assert.equal(typeof w.PixkuyForms.getReservationForm==='function',!!options.controllers);
  assert.equal(!!w.PixkuyForms.contactDirectTransferEditor,false,'Removed editor never supplied by the test');
  const mobile=w.PixkuyDirectTransferMobileContactStep;
  // Actual configuration handoff contract, not the old form reader.
  const mobileSnapshot=w.PixkuyDirectTransferMobileContactContract.buildSnapshotFromPayload(panelPayload);
  const snap=options.mobile?mobileSnapshot:w.__directHandoff.snapshot({...mobileSnapshot,originAddress:panelPayload.originAddress,destinationAddress:panelPayload.destinationAddress,quote:panelPayload.quote});
  await w.PixkuyFleetSelection.fetchPrecheck('direct_transfer','https://local.pixkuy.test/v1/public/reservations/direct-transfer-availability-precheck',{method:'POST',body:JSON.stringify(state.buildPrecheckPayload(snap))});
  if(options.mobile)assert(mobile.open(config,panelPayload));else assert(w.__directHandoff.open(snap));await settle();
  const fields=()=>options.mobile?Object.fromEntries(['name','phone','email'].map(k=>[k,d.querySelector('[data-direct-transfer-mobile-contact-field="'+k+'"]')])):own.getReservationRequestFields();
  const set=(key,value)=>{fields()[key].value=value;fields()[key].dispatchEvent(new Event('input',{bubbles:true}));};
  const submit=()=>options.mobile?mobile.submit():own.getReservationForm().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  set('name','Synthetic customer');set('phone','+525512345678');set('email','invalid');
  let before=r.requests.length;submit();await settle();assert.equal(r.requests.length,before,'Invalid contact must not query or advance');
  set('email','direct@example.invalid');submit();await settle();assert.equal(r.requests.length,before,'Missing consent blocks');
  const legalHost=d.querySelector(options.mobile?'[data-direct-transfer-mobile-checkout-legal-acceptance]':'[data-direct-transfer-checkout-legal-acceptance]');
  const instance=legalHost.__pixkuyLegalAcceptanceInstance;assert(instance);instance.checkbox.checked=true;instance.checkbox.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  submit();await settle();assert.equal(r.requests.length,before+1,'Actual Data submit revalidates');assert(r.redirects.some(u=>u.includes('direct-transfer-checkout-review.html')));
  const saved=state.readReviewSnapshot(),payload=state.buildCheckoutPayload(saved);assert(payload);
  assert.equal(payload.customer.full_name,'Synthetic customer');assert.equal(payload.customer.email,'direct@example.invalid');assert.equal(payload.direct_transfer_notes,panelPayload.notes);
  assert.equal(payload.direct_transfer_passenger_fare_key,'van_3_4');assert.equal(payload.direct_transfer_price,80000);
  assert.equal(payload.legal_acceptance_channel,options.mobile?'web_direct_transfer_mobile_checkout':'web_direct_transfer_checkout');
  assert.equal(state.buildCheckoutPayload({...saved,email:''}),null);assert.equal(state.buildCheckoutPayload({...saved,legal_acceptance_accepted:''}),null);
  assert.equal(state.buildCheckoutPayload({...saved,direct_transfer_origin_place_id:''}),null);
  // Continue the actual Data snapshot through the existing Review runner. Only
  // its presentation boundary and HTTP are controlled; no legacy callback supplied.
  const reviewRunner=require('./direct-review-renewal-regression.cjs');
  const review=await reviewRunner.runtime({mobile:options.mobile,expired:false,initialSnapshot:saved,
    prepareEnvironment({document,window,sandbox}){
      document.getElementById=id=>document.querySelector('#'+id);
      if(options.dom){const old=document.createElement('form');old.name='contact';document.body.append(old);}
      if(options.controllers)for(const file of legacyModules)vm.runInContext(fs.readFileSync(path.join(root,'assets/js',file+'.js'),'utf8'),sandbox,{filename:file});
      if(options.controllers)document.dispatchEvent(new Event('DOMContentLoaded'));
    }});
  // An unchanged authoritative quote in this transport; fingerprint remains opaque.
  review.window.fetch=((original)=>async(url,init)=>{
    const response=await original(url,init);
    if(url.endsWith('/direct-transfer-availability-precheck')){const body=await response.json();body.result.price={...price};return new Response(JSON.stringify(body));}
    return response;
  })(review.window.fetch);
  review.click();await reviewRunner.settle();assert.equal(review.writes().length,1,'Single captured checkout, no Netlify');
  assert.equal(review.writes()[0].payload.customer.email,'direct@example.invalid');assert.equal(review.writes()[0].payload.direct_transfer_notes,panelPayload.notes);
  // Fresh JS realm with the real serialized draft: no injected contact or legal callback.
  const restored=await runtime({...options,saved:w.sessionStorage.dump()});
  if(options.mobile){assert(restored.window.PixkuyDirectTransferMobileContactStep.restoreDraft(restored.config));}
  else {restored.window.history.replaceState(null,'','/?service=direct_transfer#direct/datos');restored.window.dispatchEvent(new Event('popstate'));}
  await settle();
  const contact=options.mobile?restored.document.querySelector('[data-direct-transfer-mobile-contact-field="email"]').value:restored.own.raw().email;
  assert.equal(contact,'direct@example.invalid','F5 reconstructs contact without legacy reader');
  const restoredHost=restored.document.querySelector(options.mobile?'[data-direct-transfer-mobile-checkout-legal-acceptance]':'[data-direct-transfer-checkout-legal-acceptance]');
  assert(restoredHost.__pixkuyLegalAcceptanceInstance.isAccepted(),'Own consent evidence restored');
  restored.document.documentElement.lang='en';restored.window.dispatchEvent(new Event('pixkuy:i18n-applied'));await settle();
  assert.equal(restored.state.readReviewSnapshot().direct_transfer_notes,panelPayload.notes);
  // Actual pending dispatcher -> real desktop/mobile contact editor. No payment operation.
  const base={...saved,customer:{full_name:'Pending synthetic',email:'pending@example.invalid',phone:'+525512345678'}};
  const raw={reservation:{serviceType:'direct_transfer',status:'pending_payment',publicCode:'SYNTHETIC'},payment:{status:'pending'},actions:{canModify:true},edit:{allowed:true,revision:'synthetic-revision',draft:base},hold:{expiresAt:'2027-01-18T12:30:00Z'},serverNow:'2027-01-18T12:00:00Z'};
  restored.window.PixkuyBookingStatusState={onReady(){}};restored.load('forms/booking-cancelled-edit');
  assert(restored.window.PixkuyBookingCancelledEdit.begin({token:'synthetic-token',result:{serviceType:'direct_transfer',view:'pending',raw}}));
  restored.window.fetch=async url=>{assert(url.includes('/v1/public/reservations/status?token=synthetic-token'));return new Response(JSON.stringify(raw));};
  await restored.window.PixkuyDirectPendingEdit.mountData(restored.config);await settle();
  const pendingField=options.mobile?restored.document.querySelector('[data-direct-transfer-mobile-contact-field="name"]'):restored.own.getReservationRequestFields().name;
  assert.equal(pendingField.value,'Pending synthetic');pendingField.value='Pending changed';pendingField.dispatchEvent(new Event('input',{bubbles:true}));
  const edit=JSON.parse(restored.window.sessionStorage.getItem('pixkuy_direct_pending_edit_v1'));assert.equal(edit.customer.full_name,'Pending changed');assert.equal(edit.token,'synthetic-token');assert.equal(edit.expiresAt,raw.hold.expiresAt);
  // Same pending controller continues to its real update-contact transport branch.
  const writes=[];restored.window.history.replaceState(null,'','/direct-transfer-checkout-review.html?pending=1#revision');
  for(const selector of ['proceed','edit','error','empty','content','details','legal']){const element=restored.node(selector==='proceed'?'button':'div');element.setAttribute('data-direct-transfer-checkout-review-'+selector,'');restored.document.body.append(element);}
  restored.window.fetch=async(url,init={})=>{
    if(url.includes('/status?token='))return new Response(JSON.stringify(raw));
    assert(url.endsWith('/update-contact'),'Pending must never submit Netlify');writes.push({body:JSON.parse(init.body),headers:init.headers});
    return new Response(JSON.stringify({bookingStatusToken:'synthetic-token',checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic',hold:raw.hold,editRevision:'next'}));
  };
  restored.window.PixkuyDirectPendingEdit.mount({renderStaticCopy(){},renderDetails(){},renderLegal(){},
    loadDictionary:async()=>JSON.parse(fs.readFileSync(path.join(root,'assets/i18n/es/direct-transfer-checkout.json'))).directTransferCheckout,
    redirectToCheckout:()=>true});
  await settle();const proceed=restored.document.querySelector('[data-direct-transfer-checkout-review-proceed]');assert.equal(proceed.disabled,false,'Authoritative pending state and own guards allow the action');
  await proceed.onclick();assert.equal(writes.length,1);assert.equal(writes[0].body.customer.full_name,'Pending changed');
  assert.equal(writes[0].headers['X-Pixkuy-Booking-Token'],'synthetic-token');assert(writes[0].headers['Idempotency-Key']);
  assert.equal(JSON.parse(restored.window.sessionStorage.getItem('pixkuy_direct_pending_edit_v1')).expiresAt,raw.hold.expiresAt);
  return {device:options.mobile?'mobile':'desktop',absence:options.dom?'B:controllers':options.controllers?'A:DOM':'C:both',result:'PASS'};
}
async function remainingForm(){
  const r=await runtime({dom:true});for(const f of legacyModules.slice(0,4))r.load(f);
  const api=r.window.PixkuyForms,form=api.getReservationForm(),fields=api.getReservationRequestFields(form);
  const base={name:'Synthetic',phone:'+525512345678',email:'other@example.invalid',tripDate:'2027-01-19',tripTime:'10:00',origin:'Origin',destination:'Destination',passengers:'2',luggage:'0'};
  const variants={other:{},tour_private:{tourPrivateTourId:'synthetic',tourPrivatePassengerFareKey:'van_1_2',tourPrivatePickup:'Origin',tourPrivateDate:'2027-01-19',tourPrivateTime:'10:00',tourPrivatePrice:'100',tourPrivateCurrency:'MXN'},
    event_special:{eventSpecialEventId:'synthetic',eventSpecialVariant:'arrival',eventSpecialPassengerFareKey:'van_1_2',eventSpecialPrice:'100',eventSpecialCurrency:'MXN',eventSpecialOriginAddress:'Origin',eventSpecialOriginPlaceId:'origin',eventSpecialOriginPickupTime:'10:00'}};
  for(const [service,values] of Object.entries(variants)){
    api.contactServiceState.setActiveServiceType(service);assert.equal(fields.serviceType.value,service);
    for(const [key,value] of Object.entries({...base,...values})){assert(fields[key],'Existing control retained: '+key);fields[key].value=value;}
    const data=api.getReservationRequestData(fields);assert(api.hasMinimumRequiredReservationData(data),service+' valid');
    assert.equal(api.hasMinimumRequiredReservationData({...data,email:''}),false,service+' invalid contact blocked');
  }
  api.contactServiceState.setActiveServiceType('direct_transfer');assert.equal(fields.serviceType.value,'other','Legacy state cannot reactivate removed Direct');
  const ownButton=r.own.getReservationRequestFields().submit;ownButton.disabled=false;r.window.PixkuySubmissionGuard.lockForm(form);assert.equal(ownButton.disabled,false,'Old guard cannot lock Direct');
  assert.equal(r.requests.length,0);return 'PASS: other/tour_private/event_special selection, actual controls/readers/validation, own guard isolation; no submission';
}
async function main(){const results=[];for(const mobile of [false,true])for(const variant of [{controllers:true},{dom:true},{}])results.push(await check({mobile,...variant}));const remaining=await remainingForm();console.log(JSON.stringify({result:'PASS',results,remaining,transport:'captured',browser:false,realOperations:0},null,2));}
main().catch(error=>{console.error(error);process.exitCode=1;});
