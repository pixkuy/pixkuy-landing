'use strict';
// Directed case in the existing local browser runner. HTTP offers are controlled;
// checkout, reservations, payment sessions and external providers remain blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = require('./mobile-booking-audit.cjs');
const fixtures = require('./airport-controlled-fixtures.cjs');
const beforeFix = process.argv.includes('--before-fix');
const reloadAccepted = process.argv.includes('--reload');
const trace = [], violations = [];
let amount = 70000, number = 0;

async function state(page) {
  return page.evaluate(() => ({
    route: location.hash,
    draft: window.PixkuyAirportCheckout.draft(),
    offer: window.PixkuyFleetSelection.airportOfferStatus(),
    contextKey: window.PixkuyAirportZoneTariff.fleetContextKey(),
    calls: window.__priceAcceptanceTrace,
    text: document.querySelector('[data-airport-desktop-booking]')?.innerText || document.body.innerText,
  }));
}
async function main() {
  await fs.mkdir(base.output, { recursive: true });
  const browser = await base.launchChrome(); base.setBrowser(browser);
  let t;
  try {
    t = await base.setup(1440, 'airport_transfer');
    await t.context.route('**/v1/**', async route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.endsWith('/airport-transfer-availability-precheck')) {
        if (['GET', 'HEAD'].includes(req.method())) return route.fallback();
        violations.push({ method: req.method(), path: url.pathname });
        return route.abort();
      }
      const payload = req.postDataJSON();
      const row = { at: new Date().toISOString(), payload, httpStatus: 200, actualAmountMinor: amount };
      trace.push(row);
      const mismatch = payload.expectedAmountMinor !== amount;
      const body = mismatch ? { status: 'ok', result: {
        ...payload, checkoutAllowed: false,
        price: { available: false, reason: 'AIRPORT_TRANSFER_PRICE_MISMATCH', expectedAmountMinor: payload.expectedAmountMinor, actualAmountMinor: amount },
      } } : fixtures.precheck(payload, { models: [base.model], requestNumber: ++number, available: true });
      if (!mismatch) Object.assign(body.result.price, { currency: 'MXN', quoteExpiresAt: new Date(Date.now() + 300000).toISOString() });
      row.response = body;
      return route.fulfill({ status: 200, json: body });
    });
    const p = t.page;
    await p.goto(base.origin + '/?service=airport_hotel&lang=es');
    await p.waitForFunction(() => window.PixkuyAirportZoneTariff && window.PixkuyAirportDesktopBooking);
    await p.locator('[data-consent-reject]').click({ timeout: 900 }).catch(() => {});
    await p.evaluate(() => {
      window.__priceAcceptanceTrace = [];
      const fleet = window.PixkuyFleetSelection, fetch = fleet.fetchPrecheck;
      fleet.fetchPrecheck = function (service, url, init, options) {
        const row = { expected: JSON.parse(init.body).expectedAmountMinor, key: options?.fleetContextKey };
        window.__priceAcceptanceTrace.push(row);
        return fetch.apply(this, arguments).then(value => { row.after = fleet.airportOfferStatus(); return value; }, error => { row.error = error.message; throw error; });
      };
      const checkout = window.PixkuyAirportCheckout, prepare = checkout.prepare;
      checkout.prepare = function () {
        return prepare.apply(this, arguments).catch(error => {
          window.__priceAcceptanceTrace.push({ prepareError: error.message, result: error.result }); throw error;
        });
      };
      const a = window.PixkuyAirportZoneTariff;
      a.setAirportSelection({ airportId: 'mex', direction: 'airport_to_hotel' });
      a.setResolvedDestination({ placeLabel: 'Blvd. Puerto Aéreo 502', zoneId: 'aeropuerto_oriente', placeId: 'controlled-place-airport-east', primaryType: 'street_address', lat: 19.4207, lng: -99.0887 });
      a.setFareKeySelection({ fareKey: 'van_1_2' });
    });
    await p.locator('#airport-tariff-date').fill('2026-11-26');
    await p.locator('#airport-tariff-time').fill('10:00');
    await p.locator('#airport-tariff-time').dispatchEvent('change');
    await p.waitForFunction(() => window.PixkuyFleetSelection.airportOfferStatus().valid);
    await p.locator(base.configCta('airport_transfer')).click();
    await p.waitForURL(/#airport\/datos$/);
    await p.locator('#airport-contact-name').fill('Persona Sintética');
    await p.locator('#airport-contact-phone').fill('+525512345678');
    await p.locator('#airport-contact-email').fill('acceptance@example.invalid');
    await p.locator('#airport-contact-message').fill('Conservar estos datos tras aceptar el precio');
    await p.locator('#pixkuy-airport-transfer-legal-acceptance').check();
    await p.locator('#airport-contact-submit').click();
    await p.waitForURL(/#airport\/revision$/);
    const original = await state(p);
    assert.equal(Number(original.draft.airport_transfer_price), 700);
    amount = 71000;
    await p.locator('[data-airport-pay]').click();
    await p.getByRole('button', { name: 'Aceptar nueva oferta', exact: true }).waitFor();
    await p.getByRole('button', { name: 'Aceptar nueva oferta', exact: true }).click();
    await p.waitForURL(/#airport\/datos$/);
    const accepted = await state(p);
    let restored;
    if (!beforeFix && reloadAccepted) {
      await p.reload();
      await p.locator('#airport-contact-name').waitFor({ state: 'visible' });
      restored = await state(p);
      assert.equal(Number(restored.draft.airport_transfer_price), 710);
    }
    await p.locator('#airport-contact-submit').click();
    if (beforeFix) {
      await p.getByText('No hemos podido comprobar la disponibilidad. Sus datos siguen guardados. Puede reintentar la comprobación.', { exact: true }).waitFor();
    } else {
      await p.waitForURL(/#airport\/revision$/);
      await p.waitForFunction(() => window.PixkuyFleetSelection.airportOfferStatus().valid && !document.querySelector('[data-airport-pay]').disabled);
    }
    const recovered = await state(p);
    const checks = [];
    if (!beforeFix) {
      assert.equal(Number(recovered.draft.airport_transfer_price), 710);
      for (const field of ['name', 'phone', 'email', 'message', 'airport_transfer_date', 'airport_transfer_time', 'airport_transfer_passenger_fare_key', 'airport_transfer_destination', 'destination_place_id', 'destination_lat', 'destination_lng', 'legal_acceptance_accepted', 'legal_acceptance_terms_version']) {
        assert.notEqual(original.draft[field], undefined, field);
        assert.deepEqual(recovered.draft[field], original.draft[field], field);
        if (restored) assert.deepEqual(restored.draft[field], original.draft[field], 'restored ' + field);
      }
      assert.equal(await p.locator('#pixkuy-airport-transfer-legal-acceptance').isChecked(), true);
      await p.screenshot({ path: path.join(base.output, (reloadAccepted ? 'after-fix-reload' : 'after-fix') + '-review-710.png') });
      checks.push('700 -> explicit 710 -> Datos -> ' + (reloadAccepted ? 'reload -> ' : '') + 'availability -> Review 710; contact, trip, notes and legal preserved');
      amount = 72000;
      await p.locator('[data-airport-pay]').click();
      await p.getByRole('button', { name: 'Aceptar nueva oferta', exact: true }).waitFor();
      assert.equal(Number((await state(p)).draft.airport_transfer_price), 710);
      assert.equal(violations.length, 0);
      checks.push('Further 720 requires separate consent; no checkout dispatched');
    }
    assert.equal(violations.length, 0, 'No booking/payment/other API requests permitted');
    const result = { mode: beforeFix ? 'before-fix' : reloadAccepted ? 'after-fix-reload' : 'after-fix', origin: base.origin, controlledHttp: true, sqlWrites: 0, original, accepted, restored, recovered, final: await state(p), trace, violations, errors: t.state.errors, checks };
    await fs.writeFile(path.join(base.output, result.mode + '.json'), JSON.stringify(result, null, 2));
    await p.screenshot({ path: path.join(base.output, result.mode + '.png') });
    console.log(JSON.stringify({ mode: result.mode, route: recovered.route, offerValid: recovered.offer.valid, traceCount: trace.length, checks, violations }));
  } catch (error) {
    if (t) await fs.writeFile(path.join(base.output, 'failure.json'), JSON.stringify({ message: error.message, state: await state(t.page), trace, violations }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
