'use strict';
// Existing HTTPS landing + real read-only precheck/media. Never submits a booking.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('../../../pixkuy_frontend/node_modules/playwright');
const origin = 'https://local.pixkuy.test';
const endpoint = '/v1/public/reservations/airport-transfer-availability-precheck';
const output = process.env.PIXKUY_PHOTO_OUTPUT;
const before = process.env.PIXKUY_PHOTO_BEFORE === '1';
const remaining = process.env.PIXKUY_PHOTO_REMAINING === '1';
const screensOnly = process.env.PIXKUY_PHOTO_SCREENS === '1';
const reviewOnly = process.env.PIXKUY_PHOTO_REVIEW === '1';
assert(output && process.env.PIXKUY_REAL_PRECHECK === '1', 'Explicit local read-only opt-in required');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = { origin, startedAt: new Date().toISOString(), before, prechecks: [], media: [], screens: [], errors: [], blocked: [], resources: [] };
async function main() {
  await fs.mkdir(output, { recursive: true });
  // Use installed Chrome for visual acceptance; the bundled headless renderer
  // produced transparent decoded WebP pixels on Review in this environment.
  const bundled = process.env.PIXKUY_PHOTO_BUNDLED === '1';
  const browser = await chromium.launch({ headless: true, ...(bundled ? {} : {channel:'chrome'}) });
  evidence.browser = { channel: bundled ? 'bundled-chromium' : 'chrome', version: browser.version() };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const tasks = [];
  page.setDefaultTimeout(15000);
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (/\.(mp4|webm|mov|m3u8)$/i.test(url.pathname)) return route.abort();
    if (url.origin === origin && (['GET','HEAD'].includes(request.method()) || url.pathname === endpoint)) return route.continue();
    if (['maps.googleapis.com','maps.gstatic.com','places.googleapis.com','fonts.googleapis.com','fonts.gstatic.com','unpkg.com'].includes(url.hostname) && !url.pathname.includes('collect')) return route.continue();
    if (!['GET','HEAD'].includes(request.method())) evidence.blocked.push({ origin: url.origin, path: url.pathname, method: request.method() });
    return route.abort();
  });
  page.on('pageerror', error => evidence.errors.push(error.message.replace(/https?:\/\/\S+/g, '[url]')));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== origin) return;
    if (url.pathname === endpoint) tasks.push((async () => {
      evidence.prechecks.push({ at: new Date().toISOString(), payload: response.request().postDataJSON(), status: response.status(), body: await response.json() });
    })());
    if (url.pathname.startsWith('/v1/public/fleet/models/')) tasks.push((async () => {
      const bytes = await response.body();
      const row = { path: url.pathname, status: response.status(), contentType: response.headers()['content-type'], bytes: bytes.length, sha256: digest(bytes) };
      evidence.media.push(row);
      if (row.status === 200) await fs.writeFile(path.join(output, path.basename(url.pathname) + '-' + row.sha256.slice(0, 12) + '.webp'), bytes);
    })());
    if (/^\/assets\/(?:js\/(?:forms\/(?:airport-desktop-[^/]+|booking-public-config)|services\/(?:fleet-selection-state|airport[^/]+))\.js|css\/[^/]+\.css)$/.test(url.pathname)) tasks.push((async () => {
      const served = await response.body(), local = await fs.readFile(path.resolve(__dirname, '..', url.pathname.slice(1)));
      evidence.resources.push({ path: url.pathname, status: response.status(), servedHash: digest(served), localHash: digest(local), matches: served.equals(local) });
    })());
  });
  const panel = '#services-expand-airport';
  async function settled() {
    await page.waitForFunction(() => ['available','unavailable','error','choice'].includes(document.querySelector('#services-expand-airport').getAttribute('data-airport-mobile-availability-state')), null, { timeout: 45000 });
    await page.waitForLoadState('networkidle');
    await Promise.all(tasks);
  }
  async function photo(selector) {
    const img = page.locator(selector + ':visible').first();
    await img.waitFor({ state: 'visible' });
    await img.evaluate(async image => { await image.decode(); });
    const result = await img.evaluate(image => {
      const box = image.getBoundingClientRect(), style = getComputedStyle(image);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,16,16);
      const pixels=ctx.getImageData(0,0,16,16).data;
      return { src: new URL(image.currentSrc).pathname, alt: image.alt, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, width: box.width, height: box.height, display: style.display, visibility: style.visibility, opacity: style.opacity, decodedAlpha: [...pixels].filter((v,i)=>i%4===3).reduce((a,b)=>a+b,0) };
    });
    assert(result.naturalWidth > 100 && result.naturalHeight > 100 && result.width > 100 && result.height > 100 && result.opacity !== '0');
    assert(result.decodedAlpha > 0, 'Decoded dimensions alone do not prove a painted photo');
    const expected = await page.evaluate(() => {
      const model = window.PixkuyFleetSelection.model('airport_transfer');
      return { name: model.name, path: new URL(window.PixkuyFleetSelection.photo(model)).pathname };
    });
    assert.equal(result.src, expected.path); assert.equal(result.alt, expected.name);
    return result;
  }
  async function capture(label, scope = panel, imageSelector = panel + ' .airport-single-model__image') {
    await page.waitForLoadState('networkidle');
    const image = before || !imageSelector ? null : await photo(imageSelector);
    if (scope === 'body') await page.locator('.airport-booking__logo').evaluate(async logo => { await logo.decode(); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const text = await page.locator(scope).innerText();
    const state = await page.evaluate(() => ({ model: window.PixkuyFleetSelection.model('airport_transfer'), availability: document.querySelector('#services-expand-airport').getAttribute('data-airport-mobile-availability-state'), disabled: window.PixkuyAirportZoneTariff.cta.disabled, trip: window.PixkuyAirportZoneTariff.getState() }));
    evidence.screens.push({ label, image, state, text });
    if (scope === panel) await page.locator(scope).screenshot({ path: path.join(output, label + '.png') });
    else await page.screenshot({ path: path.join(output, label + '.png'), fullPage: true });
  }
  async function chooseOffered() {
    const choices = page.locator('[data-fleet-selection="airport_transfer"] input[type=radio]:visible');
    if (await choices.count()) await choices.first().check();
    const confirm = page.locator('[data-fleet-selection="airport_transfer"] button');
    if (await confirm.isVisible()) await confirm.click();
    await settled();
  }
  try {
    await page.goto(origin + '/#services');
    await page.waitForFunction(() => window.PixkuyAirportZoneTariff);
    await page.locator('[data-consent-reject]').click({ timeout: 1500 }).catch(() => {});
    await page.locator('.service-card').filter({ has: page.locator('[data-i18n="services.cards.airport.title"]') }).click();
    await page.locator(panel + ' input[placeholder]').fill('NH Collection Mexico City Reforma');
    await page.locator(panel + ' [role=option]').filter({ hasText: 'Liverpool 155' }).click({ timeout: 20000 });
    await page.locator('#airport-tariff-date').fill('2027-01-15');
    await page.locator('#airport-tariff-time').fill('07:38');
    await page.locator('[data-airport-tariff-passenger-option="van_1_2"]').click();
    await settled();
    await capture('configuracion-directa');
    if (before) { assert(evidence.media.some(row => row.status === 404)); return; }
    assert.equal(evidence.screens.at(-1).state.disabled, false);
    const offered = evidence.prechecks.at(-1).body.result;
    assert(offered.fleet.models.some(model => model.modelId === evidence.screens.at(-1).state.model.modelId));
    assert(offered.price.amountMinor > 0, 'Use the live price, not a historical fixture');
    if (!remaining && !screensOnly && !reviewOnly) {
    await page.locator('[data-airport-desktop-vehicle-gallery-trigger]').click();
    const galleryImage = page.locator('.direct-transfer-desktop-vehicle-gallery__image:visible');
    await galleryImage.evaluate(async image => { await image.decode(); });
    const gallery = await page.evaluate(() => window.PixkuyFleetSelection.gallery('airport_transfer'));
    assert.equal(await galleryImage.getAttribute('src'), gallery.images[0].src);
    assert(await galleryImage.evaluate(image => image.naturalWidth > 100 && image.getBoundingClientRect().width > 100));
    await page.screenshot({ path: path.join(output, 'galeria-modelo-ofrecido.png') });
    await page.locator('.direct-transfer-desktop-vehicle-gallery__close').click();
    await page.locator('#airport-tariff-time').fill('00:49');
    await settled();
    const suggestion = evidence.prechecks.at(-1).body.result.availability.nextAvailableStartLocal;
    assert(suggestion, 'Real current alternative required');
    assert(await page.locator(panel + ' .services-expand__actions .services-expand__cta').isDisabled());
    await page.locator(panel + ' .shared-availability-suggestion__link').click();
    assert(await page.locator(panel + ' .services-expand__actions .services-expand__cta').isDisabled());
    await settled();
    assert.equal(await page.locator('#airport-tariff-time').inputValue(), suggestion.slice(11, 16));
    await capture('configuracion-sugerencia');
    }
    for (const band of (screensOnly || reviewOnly ? [] : remaining ? ['van_5_6','van_1_2'] : ['van_3_4','van_5_6','van_1_2'])) {
      await page.locator('[data-airport-tariff-passenger-option="' + band + '"]').click();
      await settled();
      if (evidence.prechecks.at(-1).body.result.availability.available === false) {
        assert(await page.locator(panel + ' .services-expand__actions .services-expand__cta').isDisabled());
        assert.equal(await page.locator(panel + ' .airport-single-model__image:visible').count(), 0, 'Unavailable band must not display the previous vehicle photo');
        await capture('sin-disponibilidad-' + band, panel, null);
        assert(evidence.prechecks.at(-1).body.result.availability.nextAvailableStartLocal, 'Use a real certified alternative to test the other model');
        await page.locator(panel + ' .shared-availability-suggestion__link').click();
        await settled();
      }
      await chooseOffered();
      await capture('banda-' + band);
      assert.equal(evidence.screens.at(-1).state.disabled, false);
    }
    await page.locator('#airport-tariff-date').fill('2027-01-15');
    await page.locator('#airport-tariff-time').fill('07:38');
    await settled(); await chooseOffered();
    await capture('configuracion-regreso-modelo');
    if (!reviewOnly) {
    await page.reload();
    await page.waitForFunction(() => window.PixkuyAirportZoneTariff);
    evidence.reloadPanelInitiallyVisible = await page.locator(panel).isVisible();
    if (!evidence.reloadPanelInitiallyVisible) await page.locator('.service-card').filter({ has: page.locator('[data-i18n="services.cards.airport.title"]') }).click();
    await settled();
    await capture('configuracion-recargada');
    }
    await page.locator(panel + ' .services-expand__actions .services-expand__cta').click();
    await page.waitForURL(/#airport\/datos$/);
    await page.locator('#contact-name').fill('Persona Sintética');
    await page.locator('#contact-phone').fill('+525512345678');
    await page.locator('#contact-email').fill('audit@example.invalid');
    await page.locator('#contact-message').fill('Notas de prueba desktop');
    await page.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    await page.waitForFunction(() => !document.querySelector('#contact-submit').disabled);
    await capture('datos', 'body', '.airport-booking__photo');
    await page.locator('#contact-submit').click();
    await page.waitForURL(/#airport\/revision$/);
    await page.waitForFunction(() => document.querySelector('[data-airport-pay]') && !document.querySelector('[data-airport-pay]').disabled);
    await capture('revision', 'body', '.airport-booking__photo');
    assert.deepEqual(evidence.errors, []);
    assert.deepEqual(evidence.blocked, [], 'No booking, payment or communication request is permitted');
    assert(evidence.media.length && evidence.media.every(row => row.status === 200 && row.contentType.startsWith('image/')));
    assert(evidence.prechecks.every(row => row.status === 200));
    evidence.result = 'PASS';
  } catch (error) {
    evidence.failure = error.message.replace(/https?:\/\/\S+/g, '[url]');
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.all(tasks);
    evidence.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error.message.replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
