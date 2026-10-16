'use strict';
// Existing Direct runner + isolated Chrome. Every request is intercepted;
// no local server, production, reservation writer or Stripe is contacted.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs'),direct=require('./direct-desktop-regression.cjs');
const root=path.resolve(__dirname,'..'),token='controlled-direct',revision='2026-10-14T10:00:00.000Z';
async function serve(t){
  await t.context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/.netlify/')||u.hostname==='checkout.stripe.com'||u.hostname==='unpkg.com'&&u.pathname.includes('libphonenumber'))return route.fallback();
   if(u.origin!==direct.origin||/\.(mp4|webm)$/.test(u.pathname))return route.abort();
   assert.equal(route.request().method(),'GET');const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
   assert(file.startsWith(root+path.sep));const types={'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
   try{return route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)]||'application/octet-stream'});}
   catch(e){if(e.code!=='ENOENT')throw e;return route.fulfill({status:404,body:''});}
  });
}
async function run(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();let t;const report={transport:'captured only; no network',checks:[],shots:[]};
 const timer=setTimeout(()=>browser.close(),90000);
 try{
  t=await direct.setup(browser,{});const p=t.page;
  await serve(t);
  await t.context.route('**/v1/public/reservations/update-contact',route=>{
   const request=route.request(),payload=request.postDataJSON(),pathname=new URL(request.url()).pathname;
   t.state.requests.push({path:pathname,method:request.method(),payload});
   t.state.writes.push({path:pathname,payload,key:request.headers()['idempotency-key']});
   return route.fulfill({json:{...direct.contactResponse(t.state,payload),status:'ok',editRevision:revision}});
  });
  // Obtain valid legal evidence using the actual legal component, then represent
  // the already committed reservation in the status transport, not a DOM callback.
  await direct.enter(t);await p.locator('[data-direct-transfer-panel-cta]').click();await direct.contact(t);
  const saved=await p.evaluate(()=>window.PixkuyDirectTransferTransactionalState.buildSnapshot(window.PixkuyDirectBookingForm.getReservationForm(),window.PixkuyDirectBookingForm.getReservationRequestData()));
  t.state.draft={...saved,customer:{full_name:saved.name,phone:saved.phone,email:saved.email},direct_transfer_amount_minor:80000};
  await t.context.route('**/v1/public/reservations/status?*',route=>{
   const body=base.statusBody('direct_transfer','pending',t.state.draft);body.edit={allowed:true,revision,draft:t.state.draft};body.hold.expiresAt=t.state.expiresAt;body.actions.canModify=true;body.contactUpdatePending=false;
   body.payment.amountExpected=80000;Object.assign(body.reservation,{pickupAddress:t.state.draft.direct_transfer_origin_address,destinationAddress:t.state.draft.direct_transfer_destination_address,serviceStartLocalDate:t.state.draft.direct_transfer_date,serviceStartLocalTime:t.state.draft.direct_transfer_time,vehiclePhotoUrl:direct.model.photoUrl});
   return route.fulfill({json:body});
  });
  await p.evaluate(({token,saved})=>sessionStorage.setItem('pixkuy_fleet_b:direct_transfer',JSON.stringify({version:1,reservationToken:token,attempt:{state:'committed',key:'previous-completed',payload:saved,response:{status:'ok',bookingStatusToken:token,checkoutUrl:'https://checkout.stripe.com/c/pay/previous'}},selected:null,offer:null})),{token,saved});
  const pending=async()=>{await p.goto(direct.origin+'/booking-cancelled.html?token='+token+'&lang=es');await p.locator('.airport-booking--result').waitFor();};
  // Keep the fixture's current trip/price consistent with the projected status.
  t.state.draft.fleet_model={id:direct.model.modelId,name:direct.model.name,revision:direct.model.modelRevision};
  await pending();report.shots.push(await direct.shot(t,base.output,'pending-actions'));
  await p.getByRole('button',{name:'Modificar traslado',exact:true}).click();await p.waitForURL(/#direct\/servicio$/);await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  assert.equal(t.state.writes.length,0);await pending();
  await p.getByRole('button',{name:'Volver al traslado',exact:true}).click();await p.waitForURL(/#direct\/servicio$/);await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  assert.equal(t.state.writes.length,0);report.checks.push('pending trip action and header both open editable configuration without writes');
  report.accessRequests=t.state.requests.splice(0); // Separate bounded access phase; retain every captured request.
  await p.locator('[data-direct-transfer-panel-cta]:enabled').click();await p.waitForURL(/#direct\/datos$/);
  await p.locator('#direct-booking-form button[type=submit]:enabled').click();await p.waitForURL(/direct-transfer-checkout-review/);
  await p.locator('[data-direct-transfer-checkout-review-proceed]:enabled').click();await p.waitForURL(/checkout\.stripe\.com/);
  assert.equal(t.state.writes.length,1);assert(t.state.writes[0].path.endsWith('/update-contact'));
  report.unchangedWrites=t.state.writes.splice(0);report.unchangedRequests=t.state.requests.splice(0);
  report.checks.push('configuration without trip changes uses existing update-contact; no replacement');
  await pending();
  await p.getByRole('button',{name:'Modificar datos de contacto',exact:true}).click();await p.waitForURL(/#direct\/datos$/);
  await p.waitForFunction(()=>!document.querySelector('#direct-booking-form button[type=submit]').disabled);
  await p.locator('#pixkuy-direct-transfer-legal-acceptance').uncheck();await p.reload();
  await p.locator('#direct-contact-name').waitFor();
  assert.equal(await p.locator('#pixkuy-direct-transfer-legal-acceptance').isChecked(),false);
  assert.equal(await p.locator('#direct-booking-form button[type=submit]').isDisabled(),true);
  await p.locator('#pixkuy-direct-transfer-legal-acceptance').check();await p.locator('#direct-booking-form button[type=submit]:enabled').waitFor();
  report.checks.push('explicit consent revocation survives F5 and blocks review; new gesture restores permission');
  await p.locator('#direct-contact-name').fill('Persona editada');
  await p.locator('.direct-booking .airport-booking__progress li:first-child button').click();
  await p.waitForURL(/#direct\/servicio$/);await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  assert.equal(t.state.writes.length,0);report.checks.push('pending contact → first step → configuration; no writes');
  await p.reload();await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  report.shots.push(await direct.shot(t,base.output,'configuration'));
  // Real panel restoration boundary, with another canonical Places selection.
  const changed={...saved,direct_transfer_destination_address:'Destino modificado — Roma',direct_transfer_destination_place_id:'controlled-new-destination'};
  await p.evaluate(v=>window.PixkuyDirectTransferPanel.restore(v),changed);
  await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  await p.reload();await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  assert.equal(await p.locator('[data-direct-transfer-panel-address-input=destination]').inputValue(),changed.direct_transfer_destination_address);
  await p.screenshot({path:path.join(base.output,'configuration-arrival.png'),fullPage:false});
  const rect=await p.locator('#services-expand-direct h3').boundingBox();assert(rect.y>=40&&rect.y+rect.height<400,'complete heading below header');
  await p.locator('[data-direct-transfer-panel-cta]:enabled').click();await p.waitForURL(/#direct\/datos$/);
  assert.equal(await p.locator('#direct-contact-name').inputValue(),'Persona editada');
  assert.equal(await p.locator('#pixkuy-direct-transfer-legal-acceptance').isChecked(),true);
  await p.reload();await p.locator('#direct-booking-form button[type=submit]:enabled').waitFor();
  assert.equal(await p.locator('#pixkuy-direct-transfer-legal-acceptance').isChecked(),true);
  report.shots.push(await direct.shot(t,base.output,'data-restored'));
  await p.locator('#direct-booking-form button[type=submit]').click();await p.waitForURL(/direct-transfer-checkout-review/);await p.locator('[data-direct-desktop-review]').waitFor();
  assert((await p.locator('[data-direct-desktop-review]').innerText()).includes('Destino modificado'));
  report.shots.push(await direct.shot(t,base.output,'review'));
  await p.locator('[data-direct-transfer-checkout-review-proceed]').click();await p.waitForURL(/checkout\.stripe\.com/);
  assert.equal(t.state.writes.length,1);assert(t.state.writes[0].path.endsWith('/replace-checkout'));assert.equal(t.state.writes[0].payload.direct_transfer_destination.place_id,'controlled-new-destination');
  report.checks.push('change route → F5 Data → Review → one captured replacement');
  const prechecks=t.state.requests.filter(r=>r.path.endsWith('availability-precheck')&&r.payload.pending_edit);
  assert(prechecks.length);for(const r of prechecks)assert.deepEqual(r.payload.pending_edit,{token,editRevision:revision});
  report.checks.push('own-reservation authorization carried on prechecks');
  report.checks.push('F5 Configuration preserves edited location, single controlled arrival');
  // Separate unresolved fixture; it must not be interpreted as the successful
  // receipt above merely because the reservation token is known.
  await p.goto(direct.origin+'/?service=direct_transfer&lang=es#direct/servicio');
  await p.evaluate(()=>{const key='pixkuy_fleet_b:direct_transfer',state=JSON.parse(sessionStorage.getItem(key));state.attempt={state:'unknown',key:'frozen-uncertain',payload:{service_type:'direct_transfer'},url:'/v1/public/reservations/replace-checkout'};sessionStorage.setItem(key,JSON.stringify(state));});
  await p.reload();await p.locator('[data-fleet-selection=direct_transfer]').waitFor();
  assert.equal(await p.locator('[data-direct-transfer-panel-cta]').isDisabled(),true);
  assert(!/Disponibilidad confirmada/.test(await p.locator('#services-expand-direct').innerText()));
  assert.equal(await p.locator('[data-fleet-selection=direct_transfer] legend').count(),0);
  assert.equal(await p.locator('[data-fleet-selection=direct_transfer] button.services-expand__cta').count(),1);
  await p.screenshot({path:path.join(base.output,'uncertain-attempt.png'),fullPage:false});
  report.checks.push('uncertain attempt preserved; no enabled offer or duplicate vehicle title');
  assert.deepEqual(t.state.errors,[]);
  report.desktopRequests=t.state.requests;await t.context.close();
  t=await direct.setup(browser,{width:390});await serve(t);
  t.state.draft={...saved,customer:{full_name:saved.name,phone:saved.phone,email:saved.email},direct_transfer_amount_minor:80000,legal_acceptance_channel:'web_direct_transfer_mobile_checkout'};
  const m=t.page;await m.goto(direct.origin+'/booking-cancelled.html?token='+token+'&lang=es');
  await m.locator('[data-booking-cancelled-modify]:visible').click();await m.waitForURL(/#direct\/datos$/);
  await m.locator('[data-direct-transfer-mobile-contact-submit]:enabled').waitFor();
  await m.reload();await m.locator('[data-direct-transfer-mobile-contact-submit]:enabled').waitFor();
  assert.equal(t.state.writes.length,0);await m.locator('[data-direct-transfer-mobile-contact-back]').click();await m.waitForURL(/booking-cancelled/);
  report.checks.push('mobile shared boundary: pending contact, F5, unchanged return and no writer; not iPhone acceptance');
  assert.deepEqual(t.state.errors,[]);
 }catch(e){report.error=e.stack;if(t)await t.page.screenshot({path:path.join(base.output,'failure.png'),fullPage:true}).catch(()=>{});throw e;}
 finally{if(t){report.requests=t.state.requests;report.errors=t.state.errors;await t.context.close();}clearTimeout(timer);await browser.close();await fs.writeFile(path.join(base.output,'controlled.json'),JSON.stringify(report,null,2));}
}
async function fareOnly(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();let t;const report={transport:'captured, files served from workspace; no network',checks:[]};
 const timer=setTimeout(()=>browser.close(),60000);
 try{
  t=await direct.setup(browser,{});await serve(t);let release;let hold=false;let requests=0;
  await t.context.route('**/.netlify/functions/direct-transfer-quote',r=>r.fulfill({json:{ok:true,quote:{price:9650,currency:'MXN',distanceMeters:386142,durationSeconds:20604,pricingVersion:'controlled-v1'}}}));
  await t.context.route('**/v1/public/reservations/direct-transfer-availability-precheck',async r=>{
   requests++;assert(requests<14);const payload=r.request().postDataJSON();const available=payload.pickupTime==='11:48';
   if(available&&hold)await new Promise(resolve=>{release=resolve;});
   const body=require('./airport-controlled-fixtures.cjs').precheck({...payload,expectedAmountMinor:965000},{models:[direct.model],available,requestNumber:requests});
   Object.assign(body.result.price,{currency:'MXN',durationSeconds:20604,distanceMeters:386142,quoteExpiresAt:new Date(Date.now()+300000).toISOString()});
   if(!available)body.result.availability.nextAvailableStartLocal='2027-01-12T11:48';
   return r.fulfill({json:body});
  });
  await t.context.route(/\/(checkout|replace-checkout|retry-checkout|update-contact)(?:\?|$)/,()=>{throw Error('Writer forbidden');});
  const p=t.page;await p.goto(direct.origin+'/?service=direct_transfer&lang=es#services',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.PixkuyDirectTransferPanel);await p.locator('[data-consent-reject]').click({timeout:700}).catch(()=>{});
  const draft={...direct.draft(),direct_transfer_origin_address:'Four Seasons Hotel Mexico City',direct_transfer_origin_place_id:'controlled-four-seasons',direct_transfer_origin_lat:'19.4232659',direct_transfer_origin_lng:'-99.1743713',direct_transfer_destination_address:'Acapulco de Juárez, Gro.',direct_transfer_destination_place_id:'controlled-acapulco',direct_transfer_destination_lat:'16.8639515',direct_transfer_destination_lng:'-99.8822807',direct_transfer_date:'2027-01-12',direct_transfer_time:'11:37',direct_transfer_passenger_fare_key:'van_3_4',direct_transfer_notes:''};
  await p.evaluate(v=>window.PixkuyDirectTransferPanel.restore(v),draft);
  const status=p.locator('[data-direct-transfer-panel-availability]'),fare=p.locator('.services-direct-transfer-panel__fare'),cta=p.locator('[data-direct-transfer-panel-cta]');
  for(const step of ['first','reload']){
   if(step==='reload')await p.reload({waitUntil:'domcontentloaded'});
   await status.getByRole('link').waitFor();await status.scrollIntoViewIfNeeded();
   const geometry=await fare.evaluate(n=>({hidden:n.hidden,display:getComputedStyle(n).display,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,text:n.innerText}));
   report[step]=geometry;await p.locator('#services-expand-direct').screenshot({path:path.join(base.output,step+'.png')});
   assert(geometry.width>0&&geometry.height>0&&!geometry.hidden,'valid fare must be visible in final composition');assert.match(geometry.text,/9[.,]650/);
   assert(await cta.isDisabled());assert.equal(await p.locator('.services-direct-transfer-panel__vehicle:visible').count(),0);
  }
  hold=true;await status.getByRole('link').click();await p.waitForFunction(()=>document.querySelector('[data-direct-transfer-panel-field="time"]').value==='11:48');
  assert(await cta.isDisabled(),'suggestion cannot enable continuation before revalidation');
  const releaseDeadline=Date.now()+8000;while(!release&&Date.now()<releaseDeadline)await new Promise(r=>setTimeout(r,20));assert(release,'suggestion must issue a new precheck');release();await p.locator('[data-direct-transfer-panel-cta]:enabled').waitFor();
  assert.deepEqual(t.state.errors,[]);assert.equal(t.state.writes.length,0);report.checks=['price visible before and after F5','no confirmed vehicle while unavailable','suggestion waits for captured revalidation'];report.result='PASS';report.requests=requests;
 }catch(e){report.error=e.stack;if(t){report.errors=t.state.errors;report.panel=await t.page.locator('#services-expand-direct').innerText().catch(()=>null);await t.page.screenshot({path:path.join(base.output,'failure.png'),fullPage:true}).catch(()=>{});}throw e;}finally{clearTimeout(timer);if(t)await t.context.close();await browser.close();await fs.writeFile(path.join(base.output,'fare.json'),JSON.stringify(report,null,2));}
}
(process.argv.includes('--fare-only')?fareOnly():run()).catch(e=>{console.error(e);process.exitCode=1;});
