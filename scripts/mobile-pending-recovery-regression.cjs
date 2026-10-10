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
if(require.main===module)(process.argv.includes('--contracts')?contracts():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
