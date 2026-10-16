'use strict';
// Real local product/runner; existing closed HTTP boundary, never SQL or providers.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs');
const {chromium,webkit}=require('../../../pixkuy_frontend/node_modules/playwright');
const results=[],before=process.argv.includes('--before'),out=base.output;
const checkSelector=s=>s==='airport_transfer'?'#pixkuy-airport-transfer-legal-acceptance':'#pixkuy-hourly-legal-acceptance';
async function wait(fn,label){const end=Date.now()+12000;while(!await fn()){assert(Date.now()<end,label);await new Promise(r=>setTimeout(r,60));}}
async function prepare(t){
 const p=t.page,s=t.s;t.replacements=[];p.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/replace-checkout'))t.replacements.push({token:r.headers()['x-pixkuy-booking-token'],key:r.headers()['idempotency-key']});});t.expiry=new Date(Date.now()+20*60000).toISOString();t.statusMode='pending';
 await t.context.route('**/v1/public/reservations/status?**',async route=>{
  const token=new URL(route.request().url()).searchParams.get('token');t.state.requests.push({kind:'status',token,mode:t.statusMode});
  if(t.statusMode==='network')return route.fulfill({status:503,json:{code:'CONTROLLED'}});
  if(t.statusMode==='invalid')return route.fulfill({status:404,json:{code:'BOOKING_STATUS_NOT_FOUND'}});
  if(t.statusMode==='access_expired')return route.fulfill({status:410,json:{code:'BOOKING_STATUS_TOKEN_EXPIRED',serviceType:s}});
  const draft={...t.state.draft.form_payload_raw,...t.state.draft};delete draft.form_payload_raw;
  if(['absent','fallback'].includes(t.proof))Object.keys(draft).filter(k=>k.startsWith('legal_acceptance_')).forEach(k=>delete draft[k]);
  if(t.proof==='revoked')draft.legal_acceptance_accepted=false;
  if(t.proof==='foreign')draft.legal_acceptance_channel=s==='airport_transfer'?'web_hourly_checkout':'web_airport_checkout';
  if(t.proof==='outdated')draft.legal_acceptance_terms_version='superseded';
  const body=base.statusBody(s,t.statusMode,draft);body.serverNow=new Date().toISOString();body.hold.expiresAt=t.expiry;
  body.reservation.publicCode='PKY-SYNTHETIC-'+s;body.reservation.passengerLabel='3-4 passengers';
  body.reservation.durationHours=s==='direct_transfer'?4:body.reservation.durationHours;
  if(t.statusMode==='unknown'){body.reservation.status='unknown';body.actions.canRetryCheckout=false;body.edit.allowed=false;}
  if(t.statusMode==='hold_expired'){body.hold.expiresAt=new Date(Date.now()-1000).toISOString();body.actions.canRetryCheckout=false;}
  if(t.noExpiry)delete body.hold.expiresAt;
  return route.fulfill({json:body});
 });
 if(process.argv.includes('--persisted-hourly')&&s==='hourly_daily'){
  // Start at a persisted pending reservation; do not re-test accepted initial screens.
  t.token='synthetic-audit-'+s;t.initialWrites=0;
  const proof={legal_acceptance_accepted:'true',legal_acceptance_terms_version:'terms_v1_2026_05',legal_acceptance_cancellation_policy_version:'cancellation_policy_v1_2026_05',legal_acceptance_privacy_version:'privacy_v1_2026_05',legal_acceptance_accepted_at:new Date().toISOString(),legal_acceptance_channel:'web_hourly_checkout',legal_acceptance_terms_url:'legal/terms.html',legal_acceptance_cancellations_url:'legal/cancellations.html',legal_acceptance_privacy_url:'legal/privacy.html'};
  t.state.draft={service_type:s,locale:'es',hourly_daily_mode:'hourly',hourly_daily_pickup:'Origen sintético, Roma Norte',hourly_daily_date:'2027-01-13',hourly_daily_start_time:'23:00',hourly_daily_duration_hours:2,hourly_daily_passengers:2,hourly_daily_price:150000,hourly_daily_currency:'MXN',hourly_daily_pickup_place_id:'synthetic-place',hourly_daily_pickup_lat:19.427,hourly_daily_pickup_lng:-99.1677,hourly_daily_notes:'Notas sintéticas conservadas',customer:{full_name:'Persona sintética',email:'synthetic@example.invalid',phone:'+525512345678'},fleet_selection:{version:1,model_id:base.model.modelId,model_revision:1},fleet_model:base.model,...proof};
  await p.goto(base.origin+'/booking-cancelled.html?token='+t.token);
  await p.locator('[data-consent-reject]').click();
  await p.evaluate(({payload,token})=>sessionStorage.setItem('pixkuy_fleet_b:hourly_daily',JSON.stringify({version:1,reservationToken:token,attempt:{state:'committed',key:'synthetic-persisted',payload,response:{bookingStatusToken:token}}})),{payload:t.state.draft,token:t.token});
  return;
 }
 if(process.argv.includes('--webkit')&&s==='airport_transfer'){
  await p.goto(base.origin+'/?service=airport_hotel&lang=es');await p.waitForFunction(()=>window.PixkuyAirportZoneTariff&&window.PixkuyAirportDesktopBooking);
  await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
  await p.evaluate(()=>{const a=window.PixkuyAirportZoneTariff;a.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});a.setResolvedDestination({placeLabel:'Hotel sintético — Roma Norte',zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});for(const [id,value] of [['airport-tariff-date','2027-01-13'],['airport-tariff-time','23:00']]){const n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event('change',{bubbles:true}));}});
 }else await base.enter(t);
 await p.locator(base.configCta(s)).click();
 // Seed the pending fixture only after the already accepted entry/handoff settles.
 await p.evaluate(()=>Promise.all([window.PixkuyAirportDesktopView?.ready,window.PixkuyHourlyBookingView?.ready]));
 await p.waitForLoadState('networkidle');
 const field=n=>p.locator(s==='direct_transfer'?'[data-direct-transfer-mobile-contact-field="'+n+'"]':'#contact-'+n);
 await field('name').fill('Persona sintética');await field('phone').fill('+525512345678');await field('email').fill('synthetic@example.invalid');
 await p.locator(s==='direct_transfer'?'#pixkuy-direct-transfer-mobile-legal-acceptance':checkSelector(s)).check();
 await p.locator(s==='direct_transfer'?'[data-direct-transfer-mobile-contact-submit]':'#contact-submit').click();
 await p.waitForURL(s==='direct_transfer'?/direct-transfer-checkout-review/:s==='hourly_daily'?/#hourly\/revision$/:/#airport\/revision$/);
 await p.locator(s==='direct_transfer'?'[data-direct-transfer-checkout-review-proceed]':s==='hourly_daily'?'[data-hourly-pay]':'[data-airport-pay]').click();await p.waitForURL(/checkout\.stripe\.com/);
 t.token='synthetic-audit-'+s;t.initialWrites=t.state.requests.filter(r=>/checkout$/.test(r.kind)).length;
}
async function status(t){await t.page.goto(base.origin+'/booking-cancelled.html?token='+t.token+'&status=cancelled');await t.page.waitForFunction(()=>window.__auditStatus?.result);await t.page.evaluate(()=>Promise.all([window.PixkuyAirportDesktopView?.ready,window.PixkuyHourlyBookingView?.ready]));await t.page.waitForLoadState('networkidle');}
async function menu(t,service){await t.page.locator('[data-mobile-topbar-menu-trigger]').click();await t.page.locator('[data-mobile-topbar-menu-action="'+service+'"]').click();}
async function direct(t,row){await prepare(t);await status(t);const p=t.page,root=p.locator('[data-booking-cancelled-mobile]');
 await wait(async()=>await root.locator('[data-booking-status-title]').innerText()==='Pago pendiente','Direct authoritative pending');
 assert((await root.innerText()).includes('PKY-SYNTHETIC-direct_transfer'));assert.equal(await root.locator('[data-booking-status-passengers]').innerText(),'3–4');
 assert(!(await root.locator('[data-booking-status-date]').innerText()).includes('2027-01-13'));assert(await root.locator('details').isVisible());
 assert.equal(await root.locator('[data-booking-cancelled-modify]').isVisible(),false);assert.equal(await root.locator('[data-booking-cancelled-retry]').innerText(),'Continuar con el pago');
 row.pending=await base.shot(t,'pending');await root.locator('summary').click();row.contact=await base.shot(t,'pending-contact');
 for(const mode of ['confirmed','hold_expired','unknown']){t.statusMode=mode;await p.evaluate(()=>window.PixkuyBookingStatusState.refresh());assert.notEqual(await root.locator('[data-booking-status-title]').innerText(),'Pago pendiente');assert.equal(await root.locator('[data-booking-cancelled-retry]').isVisible(),false);assert(await root.locator('[data-booking-status-amount]').isVisible(),'Amount survives live '+mode);t.statusMode='pending';await p.evaluate(()=>window.PixkuyBookingStatusState.refresh());await wait(async()=>await root.locator('[data-booking-status-title]').innerText()==='Pago pendiente','live pending restored');}
 if(process.argv.includes('--languages')){row.languages=[];for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){const copy=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'airport-desktop-booking.json'),'utf8'));const statusCopy=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'booking-status.json'),'utf8')).bookingStatus;await p.locator('#lang-trigger').click();await p.locator('[data-lang="'+lang+'"]').click();await wait(async()=>await root.locator('[data-booking-status-title]').innerText()===copy.returnPendingTitle&&await root.locator('[data-booking-status-service]').innerText()===statusCopy.serviceLabels.direct_transfer,'Localized pending '+lang);assert.equal(await root.locator('[data-booking-cancelled-retry]').innerText(),copy.resumePayment);assert.equal(await p.evaluate(()=>window.__auditStatus.result.raw.hold.expiresAt),t.expiry);const capture=await base.shot(t,'pending-'+lang);assert(capture.scrollWidth<=t.width);row.languages.push(capture);}return;}
 const expiry=t.expiry;await p.reload();await p.waitForFunction(()=>window.__auditStatus?.result);assert.equal(await p.evaluate(()=>window.__auditStatus.result.raw.hold.expiresAt),expiry);
 for(const mode of ['confirmed','hold_expired','unknown','inconsistent','invalid','access_expired','network']){t.statusMode=mode;await status(t);assert.notEqual(await root.locator('[data-booking-status-title]').innerText(),'Pago pendiente',mode);assert.equal(await root.locator('[data-booking-cancelled-retry]').isVisible(),false,mode+' no retry');row[mode]=await base.shot(t,mode);}
 t.statusMode='pending';t.noExpiry=true;await status(t);assert.equal(await root.locator('[data-airport-mobile-deadline]').count(),0);
 assert.equal(t.state.requests.filter(r=>/checkout$/.test(r.kind)).length,t.initialWrites);row.noNavigationWrites=true;
 t.noExpiry=false;await status(t);await root.locator('[data-booking-cancelled-retry]').evaluate(n=>{n.click();n.click();});await p.waitForURL(/checkout\.stripe\.com/);const retries=t.state.requests.filter(r=>r.kind==='retry-checkout');assert.equal(retries.length,1);assert.equal(retries[0].payload.token,t.token);row.sameReservationRetry=true;
}
async function recovery(t,row){await prepare(t);await status(t);const p=t.page;
 await p.evaluate(()=>sessionStorage.setItem('pixkuy_fleet_b:direct_transfer',JSON.stringify({version:1,reservationToken:'other-synthetic-owner',attempt:{state:'committed',key:'other-key',response:{bookingStatusToken:'other-synthetic-owner'}}})));
 await menu(t,'hourly');await p.waitForURL(u=>u.pathname==='/');await menu(t,'airport');await p.waitForURL(u=>u.pathname==='/booking-cancelled.html'&&u.searchParams.get('token')===t.token);await p.waitForFunction(()=>window.__auditStatus?.result);
 assert.equal(await p.evaluate(()=>window.__auditStatus.result.raw.hold.expiresAt),t.expiry);assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_fleet_b:direct_transfer')).reservationToken),'other-synthetic-owner');row.restored=await base.shot(t,'restored-pending');
 t.statusMode='network';await p.reload();await p.waitForFunction(()=>window.__auditStatus?.result);row.failedRecovery=await base.shot(t,'recovery-network');assert.equal(t.state.requests.filter(r=>/checkout$/.test(r.kind)).length,t.initialWrites);row.noNavigationWrites=true; t.statusMode='hold_expired';await status(t);await p.locator('[data-booking-cancelled-mobile] [data-booking-cancelled-new]').click();await p.waitForURL(/#airport\/traslado$/);assert.equal(await p.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').reservationToken),undefined);await menu(t,'hourly');await menu(t,'airport');assert.equal(new URL(p.url()).pathname,'/');assert.equal(t.state.requests.filter(r=>/checkout$/.test(r.kind)).length,t.initialWrites);row.explicitNewRespected=true;
}
async function edit(t,row){await prepare(t);if(process.argv.includes('--proof'))t.proof=process.argv[process.argv.indexOf('--proof')+1];await status(t);const p=t.page,s=t.s;
 if(s==='airport_transfer'){assert.equal(await p.evaluate(()=>window.PixkuyBookingCancelledEdit.begin({...window.__auditStatus,token:'another-synthetic-owner'})),false);row.ownerFenced=true;}
 const unknownGuard=await p.evaluate(s=>{const key='pixkuy_fleet_b:'+s,original=sessionStorage.getItem(key),unknown={version:1,attempt:{state:'unknown',key:'frozen-other-attempt',payload:{synthetic:true},url:'/synthetic-only'}};sessionStorage.setItem(key,JSON.stringify(unknown));const before=sessionStorage.getItem(key);const accepted=window.PixkuyBookingCancelledEdit.begin(window.__auditStatus);const unchanged=sessionStorage.getItem(key)===before;sessionStorage.setItem(key,original);return {accepted,unchanged};},s);assert.deepEqual(unknownGuard,{accepted:false,unchanged:true});row.unknownAttemptPreserved=true;
 if(t.proof==='absent')await p.evaluate(s=>{const k='pixkuy_fleet_b:'+s,v=JSON.parse(sessionStorage.getItem(k));delete v.attempt.payload;sessionStorage.setItem(k,JSON.stringify(v));},s);
 await p.locator('[data-booking-cancelled-mobile] [data-booking-cancelled-modify]').click();await p.waitForURL(s==='airport_transfer'?/#airport\/datos$/:/#hourly\/datos$/);await p.locator(checkSelector(s)).waitFor();
 const valid=!t.proof||t.proof==='fallback',checkbox=p.locator(checkSelector(s));await wait(async()=>await checkbox.isChecked()===valid,'checkbox matches proof');
 if(valid){await wait(()=>p.locator('#contact-submit').isEnabled(),'valid edit enabled');assert((await p.locator('body').innerText()).includes('PKY-SYNTHETIC-'+s));}
 else {assert(await p.locator('#contact-submit').isDisabled());await p.locator('#contact-submit').evaluate(n=>n.click());assert(p.url().endsWith('/datos'));await checkbox.check();await wait(()=>p.locator('#contact-submit').isEnabled(),'explicit acceptance enables');}
 if(process.argv.includes('--dispatch')){await p.locator('#contact-name').fill('Persona editada');if(s==='airport_transfer'){await p.locator('#contact-message').click();await p.locator('[data-airport-mobile-notes-editor-input]').fill('Notas editadas de la misma reserva');await p.locator('[data-airport-mobile-notes-editor-close]').click();}}
 row.data=await base.shot(t,'edit-'+(t.proof||'valid'));await p.locator('#contact-submit').scrollIntoViewIfNeeded();row.actions=await base.shot(t,'edit-actions-'+(t.proof||'valid'));await checkbox.uncheck();assert.equal(await p.locator('form[name="contact"] [name="legal_acceptance_accepted"]').inputValue(),'');await p.locator('#contact-submit').evaluate(n=>n.click());assert(p.url().endsWith('/datos'));
 await p.reload();await checkbox.waitFor();assert.equal(await checkbox.isChecked(),false,'Revocation survives reload');assert(await p.locator('#contact-submit').isDisabled());row.revocationPersisted=true;
 await checkbox.check();row.beforeSubmit=await p.evaluate(()=>({checked:document.querySelector('#pixkuy-hourly-legal-acceptance')?.checked,disabled:document.querySelector('#contact-submit').disabled,proof:Array.from(document.querySelectorAll('form[name=contact] [name^=legal_acceptance_]')).map(n=>[n.name,n.value])}));await p.locator('#contact-submit').click();await p.waitForURL(s==='airport_transfer'?/#airport\/revision$/:/#hourly\/revision$/);row.review=await base.shot(t,'edit-review');assert.equal(t.state.requests.filter(r=>/checkout$/.test(r.kind)).length,t.initialWrites); if(process.argv.includes('--dispatch')){await p.locator(s==='airport_transfer'?'[data-airport-pay]':'[data-hourly-pay]').evaluate(n=>{n.click();n.click();});await p.waitForURL(/checkout\.stripe\.com/);const writes=t.state.requests.filter(r=>r.kind==='replace-checkout');assert.equal(writes.length,1);assert.equal(t.replacements[0].token,t.token);assert(t.replacements[0].key);row.replacementIdentity=t.replacements[0];assert.equal(writes[0].payload.customer.full_name,'Persona editada');if(s==='airport_transfer')assert.equal(writes[0].payload.airport_transfer_notes,'Notas editadas de la misma reserva');assert.equal(t.state.requests.filter(r=>r.kind==='checkout').length,1);row.sameReservationReplacement=true;}
}
async function contracts(){
 const vm=require('node:vm'),window={};vm.runInNewContext(await fs.readFile(path.resolve(__dirname,'../assets/js/forms/legal-acceptance.js'),'utf8'),{window,document:{}});const api=window.PixkuyForms.LegalAcceptance,rows=[];
 for(const channel of ['web_airport_checkout','web_hourly_checkout']){
  const proof=api.buildSnapshot(channel),flat=Object.fromEntries(Object.entries(api.fieldNames).map(([key,field])=>[field,proof[key]]));
  for(const [name,mutation,valid] of [['valid',{},true],['revoked',{legal_acceptance_accepted:false},false],['missing',{legal_acceptance_accepted:undefined},false],['foreign',{legal_acceptance_channel:'web_direct_transfer_mobile_checkout'},false],['obsolete',{legal_acceptance_terms_version:'old'},false],['bad-date',{legal_acceptance_accepted_at:'invalid'},false],['bad-url',{legal_acceptance_terms_url:'legal/old.html'},false]]){const actual=api.readEvidence({...flat,...mutation},channel);assert.equal(!!actual,valid);if(valid)assert.equal(actual.acceptedAt,proof.acceptedAt);rows.push({channel,name,result:'PASS'});}
 }
 await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'contracts.json'),JSON.stringify(rows,null,2));console.log('14 legal evidence contract checks PASS');
}
async function main(){assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(out,{recursive:true});const browser=await(process.argv.includes('--webkit')?webkit:chromium).launch({headless:true});base.setBrowser(browser);try{for(const width of (process.argv.includes('--width=390')?[390]:[320,390]))for(const s of (process.argv.includes('--hourly')?['hourly_daily']:process.argv.includes('--direct')?['direct_transfer']:process.argv.includes('--recovery')?['airport_transfer']:['airport_transfer','hourly_daily'])){const t=await base.setup(width,s);t.pending=new Map();t.page.on('request',r=>t.pending.set(r,new URL(r.url()).pathname));t.page.on('requestfinished',r=>t.pending.delete(r));t.page.on('requestfailed',r=>t.pending.delete(r));const row={s,width,proof:process.argv.includes('--proof')?process.argv[process.argv.indexOf('--proof')+1]:'valid'};try{await(s==='direct_transfer'?direct:process.argv.includes('--recovery')?recovery:edit)(t,row);assert.deepEqual(t.state.errors,[]);row.result='PASS';}catch(e){row.result='FAIL';row.error=e.message;row.errorStack=e.stack;row.pendingRequests=[...t.pending.values()];row.diagnostic=await t.page.evaluate(()=>({checked:document.querySelector('#pixkuy-hourly-legal-acceptance')?.checked,proof:window.PixkuyForms?.LegalAcceptance?.readEvidence(document.querySelector('form[name=contact]'),'web_hourly_checkout'),offer:window.PixkuyFleetSelection?.hourlyOfferStatus(),fleet:window.PixkuyFleetSelection?.read('hourly_daily')})).catch(()=>null);row.failure=await base.shot(t,'failure').catch(()=>null);}row.requests=t.state.requests;results.push(row);console.log(JSON.stringify({s,width,result:row.result,error:row.error}));await t.context.close();}}finally{await browser.close();await fs.writeFile(path.join(out,before?'before.json':'results.json'),JSON.stringify(results,null,2));await fs.writeFile(path.join(out,'served-hashes.json'),JSON.stringify([...base.resources],null,2));}if(!before&&results.some(r=>r.result==='FAIL'))process.exitCode=1;}
module.exports={prepare,status,menu,wait,base};
// Targeted continuation on the actual mobile controllers. All transport remains
// captured by the existing audit boundary; never query a live pending booking.
async function transferClose(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(out,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const rows=[];
 const timeout=setTimeout(()=>browser.close(),180000);
 try{for(const s of (process.argv.includes('--airport-only')?['airport_transfer']:process.argv.includes('--direct-only')?['direct_transfer']:['airport_transfer','direct_transfer'])){
  const t=await base.setup(390,s),p=t.page,row={service:s,checks:[],resources:[],defects:[]};rows.push(row);
  const tasks=[];let deliveryError;
  p.on('response',response=>{const u=new URL(response.url());if(u.origin!==base.origin||!/^\/assets\/.*\.(js|css)$/.test(u.pathname))return;
   tasks.push((async()=>{const body=await response.body(),file=await fs.readFile(path.join(__dirname,'..',u.pathname.slice(1))),hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
    const normal=b=>b.toString('utf8').replace(/^\uFEFF/,'');const same=normal(body)===normal(file);row.resources.push({path:u.pathname,http:response.status(),type:response.headers()['content-type'],localHash:hash(file),decodedHash:hash(body),same});
    if(!same)deliveryError='Delivered bytes differ: '+u.pathname;
   })().catch(e=>{deliveryError=e.message;}));});
  const gate=async()=>{await Promise.all(tasks);assert(!deliveryError,deliveryError);assert.deepEqual(t.state.errors,[]);};
  const shot=async label=>{await gate();row[label]=await base.shot(t,label);row[label].geometry=await p.evaluate(()=>{const rect=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,text:n.textContent,display:getComputedStyle(n).display};};return {header:rect('.mobile-topbar'),back:rect('[data-direct-transfer-mobile-contact-back],.airport-mobile-flow__back'),name:rect('#airport-contact-name,[data-direct-transfer-mobile-contact-field="name"]'),phone:rect('#airport-contact-phone,[data-direct-transfer-mobile-contact-field="phone"]')};});};
  const field=n=>p.locator(s==='airport_transfer'?'#airport-contact-'+n:'[data-direct-transfer-mobile-contact-field="'+n+'"]');
  const legal=()=>p.locator(s==='airport_transfer'?'#pixkuy-airport-transfer-legal-acceptance':'#pixkuy-direct-transfer-mobile-legal-acceptance');
  const submit=()=>p.locator(s==='airport_transfer'?'#airport-contact-submit':'[data-direct-transfer-mobile-contact-submit]');
  const review=async()=>{await submit().click();await p.waitForURL(s==='airport_transfer'?/#airport\/revision$/:/direct-transfer-checkout-review/);await p.locator(s==='airport_transfer'?'[data-airport-pay]':'[data-direct-transfer-checkout-review-content]:not([hidden])').waitFor();};
  try{
   await base.enter(t);await p.locator(base.configCta(s)+':enabled').click();await field('name').waitFor();
   await field('name').fill('Persona Sintética');await field('phone').focus();
   const premature=await field('email').getAttribute('aria-invalid')==='true';
   if(premature)row.defects.push('Untouched email marked invalid after name blur');
   if(!before)assert(!premature);await shot('name-only');
   await field('phone').fill('+525512345678');await field('email').fill('audit@example.invalid');
   assert(await submit().isDisabled(),'Consent required');await legal().check();await review();
   const saved=await p.evaluate(s=>JSON.parse(sessionStorage.getItem(s==='airport_transfer'?'pixkuy_airport_transfer_checkout_review_snapshot':'pixkuy_direct_transfer_checkout_review_snapshot')),s);assert(saved);
   const draft={...saved,...saved.form_payload_raw,service_type:s,customer:{full_name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'}};
   const expiry=new Date(Date.now()+1200000).toISOString();t.state.draft=draft;
   await t.context.route('**/v1/public/reservations/status?**',route=>{const b=base.statusBody(s,'pending',draft);b.payment.amountExpected=Number(s==='airport_transfer'?saved.airport_desktop_amount_minor:saved.direct_transfer_amount_minor);assert(Number.isSafeInteger(b.payment.amountExpected)&&b.payment.amountExpected>0,'Status fixture uses numeric minor units');b.hold.expiresAt=expiry;b.edit={allowed:true,revision:'synthetic-transfer-close',draft};b.actions.canModify=true;return route.fulfill({json:b});});
   const pending=async()=>{await p.goto(base.origin+'/booking-cancelled.html?token=synthetic-transfer-close&lang=es');await p.locator('[data-booking-cancelled-modify]:visible').waitFor();};
   await pending();await shot('pending-actions');
   const service=p.locator('[data-booking-cancelled-modify-service]:visible');
   if(!await service.count()){row.defects.push('Missing mobile service edit action');if(!before)assert.fail(row.defects.at(-1));}
   else{await service.click();await p.locator(base.configCta(s)+':enabled').waitFor();await shot('service-configuration');assert(await field('name').isHidden());
    await p.reload();await p.locator(base.configCta(s)+':enabled').waitFor();await p.locator(base.configCta(s)).click();await field('name').waitFor();assert.equal(await field('name').inputValue(),'Persona Sintética');assert(await legal().isChecked());
    await review();await shot('service-review');
   }
   await pending();await p.locator('[data-booking-cancelled-modify]:visible').click();await field('name').waitFor();
   await p.waitForFunction(sel=>!document.querySelector(sel)?.disabled,s==='airport_transfer'?'#airport-contact-submit':'[data-direct-transfer-mobile-contact-submit]');
   await shot('contact-first');assert(await legal().isChecked());
   await p.locator(s==='airport_transfer'?'.airport-mobile-flow__back':'[data-direct-transfer-mobile-contact-back]').click();
   await p.locator(base.configCta(s)+':enabled').waitFor();assert(await field('name').isHidden());
   await p.locator(base.configCta(s)).click();await field('name').waitFor();assert(await legal().isChecked());
   await p.reload();await field('name').waitFor();await p.waitForFunction(sel=>!document.querySelector(sel)?.disabled,s==='airport_transfer'?'#airport-contact-submit':'[data-direct-transfer-mobile-contact-submit]');
   await shot('contact-reload');assert.equal(await field('name').inputValue(),'Persona Sintética');assert(await legal().isChecked());
   await review();await shot('pending-review');
   const editing=await p.evaluate(s=>JSON.parse(sessionStorage.getItem(s==='airport_transfer'?'pixkuy_airport_pending_edit_v1':'pixkuy_direct_pending_edit_v1')),s);
   assert.equal(editing.expiresAt,expiry);assert.equal(editing.token,'synthetic-transfer-close');
   assert(!row['pending-review'].text.includes('Cancelar edición'));
   assert(!t.state.requests.some(r=>['checkout','replace-checkout','retry-checkout','update-contact'].includes(r.kind)));
   row.checks.push('actual mobile contact, pending actions, Data F5, Review; zero business writes');row.result=before?'BASELINE':'PASS';
  }catch(e){row.result='FAIL';row.error=e.stack;row.deliveryError=deliveryError;row.browserErrors=t.state.errors;await fs.writeFile(path.join(out,s+'-checkpoint.json'),JSON.stringify(row,null,2));await p.screenshot({path:path.join(out,s+'-failure.png')}).catch(()=>{});if(deliveryError||t.state.errors.length)throw e;}
  finally{await Promise.all(tasks);await fs.writeFile(path.join(out,s+'-checkpoint.json'),JSON.stringify(row,null,2));await t.context.close();}
 }}finally{clearTimeout(timeout);await browser.close();await fs.writeFile(path.join(out,before?'transfer-before.json':'transfer-results.json'),JSON.stringify(rows,null,2));}
 console.log(JSON.stringify(rows.map(({service,result,error,defects})=>({service,result,error,defects}))));if(rows.some(r=>r.result==='FAIL'))process.exitCode=1;
}
async function airportConfigurationArrival(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(out,{recursive:true});
 const composition=process.argv.includes('--airport-composition');
 const browser=process.argv.includes('--webkit')?await webkit.launch({headless:true}):await base.launchChrome();base.setBrowser(browser);
 const device=require('../../../pixkuy_frontend/node_modules/playwright').devices['iPhone 13'];
 const t=await base.setup(390,'airport_transfer',device),p=t.page,row={screens:{},resources:[],device:'iPhone 13 emulation'},tasks=[];
 const root=path.resolve(__dirname,'..'),hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
 const timeout=setTimeout(()=>browser.close(),120000);let deliveryError;
 // Deliver real workspace files through the existing HTTP boundary, without a server.
 // API writes are forbidden even though the common runner normally captures them.
 await p.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(/\/(checkout|replace-checkout|retry-checkout|update-contact)$/.test(u.pathname)){
   deliveryError='Unexpected business write';return route.abort();
  }
  if(u.origin!==base.origin||u.pathname.startsWith('/v1/')||u.pathname.startsWith('/.netlify/'))return route.fallback();
  assert.equal(req.method(),'GET');
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  assert(file.startsWith(root+path.sep));
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon'};
  const type=types[path.extname(file)];if(!type)return route.fulfill({status:204});
  try{return await route.fulfill({contentType:type,body:await fs.readFile(file)});}catch(e){if(e.code!=='ENOENT')throw e;return route.fulfill({status:404});}
 });
 await t.context.addInitScript(()=>{
  window.__arrivalTrace=[];const id=n=>n?.id||n?.className||n?.tagName;
  for(const [proto,name] of [[HTMLElement.prototype,'focus'],[HTMLElement.prototype,'click'],[HTMLInputElement.prototype,'showPicker'],[Element.prototype,'scrollIntoView']]){
   const original=proto[name];if(!original)continue;
   proto[name]=function(...args){window.__arrivalTrace.push({kind:name,target:id(this),time:performance.now(),stack:new Error().stack.split('\n').slice(2,5)});return original.apply(this,args);};
  }
  for(const type of ['click','focusin','pointerdown'])document.addEventListener(type,e=>window.__arrivalTrace.push({kind:'event:'+type,target:id(e.target),trusted:e.isTrusted,time:performance.now()}),true);
 });
 p.on('response',response=>{const u=new URL(response.url());if(u.origin!==base.origin||!/^\/assets\/.*\.(js|css)$/.test(u.pathname))return;
  tasks.push((async()=>{const body=await response.body(),local=await fs.readFile(path.join(root,u.pathname.slice(1)));const decoded=b=>b.toString('utf8').replace(/^\uFEFF/,'');const same=decoded(body)===decoded(local);
   row.resources.push({path:u.pathname,http:response.status(),same,bytesEqual:body.equals(local),hash:hash(body),localHash:hash(local)});if(!same)deliveryError='Bytes differ: '+u.pathname;
  })().catch(e=>deliveryError=e.message));});
 const settle=()=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const capture=async label=>{
  await settle();await Promise.all(tasks);assert(!deliveryError,deliveryError);assert.deepEqual(t.state.errors,[]);
  await p.locator('.mobile-topbar__brand img,.airport-mobile-fare-footer img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
  row.screens[label]=await p.evaluate(()=>{
   const box=n=>{if(!n)return null;const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {id:n.id,cls:n.className,x:r.x,y:r.y,w:r.width,h:r.height,display:c.display,order:c.order,hidden:n.hidden,margin:c.margin,padding:c.padding};};
   const panel=document.querySelector('#services-expand-airport'),scroller=document.querySelector('.airport-mobile-route__content');
   return {active:document.activeElement?.id||document.activeElement?.className,url:location.pathname+location.hash,scrollTop:scroller.scrollTop,
    heading:box(panel.querySelector('.airport-mobile-flow__title')),header:box(document.querySelector('.mobile-topbar')),panel:box(panel),
    brand:{...box(document.querySelector('.mobile-topbar__brand img')),naturalWidth:document.querySelector('.mobile-topbar__brand img').naturalWidth},
    auxiliary:panel.querySelector('[data-fleet-selection]')?.innerText||'',
    children:[...panel.querySelector('.services-expand__form').children].map(box),endpoints:[...panel.querySelectorAll('[data-airport-tariff-role="origin"], [data-airport-tariff-role="destination"]')].map(n=>({box:box(n),children:[...n.children].map(box)})),trace:window.__arrivalTrace,
    fare:panel.querySelector('.airport-mobile-fare-footer')?.innerText,availability:panel.getAttribute('data-airport-mobile-availability-state'),
    date:document.querySelector('#airport-tariff-date').value,time:document.querySelector('#airport-tariff-time').value,
    passengers:panel.querySelector('[data-airport-mobile-passengers-select]').value,luggage:panel.querySelector('[data-airport-mobile-luggage-select]').value};
  });
  await p.screenshot({path:path.join(out,label+'.png')});await fs.writeFile(path.join(out,'arrival.json'),JSON.stringify(row,null,2));
  if(composition){
   // A full configuration capture includes content below the inner scroller,
   // without changing its width, scroll offset or product layout.
   const original=p.viewportSize(),height=await p.locator('.airport-mobile-route__content').evaluate(n=>n.scrollHeight);
   assert(height<1600,'Bounded configuration capture, never the whole landing');
   await p.setViewportSize({width:original.width,height:Math.max(1100,height)});await settle();
   await p.screenshot({path:path.join(out,label+'-complete.png')});
   await p.setViewportSize(original);await settle();
  }
 };
 const ready=async()=>{await p.locator(base.configCta(t.s)+':enabled').waitFor();await settle();};
 try{
  t.state.amount=127500;t.state.models=[{...base.model,passengersSupported:6}];
  await p.goto(base.origin+'/?service=airport_hotel&lang=es');
  await p.waitForFunction(()=>window.PixkuyAirportZoneTariff&&window.PixkuyAirportMobileBookingFlow);
  await p.locator('[data-consent-reject]').click({timeout:700}).catch(()=>{});
  await p.evaluate(()=>{
   window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'hotel_to_airport'});
   if(!window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'NH Collection Mexico City Reforma — Liverpool 155',zoneId:'reforma',placeId:'synthetic-nh',primaryType:'lodging',lat:19.425,lng:-99.163}))throw new Error('Synthetic lodging rejected by real catalog');
   window.PixkuyAirportZoneTariff.setFareKeySelection({fareKey:'van_5_6'});
   window.PixkuyAirportMobileBookingFlow.setLuggage('0');
  });
  await p.locator('#airport-tariff-date').fill('2027-01-30');
  if(await p.locator('#airport-tariff-time').isVisible())await p.locator('#airport-tariff-time').fill('18:42');
  else await p.locator('[data-airport-tariff-time-select]').selectOption('18:42');
  await ready();
  await p.locator('.airport-mobile-flow__title').click();
  await p.evaluate(()=>{document.querySelector('.airport-mobile-route__content').scrollTop=0;window.__arrivalTrace=[];});
  await capture('normal');
  await p.locator(base.configCta(t.s)).click();await p.locator('#airport-contact-name').fill('Persona Sintética');
  await p.locator('#airport-contact-phone').fill('+525512345678');await p.locator('#airport-contact-email').fill('audit@example.invalid');
  await p.locator('#pixkuy-airport-transfer-legal-acceptance').check();await p.locator('#airport-contact-submit').click();await p.locator('[data-airport-pay]').waitFor();
  const saved=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot')));
  const draft={...saved,...saved.form_payload_raw,customer:{full_name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'}},expiry=new Date(Date.now()+1200000).toISOString();
  if(composition)await p.evaluate(payload=>{
   const key='pixkuy_fleet_b:airport_transfer',value=JSON.parse(sessionStorage.getItem(key));
   value.reservationToken='synthetic-airport-arrival';
   value.attempt={state:'committed',key:'synthetic-known-airport-attempt',payload:{...payload,service_type:'airport_transfer'},url:'/v1/public/reservations/checkout',headers:{},response:{bookingStatusToken:'synthetic-airport-arrival'}};
   sessionStorage.setItem(key,JSON.stringify(value));
  },draft);
  await t.context.route('**/v1/public/reservations/status?**',route=>{
   const body=base.statusBody(t.s,'pending',draft);body.payment.amountExpected=127500;body.hold.expiresAt=expiry;
   Object.assign(body.reservation,{pickupAddress:'NH Collection Mexico City Reforma — Liverpool 155',destinationAddress:'MEX',serviceStartLocalDate:'2027-01-30',serviceStartLocalTime:'18:42',passengerLabel:'5–6',luggageCount:0});
   body.edit={allowed:true,revision:'synthetic-airport-arrival',draft};return route.fulfill({json:body});
  });
  await p.goto(base.origin+'/booking-cancelled.html?token=synthetic-airport-arrival&lang=es');
  await p.locator('[data-booking-cancelled-modify-service]:visible').click();await ready();
  if(!before)await p.waitForFunction(()=>document.activeElement?.hasAttribute('data-airport-mobile-flow-back'));
  await capture('pending-config');
  await p.locator(base.configCta(t.s)).click();await p.locator('#airport-contact-submit:enabled').waitFor();
  assert(await p.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
  await p.evaluate(()=>window.__arrivalTrace=[]);
  await p.locator('.airport-booking .airport-mobile-flow__back').click();await ready();await capture('data-back');
  await p.reload();await ready();
  if(!before)await p.waitForFunction(()=>document.activeElement?.hasAttribute('data-airport-mobile-flow-back'));
  await capture('reload');
  if(composition){
   row.knownAttempt=await p.evaluate(()=>{const f=window.PixkuyFleetSelection.read('airport_transfer');return {key:f.attempt?.key,state:f.attempt?.state,owner:f.attempt?.response?.bookingStatusToken,selected:f.selected?.modelId};});
   assert.equal(row.knownAttempt.key,'synthetic-known-airport-attempt');assert.equal(row.knownAttempt.state,'committed');
   if(!before)for(const label of ['pending-config','data-back','reload'])assert.equal(row.screens[label].auxiliary,'',label+' no redundant model selector for a certified single model');
  }
  const edit=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')));
  assert.equal(edit.token,'synthetic-airport-arrival');assert.equal(edit.expiresAt,expiry);
  assert.equal(await p.locator('#airport-contact-name').inputValue(),'Persona Sintética');
  assert.equal(await p.locator('#airport-contact-email').inputValue(),'audit@example.invalid');
  assert(await p.evaluate(()=>!!window.PixkuyForms.LegalAcceptance.readEvidence(window.PixkuyAirportBookingForm.getReservationForm(),'web_airport_checkout')),'Valid owned consent survives Configuration reload; checkbox mounts in Data');
  for(const label of ['pending-config','data-back','reload']){
   const value=row.screens[label];assert.equal(value.date,'2027-01-30');assert.equal(value.time,'18:42');assert.equal(value.passengers,'van_5_6');assert.equal(value.luggage,'0');
   if(!before){assert.notEqual(value.active,'airport-tariff-date',label);assert(value.heading.y>=60,label+' heading visible');assert.equal(value.scrollTop,0,label+' canonical top');assert(!value.trace.some(e=>e.kind==='showPicker'||e.kind==='focus'&&e.target==='airport-tariff-date'),label+' no implicit date activation');}
  }
  if(!before)for(const label of ['normal','pending-config','data-back','reload']){
   const value=row.screens[label];
   assert(value.endpoints.every(e=>e.children.filter(c=>c.hidden).every(c=>c.h===0)),label+' hidden endpoint roots occupy no space');
   // A fresh response may append its existing availability announcement below
   // the CTA; a recovered offer need not repeat that announcement.
   const composition=screen=>screen.children.map(({cls,x,y,w,h,display})=>({x,y,w,h:cls==='airport-mobile-fare-footer'?null:h,display}));
   assert.deepEqual(composition(value),composition(row.screens.normal),label+' canonical fields and fare position');
   assert.equal(value.availability,'available');assert(value.fare.includes('1,275')&&value.fare.includes('BYD M9'));
  }
  await p.evaluate(()=>window.__arrivalTrace=[]);await p.locator('#airport-tariff-date').click();await capture('explicit-date');
  assert.equal(row.screens['explicit-date'].active,'airport-tariff-date');assert(row.screens['explicit-date'].trace.some(e=>e.kind==='event:click'&&e.target==='airport-tariff-date'&&e.trusted));
  assert(!t.state.requests.some(r=>['checkout','replace-checkout','retry-checkout','update-contact'].includes(r.kind)));
  row.result=before?'BASELINE':'PASS';
 }catch(e){row.result='FAIL';row.error=e.stack;row.diagnostic=await p.evaluate(()=>({offer:window.PixkuyFleetSelection?.airportOfferStatus(),text:document.body.innerText})).catch(()=>null);await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
 finally{clearTimeout(timeout);await Promise.all(tasks);row.browserErrors=t.state.errors;row.requests=t.state.requests;row.blocked=t.state.blocked;await fs.writeFile(path.join(out,'arrival.json'),JSON.stringify(row,null,2));await browser.close();}
 console.log(JSON.stringify({result:row.result,resources:row.resources.length,screens:Object.keys(row.screens)}));
}
if(require.main===module)((process.argv.includes('--airport-config')||process.argv.includes('--airport-composition'))?airportConfigurationArrival():process.argv.includes('--transfer-close')?transferClose():process.argv.includes('--contracts')?contracts():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
