'use strict';
// Deterministic initialization order. Real Direct owner/state/bridge/controller
// and legal guards; existing offline DOM and presentation-only view doubles.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const support=fs.readFileSync(path.join(__dirname,'airport-netlify-independence.test.cjs'),'utf8');
const {Events,Element,Event,storage}=vm.runInNewContext(support.slice(support.indexOf('class Events'),support.indexOf('function runtime'))+'\n({Events,Element,Event,storage})',{assert});
function runCase({mobile=false,missingContact=false,missingConsent=false,busy=false}={}){
  const document=new Events();document.createElement=t=>new Element(t,document);
  document.createTextNode=t=>Object.assign(document.createElement('text'),{textContent:t});
  document.body=document.createElement('body');document.documentElement=document.createElement('html');document.documentElement.lang='es';
  document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  const callbacks=[],window=Object.assign(new Events(),{document,Event,CustomEvent:Event,innerWidth:mobile?390:1440,
    sessionStorage:storage(),localStorage:storage(),location:{hash:'#direct/datos',search:'?service=direct_transfer',pathname:'/',origin:'https://local.pixkuy.test'},
    matchMedia:q=>({matches:q.includes('max-width')?mobile:!mobile}),setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,
    FormData:class{constructor(f){this.f=f;}forEach(fn){for(const n of this.f.elements)if(n.name&&!n.disabled)fn(String(n.value),n.name);}},
    libphonenumber:require('../../../pixkuy_frontend/node_modules/libphonenumber-js'),
    fetch(url){assert(/^assets\/i18n\/[a-z-]+\.json$/.test(url),'Network forbidden: '+url);return Promise.resolve(new Response(fs.readFileSync(path.join(root,url)),{status:200}));},PixkuyDirectPendingEdit:{activeData:()=>false}});
  const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';n.textContent=text||'';return n;};
  window.PixkuyAirportDesktopView={media:{matches:!mobile},ready:{then:fn=>callbacks.push(fn)},node,t:k=>k,
    shell:()=>node('main'),action:()=>node('button'),focusRouteHeading:n=>n.focus()};
  window.PixkuyDirectDesktopView={summary:()=>node('aside','airport-booking__summary'),trip:()=>node('section'),block:()=>node('section')};
  const sandbox=vm.createContext({window,document,location:window.location,Event,CustomEvent:Event,URL,URLSearchParams,console,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout});
  const load=file=>vm.runInContext(fs.readFileSync(path.join(root,'assets/js',file+'.js'),'utf8'),sandbox,{filename:file,timeout:1000});
  for(const file of ['forms/legal-acceptance','services/fleet-selection-state','services/direct-transfer-transactional-state','forms/direct-transfer-booking-form','forms/direct-transfer-booking-api-checkout'])load(file);
  const own=window.PixkuyDirectBookingForm,state=window.PixkuyDirectTransferTransactionalState,legal=window.PixkuyForms.LegalAcceptance,form=own.getReservationForm();
  const trip={direct_transfer_origin_address:'Origin',direct_transfer_origin_place_id:'origin',direct_transfer_origin_lat:'19.4',direct_transfer_origin_lng:'-99.1',
    direct_transfer_destination_address:'Destination',direct_transfer_destination_place_id:'destination',direct_transfer_destination_lat:'19.5',direct_transfer_destination_lng:'-99.2',
    direct_transfer_date:'2027-01-19',direct_transfer_time:'10:00',direct_transfer_passenger_fare_key:'van_3_4',direct_transfer_price:'900',direct_transfer_amount_minor:'90000',
    direct_transfer_currency:'MXN',direct_transfer_pricing_version:'controlled',direct_transfer_quote_fingerprint:'b'.repeat(64),
    direct_transfer_quote_expires_at:'2027-01-19T16:00:00Z',direct_transfer_quote_accepted_at:''};
  own.setTrip(trip);own.contact({name:'Synthetic',phone:'+525512345678',email:missingContact?'':'direct@example.invalid'});
  if(!missingConsent)legal.syncAcceptedFields(form,legal.buildSnapshot('web_direct_transfer_checkout'));
  state.writeReviewSnapshot(state.buildSnapshot(form,own.getReservationRequestData()));
  own.setTrip({});own.contact({name:'',phone:'',email:''});legal.clearFields(form);
  const submit=own.getReservationRequestFields().submit;
  // I18n settles while the owner is still empty, before base.ready restores it.
  window.dispatchEvent(new Event('pixkuy:i18n-applied'));
  if(!mobile)assert.equal(submit.disabled,true,'Initial incomplete owner is blocked');
  if(busy)form.setAttribute('data-booking-api-checkout-busy','1');
  const initialDisabled=submit.disabled;
  load('forms/direct-transfer-desktop-booking');
  callbacks.splice(0).forEach(fn=>fn());
  if(mobile){
    assert.equal(submit.disabled,initialDisabled,'Desktop restore must not mutate mobile controls');
    assert.equal(own.raw().direct_transfer_price,undefined,'Desktop restore does not own mobile recovery');
    if(window.PixkuyDirectBookingCheckout)assert.equal(window.PixkuyDirectBookingCheckout.refreshFormState(),false,'Shared guard API remains desktop-scoped');
    assert.equal(submit.disabled,initialDisabled);
  }else{
    assert.equal(submit.disabled,missingContact||missingConsent||busy,'Restoration must evaluate guards without any later input/click/i18n event');
    assert.equal(own.raw().direct_transfer_price,'900');assert.equal(own.raw().direct_transfer_quote_accepted_at,'');
    assert.equal(state.readReviewSnapshot().direct_transfer_quote_accepted_at,'');
    assert.equal(state.buildCheckoutPayload(state.buildSnapshot(form,own.getReservationRequestData())),null,'No implicit acceptance after restoration');
  }
  return {mobile,missingContact,missingConsent,busy,result:'PASS'};
}
const cases=[{}, {missingContact:true}, {missingConsent:true}, {busy:true}, {mobile:true}].map(runCase);
console.log(JSON.stringify({result:'PASS',cases,limit:'Offline actual modules and deterministic ready/i18n ordering; view doubles do not certify rendering or mobile navigation.'},null,2));
