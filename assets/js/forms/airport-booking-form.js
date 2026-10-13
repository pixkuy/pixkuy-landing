(function (window, document) {
  'use strict';
  // Airport owns contact controls and a trip record. Configuration is never an
  // editor hidden in the Netlify form; raw aliases only preserve checkout drafts.
  var form = document.createElement('form'), home = document.createElement('div');
  var trip = {}, hydrated = false;
  form.id = 'airport-booking-form'; form.name = 'airport-booking'; form.className = 'form'; form.noValidate = true;
  home.hidden = true; home.appendChild(form); document.body.appendChild(home);
  var error = document.createElement('p');
  error.id = 'airport-booking-error'; error.className = 'form-error'; error.hidden = true; error.setAttribute('role', 'alert'); form.appendChild(error);
  var grid = document.createElement('div'); grid.className = 'form-grid'; form.appendChild(grid);
  function copy(path) { return path.split('.').reduce(function (v, k) { return v && v[k]; }, window.__pixkuyI18nDict) || ''; }
  function text(value) { return value == null ? '' : String(value).trim(); }
  function field(name, type, key) {
    var wrap = document.createElement('div'), label = document.createElement('label');
    var input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    wrap.className = 'form-field'; label.className = 'visually-hidden';
    input.id = 'airport-contact-' + name; input.name = name; label.htmlFor = input.id;
    label.setAttribute('data-i18n', key); input.setAttribute('data-i18n-ph', key);
    input.autocomplete = {name:'name', phone:'tel', email:'email'}[name] || 'off';
    if (type === 'textarea') input.rows = 4;
    else { input.type = type; input.required = name !== 'luggage'; }
    if (name === 'phone') { input.inputMode = 'tel'; input.maxLength = 16; input.autocapitalize = 'off'; input.spellcheck = false; input.pattern = '^\\+[1-9]\\d{6,14}$'; }
    if (name === 'luggage') { input.min = '0'; input.step = '1'; input.inputMode = 'numeric'; }
    wrap.append(label, input);
    if (type !== 'textarea') {
      var message = document.createElement('p'); message.id = input.id + '-error'; message.className = 'form-error'; message.hidden = true;
      message.setAttribute('data-error-for', name); message.setAttribute('data-i18n', 'contact.validation.' + name + 'Required');
      input.setAttribute('aria-describedby', message.id); wrap.appendChild(message);
    }
    if (name === 'luggage') { var row = document.createElement('div'); row.className = 'form-row form-row--two'; row.appendChild(wrap); grid.appendChild(row); }
    else grid.appendChild(wrap);
  }
  field('name', 'text', 'contact.name'); field('phone', 'tel', 'contact.phone'); field('email', 'email', 'contact.email');
  field('luggage', 'number', 'contact.luggage'); field('message', 'textarea', 'contact.notes');
  var actions = document.createElement('div'), submit = document.createElement('button');
  actions.className = 'form-actions'; submit.id = 'airport-contact-submit'; submit.type = 'submit'; submit.className = 'cta';
  submit.setAttribute('data-i18n', 'contact.submit'); actions.appendChild(submit); grid.appendChild(actions);
  Object.values(window.PixkuyForms.LegalAcceptance.fieldNames).forEach(function (name) {
    var input = document.createElement('input'); input.type = 'hidden'; input.name = name; form.appendChild(input);
  });
  function fields() {
    var result = {form:form, formError:error, submit:submit};
    Array.from(form.elements).forEach(function (input) { if (input.name) result[input.name.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); })] = input; });
    return result;
  }
  function phone(value) { try { return window.libphonenumber?.parsePhoneNumberFromString(text(value).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')); } catch (_) { return null; } }
  function data() {
    var value = Object.assign({}, trip, {serviceType:'airport_hotel'});
    ['name','phone','email','luggage'].forEach(function (key) { value[key] = text(form.elements.namedItem(key).value); });
    var parsed = phone(value.phone); if (parsed?.isValid()) value.phone = parsed.number;
    value.notes = text(form.elements.namedItem('message').value); value.message = value.notes;
    return value;
  }
  function validContext() {
    var value = data(), side = value.direction === 'hotel_to_airport' ? 'origin' : 'destination';
    return !!(value.airportId && /^(airport_to_hotel|hotel_to_airport)$/.test(value.direction) &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.airportHotelDate || '') && /^\d{2}:\d{2}$/.test(value.airportHotelTime || '') &&
      /^(van_1_2|van_3_4|van_5_6)$/.test(value.passengerFareKey || '') && value.zone && Number(value.fare) > 0 &&
      value.origin && value.destination && value[side + 'PlaceId'] &&
      text(value[side + 'Lat']) !== '' && text(value[side + 'Lng']) !== '' &&
      Number.isFinite(Number(value[side + 'Lat'])) && Number.isFinite(Number(value[side + 'Lng'])));
  }
  function validate(show) {
    var value = data(), parsed = phone(value.phone);
    var checks = {name:!!value.name, phone:/^\+[1-9]\d{6,14}$/.test(value.phone) && !!parsed?.isValid(),
      email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email), luggage:value.luggage === '' || /^\d+$/.test(value.luggage)};
    Object.keys(checks).forEach(function (name) {
      var input = form.elements.namedItem(name); input.setCustomValidity(checks[name] ? '' : copy('contact.validation.' + name + 'Required'));
      if (show || checks[name]) { input.setAttribute('aria-invalid', String(!checks[name])); form.querySelector('[data-error-for="' + name + '"]').hidden = checks[name]; }
    });
    return Object.values(checks).every(Boolean) && validContext();
  }
  function snapshot() {
    return Object.assign({}, trip, {hotel:trip.direction === 'hotel_to_airport' ? trip.origin : trip.destination,
      zoneId:trip.zone, serviceDate:trip.airportHotelDate, serviceTime:trip.airportHotelTime, lodgingEndpointSide:trip.direction === 'hotel_to_airport' ? 'origin' : 'destination',
      lodgingPlaceId:trip[trip.direction === 'hotel_to_airport' ? 'originPlaceId' : 'destinationPlaceId'],
      lodgingLat:trip[trip.direction === 'hotel_to_airport' ? 'originLat' : 'destinationLat'],
      lodgingLng:trip[trip.direction === 'hotel_to_airport' ? 'originLng' : 'destinationLng']});
  }
  function raw() {
    var value = data(), result = {};
    // These aliases are a serialization contract, not hidden legacy controls.
    Object.keys(value).forEach(function (key) { if (value[key] != null) result[key.replace(/[A-Z]/g, function (c) { return '_' + c.toLowerCase(); })] = String(value[key]); });
    Object.assign(result, {airport_hotel_direction:value.direction || '', airport_hotel_airport:value.airportId || '',
      airport_hotel_hotel:snapshot().hotel || '', airport_hotel_date:value.airportHotelDate || '', airport_hotel_time:value.airportHotelTime || '',
      airport_hotel_direction_label:value.directionLabel || '', airport_hotel_airport_label:value.airportLabel || '',
      airport_hotel_hotel_label:snapshot().hotel || '', airport_hotel_zone_label:value.zoneLabel || '',
      airport_hotel_fare_label:value.fareLabel || '', airport_hotel_passenger_bucket_label:value.passengerBucketLabel || '',
      message:value.notes, trip_date:value.airportHotelDate || '', trip_time:value.airportHotelTime || ''});
    new window.FormData(form).forEach(function (v, k) { if (typeof v === 'string') result[k] = v; });
    return result;
  }
  function setTrip(value) {
    var direction = value.airport_transfer_direction === 'destination_to_airport' || (value.airport_hotel_direction || value.direction) === 'hotel_to_airport' ? 'hotel_to_airport' : 'airport_to_hotel';
    var side = direction === 'hotel_to_airport' ? 'origin' : 'destination';
    var location = value.airport_transfer_non_airport_location || {};
    var hotel = text(value.airport_transfer_destination_label || value.airport_hotel_hotel || value.hotel || location.address || value[side]);
    var airportLabel = text(value.airport_transfer_airport_label || value.airport_hotel_airport_label || value.airportLabel || value.airport || value[direction === 'hotel_to_airport' ? 'destination' : 'origin']);
    trip = {direction:direction, airportId:text(value.airport_transfer_airport_id || value.airportId), airportLabel:airportLabel,
      origin:direction === 'hotel_to_airport' ? hotel : airportLabel, destination:direction === 'hotel_to_airport' ? airportLabel : hotel,
      airportHotelDate:text(value.airport_transfer_date || value.airport_hotel_date || value.serviceDate),
      airportHotelTime:text(value.airport_transfer_time || value.airport_hotel_time || value.serviceTime),
      zone:text(value.airport_transfer_zone_id || value.zoneId), zoneLabel:text(value.airport_transfer_zone_label || value.airport_hotel_zone_label || value.zoneLabel),
      fare:text(value.fare ?? (Number.isSafeInteger(value.airport_desktop_amount_minor) ? value.airport_desktop_amount_minor / 100 : value.airport_transfer_price) ?? ''), fareLabel:text(value.airport_transfer_price_label || value.airport_hotel_fare_label || value.fareLabel),
      passengerFareKey:text(value.airport_transfer_passenger_fare_key || value.passenger_fare_key || value.passengerFareKey),
      passengerBucketLabel:text(value.airport_transfer_passenger_bucket_label || value.airport_hotel_passenger_bucket_label || value.passengerBucketLabel),
      directionLabel:text(value.airport_transfer_direction_label || value.airport_hotel_direction_label || value.directionLabel), lodgingPrimaryType:text(value.lodgingPrimaryType)};
    ['origin','destination'].forEach(function (name) { ['PlaceId','Lat','Lng'].forEach(function (key) { trip[name + key] = ''; }); });
    trip[side + 'PlaceId'] = text(location.place_id ?? value.lodgingPlaceId ?? value['airport_transfer_' + side + '_place_id'] ?? value[side + '_place_id'] ?? '');
    trip[side + 'Lat'] = text(location.lat ?? value.lodgingLat ?? value['airport_transfer_' + side + '_lat'] ?? value[side + '_lat'] ?? '');
    trip[side + 'Lng'] = text(location.lng ?? value.lodgingLng ?? value['airport_transfer_' + side + '_lng'] ?? value[side + '_lng'] ?? '');
    hydrated = true;
    translate();
  }
  function restoreContact(value) {
    ['name','phone','email'].forEach(function (key) { form.elements.namedItem(key).value = text(value[key]); });
    form.elements.namedItem('message').value = text(value.message ?? value.notes ?? value.airport_transfer_notes);
    form.elements.namedItem('luggage').value = text(value.luggage ?? value.airport_transfer_luggage);
    var legal = window.PixkuyForms.LegalAcceptance;
    Object.values(legal.fieldNames).forEach(function (key) { form.elements.namedItem(key).value = text(value[key]); });
    var proof = legal.readEvidence(form, 'web_airport_checkout');
    if (!proof) legal.clearFields(form);
    var host = form.querySelector('[data-airport-transfer-checkout-legal-acceptance]');
    if (host?.__pixkuyLegalAcceptanceInstance) host.__pixkuyLegalAcceptanceInstance.restore(proof);
    return true;
  }
  function notifyContext() { document.dispatchEvent(new window.CustomEvent('pixkuy:airport-context-changed')); }
  function restore(value) { if (!value) return false; setTrip(value); restoreContact(value); notifyContext(); return true; }
  function fromPanel(state, summary, passengerLabel) {
    var toAirport = state.originType !== 'airport';
    setTrip({direction:toAirport ? 'hotel_to_airport' : 'airport_to_hotel', airportId:toAirport ? state.destinationValue : state.originValue,
      airportLabel:toAirport ? summary.destination : summary.origin, hotel:state.lodgingEndpointLabel,
      zoneId:state.lodgingEndpointZoneId || state.resolvedZoneId, zoneLabel:summary.zone,
      fare:text(summary.fare).replace(/[^\d.]/g, ''), fareLabel:summary.fare,
      serviceDate:state.serviceDate, serviceTime:state.serviceTime, passengerFareKey:state.selectedFareKey, passengerBucketLabel:passengerLabel,
      lodgingPlaceId:state.lodgingEndpointPlaceId, lodgingLat:state.lodgingEndpointLat, lodgingLng:state.lodgingEndpointLng, lodgingPrimaryType:state.lodgingEndpointPrimaryType});
    var luggage = document.querySelector('[data-airport-mobile-luggage-select]');
    if (window.matchMedia('(max-width:720px)').matches && luggage) form.elements.namedItem('luggage').value = luggage.value;
    notifyContext();
    return validContext();
  }
  function translate() {
    if (hydrated) {
      var toAirport = trip.direction === 'hotel_to_airport';
      trip.directionLabel = copy('airportMobileContactStep.summary.' + (toAirport ? 'directionHotelToAirport' : 'directionAirportToHotel')) || trip.directionLabel;
      trip.zoneLabel = window.PixkuyAirportTariffCatalog?.resolveDisplayLabel('zone', trip.zone) || trip.zoneLabel;
      trip.passengerBucketLabel = window.PixkuyAirportTariffUtils?.resolveFareKeyDisplayLabel(trip.passengerFareKey) || trip.passengerBucketLabel;
    }
    form.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = copy(node.getAttribute('data-i18n')); });
    form.querySelectorAll('[data-i18n-ph]').forEach(function (node) { node.placeholder = copy(node.getAttribute('data-i18n-ph')); });
  }
  form.addEventListener('submit', function (event) { event.preventDefault(); });
  form.addEventListener('input', function () { error.hidden = true; validate(false); });
  form.addEventListener('blur', function (event) { if (event.target.name === 'phone') { var parsed = phone(event.target.value); if (parsed?.isValid()) event.target.value = parsed.number; } validate(true); }, true);
  window.addEventListener('pixkuy:i18n-applied', translate); translate();
  window.PixkuyAirportBookingForm = {getReservationForm:function () { return form; }, home:home,
    getReservationRequestFields:fields, getReservationRequestData:data, getSnapshot:snapshot, raw:raw,
    refreshReservationRequestValidationUX:function () { return validate(true); }, syncReservationRequestState:function () { return validate(false); },
    validContext:validContext, restore:restore, restoreContact:restoreContact, fromPanel:fromPanel, hydrated:function () { return hydrated; },
    acceptPrice:function (amountMinor) { trip.fare = String(amountMinor / 100); trip.fareLabel = trip.fare + ' MXN'; }};
})(window, document);
