/* Return-only cases in the existing smoke; all business traffic is intercepted. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const fixtures=require('./airport-controlled-fixtures.cjs');
module.exports=async function({page,context,origin,output,before,webkit,model,stats,report}) {
  const evidence=path.resolve(__dirname,'../../../evidence/airport-return-hierarchy-20261003');
  const bindings=JSON.parse((await fs.readFile(path.join(evidence,'bindings-before.json'),'utf8')).replace(/^\uFEFF/,''));
  const preimages=new Map(bindings.filter(n=>!n.path.startsWith('scripts/')).map(n=>['/'+n.path,path.join(evidence,'preimages',n.path)]));
  const baseline=route=>{const file=preimages.get(new URL(route.request().url()).pathname);return file?route.fulfill({path:file}):route.fallback();};
  if(before)await context.route(origin+'/**',baseline);
  const factory=(state='pending_payment',allowed=true)=>fixtures.status({source:{airport_transfer_date:'2027-01-14',airport_transfer_time:'12:30'},selected:model,amount:80000,service:'airport_transfer',state,canModify:allowed,canRetry:allowed});
  const address='Salamanca 35, Roma Norte, Ciudad de México, México';
  const compound='Hotel MX Condesa — Salamanca 35, Roma Norte, Ciudad de México, Estados Unidos Mexicanos';
  let body=factory();
  await context.route('**/v1/public/reservations/status*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)}));
  report.browser=webkit?'Playwright WebKit; not physical iPhone':'Chromium';report.observations=[];
  report.failedResources=[];
  page.on('requestfailed',request=>report.failedResources.push({path:new URL(request.url()).pathname,failure:request.failure()?.errorText}));
  const check=(value,label)=>{report.observations.push({label,pass:!!value});if(!before)assert(value,label);};
  const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  async function shot(name){
    await page.evaluate(()=>document.fonts.ready);
    const consent=page.locator('[data-consent-reject]');if(await consent.isVisible())await consent.click();
    await paint();await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});
    assert(!await consent.isVisible(),'Evidence is not covered by the consent panel');
  }
  async function visit(width=390,height=844,file='booking-cancelled.html') {
    await page.setViewportSize({width,height});await page.goto(origin+'/'+file+'?token=synthetic-return-hierarchy');
    await page.evaluate(()=>window.PixkuyAirportDesktopView.ready);
    await page.evaluate(()=>window.PixkuyBookingStatusState.onReady(s=>window.__returnReady={view:s.result.view,service:s.result.serviceType}));
    try {
      await page.waitForFunction(()=>window.__returnReady,{},{timeout:15000});
      await page.locator(width>720?'.airport-booking--result':'[data-airport-return]').waitFor();
    } catch(error) {
      report.renderFailure=await page.evaluate(()=>({state:window.__returnReady || null,i18n:document.documentElement.getAttribute('data-booking-status-i18n'),ready:document.readyState,root:!!document.querySelector('[data-airport-return]')}));
      await shot('render-failure');throw error;
    }
    const reject=page.locator('[data-consent-reject]');if(await reject.isVisible())await reject.click();await paint();
    if(!before && width<=720)check(!await page.locator('[data-airport-mobile-deadline]').count() || !(await page.locator('[data-airport-mobile-deadline]').innerText()).includes('paymentRemaining'),'clock-copy-ready-'+file);
  }
  const root=page.locator('[data-airport-return]');
  const panel=page.locator('[data-booking-cancelled-mobile-panel]');
  for(const width of [320,390,430]) {
    body=factory();body.reservation.destinationAddress=compound;body.reservation.destinationAddressDetail=address;
    await visit(width);
    const metrics=await root.evaluate(n=>{
      const p=n.querySelector('[data-booking-cancelled-mobile-panel]'),pay=n.querySelector('[data-booking-cancelled-retry]'),amount=n.querySelector('[data-booking-status-amount]'),header=document.querySelector('.mobile-topbar');
      return {panelWidth:p.clientWidth,scrollWidth:p.scrollWidth,amountY:amount.getBoundingClientRect().top,payBottom:pay.getBoundingClientRect().bottom,viewport:innerHeight,headerBackground:getComputedStyle(header).backgroundColor,headerBottom:header.getBoundingClientRect().bottom,panelTop:p.getBoundingClientRect().top};
    });report.observations.push({width,metrics});
    check(await page.locator('[data-mobile-topbar-menu-trigger]').isVisible(),'menu-visible-'+width);
    check(await root.locator('[data-booking-status-destination]').innerText()===compound,'composite-address-once-'+width);
    check((await root.locator('[data-booking-status-title]').innerText())==='Pago pendiente','server-pending-title-'+width);
    check(metrics.payBottom<=metrics.viewport && metrics.amountY>=metrics.headerBottom,'payment-first-screen-'+width);
    check(metrics.panelTop>=metrics.headerBottom && metrics.headerBackground==='rgb(15, 17, 19)','opaque-header-and-content-separation-'+width);
    check(metrics.scrollWidth<=metrics.panelWidth+1,'no-horizontal-clipping-'+width);
    check(await root.locator('.airport-return__disclosure:not([open])').count()===1,'contact-initially-collapsed-'+width);
    await shot('pending-initial-'+width);
    if(!before) {
      await root.locator('.airport-return__disclosure summary').click();
      check(await root.locator('[data-airport-return-email]').isVisible() && await root.locator('[data-booking-status-notes-row]').isVisible(),'contact-notes-readable-'+width);
    }
    await panel.evaluate(n=>n.scrollTop=n.scrollHeight);await shot('pending-scrolled-'+width);
    if(!before) {
      const scroll=await panel.evaluate(n=>n.scrollTop),clock=root.locator('[data-airport-mobile-deadline]');
      const firstClock=await clock.innerText();await clock.evaluate(n=>window.__returnClock=n);
      await page.locator('[data-mobile-topbar-menu-trigger]').click();await paint();
      check(await page.locator('[data-mobile-topbar-menu]').getAttribute('aria-hidden')==='false','menu-open-'+width);
      check(await page.locator('[data-mobile-topbar-menu-panel]').evaluate(n=>n.contains(document.activeElement)),'menu-focus-'+width);
      await shot('pending-menu-'+width);
      await page.keyboard.press('Shift+Tab');
      check(await page.locator('[data-mobile-topbar-menu-panel]').evaluate(n=>n.contains(document.activeElement)),'menu-focus-trapped-'+width);
      await page.keyboard.press('Escape');await paint();
      check(await page.locator('[data-mobile-topbar-menu-trigger]').evaluate(n=>document.activeElement===n),'menu-close-focus-'+width);
      check(Math.abs(await panel.evaluate(n=>n.scrollTop)-scroll)<2,'menu-close-scroll-'+width);
      await page.locator('[data-mobile-topbar-menu-trigger]').click();await paint();
      await page.locator('[data-mobile-topbar-menu-dismiss]').click({position:{x:5,y:5}});await paint();
      check(await page.locator('[data-mobile-topbar-menu]').isHidden(),'menu-backdrop-close-'+width);
      await page.waitForTimeout(1100);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy')));await paint();
      check(await clock.evaluate(n=>n===window.__returnClock) && await clock.innerText()!==firstClock,'clock-preserved-'+width);
      check(await root.locator('.airport-return__disclosure[open]').count()===1,'disclosure-preserved-on-redraw-'+width);
      check(stats().checkouts.length===0 && stats().retries===0 && stats().writes===0,'menu-disclosure-no-attempt-'+width);
      if(width===390) {
        await page.locator('#lang-trigger').click();await page.keyboard.press('Escape');await paint();
        check(page.url().includes('booking-cancelled.html') && await root.isVisible(),'language-close-stays-on-return');
        await page.locator('#lang-trigger').click();await page.locator('.lang-menu [data-lang="en"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-airport-return] [data-booking-status-title]').textContent==='Payment pending');
        check(await clock.evaluate(n=>n===window.__returnClock),'language-keeps-clock');
        await page.locator('#lang-trigger').click();await page.locator('.lang-menu [data-lang="es"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-airport-return] [data-booking-status-title]').textContent==='Pago pendiente');
      }
    }
  }
  if(!before) {
    // No changes to the retry handler: same synthetic public reservation token.
    const request=page.waitForRequest(r=>r.url().endsWith('/retry-checkout') && r.method()==='POST');
    await root.locator('[data-booking-cancelled-retry]').click();check((await request).postDataJSON().token==='synthetic-return-hierarchy','retry-same-reservation');
    await page.waitForURL('https://checkout.stripe.com/c/pay/synthetic-retry');check(await page.title()==='Controlled payment boundary','retry-intercepted');
    for(const variant of ['separate','address-only','processing','confirmed','expired','unknown','restricted','long']) {
      body=factory(variant==='confirmed'?'confirmed':variant==='expired'?'hold_expired':variant==='unknown'?'unknown':'pending_payment',false);
      if(variant==='processing')body.payment.status='processing';
      if(variant==='separate' || variant==='address-only') {
        for(const key of ['pickup','destination']) {body.reservation[key+'Address']=variant==='separate'?'Hotel MX Condesa':null;body.reservation[key+'AddressDetail']=address;}
      }
      if(variant==='long') {body.customer.email='contacto.sintetico.con.un.nombre.muy.largo@example.com';body.reservation.customerNotes='Notas extensas para probar el desplegable. '.repeat(18);}
      else body.reservation.customerNotes='';
      await visit();
      if(variant==='separate' || variant==='address-only')for(const key of ['pickup','destination'])check(await root.locator('[data-booking-status-'+key+']').innerText()===(variant==='separate'?'Hotel MX Condesa\n':'')+address,'location-'+variant+'-'+key);
      check(!await root.locator('[data-booking-cancelled-retry]').isVisible(),'server-permissions-'+variant);
      check(await root.locator('.airport-return__disclosure summary').innerText()===(variant==='long'?'Contacto y notas':'Contacto'),'disclosure-title-'+variant);
      if(variant==='processing')check((await root.locator('[data-booking-status-title]').innerText()).includes('verificando'),'processing-distinct');
      if(variant==='restricted')check(await root.locator('[data-booking-status-title]').innerText()==='Pago pendiente','pending-without-retry-is-not-processing');
      await shot(variant+'-initial');await root.locator('.airport-return__disclosure summary').click();await panel.evaluate(n=>n.scrollTop=n.scrollHeight);await shot(variant+'-scrolled');
    }
    // Text enlargement is a layout stress, not native Safari zoom evidence.
    const enlarged=await root.evaluate(n=>{for(const e of n.querySelectorAll('h1,h2,dt,dd,p,a,button,summary'))e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*1.5+'px';const p=n.querySelector('[data-booking-cancelled-mobile-panel]');p.scrollTop=0;return {width:p.clientWidth,scrollWidth:p.scrollWidth};});
    check(enlarged.width+1>=enlarged.scrollWidth,'enlarged-no-horizontal-clipping');await shot('enlarged-initial');await panel.evaluate(n=>n.scrollTop=n.scrollHeight);await shot('enlarged-scrolled');
    body=factory();await visit();await page.locator('[data-mobile-topbar-menu-trigger]').click();
    await page.locator('[data-mobile-topbar-menu-action="airport"]').click();await page.waitForURL(/\?service=airport_hotel$/);
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff);check(await page.locator('#services-expand-airport').isVisible(),'menu-navigation-real-airport');
    // Same status contracts, desktop layout before/after, including confirmed.
    report.desktop=[];
    for(const width of [721,1365])for(const file of ['booking-cancelled.html','booking-success.html']) {
      body=factory(file.includes('success')?'confirmed':'pending_payment',!file.includes('success'));
      const samples=[];
      for(const phase of ['before','after']) {
        if(phase==='before')await context.route(origin+'/**',baseline);
        await visit(width,900,file);
        samples.push(await page.locator('.airport-booking--result .airport-booking__layout').evaluate(n=>({width:n.getBoundingClientRect().width,columns:getComputedStyle(n).gridTemplateColumns,text:n.innerText.replace(/\d\d:\d\d/g,'TIME')})));
        await shot('desktop-'+file.replace('.html','')+'-'+phase+'-'+width);
        if(phase==='before')await context.unroute(origin+'/**',baseline);
      }
      assert.deepEqual(samples[0],samples[1]);report.desktop.push({width,file,unchanged:true});
    }
    body=factory('confirmed',false);await visit(390,844,'booking-success.html');check((await root.locator('[data-booking-status-title]').innerText()).includes('confirmada'),'success-confirmed-preserved');await shot('success-confirmed');
    check((await root.locator('[data-booking-status-payment]').innerText()).includes('Pagado'),'confirmed-paid-visible');
    await page.locator('[data-mobile-topbar-menu-trigger]').click();await page.keyboard.press('Escape');await paint();
    check(await root.isVisible() && page.url().includes('booking-success.html'),'confirmed-menu-close-preserves-return');
  }
  check(stats().checkouts.length===0 && stats().writes===0 && stats().retries===(before?0:1),'no-real-business-operations');
  report.checks.push({name:'return-mobile-hierarchy',result:before?'BASELINE_CAPTURED':'PASS'});
};

// A single existing normal scenario leaves a pending-return URL for physical
// review. No route interception; the unchanged local manual boundary protects it.
module.exports.manualPending=async function({browser,context,origin,confirmed=false,outputOverride}) {
  const output=outputOverride || path.resolve(__dirname,'../../../evidence/airport-return-hierarchy-20261003/manual');await fs.mkdir(output,{recursive:true});
  const page=await context.newPage();await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/.netlify/functions/airport-manual-acceptance/start/normal');
  await page.locator('iframe').waitFor();let app=page.frames().find(f=>f.parentFrame());
  await app.waitForFunction(()=>window.PixkuyAirportReview && window.PixkuyFleetSelection.airportOfferStatus().valid);
  const reject=app.locator('[data-consent-reject]');if(await reject.isVisible())await reject.click();
  await app.locator('#services-expand-airport .services-expand__actions .services-expand__cta').click();await app.waitForURL(/#airport\/datos$/);
  await app.waitForFunction(()=>document.activeElement?.matches('.airport-mobile-flow__back'));
  await app.locator('#contact-name').fill('Persona QA');await app.locator('#contact-phone').fill('+34612345678');await app.locator('#contact-email').fill('qa@example.com');
  await app.locator('#pixkuy-airport-transfer-legal-acceptance').check();await app.locator('#contact-submit').click();await app.waitForURL(/#airport\/revision$/);
  await app.locator('[data-airport-pay]').click();await app.waitForURL(/\/app\/provider.html$/);
  await app.getByRole('link',{name:confirmed?'Simular retorno confirmado':'Simular retorno pendiente',exact:true}).click();await app.waitForURL(confirmed?/booking-success.html\?token=synthetic-/:/booking-cancelled.html\?token=synthetic-/);
  await app.locator('[data-airport-return]').waitFor();
  const pendingUrl=app.url(),shellUrl=page.url();
  const summary=await page.evaluate(()=>fetch(location.pathname.replace(/\/$/,'')+'/control/summary').then(r=>r.json()));
  assert.equal(summary.realBusinessWrites,0);assert.equal(summary.uniqueAttempts,1);
  // Separate browser context: the exact URL also works without the parent shell,
  // automation routes, or any storage inherited from the first browser context.
  const external=await browser.newContext({viewport:{width:390,height:844},locale:'es-ES',serviceWorkers:'block'});
  try {
    const tab=await external.newPage();await tab.goto(pendingUrl);await tab.locator('[data-airport-return]').waitFor();
    assert(await tab.evaluate(()=>window.PixkuyManualBoundary.ready));
    assert.equal(await tab.locator('[data-airport-return] [data-booking-status-title]').innerText(),confirmed?'Reserva confirmada':'Pago pendiente');
    assert(!await tab.locator('[data-airport-return] [data-booking-cancelled-retry]').isVisible());
    const consent=tab.locator('[data-consent-reject]');if(await consent.isVisible())await consent.click();
    await tab.screenshot({path:path.join(output,confirmed?'confirmed-direct-url.png':'pending-direct-url.png'),fullPage:false});
    await tab.locator('[data-mobile-topbar-menu-trigger]').click();await tab.keyboard.press('Escape');
    assert.equal(tab.url(),pendingUrl);
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({result:'PASS',confirmedUrl:confirmed?pendingUrl:undefined,pendingUrl:confirmed?undefined:pendingUrl,shellUrl,playwrightInterception:false,separateBrowserContext:true,capabilities:await tab.evaluate(()=>({protected:window.PixkuyManualBoundary.ready,isSecureContext})),fixturePermissions:{canRetry:false,canModify:false},summary},null,2));
  } finally {await external.close();}
};
