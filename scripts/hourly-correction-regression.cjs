"use strict";
// Unit tests of real modules/declarations. DOM, database and provider boundaries are doubles;
// these results do not certify a browser layout or PostgreSQL concurrency.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ts=require(process.env.PIXKUY_TYPESCRIPT_MODULE||'../../../pixkuy-booking-api/node_modules/typescript');
const source=rel=>fs.readFileSync(path.join(root,rel),'utf8');
function declarations(rel,names,bindings){
 const text=source(rel),ast=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),found=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name&&names.includes(n.name.text))found.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
 assert.equal(found.length,names.length);return vm.runInNewContext(found.join('\n')+'\n({'+names.join(',')+'})',bindings);
}
const panel='assets/js/services/hourly-daily-panel.js',draftPath='assets/js/forms/hourly-booking-draft.js';
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
 PixkuyForms:{getReservationRequestFields:()=>fields,syncReservationRequestState:()=>{}},
 PixkuyFleetSelection:{setPassengers:v=>{passengers=Number(v);},passengers:()=>passengers,hourlyEdit:()=>null},
 dispatchEvent:e=>{events.push(e);apply(e.detail.snapshot);}};
 const apply=declarations(panel,['applyContactHourlyDailySync'],{window,state,normalizeText:v=>v==null?'':String(v).trim(),
 MODES:{HOURLY:'hourly',FULL_DAY:'full_day',LONG_TERM:'long_term'},HOURLY_DURATION_OPTIONS:[2,3,4,5,6,7,8,9,10,11],LONG_TERM_OPTIONS:[],
 HOURLY_PRICING_CONSTANTS:{fullDayHours:12},invalidateAvailabilityState:()=>{},renderAll:()=>{renders++;}}).applyContactHourlyDailySync;
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
// Execute the real normalizer and its real pure accessors, not an alternate status implementation.
const statusNames=['normalizeText','normalizeResult','resolveView',...Array.from(source(statusFile).matchAll(/function (get(?:ReservationStatus|PaymentStatus|ServiceType|PaymentAmountPaid|PaymentAmountExpected|PaymentCurrency|PublicCode|ServiceStartLocalDate|ServiceStartLocalTime|PickupAddress|DestinationAddress|DurationHours|PassengerCount|PassengerLabel|LuggageCount|CustomerNotes|VehicleDisplayName|CustomerFullName|CustomerEmail|CustomerPhone))\(/g),m=>m[1])];
for(const storage of ['absent','throws','cleared'])test('Hourly public 410 independent of '+storage+' browser context',()=>{
 const window=storage==='absent'?{}:{sessionStorage:{getItem:()=>{if(storage==='throws')throw Error('disabled');return null;}}};
 const normalize=declarations(statusFile,statusNames,{window}).normalizeResult;
 const result=normalize({statusCode:410,ok:false,body:{code:'BOOKING_STATUS_TOKEN_EXPIRED',serviceType:'hourly_daily'}});
 assert.equal(result.view,'requestError');assert.equal(result.accessExpired,true);assert.equal(result.serviceType,'hourly_daily');assert.equal(result.reservationStatus,'');
 for(const body of [{},{code:'BOOKING_STATUS_TOKEN_EXPIRED',serviceType:'airport_transfer'}])assert.equal(normalize({statusCode:410,ok:false,body}).accessExpired,false);
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
 form.setAttribute('name','contact');submit.setAttribute('id','contact-submit');submit.textContent='Continue';form.append(submit);body.append(form);
 const fields={};for(const key of [...Object.keys(snapshot),'name','phone','email','message']){
  const field=new Node(key==='message'?'textarea':'input');field.value=snapshot[key]||'';fields[key]=field;form.append(field);
 }
 for(const key of ['phone','message']){const label=new Node('label');label.setAttribute('for','contact-'+key);label.textContent=key;form.append(label);}
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
 PixkuyForms:{contactServiceState:{setActiveServiceType:(service,options)=>{assert.equal(service,'hourly_daily');assert.equal(options.skipConfirm,true);owners.push(service);}}},
 history:{pushState:(_,__,url)=>{current=new URL(url,current);window.location=current;locations.splice(++index,Infinity,current.href);},replaceState:(_,__,url)=>{current=new URL(url,current);window.location=current;locations[index]=current.href;}},
 PixkuyInMotionScrollCinema:{returnTo:ctx=>{returns.push(ctx);return true;}},
 PixkuyHourlyBookingDraft:{save:v=>v,restore:()=>true,syncPanel(){sync++;},read:()=>({...snapshot})},
 PixkuyHourlyCheckout:{draft:()=>({...snapshot}),sync(){},setBusy(){}},PixkuyFleetSelection:{hourlyOfferStatus:()=>({valid:true}),read:()=>({}),hourlyEdit:()=>null,model:()=>null,photo:()=>null,passengerLabel:n=>String(n)}};
 window.PixkuyAirportDesktopView={ready:Promise.resolve(),media:desktop,t:k=>k,node:(tag,cls,text)=>{const n=new Node(tag);n.className=cls||'';n.textContent=text||'';return n;},field:()=>new Node('div'),date:v=>v,money:v=>v,
 shell:(_,back)=>{const n=new Node('section'),identity=new Node('div'),button=new Node('button');identity.className='airport-booking__identity';button.addEventListener('click',back);identity.append(button);n.append(identity);return n;},action:(label,fn)=>{const n=new Node('button');n.textContent=label;n.addEventListener('click',fn);return n;}};
 const sandbox={window,document,CustomEvent,Event:CustomEvent,URL,URLSearchParams,MutationObserver:class{observe(){}disconnect(){}},console};
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
