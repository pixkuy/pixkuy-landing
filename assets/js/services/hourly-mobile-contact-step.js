/* assets/js/services/hourly-mobile-contact-step.js
   Hourly / Daily mobile contact step.
   Responsabilidad:
   - crear la segunda pantalla móvil del flujo Hourly / Daily
   - mostrar resumen compacto del servicio configurado
   - recoger datos personales mínimos
   - usar form[name="contact"] como infraestructura técnica de envío Netlify
   - no hacer scroll a #contact
   - no activar el handoff visual legacy
   - no tocar Google Places, Google Ads ni success modal
*/

(function initHourlyMobileContactStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const CONTACT_STEP_SELECTOR = "[data-hourly-mobile-contact-step]";
  const CONTACT_STEP_ACTIVE_ATTR = "data-hourly-mobile-contact-step-active";
  const PRIMARY_STEP_HIDDEN_ATTR = "data-hourly-mobile-primary-step-hidden";

  const FIELD_NAME = "name";
  const FIELD_PHONE = "phone";
  const FIELD_EMAIL = "email";
  const FIELD_NOTES = "notes";

  const MODE_HOURLY = "hourly";
  const MODE_FULL_DAY = "full_day";
  const MODE_LONG_TERM = "custom_long_term";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let contactStepNode = null;
  let currentPanel = null;
  let currentSnapshot = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizePhoneValue(value) {
    return String(value || "")
      .trim()
      .replace(/[^\d+]/g, "")
      .replace(/(?!^)\+/g, "");
  }

  function getPhoneLibrary() {
    return window.libphonenumber || null;
  }

  function parseInternationalPhoneNumber(value) {
    const phoneLibrary = getPhoneLibrary();
    const normalizedValue = normalizePhoneValue(value);
    let parsedNumber;

    if (!phoneLibrary || !normalizedValue || normalizedValue.charAt(0) !== "+") {
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

  function isValidPhone(value) {
    const normalizedValue = normalizePhoneValue(value);

    if (!/^\+[1-9]\d{6,14}$/.test(normalizedValue)) {
      return false;
    }

    if (!getPhoneLibrary()) {
      return true;
    }

    return Boolean(parseInternationalPhoneNumber(normalizedValue));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
  }

  function getI18nValue(path, fallback) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = String(path || "").split(".");
    let cursor = dict;
    let index;
    let value;

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      value = getValue(dict, path);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function getReservationFormsApi() {
    const api = window.PixkuyForms;

    if (!api || typeof api !== "object") {
      return null;
    }

    if (
      typeof api.getReservationForm !== "function" ||
      typeof api.getReservationRequestFields !== "function" ||
      typeof api.syncReservationRequestState !== "function"
    ) {
      return null;
    }

    return api;
  }

  function getServiceLabel() {
    return getI18nValue("contact.services.hourlyDaily", "");
  }

  function getModeLabel(mode) {
    if (mode === MODE_FULL_DAY) {
      return getI18nValue("services.cards.hourly.panel.tabs.fullDay", "");
    }

    if (mode === MODE_LONG_TERM) {
      return getI18nValue("services.cards.hourly.panel.tabs.longTerm", "");
    }

    return getI18nValue("services.cards.hourly.panel.tabs.hourly", "");
  }

  function getLongTermLabel(option) {
    if (option === "week") {
      return getI18nValue("services.cards.hourly.panel.longTerm.week", "");
    }

    if (option === "fortnight") {
      return getI18nValue("services.cards.hourly.panel.longTerm.fortnight", "");
    }

    if (option === "monthly") {
      return getI18nValue("services.cards.hourly.panel.longTerm.monthly", "");
    }

    if (option === "custom") {
      return getI18nValue("services.cards.hourly.panel.longTerm.custom", "");
    }

    return "";
  }

  function formatCurrencyValue(value, currency) {
    const safeCurrency = normalizeText(currency) || "MXN";
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: 0
      }).format(numericValue) + " " + safeCurrency;
    } catch (error) {
      return String(value) + " " + safeCurrency;
    }
  }

  function getDurationLabel(snapshot) {
    const safeSnapshot = snapshot || {};
    const mode = normalizeText(safeSnapshot.hourly_daily_mode);
    const duration = normalizeText(safeSnapshot.hourly_daily_duration_hours);
    const customTerm = normalizeText(safeSnapshot.hourly_daily_custom_term);

    if (mode === MODE_FULL_DAY) {
      return getModeLabel(MODE_FULL_DAY);
    }

    if (mode === MODE_LONG_TERM) {
      return getLongTermLabel(customTerm);
    }

    return duration ? duration + "h" : "";
  }

  function getPriceLabel(snapshot) {
    const safeSnapshot = snapshot || {};
    const mode = normalizeText(safeSnapshot.hourly_daily_mode);
    const price = normalizeText(safeSnapshot.hourly_daily_price);
    const currency = normalizeText(safeSnapshot.hourly_daily_currency);

    if (mode === MODE_LONG_TERM) {
      return getI18nValue("services.cards.hourly.panel.longTermPriceValue", "");
    }

    return price ? formatCurrencyValue(price, currency) : "";
  }

  function buildSnapshotFromPayload(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const mode = normalizeText(safePayload.hourly_daily_mode);
    const price = normalizeText(
      typeof safePayload.hourly_daily_price === "number"
        ? String(safePayload.hourly_daily_price)
        : safePayload.hourly_daily_price
    );
    const currency = normalizeText(safePayload.hourly_daily_currency);

    return {
      serviceType: "hourly_daily",
      hourly_daily_mode:
        mode === MODE_HOURLY || mode === MODE_FULL_DAY || mode === MODE_LONG_TERM
          ? mode
          : "",
      hourly_daily_vehicle_type: normalizeText(safePayload.hourly_daily_vehicle_type),
      hourly_daily_pickup: normalizeText(safePayload.hourly_daily_pickup),
      hourly_daily_pickup_place_id: normalizeText(safePayload.hourly_daily_pickup_place_id),
      hourly_daily_pickup_lat: normalizeText(safePayload.hourly_daily_pickup_lat),
      hourly_daily_pickup_lng: normalizeText(safePayload.hourly_daily_pickup_lng),
      hourly_daily_date: normalizeText(safePayload.hourly_daily_date),
      hourly_daily_start_time: normalizeText(safePayload.hourly_daily_start_time),
      hourly_daily_duration_hours: normalizeText(safePayload.hourly_daily_duration_hours),
      hourly_daily_custom_term: normalizeText(safePayload.hourly_daily_custom_term),
      hourly_daily_notes: normalizeText(safePayload.hourly_daily_notes),
      hourly_daily_price: price,
      hourly_daily_currency: currency,
      hourly_daily_km_included: normalizeText(safePayload.hourly_daily_km_included),
      hourly_daily_extra_km_price: normalizeText(safePayload.hourly_daily_extra_km_price),
      hourly_daily_out_of_zone_supplement: normalizeText(safePayload.hourly_daily_out_of_zone_supplement)
    };
  }

  function hasCompleteHourlySnapshot(snapshot) {
    const safeSnapshot = snapshot || {};
    const mode = normalizeText(safeSnapshot.hourly_daily_mode);

    if (
      !mode ||
      !safeSnapshot.hourly_daily_pickup ||
      !safeSnapshot.hourly_daily_date ||
      !safeSnapshot.hourly_daily_start_time
    ) {
      return false;
    }

    if (mode === MODE_LONG_TERM) {
      return Boolean(safeSnapshot.hourly_daily_custom_term);
    }

    return Boolean(
      safeSnapshot.hourly_daily_duration_hours &&
      safeSnapshot.hourly_daily_price &&
      safeSnapshot.hourly_daily_currency
    );
  }

  function getContactField(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-hourly-mobile-contact-field="' + name + '"]')
      : null;
  }

  function getContactError(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-hourly-mobile-contact-error="' + name + '"]')
      : null;
  }

  function setText(node, value) {
    if (!node) {
      return false;
    }

    node.textContent = value || "";
    return true;
  }

  function setHidden(node, isHidden) {
    if (!node) {
      return false;
    }

    node.hidden = Boolean(isHidden);
    return true;
  }

  function setInputValue(input, value) {
    if (!input) {
      return false;
    }

    input.value = value || "";
    return true;
  }

  function dispatchInputEvents(input) {
    if (!input) {
      return false;
    }

    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));

    return true;
  }

  function writeFormValue(form, name, value, shouldDispatch) {
    const field = form ? form.querySelector('[name="' + name + '"]') : null;

    if (!field) {
      return false;
    }

    setInputValue(field, value);

    if (shouldDispatch === true) {
      dispatchInputEvents(field);
    }

    return true;
  }

  function buildSummaryRow(key) {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");

    row.className = "hourly-mobile-contact-step__summary-row";
    row.setAttribute("data-hourly-mobile-contact-summary-row", key);

    label.className = "hourly-mobile-contact-step__summary-label";
    label.setAttribute("data-hourly-mobile-contact-summary-label", key);

    value.className = "hourly-mobile-contact-step__summary-value";
    value.setAttribute("data-hourly-mobile-contact-summary-value", key);

    row.appendChild(label);
    row.appendChild(value);

    return row;
  }

  function buildField(name, type, autocomplete) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const field =
      name === FIELD_NOTES
        ? document.createElement("textarea")
        : document.createElement("input");
    const error = document.createElement("p");
    const fieldId = "hourly-mobile-contact-" + name;

    wrapper.className = "hourly-mobile-contact-step__field";
    wrapper.setAttribute("data-hourly-mobile-contact-field-wrapper", name);

    label.className = "hourly-mobile-contact-step__label";
    label.setAttribute("for", fieldId);
    label.setAttribute("data-hourly-mobile-contact-label", name);

    field.id = fieldId;
    field.className = "hourly-mobile-contact-step__control";
    field.setAttribute("data-hourly-mobile-contact-field", name);
    field.setAttribute("aria-describedby", fieldId + "-error");

    if (name === FIELD_NOTES) {
      field.rows = 2;
    } else {
      field.type = type || "text";
    }

    if (autocomplete) {
      field.setAttribute("autocomplete", autocomplete);
    }

    if (name === FIELD_PHONE) {
      field.setAttribute("inputmode", "tel");
      field.setAttribute("autocapitalize", "off");
      field.setAttribute("spellcheck", "false");
    }

    error.id = fieldId + "-error";
    error.className = "hourly-mobile-contact-step__error";
    error.setAttribute("data-hourly-mobile-contact-error", name);
    error.hidden = true;

    wrapper.appendChild(label);
    wrapper.appendChild(field);
    wrapper.appendChild(error);

    return wrapper;
  }

  function buildContactStepNode() {
    const root = document.createElement("section");
    const backRow = document.createElement("div");
    const back = document.createElement("button");
    const summary = document.createElement("section");
    const summaryTitle = document.createElement("p");
    const summaryList = document.createElement("dl");
    const form = document.createElement("div");
    const actions = document.createElement("div");
    const submit = document.createElement("button");
    const globalError = document.createElement("p");

    root.className = "hourly-mobile-contact-step";
    root.setAttribute("data-hourly-mobile-contact-step", "1");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;

    backRow.className = "hourly-mobile-flow__back-row";

    back.type = "button";
    back.className = "hourly-mobile-flow__back";
    back.setAttribute("data-hourly-mobile-contact-back", "1");

    summary.className = "hourly-mobile-contact-step__summary";
    summary.setAttribute("data-hourly-mobile-contact-summary", "1");

    summaryTitle.className = "hourly-mobile-contact-step__summary-title";
    summaryTitle.setAttribute("data-hourly-mobile-contact-summary-title", "1");

    summaryList.className = "hourly-mobile-contact-step__summary-list";
    summaryList.setAttribute("data-hourly-mobile-contact-summary-list", "1");

    [
      "mode",
      "pickup",
      "date",
      "time",
      "duration",
      "vehicle",
      "price",
      "notes"
    ].forEach(function appendRow(key) {
      summaryList.appendChild(buildSummaryRow(key));
    });

    form.className = "hourly-mobile-contact-step__form";
    form.setAttribute("data-hourly-mobile-contact-form", "1");

    form.appendChild(buildField(FIELD_NAME, "text", "name"));
    form.appendChild(buildField(FIELD_PHONE, "tel", "tel"));
    form.appendChild(buildField(FIELD_EMAIL, "email", "email"));

    globalError.className = "hourly-mobile-contact-step__global-error";
    globalError.setAttribute("data-hourly-mobile-contact-global-error", "1");
    globalError.hidden = true;

    actions.className = "hourly-mobile-contact-step__actions";

    submit.type = "button";
    submit.className = "hourly-mobile-contact-step__submit";
    submit.setAttribute("data-hourly-mobile-contact-submit", "1");

    actions.appendChild(submit);

    backRow.appendChild(back);

    summary.appendChild(summaryTitle);
    summary.appendChild(summaryList);

    root.appendChild(backRow);
    root.appendChild(summary);
    root.appendChild(form);
    root.appendChild(globalError);
    root.appendChild(actions);

    return root;
  }

  function ensureContactStepNode(panel) {
    const routeContent = panel && panel.parentNode ? panel.parentNode : null;

    if (contactStepNode) {
      return contactStepNode;
    }

    contactStepNode = document.querySelector(CONTACT_STEP_SELECTOR);

    if (!contactStepNode) {
      contactStepNode = buildContactStepNode();

      if (routeContent) {
        routeContent.appendChild(contactStepNode);
      } else {
        document.body.appendChild(contactStepNode);
      }
    }

    bindContactStepEvents();
    syncCopy();

    return contactStepNode;
  }

  function getSummaryValueNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-hourly-mobile-contact-summary-value="' + key + '"]'
        )
      : null;
  }

  function getSummaryLabelNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-hourly-mobile-contact-summary-label="' + key + '"]'
        )
      : null;
  }

  function syncSummary(snapshot) {
    const safeSnapshot = snapshot || {};
    const summaryTitle = contactStepNode
      ? contactStepNode.querySelector("[data-hourly-mobile-contact-summary-title]")
      : null;

    setText(
      summaryTitle,
      getI18nValue("services.cards.hourly.mobileFlow.contactStep.summary.title", "")
    );

    const values = {
      mode: getModeLabel(safeSnapshot.hourly_daily_mode),
      pickup: safeSnapshot.hourly_daily_pickup || "",
      date: safeSnapshot.hourly_daily_date || "",
      time: safeSnapshot.hourly_daily_start_time || "",
      duration: getDurationLabel(safeSnapshot),
      vehicle: "ByD M9",
      price: getPriceLabel(safeSnapshot),
      notes: safeSnapshot.hourly_daily_notes || ""
    };

    Object.keys(values).forEach(function syncValue(key) {
      setText(getSummaryValueNode(key), values[key]);
    });

    return true;
  }

  function syncCopy() {
    const root = contactStepNode;
    const back = root
      ? root.querySelector("[data-hourly-mobile-contact-back]")
      : null;
    const submit = root
      ? root.querySelector("[data-hourly-mobile-contact-submit]")
      : null;
    const globalError = root
      ? root.querySelector("[data-hourly-mobile-contact-global-error]")
      : null;

    if (!root) {
      return false;
    }

    setText(
      back,
      getI18nValue(
        "services.cards.hourly.mobileFlow.contactStep.notesEditor.close",
        getI18nValue("services.cards.airport.panel.back", "")
      )
    );
    setText(
      submit,
      getI18nValue("services.cards.hourly.mobileFlow.contactStep.cta.submit", "")
    );
    setText(
      globalError,
      getI18nValue("services.cards.hourly.mobileFlow.contactStep.validation.formIncomplete", "")
    );

    ["mode", "pickup", "date", "time", "duration", "vehicle", "price", "notes"]
      .forEach(function syncSummaryLabel(key) {
        setText(
          getSummaryLabelNode(key),
          getI18nValue(
            "services.cards.hourly.mobileFlow.contactStep.summary." + key,
            ""
          )
        );
      });

    [FIELD_NAME, FIELD_PHONE, FIELD_EMAIL]
      .forEach(function syncFieldCopy(name) {
        const field = getContactField(name);
        const label = root.querySelector(
          '[data-hourly-mobile-contact-label="' + name + '"]'
        );
        const error = getContactError(name);
        const fieldLabel = getI18nValue(
          "services.cards.hourly.mobileFlow.contactStep.fields." + name,
          ""
        );
        const placeholder = getI18nValue(
          "services.cards.hourly.mobileFlow.contactStep.placeholders." + name,
          ""
        );

        setText(label, fieldLabel);

        if (field) {
          field.setAttribute("placeholder", placeholder);
          field.setAttribute("aria-label", fieldLabel);
        }

        setText(
          error,
          getI18nValue(
            "services.cards.hourly.mobileFlow.contactStep.validation." + name,
            ""
          )
        );
      });

    return true;
  }

  function setFieldValidity(name, isValid) {
    const field = getContactField(name);
    const wrapper = contactStepNode
      ? contactStepNode.querySelector(
          '[data-hourly-mobile-contact-field-wrapper="' + name + '"]'
        )
      : null;
    const error = getContactError(name);

    if (wrapper) {
      wrapper.classList.toggle("is-invalid", !isValid);
    }

    if (field) {
      field.setAttribute("aria-invalid", isValid ? "false" : "true");
    }

    if (error) {
      error.hidden = isValid;
    }

    return isValid;
  }

  function hideGlobalError() {
    const error = contactStepNode
      ? contactStepNode.querySelector("[data-hourly-mobile-contact-global-error]")
      : null;

    setHidden(error, true);
    return true;
  }

  function showGlobalError() {
    const error = contactStepNode
      ? contactStepNode.querySelector("[data-hourly-mobile-contact-global-error]")
      : null;

    setHidden(error, false);
    return true;
  }

  function hasFilledContactData() {
    const nameField = getContactField(FIELD_NAME);
    const phoneField = getContactField(FIELD_PHONE);
    const emailField = getContactField(FIELD_EMAIL);
    const name = normalizeText(nameField && nameField.value);
    const phone = normalizePhoneValue(phoneField && phoneField.value);
    const email = normalizeText(emailField && emailField.value);

    return Boolean(name && phone && email);
  }

  function hasRequiredContactData() {
    const nameField = getContactField(FIELD_NAME);
    const phoneField = getContactField(FIELD_PHONE);
    const emailField = getContactField(FIELD_EMAIL);
    const name = normalizeText(nameField && nameField.value);
    const phone = normalizePhoneValue(phoneField && phoneField.value);
    const email = normalizeText(emailField && emailField.value);

    return Boolean(name && isValidPhone(phone) && isValidEmail(email));
  }

  function syncSubmitAvailability() {
    const submit = contactStepNode
      ? contactStepNode.querySelector("[data-hourly-mobile-contact-submit]")
      : null;
    const isReady = hasFilledContactData();

    if (!submit) {
      return false;
    }

    submit.disabled = !isReady;
    submit.setAttribute("aria-disabled", isReady ? "false" : "true");
    submit.setAttribute("data-hourly-mobile-contact-submit-ready", isReady ? "true" : "false");

    return true;
  }

  function clearValidationForField(name) {
    setFieldValidity(name, true);
    hideGlobalError();
  }

  function validateContactStep() {
    const name = normalizeText(getContactField(FIELD_NAME).value);
    const phone = normalizePhoneValue(getContactField(FIELD_PHONE).value);
    const email = normalizeText(getContactField(FIELD_EMAIL).value);
    const validity = {
      name: Boolean(name),
      phone: isValidPhone(phone),
      email: isValidEmail(email)
    };
    const hasErrors = Object.keys(validity).some(function hasInvalidField(key) {
      return validity[key] !== true;
    });

    Object.keys(validity).forEach(function applyValidity(key) {
      setFieldValidity(key, validity[key]);
    });

    if (hasErrors) {
      showGlobalError();
      return false;
    }

    hideGlobalError();
    return true;
  }

  function getContactData() {
    return {
      name: normalizeText(getContactField(FIELD_NAME).value),
      phone: normalizePhoneValue(getContactField(FIELD_PHONE).value),
      email: normalizeText(getContactField(FIELD_EMAIL).value),
      notes: normalizeText(currentSnapshot && currentSnapshot.hourly_daily_notes)
    };
  }

  function buildRequestSummary(snapshot) {
    const safeSnapshot = snapshot || {};
    const parts = [];
    const labels = {
      mode: getI18nValue("services.cards.hourly.panel.modeLabel", ""),
      pickup: getI18nValue("services.cards.hourly.panel.pickupLabel", ""),
      date: getI18nValue("services.cards.hourly.panel.dateLabel", ""),
      time: getI18nValue("services.cards.hourly.panel.timeLabel", ""),
      duration: safeSnapshot.hourly_daily_mode === MODE_LONG_TERM
        ? getI18nValue("services.cards.hourly.panel.longTermDurationLabel", "")
        : getI18nValue("services.cards.hourly.panel.durationLabel", ""),
      price: safeSnapshot.hourly_daily_mode === MODE_LONG_TERM
        ? getI18nValue("services.cards.hourly.panel.longTermPriceLabel", "")
        : getI18nValue("services.cards.hourly.panel.priceLabel", "")
    };

    if (safeSnapshot.hourly_daily_mode) {
      parts.push(labels.mode + ": " + getModeLabel(safeSnapshot.hourly_daily_mode));
    }

    if (safeSnapshot.hourly_daily_pickup) {
      parts.push(labels.pickup + ": " + safeSnapshot.hourly_daily_pickup);
    }

    if (safeSnapshot.hourly_daily_date) {
      parts.push(labels.date + ": " + safeSnapshot.hourly_daily_date);
    }

    if (safeSnapshot.hourly_daily_start_time) {
      parts.push(labels.time + ": " + safeSnapshot.hourly_daily_start_time);
    }

    if (getDurationLabel(safeSnapshot)) {
      parts.push(labels.duration + ": " + getDurationLabel(safeSnapshot));
    }

    if (getPriceLabel(safeSnapshot)) {
      parts.push(labels.price + ": " + getPriceLabel(safeSnapshot));
    }

    return parts.filter(Boolean).join(" | ");
  }

  function fillReservationForm(snapshot, contactData, options) {
    const formsApi = getReservationFormsApi();
    const form = formsApi ? formsApi.getReservationForm() : null;
    const fields = form && formsApi ? formsApi.getReservationRequestFields(form) : null;
    const summary = buildRequestSummary(snapshot);
    const safeOptions = options && typeof options === "object" ? options : {};

    if (!form || !fields) {
      return false;
    }

    writeFormValue(form, "service_type", "hourly_daily", false);

    writeFormValue(form, "name", contactData.name, true);
    writeFormValue(form, "phone", contactData.phone, true);
    writeFormValue(form, "email", contactData.email, true);

    writeFormValue(form, "trip_date", snapshot.hourly_daily_date, true);
    writeFormValue(form, "trip_time", snapshot.hourly_daily_start_time, true);
    writeFormValue(form, "origin", snapshot.hourly_daily_pickup, true);
    writeFormValue(form, "destination", "", true);
    writeFormValue(form, "passengers", "", true);
    writeFormValue(form, "luggage", "", true);
    writeFormValue(form, "message", contactData.notes || snapshot.hourly_daily_notes, true);

    writeFormValue(form, "service_label", getServiceLabel(), false);
    writeFormValue(form, "request_summary", summary, false);
    writeFormValue(form, "hourly_daily_trip_summary", summary, false);
    writeFormValue(form, "hourly_daily_pickup_label", snapshot.hourly_daily_pickup, false);
    writeFormValue(form, "hourly_daily_mode_label", getModeLabel(snapshot.hourly_daily_mode), false);
    writeFormValue(form, "hourly_daily_duration_label", getDurationLabel(snapshot), false);
    writeFormValue(form, "hourly_daily_price_label", getPriceLabel(snapshot), false);

    writeFormValue(form, "hourly_daily_mode", snapshot.hourly_daily_mode, false);
    writeFormValue(form, "hourly_daily_vehicle_type", snapshot.hourly_daily_vehicle_type, false);
    writeFormValue(form, "hourly_daily_pickup", snapshot.hourly_daily_pickup, false);
    writeFormValue(form, "hourly_daily_pickup_place_id", snapshot.hourly_daily_pickup_place_id, false);
    writeFormValue(form, "hourly_daily_pickup_lat", snapshot.hourly_daily_pickup_lat, false);
    writeFormValue(form, "hourly_daily_pickup_lng", snapshot.hourly_daily_pickup_lng, false);
    writeFormValue(form, "hourly_daily_date", snapshot.hourly_daily_date, false);
    writeFormValue(form, "hourly_daily_start_time", snapshot.hourly_daily_start_time, false);
    writeFormValue(form, "hourly_daily_duration_hours", snapshot.hourly_daily_duration_hours, false);
    writeFormValue(form, "hourly_daily_custom_term", snapshot.hourly_daily_custom_term, false);
    writeFormValue(form, "hourly_daily_notes", contactData.notes || snapshot.hourly_daily_notes, false);
    writeFormValue(form, "hourly_daily_price", snapshot.hourly_daily_price, false);
    writeFormValue(form, "hourly_daily_currency", snapshot.hourly_daily_currency, false);
    writeFormValue(form, "hourly_daily_km_included", snapshot.hourly_daily_km_included, false);
    writeFormValue(form, "hourly_daily_extra_km_price", snapshot.hourly_daily_extra_km_price, false);
    writeFormValue(form, "hourly_daily_out_of_zone_supplement", snapshot.hourly_daily_out_of_zone_supplement, false);

    formsApi.syncReservationRequestState(fields);

    if (safeOptions.skipLegacyValidation === true) {
      return true;
    }

    if (typeof formsApi.refreshReservationRequestValidationUX === "function") {
      return formsApi.refreshReservationRequestValidationUX(fields);
    }

    return true;
  }
  
    function trackHourlyMobileContactRequest(snapshot) {
    const analytics = window.PixkuyAnalytics;
    const safeSnapshot = snapshot || {};
    const mode = normalizeText(safeSnapshot.hourly_daily_mode);
    const rawDurationHours = normalizeText(safeSnapshot.hourly_daily_duration_hours);
    const rawPrice = normalizeText(safeSnapshot.hourly_daily_price);
    const durationHours = rawDurationHours ? Number(rawDurationHours) : NaN;
    const price = rawPrice ? Number(rawPrice) : NaN;
    const currency = normalizeText(safeSnapshot.hourly_daily_currency);
    const payload = {
      service_type: "hourly_daily",
      mode: mode,
      flow_surface: "mobile_route"
    };

    if (Number.isFinite(durationHours)) {
      payload.duration_hours = durationHours;
    }

    if (Number.isFinite(price)) {
      payload.price = price;
    }

    if (currency) {
      payload.currency = currency;
    }

    if (!analytics || typeof analytics.track !== "function") {
      return false;
    }

    if (typeof analytics.hasConsent === "function" && !analytics.hasConsent()) {
      return false;
    }

    analytics.track("pixkuy_contact_request", payload);
    return true;
  }
  
    function isTransactionalHourlySnapshot(snapshot) {
    const mode = normalizeText(snapshot && snapshot.hourly_daily_mode);

    return mode === MODE_HOURLY || mode === MODE_FULL_DAY;
  }

  function isHourlyBookingApiCheckoutBridgeReady() {
    return Boolean(
      document.documentElement &&
      document.documentElement.dataset.hourlyBookingApiCheckoutBound === "1"
    );
  }

  function dispatchTransactionalCheckoutSubmit(form) {
    if (!form || !isHourlyBookingApiCheckoutBridgeReady()) {
      return false;
    }

    form.dispatchEvent(
      new window.Event("submit", {
        bubbles: true,
        cancelable: true
      })
    );

    return true;
  }

  function submitContactStep() {
    const formsApi = getReservationFormsApi();
    const form = formsApi ? formsApi.getReservationForm() : null;
    const snapshot = currentSnapshot;
    const contactData = getContactData();
    const isContactValid = validateContactStep();
    let isFormValid;

    if (!isContactValid) {
      return false;
    }

    if (!hasCompleteHourlySnapshot(snapshot)) {
      showGlobalError();
      return false;
    }

    isFormValid = fillReservationForm(snapshot, contactData, {
      skipLegacyValidation: isTransactionalHourlySnapshot(snapshot)
    });

    if (!isFormValid) {
      showGlobalError();
      return false;
    }

    trackHourlyMobileContactRequest(snapshot);

    if (isTransactionalHourlySnapshot(snapshot)) {
      if (dispatchTransactionalCheckoutSubmit(form)) {
        return true;
      }

      showGlobalError();
      return false;
    }

    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    }

    showGlobalError();
    return false;
  }



  function bindContactStepEvents() {
    if (!contactStepNode || contactStepNode.dataset.hourlyMobileContactBound === "1") {
      return false;
    }

    contactStepNode.dataset.hourlyMobileContactBound = "1";

    [FIELD_NAME, FIELD_PHONE, FIELD_EMAIL]
      .forEach(function bindField(name) {
        const field = getContactField(name);

        if (!field) {
          return;
        }

        field.addEventListener("input", function onInput() {
          clearValidationForField(name);
          syncSubmitAvailability();
        });

        field.addEventListener("change", function onChange() {
          clearValidationForField(name);
          syncSubmitAvailability();
        });

        if (name === FIELD_PHONE) {
          field.addEventListener("blur", function onPhoneBlur() {
            const normalized = normalizePhoneValue(field.value);

            if (normalized) {
              field.value = normalized;
            }

            syncSubmitAvailability();
          });
        }
      });

    contactStepNode.addEventListener("click", function onClick(event) {
      const back = event.target.closest("[data-hourly-mobile-contact-back]");
      const submit = event.target.closest("[data-hourly-mobile-contact-submit]");

      if (back) {
        event.preventDefault();
        close();
        return;
      }

      if (!submit) {
        return;
      }

      event.preventDefault();

      if (!hasRequiredContactData()) {
        validateContactStep();
        syncSubmitAvailability();
        showGlobalError();
        return;
      }

      submitContactStep();
    });

    return true;
  }

  function open(panel, payload) {
    const snapshot = buildSnapshotFromPayload(payload);
    const node = ensureContactStepNode(panel);

    if (!isMobileViewport() || !panel || !node || !hasCompleteHourlySnapshot(snapshot)) {
      return false;
    }

    currentPanel = panel;
    currentSnapshot = snapshot;

    syncCopy();
    syncSummary(snapshot);
    syncSubmitAvailability();

    panel.setAttribute(PRIMARY_STEP_HIDDEN_ATTR, "true");
    node.hidden = false;
    node.setAttribute("aria-hidden", "false");
    document.body.setAttribute(CONTACT_STEP_ACTIVE_ATTR, "true");

    window.requestAnimationFrame(function focusFirstContactField() {
      const first = getContactField(FIELD_NAME);

      if (first && typeof first.focus === "function") {
        first.focus({ preventScroll: true });
      }
    });

    return true;
  }
  
    function blurActiveElementInside(node) {
    const activeElement = document.activeElement;

    if (
      node &&
      activeElement &&
      typeof activeElement.blur === "function" &&
      node.contains(activeElement)
    ) {
      activeElement.blur();
      return true;
    }

    return false;
  }

  function close() {
    if (!contactStepNode) {
      return false;
    }

    if (currentPanel) {
      currentPanel.removeAttribute(PRIMARY_STEP_HIDDEN_ATTR);
    }

    blurActiveElementInside(contactStepNode);

    contactStepNode.hidden = true;
    contactStepNode.setAttribute("aria-hidden", "true");
    document.body.setAttribute(CONTACT_STEP_ACTIVE_ATTR, "false");

    currentPanel = null;
    hideGlobalError();

    return true;
  }

  function isOpen() {
    return Boolean(
      contactStepNode &&
      contactStepNode.hidden !== true &&
      contactStepNode.getAttribute("aria-hidden") !== "true"
    );
  }

  function canOpen(payload) {
    return hasCompleteHourlySnapshot(buildSnapshotFromPayload(payload));
  }

  window.PixkuyHourlyMobileContactStep = {
    open: open,
    close: close,
    isOpen: isOpen,
    canOpen: canOpen,
    syncCopy: syncCopy,
    submit: submitContactStep
  };

  window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
    if (contactStepNode) {
      syncCopy();

      if (currentSnapshot && isOpen()) {
        syncSummary(currentSnapshot);
      }
    }
  });
})(window, document);