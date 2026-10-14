'use strict';
// Real Landing in isolated Chrome; reuse the existing audit transport. No server,
// network, reservation writer or Stripe operation. Static bytes come from this checkout.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before'),mobile=process.argv.includes('--mobile');
const refinements=process.argv.includes('--refinements');
const token='synthetic-hourly-config',revision='2026-10-13T10:00:00.000Z';
const draft={service_type:'hourly_daily',hourly_daily_mode:'hourly',hourly_daily_pickup:'Hotel sintético, Roma Norte',
 hourly_daily_pickup_place_id:'synthetic-place',hourly_daily_pickup_lat:19.427,hourly_daily_pickup_lng:-99.1677,
 hourly_daily_date:'2027-01-13',hourly_daily_start_time:'23:00',hourly_daily_duration_hours:2,hourly_daily_passengers:2,
 hourly_daily_price:150000,hourly_daily_currency:'MXN',hourly_daily_notes:'Notas conservadas'};
async function main(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);let t;
 const row={before,mobile,transport:'controlled, no network',checks:[],requests:[]};
 const timeout=setTimeout(()=>browser.close(),90000);
 try{
  t=await base.setup(mobile?390:1440,'hourly_daily');const p=t.page;t.state.draft={...draft};let holdConfig=false,releaseConfig,statusLegal=false;
  p.on('pageerror',e=>{row.errorStacks??=[];row.errorStacks.push(e.stack);});
  if(refinements)await t.context.addInitScript(()=>{
   window.__hourlyScrollTrace=[];const original=window.scrollTo;
   window.scrollTo=function(...args){window.__hourlyScrollTrace.push({args,hash:location.hash,stack:new Error().stack});return original.apply(this,args);};
  });
  await t.context.addInitScript(({token,draft})=>{
   if(!sessionStorage.getItem('pixkuy_fleet_b:hourly_daily'))sessionStorage.setItem('pixkuy_fleet_b:hourly_daily',JSON.stringify({reservationToken:token,attempt:{state:'committed',payload:draft,response:{bookingStatusToken:token}}}));
  },{token,draft});
  await t.context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(/\.(mp4|webm)(\?|$)/.test(u.pathname))return route.abort();
   if(u.origin!==base.origin||u.pathname.startsWith('/v1/')||u.pathname.startsWith('/.netlify/'))return route.fallback();
   assert.equal(route.request().method(),'GET');
   const rel=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname),file=path.resolve(root,'.'+rel);
   assert(file.startsWith(root+path.sep));
   const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
   try{return route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)]||'application/octet-stream'});}
   catch(e){if(e.code!=='ENOENT')throw e;return route.fulfill({status:404,body:''});}
  });
  await t.context.route('**/v1/public/reservations/status?*',route=>{
   const body=base.statusBody('hourly_daily','pending',t.state.draft);body.edit.revision=revision;
   if(refinements&&!statusLegal)Object.keys(body.edit.draft).filter(k=>k.startsWith('legal_acceptance_')).forEach(k=>delete body.edit.draft[k]);
   return route.fulfill({json:body});
  });
  if(refinements)await t.context.route('**/v1/public/reservations/replace-checkout',route=>{
   t.state.draft=route.request().postDataJSON();return route.fulfill({json:{bookingStatusToken:token,checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic-audit'}});
  });
  await t.context.route('**/v1/public/reservations/update-contact',route=>route.fulfill({json:{bookingStatusToken:token,checkoutUrl:'https://checkout.stripe.com/c/pay/synthetic-audit'}}));
  await t.context.route('**/.netlify/functions/booking-public-config',async route=>{
   if(holdConfig)await new Promise(resolve=>releaseConfig=resolve);
   return route.fulfill({json:{ok:true,bookingApi:{apiBaseUrl:'https://booking.example.invalid'},publicSite:{siteKey:'local_pixkuy_site_key'}}});
  });
  p.on('request',req=>{if(/\/(?:hourly-availability-precheck|replace-checkout|update-contact|checkout)$/.test(new URL(req.url()).pathname))row.requests.push({url:req.url(),path:new URL(req.url()).pathname,payload:req.postDataJSON(),headers:req.headers()});});
  async function pending(){await p.goto(base.origin+'/booking-cancelled.html?token='+token+'&lang=en');await p.locator(mobile?'[data-booking-cancelled-mobile]':'.hourly-booking').waitFor();await p.locator('[data-consent-reject]').click({timeout:600}).catch(()=>{});}
  const snap=async label=>{await p.screenshot({path:path.join(base.output,label+'.png'),fullPage:label!=='configuration-arrival'});};
  await pending();await snap('pending');
  if(!mobile){
   await p.locator('.hourly-booking .airport-booking__identity button').click();
   if(before){await p.waitForURL(/booking-cancelled/);await snap('before-configure-loop');row.checks.push('configure returns to pending: reproduced');return;}
  }else await p.locator('[data-booking-cancelled-modify]:visible').click();
  if(mobile){await p.waitForURL(/#hourly\/datos$/);await p.locator('.hourly-booking .hourly-mobile-flow__back').click();}
  await p.waitForURL(/#hourly\/servicio$/);await p.locator('[data-services-hourly-panel]').waitFor({state:'visible'});
  row.checks.push('pending to editable configuration');await snap('configuration');
  const pick=p.locator('[data-services-hourly-panel] [data-place-input="hourly_daily_pickup"]');
  await pick.evaluate(n=>{n.value='Hotel nuevo sintético, Condesa';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-pickup-selected',{detail:{selectedPlace:{label:n.value,placeId:'synthetic-new-place',lat:19.418,lng:-99.175}}}));});
  await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
  await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#hourly\/datos$/);
  assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Persona Sintética');
  assert.equal(await p.locator('#pixkuy-hourly-legal-acceptance').isChecked(),false);
  await p.locator('#pixkuy-hourly-legal-acceptance').check();
  await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);await snap('review');
  assert((await p.locator('.hourly-booking').innerText()).includes('Hotel nuevo sintético'));
  if(refinements&&!mobile){assert.equal(await p.getByRole('button',{name:'Cancel editing',exact:true}).count(),0);assert((await p.locator('.hourly-booking').innerText()).includes('Private chauffeur by the hour'));}
  row.checks.push('changed pickup, contact and legal guard, data to review');
  const prechecks=row.requests.filter(r=>r.path.endsWith('precheck'));assert(prechecks.length);
  for(const r of prechecks){assert.equal(r.payload.pending_edit.bookingStatusToken,token);assert.equal(r.payload.pending_edit.editRevision,revision);}
  await p.locator('[data-hourly-pay]').click();await p.waitForURL(/checkout\.stripe\.com/);
  const writes=row.requests.filter(r=>!r.path.endsWith('precheck'));assert.equal(writes.length,1);assert(writes[0].path.endsWith('/replace-checkout'));assert.equal(writes[0].payload.hourly_daily_pickup_place_id,'synthetic-new-place');
  assert.equal(writes[0].headers['x-pixkuy-booking-token'],token);row.checks.push('single captured replacement, same token and reviewed pickup');
  if(refinements){
   const editDetails=async(alreadyPending=false)=>{
    if(!alreadyPending)await pending();await p.locator(mobile?'[data-booking-cancelled-modify]:visible':'.hourly-booking button').filter({hasText:/Edit details|Modificar datos/}).click();
    await p.waitForURL(/#hourly\/datos$/);await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
   };
   const back=p.locator(mobile?'.hourly-booking .hourly-mobile-flow__back':'.hourly-booking .airport-booking__identity button');
   const legal=p.locator('#pixkuy-hourly-legal-acceptance');
   const error=p.locator('.hourly-booking [data-legal-acceptance-error]');
   await editDetails();assert(await legal.isChecked());assert(await error.isHidden());await snap('returned-data');
   if(!mobile)assert((await p.locator('.hourly-booking').innerText()).includes('Private chauffeur by the hour'));
   await p.locator('#hourly-contact-name').fill('Contacto conservado');await back.click();
   await p.waitForURL(/#hourly\/servicio$/);row.checks.push('page Back after returned replacement opens configuration');
   await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
   if(!mobile){
    await p.waitForFunction(()=>document.activeElement===document.querySelector('#services-expand-hourly h3'));
    row.arrival=await p.locator('#services-expand-hourly h3').evaluate(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom,outline:getComputedStyle(n).outlineStyle,marker:n.hasAttribute('data-hourly-programmatic-focus')}));
    assert(row.arrival.top>=56);assert(row.arrival.bottom<844);assert.equal(row.arrival.outline,'none');assert(row.arrival.marker);
    await snap('configuration-arrival');await p.keyboard.press('Tab');
    assert.equal(await p.locator('#services-expand-hourly h3').getAttribute('data-hourly-programmatic-focus'),null);
    row.keyboardFocus=await p.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle}));
   }
   await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#hourly\/datos$/);
   assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Contacto conservado');assert(await legal.isChecked());
   if(!mobile)assert.equal(await p.getByRole('button',{name:'Cancel editing',exact:true}).count(),0);
   // A same-reservation draft must also recover after the committed receipt is
   // absent. Only synthetic fixture-owned state is changed, not product storage.
   await p.evaluate(()=>{const k='pixkuy_fleet_b:hourly_daily',v=JSON.parse(sessionStorage.getItem(k));v.attempt=null;sessionStorage.setItem(k,JSON.stringify(v));});
   await editDetails();assert(await legal.isChecked());assert(await error.isHidden());
   row.checks.push('service-edit acceptance restored without committed receipt; no premature legal error');
   // Model the new status contract, then revoke using the actual checkbox events.
   statusLegal=true;await legal.uncheck();
   const revoked=await p.evaluate(()=>window.PixkuyHourlyBookingDraft.read().legal_acceptance_accepted);assert.equal(revoked,'');
   await editDetails();assert.equal(await legal.isChecked(),false);assert(await error.isHidden());assert(await p.locator('#hourly-contact-submit').isDisabled());
   row.checks.push('real checkbox revocation persists and beats server acceptance');
   // Leave Data first: its real pagehide handler persists the last edit.
   // Remove the synthetic draft only after Pending has taken ownership.
   await pending();
   // Missing local evidence must recover the recorded proof projected by status.
   await p.evaluate(()=>{sessionStorage.removeItem('pixkuy_hourly_checkout_review_snapshot');const k='pixkuy_fleet_b:hourly_daily',v=JSON.parse(sessionStorage.getItem(k));v.attempt=null;sessionStorage.setItem(k,JSON.stringify(v));});
   await editDetails(true);assert(await legal.isChecked());assert(await error.isHidden());
   await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);await snap('review-final');
   if(!mobile){assert((await p.locator('.hourly-booking').innerText()).includes('Private chauffeur by the hour'));assert.equal(await p.getByRole('button',{name:'Cancel editing',exact:true}).count(),0);}
   row.checks.push('server recorded proof restores without local receipt; review remains reachable');
   assert.deepEqual(t.state.errors,[]);assert.deepEqual(row.errorStacks||[],[]);row.result='PASS';return;
  }
  // Independent pending return in this same isolated context; only fixture-owned
  // Hourly records are removed, never unrelated service drafts or global storage.
  await p.goto(base.origin+'/');
  await p.evaluate(()=>{for(const k of Object.keys(sessionStorage))if(k.includes('hourly')||k==='pixkuy_fleet_b:hourly_daily')sessionStorage.removeItem(k);});
  t.state.draft={...draft};t.state.availability='technical';const retryStart=row.requests.length;
  await pending();holdConfig=true;
  await p.locator(mobile?'[data-booking-cancelled-modify]:visible':'.hourly-booking button').filter({hasText:/Edit details|Modificar datos/}).click();
  await p.waitForURL(/#hourly\/datos$/);
  await p.locator('#hourly-contact-submit').waitFor();
  assert.equal(row.requests.length,retryStart,'restored Data must await runtime config');
  assert.equal(typeof releaseConfig,'function');holdConfig=false;releaseConfig();
  const retry=p.getByRole('button',{name:/Check again|Comprobar de nuevo/});await retry.waitFor();
  assert(await p.locator('#hourly-contact-submit').isDisabled());
  assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Persona Sintética');
  t.state.availability='available';await retry.click();
  await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
  assert(await p.locator('#hourly-contact-submit').isDisabled(),'consent absent stays blocked');
  await p.locator('#pixkuy-hourly-legal-acceptance').check();
  await p.reload();await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
  assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Persona Sintética');
  assert(await p.locator('#pixkuy-hourly-legal-acceptance').isChecked());
  await p.waitForFunction(()=>!document.querySelector('#hourly-contact-submit').disabled);
  row.checks.push('technical error blocks; explicit retry succeeds; F5 preserves contact, consent and valid guard');
  await p.locator(mobile?'.hourly-booking .hourly-mobile-flow__back':'.hourly-booking .airport-booking__identity button').click();
  await p.waitForURL(/#hourly\/servicio$/);await p.locator('[data-services-hourly-panel]').waitFor({state:'visible'});
  await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
  await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#hourly\/datos$/);
  if(!mobile){
   await p.locator('.hourly-booking .airport-booking__progress button').first().click();
   await p.waitForURL(/#hourly\/servicio$/);await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
   await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#hourly\/datos$/);
  }
  await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);
  await p.locator('[data-hourly-pay]').click();await p.waitForURL(/checkout\.stripe\.com/);
  const unchangedWrites=row.requests.slice(retryStart).filter(r=>!r.path.endsWith('precheck'));
  assert.equal(unchangedWrites.length,1);assert(unchangedWrites[0].path.endsWith('/update-contact'));
  assert(!('hourly_daily_pickup' in unchangedWrites[0].payload),'contact path does not replace service');
  row.checks.push('Back/progress opens configuration; unchanged reviewed trip uses contact update only');
  for(const r of row.requests)assert.equal(new URL(r.url).origin,'https://booking.example.invalid','all requests target configured API, not Landing');
  await p.goto(base.origin+'/');
  await p.evaluate(()=>{
   const e=JSON.parse(sessionStorage.getItem('pixkuy_hourly_pending_edit_v1'));delete e.serviceBaseline;e.contactOnly=true;sessionStorage.setItem('pixkuy_hourly_pending_edit_v1',JSON.stringify(e));
   const s=JSON.parse(sessionStorage.getItem('pixkuy_fleet_b:hourly_daily'));s.attempt=null;sessionStorage.setItem('pixkuy_fleet_b:hourly_daily',JSON.stringify(s));
  });
  await p.goto(base.origin+'/?service=hourly_daily#hourly/servicio');await p.waitForURL(/booking-cancelled/);
  row.checks.push('legacy context without authorized baseline reacquires status, never opens editable service');
  assert.deepEqual(t.state.errors,[]);row.result='PASS';
 }catch(e){row.result='FAIL';row.error=e.message;row.lastUrl=t?.page.url();row.scrollTrace=await t?.page.evaluate(()=>window.__hourlyScrollTrace).catch(()=>[]);await t?.page.screenshot({path:path.join(base.output,'failure.png'),fullPage:true}).catch(()=>{});throw e;}
 finally{clearTimeout(timeout);row.errors=t?.state.errors||[];await fs.writeFile(path.join(base.output,'result.json'),JSON.stringify(row,null,2));await browser.close();console.log(JSON.stringify({result:row.result||'REPRODUCED',checks:row.checks,error:row.error}));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
