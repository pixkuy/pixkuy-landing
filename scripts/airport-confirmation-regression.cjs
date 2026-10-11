'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs');
const {webkit,devices}=require('../../../pixkuy_frontend/node_modules/playwright');
async function main(){
 const browser=await webkit.launch({headless:true});base.setBrowser({newContext:o=>browser.newContext({...devices['iPhone 13'],...o})});await fs.mkdir(base.output,{recursive:true});const rows=[];
 const baseline=process.argv.includes('--baseline');
 try{for(const width of [320,390])for(const lang of ['en','es'])for(const mode of baseline||process.argv.includes('--race-only')?['race']:['race','absent','invalid','pending','pending-to-paid','unpaid-confirmed','error']){
  const t=await base.setup(width,'airport_transfer'),p=t.page,row={width,lang,mode,http:[]};
  if(baseline)for(const file of ['assets/js/forms/airport-desktop-result.js','assets/css/82-booking-status-mobile.css'])await t.context.route('**/'+file,r=>r.fulfill({path:path.resolve(__dirname,'../../../evidence/mobile-pending-recovery-20261010/airport-confirmation-20261011/preimages',file)}));
  p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/v1/public/reservations/')&&r.method()!=='GET')row.writes=(row.writes||0)+1;});
  try{
   let paid=!['pending','pending-to-paid'].includes(mode),delayed=mode==='race',releaseResult,copyRequests=0;const resultGate=new Promise(r=>releaseResult=r);
   await t.context.route('**/assets/i18n/*/airport-desktop-booking.json',async r=>{copyRequests++;if(delayed&&copyRequests===1)await resultGate;return r.continue();});
   await t.context.route('**/v1/public/reservations/status*',r=>{
    row.http.push({method:r.request().method(),path:'/v1/public/reservations/status',paid});
    if(mode==='error')return r.fulfill({status:503,json:{code:'CONTROLLED_UNAVAILABLE'}});
    const body=base.statusBody('airport_transfer',paid?'confirmed':'pending');
    Object.assign(body.reservation,{publicCode:'QA-CONFIRMATION',serviceStartLocalDate:'2027-01-30',serviceStartLocalTime:'22:00',durationHours:79/60,luggageCount:6,passengerLabel:'3–4',vehicleDisplayName:'BYD M9',vehiclePhotoUrl:base.origin+'/assets/img/fleet/bydm9_xhoras001d.jpeg',pickupAddress:'MEX — Airport',destinationAddress:'Synthetic destination, Reforma, Ciudad de México'});
    if(mode==='absent')body.reservation.durationHours=null;
    if(mode==='invalid')body.reservation.durationHours='79';
    Object.assign(body.payment,{amountExpected:102500,amountPaid:paid?102500:null});
    if(mode==='unpaid-confirmed')Object.assign(body.payment,{status:'pending',amountPaid:null});
    return r.fulfill({json:body});
   });
   await p.goto('https://checkout.stripe.com/synthetic');await p.setContent('<a href="'+base.origin+'/booking-success.html?token=synthetic-confirmation&lang='+lang+'">Return from TEST (double)</a>');
   await p.locator('a').click({noWaitAfter:true});
   await p.waitForFunction(()=>window.__auditStatus?.result&&window.PixkuyAirportDesktopView?.t('mobileConfirmedTitle')!=='mobileConfirmedTitle');
   await p.locator('[data-consent-reject]').click().catch(()=>{});
   if(mode==='pending-to-paid'){row.pending=await inspect(p);assert.equal(row.pending.confirmed,false);paid=true;await p.waitForFunction(()=>window.__auditStatus?.result.view==='confirmed');}
   row.initial=await inspect(p);row.before=await base.shot(t,lang+'-'+mode+'-return');
   delayed=false;releaseResult();await p.reload();await p.waitForLoadState('networkidle');row.reload=await inspect(p);row.after=await base.shot(t,lang+'-'+mode+'-reload');
   const confirmed=!['pending','unpaid-confirmed','error'].includes(mode);
   assert.equal(row.initial.confirmed,confirmed,'Only authoritative paid confirmation uses chosen Airport component');assert.deepEqual(row.initial,row.reload);
   if(confirmed){assert(row.initial.serviceVisible&&row.initial.service);assert(row.initial.photo&&row.initial.disclosureVisible&&row.initial.referenceVisible);assert.equal(row.initial.durationVisible,!['absent','invalid'].includes(mode));if(row.initial.durationVisible){assert.equal(row.initial.duration,'1 h 19 min');assert.equal(row.initial.durationLabel,lang==='en'?'Estimated duration':'Duración estimada');assert(row.initial.durationOrder);}await p.locator('.airport-return__disclosure summary').click();assert(await p.locator('.airport-return__contact [data-airport-return-email]').isVisible());}
   assert(row.http.every(r=>r.method==='GET'),'Rendering must not write reservations/payment');assert.equal(row.writes||0,0);row.result='PASS';
  }catch(e){row.result='FAIL';row.error=e.message;}finally{await t.context.close();rows.push(row);}
 }}finally{await browser.close();await fs.writeFile(path.join(base.output,'results.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(base.output,'served-hashes.json'),JSON.stringify([...base.resources],null,2));}
 console.log(JSON.stringify(rows.map(({width,lang,mode,result,error})=>({width,lang,mode,result,error}))));if(rows.some(r=>r.result==='FAIL'))process.exitCode=1;
}
async function inspect(p){return p.evaluate(()=>{const root=document.querySelector('[data-booking-status-mobile]'),q=s=>root.querySelector(s),visible=n=>!!n&&!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',duration=q('[data-booking-status-duration]'),timezone=q('[data-airport-confirmed-timezone]'),pickup=q('[data-booking-status-pickup]');return {confirmed:root.hasAttribute('data-airport-confirmed'),title:q('[data-booking-status-title]').textContent,reference:q('[data-booking-status-public-code]').textContent,referenceVisible:visible(q('[data-booking-status-public-code]')),amount:q('[data-booking-status-amount]').textContent,service:q('[data-booking-status-service]').textContent,serviceVisible:visible(q('[data-booking-status-service]')),durationVisible:visible(duration),duration:duration.textContent,durationLabel:duration.parentNode.querySelector('dt').textContent,durationOrder:!!timezone&&!!(timezone.compareDocumentPosition(duration)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(duration.compareDocumentPosition(pickup)&Node.DOCUMENT_POSITION_FOLLOWING),photo:visible(q('.airport-return__vehicle-summary img')),disclosureVisible:visible(q('.airport-return__disclosure')),lang:document.documentElement.lang};});}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
