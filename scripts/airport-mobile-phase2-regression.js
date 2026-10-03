/* Phase 2 scenarios: existing smoke browser/routes only, intercepted dispatch. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async function({page,context,origin,output,desktopSelectionOnly,visualRestore,mobileRefinement,refinementBefore,refinementWebkit,reviewCompact,mobileIntegrated,integratedBefore,integratedWebkit,model,errors,fixture,stats}) {
  const report={checks:[],layouts:[],backend:'intercepted fixtures; no real business operations'};
  const panel='#services-expand-airport';
  const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const address='Hotel MX Condesa — Salamanca 35, Roma Norte, Ciudad de México';
  const explorer={...model,modelId:'00000000-0000-4000-8000-000000000002',name:'Ford Explorer',photoUrl:null};
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(15000);
  async function until(fn,label) { const limit=Date.now()+6500; while(!await fn()){assert(Date.now()<limit,label);await page.waitForTimeout(40);} }
  async function available() { await until(()=>page.locator(panel).getAttribute('data-airport-mobile-availability-state').then(value=>value==='available'),'Available offer'); }
  async function shot(name) { await page.waitForTimeout(80); await page.screenshot({path:path.join(output,name+'.png'),fullPage:false}); }
  const fontStyles=()=>page.evaluate(()=>['#airport-tariff-date','#airport-tariff-time','[data-airport-mobile-passengers-select]'].map(selector=>{const node=document.querySelector(selector),s=getComputedStyle(node),native=getComputedStyle(node,'::-webkit-datetime-edit');return {selector,fontSize:s.fontSize,fontFamily:s.fontFamily,fontWeight:s.fontWeight,lineHeight:s.lineHeight,nativeFontSize:native.fontSize};}));
  async function load(width=390,height=844,models=[model],lang='es',destination=address) {
    fixture({models}); await page.setViewportSize({width,height});
    await page.goto(origin+'/');
    if((refinementWebkit || integratedWebkit) && !process.argv.includes('--iphone-four-fixes')) await page.waitForLoadState('networkidle');
    // Recovery scenarios retain their synthetic state throughout reload/navigation.
    if(!process.argv.includes('--review-uncertainty') && !mobileIntegrated) await page.evaluate(()=>sessionStorage.clear());
    await page.goto(origin+'/?service=airport_hotel&lang='+lang);
    if((refinementWebkit || integratedWebkit) && !process.argv.includes('--iphone-four-fixes')) await page.waitForLoadState('networkidle');
    await page.waitForFunction(()=>window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    if(process.argv.includes('--iphone-four-fixes')) await page.evaluate(()=>window.PixkuyAirportDesktopView.ready);
    await page.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
    await page.evaluate(address=>{
      window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
      window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:address,zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});
    },destination);
    if(width>720) await page.locator('[data-airport-tariff-fare-key="van_1_2"]').first().click();
    await page.locator('#airport-tariff-date').fill(date);
    await page.locator('#airport-tariff-time').fill('12:30');
    if (models.length>1) await page.locator(panel+' input[value="'+models[0].modelId+'"]').check();
    await available();
  }
  async function data() {
    await page.locator(panel+' .services-expand__actions .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('.airport-booking #contact-name').waitFor({state:'visible'});
  }
  async function editTrip() {
    if(page.viewportSize().width>720) return page.locator('.airport-booking__step-action').first().click();
    if(new URL(page.url()).hash.includes('/revision')) await editData();
    return page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();
  }
  async function editData() {
    return page.locator(page.viewportSize().width>720?'.airport-booking__step-action':'.airport-booking > .airport-mobile-flow__back-row button').nth(page.viewportSize().width>720?1:0).click();
  }
  function screenScroller() {return page.locator(page.viewportSize().width>720?'.airport-booking':'.airport-mobile-route__content');}
  async function fillContact() {
    await page.locator('#contact-name').fill('Ana García');
    await page.locator('#contact-phone').fill('+34612345678');
    await page.locator('#contact-email').fill('ana@example.com');
    if(page.viewportSize().width>720) await page.locator('#contact-luggage').fill('2');
    else if(await page.locator('#contact-luggage').inputValue()!=='2') {
      await editTrip();await page.locator('[data-airport-mobile-luggage-select]').selectOption('2');await data();
    }
    if(page.viewportSize().width<=720) {
      await page.locator('#contact-message').click();
      await page.locator('[data-airport-mobile-notes-editor-input]').fill('Vuelo AM123. Dos maletas.');
      await page.locator('[data-airport-mobile-notes-editor-close]').click();
    } else await page.locator('#contact-message').fill('Vuelo AM123. Dos maletas.');
    assert.equal(await page.locator('[data-airport-mobile-notes-editor]:not([hidden])').count(),0,'Notes close without reopening');
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
  }
  async function desktopSelection() {
    await load(721,900); await data(); await fillContact();
    fixture({models:[explorer]}); await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/traslado$/);
    const desktopChoice=page.locator(panel+' [data-fleet-selection] button');
    await desktopChoice.waitFor();
    assert(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid),'Positive offer survives while awaiting desktop selection');
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer')),null);
    await desktopChoice.click(); await available(); await data();
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
    await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
    assert((await page.locator('.airport-booking__summary').innerText()).includes('Ford Explorer'));
    assert.equal(stats().writes,0); assert.deepEqual(errors,[]);
    report.checks.push({name:'desktop-replacement-positive-offer-retained',result:'PASS'});
  }
  async function mobileRefinements() {
    if(refinementWebkit) {
      if(refinementBefore) {
        const folder=path.resolve(output,'../../..');
        const bindings=JSON.parse((await fs.readFile(path.join(folder,'bindings-before.json'),'utf8')).replace(/^\uFEFF/,''));
        const paths=new Map(bindings.filter(n=>!n.path.startsWith('scripts/')).map(n=>['/'+n.path,path.join(folder,'preimages',n.path)]));
        await context.route(origin+'/**',route=>{const local=paths.get(new URL(route.request().url()).pathname);return local?route.fulfill({path:local}):route.fallback();});
      }
      report.browser='Playwright WebKit on Windows; not physical Safari/iOS';report.native=[];
      for(const width of [320,360,390,430]) {
        await load(width,844);
        for(const state of ['selected','empty','editing']) {
          if(state==='empty') {await page.locator('#airport-tariff-date').fill('');await page.locator('#airport-tariff-time').fill('');}
          if(state==='editing') {await page.locator('#airport-tariff-date').fill(date);await page.locator('#airport-tariff-time').fill('12:31');await page.locator('#airport-tariff-time').focus();}
          await page.locator('#airport-tariff-date').scrollIntoViewIfNeeded();
          report.native.push({width,state,styles:await fontStyles()});await shot('trayecto-'+width+'-'+state);
          assert.equal(await page.locator('#airport-tariff-date').getAttribute('type'),'date');assert.equal(await page.locator('#airport-tariff-time').getAttribute('type'),'time');
        }
      }
      assert.equal(stats().writes,0);assert.equal(stats().checkouts.length,0);assert.deepEqual(errors,[]);
      report.checks.push({name:'webkit-native-empty-selected-editing-four-widths',result:'PASS'});return;
    }
    const back=()=>page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();
    const summary=()=>page.locator('.airport-booking > .airport-mobile-contact-step__summary');
    const cdp=await context.newCDPSession(page);
    async function nativeBoxes() {
      const {root}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
      const result=[];
      async function visit(n,owner) {
        const a=Object.fromEntries((n.attributes||[]).reduce((r,v,i,s)=>i%2?r:[...r,[v,s[i+1]]],[]));
        if(['airport-tariff-date','airport-tariff-time'].includes(a.id)) owner=a.id;
        if(owner && n.nodeType===1) {
          const box=await cdp.send('DOM.getBoxModel',{nodeId:n.nodeId}).catch(()=>null);
          if(box) result.push({owner,node:n.nodeName,pseudo:a.pseudo||a.id||'',border:box.model.border,content:box.model.content});
        }
        for(const child of [...(n.children||[]),...(n.shadowRoots||[])]) await visit(child,owner);
      }
      await visit(root,null);return result;
    }
    async function captureScreen(name,action) {
      await screenScroller().evaluate(n=>n.scrollTop=0);await page.waitForTimeout(120);
      await shot(name);
      if(action) {await page.locator(action).scrollIntoViewIfNeeded();await shot(name+'-inferior');}
    }
    report.native=[];report.summaries=[];report.desktop=[];
    for(const width of [320,360,390,430,720]) {
      await load(width,844);await page.locator('[data-airport-mobile-luggage-select]').selectOption('2');
      await captureScreen('trayecto-'+width,panel+' .services-expand__cta');
      for(const state of ['selected','empty','editing']) {
        if(state==='empty') {await page.locator('#airport-tariff-date').fill('');await page.locator('#airport-tariff-time').fill('');}
        if(state==='editing') {await page.locator('#airport-tariff-date').fill(date);await page.locator('#airport-tariff-time').fill('12:31');await page.locator('#airport-tariff-time').focus();}
        await page.locator('#airport-tariff-date').scrollIntoViewIfNeeded();
        const boxes=await nativeBoxes();
        if(!refinementBefore) for(const owner of ['airport-tariff-date','airport-tariff-time']) {
          const input=boxes.find(n=>n.pseudo===owner),editor=boxes.find(n=>n.owner===owner && n.pseudo==='-webkit-datetime-edit-fields-wrapper');
          assert(Math.abs((input.border[1]+input.border[5]-editor.border[1]-editor.border[5])/2)<=1,'Native vertical center '+owner);
        }
        report.native.push({width,state,styles:await fontStyles(),boxes});
        if(width===390) await shot('trayecto-'+state);
      }
      await page.locator('#airport-tariff-time').fill('12:30');await available();
      await data();await fillContact();await page.locator('#contact-name').blur();
      if(!refinementBefore) assert.equal(await page.locator('#contact-submit').innerText(),'Revisar datos');
      await captureScreen('datos-'+width,'#contact-submit');
      report.summaries.push({width,height:await summary().evaluate(n=>n.getBoundingClientRect().height),text:await summary().innerText()});
      const beforeStats=stats();await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
      assert.equal(stats().writes,beforeStats.writes);assert.equal(stats().checkouts.length,beforeStats.checkouts.length);
      await captureScreen('revision-'+width,'[data-airport-pay]');
      if(!refinementBefore) {
        assert.equal(await page.locator('.airport-booking .airport-booking__link').count(),0,'No redundant edit controls in DOM');
        assert.equal(await page.locator('.airport-booking .airport-booking__detail dt').filter({hasText:/^Maletas$/}).count(),0);
        assert.equal(await page.locator('.airport-booking__block-heading').last().innerText(),'Notas');
        const geometry=await page.locator('.airport-mobile-route__content').evaluate(n=>({w:n.clientWidth,sw:n.scrollWidth}));
        assert(geometry.sw<=geometry.w+1,'No horizontal overflow');
        const prior=JSON.parse(await fs.readFile(path.join(output,'../before/results.json'),'utf8')).summaries.find(n=>n.width===width);
        const height=report.summaries.at(-1).height;
        assert(height<prior.height,'Measured summary reduction');report.layouts.push({width,before:prior.height,after:height,reduction:prior.height-height});
      }
      await back();await page.waitForURL(/#airport\/datos$/);
      assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
      assert.equal(await page.locator('#contact-message').inputValue(),'Vuelo AM123. Dos maletas.');
      assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
      await back();await page.waitForURL(/#airport\/traslado$/);
      assert.equal(await page.locator('[data-airport-mobile-luggage-select]').inputValue(),'2');
      assert(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid));
    }
    report.checks.push({name:'five-widths-native-states-navigation-no-dispatch-summary-measured',result:'PASS'});
    for(const width of [721,1440]) {
      await load(width,1000);await data();await fillContact();await page.locator('#contact-name').blur();
      const shape=()=>page.locator('.airport-booking').evaluate(n=>({html:n.outerHTML.replace(/legal_acceptance_accepted_at[^>]+/g,''),width:n.clientWidth,height:n.clientHeight}));
      const record={width,data:await shape()};await page.screenshot({path:path.join(output,'desktop-datos-'+width+'.png'),fullPage:true});
      await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
      record.review=await shape();report.desktop.push(record);
      await page.screenshot({path:path.join(output,'desktop-revision-'+width+'.png'),fullPage:true});
      if(!refinementBefore) {
        const prior=JSON.parse(await fs.readFile(path.join(output,'../before/results.json'),'utf8')).desktop.find(n=>n.width===width);
        assert.deepEqual(record,prior,'Desktop exact composition and geometry');
      }
    }
    report.checks.push({name:'desktop-721-1440',result:'PASS'});
    if(!refinementBefore) {
      await load();await data();await fillContact();
      report.languages=[];
      for(const lang of ['es','en','fr','de','it','pt','ru','ko','zh-hans']) {
        await page.locator('#lang-trigger').click();
        await page.locator('.lang-menu [data-lang="'+lang+'"]').click();
        const dict=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'airport-desktop-booking.json'),'utf8'));
        await until(()=>page.locator('#contact-submit').innerText().then(t=>t===dict.mobileReviewCta),'Localized CTA '+lang);
        await page.locator('#contact-email').fill('invalid');await page.locator('#contact-email').blur();
        assert.equal(await page.locator('#contact-submit').innerText(),dict.mobileReviewCta);
        await page.locator('#contact-email').fill('ana@example.com');await page.locator('#contact-email').blur();
        await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);await back();
        assert.equal(await page.locator('#contact-submit').innerText(),dict.mobileReviewCta);
        report.languages.push({lang,label:dict.mobileReviewCta,result:'PASS'});
      }
      report.checks.push({name:'nine-language-CTA-validation-review-return',result:'PASS'});
      const longAddress='Hotel de la Ciudad de México — Avenida Paseo de la Reforma 1234, Colonia Juárez, Alcaldía Cuauhtémoc, Ciudad de México, entrada por la calle lateral';
      const longName='Ana María de los Ángeles García López';
      const longEmail='ana.maria.delosangeles.garcia.lopez@departamentodeviajes.example.com';
      await load(320,568,[{...model,name:'Mercedes-Benz Clase V Extra Larga Executive'}],'es',longAddress);
      await data();await fillContact();
      await page.locator('#contact-name').fill(longName);await page.locator('#contact-email').fill(longEmail);
      await page.locator('#contact-message').click();await page.locator('[data-airport-mobile-notes-editor-input]').fill('');await page.locator('[data-airport-mobile-notes-editor-close]').click();
      await page.locator('#pixkuy-airport-transfer-legal-acceptance').uncheck();
      await until(()=>page.locator('#contact-submit').isDisabled(),'Consent still required');
      assert.equal(await page.locator('#contact-submit').innerText(),'Revisar datos');
      await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
      await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
      assert.equal(await page.locator('.airport-booking__block').count(),1,'No empty notes block');
      const reviewText=await page.locator('.airport-booking').innerText();
      for(const value of [longAddress,longName,longEmail,'Mercedes-Benz Clase V Extra Larga Executive']) assert(reviewText.includes(value));
      const overflow=await page.locator('.airport-booking dd').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1 || n.scrollHeight>n.clientHeight+1).map(n=>n.textContent));
      assert.deepEqual(overflow,[],'Complete long values wrap without clipping');
      await captureScreen('revision-sin-notas-textos-largos-320','[data-airport-pay]');
      await back();await page.locator('#contact-message').click();
      await page.locator('[data-airport-mobile-notes-editor-input]').fill('Punto de encuentro y detalles del vuelo. '.repeat(10));
      await page.locator('[data-airport-mobile-notes-editor-close]').click();
      await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
      await captureScreen('revision-notas-largas-320','[data-airport-pay]');
      const payBounds=await page.locator('[data-airport-pay]').boundingBox();assert(payBounds.y+payBounds.height<=568 && payBounds.height>=44);
      await back();
      // Exercise the browser's autofill pseudo-state with synthetic data only.
      await cdp.send('DOM.enable');await cdp.send('CSS.enable');
      const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#contact-name'});
      await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['autofill']});
      report.autofill=await page.locator('#contact-name').evaluate(n=>({matches:n.matches(':autofill'),autocomplete:n.autocomplete,value:n.value,background:getComputedStyle(n).backgroundColor,shadow:getComputedStyle(n).boxShadow,text:getComputedStyle(n).webkitTextFillColor}));
      assert(report.autofill.matches);assert.notEqual(report.autofill.autocomplete,'off');assert.equal(report.autofill.value,longName);assert(report.autofill.shadow.includes('inset'));
      await page.locator('#contact-name').scrollIntoViewIfNeeded();await shot('datos-autofill-simulado-320');
      await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
      await back();
      await page.locator('#airport-tariff-time').fill('13:45');
      assert(!(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid)),'Real trip change invalidates old offer');
      await available();await data();assert.equal(await page.locator('#contact-name').inputValue(),longName);
      // Explicit route navigation works even when the current history entry is replaced.
      await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
      await page.evaluate(()=>history.replaceState(null,'',location.href));await back();await back();await page.waitForURL(/#airport\/traslado$/);
      report.checks.push({name:'long-values-notes-absent-present-consent-autofill-trip-invalidation',result:'PASS'});
      report.civilDates=[];
      for(const zone of ['Pacific/Kiritimati','America/Mexico_City','Pacific/Pago_Pago']) {
        await cdp.send('Emulation.setTimezoneOverride',{timezoneId:zone});
        const formatted=await page.evaluate(()=>window.PixkuyAirportDesktopView.date('2027-01-14',true));
        assert.equal(formatted,'14 ene 2027');report.civilDates.push({zone,formatted});
      }
      await cdp.send('Emulation.setTimezoneOverride',{timezoneId:''});
      report.checks.push({name:'civil-date-no-day-shift',result:'PASS'});
    }
    assert.equal(stats().writes,0);assert.equal(stats().checkouts.length,0);assert.deepEqual(errors,[]);
  }
  async function visualRestoration() {
    const referenceFile=path.join(output,'reference.json');
    async function interceptPreimages(folder) {
      const bindings=JSON.parse(await fs.readFile(path.join(folder,'bindings-before.json'),'utf8'));
      const routes=new Map(bindings.map(item=>[new URL(item.path==='index.html'?'/':'/'+item.path,origin).pathname,path.join(folder,'preimages',item.path)]));
      const handler=route=>{
        const local=routes.get(new URL(route.request().url()).pathname);
        return local?route.fulfill({path:local}):route.fallback();
      };
      await context.route(origin+'/**',handler);
      return ()=>context.unroute(origin+'/**',handler);
    }
    async function styles(legacy) {
      return page.evaluate(legacy=>{
        const controls=legacy?['#airport-mobile-contact-name','#airport-mobile-contact-phone','#airport-mobile-contact-email','#airport-mobile-contact-notes']:['#contact-name','#contact-phone','#contact-email','#contact-message'];
        const selectors=['.airport-mobile-route','.airport-mobile-contact-step__summary',...controls,legacy?'[data-airport-mobile-contact-submit]':'#contact-submit'];
        return selectors.map(selector=>{const n=document.querySelector(selector),s=getComputedStyle(n);return {selector,fontSize:s.fontSize,fontFamily:s.fontFamily,fontWeight:s.fontWeight,lineHeight:s.lineHeight,padding:s.padding,height:s.height,borderRadius:s.borderRadius,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,color:s.color};});
      },legacy);
    }
    let reference;
    try {reference=JSON.parse(await fs.readFile(referenceFile,'utf8'));} catch { /* First capture only; never restore preimages on disk. */ }
    if(!reference || reference.version!==3) {
      reference={version:3};
      const remove=await interceptPreimages(path.resolve(output,'../../airport-mobile-phase2-20260930'));
      await load();
      await page.locator(panel+' .services-expand__actions .services-expand__cta').click();
      await page.locator('[data-airport-mobile-contact-step]:not([hidden])').waitFor();
      for(const [name,value] of [['name','Ana García'],['phone','+34612345678'],['email','ana@example.com'],['notes','Vuelo AM123. Dos maletas.']]) await page.locator('#airport-mobile-contact-'+name).evaluate((n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));},value);
      await page.evaluate(()=>document.activeElement.blur());
      await page.locator('#pixkuy-airport-mobile-legal-acceptance').check();
      await until(()=>page.locator('[data-airport-mobile-contact-submit]').isEnabled(),'Original CTA ready for like-for-like style comparison');
      await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop=0);
      await shot('datos-antes-fase2-390'); reference.mobile=await styles(true);
      await remove();
      const removeDesktop=await interceptPreimages(path.resolve(output,'..'));
      await load(1440,1000); await data(); await fillContact();
      await page.locator('#contact-name').blur();
      await page.screenshot({path:path.join(output,'desktop-antes.png'),fullPage:true});
      reference.desktop=await page.locator('.airport-booking').evaluate(n=>({html:n.outerHTML.replace(/legal_acceptance_accepted_at[^>]+/g,''),width:n.clientWidth,height:n.clientHeight}));
      await removeDesktop();
      await fs.writeFile(referenceFile,JSON.stringify(reference,null,2));
    }
    await load(); await data();
    await page.locator('#contact-name').fill('Ana García');
    await page.locator('#contact-phone').fill('+34612345678');
    await page.locator('#contact-email').fill('ana@example.com');
    await page.locator('#contact-message').click();
    await page.locator('[data-airport-mobile-notes-editor-input]').fill('Vuelo AM123. Dos maletas.');
    await page.locator('[data-airport-mobile-notes-editor-close]').click();
    assert.equal(await page.locator('[data-airport-mobile-notes-editor]:not([hidden])').count(),0);
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop=0);
    await shot('datos-corregidos-390'); report.stylesRestored=await styles(false); report.stylesReference=reference.mobile;
    assert.equal(await page.locator('.airport-booking__progress,.airport-booking__header,.airport-booking h1').count(),0,'No desktop composition on mobile');
    assert.equal(await page.locator('form[name="contact"]').count(),1);
    assert.equal(await page.locator('#contact-luggage:visible').count(),0,'Luggage remains in its original Trip control');
    for(let i=0;i<reference.mobile.length;i++) for(const prop of ['fontSize','fontFamily','fontWeight','lineHeight','padding','borderRadius','backgroundColor','backgroundImage','color']) assert.equal(report.stylesRestored[i][prop],reference.mobile[i][prop],reference.mobile[i].selector+' '+prop);
    report.checks.push({name:'original-mobile-styles-and-structure',result:'PASS'});
    await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
    await shot('revision-corregida-390');
    assert((await page.locator('.airport-booking').innerText()).includes('Ana García'));
    assert.equal(await page.locator('.airport-booking__progress,.airport-booking__header,.airport-booking h1').count(),0);
    await page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();
    await page.waitForURL(/#airport\/datos$/);assert.equal(await page.locator('#contact-message').inputValue(),'Vuelo AM123. Dos maletas.');
    await page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();await page.waitForURL(/#airport\/traslado$/);
    await page.locator('[data-airport-mobile-luggage-select]').selectOption('2');await data();
    await page.reload();await page.locator('.airport-booking #contact-name').waitFor();
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');assert.equal(await page.locator('#contact-luggage').inputValue(),'2');
    report.checks.push({name:'trip-data-review-back-reload-preserves-fields',result:'PASS'});
    assert(await page.locator('[data-mobile-topbar-menu-trigger]').isVisible());
    assert(await page.locator('.lang').isVisible());
    await page.locator('[data-mobile-topbar-menu-trigger]').click();
    await page.locator('[data-mobile-topbar-menu][aria-hidden="false"]').waitFor();
    await page.keyboard.press('Escape');
    await until(()=>page.locator('body').getAttribute('data-mobile-topbar-menu-open').then(value=>value!=='true'),'Original menu closes');
    const legalLink=page.locator('[data-airport-transfer-checkout-legal-acceptance] a').first();
    await legalLink.scrollIntoViewIfNeeded();
    const legalScroll=await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop);
    await legalLink.click();await page.locator('#pixkuy-legal-overlay[data-open="1"]').waitFor();
    await page.keyboard.press('Escape');await until(()=>page.locator('#pixkuy-legal-overlay[data-open="1"]').count().then(n=>!n),'Legal closes');
    assert(await legalLink.evaluate(n=>document.activeElement===n));
    assert.equal(await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop),legalScroll);
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').uncheck();await until(()=>page.locator('#contact-submit').isDisabled(),'Consent revocation updates CTA');
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    report.checks.push({name:'original-header-menu-legal-focus-consent',result:'PASS'});
    for(const [width,height] of [[320,568],[360,640],[390,844],[430,844],[720,900]]) {
      await page.setViewportSize({width,height});
      await page.locator('.airport-mobile-route__content').evaluate(n=>n.scrollTop=0);await shot('datos-corregidos-'+width);
      await page.locator('#contact-submit').scrollIntoViewIfNeeded();
      const layout=await page.evaluate(()=>{const field=document.querySelector('#contact-message').closest('.form-field').getBoundingClientRect(),legal=document.querySelector('[data-airport-transfer-checkout-legal-acceptance]').getBoundingClientRect(),button=document.querySelector('#contact-submit').getBoundingClientRect(),root=document.querySelector('.airport-mobile-route__content');return {notesBottom:field.bottom,legalTop:legal.top,legalBottom:legal.bottom,buttonTop:button.top,width:root.clientWidth,scrollWidth:root.scrollWidth};});
      assert(layout.legalTop>=layout.notesBottom && layout.buttonTop>=layout.legalBottom,'No overlap at '+width);assert(layout.scrollWidth<=layout.width+1);
      const addressGeometry=await page.locator('.airport-booking [data-airport-mobile-contact-summary-value="hotel"]').evaluate(n=>({text:n.textContent,height:n.clientHeight,scroll:n.scrollHeight}));
      assert.equal(addressGeometry.text,address);assert(addressGeometry.scroll<=addressGeometry.height+1,'Complete address without clipping');
      await shot('datos-corregidos-'+width+'-acciones');report.layouts.push({width,height,...layout});
      await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);await shot('revision-corregida-'+width);
      await page.locator('[data-airport-pay]').scrollIntoViewIfNeeded();await shot('revision-corregida-'+width+'-acciones');
      await page.locator('.airport-booking > .airport-mobile-flow__back-row button').click();await page.waitForURL(/#airport\/datos$/);
    }
    report.checks.push({name:'mobile-geometry-and-review-actions',result:'PASS'});
    await page.setViewportSize({width:320,height:350});
    await page.locator('#contact-email').fill('invalid');
    await page.locator('#contact-email').blur();
    await page.locator('#contact-message').click();
    await page.locator('[data-airport-mobile-notes-editor-input]').fill('Información de vuelo y equipaje. '.repeat(8));
    await page.locator('[data-airport-mobile-notes-editor-close]').click();
    await page.locator('#contact-submit').scrollIntoViewIfNeeded();
    await shot('datos-altura-reducida-error');
    assert.equal(await page.locator('[data-airport-mobile-notes-editor]:not([hidden])').count(),0);
    assert(await page.locator('#contact-email').evaluate(n=>!n.validity.valid));
    await page.locator('#contact-email').fill('ana@example.com');
    await page.setViewportSize({width:721,height:900});
    await page.locator('.airport-booking__progress').waitFor({state:'visible'});
    assert(await page.locator('.airport-booking__progress').isVisible());
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
    await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
    await shot('desktop-721-desde-movil');
    report.checks.push({name:'reduced-viewport-error-notes-and-721-transition',result:'PASS'});
    await load(1440,1000);await data();await fillContact();await page.locator('#contact-name').blur();
    await page.screenshot({path:path.join(output,'desktop-despues.png'),fullPage:true});
    const desktop=await page.locator('.airport-booking').evaluate(n=>({html:n.outerHTML.replace(/legal_acceptance_accepted_at[^>]+/g,''),width:n.clientWidth,height:n.clientHeight}));
    assert.deepEqual(desktop,reference.desktop,'Desktop composition unchanged');
    await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
    report.checks.push({name:'desktop-composition-and-review',result:'PASS'});
    assert.equal(stats().checkouts.length,0);assert.equal(stats().writes,0);assert.deepEqual(errors,[]);
  }
  try {
    if(mobileIntegrated) {await require(process.argv.includes('--confirmed-copy')?'./airport-confirmed-copy-regression':process.argv.includes('--return-mobile-hierarchy')?'./airport-return-hierarchy-regression':process.argv.includes('--iphone-four-fixes')?'./airport-iphone-four-fixes-regression':'./airport-mobile-integrated-regression')({page,context,origin,output,before:integratedBefore,webkit:integratedWebkit,model,explorer,errors,fixture,stats,report,load,data,fillContact,available,shot,until});report.result='PASS';return;}
    if(reviewCompact) {await require('./airport-mobile-review-regression')({page,context,origin,output,before:refinementBefore,webkit:refinementWebkit,model,explorer,errors,fixture,stats,report,load,data,fillContact,available,shot,until});report.result='PASS';return;}
    if(mobileRefinement) {await mobileRefinements();report.result='PASS';return;}
    if(visualRestore) {await visualRestoration();report.result='PASS';return;}
    if(desktopSelectionOnly) { await desktopSelection(); report.result='PASS'; return; }
    await load(); await shot('trayecto-390');
    const styles=await page.evaluate(()=>['#airport-tariff-date','#airport-tariff-time','[data-airport-mobile-passengers-select]'].map(selector=>{const node=document.querySelector(selector),s=getComputedStyle(node),native=getComputedStyle(node,'::-webkit-datetime-edit');return {selector,fontSize:s.fontSize,fontFamily:s.fontFamily,fontWeight:s.fontWeight,lineHeight:s.lineHeight,nativeFontSize:native.fontSize};}));
    report.styles=styles;
    await data(); await fillContact(); await shot('datos-390');
    assert.equal(await page.locator('form[name="contact"]').count(),1);
    assert.equal(stats().checkouts.length,0);
    assert.equal(await page.locator('#contact-submit').innerText(),'Revisar datos');
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    await shot('revision-390');
    const reviewText=await page.locator('.airport-booking').innerText();
    assert(address.split(' — ').every(part=>reviewText.includes(part)),'Full destination preserved across name/address lines');
    assert.equal(stats().checkouts.length,0);
    report.checks.push({name:'trip-data-review-notes-legal',result:'PASS'});

    await editTrip();
    await page.waitForURL(/#airport\/traslado$/);
    assert.equal(await page.locator('[data-airport-mobile-luggage-select]').inputValue(),'2');
    await data();
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
    assert.equal(await page.locator('#contact-message').inputValue(),'Vuelo AM123. Dos maletas.');
    await page.reload();
    await page.locator('.airport-booking #contact-name').waitFor({state:'visible'});
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García','Reload restores contact');
    assert.equal(await page.locator('#contact-message').inputValue(),'Vuelo AM123. Dos maletas.','Reload restores notes');
    assert.equal(await page.locator('#contact-luggage').inputValue(),'2','Reload restores luggage');
    assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked(),'Same draft restores canonical consent');
    assert.equal(await page.evaluate(()=>window.PixkuyAirportZoneTariff.getState().lodgingEndpointPlaceId),'synthetic-place');
    assert.equal(stats().checkouts.length,0);
    report.checks.push({name:'data-trip-data-reload-draft',result:'PASS'});
    await editTrip();
    await page.waitForURL(/#airport\/traslado$/); await page.reload(); await available();
    await data();
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García','Trip reload restores contact before handoff');
    assert.equal(await page.locator('#contact-message').inputValue(),'Vuelo AM123. Dos maletas.');
    assert(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked());
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').uncheck();
    assert.equal(await page.locator('[name="legal_acceptance_accepted"]').inputValue(),'');
    await until(()=>page.locator('#contact-submit').isDisabled(),'Revoked consent prevents review');
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    report.checks.push({name:'trip-reload-common-fields-consent-revocation',result:'PASS'});
    await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
    await page.evaluate(()=>{window.__advanceAirportClock(301000);window.PixkuyFleetSelection.expireAirportOfferIfNeeded();});
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid),false);
    await until(()=>page.getByRole('button',{name:'Continuar al pago',exact:true}).count(),'Expired offer revalidated before payment');
    assert.equal(stats().checkouts.length,0);
    report.checks.push({name:'expired-offer-revalidated-without-dispatch',result:'PASS'});

    fixture({price:90000});
    await page.locator('[data-airport-pay]').click();
    await page.getByRole('button',{name:'Aceptar nueva oferta',exact:true}).waitFor();
    assert((await page.locator('.airport-booking').innerText()).includes('900 MXN'));
    assert.equal(stats().checkouts.length,0);
    await page.getByRole('button',{name:'Aceptar nueva oferta',exact:true}).click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
    await until(()=>page.locator('.airport-booking').innerText().then(text=>text.includes('900 MXN')),'Accepted current price rendered');
    report.checks.push({name:'price-change-explicit-review',result:'PASS'});

    for(const [width,height] of [[320,568],[360,640],[390,844],[430,844],[720,900],[721,900],[1440,1000]]) {
      await page.setViewportSize({width,height});
      await page.locator('.airport-booking').waitFor();
      await page.waitForTimeout(100);
      await screenScroller().evaluate(node=>{node.scrollTop=0;});
      await shot('revision-'+width);
      await page.locator('[data-airport-pay]').scrollIntoViewIfNeeded();
      await shot('revision-'+width+'-acciones');
      const geometry=await page.locator('.airport-booking').evaluate(node=>({width:node.clientWidth,scrollWidth:node.scrollWidth,overflow:getComputedStyle(node).overflowY}));
      assert(geometry.scrollWidth<=geometry.width+1,'No horizontal overflow at '+width);
      report.layouts.push({width,height,screen:'revision',...geometry});
      await editData();
      await page.waitForURL(/#airport\/datos$/);
      await page.locator('#contact-submit').scrollIntoViewIfNeeded();
      const overlap=await page.evaluate(()=>{const note=document.querySelector('#contact-message').closest('.form-field').getBoundingClientRect();const legal=document.querySelector('[data-airport-transfer-checkout-legal-acceptance]').getBoundingClientRect();const button=document.querySelector('#contact-submit').getBoundingClientRect();return {notesBottom:note.bottom,legalTop:legal.top,legalBottom:legal.bottom,buttonTop:button.top};});
      assert(overlap.legalTop>=overlap.notesBottom,'Notes/help and legal do not overlap at '+width);
      assert(overlap.buttonTop>=overlap.legalBottom,'Legal and CTA do not overlap at '+width);
      await shot('datos-'+width+'-acciones');
      report.layouts.push({width,height,screen:'datos',...overlap});
      await page.locator('#contact-submit').click();await page.waitForURL(/#airport\/revision$/);
    }
    await page.setViewportSize({width:390,height:844});
    report.checks.push({name:'responsive-data-review-720-721',result:'PASS'});

    await page.locator('[data-airport-pay]').evaluate(node=>{node.click();node.click();});
    await until(()=>stats().checkouts.length>0,'Final dispatch intercepted');
    await page.waitForTimeout(500);
    assert.equal(stats().checkouts.length,1,'Double tap makes one dispatch');
    assert(stats().checkouts[0].key);
    assert.equal(stats().checkouts[0].body.customer.full_name,'Ana García');
    const dispatched=stats().checkouts[0].body;
    assert.equal(dispatched.airport_transfer_date,date);
    assert.equal(dispatched.airport_transfer_time,'12:30');
    assert.equal(dispatched.airport_transfer_passenger_fare_key,'van_1_2');
    assert.equal(dispatched.airport_transfer_luggage,'2');
    assert.equal(dispatched.airport_transfer_notes,'Vuelo AM123. Dos maletas.');
    assert.deepEqual(dispatched.airport_transfer_non_airport_location,{address,place_id:'synthetic-place',lat:19.418,lng:-99.169});
    assert.equal(dispatched.airport_transfer_price,90000);
    assert.equal(dispatched.airport_transfer_currency,'MXN');
    assert(dispatched.request_summary.includes('900 MXN'));
    assert(dispatched.form_payload_raw.airport_hotel_trip_summary.includes('900 MXN'));
    assert.equal(dispatched.fleet_selection.model_id,model.modelId);
    for(const key of ['accepted','terms_version','cancellation_policy_version','privacy_version','accepted_at','channel']) {
      assert(dispatched['legal_acceptance_'+key]);
      assert.equal(dispatched['legal_acceptance_'+key],dispatched.form_payload_raw['legal_acceptance_'+key]);
    }
    assert.equal(stats().writes,0,'No other writes attempted');
    assert.deepEqual(errors,[]);
    report.checks.push({name:'intercepted-checkout-double-tap',result:'PASS'});

    // Recovery/error handling stays in the real controller; only transport is controlled.
    await load(); await data();
    assert(!(await page.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked()),'New booking has no inherited consent');
    await fillContact();
    await page.locator('#contact-email').fill('invalid');
    await page.locator('#contact-submit').evaluate(node=>node.form.requestSubmit());
    assert.equal(new URL(page.url()).hash,'#airport/datos');
    assert.equal(stats().checkouts.length,1);
    await page.locator('#contact-email').fill('ana@example.com');
    for(const mode of ['technical','unavailable']) {
      const before=stats().prechecks;
      fixture({mode}); await page.locator('#contact-submit').click();
      await until(()=>stats().prechecks>before && stats().requests.at(-1).settled,'Error response settles');
      await until(()=>page.locator('.airport-booking__notice').count(),'Error shown in canonical Data');
      assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
      assert.equal(await page.locator('#contact-message').inputValue(),'Vuelo AM123. Dos maletas.');
      assert.equal(new URL(page.url()).hash,'#airport/datos');
      if(mode==='unavailable') {
        assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid),false);
        assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.model('airport_transfer')),null);
        assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.read('airport_transfer').selected.modelId),model.modelId,'Remembered choice is only a draft');
        await editTrip();
        await until(()=>page.locator(panel).getAttribute('data-airport-mobile-availability-state').then(value=>value==='unavailable'),'Negative result remains unavailable on Trip');
        assert(await page.locator(panel+' .services-expand__actions .services-expand__cta').isDisabled());
        await page.goBack(); await page.waitForURL(/#airport\/datos$/);
      }
    }
    fixture({}); await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
    report.checks.push({name:'validation-consent-error-unavailable-recovery',result:'PASS'});

    await editData();
    const lateStart=stats().prechecks;
    fixture({mode:'technical',delay:()=>800}); await page.locator('#contact-submit').click();
    await until(()=>stats().prechecks>lateStart,'Delayed precheck dispatched');
    fixture({});
    await editTrip();
    await page.locator('#airport-tariff-time').fill('12:31');
    await available(); await data();
    await until(()=>stats().requests[lateStart].settled,'Late failure delivered');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.airport-booking__notice').count(),0,'Late failure cannot contaminate new Data route');
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
    report.checks.push({name:'late-data-error-after-navigation',result:'PASS'});

    fixture({models:[explorer]}); await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/traslado$/);
    const confirm=page.locator(panel+' [data-fleet-selection] button');
    await confirm.waitFor(); assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.selection('airport_transfer')),null);
    assert(await page.locator(panel+' .services-expand__actions .services-expand__cta').isDisabled());
    await confirm.click(); await available(); await data();
    assert.equal(await page.locator('#contact-name').inputValue(),'Ana García');
    await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
    assert((await page.locator('.airport-booking').innerText()).includes('Ford Explorer'));
    report.checks.push({name:'BYD-to-Explorer-explicit-replacement-with-contact',result:'PASS'});

    // Legal overlays return to their trigger and preserve the mobile scroll container.
    for(const index of [0,1,2]) {
      const link=page.locator('.airport-booking__conditions a').nth(index);
      await link.scrollIntoViewIfNeeded();
      const scroll=await screenScroller().evaluate(node=>node.scrollTop);
      await link.click(); await page.locator('#pixkuy-legal-overlay[data-open="1"]').waitFor();
      await page.keyboard.press('Escape');
      await until(()=>page.locator('#pixkuy-legal-overlay[data-open="1"]').count().then(n=>!n),'Legal closes');
      assert(await link.evaluate(node=>document.activeElement===node));
      assert.equal(await screenScroller().evaluate(node=>node.scrollTop),scroll);
    }
    report.checks.push({name:'three-legal-overlays-focus-scroll',result:'PASS'});

    await load();
    fixture({mode:'unavailable',next:date+'T15:30:00'});
    await page.locator('#airport-tariff-time').fill('14:00');
    await page.locator('.shared-availability-suggestion__link').waitFor();
    fixture({}); await page.locator('.shared-availability-suggestion__link').click(); await available();
    assert.equal(await page.locator('#airport-tariff-time').inputValue(),'15:30');
    fixture({mode:'unavailable',code:'AIRPORT_TRANSFER_MINIMUM_LEAD_TIME_NOT_MET',next:date+'T16:00:00'});
    await page.locator('#airport-tariff-time').fill('14:01');
    await page.locator('.shared-availability-suggestion__link').waitFor();
    const refreshStart=stats().prechecks;
    fixture({mode:'unavailable',code:'AIRPORT_TRANSFER_MINIMUM_LEAD_TIME_NOT_MET',next:date+'T16:05:00'});
    await page.locator('.shared-availability-suggestion__link').click();
    await until(()=>page.locator('#airport-tariff-time').inputValue().then(value=>value==='16:05'),'Suggestion refresh uses current 24h response');
    await until(()=>stats().requests.at(-1).settled,'Refreshed suggestion validation settles');
    assert.equal(stats().prechecks-refreshStart,2,'One refresh and one validation');
    assert(await page.locator(panel+' .services-expand__actions .services-expand__cta').isDisabled());
    report.checks.push({name:'occupied-next-slot-and-24h-refresh-contract',result:'PASS',backend:'controlled codes, no real availability'});

    await load();
    await page.locator('#airport-tariff-date').fill('');
    await page.locator('#airport-tariff-time').fill('');
    await page.locator('[data-airport-mobile-passengers-select]').selectOption('van_3_4');
    await page.locator('[data-airport-mobile-luggage-select]').selectOption('3');
    await page.evaluate(()=>window.PixkuyAirportZoneTariff.clearResolvedDestination());
    await page.locator('[data-airport-lodging-input]:visible').fill('Dirección todavía sin resolver');
    await page.reload(); await page.waitForTimeout(650);
    assert.equal(await page.locator('#airport-tariff-date').inputValue(),'');
    assert.equal(await page.locator('#airport-tariff-time').inputValue(),'');
    assert.equal(await page.locator('[data-airport-mobile-passengers-select]').inputValue(),'van_3_4');
    assert.equal(await page.locator('[data-airport-mobile-luggage-select]').inputValue(),'3');
    assert.equal(await page.locator('[data-airport-lodging-input]:visible').inputValue(),'Dirección todavía sin resolver');
    assert.equal(await page.evaluate(()=>window.PixkuyFleetSelection.airportOfferStatus().valid),false);
    assert(await page.locator(panel+' .services-expand__actions .services-expand__cta').isDisabled());
    report.checks.push({name:'partial-unresolved-draft-not-an-offer',result:'PASS'});

    const cssPattern='**/assets/css/49-airport-mobile-booking-flow.css*';
    await context.route(cssPattern,route=>route.fulfill({contentType:'text/css',path:path.resolve(__dirname,'../../../evidence/airport-mobile-phase2-20260930/preimages/assets/css/49-airport-mobile-booking-flow.css')}));
    await load(); report.stylesBefore=await fontStyles(); await context.unroute(cssPattern);
    await page.reload(); await available(); report.stylesAfter=await fontStyles();
    // Native date/time use the measured line-height introduced by the later
    // alignment correction; select retains its native "normal" line-height.
    for(const entry of report.stylesAfter.slice(0,2)) for(const prop of ['fontSize','fontFamily','fontWeight']) assert.equal(entry[prop],report.stylesAfter[2][prop],prop+' matches equivalent control');
    const luminance=rgb=>rgb.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
    report.successContrast=(luminance([121,212,163])+.05)/(luminance([15,17,19])+.05);
    assert(report.successContrast>=4.5);
    assert.equal(await page.locator('[data-airport-tariff-availability]').innerText(),'Disponibilidad confirmada. Puede continuar.');
    report.checks.push({name:'computed-native-fonts-success-copy-contrast',result:'PASS',browser:'Chromium only'});

    report.languages=[];
    for(const lang of ['es','en','de','fr','it','pt','ru','ko','zh-hans']) {
      const dict=JSON.parse(await fs.readFile(path.join(__dirname,'../assets/i18n',lang+'.json'),'utf8'));
      const copy=JSON.parse(await fs.readFile(path.join(__dirname,'../assets/i18n',lang,'airport-desktop-booking.json'),'utf8'));
      for(const key of ['reviewCta','payCta','accepted','unverified','offerChanged','technical','unavailable','trip','data','review','transferNotes']) assert(copy[key]?.trim(),lang+': '+key);
      assert(dict.services.cards.airport.panel.availability.available?.trim(),lang+': success copy');
      await load(320,568,[model],lang); await data(); await fillContact();
      await until(()=>page.locator('#contact-submit').innerText().then(text=>text===copy.mobileReviewCta),'Localized review CTA '+lang);
      await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
      const displayedDate=await page.evaluate(date=>window.PixkuyAirportDesktopView.date(date,true),date);
      const expectedDate=await page.evaluate(date=>{const [y,m,d]=date.split('-').map(Number);return new Intl.DateTimeFormat(document.documentElement.lang,{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d,12));},date);
      assert.equal(displayedDate,expectedDate);
      assert((await page.locator('.airport-booking').innerText()).includes(displayedDate));
      assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot')).airport_transfer_date),date);
      const fits=await page.locator('.airport-booking').evaluate(node=>node.scrollWidth<=node.clientWidth+1);
      assert(fits,lang+' review fits 320px');
      await shot('revision-320-'+lang);
      report.languages.push({lang,reviewCta:copy.reviewCta,success:dict.services.cards.airport.panel.availability.available,date:displayedDate,result:'PASS'});
    }
    report.checks.push({name:'nine-catalogs-live-routes-local-civil-date',result:'PASS'});

    await load(320,568); await data(); await fillContact();
    const longNotes='Detalles del servicio, equipaje y punto de encuentro. '.repeat(12);
    await page.locator('#contact-name').fill('Ana María de los Ángeles García López');
    await page.locator('#contact-message').click();
    await page.locator('[data-airport-mobile-notes-editor-input]').fill(longNotes);
    await page.setViewportSize({width:320,height:350});
    await page.locator('[data-airport-mobile-notes-editor-close]').click();
    assert.equal(await page.locator('[data-airport-mobile-notes-editor]:not([hidden])').count(),0);
    await page.locator('#contact-submit').scrollIntoViewIfNeeded();
    const reduced=await page.evaluate(()=>{const note=document.querySelector('#contact-message').closest('.form-field').getBoundingClientRect();const legal=document.querySelector('[data-airport-transfer-checkout-legal-acceptance]').getBoundingClientRect();const action=document.querySelector('#contact-submit').getBoundingClientRect();return {noteBottom:note.bottom,legalTop:legal.top,legalBottom:legal.bottom,actionTop:action.top,actionBottom:action.bottom};});
    assert(reduced.legalTop>=reduced.noteBottom && reduced.actionTop>=reduced.legalBottom && reduced.actionBottom<=350);
    await shot('datos-320-altura-reducida');
    await page.locator('#contact-submit').click(); await page.waitForURL(/#airport\/revision$/);
    assert((await page.locator('.airport-booking').innerText()).includes(longNotes.trim()));
    report.checks.push({name:'long-notes-contact-reduced-viewport',result:'PASS',note:'Reduced viewport; not physical keyboard/Safari certification'});
    const editGuard=await page.evaluate(()=>{
      const key='pixkuy_airport_pending_edit_v1';
      sessionStorage.setItem(key,JSON.stringify({version:1,token:'synthetic-phase3-context',editRevision:'synthetic-revision',idempotencyKey:'synthetic-edit-key'}));
      try { return {active:window.PixkuyAirportDesktopBooking.active(),opened:window.PixkuyAirportDesktopBooking.open()}; }
      finally { sessionStorage.removeItem(key); }
    });
    assert.deepEqual(editGuard,{active:true,opened:true});
    assert.equal(stats().checkouts.length,1);
    report.checks.push({name:'pending-edit-mobile-canonical-controller',result:'PASS',note:'Authorized edit uses the same controller; integrated suite verifies replacement transport'});

    await desktopSelection();

    report.result='PASS';
  } catch(error) { report.result='FAIL'; report.failure=error.message; throw error; }
  finally { report.stats=process.argv.includes('--review-uncertainty') || process.argv.includes('--mobile-integrated')?{prechecks:stats().prechecks,writes:stats().writes,checkouts:stats().checkouts.length}:stats();report.errors=errors;await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks.length,prechecks:stats().prechecks,checkouts:stats().checkouts.length,writes:stats().writes})); }
};
