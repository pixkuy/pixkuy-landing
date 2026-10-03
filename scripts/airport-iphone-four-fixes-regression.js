/* Four iPhone regressions, using the existing smoke, real modules and fixtures. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const fixtures=require('./airport-controlled-fixtures.cjs');
module.exports=async function({page,context,origin,output,before,webkit,model,fixture,stats,report,load,data,fillContact,available,until}) {
  report.browser=webkit?'Playwright WebKit, ephemeral context; NOT physical/private iPhone':'Chromium';
  report.observations=[];
  const evidence=path.resolve(__dirname,'../../../evidence/airport-iphone-four-fixes-20261003');
  const bindings=JSON.parse((await fs.readFile(path.join(evidence,'bindings-before.json'),'utf8')).replace(/^\uFEFF/,''));
  const preimages=new Map(bindings.filter(n=>!n.path.startsWith('scripts/')).map(n=>['/'+n.path,path.join(evidence,'preimages',n.path)]));
  const baselineRoute=route=>{const file=preimages.get(new URL(route.request().url()).pathname);return file?route.fulfill({path:file}):route.fallback();};
  if(before)await context.route(origin+'/**',baselineRoute);
  let statusBody=fixtures.status({source:{airport_transfer_date:'2027-01-14',airport_transfer_time:'12:30'},selected:model,amount:80000,service:'airport_transfer',state:'pending_payment',canModify:true,canRetry:true});
  await context.route('**/v1/public/reservations/status*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(statusBody)}));
  const check=(value,label)=>{report.observations.push({label,pass:!!value});if(!before)assert(value,label);};
  const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  async function shot(name){
    // Capture the actual visible scroller, not the hidden landing document.
    const consent=page.locator('[data-consent-reject]');
    if(await consent.isVisible())await consent.click();
    await paint();await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});
  }
  const panel='#services-expand-airport';
  async function incomplete(label) {
    await paint();
    const state=await page.locator(panel).evaluate(n=>({status:n.dataset.airportMobileAvailabilityState,text:n.querySelector('[data-airport-availability-status]')?.textContent || '',error:!!n.querySelector('[data-availability-tone="error"]:not([hidden])'),disabled:n.querySelector('.services-expand__actions .services-expand__cta').disabled}));
    report.observations.push({label,state});check(!state.error && state.disabled,label);
  }
  const desktopOnly=process.argv.includes('--four-fixes-desktop-only');
  if(!desktopOnly){await page.setViewportSize({width:390,height:844});await page.goto(origin+'/?service=airport_hotel&lang=es');await page.waitForLoadState('load');await incomplete('initial-empty');}
  for(const width of desktopOnly?[]:[320,390,430]) {
    await load(width,844);const date=await page.locator('#airport-tariff-date').inputValue();
    await page.locator('#airport-tariff-date').fill('');await page.locator('#airport-tariff-time').fill('');
    await page.waitForTimeout(150);await incomplete('incomplete-'+width);await shot('trayecto-incompleto-'+width);
    const count=stats().prechecks;await page.reload();await page.waitForLoadState('load');await paint();
    await incomplete('partial-restoration-'+width);check(stats().prechecks===count,'partial-no-precheck-'+width);
    await page.locator('#airport-tariff-date').fill(date);await page.locator('#airport-tariff-time').fill('12:30');await available();
    fixture({models:[model],delay:()=>350});await page.locator('#airport-tariff-time').fill('13:30');
    await until(()=>page.locator(panel).getAttribute('data-airport-mobile-availability-state').then(v=>v==='loading'),'Delayed request started');
    await page.locator('#airport-tariff-date').fill('');await page.waitForTimeout(450);await incomplete('late-response-cleared-'+width);
    fixture({models:[model]});await page.locator('#airport-tariff-date').fill(date);await available();
    fixture({models:[model],mode:'network'});await page.locator('#airport-tariff-time').fill('14:30');
    await until(()=>page.locator(panel).getAttribute('data-airport-mobile-availability-state').then(v=>v==='error'),'Genuine precheck error');
    check(await page.locator(panel+' [data-availability-tone="error"]:not([hidden])').count()>0,'complete-real-error-visible-'+width);
    fixture({models:[model]});await page.locator('#airport-tariff-time').fill('12:30');await available();
    await page.setViewportSize({width,height:640});
    await data();await paint();
    // Reproduce a copy refresh in the same mount frame as route entry.
    await page.evaluate(()=>{window.PixkuyAirportDesktopBooking.open();document.querySelector('.airport-mobile-route__content').scrollTop=240;window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy'));});await paint();
    const entry=await page.evaluate(()=>{const scroll=document.querySelector('.airport-mobile-route__content'),back=document.querySelector('.airport-booking .airport-mobile-flow__back'),summary=document.querySelector('.airport-booking .airport-mobile-contact-step__summary'),bar=document.querySelector('.mobile-topbar');return {scroll:scroll.scrollTop,backTop:back.getBoundingClientRect().top,summaryTop:summary.getBoundingClientRect().top,barBottom:bar.getBoundingClientRect().bottom,focus:document.activeElement.className};});
    report.observations.push({width,entry});check(entry.scroll===0 && entry.backTop>=entry.barBottom-1,'data-start-and-focus-'+width);await shot('datos-entrada-'+width);
    await page.locator('#contact-message').click();await paint();
    if(!before && (await page.locator('[data-airport-mobile-notes-editor-input]').inputValue()).length>100) {
      check(await page.locator('[data-airport-mobile-notes-editor-input]').evaluate(n=>n.selectionStart===n.value.length && n.scrollTop>0),'existing-long-note-cursor-visible-'+width);
    }
    await page.locator('[data-airport-mobile-notes-editor-input]').fill('');
    await page.locator('[data-airport-mobile-notes-editor-close]').click();
    await page.locator('#contact-message').click();await paint();
    await page.evaluate(()=>{window.__vvDescriptors={};for(const [key,value] of Object.entries({height:340,offsetTop:80})){window.__vvDescriptors[key]=Object.getOwnPropertyDescriptor(visualViewport,key);Object.defineProperty(visualViewport,key,{configurable:true,get:()=>value});}visualViewport.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('scroll'));});await paint();
    const notes=await page.evaluate(()=>{const input=document.querySelector('[data-airport-mobile-notes-editor-input]'),close=document.querySelector('[data-airport-mobile-notes-editor-close]');return {input:input.getBoundingClientRect().toJSON(),close:close.getBoundingClientRect().toJSON(),scroll:input.scrollTop,selection:input.selectionStart,focused:document.activeElement===input};});
    report.observations.push({width,notes,keyboard:'synthetic visualViewport geometry; not a physical keyboard'});
    check(notes.input.top>=80 && notes.input.bottom<=421 && notes.close.top>=80 && notes.close.bottom<=420 && notes.focused && notes.selection===0,'notes-visible-empty-'+width);await shot('notas-viewport-reducido-'+width);
    await page.locator('[data-airport-mobile-notes-editor-input]').fill('Notas largas de prueba. '.repeat(120));
    await page.locator('[data-airport-mobile-notes-editor-input]').evaluate(n=>{n.setSelectionRange(90,90);n.scrollTop=40;});
    await page.locator('[data-airport-mobile-notes-editor-close]').click();await paint();
    check(await page.locator('[data-airport-mobile-notes-editor]').isHidden(),'notes-close-no-reopen-'+width);
    const savedScroll=await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop);
    await page.evaluate(()=>{for(const key of Object.keys(window.__vvDescriptors)){const descriptor=window.__vvDescriptors[key];if(descriptor)Object.defineProperty(visualViewport,key,descriptor);else delete visualViewport[key];}visualViewport.dispatchEvent(new Event('resize'));});
    await page.locator('#contact-message').click();await paint();
    check(await page.locator('[data-airport-mobile-notes-editor-input]').inputValue()==='Notas largas de prueba. '.repeat(120),'notes-content-'+width);
    if(!before)check(await page.locator('[data-airport-mobile-notes-editor-input]').evaluate(n=>n.selectionStart===90),'notes-caret-reopen-'+width);
    await page.locator('[data-airport-mobile-notes-editor-close]').click();await paint();check(Math.abs(await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop)-savedScroll)<2,'notes-return-scroll-'+width);
    await shot('datos-notas-cerradas-'+width);
    if(!before) {
      await page.locator('#contact-name').fill('Persona QA');
      const y=await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop);
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy')));await paint();
      check(await page.locator('#contact-name').evaluate(n=>document.activeElement===n),'editing-focus-preserved-'+width);
      check(Math.abs(await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop)-y)<2,'editing-scroll-preserved-'+width);
      const legal=page.locator('[data-airport-transfer-checkout-legal-acceptance] a').first();await legal.scrollIntoViewIfNeeded();
      const legalY=await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop);
      await legal.click();await page.locator('#pixkuy-legal-overlay[data-open="1"]').waitFor();
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy')));
      await page.keyboard.press('Escape');await until(()=>page.locator('#pixkuy-legal-overlay[data-open="1"]').count().then(n=>!n),'Legal overlay closed');await paint();
      check(Math.abs(await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop)-legalY)<2,'legal-return-scroll-'+width);
      check(await legal.evaluate(n=>document.activeElement===n),'legal-return-focus-'+width);
      if(width===390) {
        await fillContact();const notes=await page.locator('#contact-message').inputValue();
        await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
        await page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();await page.waitForURL(/#airport\/datos$/);
        check(await page.locator('#contact-message').inputValue()===notes && await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked(),'review-back-notes-consent');
        check(await page.locator('[data-airport-mobile-notes-editor]').isHidden(),'review-back-no-editor');
      }
    }
    await page.setViewportSize({width,height:844});
    fixture({models:[model],status:'pending_payment',canRetry:true,canModify:true});
    await page.goto(origin+'/booking-cancelled.html?token=synthetic-four-fixes');await page.locator('[data-booking-cancelled-mobile-panel]').waitFor();await paint();
    const returned=await page.locator('[data-booking-cancelled-mobile]').evaluate(root=>{const panel=root.querySelector('[data-booking-cancelled-mobile-panel]'),details=root.querySelector('[data-booking-status-details]'),notice=root.querySelector('[data-booking-status-notice]'),amount=root.querySelector('[data-booking-status-amount]');return {amount:amount?.textContent || null,overflow:getComputedStyle(panel).overflowY,detailsBottom:details.getBoundingClientRect().bottom,noticeTop:notice.getBoundingClientRect().top,noticeHidden:notice.hidden};});
    report.observations.push({width,returned});check(returned.amount?.includes('800') && returned.overflow==='auto' && (returned.noticeHidden || returned.noticeTop>=returned.detailsBottom),'return-amount-scroll-no-overlap-'+width);
    await shot('retorno-pendiente-'+width);await page.locator('[data-booking-cancelled-mobile-panel]').evaluate(n=>n.scrollTop=n.scrollHeight);await shot('retorno-pendiente-acciones-'+width);
  }
  if(!before) {
    // Same existing application served from captured preimages for desktop comparison.
    report.desktop=[];
    for(const width of [721,1365]) {
      const samples=[];
      for(const phase of ['before','after']) {
        if(phase==='before')await context.route(origin+'/**',baselineRoute);
        await load(width,900);
        try {
          if(webkit) {
            // Baseline WebKit pointer navigation fails at 721 too; compare the
            // same canonical mount in both versions. Chromium covers the CTA.
            await page.evaluate(()=>window.PixkuyAirportDesktopBooking.open());
            await page.locator('.airport-booking #contact-name').waitFor({state:'visible'});
          } else await data();
        } catch(error) {
          report.desktopFailure={width,phase,url:page.url(),state:await page.locator(panel).evaluate(n=>({availability:n.dataset.airportMobileAvailabilityState,cta:n.querySelector('.services-expand__actions .services-expand__cta').textContent,disabled:n.querySelector('.services-expand__actions .services-expand__cta').disabled,booking:!!document.querySelector('.airport-booking')}))};
          await page.screenshot({path:path.join(output,'desktop-navigation-failure.png'),fullPage:false}).catch(()=>{});throw error;
        }
        await paint();
        check(!await page.locator('#contact-message').evaluate(n=>n.readOnly),'desktop-notes-editable-'+phase+'-'+width);
        const dataLayout=await page.locator('.airport-booking__layout').evaluate(n=>({display:getComputedStyle(n).display,columns:getComputedStyle(n).gridTemplateColumns,width:n.getBoundingClientRect().width}));
        await shot('desktop-datos-'+phase+'-'+width);
        await page.goto(origin+'/booking-cancelled.html?token=synthetic-four-fixes');await page.locator('.airport-booking--result').waitFor();await paint();
        const resultLayout=await page.evaluate(()=>{const n=document.querySelector('.airport-booking--result .airport-booking__layout');return {display:getComputedStyle(n).display,columns:getComputedStyle(n).gridTemplateColumns,width:n.getBoundingClientRect().width};});
        await shot('desktop-retorno-'+phase+'-'+width);samples.push({dataLayout,resultLayout});
        if(phase==='before')await context.unroute(origin+'/**',baselineRoute);
      }
      assert.deepEqual(samples[0],samples[1]);report.desktop.push({width,unchanged:true,...samples[1]});
    }
    await page.setViewportSize({width:390,height:700});
    report.returnStates=[];
    for(const variant of ['pending','processing','confirmed','expired','unknown-amount','long']) {
      const serverState=variant==='confirmed'?'confirmed':variant==='expired'?'hold_expired':'pending_payment';
      statusBody=fixtures.status({source:{airport_transfer_date:'2027-01-14',airport_transfer_time:'12:30'},selected:model,amount:80000,service:'airport_transfer',state:serverState,canModify:variant==='pending',canRetry:variant==='pending'});
      if(variant==='processing')statusBody.payment.status='processing';
      if(variant==='unknown-amount')statusBody.payment.amountExpected=null;
      if(variant==='long') {
        statusBody.reservation.destinationAddress+=' — Edificio de llegadas internacionales, puerta exterior norte, acceso adaptado y punto de encuentro de pasajeros';
        statusBody.customer.email='contacto.sintetico.con.nombre.muy.largo.para.prueba@example.com';
        statusBody.reservation.customerNotes='Notas extensas para comprobar el reflujo natural. '.repeat(12);
      } else statusBody.reservation.customerNotes='';
      await page.goto(origin+'/booking-cancelled.html?token=synthetic-four-fixes');await page.locator('[data-airport-return]').waitFor();await paint();
      const root=page.locator('[data-airport-return]'),pay=root.locator('[data-booking-cancelled-retry]');
      check(await pay.isVisible()===(variant==='pending'),'payment-action-'+variant);
      const amount=await root.locator('[data-booking-status-amount]').innerText();check(variant==='unknown-amount'?amount==='—':amount.includes('800'),'amount-'+variant);
      check(await root.locator('[data-booking-status-notes-row]').isVisible()===(variant==='long'),'notes-conditional-'+variant);
      if(variant==='processing')check((await root.locator('[data-booking-status-title]').innerText()).includes('verificando'),'processing-copy');
      const clock=page.locator('[data-airport-mobile-deadline]');
      if(variant==='pending') {
        await clock.evaluate(n=>window.__sameDeadline=n);const first=await clock.innerText();await page.waitForTimeout(1100);
        await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy')));await paint();
        check(await clock.evaluate(n=>n===window.__sameDeadline),'clock-node-preserved');check(await clock.innerText()!==first,'clock-does-not-restart');
        check(await pay.innerText()==='Continuar con el pago','resume-payment-label');
      }
      await shot('retorno-'+variant);await root.locator('[data-booking-cancelled-mobile-panel]').evaluate(n=>n.scrollTop=n.scrollHeight);await shot('retorno-'+variant+'-final');
      report.returnStates.push({variant,amount,payVisible:await pay.isVisible()});
      if(variant==='pending') {
        const request=page.waitForRequest(r=>r.url().endsWith('/retry-checkout') && r.method()==='POST');
        await pay.click();check((await request).postDataJSON().token==='synthetic-four-fixes','retry-same-reservation');
        await page.waitForURL('https://checkout.stripe.com/c/pay/synthetic-retry');
        check(await page.title()==='Controlled payment boundary','retry-controlled-boundary');
      }
    }
    // Enlarge actual text boxes; this is a layout stress, not an iPhone zoom claim.
    const enlarged=await page.locator('[data-airport-return]').evaluate(root=>{
      for(const n of root.querySelectorAll('h1,h2,dt,dd,p,a,button'))n.style.fontSize=parseFloat(getComputedStyle(n).fontSize)*1.5+'px';
      const panel=root.querySelector('[data-booking-cancelled-mobile-panel]');panel.scrollTop=0;
      return {width:panel.clientWidth,scrollWidth:panel.scrollWidth,height:panel.clientHeight,scrollHeight:panel.scrollHeight};
    });check(enlarged.scrollWidth<=enlarged.width+1,'enlarged-text-no-horizontal-clipping');
    report.enlargedText={...enlarged,factor:1.5,method:'synthetic CSS text enlargement'};await shot('retorno-texto-ampliado');
    await page.locator('[data-booking-cancelled-mobile-panel]').evaluate(n=>n.scrollTop=(n.scrollHeight-n.clientHeight)/2);await shot('retorno-texto-ampliado-medio');
    await page.locator('[data-booking-cancelled-mobile-panel]').evaluate(n=>n.scrollTop=n.scrollHeight);await shot('retorno-texto-ampliado-final');
    statusBody=fixtures.status({source:{airport_transfer_date:'2027-01-14',airport_transfer_time:'12:30'},selected:model,amount:80000,service:'airport_transfer',state:'confirmed',canModify:false,canRetry:false});
    await page.goto(origin+'/booking-success.html?token=synthetic-four-fixes');await page.locator('[data-airport-return]').waitFor();await paint();
    check((await page.locator('[data-airport-return] [data-booking-status-payment]').innerText()).includes('Pagado'),'success-route-authoritative-paid');await shot('retorno-success-confirmado');
  }
  check(stats().checkouts.length===0 && stats().retries===(before?0:1) && stats().writes===0,'no-real-business-dispatch-one-controlled-retry');
  report.checks.push({name:'four-iphone-defects',result:before?'BASELINE_CAPTURED':'PASS'});
};
