'use strict';
// Offline boundary test. No browser or socket; only the canonical panel/catalog,
// external phone parser and HTTP boundary are controlled. Product readers,
// consent, handoff, draft, precheck, Fleet, review and controller run unchanged.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
class Events {
  constructor() { this.listeners = {}; }
  addEventListener(k, f) { (this.listeners[k] ??= []).push(f); }
  removeEventListener(k, f) { this.listeners[k] = (this.listeners[k] || []).filter(x => x !== f); }
  dispatchEvent(e) { e.target ??= this; for (const f of this.listeners[e.type] || []) f(e); return !e.defaultPrevented; }
}
class Event {
  constructor(type, options = {}) { Object.assign(this, options); this.type = type; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {} stopImmediatePropagation() {}
}
class Element extends Events {
  constructor(tag, doc) { super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.attrs = {}; this.value = ''; this.nodeType = 1; this.dataset = {}; this.style = {setProperty(){},removeProperty(){}}; this.className = ''; }
  get classList() { const n=this; return {contains:c=>n.className.split(/\s+/).includes(c),add(...cs){n.className=[...new Set(n.className.split(/\s+/).concat(cs))].join(' ').trim();},remove(...cs){n.className=n.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},toggle(c,v){if(v===undefined)v=!this.contains(c);v?this.add(c):this.remove(c);return v;}}; }
  append(...nodes) { for (let n of nodes) { if(typeof n==='string')n=this.ownerDocument.createTextNode(n); n.remove(); n.parentNode=this; this.children.push(n); } }
  appendChild(n) { this.append(n); return n; }
  removeChild(n) { assert.equal(n.parentNode,this);n.remove();return n; }
  prepend(...nodes) { for(const n of nodes.reverse()) this.insertBefore(n,this.firstChild); }
  remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this); this.parentNode=null; }
  insertBefore(n, ref) { n.remove(); const i=this.children.indexOf(ref); n.parentNode=this; this.children.splice(i<0?this.children.length:i,0,n); }
  before(n) { this.parentNode.insertBefore(n,this); }
  after(n) { const p=this.parentNode, i=p.children.indexOf(this); n.remove();n.parentNode=p;p.children.splice(i+1,0,n); }
  replaceWith(n) { this.before(n);this.remove(); }
  replaceChildren(...n) { for(const c of [...this.children])c.remove();this.append(...n); }
  get childNodes(){return this.children;} get firstChild(){return this.children[0];} get parentElement(){return this.parentNode;}
  all(){return this.children.flatMap(n=>[n,...n.all()]);}
  contains(n){return n===this||this.all().includes(n);} get isConnected(){return this.ownerDocument.body.contains(this);}
  setAttribute(k,v){this.attrs[k]=String(v);if(['class','id','name','type'].includes(k))this[k==='class'?'className':k]=String(v);}
  getAttribute(k){return k==='class'?this.className:this.attrs[k]??this[k]??null;}
  hasAttribute(k){return k in this.attrs;} removeAttribute(k){delete this.attrs[k];}
  toggleAttribute(k,v){if(v)this.setAttribute(k,'');else this.removeAttribute(k);}
  matches(selector){
    return selector.split(',').some(s=>{
      s=s.trim(); const parts=s.split(/\s+(?=[^\]]*(?:\[|$))/); if(parts.length>1){const last=parts.pop();return this.matches(last)&&!!this.parentNode?.closest(parts.join(' '));}
      const tag=/^[a-z][\w-]*/i.exec(s);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
      const id=/#([\w-]+)/.exec(s);if(id&&this.id!==id[1])return false;
      for(const m of s.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;
      for(const m of s.matchAll(/\[([^=\]]+)(?:=['"]?([^'"\]]*)['"]?)?\]/g)){
        const v=this.getAttribute(m[1]);if(m[2]===undefined?v===null:String(v)!==m[2])return false;
      }
      return !!(tag||id||s.startsWith('.')||s.startsWith('['));
    });
  }
  closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;}
  querySelectorAll(s){return this.all().filter(n=>n.matches(s));} querySelector(s){return this.querySelectorAll(s)[0]||null;}
  get elements(){const a=this.all().filter(n=>['INPUT','TEXTAREA','BUTTON','SELECT'].includes(n.tagName));a.namedItem=k=>a.find(n=>n.name===k)||null;for(const n of a)if(n.name)a[n.name]=n;return a;}
  setCustomValidity(v){this.validationMessage=v;} focus(){this.ownerDocument.activeElement=this;} blur(){this.ownerDocument.activeElement=null;} scrollIntoView(){} getClientRects(){return this.hidden?[]:[{}];}
  cloneNode(deep){const n=new Element(this.tagName,this.ownerDocument);Object.assign(n,{attrs:{...this.attrs},className:this.className,textContent:this.textContent});if(deep)this.children.forEach(c=>n.append(c.cloneNode(true)));return n;}
  set innerHTML(value){this.replaceChildren();this._html=value; /* SVG is presentation only in this test. */} get innerHTML(){return this._html||this.children.map(c=>c.tagName+':'+(c.textContent||'')).join('');}
}
function storage(values={}){const map=new Map(Object.entries(values));return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),dump:()=>Object.fromEntries(map)};}
function runtime({mobile=false,legacy=false,readers=false,saved={},route='#services'}={}){
  const document=new Events();document.createElement=t=>new Element(t,document);document.createComment=()=>document.createElement('comment');document.createTextNode=t=>{const n=document.createElement('text');n.textContent=t;return n;};
  document.body=document.createElement('body');document.documentElement=document.createElement('html');document.documentElement.lang='es';document.readyState='complete';document.activeElement=null;
  document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);document.getElementById=id=>document.querySelector('#'+id);
  if(legacy){const old=document.createElement('form');old.name='contact';document.body.append(old);const n=document.createElement('input');n.name='name';n.value='LEGACY MUST NOT LEAK';old.append(n);}
  const panel=document.createElement('section');panel.id='services-expand-airport';document.body.append(panel);
  for(const role of ['date','time']){const wrap=document.createElement('div');wrap.setAttribute('data-airport-tariff-role',role);wrap.append(document.createElement('input'));panel.append(wrap);}
  const mobileRoot=document.createElement('div');mobileRoot.className='airport-mobile-route__content';document.body.append(mobileRoot);
  const window=new Events(), frames=[], timers=[], calls=[];
  let href='https://local.pixkuy.test/'+route;
  const location={get href(){return href;},get hash(){return new URL(href).hash;},get search(){return new URL(href).search;},pathname:'/',origin:'https://local.pixkuy.test',assign(v){href=new URL(v,href).href;}};
  Object.assign(window,{document,location,history:{state:null,pushState(s,_,v){this.state=s;href=new URL(v,href).href;},replaceState(s,_,v){this.state=s;href=new URL(v,href).href;}},
    sessionStorage:storage(saved),localStorage:storage(),FormData:class{constructor(f){this.f=f;}forEach(fn){for(const n of this.f.elements)if(n.name&&!n.disabled)fn(String(n.value),n.name);}},
    Event,CustomEvent:Event,Response,AbortController,crypto:require('node:crypto').webcrypto,performance,
    matchMedia:q=>Object.assign(new Events(),{matches:q.includes('max-width')?mobile:!mobile}),innerWidth:mobile?390:1440,
    requestAnimationFrame:f=>(frames.push(f),frames.length),cancelAnimationFrame(){},setTimeout:f=>(timers.push(f),timers.length),clearTimeout(){},setInterval:()=>1,clearInterval(){},queueMicrotask,
    MutationObserver:class{observe(){}},scrollTo(){},getComputedStyle:()=>({visibility:'visible'}),
    PIXKUY_BOOKING_API_CONFIG:{apiBaseUrl:'https://controlled.invalid',publicSiteKey:'isolated'},
    // The CDN phone library is not available offline. This stand-in is outside
    // the decoupled boundary; no claim of phone-library regression coverage.
    libphonenumber:{parsePhoneNumberFromString:v=>({number:v,isValid:()=>/^\+5255\d{8}$/.test(v)})}});
  const state={originType:'airport',originValue:'mex',originLabel:'MEX',destinationType:'hotel',lodgingEndpointLabel:'Synthetic hotel',lodgingEndpointPlaceId:'place-fixture',lodgingEndpointLat:19.4,lodgingEndpointLng:-99.1,lodgingEndpointZoneId:'reforma',selectedFareKey:'van_1_2',serviceDate:'2027-01-15',serviceTime:'07:38'};
  const summary={origin:'MEX',destination:'Synthetic hotel',zone:'Reforma',fare:'775 MXN',serviceDate:state.serviceDate,serviceTime:state.serviceTime};
  window.PixkuyAirportZoneTariff={panel,getState:()=>state,getContactSummaryPayload:()=>summary,fleetContextKey:()=>JSON.stringify(state),setAirportSelection:()=>true,setResolvedDestination(){},clearResolvedDestination(){},setFareKeySelection(){},reconcileAvailability(){}};
  window.PixkuyAirportMobileBookingFlow={isOpen:()=>true,open(){},setLuggage(){}};
  window.PixkuyAirportTariffUtils={resolveFareKeyDisplayLabel:()=> '1–2'};
  window.fetch=async(url,init={})=>{
    calls.push({url:String(url),method:init.method||'GET',body:init.body&&JSON.parse(init.body)});
    if(String(url).startsWith('assets/i18n/'))return new Response(fs.readFileSync(path.join(root,url)),{status:200});
    if(String(url).endsWith('/airport-transfer-availability-precheck'))return new Response(JSON.stringify({result:{checkoutAllowed:true,availability:{available:true},price:{available:true,amountMinor:77500,currency:'MXN',pricingVersion:'fixture-v1',quoteFingerprint:'a'.repeat(64)},fleet:{version:1,status:'available',requestKey:'offer-fixture',models:[{modelId:'fixture-model',modelRevision:1,name:'Fixture vehicle',capacity:6,photoUrl:'/fixture.jpg'}]}}}),{status:200});
    throw new Error('CAPTURED_NO_TRANSPORT');
  };
  const sandbox={window,document,console,URL,URLSearchParams,CustomEvent:Event,Event,Response,AbortController,performance,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout};vm.createContext(sandbox);
  const run=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file,timeout:2000});
  if(readers){run('assets/js/forms/reservation-request.js');assert.equal(window.PixkuyForms.initReservationRequestForm(),false);}
  for(const f of ['forms/legal-acceptance','forms/airport-booking-form','services/fleet-selection-state','services/airport-transfer-availability-precheck','forms/airport-transfer-booking-api-checkout','airport-tariff/airport-tariff-handoff','forms/airport-mobile-draft','forms/airport-transfer-checkout-review-page','forms/airport-desktop-view','services/airport-mobile-contact-step','forms/airport-desktop-booking'])run('assets/js/'+f+'.js');
  async function settle(){for(let i=0;i<12;i++)await Promise.resolve();const batch=frames.splice(0);batch.forEach(f=>f());for(let i=0;i<12;i++)await Promise.resolve();}
  return {window,document,state,summary,calls,run,settle,frames,timers};
}
async function scenario(options){
  const c=runtime(options),w=c.window;await c.settle();
  const owner=w.PixkuyAirportBookingForm,form=owner.getReservationForm();
  const flow=w.PixkuyAirportDesktopBooking;assert(flow,'canonical controller initialized');
  assert.equal(form.getAttribute('data-netlify'),null);assert.equal(form.elements.namedItem('form-name'),null);
  assert.notEqual(form,c.document.querySelector('form[name="contact"]'));
  const deps={normalizeText:v=>String(v||'').trim(),getActiveLodgingSide:()=> 'destination',resolveDisplayLabel:(type)=>type==='airport'?'MEX':'Reforma',getZoneIdForFare:()=> 'reforma',resolveFare:()=>({price:775,currency:'MXN'}),formatPrice:n=>n+' MXN',resolveFareKeyDisplayLabel:()=> '1–2',debugSwapTrace(){}};
  assert(w.PixkuyAirportTariffHandoff.handoffPanelSelectionToContact(c.state,deps));
  await c.settle();assert.equal(w.location.hash,'#airport/datos');
  assert.equal(form.elements.name.value,'');assert.equal(w.PixkuyAirportCheckout.validate(),false);
  await assert.rejects(w.PixkuyAirportCheckout.prepare(),/INCOMPLETE_CHECKOUT_CONTEXT/);
  Object.assign(form.elements.name,{value:'Synthetic customer'});form.elements.phone.value='+525512345678';form.elements.email.value='fixture@example.invalid';form.elements.message.value='Preserved notes';
  await assert.rejects(w.PixkuyAirportCheckout.prepare(),/INCOMPLETE_CHECKOUT_CONTEXT/);
  const host=form.querySelector('[data-airport-transfer-checkout-legal-acceptance]');assert(host);
  const legal=host.__pixkuyLegalAcceptanceInstance;legal.checkbox.checked=true;legal.checkbox.dispatchEvent(new Event('change'));
  assert(w.PixkuyAirportCheckout.validate());
  const review=await w.PixkuyAirportCheckout.prepare({interactive:false});
  assert.equal(review.name,'Synthetic customer');assert.equal(review.message,'Preserved notes');assert.equal(review.lodgingPlaceId,'place-fixture');
  assert.equal(review.airport_transfer_airport_id,'mex');assert.equal(review.airport_transfer_date,'2027-01-15');assert(w.PixkuyAirportReview.validateSnapshot(review));
  const submitEvent=new Event('submit',{target:form,cancelable:true});c.document.dispatchEvent(submitEvent);
  assert(submitEvent.defaultPrevented,'the real checkout listener owns this submit');
  for(let i=0;i<12&&w.location.hash!=='#airport/revision';i++){await new Promise(setImmediate);await c.settle();}
  assert.equal(w.location.hash,'#airport/revision','real submit/precheck/review connection');
  flow.configure();assert.equal(w.location.hash,'#airport/traslado');assert.equal(form.elements.message.value,'Preserved notes');
  assert(w.PixkuyAirportTariffHandoff.handoffPanelSelectionToContact(c.state,deps));await c.settle();assert.equal(form.elements.name.value,'Synthetic customer');
  const oldStorage=w.sessionStorage.dump();
  oldStorage['independent-service-fixture']='untouched';
  const reload=runtime({...options,saved:oldStorage,route:'#airport/datos'});await reload.settle();
  reload.window.dispatchEvent(new Event('pageshow'));await reload.settle();
  assert.equal(reload.window.PixkuyAirportBookingForm.getReservationRequestData().name,'Synthetic customer');
  assert.equal(reload.window.PixkuyAirportBookingForm.getReservationRequestData().notes,'Preserved notes');
  assert.equal(reload.window.sessionStorage.getItem('independent-service-fixture'),'untouched');
  assert.equal(reload.window.sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_return'),null);
  reload.document.documentElement.lang='en';reload.window.dispatchEvent(new Event('pixkuy:i18n-applied'));await reload.settle();
  assert.equal(reload.window.PixkuyAirportBookingForm.getReservationRequestData().notes,'Preserved notes');
  owner.restore(review);assert.equal(form.elements.message.value,'Preserved notes');assert(w.PixkuyAirportCheckout.validate());
  owner.restore({...review,message:'',legal_acceptance_accepted:''});assert.equal(form.elements.message.value,'');assert.equal(w.PixkuyAirportCheckout.validate(),false);
  owner.restore(review);owner.restore({...review,lodgingPlaceId:'',lodgingLat:'',lodgingLng:'',airport_transfer_destination_place_id:'',airport_transfer_destination_lat:'',airport_transfer_destination_lng:''});
  assert.equal(w.PixkuyAirportCheckout.validate(),false);await assert.rejects(w.PixkuyAirportCheckout.prepare(),/INCOMPLETE_CHECKOUT_CONTEXT/);
  assert(!c.calls.some(v=>v.url.includes('netlify')||v.url.includes('/checkout')));
  owner.restore(review);
  const late=w.PixkuyAirportCheckout.prepare({interactive:false});
  owner.restore({...review,airport_transfer_time:'08:38'});
  await assert.rejects(late,/AIRPORT_CHECKOUT_CONTEXT_CHANGED/,'late response cannot certify another context');
  owner.restore(review);
  await assert.rejects(w.PixkuyAirportReview.requestCheckout(review),/CAPTURED_NO_TRANSPORT/);
  const sent=c.calls.find(v=>v.url.endsWith('/checkout'));assert(sent,'real review and Fleet built a checkout request');
  assert.equal(sent.body.customer.full_name,'Synthetic customer');assert.equal(sent.body.airport_transfer_notes,'Preserved notes');
  assert.equal(sent.body.airport_transfer_non_airport_location.place_id,'place-fixture');
  assert.equal(sent.body.airport_transfer_price,77500);assert.equal(sent.body.form_payload_raw.message,'Preserved notes');
  assert.equal(sent.body.legal_acceptance_accepted,'true');assert.equal(sent.body.form_payload_raw['form-name'],undefined);
  const frozen=w.sessionStorage.getItem('pixkuy_fleet_b:airport_transfer');
  const pendingReload=runtime({...options,saved:w.sessionStorage.dump(),route:'#airport/revision'});await pendingReload.settle();
  pendingReload.window.dispatchEvent(new Event('pageshow'));await pendingReload.settle();
  assert.equal(pendingReload.window.sessionStorage.getItem('pixkuy_fleet_b:airport_transfer'),frozen,'reload preserves uncertain attempt and identity');
  assert(!pendingReload.calls.some(v=>v.url.endsWith('/checkout')),'reload never retries creation');
  // Traverse the actual pending-status -> editor adapter, then a fresh document.
  const status=runtime({...options});await status.settle();status.document.readyState='loading';
  status.run('assets/js/forms/booking-status-state.js');status.run('assets/js/forms/booking-cancelled-edit.js');status.document.readyState='complete';
  const now=new Date().toISOString(),expiry=new Date(Date.now()+25*60000).toISOString();
  const publicState={token:'controlled-status-token',result:{serviceType:'airport_transfer',view:'pending',publicCode:'CONTROLLED',raw:{actions:{canModify:true},edit:{allowed:true,revision:'revision-fixture',draft:sent.body},hold:{expiresAt:expiry},serverNow:now}}};
  assert(status.window.PixkuyBookingCancelledEdit.begin(publicState));
  const editStored=status.window.sessionStorage.dump(), authority=editStored.pixkuy_airport_pending_edit_v1;
  const editor=runtime({...options,saved:editStored,route:'?service=airport_hotel#airport/datos'});await editor.settle();editor.window.dispatchEvent(new Event('pageshow'));await editor.settle();
  assert.equal(editor.window.PixkuyAirportBookingForm.getReservationRequestData().fare,'775','public amountMinor restored as MXN, once');
  assert.equal(editor.window.PixkuyAirportBookingForm.getReservationRequestData().notes,'Preserved notes');
  assert.equal(editor.window.sessionStorage.getItem('pixkuy_airport_pending_edit_v1'),authority,'opening editor preserves expiry, revision and identity');
  assert.equal(editor.window.PixkuyAirportBookingForm.getReservationRequestData().name,'Synthetic customer');
  owner.restore({...review,airport_transfer_direction:'destination_to_airport'});
  assert.equal(owner.getReservationRequestData().origin,'Synthetic hotel');assert.equal(owner.getReservationRequestData().originPlaceId,'place-fixture');
  assert.equal(owner.getReservationRequestData().destinationPlaceId,'','direction change clears the other side');
  return {case:options,result:'PASS',scope:'real handoff/provider, Data/Review, consent, F5/language, precheck, captured checkout payload, uncertain attempt and pending edit; in-memory DOM/transport'};
}
async function remainingServices(){
  const c=runtime();await c.settle();const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const source=html.slice(html.indexOf('<form\n')>=0?html.indexOf('<form\n'):html.indexOf('<form\r\n'));
  const oldMarkup=source.slice(0,source.indexOf('</form>')+7);
  assert(oldMarkup.includes('name="contact"'));assert(!oldMarkup.includes('airport_hotel'));
  assert(!oldMarkup.includes('data-airport-canonical-controls'));assert(!oldMarkup.includes('hourly_daily'));
  // Controls/attributes are read from the real remaining HTML, not supplied by
  // an alternate form implementation. This checks readers, not layout/events.
  const form=c.document.createElement('form');form.name='contact';c.document.body.append(form);
  for(const match of oldMarkup.matchAll(/<(input|textarea|select|button|p)\b([^>]*)>/g)){
    const node=c.document.createElement(match[1]);
    for(const attr of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g))node.setAttribute(attr[1],attr[2]??'');
    form.append(node);
  }
  c.run('assets/js/forms/reservation-request.js');c.run('assets/js/forms/contact-service-state.js');
  const api=c.window.PixkuyForms,fields=api.getReservationRequestFields(form);assert(fields);
  assert(!Object.values(api.contactServiceState.SERVICE_TYPES).includes('airport_hotel'));
  for(const n of form.elements)if(n.name)n.value='fixture';
  const values={name:'Synthetic customer',phone:'+525512345678',email:'fixture@example.invalid',origin:'Origin',destination:'Destination',trip_date:'2027-01-15',trip_time:'07:38',passengers:'2',luggage:'0',event_special_variant:'arrival'};
  Object.entries(values).forEach(([k,v])=>{assert(form.elements.namedItem(k),k);form.elements.namedItem(k).value=v;});
  const whatsapp=c.document.createElement('a');whatsapp.setAttribute('data-contact-whatsapp','1');c.document.body.append(whatsapp);
  c.window.PixkuyWhatsappContact={phone:()=> '0000000000'}; // Controlled destination; link is never opened.
  c.run('assets/js/forms/whatsapp-handoff.js');assert(api.initWhatsappHandoff());
  for(const service of ['tour_private','event_special','direct_transfer','other']){
    form.elements.namedItem('service_type').value=service;
    const value=api.getReservationRequestData(fields);assert(value,service+' readable');
    assert(api.hasMinimumRequiredReservationData(value),service+' guard accepts complete own fields');
    assert.equal(api.hasMinimumRequiredReservationData({...value,email:''}),false,service+' still rejects missing contact');
    form.dispatchEvent(new Event('change'));
    const message=new URL(whatsapp.getAttribute('href')).searchParams.get('text');
    assert(message.includes('Synthetic customer') && message.includes('fixture@example.invalid'),service+' retains own contact in WhatsApp');
    assert(!message.includes('LEGACY MUST NOT LEAK'));

  }
  for(const lang of ['es','en','fr','de','it','pt','ru','ko','zh-hans']){
    const dictionary=JSON.parse(fs.readFileSync(path.join(root,'assets/i18n',lang+'.json'),'utf8'));
    for(const key of ['contact.name','contact.phone','contact.email','contact.notes','contact.luggage','contact.submit','contact.validation.nameRequired','contact.validation.phoneRequired','contact.validation.emailRequired','contact.validation.luggageRequired'])assert(key.split('.').reduce((v,k)=>v?.[k],dictionary),lang+':'+key);
  }
  return {case:'Remaining Netlify services and shared translations',result:'PASS',scope:'actual HTML controls -> real readers/negative guards/WhatsApp formatting; nine existing dictionaries; no submit or link opening'};
}
(async()=>{
  const results=[];
  for(const mobile of [false,true])for(const absence of ['DOM','controllers']){
    results.push(await scenario({mobile,legacy:absence==='controllers',readers:absence==='DOM'}));
  }
  results.push(await remainingServices());
  console.log(JSON.stringify({results,limits:['Not browser/rendering/visual acceptance','Canonical configuration panel and CDN phone parser controlled','Precheck response controlled; no network, SQL, Stripe or email']},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
