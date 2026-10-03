/* Scenarios for smoke-airport-desktop-booking.js --mobile-phase1.
 * Uses its existing browser, local runner and intercepted precheck fixtures.
 * No server, database, checkout or external provider is opened here.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async function ({page,origin,output,baseline,model,errors,fixture,stats}) {
  const panel = '#services-expand-airport';
  const main = page.locator(panel+' .services-expand__actions .services-expand__cta');
  const content = page.locator('.airport-mobile-route__content');
  const report = {mode:baseline?'baseline':'regression',runner:origin,backend:'controlled responses, no business writes',checks:[],layouts:[]};
  const alt = {...model,modelId:'00000000-0000-4000-8000-000000000002',name:'Vehículo alternativo de denominación comercial larga para pasajeros y equipaje — selección explícita',photoUrl:null};
  const date = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  page.setDefaultTimeout(5000);
  async function until(predicate, label) {
    const limit=Date.now()+6000;
    while (!await predicate()) {
      assert(Date.now()<limit,label);
      await page.waitForTimeout(30);
    }
  }
  async function state() { return page.locator(panel).getAttribute('data-airport-mobile-availability-state'); }
  async function settled() { await until(async()=>['available','unavailable','error','choice'].includes(await state()),'Precheck settles'); }
  async function edit(value,events=['change']) {
    await page.locator('#airport-tariff-time').evaluate((node,{value,events})=>{
      node.value=value;
      events.forEach(type=>node.dispatchEvent(new Event(type,{bubbles:true})));
    },{value,events});
  }
  async function load(width=390,height=844,offers=[model]) {
    fixture({models:offers});
    await page.setViewportSize({width,height});
    await page.goto(origin+'/');
    await page.evaluate(()=>sessionStorage.clear());
    await page.goto(origin+'/?service=airport_hotel#services');
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyFleetSelection && window.PixkuyAirportMobileBookingFlow);
    await page.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
    if (width<=720) await page.locator('[data-airport-mobile-route]:not([hidden])').waitFor();
    await page.evaluate(()=>{
      window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel MX Condesa — Salamanca 35, Roma Norte',zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});
    });
    if (width<=720) await page.locator('[data-airport-mobile-passengers-select]').selectOption('van_1_2');
    else await page.locator('[data-airport-tariff-fare-key="van_1_2"]').first().click();
    await page.locator('#airport-tariff-date').fill(date);
    await edit('12:30');
    await settled();
  }
  async function screenshot(name) { await page.screenshot({path:path.join(output,name+'.png'),fullPage:false}); }
  async function layout(name) {
    await content.evaluate(node=>{node.scrollTop=0;});
    await screenshot(name+'-top');
    const before=await content.evaluate(node=>({client:node.clientHeight,height:node.scrollHeight,width:node.clientWidth,scrollWidth:node.scrollWidth,overflow:getComputedStyle(node).overflowY}));
    const box=await content.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.wheel(0,3000);
    await page.waitForTimeout(250);
    const visible=await main.evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;});
    const after=await content.evaluate(node=>({scrollTop:node.scrollTop,bodyOverflow:getComputedStyle(document.body).overflowY}));
    const result={name,...before,...after,ctaReachableByWheel:visible};
    report.layouts.push(result);
    await screenshot(name+'-bottom');
    if (!baseline) {
      assert(before.scrollWidth<=before.width+1,'No horizontal scroll: '+name);
      assert(visible,'Main action reachable with normal scroll: '+name);
      assert.equal(before.overflow,'auto','One main mobile scroller');
      assert.equal(after.bodyOverflow,'hidden','Background stays locked');
      const fare=page.locator(panel+' .services-expand__field--fare:visible');
      if (await fare.count()) assert(await fare.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Fare fits its column: '+name);
    }
  }
  try {
    await load();
    fixture({delay:()=>180});
    const equivalentStart=stats().prechecks;
    await edit('12:31',['input','change']);
    await settled();
    report.checks.push({name:'equivalent-input-change',state:await state(),requests:stats().prechecks-equivalentStart,mainEnabled:await main.isEnabled()});
    await screenshot('equivalent-input-change');
    if (!baseline) {
      assert.equal(await state(),'available');
      assert.equal(stats().prechecks-equivalentStart,1,'Equivalent events deduplicate');
      assert(await main.isEnabled());
      const dateStart=stats().prechecks;
      await page.locator('#airport-tariff-date').fill(new Date(Date.now()+8*86400000).toISOString().slice(0,10));
      await settled();
      assert.equal(await state(),'available');
      assert.equal(stats().prechecks-dateStart,1,'Date input/change also deduplicates');
      report.checks.push({name:'equivalent-date-input-change',result:'PASS'});
    }

    for (const [width,height] of [[320,568],[360,640],[390,844],[430,844],[720,900]]) {
      await load(width,height,[model,alt]);
      await page.locator(panel+' input[value="'+model.modelId+'"]').check();
      await settled();
      await layout(width+'x'+height+'-multiple');
    }
    await load(390,844,[model,alt]);
    await page.locator(panel+' input[value="'+model.modelId+'"]').check();
    await settled();
    fixture({models:[alt]});
    await edit('12:32');
    await until(()=>page.locator(panel+' [data-fleet-selection] button').count(),'Explicit replacement appears');
    const confirm=page.locator(panel+' [data-fleet-selection] button');
    report.checks.push({name:'explicit-replacement',text:await confirm.innerText(),enabled:await confirm.isEnabled(),selection:await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer'))});
    await screenshot('explicit-replacement');
    if (!baseline) {
      assert((await confirm.innerText()).includes('Confirmar modelo'));
      assert(await confirm.isEnabled());
      assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer')),null);
      assert(await main.isDisabled());
      await confirm.click();
      await until(()=>main.isEnabled(),'Main CTA enabled after explicit alternative confirmation');
      assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer').model_id),alt.modelId);
      await screenshot('alternative-confirmed');
    }
    if (baseline) return;

    await load();
    const raceStart=stats().prechecks;
    fixture({delay:(_payload,id)=>id===raceStart+1?1100:id===raceStart+2?650:60});
    await edit('13:00',['input','change']);
    await until(()=>stats().prechecks===raceStart+1,'First A dispatched');
    await edit('13:01',['input','change']);
    await until(()=>stats().prechecks===raceStart+2,'B dispatched');
    await edit('13:00',['input','change']);
    await until(()=>stats().prechecks===raceStart+3,'New A dispatched');
    await settled();
    const currentOffer=await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').offer.requestKey);
    await until(()=>stats().requests.slice(-3).every(item=>item.settled),'All late replies delivered');
    await page.waitForTimeout(100);
    assert.equal(await state(),'available');
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').offer.requestKey),currentOffer);
    assert.equal(currentOffer,'offer-'+(raceStart+3));
    report.checks.push({name:'A-B-A-late-responses',result:'PASS',requests:stats().requests.slice(-3)});

    for (const [mode,offers,expected,time] of [['unavailable',[], 'unavailable','14:00'],['technical',[model],'error','14:01'],['available',[model],'available','14:02']]) {
      fixture({mode,models:offers}); await edit(time,['input','change']); await settled();
      assert.equal(await state(),expected);
      assert.equal(await main.isEnabled(),expected==='available');
      if (expected!=='available') assert.equal(await page.locator(panel+' .services-expand__field--fare:visible').count(),0,'No empty fare block in error/unavailable state');
      await screenshot(mode);
      report.checks.push({name:mode,result:'PASS'});
    }

    await layout('gallery-return-before');
    await page.locator('[data-airport-mobile-vehicle-gallery-trigger]').click();
    await page.locator('[data-airport-mobile-vehicle-gallery]:not([hidden])').waitFor();
    assert.equal(await content.evaluate(node=>getComputedStyle(node).overflowY),'hidden');
    await page.locator('[data-airport-mobile-vehicle-gallery-close]').click();
    await layout('gallery-return-after');
    await page.locator('[data-airport-tariff-control="origin"]').click();
    await page.locator('[data-airport-mobile-airport-picker]:not([hidden])').waitFor();
    await page.locator('[data-airport-mobile-airport-picker-close]').click();
    await layout('picker-return');

    for (let cycle=0;cycle<2;cycle++) {
      await page.locator('[data-airport-mobile-flow-back]').click();
      assert.equal(await page.evaluate(()=>window.PixkuyAirportMobileBookingFlow.isOpen()),false);
      assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).position),'fixed');
      await page.evaluate(()=>window.PixkuyAirportMobileBookingFlow.open());
      await page.locator('[data-airport-mobile-route]:not([hidden])').waitFor();
      const start=stats().prechecks;
      await edit('15:0'+cycle,['input','change']); await settled();
      assert.equal(stats().prechecks-start,1,'One dispatch after each reopen');
      assert.equal(await page.locator('#services-expand-airport').count(),1);
      assert.equal(await page.locator('[data-airport-mobile-route]').count(),1);
      await layout('reopen-'+cycle);
    }
    report.checks.push({name:'gallery-picker-exit-reopen',result:'PASS'});

    await load(320,568,[{...model,name:'Modelo '+ 'denominación-extensa-'.repeat(8)}]);
    await page.evaluate(()=>{
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:'Hotel y centro de convenciones — '+ 'dirección-detallada-'.repeat(8),zoneId:'roma_condesa',placeId:'synthetic-long-place',primaryType:'lodging',lat:19.418,lng:-99.169});
    });
    await settled();
    // Synthetic translated copy stress; this does not certify translations.
    await page.locator('[data-airport-tariff-control="origin"]').evaluate(node=>{node.textContent='Aeropuerto Internacional — '+ 'denominación-completa-'.repeat(6);});
    await main.evaluate(node=>{node.textContent='Continuar con los datos de contacto del pasajero principal';});
    await layout('320-long-airport-address-model-copy');
    const longTextGeometry=await page.locator(panel).evaluate(root=>{
      const selectors=['[data-airport-tariff-control="origin"]','.services-expand__destination-resolved-label','.airport-mobile-vehicle-gallery-trigger__label','.services-expand__actions .services-expand__cta'];
      return selectors.map(selector=>{
        const node=Array.from(root.querySelectorAll(selector)).find(item=>item.getBoundingClientRect().height>0);
        if (!node) return {selector,visible:false};
        const rect=node.getBoundingClientRect();
        return {selector,width:node.clientWidth,scrollWidth:node.scrollWidth,height:node.clientHeight,scrollHeight:node.scrollHeight,visible:rect.height>0};
      });
    });
    for(const geometry of longTextGeometry) {
      assert(geometry.visible,geometry.selector);
      assert(geometry.scrollHeight<=geometry.height+1,'Text height grows: '+geometry.selector);
      assert(geometry.scrollWidth<=geometry.width+1,'Long words wrap: '+geometry.selector);
    }
    fixture({mode:'technical'}); await edit('17:00',['input','change']); await settled();
    await page.locator('[data-airport-tariff-availability]').evaluate(node=>{node.textContent='No se ha podido verificar la disponibilidad en este momento. '+ 'Vuelve a intentarlo conservando tus datos. '.repeat(6);});
    await layout('320-long-technical-error');
    assert.equal(await state(),'error'); assert(await main.isDisabled());
    const statusFits=await page.locator('[data-airport-tariff-availability]').evaluate(node=>node.scrollHeight<=node.clientHeight+1);
    assert(statusFits,'Long error fits without clipping');
    report.checks.push({name:'long-copy-no-clipping',result:'PASS',geometry:longTextGeometry});

    // Same shared fetchPrecheck contract, with deferred in-memory responses;
    // exercises Direct/Hourly generations without any HTTP/business operation.
    const shared=await page.evaluate(async()=>{
      const api=window.PixkuyFleetSelection,originalFetch=window.fetch,results=[];
      try {
        for (const service of ['direct_transfer','hourly_daily']) {
          const pending=[];
          window.fetch=()=>new Promise(resolve=>pending.push(resolve));
          const response=id=>new Response(JSON.stringify({result:{checkoutAllowed:true,fleet:{version:1,status:'available',requestKey:id,models:[{modelId:'shared-model',modelRevision:1,name:'Shared model'}]}}}),{status:200});
          const request=()=>api.fetchPrecheck(service,'/controlled-precheck',{body:JSON.stringify({date:'2030-01-01',time:'12:00'})}).then(()=> 'accepted',error=>error.message);
          const old=request(),duplicate=request();
          const deduplicated=pending.length===1;
          api.invalidateOffer(service);
          const latest=request();
          const count=pending.length;
          pending[pending.length-1](response('new'));
          if (pending.length>1) pending[0](response('old'));
          const outcome=await Promise.all([old,duplicate,latest]);
          window.fetch=originalFetch;
          results.push({service,deduplicated,count,outcome,offer:api.read(service).offer?.requestKey});
        }
      } finally { window.fetch=originalFetch; }
      return results;
    });
    for(const item of shared) {
      assert(item.deduplicated); assert.equal(item.count,2);
      assert.deepEqual(item.outcome,['FLEET_STALE_OFFER','FLEET_STALE_OFFER','accepted']);
      assert.equal(item.offer,'new');
    }
    report.checks.push({name:'shared-direct-hourly',result:'PASS',details:shared});

    await load(721,900);
    const desktopStart=stats().prechecks;
    fixture({delay:()=>150}); await edit('16:00',['input','change']);
    await until(()=>stats().prechecks>desktopStart,'Desktop precheck scheduled'); await settled();
    assert.equal(stats().prechecks-desktopStart,1);
    assert(await main.isEnabled());
    assert.equal(await page.locator('[data-airport-mobile-route]:not([hidden])').count(),0);
    assert(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid));
    await screenshot('721-desktop');
    report.checks.push({name:'721-desktop-certificate-dedup',result:'PASS'});
    await page.setViewportSize({width:720,height:900});
    await page.evaluate(()=>window.PixkuyAirportMobileBookingFlow.open());
    await page.locator('[data-airport-mobile-route]:not([hidden])').waitFor();
    await layout('720-from-desktop');
    await page.setViewportSize({width:721,height:900});
    await until(()=>page.locator('[data-airport-mobile-route]:not([hidden])').count().then(count=>count===0),'Desktop restores panel at breakpoint');
    assert.equal(await page.locator('#services-expand-airport').count(),1);
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).position),'fixed');
    report.checks.push({name:'720-721-live-transition',result:'PASS'});
    assert.equal(stats().writes,0,'No business requests attempted');
    assert.deepEqual(errors,[]);
    report.result='PASS';
  } catch(error) {
    report.result='FAIL'; report.failure=error.message;
    throw error;
  } finally {
    report.result ||= 'BASELINE_RECORDED';
    report.stats=stats(); report.errors=errors;
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({result:report.result,checks:report.checks.length,layouts:report.layouts.length,prechecks:stats().prechecks,writes:stats().writes,output}));
  }
};
