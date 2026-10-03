'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async function({context,origin,webkit}) {
  // Deliberately no context.route/page.route: server and browser policies protect
  // this client exactly as they protect a separate iPhone Safari tab.
  const output=path.resolve(__dirname,'../../../evidence/airport-iphone-acceptance-20261003/browser',webkit?'webkit':'chromium');
  await fs.mkdir(output,{recursive:true});
  const report={checks:[],network:[],browser:webkit?'Playwright WebKit; physical Safari pending':'Chromium',playwrightInterception:false};
  const page=await context.newPage();await page.setViewportSize({width:390,height:844});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push({name:error.name,message:/^[A-Z_]+$/.test(error.message)?error.message:'other-local-error'}));
  const requests=new Map();
  page.on('request',request=>{const url=new URL(request.url()),entry={origin:url.origin,path:url.pathname,method:request.method()};requests.set(request,entry);report.network.push(entry);});
  page.on('requestfinished',request=>{if(requests.has(request))requests.get(request).outcome='FINISHED';});
  page.on('requestfailed',request=>{if(requests.has(request))requests.get(request).outcome=/csp|content.security/i.test(request.failure()?.errorText || '')?'CSP_BLOCKED':'FAILED';});
  await context.addInitScript(()=>{
    if(window.top!==window)return;
    if(!sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot'))sessionStorage.setItem('pixkuy_airport_transfer_checkout_review_snapshot','manual-test-unrelated-sentinel');
    if(!localStorage.getItem('manual-test-unrelated'))localStorage.setItem('manual-test-unrelated','manual-test-unrelated-sentinel');
  });
  const mount='/.netlify/functions/airport-manual-acceptance';
  async function frame() {await page.locator('iframe').waitFor();return page.frames().find(f=>f.parentFrame());}
  async function summary() {return page.evaluate(async()=>{const context=location.pathname.replace(/\/$/,'');return fetch(context+'/control/summary').then(r=>r.json());});}
  async function reloadApp() {const app=await frame();await Promise.all([app.waitForNavigation({waitUntil:'load'}),page.locator('[data-manual-reload]').click()]);return frame();}
  async function until(fn,label) {const deadline=Date.now()+15000;while(!await fn()){assert(Date.now()<deadline,label);await page.waitForTimeout(50);}}
  async function normalReview(scenario) {
    await page.goto(origin+mount+'/start/'+scenario);const app=await frame();await app.waitForLoadState('load');
    await app.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportReview);
    await app.locator('[data-consent-reject]').click({timeout:6000}).catch(()=>{});
    await app.waitForFunction(()=>window.PixkuyFleetSelection.airportOfferStatus().valid);
    report.capabilities=await app.evaluate(()=>({origin:location.origin,isSecureContext,randomUUID:typeof crypto.randomUUID,getRandomValues:typeof crypto.getRandomValues,subtle:typeof crypto.subtle,protected:window.PixkuyManualBoundary.ready}));
    await app.locator('#services-expand-airport .services-expand__actions .services-expand__cta').click();
    await app.waitForURL(/#airport\/datos$/);
    await app.waitForFunction(()=>document.querySelector('#contact-phone')?.closest('form')?.inert===false && document.activeElement?.matches('.airport-mobile-flow__back'));
    await app.evaluate(()=>{window.__manualPhoneEvents=[];for(const type of ['input','change','blur','focus'])document.addEventListener(type,event=>{if(event.target.id==='contact-phone')window.__manualPhoneEvents.push({type,length:event.target.value.length,trusted:event.isTrusted});},true);});
    await app.locator('#contact-name').fill('Ana García');await app.locator('#contact-phone').fill('+34612345678');await app.locator('#contact-email').fill('ana@example.com');
    assert.equal(await app.locator('#contact-phone').inputValue(),'+34612345678','Phone populated after focus transition');
    await app.locator('#contact-message').click();await app.locator('[data-airport-mobile-notes-editor-input]').fill('Notas sintéticas para aceptación');await app.locator('[data-airport-mobile-notes-editor-close]').click();
    await app.locator('#pixkuy-airport-transfer-legal-acceptance').check();assert.equal(await app.locator('#contact-phone').inputValue(),'+34612345678','Phone preserved before review');await app.locator('#contact-submit').click();await app.waitForURL(/#airport\/revision$/);
    await until(()=>app.locator('[data-airport-pay]').isEnabled(),'Normal review payable');
    assert.equal((await summary()).checkoutRequests,0,'Review preparation never dispatches a payment');
    await page.screenshot({path:path.join(output,scenario+'-revision.png'),fullPage:true});
    return app;
  }
  async function sentinelUnchanged() {
    assert.deepEqual(await page.evaluate(()=>[sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot'),localStorage.getItem('manual-test-unrelated')]),['manual-test-unrelated-sentinel','manual-test-unrelated-sentinel']);
  }
  try {
    let app=await normalReview('normal');
    app=await reloadApp();
    await until(async()=>{app=await frame();return app.url().endsWith('#airport/revision') && await app.locator('[data-airport-pay]').count() && await app.locator('[data-airport-pay]').isEnabled();},'Reloaded review retains route');
    assert.equal(await app.locator('#contact-name').inputValue(),'Ana García');assert(await app.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
    await page.reload({waitUntil:'load'});
    await until(async()=>{app=await frame();return app.url().endsWith('#airport/revision') && await app.locator('[data-airport-pay]').count() && await app.locator('[data-airport-pay]').isEnabled();},'Safari-style full tab reload retains review');
    assert.equal(await app.locator('#contact-name').inputValue(),'Ana García');assert(await app.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
    await app.locator('[data-airport-pay]').click();await until(async()=>{app=await frame();return app.url().includes('/app/provider.html');},'Real checkout reaches local provider boundary');
    assert.equal((await summary()).checkoutRequests,1);await page.screenshot({path:path.join(output,'frontera-simulada.png'),fullPage:true});
    await app.getByRole('link',{name:'Simular retorno confirmado',exact:true}).click();
    await until(async()=>{app=await frame();return app.url().includes('booking-success.html') && await app.locator('[data-booking-status-payment]:visible').count()>0 && (await app.locator('[data-booking-status-payment]:visible').innerText()).includes('Pagado');},'Simulated confirmed status');
    assert((await app.locator('[data-booking-status-payment]:visible').innerText()).includes('Pagado'));
    report.normal=await summary();await sentinelUnchanged();await page.screenshot({path:path.join(output,'retorno-confirmado-simulado.png'),fullPage:true});
    report.checks.push({name:'real-normal-review-reload-checkout-local-boundary-simulated-return',result:'PASS'});
    app=await normalReview('lost');
    await app.locator('[data-airport-pay]').click();
    const recovery=()=>app.getByRole('button',{name:'Comprobar estado del pago',exact:true});await recovery().waitFor();
    const attempt=await app.evaluate(()=>{const a=window.PixkuyFleetSelection.read('airport_transfer').attempt;return {key:a.key,payload:a.payload};});
    assert.equal((await summary()).checkoutRequests,1);
    app=await reloadApp();
    await until(async()=>{app=await frame();return await app.getByRole('button',{name:'Comprobar estado del pago',exact:true}).count()>0;},'Uncertain attempt survives reload');
    assert.deepEqual(await app.evaluate(()=>{const a=window.PixkuyFleetSelection.read('airport_transfer').attempt;return {key:a.key,payload:a.payload};}),attempt);
    assert.equal((await summary()).checkoutRequests,1,'Reload does not dispatch');
    await recovery().click();await until(async()=>await recovery().isEnabled() && (await summary()).checkoutRequests===2,'Recovery failure remains actionable');
    assert.deepEqual(await app.evaluate(()=>{const a=window.PixkuyFleetSelection.read('airport_transfer').attempt;return {key:a.key,payload:a.payload};}),attempt);
    await page.screenshot({path:path.join(output,'recuperacion-fallida.png'),fullPage:true});
    await recovery().click();await until(async()=>{app=await frame();return app.url().includes('/app/provider.html');},'Same attempt recovered successfully');
    report.lost=await summary();assert.equal(report.lost.checkoutRequests,3);assert.equal(report.lost.uniqueAttempts,1);
    await app.getByRole('link',{name:'Simular retorno pendiente',exact:true}).click();await until(async()=>{app=await frame();return app.url().includes('booking-cancelled.html');},'Simulated pending return');
    await app.locator('[data-booking-status-payment]:visible').waitFor();assert((await app.locator('[data-booking-status-payment]:visible').innerText()).includes('Pendiente'));
    await sentinelUnchanged();report.checks.push({name:'lost-response-reload-failed-recovery-success-same-identity-content',result:'PASS'});
    app=await normalReview('normal');
    const storage=await app.evaluate(()=>{
      const s=sessionStorage,l=localStorage;
      s.setItem('manual-probe','method');s['manual-property']='property';l.setItem('manual-probe','local');
      const result={method:s.getItem('manual-probe')==='method',property:s['manual-property']==='property',enumeration:Object.keys(s).includes('manual-probe') && Object.keys(s).includes('manual-property'),ownLength:s.length===Object.keys(s).length,foreign:s.getItem('pixkuy_airport_transfer_checkout_review_snapshot')!=='manual-test-unrelated-sentinel'};
      s.clear();l.clear();result.cleared=s.length===0 && l.length===0;return result;
    });
    assert(Object.values(storage).every(Boolean));await sentinelUnchanged();report.storage=storage;
    report.checks.push({name:'real-Storage-scoped-method-property-enumeration-length-clear-preserves-unrelated',result:'PASS'});
    report.applicationErrors=errors.slice();assert.equal(report.applicationErrors.length,0,'Normal application has no script errors');
    const base=page.url().replace(/\/$/,'');
    const bootstrapUrl=base+'/app/index.html?service=airport_hotel&bootstrap=disabled';
    await page.locator('iframe').evaluate((node,url)=>node.src=url,bootstrapUrl);
    await until(async()=>{app=await frame();return app.url().includes('bootstrap=disabled') && await app.evaluate(()=>document.readyState==='complete');},'Deliberate bootstrap failure loaded');
    assert.equal(await app.evaluate(()=>typeof window.PixkuyManualBoundary),'undefined');
    assert.equal(await app.evaluate(()=>typeof window.PixkuyAirportReview),'undefined','Guarded product cannot execute without protection');
    const canary=origin+mount+'/canary';
    const beforePositive=await summary();
    assert.equal((await page.request.get(canary)).status(),200);
    const before=await summary();assert.equal(before.canaryRequests,beforePositive.canaryRequests+1,'Independent canary receiver is live');
    const violations=await app.evaluate(async canary=>{
      const blocked=[];document.addEventListener('securitypolicyviolation',event=>blocked.push(event.effectiveDirective));
      await fetch(canary,{method:'POST',body:'canary'}).catch(()=>{});
      await new Promise(resolve=>{const xhr=new XMLHttpRequest();xhr.open('POST',canary);xhr.onerror=xhr.onload=resolve;xhr.send('canary');});
      navigator.sendBeacon(canary,'canary');
      const image=new Image();image.src=canary;document.body.append(image);
      try{new Worker(canary);}catch(_){}
      await new Promise(resolve=>setTimeout(resolve,200));return blocked;
    },canary);
    await page.evaluate(()=>{window.__manualPolicyEvents=[];document.addEventListener('securitypolicyviolation',event=>window.__manualPolicyEvents.push(event.effectiveDirective));window.addEventListener('message',event=>{if(event.data?.type==='manual-policy')window.__manualPolicyEvents.push(event.data.directive);});});
    await app.evaluate(canary=>{
      document.addEventListener('securitypolicyviolation',event=>window.parent.postMessage({type:'manual-policy',directive:event.effectiveDirective},location.origin));
      const form=document.createElement('form');form.method='POST';form.action=canary;document.body.append(form);form.submit();
    },canary).catch(()=>{});await page.waitForTimeout(200);
    const formPolicies=await page.evaluate(()=>window.__manualPolicyEvents);
    report.formPolicies=formPolicies;
    assert(formPolicies.some(directive=>['form-action','frame-src'].includes(directive)),'Native form blocked by child form policy or parent frame policy');
    await page.locator('iframe').evaluate((node,url)=>node.src=url,bootstrapUrl);
    await until(async()=>{app=await frame();return app.url().includes('bootstrap=disabled') && await app.evaluate(()=>document.readyState==='complete');},'Probe document restored for navigation checks');
    await app.evaluate(canary=>{window.open(canary);},canary).catch(()=>{});
    await app.evaluate(canary=>{window.location.href=canary;},canary).catch(()=>{});await page.waitForTimeout(300);
    const after=await summary();assert.equal(after.canaryRequests,before.canaryRequests,'No blocked channel reached even the harmless server canary');
    assert(violations.includes('connect-src'));assert(violations.includes('img-src'));assert(violations.includes('worker-src'));
    assert(!page.url().includes('/canary'));
    report.safety={bootstrapAbsent:true,violations:[...new Set([...violations,...formPolicies])],canaryReceiverVerified:true,canaryDelta:after.canaryRequests-before.canaryRequests,storageUnchanged:true};await sentinelUnchanged();
    report.checks.push({name:'bootstrap-failure-CSP-business-channels-child-navigation-and-popup-blocked',result:'PASS'});
    const api=base+'/api/v1/public/reservations/checkout';
    const blocked=await page.request.post(api,{data:{probe:true}});assert.equal(blocked.status(),400);
    const traversal=await page.request.get(base+'/resource/assets/js/%2e%2e/%2e%2e/.env');assert([400,403,404].includes(traversal.status()));
    report.checks.push({name:'server-rejects-unprepared-business-body-and-private-path',result:'PASS'});
    // A separate adversarial probe, outside the guarded product flow. Some
    // WebKit versions execute parent Location.assign in the parent's realm.
    // Keep and report this GET escape; never turn it into a blanket safety PASS.
    await page.locator('iframe').evaluate((node,url)=>node.src=url,bootstrapUrl);
    await until(async()=>{app=await frame();return app.url().includes('bootstrap=disabled') && await app.evaluate(()=>document.readyState==='complete');},'Parent navigation probe document restored');
    await app.evaluate(canary=>{try{window.parent.location.assign(canary);}catch(_){}},canary).catch(()=>{});await page.waitForTimeout(300);
    const parentEscaped=page.url().includes('/canary');
    const finalSummary=await page.request.get(base+'/control/summary').then(response=>response.json());
    assert.equal(finalSummary.checkoutRequests,after.checkoutRequests,'Injected navigation never dispatches business');
    if(parentEscaped) {
      assert(webkit,'Unexpected parent navigation escape in Chromium');assert.equal(finalSummary.canaryRequests-after.canaryRequests,1);
      report.limitations=[{name:'injected-parent-native-GET-navigation',result:'ALLOWED_ENGINE_LIMITATION',realBusinessWrites:0}];
    } else assert.equal(finalSummary.canaryRequests,after.canaryRequests,'Parent navigation blocked');
    assert(report.network.filter(r=>r.origin!==origin).every(r=>r.outcome==='CSP_BLOCKED'),'No provider/external-origin request escaped policy');
    assert(report.network.filter(r=>r.method==='POST' && r.outcome==='FINISHED').every(r=>r.path.startsWith(mount+'/run/')),'No normal business POST');
    report.result=parentEscaped?'PASS_WITH_NATIVE_NAVIGATION_LIMIT':'PASS';report.realBusinessWrites=0;
  } finally {
    report.expectedProtectionErrors=errors.filter(error=>error.message==='MANUAL_PROTECTION_REQUIRED').length;
    report.unexpectedErrors=errors.filter(error=>error.message!=='MANUAL_PROTECTION_REQUIRED');
    report.parentPath=new URL(page.url()).pathname;
    report.lastView=await frame().then(app=>app.evaluate(()=>({path:location.pathname,hash:location.hash,consent:document.querySelector('#pixkuy-airport-transfer-legal-acceptance')?.checked,invalid:Array.from(document.querySelectorAll('[aria-invalid="true"]')).map(n=>n.id || n.name),phoneEvents:window.__manualPhoneEvents}))).catch(()=>null);
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));
    await page.screenshot({path:path.join(output,'estado-final.png'),fullPage:true}).catch(()=>{});
    console.log(JSON.stringify({result:report.result || 'FAIL',groups:report.checks.length,playwrightInterception:false}));
  }
};
