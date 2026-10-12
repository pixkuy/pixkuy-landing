'use strict';
// Existing runner/product, closed HTTP boundaries; no reservation or provider writes.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const previous=require('./mobile-pending-recovery-regression.cjs'),{base}=previous;
const before=process.argv.includes('--before'),mobile=process.argv.includes('--mobile-clock');
async function main(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');assert.equal(base.origin,'https://local.pixkuy.test');
 await fs.mkdir(base.output,{recursive:true});const browser=await base.launchChrome();base.setBrowser(browser);
 const t=await base.setup(mobile?390:1440,'hourly_daily'),p=t.page,row={before,mobile,screens:[],assets:[]},tasks=[];
 p.on('crash',()=>{row.crash={stage:row.stage,url:p.url(),at:new Date().toISOString()};});
 p.on('framenavigated',f=>{if(f===p.mainFrame())(row.navigation||(row.navigation=[])).push({url:f.url(),at:new Date().toISOString()});});
 p.on('response',r=>{const u=new URL(r.url());if(/\/(booking-cancelled-edit|hourly-booking-result|hourly-booking-flow)\.(js|css)$/.test(u.pathname))tasks.push((async()=>{const b=await r.body(),local=await fs.readFile(path.resolve(__dirname,'..','.'+u.pathname));row.assets.push({file:u.pathname,status:r.status(),matches:b.equals(local),sha256:crypto.createHash('sha256').update(b).digest('hex')});})());});
 const clock=async()=>{const text=await p.locator('[data-airport-deadline]:visible').innerText(),m=text.match(/(\d+):(\d+)/);assert(m,text);return Number(m[1])*60+Number(m[2]);};
 async function shot(label){await p.waitForLoadState('networkidle');await p.locator('.hourly-booking img:visible').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));const s=await base.shot(t,label);await p.screenshot({path:path.join(base.output,s.file),fullPage:true});row.screens.push(s);}
 try{
  row.stage='prepare';await previous.prepare(t);await previous.status(t);row.expiresAt=t.expiry;
  await p.waitForTimeout(9000);row.pending=await clock();await shot('pending');
  row.styles=await p.locator('.hourly-booking .airport-booking__secondary,.hourly-booking .airport-booking__actions .airport-booking__link').evaluateAll(ns=>ns.map(n=>({text:n.textContent,border:getComputedStyle(n).borderTopWidth,padding:getComputedStyle(n).padding,minHeight:getComputedStyle(n).minHeight})));
  row.stage='pending-to-data';await p.locator(mobile?'[data-booking-cancelled-modify]:visible':'.hourly-booking .airport-booking__secondary').click();await p.waitForURL(/#hourly\/datos$/);await p.waitForLoadState('networkidle');row.data=await clock();await shot('datos');
  const edit=await p.evaluate(()=>window.PixkuyFleetSelection.hourlyEdit());assert.equal(edit.expiresAt,t.expiry);row.editClock={expiresAt:edit.expiresAt,serverNow:edit.serverNow,receivedAt:edit.receivedAt};
  if(before){assert(row.data-row.pending>=7,'Expected preimage clock jump');row.result='REPRODUCED';}
  else if(mobile){
   assert(row.data<=row.pending+1,'Opening editor added time');row.stage='reload-data';await p.waitForTimeout(2500);await p.reload();await p.waitForLoadState('networkidle');row.reloadedData=await clock();assert(row.reloadedData<row.data,'Reload lost elapsed time');
   assert.equal((await p.evaluate(()=>window.PixkuyFleetSelection.hourlyEdit())).expiresAt,t.expiry);
   let revision='synthetic-revision-1',renewed=false;const writes=[];
   await t.context.route('**/v1/public/reservations/status?**',r=>{const b=base.statusBody(t.s,'pending',t.state.draft);b.hold.expiresAt=t.expiry;b.paymentWindowRenewed=renewed;b.edit.revision=revision;return r.fulfill({json:b});});
   await t.context.route('**/v1/public/reservations/update-contact',r=>{
    const body=r.request().postDataJSON();assert.equal(r.request().headers()['x-pixkuy-booking-token'],t.token);assert.equal(body.service_type,t.s);
    const prior=t.state.draft.customer,changed=body.customer.email.trim().toLowerCase()!==prior.email.trim().toLowerCase();
    if(changed){t.expiry=new Date(Date.now()+31*60000).toISOString();renewed=true;}
    t.state.draft={...t.state.draft,customer:{...body.customer,email:changed?body.customer.email:prior.email}};revision='synthetic-revision-'+(writes.length+2);writes.push({changed,expiresAt:t.expiry});
    return r.fulfill({json:{status:'ok',bookingStatusToken:t.token,checkoutUrl:'https://checkout.stripe.com/synthetic-only',editRevision:revision,hold:{expiresAt:t.expiry},paymentWindowRenewed:changed}});
   });
   async function save(label,priorClock){
    row.stage=label+'-data-to-review';await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);await p.waitForLoadState('networkidle');const review=await clock();assert(review<=priorClock+1,'Review added time');
    assert.equal((await p.evaluate(()=>window.PixkuyFleetSelection.hourlyEdit())).expiresAt,t.expiry);
    if(label==='noop'){row.review=review;await shot('revision');}
    row.stage=label+'-save';await p.locator('[data-hourly-pay]').click();await p.waitForURL(/checkout\.stripe\.com/);await previous.status(t);const pending=await clock();
    assert.equal(await p.evaluate(()=>window.__auditStatus.result.raw.hold.expiresAt),t.expiry);return {review,pending};
   }
   const noop=await save('noop',row.reloadedData);row.afterNoop=noop.pending;assert(row.afterNoop<=noop.review+1);assert.equal(t.expiry,row.expiresAt);assert.equal(writes.length,1);assert.equal(writes[0].changed,false);
   async function reopen(label){row.stage=label+'-pending-to-data';await p.waitForTimeout(2500);const pending=await clock();await p.locator('[data-booking-cancelled-modify]:visible').click();await p.waitForURL(/#hourly\/datos$/);await p.waitForLoadState('networkidle');const data=await clock();assert(data<=pending+1,'Reopening editor added time');assert.equal((await p.evaluate(()=>window.PixkuyFleetSelection.hourlyEdit())).expiresAt,t.expiry);return data;}
   const equivalentData=await reopen('equivalent');await p.locator('#hourly-contact-email').fill(t.state.draft.customer.email.toUpperCase());row.equivalent=await save('equivalent',equivalentData);assert.equal(t.expiry,row.expiresAt);assert.equal(writes.length,2);assert.equal(writes[1].changed,false);assert(row.equivalent.pending<=row.equivalent.review+1);
   const changedData=await reopen('changed');await p.locator('#hourly-contact-email').fill('changed@example.invalid');row.changed=await save('changed',changedData);assert.equal(writes.length,3);assert.equal(writes[2].changed,true);assert.notEqual(t.expiry,row.expiresAt);assert(row.changed.pending>row.changed.review);
   row.renewedExpiresAt=t.expiry;row.stage='renewed-reload';await p.reload();await p.waitForLoadState('networkidle');assert.equal(await p.evaluate(()=>window.__auditStatus.result.raw.hold.expiresAt),t.expiry);row.renewedReload=await clock();assert(row.renewedReload<=row.changed.pending+1);await shot('renewed');
   row.controlledWrites=writes;assert.equal(t.state.requests.filter(r=>r.kind==='checkout').length,0);row.result='PASS';
  }
  else{
   assert(row.data<=row.pending+1,'Opening editor added time');assert(row.styles.every(s=>parseFloat(s.border)===1),'Expected bordered actions');
   await p.reload();await p.waitForLoadState('networkidle');row.reloadedData=await clock();assert(row.reloadedData<=row.data+1,'Data reload added time');
   await p.locator('#hourly-contact-submit').click();await p.waitForURL(/#hourly\/revision$/);await p.waitForLoadState('networkidle');row.review=await clock();assert(row.review<=row.data+1);await shot('revision');
   let writes=0;await t.context.route('**/v1/public/reservations/update-contact',r=>{writes++;return r.fulfill({json:{status:'ok',bookingStatusToken:t.token,checkoutUrl:'https://checkout.stripe.com/synthetic-only',editRevision:'synthetic-revision-1',hold:{expiresAt:t.expiry},paymentWindowRenewed:false}});});
   await p.locator('[data-hourly-pay]').click();await p.waitForURL(/checkout\.stripe\.com/);assert.equal(writes,1);
   await previous.status(t);row.afterNoop=await clock();assert(row.afterNoop<=row.review+1);assert.equal(await p.evaluate(()=>window.__auditStatus.result.raw.hold.expiresAt),t.expiry);
   await t.context.route('**/v1/public/reservations/status?**',r=>{const b=base.statusBody(t.s,t.state.mode,t.state.draft);b.paymentWindowRenewed=t.state.mode==='pending';return r.fulfill({json:b});});
   t.state.mode='pending';await previous.status(t);await shot('renewed');
   const lead=p.locator('.hourly-booking .airport-booking__lead:not([data-airport-deadline])'),notice=p.locator('.hourly-booking > .airport-booking__notice');assert(!(await lead.innerText()).includes('Correo actualizado'));assert((await notice.innerText()).includes('Correo actualizado'));
   t.state.mode='confirmed';await previous.status(t);await shot('confirmed');assert.equal(await p.locator('.hourly-booking [data-airport-pay]').count(),0);assert.equal(await p.locator('[data-airport-deadline]:visible').count(),0);
   row.result='PASS';
  }
  await Promise.all(tasks);assert.deepEqual(t.state.errors,[]);assert(row.assets.every(a=>a.matches&&a.status===200));
 }catch(e){row.result='FAIL';row.error=e.message;await shot('failure').catch(()=>{});}
 finally{await Promise.allSettled(tasks);row.errors=t.state.errors;row.requests=t.state.requests.map(r=>r.kind);await fs.writeFile(path.join(base.output,'results.json'),JSON.stringify(row,null,2));await t.context.close();await browser.close();}
 console.log(JSON.stringify({result:row.result,error:row.error,pending:row.pending,data:row.data,review:row.review,afterNoop:row.afterNoop}));if(row.result==='FAIL')process.exitCode=1;
}
async function clockContracts(){
 assert.equal(process.env.PIXKUY_AUDIT_FIXTURES,'1');
 const vm=require('node:vm'),root=path.resolve(__dirname,'..');
 const source=await fs.readFile(path.join(root,'assets/js/forms/booking-cancelled-edit.js'),'utf8');
 const flow=await fs.readFile(path.join(root,'assets/js/forms/hourly-booking-flow.js'),'utf8');
 const view=await fs.readFile(path.join(root,'assets/js/forms/airport-desktop-view.js'),'utf8');
 const estimates=[...flow.matchAll(/var estimated=([^;]+);/g)];assert.equal(estimates.length,1);
 const first=view.indexOf('  function deadline('),last=view.indexOf('  function load()',first);assert(first>=0&&last>first);assert.equal(view.indexOf('  function deadline(',first+1),-1);
 const epoch=Date.parse('2027-01-01T00:00:00Z'),rows=[];
 function fixture(code,{service='hourly_daily',mode='hourly',server=epoch,expiry=epoch+1800000,frozen=false}={}){
  let wall=epoch+7*3600000,perf=100,ready,snapshot=null,prior=null,performanceReads=0,directCalls=0;
  const storage=new Map(),navigations=[];
  class ClockDate extends Date{constructor(...args){super(...(args.length?args:[wall]));}static now(){return wall;}}
  const draft={hourly_daily_mode:mode,customer:{full_name:'Synthetic',email:'synthetic@example.invalid',phone:'+525512345678'},fleet_selection:{model_id:'synthetic-model',model_revision:1},fleet_model:{name:'Synthetic'}};
  const state={token:'synthetic-token',dictionary:{},result:{serviceType:service,view:'pending',publicCode:'SYNTHETIC',raw:{serverNow:new Date(server).toISOString(),hold:{expiresAt:new Date(expiry).toISOString()},edit:{allowed:true,revision:'r1',draft},actions:{canModify:true,canCreateNewReservation:true},continuation:{draft},payment:{amountExpected:150000,currency:'MXN'}}}};
  let current={reservationToken:state.token};
  const win={performance:{now:()=>{performanceReads++;return perf;}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{assign:u=>navigations.push(u)},PixkuyBookingStatusState:{onReady:fn=>{ready=fn;}},PixkuyDirectPendingEdit:{begin:()=>{directCalls++;return true;}},PixkuyForms:{LegalAcceptance:{readEvidence:()=>null,fieldNames:{}}},PixkuyHourlyBookingDraft:{returnKey:'synthetic-return',read:()=>snapshot,fromPublic:s=>({...s,name:s.customer.full_name,phone:s.customer.phone,email:s.customer.email}),save:s=>{snapshot=s;}},PixkuyFleetSelection:{read:()=>current,hourlyEdit:()=>prior,createAttemptKey:()=> 'synthetic-key',completeReservation:()=>{}}};
  if(frozen){prior={token:state.token,contactOnly:true,serverNow:new Date(server-5000).toISOString(),receivedAt:wall-5000,expiresAt:state.result.raw.hold.expiresAt};current.attempt={state:'unknown',headers:{'X-Pixkuy-Booking-Token':state.token},payload:{customer:draft.customer}};}
  vm.runInNewContext(code,{window:win,document:{querySelectorAll:()=>[]},Date:ClockDate},{filename:'booking-cancelled-edit.js'});
  const notify=()=>ready(state),advance=ms=>{wall+=ms;perf+=ms;},context=()=>JSON.parse(storage.get(service==='airport_transfer'?'pixkuy_airport_pending_edit_v1':'pixkuy_hourly_pending_edit_v1'));
  const estimate=edit=>vm.runInNewContext(estimates[0][1],{edit,Date:ClockDate});
  function timer(expiresAt,serverNow){let tick;const node={isConnected:true,setAttribute:()=>{}};const deadline=vm.runInNewContext(view.slice(first,last)+'\ndeadline',{Date:ClockDate,node:()=>node,t:k=>k==='paymentRemaining'?'{time}':k,window:{performance:win.performance,setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{}}});deadline(expiresAt,serverNow);return ()=>{tick();return node.textContent;};}
  return {state,notify,advance,context,estimate,timer,win,navigations,reload:()=>{perf=0;},reads:()=>performanceReads,directCalls:()=>directCalls,prior:()=>prior};
 }
 for(const mode of ['hourly','full_day']){
  const f=fixture(source,{mode});f.notify();const pending=f.timer(f.state.result.raw.hold.expiresAt,f.state.result.raw.serverNow);
  f.advance(6000);f.notify();f.advance(3000);assert.equal(pending(),'29:51');assert.equal(f.win.PixkuyBookingCancelledEdit.begin(f.state),true);
  const edit=f.context();assert.equal(edit.expiresAt,f.state.result.raw.hold.expiresAt);assert.equal(Date.parse(edit.serverNow),epoch+9000);
  const data=f.timer(edit.expiresAt,f.estimate(edit));assert.equal(data(),'29:51');f.advance(5000);assert.equal(data(),'29:46');
  const restored=JSON.parse(JSON.stringify(edit));f.reload();const reloaded=f.timer(restored.expiresAt,f.estimate(restored));assert.equal(reloaded(),'29:46');f.advance(3000);
  const review=f.timer(restored.expiresAt,f.estimate(restored));assert.equal(review(),'29:43');assert.equal(restored.expiresAt,edit.expiresAt);
  rows.push({case:'elapsed-edit-reload-review',mode,result:'PASS',pending:'29:51',data:'29:51',reload:'29:46',review:'29:43',expiry:edit.expiresAt,sameResultNotificationDoesNotReset:true,localClockOffsetHours:7});
 }
 // These are supplied authoritative responses, not a test of backend email renewal policy.
 for(const [label,expiry] of [['equivalent-email-response',epoch+1800000],['real-email-renewed-response',epoch+60000+31*60000]]){
  const f=fixture(source,{server:epoch+60000,expiry});f.state.result.raw.edit.draft.customer.email=label.startsWith('equivalent')?'SYNTHETIC@EXAMPLE.INVALID':'changed@example.invalid';f.notify();f.advance(7000);f.win.PixkuyBookingCancelledEdit.begin(f.state);const edit=f.context();assert.equal(Date.parse(edit.expiresAt),expiry);assert.equal(Date.parse(f.estimate(edit)),epoch+67000);
  rows.push({case:label,result:'PASS',authority:'controlled response only',expiresAt:edit.expiresAt,secondsRemaining:(expiry-Date.parse(f.estimate(edit)))/1000});
 }
 const beforePath=path.resolve(__dirname,'../../..','evidence/hourly-desktop-manual-fixes-20261012/preimage/landing/assets/js/forms/booking-cancelled-edit.js');
 const beforeSource=await fs.readFile(beforePath,'utf8');
 for(const service of ['airport_transfer','direct_transfer']){
  const results=[beforeSource,source].map(code=>{const f=fixture(code,{service});f.notify();f.advance(9000);assert.equal(f.win.PixkuyBookingCancelledEdit.begin(f.state),true);return {reads:f.reads(),directCalls:f.directCalls(),navigations:f.navigations,context:service==='airport_transfer'?f.context():null};});
  assert.deepEqual(results[1],results[0]);assert.equal(results[1].reads,0);rows.push({case:'unchanged-dispatch',service,result:'PASS',performanceClockReads:0,scope:'source execution, not browser'});
 }
 const frozen=fixture(source,{frozen:true}),priorClock={...frozen.prior()};frozen.notify();frozen.advance(9000);frozen.win.PixkuyBookingCancelledEdit.begin(frozen.state);assert.equal(frozen.context().serverNow,priorClock.serverNow);assert.equal(frozen.context().receivedAt,priorClock.receivedAt);assert.equal(frozen.context().expiresAt,priorClock.expiresAt);assert(frozen.navigations[0].endsWith('/revision'));rows.push({case:'frozen-attempt-bypasses-new-anchor',result:'PASS'});
 const fresh=fixture(source);fresh.notify();fresh.advance(9000);assert.equal(fresh.win.PixkuyBookingCancelledEdit.beginNew(fresh.state),true);assert.throws(()=>fresh.context());assert(fresh.navigations[0].endsWith('/servicio'));rows.push({case:'start-new-bypasses-edit-anchor',result:'PASS'});
 const old=fixture(beforeSource);old.notify();old.advance(9000);old.win.PixkuyBookingCancelledEdit.begin(old.state);assert.equal(Date.parse(old.context().serverNow),epoch);rows.push({case:'preimage-detects-regression',result:'PASS',artificialSecondsRecovered:9});
 await fs.mkdir(base.output,{recursive:true});await fs.writeFile(path.join(base.output,'clock-contracts.json'),JSON.stringify({kind:'deterministic real-source execution; no browser or backend',result:'PASS',rows,sources:[['booking-cancelled-edit.js',source],['hourly-booking-flow.js',flow],['airport-desktop-view.js',view]].map(([file,code])=>({file,sha256:crypto.createHash('sha256').update(code).digest('hex')}))},null,2));console.log(JSON.stringify({result:'PASS',deterministicCases:rows.length}));
}
(process.argv.includes('--clock-contracts')?clockContracts():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
