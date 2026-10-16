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
async function mobileLot(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const channel=process.argv.includes('--bundled-chromium')?'chromium':'chrome';
 const browser=await base.launchChrome(channel);base.setBrowser(browser);let t;
 const report={browser:{channel,version:browser.version()},transport:'captured; real checkout modules, no external network',checks:[],errors:[],screens:[]};
 const visualClose=process.argv.includes('--visual-close'),deliveryTasks=[],staticBytes=new Map(),scriptTasks=[];
 const sha=body=>require('node:crypto').createHash('sha256').update(body).digest('hex');
 const withoutBom=body=>body.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))?body.subarray(3):body;
 const timer=setTimeout(()=>browser.close(),240000);
 async function setup(width=390){
  if(t){report.errors.push(...t.state.errors);assert.deepEqual(t.state.errors,[]);await t.context.close();}
  t=await base.setup(width,'hourly_daily');
  // This focused mode uses one awaited collector instead of the base collector
  // plus a second concurrent response.body() read. No changes to product bytes.
  if(visualClose)for(const listener of t.page.listeners('response'))t.page.off('response',listener);
  if(process.argv.includes('--draft-only'))await t.context.route('**/.netlify/functions/booking-public-config',route=>route.fulfill({json:{ok:true,bookingApi:{apiBaseUrl:base.origin},publicSite:{siteKey:'local_pixkuy_site_key'},recaptchaEnterprise:{siteKey:'synthetic-public-key'}}}));
  t.page.on('pageerror',e=>{report.stacks??=[];report.stacks.push(e.stack);});
  const cdp=await t.context.newCDPSession(t.page);await cdp.send('Runtime.enable');
  if(process.argv.includes('--source-attestation')){
   const watched=new Set(['booking-cancelled-edit.js','fleet-selection-state.js','contact-event-special-editor.js','direct-transfer-booking-api-checkout.js','hourly-booking-flow.js','hourly-mobile-booking-flow.js']);
   cdp.on('Debugger.scriptParsed',event=>{
    let u;try{u=new URL(event.url);}catch{return;}
    if(u.origin!==base.origin||!watched.has(path.posix.basename(u.pathname)))return;
    scriptTasks.push((async()=>{
     const result=await cdp.send('Debugger.getScriptSource',{scriptId:event.scriptId});
     const source=Buffer.from(result.scriptSource),local=await fs.readFile(path.resolve(root,'.'+u.pathname));
     report.executedSources??=[];report.executedSources.push({path:u.pathname,scriptId:event.scriptId,localHash:sha(local),sourceHash:sha(source),equivalent:withoutBom(source).equals(withoutBom(local))});
     if(!withoutBom(source).equals(withoutBom(local)))await fs.writeFile(path.join(base.output,path.posix.basename(u.pathname)+'.debugger-source'),source);
    })().catch(error=>{report.scriptCaptureErrors??=[];report.scriptCaptureErrors.push(error.message);}));
   });
   await cdp.send('Debugger.enable');
  }
  cdp.on('Runtime.exceptionThrown',e=>{report.exceptions??=[];report.exceptions.push(e.exceptionDetails);});
  t.page.on('response',response=>{
   const u=new URL(response.url());if(u.origin!==base.origin||!/^\/assets\/.+\.(js|css|json)$/.test(u.pathname))return;
   const task=(async()=>{try{
    const body=await response.body(),file=path.resolve(root,'.'+u.pathname),raw=await fs.readFile(file);
    // Chromium's decoded resource body omits a UTF-8 BOM. Compare content bytes
    // after this documented decoding boundary, not a false three-byte mismatch.
    const expected=withoutBom(raw),decoded=withoutBom(body),sent=staticBytes.get(file);
    if(visualClose){
     report.delivery??=[];report.delivery.push({path:u.pathname,status:response.status(),contentType:response.headers()['content-type'],contentEncoding:response.headers()['content-encoding']||'identity',localBytes:raw.length,decodedBytes:body.length,localHash:sha(raw),sentHash:sent?sha(sent):null,decodedHash:sha(body),equivalent:decoded.equals(expected),diskUnchanged:!sent||sent.equals(raw)});
    }
    if(!decoded.equals(expected)||(sent&&!sent.equals(raw))){
     report.resourceMismatches??=[];report.resourceMismatches.push({path:u.pathname,expectedLength:expected.length,receivedLength:body.length});
     await fs.writeFile(path.join(base.output,path.basename(file)+'.received'),body);
    }
   }catch(error){if(visualClose){report.captureErrors??=[];report.captureErrors.push({path:u.pathname,error:error.message});}}})();deliveryTasks.push(task);
  });
  await t.context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(/\.(mp4|webm)$/.test(u.pathname))return route.abort();
   if(visualClose&&u.origin===base.origin&&u.pathname==='/__hourly_resource_probe')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><title>Resource delivery probe</title>'});
   if(u.origin!==base.origin||u.pathname.startsWith('/v1/')||u.pathname.startsWith('/.netlify/'))return route.fallback();
   assert.equal(route.request().method(),'GET');const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));assert(file.startsWith(root+path.sep));
   const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
   try{
    const body=visualClose&&staticBytes.has(file)?staticBytes.get(file):await fs.readFile(file);
    if(visualClose)staticBytes.set(file,body);
    return route.fulfill({body,contentType:types[path.extname(file)]||'application/octet-stream'});
   }catch(e){if(e.code!=='ENOENT')throw e;return route.fulfill({status:404,body:''});}
  });return t.page;
 }
 async function snap(label){await t.page.screenshot({path:path.join(base.output,label+'.png'),fullPage:false});report.screens.push(label+'.png');}
 async function data(){await t.page.locator('[data-services-hourly-cta]:visible').click();await t.page.waitForURL(/#hourly\/datos$/);}
 async function contact(){for(const [k,v]of Object.entries({name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'}))await t.page.locator('#hourly-contact-'+k).fill(v);await t.page.locator('#pixkuy-hourly-legal-acceptance').check();}
 async function review(){await t.page.locator('#hourly-contact-submit').click();await t.page.waitForURL(/#hourly\/revision$/);}
 async function homeEntry(){await t.page.goto(base.origin+'/?lang=es');await t.page.locator('.hero-mobile-entry__action[href*="service=hourly_daily"]').click();}
 async function offer(){await t.page.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);}
 async function deliveryGate(){
  await Promise.all(deliveryTasks);await Promise.all(scriptTasks);
  assert.deepEqual(report.captureErrors||[],[]);assert.deepEqual(report.scriptCaptureErrors||[],[]);
  assert.deepEqual((report.executedSources||[]).filter(row=>!row.equivalent),[]);
  // A discrepant response-body capture stays a failure. Debugger evidence is
  // diagnostic only; it cannot erase a previous resource-delivery discrepancy.
  assert.deepEqual(report.resourceMismatches||[],[]);assert.deepEqual(report.exceptions||[],[]);assert.deepEqual(t.state.errors,[]);
 }
 try{
  if(visualClose){
   const layoutDesktop=process.argv.includes('--layout-desktop'),layoutHourly=process.argv.includes('--layout-hourly');
   const p=await setup(layoutDesktop?1440:390);
   if(process.argv.includes('--first-mount')&&!layoutDesktop){
    const cdp=await t.context.newCDPSession(p);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
   }
   // No product navigation until raw bytes received by fetch, decoded CDP body
   // and syntax independently agree for the historically affected resources.
   await p.goto(base.origin+'/__hourly_resource_probe');report.probes=[];
   for(const rel of ['assets/js/forms/contact-event-special-editor.js','assets/js/forms/direct-transfer-booking-api-checkout.js']){
    const result=await p.evaluate(async rel=>{
     const response=await fetch('/'+rel),bytes=new Uint8Array(await response.arrayBuffer());
     let syntax=true;try{new Function(new TextDecoder().decode(bytes));}catch(e){syntax=e.message;}
     return {status:response.status,contentType:response.headers.get('content-type'),contentEncoding:response.headers.get('content-encoding')||'identity',base64:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')),syntax};
    },rel);
    const bytes=Buffer.from(result.base64,'base64'),local=await fs.readFile(path.join(root,rel));delete result.base64;
    report.probes.push({path:rel,...result,bytes:bytes.length,hash:sha(bytes),matchesDisk:bytes.equals(local)});
    assert.equal(result.status,200);assert(bytes.equals(local));assert.equal(result.syntax,true);
   }
   await deliveryGate();report.checks.push('preflight: local/fulfilled/fetch raw/CDP decoded/syntax agree');
   if(process.argv.includes('--pending-layout')){
    const fullDay={...draft,hourly_daily_mode:'full_day',hourly_daily_duration_hours:12,hourly_daily_passengers:4,hourly_daily_price:600000,
     customer:{full_name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'},
     legal_acceptance_accepted:'true',legal_acceptance_accepted_at:'2026-10-16T08:00:00.000Z',legal_acceptance_channel:'web_hourly_checkout',
     legal_acceptance_terms_version:'terms_v1_2026_05',legal_acceptance_cancellation_policy_version:'cancellation_policy_v1_2026_05',legal_acceptance_privacy_version:'privacy_v1_2026_05',
     legal_acceptance_terms_url:'legal/terms.html',legal_acceptance_cancellations_url:'legal/cancellations.html',legal_acceptance_privacy_url:'legal/privacy.html'};
    if(layoutHourly)Object.assign(fullDay,{hourly_daily_mode:'hourly',hourly_daily_duration_hours:2});
    t.state.draft=fullDay;t.state.amount=600000;t.state.models=[{...base.model,passengersSupported:4}];
    let holdPrecheck=false;const heldPrechecks=[];
    await t.context.route('**/hourly-availability-precheck',async route=>{
     if(holdPrecheck)await new Promise(resolve=>heldPrechecks.push(resolve));
     return route.fallback();
    });
    const expiresAt=new Date(Date.now()+1800000).toISOString();
    await t.context.route('**/v1/public/reservations/status?*',route=>{
     const body=base.statusBody('hourly_daily','pending',fullDay);body.hold.expiresAt=expiresAt;
     Object.assign(body.reservation,{hourlyMode:fullDay.hourly_daily_mode,durationHours:fullDay.hourly_daily_duration_hours,passengerCount:4,passengerLabel:'3–4',serviceEndLocalTime:layoutHourly?'01:00':'11:00'});
     t.state.requests.push({kind:'status',mode:'pending-layout'});return route.fulfill({json:body});
    });
    await t.context.addInitScript(()=>{
     window.__routeTrace=[];for(const method of ['pushState','replaceState']){const fn=history[method];history[method]=function(...args){window.__routeTrace.push({method,url:String(args[2]),stack:new Error().stack});return fn.apply(this,args);};}
    });
    const pendingUrl=base.origin+'/booking-cancelled.html?token=synthetic-pending-layout&lang=es';
    const serviceAction=()=>p.locator(layoutDesktop?'.hourly-booking .airport-booking__identity button':'[data-booking-cancelled-modify-service]:visible');
    const contactAction=()=>layoutDesktop?p.getByRole('button',{name:'Modificar datos',exact:true}):p.locator('[data-booking-cancelled-modify]:visible');
    async function pending(){await p.goto(pendingUrl);await serviceAction().waitFor();await p.locator('[data-consent-reject]').click({timeout:600}).catch(()=>{});}
    async function record(label){
     await deliveryGate();await snap(label);await p.screenshot({path:path.join(base.output,label+'-full.png'),fullPage:true});
     const state=await p.evaluate(()=>{
      const rect=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {x:r.x,y:r.y,width:r.width,height:r.height,font:c.font,position:c.position,display:c.display};};
      return {hash:location.hash,scrollY,active:document.activeElement?.outerHTML.slice(0,350),body:document.body.className,attrs:[...document.body.attributes].map(a=>[a.name,a.value]),
       logo:rect('.mobile-topbar__brand'),logoImage:rect('.mobile-topbar__brand img'),header:rect('.mobile-topbar'),phone:rect('#hourly-contact-phone'),name:rect('#hourly-contact-name'),mount:rect('.hourly-booking'),
       touch:matchMedia('(pointer:coarse)').matches,offerValid:window.PixkuyFleetSelection.hourlyOfferStatus().valid,
       pickup:rect('[data-place-input="hourly_daily_pickup"]'),text:document.querySelector('.hourly-booking')?.innerText,
       pendingMeta:!!document.querySelector('.hourly-booking__summary--mobile .hourly-booking__pending-meta'),
       edit:window.PixkuyFleetSelection.hourlyEdit(),draft:window.PixkuyHourlyBookingDraft.read(),trace:window.__routeTrace};
     });report.layouts??=[];report.layouts.push({label,...state});return state;
    }
    await pending();await snap('pending-actions');
    await serviceAction().click();await p.waitForURL(/#hourly\/servicio$/);await offer();
    const config=await record('service-final');assert.equal(config.hash,'#hourly/servicio');assert(config.pickup.height>0);assert.equal(config.edit.contactOnly,false);
    assert(await p.locator('#hourly-contact-name').isHidden());assert(await p.locator('[data-services-hourly-date]:visible').isEditable());
    await data();await offer();await record('service-data-first');await review();await record('service-review');
    await pending();holdPrecheck=process.argv.includes('--first-mount');
    await contactAction().click();await p.waitForURL(/#hourly\/datos$/);
    if(holdPrecheck){
     try{await p.locator('#hourly-contact-name').waitFor();await record('contact-data-initial-unverified');}
     finally{holdPrecheck=false;heldPrechecks.splice(0).forEach(resolve=>resolve());}
    }
    await offer();
    const first=await record('contact-data-first');assert.equal(first.hash,'#hourly/datos');assert.equal(first.edit.contactOnly,true);
    assert(await p.locator('[data-place-input="hourly_daily_pickup"]').isHidden());
    await p.reload();await p.locator('#hourly-contact-name').waitFor();await offer();const reloaded=await record('contact-data-reload');
    assert(await p.locator('#pixkuy-hourly-legal-acceptance').isChecked());await review();const reviewed=await record('contact-review');
    for(const row of report.layouts){assert.equal(row.edit.expiresAt,expiresAt);assert.equal(row.edit.token,'synthetic-pending-layout');assert.equal(row.draft.hourly_daily_mode,fullDay.hourly_daily_mode);assert.equal(Number(row.draft.hourly_daily_passengers),4);assert.equal(row.draft.name,'Persona Sintética');assert.equal(row.draft.legal_acceptance_accepted_at,fullDay.legal_acceptance_accepted_at);if(!before&&row.text){assert(!row.text.includes('Cancelar edición'));if(!layoutDesktop)assert(row.pendingMeta);}}
    assert.equal(t.state.requests.filter(r=>['checkout','replace-checkout','retry-checkout'].includes(r.kind)).length,0);
    if(!before){assert.equal(first.phone.width,reloaded.phone.width);if(!layoutDesktop){assert(first.logo.y>=0&&reloaded.logo.y>=0);
     const initial=report.layouts.find(row=>row.label==='contact-data-initial-unverified');
     if(initial){assert.equal(initial.offerValid,false);assert.equal(initial.phone.width,reloaded.phone.width);assert.equal(initial.logo.y,reloaded.logo.y);assert.equal(initial.header.height,reloaded.header.height);assert(initial.touch);}
     await p.locator('.hourly-booking .hourly-mobile-flow__back').click();await p.waitForURL(/#hourly\/datos$/);
     await p.locator('.hourly-booking .hourly-mobile-flow__back').click();await p.waitForURL(/#hourly\/servicio$/);await offer();
     await p.locator('[data-hourly-mobile-flow-back]:visible').click();await p.waitForURL(/booking-cancelled/);await p.locator('[data-booking-cancelled-modify-service]:visible').waitFor();
     assert.equal(new URL(p.url()).searchParams.get('token'),'synthetic-pending-layout');await deliveryGate();
    }}
    report.checks.push(fullDay.hourly_daily_mode+' '+(layoutDesktop?'desktop':'mobile')+' real labeled actions/final visible config/data/F5/review; original identity/deadline/contact/consent; zero writes');report.result='PASS';return;
   }
   t.state.draft={...draft,customer:{full_name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'}};
   const pendingUrl=base.origin+'/booking-cancelled.html?token=synthetic-visual-close&lang=es';
   await p.goto(pendingUrl);await p.locator('[data-booking-cancelled-modify-service]:visible').waitFor();
   await p.locator('[data-consent-reject]').click({timeout:600}).catch(()=>{});
   await deliveryGate();
   report.actions=await p.locator('[data-booking-cancelled-mobile] [data-booking-cancelled-modify-service], [data-booking-cancelled-mobile] [data-booking-cancelled-modify]').evaluateAll(nodes=>nodes.map(n=>{
    const c=getComputedStyle(n),r=n.getBoundingClientRect();return {text:n.textContent,parent:n.parentNode.className,x:r.x,y:r.y,width:r.width,height:r.height,fontSize:c.fontSize,fontWeight:c.fontWeight,border:c.border,borderRadius:c.borderRadius,disabled:n.disabled,clipped:n.scrollWidth>n.clientWidth,focusVisibleRule:!!n.matches(':focus-visible')};
   }));
   assert.equal(report.actions.length,2);for(const a of report.actions){assert(a.parent.includes('airport-return__payment-actions'));assert(!a.disabled&&!a.clipped);assert(a.height>=44);}
   for(const key of ['fontSize','fontWeight','border','borderRadius','width'])assert.equal(report.actions[0][key],report.actions[1][key]);
   await snap('final-mobile-actions');await p.screenshot({path:path.join(base.output,'final-mobile-actions-full.png'),fullPage:true});
   await p.locator('[data-booking-cancelled-modify-service]:visible').click();await p.waitForURL(/#hourly\/servicio$/);await offer();await deliveryGate();
   assert.equal(await p.locator('[data-place-input="hourly_daily_pickup"]:visible').inputValue(),draft.hourly_daily_pickup);await snap('service-destination');
   await p.goto(pendingUrl);await p.locator('[data-booking-cancelled-modify]:visible').click();await p.waitForURL(/#hourly\/datos$/);await offer();await deliveryGate();
   assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Persona Sintética');
   await p.reload();await p.locator('#hourly-contact-name').waitFor();await offer();await deliveryGate();
   assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Persona Sintética');await snap('contact-restored');
   await p.locator('.hourly-booking .hourly-mobile-flow__back').click();await p.waitForURL(/#hourly\/servicio$/);await offer();await deliveryGate();
   assert.equal(await p.locator('[data-place-input="hourly_daily_pickup"]:visible').inputValue(),draft.hourly_daily_pickup);
   assert.equal(t.state.requests.filter(r=>['checkout','replace-checkout','retry-checkout'].includes(r.kind)).length,0);
   report.checks.push('final two secondary actions: same group/style, unclipped, correct config/contact destinations','contact F5 and Back restore existing synthetic reservation; no checkout');report.result='PASS';return;
  }
  // Actual blur/input events on the canonical form, including the desktop consumer.
  let p;
  if(!process.argv.includes('--remaining')&&!process.argv.includes('--draft-only')){
  for(const width of process.argv.includes('--known-only')?[]:[390,1440]){
   const p=await setup(width);await base.enter(t);await data();
   await p.locator('#hourly-contact-name').fill('Persona Sintética');await p.locator('#hourly-contact-phone').focus();
   for(const key of ['phone','email'])assert(await p.locator('#hourly-contact-'+key+'-error').isHidden());
   assert(await p.locator('#hourly-contact-submit').isDisabled());await snap('name-blur-'+width);
   await p.locator('#hourly-contact-phone').fill('12');await p.locator('#hourly-contact-email').focus();
   assert(await p.locator('#hourly-contact-phone-error').isVisible());assert(await p.locator('#hourly-contact-email-error').isHidden());
   await p.reload();await p.locator('#hourly-contact-name').waitFor();
   assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Persona Sintética');
   for(const key of ['name','phone','email'])assert(await p.locator('#hourly-contact-'+key+'-error').isHidden());
   assert(await p.locator('#hourly-contact-submit').isDisabled());
   assert.equal(await p.evaluate(()=>window.PixkuyHourlyBookingForm.refreshReservationRequestValidationUX()),false);
   assert(await p.locator('#hourly-contact-email-error').isVisible());
   await contact();await p.locator('#pixkuy-hourly-legal-acceptance').uncheck();assert(await p.locator('#hourly-contact-submit').isDisabled());
   await p.reload();await p.locator('#hourly-contact-name').waitFor();assert.equal(await p.locator('#pixkuy-hourly-legal-acceptance').isChecked(),false);
   await offer();await p.locator('#pixkuy-hourly-legal-acceptance').check();await review();
   report.checks.push('contact blur/touched/full validation/F5/consent '+width);
  }
  // Known reservation is generated only by captured checkout, never an injected callback.
  p=await setup();await base.enter(t);await data();await contact();await review();
  await p.locator('[data-hourly-pay]').click();await p.waitForURL(/checkout\.stripe\.com/);
  const original=structuredClone(t.state.draft),writes=t.state.requests.filter(r=>r.kind==='checkout').length;
  const pendingUrl=base.origin+'/booking-cancelled.html?token=synthetic-audit-hourly_daily&lang=es';
  await p.setViewportSize({width:1440,height:844});await p.goto(base.origin+'/?lang=es#services');
  await p.locator('[data-service-expand-trigger="hourly"]').click();await p.waitForURL(/booking-cancelled/);
  assert.equal(new URL(p.url()).searchParams.get('lang'),'es');await p.setViewportSize({width:390,height:844});
  await homeEntry();await p.waitForURL(/booking-cancelled/);await p.locator('[data-booking-cancelled-modify-service]:visible').waitFor();await snap('home-known-reservation');
  await p.goto(pendingUrl);await p.locator('[data-booking-cancelled-modify-service]:visible').waitFor();await snap('pending-mobile-actions');
  assert.equal(await p.locator('[data-booking-cancelled-modify]:visible').innerText(),'Modificar datos de contacto');
  await p.locator('[data-booking-cancelled-modify-service]:visible').click();await p.waitForURL(/#hourly\/servicio$/);await snap('pending-service-config');
  await p.reload();await offer();await data();assert(await p.locator('#pixkuy-hourly-legal-acceptance').isChecked());
  await p.goto(pendingUrl);await p.locator('[data-booking-cancelled-modify]:visible').click();await p.waitForURL(/#hourly\/datos$/);await offer();
  await p.locator('#hourly-contact-name').fill('Nombre conservado');await p.reload();await p.locator('#hourly-contact-name').waitFor();
  assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Nombre conservado');
  await p.locator('.hourly-booking .hourly-mobile-flow__back').click();await p.waitForURL(/#hourly\/servicio$/);await offer();await data();
  assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Nombre conservado');assert(await p.locator('#pixkuy-hourly-legal-acceptance').isChecked());
  await p.goto(pendingUrl);await homeEntry();await p.waitForURL(/#hourly\/datos$/);await offer();assert.equal(await p.locator('#hourly-contact-name').inputValue(),'Nombre conservado');
  assert.equal(t.state.requests.filter(r=>r.kind==='checkout').length,writes);assert.deepEqual(t.state.draft,original);
  report.checks.push('known reservation from Home; separate mobile service/contact actions; config/data F5 and Back; no new checkout');
  if(process.argv.includes('--known-only')){report.errors.push(...t.state.errors);assert.deepEqual(t.state.errors,[]);assert.deepEqual(report.resourceMismatches||[],[]);report.result='PASS';return;}
  }
  // Real failed transport leaves a frozen attempt; Home must recover its mode/key.
  if(!process.argv.includes('--draft-only')){
  p=await setup();await base.enter(t);await data();await contact();await review();t.state.checkout='lost';
  await p.locator('[data-hourly-pay]').click();await p.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).waitFor();
  const sent=t.state.requests.find(r=>r.kind==='checkout');assert(sent);
  await homeEntry();await p.waitForURL(/#hourly\/revision$/);await snap('home-uncertain-original-mode');
  assert((await p.locator('.hourly-booking').innerText()).includes('Origen sintético'));
  assert(await p.locator('[data-hourly-pay]').isDisabled());assert.equal(await p.locator('[data-fleet-selection="hourly_daily"]').count(),0);
  const rejected=await p.evaluate(async()=>{try{await window.PixkuyFleetSelection.fetchPrecheck('hourly_daily','/v1/public/reservations/hourly-availability-precheck',{method:'POST',body:JSON.stringify({hourly_daily_mode:'full_day'})});return false;}catch(e){return e.message;}});
  assert.equal(rejected,'FLEET_ATTEMPT_RECOVERY_REQUIRED');
  t.state.checkout='success';await p.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).click();await p.waitForURL(/checkout\.stripe\.com/);
  const attempts=t.state.requests.filter(r=>r.kind==='checkout');assert.equal(attempts.length,2);assert.equal(attempts[1].key,sent.key);assert.deepEqual(attempts[1].payload,sent.payload);
  report.checks.push('uncertain recovery preserves original modality/payload/key; foreign precheck rejected; single captured replay');
  }
  // Unsent draft is free to change modality; its offer is freshly certified.
  p=await setup();await base.enter(t);await data();await p.locator('#hourly-contact-name').fill('Borrador');await homeEntry();
  await p.locator('[data-services-hourly-mode="full_day"]').click();await offer();
  assert.equal(t.state.requests.filter(r=>r.kind==='precheck').at(-1).payload.hourly_daily_mode,'full_day');
  await p.waitForFunction(()=>!document.querySelector('[data-services-hourly-cta]').disabled);await snap('draft-full-day');
  report.checks.push('unsent shared draft Home/hourly/full_day: fresh matching precheck');
  // Actual long-term controller sends only to captured HTTP. Full document exit
  // is checked by a document marker; no fake Google badge is manufactured.
  await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
  await p.locator('[data-services-hourly-date]').fill('2027-01-13');await p.locator('[data-services-hourly-date]').dispatchEvent('change');
  await p.locator('[data-services-hourly-time]').fill('23:00');await p.locator('[data-services-hourly-time]').dispatchEvent('change');
  let requests=0;await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,route=>{requests++;return route.fulfill(route.request().url().endsWith('/recover')?{status:404,json:{code:'REQUEST_NOT_FOUND'}}:{json:{receipt:{state:'received',reference:'PL-CONTROLLED-MOBILE',receivedAt:new Date().toISOString()}}});});
  await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#long-term\/datos$/);
  for(const[k,v]of Object.entries({name:'Persona Sintética',phone:'+525512345678',email:'audit@example.invalid'}))await p.locator('#long-term-'+k).fill(v);
  await p.locator('#long-term-consent').check();await p.locator('.long-term-request [type="submit"]').click();await p.getByRole('button',{name:'Volver al inicio',exact:true}).waitFor();await snap('long-term-received');
  const saved=await p.evaluate(()=>({receipt:sessionStorage.getItem('pixkuy_long_term_request_v1'),hourly:sessionStorage.getItem('pixkuy_hourly_checkout_review_snapshot'),lang:document.documentElement.lang}));
  if(process.argv.includes('--draft-only'))assert.equal(await p.locator('script[src*="recaptcha/enterprise.js"]').count(),1);
  await p.evaluate(()=>window.__requestDocument=true);await p.getByRole('button',{name:'Volver al inicio',exact:true}).click();await p.waitForURL(u=>u.hash===''&&!u.searchParams.has('service'));
  await p.waitForFunction(()=>window.PixkuyLongTermRequest);
  assert.equal(await p.evaluate(()=>window.__requestDocument),undefined);assert.equal(requests,2);
  assert.equal(await p.locator('script[src*="recaptcha/enterprise.js"]').count(),0);
  const restored=await p.evaluate(()=>({receipt:sessionStorage.getItem('pixkuy_long_term_request_v1'),hourly:sessionStorage.getItem('pixkuy_hourly_checkout_review_snapshot'),lang:document.documentElement.lang}));assert.deepEqual(restored,saved);await snap('long-term-document-home');
  await p.reload();assert.equal(requests,2);report.checks.push('long-term receipt/home uses new document; locale and independent draft retained; no resend');
  for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
   const dict=JSON.parse(await fs.readFile(path.join(root,'assets/i18n',lang,'booking-status.json'),'utf8'));
   for(const key of ['modifyService','modifyContact'])assert(dict.bookingStatus.cancelled.actions[key]?.trim());
  }report.checks.push('nine translation catalogs');
  report.errors.push(...t.state.errors);assert.deepEqual(t.state.errors,[]);assert.deepEqual(report.resourceMismatches||[],[]);report.result='PASS';
 }catch(e){report.result='FAIL';report.error=e.stack;report.url=t?.page.url();if(t)await snap('failure').catch(()=>{});throw e;}
 finally{clearTimeout(timer);await Promise.all(deliveryTasks);await Promise.all(scriptTasks);report.errors.push(...(t?.state.errors||[]));report.requests=t?.state.requests;await fs.writeFile(path.join(base.output,'mobile-lot.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(base.output,'resources.json'),JSON.stringify([...base.resources],null,2));await browser.close();console.log(JSON.stringify({result:report.result,checks:report.checks,error:report.error}));}
}
// Focused unsent Data reload. Real document/controllers; only static delivery,
// Places selection and HTTP are controlled. No checkout endpoint is permitted.
async function dataReload(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);
 const report={transport:'offline captured',before,rows:[]},timer=setTimeout(()=>browser.close(),180000);let current;
 try{for(const width of (before?[390]:[390,1440]))for(const mode of ['hourly','full_day']){
  const only=process.argv.find(v=>v.startsWith('--reload-case='))?.split('=')[1];if(only&&only!==mode+'-'+width)continue;
  const t=await base.setup(width,'hourly_daily'),p=t.page,row={width,mode,requests:[],checks:[]};report.rows.push(row);
  current=t;row.errors=t.state.errors;
  let hold=false,configHold=false,configRelease,technical=false;const pending=[];
  t.state.models=[{...base.model,passengersSupported:4}];
  await t.context.addInitScript(()=>{
   window.__reloadPrechecks=[];let api;
   Object.defineProperty(window,'PixkuyHourlyAvailabilityPrecheck',{configurable:true,get:()=>api,set:value=>{
    api=value;const original=value.precheck;
    value.precheck=function(detail,options){
     const entry={mode:detail.hourly_daily_mode,duration:detail.hourly_daily_duration_hours,at:performance.now(),caller:new Error().stack};window.__reloadPrechecks.push(entry);
     return original.call(this,detail,options).then(result=>{entry.result={code:result.code,available:result.available,ok:result.ok,http:result.statusCode};entry.completedAt=performance.now();return result;});
    };
   }});
  });
  await t.context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(/\.(mp4|webm)$/.test(u.pathname))return route.abort();
   if(u.origin!==base.origin||u.pathname.startsWith('/v1/')||u.pathname.startsWith('/.netlify/'))return route.fallback();
   assert.equal(route.request().method(),'GET');const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));assert(file.startsWith(root+path.sep));
   const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
   let body;
   try{
    const preimage=process.env.PIXKUY_HOURLY_PRECHECK_PREIMAGE;
    if(before&&preimage){try{body=await fs.readFile(path.join(preimage,path.relative(root,file)));}catch(e){if(e.code!=='ENOENT')throw e;}}
    body=body||await fs.readFile(file);return route.fulfill({body,contentType:types[path.extname(file)]||'application/octet-stream'});
   }catch(e){if(e.code!=='ENOENT')throw e;return route.fulfill({status:404,body:''});}
  });
  await t.context.route('**/.netlify/functions/booking-public-config',async route=>{
   if(configHold)await new Promise(resolve=>configRelease=resolve);
   return route.fulfill({json:{ok:true,bookingApi:{apiBaseUrl:base.origin},publicSite:{siteKey:'offline-site'}}});
  });
  await t.context.route('**/v1/public/reservations/**',async route=>{
   const u=new URL(route.request().url());assert(u.pathname.endsWith('/hourly-availability-precheck'),'No business operations allowed');
   const payload=route.request().postDataJSON(),entry={payload,http:technical?503:200};row.requests.push(entry);
   if(hold)await new Promise(resolve=>pending.push(resolve));
   if(technical)return route.fulfill({status:503,json:{code:'FLEET_AVAILABILITY_UNDETERMINED'}});
   return route.fallback();
  });
  await base.enter(t);
  if(mode==='full_day')await p.locator('[data-services-hourly-mode="full_day"]').click();
  else if(width<=720)await p.locator('[data-hourly-mobile-duration-select]').selectOption('8');
  else await p.locator('[data-services-hourly-duration="8"]').click();
  await p.locator('[data-services-hourly-date]').fill('2027-01-29');await p.locator('[data-services-hourly-time]').fill('21:48');
  await p.locator('[data-fleet-hourly-passengers]').selectOption('4');
  await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
  await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#hourly\/datos$/);
  await p.locator('#hourly-contact-name').fill('Persona Sintética');await p.locator('#hourly-contact-phone').fill('+525512345678');await p.locator('#hourly-contact-email').fill('reload@example.invalid');
  await p.locator('#pixkuy-hourly-legal-acceptance').check();
  await p.waitForFunction(()=>!document.querySelector('#hourly-contact-submit').disabled);
  const read=()=>p.evaluate(()=>({hash:location.hash,notice:document.querySelector('.hourly-booking__notice')?.textContent||'',disabled:document.querySelector('#hourly-contact-submit')?.disabled,
   fresh:window.PixkuyFleetSelection.hourlyOfferStatus().valid,draft:window.PixkuyHourlyCheckout.draft(),consent:document.querySelector('#pixkuy-hourly-legal-acceptance')?.checked}));
  row.initial=await read();let start=row.requests.length;hold=true;configHold=before;
  await p.reload({waitUntil:'domcontentloaded'});await p.locator('#hourly-contact-submit').waitFor();
  // Let the existing 350ms panel debounce fire while transport is held. This is
  // a test schedule, not a product delay or retry.
  await p.waitForTimeout(600);row.loading=await read();row.reloadRequests=row.requests.slice(start);
  if(before){configHold=false;configRelease();await p.waitForTimeout(100);row.reloadRequests=row.requests.slice(start);}
  hold=false;for(const release of pending.splice(0))release();
  await p.waitForTimeout(250);row.reloaded=await read();row.reloadTrace=await p.evaluate(()=>window.__reloadPrechecks);
  await p.screenshot({path:path.join(base.output,mode+'-'+width+'-reload.png'),fullPage:false});
  if(!before){
   assert.equal(row.reloadRequests.length,1,'one owner for restored availability');assert.match(row.loading.notice,/Comprobando/);assert(row.loading.disabled);
   assert(row.reloaded.fresh);assert.equal(row.reloaded.notice,'');assert.equal(row.reloaded.disabled,false);assert(row.reloaded.consent);
   for(const key of Object.keys(row.initial.draft).filter(k=>/^(name|phone|email|hourly_daily_|legal_acceptance_|fleet_)/.test(k)))
    assert.deepEqual(row.reloaded.draft[key],row.initial.draft[key],key);
   row.checks.push('reload single request; data, consent and valid gate restored');
   start=row.requests.length;configHold=true;hold=true;
   await p.reload({waitUntil:'domcontentloaded'});await p.locator('#hourly-contact-submit').waitFor();await p.waitForTimeout(600);
   assert.equal(row.requests.length,start);assert.match((await read()).notice,/Comprobando/);
   configHold=false;configRelease();await p.waitForTimeout(100);assert.equal(row.requests.length,start+1);hold=false;for(const release of pending.splice(0))release();
   await p.waitForFunction(()=>!document.querySelector('#hourly-contact-submit').disabled);assert.equal((await read()).notice,'');
   row.lateTrace=await p.evaluate(()=>window.__reloadPrechecks);
   assert.equal(row.lateTrace.length,1,'Data owns the initial revalidation');row.checks.push('late runtime config waits, one request');
   technical=true;start=row.requests.length;await p.reload({waitUntil:'domcontentloaded'});
   const retry=p.getByRole('button',{name:/Volver a comprobar|Comprobar de nuevo|Check again/});await retry.waitFor();await p.waitForTimeout(600);
   assert.equal(row.requests.length,start+1);assert((await read()).disabled);assert((await read()).consent);
   technical=false;await retry.click();await p.waitForFunction(()=>!document.querySelector('#hourly-contact-submit').disabled);row.checks.push('persistent failure stays blocked without automatic retry; explicit recovery');
   hold=true;await p.reload({waitUntil:'domcontentloaded'});await p.locator('#hourly-contact-submit').waitFor();
   await p.waitForTimeout(100);assert.equal(pending.length,1);const oldResponse=pending.shift();hold=false;
   await p.locator(width<=720?'.hourly-booking .hourly-mobile-flow__back':'.hourly-booking .airport-booking__identity button').click();await p.waitForURL(/#hourly\/servicio$/);
   await p.locator('[data-services-hourly-time]').fill('22:18');await p.locator('[data-services-hourly-time]').dispatchEvent('change');
   await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
   oldResponse();await p.waitForTimeout(150);
   const current=await p.evaluate(()=>window.PixkuyFleetSelection.read('hourly_daily').precheck.payload);
   assert.equal(current.hourly_daily_start_time,'22:18');assert.equal(current.hourly_daily_mode,mode);
   await p.locator('[data-services-hourly-cta]:visible').click();await p.waitForURL(/#hourly\/datos$/);
   await p.waitForFunction(()=>!document.querySelector('#hourly-contact-submit').disabled);
   const final=await read();assert.equal(final.notice,'');assert(final.consent);assert.equal(final.draft.hourly_daily_start_time,'22:18');
   for(const key of ['name','phone','email','hourly_daily_notes'])assert.equal(final.draft[key],row.initial.draft[key]);
   row.checks.push('Back revalidates changed trip; late restored response cannot replace current offer');
  }
  assert.deepEqual(t.state.errors,[]);row.errors=t.state.errors;row.result=before?'OBSERVED':'PASS';await t.context.close();
 }}catch(e){report.error=e.stack;report.diagnostic=await current?.page.evaluate(()=>({hash:location.hash,trace:window.__reloadPrechecks,
  fields:Array.from(document.querySelectorAll('[data-services-hourly-config] input,[data-services-hourly-config] select')).map(n=>({type:n.type,value:n.value})),
  state:window.PixkuyFleetSelection?.hourlyOfferStatus()})).catch(()=>null);throw e;
 }finally{clearTimeout(timer);await fs.writeFile(path.join(base.output,'reload-result.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({result:before?'OBSERVED':'PASS',cases:report.rows.map(r=>({mode:r.mode,width:r.width,requests:r.reloadRequests.length,notice:r.reloaded.notice,checks:r.checks}))}));
}
(process.argv.includes('--data-reload')?dataReload():process.argv.includes('--mobile-lot')?mobileLot():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
