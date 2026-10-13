'use strict';
// Actual desktop result + view modules with the established offline DOM adapter.
// Text construction is covered, not browser layout or delivery of notifications.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const support=fs.readFileSync(path.join(__dirname,'airport-netlify-independence.test.cjs'),'utf8');
const {Events,Element,Event,storage}=vm.runInNewContext(support.slice(support.indexOf('class Events'),support.indexOf('function runtime'))+'\n({Events,Element,Event,storage})',{assert});
async function run(){
  let cases=0;
  for(const locale of ['es','en','fr','de','it','pt','ru','ko','zh-hans']){
    const document=new Events();document.createElement=t=>new Element(t,document);
    document.body=document.createElement('body');document.documentElement=document.createElement('html');document.documentElement.lang=locale;
    document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
    const window=new Events();let update;
    const copy=JSON.parse(fs.readFileSync(path.join(root,'assets/i18n',locale,'airport-desktop-booking.json'),'utf8'));
    Object.assign(window,{document,matchMedia:()=>Object.assign(new Events(),{matches:true}),navigator:{},performance:{now:()=>0},
      location:{pathname:'/booking-success.html',search:''},sessionStorage:storage(),
      fetch:async url=>{assert.equal(url,'assets/i18n/'+locale+'/airport-desktop-booking.json');return {ok:true,json:async()=>copy};},
      PixkuyBookingStatusState:{onReady:fn=>{update=fn;}},PixkuyFleetSelection:{completeReservation(){}}});
    const sandbox=vm.createContext({window,document,Intl,URL,URLSearchParams,CustomEvent:Event});
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/forms/airport-desktop-view.js'),'utf8'),sandbox);
    vm.runInContext(fs.readFileSync(process.argv[2]==='--before'?process.argv[3]:path.join(root,'assets/js/forms/airport-desktop-result.js'),'utf8'),sandbox);
    await window.PixkuyAirportDesktopView.ready;await Promise.resolve();
    for(const band of ['1–2','3–4','5–6'])for(const view of ['pending','confirmed']){
      const result={serviceType:'direct_transfer',view,paymentStatus:view==='confirmed'?'paid':'pending',raw:{actions:{}},
        passengerLabel:band+' passengers',passengerCount:Number(band[2]),publicCode:'SYNTHETIC',
        pickupAddress:'Synthetic origin',destinationAddress:'Synthetic destination',serviceStartLocalDate:'2027-01-19',serviceStartLocalTime:'10:00',
        customerFullName:'Synthetic customer',luggageCount:null,paymentAmountPaid:195000,paymentAmountExpected:195000,paymentCurrency:'MXN'};
      const before=JSON.stringify(result);update({result,dictionary:{details:{}},token:'synthetic'});
      const passengerRow=document.querySelectorAll('.airport-booking__detail').find(row=>row.children[0]?.textContent===copy.passengers);
      assert(passengerRow,locale+': actual result rendered');
      assert.equal(passengerRow.children[1].textContent,copy.passengerBuckets['van_'+band.replace('–','_')],locale+' '+view);
      assert.equal(JSON.stringify(result),before,'No mutation of authoritative result');cases++;
    }
    update({result:{serviceType:'airport_transfer',view:'confirmed',paymentStatus:'paid',raw:{actions:{}},passengerLabel:'Airport preserved',luggageCount:1},dictionary:{details:{}},token:'synthetic'});
    assert(document.querySelectorAll('dd').some(row=>row.textContent==='Airport preserved'),'Shared Airport consumer unchanged');
  }
  console.log(JSON.stringify({result:'PASS',desktopTextCases:cases,airportBoundaryCases:9,locales:9,browser:false}));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
