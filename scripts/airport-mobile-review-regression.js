/* Review continuation, called only by the existing intercepted Airport smoke. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async function({page,context,origin,output,before,webkit,model,explorer,errors,fixture,stats,report,load,data,fillContact,available,shot,until}) {
  const stateOnly=process.argv.includes('--review-state-only');
  if(process.argv.includes('--review-uncertainty')) {
    const pay=()=>page.locator('[data-airport-pay]');
    const recovery=()=>page.getByRole('button',{name:'Comprobar estado del pago',exact:true});
    const errorText=()=>page.locator('.airport-booking__notice').allTextContents();
    const inspect=()=>page.evaluate(()=>({
      total:document.querySelector('.airport-booking__total')?.textContent,
      message:document.querySelector('.airport-booking__notice')?.textContent || '',
      actions:Array.from(document.querySelectorAll('.airport-booking__summary button')).map(n=>({label:n.textContent,disabled:n.disabled})),
      attempt:!!window.PixkuyFleetSelection.read('airport_transfer').attempt,
      offerValid:window.PixkuyFleetSelection.airportOfferStatus().valid
    }));
    const capture=async name=>{
      await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop=0);await shot(name);
      const height=await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollHeight);
      await page.setViewportSize({width:390,height:Math.max(700,height)});await shot(name+'-completa');
      await page.setViewportSize({width:390,height:700});
    };
    const ready=async()=>{
      await until(()=>pay().count().then(async n=>n>0 && await pay().isEnabled() && await pay().innerText()==='Continuar al pago'),'Ready without extra check');
      assert((await page.locator('.airport-booking__total').innerText()).includes('800'));
      assert(!(await errorText()).join(' ').includes('resultado del intento'));
    };
    const retryAvailability=async()=>{
      fixture({});await page.getByRole('button',{name:'Reintentar comprobación',exact:true}).click();await ready();
      assert.equal(stats().checkouts.length,0,'Availability recovery never dispatches checkout');
    };
    await load(390,700);await data();await fillContact();await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);await ready();
    report.normal=await inspect();assert.equal(report.normal.attempt,false);assert.equal(stats().checkouts.length,0);
    await capture('revision-normal');report.checks.push({name:'normal-review-zero-checkout',result:'PASS'});
    await page.evaluate(()=>{window.__advanceAirportClock(301000);window.PixkuyFleetSelection.expireAirportOfferIfNeeded();});
    await page.reload();await ready();
    assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
    report.reloaded=await inspect();assert.equal(report.reloaded.attempt,false);assert.equal(stats().checkouts.length,0);
    report.checks.push({name:'reload-expired-draft-no-transaction-preserves-fields-consent',result:'PASS'});
    // Genuine failure at durable-storage boundary: fetchCheckout must refuse send.
    // This only affects this isolated browser context, never user storage.
    await page.evaluate(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key==='pixkuy_fleet_b:airport_transfer' && JSON.parse(value).attempt) {
          Storage.prototype.setItem=original;
          throw new DOMException('Synthetic storage capacity failure','QuotaExceededError');
        }
        return original.call(this,key,value);
      };
    });
    await pay().click();
    await until(()=>errorText().then(values=>values.length>0),'Pre-dispatch failure visible');
    report.storageBeforeDispatch=await inspect();assert.equal(report.storageBeforeDispatch.attempt,false);assert.equal(stats().checkouts.length,0);
    await capture('revision-fallo-antes-de-envio');
    if(before) {
      assert(report.storageBeforeDispatch.message.includes('resultado del intento'));
      assert(report.storageBeforeDispatch.actions.every(n=>n.disabled));assert.equal(await recovery().count(),0);
      report.checks.push({name:'reproduced-uncertain-without-attempt-or-recovery',result:'PASS'});return;
    }
    assert(!report.storageBeforeDispatch.message.includes('resultado del intento'));await retryAvailability();
    // Typed HTTP failure and an untyped async prepare failure are distinct cases.
    fixture({mode:'technical'});await pay().click();
    await until(()=>errorText().then(values=>values.join(' ').includes('disponibilidad')),'Precheck error classified');
    report.precheckFailure=await inspect();assert.equal(report.precheckFailure.attempt,false);
    assert(!report.precheckFailure.message.includes('resultado del intento'));await capture('revision-error-disponibilidad');await retryAvailability();
    report.untypedPrepare=[];
    for(const synchronous of [false,true]) {
      await page.evaluate(sync=>{const original=window.PixkuyAirportCheckout.prepare;window.PixkuyAirportCheckout.prepare=function(){window.PixkuyAirportCheckout.prepare=original;const error=new Error('CONTROLLED_UNTYPED_PREPARE_FAILURE');if(sync)throw error;return Promise.reject(error);};},synchronous);
      await pay().click();await until(()=>errorText().then(values=>values.join(' ').includes('disponibilidad')),'Untyped prepare remains nontransactional');
      const observed=await inspect();report.untypedPrepare.push({synchronous,...observed});assert.equal(observed.attempt,false);await retryAvailability();
    }
    report.checks.push({name:'storage-and-typed-untyped-precheck-errors-no-payment-uncertainty',result:'PASS'});
    report.desktop=[];
    for(const width of [721,1440]) {
      await page.setViewportSize({width,height:1000});await ready();fixture({mode:'technical'});await pay().click();
      await until(()=>errorText().then(values=>values.join(' ').includes('disponibilidad')),'Desktop precheck classification');
      const observed=await inspect();assert.equal(observed.attempt,false);assert(!observed.message.includes('resultado del intento'));
      report.desktop.push({width,...observed});await retryAvailability();
    }
    await page.setViewportSize({width:390,height:700});await ready();
    report.checks.push({name:'shared-checkout-desktop-721-1440-precheck-error-and-recovery',result:'PASS'});
    fixture({checkout:'lost'});
    await pay().evaluate(n=>{n.click();n.click();});await recovery().waitFor();await until(()=>recovery().isEnabled(),'Recovery enabled');
    assert.equal(stats().checkouts.length,1,'One original attempt despite double click');
    report.lostCheckout=await inspect();assert(report.lostCheckout.attempt);assert.equal(await pay().count(),0);
    assert(report.lostCheckout.message.includes('resultado del intento'));await capture('revision-intento-incierto');
    const original=stats().checkouts[0];
    fixture({checkout:'unknown'});await recovery().evaluate(n=>{n.click();n.click();});
    await until(()=>stats().checkouts.length===2 && recovery().isEnabled(),'Failed recovery settles');
    assert.deepEqual(stats().checkouts[1],original,'Same key and frozen payload on explicit recovery');
    report.failedRecovery=await inspect();assert(report.failedRecovery.attempt);assert.equal(await pay().count(),0);
    assert(report.failedRecovery.actions.some(n=>n.label==='Comprobar estado del pago' && !n.disabled));await capture('revision-recuperacion-fallida');
    const count=stats().checkouts.length;await page.waitForTimeout(500);assert.equal(stats().checkouts.length,count,'No automatic replay loop');
    await page.reload();await recovery().waitFor();assert.equal(stats().checkouts.length,count,'Reload does not dispatch');
    report.pendingReload=await inspect();assert(report.pendingReload.attempt);assert.equal(await pay().count(),0);
    assert(report.pendingReload.message.includes('resultado del intento'));assert.equal(report.pendingReload.total,'Total—');
    // The existing top Back remains operative; it neither deletes nor replaces the attempt.
    await page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
    await page.evaluate(()=>{location.hash='#airport/revision';});await recovery().waitFor();
    fixture({checkout:'status'});await recovery().click();await page.waitForURL(/booking-success\.html/);
    assert.equal(stats().checkouts.length,count+1);assert.deepEqual(stats().checkouts.at(-1),original,'Recovery retains original identity through reload/back');
    report.recovery={sameKeyAndPayload:true,navigatedToExistingStatus:true,controlledRequests:stats().checkouts.length,realBusinessWrites:stats().writes};
    report.checks.push({name:'real-dispatched-unknown-recovery-failure-reload-same-attempt-status',result:'PASS'});
    assert.equal(stats().writes,0);assert.deepEqual(errors,[]);return;
  }
  if(webkit) {
    if(before) {
      const folder=path.resolve(output,'../../..');
      const bindings=JSON.parse((await fs.readFile(path.join(folder,'bindings-before.json'),'utf8')).replace(/^\uFEFF/,''));
      const paths=new Map(bindings.filter(n=>!n.path.startsWith('scripts/')).map(n=>['/'+n.path,path.join(folder,'preimages',n.path)]));
      await context.route(origin+'/**',route=>{const file=paths.get(new URL(route.request().url()).pathname);return file?route.fulfill({path:file}):route.fallback();});
    }
    for(const width of [320,360,390,430]) {
      await load(width,700);const date=await page.locator('#airport-tariff-date').inputValue();
      for(const state of ['selected','empty','editing']) {
        if(state==='empty'){await page.locator('#airport-tariff-date').fill('');await page.locator('#airport-tariff-time').fill('');}
        if(state==='editing'){await page.locator('#airport-tariff-date').fill(date);await page.locator('#airport-tariff-time').fill('12:31');await page.locator('#airport-tariff-time').focus();}
        await page.locator('#airport-tariff-date').scrollIntoViewIfNeeded();await shot('trayecto-'+width+'-'+state);
        assert.equal(await page.locator('#airport-tariff-date').getAttribute('type'),'date');assert.equal(await page.locator('#airport-tariff-time').getAttribute('type'),'time');
      }
    }
    report.checks.push({name:'webkit-mobile-emulation-native-states',result:'PASS',limit:'Not physical Safari/iPhone'});
    assert.equal(stats().checkouts.length,0);assert.equal(stats().writes,0);assert.deepEqual(errors,[]);return;
  }
  const back=()=>page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();
  const scroller=()=>page.locator('.airport-mobile-route__content');
  const state=()=>page.evaluate(()=>({offer:window.PixkuyFleetSelection.airportOfferStatus(),hash:location.hash,text:document.querySelector('.airport-booking')?.innerText,cta:document.querySelector('[data-airport-pay]')?.textContent}));
  const expire=()=>page.evaluate(()=>{window.__advanceAirportClock(301000);window.PixkuyFleetSelection.expireAirportOfferIfNeeded();});
  const review=async()=>{await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);};
  async function capture(name) {
    await scroller().evaluate(n=>n.scrollTop=0);await page.waitForTimeout(100);await shot(name);
    const measure=await page.locator('.airport-booking').evaluate(n=>{
      const s=document.querySelector('.airport-mobile-route__content'),b=n.querySelector('[data-airport-pay]'),r=b?.getBoundingClientRect();
      return {height:n.getBoundingClientRect().height,viewport:innerHeight,scroll:Math.max(0,s.scrollHeight-s.clientHeight),ctaTop:r?.top,ctaBottom:r?.bottom,ctaHeight:r?.height,width:n.clientWidth,scrollWidth:n.scrollWidth};
    });
    if(await page.locator('[data-airport-pay]').count()) {await page.locator('[data-airport-pay]').scrollIntoViewIfNeeded();await shot(name+'-inferior');}
    const viewport=page.viewportSize();
    const fullHeight=await scroller().evaluate(n=>n.scrollHeight);
    await page.setViewportSize({width:viewport.width,height:Math.max(viewport.height,fullHeight)});await scroller().evaluate(n=>n.scrollTop=0);await shot(name+'-completa');
    await page.setViewportSize(viewport);return measure;
  }
  const cdp=webkit?null:await context.newCDPSession(page);
  async function nativeGeometry() {
    if(!cdp) return [];
    const {root}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});const boxes=[];
    async function visit(n,owner) {
      const a={};for(let i=0;i<(n.attributes||[]).length;i+=2)a[n.attributes[i]]=n.attributes[i+1];
      if(['airport-tariff-date','airport-tariff-time'].includes(a.id))owner=a.id;
      if(owner && (a.id===owner || /-webkit-datetime-edit-(day|month|year|hour|minute)-field/.test(a.pseudo||''))) {
        const b=await cdp.send('DOM.getBoxModel',{nodeId:n.nodeId}).catch(()=>null);if(b)boxes.push({owner,pseudo:a.pseudo||a.id,border:b.model.border});
      }
      for(const child of [...(n.children||[]),...(n.shadowRoots||[])])await visit(child,owner);
    }
    await visit(root,null);
    return ['airport-tariff-date','airport-tariff-time'].map(owner=>{
      const input=boxes.find(b=>b.pseudo===owner),fields=boxes.filter(b=>b.owner===owner && b.pseudo!==owner);
      const left=Math.min(...fields.map(b=>b.border[0])),right=Math.max(...fields.map(b=>b.border[2]));
      const top=Math.min(...fields.map(b=>b.border[1])),bottom=Math.max(...fields.map(b=>b.border[5]));
      return {owner,dx:(left+right-input.border[0]-input.border[2])/2,dy:(top+bottom-input.border[1]-input.border[5])/2};
    });
  }
  report.native=[];report.screens=[];
  for(const [width,height] of stateOnly?[]:[[320,448],[360,520],[390,700],[430,700]]) {
    await load(width,height);await page.locator('[data-airport-mobile-luggage-select]').selectOption('2');
    for(const nativeState of ['selected','empty','editing']) {
      const date=await page.locator('#airport-tariff-date').inputValue();
      if(nativeState==='empty') {await page.locator('#airport-tariff-date').fill('');await page.locator('#airport-tariff-time').fill('');}
      if(nativeState==='editing') {await page.locator('#airport-tariff-date').fill(new Date(Date.now()+7*86400000).toISOString().slice(0,10));await page.locator('#airport-tariff-time').fill('12:30');await page.locator('#airport-tariff-time').focus();}
      await page.locator('#airport-tariff-date').scrollIntoViewIfNeeded();
      const geometry=await nativeGeometry();report.native.push({width,nativeState,geometry});
      if(!before) for(const g of geometry){assert(Math.abs(g.dx)<=2,'Horizontal native center '+g.owner+' '+g.dx);assert(Math.abs(g.dy)<=2,'Vertical native center '+g.owner+' '+g.dy);}
      await shot('trayecto-'+width+'-'+nativeState);
      if(nativeState==='empty') await page.locator('#airport-tariff-date').fill(date);
    }
    await available();await data();await fillContact();
    await page.locator('#contact-name').blur();await shot('datos-'+width);
    await review();report.screens.push({viewportWidth:width,...await capture('revision-'+width)});
    if(!before) {
      assert.equal(await page.locator('.airport-booking__link').count(),0);
      assert.equal(await page.locator('[data-airport-mobile-contact-summary-row="zone"], [data-airport-mobile-contact-summary-row="fare"]').count(),0);
      assert.equal(await page.locator('.airport-booking__total').count(),1);
      assert(await page.locator('[data-airport-pay]').isEnabled());
    }
    await back();assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
    await back();assert(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid));
  }
  if(!stateOnly) report.checks.push({name:'review-composition-native-centers-useful-viewports',result:'PASS'});
  report.desktop=[];
  for(const width of stateOnly?[]:[721,1440]) {
    await load(width,1000);await data();await fillContact();await page.locator('#contact-name').blur();
    const shape=()=>page.locator('.airport-booking').evaluate(n=>({html:n.outerHTML.replace(/legal_acceptance_accepted_at[^>]+/g,''),height:n.clientHeight,width:n.clientWidth}));
    const item={width,data:await shape()};await review();item.review=await shape();report.desktop.push(item);
    await page.screenshot({path:path.join(output,'desktop-'+width+'.png'),fullPage:true});
    if(!before){const prior=JSON.parse(await fs.readFile(path.join(output,'../before/results.json'),'utf8')).desktop.find(n=>n.width===width);assert.deepEqual(item,prior);}
  }
  await load();await data();await fillContact();await review();
  report.diagnosis={initial:await state(),prechecksBeforeExpiry:stats().prechecks};
  fixture({delay:()=>600});await expire();await page.waitForTimeout(100);
  report.diagnosis.afterExpiry=await state();report.diagnosis.prechecksAfterExpiry=stats().prechecks;
  await shot('oferta-caducada');
  if(before){await page.locator('[data-airport-pay]').click();await page.waitForTimeout(60);report.diagnosis.manualPending=await state();await shot('reintento-pendiente');}
  await until(()=>page.locator('[data-airport-pay]').innerText().then(t=>t==='Continuar al pago'),'Revalidation returns ready');
  report.diagnosis.afterCheck=await state();
  if(before) {
    fixture({});const count=stats().prechecks;await page.reload();await page.locator('.airport-booking').waitFor();await page.waitForTimeout(300);
    report.diagnosis.afterReload=await state();report.diagnosis.reloadRequests=stats().prechecks-count;await shot('revision-recarga-pendiente');
  } else {
    assert.equal(report.diagnosis.prechecksAfterExpiry,report.diagnosis.prechecksBeforeExpiry+1,'One automatic recheck');
    assert.equal(report.diagnosis.afterExpiry.cta,'Comprobando disponibilidad…');
    report.checks.push({name:'expiry-automatic-single-request-visible-transition',result:'PASS'});
    const validCount=stats().prechecks;
    await back();await page.evaluate(()=>{location.hash='#airport/revision';});
    await page.locator('[data-airport-pay]').waitFor();await page.waitForTimeout(150);
    assert.equal(stats().prechecks,validCount,'Review reuses valid exact-context offer');assert(await page.locator('[data-airport-pay]').isEnabled());
    await page.addInitScript(()=>{
      window.__reviewTrace=[];
      for(const event of ['pixkuy:fleet-offer-invalidated','pixkuy:fleet-offer-accepted','pixkuy:airport-trip-changed'])document.addEventListener(event,()=>window.__reviewTrace.push({event,at:performance.now(),key:window.PixkuyFleetSelection?.airportOfferStatus(),stack:new Error().stack}));
    });
    fixture({delay:()=>500});await page.reload();await page.locator('.airport-booking').waitFor();
    await until(()=>page.locator('[data-airport-pay]').isEnabled(),'Reload resolves pending state automatically');
    report.reloadTrace=await page.evaluate(()=>window.__reviewTrace);report.reloadState=await state();
    assert.equal(await page.locator('[data-airport-pay]').innerText(),'Continuar al pago');
    assert.equal(stats().prechecks,validCount+1,'Reload shares the pertinent request');
    report.checks.push({name:'valid-offer-reentry-reload-no-duplicate',result:'PASS'});
    for(const mode of ['technical','unavailable']) {
      fixture({mode,delay:()=>450});const count=stats().prechecks;await expire();
      await until(()=>page.locator('[data-airport-pay]').innerText().then(t=>t==='Comprobando disponibilidad…'),'Visible checking');
      assert(await page.locator('[data-airport-pay]').isDisabled());
      await until(()=>page.locator('.airport-booking__notice:not(.airport-mobile-review__status)').count().then(n=>n>0),'Failure explained');
      await page.waitForTimeout(800);assert.equal(stats().prechecks,count+1,'No automatic retry loop');
      await capture('revision-'+mode);
      if(mode==='technical') {
        assert.equal(await page.locator('[data-airport-pay]').innerText(),'Reintentar comprobación');
        await page.locator('[data-airport-pay]').click();await until(()=>page.locator('[data-airport-pay]').innerText().then(t=>t==='Comprobando disponibilidad…'),'Retry progress');
        await until(()=>page.locator('[data-airport-pay]').innerText().then(t=>t==='Reintentar comprobación'),'Persistent failure visible');
        assert.equal(stats().prechecks,count+2);fixture({});
        if(stateOnly) {
          // A concurrent existing consumer has already obtained a valid offer.
          await page.evaluate(()=>window.PixkuyAirportCheckout.prepare({interactive:false}));
          report.freshRetryRequests=stats().prechecks;
        }
        await page.locator('[data-airport-pay]').click();
        await until(()=>page.locator('[data-airport-pay]').innerText().then(t=>t==='Continuar al pago'),'Explicit recovery succeeds');
        if(stateOnly) assert.equal(stats().prechecks,report.freshRetryRequests,'Explicit retry reuses the now-valid offer and clears stale error');
      } else {
        assert(await page.locator('[data-airport-pay]').isDisabled());await back();await back();
        assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
        fixture({});await page.locator('#airport-tariff-time').fill('13:30');await available();await data();await review();
      }
    }
    report.checks.push({name:'persistent-technical-explicit-bounded-retry-unavailable-back',result:'PASS'});
    fixture({price:90000});await expire();
    await page.getByRole('button',{name:'Aceptar nueva oferta',exact:true}).waitFor();
    assert((await page.locator('.airport-booking').innerText()).includes('900 MXN'));assert.equal(stats().checkouts.length,0);
    await capture('revision-cambio-precio');
    await page.getByRole('button',{name:'Aceptar nueva oferta',exact:true}).click();await page.waitForURL(/#airport\/datos$/);await review();
    await until(()=>page.locator('.airport-booking__total').innerText().then(t=>t.includes('900 MXN')),'Accepted price is displayed after validation');
    report.acceptedPrice=await state();
    fixture({models:[explorer]});await expire();await page.waitForURL(/#airport\/traslado$/);
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer')),null);
    const confirm=page.locator('#services-expand-airport [data-fleet-selection] button');await confirm.waitFor();await confirm.click();await available();await data();await review();
    assert((await page.locator('.airport-booking').innerText()).includes('Ford Explorer'));
    report.checks.push({name:'price-confirmation-model-explicit-choice-preserved',result:'PASS'});
    fixture({mode:'technical',models:[explorer],delay:()=>900});await expire();await page.waitForTimeout(80);await back();await back();
    fixture({models:[explorer]});await page.locator('#airport-tariff-time').fill('14:30');await available();await data();await review();await page.waitForTimeout(1000);
    assert.equal(await page.locator('[data-airport-pay]').innerText(),'Continuar al pago');assert((await page.locator('.airport-booking').innerText()).includes('14:30'));
    report.checks.push({name:'late-response-discarded-after-real-trip-change',result:'PASS'});
    for(const index of [0,1,2]) {
      const link=page.locator('.airport-booking__conditions a').nth(index);await link.scrollIntoViewIfNeeded();const scroll=await scroller().evaluate(n=>n.scrollTop);
      assert((await link.boundingBox()).height>=44);await link.click();await page.locator('#pixkuy-legal-overlay[data-open="1"]').waitFor();await page.keyboard.press('Escape');
      await until(()=>page.locator('#pixkuy-legal-overlay[data-open="1"]').count().then(n=>n===0),'Legal closes');
      assert(await link.evaluate(n=>document.activeElement===n));assert.equal(await scroller().evaluate(n=>n.scrollTop),scroll);
    }
    await back();await page.setViewportSize({width:320,height:448});
    await page.locator('#contact-name').fill('Ana María de los Ángeles García López');await page.locator('#contact-email').fill('ana.maria.garcia.lopez@departamentodeviajes.example.com');
    await page.locator('#contact-message').click();await page.locator('[data-airport-mobile-notes-editor-input]').fill('');await page.locator('[data-airport-mobile-notes-editor-close]').click();await review();
    assert.equal(await page.locator('.airport-mobile-review__notes').count(),0);await capture('revision-sin-notas-largos');
    await back();await page.locator('#contact-message').click();await page.locator('[data-airport-mobile-notes-editor-input]').fill('Punto de encuentro y datos del vuelo. '.repeat(12));await page.locator('[data-airport-mobile-notes-editor-close]').click();await review();
    // Text enlargement, without replacing any product layout or controls.
    await page.addStyleTag({content:'.airport-booking{font-size:125% !important}.airport-booking :is(p,dt,dd,a,button,strong,h1){font-size:inherit !important}'});
    const enlarged=await capture('revision-texto-ampliado-notas-largas');assert(enlarged.scroll>0);assert(enlarged.scrollWidth<=enlarged.width+1);
    assert((await page.locator('[data-airport-pay]').boundingBox()).height>=44);
    assert.equal(await page.locator('.whatsapp-floating:visible').count(),0);await back();await back();assert.equal(await page.locator('.whatsapp-floating:visible').count(),0);
    report.checks.push({name:'legal-documents-focus-44px-long-contact-notes-enlargement-whatsapp',result:'PASS'});
  }
  assert.equal(stats().checkouts.length,0);assert.equal(stats().writes,0);assert.deepEqual(errors,[]);
};
