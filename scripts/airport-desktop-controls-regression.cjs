'use strict';
// Real local pages and the established browser runner; only HTTP boundaries are doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('../../../pixkuy_frontend/node_modules/playwright');
const base = require('./mobile-booking-audit.cjs');
const before = process.argv.includes('--before');
const selected = process.env.PIXKUY_DESKTOP_CASE;
const rows = [];
const expectedResources = new Map();
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const key = 'pixkuy_airport_transfer_checkout_review_snapshot';
const pay = '[data-airport-pay]';
const legal = '#pixkuy-airport-transfer-legal-acceptance';
const writes = t => t.state.requests.filter(r => ['checkout', 'replace-checkout', 'retry-checkout'].includes(r.kind));
async function setup(width = 1440) {
  const t = await base.setup(width, 'airport_transfer');
  await t.context.route(/\.(?:mp4|webm|mov|m3u8)(?:\?|$)/i, r => r.abort());
  t.state.errorDetails = [];
  t.state.resourceEvidence = [];
  t.resourceTasks = [];
  t.page.on('pageerror', error => t.state.errorDetails.push({ at: new Date().toISOString(), documentUrl: t.page.url(), message: error.message, stack: error.stack }));
  t.page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== base.origin || !/^\/assets\/.+\.(js|css|json)$/.test(url.pathname)) return;
    const entry = { at: new Date().toISOString(), url: response.url(), documentUrl: t.page.url(), status: response.status(), contentType: response.headers()['content-type'] };
    t.state.resourceEvidence.push(entry);
    t.resourceTasks.push((async () => {
      try {
        const localPath = path.resolve(__dirname, '..', '.' + decodeURIComponent(url.pathname));
        assert(localPath.startsWith(path.resolve(__dirname, '..') + path.sep), 'Public asset must stay in landing');
        if (!expectedResources.has(localPath)) expectedResources.set(localPath, fs.readFile(localPath).then(digest));
        entry.localPath = localPath;
        entry.expectedSha256 = await expectedResources.get(localPath);
        const bytes = await response.body();
        entry.bytes = bytes.length;
        entry.servedSha256 = digest(bytes);
        entry.byteIdentical = entry.servedSha256 === entry.expectedSha256;
        entry.matches = entry.status === 200 && entry.servedSha256 === entry.expectedSha256;
        // Observed Netlify representation: this unrelated legacy script loses
        // only its UTF-8 BOM. Preserve raw hashes and allow no other transform.
        if (!entry.matches && entry.status === 200 && url.pathname === '/assets/js/forms/contact-event-special-editor.js') {
          const local = await fs.readFile(localPath);
          if (digest(local) === entry.expectedSha256 && local.subarray(0, 3).toString('hex') === 'efbbbf' && local.subarray(3).equals(bytes)) {
            entry.representation = 'exact-source-without-utf8-bom';
            entry.matches = true;
          }
        }
        if (!entry.matches) {
          entry.capturedResponse = 'resource-mismatch-' + entry.servedSha256 + '.txt';
          await fs.writeFile(path.join(base.output, entry.capturedResponse), bytes);
        }
      } catch (error) { entry.error = error.message; entry.matches = false; }
    })());
  });
  await t.page.setViewportSize({ width, height: 1000 });
  return t;
}
async function configure(t) {
  const p = t.page;
  await p.goto(base.origin + '/?service=airport_hotel&lang=es');
  await p.waitForFunction(() => window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
  await p.locator('[data-consent-reject]').click({ timeout: 900 }).catch(() => {});
  await p.evaluate(() => {
    const a = window.PixkuyAirportZoneTariff;
    a.setAirportSelection({ airportId: 'mex', direction: 'airport_to_hotel' });
    a.setResolvedDestination({ placeLabel: 'Hotel sintético — Roma Norte', zoneId: 'roma_condesa', placeId: 'synthetic-place', primaryType: 'lodging', lat: 19.418, lng: -99.169 });
    a.setFareKeySelection({ fareKey: 'van_3_4' });
  });
  await p.locator('#airport-tariff-date').fill('2027-01-13');
  await p.locator('#airport-tariff-time').fill('23:00');
  await p.locator('#airport-tariff-time').dispatchEvent('change');
  await p.waitForFunction(() => window.PixkuyFleetSelection.airportOfferStatus().valid);
  await p.locator(base.configCta('airport_transfer')).waitFor({ state: 'visible' });
}
async function data(t) {
  const p = t.page;
  await configure(t);
  await p.locator(base.configCta('airport_transfer')).click();
  await p.waitForURL(/#airport\/datos$/);
  await p.locator('#contact-name').fill('Persona Sintética');
  await p.locator('#contact-phone').fill('+525512345678');
  await p.locator('#contact-email').fill('audit@example.invalid');
  if (t.width > 720) await p.locator('#contact-message').fill('Notas de prueba desktop');
  else {
    await p.locator('#contact-message').click();
    await p.locator('[data-airport-mobile-notes-editor-input]').fill('Notas de prueba desktop');
    await p.locator('[data-airport-mobile-notes-editor-close]').click();
  }
  await p.locator(legal).check();
  await p.waitForFunction(() => !document.querySelector('#contact-submit').disabled);
}
async function review(t) {
  await data(t);
  await t.page.locator('#contact-submit').click();
  await t.page.waitForURL(/#airport\/revision$/);
  await t.page.waitForFunction(() => !!document.querySelector('[data-airport-pay]') && !document.querySelector('[data-airport-pay]').disabled);
}
async function shot(t, label) { return base.shot(t, label); }
async function readyReview(t) {
  await t.page.waitForFunction(() => !!document.querySelector('[data-airport-pay]') && !document.querySelector('[data-airport-pay]').disabled && window.PixkuyFleetSelection.airportOfferStatus().valid);
}
async function changeLanguage(t, lang) {
  // Exercise the real language handler; desktop booking hides the global header.
  await t.page.locator('[data-lang="' + lang + '"]').evaluate(n => n.click());
  await t.page.waitForFunction(lang => document.documentElement.lang === lang && window.__pixkuyI18nLang === lang, lang);
  await t.page.waitForLoadState('networkidle');
}
async function pending(t) {
  await review(t);
  await t.page.locator(pay).click(); await t.page.waitForURL(/checkout\.stripe\.com/);
  assert.equal(writes(t).length, 1);
  // Persisted expiry is fixed in this HTTP fixture, independent of each GET.
  const expiry = new Date(Date.now() + 1800000).toISOString();
  await t.context.route('**/v1/public/reservations/status*', r => {
    const body = base.statusBody('airport_transfer', t.state.mode, t.state.draft);
    body.hold.expiresAt = expiry;
    body.reservation.durationHours = 0.5;
    return r.fulfill({ json: body });
  });
  await t.page.goto(base.origin + '/booking-cancelled.html?token=synthetic-audit-airport_transfer');
  await t.page.waitForFunction(() => window.__auditStatus?.result);
  await t.page.getByRole('button', { name: 'Modificar datos', exact: true }).waitFor();
  return expiry;
}
async function runCase(name, action, width = 1440) {
  if (selected && !selected.split(',').includes(name)) return;
  const t = await setup(width), row = { name, width, startedAt: new Date().toISOString(), checks: [] };
  try {
    await action(t, row);
    await t.page.waitForLoadState('networkidle');
    await Promise.all(t.resourceTasks);
    assert.deepEqual(t.state.errors, [], 'Unexpected browser error');
    assert(t.state.resourceEvidence.length, 'No public resource evidence');
    assert.deepEqual(t.state.resourceEvidence.filter(resource => !resource.matches), [], 'Served resource differs from local source or could not be checked');
    row.result = 'PASS';
  }
  catch (e) {
    row.result = 'FAIL'; row.error = e.message;
    row.failure = await shot(t, name + '-failure').catch(() => null);
  } finally {
    await Promise.all(t.resourceTasks);
    row.finishedAt = new Date().toISOString();
    row.requests = t.state.requests; row.errors = t.state.errors; row.errorDetails = t.state.errorDetails;
    row.resources = t.state.resourceEvidence;
    rows.push(row); await t.context.close();
    console.log(JSON.stringify({ name, result: row.result, error: row.error }));
  }
}
async function main() {
  assert.equal(process.env.PIXKUY_AUDIT_FIXTURES, '1', 'Controlled fixture opt-in required');
  assert.equal(new URL(base.origin).hostname, 'localhost');
  await fs.mkdir(base.output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', '--no-proxy-server'] });
  base.setBrowser(browser);
  try {
    await runCase('review-reload', async (t, row) => {
      await configure(t); row.config = await shot(t, 'configuracion');
      await data(t); row.data = await shot(t, 'datos');
      await t.page.locator('#contact-submit').click();
      await t.page.waitForURL(/#airport\/revision$/);
      row.review = await shot(t, 'revision');
      assert.equal(writes(t).length, 0, 'Review must not write');
      await t.page.reload();
      await t.page.waitForLoadState('networkidle');
      row.reload = await shot(t, 'revision-recargada');
      assert.equal(await t.page.evaluate(() => window.PixkuyFleetSelection.airportOfferStatus().valid), true, 'Desktop review must revalidate automatically after reload');
      assert.equal(await t.page.locator(pay).isEnabled(), true);
      assert((await t.page.locator('.airport-booking').innerText()).includes('Persona Sintética'));
      assert.equal(writes(t).length, 0);
      row.checks.push('review and reload: no write, valid offer, preserved contact');
    });
    await runCase('config-reload', async (t, row) => {
      await configure(t);
      await t.page.reload(); await t.page.waitForLoadState('networkidle');
      row.screen = await shot(t, 'configuracion-recargada');
      assert.equal(await t.page.locator('#airport-tariff-date').inputValue(), '2027-01-13', 'Desktop configuration draft must survive reload');
      assert.equal(await t.page.locator('#airport-tariff-time').inputValue(), '23:00');
      assert.equal(await t.page.evaluate(() => window.PixkuyAirportZoneTariff.getState().selectedFareKey), 'van_3_4');
      assert.equal(writes(t).length, 0);
    });
    await runCase('review-expiry', async (t, row) => {
      await review(t);
      t.state.availability = 'technical';
      await t.page.evaluate(() => {
        const until = window.PixkuyFleetSelection.airportOfferStatus().validUntil;
        Date.now = () => until + 1;
        window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
      });
      await t.page.waitForLoadState('networkidle');
      row.screen = await shot(t, 'oferta-caducada-error');
      assert(t.state.requests.some(r => r.mode === 'technical'), 'Expired offer must be rechecked automatically on desktop');
      assert.equal(writes(t).length, 0);
      t.state.availability = 'available';
      await t.page.locator(pay).click();
      await t.page.waitForFunction(() => window.PixkuyFleetSelection.airportOfferStatus().valid);
      assert.equal(writes(t).length, 0, 'Recovery of availability must not checkout');
    });
    await runCase('availability-and-races', async (t, row) => {
      await configure(t);
      const p = t.page, cta = p.locator(base.configCta('airport_transfer'));
      await p.locator('#airport-tariff-date').fill('');
      assert(await cta.isDisabled(), 'Incomplete is not an available offer');
      await p.locator('#airport-tariff-date').fill('2027-01-13');
      for (const [i, mode] of ['unavailable', 'technical', 'available'].entries()) {
        t.state.availability = mode;
        const response = p.waitForResponse(r => r.url().includes('-availability-precheck') && r.request().postDataJSON().time === '22:0' + i);
        await p.locator('#airport-tariff-time').fill('22:0' + i);
        await p.locator('#airport-tariff-time').dispatchEvent('change');
        await response;
        await p.waitForLoadState('networkidle');
        assert.equal(await cta.isDisabled(), mode !== 'available', mode);
        row.checks.push({ mode, disabled: await cta.isDisabled(), screen: await shot(t, mode) });
      }
      t.state.delay = 900;
      const started = p.waitForRequest(r => r.url().includes('-availability-precheck') && r.postDataJSON().time === '22:03');
      await p.locator('#airport-tariff-time').fill('22:03');
      await p.locator('#airport-tariff-time').dispatchEvent('change');
      await started;
      t.state.delay = 0; t.state.availability = 'unavailable';
      await p.locator('#airport-tariff-time').fill('22:04'); await p.locator('#airport-tariff-time').dispatchEvent('change');
      await p.waitForLoadState('networkidle');
      assert(await cta.isDisabled(), 'Late available result cannot overwrite unavailable current trip');
      assert.equal(writes(t).length, 0);
    });
    await runCase('data-keyboard-consent', async (t, row) => {
      await data(t); const p = t.page;
      await p.locator('#contact-email').fill('incorrecto');
      await p.locator('#contact-submit').click();
      assert.equal(p.url().split('#')[1], 'airport/datos', 'Invalid contact must not advance');
      assert.equal(writes(t).length, 0);
      await p.locator('#contact-email').fill('audit@example.invalid');
      await p.locator(legal).uncheck();
      await p.locator('form[name=contact]').evaluate(f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(p.url().split('#')[1], 'airport/datos', 'Revoked consent must not advance');
      await p.reload(); await p.waitForLoadState('networkidle');
      assert.equal(await p.locator(legal).isChecked(), false, 'Revocation must survive reload');
      await p.locator(legal).check();
      await p.locator('#contact-luggage').fill('0');
      await p.locator('#contact-message').fill('');
      t.state.delay = 300;
      await p.locator('#contact-email').press('Enter');
      await p.locator('form[name=contact]').evaluate(f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      assert.equal(writes(t).length, 0, 'Repeated submit and Enter are review only');
      await p.goBack(); await p.waitForURL(/#airport\/datos$/);
      assert.equal(await p.locator('#contact-luggage').inputValue(), '0');
      assert.equal(await p.locator('#contact-message').inputValue(), '');
      await p.reload(); await p.waitForLoadState('networkidle');
      assert.equal(await p.locator('#contact-luggage').inputValue(), '0', 'Zero must not become absent');
      assert.equal(await p.locator('#contact-message').inputValue(), '', 'Deleted notes must not reappear');
      await p.locator('#contact-luggage').fill('');
      await p.locator('#contact-submit').click(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      await p.locator(pay).evaluate(n => { n.click(); n.click(); });
      await p.waitForURL(/checkout\.stripe\.com/);
      assert.equal(writes(t).length, 1, 'Double payment click is one checkout');
      const payload = writes(t)[0].payload;
      assert.equal(payload.airport_transfer_passenger_fare_key, 'van_3_4');
      assert(!Object.hasOwn(payload, 'airport_transfer_passengers'), 'Band is not an invented headcount');
      assert(!Object.hasOwn(payload, 'airport_transfer_luggage'), 'Absent luggage is not zero');
      row.checks.push('invalid contact, revocation, zero/absent luggage, deleted notes, Enter, double click, no invented headcount');
    });
    await runCase('history-language-resize', async (t, row) => {
      await review(t); const p = t.page;
      await p.evaluate(() => window.__formIdentity = document.querySelector('form[name=contact]'));
      await p.goBack(); await p.waitForURL(/#airport\/datos$/);
      await p.locator('#contact-name').fill('Nombre actual');
      await p.goForward(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      assert((await p.locator('.airport-booking').innerText()).includes('Nombre actual'));
      for (const width of [390, 1440]) {
        await p.setViewportSize({ width, height: 1000 }); await readyReview(t);
        assert(await p.evaluate(() => window.__formIdentity === document.querySelector('form[name=contact]')));
        assert.equal(await p.locator('form[name=contact]').count(), 1);
        assert.equal(await p.locator(pay).count(), 1);
      }
      for (const lang of ['en', 'es']) {
        await changeLanguage(t, lang); await readyReview(t);
        assert((await p.locator('.airport-booking').innerText()).includes('Nombre actual'));
      }
      assert.equal(writes(t).length, 0);
      row.screen = await shot(t, 'historial-idioma-resize');
    });
    await runCase('navigation-resume', async (t, row) => {
      await review(t); const p = t.page;
      const saved = await p.evaluate(k => JSON.parse(sessionStorage.getItem(k)), key);
      // Full-page Home and service links exercise storage ownership across documents.
      await p.locator('.airport-booking__identity a').click(); await p.waitForURL(base.origin + '/');
      await p.locator('[data-service-expand-trigger="hourly"]').click();
      await p.locator('[data-service-expand-trigger="airport"]').click();
      await p.waitForURL(/#airport\/revision$/, { timeout: 4000 });
      await readyReview(t);
      assert((await p.locator('.airport-booking').innerText()).includes(saved.name));
      assert.equal(writes(t).length, 0);
      row.screen = await shot(t, 'regreso-desde-otro-servicio');
    });
    await runCase('abandoned-review', async (t, row) => {
      await review(t); const p = t.page;
      let release;
      const gate = new Promise(r => release = r);
      let requested;
      const started = new Promise(r => requested = r);
      await t.context.route('**/*-availability-precheck', async r => { requested(); await gate; await r.fallback(); });
      await p.evaluate(() => {
        const until = window.PixkuyFleetSelection.airportOfferStatus().validUntil;
        Date.now = () => until + 1;
        window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
      });
      await started;
      await p.goBack(); await p.waitForURL(/#airport\/datos$/);
      await p.locator('#contact-name').fill('Edición posterior');
      release(); await p.waitForLoadState('networkidle');
      assert.equal(await p.locator('#contact-name').inputValue(), 'Edición posterior');
      assert.equal(p.url().split('#')[1], 'airport/datos');
      assert.equal(writes(t).length, 0);
      row.screen = await shot(t, 'respuesta-tardia-descartada');
    });
    await runCase('pending-edit', async (t, row) => {
      const expiry = await pending(t), p = t.page;
      row.pending = await shot(t, 'pendiente');
      await p.getByRole('button', { name: 'Modificar datos', exact: true }).click();
      await p.waitForURL(/#airport\/datos$/); await p.waitForLoadState('networkidle');
      assert(await p.locator('#contact-submit').isEnabled(), 'Valid restored data needs no fictional edit');
      assert(await p.locator(legal).isChecked());
      await p.locator('#contact-submit').click(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      assert.equal(writes(t).length, 1, 'Opening and reviewing pending reservation do not save');
      assert.equal(await p.evaluate(() => JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')).expiresAt), expiry);
      await p.goBack(); await p.waitForURL(/#airport\/datos$/);
      await p.locator('#contact-name').fill('Nombre editado');
      await p.locator('#contact-message').fill('Notas Airport permitidas');
      await p.locator('#contact-submit').click(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      const updates = [];
      await t.context.route('**/update-contact', async r => {
        updates.push({ payload: r.request().postDataJSON(), key: r.request().headers()['idempotency-key'] });
        await r.fulfill({ json: { bookingStatusToken: 'synthetic-audit-airport_transfer', checkoutUrl: 'https://checkout.stripe.com/c/pay/synthetic-existing-session' } });
      });
      await p.locator(pay).click(); await p.waitForURL(/checkout\.stripe\.com/);
      assert.equal(updates.length, 1); assert.equal(writes(t).length, 1, 'Contact edit must use existing update-contact contract');
      row.updates = updates; row.expiry = expiry;
    });
    await runCase('status-and-confirmation', async (t, row) => {
      await pending(t); const p = t.page;
      for (const mode of ['pending', 'inconsistent', 'confirmed']) {
        t.state.mode = mode;
        await p.goto(base.origin + '/booking-success.html?token=synthetic-audit-airport_transfer&status=confirmed&lang=es');
        await p.waitForFunction(() => window.__auditStatus?.result);
        await p.waitForLoadState('networkidle');
        const actual = await p.evaluate(() => window.__auditStatus.result.view);
        assert.equal(actual, mode === 'confirmed' ? 'confirmed' : 'pending');
        if (mode === 'confirmed') {
          assert.equal(await p.locator('[data-airport-pay]').count(), 0);
          assert.equal(await p.locator('[data-airport-deadline]').count(), 0);
          row.confirmed = await shot(t, 'confirmada');
          assert((await p.locator('.airport-booking').innerText()).includes('Duración estimada'), 'Desktop confirmation must identify valid estimated duration');
          await p.reload(); await p.waitForLoadState('networkidle');
          assert.equal(await p.evaluate(() => window.__auditStatus.result.view), 'confirmed');
        }
      }
    });
    await runCase('mobile-shared-regression', async (t, row) => {
      await review(t); const p = t.page;
      await p.reload(); await p.waitForLoadState('networkidle'); await readyReview(t);
      await p.goBack(); await p.waitForURL(/#airport\/datos$/);
      assert.equal(await p.locator('#contact-name').inputValue(), 'Persona Sintética');
      await p.locator(legal).uncheck();
      await p.locator('form[name=contact]').evaluate(f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(p.url().split('#')[1], 'airport/datos', 'Revoked mobile consent must not advance');
      await p.locator(legal).check(); await p.locator('#contact-submit').click(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      assert.equal(writes(t).length, 0);
      row.screen = await shot(t, 'movil-regresion');
    }, 390);
    await runCase('uncertain-checkout', async (t, row) => {
      await review(t); const p = t.page;
      t.state.checkout = 'lost';
      await p.locator(pay).evaluate(n => { n.click(); n.click(); });
      await p.waitForFunction(() => window.PixkuyFleetSelection.read('airport_transfer').attempt);
      await p.waitForLoadState('networkidle');
      const original = await p.evaluate(() => window.PixkuyFleetSelection.read('airport_transfer').attempt);
      assert.equal(writes(t).length, 1);
      await p.reload(); await p.waitForLoadState('networkidle');
      assert.equal(writes(t).length, 1, 'Reload must not automatically redispatch');
      assert.equal(await p.evaluate(() => window.PixkuyFleetSelection.read('airport_transfer').attempt.key), original.key);
      row.uncertain = await shot(t, 'intento-incierto');
      t.state.checkout = 'success';
      await p.getByRole('button', { name: await p.evaluate(() => window.PixkuyAirportDesktopView.t('recover')), exact: true }).click();
      await p.waitForURL(/checkout\.stripe\.com/);
      assert.equal(writes(t).length, 2, 'One initial send and one explicit replay');
      assert.equal(writes(t)[0].key, writes(t)[1].key, 'Same exact attempt');
      assert.deepEqual(writes(t)[0].payload, writes(t)[1].payload, 'Frozen original payload');
      row.checks.push('lost response: frozen payload/key, no automatic repeat, one explicit replay');
    });
    await runCase('access-expiry-and-status-error', async (t, row) => {
      const p = t.page;
      for (const mode of ['access_expired', 'network', 'hold_expired', 'inconsistent', 'confirmed']) {
        t.state.mode = mode;
        await p.goto(base.origin + '/booking-success.html?token=synthetic-access-only&status=confirmed');
        await p.waitForFunction(() => window.__auditStatus?.result);
        await p.waitForLoadState('networkidle');
        const result = await p.evaluate(() => window.__auditStatus.result);
        if (mode === 'access_expired') { assert(result.accessExpired); assert.equal(result.view, 'requestError'); }
        if (mode === 'network') assert.equal(result.view, 'requestError');
        if (mode === 'hold_expired') { assert.equal(result.view, 'expired'); assert.equal(await p.locator(pay).count(), 0); }
        if (mode === 'inconsistent') assert.equal(result.view, 'pending');
        if (mode === 'confirmed') { assert.equal(result.view, 'confirmed'); assert.equal(await p.locator(pay).count(), 0); }
        row.checks.push({ mode, view: result.view, screenshot: await shot(t, mode) });
      }
      assert.equal(writes(t).length, 0);
    });
    await runCase('pending-save-lost', async (t, row) => {
      const expiry = await pending(t), p = t.page;
      await p.getByRole('button', { name: 'Modificar datos', exact: true }).click();
      await p.waitForURL(/#airport\/datos$/); await p.waitForLoadState('networkidle');
      await p.locator('#contact-email').fill('updated@example.invalid');
      await p.locator('#contact-submit').click(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      assert.equal(await p.evaluate(() => JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')).expiresAt), expiry, 'Review does not renew');
      const updates = [];
      let lost = true;
      await t.context.route('**/update-contact', r => {
        updates.push({ payload: r.request().postDataJSON(), key: r.request().headers()['idempotency-key'], revision: r.request().headers()['x-pixkuy-edit-revision'] });
        return lost ? r.abort('failed') : r.fulfill({ json: { bookingStatusToken: 'synthetic-audit-airport_transfer', checkoutUrl: 'https://checkout.stripe.com/c/pay/synthetic-renewed-session' } });
      });
      await p.locator(pay).click();
      await p.getByRole('button', { name: await p.evaluate(() => window.PixkuyAirportDesktopView.t('recoverSave')), exact: true }).waitFor();
      assert.equal(updates.length, 1);
      await p.reload(); await p.waitForLoadState('networkidle');
      assert.equal(updates.length, 1);
      lost = false;
      await p.getByRole('button', { name: await p.evaluate(() => window.PixkuyAirportDesktopView.t('recoverSave')), exact: true }).click();
      await p.waitForURL(/checkout\.stripe\.com/);
      assert.equal(updates.length, 2); assert.deepEqual(updates[0], updates[1]);
      assert.equal(writes(t).length, 1, 'Editing does not create another reservation');
      row.checks.push('email proposal does not renew; lost save replays exact key/revision/payload; server response owns destination');
    });
    await runCase('cross-service-draft', async (t, row) => {
      await review(t); const p = t.page;
      await p.goto(base.origin + '/?service=hourly_daily#contact');
      await p.waitForLoadState('networkidle');
      row.owner = await p.locator('form[name=contact]').evaluate(f => ({
        service: f.elements.namedItem('service_type').value,
        name: f.elements.namedItem('name').value,
        email: f.elements.namedItem('email').value,
        airportConsent: !!window.PixkuyForms.LegalAcceptance.readEvidence(f, 'web_airport_checkout')
      }));
      assert.notEqual(row.owner.name, 'Persona Sintética', 'Background Airport draft must not claim contact on a different service');
      assert.equal(row.owner.airportConsent, false);
      assert.equal(writes(t).length, 0);
    });
    for (const outcome of ['stale', 'unavailable', 'paid', 'expired']) await runCase('pending-' + outcome, async (t, row) => {
      await pending(t); const p = t.page;
      await p.getByRole('button', { name: 'Modificar datos', exact: true }).click();
      await p.waitForURL(/#airport\/datos$/); await p.waitForLoadState('networkidle');
      await p.locator('#contact-email').fill('updated@example.invalid');
      if (outcome === 'expired') {
        await p.evaluate(() => {
          const c = JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1'));
          const end = c.receivedAt + Date.parse(c.expiresAt) - Date.parse(c.serverNow);
          Date.now = () => end + 1;
        });
        await p.locator('form[name=contact]').evaluate(f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(p.url().split('#')[1], 'airport/datos');
        assert.equal(writes(t).length, 1);
        row.screen = await shot(t, 'edicion-caducada');
        return;
      }
      await p.locator('#contact-submit').click(); await p.waitForURL(/#airport\/revision$/); await readyReview(t);
      const updates = [];
      await t.context.route('**/update-contact', r => {
        updates.push(r.request().postDataJSON());
        if (outcome === 'paid') {
          t.state.mode = 'confirmed';
          return r.fulfill({ status: 409, json: { code: 'CHECKOUT_ALREADY_COMPLETED', recovery: { state: 'authoritative_status', action: 'reservation_status' } } });
        }
        return r.fulfill({ status: 409, json: { code: outcome === 'stale' ? 'CHECKOUT_REPLACEMENT_STALE' : 'NO_AVAILABILITY', recovery: { state: 'not_committed' } } });
      });
      await p.locator(pay).click();
      if (outcome === 'paid') {
        await p.waitForURL(/booking-success\.html/);
        await p.waitForFunction(() => window.__auditStatus?.result.view === 'confirmed');
        assert.equal(await p.locator(pay).count(), 0);
      } else {
        await p.getByRole('button', { name: await p.evaluate(() => window.PixkuyAirportDesktopView.t('recover')), exact: true }).waitFor();
        assert.equal(await p.evaluate(() => !!JSON.parse(sessionStorage.getItem('pixkuy_airport_pending_edit_v1')).attempt), false, 'Known rejection is not an uncertain dispatched replacement');
        assert(!p.url().includes('checkout.stripe.com'));
      }
      assert.equal(updates.length, 1); assert.equal(writes(t).length, 1);
      row.screen = await shot(t, 'guardar-' + outcome);
    });
    await runCase('confirmation-languages', async (t, row) => {
      const p = t.page; let duration = 79 / 60;
      await t.context.route('**/v1/public/reservations/status*', r => {
        const body = base.statusBody('airport_transfer', 'confirmed');
        body.reservation.durationHours = duration;
        return r.fulfill({ json: body });
      });
      for (const lang of ['es', 'en', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh-hans']) {
        await p.goto(base.origin + '/booking-success.html?token=synthetic-language&lang=' + lang);
        await p.waitForLoadState('networkidle');
        const label = await p.evaluate(() => window.PixkuyAirportDesktopView.t('estimatedDuration'));
        const text = await p.locator('.airport-booking--result').innerText();
        assert(text.includes(label) && label !== 'estimatedDuration');
        assert.equal(await p.locator(pay).count(), 0);
        row.checks.push({ lang, label });
      }
      for (duration of [null, '79', -1]) {
        await p.reload(); await p.waitForLoadState('networkidle');
        const label = await p.evaluate(() => window.PixkuyAirportDesktopView.t('estimatedDuration'));
        assert(!(await p.locator('.airport-booking--result').innerText()).includes(label));
      }
      assert.equal(writes(t).length, 0);
    });
  } finally {
    await browser.close();
    const finalResources = [];
    for (const [localPath, initial] of expectedResources) {
      const expectedSha256 = await initial;
      const finalSha256 = digest(await fs.readFile(localPath));
      finalResources.push({ localPath, expectedSha256, finalSha256, unchanged: expectedSha256 === finalSha256 });
    }
    await fs.writeFile(path.join(base.output, 'local-resources.json'), JSON.stringify(finalResources, null, 2));
    if (finalResources.some(resource => !resource.unchanged)) process.exitCode = 1;
    await fs.writeFile(path.join(base.output, 'results.json'), JSON.stringify(rows, null, 2));
    await fs.writeFile(path.join(base.output, 'served-hashes.json'), JSON.stringify([...base.resources], null, 2));
  }
  if (!before && rows.some(r => r.result === 'FAIL')) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
