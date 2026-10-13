'use strict';
// Offline continuation of the established Direct runner. Real review actions,
// transactional state, legal guards and Fleet/idempotency; controlled clock and
// HTTP only. Rendering is a presentation boundary, not a visual assertion.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..');
const support=fs.readFileSync(path.join(__dirname,'airport-netlify-independence.test.cjs'),'utf8');
const {Events,Element,Event,storage}=vm.runInNewContext(support.slice(support.indexOf('class Events'),support.indexOf('function runtime'))+'\n({Events,Element,Event,storage})',{assert});
const model={modelId:'controlled-model',modelRevision:1,name:'Modelo de prueba',passengersSupported:4};
const copy=v=>JSON.parse(JSON.stringify(v));
const traces=[];
async function settle(){for(let i=0;i<35;i++)await new Promise(resolve=>setImmediate(resolve));}
async function runtime({mobile=false,expired=true,reviewFile,initialSnapshot,prepareEnvironment}={}){
  let now=Date.parse('2026-10-13T10:00:00Z');
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const document=new Events();document.readyState='loading';
  document.createElement=t=>new Element(t,document);document.createTextNode=t=>Object.assign(document.createElement('text'),{textContent:t});
  document.body=document.createElement('body');document.documentElement=document.createElement('html');document.documentElement.lang='es';
  document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  const node=(tag,attr)=>{const n=document.createElement(tag);n.setAttribute(attr,'');document.body.append(n);return n;};
  const button=node('button','data-direct-transfer-checkout-review-proceed');
  node('a','data-direct-transfer-checkout-review-edit');
  const error=node('div','data-direct-transfer-checkout-review-error');error.hidden=true;
  const requests=[],redirects=[],renders=[];
  const state={price:80000,duration:1800,distance:12000,pricingVersion:'controlled-v1',available:true,technical:false,lost:false,hold:null,serverStale:false};
  function price(){return {available:true,amountMinor:state.price,currency:'MXN',pricingVersion:state.pricingVersion,
    // Opaque HTTP fixture, never a product-computed or forced fingerprint.
    quoteFingerprint:'controlled-'+state.price+'-'+state.duration+'-'+state.distance+'-'+now,
    quoteExpiresAt:new Clock(now+300000).toISOString(),durationSeconds:state.duration,distanceMeters:state.distance};}
  const window=Object.assign(new Events(),{document,Event,CustomEvent:Event,Response,Date:Clock,innerWidth:mobile?390:1440,
    sessionStorage:storage(),localStorage:storage(),crypto:require('node:crypto').webcrypto,
    location:{href:'https://local.pixkuy.test/direct-transfer-checkout-review.html?lang=es',pathname:'/direct-transfer-checkout-review.html',search:'?lang=es',hash:'',origin:'https://local.pixkuy.test',protocol:'https:',hostname:'local.pixkuy.test',assign:url=>redirects.push(url),replace:url=>redirects.push(url)},
    matchMedia:q=>Object.assign(new Events(),{matches:q.includes('max-width')?mobile:!mobile}),
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,requestAnimationFrame:()=>1,
    FormData:class{constructor(f){this.f=f;}forEach(fn){for(const n of this.f.elements)if(n.name&&!n.disabled)fn(String(n.value),n.name);}},
    libphonenumber:require('../../../pixkuy_frontend/node_modules/libphonenumber-js'),
    PIXKUY_BOOKING_API_CONFIG:{apiBaseUrl:'https://local.pixkuy.test',publicSiteKey:'controlled-site'},
    __render:s=>renders.push(copy(s)),
    async fetch(url,init){
      if(/^assets\/i18n\/[a-z-]+\.json$/.test(url))return new Response(fs.readFileSync(path.join(root,url)));
      assert(url.startsWith('https://local.pixkuy.test/v1/public/reservations/'),'Network forbidden: '+url);
      const payload=JSON.parse(init.body);requests.push({url,payload:copy(payload),headers:copy(init.headers)});
      if(url.endsWith('/direct-transfer-availability-precheck')){
        const body={status:'ok',result:{checkoutAllowed:state.available,price:price(),
          availability:{available:state.available,code:state.available?undefined:'NO_AVAILABILITY'},
          fleet:{version:1,status:state.available?'available':'unavailable',models:state.available?[state.model||model]:[],requestKey:'controlled-'+requests.length,selectedModelEligible:true}}};
        if(state.hold)await state.hold;
        if(state.technical)return new Response(JSON.stringify({code:'CONTROLLED_TECHNICAL'}),{status:503});
        if(state.serverStale&&payload.quoteExpiresAt){
          return new Response(JSON.stringify({result:{checkoutAllowed:false,price:{...price(),available:false,reason:'DIRECT_TRANSFER_QUOTE_STALE'},availability:{available:false,code:'DIRECT_TRANSFER_QUOTE_STALE'}}}));
        }
        if(payload.quoteExpiresAt&&Date.parse(payload.quoteExpiresAt)<=now){
          return new Response(JSON.stringify({result:{checkoutAllowed:false,price:{...price(),available:false,reason:'DIRECT_TRANSFER_QUOTE_STALE'},availability:{available:false,code:'DIRECT_TRANSFER_QUOTE_STALE'}}}));
        }
        return new Response(JSON.stringify(body));
      }
      assert(url.endsWith('/checkout'));
      if(state.lost)throw new TypeError('Controlled lost response');
      return new Response(JSON.stringify({bookingStatusToken:'controlled-only',checkoutUrl:'https://checkout.stripe.com/c/pay/controlled-only'}));
    }});
  const sandbox=vm.createContext({window,document,Event,CustomEvent:Event,Response,URL,URLSearchParams,Intl,Date:Clock,console,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout});
  for(const f of ['forms/legal-acceptance','services/fleet-selection-state','services/direct-transfer-transactional-state','forms/direct-transfer-booking-form'])
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/'+f+'.js'),'utf8'),sandbox,{filename:f,timeout:1500});
  if(prepareEnvironment)prepareEnvironment({window,document,sandbox});
  const api=window.PixkuyDirectTransferTransactionalState,fleet=window.PixkuyFleetSelection,own=window.PixkuyDirectBookingForm,legal=window.PixkuyForms.LegalAcceptance;
  own.setTrip({direct_transfer_origin_address:'Origen sintético',direct_transfer_origin_place_id:'origin',direct_transfer_origin_lat:'19.4',direct_transfer_origin_lng:'-99.1',
    direct_transfer_destination_address:'Destino sintético',direct_transfer_destination_place_id:'destination',direct_transfer_destination_lat:'19.5',direct_transfer_destination_lng:'-99.2',
    direct_transfer_date:'2027-01-19',direct_transfer_time:'10:00',direct_transfer_passenger_fare_key:'van_3_4',direct_transfer_passenger_bucket_label:'3–4',direct_transfer_notes:'Notas conservadas',locale:'es'});
  own.contact({name:'Persona sintética',phone:'+525512345678',email:'test@example.invalid'});
  legal.syncAcceptedFields(own.getReservationForm(),legal.buildSnapshot(mobile?'web_direct_transfer_mobile_checkout':'web_direct_transfer_checkout'));
  let snapshot=initialSnapshot?copy(initialSnapshot):api.buildSnapshot(own.getReservationForm(),own.getReservationRequestData());
  if(!initialSnapshot)api.applyCanonicalQuote(snapshot,price(),new Clock().toISOString());
  await fleet.fetchPrecheck('direct_transfer','https://local.pixkuy.test/v1/public/reservations/direct-transfer-availability-precheck',{method:'POST',headers:{},body:JSON.stringify(api.buildPrecheckPayload(snapshot))});
  snapshot=fleet.snapshot('direct_transfer',snapshot,{refreshSelection:true});
  if(expired)now+=300001;
  api.writeReviewSnapshot(snapshot);requests.length=0;
  const file=reviewFile||path.join(root,'assets/js/forms/direct-transfer-checkout-review-page.js');
  let source=fs.readFileSync(file,'utf8');
  const end='})(window, document);';assert(source.endsWith(end+'\n')||source.endsWith(end+'\r\n'));
  source=source.replace(end,`renderDetails=function(s){window.__render(s);};
    window.__reviewTest={bind:bindActions,busy:function(){return checkoutBusy;},dictionary:function(d){currentDictionary=d;}};
    `+end);
  vm.runInContext(source,sandbox,{filename:file,timeout:1500});
  const dictionary=JSON.parse(fs.readFileSync(path.join(root,'assets/i18n/es/direct-transfer-checkout.json'))).directTransferCheckout;
  window.__reviewTest.dictionary(dictionary);window.__reviewTest.bind(snapshot,dictionary);
  return {window,document,state,api,fleet,button,error,requests,redirects,renders,snapshot,clock:()=>now,advance:n=>{now+=n;},
    click:()=>button.dispatchEvent(new Event('click')),writes:()=>requests.filter(r=>r.url.endsWith('/checkout')),checks:()=>requests.filter(r=>r.url.endsWith('/direct-transfer-availability-precheck'))};
}
module.exports={runtime,settle};
if(require.main===module){
const baseline=process.env.PIXKUY_RENEWAL_REVIEW_SOURCE;
test('expired equal conditions: one gesture renews and dispatches exactly once',async()=>{
  const r=await runtime({reviewFile:baseline});r.click();await settle();
  assert.equal(r.writes().length,1);assert.equal(r.checks().length,1);
  assert.equal(r.checks()[0].payload.quoteExpiresAt,undefined);
  const sent=r.writes()[0].payload;
  assert(Date.parse(sent.direct_transfer_quote_expires_at)>r.clock());
  assert.notEqual(sent.direct_transfer_quote_fingerprint,r.snapshot.direct_transfer_quote_fingerprint);
  assert.equal(sent.direct_transfer_price,80000);assert.equal(sent.direct_transfer_duration_seconds,1800);
  assert.equal(sent.direct_transfer_notes,'Notas conservadas');assert.equal(sent.legal_acceptance_accepted,'true');assert.equal(r.error.hidden,true);
  traces.push({scenario:'expired-equal',gestureCount:1,prechecks:r.checks().length,checkoutAttempts:r.writes().length,
    requestHasExpiredBinding:'quoteExpiresAt' in r.checks()[0].payload,sent:{amount:sent.direct_transfer_price,duration:sent.direct_transfer_duration_seconds,
      expiry:sent.direct_transfer_quote_expires_at,acceptedAt:sent.direct_transfer_quote_accepted_at},transport:'controlled; no sockets'});
});
if(!baseline){
  test('fresh ordinary quote still reaches checkout in one gesture',async()=>{
    const r=await runtime({expired:false});r.click();await settle();assert.equal(r.checks().length,1);assert.equal(r.writes().length,1);
    assert(r.checks()[0].payload.quoteFingerprint);assert.equal(r.error.hidden,true);
  });
  test('expiry while waiting for transport credentials renews before dispatch',async()=>{
    const r=await runtime({expired:false});let release;
    r.window.PixkuyRecaptchaEnterprise={execute:()=>new Promise(resolve=>{release=resolve;})};
    r.click();await settle();assert.equal(r.checks().length,0);r.advance(300001);release('');await settle();
    assert.equal(r.checks()[0].payload.quoteExpiresAt,undefined);assert.equal(r.writes().length,1);
    assert(Date.parse(r.writes()[0].payload.direct_transfer_quote_expires_at)>r.clock());
  });
  for(const [field,value] of [['price',90000],['duration',1860],['distance',12100],['pricingVersion','controlled-v2']])
    test('renewal changes '+field+': persist unaccepted, new explicit action revalidates',async()=>{
      const r=await runtime();r.state[field]=value;r.click();await settle();
      assert.equal(r.writes().length,0);assert.equal(r.api.readReviewSnapshot().direct_transfer_quote_accepted_at,'');
      assert.equal(r.error.hidden,false);assert.match(r.error.textContent,/cotización se ha actualizado/);
      if(field!=='pricingVersion')assert(r.error.children.some(n=>n.textContent.includes(' → ')));
      r.click();await settle();assert.equal(r.writes().length,1);assert.equal(r.checks().length,2);
      assert.equal(r.checks()[1].payload.quoteFingerprint,r.writes()[0].payload.direct_transfer_quote_fingerprint);
    });
  for(const kind of ['unavailable','technical'])test(kind+' blocks, retaining contact, consent and notes',async()=>{
    const r=await runtime();if(kind==='unavailable')r.state.available=false;else r.state.technical=true;
    r.click();await settle();assert.equal(r.writes().length,0);assert.equal(r.error.hidden,false);
    assert.equal(r.error.textContent,JSON.parse(fs.readFileSync(path.join(root,'assets/i18n/es/direct-transfer-checkout.json'))).directTransferCheckout[kind==='unavailable'?'availabilityUnavailable':'availabilityTechnical']);
    const s=r.api.readReviewSnapshot();for(const k of ['name','phone','email','direct_transfer_notes','legal_acceptance_accepted'])assert.equal(s[k],r.snapshot[k]);
  });
  test('double click while renewal is in flight creates one attempt',async()=>{
    const r=await runtime();let release;r.state.hold=new Promise(resolve=>{release=resolve;});
    r.click();r.click();await settle();assert.equal(r.checks().length,1);assert.equal(r.writes().length,0);
    release();await settle();assert.equal(r.writes().length,1);
  });
  test('late response cannot overwrite a newer saved trip',async()=>{
    const r=await runtime();let release;r.state.hold=new Promise(resolve=>{release=resolve;});r.click();await settle();
    const current={...r.api.readReviewSnapshot(),direct_transfer_passenger_fare_key:'van_5_6'};r.api.writeReviewSnapshot(current);
    release();await settle();assert.equal(r.writes().length,0);assert.equal(r.api.readReviewSnapshot().direct_transfer_passenger_fare_key,'van_5_6');assert.equal(r.renders.length,0);
  });
  test('Fleet invalidation rejects a late response without checkout',async()=>{
    const r=await runtime();let release;r.state.hold=new Promise(resolve=>{release=resolve;});r.click();await settle();
    r.fleet.invalidateOffer('direct_transfer');release();await settle();assert.equal(r.writes().length,0);assert.equal(r.renders.length,0);
  });
  test('new model revision remains a relevant condition',async()=>{
    const r=await runtime();r.state.model={...model,modelRevision:2};r.click();await settle();
    assert.equal(r.writes().length,0);assert.equal(r.api.readReviewSnapshot().fleet_selection.model_revision,2);
    assert.equal(r.api.readReviewSnapshot().direct_transfer_quote_accepted_at,'');
  });
  test('navigation while precheck waits cannot dispatch checkout',async()=>{
    const r=await runtime();let release;r.state.hold=new Promise(resolve=>{release=resolve;});r.click();await settle();
    r.window.location.href='https://local.pixkuy.test/#direct/datos';release();await settle();assert.equal(r.writes().length,0);
  });
  test('server-clock expiry gets a single complete renewal, not a retry loop',async()=>{
    const r=await runtime({expired:false});r.state.serverStale=true;r.click();await settle();assert.equal(r.checks().length,2);assert.equal(r.writes().length,1);
  });
  test('uncertain dispatch recovers original identity/payload without another precheck',async()=>{
    const r=await runtime();r.state.lost=true;r.click();await settle();assert.equal(r.writes().length,1);
    const original=copy(r.writes()[0]);r.advance(600000);r.state.price=95000;r.state.lost=false;r.click();await settle();
    assert.equal(r.checks().length,1);assert.equal(r.writes().length,2);
    assert.deepEqual(r.writes()[1].payload,original.payload);assert.equal(r.writes()[1].headers['Idempotency-Key'],original.headers['Idempotency-Key']);
    assert(r.redirects.length>0);
    traces.push({scenario:'uncertain-recovery',prechecks:r.checks().length,dispatches:r.writes().length,sameIdentity:true,sameFrozenPayload:true,newAttempts:0});
  });
  for(const field of ['email','legal_acceptance_accepted'])test('negative checkout guard: '+field,async()=>{
    const r=await runtime();r.snapshot[field]='';r.api.writeReviewSnapshot(r.snapshot);r.click();await settle();assert.equal(r.writes().length,0);
  });
  test('mobile boundary retains fresh-quote checkout and stale-quote blocking',async()=>{
    const fresh=await runtime({mobile:true,expired:false});fresh.click();await settle();assert.equal(fresh.writes().length,1);
    const stale=await runtime({mobile:true});stale.click();await settle();assert.equal(stale.writes().length,0);assert(stale.checks()[0].payload.quoteExpiresAt);
  });
  test('neutral updated-quote message exists in all nine dictionaries',()=>{
    for(const lang of ['es','en','fr','de','it','pt','ru','ko','zh-hans']){
      const dict=JSON.parse(fs.readFileSync(path.join(root,'assets/i18n',lang,'direct-transfer-checkout.json')));
      assert(dict.directTransferCheckout.quote.updated);new Intl.NumberFormat(lang,{style:'unit',unit:'second'}).format(1801);
    }
  });
}
test.after(()=>{
  const output=process.env.PIXKUY_RENEWAL_EVIDENCE;
  if(output){
    const allowed=path.resolve(root,'../../evidence/direct-desktop-20261013/expired-quote-renewal');
    assert.equal(path.resolve(output),allowed,'Evidence must stay in the task directory');
    fs.writeFileSync(path.join(output,'controlled-checkout.json'),JSON.stringify(traces,null,2));
  }
});
}
