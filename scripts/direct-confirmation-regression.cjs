'use strict';
// Real local pages/renderers; isolated synthetic status and external-provider boundaries.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs');
const {webkit,devices}=require('../../../pixkuy_frontend/node_modules/playwright');
const langs=['en','es','de','fr','it','pt','ru','ko','zh-hans'];
async function main(){
 const browser=await webkit.launch({headless:true});base.setBrowser({newContext:o=>browser.newContext({...devices['iPhone 13'],...o})});await fs.mkdir(base.output,{recursive:true});const rows=[];
 const before=process.argv.includes('--before'),baseline=process.argv.includes('--baseline'),translations=process.argv.includes('--translations'),invariants=process.argv.includes('--invariants'),shared=process.argv.includes('--shared'),transitions=process.argv.includes('--transitions'),contract=process.argv.includes('--contract');
 const apiFixture=contract?JSON.parse(await fs.readFile(path.resolve(__dirname,'../../../evidence/mobile-pending-recovery-20261010/direct-confirmation-20261011/api-confirmed-fixture.json'),'utf8')):null;
 try{for(const service of shared?['airport_transfer','hourly_daily']:['direct_transfer'])for(const lang of shared?['en']:translations?langs.slice(2):langs.slice(0,2))for(const width of shared?[390,1280]:invariants?[320,390,1280]:[320,390])for(const mode of shared?['paid','pending']:invariants?(width>720?['paid','pending']:['pending','error']):before||translations||transitions||contract?['paid']:['paid','absent','invalid','pending','pending-to-paid','unpaid-confirmed','error','copy-race']){
  const t=await base.setup(width,service),p=t.page,row={service,width,lang,mode,writes:0};let release=()=>{};
  await t.context.addInitScript(()=>localStorage.setItem('pixkuy_google_ads_consent','rejected'));
  if(baseline)for(const file of ['assets/js/forms/airport-desktop-result.js','assets/js/forms/booking-status-mobile.js','assets/css/82-booking-status-mobile.css'])await t.context.route('**/'+file,r=>r.fulfill({path:path.resolve(__dirname,'../../../evidence/mobile-pending-recovery-20261010/direct-confirmation-20261011/preimages',file)}));
  try{
   let paid=!['pending','pending-to-paid'].includes(mode),copyCount=0,override='';const copyGate=new Promise(r=>release=r);
   await t.context.route('**/assets/i18n/*/airport-desktop-booking.json',async r=>{if(mode==='copy-race'&&++copyCount===1)await copyGate;return r.continue();});
   p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/v1/public/reservations/')&&r.method()!=='GET')row.writes++;});
   if(contract)await t.context.route('**/v1/public/fleet/models/*/photos/*',r=>r.fulfill({path:path.resolve(__dirname,'../assets/img/fleet/bydm9_xhoras001d.jpeg'),contentType:'image/jpeg'}));
   await t.context.route('**/v1/public/reservations/status*',r=>{
    if(contract)return r.fulfill({json:apiFixture});
    if(mode==='error')return r.fulfill({status:503,json:{code:'CONTROLLED_ERROR'}});
    const body=base.statusBody(service,override||(paid?'confirmed':'pending'));
    Object.assign(body.reservation,{publicCode:'QA-DIRECT-2027-000072',serviceStartLocalDate:'2027-01-17',serviceStartLocalTime:'12:41',durationHours:354/60,passengerLabel:'3-4 passengers',passengerCount:4,vehicleDisplayName:'BYD M9',pickupAddress:'NH Collection Mexico City Reforma',pickupAddressDetail:'Liverpool 155, Juárez, Cuauhtémoc, Ciudad de México, México',destinationAddress:'Acapulco',destinationAddressDetail:'Avenida Costera Miguel Alemán 1234, Acapulco de Juárez, Guerrero, México',customerNotes:'Synthetic long notes / conservar equipaje y punto de encuentro acordado.'});
    if(mode==='absent')body.reservation.durationHours=null;
    if(mode==='invalid')body.reservation.durationHours='5.9';
    Object.assign(body.payment,{amountExpected:970000,amountPaid:paid?965000:null});
    if(mode==='unpaid-confirmed')Object.assign(body.payment,{status:'pending',amountPaid:null});
    return r.fulfill({json:body});
   });
   if(translations)await p.goto(base.origin+'/booking-success.html?token=synthetic-direct-confirmation&lang='+lang);
   else {await p.goto('https://checkout.stripe.com/synthetic');await p.setContent('<a href="'+base.origin+'/booking-success.html?token=synthetic-direct-confirmation&lang='+lang+'">Return (TEST double)</a>');await p.locator('a').click({noWaitAfter:true});}
   if(mode==='copy-race')await p.waitForFunction(()=>window.__auditStatus?.result&&window.PixkuyAirportDesktopView?.t('paymentRemaining')!=='paymentRemaining');
   else await p.waitForLoadState('networkidle');
   if(await p.locator('[data-consent-reject]').isVisible())await p.locator('[data-consent-reject]').click();
   if(mode==='pending-to-paid'){row.pending=await inspect(p);assert.equal(row.pending.confirmed,false);paid=true;await p.evaluate(()=>window.PixkuyBookingStatusState.refresh());}
   row.initial=await inspect(p);row.screen=await base.shot(t,lang+'-'+mode+'-return');release();
   if(!translations){await p.reload();await p.waitForLoadState('networkidle');row.reload=await inspect(p);row.reloadScreen=await base.shot(t,lang+'-'+mode+'-reload');assert.deepEqual(row.initial,row.reload,'Return and reload presentation');}
   if(invariants||shared){assert.equal(row.writes,0);row.result='PASS';continue;}
   const confirmed=!['pending','unpaid-confirmed','error'].includes(mode);assert.equal(row.initial.confirmed,confirmed,'Direct must use compact component only for authoritative paid confirmation');
   if(confirmed){
    const copy=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'airport-desktop-booking.json'),'utf8'));
    const status=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'booking-status.json'),'utf8')).bookingStatus;
    assert.equal(row.initial.title,copy.mobileConfirmedTitle);assert.equal(row.initial.service,status.serviceLabels.direct_transfer);assert(row.initial.serviceVisible);
    assert.equal(row.initial.photoWidth,136);assert.equal(row.initial.photoHeight,108);assert(row.initial.photoLoaded);assert.equal(row.initial.referenceFont,'12px');assert.equal(row.initial.referenceWeight,'400');assert(row.initial.referenceAligned);
    assert.equal(row.initial.durationVisible,!['absent','invalid'].includes(mode));if(row.initial.durationVisible){assert.equal(row.initial.durationLabel,copy.estimatedDuration);assert(row.initial.durationOrder);}
    assert.equal(row.initial.timezone,copy.confirmedTimezone);assert.equal(row.initial.amountLabel,copy.paidAmount);assert.equal(row.initial.passengers,'3–4');assert.equal(row.initial.lang,lang);
    assert(row.initial.amount.includes('9')&&row.initial.amount.includes('650'),'Authoritative paid amount, not expected quote');assert.equal(row.initial.overflow,false);
    assert.equal(row.initial.whatsapp.text,copy.talkWhatsApp);assert.equal(row.initial.another.text,copy.bookAnother);assert(row.initial.whatsapp.href&&row.initial.another.href);assert.equal(row.initial.actionBackground,'rgba(0, 0, 0, 0)');
    assert(row.initial.pickup.includes('Liverpool 155')&&row.initial.destination.includes('Costera Miguel Alemán'));
    await p.locator('.airport-return__disclosure summary').click();assert(await p.locator('[data-airport-return-email]').isVisible());assert(await p.locator('.airport-return__contact [data-booking-status-notes]').isVisible());
    await base.shot(t,lang+'-'+mode+'-contact');
    if(transitions){
     // Refresh through the real status API boundary, retaining the user's disclosure/focus.
     await p.locator('.airport-return__disclosure summary').focus();
     await p.evaluate(()=>window.PixkuyBookingStatusState.refresh());
     assert(await p.locator('.airport-return__disclosure').evaluate(n=>n.open));
     assert(await p.locator('.airport-return__disclosure summary').evaluate(n=>n===document.activeElement),'Refresh must preserve disclosure focus');
     row.transitions=[];
     for(const next of ['pending','hold_expired','confirmed']){
      override=next;await p.evaluate(()=>window.PixkuyBookingStatusState.refresh());const value=await inspect(p);
      assert.equal(value.confirmed,next==='confirmed');assert.equal(value.overflow,false);
      assert.equal(await p.locator('[data-booking-status-mobile] [data-booking-status-public-code]').count(),1);
      assert.equal(await p.locator('[data-booking-status-mobile] [data-booking-status-amount]').count(),1);
      if(next==='confirmed'){assert.equal(value.photoWidth,136);assert.equal(value.serviceVisible,true);}
      row.transitions.push({state:next,value});
     }
    }
   }
   assert.equal(row.writes,0);assert.equal(t.state.requests.filter(r=>r.kind!=='status').length,0);row.result='PASS';
  }catch(e){row.result='FAIL';row.error=e.message;}finally{release();await t.context.close();rows.push(row);}
 }}finally{await browser.close();await fs.writeFile(path.join(base.output,'results.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(base.output,'served-hashes.json'),JSON.stringify([...base.resources],null,2));}
 console.log(JSON.stringify(rows.map(({width,lang,mode,result,error})=>({width,lang,mode,result,error}))));if(rows.some(r=>r.result==='FAIL'))process.exitCode=1;
}
async function inspect(p){return p.evaluate(()=>{
 const root=document.querySelector('[data-booking-status-mobile]'),q=s=>root.querySelector(s),visible=n=>!!n&&!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',field=k=>q('[data-booking-status-'+k+']'),text=n=>n?.textContent||'',ref=field('public-code'),duration=field('duration'),timezone=q('[data-airport-confirmed-timezone]'),pickup=field('pickup'),photo=q('.airport-return__vehicle-summary img'),whatsapp=field('whatsapp'),another=field('primary'),box=n=>n?.getBoundingClientRect(),link=n=>({text:text(n),href:n?.getAttribute('href')}),refLabel=ref.parentNode.querySelector('dt');
 return {confirmed:root.hasAttribute('data-airport-confirmed'),title:text(field('title')),reference:text(ref),referenceFont:getComputedStyle(ref).fontSize,referenceWeight:getComputedStyle(ref).fontWeight,referenceAligned:Math.abs(box(ref).y-box(refLabel).y)<2||box(ref).y>=box(refLabel).bottom,amount:text(field('amount')),amountLabel:text(field('amount').parentNode.querySelector('dt')),service:text(field('service')),serviceVisible:visible(field('service')),duration:text(duration),durationLabel:text(duration.parentNode.querySelector('dt')),durationVisible:visible(duration),durationOrder:!!timezone&&!!(timezone.compareDocumentPosition(duration)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(duration.compareDocumentPosition(pickup)&Node.DOCUMENT_POSITION_FOLLOWING),timezone:text(timezone),photoWidth:box(photo)?.width||0,photoHeight:box(photo)?.height||0,photoLoaded:!!photo?.naturalWidth,passengers:text(field('passengers')),pickup:text(pickup),destination:text(field('destination')),disclosure:visible(q('.airport-return__disclosure')),whatsapp:link(whatsapp),another:link(another),actionBackground:whatsapp?getComputedStyle(whatsapp).backgroundColor:'',lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth||root.scrollWidth>root.clientWidth,desktop:innerWidth>720?document.querySelector('[data-booking-status-desktop]')?.innerText:null};
 });}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
