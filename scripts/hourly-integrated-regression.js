"use strict";
// Uses the existing runner and real Hourly/Fleet/form modules. Does not serve,
// install or modify a product. Provider/API responses are explicit test fixtures.
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs/promises");
const os=require("node:os");
const fixtures=require("./airport-controlled-fixtures.cjs");
async function run(){
  assert.equal(process.env.PIXKUY_HOURLY_BROWSER_FIXTURES,"1","Explicit isolated fixture mode required");
  const origin=process.env.PIXKUY_TEST_ORIGIN||"http://localhost:8888";
  assert(["localhost","127.0.0.1"].includes(new URL(origin).hostname));
  const {chromium,webkit}=require(process.env.PIXKUY_PLAYWRIGHT_MODULE||"../../../pixkuy_frontend/node_modules/playwright");
  const engine=process.argv.includes("--webkit")?webkit:chromium;
  const output=path.resolve(process.env.PIXKUY_TEST_OUTPUT||path.join(os.tmpdir(),"pixkuy-hourly-candidate-browser"));
  await fs.mkdir(output,{recursive:true});
  const browser=await engine.launch({headless:true}),results=[];
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const context=await browser.newContext({viewport,locale:"es-MX"});
      const requests=[],errors=[];let count=0,checkoutCount=0,lost=true;
      const model={modelId:"10000000-0000-4000-8000-000000000001",modelRevision:1,name:"Synthetic Hourly",
        photoUrl:null,photoUrls:[],passengersSupported:2};
      await context.route("**/*",async route=>{
        const url=new URL(route.request().url());
        const json=body=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
        if(url.pathname==="/.netlify/functions/booking-public-config")
          return json({ok:true,bookingApi:{apiBaseUrl:origin},publicSite:{siteKey:"local_pixkuy_site_key"}});
        if(url.pathname.endsWith("/hourly-availability-precheck")){
          const payload=route.request().postDataJSON();assert.equal(payload.service_type,"hourly_daily");
          requests.push({kind:"precheck",payload});
          return json(fixtures.precheck({...payload,expectedAmountMinor:payload.hourly_daily_price},
            {models:[model],requestNumber:++count,available:true}));
        }
        if(url.pathname.endsWith("/checkout")||url.pathname.endsWith("/replace-checkout")){
          const payload=route.request().postDataJSON(),key=route.request().headers()["idempotency-key"];
          requests.push({kind:"checkout",key,payload});checkoutCount++;
          if(lost)return route.abort("failed"); // lost response, not certified absence
          return json({status:"ok",bookingStatusToken:"synthetic-hourly-token",
            checkoutUrl:"https://checkout.stripe.com/c/pay/synthetic-hourly"});
        }
        if(url.hostname==="checkout.stripe.com")
          return route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Isolated provider boundary</title>"});
        // No business API, email, Calendar, analytics, Maps or other external service.
        if(url.pathname.startsWith("/v1/"))return route.fulfill({status:503,contentType:"application/json",body:'{"code":"ISOLATED_CASE_NOT_CONFIGURED"}'});
        if(url.origin!==origin)return route.abort();
        return route.continue();
      });
      const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
      await page.goto(origin+"/?service=hourly_daily");
      await page.waitForFunction(()=>window.PixkuyHourlyBookingFlow&&window.PixkuyHourlyCheckout);
      // Real configuration controls and real panel handoff; only Places/API boundaries use fixtures.
      if(viewport.width<=720)await page.evaluate(()=>window.PixkuyHourlyMobileBookingFlow.open());
      const panel=page.locator('[data-services-hourly-panel]');
      await panel.locator('[data-services-hourly-mode="hourly"]').click();
      const pickup=panel.locator('[data-place-input="hourly_daily_pickup"]');
      await pickup.fill("Synthetic pickup");
      await pickup.evaluate(node=>node.dispatchEvent(new CustomEvent("pixkuy:hourly-daily-pickup-selected",{detail:{
        selectedPlace:{label:"Synthetic pickup",placeId:"synthetic-place",lat:19.427,lng:-99.1677}
      }})));
      await panel.locator('[data-services-hourly-date]').fill("2027-01-13");
      await panel.locator('[data-services-hourly-date]').dispatchEvent("change");
      const time=panel.locator('[data-services-hourly-time]');
      await time.fill("10:00");await time.dispatchEvent("change");
      await panel.locator('[data-fleet-hourly-passengers]').selectOption("2");
      await panel.locator('[data-services-hourly-notes]').fill("Synthetic notes preserved");
      await panel.locator('[data-services-hourly-notes]').dispatchEvent("input");
      await panel.locator('[data-services-hourly-cta]').click();
      await page.waitForURL(/#hourly\/datos$/);
      await page.locator('.hourly-booking [name="name"]').fill("Synthetic Customer");
      await page.locator('.hourly-booking [name="phone"]').fill("+525512345678");
      await page.locator('.hourly-booking [name="email"]').fill("synthetic@example.invalid");
      assert.equal(await page.locator('[name="hourly_daily_passengers"]').inputValue(),"2");
      assert.equal(await page.locator('form[name="contact"]').count(),1,"one canonical form");
      await page.locator(".hourly-booking #pixkuy-hourly-legal-acceptance").check();
      await page.locator(".hourly-booking #contact-submit").click();
      await page.waitForURL(/#hourly\/revision$/);
      assert.equal(checkoutCount,0,"Data -> Review does not dispatch payment");
      if(viewport.width<=720){
        const back=page.locator('.hourly-booking--mobile .hourly-mobile-flow__back');
        assert.equal(await back.count(),1);
        await back.click();await page.waitForURL(/#hourly\/datos$/);
        assert.equal(await page.locator('.hourly-booking [name="name"]').inputValue(),"Synthetic Customer");
        await page.locator('.hourly-booking #contact-submit').click();await page.waitForURL(/#hourly\/revision$/);
      }
      if(viewport.width<=720){
        // Both real navigation listeners run in the page's normal registration order.
        await page.goBack();await page.waitForURL(/#hourly\/datos$/);
        await page.goForward();await page.waitForURL(/#hourly\/revision$/);
        assert(await page.locator('[data-hourly-mobile-route]').isVisible());
        assert(await page.locator('.mobile-topbar').isVisible());
        await page.locator('[data-mobile-topbar-menu-trigger]').click();
        assert(await page.locator('[data-mobile-topbar-menu-panel]').isVisible());
        await page.locator('[data-mobile-topbar-menu-dismiss]').first().click();
        // Force long content through the actual data form, then reach legal/payment in Review.
        await page.locator('.hourly-booking--mobile .hourly-mobile-flow__back').click();
        await page.locator('.hourly-booking [name="message"]').fill('Notas extensas de fixture. '.repeat(40));
        await page.locator('.hourly-booking #contact-submit').click();await page.waitForURL(/#hourly\/revision$/);
        const scroller=page.locator('[data-hourly-mobile-route-content]');
        assert.equal(await scroller.evaluate(n=>getComputedStyle(n).overflowY),'auto');
        await page.locator('[data-hourly-pay]').scrollIntoViewIfNeeded();
        const box=await page.locator('[data-hourly-pay]').boundingBox();
        assert(box&&box.y>=0&&box.y+box.height<=viewport.height,'payment reachable inside mobile viewport');
        assert(await page.locator('.hourly-booking .legal-acceptance__links a').first().isVisible());
        await page.screenshot({path:path.join(output,'hourly-mobile-review-long-content.png')});
      }
      assert(await page.locator("[data-hourly-pay]").isEnabled());
      await page.locator("[data-hourly-pay]").click();
      await page.waitForFunction(()=>window.PixkuyFleetSelection.read("hourly_daily").attempt);
      const before=await page.evaluate(()=>window.PixkuyFleetSelection.read("hourly_daily").attempt);
      assert.equal(before.state,"pending");assert(before.key);
      lost=false;
      // Invoke the real visible recovery action, preserving its frozen payload.
      await page.getByRole("button",{name:"Recuperar y continuar al pago",exact:true}).click();
      await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/synthetic-hourly/);
      const sends=requests.filter(r=>r.kind==="checkout");
      assert.equal(sends.length,2);assert.equal(sends[0].key,sends[1].key);
      assert.deepEqual(sends[0].payload,sends[1].payload);
      assert.equal(sends[1].payload.hourly_daily_passengers,2);
      assert.equal(sends[1].payload.hourly_daily_duration_hours,2);
      results.push({viewport,case:"T26/T32 configuration-data-review, mobile back and lost response",result:"PASS",requests});
      await page.screenshot({path:path.join(output,"hourly-"+viewport.width+"-provider-boundary.png")});
      assert.deepEqual(errors,[]);
      await context.close();
    }
  }finally{await browser.close();}
  await fs.writeFile(path.join(output,"result.json"),JSON.stringify({results,scope:"intercepted UI; no SQL/provider/human acceptance"},null,2));
  console.log(JSON.stringify({result:"PASS",cases:results.length,output}));
}
module.exports={run};
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
