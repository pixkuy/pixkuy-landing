'use strict';
// Existing product/runner; controlled HTTP states never reach booking writers.
const assert=require('node:assert/strict'), fs=require('node:fs/promises'), path=require('node:path'), crypto=require('node:crypto');
const base=require('./mobile-booking-audit.cjs');
const {chromium}=require('../../../pixkuy_frontend/node_modules/playwright');
const before=process.argv.includes('--before'), real=process.argv.includes('--real');
const rows=[];let browser;
async function capture(t,label){
 await t.page.waitForLoadState('networkidle');
 await t.page.locator('.hourly-booking img:visible, #services-expand-hourly img:visible').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode().catch(()=>{}))));
 const shot=await base.shot(t,label);
 if(await t.page.locator('.hourly-booking').isVisible())await t.page.screenshot({path:path.join(base.output,shot.file),fullPage:true});
 const photos=await t.page.locator('.hourly-booking img:visible, #services-expand-hourly img:visible').evaluateAll(ns=>ns.map(n=>({alt:n.alt,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,naturalWidth:n.naturalWidth})));
 return {label,...shot,photos};
}
async function setup(width=1440){
 const t=await base.setup(width,'hourly_daily');t.tasks=[];t.assets=[];
 const preimage=process.env.PIXKUY_AUDIT_PREIMAGE;
 const compared=/\/(?:hourly-booking-(?:flow|view|result)\.js|hourly-booking-flow\.css)$/;
 if(preimage)await t.context.route(compared,r=>r.fulfill({path:path.join(preimage,new URL(r.request().url()).pathname),contentType:r.request().url().endsWith('.css')?'text/css':'application/javascript'}));
 await t.context.route(/\.(mp4|webm)(\?|$)/,r=>r.abort());
 t.page.on('response',r=>{const u=new URL(r.url());if(u.origin===base.origin&&/\/(?:hourly-booking-(?:flow|view|result|draft)|services-expand)\.(js|css)$/.test(u.pathname))t.tasks.push((async()=>{const bytes=await r.body(),local=await fs.readFile(preimage&&compared.test(u.pathname)?path.join(preimage,u.pathname):path.resolve(__dirname,'..','.'+u.pathname));t.assets.push({path:u.pathname,preimage:!!preimage&&compared.test(u.pathname),status:r.status(),matches:bytes.equals(local),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});})());});
 t.page.setDefaultTimeout(15000);return t;
}
async function configure(t){
 const p=t.page;
 await p.goto(base.origin+'/#services');await p.waitForFunction(()=>window.PixkuyHourlyBookingFlow);
 await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
 await p.locator('[data-service-expand-trigger="hourly"]').click();
 await p.waitForTimeout(1200);
 t.openPosition=await p.locator('#services-expand-hourly').boundingBox();
 await p.locator('[data-services-hourly-mode="hourly"]').click();
 const pick=p.locator('[data-services-hourly-pickup-input]');
 if(real){
  await pick.fill('Hotel NH Collection Mexico City Reforma');
  await p.locator('[data-place-autocomplete-item]:visible').filter({hasText:/NH Collection/}).first().click({timeout:20000});
 }else{
  await pick.fill('Hotel de prueba — Reforma 1234, Ciudad de México');
  await pick.evaluate(n=>n.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-pickup-selected',{detail:{selectedPlace:{label:n.value,placeId:'synthetic-hourly-place',lat:19.427,lng:-99.1677}}})));
 }
 await p.locator('[data-services-hourly-date]').fill('2027-01-26');await p.locator('[data-services-hourly-date]').dispatchEvent('change');
 await p.locator('[data-services-hourly-time]').fill('10:00');await p.locator('[data-services-hourly-time]').dispatchEvent('change');
 await p.locator('[data-fleet-hourly-passengers]').selectOption('2');
 await p.locator('[data-services-hourly-notes]').fill('Recogida en recepción. Itinerario por Ciudad de México.');
 await p.waitForFunction(()=>window.PixkuyFleetSelection.hourlyOfferStatus().valid,null,{timeout:45000});
}
async function journey(){
 const t=await setup(),p=t.page,row={case:real?'real-availability':'controlled-journey',before,screens:[]};
 try{
  if(real){
   await t.context.unroute('**/*');
   await t.context.route('**/*',r=>{const u=new URL(r.request().url()),m=r.request().method();if(/\.(mp4|webm)$/.test(u.pathname))return r.abort();if(u.origin===base.origin&&(['GET','HEAD'].includes(m)||u.pathname==='/v1/public/reservations/hourly-availability-precheck'))return r.continue();if(['maps.googleapis.com','maps.gstatic.com','places.googleapis.com','fonts.googleapis.com','fonts.gstatic.com','unpkg.com'].includes(u.hostname)&&!u.pathname.includes('collect'))return r.continue();if(!['GET','HEAD'].includes(m))t.state.blocked.push(u.origin+u.pathname);return r.abort();});
   p.on('response',r=>{if(new URL(r.url()).pathname.endsWith('/hourly-availability-precheck'))t.tasks.push((async()=>{row.prechecks=row.prechecks||[];row.prechecks.push({status:r.status(),request:r.request().postDataJSON(),body:await r.json()});})());});
  }
  await configure(t);row.openPosition=t.openPosition;row.screens.push(await capture(t,'configuracion'));
  if(process.argv.includes('--navigation')){
   const panel=p.locator('#services-expand-hourly'),trigger=p.locator('[data-service-expand-trigger="hourly"]');
   async function stable(label){await p.waitForTimeout(1200);const first=await panel.boundingBox();await p.waitForTimeout(900);const last=await panel.boundingBox();assert(first&&last&&Math.abs(first.y-last.y)<2&&last.y>=0&&last.y<100,'Panel must remain at the viewport start');row.positions=row.positions||[];row.positions.push({label,first,last});row.screens.push(await capture(t,label));}
   await stable('apertura-estable');await trigger.click();await panel.waitFor({state:'hidden'});await trigger.click();await stable('reapertura-estable');
   assert.equal(await p.locator('[data-services-hourly-date]').inputValue(),'2027-01-26');
  }
  await p.locator('[data-services-hourly-cta]').click();await p.waitForURL(/#hourly\/datos$/);
  await p.locator('#hourly-contact-name').fill('Persona Sintética');await p.locator('#hourly-contact-phone').fill('+525512345678');await p.locator('#hourly-contact-email').fill('audit@example.invalid');
  const legal=p.locator('#pixkuy-hourly-legal-acceptance');await legal.check();
  row.screens.push(await capture(t,'datos'));
  await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);row.screens.push(await capture(t,'revision'));
  if(!before){
   await p.locator('.airport-booking__step-action').filter({hasText:'Datos'}).click();await p.waitForURL(/#hourly\/datos$/);
   await legal.uncheck();assert(await p.locator('#hourly-contact-submit').isDisabled());await p.reload();await p.waitForLoadState('networkidle');assert(!await legal.isChecked());assert(await p.locator('#hourly-contact-submit').isDisabled());
   await legal.check();await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);
   await p.reload();await p.waitForLoadState('networkidle');row.screens.push(await capture(t,'revision-recargada'));
   if(process.argv.includes('--navigation')){
    await p.locator('.airport-booking__identity a').click();await p.waitForURL(u=>!u.hash);await p.waitForLoadState('networkidle');
    await p.goBack();await p.waitForURL(/#hourly\/revision$/);await p.locator('.hourly-booking').waitFor();
    assert((await p.locator('.hourly-booking').innerText()).includes('Persona Sintética'));
    row.screens.push(await capture(t,'regreso-inicio'));
   }
  }
  assert.equal(t.state.requests.filter(r=>['checkout','replace-checkout','retry-checkout'].includes(r.kind)).length,0);
  await Promise.all(t.tasks);assert.deepEqual(t.state.errors,[]);assert(t.assets.every(r=>r.matches&&r.status===200),'Relevant resource bytes differ');
  row.result='PASS';
 }catch(e){row.result='FAIL';row.error=e.message;row.failure=await capture(t,'failure').catch(()=>null);}finally{await Promise.allSettled(t.tasks);row.errors=t.state.errors;row.assets=t.assets;rows.push(row);await t.context.close();}
}
async function results(){
 for(const mode of ['pending','confirmed']){
 const t=await setup(),p=t.page,row={case:'controlled-'+mode,before,screens:[]};
 try{
  t.state.mode=mode;
  await p.goto(base.origin+'/booking-'+(mode==='pending'?'cancelled':'success')+'.html?token=synthetic-hourly-desktop&lang=es');
  await p.locator('.hourly-booking').waitFor();await p.locator('[data-consent-reject]').click({timeout:1000}).catch(()=>{});
  row.screens.push(await capture(t,mode));
  if(mode==='confirmed')assert.equal(await p.locator('.hourly-booking [data-airport-pay]').count(),0);
  if(!before){await p.reload();await p.locator('.hourly-booking').waitFor();row.screens.push(await capture(t,mode+'-reload'));}
  await Promise.all(t.tasks);assert.deepEqual(t.state.errors,[]);assert(t.assets.every(r=>r.matches&&r.status===200),'Relevant resource bytes differ');row.result='PASS';
 }catch(e){row.result='FAIL';row.error=e.message;}finally{await Promise.allSettled(t.tasks);row.errors=t.state.errors;row.assets=t.assets;rows.push(row);await t.context.close();}
 }
}
async function main(){
 assert.equal(base.origin,'https://local.pixkuy.test');await fs.mkdir(base.output,{recursive:true});
 browser=await base.launchChrome();base.setBrowser(browser);
 try{if(!process.argv.includes('--results'))await journey();if(!real&&!process.argv.includes('--journey'))await results();}
 finally{await fs.writeFile(path.join(base.output,'results.json'),JSON.stringify({browser:browser.version(),real,before,rows},null,2));await browser.close();}
 console.log(JSON.stringify(rows.map(({case:c,result,error})=>({case:c,result,error}))));if(rows.some(r=>r.result==='FAIL'))process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
