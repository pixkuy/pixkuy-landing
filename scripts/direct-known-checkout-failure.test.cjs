'use strict';
// Existing offline runner: real Review/Fleet modules, captured transport only.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runtime,settle}=require('./direct-review-renewal-regression.cjs');
const resultCopy=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/i18n/es/airport-desktop-booking.json')));
for(const mobile of [false,true])for(const code of ['BOOKING_STATUS_TOKEN_EXPIRED','CHECKOUT_PAYMENT_WINDOW_CLOSED'])test('known replacement expiry stays blocked without retry: '+code+' '+mobile,async()=>{
 const r=await runtime({mobile,expired:false,prepareEnvironment:({window})=>{window.PixkuyAirportDesktopView={t:key=>resultCopy[key]};}});
 r.window.sessionStorage.setItem('pixkuy_direct_pending_edit_v1',JSON.stringify({token:'synthetic-edit-token',revision:'2026-10-16T08:08:01.485Z',idempotencyKey:'same-replacement-key',serviceEditing:true}));
 const prior=r.window.fetch;let writes=0;
 r.window.fetch=async(url,init)=>{
  if(!url.endsWith('/replace-checkout'))return prior(url,init);
  assert.equal(init.headers['Idempotency-Key'],'same-replacement-key');
  assert.equal(init.headers['X-Pixkuy-Booking-Token'],'synthetic-edit-token');
  writes++;
  return new Response(JSON.stringify({status:'error',code,recovery:{state:'not_committed',action:'reservation_status',preserveData:true}}),{status:code==='BOOKING_STATUS_TOKEN_EXPIRED'?410:409});
 };
 r.click();await settle();const before=r.fleet.read('direct_transfer').attempt;
 assert.equal(before.state,'not_committed');assert.equal(r.error.textContent,resultCopy.paymentWindowClosed);assert.equal(r.button.disabled,true);
 r.click();await settle();assert.equal(writes,1);assert.equal(r.redirects.length,0);
 assert.equal(r.fleet.read('direct_transfer').attempt.key,before.key);
});
for(const mobile of [false,true])test('known closed checkout remains recoverable, not uncertain: '+(mobile?'mobile':'desktop'),async()=>{
 const r=await runtime({mobile,expired:false,prepareEnvironment:({window})=>{window.PixkuyAirportDesktopView={t:key=>resultCopy[key]};}});
 const prior=r.window.fetch;r.window.fetch=async(url,init)=>url.endsWith('/checkout')?new Response(JSON.stringify({status:'error',code:'CHECKOUT_PAYMENT_WINDOW_CLOSED',bookingStatusToken:'synthetic',recovery:{state:'committed',action:'reservation_status',preserveData:true}}),{status:409}):prior(url,init);
 r.click();await settle();
 assert.equal(r.error.textContent,resultCopy.paymentWindowClosed);assert.equal(r.redirects.length,0);
 const before=r.fleet.read('direct_transfer').attempt;assert.equal(before.state,'committed');assert.equal(before.response.code,'CHECKOUT_PAYMENT_WINDOW_CLOSED');
 r.click();await settle();assert.equal(r.redirects[0],'/booking-success.html?token=synthetic');
 assert.equal(r.fleet.read('direct_transfer').attempt.key,before.key);assert.deepEqual(r.fleet.read('direct_transfer').attempt.payload,before.payload);
});
for(const mobile of [false,true])test('lost response recovers the existing session with original key: '+(mobile?'mobile':'desktop'),async()=>{
 const r=await runtime({mobile,expired:false});r.state.lost=true;r.click();await settle();
 const before=r.fleet.read('direct_transfer').attempt;assert(before);assert.equal(r.redirects.length,0);
 r.state.lost=false;r.click();await settle();
 assert.equal(r.writes().length,2);assert.equal(r.writes()[0].headers['Idempotency-Key'],r.writes()[1].headers['Idempotency-Key']);
 assert.deepEqual(r.writes()[0].payload,r.writes()[1].payload);assert.match(r.redirects[0],/^\/booking-checkout.html\?token=/);
 assert.equal(r.fleet.read('direct_transfer').attempt.key,before.key);
});
