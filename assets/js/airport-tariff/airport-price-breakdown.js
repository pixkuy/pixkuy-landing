(function (window, document) {
    'use strict';
    var dictionaries = {}, requests = {};
    var fallback = { "base": "Base transfer", "waiting": "Waiting", "parking": "Parking", "total": "Total", "tax": "MXN · VAT included", "minutes": "Estimated parking: {minutes} min", "terminal": "Terminal / parking", "termsChanged": "Your fare terms have changed. Review the breakdown and accept to continue.", "accept": "Accept fare and terms", "previous": "Previous", "updated": "Updated", "selectTerminal": "Select terminal", "configurationUnavailable": "Parking configuration is incomplete for this pickup." };
    function locale() { var lang = (document.documentElement.lang || 'es').toLowerCase(); return lang.indexOf('zh') === 0 ? 'zh-hans' : lang.split('-')[0]; }
    function dictionary() { return dictionaries[locale()] || fallback; }
    function load() { var lang = locale(); if (!requests[lang])
        requests[lang] = window.fetch('assets/i18n/' + lang + '/airport-desktop-booking.json').then(function (r) { if (!r.ok)
            throw new Error('COPY_UNAVAILABLE'); return r.json(); }).then(function (v) { if (v.airportPrice)
            dictionaries[lang] = v.airportPrice; }).catch(function () { }); return requests[lang]; }
    function valid(v) { return !!v && (v.schemaVersion === 2 || v.schemaVersion === 3) && v.currency === 'MXN' && v.taxIncluded === true && ['baseAmountMinor', 'waitingAmountMinor', 'parkingCustomerMinor', 'totalAmountMinor'].every(function (k) { return Number.isSafeInteger(v[k]) && v[k] >= 0; }) && v.baseAmountMinor + v.waitingAmountMinor + v.parkingCustomerMinor === v.totalAmountMinor; }
    function text(key) { return dictionary()[key] || fallback[key] || ''; }
    // Public fares show one total. Composition remains available only for binding and validation.
    function render(host) { if (!host) return; host.replaceChildren(); host.hidden = true; }
    function append(parent) { if (parent) parent.querySelectorAll('[data-airport-price-breakdown]').forEach(function (host) { host.remove(); }); return null; }
    window.PixkuyAirportPriceBreakdown = { render: render, append: append, valid: valid, text: text, ready: load };
    load();
})(window, document);
