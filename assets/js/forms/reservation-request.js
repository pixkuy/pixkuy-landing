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

  function isZeroOrPositiveInteger(value) {
    return /^(0|[1-9]\d*)$/.test(value);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  function getReservationRequestData(fields) {
    if (!hasCriticalFields(fields)) {
      return null;
    }

    return {
      name: getTrimmedValue(fields.name),
      phone: getTrimmedValue(fields.phone),
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

      passengers: getTrimmedValue(fields.passengers),
      luggage: getTrimmedValue(fields.luggage),
      notes: getTrimmedValue(fields.message),
      leadSource: fields.leadSource ? getTrimmedValue(fields.leadSource) : '',
      leadContext: fields.leadContext ? getTrimmedValue(fields.leadContext) : ''
    };
  }

  function hasAttemptableReservationData(data) {
    if (!data) return false;

    return Boolean(
      data.name &&
      data.phone &&
      data.email &&
      data.tripDate &&
      data.tripTime &&
      data.origin &&
      data.destination &&
      data.passengers &&
      data.luggage !== ''
    );
  }

  function hasMinimumRequiredReservationData(data) {
    if (!data) return false;

    return Boolean(
      data.name &&
      data.phone &&
      isValidEmail(data.email) &&
      data.tripDate &&
      data.tripTime &&
      data.origin &&
      data.destination &&
      isPositiveInteger(data.passengers) &&
      isZeroOrPositiveInteger(data.luggage)
    );
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

  function setFieldValidity(field, fieldName, isValid) {
    var wrapper;
    var errorNode;

    if (!field) return;

    wrapper = getFieldWrapper(field);
    errorNode = getFieldErrorNode(fieldName, field.form);

    if (wrapper) {
      wrapper.classList.toggle('is-invalid', !isValid);
    }

    field.setAttribute('aria-invalid', isValid ? 'false' : 'true');

    if (errorNode) {
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
  }

  function validateReservationRequestFields(fields) {
    var data;
    var validity;

    if (!hasCriticalFields(fields)) {
      return null;
    }

    data = getReservationRequestData(fields);

     validity = {
      name: Boolean(data.name),
      phone: Boolean(data.phone),
      email: Boolean(data.email) && isValidEmail(data.email),
      trip_date: Boolean(data.tripDate) && Boolean(data.tripTime) && isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime),
      trip_time: Boolean(data.tripTime) && Boolean(data.tripDate) && isReservationDateTimeAtLeast24HoursAhead(data.tripDate, data.tripTime),
      origin: Boolean(data.origin) && !areSameLocations(data.origin, data.destination),
      destination: Boolean(data.destination) && !areSameLocations(data.origin, data.destination),
      passengers: isPositiveInteger(data.passengers),
      luggage: isZeroOrPositiveInteger(data.luggage)
    };

    return validity;
  }

  function validateSingleField(fields, fieldName) {
    var validity;

    validity = validateReservationRequestFields(fields);
    if (!validity || !Object.prototype.hasOwnProperty.call(validity, fieldName)) {
      return true;
    }

    return validity[fieldName];
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

    return true;
  }

    function syncReservationRequestState(fields) {
    var data;
    var canAttemptSubmit;

    if (!hasCriticalFields(fields)) {
      return false;
    }

    syncReservationDateTimeMinimum(fields);

    if (isFormLocked(fields.form)) {
      setSubmitEnabled(fields, false);
      return true;
    }

    data = getReservationRequestData(fields);
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

    if (!hasCriticalFields(fields)) {
      return false;
    }

    if (isFormLocked(fields.form)) {
      return true;
    }

    validity = validateReservationRequestFields(fields);

    if (fieldName && typeof fieldName === 'string') {
      relatedFieldNames = getRelatedValidationFieldNames(fieldName);
      applyPartialValidationState(fields, validity, relatedFieldNames);
      syncReservationRequestState(fields);

      hasPartialErrors = false;

      for (i = 0; i < relatedFieldNames.length; i += 1) {
        if (Object.prototype.hasOwnProperty.call(validity, relatedFieldNames[i]) && !validity[relatedFieldNames[i]]) {
          hasPartialErrors = true;
          break;
        }
      }

      return !hasPartialErrors;
    }

    hasErrors = hasValidationErrors(validity);

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

    if (!field) return;

    wrapper = getFieldWrapper(field);
    errorNode = getFieldErrorNode(fieldName, field.form);

    if (wrapper) {
      wrapper.classList.remove('is-invalid');
    }

    field.setAttribute('aria-invalid', 'false');

    if (errorNode) {
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
      luggage: fields.luggage
    };

    keys = Object.keys(fieldMap);

    for (i = 0; i < keys.length; i += 1) {
      fieldName = keys[i];
      field = fieldMap[fieldName];

      if (!field) continue;

       field.addEventListener('input', (function (currentField, currentFieldName) {
        return function () {
          clearFieldValidationOnInput(currentField, currentFieldName);
          hideGlobalFormError(fields);

          if (currentFieldName === 'trip_date' || currentFieldName === 'trip_time') {
            syncReservationDateTimeMinimum(fields);
          }

          syncReservationRequestState(fields);
        };
      })(field, fieldName));

           field.addEventListener('change', (function (currentField, currentFieldName) {
        return function () {
          clearFieldValidationOnInput(currentField, currentFieldName);
          hideGlobalFormError(fields);

          if (currentFieldName === 'trip_date' || currentFieldName === 'trip_time') {
            syncReservationDateTimeMinimum(fields);
          }

          syncReservationRequestState(fields);
        };
      })(field, fieldName));

      field.addEventListener('blur', (function (currentFieldName, currentFields) {
        return function () {
          refreshValidationUX(currentFields, currentFieldName);
        };
      })(fieldName, fields));
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
      if (isFormLocked(fields.form)) {
        return;
      }

      if (!refreshValidationUX(fields)) {
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
})(window, document);