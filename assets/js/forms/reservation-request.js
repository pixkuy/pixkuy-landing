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
      trip_date: Boolean(data.tripDate),
      trip_time: Boolean(data.tripTime),
      origin: Boolean(data.origin),
      destination: Boolean(data.destination),
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

    if (isFormLocked(fields.form)) {
      setSubmitEnabled(fields, false);
      return true;
    }

    data = getReservationRequestData(fields);
    canAttemptSubmit = hasAttemptableReservationData(data);

    setSubmitEnabled(fields, canAttemptSubmit);
    return true;
  }

  function refreshValidationUX(fields) {
    var validity;
    var hasErrors;

    if (!hasCriticalFields(fields)) {
      return false;
    }

    if (isFormLocked(fields.form)) {
      return true;
    }

    validity = validateReservationRequestFields(fields);
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
          syncReservationRequestState(fields);
        };
      })(field, fieldName));

      field.addEventListener('change', (function (currentField, currentFieldName) {
        return function () {
          clearFieldValidationOnInput(currentField, currentFieldName);
          hideGlobalFormError(fields);
          syncReservationRequestState(fields);
        };
      })(field, fieldName));

      field.addEventListener('blur', (function (currentFieldName, currentFields) {
        return function () {
          var isValid = validateSingleField(currentFields, currentFieldName);
          var currentField = this;

          setFieldValidity(currentField, currentFieldName, isValid);

          if (isValid) {
            hideGlobalFormError(currentFields);
          }

          syncReservationRequestState(currentFields);
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