'use strict';
// Existing Chrome audit runner and real HTTPS assets; request boundary captured.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs');
async function main(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');
 await fs.mkdir(base.output,{recursive:true});const browser=await base.launchChrome();base.setBrowser(browser);
 const t=await base.setup(1440,'hourly_daily'),p=t.page;let sent=[],receipt=null,mode='reject',recoveries=0;
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,async r=>{
   const json=(body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(r.request().url().endsWith('/recover')){recoveries++;return receipt?json({status:'ok',receipt}):json({code:'RECOVERY_UNAVAILABLE'},404);}
   sent.push(r.request().postDataJSON());
   if(mode==='reject')return json({code:'NOTIFICATION_UNAVAILABLE'},503);
   receipt={reference:'PL-CONTROLLED-ONLY',state:'received'};
   if(mode==='lost')return r.abort('failed');
   return json({status:'ok',receipt});
 });
 try{
   await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyLongTermRequest);
   await p.locator('[data-consent-reject]').click({timeout:1200}).catch(()=>{});
   await p.locator('[data-service-expand-trigger="hourly"]').click();
   await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
   await p.locator('[data-services-hourly-pickup-input]').fill('Hotel de prueba — Reforma 1234, Ciudad de México');
   await p.locator('[data-services-hourly-date]').fill('2027-01-28');
   await p.locator('[data-services-hourly-time]').fill('07:43');
   await p.locator('[data-services-hourly-long-term="custom"]').click();
   await p.locator('[data-services-hourly-notes]').fill('Agenda de prueba: lunes y viernes, oficinas <centro> & hotel.');
   await p.locator('#services-expand-hourly').scrollIntoViewIfNeeded();
   await p.screenshot({path:path.join(base.output,'configuration.png'),fullPage:false});
   await p.locator('[data-services-hourly-cta]').click();
   await p.locator('.long-term-request:visible').waitFor();
   assert.equal(await p.locator('.long-term-request .hourly-booking__summary img').count(),0);
   await p.locator('.long-term-request [type=submit]').click();assert.equal(sent.length,0);
   for(const [name,value] of Object.entries({name:'Persona de prueba',phone:'+525512345678',email:'client@example.invalid'}))await p.locator('#long-term-'+name).fill(value);
   await p.locator('.long-term-request [type=submit]').click();assert.equal(sent.length,0);
   assert.match(await p.locator('.long-term-request__status').innerText(),/condiciones/);
   await p.locator('#long-term-consent').check();
   const proof=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).consent);
   await p.locator('.long-term-request .long-term-request__steps').waitFor();
   await p.screenshot({path:path.join(base.output,'data.png'),fullPage:true});
   await p.getByRole('button',{name:'Volver a Configuración',exact:true}).click();
   assert.equal(await p.locator('[data-services-hourly-notes]').inputValue(),'Agenda de prueba: lunes y viernes, oficinas <centro> & hotel.');
   await p.locator('[data-services-hourly-notes]').fill('Agenda editada <img src=x onerror=alert(1)>');
   await p.locator('[data-services-hourly-cta]').click();
   assert.equal(await p.locator('#long-term-name').inputValue(),'Persona de prueba');
   assert.equal(await p.locator('#long-term-consent').isChecked(),true);
   for(const lang of ['en','de','fr','it','ko','pt','ru','zh-hans','es']){
     await p.locator('.lang [data-lang="'+lang+'"]').evaluate(n=>n.click());
     await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);
     await p.waitForTimeout(250);
     assert.equal(await p.locator('#long-term-name').inputValue(),'Persona de prueba');
     assert.equal(await p.locator('#long-term-consent').isChecked(),true);
     assert.equal(await p.locator('.long-term-request .hourly-booking__summary img').count(),0);
     assert((await p.locator('.long-term-request h1').innerText()).length>0);
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     if(lang==='de')await p.screenshot({path:path.join(base.output,'data-de.png'),fullPage:true});
   }
   assert.deepEqual(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).consent),proof);
   await p.locator('.long-term-request [type=submit]').dblclick();
   await p.waitForFunction(()=>document.querySelector('.long-term-request__status').textContent.includes('confirmar'));
   assert.equal(sent.length,1);assert.equal(sent[0].request.notes,'Agenda editada <img src=x onerror=alert(1)>');
   assert.deepEqual(sent[0].request.contact,{name:'Persona de prueba',phone:'+525512345678',email:'client@example.invalid'});
   await p.reload();await p.locator('.long-term-request:visible').waitFor();await p.waitForTimeout(300);assert.equal(sent.length,1);
   mode='lost';await p.locator('.long-term-request [type=submit]').click();
   await p.waitForFunction(()=>document.querySelector('.long-term-request__status').textContent.includes('confirmar'));
   assert.equal(sent.length,2);assert.deepEqual(sent[0].request,sent[1].request);
   await p.reload();await p.getByRole('heading',{name:'Solicitud recibida',exact:true}).waitFor({timeout:15000});assert.equal(sent.length,2);
   await p.screenshot({path:path.join(base.output,'received.png'),fullPage:true});
   await p.reload();await p.getByRole('heading',{name:'Solicitud recibida',exact:true}).waitFor();assert.equal(sent.length,2);
   assert.equal(t.state.requests.filter(r=>['checkout','replace-checkout','retry-checkout'].includes(r.kind)).length,0);
   assert.deepEqual(t.state.errors,[]);
   for(const [url,hash] of base.resources){if(/long-term-request|hourly-daily-panel/.test(url)){const local=await fs.readFile(path.resolve(__dirname,'..','.'+url));assert.equal(require('node:crypto').createHash('sha256').update(local).digest('hex'),hash,url);}}
   await fs.writeFile(path.join(base.output,'browser-results.json'),JSON.stringify({result:'PASS',boundary:'CONTROLLED_HTTP',realAssets:base.origin,locales:9,submissions:sent.length,recoveries,errors:t.state.errors,reservations:0,realEmails:0},null,2));
   console.log('PASS long-term desktop controlled browser');
 }catch(error){await p.screenshot({path:path.join(base.output,'failure.png'),fullPage:true}).catch(()=>{});console.log(await p.evaluate(()=>({hash:location.hash,lang:document.documentElement.lang,receipt:JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1'))?.receipt,text:document.querySelector('.long-term-request')?.innerText})));console.log({errors:t.state.errors,submissions:sent.length,recoveries,receipt});throw error;}finally{await t.context.close();await browser.close();}
}
async function borders(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const results=[];
 try{
   for(const mode of (process.argv.includes('--reference')||process.argv.includes('--capture')?[]:['hourly','full_day'])){
     const t=await base.setup(Number(process.env.PIXKUY_AUDIT_WIDTH||1440),'hourly_daily'),p=t.page;
     await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
     try{
       await base.enter(t);
       if(mode==='full_day')await p.locator('[data-services-hourly-mode="full_day"]').click();
       const original=await p.locator('[data-services-hourly-pickup-input]').inputValue();
       await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
       await p.locator('[data-services-hourly-pickup-input]').evaluate(n=>{n.value='Recogida exclusiva de Planes largos';n.dispatchEvent(new Event('input',{bubbles:true}));});
       await p.locator('[data-services-hourly-date]').fill('2027-02-01');await p.locator('[data-services-hourly-time]').fill('09:00');
       if(t.width<=720){await p.locator('[data-hourly-mobile-long-term-select]').selectOption('custom');await p.locator('[data-fleet-hourly-passengers]').selectOption('6');}
       else await p.locator('[data-services-hourly-long-term="custom"]').click();
       await p.locator('[data-services-hourly-notes]').evaluate(n=>{n.value='';n.dispatchEvent(new Event('input',{bubbles:true}));});
       await p.locator('[data-services-hourly-cta]').click();await p.locator('#long-term-name').waitFor();
       assert.equal(await p.locator('.long-term-request .hourly-booking__summary img').count(),0);
       await p.getByRole('button',{name:'Volver a Configuración',exact:true}).click();
       await p.locator('[data-services-hourly-mode="'+mode+'"]').click();
       assert.equal(await p.locator('[data-services-hourly-pickup-input]').inputValue(),original);
       if(t.width<=720)assert.equal(await p.locator('[data-fleet-hourly-passengers]').inputValue(),'2');
       await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid);
       await base.contact(t);await p.waitForURL(/#hourly\/revision$/);
       assert.equal(await p.locator('.long-term-request:visible').count(),0);
       assert.equal(t.state.requests.filter(r=>/checkout/.test(r.kind)).length,0);
       assert.deepEqual(t.state.errors,[]);results.push({mode,width:t.width,result:'PASS',customWithoutNotes:true,isolatedDraft:true,review:true,reservations:0});
     }finally{await t.context.close();}
   }
   if(process.env.PIXKUY_AUDIT_WIDTH==='390'){
     await fs.writeFile(path.join(base.output,'mobile-borders-results.json'),JSON.stringify({boundary:'CHROME_CONTROLLED_HTTP',origin:base.origin,results},null,2));console.log('PASS mobile Hourly/full-day boundaries');return;
   }
   const t=await base.setup(1440,'hourly_daily'),p=t.page;
   try{
     await p.setViewportSize({width:1440,height:1200});
     await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
     if(!process.argv.includes('--capture')){
       await t.context.route('**/assets/js/services/hourly-daily-panel.js',r=>r.fulfill({path:path.join(base.output,'preimage/pixkuy_landing/public/assets/js/services/hourly-daily-panel.js'),contentType:'application/javascript'}));
       await t.context.route('**/assets/js/forms/long-term-request.js',r=>r.fulfill({contentType:'application/javascript',body:'/* Reference: module did not exist before this task. */'}));
     }
     await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyHourlyBookingFlow);
     await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
     await p.locator('[data-service-expand-trigger="hourly"]').click();await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
     await p.locator('[data-services-hourly-pickup-input]').fill('Hotel de prueba — Reforma 1234, Ciudad de México');
     await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');
     await p.locator('[data-services-hourly-long-term="custom"]').click();await p.locator('[data-services-hourly-notes]').fill('Agenda de prueba: lunes y viernes, oficinas <centro> & hotel.');
     await p.locator('#services-expand-hourly').scrollIntoViewIfNeeded();
     await p.locator('#services-expand-hourly').evaluate(n=>window.scrollTo(0,scrollY+n.getBoundingClientRect().top-12));
     await p.waitForTimeout(600);
     await p.screenshot({path:path.join(base.output,process.argv.includes('--capture')?'configuration-full.png':'configuration-preimage-full.png'),fullPage:false});
     assert.deepEqual(t.state.errors,[]);
   }finally{await t.context.close();}
   if(results.length)await fs.writeFile(path.join(base.output,'borders-results.json'),JSON.stringify({boundary:'CONTROLLED_HTTP',results,preimage:'Saved panel JS; new request module disabled; remaining unchanged/current assets'},null,2));
   console.log('PASS Hourly/full-day boundaries and captured configuration reference');
 }finally{await browser.close();}
}
async function editing(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');const browser=await base.launchChrome();base.setBrowser(browser);
 const t=await base.setup(1440,'hourly_daily'),p=t.page;let submitted=0;
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,r=>{
   const recovery=r.request().url().endsWith('/recover');if(!recovery)submitted++;
   return r.fulfill({status:recovery?404:503,contentType:'application/json',body:JSON.stringify({code:recovery?'RECOVERY_UNAVAILABLE':'NOTIFICATION_NOT_CONFIGURED'})});
 });
 try{
   await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyLongTermRequest);
   await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
   await p.locator('[data-service-expand-trigger="hourly"]').click();await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
   await p.locator('[data-services-hourly-pickup-input]').fill('Hotel de prueba, Ciudad de México');
   await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');
   await p.locator('[data-services-hourly-cta]').click();
   for(const [k,v] of Object.entries({name:'Persona de prueba',phone:'+525512345678',email:'client@example.invalid'}))await p.locator('#long-term-'+k).fill(v);
   await p.locator('#long-term-consent').check();await p.reload();await p.locator('#long-term-name').waitFor();
   assert.equal(await p.locator('#long-term-name').inputValue(),'Persona de prueba');assert(await p.locator('#long-term-consent').isChecked());assert.equal(submitted,0);
   await p.locator('#long-term-consent').uncheck();await p.reload();await p.locator('#long-term-name').waitFor();assert(!await p.locator('#long-term-consent').isChecked());
   await p.locator('.long-term-request [type=submit]').click();assert.equal(submitted,0);
   await p.locator('#long-term-consent').check();await p.locator('#long-term-phone').fill('+123');await p.locator('.long-term-request [type=submit]').click();assert.equal(submitted,0);
   await p.locator('#long-term-phone').fill('+525512345678');await p.locator('.long-term-request [type=submit]').click();
   await p.waitForFunction(()=>document.querySelector('.long-term-request__status').textContent.includes('confirmar'));
   assert.equal(submitted,1);assert(await p.locator('#long-term-name').isEnabled());assert(await p.getByRole('button',{name:'Volver a Configuración',exact:true}).isEnabled());
   await p.locator('#long-term-name').fill('Nombre corregido');await p.reload();await p.locator('#long-term-name').waitFor();assert.equal(await p.locator('#long-term-name').inputValue(),'Nombre corregido');assert.equal(submitted,1);
   await p.evaluate(()=>{const old=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='pixkuy_long_term_request_v1')throw new Error('Synthetic storage refusal');return old.call(this,k,v);};});
   await p.locator('.long-term-request [type=submit]').click();assert.equal(submitted,1);assert.match(await p.locator('.long-term-request__status').innerText(),/navegador/);
   assert.deepEqual(t.state.errors,[]);
   assert.equal(t.state.requests.filter(r=>r.kind==='precheck').length,0,'Long-term request must not ask for transactional availability');
   await fs.writeFile(path.join(base.output,'editing-results.json'),JSON.stringify({result:'PASS',boundary:'CONTROLLED_HTTP',editingReload:true,consentRevocationReload:true,invalidPhoneBlocked:true,missingAudienceRetainsEditableData:true,storageFailureBlocksSend:true,realRequests:0},null,2));
   console.log('PASS editing, consent, missing configuration and storage guards');
 }finally{await t.context.close();await browser.close();}
}
async function manualFixes(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const before=process.argv.includes('--before'),browser=await base.launchChrome();base.setBrowser(browser);
 const t=await base.setup(1440,'hourly_daily'),p=t.page,results=[];let submissions=0;
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,r=>{submissions++;return r.fulfill({status:503,contentType:'application/json',body:'{"code":"UNEXPECTED_REQUEST_IN_NAVIGATION_TEST"}'});});
 const shot=async name=>{await p.locator('.long-term-request img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));await p.screenshot({path:path.join(base.output,(before?'before-':'')+name+'.png'),fullPage:true});};
 const changeLang=async lang=>{await p.locator('.lang [data-lang="'+lang+'"]').evaluate(n=>n.click());await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);await p.waitForTimeout(250);};
 const backButton=()=>p.getByRole('button',{name:/^(Volver a Configuración|Back to Configuration)$/});
 const panelState=()=>p.locator('#services-expand-hourly').evaluate(n=>({hidden:n.hidden,top:n.getBoundingClientRect().top,open:window.PixkuyServicesExpand.getOpenService(),mode:document.querySelector('[data-services-hourly-mode="custom_long_term"]')?.getAttribute('aria-pressed'),hash:location.hash}));
 try{
   await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyLongTermRequest);
   await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
   await p.locator('[data-service-expand-trigger="hourly"]').click();await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
   await p.locator('[data-services-hourly-pickup-input]').fill('Hotel de prueba — Reforma 1234, Ciudad de México');await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');await p.locator('[data-services-hourly-notes]').fill('Agenda original sin traducir: lunes y viernes.');
   await p.locator('[data-services-hourly-cta]').click();await p.locator('#long-term-name').fill('Persona de prueba');await p.locator('#long-term-phone').fill('+525512345678');await p.locator('#long-term-email').fill('client@example.invalid');
   await shot('data-es');await backButton().click();await p.waitForTimeout(400);results.push({case:'return-before-reload',...await panelState()});
   await p.locator('[data-services-hourly-cta]').click();await changeLang('en');await shot('data-en');
   await p.reload();await p.locator('#long-term-name').waitFor();assert.equal(await p.locator('#long-term-name').inputValue(),'Persona de prueba');
   await backButton().click();await p.waitForTimeout(500);const returned=await panelState();results.push({case:'return-after-reload',...returned});
   if(before){assert(returned.hidden,'Reproduce the reported closed panel');await p.screenshot({path:path.join(base.output,'before-return-after-f5.png'),fullPage:false});await p.locator('[data-service-expand-trigger="hourly"]').click();}
   else{assert.equal(returned.hidden,false);assert.equal(returned.open,'hourly');assert.equal(returned.mode,'true');assert(returned.top>=0&&returned.top<110);const top=returned.top;await p.waitForTimeout(600);assert(Math.abs((await panelState()).top-top)<2,'No late scroll undo');}
   await p.locator('[data-services-hourly-cta]').click();await p.locator('#long-term-name').waitFor();
   if(!before){
     assert.equal(await p.locator('#long-term-name').inputValue(),'Persona de prueba');
     assert.equal(await p.locator('#long-term-consent').isChecked(),false);
     const logo=await p.locator('.long-term-request .airport-booking__logo').evaluate(n=>({loaded:n.complete&&n.naturalWidth>0,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));assert(logo.loaded&&logo.width>100&&logo.height>10);
     assert.equal(await p.locator('.long-term-request .airport-booking__progress li').count(),2);assert.equal(await p.locator('.long-term-request .airport-booking__progress .is-current').count(),1);
     assert(await p.locator('.long-term-request [type=submit]').evaluate(n=>n.classList.contains('cta')));
   }
   await p.evaluate(()=>{const key='pixkuy_long_term_request_v1',d=JSON.parse(sessionStorage.getItem(key));d.attempt={config:structuredClone(d.config),key:'a'.repeat(64),secret:'b'.repeat(64),body:{locale:'en'}};d.receipt={reference:'PL-SYNTHETIC-NAVIGATION-ONLY',state:'received'};sessionStorage.setItem(key,JSON.stringify(d));});
   await p.reload();await p.getByRole('heading',{name:'Request received',exact:true}).waitFor();await shot('received-en');await changeLang('es');await shot('received-es');
   if(!before){
     assert.equal(await p.locator('.long-term-request .airport-booking__progress .is-complete').count(),2);assert.equal(await p.locator('.long-term-request [aria-current="step"]').count(),0);assert.equal(await backButton().count(),0);assert(!/PL-/.test(await p.locator('.long-term-request').innerText()));
     assert.equal(await p.getByRole('button',{name:'Volver al inicio',exact:true}).evaluate(n=>getComputedStyle(n).borderTopWidth),'1px');
     const sent=await p.evaluate(()=>{const d=JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1'));return JSON.stringify({attempt:d.attempt,receipt:d.receipt});});
     await p.evaluate(()=>sessionStorage.setItem('pixkuy_hourly_checkout_review_snapshot',JSON.stringify({sentinel:'independent-hourly-draft'})));
     // Preserve the underlying selected panel as it is immediately after sending.
     await p.evaluate(()=>window.dispatchEvent(new CustomEvent('pixkuy:contact-hourly-daily-sync',{detail:{snapshot:JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).config}})));
     await p.getByRole('button',{name:'Reservar otro servicio',exact:true}).click();await p.waitForTimeout(300);assert.equal(new URL(p.url()).hash,'#services');assert.equal(await p.locator('.long-term-request:visible').count(),0);assert((await p.locator('#services').boundingBox()).y<100);
     await p.locator('[data-service-expand-trigger="hourly"]').click();assert.equal(await p.locator('[data-services-hourly-mode="custom_long_term"]').getAttribute('aria-pressed'),'false');
     await p.locator('[data-services-hourly-mode="custom_long_term"]').click();assert.equal(await p.locator('.long-term-request:visible').count(),0);
     assert.equal(await p.locator('[data-services-hourly-pickup-input]').inputValue(),'');
     assert.equal(await p.evaluate(()=>{const d=JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1:received:PL-SYNTHETIC-NAVIGATION-ONLY'));return JSON.stringify({attempt:d.attempt,receipt:d.receipt});}),sent);
     assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_hourly_checkout_review_snapshot')).sentinel),'independent-hourly-draft');
   }
   assert.equal(submissions,0);assert.deepEqual(t.state.errors,[]);
   await fs.writeFile(path.join(base.output,before?'before-results.json':'manual-fixes-results.json'),JSON.stringify({result:'PASS',boundary:'CONTROLLED_RECEIVED_STATE_NO_SEND',results,submissions,errors:t.state.errors},null,2));console.log(before?'REPRODUCED closed panel after F5':'PASS manual-fixes navigation and presentation');
 }finally{await t.context.close();await browser.close();}
}
async function copyFixes(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const t=await base.setup(1440,'hourly_daily'),p=t.page,results=[];let submissions=0,keys;
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,r=>{submissions++;return r.fulfill({status:503,contentType:'application/json',body:'{}'});});
 try{
   await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyLongTermRequest);
   await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
   await p.locator('[data-service-expand-trigger="hourly"]').click();
   const lead=p.locator('#services-expand-hourly [data-i18n="services.cards.hourly.panel.text"]');
   for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
     const copy=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'long-term-request.json'),'utf8'));
     keys=keys||Object.keys(copy).sort();assert.deepEqual(Object.keys(copy).sort(),keys);assert(Object.values(copy).every(v=>typeof v==='string'&&v.trim()));
     await p.locator('.lang [data-lang="'+lang+'"]').evaluate(n=>n.click());
     await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);
     await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
     await p.waitForFunction(text=>document.querySelector('#services-expand-hourly [data-i18n="services.cards.hourly.panel.text"]').textContent===text,copy.configurationLead);
     await p.locator('[data-services-hourly-pickup-input]').fill('Hotel de prueba — Reforma 1234, Ciudad de México');
     await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');
     await p.locator('[data-services-hourly-notes]').fill('Agenda original sin traducir: lunes y viernes.');
     await p.locator('[data-services-hourly-cta]').click();await p.getByRole('heading',{name:copy.summary,exact:true}).waitFor();
     for(const [name,value] of Object.entries({name:'Persona de prueba',phone:'+525512345678',email:'client@example.invalid'}))await p.locator('#long-term-'+name).fill(value);
     await p.locator('.long-term-request [type=submit]').click();assert.equal(await p.locator('.long-term-request__status').innerText(),copy.consentRequired);assert.equal(submissions,0);
     assert.equal(await p.locator('.long-term-request .airport-booking__step-label').allTextContents().then(x=>x.join('|')),copy.configuration+'|'+copy.data);
     assert((await p.locator('.hourly-booking__summary').innerText()).includes('Agenda original sin traducir: lunes y viernes.'));
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await p.getByRole('button',{name:copy.back,exact:true}).click();await p.locator('[data-services-hourly-mode="hourly"]').click();
     const ordinary=await p.evaluate(()=>window.__pixkuyI18nDict.services.cards.hourly.panel.text);assert.equal(await lead.innerText(),ordinary);
     await p.locator('[data-services-hourly-mode="full_day"]').click();assert.equal(await lead.innerText(),ordinary);
     results.push({lang,keys:keys.length,configurationLead:true,formalSummary:copy.summary,consentBlocked:true,ordinaryModesUnchanged:true});
   }
   const hashes=[];
   for(const [url,sha256] of base.resources){if(/long-term-request\.(js|css|json)$/.test(url)){const local=await fs.readFile(path.resolve(__dirname,'..','.'+url));assert.equal(require('node:crypto').createHash('sha256').update(local).digest('hex'),sha256,url);hashes.push({url,sha256});}}
   assert.equal(hashes.length,11);assert.equal(submissions,0);assert.deepEqual(t.state.errors,[]);
   await fs.writeFile(path.join(base.output,'copy-fixes-results.json'),JSON.stringify({result:'PASS',boundary:'REAL_HTTPS_ASSETS_CONTROLLED_HTTP',results,hashes,submissions,errors:t.state.errors},null,2));console.log('PASS nine locales, consent guard, mode copy and 11 served resource hashes');
 }finally{await t.context.close();await browser.close();}
}
async function finishing(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const t=await base.setup(1440,'hourly_daily'),p=t.page,results=[];let submissions=0,whatsappRequests=0;
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,r=>{submissions++;return r.fulfill({status:503,contentType:'application/json',body:'{}'});});
 await t.context.route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//,r=>{whatsappRequests++;return r.abort();});
 const locale=async lang=>{await p.locator('.lang [data-lang="'+lang+'"]').evaluate(n=>n.click());await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);await p.waitForTimeout(250);};
 const shot=async name=>{await p.locator('.long-term-request img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));await p.screenshot({path:path.join(base.output,name+'.png'),fullPage:true});};
 const connector=async()=>{
   const value=await p.locator('.long-term-request__steps:not(.long-term-request__steps--config)').evaluate(n=>{const a=n.children[0],b=n.children[1],s=getComputedStyle(a,'::after');return {end:a.getBoundingClientRect().left+parseFloat(s.left)+parseFloat(s.width),next:b.querySelector('.airport-booking__step-marker').getBoundingClientRect().left,lastContent:getComputedStyle(b,'::after').content};});
   assert(Math.abs(value.end-value.next)<2,'Connector ends at second marker');assert.equal(value.lastContent,'none');return value;
 };
 try{
   await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyLongTermRequest);
   await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
   const hourlyRadius=await p.locator('#hourly-contact-submit').evaluate(n=>getComputedStyle(n).borderTopLeftRadius);
   await p.locator('[data-service-expand-trigger="hourly"]').click();await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
   await p.locator('[data-services-hourly-pickup-input]').fill('Hotel de prueba — Reforma 1234, Ciudad de México');await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');await p.locator('[data-services-hourly-notes]').fill('Agenda original sin traducir: lunes y viernes.');
   await p.locator('[data-services-hourly-cta]').click();
   for(const [name,value] of Object.entries({name:'Persona de prueba',phone:'+525512345678',email:'client@example.invalid'}))await p.locator('#long-term-'+name).fill(value);
   for(const lang of ['es','en']){
     await locale(lang);const send=p.locator('.long-term-request [type=submit]');
     assert.equal(await send.evaluate(n=>getComputedStyle(n).borderTopLeftRadius),hourlyRadius);
     await send.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert(await send.evaluate(n=>n===document.activeElement&&parseFloat(getComputedStyle(n).outlineWidth)>0));
     await send.click();const expected=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'long-term-request.json'),'utf8'));assert.equal(await p.locator('.long-term-request__status').innerText(),expected.consentRequired);
     // CSS-only disabled-state probe, not a simulated successful send.
     await send.evaluate(n=>n.disabled=true);assert.equal(await send.evaluate(n=>getComputedStyle(n).borderTopLeftRadius),hourlyRadius);await send.evaluate(n=>n.disabled=false);
     await p.locator('#long-term-name').fill('Persona de prueba');await p.locator('#long-term-name').blur();
     results.push({screen:'data',lang,radius:hourlyRadius,connector:await connector(),consentBlocked:true,focus:true});await shot('data-'+lang);
   }
   await p.evaluate(()=>{const k='pixkuy_long_term_request_v1',d=JSON.parse(sessionStorage.getItem(k));d.attempt={config:structuredClone(d.config),key:'a'.repeat(64),secret:'b'.repeat(64),body:{locale:'en'}};d.receipt={reference:'PL-SYNTHETIC-FINISHING-ONLY',state:'received'};sessionStorage.setItem(k,JSON.stringify(d));});
   await p.reload();await p.getByRole('heading',{name:'Request received',exact:true}).waitFor();
   for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
     await locale(lang);const dictionary=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang+'.json'),'utf8'));assert(dictionary.contact.whatsappCta);
     const link=p.locator('.long-term-request .airport-booking__contact-action');assert.equal(await link.innerText(),dictionary.contact.whatsappCta);assert.equal(await link.getAttribute('aria-label'),dictionary.contact.whatsappCta);
     const href=new URL(await link.getAttribute('href')),configured=new URL(await p.locator('[data-whatsapp-floating] a').getAttribute('href'));
     assert.equal(href.origin,'https://wa.me');assert.equal(href.pathname,configured.pathname);assert.equal(href.search,'');assert.equal(href.hash,'');assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);
     assert.equal(await link.locator('.airport-booking__icon').innerHTML(),await p.evaluate(()=>window.PixkuyAirportDesktopView.icon('contact').innerHTML));assert.equal(await link.evaluate(n=>getComputedStyle(n).borderTopWidth),'1px');
     assert.equal(await p.locator('.long-term-request .is-complete').count(),2);assert(!/PL-/.test(await p.locator('.long-term-request').innerText()));
     assert.equal(await p.locator('.long-term-request .airport-booking__actions > *').count(),3);
     results.push({screen:'received',lang,label:dictionary.contact.whatsappCta,destination:href.href,connector:await connector(),completed:2});
     if(['es','en'].includes(lang))await shot('received-'+lang);
   }
   assert.equal(submissions,0);assert.equal(whatsappRequests,0);assert.deepEqual(t.state.errors,[]);
   const hashes=[];for(const [url,sha256] of base.resources){if(/long-term-request\.(js|css)$/.test(url)){const bytes=await fs.readFile(path.resolve(__dirname,'..','.'+url));assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),sha256);hashes.push({url,sha256});}}assert.equal(hashes.length,2);
   await fs.writeFile(path.join(base.output,'finishing-results.json'),JSON.stringify({result:'PASS',origin:base.origin,boundary:'REAL_LOCAL_ASSETS_CONTROLLED_RECEIPT_NO_SEND',results,hashes,submissions,whatsappRequests,errors:t.state.errors},null,2));console.log('PASS finishing: 2 screens ES/EN, 9 contact labels, configured WhatsApp without navigation, 0 sends');
 }finally{await t.context.close();await browser.close();}
}
async function mobileBefore(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const t=await base.setup(390,'hourly_daily'),p=t.page;
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 if(process.env.PIXKUY_AUDIT_PREIMAGE){
  const root=path.resolve(process.env.PIXKUY_AUDIT_PREIMAGE),manifest=JSON.parse(await fs.readFile(path.resolve(root,'../../../preimages.json'),'utf8'));
  for(const item of manifest){if(!item.path.startsWith('pixkuy_landing/public/assets/'))continue;const relative=item.path.slice('pixkuy_landing/public/'.length),file=path.join(root,relative),bytes=await fs.readFile(file);
   assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex').toUpperCase(),item.sha256.toUpperCase());
   await t.context.route(url=>url.origin===base.origin&&url.pathname==='/'+relative,r=>r.fulfill({body:bytes,contentType:relative.endsWith('.css')?'text/css':relative.endsWith('.json')?'application/json':'application/javascript'}));
  }
 }
 try{
  await base.enter(t);await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
  await p.locator('[data-services-hourly-pickup-input]').evaluate(n=>{n.value='Hotel de prueba — Reforma 1234, Ciudad de México';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');
  await p.locator('[data-services-hourly-notes]').click();await p.locator('[data-hourly-mobile-notes-editor-input]').fill('Agenda intacta: lunes <centro> & hotel.');await p.locator('[data-hourly-mobile-notes-editor-close]').click();
  await p.locator('[data-hourly-mobile-long-term-select]').selectOption('monthly');
  await p.locator('[data-fleet-hourly-passengers]').selectOption('4');
  await p.screenshot({path:path.join(base.output,'before-configuration-es.png'),fullPage:false});
  await p.locator('.lang [data-lang="en"]').evaluate(n=>n.click());await p.waitForTimeout(350);await p.screenshot({path:path.join(base.output,'before-configuration-en.png'),fullPage:false});
  await p.locator('.lang [data-lang="es"]').evaluate(n=>n.click());await p.waitForTimeout(350);
  await p.locator('[data-services-hourly-cta]').click();
  const screen=p.locator('.hourly-mobile-contact-step');await screen.waitFor({state:'visible'});
  const fields=await screen.locator('input:not([type=hidden])').evaluateAll(ns=>ns.map(n=>({id:n.id,name:n.name,type:n.type})));
  await screen.locator('input[type=text]').first().fill('Persona sintética');
  await screen.locator('input[type=tel]').fill('+525512345678');await screen.locator('input[type=email]').fill('client@example.invalid');
  await screen.locator('input[type=email]').blur();
  await p.screenshot({path:path.join(base.output,'before-data-es.png'),fullPage:false});
  await p.locator('.lang [data-lang="en"]').evaluate(n=>n.click());await p.waitForTimeout(350);await p.screenshot({path:path.join(base.output,'before-data-en.png'),fullPage:false});
  const before=await p.evaluate(()=>({hash:location.hash,stored:!!sessionStorage.getItem('pixkuy_long_term_request_v1'),height:getComputedStyle(document.body).height,position:getComputedStyle(document.body).position}));
  await p.reload();await p.waitForFunction(()=>window.PixkuyHourlyMobileBookingFlow);
  await p.waitForTimeout(500);
  const after=await p.locator('[data-services-hourly-mode][aria-pressed=true]').getAttribute('data-services-hourly-mode');
  assert.equal(after,'hourly');assert.deepEqual(t.state.errors,[]);
  await fs.writeFile(path.join(base.output,'before-results.json'),JSON.stringify({boundary:'CHROME_CONTROLLED_HTTP',before,after,fields,errors:t.state.errors,confirmation:'No existing API receipt in this mobile path; no submission performed.'},null,2));
 }finally{await t.context.close();await browser.close();}
}
async function mobileCapture(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const results=[];
 const c={mode:'custom_long_term',pickup:'Hotel de prueba — Reforma 1234, Ciudad de México',tripDate:'2027-01-28',startTime:'07:43',customTerm:'monthly',passengerBand:'3-4',notes:'Agenda intacta: lunes <centro> & hotel.'};
 try{for(const stage of ['config','data','received']){
  const received=stage==='received';
  const t=await base.setup(390,'hourly_daily'),p=t.page;let posts=0;
  await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
  await t.context.addInitScript(({c,received})=>{sessionStorage.setItem('pixkuy_long_term_request_v1',JSON.stringify({version:1,config:c,contact:{name:'Persona sintética',phone:'+525512345678',email:'client@example.invalid'},...(received?{attempt:{config:c,body:{locale:'es'},key:'controlled',secret:'controlled'},receipt:{state:'received',reference:'PL-controlled-capture'}}:{})}));},{c,received});
  p.on('request',r=>{if(r.method()==='POST')posts++;});
  try{
   await p.goto(base.origin+'/?lang=es#long-term/'+(stage==='config'?'config':'datos'));await p.locator(stage==='config'?'[data-services-hourly-cta]':'.long-term-request').waitFor({state:'visible'});await p.locator('[data-consent-reject]').click({timeout:700}).catch(()=>{});
   for(const lang of ['es','en']){
    await p.locator('.lang [data-lang="'+lang+'"]').evaluate(n=>n.click());await p.waitForTimeout(300);
    if(stage==='config'){
     const notes=await p.locator('[data-services-hourly-notes]').evaluate(n=>({value:n.value,scrollLeft:n.scrollLeft,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}));assert.equal(notes.value,c.notes);assert.equal(await p.locator('[data-fleet-hourly-passengers]').inputValue(),'4');
     await p.screenshot({path:path.join(base.output,'configuration-'+lang+'.png'),fullPage:false});results.push({screen:'configuration',lang,notes});continue;
    }
    const progress=await p.locator('.long-term-request__steps').evaluate(n=>({last:getComputedStyle(n.lastElementChild,'::after').content,items:n.children.length}));assert.equal(progress.items,2);assert.equal(progress.last,'none');
    assert.equal(await p.locator('.long-term-request .is-complete').count(),received?2:1);
    if(received){const icon=p.locator('.long-term-request .airport-booking__contact-action svg');assert.notEqual(await icon.evaluate(n=>getComputedStyle(n).stroke),'none');assert((await icon.boundingBox()).width>0);}
    await p.screenshot({path:path.join(base.output,(received?'received-':'data-')+lang+'.png'),fullPage:false});
    results.push({screen:received?'received':'data',lang,progress});
   }
   assert.equal(posts,0);assert.deepEqual(t.state.errors,[]);
  }finally{await t.context.close();}
 }
 await fs.writeFile(path.join(base.output,'mobile-visual-results.json'),JSON.stringify({result:'PASS',origin:base.origin,boundary:'CONTROLLED_STATES_NO_SEND',results,posts:0},null,2));
 }finally{await browser.close();}
}
async function mobile(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const results=[];
 const fixture={pickup:'Hotel de prueba — Reforma 1234, Ciudad de México',notes:'Agenda intacta: lunes <centro> & hotel.',name:'Persona sintética',phone:'+525512345678',email:'client@example.invalid'};
 try{for(const isolated of (process.argv.includes('--isolated-only')?[true]:[false,true])){
  const t=await base.setup(390,'hourly_daily'),p=t.page,sent=[],posts=[];let receipt=null,recoveries=0,responseMode='lost';
  await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
  if(isolated){
   await t.context.route('**/assets/js/forms/index.js',r=>r.fulfill({contentType:'application/javascript',body:'/* Isolation: legacy form initializer not loaded. */'}));
   await t.context.addInitScript(()=>{
    new MutationObserver(()=>document.querySelectorAll('form[name="contact"]').forEach(n=>n.remove())).observe(document,{childList:true,subtree:true});
    HTMLFormElement.prototype.requestSubmit=function(){throw new Error('LEGACY_REQUEST_SUBMIT_FORBIDDEN');};
    HTMLFormElement.prototype.submit=function(){throw new Error('LEGACY_SUBMIT_FORBIDDEN');};
   });
  }
  p.on('request',r=>{if(r.method()==='POST')posts.push(new URL(r.url()).pathname);});
  await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,async r=>{
   const json=(body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(r.request().url().endsWith('/recover')){recoveries++;return receipt?json({receipt}):json({code:'REQUEST_NOT_FOUND'},404);}
   sent.push({body:r.request().postDataJSON(),key:r.request().headers()['idempotency-key']});
   if(responseMode==='reject')return json({code:'NOTIFICATION_NOT_CONFIGURED'},503);
   receipt={reference:'PL-controlled-mobile',state:'received'};
   if(responseMode==='lost')return r.abort('failed');
   await p.waitForTimeout(150);return json({receipt});
  });
  const shot=async label=>{await p.screenshot({path:path.join(base.output,(isolated?'isolated-':'')+label+'.png'),fullPage:false});};
  const changeLang=async lang=>{await p.locator('.lang [data-lang="'+lang+'"]').evaluate(n=>n.click());await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);await p.waitForTimeout(250);};
  const fillContact=async()=>{for(const key of ['name','phone','email'])await p.locator('#long-term-'+key).fill(fixture[key]);};
  try{
   await p.goto(base.origin+'/?service=hourly_daily&lang=es');await p.waitForFunction(()=>window.PixkuyLongTermRequest&&window.PixkuyHourlyMobileBookingFlow);
   await p.locator('[data-consent-reject]').click({timeout:700}).catch(()=>{});
   await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
   await p.locator('[data-services-hourly-pickup-input]').evaluate((n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));},fixture.pickup);
   await p.locator('[data-services-hourly-date]').fill('2027-01-28');await p.locator('[data-services-hourly-time]').fill('07:43');
   await p.locator('[data-hourly-mobile-long-term-select]').selectOption('monthly');await p.locator('[data-fleet-hourly-passengers]').selectOption('4');
   await p.locator('[data-services-hourly-notes]').click();await p.locator('[data-hourly-mobile-notes-editor-input]').fill(fixture.notes);await p.locator('[data-hourly-mobile-notes-editor-close]').click();
   assert.equal(await p.locator('.services-hourly-panel__price--inline:visible').count(),0);
   for(const locale of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
    await changeLang(locale);const dict=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n/'+locale+'/long-term-request.json'),'utf8'));
    assert.equal(await p.locator('[data-hourly-mobile-flow-helper]').innerText(),dict.configurationLead);
    assert.equal(await p.locator('[data-services-hourly-notes]').inputValue(),fixture.notes);
    if(['es','en'].includes(locale))await shot('configuration-'+locale);
   }await changeLang('es');
   await p.locator('[data-services-hourly-cta]').click();await p.locator('#long-term-name').waitFor({state:'visible'});
   assert.equal(await p.locator('#long-term-consent').isChecked(),false);
   assert.equal(await p.locator('.long-term-request img').count(),0);
   assert.match(await p.locator('.long-term-request').innerText(),/3–4/);
   await p.locator('.long-term-request button[type=submit]').click();assert.equal(sent.length,0);
   await fillContact();await p.locator('.long-term-request button[type=submit]').click();assert.equal(sent.length,0);
   assert.match(await p.locator('.long-term-request__status').innerText(),/condiciones/);
   await p.locator('#long-term-email').fill('invalid');await p.locator('.long-term-request button[type=submit]').click();assert.equal(sent.length,0);await fillContact();
   await shot('data-es');await changeLang('en');await shot('data-en');
   const saved=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')));
   assert.equal(saved.config.notes,fixture.notes);assert.equal(saved.config.passengerBand,'3-4');
   await p.reload();await p.locator('#long-term-name').waitFor({state:'visible'});
   for(const key of ['name','phone','email'])assert.equal(await p.locator('#long-term-'+key).inputValue(),fixture[key]);
   assert.equal(await p.locator('#long-term-consent').isChecked(),false);assert.equal(await p.evaluate(()=>document.documentElement.lang),'en');
   await p.getByRole('button',{name:'Back to Configuration',exact:true}).click();await p.locator('[data-services-hourly-cta]').waitFor({state:'visible'});
   assert.equal(await p.locator('[data-services-hourly-pickup-input]').inputValue(),fixture.pickup);assert.equal(await p.locator('[data-fleet-hourly-passengers]').inputValue(),'4');
   await p.reload();await p.locator('[data-services-hourly-cta]').waitFor({state:'visible'});assert.equal(await p.locator('[data-hourly-mobile-long-term-select]').inputValue(),'monthly');
   await p.locator('[data-services-hourly-mode="hourly"]').click();await p.locator('[data-services-hourly-mode="custom_long_term"]').click();assert.equal(await p.locator('[data-services-hourly-notes]').inputValue(),fixture.notes);
   await p.locator('[data-services-hourly-cta]').click();await p.locator('#long-term-name').waitFor({state:'visible'});
   const focused=[];for(const key of ['name','phone','email']){
    await p.locator('#long-term-'+key).focus();await p.locator('#long-term-'+key).scrollIntoViewIfNeeded();
    const bounds=await p.locator('#long-term-'+key).boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=844);focused.push({key,...bounds});
   }
   assert.equal(await p.evaluate(()=>getComputedStyle(document.body).position),'relative');
   if(isolated){assert.equal(await p.locator('form[name=contact]').count(),0);assert.equal(await p.evaluate(()=>window.PixkuyForms.getReservationForm?.()||null),null);}
   for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
    await changeLang(lang);const dict=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n/'+lang+'/long-term-request.json'),'utf8'));
    assert.match(await p.locator('.long-term-request').innerText(),new RegExp(dict.requestedPeriod));
    assert.equal(await p.locator('#long-term-name').inputValue(),fixture.name);
   }
   await changeLang('es');await p.locator('#long-term-consent').check();
   if(isolated){responseMode='reject';await p.locator('.long-term-request button[type=submit]').click();await p.waitForFunction(()=>!JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).attempt);assert.equal(sent.length,1);responseMode='success';}
   await p.locator('.long-term-request button[type=submit]').evaluate(n=>{n.click();n.click();});
   if(!isolated){await p.waitForFunction(()=>JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).error==='sendError');assert.equal(sent.length,1);await p.reload();}
   await p.getByRole('heading',{name:'Solicitud recibida',exact:true}).waitFor();
   const expected=isolated?2:1;assert.equal(sent.length,expected);assert.equal(sent.at(-1).body.request.passengerBand,'3-4');assert.equal(sent.at(-1).body.request.notes,fixture.notes);
   await fs.writeFile(path.join(base.output,'captured-request.json'),JSON.stringify(sent.at(-1).body.request,null,2));
   assert.equal(await p.locator('.long-term-request .is-complete').count(),2);assert(!/PL-/.test(await p.locator('.long-term-request').innerText()));
   await shot('received-es');await changeLang('en');await shot('received-en');await p.reload();await p.getByRole('heading',{name:'Request received',exact:true}).waitFor();assert.equal(sent.length,expected);
   const contact=new URL(await p.locator('.long-term-request .airport-booking__contact-action').getAttribute('href'));assert.equal(contact.origin,'https://wa.me');assert.equal(contact.search,'');
   await p.getByRole('button',{name:'Back to home',exact:true}).click();assert.equal(new URL(p.url()).hash,'');assert.equal(new URL(p.url()).searchParams.get('lang'),'en');
   await p.goBack();await p.getByRole('heading',{name:'Request received',exact:true}).waitFor();
   await p.getByRole('button',{name:'Book another service',exact:true}).click();assert.equal(new URL(p.url()).hash,'#services');
   assert.equal(sent.length,expected);assert(!posts.some(path=>!path.startsWith('/v1/public/long-term-requests')));assert.deepEqual(t.state.errors,[]);
   results.push({isolated,result:'PASS',controlledPosts:sent.length,recoveries,netlifySubmissions:0,reservations:0,realRequests:0,realEmails:0,focused,errors:t.state.errors});
  }catch(error){await shot('failure').catch(()=>{});console.log({isolated,errors:t.state.errors,posts,url:p.url(),detail:await p.locator('.long-term-request').innerText().catch(()=>null)});throw error;}finally{await t.context.close();}
 }
 await fs.writeFile(path.join(base.output,process.argv.includes('--isolated-only')?'mobile-isolated-final-results.json':'mobile-results.json'),JSON.stringify({result:'PASS',origin:base.origin,boundary:'REAL_LOCAL_ASSETS_CHROME_CONTROLLED_HTTP',results,safariKeyboard:'NOT_VERIFIED'},null,2));console.log('PASS mobile long-term normal and/or without Netlify form/init');
 }finally{await browser.close();}
}
async function anotherService(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');await fs.mkdir(base.output,{recursive:true});
 const browser=await base.launchChrome();base.setBrowser(browser);const results=[],before=process.argv.includes('--before');
 const key='pixkuy_long_term_request_v1',config={mode:'custom_long_term',pickup:'Recogida sintética, Ciudad de México',tripDate:'2027-01-28',startTime:'09:00',customTerm:'week',notes:'Agenda anterior',passengerBand:'3-4'};
 const original={version:1,config,contact:{name:'Prueba anterior',phone:'+525512345678',email:'old@example.invalid'},attempt:{key:'a'.repeat(64),secret:'b'.repeat(64),config,body:{locale:'en'}},receipt:{reference:'PL-CONTROLLED-PREVIOUS',state:'received'}};
 try{for(const width of (before?[390]:[390,1440])){
  const t=await base.setup(width,'hourly_daily'),p=t.page,posts=[];let nextKey='';
  await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
  await t.context.route(/\/v1\/public\/long-term-requests(?:\/recover)?$/,r=>{posts.push(r.request().url());nextKey=r.request().headers()['idempotency-key'];return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'RECOVERY_UNAVAILABLE'})});});
  await p.goto(base.origin+'/?lang=en#services');await p.waitForFunction(()=>window.PixkuyLongTermRequest&&window.PixkuyMobileTopbarMenu);
  await p.locator('[data-consent-reject]').click({timeout:800}).catch(()=>{});
  await p.evaluate(({key,original})=>{sessionStorage.setItem(key,JSON.stringify(original));sessionStorage.setItem('pixkuy_hourly_checkout_review_snapshot',JSON.stringify({sentinel:'independent-hourly'}));sessionStorage.setItem('pixkuy_airport_transfer_checkout_review_snapshot',JSON.stringify({sentinel:'independent-airport'}));}, {key,original});
  await p.evaluate(()=>history.replaceState(null,'','?lang=en#long-term/datos'));await p.reload();
  await p.getByRole('heading',{name:'Request received',exact:true}).waitFor();
  await p.reload();await p.getByRole('heading',{name:'Request received',exact:true}).waitFor();assert.equal(posts.length,0);
  await p.screenshot({path:path.join(base.output,`${width}-confirmation.png`),fullPage:true});
  if(!before&&width===390){
   await p.evaluate(()=>{window.__restoreStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes(':received:'))throw new DOMException('Controlled quota','QuotaExceededError');return window.__restoreStorageWrite.call(this,key,value);};});
   await p.getByRole('button',{name:'Book another service',exact:true}).click();
   assert.equal(new URL(p.url()).hash,'#long-term/datos');assert(await p.locator('.long-term-request__status').isVisible());
   assert.deepEqual(await p.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),key),original);assert.equal(posts.length,0);
   await p.evaluate(()=>{Storage.prototype.setItem=window.__restoreStorageWrite;delete window.__restoreStorageWrite;});
  }
  await p.getByRole('button',{name:'Book another service',exact:true}).click();await p.waitForTimeout(500);
  const destination=await p.evaluate(()=>({hash:location.hash,lang:document.documentElement.lang,menu:window.PixkuyMobileTopbarMenu.isOpen(),servicesVisible:document.getElementById('services').getBoundingClientRect().height>0,stateReceived:JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).receipt?.state||null}));
  await p.screenshot({path:path.join(base.output,`${before?'before-':''}${width}-services.png`),fullPage:false});
  if(before){assert.equal(destination.menu,false);assert.equal(destination.stateReceived,'received');results.push({width,reproduced:true,...destination});await t.context.close();continue;}
  assert.equal(destination.hash,'#services');assert.equal(destination.lang,'en');assert.equal(destination.stateReceived,null);
  if(width<=720){assert(destination.menu);await p.locator('[data-mobile-topbar-menu-action="hourly"]').click();}
  else{assert(destination.servicesVisible);await p.locator('[data-service-expand-trigger="hourly"]').click();}
  await p.locator('[data-services-hourly-mode="custom_long_term"]').click();
  assert.equal(await p.locator('.long-term-request:visible').count(),0);
  assert.equal(await p.locator('[data-services-hourly-pickup-input]').inputValue(),'');
  await p.waitForTimeout(600);
  assert.equal(await p.locator('[data-services-hourly-mode][aria-pressed=true]').getAttribute('data-services-hourly-mode'),'custom_long_term');
  await p.locator('#services-expand-hourly').screenshot({path:path.join(base.output,`${width}-new-configuration.png`)});
  await p.locator('[data-services-hourly-pickup-input]').evaluate(n=>{n.value='Nueva recogida sintética, Ciudad de México';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('[data-services-hourly-date]').fill('2027-02-02');await p.locator('[data-services-hourly-time]').fill('10:00');
  await p.locator('[data-services-hourly-cta]').click();await p.locator('#long-term-name').waitFor().catch(async error=>{console.log({width,url:p.url(),errors:t.state.errors,config:await p.evaluate(()=>JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).config)});throw error;});
  assert.equal(await p.locator('#long-term-name').inputValue(),'');assert.equal(await p.locator('#long-term-consent').isChecked(),false);
  await p.screenshot({path:path.join(base.output,`${width}-new-data.png`),fullPage:true});
  await p.reload();await p.locator('#long-term-name').waitFor();assert.equal(await p.locator('#long-term-consent').isChecked(),false);assert.equal(posts.length,0);
  const retained=await p.evaluate(key=>({old:JSON.parse(sessionStorage.getItem(key+':received:PL-CONTROLLED-PREVIOUS')),hourly:JSON.parse(sessionStorage.getItem('pixkuy_hourly_checkout_review_snapshot')),airport:JSON.parse(sessionStorage.getItem('pixkuy_airport_transfer_checkout_review_snapshot')),current:JSON.parse(sessionStorage.getItem(key)),lang:document.documentElement.lang}),key);
  assert.deepEqual(retained.old,original);assert.equal(retained.hourly.sentinel,'independent-hourly');assert.equal(retained.airport.sentinel,'independent-airport');assert.equal(retained.lang,'en');assert(!retained.current.attempt);assert(!retained.current.receipt);
  // Only the existing transport boundary sees this new attempt; no API mutation or email.
  await t.context.route(/\/v1\/public\/long-term-requests$/,r=>{posts.push(r.request().url());assert.equal(r.request().headers()['idempotency-key'],nextKey);return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'CONTROLLED_UNAVAILABLE'})});});
  for(const [field,value] of Object.entries({name:'Nueva prueba',phone:'+525512345678',email:'new@example.invalid'}))await p.locator('#long-term-'+field).fill(value);
  await p.locator('.long-term-request [type=submit]').click();assert.equal(posts.length,0);
  await p.locator('#long-term-consent').check();await p.locator('.long-term-request [type=submit]').click();await p.waitForFunction(()=>JSON.parse(sessionStorage.getItem('pixkuy_long_term_request_v1')).error==='sendError');
  assert(nextKey&&nextKey!==original.attempt.key);assert.equal(posts.length,2);assert.deepEqual(await p.evaluate(key=>JSON.parse(sessionStorage.getItem(key+':received:PL-CONTROLLED-PREVIOUS')),key),original);
  assert.deepEqual(t.state.errors,[]);assert(!t.state.requests.some(r=>/checkout/.test(r.kind)));
  results.push({width,result:'PASS',destination,confirmationReload:true,archiveUnchanged:true,newIdentity:true,consentInitiallyFalse:true,independentDrafts:true,archiveStorageFailure:width===390?'PASS':'not repeated',controlledRequests:posts.length,browserErrors:t.state.errors});await t.context.close();
 }
 await fs.writeFile(path.join(base.output,before?'before-results.json':'another-service-results.json'),JSON.stringify({origin:base.origin,boundary:'REAL_LOCAL_ASSETS_CONTROLLED_TRANSPORT',realSubmissions:0,results},null,2));
 const verified=[];for(const [url,hash] of base.resources){if(!/long-term-request|hourly-mobile-booking-flow|mobile-topbar-menu|services-expand\.js/.test(url))continue;const local=await fs.readFile(path.resolve(__dirname,'..','.'+url));assert.equal(require('node:crypto').createHash('sha256').update(local).digest('hex'),hash,url);verified.push({url,sha256:hash});}
 await fs.writeFile(path.join(base.output,'served-hashes.json'),JSON.stringify(verified,null,2));
 console.log('PASS another-service '+(before?'reproduction':'mobile + desktop'));
 }finally{await browser.close();}
}
(process.argv.includes('--another-service')?anotherService():process.argv.includes('--mobile-capture')?mobileCapture():process.argv.includes('--mobile')?mobile():process.argv.includes('--mobile-before')?mobileBefore():process.argv.includes('--finishing')?finishing():process.argv.includes('--copy-fixes')?copyFixes():process.argv.includes('--manual-fixes')?manualFixes():process.argv.includes('--editing')?editing():process.argv.includes('--borders')||process.argv.includes('--reference')||process.argv.includes('--capture')?borders():main()).catch(e=>{console.error(e);process.exitCode=1;});
