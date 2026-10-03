/* Integrated LAN/loopback scenarios inside the existing intercepted smoke. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
module.exports=async function({page,context,origin,output,before,webkit,model,explorer,errors,fixture,stats,report,load,data,fillContact,available,shot,until}) {
  if(before) {
    const folder=path.resolve(output,'../../../..');
    const bindings=JSON.parse((await fs.readFile(path.join(folder,'bindings-before.json'),'utf8')).replace(/^\uFEFF/,''));
    const assets=new Map(bindings.filter(n=>n.path.startsWith('assets/')).map(n=>['/'+n.path,path.join(folder,'preimages',n.path)]));
    await context.route(origin+'/**',route=>{const source=assets.get(new URL(route.request().url()).pathname);return source?route.fulfill({path:source}):route.fallback();});
  }
  const resources=[];
  const reads=[];
  const functions=[];
  const navigations=[];
  page.on('request',request=>{if(request.isNavigationRequest()){const url=new URL(request.url());navigations.push({origin:url.origin,path:url.hostname==='checkout.stripe.com'?'/c/pay/[controlled]':url.pathname});}});
  await context.exposeFunction('__airportIntegratedRecord',entry=>functions.push(entry));
  page.on('response',response=>{
    const url=new URL(response.url());
    if(url.origin!==origin || !/^\/assets\/.+\.(js|css)$/.test(url.pathname))return;
    reads.push(response.body().then(body=>resources.push({path:url.pathname,status:response.status(),sha256:crypto.createHash('sha256').update(body).digest('hex')})).catch(()=>{}));
  });
  const trace=[];
  async function state() {
    return page.evaluate(()=>{
      const fleet=window.PixkuyFleetSelection?.read('airport_transfer');
      const button=document.querySelector('[data-airport-pay]');
      return {route:location.pathname+location.hash,offer:window.PixkuyFleetSelection?.airportOfferStatus().valid,panel:window.PixkuyAirportZoneTariff?.getState().mobileAvailabilityStatus,attempt:fleet?.attempt?.state || null,total:document.querySelector('.airport-booking__total')?.textContent || null,notice:document.querySelector('.airport-booking__notice')?.textContent || null,cta:button?.textContent || null,disabled:button?.disabled ?? null};
    });
  }
  async function action(label,run) {
    const prior=await state(),requests=stats();const priorCount=requests.prechecks,priorCheckouts=requests.checkouts.length;
    await run();trace.push({action:label,prior,result:await state().catch(()=>({route:new URL(page.url()).pathname,transitioning:true})),prechecks:stats().prechecks-priorCount,checkouts:stats().checkouts.length-priorCheckouts});
  }
  function installObservation() {
      if(!window.PixkuyAirportCheckout){document.addEventListener('DOMContentLoaded',installObservation,{once:true});return;}
      if(window.__airportIntegratedObserved)return;
      window.__airportIntegratedObserved=true;
      window.__airportIntegratedTrace=[];
      for(const type of ['click','pointerdown','pointerup','touchstart','touchend','blur','change'])document.addEventListener(type,event=>{window.__airportIntegratedTrace.push({event:type,target:event.target.id || event.target.className,disabled:event.target.disabled});},true);
      document.addEventListener('pixkuy:airport-transfer-panel-submit',()=>window.__airportIntegratedTrace.push({event:'panel-submit'}));
      function record(fn,result,error){const entry={fn,result,...error?{exception:{name:error.name,code:/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:error.message?.includes('randomUUID')?'crypto.randomUUID is not a function':'untyped-local-error'}}:{}};window.__airportIntegratedTrace.push(entry);window.__airportIntegratedRecord(entry);}
      for(const [api,key] of [['PixkuyAirportCheckout','prepare'],['PixkuyAirportReview','requestCheckout'],['PixkuyFleetSelection','fetchCheckout'],['PixkuyFleetSelection','recoverAttempt']]){
        const original=window[api][key];
        // Observation only: invoke the real implementation with original arguments,
        // preserve return values/errors, never replace the operation or its guards.
        window[api][key]=function(...args){record(api+'.'+key,'entered');if(key==='prepare'){const d=window.PixkuyAirportCheckout.draft() || {};window.__airportIntegratedRecord({fn:api+'.'+key,readiness:{amount:!!d.fare,zone:!!d.airport_transfer_zone_id,band:!!d.airport_transfer_passenger_fare_key,date:!!d.airport_transfer_date,time:!!d.airport_transfer_time,location:!!d.airport_transfer_non_airport_location,service:document.querySelector('[name="service_type"]')?.value}});}try{const value=original.apply(this,args);return value?.then?value.then(v=>{record(api+'.'+key,'resolved');return v;},e=>{record(api+'.'+key,'rejected',e);throw e;}):value;}catch(e){record(api+'.'+key,'threw',e);throw e;}};
      }
  }
  await page.addInitScript(installObservation);
  async function observe() {
    await page.evaluate(installObservation);
  }
  const back=()=>page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();
  const pay=()=>page.locator('[data-airport-pay]');
  const recover=()=>page.getByRole('button',{name:'Comprobar estado del pago',exact:true});
  async function review() {await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);}
  async function ready() {await until(()=>pay().count().then(async n=>n>0 && await pay().isEnabled() && await pay().innerText()==='Continuar al pago'),'Valid review');}
  async function loadedSnapshotPhoto(expectedUrl) {
    const photo=page.locator('[data-booking-status-vehicle-thumb]:visible');
    await photo.waitFor();await photo.scrollIntoViewIfNeeded();
    await photo.evaluate(img=>img.decode());
    const observed=await photo.evaluate(img=>({path:new URL(img.currentSrc).pathname,width:img.naturalWidth}));
    assert.equal(observed.path,new URL(expectedUrl).pathname);assert(observed.width>0);
    await page.locator('[data-booking-cancelled-mobile-panel],[data-booking-status-mobile-panel]').evaluateAll(nodes=>nodes.forEach(n=>n.scrollTop=0));
    return observed;
  }
  try {
    await load(390,700);await page.waitForLoadState('load');await observe();
    report.environment=await page.evaluate(()=>{
      let storage=false;const key='pixkuy_qa_capability';try{sessionStorage.setItem(key,'1');storage=sessionStorage.getItem(key)==='1';sessionStorage.removeItem(key);}catch(_){}
      return {origin:location.origin,isSecureContext:window.isSecureContext,randomUUID:typeof window.crypto?.randomUUID,getRandomValues:typeof window.crypto?.getRandomValues,subtle:typeof window.crypto?.subtle,storage,modules:{prepare:typeof window.PixkuyAirportCheckout?.prepare,fleet:typeof window.PixkuyFleetSelection?.fetchCheckout,review:typeof window.PixkuyAirportReview?.requestCheckout},engine: navigator.userAgent.includes('AppleWebKit')?'WebKit-compatible UA':'other'};
    });
    report.browser=webkit?'Playwright WebKit; not physical Safari':'Playwright Chromium mobile viewport';
    if(!before) {
      const beforeQuota=stats().checkouts.length;
      report.storageQuota=await page.evaluate(async origin=>{
        const keys=[];let size=1024*1024,code='';
        try {
          // Exhaust only this ephemeral test profile using the real Storage API.
          // Do not replace preparation, persistence, UUID or transport functions.
          while(size>=8 && keys.length<128) {
            const key='pixkuy_qa_quota_'+keys.length;
            try{sessionStorage.setItem(key,'q'.repeat(size));keys.push(key);}catch(_){size=Math.floor(size/2);}
          }
          try{await window.PixkuyFleetSelection.fetchCheckout('direct_transfer',origin+'/v1/public/reservations/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceType:'direct_transfer',controlledFixture:true})});}
          catch(error){code=error.name;}
          return {code,attemptPersisted:!!window.PixkuyFleetSelection.read('direct_transfer').attempt};
        } finally {keys.forEach(key=>sessionStorage.removeItem(key));}
      },origin);
      assert.equal(report.storageQuota.code,'QuotaExceededError');assert.equal(report.storageQuota.attemptPersisted,false);assert.equal(stats().checkouts.length,beforeQuota);
      report.checks.push({name:'real-storage-quota-refuses-dispatch-before-persistence',result:'PASS'});
      report.tripBranches=[];
      const airports=await page.evaluate(()=>window.PIXKUY_AIRPORT_ZONE_CATALOG.airports.filter(a=>a.active).map(a=>a.id));
      for(const [index,airport] of airports.entries()) for(const direction of ['airport_to_hotel','hotel_to_airport']) {
        const band=['van_1_2','van_3_4','van_5_6'][index%3],capacity=[2,4,6][index%3];
        fixture({models:[{...model,passengersSupported:capacity}]});
        await page.evaluate(({airport,direction})=>window.PixkuyAirportZoneTariff.setAirportSelection({airportId:airport,direction}),{airport,direction});
        await page.locator('[data-airport-mobile-passengers-select]').selectOption(band);
        await page.locator('[data-airport-mobile-luggage-select]').selectOption(String(index%4));
        await available();
        const request=stats().requests.at(-1);
        assert.equal(request.airport,airport);assert.equal(request.band,band);assert.equal(request.capacity,capacity);
        assert.equal(request.direction,direction==='hotel_to_airport'?'destination_to_airport':'airport_to_destination');
        report.tripBranches.push({airport,direction,band,capacity,luggage:index%4});
      }
      for(const mode of ['invalid','pending','network']) {
        fixture({mode});await page.locator('#airport-tariff-time').fill(mode==='invalid'?'13:00':mode==='pending'?'13:01':'13:02');
        await until(()=>page.locator('#services-expand-airport').getAttribute('data-airport-mobile-availability-state').then(s=>s==='error'),'Panel technical state: '+mode);
        assert(await page.locator('#services-expand-airport .services-expand__actions .services-expand__cta').isDisabled());
      }
      fixture({});await page.locator('[data-airport-mobile-passengers-select]').selectOption('van_1_2');await load(390,700);await observe();
      report.checks.push({name:'five-airports-both-directions-three-bands-luggage-panel-invalid-pending-network',result:'PASS',scope:'Frontend catalog/context and controlled server eligibility; not live provider coverage'});
    }
    await action('Trayecto → Datos',async()=>{
      const cta=page.locator('#services-expand-airport .services-expand__actions .services-expand__cta');
      if(webkit) {await cta.tap();if(before){await page.waitForTimeout(300);if(!page.url().includes('#airport/datos')){report.webkitFirstTapLost=true;await cta.tap();}}await page.waitForURL(/#airport\/datos$/);}
      else await data();
    });await fillContact();
    await action('Datos → Revisión',async()=>{await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);});
    await shot('revision-antes-de-continuar');
    assert(await page.locator('[data-airport-pay]').isEnabled());assert.equal(stats().checkouts.length,0);
    if(!before || !origin.includes('192.168.')) {
      report.availability=[];
      for(const mode of before?['invalid']:['invalid','pending','network','technical','unavailable']) {
        fixture({mode});await pay().click();
        await until(()=>page.locator('.airport-booking__notice').count().then(n=>n>0),'Availability outcome');
        const observed=await state();report.availability.push({mode,...observed});
        assert.equal(stats().checkouts.length,0);
        if(before){assert(observed.notice.includes('No hay disponibilidad'));await shot('respuesta-invalida-como-indisponibilidad');}
        else if(mode==='unavailable'){assert(observed.notice.includes('No hay disponibilidad'));assert(observed.disabled);}
        else {assert(observed.notice.includes('comprobar la disponibilidad'));assert.equal(observed.cta,'Reintentar comprobación');}
        fixture({});
        if(before || mode==='unavailable'){await back();await review();}
        else await pay().click();
        await ready();
      }
      report.checks.push({name:before?'invalid-response-misclassification-reproduced':'transport-invalid-pending-not-unavailability',result:'PASS'});
    }
    if(!before) {
      await action('Caducidad y recarga del borrador',async()=>{await page.evaluate(()=>{window.__advanceAirportClock(301000);window.PixkuyFleetSelection.expireAirportOfferIfNeeded();});await page.reload();await ready();await observe();});
      assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
      assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
      await shot('revision-restaurada');
      report.checks.push({name:'expired-reloaded-draft-auto-validates-retains-contact-legal',result:'PASS'});
    }
    fixture({checkout:'success'});
    await action('Continuar al pago',async()=>{
      await page.locator('[data-airport-pay]').click();
      await until(()=>stats().checkouts.length>0 || page.locator('.airport-booking__notice').count().then(n=>n>0),'Checkout or original failure');
      await page.waitForTimeout(350);
    });
    report.functions=functions;
    if(before && !report.environment.randomUUID.includes('function')) {
      assert.equal(stats().checkouts.length,0,'LAN fails before HTTP dispatch');
      assert(report.functions.some(n=>n.exception?.code==='crypto.randomUUID is not a function'));
      await shot('bloqueo-lan');report.checks.push({name:'real-lan-uuid-pre-dispatch-failure-reproduced',result:'PASS'});return;
    }
    assert.equal(stats().checkouts.length,1,'Normal flow dispatches exactly once');
    await until(()=>navigations.some(n=>n.path==='/booking-checkout.html'),'Existing checkout bridge requested');
    await page.waitForURL('https://checkout.stripe.com/**');
    report.checkout={requested:true,redirectedToExistingBridge:true};
    report.checks.push({name:'continuous-trip-data-review-real-prepare-checkout-redirect',result:'PASS'});
    if(!before) {
      const original=stats().checkouts[0];
      assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(original.key));
      report.returns=[];
      for(const status of ['pending_payment','processing','hold_expired','cancelled_manual','confirmed']) {
        fixture({status,canRetry:status==='pending_payment',canModify:false});await page.goto(origin+'/booking-cancelled.html?token=synthetic-integrated-only');
        await page.waitForFunction(()=>window.__qaBookingStatus);
        const result=await page.evaluate(()=>{const r=window.__qaBookingStatus.result;return {view:r.view,paymentStatus:r.paymentStatus,expected:r.paymentAmountExpected,paid:r.paymentAmountPaid,vehicle:r.vehicleDisplayName,photo:!!r.vehiclePhotoUrl};});
        report.returns.push({status,...result});
        if(status==='confirmed'){assert.equal(result.paid,80000);assert.equal(result.view,'confirmed');}
        else assert.equal(result.paid,null);
        assert.equal(result.expected,80000);
        assert.equal(result.view,{pending_payment:'pending',processing:'pending',hold_expired:'expired',cancelled_manual:'cancelled',confirmed:'confirmed'}[status]);
        if(status==='processing') {
          assert.equal(result.paymentStatus,'pending','Unresolved checkout is not a new payment status');
          assert.equal(await page.locator('[data-booking-cancelled-retry]:visible,[data-booking-cancelled-modify]:visible').count(),0,'Unresolved checkout exposes no competing payment/edit');
        }
        assert.equal(result.vehicle,model.name);result.loadedPhoto=await loadedSnapshotPhoto(model.photoUrl);await shot('retorno-'+status);
        if(status==='pending_payment') {
          await page.locator('[data-booking-cancelled-retry]:visible').click();await page.waitForURL('https://checkout.stripe.com/**');
          assert.equal(stats().retries,1,'Existing reservation retry endpoint');assert.equal(stats().checkouts.length,1,'Return retry is not a new reservation');
        }
      }
      assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').attempt),null,'Confirmed A releases its attempt authoritatively');
      report.returnPhotos=[];
      for(const route of ['booking-cancelled.html','booking-success.html']) {
        for(const variant of ['snapshot','missing','broken']) {
          const selected={...model,photoUrl:variant==='snapshot'?origin+'/assets/img/fleet/byd-m9-cabin-overview.webp':variant==='missing'?null:origin+'/assets/img/fleet/controlled-missing-snapshot.png'};
          fixture({status:route==='booking-success.html'?'confirmed':'pending_payment',models:[selected],canModify:false});
          await page.goto(origin+'/'+route+'?token=synthetic-integrated-only');await page.waitForFunction(()=>window.__qaBookingStatus);
          await page.locator('[data-booking-status-vehicle]:visible').filter({hasText:model.name}).waitFor();
          const record={route,variant};
          if(variant==='snapshot') record.loadedPhoto=await loadedSnapshotPhoto(selected.photoUrl);
          else {await until(()=>page.locator('[data-booking-status-vehicle-thumb]:visible').count().then(n=>n===0),'No invented/broken snapshot photo');assert.equal(await page.locator('[data-booking-status-vehicle]:visible').evaluate(n=>n.classList.contains('booking-status-mobile__vehicle-value')),false);}
          report.returnPhotos.push(record);await shot('foto-'+route.replace('.html','')+'-'+variant);
        }
      }
      report.checks.push({name:'mobile-return-snapshot-photo-loaded-missing-broken-both-pages',result:'PASS'});
      await load(390,700,[explorer]);await data();await fillContact();await review();await ready();await observe();
      assert((await page.locator('.airport-booking').innerText()).includes('Ford Explorer'));
      fixture({checkout:'timeout',models:[explorer]});await pay().evaluate(n=>{n.click();n.click();});await recover().waitFor();await until(()=>recover().isEnabled(),'Lost response actionable');
      assert.equal(stats().checkouts.length,2);const second=stats().checkouts[1];assert.notEqual(second.key,original.key,'Reservation B has independent identity');
      report.secondAttempt={differentIdentity:true};await shot('respuesta-perdida');
      fixture({checkout:'unknown',models:[explorer]});await recover().click();await until(()=>stats().checkouts.length===3 && recover().isEnabled(),'Recovery failure actionable');
      assert.equal(JSON.stringify(stats().checkouts[2]),JSON.stringify(second),'Same attempt on recovery');await shot('recuperacion-fallida');
      await page.reload();await recover().waitFor();assert.equal(stats().checkouts.length,3,'Reload does not repeat dispatch');
      fixture({checkout:'success',models:[explorer]});const redirects=navigations.filter(n=>n.path==='/booking-checkout.html').length;await recover().click();await until(()=>navigations.filter(n=>n.path==='/booking-checkout.html').length>redirects,'Explicit recovery redirects');await page.waitForURL('https://checkout.stripe.com/**');
      assert.equal(JSON.stringify(stats().checkouts[3]),JSON.stringify(second),'Same identity/content after reload');
      report.checks.push({name:'continuous-return-A-confirmed-new-B-timeout-recovery-failure-reload-success',result:'PASS'});
      // Server-authorized editing, using the actual public status and edit handoff.
      fixture({status:'pending_payment',canModify:true,models:[explorer]});await page.goto(origin+'/booking-cancelled.html?token=synthetic-integrated-only');
      await page.waitForFunction(()=>window.__qaBookingStatus?.result?.raw?.edit?.allowed);
      assert.equal(await page.evaluate(()=>window.__qaBookingStatus.result.vehicleDisplayName),explorer.name);
      assert.equal(await page.evaluate(()=>!!window.__qaBookingStatus.result.vehiclePhotoUrl),false,'No inherited BYD photo for Explorer without a photo');
      assert.equal(await page.locator('[data-booking-status-vehicle-thumb]:visible').count(),0);
      await page.locator('[data-booking-cancelled-modify]:visible').click();await page.waitForURL(/#airport\/datos$/);
      await page.locator('#contact-name').waitFor({state:'visible'});
      await page.locator('#contact-name').fill('Persona QA editada');await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();await review();
      await until(()=>pay().count().then(async n=>n>0 && await pay().isEnabled()),'Authorized edit can continue');
      await shot('revision-edicion-autorizada');fixture({checkout:'lost',status:'pending_payment',canModify:true,models:[explorer]});await pay().click();
      await until(()=>stats().replacements.length===1,'Replacement request, not new booking');
      await page.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).waitFor();
      await back();await page.getByRole('button',{name:'Volver al estado del pago sin aplicar cambios',exact:true}).click();
      await page.waitForURL(/booking-cancelled\.html/);await page.locator('[data-booking-cancelled-modify]:visible').click();
      await page.waitForURL(/#airport\/revision$/);await shot('recuperacion-sustitucion');fixture({checkout:'success',status:'pending_payment',canModify:true,models:[explorer]});
      await page.getByRole('button',{name:'Recuperar y continuar al pago',exact:true}).click();
      await until(()=>stats().replacements.length===2,'Original replacement recovered after exit/reopen');
      assert.equal(JSON.stringify(stats().replacements[0]),JSON.stringify(stats().replacements[1]),'Replacement identity and payload retained through status return');
      assert.equal(stats().checkouts.length,4);report.replacement={requests:stats().replacements.length,usesExistingReservation:true,sameIdentityAndPayload:true};report.checks.push({name:'authorized-mobile-edit-lost-response-exit-reopen-same-replacement',result:'PASS'});
      await page.waitForURL('https://checkout.stripe.com/**');
      await page.goto(origin+'/');await page.waitForFunction(()=>window.PixkuyFleetSelection);
      fixture({checkout:'unknown'});
      for(const service of ['direct_transfer','hourly_daily']) {
        const count=stats().checkouts.length;
        await page.evaluate(async({origin,service})=>{
          const init={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceType:service,controlledFixture:true})};
          await window.PixkuyFleetSelection.fetchCheckout(service,origin+'/v1/public/reservations/checkout',init);
        },{origin,service});
        const sent=stats().checkouts.at(-1);assert.equal(stats().checkouts.length,count+1);
        assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sent.key));
        await page.evaluate(service=>window.PixkuyFleetSelection.recoverAttempt(service).catch(()=>{}),service);
        assert.equal(stats().checkouts.length,count+2);assert.equal(JSON.stringify(stats().checkouts.at(-1)),JSON.stringify(sent));
      }
      report.checks.push({name:'shared-Direct-Hourly-CSPRNG-and-same-identity-recovery',result:'PASS',scope:'Actual shared transport helper; not full Direct/Hourly forms'});
      fixture({checkout:'status',status:'pending_payment',service:'hourly_daily',canModify:false});
      await page.evaluate(()=>window.PixkuyFleetSelection.recoverAttempt('hourly_daily'));
      await page.waitForURL(/booking-success\.html/);await page.waitForFunction(()=>window.__qaBookingStatus);
      assert.equal(await page.evaluate(()=>window.__qaBookingStatus.result.view),'pending');
      report.checks.push({name:'shared-default-status-recovery-existing-route-authoritative-pending',result:'PASS'});
    }
    assert.equal(stats().writes,0);assert.deepEqual(errors,[]);
  } finally {
    report.lastState=await state().catch(()=>null);
    report.contextComparison=await page.evaluate(()=>{
      const saved=JSON.parse(sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot') || '{}');
      const draft=window.PixkuyAirportCheckout?.draft() || {};
      const fields=['airport_transfer_airport_id','airport_transfer_direction','airport_transfer_zone_id','airport_transfer_passenger_fare_key','airport_transfer_date','airport_transfer_time','airport_transfer_price','airport_desktop_amount_minor','fleet_selection'];
      return Object.fromEntries(fields.map(key=>[key,{equal:JSON.stringify(saved[key])===JSON.stringify(draft[key]),saved:key==='fleet_selection'?saved[key]?.model_id:saved[key],draft:key==='fleet_selection'?draft[key]?.model_id:draft[key]}]));
    }).catch(()=>null);
    report.formFlags=await page.evaluate(()=>({invalid:Array.from(document.querySelectorAll('[aria-invalid="true"]')).map(n=>n.id || n.name),consent:document.querySelector('#pixkuy-airport-transfer-legal-acceptance')?.checked,legalSaved:document.querySelector('[name="legal_acceptance_accepted"]')?.value,restoring:sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_return')==='1',busy:document.querySelector('form[name="contact"]')?.getAttribute('aria-busy')})).catch(()=>null);
    report.functions=functions;
    report.events=await page.evaluate(()=>window.__airportIntegratedTrace?.filter(n=>n.event) || []).catch(()=>[]);
    await shot('estado-final').catch(()=>{});
    report.trace=trace;await Promise.all(reads);report.resources=resources;
    report.navigations=navigations;
    await fs.writeFile(path.join(output,'trace.json'),JSON.stringify({environment:report.environment,actions:trace,functions:report.functions,resources},null,2));
  }
};
