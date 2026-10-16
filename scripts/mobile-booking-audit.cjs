'use strict';
// Audit of the real local application. Only HTTP/provider boundaries are simulated.
// No server, SQL, credentials, real reservations or external requests are used.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {chromium} = require('../../../pixkuy_frontend/node_modules/playwright');
const fixtures = require('./airport-controlled-fixtures.cjs');
const origin = process.env.PIXKUY_TEST_ORIGIN || 'http://localhost:8888';
assert(['http://localhost:8888','https://local.pixkuy.test'].includes(origin), 'Local audit origins only');
const output = path.resolve(process.env.PIXKUY_AUDIT_OUTPUT || path.join(os.tmpdir(), 'pixkuy-mobile-booking-regression'));
const langs = ['es','en','de','fr','it','ko','pt','ru','zh-hans'];
const services = ['airport_transfer','hourly_daily','direct_transfer'];
const model = {modelId:'00000000-0000-4000-8000-000000000001',modelRevision:1,name:'BYD M9',photoUrl:origin+'/assets/img/fleet/bydm9_xhoras001d.jpeg',passengersSupported:2};
const date = '2027-01-13';
const results = [], resources = new Map();
const reviewRoute=s=>s==='direct_transfer'?/\/direct-transfer-checkout-review\.html/:s==='hourly_daily'?/#hourly\/revision$/:/#airport\/revision$/;
const paymentSelector=s=>s==='direct_transfer'?'[data-direct-transfer-checkout-review-proceed]':s==='hourly_daily'?'[data-hourly-pay]':'[data-airport-pay]';
let browser;
async function launchChrome(channel='chrome') {
  assert(['chrome','chromium'].includes(channel),'Installed Chromium engines only');
  const cdp=process.env.PIXKUY_AUDIT_CDP;
  if(cdp){assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(cdp),'Isolated loopback CDP only');return chromium.connectOverCDP(cdp);}
  return chromium.launch({...(channel==='chrome'?{channel:'chrome'}:{}),headless:true});
}
function statusBody(s, mode, draft={}) {
  const amount=draft.hourly_daily_price||draft.airport_transfer_price||draft.direct_transfer_price||(s==='hourly_daily'?150000:80000);
  const paid=mode==='confirmed', pending=['pending','inconsistent'].includes(mode);
  const state=paid||mode==='inconsistent'?'confirmed':pending?'pending_payment':mode;
  const edit=s!=='direct_transfer'&&mode==='pending';
  const source={...draft,customer:draft.customer||{full_name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'},fleet_selection:{version:1,model_id:model.modelId,model_revision:1},fleet_model:{id:model.modelId,name:model.name,photoUrl:model.photoUrl},service_type:s};
  return {serverNow:new Date().toISOString(),reservation:{serviceType:s,status:state,publicCode:'PKY-AUDIT',operationalStatus:'pending_coordination',serviceTimezone:'America/Mexico_City',serviceStartLocalDate:date,serviceStartLocalTime:'23:00',serviceEndLocalDate:'2027-01-14',serviceEndLocalTime:'01:00',durationHours:s==='hourly_daily'?2:null,hourlyMode:s==='hourly_daily'?'hourly':null,pickupAddress:s==='airport_transfer'?'MEX — Aeropuerto Internacional Ciudad de México':'Origen sintético, Roma Norte',destinationAddress:s==='hourly_daily'?null:'Destino sintético, Condesa',passengerCount:s==='hourly_daily'?2:null,passengerLabel:s==='hourly_daily'?'2':'1–2',luggageCount:s==='airport_transfer'?2:null,vehicleDisplayName:model.name,vehiclePhotoUrl:model.photoUrl,customerNotes:source.hourly_daily_notes||source.airport_transfer_notes||source.direct_transfer_notes||'Notas sintéticas de auditoría'},customer:{fullName:source.customer.full_name,email:source.customer.email,phone:source.customer.phone},payment:{status:paid?'paid':'pending',amountExpected:amount,amountPaid:paid?amount:null,currency:'MXN'},hold:{status:mode==='hold_expired'?'expired':'active',expiresAt:new Date(Date.now()+(mode==='hold_expired'?-1000:1800000)).toISOString()},actions:{canModify:edit,canRetryCheckout:mode==='pending',canCreateNewReservation:mode==='hold_expired'&&s!=='direct_transfer',paymentWindowClosed:mode==='hold_expired'},edit:{allowed:edit,revision:'synthetic-revision-1',draft:edit?source:null},continuation:mode==='hold_expired'&&s!=='direct_transfer'?{draft:source}:null};
}
async function setup(width,s,device={}) {
  const context=await browser.newContext({...device,viewport:{width,height:844},locale:'es-MX',serviceWorkers:'block',ignoreHTTPSErrors:origin==='https://local.pixkuy.test'});
  const state={service:s,mode:'pending',availability:'available',delay:0,checkout:'success',draft:{},requests:[],blocked:[],errors:[],amount:null};
  await context.addInitScript(()=>window.addEventListener('pixkuy:booking-status-ready',e=>window.__auditStatus=e.detail));
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(u.pathname==='/.netlify/functions/booking-public-config')return json({ok:true,bookingApi:{apiBaseUrl:origin},publicSite:{siteKey:'local_pixkuy_site_key'}});
    if(u.pathname.endsWith('/runtime-config'))return json({bookingApi:{apiBaseUrl:origin},publicSite:{siteKey:'local_pixkuy_site_key'}});
    if(u.hostname==='unpkg.com'&&u.pathname.includes('libphonenumber-js'))return route.fulfill({contentType:'application/javascript',path:path.resolve(__dirname,'../../../pixkuy_frontend/node_modules/libphonenumber-js/bundle/libphonenumber-max.js')});
    if(u.pathname.endsWith('/direct-transfer-quote')) {
      state.requests.push({kind:'quote',payload:req.postDataJSON()});
      return json({ok:true,quote:{price:800,currency:'MXN',distanceMeters:12000,durationSeconds:1800,pricingVersion:'synthetic-v1'}});
    }
    if(u.pathname.endsWith('-availability-precheck')) {
      const p=req.postDataJSON(),mode=state.availability,delay=state.delay;
      state.requests.push({kind:'precheck',path:u.pathname,payload:p,mode});
      if(delay)await new Promise(r=>setTimeout(r,delay));
      if(mode==='network')return route.abort('failed');
      if(mode==='technical')return json({code:'FLEET_AVAILABILITY_UNDETERMINED'},503);
      const amount=state.amount||p.expectedAmountMinor||p.hourly_daily_price||(s==='hourly_daily'?150000:80000);
      const models=state.models||[model];
      const body=fixtures.precheck({...p,expectedAmountMinor:amount},{models,requestNumber:state.requests.length,available:mode==='available'&&models.length>0});
      Object.assign(body.result.price,{currency:'MXN',durationSeconds:1800,distanceMeters:12000,quoteExpiresAt:new Date(Date.now()+300000).toISOString()});
      return json(body);
    }
    if(/\/(checkout|replace-checkout|retry-checkout)$/.test(u.pathname)) {
      const p=req.postDataJSON();state.requests.push({kind:u.pathname.split('/').pop(),payload:p,key:req.headers()['idempotency-key']});
      if(u.pathname.endsWith('/checkout')||u.pathname.endsWith('/replace-checkout'))state.draft=p;
      if(state.checkout==='lost')return route.abort('failed');
      if(state.checkout==='rejected')return json({code:'NO_AVAILABILITY',recovery:{state:'not_committed'}},409);
      if(u.pathname.endsWith('/retry-checkout'))return json({paymentAttempt:{checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic-audit'}});
      return json({bookingStatusToken:'synthetic-audit-'+s,checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic-audit',replacement:u.pathname.endsWith('/replace-checkout')});
    }
    if(u.pathname==='/v1/public/reservations/status') {
      state.requests.push({kind:'status',mode:state.mode});
      if(state.mode==='invalid')return json({code:'BOOKING_STATUS_NOT_FOUND'},404);
      if(state.mode==='access_expired')return json({code:'BOOKING_STATUS_TOKEN_EXPIRED',serviceType:s},410);
      if(state.mode==='network')return json({code:'CONTROLLED_FAILURE'},503);
      return json(statusBody(s,state.mode,state.draft));
    }
    if(u.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Frontera Stripe simulada</title>'});
    if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/.netlify/functions/')) {state.blocked.push(u.pathname);return json({items:[],ok:true});}
    if(u.origin===origin&&['GET','HEAD'].includes(req.method()))return route.continue();
    state.blocked.push(u.origin+u.pathname);return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(15000);
  page.on('pageerror',e=>state.errors.push(e.message));
  page.on('response',async r=>{const u=new URL(r.url());if(u.origin===origin&&/^\/assets\/.+\.(js|css|json)$/.test(u.pathname)){try{resources.set(u.pathname,crypto.createHash('sha256').update(await r.body()).digest('hex'));}catch{}}});
  return {context,page,state,width,s};
}
async function shot(t,label) {
  const file=t.s+'-'+t.width+'-'+label+'.png';
  await t.page.locator('[data-direct-transfer-checkout-review-content] img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode().catch(()=>{}))));
  await t.page.screenshot({path:path.join(output,file),fullPage:false});
  const layout=await t.page.evaluate(()=>({url:location.pathname+location.hash,lang:document.documentElement.lang,scrollY,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,active:document.activeElement?.id,text:document.body.innerText,fields:[...document.querySelectorAll('input,textarea,select')].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).map(n=>({id:n.id,name:n.name,type:n.type,font:getComputedStyle(n).fontSize,readonly:n.readOnly,disabled:n.disabled,value:n.value,invalid:n.getAttribute('aria-invalid')})),buttons:[...document.querySelectorAll('button,a')].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).map(n=>({text:n.innerText,disabled:n.disabled,href:n.getAttribute('href')}))}));
  return {file,...layout};
}
async function enter(t) {
  const {page,s}=t;
  await page.goto(origin+'/?service='+(s==='airport_transfer'?'airport_hotel':s)+'&lang=es');
  await page.waitForFunction(()=>window.PixkuyFleetSelection&&window.PixkuyHourlyMobileBookingFlow&&window.PixkuyDirectTransferMobileConfigStep);
  await page.locator('[data-consent-reject]').click({timeout:700}).catch(()=>{});
  if(s==='airport_transfer') {
    await page.evaluate(()=>{window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel sintético — Roma Norte',zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});});
    await page.locator('#airport-tariff-date').fill(date);await page.locator('#airport-tariff-time').fill('23:00');
    await page.waitForFunction(()=>document.querySelector('#services-expand-airport').getAttribute('data-airport-mobile-availability-state')==='available');
  } else if(s==='hourly_daily') {
    await page.evaluate(()=>window.PixkuyHourlyMobileBookingFlow.open());
    await page.locator('[data-services-hourly-mode="hourly"]').click();
    const pick=page.locator('[data-services-hourly-panel] [data-place-input="hourly_daily_pickup"]');
    await pick.evaluate(n=>{n.value='Origen sintético, Roma Norte';n.dispatchEvent(new Event('input',{bubbles:true}));});
    await pick.evaluate(n=>n.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-pickup-selected',{detail:{selectedPlace:{label:'Origen sintético, Roma Norte',placeId:'synthetic-place',lat:19.427,lng:-99.1677}}})));
    await page.locator('[data-services-hourly-date]').fill(date);await page.locator('[data-services-hourly-date]').dispatchEvent('change');
    await page.locator('[data-services-hourly-time]').fill('23:00');await page.locator('[data-services-hourly-time]').dispatchEvent('change');
    await page.locator('[data-fleet-hourly-passengers]').selectOption('2');
    await page.waitForFunction(()=>window.PixkuyFleetSelection.selection('hourly_daily')&&window.PixkuyFleetSelection.hourlyOfferStatus().valid);
    if(t.width>720)await page.locator('[data-services-hourly-notes]').fill('Notas sintéticas de auditoría');
    else{
      await page.locator('[data-services-hourly-notes]').click();
      await page.locator('[data-hourly-mobile-notes-editor-input]').fill('Notas sintéticas de auditoría');
      await page.locator('[data-hourly-mobile-notes-editor-close]').click();
    }
  } else {
    const step=page.locator('[data-direct-transfer-mobile-config-step]');
    await step.waitFor({state:'visible'});
    for(const [role,label,lat,lng] of [['origin','Origen sintético, Roma Norte',19.4192,-99.1629],['destination','Destino sintético, Condesa',19.418,-99.169]])
      await step.evaluate((n,detail)=>{const input=n.querySelector('[data-direct-transfer-mobile-address-role="'+detail.role+'"]');input.value=detail.selectedPlace.label;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new CustomEvent('pixkuy:direct-transfer-mobile-address-place',{bubbles:true,detail}));},{role,selectedPlace:{label,placeId:'synthetic-'+role,lat,lng,countryCode:'MX',locality:'Ciudad de México',types:['street_address']}});
    await page.locator('[data-direct-transfer-mobile-config-field="date"]').fill(date);
    await page.locator('[data-direct-transfer-mobile-config-field="time"]').fill('23:00');
    await page.locator('[data-direct-transfer-mobile-config-field="time"]').dispatchEvent('change');
  }
}
const configCta=s=>s==='airport_transfer'?'#services-expand-airport .services-expand__actions .services-expand__cta':s==='hourly_daily'?'[data-services-hourly-cta]':'[data-direct-transfer-mobile-config-cta]';
async function contact(t,submitNow=true) {
  const {page,s}=t;
  await page.locator(configCta(s)).click();
  if(s!=='direct_transfer')await page.waitForURL(s==='hourly_daily'?/#hourly\/datos$/:/#airport\/datos$/);
  else await page.locator('[data-direct-transfer-mobile-contact-step][aria-hidden="false"]').waitFor();
  const sel=s==='direct_transfer'?'[data-direct-transfer-mobile-contact-field="':'#contact-';
  const field=n=>page.locator(s==='direct_transfer'?sel+n+'"]':sel+n);
  await field('name').fill('Persona Sintética');await field('phone').fill('+123');await field('email').fill('incorrecto');await field('name').focus();
  t.invalidContact=await shot(t,'contacto-invalido');
  await field('phone').fill('+525512345678');await field('email').fill('audit@example.invalid');
  if(s==='airport_transfer') {
    await page.locator('#contact-message').click();await page.locator('[data-airport-mobile-notes-editor-input]').fill('Notas sintéticas de auditoría');await page.locator('[data-airport-mobile-notes-editor-close]').click();
  }
  if(s==='direct_transfer'){await field('notes').click();await page.locator('[data-direct-transfer-mobile-notes-editor-input]').fill('Notas sintéticas de auditoría');await page.locator('[data-direct-transfer-mobile-notes-editor-close]').click();}
  const legal=s==='airport_transfer'?'#pixkuy-airport-transfer-legal-acceptance':s==='hourly_daily'?'#pixkuy-hourly-legal-acceptance':'#pixkuy-direct-transfer-mobile-legal-acceptance';
  assert.equal(await page.locator(legal).isChecked(),false);await page.locator(legal).check();
  t.data=await shot(t,'datos');
  if(!submitNow)return;
  const submit=s==='direct_transfer'?'[data-direct-transfer-mobile-contact-submit]':s==='hourly_daily'?'#hourly-contact-submit':'#contact-submit';
  await page.locator(submit).click();
  await page.waitForURL(reviewRoute(s));
}
async function edges(s,width) {
  const t=await setup(width,s),row={kind:'edges',s,width,availability:[]};
  try {
    await enter(t);await t.page.waitForFunction(selector=>!document.querySelector(selector).disabled,configCta(s));
    const time=t.page.locator(s==='airport_transfer'?'#airport-tariff-time':s==='hourly_daily'?'[data-services-hourly-time]':'[data-direct-transfer-mobile-config-field="time"]');
    for(const [i,mode] of ['unavailable','technical','network','available'].entries()) {
      t.state.availability=mode;
      await time.fill('22:0'+i);await time.dispatchEvent('change');
      await t.page.waitForTimeout(800);
      row.availability.push({mode,disabled:await t.page.locator(configCta(s)).isDisabled(),...await shot(t,'disponibilidad-'+mode)});
    }
    // Delayed positive A must not restore an offer after newer unavailable B.
    t.state.delay=1000;t.state.availability='available';
    const initial=t.state.requests.filter(r=>r.kind==='precheck').length;
    await time.fill('22:10');await time.dispatchEvent('change');
    await t.page.waitForFunction(()=>true); // No application function is replaced.
    const deadline=Date.now()+5000;while(t.state.requests.filter(r=>r.kind==='precheck').length===initial&&Date.now()<deadline)await t.page.waitForTimeout(50);
    t.state.delay=0;t.state.availability='unavailable';await time.fill('22:11');await time.dispatchEvent('change');
    await t.page.waitForTimeout(1500);
    row.stale={disabled:await t.page.locator(configCta(s)).isDisabled(),...await shot(t,'respuesta-antigua')};
    t.state.availability='available';await time.fill('23:00');await time.dispatchEvent('change');
    await t.page.waitForFunction(selector=>!document.querySelector(selector).disabled,configCta(s));
    if(s==='hourly_daily')await t.page.waitForFunction(()=>window.PixkuyFleetSelection.selection('hourly_daily')&&window.PixkuyFleetSelection.hourlyOfferStatus().valid);
    await contact(t,false);
    row.notes=await shot(t,'notas');
    const submit=s==='direct_transfer'?'[data-direct-transfer-mobile-contact-submit]':s==='hourly_daily'?'#hourly-contact-submit':'#contact-submit';
    await t.page.locator(submit).click();await t.page.waitForURL(reviewRoute(s));
    t.state.checkout='lost';
    const pay=t.page.locator(paymentSelector(s));
    await pay.evaluate(n=>{n.click();n.click();});await t.page.waitForTimeout(1000);
    row.lost=await shot(t,'respuesta-pago-perdida');
    row.attempt=await t.page.evaluate(s=>window.PixkuyFleetSelection.read(s).attempt,s);
    row.dispatchCount=t.state.requests.filter(r=>r.kind==='checkout').length;
    await t.page.reload();await t.page.waitForTimeout(650);
    row.reload=await shot(t,'recarga-pago-incierto');
    row.afterReloadCount=t.state.requests.filter(r=>r.kind==='checkout').length;
    row.attemptAfterReload=await t.page.evaluate(s=>window.PixkuyFleetSelection.read(s).attempt,s);
    row.completed=true;
  }catch(e){row.error=e.message;row.failure=await shot(t,'edge-error').catch(()=>null);}
  row.requests=t.state.requests;row.errors=t.state.errors;results.push(row);await t.context.close();
}
async function flow(s,width) {
  const t=await setup(width,s);const row={kind:'flow',s,width};
  try {
    await enter(t);await t.page.locator(configCta(s)).waitFor();
    await t.page.waitForFunction(selector=>!document.querySelector(selector).disabled,configCta(s));
    row.config=await shot(t,'configuracion');
    await contact(t);row.invalidContact=t.invalidContact;row.data=t.data;
    row.afterData={url:t.page.url(),checkouts:t.state.requests.filter(r=>r.kind==='checkout').length};
    assert.equal(row.afterData.checkouts,0,'Review must not dispatch checkout');
    {
      row.review=await shot(t,'revision');
      const pay=t.page.locator(paymentSelector(s));
      await pay.click();await t.page.waitForURL(/checkout\.stripe\.com/);
    }
    t.state.mode='pending';
    await t.page.goto(origin+'/booking-cancelled.html?token=synthetic-audit-'+s);
    await t.page.waitForFunction(()=>window.__auditStatus?.result);
    row.pending=await shot(t,'retorno-pendiente');
    row.editAllowed=await t.page.evaluate(()=>window.PixkuyBookingCancelledEdit.allowed(window.__auditStatus));
    if(row.editAllowed) {
      await t.page.getByRole('button',{name:'Modificar datos',exact:true}).click();
      await t.page.waitForURL(s==='hourly_daily'?/#hourly\/datos$/:/#airport\/datos$/);
      row.edit=await shot(t,'modificar-datos');
      await t.page.locator(s==='hourly_daily'?'#hourly-contact-name':'#contact-name').fill('Persona Modificada');
      if(s==='airport_transfer') {await t.page.locator('#contact-message').click();await t.page.locator('[data-airport-mobile-notes-editor-input]').fill('Notas editadas');await t.page.locator('[data-airport-mobile-notes-editor-close]').click();}
      const legal=t.page.locator(s==='hourly_daily'?'#pixkuy-hourly-legal-acceptance':'#pixkuy-airport-transfer-legal-acceptance');
      row.editLegal=await legal.isChecked();if(!row.editLegal)await legal.check();
      await t.page.locator(s==='hourly_daily'?'#hourly-contact-submit':'#contact-submit').click();
      await t.page.waitForURL(s==='hourly_daily'?/#hourly\/revision$/:/#airport\/revision$/);
      row.editReview=await shot(t,'nueva-revision');
      await t.page.locator(s==='hourly_daily'?'[data-hourly-pay]':'[data-airport-pay]').click();
      await t.page.waitForURL(/checkout\.stripe\.com/);
      row.replacement=true;
    }
    row.completed=true;
  }catch(e){row.error=e.message;row.failure=await shot(t,'flow-error').catch(()=>null);}
  row.requests=t.state.requests;row.errors=t.state.errors;row.blocked=t.state.blocked;
  results.push(row);await t.context.close();
}
async function statuses(s,width) {
  const t=await setup(width,s);const row={kind:'statuses',s,width,states:[]};
  try {
    for(const mode of (process.argv.includes('--failed')?['failed','missing']:['pending','confirmed','hold_expired','payment_mismatch','payment_after_expiry','cancelled_manual','invalid','access_expired','network','inconsistent'])) {
      t.state.mode=mode;
      await t.page.goto(origin+'/booking-success.html?'+(mode==='missing'?'':'token=synthetic-audit-'+s+'&')+'payment_status=paid&status=confirmed');
      await t.page.waitForFunction(()=>window.__auditStatus?.result);
      const normalized=await t.page.evaluate(()=>({view:window.__auditStatus.result.view,service:window.__auditStatus.result.serviceType,edit:window.PixkuyBookingCancelledEdit?.allowed(window.__auditStatus)}));
      const capture=await shot(t,'estado-'+mode);
      row.states.push({mode,normalized,...capture});
      if(mode==='confirmed'){await t.page.reload();await t.page.waitForFunction(()=>window.__auditStatus?.result);row.confirmedReload=await t.page.evaluate(()=>window.__auditStatus.result.view);}
    }
    t.state.mode='confirmed';
    row.languages=[];
    for(const lang of (process.argv.includes('--failed')?[]:langs)) {
      await t.page.goto(origin+'/booking-success.html?token=synthetic-audit-'+s+'&lang='+lang);
      await t.page.waitForFunction(()=>window.__auditStatus?.result);
      row.languages.push({lang,...await shot(t,'confirmada-'+lang)});
    }
  }catch(e){row.error=e.message;}
  row.errors=t.state.errors;results.push(row);await t.context.close();
}
async function extra(s,width) {
  const t=await setup(width,s),row={kind:'extra',s,width,languages:[]};
  try {
    await enter(t);await t.page.waitForFunction(selector=>!document.querySelector(selector).disabled,configCta(s));
    await contact(t,false);
    // Exercise the real language selector and preserve contact/notes/legal state.
    for(const lang of langs) {
      await t.page.locator('#lang-trigger').click();
      await t.page.locator('[data-lang="'+lang+'"]').click();
      await t.page.waitForFunction(lang=>document.documentElement.lang===lang,lang);await t.page.waitForTimeout(180);
      row.languages.push({lang,...await shot(t,'datos-idioma-'+lang)});
    }
    await t.page.locator('#lang-trigger').click();await t.page.locator('[data-lang="es"]').click();await t.page.waitForTimeout(200);
    const back=t.page.locator(s==='direct_transfer'?'[data-direct-transfer-mobile-contact-back]':s==='hourly_daily'?'.hourly-booking--mobile .hourly-mobile-flow__back':'.airport-booking > .airport-mobile-flow__back-row button');
    await back.click();row.back=await shot(t,'volver-configuracion');
    if(s==='direct_transfer') {
      const step=t.page.locator('[data-direct-transfer-mobile-config-step]');
      await step.evaluate(n=>{const input=n.querySelector('[data-direct-transfer-mobile-address-role="origin"]');input.value='Aeropuerto Internacional Benito Juárez MEX';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new CustomEvent('pixkuy:direct-transfer-mobile-address-place',{bubbles:true,detail:{role:'origin',selectedPlace:{label:input.value,placeId:'synthetic-airport',lat:19.436,lng:-99.0719,types:['airport'],iataCode:'MEX'}}}));});
      await t.page.waitForTimeout(400);row.airportGuard=await shot(t,'aeropuerto-rechazado');
    }
    for(const mode of ['confirmed','pending']) {
      t.state.mode=mode;await t.page.goto(origin+'/booking-'+(mode==='confirmed'?'success':'cancelled')+'.html?token=synthetic-audit-'+s+'&lang=es');
      await t.page.waitForFunction(()=>window.__auditStatus?.result);
      await t.page.locator('[data-consent-reject]').click({timeout:500}).catch(()=>{});
      await t.page.waitForTimeout(150);
      row[mode]=await shot(t,'comparativa-'+mode);
      const photo=t.page.locator('[data-booking-status-vehicle-thumb]:visible').first();
      row[mode].photo=await photo.evaluate(n=>({loaded:n.complete&&n.naturalWidth>0,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,fit:getComputedStyle(n).objectFit})).catch(()=>null);
      row[mode].links=await t.page.locator('a:visible').evaluateAll(ns=>ns.map(n=>({text:n.innerText,href:n.getAttribute('href')})));
      const disclosure=t.page.locator('summary:visible').first();
      if(await disclosure.count()){await disclosure.click();row[mode].expanded=await shot(t,'comparativa-'+mode+'-abierta');}
      if(mode==='confirmed'){
        await t.page.getByRole('link',{name:'Reservar otro servicio',exact:true}).click();
        row.newService={url:t.page.url(),checkoutRequests:t.state.requests.filter(r=>r.kind==='checkout').length};
      }
    }
    row.completed=true;
  }catch(e){row.error=e.message;row.failure=await shot(t,'extra-error').catch(()=>null);}
  row.requests=t.state.requests;row.errors=t.state.errors;results.push(row);await t.context.close();
}
async function catalogs() {
  function leaves(x,p='',out={}) {for(const [k,v] of Object.entries(x)){const key=p?p+'.'+k:k;if(v&&typeof v==='object')leaves(v,key,out);else out[key]=v;}return out;}
  const files=['airport-desktop-booking.json','airport-mobile-booking-flow.json','booking-status.json','direct-transfer-checkout.json','direct-transfer-mobile-booking-flow.json','services-hourly.json','legal.json'];
  const rows=[];
  for(const file of files){const es=leaves(JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n/es',file),'utf8')));for(const lang of langs){const other=leaves(JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,file),'utf8')));rows.push({file,lang,keys:Object.keys(es).length,missing:Object.keys(es).filter(k=>!(k in other)),empty:Object.keys(es).filter(k=>other[k]===''),sameAsSpanish:lang==='es'?[]:Object.keys(es).filter(k=>typeof es[k]==='string'&&es[k].length>24&&other[k]===es[k]).map(k=>({key:k,text:es[k]}))});}}
  await fs.writeFile(path.join(output,'i18n-catalogs.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({catalogs:rows.length,missing:rows.reduce((n,r)=>n+r.missing.length,0),empty:rows.reduce((n,r)=>n+r.empty.length,0)}));
}
async function recovery(s,width) {
  const t=await setup(width,s),row={kind:'recovery',s,width};
  try {
    await enter(t);await t.page.waitForFunction(selector=>!document.querySelector(selector).disabled,configCta(s));
    await contact(t,false);
    const submit=s==='direct_transfer'?'[data-direct-transfer-mobile-contact-submit]':s==='hourly_daily'?'#hourly-contact-submit':'#contact-submit';
    await t.page.locator(submit).click();await t.page.waitForURL(reviewRoute(s));
    t.state.checkout='lost';await t.page.locator(paymentSelector(s)).click();
    await t.page.waitForTimeout(600);
    if(s==='direct_transfer'){assert.equal(await t.page.locator('[data-direct-transfer-checkout-review-edit]').isVisible(),false);row.uncertain=await shot(t,'fixed-uncertain');}
    await t.page.reload();await t.page.waitForTimeout(600);
    if(s==='direct_transfer'){assert.equal(await t.page.locator('[data-direct-transfer-checkout-review-edit]').isVisible(),false);row.reloaded=await shot(t,'fixed-uncertain-reloaded');}
    t.state.checkout='success';
    await t.page.getByRole('button',{name:s==='hourly_daily'?'Recuperar y continuar al pago':'Comprobar estado del pago',exact:true}).click();
    await t.page.waitForURL(/checkout\.stripe\.com/);
    const sends=t.state.requests.filter(r=>r.kind==='checkout');
    row.sameKey=sends.length===2&&sends[0].key===sends[1].key;row.samePayload=sends.length===2&&JSON.stringify(sends[0].payload)===JSON.stringify(sends[1].payload);
    assert(row.sameKey&&row.samePayload);row.completed=true;
  }catch(e){row.error=e.message;row.failure=await shot(t,'recovery-error').catch(()=>null);}
  row.requests=t.state.requests;results.push(row);await t.context.close();
}
async function main() {
  assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1','Explicit fixture mode required');
  if(process.argv.includes('--catalogs'))return catalogs();
  await fs.mkdir(output,{recursive:true});browser=process.argv.includes('--chrome')?await launchChrome():await chromium.launch({headless:true});
  const widths=process.env.PIXKUY_AUDIT_WIDTH?[Number(process.env.PIXKUY_AUDIT_WIDTH)]:[320,390];
  assert(widths.every(w=>[320,390,1440].includes(w)),'Known audit viewports only');
  const selected=process.env.PIXKUY_AUDIT_SERVICE?services.filter(s=>s===process.env.PIXKUY_AUDIT_SERVICE):services;
  const suffix=process.env.PIXKUY_AUDIT_SERVICE?'-'+process.env.PIXKUY_AUDIT_SERVICE:'';
  try {for(const s of selected)for(const width of widths){if(process.argv.includes('--regression'))await regression(s,width);else if(process.argv.includes('--failed'))await statuses(s,width);else if(process.argv.includes('--recovery'))await recovery(s,width);else if(process.argv.includes('--extra'))await extra(s,width);else if(process.argv.includes('--edges'))await edges(s,width);else {if(!process.argv.includes('--status-only'))await flow(s,width);if(!process.argv.includes('--flow-only'))await statuses(s,width);}await fs.writeFile(path.join(output,(process.argv.includes('--regression')?'regression':process.argv.includes('--failed')?'failed':process.argv.includes('--recovery')?'recovery':process.argv.includes('--extra')?'extra':process.argv.includes('--edges')?'edges':process.argv.includes('--status-only')?'statuses':'browser')+suffix+'.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({s,width,result:results.at(-1).error||'recorded'}));}if(results.some(r=>r.error||r.errors?.length))process.exitCode=1;}
  finally {await browser.close();await fs.writeFile(path.join(output,'browser-resource-hashes.json'),JSON.stringify([...resources].map(([file,sha256])=>({file,sha256})),null,2));}
}
async function regression(s,width) {
  const t=await setup(width,s),row={kind:'regression',s,width,checks:[],screens:[]};
  try {
    await enter(t);await t.page.waitForFunction(selector=>!document.querySelector(selector).disabled,configCta(s));
    await contact(t,false);
    const checkbox=t.page.locator(s==='airport_transfer'?'#pixkuy-airport-transfer-legal-acceptance':s==='hourly_daily'?'#pixkuy-hourly-legal-acceptance':'#pixkuy-direct-transfer-mobile-legal-acceptance');
    const proof=()=>t.page.locator((s==='hourly_daily'?'form[name="hourly-booking"]':'form[name="contact"]')+' [name="legal_acceptance_accepted_at"]').inputValue();
    async function language(lang){await t.page.locator('#lang-trigger').click();await t.page.locator('[data-lang="'+lang+'"]').click();await t.page.waitForFunction(lang=>document.documentElement.lang===lang,lang);await t.page.waitForTimeout(200);}
    await checkbox.uncheck();await language('en');assert.equal(await checkbox.isChecked(),false);assert.equal(await proof(),'');
    await checkbox.check();const acceptedAt=await proof();assert(acceptedAt);
    for(const lang of langs){await language(lang);assert.equal(await checkbox.isChecked(),true);assert.equal(await proof(),acceptedAt);
      const label=await checkbox.evaluate(n=>n.parentElement.querySelector('label').textContent);
      assert.equal(label,await t.page.evaluate(()=>window.__pixkuyI18nDict.terms.acceptance.checkbox));
      assert((await checkbox.evaluate(n=>[...n.parentElement.querySelectorAll('a')].map(a=>a.getAttribute('href')))).every(h=>h.endsWith('?lang='+lang)));
      row.screens.push(await shot(t,'fixed-legal-'+lang));}
    row.checks.push('nine languages, original consent timestamp and unchecked consent preserved');
    await language('es');
    if(s==='airport_transfer'&&width===390){await language('en');await t.page.setViewportSize({width:1440,height:1000});assert.equal(await proof(),acceptedAt);row.screens.push(await shot(t,'desktop-legal'));await t.page.setViewportSize({width,height:844});await language('es');}
    const submit=s==='direct_transfer'?'[data-direct-transfer-mobile-contact-submit]':s==='hourly_daily'?'#hourly-contact-submit':'#contact-submit';
    await t.page.locator(submit).click();await t.page.waitForURL(reviewRoute(s));
    assert.equal(t.state.requests.filter(r=>r.kind==='checkout').length,0);
    row.screens.push(await shot(t,'fixed-review'));
    if(s==='direct_transfer') {
      await t.page.locator('[data-mobile-topbar-menu-trigger]').click();assert(await t.page.locator('[data-mobile-topbar-menu-panel]').isVisible());await t.page.keyboard.press('Escape');
      await t.page.locator('[data-direct-transfer-checkout-review-edit]').click();
      await t.page.waitForURL(url=>url.pathname==='/'&&url.searchParams.get('service')==='direct_transfer');
      await t.page.waitForFunction(()=>window.PixkuyDirectTransferMobileContactStep?.isOpen(),null,{timeout:15000});
      await t.page.locator('[data-direct-transfer-mobile-contact-field="name"]').waitFor({state:'visible',timeout:15000});
      assert.equal(await t.page.locator('[data-direct-transfer-mobile-contact-field="name"]').inputValue(),'Persona Sintética');
      assert.equal(await t.page.locator('[data-direct-transfer-mobile-contact-field="notes"]').inputValue(),'Notas sintéticas de auditoría');
      assert(await t.page.locator('#pixkuy-direct-transfer-mobile-legal-acceptance').isChecked());
      await t.page.locator('[data-direct-transfer-mobile-contact-field="name"]').fill('Persona Modificada');
      await t.page.locator('[data-direct-transfer-mobile-contact-field="notes"]').click();await t.page.locator('[data-direct-transfer-mobile-notes-editor-input]').fill('Notas editadas');await t.page.locator('[data-direct-transfer-mobile-notes-editor-close]').click();
      await t.page.locator(submit).click();await t.page.waitForURL(reviewRoute(s));
      await t.page.reload();await t.page.locator('[data-direct-transfer-checkout-review-proceed]').waitFor();
      assert((await t.page.locator('[data-direct-transfer-checkout-review-content]').innerText()).includes('Notas editadas'));
      if(width===390){await t.page.setViewportSize({width:1440,height:1000});await t.page.waitForTimeout(150);row.screens.push(await shot(t,'desktop-review'));await t.page.setViewportSize({width,height:844});}
      t.state.models=[{...model,modelId:'00000000-0000-4000-8000-000000000002',name:'Modelo alternativo sintético',photoUrl:null}];
      await t.page.locator(paymentSelector(s)).click();
      await t.page.waitForFunction(()=>{const n=document.querySelector('[data-direct-transfer-checkout-review-error]');return n&&!n.hidden&&!document.querySelector('[data-direct-transfer-checkout-review-proceed]').disabled;});
      assert.equal(t.state.requests.filter(r=>r.kind==='checkout').length,0,'Model change requires another gesture');
      assert((await t.page.locator('[data-direct-transfer-checkout-review-content]').innerText()).includes('Modelo alternativo sintético'));
      row.screens.push(await shot(t,'fixed-model-change'));
      t.state.amount=90000;
      await t.page.locator(paymentSelector(s)).click();
      await t.page.waitForFunction(()=>{const n=document.querySelector('[data-direct-transfer-checkout-review-error]');return n&&!n.hidden&&!document.querySelector('[data-direct-transfer-checkout-review-proceed]').disabled;});
      assert.equal(t.state.requests.filter(r=>r.kind==='checkout').length,0,'Price change requires another gesture');
      assert((await t.page.locator('[data-direct-transfer-checkout-review-content]').innerText()).includes('900'));
      await language('en');assert((await t.page.locator('[data-direct-transfer-checkout-review-content]').innerText()).includes('900'),'Language cannot restore old quote');await language('es');
      row.screens.push(await shot(t,'fixed-price-change'));
    }
    await t.page.locator(paymentSelector(s)).click();await t.page.waitForURL(/checkout\.stripe\.com/);
    const sent=t.state.requests.filter(r=>r.kind==='checkout');assert.equal(sent.length,1);
    if(s==='direct_transfer'){assert.equal(sent[0].payload.direct_transfer_price,90000);assert.equal(sent[0].payload.fleet_selection.model_id,t.state.models[0].modelId);assert.equal(sent[0].payload.customer.full_name,'Persona Modificada');assert.equal(sent[0].payload.direct_transfer_notes,'Notas editadas');}
    row.checks.push('review zero checkout, one payment dispatch; Direct back/edit/reload and new price accepted');
    for(const mode of ['access_expired','pending','inconsistent','confirmed']){
      t.state.mode=mode;await t.page.goto(origin+'/booking-success.html?token=synthetic-audit-'+s+'&lang=en&status=confirmed');await t.page.waitForFunction(()=>window.__auditStatus?.result);await t.page.waitForTimeout(200);
      const state=await t.page.evaluate(()=>window.__auditStatus.result);
      assert.equal(state.view,mode==='access_expired'?'requestError':mode==='confirmed'?'confirmed':'pending');
      if(mode==='access_expired'){assert(state.accessExpired);assert((await t.page.locator('[data-booking-status-title]:visible').innerText()).toLowerCase().includes('access'));}
      if(mode==='pending'&&s==='direct_transfer'){assert.equal(await t.page.locator('[data-booking-status-label="amount"]:visible').innerText(),'Pending amount');}
      if(mode==='confirmed'&&s==='direct_transfer'){assert.equal(await t.page.locator('[data-booking-status-label="notes"]:visible').innerText(),'Notes');}
      await t.page.locator('[data-consent-reject]').click({timeout:300}).catch(()=>{});row.screens.push(await shot(t,'fixed-status-'+mode));
      if(width===390&&mode==='access_expired'){await t.page.setViewportSize({width:1440,height:1000});await t.page.waitForTimeout(100);row.screens.push(await shot(t,'desktop-access-expired'));await t.page.setViewportSize({width,height:844});}
    }
    row.checks.push('expired access, pending amount, contradictory status and paid confirmation');row.completed=true;
  }catch(e){row.error=e.message;row.failure=await shot(t,'regression-error').catch(()=>null);}
  row.requests=t.state.requests;row.errors=t.state.errors;results.push(row);await t.context.close();
}
module.exports={setup,shot,enter,contact,configCta,statusBody,output,origin,services,results,resources,model,launchChrome,setBrowser:b=>{browser=b;}};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
