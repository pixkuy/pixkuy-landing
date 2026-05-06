(function (window, document) {
  'use strict';

  function getReservationForm() {
    return document.querySelector('form[name="contact"]');
  }

  function getReservationRequestFields(form) {
    if (!form) return null;

    return {
      form: form,
      name: form.querySelector('input[name="name"]'),
      phone: form.querySelector('input[name="phone"]'),
      email: form.querySelector('input[name="email"]'),
      tripDate: form.querySelector('input[name="trip_date"]'),
      tripTime: form.querySelector('input[name="trip_time"]'),
           origin: form.querySelector('input[name="origin"]'),
      destination: form.querySelector('input[name="destination"]'),

      originPlaceId: form.querySelector('input[name="origin_place_id"]'),
      originLat: form.querySelector('input[name="origin_lat"]'),
      originLng: form.querySelector('input[name="origin_lng"]'),

      destinationPlaceId: form.querySelector('input[name="destination_place_id"]'),
      destinationLat: form.querySelector('input[name="destination_lat"]'),
      destinationLng: form.querySelector('input[name="destination_lng"]'),
      serviceType: form.querySelector('input[name="service_type"]'),
      zone: form.querySelector('input[name="zone"]'),
      fare: form.querySelector('input[name="fare"]'),
      airportHotelDate: form.querySelector('input[name="airport_hotel_date"]'),
      airportHotelTime: form.querySelector('input[name="airport_hotel_time"]'),
      passengerFareKey: form.querySelector('input[name="passenger_fare_key"]'),

      tourPrivateTourId: form.querySelector('input[name="tour_private_tour_id"]'),
      tourPrivateTourLabel: form.querySelector('input[name="tour_private_tour_label"]'),
      tourPrivateDurationHours: form.querySelector('input[name="tour_private_duration_hours"]'),
      tourPrivatePassengerFareKey: form.querySelector('input[name="tour_private_passenger_fare_key"]'),
      tourPrivatePassengerBucketLabel: form.querySelector('input[name="tour_private_passenger_bucket_label"]'),
      tourPrivatePickup: form.querySelector('input[name="tour_private_pickup"]'),
      tourPrivatePickupPlaceId: form.querySelector('input[name="tour_private_pickup_place_id"]'),
      tourPrivatePickupLat: form.querySelector('input[name="tour_private_pickup_lat"]'),
      tourPrivatePickupLng: form.querySelector('input[name="tour_private_pickup_lng"]'),
      tourPrivateDate: form.querySelector('input[name="tour_private_date"]'),
      tourPrivateTime: form.querySelector('input[name="tour_private_time"]'),
      tourPrivateHasGuide: form.querySelector('input[name="tour_private_has_guide"]'),
      tourPrivateGuideLanguage: form.querySelector('input[name="tour_private_guide_language"]'),
      tourPrivatePrice: form.querySelector('input[name="tour_private_price"]'),
      tourPrivateCurrency: form.querySelector('input[name="tour_private_currency"]'),

      hourlyDailyVisiblePickup: form.querySelector('[data-contact-hourly-daily-pickup]'),
      hourlyDailyVisibleDate: form.querySelector('[data-contact-hourly-daily-date]'),
      hourlyDailyVisibleTime: form.querySelector('[data-contact-hourly-daily-time]'),

      hourlyDailyMode: form.querySelector('input[name="hourly_daily_mode"]'),
      hourlyDailyVehicleType: form.querySelector('input[name="hourly_daily_vehicle_type"]'),
      hourlyDailyPickup: form.querySelector('input[name="hourly_daily_pickup"]'),
      hourlyDailyPickupPlaceId: form.querySelector('input[name="hourly_daily_pickup_place_id"]'),
      hourlyDailyPickupLat: form.querySelector('input[name="hourly_daily_pickup_lat"]'),
      hourlyDailyPickupLng: form.querySelector('input[name="hourly_daily_pickup_lng"]'),
      hourlyDailyDate: form.querySelector('input[name="hourly_daily_date"]'),
      hourlyDailyStartTime: form.querySelector('input[name="hourly_daily_start_time"]'),
      hourlyDailyDurationHours: form.querySelector('input[name="hourly_daily_duration_hours"]'),
      hourlyDailyCustomTerm: form.querySelector('input[name="hourly_daily_custom_term"]'),
      hourlyDailyNotes: form.querySelector('input[name="hourly_daily_notes"]'),
      hourlyDailyPrice: form.querySelector('input[name="hourly_daily_price"]'),
      hourlyDailyCurrency: form.querySelector('input[name="hourly_daily_currency"]'),

      eventSpecialEventId: form.querySelector('input[name="event_special_event_id"]'),
      eventSpecialVariant: form.querySelector('input[name="event_special_variant"]'),
      eventSpecialOriginAddress: form.querySelector('input[name="event_special_origin_address"]'),
      eventSpecialOriginPlaceId: form.querySelector('input[name="event_special_origin_address_place_id"]'),
      eventSpecialDestinationAddress: form.querySelector('input[name="event_special_destination_address"]'),
      eventSpecialDestinationPlaceId: form.querySelector('input[name="event_special_destination_address_place_id"]'),
      eventSpecialOriginPickupTime: form.querySelector('input[name="event_special_origin_pickup_time"]'),
      eventSpecialReturnPickupTime: form.querySelector('input[name="event_special_return_pickup_time"]'),
      eventSpecialPassengerFareKey: form.querySelector('input[name="event_special_passenger_fare_key"]'),
      eventSpecialPrice: form.querySelector('input[name="event_special_price"]'),
      eventSpecialCurrency: form.querySelector('input[name="event_special_currency"]'),

      directTransferOriginAddress: form.querySelector('input[name="direct_transfer_origin_address"]'),
      directTransferOriginPlaceId: form.querySelector('input[name="direct_transfer_origin_place_id"]'),
      directTransferDestinationAddress: form.querySelector('input[name="direct_transfer_destination_address"]'),
      directTransferDestinationPlaceId: form.querySelector('input[name="direct_transfer_destination_place_id"]'),
      directTransferDate: form.querySelector('input[name="direct_transfer_date"]'),
      directTransferTime: form.querySelector('input[name="direct_transfer_time"]'),
      directTransferPassengerFareKey: form.querySelector('input[name="direct_transfer_passenger_fare_key"]'),
      directTransferPrice: form.querySelector('input[name="direct_transfer_price"]'),
      directTransferCurrency: form.querySelector('input[name="direct_transfer_currency"]'),

      passengers: form.querySelector('input[name="passengers"]'),
      luggage: form.querySelector('input[name="luggage"]'),
      message: form.querySelector('textarea[name="message"]'),
      leadSource: form.querySelector('input[name="lead_source"]'),
      leadContext: form.querySelector('input[name="lead_context"]'),
      submit: form.querySelector('#contact-submit'),
      status: form.querySelector('#contact-status'),
      formError: form.querySelector('#contact-form-error')
    };
  }

  function hasCriticalFields(fields) {
    if (!fields) return false;

    return Boolean(
      fields.form &&
      fields.name &&
      fields.phone &&
      fields.email &&
      fields.tripDate &&
      fields.tripTime &&
      fields.origin &&
      fields.destination &&
      fields.passengers &&
      fields.luggage &&
      fields.message &&
      fields.submit &&
      fields.status &&
      fields.formError
    );
  }

  function getTrimmedValue(field) {
    if (!field || typeof field.value !== 'string') return '';
    return field.value.trim();
  }

  function isPositiveInteger(value) {
    return /^[1-9]\d*$/.test(value);
  }

  function isPositiveIntegerUpTo(value, max) {
    var numericValue;

    if (!isPositiveInteger(value)) {
      return false;
    }

    numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue <= max;
  }

  function isZeroOrPositiveInteger(value) {
    return /^(0|[1-9]\d*)$/.test(value);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  
    function getPhoneLibrary() {
    if (!window.libphonenumber) {
      return null;
    }

    return window.libphonenumber;
  }

  function normalizePhoneInputValue(value) {
    return String(value || '')
      .trim()
      .replace(/[^\d+]/g, '')
      .replace(/(?!^)\+/g, '');
  }

  function isInternationalPhoneCandidate(value) {
    return /^\+[1-9]\d{6,14}$/.test(normalizePhoneInputValue(value));
  }

  function parseInternationalPhoneNumber(value) {
    var phoneLibrary = getPhoneLibrary();
    var normalizedValue = normalizePhoneInputValue(value);
    var parsedNumber;

    if (!phoneLibrary || !normalizedValue || normalizedValue.charAt(0) !== '+') {
      return null;
    }

    try {
      parsedNumber = phoneLibrary.parsePhoneNumberFromString(normalizedValue);
    } catch (error) {
      return null;
    }

    if (!parsedNumber || !parsedNumber.isValid()) {
      return null;
    }

    return parsedNumber;
  }

  function normalizeInternationalPhoneNumber(value) {
    var parsedNumber = parseInternationalPhoneNumber(value);

    if (!parsedNumber) {
      return '';
    }

    return parsedNumber.number || '';
  }

  function isValidInternationalPhoneNumber(value) {
    var normalizedValue = normalizePhoneInputValue(value);

    if (!isInternationalPhoneCandidate(normalizedValue)) {
      return false;
    }

    return Boolean(parseInternationalPhoneNumber(normalizedValue));
  }
  
    function normalizeLocationComparisonValue(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function areSameLocations(originValue, destinationValue) {
    var normalizedOrigin = normalizeLocationComparisonValue(originValue);
    var normalizedDestination = normalizeLocationComparisonValue(destinationValue);

    if (!normalizedOrigin || !normalizedDestination) {
      return false;
    }

    return normalizedOrigin === normalizedDestination;
  }
  
    function padDateTimePart(value) {
    return String(value).padStart(2, '0');
  }

  function formatDateForInput(date) {
    return [
      date.getFullYear(),
      padDateTimePart(date.getMonth() + 1),
      padDateTimePart(date.getDate())
    ].join('-');
  }

  function formatTimeForInput(date) {
    return [
      padDateTimePart(date.getHours()),
      padDateTimePart(date.getMinutes())
    ].join(':');
  }

  function getReservationMinimumDateTime() {
    return new Date(Date.now() + (24 * 60 * 60 * 1000));
  }

  function parseReservationDateTime(dateValue, timeValue) {
    var parts;
    var timeParts;
    var year;
    var month;
    var day;
    var hours;
    var minutes;
    var candidate;

    if (!dateValue || !timeValue) {
      return null;
    }

    parts = dateValue.split('-');
    timeParts = timeValue.split(':');

    if (parts.length !== 3 || timeParts.length < 2) {
      return null;
    }

    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
    hours = Number(timeParts[0]);
    minutes = Number(timeParts[1]);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes)
    ) {
      return null;
    }

    candidate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (Number.isNaN(candidate.getTime())) {
      return null;
    }

    return candidate;
  }

  function isReservationDateTimeAtLeast24HoursAhead(dateValue, timeValue) {
    var candidate;
    var minimum;

    candidate = parseReservationDateTime(dateValue, timeValue);

    if (!candidate) {
      return false;
    }

    minimum = getReservationMinimumDateTime();
    return candidate.getTime() >= minimum.getTime();
  }

  function syncReservationDateTimeMinimum(fields) {
    var minimum;
    var minimumDate;
    var minimumTime;
    var selectedDate;

    if (!fields || !fields.tripDate || !fields.tripTime) {
      return false;
    }

    minimum = getReservationMinimumDateTime();
    minimumDate = formatDateForInput(minimum);
    minimumTime = formatTimeForInput(minimum);
    selectedDate = getTrimmedValue(fields.tripDate);

    fields.tripDate.setAttribute('min', minimumDate);

    if (selectedDate === minimumDate) {
      fields.tripTime.setAttribute('min', minimumTime);
    } else {
      fields.tripTime.removeAttribute('min');
    }

    return true;
  }

  function isMobileDateTimeConstraintGuardEnabled() {
    return Boolean(
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 720px)').matches
    );
  }

  function setMobileDateTimeMinimumViolation(fields, fieldName, enabled) {
    var field;

    if (!fields) {
      return;
    }

    if (fieldName === 'trip_date') {
      field = fields.tripDate;
    } else if (fieldName === 'trip_time') {
      field = fields.tripTime;
    } else {
      return;
    }

    if (!field || !field.dataset) {
      return;
    }

    if (enabled) {
      field.dataset.mobileMinViolation = '1';
    } else {
      delete field.dataset.mobileMinViolation;
    }
  }

  function hasMobileDateTimeMinimumViolation(fields, fieldName) {
    var field;

    if (!fields) {
      return false;
    }

    if (fieldName === 'trip_date') {
      field = fields.tripDate;
    } else if (fieldName === 'trip_time') {
      field = fields.tripTime;
    } else {
      return false;
    }

    return Boolean(field && field.dataset && field.dataset.mobileMinViolation === '1');
  }
  
  function hasAnyMobileDateTimeMinimumViolation(fields) {
    return (
      hasMobileDateTimeMinimumViolation(fields, 'trip_date') ||
      hasMobileDateTimeMinimumViolation(fields, 'trip_time')
    );
  }

  function syncTripDateErrorMessage(fields) {
    var data;
    var hasMobileViolation;
    var hasBothTripDateTimeValues;
    var isBelowMinimum;

    if (!fields || !fields.form) {
      return;
    }

    hasMobileViolation = hasAnyMobileDateTimeMinimumViolation(fields);
    data = getReservationRequestData(fields);
    hasBothTripDateTimeValues = Boolean(data && data.tripDate && data.tripTime);
    isBelowMinimum = hasBothTripDateTimeValues && !isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime);

    if (hasMobileViolation || isBelowMinimum) {
      setFieldErrorMessage('trip_date', fields.form, 'contact.validation.tripDateMinimum24h');
      return;
    }

    setFieldErrorMessage('trip_date', fields.form, null);
  }

  function enforceMobileDateTimeMinimum(fields, fieldName) {
    var field;

    if (!isMobileDateTimeConstraintGuardEnabled() || !fields) {
      return false;
    }

    if (fieldName === 'trip_date') {
      field = fields.tripDate;
    } else if (fieldName === 'trip_time') {
      field = fields.tripTime;
    } else {
      return false;
    }

    if (!field || !field.validity || field.validity.rangeUnderflow !== true) {
      return false;
    }

    field.value = '';
    setMobileDateTimeMinimumViolation(fields, fieldName, true);
    syncReservationDateTimeMinimum(fields);
    syncTripDateErrorMessage(fields);

    setFieldValidity(fields.tripDate, 'trip_date', false);

    if (fields.tripTime && !getTrimmedValue(fields.tripTime)) {
      setFieldValidity(fields.tripTime, 'trip_time', true);
    }

    showGlobalFormError(fields);
    setSubmitEnabled(fields, false);

    return true;
  }

  function getSelectedAirportHotelFareKey(fields) {
    if (!fields || !fields.passengerFareKey) {
      return '';
    }

    return getTrimmedValue(fields.passengerFareKey);
  }

  function hasAirportHotelFareKeySelected(data) {
    if (!data || data.serviceType !== 'airport_hotel') {
      return false;
    }

    return Boolean(data.passengerFareKey);
  }

  function getReservationRequestData(fields) {
    if (!hasCriticalFields(fields)) {
      return null;
    }

    return {
      name: getTrimmedValue(fields.name),
      phone: normalizeInternationalPhoneNumber(getTrimmedValue(fields.phone)) || normalizePhoneInputValue(getTrimmedValue(fields.phone)),
      email: getTrimmedValue(fields.email),
      tripDate: getTrimmedValue(fields.tripDate),
      tripTime: getTrimmedValue(fields.tripTime),
      origin: getTrimmedValue(fields.origin),
      destination: getTrimmedValue(fields.destination),

      originPlaceId: fields.originPlaceId ? getTrimmedValue(fields.originPlaceId) : '',
      originLat: fields.originLat ? getTrimmedValue(fields.originLat) : '',
      originLng: fields.originLng ? getTrimmedValue(fields.originLng) : '',

      destinationPlaceId: fields.destinationPlaceId ? getTrimmedValue(fields.destinationPlaceId) : '',
      destinationLat: fields.destinationLat ? getTrimmedValue(fields.destinationLat) : '',
      destinationLng: fields.destinationLng ? getTrimmedValue(fields.destinationLng) : '',
      serviceType: fields.serviceType ? getTrimmedValue(fields.serviceType) : '',
      zone: fields.zone ? getTrimmedValue(fields.zone) : '',
      fare: fields.fare ? getTrimmedValue(fields.fare) : '',
      airportHotelDate: fields.airportHotelDate ? getTrimmedValue(fields.airportHotelDate) : '',
      airportHotelTime: fields.airportHotelTime ? getTrimmedValue(fields.airportHotelTime) : '',
      passengerFareKey: getSelectedAirportHotelFareKey(fields),

      tourPrivateTourId: fields.tourPrivateTourId ? getTrimmedValue(fields.tourPrivateTourId) : '',
      tourPrivateTourLabel: fields.tourPrivateTourLabel ? getTrimmedValue(fields.tourPrivateTourLabel) : '',
      tourPrivateDurationHours: fields.tourPrivateDurationHours ? getTrimmedValue(fields.tourPrivateDurationHours) : '',
      tourPrivatePassengerFareKey: fields.tourPrivatePassengerFareKey ? getTrimmedValue(fields.tourPrivatePassengerFareKey) : '',
      tourPrivatePassengerBucketLabel: fields.tourPrivatePassengerBucketLabel ? getTrimmedValue(fields.tourPrivatePassengerBucketLabel) : '',
      tourPrivatePickup: fields.tourPrivatePickup ? getTrimmedValue(fields.tourPrivatePickup) : '',
      tourPrivatePickupPlaceId: fields.tourPrivatePickupPlaceId ? getTrimmedValue(fields.tourPrivatePickupPlaceId) : '',
      tourPrivatePickupLat: fields.tourPrivatePickupLat ? getTrimmedValue(fields.tourPrivatePickupLat) : '',
      tourPrivatePickupLng: fields.tourPrivatePickupLng ? getTrimmedValue(fields.tourPrivatePickupLng) : '',
      tourPrivateDate: fields.tourPrivateDate ? getTrimmedValue(fields.tourPrivateDate) : '',
      tourPrivateTime: fields.tourPrivateTime ? getTrimmedValue(fields.tourPrivateTime) : '',
      tourPrivateHasGuide: fields.tourPrivateHasGuide ? getTrimmedValue(fields.tourPrivateHasGuide) : '',
      tourPrivateGuideLanguage: fields.tourPrivateGuideLanguage ? getTrimmedValue(fields.tourPrivateGuideLanguage) : '',
      tourPrivatePrice: fields.tourPrivatePrice ? getTrimmedValue(fields.tourPrivatePrice) : '',
      tourPrivateCurrency: fields.tourPrivateCurrency ? getTrimmedValue(fields.tourPrivateCurrency) : '',

      hourlyDailyMode: fields.hourlyDailyMode ? getTrimmedValue(fields.hourlyDailyMode) : '',
      hourlyDailyVehicleType: fields.hourlyDailyVehicleType ? getTrimmedValue(fields.hourlyDailyVehicleType) : '',
      hourlyDailyPickup: fields.hourlyDailyPickup ? getTrimmedValue(fields.hourlyDailyPickup) : '',
      hourlyDailyPickupPlaceId: fields.hourlyDailyPickupPlaceId ? getTrimmedValue(fields.hourlyDailyPickupPlaceId) : '',
      hourlyDailyPickupLat: fields.hourlyDailyPickupLat ? getTrimmedValue(fields.hourlyDailyPickupLat) : '',
      hourlyDailyPickupLng: fields.hourlyDailyPickupLng ? getTrimmedValue(fields.hourlyDailyPickupLng) : '',
      hourlyDailyDate: fields.hourlyDailyDate ? getTrimmedValue(fields.hourlyDailyDate) : '',
      hourlyDailyStartTime: fields.hourlyDailyStartTime ? getTrimmedValue(fields.hourlyDailyStartTime) : '',
      hourlyDailyDurationHours: fields.hourlyDailyDurationHours ? getTrimmedValue(fields.hourlyDailyDurationHours) : '',
      hourlyDailyCustomTerm: fields.hourlyDailyCustomTerm ? getTrimmedValue(fields.hourlyDailyCustomTerm) : '',
      hourlyDailyNotes: fields.hourlyDailyNotes ? getTrimmedValue(fields.hourlyDailyNotes) : '',
      hourlyDailyPrice: fields.hourlyDailyPrice ? getTrimmedValue(fields.hourlyDailyPrice) : '',
      hourlyDailyCurrency: fields.hourlyDailyCurrency ? getTrimmedValue(fields.hourlyDailyCurrency) : '',

      eventSpecialEventId: fields.eventSpecialEventId ? getTrimmedValue(fields.eventSpecialEventId) : '',
      eventSpecialVariant: fields.eventSpecialVariant ? getTrimmedValue(fields.eventSpecialVariant) : '',
      eventSpecialOriginAddress: fields.eventSpecialOriginAddress ? getTrimmedValue(fields.eventSpecialOriginAddress) : '',
      eventSpecialOriginPlaceId: fields.eventSpecialOriginPlaceId ? getTrimmedValue(fields.eventSpecialOriginPlaceId) : '',
      eventSpecialDestinationAddress: fields.eventSpecialDestinationAddress ? getTrimmedValue(fields.eventSpecialDestinationAddress) : '',
      eventSpecialDestinationPlaceId: fields.eventSpecialDestinationPlaceId ? getTrimmedValue(fields.eventSpecialDestinationPlaceId) : '',
      eventSpecialOriginPickupTime: fields.eventSpecialOriginPickupTime ? getTrimmedValue(fields.eventSpecialOriginPickupTime) : '',
      eventSpecialReturnPickupTime: fields.eventSpecialReturnPickupTime ? getTrimmedValue(fields.eventSpecialReturnPickupTime) : '',
      eventSpecialPassengerFareKey: fields.eventSpecialPassengerFareKey ? getTrimmedValue(fields.eventSpecialPassengerFareKey) : '',
      eventSpecialPrice: fields.eventSpecialPrice ? getTrimmedValue(fields.eventSpecialPrice) : '',
      eventSpecialCurrency: fields.eventSpecialCurrency ? getTrimmedValue(fields.eventSpecialCurrency) : '',

      directTransferOriginAddress: fields.directTransferOriginAddress ? getTrimmedValue(fields.directTransferOriginAddress) : '',
      directTransferOriginPlaceId: fields.directTransferOriginPlaceId ? getTrimmedValue(fields.directTransferOriginPlaceId) : '',
      directTransferDestinationAddress: fields.directTransferDestinationAddress ? getTrimmedValue(fields.directTransferDestinationAddress) : '',
      directTransferDestinationPlaceId: fields.directTransferDestinationPlaceId ? getTrimmedValue(fields.directTransferDestinationPlaceId) : '',
      directTransferDate: fields.directTransferDate ? getTrimmedValue(fields.directTransferDate) : '',
      directTransferTime: fields.directTransferTime ? getTrimmedValue(fields.directTransferTime) : '',
      directTransferPassengerFareKey: fields.directTransferPassengerFareKey ? getTrimmedValue(fields.directTransferPassengerFareKey) : '',
      directTransferPrice: fields.directTransferPrice ? getTrimmedValue(fields.directTransferPrice) : '',
      directTransferCurrency: fields.directTransferCurrency ? getTrimmedValue(fields.directTransferCurrency) : '',

      passengers: getTrimmedValue(fields.passengers),
      luggage: getTrimmedValue(fields.luggage),
      notes: getTrimmedValue(fields.message),
      leadSource: fields.leadSource ? getTrimmedValue(fields.leadSource) : '',
      leadContext: fields.leadContext ? getTrimmedValue(fields.leadContext) : ''
    };
  }

  function hasAttemptableAirportHotelReservationData(data) {
    if (!data) return false;

    return Boolean(
      data.name &&
      isValidInternationalPhoneNumber(data.phone) &&
      data.email &&
      data.serviceType === 'airport_hotel' &&
      data.airportHotelDate &&
      data.airportHotelTime &&
      data.zone &&
      data.fare &&
      hasAirportHotelFareKeySelected(data) &&
      data.luggage !== ''
    );
  }

  function hasAttemptableOtherReservationData(data) {
    if (!data) return false;

    return Boolean(
      data.name &&
      isValidInternationalPhoneNumber(data.phone) &&
      data.email &&
      data.tripDate &&
      data.tripTime &&
      data.origin &&
      data.destination &&
      isPositiveIntegerUpTo(data.passengers, 6) &&
      data.luggage !== ''
    );
  }

  function hasAttemptableTourPrivateReservationData(data) {
  if (!data) return false;

  return Boolean(
    data.name &&
    isValidInternationalPhoneNumber(data.phone) &&
    data.email &&
    data.serviceType === 'tour_private' &&
    data.tourPrivateTourId &&
    data.tourPrivatePassengerFareKey &&
    data.tourPrivatePickup &&
    data.tourPrivateDate &&
    data.tourPrivateTime &&
    data.tourPrivatePrice &&
    data.tourPrivateCurrency &&
    (
      data.tourPrivateHasGuide !== 'true' ||
      data.tourPrivateGuideLanguage
    )
  );
}

function hasAttemptableHourlyDailyReservationData(data) {
  if (!data) return false;

  return Boolean(
    data.name &&
    isValidInternationalPhoneNumber(data.phone) &&
    data.email &&
    data.serviceType === 'hourly_daily' &&
    data.hourlyDailyMode &&
    data.hourlyDailyPickup &&
    data.hourlyDailyDate &&
    data.hourlyDailyStartTime &&
    (
      (data.hourlyDailyMode === 'hourly' && data.hourlyDailyDurationHours) ||
      (data.hourlyDailyMode === 'full_day' && data.hourlyDailyDurationHours) ||
      (data.hourlyDailyMode === 'custom_long_term' && data.hourlyDailyCustomTerm)
    ) &&
    (
      data.hourlyDailyMode === 'custom_long_term' ||
      (data.hourlyDailyPrice && data.hourlyDailyCurrency)
    )
  );
}

function hasAttemptableEventSpecialReservationData(data) {
  if (!data) return false;

  if (
    !data.name ||
    !isValidInternationalPhoneNumber(data.phone) ||
    !data.email ||
    data.serviceType !== 'event_special' ||
    !data.eventSpecialEventId ||
    !data.eventSpecialVariant ||
    !data.eventSpecialPassengerFareKey ||
    !data.eventSpecialPrice ||
    !data.eventSpecialCurrency
  ) {
    return false;
  }

  if (data.eventSpecialVariant === 'arrival') {
    return Boolean(
      data.eventSpecialOriginAddress &&
      data.eventSpecialOriginPlaceId &&
      data.eventSpecialOriginPickupTime
    );
  }

  if (data.eventSpecialVariant === 'departure') {
    return Boolean(
      data.eventSpecialDestinationAddress &&
      data.eventSpecialDestinationPlaceId &&
      data.eventSpecialReturnPickupTime
    );
  }

  if (data.eventSpecialVariant === 'round_trip') {
    return Boolean(
      data.eventSpecialOriginAddress &&
      data.eventSpecialOriginPlaceId &&
      data.eventSpecialDestinationAddress &&
      data.eventSpecialDestinationPlaceId &&
      data.eventSpecialOriginPickupTime &&
      data.eventSpecialReturnPickupTime
    );
  }

  return false;
}

function hasAttemptableDirectTransferReservationData(data) {
  if (!data) return false;

  return Boolean(
    data.name &&
    isValidInternationalPhoneNumber(data.phone) &&
    data.email &&
    data.serviceType === 'direct_transfer' &&
    data.directTransferOriginAddress &&
    data.directTransferOriginPlaceId &&
    data.directTransferDestinationAddress &&
    data.directTransferDestinationPlaceId &&
    data.directTransferDate &&
    data.directTransferTime &&
    data.directTransferPassengerFareKey &&
    data.directTransferPrice &&
    data.directTransferCurrency
  );
}

  function hasAttemptableReservationData(data) {
    if (!data) return false;

    if (data.serviceType === 'airport_hotel') {
      return hasAttemptableAirportHotelReservationData(data);
    }

    if (data.serviceType === 'tour_private') {
      return hasAttemptableTourPrivateReservationData(data);
    }

    if (data.serviceType === 'hourly_daily') {
      return hasAttemptableHourlyDailyReservationData(data);
    }

    if (data.serviceType === 'event_special') {
      return hasAttemptableEventSpecialReservationData(data);
    }

    if (data.serviceType === 'direct_transfer') {
      return hasAttemptableDirectTransferReservationData(data);
    }

    return hasAttemptableOtherReservationData(data);
  }

  function hasMinimumRequiredAirportHotelReservationData(data) {
    if (!data) return false;

    return Boolean(
      data.name &&
      isValidInternationalPhoneNumber(data.phone) &&
      isValidEmail(data.email) &&
      data.serviceType === 'airport_hotel' &&
      data.airportHotelDate &&
      data.airportHotelTime &&
      data.zone &&
      data.fare &&
      hasAirportHotelFareKeySelected(data) &&
      isZeroOrPositiveInteger(data.luggage)
    );
  }

  function hasMinimumRequiredOtherReservationData(data) {
    if (!data) return false;

    return Boolean(
      data.name &&
      isValidInternationalPhoneNumber(data.phone) &&
      isValidEmail(data.email) &&
      data.tripDate &&
      data.tripTime &&
      data.origin &&
      data.destination &&
      isPositiveIntegerUpTo(data.passengers, 6) &&
      isZeroOrPositiveInteger(data.luggage)
    );
  }

  function hasMinimumRequiredTourPrivateReservationData(data) {
  if (!data) return false;

  return Boolean(
    data.name &&
    isValidInternationalPhoneNumber(data.phone) &&
    isValidEmail(data.email) &&
    data.serviceType === 'tour_private' &&
    data.tourPrivateTourId &&
    data.tourPrivatePassengerFareKey &&
    data.tourPrivatePickup &&
    data.tourPrivateDate &&
    data.tourPrivateTime &&
    data.tourPrivatePrice &&
    data.tourPrivateCurrency &&
    (
      data.tourPrivateHasGuide !== 'true' ||
      data.tourPrivateGuideLanguage
    )
  );
}

function hasMinimumRequiredHourlyDailyReservationData(data) {
  if (!data) return false;

  return Boolean(
    data.name &&
    isValidInternationalPhoneNumber(data.phone) &&
    isValidEmail(data.email) &&
    data.serviceType === 'hourly_daily' &&
    data.hourlyDailyMode &&
    data.hourlyDailyPickup &&
    data.hourlyDailyDate &&
    data.hourlyDailyStartTime &&
    (
      (data.hourlyDailyMode === 'hourly' && data.hourlyDailyDurationHours) ||
      (data.hourlyDailyMode === 'full_day' && data.hourlyDailyDurationHours) ||
      (data.hourlyDailyMode === 'custom_long_term' && data.hourlyDailyCustomTerm)
    ) &&
    (
      data.hourlyDailyMode === 'custom_long_term' ||
      (data.hourlyDailyPrice && data.hourlyDailyCurrency)
    )
  );
}

function hasMinimumRequiredEventSpecialReservationData(data) {
  if (!data) return false;

  if (
    !data.name ||
    !isValidInternationalPhoneNumber(data.phone) ||
    !isValidEmail(data.email) ||
    data.serviceType !== 'event_special' ||
    !data.eventSpecialEventId ||
    !data.eventSpecialVariant ||
    !data.eventSpecialPassengerFareKey ||
    !data.eventSpecialPrice ||
    !data.eventSpecialCurrency
  ) {
    return false;
  }

  if (data.eventSpecialVariant === 'arrival') {
    return Boolean(
      data.eventSpecialOriginAddress &&
      data.eventSpecialOriginPlaceId &&
      data.eventSpecialOriginPickupTime
    );
  }

  if (data.eventSpecialVariant === 'departure') {
    return Boolean(
      data.eventSpecialDestinationAddress &&
      data.eventSpecialDestinationPlaceId &&
      data.eventSpecialReturnPickupTime
    );
  }

  if (data.eventSpecialVariant === 'round_trip') {
    return Boolean(
      data.eventSpecialOriginAddress &&
      data.eventSpecialOriginPlaceId &&
      data.eventSpecialDestinationAddress &&
      data.eventSpecialDestinationPlaceId &&
      data.eventSpecialOriginPickupTime &&
      data.eventSpecialReturnPickupTime
    );
  }

  return false;
}

function hasMinimumRequiredDirectTransferReservationData(data) {
  if (!data) return false;

  return Boolean(
    data.name &&
    isValidInternationalPhoneNumber(data.phone) &&
    isValidEmail(data.email) &&
    data.serviceType === 'direct_transfer' &&
    data.directTransferOriginAddress &&
    data.directTransferOriginPlaceId &&
    data.directTransferDestinationAddress &&
    data.directTransferDestinationPlaceId &&
    data.directTransferDate &&
    data.directTransferTime &&
    data.directTransferPassengerFareKey &&
    data.directTransferPrice &&
    data.directTransferCurrency
  );
}

  function validateHourlyDailySpecificFields(data) {
    if (!data || data.serviceType !== 'hourly_daily') {
      return {
        hourly_daily_pickup: true,
        hourly_daily_date: true,
        hourly_daily_time: true
      };
    }

    return {
      hourly_daily_pickup: Boolean(data.hourlyDailyPickup),
      hourly_daily_date: Boolean(data.hourlyDailyDate),
      hourly_daily_time: Boolean(data.hourlyDailyStartTime)
    };
  }

  function hasMinimumRequiredReservationData(data) {
    if (!data) return false;

    if (data.serviceType === 'airport_hotel') {
      return hasMinimumRequiredAirportHotelReservationData(data);
    }

    if (data.serviceType === 'tour_private') {
      return hasMinimumRequiredTourPrivateReservationData(data);
    }

    if (data.serviceType === 'hourly_daily') {
      return hasMinimumRequiredHourlyDailyReservationData(data);
    }

    if (data.serviceType === 'event_special') {
      return hasMinimumRequiredEventSpecialReservationData(data);
    }

    if (data.serviceType === 'direct_transfer') {
      return hasMinimumRequiredDirectTransferReservationData(data);
    }

    return hasMinimumRequiredOtherReservationData(data);
  }

  function isFormSubmitted(form) {
    if (!form) return false;
    return form.dataset.submitted === '1';
  }

  function isFormBusy(form) {
    if (!form) return false;
    return form.getAttribute('aria-busy') === 'true';
  }

  function isFormLocked(form) {
    return isFormSubmitted(form) || isFormBusy(form);
  }

  function setReadyState(form) {
    form.setAttribute('data-reservation-request-ready', '1');
  }

  function setSubmitEnabled(fields, enabled) {
    if (!fields || !fields.submit) return;

    fields.submit.disabled = !enabled;
    fields.submit.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function getSubmissionGuard() {
    var guard = window.PixkuySubmissionGuard;

    if (!guard || typeof guard !== 'object') {
      return null;
    }

    if (typeof guard.prepareSubmit !== 'function') {
      return null;
    }

    return guard;
  }
  
  function syncNativeRequiredState(fields, data) {
  var usesSpecificServiceModel;
  var isTourPrivate;
  var isHourlyDaily;
  var isEventSpecial;
  var isDirectTransfer;

  if (
    !fields ||
    !fields.tripDate ||
    !fields.tripTime ||
    !fields.origin ||
    !fields.destination ||
    !fields.passengers ||
    !fields.luggage
  ) {
    return false;
  }

  usesSpecificServiceModel = Boolean(
    data &&
    (
      data.serviceType === 'airport_hotel' ||
      data.serviceType === 'tour_private' ||
      data.serviceType === 'hourly_daily' ||
      data.serviceType === 'event_special' ||
      data.serviceType === 'direct_transfer'
    )
  );

  isTourPrivate = Boolean(
    data &&
    data.serviceType === 'tour_private'
  );

  isHourlyDaily = Boolean(
    data &&
    data.serviceType === 'hourly_daily'
  );

  isEventSpecial = Boolean(
    data &&
    data.serviceType === 'event_special'
  );
  
  
  isDirectTransfer = Boolean(
    data &&
    data.serviceType === 'direct_transfer'
  );

  if (usesSpecificServiceModel) {
    fields.tripDate.required = false;
    fields.tripTime.required = false;
    fields.origin.required = false;
    fields.destination.required = false;
    fields.passengers.required = false;
    fields.luggage.required = !(isTourPrivate || isHourlyDaily || isEventSpecial || isDirectTransfer);
    return true;
  }

  fields.tripDate.required = true;
  fields.tripTime.required = true;
  fields.origin.required = true;
  fields.destination.required = true;
  fields.passengers.required = true;
  fields.luggage.required = true;
  return true;
}

  function setStatusHidden(fields) {
    if (!fields || !fields.status) return;

    if (isFormLocked(fields.form)) {
      return;
    }

    fields.status.hidden = true;
  }

  function getFieldWrapper(field) {
    if (!field) return null;
    return field.closest('.form-field');
  }

  function getFieldErrorNode(fieldName, form) {
    if (!form) return null;
    return form.querySelector('[data-error-for="' + fieldName + '"]');
  }

  function getI18nValue(path) {
    var modules;
    var getValue;
    var dict;
    var segments;
    var cursor;
    var i;

    if (!path || typeof path !== 'string') {
      return '';
    }

    modules = window.__pixkuyI18nModules || {};
    getValue = modules.getValue;
    dict = window.__pixkuyI18nDict || null;

    if (typeof getValue === 'function' && dict) {
      return getValue(dict, path) || '';
    }

    segments = path.split('.');
    cursor = dict;

    for (i = 0; cursor && i < segments.length; i += 1) {
      cursor = cursor[segments[i]];
    }

    return typeof cursor === 'string' ? cursor : '';
  }

  function setFieldErrorMessage(fieldName, form, i18nPath) {
    var errorNode;
    var nextMessage;

    errorNode = getFieldErrorNode(fieldName, form);

    if (!errorNode) {
      return;
    }

    if (!i18nPath) {
      if (errorNode.dataset && errorNode.dataset.i18n) {
        errorNode.removeAttribute('data-error-i18n-override');
      }

      if (errorNode.dataset && errorNode.dataset.i18n) {
        nextMessage = getI18nValue(errorNode.dataset.i18n);

        if (nextMessage) {
          errorNode.textContent = nextMessage;
        }
      }

      return;
    }

    nextMessage = getI18nValue(i18nPath);

    if (!nextMessage) {
      return;
    }

    errorNode.textContent = nextMessage;
    errorNode.setAttribute('data-error-i18n-override', i18nPath);
  }

  function setFieldValidity(field, fieldName, isValid) {
    var wrapper;
    var errorNode;
    var fields;
    var hasMobileMinimumViolation;
    var data;
    var hasBothTripDateTimeValues;
    var isBelowMinimum;

    if (!field) return;

    wrapper = getFieldWrapper(field);
    errorNode = getFieldErrorNode(fieldName, field.form);
    fields = getReservationRequestFields(field.form);
    hasMobileMinimumViolation = hasAnyMobileDateTimeMinimumViolation(fields);
    data = fields ? getReservationRequestData(fields) : null;
    hasBothTripDateTimeValues = Boolean(data && data.tripDate && data.tripTime);
    isBelowMinimum = hasBothTripDateTimeValues && !isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime);

    if (wrapper) {
      wrapper.classList.toggle('is-invalid', !isValid);
    }

    field.setAttribute('aria-invalid', isValid ? 'false' : 'true');

    if (errorNode) {
      if (isValid) {
        setFieldErrorMessage(fieldName, field.form, null);
      } else if (
        fieldName === 'trip_date' &&
        (hasMobileMinimumViolation || isBelowMinimum)
      ) {
        setFieldErrorMessage(fieldName, field.form, 'contact.validation.tripDateMinimum24h');
      } else if (fieldName === 'trip_date') {
        setFieldErrorMessage(fieldName, field.form, 'contact.validation.tripDateRequired');
      }

      errorNode.hidden = isValid;
    }
  }

  function hideGlobalFormError(fields) {
    if (!fields || !fields.formError) return;
    fields.formError.hidden = true;
  }

  function showGlobalFormError(fields) {
    if (!fields || !fields.formError) return;
    fields.formError.hidden = false;
  }

  function resetAllFieldErrors(fields) {
    if (!hasCriticalFields(fields)) {
      return;
    }

    setFieldValidity(fields.name, 'name', true);
    setFieldValidity(fields.phone, 'phone', true);
    setFieldValidity(fields.email, 'email', true);
    setFieldValidity(fields.tripDate, 'trip_date', true);
    setFieldValidity(fields.tripTime, 'trip_time', true);
    setFieldValidity(fields.origin, 'origin', true);
    setFieldValidity(fields.destination, 'destination', true);
    setFieldValidity(fields.passengers, 'passengers', true);
    setFieldValidity(fields.luggage, 'luggage', true);
    setFieldValidity(fields.hourlyDailyVisiblePickup, 'hourly_daily_pickup', true);
    setFieldValidity(fields.hourlyDailyVisibleDate, 'hourly_daily_date', true);
    setFieldValidity(fields.hourlyDailyVisibleTime, 'hourly_daily_time', true);
  }

  function validateReservationRequestFields(fields) {
    var data;
    var validity;
    var hasMobileMinimumViolation;

    if (!hasCriticalFields(fields)) {
      return null;
    }

    data = getReservationRequestData(fields);
    hasMobileMinimumViolation = hasAnyMobileDateTimeMinimumViolation(fields);

    validity = Object.assign(
      {
        name: Boolean(data.name),
        phone: isValidInternationalPhoneNumber(data.phone),
        email: Boolean(data.email) && isValidEmail(data.email),
        trip_date: (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        )
          ? true
          : (
              !hasMobileMinimumViolation &&
              Boolean(data.tripDate) &&
              Boolean(data.tripTime) &&
              isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime)
            ),
        trip_time: (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        )
          ? true
          : (
              !hasMobileMinimumViolation &&
              Boolean(data.tripTime) &&
              Boolean(data.tripDate) &&
              isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime)
            ),
        origin: (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        )
          ? true
          : Boolean(data.origin) && !areSameLocations(data.origin, data.destination),
        destination: (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        )
          ? true
          : Boolean(data.destination) && !areSameLocations(data.origin, data.destination),
        passengers: data.serviceType === 'airport_hotel'
          ? hasAirportHotelFareKeySelected(data)
          : (
              data.serviceType === 'tour_private' ||
              data.serviceType === 'hourly_daily' ||
              data.serviceType === 'event_special' ||
              data.serviceType === 'direct_transfer'
                ? true
                : isPositiveIntegerUpTo(data.passengers, 6)
            ),
        luggage: (
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        )
          ? true
          : isZeroOrPositiveInteger(data.luggage)
      },
      validateHourlyDailySpecificFields(data)
    );

    return validity;
  }


      function validateSingleField(fields, fieldName) {
    var data;
    var validity;

    if (!hasCriticalFields(fields)) {
      return true;
    }

    data = getReservationRequestData(fields);

    switch (fieldName) {
      case 'phone':
        return isValidInternationalPhoneNumber(data.phone);
      case 'trip_date':
        if (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        ) {
          return true;
        }

        if (hasAnyMobileDateTimeMinimumViolation(fields)) {
          return false;
        }

        if (!data.tripDate) {
          return false;
        }

        if (!data.tripTime) {
          return true;
        }

        return isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime);
      case 'trip_time':
        if (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        ) {
          return true;
        }

        if (hasAnyMobileDateTimeMinimumViolation(fields)) {
          return false;
        }

        if (!data.tripTime) {
          return false;
        }

        return isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime);
      case 'origin':
        if (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        ) {
          return true;
        }

        return Boolean(data.origin) && !areSameLocations(data.origin, data.destination);
      case 'destination':
        if (
          data.serviceType === 'airport_hotel' ||
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        ) {
          return true;
        }

        return Boolean(data.destination) && !areSameLocations(data.origin, data.destination);
      case 'passengers':
        if (
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        ) {
          return true;
        }

        validity = validateReservationRequestFields(fields);
        return validity && Object.prototype.hasOwnProperty.call(validity, fieldName)
          ? validity[fieldName]
          : true;
      case 'luggage':
        if (
          data.serviceType === 'tour_private' ||
          data.serviceType === 'hourly_daily' ||
          data.serviceType === 'event_special' ||
          data.serviceType === 'direct_transfer'
        ) {
          return true;
        }

        validity = validateReservationRequestFields(fields);
        return validity && Object.prototype.hasOwnProperty.call(validity, fieldName)
          ? validity[fieldName]
          : true;
      case 'hourly_daily_pickup':
      case 'hourly_daily_date':
      case 'hourly_daily_time':
        validity = validateReservationRequestFields(fields);
        return validity && Object.prototype.hasOwnProperty.call(validity, fieldName)
          ? validity[fieldName]
          : true;
      default:
        validity = validateReservationRequestFields(fields);
        return validity && Object.prototype.hasOwnProperty.call(validity, fieldName)
          ? validity[fieldName]
          : true;
    }
  }


    function hasValidationErrors(validity) {
    var key;

    if (!validity) return true;

    for (key in validity) {
      if (Object.prototype.hasOwnProperty.call(validity, key) && !validity[key]) {
        return true;
      }
    }

    return false;
  }

  function getFieldRefByValidationName(fields, fieldName) {
    if (!fields) {
      return null;
    }

    switch (fieldName) {
      case 'name':
        return fields.name;
      case 'phone':
        return fields.phone;
      case 'email':
        return fields.email;
      case 'trip_date':
        return fields.tripDate;
      case 'trip_time':
        return fields.tripTime;
      case 'origin':
        return fields.origin;
      case 'destination':
        return fields.destination;
      case 'passengers':
        return fields.passengers;
      case 'luggage':
        return fields.luggage;
      case 'hourly_daily_pickup':
        return fields.hourlyDailyVisiblePickup;
      case 'hourly_daily_date':
        return fields.hourlyDailyVisibleDate;
      case 'hourly_daily_time':
        return fields.hourlyDailyVisibleTime;
      default:
        return null;
    }
  }

  function getRelatedValidationFieldNames(fieldName) {
    switch (fieldName) {
      case 'trip_date':
      case 'trip_time':
        return ['trip_date', 'trip_time'];
      case 'origin':
      case 'destination':
        return ['origin', 'destination'];
      default:
        return [fieldName];
    }
  }

  function hasCompleteTripDateTimeData(fields) {
    var data;

    if (!hasCriticalFields(fields)) {
      return false;
    }

    data = getReservationRequestData(fields);

    return Boolean(data && data.tripDate && data.tripTime);
  }
  
  function applyPartialValidationState(fields, validity, fieldNames) {
    var i;
    var currentFieldName;
    var currentField;

    if (!hasCriticalFields(fields) || !validity || !Array.isArray(fieldNames) || !fieldNames.length) {
      return false;
    }

    for (i = 0; i < fieldNames.length; i += 1) {
      currentFieldName = fieldNames[i];

      if (!Object.prototype.hasOwnProperty.call(validity, currentFieldName)) {
        continue;
      }

      currentField = getFieldRefByValidationName(fields, currentFieldName);
      setFieldValidity(currentField, currentFieldName, validity[currentFieldName]);
    }

    return true;
  }

  function applyValidationState(fields, validity) {
    if (!hasCriticalFields(fields) || !validity) {
      return false;
    }

    setFieldValidity(fields.name, 'name', validity.name);
    setFieldValidity(fields.phone, 'phone', validity.phone);
    setFieldValidity(fields.email, 'email', validity.email);
    setFieldValidity(fields.tripDate, 'trip_date', validity.trip_date);
    setFieldValidity(fields.tripTime, 'trip_time', validity.trip_time);
    setFieldValidity(fields.origin, 'origin', validity.origin);
    setFieldValidity(fields.destination, 'destination', validity.destination);
    setFieldValidity(fields.passengers, 'passengers', validity.passengers);
    setFieldValidity(fields.luggage, 'luggage', validity.luggage);
    setFieldValidity(fields.hourlyDailyVisiblePickup, 'hourly_daily_pickup', validity.hourly_daily_pickup);
    setFieldValidity(fields.hourlyDailyVisibleDate, 'hourly_daily_date', validity.hourly_daily_date);
    setFieldValidity(fields.hourlyDailyVisibleTime, 'hourly_daily_time', validity.hourly_daily_time);

    return true;
  }

    function syncReservationRequestState(fields) {
    var data;
    var canAttemptSubmit;

    if (!hasCriticalFields(fields)) {
      return false;
    }

    syncReservationDateTimeMinimum(fields);
    data = getReservationRequestData(fields);
    syncNativeRequiredState(fields, data);

    if (isFormLocked(fields.form)) {
      setSubmitEnabled(fields, false);
      return true;
    }

    canAttemptSubmit = hasAttemptableReservationData(data);

    setSubmitEnabled(fields, canAttemptSubmit);
    return true;
  }

      function refreshValidationUX(fields, fieldName) {
    var validity;
    var hasErrors;
    var relatedFieldNames;
    var i;
    var hasPartialErrors;
    var partialValidity;

    if (!hasCriticalFields(fields)) {
      return false;
    }

    if (isFormLocked(fields.form)) {
      return true;
    }

    validity = validateReservationRequestFields(fields);

    if (fieldName && typeof fieldName === 'string') {
            relatedFieldNames =
        fieldName === 'trip_date' || fieldName === 'trip_time'
          ? ['trip_date', 'trip_time']
          : getRelatedValidationFieldNames(fieldName);

      partialValidity = {};

      for (i = 0; i < relatedFieldNames.length; i += 1) {
        partialValidity[relatedFieldNames[i]] = validateSingleField(fields, relatedFieldNames[i]);
      }

      syncTripDateErrorMessage(fields);
      applyPartialValidationState(fields, partialValidity, relatedFieldNames);
      syncReservationRequestState(fields);

      hasPartialErrors = false;

      for (i = 0; i < relatedFieldNames.length; i += 1) {
        if (Object.prototype.hasOwnProperty.call(partialValidity, relatedFieldNames[i]) && !partialValidity[relatedFieldNames[i]]) {
          hasPartialErrors = true;
          break;
        }
      }

      return !hasPartialErrors;
    }

    hasErrors = hasValidationErrors(validity);

    syncTripDateErrorMessage(fields);
    applyValidationState(fields, validity);

    if (hasErrors) {
      showGlobalFormError(fields);
    } else {
      hideGlobalFormError(fields);
    }

    syncReservationRequestState(fields);
    return !hasErrors;
  }
  
  function clearFieldValidationOnInput(field, fieldName) {
    var wrapper;
    var errorNode;
    var fields;

    if (!field) return;

    wrapper = getFieldWrapper(field);
    errorNode = getFieldErrorNode(fieldName, field.form);
    fields = getReservationRequestFields(field.form);

    if (wrapper) {
      wrapper.classList.remove('is-invalid');
    }

    field.setAttribute('aria-invalid', 'false');

    if (errorNode) {
      if (fieldName === 'trip_date') {
        syncTripDateErrorMessage(fields);
      } else {
        setFieldErrorMessage(fieldName, field.form, null);
      }

      errorNode.hidden = true;
    }
  }

  function bindLiveState(fields) {
    var fieldMap;
    var keys;
    var i;
    var fieldName;
    var field;

    if (!hasCriticalFields(fields)) {
      return false;
    }

    fieldMap = {
      name: fields.name,
      phone: fields.phone,
      email: fields.email,
      trip_date: fields.tripDate,
      trip_time: fields.tripTime,
      origin: fields.origin,
      destination: fields.destination,
      passengers: fields.passengers,
      luggage: fields.luggage,
      hourly_daily_pickup: fields.hourlyDailyVisiblePickup,
      hourly_daily_date: fields.hourlyDailyVisibleDate,
      hourly_daily_time: fields.hourlyDailyVisibleTime
    };

    keys = Object.keys(fieldMap);

    for (i = 0; i < keys.length; i += 1) {
      fieldName = keys[i];
      field = fieldMap[fieldName];

      if (!field) continue;

        field.addEventListener('input', (function (currentField, currentFieldName) {
        return function () {
          var enforcedMinimumViolation = false;

          clearFieldValidationOnInput(currentField, currentFieldName);
          hideGlobalFormError(fields);

          if (currentFieldName === 'trip_date' || currentFieldName === 'trip_time') {
            syncReservationDateTimeMinimum(fields);
            enforcedMinimumViolation = enforceMobileDateTimeMinimum(fields, currentFieldName);

            if (enforcedMinimumViolation) {
              return;
            }

            if (
              currentFieldName === 'trip_date' &&
              getTrimmedValue(fields.tripDate)
            ) {
              setMobileDateTimeMinimumViolation(fields, 'trip_date', false);
            }

            if (
              currentFieldName === 'trip_time' &&
              getTrimmedValue(fields.tripTime)
            ) {
              setMobileDateTimeMinimumViolation(fields, 'trip_time', false);
            }
          }

          syncReservationRequestState(fields);
        };
      })(field, fieldName));

        field.addEventListener('change', (function (currentField, currentFieldName) {
        return function () {
          var enforcedMinimumViolation = false;

          clearFieldValidationOnInput(currentField, currentFieldName);
          hideGlobalFormError(fields);

          if (currentFieldName === 'trip_date' || currentFieldName === 'trip_time') {
            syncReservationDateTimeMinimum(fields);
            enforcedMinimumViolation = enforceMobileDateTimeMinimum(fields, currentFieldName);

            if (enforcedMinimumViolation) {
              return;
            }

                        if (
              currentFieldName === 'trip_date' &&
              getTrimmedValue(fields.tripDate)
            ) {
              setMobileDateTimeMinimumViolation(fields, 'trip_date', false);
            }

            if (
              currentFieldName === 'trip_time' &&
              getTrimmedValue(fields.tripTime)
            ) {
              setMobileDateTimeMinimumViolation(fields, 'trip_time', false);
            }
          }

          syncReservationRequestState(fields);
        };
      })(field, fieldName));

      field.addEventListener('blur', (function (currentFieldName, currentFields, currentField) {
        return function () {
          var normalizedPhone;

          if (currentFieldName === 'phone') {
            normalizedPhone = normalizeInternationalPhoneNumber(getTrimmedValue(currentField));

            if (normalizedPhone) {
              currentField.value = normalizedPhone;
            }
          }

          if (currentFieldName === 'hourly_daily_pickup') {
            return;
          }

          refreshValidationUX(currentFields, currentFieldName);
        };
      })(fieldName, fields, field));
    }

    if (fields.message) {
      fields.message.addEventListener('input', function () {
        hideGlobalFormError(fields);
        syncReservationRequestState(fields);
      });

      fields.message.addEventListener('change', function () {
        hideGlobalFormError(fields);
        syncReservationRequestState(fields);
      });
    }

    return true;
  }

  function bindSubmitValidation(fields) {
    if (!hasCriticalFields(fields)) {
      return false;
    }

    fields.form.addEventListener('submit', function (event) {
      var guard;
      var data;
      var serviceType;

      if (isFormLocked(fields.form)) {
        event.preventDefault();
        return;
      }

      if (!refreshValidationUX(fields)) {
        event.preventDefault();
        return;
      }

      data = getReservationRequestData(fields);
      serviceType = data && data.serviceType ? data.serviceType : '';

      guard = getSubmissionGuard();

      if (guard && !guard.prepareSubmit(fields.form, serviceType)) {
        event.preventDefault();
      }
    });

    return true;
  }

  function initReservationRequestForm() {
    var form = getReservationForm();
    var fields = getReservationRequestFields(form);

    if (!hasCriticalFields(fields)) {
      return false;
    }

        setReadyState(form);
    setStatusHidden(fields);
    hideGlobalFormError(fields);
    resetAllFieldErrors(fields);
    syncReservationDateTimeMinimum(fields);
    bindLiveState(fields);
    bindSubmitValidation(fields);
    syncReservationRequestState(fields);

    return true;
  }

  window.PixkuyForms = window.PixkuyForms || {};
  window.PixkuyForms.getReservationForm = getReservationForm;
  window.PixkuyForms.getReservationRequestFields = getReservationRequestFields;
  window.PixkuyForms.getReservationRequestData = getReservationRequestData;
  window.PixkuyForms.hasMinimumRequiredReservationData = hasMinimumRequiredReservationData;
  window.PixkuyForms.isReservationRequestFormLocked = isFormLocked;
  window.PixkuyForms.refreshReservationRequestValidationUX = refreshValidationUX;
  window.PixkuyForms.syncReservationRequestState = syncReservationRequestState;
  window.PixkuyForms.initReservationRequestForm = initReservationRequestForm;

  window.PixkuyForms.getReservationMinimumDateTime = getReservationMinimumDateTime;
  window.PixkuyForms.formatReservationDateForInput = formatDateForInput;
  window.PixkuyForms.formatReservationTimeForInput = formatTimeForInput;
  window.PixkuyForms.parseReservationDateTime = parseReservationDateTime;
  window.PixkuyForms.isReservationDateTimeAtLeast24HoursAhead = isReservationDateTimeAtLeast24HoursAhead;
})(window, document);