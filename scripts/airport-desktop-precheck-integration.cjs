'use strict';
// Read-only integration against the existing local runner/API. No business doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('../../../pixkuy_frontend/node_modules/playwright');
const origin = process.env.PIXKUY_PRECHECK_HTTPS === '1' ? 'https://local.pixkuy.test' : 'http://localhost:8888';
const apiOrigin = 'http://192.168.0.14:3002';
const endpoint = '/v1/public/reservations/airport-transfer-availability-precheck';
const output = process.env.PIXKUY_PRECHECK_OUTPUT;
const baseline = process.env.PIXKUY_PRECHECK_BASELINE === '1';
const staleOnly = process.env.PIXKUY_PRECHECK_VALIDATE === 'stale';
const relevantResource = resource => /\/(?:airport[^/]*|fleet-selection-state|booking-public-config|services-expand|google-places[^/]*|shared-availability[^/]*)\.js$/.test(resource.path) || resource.path === '/assets/i18n/es.json';
assert(output && process.env.PIXKUY_REAL_PRECHECK === '1', 'Explicit local precheck opt-in required');
const evidence = { startedAt: new Date().toISOString(), origin, requests: [], events: [], errors: [], blocked: [], resources: [] };
async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1530, height: 1000 }, serviceWorkers: 'block', ignoreHTTPSErrors: origin.startsWith('https:') });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (baseline && url.origin === origin && ['/assets/js/forms/airport-desktop-booking.js','/assets/js/forms/airport-mobile-draft.js','/assets/js/forms/airport-desktop-view.js','/assets/js/services-expand.js'].includes(url.pathname)) {
      return route.fulfill({ contentType: 'application/javascript', path: path.resolve(__dirname, '../../../evidence/airport-desktop-controls-20261011/preimage', path.basename(url.pathname)) });
    }
    if (/\.(mp4|webm|mov|m3u8)(?:\?|$)/i.test(url.pathname)) return route.abort();
    if (url.origin === apiOrigin) {
      if (url.pathname === endpoint || request.method() === 'GET' && /^(\/health(?:\/db)?|\/v1\/public\/runtime-config)$/.test(url.pathname)) return route.continue();
      evidence.blocked.push({ origin: url.origin, path: url.pathname, method: request.method() });
      return route.abort();
    }
    if (url.origin === origin && (['GET','HEAD'].includes(request.method()) || url.pathname === endpoint)) return route.continue();
    if (['maps.googleapis.com','maps.gstatic.com','places.googleapis.com'].includes(url.hostname)) return route.continue();
    // Do not record query strings or provider headers: they may contain credentials.
    return route.abort();
  });
  const responses = [];
  page.on('pageerror', error => evidence.errors.push(error.message.replace(/https?:\/\/\S+/g, '[url]')));
  page.on('request', request => {
    if (new URL(request.url()).pathname !== endpoint) return;
    const entry = { sentAt: new Date().toISOString(), payload: request.postDataJSON(), url: request.url() };
    evidence.requests.push(entry);
    request.__precheckEvidence = entry;
  });
  page.on('requestfailed', request => {
    if (request.__precheckEvidence) request.__precheckEvidence.failure = request.failure()?.errorText;
  });
  page.on('response', response => {
    const resource = new URL(response.url());
    if (resource.origin === origin && /^\/assets\/(js\/.*\.js|i18n\/es\.json)$/.test(resource.pathname)) responses.push((async () => {
      const served = await response.body();
      const local = await fs.readFile(path.resolve(__dirname, '..', resource.pathname.slice(1)));
      const hash = bytes => createHash('sha256').update(bytes).digest('hex');
      evidence.resources.push({ path: resource.pathname, url: response.url(), at: new Date().toISOString(), status: response.status(), servedHash: hash(served), localHash: hash(local), matches: served.equals(local) });
      if (!served.equals(local) && ['/assets/js/forms/airport-desktop-booking.js','/assets/js/forms/contact-event-special-editor.js'].includes(resource.pathname)) await fs.writeFile(path.join(output, 'served-' + path.basename(resource.pathname)), served);
    })());
    const entry = response.request().__precheckEvidence;
    if (entry) responses.push((async () => {
      entry.receivedAt = new Date().toISOString(); entry.status = response.status();
      try { entry.body = await response.json(); } catch { entry.unreadable = true; }
    })());
  });
  try {
    await page.goto(origin + (origin.startsWith('https:') ? '/#services' : '/?service=airport_hotel&lang=es'));
    await page.waitForFunction(() => window.PixkuyAirportZoneTariff);
    await page.locator('[data-consent-reject]').click({ timeout: 1200 }).catch(() => {});
    if (origin.startsWith('https:')) await page.locator('.service-card').filter({ has: page.locator('[data-i18n="services.cards.airport.title"]') }).click();
    await page.evaluate(() => {
      window.__precheckTimeline = [];
      const fleet = window.PixkuyFleetSelection;
      const original = fleet.fetchPrecheck;
      fleet.fetchPrecheck = function (...args) {
        const at = performance.now();
        return original.apply(this, args).catch(error => {
          window.__precheckTimeline.push({ at: performance.now(), began: at, transportError: error.message });
          throw error;
        });
      };
      for (const type of ['input','change','click']) document.addEventListener(type, event => {
        const target = event.target.closest('input,[data-airport-tariff-passenger-option],[role=option]');
        if (target && target.closest('#services-expand-airport')) window.__precheckTimeline.push({ at: performance.now(), type, id: target.id, value: target.value, fare: target.getAttribute('data-airport-tariff-passenger-option') });
      }, true);
      const panel = document.querySelector('#services-expand-airport');
      new MutationObserver(() => window.__precheckTimeline.push({ at: performance.now(), availability: panel.getAttribute('data-airport-mobile-availability-state') })).observe(panel, { attributes: true, attributeFilter: ['data-airport-mobile-availability-state'] });
    });
    await page.locator('#services-expand-airport input[placeholder]').fill('NH Collection Mexico City Reforma');
    await page.locator('#services-expand-airport [role=option]').first().waitFor({ timeout: 20000 });
    evidence.placeOptions = await page.locator('#services-expand-airport [role=option]').allTextContents();
    await page.locator('#services-expand-airport [role=option]').filter({ hasText: 'Liverpool 155' }).click();
    await page.locator('#airport-tariff-date').fill('2027-01-15');
    await page.locator('#airport-tariff-time').fill('00:49');
    await page.locator('[data-airport-tariff-passenger-option="van_3_4"]').click();
    async function capture(label) {
      await page.waitForFunction(() => ['unavailable','available','error'].includes(document.querySelector('#services-expand-airport').getAttribute('data-airport-mobile-availability-state')), null, { timeout: 45000 });
      await page.waitForLoadState('networkidle');
      const state = await page.evaluate(() => window.PixkuyAirportZoneTariff.getState());
      const commercialUi = await page.evaluate(() => ({ availability: document.querySelector('#services-expand-airport').getAttribute('data-airport-mobile-availability-state'), certificate: window.PixkuyFleetSelection.airportOfferStatus(), model: window.PixkuyFleetSelection.selection('airport_transfer'), disabled: window.PixkuyAirportZoneTariff.cta.disabled, alternative: document.querySelector('#services-expand-airport .shared-availability-suggestion__link')?.textContent || null }));
      evidence.events.push({ label, at: new Date().toISOString(), state, commercialUi, text: await page.locator('#services-expand-airport').innerText() });
      await page.locator('#services-expand-airport').screenshot({ path: path.join(output, label + '.png') });
    }
    await capture('first');
    if (process.env.PIXKUY_PRECHECK_VALIDATE === '1') {
      assert.equal(evidence.events.at(-1).commercialUi.availability, 'unavailable');
      assert(evidence.events.at(-1).commercialUi.alternative, 'First real response must expose its certified alternative');
    }
    if (process.env.PIXKUY_PRECHECK_RELOAD === '1') {
      await page.reload();
      await page.waitForFunction(() => window.PixkuyAirportZoneTariff);
      await capture('restored-draft');
    }
    await page.locator('#airport-tariff-date').fill('2027-01-16');
    await capture('other-date');
    if (!staleOnly) {
      await page.locator('#airport-tariff-date').fill('2027-01-15');
      await capture('return-date');
      if (process.env.PIXKUY_PRECHECK_VALIDATE === '1') assert.equal(evidence.events.at(-1).commercialUi.alternative, evidence.events[0].commercialUi.alternative);
    }
    if (process.env.PIXKUY_PRECHECK_VALIDATE) {
      if (!staleOnly) {
      const suggestion = evidence.requests.at(-1).body.result.availability.nextAvailableStartLocal;
      assert(suggestion, 'Current real backend must supply an alternative for this fixture');
      await page.locator('#services-expand-airport .shared-availability-suggestion__link').click();
      assert(await page.locator('#services-expand-airport .services-expand__actions .services-expand__cta').isDisabled(), 'Suggestion must revalidate before continuation');
      await capture('suggestion-applied');
      assert.equal(await page.locator('#airport-tariff-date').inputValue(), suggestion.slice(0, 10));
      assert.equal(await page.locator('#airport-tariff-time').inputValue(), suggestion.slice(11, 16));
      const checked = evidence.requests.at(-1);
      assert.equal(checked.payload.time, suggestion.slice(11, 16));
      assert.equal(checked.status, 200);
      }
      let release, ready;
      const gate = new Promise(resolve => release = resolve);
      const received = new Promise(resolve => ready = resolve);
      await context.route('**' + endpoint, async route => {
        const payload = route.request().postDataJSON();
        if (payload.date !== '2027-01-15' || payload.time !== '00:49') return route.fallback();
        // Delay delivery of a genuine backend response; never fabricate availability.
        const response = await route.fetch();
        evidence.delayedBackend = { at: new Date().toISOString(), status: response.status(), body: await response.json() };
        ready(); await gate;
        await route.fulfill({ response });
      });
      if (staleOnly) await page.locator('#airport-tariff-date').fill('2027-01-15');
      else await page.locator('#airport-tariff-time').fill('00:49');
      await received;
      await page.locator('#airport-tariff-date').fill('2027-01-16');
      await capture('new-selection');
      const current = evidence.events.at(-1).commercialUi;
      release(); await page.waitForLoadState('networkidle');
      await capture('old-response-released');
      assert.equal(await page.locator('#airport-tariff-date').inputValue(), '2027-01-16');
      assert.deepEqual(evidence.events.at(-1).commercialUi, current, 'Old real response must not replace current availability, certificate, model or continuation');
      assert.deepEqual(evidence.errors, []);
    }
    evidence.timeline = await page.evaluate(() => window.__precheckTimeline || []);
    assert.deepEqual(evidence.errors, [], 'Unexpected browser errors');
    if (process.env.PIXKUY_PRECHECK_VALIDATE === '1') {
      assert(evidence.requests.every(entry => !entry.failure && entry.status === 200), 'Every integrated precheck must succeed at HTTP level');
      await Promise.all(responses);
      assert(evidence.resources.filter(relevantResource).every(resource => resource.status === 200 && resource.matches), 'Airport served resources must match local final bytes');
    }
    evidence.panel = await page.locator('#services-expand-airport').evaluate(panel => ({
      text: panel.innerText,
      inputs: [...panel.querySelectorAll('input,select')].map(n => ({ id: n.id, role: n.getAttribute('role'), placeholder: n.getAttribute('placeholder'), visible: !!n.getClientRects().length }))
    }));
    await page.screenshot({ path: path.join(output, 'initial.png') });
  } catch (error) {
    evidence.failure = error.message.replace(/https?:\/\/\S+/g, '[url]');
    evidence.failurePanel = await page.locator('#services-expand-airport').innerText().catch(() => 'unavailable');
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    evidence.timeline = await page.evaluate(() => window.__precheckTimeline || []).catch(() => []);
    await Promise.all(responses);
    evidence.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error.message.replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
