'use strict';
// Focused local Direct audit. Reuses existing fixtures and real page/modules.
// Only provider/HTTP boundaries are controlled. No request reaches a reservation
// write endpoint. One caller-owned Chrome instance, sequential contexts.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=require('./mobile-booking-audit.cjs');
const fixtures=require('./airport-controlled-fixtures.cjs');
const origin='https://local.pixkuy.test';
const model={...base.model,photoUrl:origin+'/assets/img/fleet/bydm9_xhoras001d.jpeg'};
async function setup(browser,{width=1440,withoutDom=false,withoutBootstrap=false}={}){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true,serviceWorkers:'block'});
  const state={requests:[],errors:[],writes:[],mode:'pending',availability:'available',delay:0,checkout:'success',draft:{},expiresAt:new Date(Date.now()+1800000).toISOString()};
  await context.route(/\/v1\/|\/\.netlify\/functions\//,async route=>{
    const req=route.request(),u=new URL(req.url());
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    const payload=req.method()==='POST'?req.postDataJSON():null;
    state.requests.push({path:u.pathname,method:req.method(),payload});
    assert(state.requests.length<90,'Bounded request budget');
    if(/booking-public-config|runtime-config/.test(u.pathname))return json({ok:true,bookingApi:{apiBaseUrl:origin},publicSite:{siteKey:'local_pixkuy_site_key'}});
    if(u.pathname.endsWith('/direct-transfer-quote'))return json({ok:true,quote:{price:800,currency:'MXN',distanceMeters:12000,durationSeconds:1800,pricingVersion:'controlled-v1'}});
    if(u.pathname.endsWith('/direct-transfer-availability-precheck')){
      const availability=state.availability, delay=state.delay;
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      if(availability==='technical')return json({code:'FLEET_AVAILABILITY_UNDETERMINED'},503);
      const body=fixtures.precheck({...payload,expectedAmountMinor:80000},{models:[model],available:availability==='available',requestNumber:state.requests.length});
      Object.assign(body.result.price,{currency:'MXN',durationSeconds:1800,distanceMeters:12000,quoteExpiresAt:new Date(Date.now()+300000).toISOString()});
      if(availability==='unavailable')body.result.availability.nextAvailableStartLocal='2027-01-15T12:00';
      return json(body);
    }
    if(u.pathname.endsWith('/status')){
      const body=base.statusBody('direct_transfer',state.mode,state.draft);
      body.hold.expiresAt=state.expiresAt;
      body.actions.canModify=state.mode==='pending';
      body.edit={allowed:state.mode==='pending',revision:'controlled-revision-1',draft:state.draft};
      body.contactUpdatePending=false;
      Object.assign(body.reservation,{pickupAddress:state.draft.direct_transfer_origin_address,destinationAddress:state.draft.direct_transfer_destination_address,serviceStartLocalDate:state.draft.direct_transfer_date,serviceStartLocalTime:state.draft.direct_transfer_time,customerNotes:state.draft.direct_transfer_notes});
      body.reservation.vehiclePhotoUrl=state.mode==='confirmed'?model.photoUrl:null;
      return json(body);
    }
    if(u.pathname.endsWith('/update-contact')){
      state.writes.push({path:u.pathname,payload,key:req.headers()['idempotency-key']});
      if(state.checkout==='lost')return route.abort();
      return json(contactResponse(state,payload));
    }
    if(/\/(checkout|replace-checkout|retry-checkout)$/.test(u.pathname)){
      state.writes.push({path:u.pathname,payload,key:req.headers()['idempotency-key']});
      if(state.checkout==='lost')return route.abort();
      return json({bookingStatusToken:'controlled-direct',checkoutUrl:'https://checkout.stripe.com/c/pay/controlled-direct'});
    }
    return json({items:[],ok:true});
  });
  await context.route(/^https:\/\/checkout\.stripe\.com\//,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled Stripe boundary</title>'}));
  await context.route(/^https:\/\/unpkg\.com\/.*libphonenumber/,route=>route.fulfill({contentType:'application/javascript',path:path.resolve(__dirname,'../../../pixkuy_frontend/node_modules/libphonenumber-js/bundle/libphonenumber-max.js')}));
  await context.route(/^https:\/\/local\.pixkuy\.test\/(?:\?.*)?$/,async route=>{
    if(route.request().method()!=='GET'){state.writes.push({path:'NETLIFY_FORBIDDEN'});return route.abort();}
    if(!withoutDom&&!withoutBootstrap)return route.continue();
    let html=await fs.readFile(path.resolve(__dirname,'../index.html'),'utf8');
    if(withoutDom){const previous=html;html=html.replace(/<form\b(?=[^>]*name="contact")[^>]*>[\s\S]*?<\/form>/,'');assert.notEqual(html,previous);}
    if(withoutBootstrap)html=html.replace(/<script src="assets\/js\/forms\/(?:index|reservation-request|contact-service-state|contact-service-switcher|submission-guard)\.js"><\/script>/g,'');
    return route.fulfill({contentType:'text/html',body:html});
  });
  const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(15000);
  page.on('pageerror',e=>state.errors.push(e.message));
  return {context,page,state};
}
function draft(){return {service_type:'direct_transfer',direct_transfer_origin_address:'Origen de prueba — Roma Norte',direct_transfer_origin_place_id:'controlled-origin',direct_transfer_origin_lat:'19.418',direct_transfer_origin_lng:'-99.169',direct_transfer_destination_address:'Destino de prueba — Condesa',direct_transfer_destination_place_id:'controlled-destination',direct_transfer_destination_lat:'19.411',direct_transfer_destination_lng:'-99.179',direct_transfer_date:'2027-01-15',direct_transfer_time:'10:45',direct_transfer_passenger_fare_key:'van_1_2',direct_transfer_passenger_bucket_label:'1–2',direct_transfer_notes:'Notas de prueba conservadas'};}
async function enter(t){
  await t.page.goto(origin+'/?service=direct_transfer&lang=es#services',{waitUntil:'domcontentloaded'});
  await t.page.waitForFunction(()=>window.PixkuyDirectTransferPanel && window.PixkuyDirectDesktopBooking);
  await t.page.locator('[data-consent-reject]').click({timeout:700}).catch(()=>{});
  // Recovery boundary, not an imitation of Places, coverage, quote or precheck.
  await t.page.evaluate(v=>window.PixkuyDirectTransferPanel.restore(v),draft());
  await t.page.waitForFunction(()=>!document.querySelector('[data-direct-transfer-panel-cta]').disabled);
}
async function contact(t){
  for(const [name,value] of Object.entries({name:'Persona de prueba',phone:'+525512345678',email:'direct@example.invalid'}))await t.page.locator('#direct-contact-'+name).fill(value);
  await t.page.locator('#pixkuy-direct-transfer-legal-acceptance').check();
}
async function shot(t,output,name){
  await fs.mkdir(output,{recursive:true});
  const photos=t.page.locator('.direct-booking img:visible,.airport-booking--result img:visible');
  const loaded=await photos.evaluateAll(async ns=>{await Promise.all(ns.map(n=>n.decode().catch(()=>{})));return ns.map(n=>({src:n.getAttribute('src'),loaded:n.naturalWidth>0,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));});
  await t.page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  return {name,loaded,url:t.page.url(),errors:t.state.errors.slice()};
}
// Controlled backend boundary: this does not certify SQL/Stripe renewal logic.
function contactResponse(state,payload){
  const renewed=payload.customer.email.trim().toLowerCase()!==state.draft.customer.email.trim().toLowerCase();
  if(renewed)state.expiresAt=new Date(Date.now()+1800000).toISOString();
  state.draft.customer={...payload.customer};
  return {bookingStatusToken:'controlled-direct',checkoutUrl:'https://checkout.stripe.com/c/pay/controlled-direct',editRevision:'controlled-revision-1',hold:{expiresAt:state.expiresAt},paymentWindowRenewed:renewed};
}
module.exports={setup,draft,enter,contact,shot,origin,model,contactResponse};

// Explicit entrypoint; never launches Chrome or a service on import. Each case
// closes its own context. The caller supplies the one isolated browser instance.
async function independenceCase(browser,absence){
  assert(['DOM','bootstrap'].includes(absence));
  const t=await setup(browser,{withoutDom:absence==='DOM',withoutBootstrap:absence==='bootstrap'});
  try{
    await enter(t);
    await t.page.locator('[data-direct-transfer-panel-cta]').click();
    await t.page.waitForURL(u=>u.hash==='#direct/datos');
    const boundary=await t.page.evaluate(()=>({
      legacy:!!document.querySelector('form[name="contact"]'),
      reader:typeof window.PixkuyForms.getReservationRequestData,
      own:window.PixkuyDirectBookingForm.getReservationForm().getAttribute('name')
    }));
    assert.equal(boundary.own,'direct-booking');
    if(absence==='DOM')assert.equal(boundary.legacy,false);
    else {assert.equal(boundary.legacy,true);assert.equal(boundary.reader,'undefined');}
    const submits=t.state.requests.length;
    await t.page.locator('#direct-booking-form').evaluate(f=>f.requestSubmit());
    assert.equal(new URL(t.page.url()).hash,'#direct/datos');
    assert.equal(t.state.requests.length,submits,'Missing contact/consent must not dispatch');
    await contact(t);
    await t.page.locator('#direct-booking-form button[type=submit]').click();
    await t.page.waitForURL('**/direct-transfer-checkout-review.html?lang=es');
    await t.page.waitForSelector('[data-direct-desktop-review]');
    assert((await t.page.locator('main.direct-booking').innerText()).includes(draft().direct_transfer_notes));
    assert.equal(t.state.writes.length,0);
    assert.deepEqual(t.state.errors,[]);
    return {result:'PASS',absence,boundary,requests:t.state.requests,errors:t.state.errors};
  }finally{await t.context.close();}
}
module.exports.independenceCase=independenceCase;

// Reload real Data with a separately persisted Configuration from another band.
// The prior bug issued a hidden precheck and replaced Data's accepted price.
async function restoredQuoteIsolationCase(browser,output){
  const t=await setup(browser);
  try{
    await enter(t);
    await t.page.locator('[data-direct-transfer-panel-passenger-option="van_3_4"]').click();
    await t.page.waitForFunction(()=>!document.querySelector('[data-direct-transfer-panel-cta]').disabled);
    await t.page.locator('[data-direct-transfer-panel-cta]').click();
    await t.page.locator('#direct-contact-name').waitFor({state:'visible'});
    await contact(t);
    const before=await t.page.evaluate(()=>{
      const key='pixkuy_direct_desktop_config_v1', config=JSON.parse(sessionStorage.getItem(key));
      config.passengerFareKey='van_5_6';sessionStorage.setItem(key,JSON.stringify(config));
      const raw=window.PixkuyDirectBookingForm.raw();
      return {band:raw.direct_transfer_passenger_fare_key,price:raw.direct_transfer_price,accepted:raw.direct_transfer_quote_accepted_at};
    });
    const prechecks=()=>t.state.requests.filter(r=>/direct-transfer-(?:quote|availability-precheck)$/.test(r.path));
    const count=prechecks().length;
    await t.page.reload({waitUntil:'load'});
    await t.page.locator('#direct-contact-name').waitFor({state:'visible'});
    // Bounded observation beyond the existing panel's debounce, not a product delay.
    await t.page.waitForTimeout(700);
    const after=await t.page.evaluate(()=>{const raw=window.PixkuyDirectBookingForm.raw();return {band:raw.direct_transfer_passenger_fare_key,price:raw.direct_transfer_price,accepted:raw.direct_transfer_quote_accepted_at};});
    assert.deepEqual(after,before);
    assert.equal(prechecks().length,count,'Reloading Data must not query the hidden Configuration');
    await t.page.locator('#direct-booking-form button[type=submit]').click();
    await t.page.waitForURL('**/direct-transfer-checkout-review.html?lang=es');
    await t.page.waitForFunction(()=>document.querySelector('[data-direct-desktop-review]')?.innerText.includes('3–4'));
    assert.equal(prechecks().at(-1).payload.passengerFareKey,'van_3_4');
    assert.equal(prechecks().at(-1).payload.passengers,4);
    assert.deepEqual(t.state.errors,[]);
    assert.deepEqual(t.state.writes,[]);
    if(output)await shot(t,output,'quote-isolation-review-controlled');
    return {result:'PASS',before,after,requests:t.state.requests,errors:t.state.errors,writes:t.state.writes,limit:'Controlled transport, not real availability'};
  }catch(error){
    const diagnostic=await t.page.evaluate(()=>{
      const own=window.PixkuyDirectBookingForm, api=window.PixkuyDirectTransferTransactionalState, form=own?.getReservationForm();
      const snapshot=form && api.buildSnapshot(form,own.getReservationRequestData());
      return {url:location.pathname+location.hash,valid:own?.validate(false),ready:snapshot && api.isSnapshotReadyForPrecheck(snapshot),
        legal:!!(form && window.PixkuyForms.LegalAcceptance.readEvidence(form,'web_direct_transfer_checkout')),
        checkbox:form?.querySelector('input[type="checkbox"]')?.checked,buttonDisabled:form?.querySelector('button[type="submit"]')?.disabled,
        presentation:typeof window.PixkuyBookingPresentation,phoneParser:typeof window.libphonenumber};
    }).catch(()=>null);
    error.message+='\n'+JSON.stringify({diagnostic,errors:t.state.errors});throw error;
  }finally{await t.context.close();}
}
module.exports.restoredQuoteIsolationCase=restoredQuoteIsolationCase;

async function passengerResponseRaceCase(browser){
  const t=await setup(browser);
  let release;
  const held=new Promise(resolve=>{release=resolve;});
  let started,finished;
  const requested=new Promise(resolve=>{started=resolve;});
  const completed=new Promise(resolve=>{finished=resolve;});
  try{
    await t.context.route(/\/direct-transfer-availability-precheck$/,async route=>{
      const payload=route.request().postDataJSON();
      if(payload.passengerFareKey!=='van_5_6')return route.fallback();
      started();await held;
      const body=fixtures.precheck({...payload,expectedAmountMinor:900000},{models:[model],available:true,requestNumber:90});
      Object.assign(body.result.price,{durationSeconds:1800,distanceMeters:12000,quoteExpiresAt:new Date(Date.now()+300000).toISOString()});
      await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});finished();
    });
    await enter(t);
    await t.page.locator('[data-direct-transfer-panel-passenger-option="van_5_6"]').click();
    await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No 5–6 precheck within budget')),4000))]);
    await t.page.locator('[data-direct-transfer-panel-passenger-option="van_3_4"]').click();
    await t.page.waitForFunction(()=>!document.querySelector('[data-direct-transfer-panel-cta]').disabled);
    release();await completed;
    await t.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await t.page.locator('[data-direct-transfer-panel-passenger-option="van_3_4"]').getAttribute('aria-pressed'),'true');
    await t.page.locator('[data-direct-transfer-panel-cta]').click();
    await t.page.locator('#direct-contact-name').waitFor({state:'visible'});
    const actual=await t.page.evaluate(()=>{const raw=window.PixkuyDirectBookingForm.raw();return {band:raw.direct_transfer_passenger_fare_key,price:raw.direct_transfer_price};});
    assert.deepEqual(actual,{band:'van_3_4',price:'800'});
    assert.deepEqual(t.state.errors,[]);assert.deepEqual(t.state.writes,[]);
    return {result:'PASS',actual,lateBand:'van_5_6',latePrice:9000,errors:t.state.errors,writes:t.state.writes,limit:'Controlled ordering/transport; amounts are fixtures'};
  }finally{release();await t.context.close();}
}
module.exports.passengerResponseRaceCase=passengerResponseRaceCase;

async function quoteUpdateCase(browser,{output}={}){
  const t=await setup(browser);
  const revalidations=[],resources=[],jobs=[];
  t.page.on('response',response=>{
    const pathname=new URL(response.url()).pathname;
    if(!['/assets/js/forms/direct-transfer-desktop-booking.js','/assets/js/forms/direct-transfer-booking-api-checkout.js'].includes(pathname))return;
    jobs.push((async()=>{
      const bytes=await response.body(),local=await fs.readFile(path.join(__dirname,'..',pathname));
      resources.push({path:pathname,status:response.status(),matches:bytes.equals(local),sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')});
    })());
  });
  const read=()=>t.page.evaluate(()=>{
    const own=window.PixkuyDirectBookingForm.raw(),saved=window.PixkuyDirectTransferTransactionalState.readReviewSnapshot();
    return {price:own.direct_transfer_price,storedPrice:saved.direct_transfer_price,accepted:own.direct_transfer_quote_accepted_at,
      storedAccepted:saved.direct_transfer_quote_accepted_at,fingerprint:own.direct_transfer_quote_fingerprint,storedFingerprint:saved.direct_transfer_quote_fingerprint,
      contact:['name','phone','email'].map(k=>document.querySelector('#direct-contact-'+k).value),consent:document.querySelector('#pixkuy-direct-transfer-legal-acceptance').checked,
      focus:document.activeElement.id,disabled:document.querySelector('#direct-booking-form button[type=submit]').disabled,
      visible:document.querySelector('.airport-booking__total').textContent};
  });
  const reload=async()=>{
    await t.page.reload({waitUntil:'domcontentloaded'});
    await t.page.locator('#direct-contact-name').waitFor({state:'visible'});
  };
  try{
    await enter(t);
    await t.page.locator('[data-direct-transfer-panel-cta]').click();
    await t.page.locator('#direct-contact-name').waitFor({state:'visible'});
    await contact(t);
    await t.page.locator('#direct-contact-email').focus();
    const contactBefore=await read();
    const before=await t.page.evaluate(()=>window.PixkuyDirectBookingForm.raw().direct_transfer_price);
    await t.context.route(/\/direct-transfer-availability-precheck$/,route=>{
      const payload=route.request().postDataJSON();
      revalidations.push({amount:payload.expectedAmountMinor,fingerprint:payload.quoteFingerprint});
      assert(revalidations.length<=2,'Only rejection and explicit revalidation are allowed');
      const body=fixtures.precheck({...payload,expectedAmountMinor:90000},{models:[model],available:true,requestNumber:91});
      Object.assign(body.result.price,{currency:'MXN',quoteFingerprint:'b'.repeat(64),quoteExpiresAt:new Date(Date.now()+300000).toISOString()});
      if(revalidations.length===1){
        body.result.checkoutAllowed=false;
        body.result.price={...body.result.price,available:false,reason:'DIRECT_TRANSFER_PRICE_MISMATCH',expectedAmountMinor:80000,actualAmountMinor:90000};
        delete body.result.price.amountMinor;
        body.result.availability={available:false,status:'unavailable',code:'DIRECT_TRANSFER_PRICE_MISMATCH'};
        delete body.result.fleet;
      }
      return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
    });
    await t.page.locator('#direct-contact-email').press('Enter');
    await t.page.locator('#direct-booking-form > .form-error:not([hidden])').waitFor();
    const after=await t.page.evaluate(()=>{
      const own=window.PixkuyDirectBookingForm.raw(),stored=window.PixkuyDirectTransferTransactionalState.readReviewSnapshot();
      return {ownPrice:own.direct_transfer_price,storedPrice:stored.direct_transfer_price,ownAccepted:own.direct_transfer_quote_accepted_at,
        storedAccepted:stored.direct_transfer_quote_accepted_at,visible:document.querySelector('.airport-booking__total').textContent,
        storedFingerprint:stored.direct_transfer_quote_fingerprint};
    });
    assert.equal(after.ownPrice,'900');
    assert.equal(after.storedPrice,'900',JSON.stringify(after));
    assert.equal(after.storedAccepted,'');assert.equal(after.ownAccepted,'');
    assert(after.visible.includes('900'),JSON.stringify(after));
    assert.equal(after.storedFingerprint,'b'.repeat(64));
    const updated=await read();
    assert.deepEqual(updated.contact,contactBefore.contact);assert.equal(updated.consent,true);
    assert.equal(updated.focus,contactBefore.focus);
    assert.equal(new URL(t.page.url()).hash,'#direct/datos','Updated quote must not auto-advance');
    await reload();
    const restored=await read();
    assert.equal(restored.price,'900');assert.equal(restored.storedPrice,'900');
    assert.equal(restored.fingerprint,'b'.repeat(64));assert.equal(restored.storedFingerprint,restored.fingerprint);
    assert.equal(restored.accepted,'');assert.equal(restored.storedAccepted,'');
    assert.deepEqual(restored.contact,contactBefore.contact);assert.equal(restored.consent,true);
    assert.equal(revalidations.length,1,'Reload must not revalidate or accept automatically');
    if(output)await shot(t,output,'f5-before-any-interaction');
    assert.equal(restored.disabled,false,'F5 must evaluate guards before any extra click');
    await t.page.locator('#direct-contact-email').fill('');
    const invalid=await read();assert.equal(invalid.disabled,true,'Invalid contact remains blocked');
    await t.page.locator('#direct-contact-email').fill(contactBefore.contact[2]);
    await t.page.locator('#pixkuy-direct-transfer-legal-acceptance').uncheck();
    const noConsent=await read();assert.equal(noConsent.disabled,true,'Missing consent remains blocked');assert.equal(noConsent.consent,false);
    assert.equal(revalidations.length,1,'Negative guards cannot trigger precheck');
    await t.page.locator('#pixkuy-direct-transfer-legal-acceptance').check();
    const ready=await read();assert.equal(ready.disabled,false);assert.equal(ready.accepted,'');
    await t.page.locator('#direct-booking-form button[type=submit]').click();
    await t.page.waitForURL(/direct-transfer-checkout-review\.html/,{waitUntil:'domcontentloaded'});
    await t.page.locator('.airport-booking__details').first().waitFor({state:'visible'});
    assert.equal(revalidations.length,2);assert.equal(revalidations[1].amount,90000);assert.equal(revalidations[1].fingerprint,'b'.repeat(64));
    const final=await t.page.evaluate(()=>{const s=window.PixkuyDirectTransferTransactionalState.readReviewSnapshot();return {price:s.direct_transfer_price,accepted:!!s.direct_transfer_quote_accepted_at};});
    assert.equal(final.price,'900');assert.equal(final.accepted,true);
    if(output)await shot(t,output,'explicit-review');
    await Promise.all(jobs);assert(resources.length>=2&&resources.every(r=>r.matches&&r.status===200));
    assert.deepEqual(t.state.errors,[]);assert.deepEqual(t.state.writes,[]);
    return {result:'PASS',before,after,restored:{...restored,contact:undefined},negativeGuards:{invalidContact:invalid.disabled,absentConsent:noConsent.disabled},final,revalidations,resources,errors:t.state.errors,writes:t.state.writes,limit:'Controlled quote/precheck; no checkout or real availability'};
  }catch(error){
    await Promise.all(jobs);
    if(output)await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,resources,revalidations,errors:t.state.errors,writes:t.state.writes},null,2));
    throw error;
  }finally{await t.context.close();}
}
module.exports.quoteUpdateCase=quoteUpdateCase;
