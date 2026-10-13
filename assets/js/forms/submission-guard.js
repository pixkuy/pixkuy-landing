/* assets/js/forms/submission-guard.js
   Submission guard.
   Responsabilidad:
   - generar idempotencia de envío para form[name="contact"]
   - preparar metadatos de submit antes del POST Netlify
   - limpiar payload semántico de servicios no activos
   - neutralizar names duplicados conocidos antes del submit
   - aplicar lock final de envío
*/

(function initPixkuySubmissionGuard(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const STORAGE_PREFIX = "pixkuy_form_submission_sent:";
  const FORM_CLIENT_VERSION = "pixkuy-contact-v1";
  const ENHANCED_CONVERSION_DATA_STORAGE_KEY = "pixkuy_google_ads_enhanced_conversion_data";
  const LEAD_SUCCESS_CONTEXT_STORAGE_KEY = "pixkuy_lead_success_context";
  const DUPLICATE_NAME_FIELDS = [
    "tour_private_pickup"
  ];

  const SERVICE_FIELD_NAMES = {
    tour_private: [
      "tour_private_trip_summary",
      "tour_private_pickup_label",
      "tour_private_guide_label",
      "tour_private_guide_language_label",
      "tour_private_price_label",
      "tour_private_tour_id",
      "tour_private_tour_label",
      "tour_private_duration_hours",
      "tour_private_passenger_fare_key",
      "tour_private_passenger_bucket_label",
      "tour_private_pickup",
      "tour_private_pickup_place_id",
      "tour_private_pickup_lat",
      "tour_private_pickup_lng",
      "tour_private_date",
      "tour_private_time",
      "tour_private_has_guide",
      "tour_private_guide_language",
      "tour_private_price",
      "tour_private_currency"
    ],


    event_special: [
      "event_special_trip_summary",
      "event_special_event_label",
      "event_special_venue_label",
      "event_special_variant_label",
      "event_special_origin_label",
      "event_special_destination_label",
      "event_special_passenger_bucket_label",
      "event_special_price_label",
      "event_special_event_id",
      "event_special_event_type",
      "event_special_event_starts_at",
      "event_special_venue_id",
      "event_special_variant",
      "event_special_origin_address",
      "event_special_destination_address",
      "event_special_origin_pickup_time",
      "event_special_return_pickup_time",
      "event_special_return_pickup_day_offset",
      "event_special_return_pickup_label",
      "event_special_estimated_event_arrival_time",
      "event_special_estimated_destination_arrival_time",
      "event_special_outbound_duration_seconds",
      "event_special_return_duration_seconds",
      "event_special_outbound_distance_meters",
      "event_special_return_distance_meters",
      "event_special_passenger_fare_key",
      "event_special_price",
      "event_special_currency",
      "event_special_notes",
      "event_special_origin_address_place_id",
      "event_special_origin_address_lat",
      "event_special_origin_address_lng",
      "event_special_destination_address_place_id",
      "event_special_destination_address_lat",
      "event_special_destination_address_lng"
    ],

  };

  function getReservationForm() {
    return document.querySelector('form[name="contact"]');
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getField(form, name) {
    return form ? form.querySelector('[name="' + name + '"]') : null;
  }

  function getFields(form, name) {
    return form ? Array.prototype.slice.call(form.querySelectorAll('[name="' + name + '"]')) : [];
  }

  function getFieldValue(form, name) {
    const field = getField(form, name);
    return field ? normalizeText(field.value) : "";
  }

  function normalizeEmailValue(value) {
    return normalizeText(value).toLowerCase();
  }

  function normalizePhoneValue(value) {
    return String(value || "")
      .trim()
      .replace(/[^\d+]/g, "")
      .replace(/(?!^)\+/g, "");
  }

  function getNameParts(value) {
    const fullName = normalizeText(value);
    const parts = fullName.split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return {
        fullName: "",
        firstName: "",
        lastName: ""
      };
    }

    return {
      fullName: fullName,
      firstName: parts[0] || "",
      lastName: parts.length > 1 ? parts.slice(1).join(" ") : ""
    };
  }

  function getEnhancedConversionData(form) {
    const nameParts = getNameParts(getFieldValue(form, "name"));
    const email = normalizeEmailValue(getFieldValue(form, "email"));
    const phone = normalizePhoneValue(getFieldValue(form, "phone"));

    if (!nameParts.fullName && !email && !phone) {
      return null;
    }

    return {
      full_name: nameParts.fullName,
      first_name: nameParts.firstName,
      last_name: nameParts.lastName,
      email: email,
      phone_number: phone
    };
  }
  
    function parsePositiveContextNumber(value) {
    const normalizedValue = normalizeText(value).replace(/[^\d.]/g, "");
    const numericValue = Number(normalizedValue);

    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : null;
  }

  function setContextValue(context, key, value) {
    const normalizedValue = normalizeText(value);

    if (!context || !key || !normalizedValue) {
      return false;
    }

    context[key] = normalizedValue;
    return true;
  }

  function setContextNumber(context, key, value) {
    const numericValue = parsePositiveContextNumber(value);

    if (!context || !key || numericValue === null) {
      return false;
    }

    context[key] = numericValue;
    return true;
  }

  function getViewportContext() {
    return window.matchMedia && window.matchMedia("(max-width: 720px)").matches
      ? "mobile"
      : "desktop";
  }

  function getFlowSurfaceContext() {
    const body = document.body;

    if (
      body &&
      (
        body.getAttribute("data-airport-mobile-screen") === "true" ||
        body.getAttribute("data-hourly-mobile-screen") === "true" ||
        body.getAttribute("data-tours-mobile-screen") === "true" ||
        body.getAttribute("data-events-mobile-screen") === "true"
      )
    ) {
      return "mobile_route";
    }

    return "";
  }

  function getLeadSuccessContext(form, activeServiceType) {
    const serviceType = normalizeText(activeServiceType);
    const context = {
      service_type: serviceType || "other",
      viewport: getViewportContext()
    };
    const flowSurface = getFlowSurfaceContext();

    if (flowSurface) {
      context.flow_surface = flowSurface;
    }

    if (serviceType === "tour_private") {
      setContextValue(context, "tour_id", getFieldValue(form, "tour_private_tour_id"));
      setContextValue(context, "passenger_fare_key", getFieldValue(form, "tour_private_passenger_fare_key"));
      setContextValue(context, "has_guide", getFieldValue(form, "tour_private_has_guide"));
      setContextNumber(context, "price", getFieldValue(form, "tour_private_price"));
      setContextValue(context, "currency", getFieldValue(form, "tour_private_currency"));
    }



    if (serviceType === "event_special") {
      setContextValue(context, "event_id", getFieldValue(form, "event_special_event_id"));
      setContextValue(context, "venue_id", getFieldValue(form, "event_special_venue_id"));
      setContextValue(context, "variant", getFieldValue(form, "event_special_variant"));
      setContextValue(context, "passenger_fare_key", getFieldValue(form, "event_special_passenger_fare_key"));
      setContextNumber(context, "price", getFieldValue(form, "event_special_price"));
      setContextValue(context, "currency", getFieldValue(form, "event_special_currency"));
      setContextNumber(context, "outbound_distance_meters", getFieldValue(form, "event_special_outbound_distance_meters"));
      setContextNumber(context, "return_distance_meters", getFieldValue(form, "event_special_return_distance_meters"));
      setContextNumber(context, "outbound_duration_seconds", getFieldValue(form, "event_special_outbound_duration_seconds"));
      setContextNumber(context, "return_duration_seconds", getFieldValue(form, "event_special_return_duration_seconds"));
    }

    return context;
  }

  function storeLeadSuccessContext(form, activeServiceType) {
    const context = getLeadSuccessContext(form, activeServiceType);

    try {
      window.sessionStorage.setItem(
        LEAD_SUCCESS_CONTEXT_STORAGE_KEY,
        JSON.stringify(context)
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function storeEnhancedConversionData(form) {
    const data = getEnhancedConversionData(form);

    if (!data) {
      return false;
    }

    try {
      window.sessionStorage.setItem(
        ENHANCED_CONVERSION_DATA_STORAGE_KEY,
        JSON.stringify(data)
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureHiddenField(form, name) {
    let field = getField(form, name);

    if (field) {
      return field;
    }

    field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = "";
    form.appendChild(field);

    return field;
  }

  function createSubmissionId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return [
      "pixkuy",
      Date.now(),
      Math.random().toString(36).slice(2, 12)
    ].join("-");
  }

  function getStorageKey(submissionId) {
    return STORAGE_PREFIX + submissionId;
  }

  function hasStoredSubmission(submissionId) {
    if (!submissionId) {
      return false;
    }

    try {
      return window.sessionStorage.getItem(getStorageKey(submissionId)) === "1";
    } catch (error) {
      return false;
    }
  }

  function storeSubmission(submissionId) {
    if (!submissionId) {
      return false;
    }

    try {
      window.sessionStorage.setItem(getStorageKey(submissionId), "1");
      return true;
    } catch (error) {
      return false;
    }
  }

  function restoreGuardDisabledFields(form) {
    if (!form) {
      return false;
    }

    Array.prototype.slice
      .call(form.querySelectorAll("[data-submission-guard-disabled='1']"))
      .forEach(function restore(field) {
        field.disabled = false;
        field.removeAttribute("data-submission-guard-disabled");
      });

    return true;
  }

  function disableFieldForSubmit(field) {
    if (!field) {
      return false;
    }

    field.disabled = true;
    field.setAttribute("data-submission-guard-disabled", "1");

    return true;
  }

  function clearFieldGroup(form, fieldNames) {
    if (!form || !Array.isArray(fieldNames)) {
      return false;
    }

    fieldNames.forEach(function clearName(name) {
      getFields(form, name).forEach(function clearField(field) {
        field.value = "";
        disableFieldForSubmit(field);
      });
    });

    return true;
  }

  function cleanInactiveServicePayload(form, activeServiceType) {
    Object.keys(SERVICE_FIELD_NAMES).forEach(function cleanService(serviceType) {
      if (serviceType === activeServiceType) {
        return;
      }

      clearFieldGroup(form, SERVICE_FIELD_NAMES[serviceType]);
    });

    return true;
  }

  function normalizeDuplicateNameField(form, name) {
    const fields = getFields(form, name).filter(function isEnabled(field) {
      return !field.disabled;
    });

    let canonical;
    let source;

    if (fields.length <= 1) {
      return true;
    }

    canonical = fields.find(function findHidden(field) {
      return String(field.type || "").toLowerCase() === "hidden";
    }) || fields[0];

    source = fields.find(function findNonEmpty(field) {
      return normalizeText(field.value);
    });

    if (source && canonical !== source && !normalizeText(canonical.value)) {
      canonical.value = source.value;
    }

    fields.forEach(function disableDuplicate(field) {
      if (field === canonical) {
        return;
      }

      disableFieldForSubmit(field);
    });

    return true;
  }

  function normalizeDuplicateNameFields(form) {
    DUPLICATE_NAME_FIELDS.forEach(function normalizeName(name) {
      normalizeDuplicateNameField(form, name);
    });

    return true;
  }

  function getActiveServiceType(form, explicitServiceType) {
    return normalizeText(explicitServiceType) || getFieldValue(form, "service_type") || "other";
  }

  function ensureSubmissionMetadata(form) {
    const submissionIdField = ensureHiddenField(form, "submission_id");
    const submittedAtField = ensureHiddenField(form, "submitted_at_client");
    const versionField = ensureHiddenField(form, "form_client_version");

    if (!normalizeText(submissionIdField.value)) {
      submissionIdField.value = createSubmissionId();
    }

    submittedAtField.value = new Date().toISOString();
    versionField.value = FORM_CLIENT_VERSION;

    return submissionIdField.value;
  }

  function lockForm(form) {
    const buttons = form
      ? Array.prototype.slice.call(form.querySelectorAll('button[type="submit"], [data-airport-mobile-contact-submit], [data-tours-mobile-contact-submit], [data-events-mobile-contact-submit]'))
      : [];

    if (!form) {
      return false;
    }

    form.dataset.submitted = "1";
    form.setAttribute("aria-busy", "true");

    buttons.forEach(function disableButton(button) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });

    return true;
  }

  function isFormLocked(form) {
    return Boolean(
      form &&
      (
        form.dataset.submitted === "1" ||
        form.getAttribute("aria-busy") === "true"
      )
    );
  }

  function prepareSubmit(form, explicitServiceType) {
    const activeServiceType = getActiveServiceType(form, explicitServiceType);
    let submissionId;

    if (!form) {
      return false;
    }

    if (isFormLocked(form)) {
      return false;
    }

    submissionId = ensureSubmissionMetadata(form);

    if (hasStoredSubmission(submissionId)) {
      lockForm(form);
      return false;
    }

    restoreGuardDisabledFields(form);
    cleanInactiveServicePayload(form, activeServiceType);
    normalizeDuplicateNameFields(form);
    storeEnhancedConversionData(form);
    storeLeadSuccessContext(form, activeServiceType);

    storeSubmission(submissionId);
    lockForm(form);

    return true;
  }

  function releaseFailedSubmit(form) {
    if (!form) return;
    const submissionId = getFieldValue(form, "submission_id");
    try {
      window.sessionStorage.removeItem(getStorageKey(submissionId));
      window.sessionStorage.removeItem(ENHANCED_CONVERSION_DATA_STORAGE_KEY);
      window.sessionStorage.removeItem(LEAD_SUCCESS_CONTEXT_STORAGE_KEY);
    } catch (error) {
      // Do not infer reception from a failed/unknown HTTP result.
    }
    delete form.dataset.submitted;
    form.removeAttribute("aria-busy");
    restoreGuardDisabledFields(form);
    Array.from(form.querySelectorAll('button[type="submit"]')).forEach(function (button) {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    });
    const api = window.PixkuyForms;
    if (api && api.getReservationRequestFields && api.syncReservationRequestState) {
      api.syncReservationRequestState(api.getReservationRequestFields(form));
    }
  }

  window.PixkuySubmissionGuard = {
    releaseFailedSubmit: releaseFailedSubmit,
    prepareSubmit: prepareSubmit,
    isFormLocked: isFormLocked,
    lockForm: lockForm,
    getReservationForm: getReservationForm
  };
})(window, document);
