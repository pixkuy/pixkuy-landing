const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const fixtures=require('./airport-controlled-fixtures.cjs');
const evidence=path.resolve(__dirname,'../../../evidence/airport-confirmed-photo-20261003');
module.exports=async function({page,context,origin,output,before,webkit,model,stats,report,load}) {
  const bindings=JSON.parse(await fs.readFile(path.join(evidence,'bindings-before.json'),'utf8'));
  const preimages=new Map(bindings.filter(n=>n.repo==='landing'&&!n.path.startsWith('scripts/')).map(n=>['/'+n.path,path.join(evidence,'preimages/landing',n.path)]));
  if(before)await context.route(origin+'/**',route=>{const file=preimages.get(new URL(route.request().url()).pathname);return file?route.fulfill({path:file}):route.fallback();});
  const factory=(state='confirmed')=>fixtures.status({source:{airport_transfer_date:'2027-01-14',airport_transfer_time:'12:30'},selected:model,amount:80000,service:'airport_transfer',state,canModify:false,canRetry:false});
  let body=factory();
  await context.route('**/v1/public/reservations/status*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)}));
  report.browser=webkit?'Playwright WebKit, not physical iPhone':'Chromium';report.observations=[];
  const check=(v,label)=>{report.observations.push({label,pass:!!v});if(!before)assert(v,label);};
  const root=page.locator('[data-airport-return]');
  const panel=page.locator('[data-booking-status-mobile-panel]');
  async function shot(name){await page.evaluate(()=>document.fonts.ready);const consent=page.locator('[data-consent-reject]');if(await consent.isVisible())await consent.click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});}
  async function visit(width=390){
    await page.setViewportSize({width,height:844});await page.goto(origin+'/booking-success.html?token=synthetic-confirmed-copy');
    await page.locator(width>720?'.airport-booking--result':'[data-airport-return]').waitFor();
    const reject=page.locator('[data-consent-reject]');if(await reject.isVisible())await reject.click();
    await page.evaluate(()=>document.fonts.ready);
  }
  for(const width of [320,390,430]) {
    await load(width);
    const tripImage=page.locator('.airport-mobile-vehicle-gallery-trigger__image');await tripImage.waitFor();await tripImage.scrollIntoViewIfNeeded();
    const photoStyle=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {width:r.width,height:r.height,fit:s.objectFit,position:s.objectPosition,radius:s.borderRadius};};
    const tripPhoto=await tripImage.evaluate(photoStyle);report.observations.push({width,tripPhoto});
    await shot('trip-photo-'+width);
    await page.locator('[data-airport-mobile-vehicle-gallery-trigger]').click();
    check(await page.locator('.airport-mobile-vehicle-gallery:not([hidden])').isVisible(),'trip-gallery-opens-'+width);await page.keyboard.press('Escape');

    body=factory();body.reservation.destinationAddress='Hotel MX Condesa';body.reservation.destinationAddressDetail='Salamanca 35, Roma Norte, Ciudad de México, México';
    await visit(width);
    check(await root.locator('[data-booking-status-title]').innerText()==='Reserva confirmada','server-confirmed-'+width);
    check((await root.locator('[data-booking-status-amount]').innerText()).includes('800'),'paid-amount-'+width);
    check(!await root.locator('[data-booking-status-lead]').isVisible()&&!await root.locator('[data-booking-status-payment]').isVisible(),'no-duplicate-confirmation-'+width);
    check(await root.locator('.airport-return__disclosure:not([open])').count()===1,'contact-closed-'+width);
    const layout=await root.evaluate(n=>{const p=n.querySelector('[data-booking-status-mobile-panel]');const box=k=>n.querySelector('[data-booking-status-'+k+']').getBoundingClientRect();return {scrollWidth:p.scrollWidth,width:p.clientWidth,contentHeight:p.scrollHeight,dateY:box('date').top,pickupY:box('pickup').top,vehicleY:box('vehicle').top,vehicleBottom:box('vehicle').bottom,viewport:innerHeight};});
    report.observations.push({width,layout});check(layout.scrollWidth<=layout.width+1,'no-clipping-'+width);check(layout.vehicleY<layout.dateY&&layout.dateY<layout.pickupY,'vehicle-date-route-order-'+width);
    check((await root.locator('[data-booking-status-passengers]').innerText()).trim()==='1–2','passenger-band-retained-'+width);
    if(!before) {
      const confirmedPhoto=await root.locator('[data-booking-status-vehicle-thumb]').evaluate(photoStyle);
      assert.deepEqual(confirmedPhoto,tripPhoto,'Confirmed photo equals Trip at '+width);report.observations.push({width,confirmedPhoto});
      check(await root.locator('.airport-return__vehicle-summary [data-booking-status-amount]').count()===1 && await root.locator('[data-booking-status-details] [data-booking-status-vehicle],[data-booking-status-details] [data-booking-status-passengers],[data-booking-status-details] [data-booking-status-luggage],[data-booking-status-details] [data-booking-status-amount]').count()===0,'single-vehicle-capacity-payment-block-'+width);
      check(await root.locator('.airport-return__vehicle-summary dt').allTextContents().then(t=>t.includes('Importe pagado')),'paid-label-'+width);
      const timezone=await root.locator('[data-airport-confirmed-timezone]').innerText();report.observations.push({timezone});check(timezone.trim()==='Hora de Ciudad de México','timezone-'+width);
      check(await root.locator('[data-booking-status-destination] .airport-return__address').innerText()===body.reservation.destinationAddressDetail,'complete-address-'+width);
    }
    await shot('confirmed-initial-'+width);
    await root.locator('.airport-return__disclosure summary').click();await panel.evaluate(n=>n.scrollTop=n.scrollHeight);await shot('confirmed-contact-'+width);
    check(await root.locator('[data-airport-return-email]').isVisible(),'contact-expanded-'+width);
    await page.locator('[data-mobile-topbar-menu-trigger]').click();await shot('confirmed-menu-'+width);await page.keyboard.press('Escape');
    check(await page.locator('[data-mobile-topbar-menu]').isHidden(),'menu-close-'+width);
    if(!before) {
      const summary=root.locator('.airport-return__disclosure summary');await summary.focus();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pixkuy:airport-desktop-copy')));
      check(await summary.evaluate(n=>document.activeElement===n&&n.parentNode.open),'redraw-keeps-disclosure-and-focus-'+width);
      await page.evaluate(()=>window.PixkuyBookingStatusState.refresh());
      check(await summary.evaluate(n=>document.activeElement===n&&n.parentNode.open),'status-refresh-keeps-disclosure-and-focus-'+width);
      if(width===390) {
        await page.locator('#lang-trigger').click();await page.locator('.lang-menu [data-lang="en"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-airport-confirmed] [data-booking-status-title]').textContent==='Booking confirmed');
        check(await root.locator('.airport-return__disclosure[open]').count()===1,'language-keeps-contact-open');
        await shot('confirmed-en');
        await page.locator('#lang-trigger').click();await page.locator('.lang-menu [data-lang="es"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-airport-confirmed] [data-booking-status-title]').textContent==='Reserva confirmada');
      }
      const whatsapp=root.locator('[data-booking-status-whatsapp]');const whatsappUrl=new URL(await whatsapp.getAttribute('href'));check(whatsappUrl.protocol==='whatsapp:'&&whatsappUrl.searchParams.get('text').includes('PKY-QA'),'existing-whatsapp-link-'+width);
    }

  }
  const stable=[];
  for(const [state,width] of [['pending_payment',390],['confirmed',721],['confirmed',1440]]) {
    body=factory(state);await visit(width);await shot(state+'-'+width);
    const selector=width>720?'.airport-booking--result':'[data-airport-return]';
    const metric=await page.locator(selector).evaluate(n=>({text:n.innerText,width:n.clientWidth,height:n.clientHeight}));stable.push({state,width,...metric});
  }
  if(before)await fs.writeFile(path.join(output,'preserved.json'),JSON.stringify(stable,null,2));
  else assert.deepEqual(stable,JSON.parse(await fs.readFile(path.join(output,'../before/preserved.json'),'utf8')),'Pending and desktop unchanged');
  if(!before) {
    body=factory();body.reservation.destinationAddress='Hotel de prueba';body.reservation.destinationAddressDetail='Avenida Paseo de la Reforma 1234, edificio poniente, acceso principal por la calle lateral, colonia Lomas, Ciudad de México, México';
    body.customer.email='persona.sintetica.con.correo.muy.largo@example.invalid';body.reservation.customerNotes='Notas sintéticas completas. '.repeat(35);
    await visit(320);await shot('confirmed-long-closed');await root.locator('.airport-return__disclosure summary').click();await panel.evaluate(n=>n.scrollTop=n.scrollHeight);await shot('confirmed-long-open-bottom');
    check(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'long-contact-no-horizontal-clipping');
    check(await root.locator('[data-booking-status-notes]').innerText()===body.reservation.customerNotes.trim(),'full-notes');
    await root.locator('[data-booking-status-primary]').click();await page.waitForURL(origin+'/');check(page.url()===origin+'/','another-service-handler');
    body=factory();body.payment.amountPaid=null;await visit();check(await root.locator('[data-booking-status-amount]').innerText()==='—','unknown-paid-never-fare');
    body=factory();body.reservation.vehiclePhotoUrl=null;body.reservation.destinationAddress='Hotel — Salamanca 35, Roma Norte';body.reservation.destinationAddressDetail='Salamanca 35, Roma Norte';await visit();
    check(await root.locator('[data-booking-status-destination]').innerText()===body.reservation.destinationAddress,'compound-address-not-split-or-duplicated');await shot('confirmed-missing-photo');
  }
  check(stats().checkouts.length===0&&stats().writes===0,'no-business-writes');
};

module.exports.manualConfirmed=options=>require('./airport-return-hierarchy-regression').manualPending({...options,confirmed:true,outputOverride:path.join(evidence,'manual')});
