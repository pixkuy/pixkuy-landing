'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=require('./mobile-booking-audit.cjs');
const {webkit,devices}=require('../../../pixkuy_frontend/node_modules/playwright');
const langs=['en','es','de','fr','it','pt','ru','ko','zh-hans'];
async function main(){
 const browser=await webkit.launch({headless:true});base.setBrowser({newContext:o=>browser.newContext({...devices['iPhone 13'],...o})});await fs.mkdir(base.output,{recursive:true});const rows=[];
 const before=process.argv.includes('--before'),translations=process.argv.includes('--translations'),invariants=process.argv.includes('--invariants'),baseline=process.argv.includes('--baseline'),formatting=process.argv.includes('--formatting');
 try{for(const lang of translations?langs.slice(2):langs.slice(0,2))for(const width of invariants?[320,390,1280]:[320,390])for(const mode of invariants?(width>720?['hourly','pending']:['pending']):before||translations||formatting?['hourly']:['hourly','full_day','custom_long_term','pending','error']){
  const t=await base.setup(width,'hourly_daily'),p=t.page,row={lang,width,mode,writes:0};
  await t.context.addInitScript(()=>localStorage.setItem('pixkuy_google_ads_consent','denied'));
  if(baseline)for(const file of ['assets/js/forms/hourly-booking-result.js','assets/css/hourly-booking-flow.css'])await t.context.route('**/'+file,r=>r.fulfill({path:path.resolve(__dirname,'../../../evidence/mobile-pending-recovery-20261010/hourly-confirmation-20261011/preimages',file)}));
  const copy=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/i18n',lang,'services-hourly.json'),'utf8')).hourlyBooking;
  try{
   p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/v1/public/reservations/')&&r.method()!=='GET')row.writes++;});
   let fixtureMode=mode, hours=mode==='full_day'?12:mode==='custom_long_term'?null:9;
   await t.context.route('**/v1/public/reservations/status*',r=>{
    if(mode==='error')return r.fulfill({status:503,json:{code:'CONTROLLED_ERROR'}});
    const body=base.statusBody('hourly_daily',mode==='pending'?'pending':'confirmed');
    Object.assign(body.reservation,{publicCode:'QA-HOURLY-2027-000071',hourlyMode:mode==='pending'?'hourly':fixtureMode,durationHours:hours,passengerCount:4,passengerLabel:'3–4',serviceStartLocalDate:'2027-01-26',serviceStartLocalTime:'10:00',serviceEndLocalDate:'2027-01-26',serviceEndLocalTime:hours===12?'22:00':hours===1?'11:00':hours===2?'12:00':'19:00',pickupAddress:'Hotel de prueba — Paseo de la Reforma 1234, Juárez, Cuauhtémoc, Ciudad de México, México',customerNotes:'Synthetic itinerary / agenda. Preserve existing notes.',vehicleDisplayName:'BYD M9',vehiclePhotoUrl:base.origin+'/assets/img/fleet/bydm9_xhoras001d.jpeg'});
    Object.assign(body.payment,{amountExpected:500000,amountPaid:mode==='pending'?null:500000});return r.fulfill({json:body});
   });
   if(translations)await p.goto(base.origin+'/booking-success.html?token=synthetic-hourly-confirmation&lang='+lang);
   else {await p.goto('https://checkout.stripe.com/synthetic');await p.setContent('<a href="'+base.origin+'/booking-success.html?token=synthetic-hourly-confirmation&lang='+lang+'">Return (TEST double)</a>');await p.locator('a').click();}
   await p.waitForLoadState('networkidle');if(await p.locator('[data-consent-reject]').isVisible())await p.locator('[data-consent-reject]').click();
   row.initial=await inspect(p);row.screen=await base.shot(t,lang+'-'+mode+'-entry');
   if(!translations){await p.reload();await p.waitForLoadState('networkidle');row.reload=await inspect(p);row.reloadScreen=await base.shot(t,lang+'-'+mode+'-reload');assert.deepEqual(row.initial,row.reload);}
   if(invariants){row.desktop=await p.locator('.hourly-booking').allTextContents();row.result='PASS';continue;}
   const confirmed=!['pending','error'].includes(mode);assert.equal(row.initial.confirmed,confirmed);
   if(confirmed){
    assert.equal(row.initial.photoWidth,136,'Photo must match accepted Airport');assert.equal(row.initial.photoHeight,108);assert.equal(row.initial.border,'0px');assert.equal(row.initial.referenceFont,'12px');assert.equal(row.initial.referenceWeight,'400');assert(row.initial.referenceAligned);
    const label=copy[mode==='full_day'?'confirmedServiceFullDay':mode==='custom_long_term'?'confirmedServiceLongTerm':'confirmedServiceHourly'];
    const expectedDuration=hours?new Intl.NumberFormat(lang,{style:'unit',unit:'hour',unitDisplay:'long',maximumFractionDigits:20}).format(hours):'';
    assert.equal(row.initial.service,label+(expectedDuration?' · '+expectedDuration:''));assert.equal(row.initial.duration,expectedDuration);assert.equal(row.initial.durationLabel,copy.contractedDuration);assert(row.initial.pickupLabelVisible);assert.equal(row.initial.summaryWeight,'650');
    assert(row.initial.start.includes('2027')&&row.initial.start.includes('10:00'));assert(row.initial.end.includes('2027')&&row.initial.end.includes(mode==='full_day'?'22:00':'19:00'));assert.equal(row.initial.lang,lang);assert.equal(row.initial.overflow,false);assert.equal(row.initial.viewportOffset.x,0);assert.equal(row.initial.viewportOffset.visualX,0);
    await p.locator('.airport-return__disclosure summary').click();assert(await p.locator('[data-airport-return-email]').isVisible());assert(await p.locator('.airport-return__contact [data-booking-status-notes]').isVisible());
   }
   if(formatting||translations){
    row.formatting=[];
    for(const item of [{mode:'hourly',hours:1},{mode:'hourly',hours:2},{mode:'full_day',hours:12},{mode:'custom_long_term',hours:null}]){
      fixtureMode=item.mode;hours=item.hours;await p.evaluate(()=>window.PixkuyBookingStatusState.refresh());
      const value=await inspect(p),key=item.mode==='hourly'?'confirmedServiceHourly':item.mode==='full_day'?'confirmedServiceFullDay':'confirmedServiceLongTerm';
      const unit=hours?new Intl.NumberFormat(lang,{style:'unit',unit:'hour',unitDisplay:'long',maximumFractionDigits:20}).format(hours):'';
      assert.equal(value.service,copy[key]+(unit?' · '+unit:''));assert.equal(value.duration,unit);assert.equal(value.durationLabel,copy.contractedDuration);assert.equal(value.overflow,false);row.formatting.push({mode:item.mode,hours,result:'PASS'});
    }
   }
   assert.equal(row.writes,0);row.result='PASS';
  }catch(e){row.result='FAIL';row.error=e.message;}finally{await t.context.close();rows.push(row);}
 }}finally{await browser.close();await fs.writeFile(path.join(base.output,'results.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(base.output,'served-hashes.json'),JSON.stringify([...base.resources],null,2));}
 console.log(JSON.stringify(rows.map(({lang,width,mode,result,error})=>({lang,width,mode,result,error}))));if(rows.some(r=>r.result==='FAIL'))process.exitCode=1;
}
async function inspect(p){return p.evaluate(()=>{const root=document.querySelector('[data-booking-status-mobile]'),q=s=>root.querySelector(s),text=s=>q(s)?.textContent||'',style=n=>n?getComputedStyle(n):{},visible=n=>!!n&&!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',ref=q('[data-booking-status-public-code]'),label=ref?.parentNode.querySelector('dt'),photo=q('.airport-return__vehicle-summary img'),duration=q('[data-booking-status-duration]');return {viewportOffset:{x:scrollX,visualX:visualViewport?.offsetLeft||0,panelX:q('[data-booking-status-mobile-panel]')?.getBoundingClientRect().x||0},confirmed:root.hasAttribute('data-airport-confirmed'),lang:document.documentElement.lang,title:text('[data-booking-status-title]'),reference:text('[data-booking-status-public-code]'),referenceFont:style(ref).fontSize,referenceWeight:style(ref).fontWeight,referenceAligned:label&&ref?(Math.abs(label.getBoundingClientRect().y-ref.getBoundingClientRect().y)<3||Math.abs(label.getBoundingClientRect().x-ref.getBoundingClientRect().x)<3&&ref.getBoundingClientRect().y>=label.getBoundingClientRect().bottom-1):false,service:text('[data-hourly-confirmed-service]'),photoWidth:photo?.getBoundingClientRect().width||0,photoHeight:photo?.getBoundingClientRect().height||0,border:style(q('[data-booking-status-details]')).borderTopWidth,pickupLabelVisible:visible(q('[data-booking-status-pickup]')?.parentNode.querySelector('dt'))&&style(q('[data-booking-status-pickup]')?.parentNode.querySelector('dt')).position!=='absolute',start:text('[data-hourly-result-start] dd'),end:text('[data-hourly-result-end] dd'),duration:visible(duration)?duration.textContent:'',durationLabel:duration?.parentNode.querySelector('dt')?.textContent||'',summaryWeight:style(q('.airport-return__disclosure summary')).fontWeight,amount:text('[data-booking-status-amount]'),overflow:document.documentElement.scrollWidth>innerWidth||[...root.querySelectorAll('dd,summary')].filter(visible).some(n=>n.scrollWidth>n.clientWidth+1)};});}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
