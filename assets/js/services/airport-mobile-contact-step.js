/* assets/js/services/airport-mobile-contact-step.js
   Airport / Hotel mobile contact step.
   Responsabilidad:
   - crear la segunda pantalla móvil del flujo Airport / Hotel
   - mostrar resumen compacto del traslado configurado
   - recoger datos personales mínimos
   - usar el proveedor Airport propio como infraestructura de contacto y checkout
   - no hacer scroll a #contact
   - no activar el handoff visual legacy
   - no tocar Google Places, Google Ads ni success modal
*/

(function initAirportMobileContactStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const CONTACT_STEP_SELECTOR = "[data-airport-mobile-contact-step]";
  const CONTACT_STEP_ACTIVE_ATTR = "data-airport-mobile-contact-step-active";
  const PRIMARY_STEP_HIDDEN_ATTR = "data-airport-mobile-primary-step-hidden";
  const LEGAL_ACCEPTANCE_SELECTOR = "[data-airport-mobile-legal-acceptance]";

  const FIELD_NAME = "name";
  const FIELD_PHONE = "phone";
  const FIELD_EMAIL = "email";
  const FIELD_NOTES = "notes";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let contactStepNode = null;
  let currentPanel = null;
  let legalAcceptanceInstance = null;

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

  function getAirportApi() {
    const api = window.PixkuyAirportZoneTariff;

    return api && typeof api === "object" ? api : null;
  }

  function getAirportUtilsApi() {
    const api = window.PixkuyAirportTariffUtils;

    return api && typeof api === "object" ? api : null;
  }

  function getReservationFormsApi() { return window.PixkuyAirportBookingForm || null; }

  function getAirportState() {
    const api = getAirportApi();

    if (!api || typeof api.getState !== "function") {
      return null;
    }

    return api.getState();
  }

  function getAirportSummaryPayload() {
    const api = getAirportApi();

    if (!api || typeof api.getContactSummaryPayload !== "function") {
      return null;
    }

    return api.getContactSummaryPayload();
  }

  function getPassengerBucketLabel(fareKey) {
    const utils = getAirportUtilsApi();
    const safeFareKey = normalizeText(fareKey);

    if (
      !utils ||
      typeof utils.resolveFareKeyDisplayLabel !== "function" ||
      !safeFareKey
    ) {
      return "";
    }

    return normalizeText(utils.resolveFareKeyDisplayLabel(safeFareKey));
  }

  function getMobileLuggageValue(panel) {
    const select = panel
      ? panel.querySelector("[data-airport-mobile-luggage-select]")
      : null;

    return normalizeText(select && "value" in select ? select.value : "") || "0";
  }

  function getContactField(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-airport-mobile-contact-field="' + name + '"]')
      : null;
  }

  function getContactError(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-airport-mobile-contact-error="' + name + '"]')
      : null;
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

  function getDirectionKey(state) {
    const lodgingSide = normalizeText(state && state.lodgingEndpointSide);

    return lodgingSide === "origin"
      ? "hotel_to_airport"
      : "airport_to_hotel";
  }

  function getDirectionLabel(direction) {
    if (direction === "hotel_to_airport") {
      return getI18nValue(
        "airportMobileContactStep.summary.directionHotelToAirport",
        getI18nValue("airportMobileFlow.direction.hotelToAirport", "")
      );
    }

    return getI18nValue(
      "airportMobileContactStep.summary.directionAirportToHotel",
      getI18nValue("airportMobileFlow.direction.airportToHotel", "")
    );
  }

  function buildAirportSnapshot(panel) {
    const state = getAirportState();
    const payload = getAirportSummaryPayload();
    const direction = getDirectionKey(state);
    const passengerFareKey = normalizeText(state && state.selectedFareKey);
    const passengerBucketLabel = getPassengerBucketLabel(passengerFareKey);
    const luggage = getMobileLuggageValue(panel);
    const origin = normalizeText(payload && payload.origin);
    const destination = normalizeText(payload && payload.destination);
    const zone = normalizeText(payload && payload.zone);
    const fare = normalizeText(payload && payload.fare);
    const serviceDate = normalizeText(
      state && state.serviceDate ? state.serviceDate : payload && payload.serviceDate
    );
    const serviceTime = normalizeText(
      state && state.serviceTime ? state.serviceTime : payload && payload.serviceTime
    );
    const lodgingSide = normalizeText(state && state.lodgingEndpointSide);
    const hotel = lodgingSide === "origin" ? origin : destination;
    const airport = lodgingSide === "origin" ? destination : origin;

    const snapshot = {
      state: state,
      payload: payload,
      direction: direction,
      directionLabel: getDirectionLabel(direction),
      origin: origin,
      destination: destination,
      airport: airport,
      hotel: hotel,
      zone: zone,
      fare: fare,
      serviceDate: serviceDate,
      serviceTime: serviceTime,
      passengerFareKey: passengerFareKey,
      passengerBucketLabel: passengerBucketLabel,
      luggage: luggage,
      lodgingPlaceId: normalizeText(state && state.lodgingEndpointPlaceId),
      lodgingPrimaryType: normalizeText(state && state.lodgingEndpointPrimaryType),
      lodgingLat: state && typeof state.lodgingEndpointLat === "number"
        ? String(state.lodgingEndpointLat)
        : "",
      lodgingLng: state && typeof state.lodgingEndpointLng === "number"
        ? String(state.lodgingEndpointLng)
        : ""
    };
    return window.PixkuyFleetSelection ? window.PixkuyFleetSelection.snapshot("airport_transfer", snapshot, {refreshSelection:true}) : snapshot;
  }

  function hasCompleteAirportSnapshot(snapshot) {
    return Boolean(
      snapshot &&
      snapshot.origin &&
      snapshot.destination &&
      snapshot.airport &&
      snapshot.hotel &&
      snapshot.zone &&
      snapshot.fare &&
      snapshot.serviceDate &&
      snapshot.serviceTime &&
      snapshot.passengerFareKey &&
      snapshot.luggage !== ""
    );
  }

  function buildSummaryRow(key) {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");

    row.className = "airport-mobile-contact-step__summary-row";
    row.setAttribute("data-airport-mobile-contact-summary-row", key);

    label.className = "airport-mobile-contact-step__summary-label";
    label.setAttribute("data-airport-mobile-contact-summary-label", key);

    value.className = "airport-mobile-contact-step__summary-value";
    value.setAttribute("data-airport-mobile-contact-summary-value", key);

    row.appendChild(label);
    row.appendChild(value);

    return row;
  }

  function buildField(name, type, autocomplete) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const field = document.createElement("input");
    const error = document.createElement("p");
    const fieldId = "airport-mobile-contact-" + name;

    wrapper.className = "airport-mobile-contact-step__field";
    wrapper.setAttribute("data-airport-mobile-contact-field-wrapper", name);

    label.className = "airport-mobile-contact-step__label";
    label.setAttribute("for", fieldId);
    label.setAttribute("data-airport-mobile-contact-label", name);

    field.id = fieldId;
    field.className = "airport-mobile-contact-step__control";
    field.setAttribute("data-airport-mobile-contact-field", name);
    field.setAttribute("aria-describedby", fieldId + "-error");

    field.type = type || "text";

    if (autocomplete) {
      field.setAttribute("autocomplete", autocomplete);
    }

    if (name === FIELD_PHONE) {
      field.setAttribute("inputmode", "tel");
      field.setAttribute("autocapitalize", "off");
      field.setAttribute("spellcheck", "false");
    }

    error.id = fieldId + "-error";
    error.className = "airport-mobile-contact-step__error";
    error.setAttribute("data-airport-mobile-contact-error", name);
    error.hidden = true;

    wrapper.appendChild(label);
    wrapper.appendChild(field);
    wrapper.appendChild(error);

    return wrapper;
  }

  function buildNotesField(name) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const field = document.createElement("textarea");
    const error = document.createElement("p");
    const fieldId = "airport-mobile-contact-" + name;

    wrapper.className = "airport-mobile-contact-step__field";
    wrapper.setAttribute("data-airport-mobile-contact-field-wrapper", name);

    label.className = "airport-mobile-contact-step__label";
    label.setAttribute("for", fieldId);
    label.setAttribute("data-airport-mobile-contact-label", name);

    field.id = fieldId;
    field.className = "airport-mobile-contact-step__control airport-mobile-contact-step__control--notes";
    field.setAttribute("data-airport-mobile-contact-field", name);
    field.setAttribute("aria-describedby", fieldId + "-error");
    field.setAttribute("autocomplete", "off");
    field.setAttribute("maxlength", "300");
    field.setAttribute("rows", "1");

    error.id = fieldId + "-error";
    error.className = "airport-mobile-contact-step__error";
    error.setAttribute("data-airport-mobile-contact-error", name);
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
    const legalAcceptance = document.createElement("div");
    const actions = document.createElement("div");
    const submit = document.createElement("button");
    const globalError = document.createElement("p");

    root.className = "airport-mobile-contact-step";
    root.setAttribute("data-airport-mobile-contact-step", "1");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;

    backRow.className = "airport-mobile-flow__back-row";

    back.type = "button";
    back.className = "airport-mobile-flow__back";
    back.setAttribute("data-airport-mobile-contact-back", "1");

    summary.className = "airport-mobile-contact-step__summary";
    summary.setAttribute("data-airport-mobile-contact-summary", "1");

    summaryTitle.className = "airport-mobile-contact-step__summary-title";
    summaryTitle.setAttribute("data-airport-mobile-contact-summary-title", "1");

    summaryList.className = "airport-mobile-contact-step__summary-list";
    summaryList.setAttribute("data-airport-mobile-contact-summary-list", "1");

        [
      "airport",
      "hotel",
      "zone",
      "date",
      "time",
      "passengers",
      "luggage",
      "vehicle",
      "fare"
    ].forEach(function appendRow(key) {
      summaryList.appendChild(buildSummaryRow(key));
    });

    form.className = "airport-mobile-contact-step__form";
    form.setAttribute("data-airport-mobile-contact-form", "1");

    legalAcceptance.className = "airport-mobile-contact-step__legal";
    legalAcceptance.setAttribute("data-airport-mobile-legal-acceptance", "1");
    legalAcceptance.hidden = true;

    form.appendChild(buildField(FIELD_NAME, "text", "name"));
    form.appendChild(buildField(FIELD_PHONE, "tel", "tel"));
    form.appendChild(buildField(FIELD_EMAIL, "email", "email"));
    form.appendChild(buildNotesField(FIELD_NOTES));

    globalError.className = "airport-mobile-contact-step__global-error";
    globalError.setAttribute("data-airport-mobile-contact-global-error", "1");
    globalError.hidden = true;

    actions.className = "airport-mobile-contact-step__actions";

    submit.type = "button";
    submit.className = "airport-mobile-contact-step__submit";
    submit.setAttribute("data-airport-mobile-contact-submit", "1");

    actions.appendChild(submit);

    backRow.appendChild(back);

    summary.appendChild(summaryTitle);
    summary.appendChild(summaryList);

    root.appendChild(backRow);
    root.appendChild(summary);
    root.appendChild(form);
    root.appendChild(legalAcceptance);
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
          '[data-airport-mobile-contact-summary-value="' + key + '"]'
        )
      : null;
  }

  function getSummaryLabelNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-airport-mobile-contact-summary-label="' + key + '"]'
        )
      : null;
  }

  function syncSummary(snapshot) {
    const safeSnapshot = snapshot || {};

    const summaryTitle = contactStepNode
      ? contactStepNode.querySelector("[data-airport-mobile-contact-summary-title]")
      : null;
    const summaryTitleText = getI18nValue("airportMobileContactStep.summary.title", "");
    const directionText = safeSnapshot.directionLabel || "";

    setText(
      summaryTitle,
      [summaryTitleText, directionText].filter(Boolean).join(" ")
    );

    const values = {
      airport: safeSnapshot.airport || "",
      hotel: safeSnapshot.hotel || "",
      zone: safeSnapshot.zone || "",
      date: safeSnapshot.serviceDate || "",
      time: safeSnapshot.serviceTime || "",
      passengers: safeSnapshot.passengerBucketLabel || "",
      luggage: safeSnapshot.luggage || "0",
      vehicle: safeSnapshot.fleet_model ? safeSnapshot.fleet_model.name : "",
      fare: safeSnapshot.fare || ""
    };

    Object.keys(values).forEach(function syncValue(key) {
      setText(getSummaryValueNode(key), values[key]);
    });

    return true;
  }

  function syncCopy() {
    const root = contactStepNode;
    const back = root
      ? root.querySelector("[data-airport-mobile-contact-back]")
      : null;
    const summaryTitle = root
      ? root.querySelector("[data-airport-mobile-contact-summary-title]")
      : null;
    const submit = root
      ? root.querySelector("[data-airport-mobile-contact-submit]")
      : null;
    const globalError = root
      ? root.querySelector("[data-airport-mobile-contact-global-error]")
      : null;

    if (!root) {
      return false;
    }

    setText(
      back,
      getI18nValue(
        "airportMobileFlow.back",
        getI18nValue("services.cards.airport.panel.back", "")
      )
    );
    if (!isOpen()) {
      setText(
        summaryTitle,
        getI18nValue("airportMobileContactStep.summary.title", "")
      );
    }
    setText(
      submit,
      getI18nValue("airportMobileContactStep.cta.submit", "")
    );
    setText(
      globalError,
      getI18nValue("airportMobileContactStep.validation.formIncomplete", "")
    );

    setText(getSummaryLabelNode("vehicle"), getI18nValue("fleetSelection.model", ""));
    ["airport", "hotel", "zone", "date", "time", "passengers", "luggage", "fare"]
      .forEach(function syncSummaryLabel(key) {
        setText(
          getSummaryLabelNode(key),
          getI18nValue("airportMobileContactStep.summary." + key, "")
        );
      });

    [FIELD_NAME, FIELD_PHONE, FIELD_EMAIL, FIELD_NOTES]
      .forEach(function syncFieldCopy(name) {
        const field = getContactField(name);
        const label = root.querySelector(
          '[data-airport-mobile-contact-label="' + name + '"]'
        );
        const error = getContactError(name);
        const fieldLabel = getI18nValue(
          "airportMobileContactStep.fields." + name,
          ""
        );
        const placeholder = getI18nValue(
          "airportMobileContactStep.placeholders." + name,
          ""
        );

        setText(label, fieldLabel);

        if (field) {
          field.setAttribute("placeholder", placeholder);
          field.setAttribute("aria-label", fieldLabel);
        }

        setText(
          error,
          getI18nValue("airportMobileContactStep.validation." + name, "")
        );
      });

    return true;
  }
  
  function setFieldValidity(name, isValid) {
    const field = getContactField(name);
    const wrapper = contactStepNode
      ? contactStepNode.querySelector(
          '[data-airport-mobile-contact-field-wrapper="' + name + '"]'
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
      ? contactStepNode.querySelector("[data-airport-mobile-contact-global-error]")
      : null;

    setHidden(error, true);
    return true;
  }

  function showGlobalError() {
    const error = contactStepNode
      ? contactStepNode.querySelector("[data-airport-mobile-contact-global-error]")
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

  function getLegalAcceptanceApi() {
    return window.PixkuyForms &&
      window.PixkuyForms.LegalAcceptance &&
      typeof window.PixkuyForms.LegalAcceptance.create === "function"
      ? window.PixkuyForms.LegalAcceptance
      : null;
  }

  function getLegalAcceptanceHost() {
    return contactStepNode
      ? contactStepNode.querySelector(LEGAL_ACCEPTANCE_SELECTOR)
      : null;
  }

  function getReservationForm() {
    const formsApi = getReservationFormsApi();

    return formsApi ? formsApi.getReservationForm() : null;
  }

  function isLegalAcceptanceAccepted() {
    return Boolean(
      legalAcceptanceInstance &&
      typeof legalAcceptanceInstance.isAccepted === "function" &&
      legalAcceptanceInstance.isAccepted()
    );
  }

  function ensureLegalAcceptance() {
    const api = getLegalAcceptanceApi();
    const host = getLegalAcceptanceHost();
    const form = getReservationForm();

    if (!api || !host || !form) {
      return null;
    }

    if (
      legalAcceptanceInstance &&
      typeof legalAcceptanceInstance.validate === "function"
    ) {
      return legalAcceptanceInstance;
    }

    legalAcceptanceInstance = api.create({
      container: host,
      form: form,
      channel: "web_airport_mobile_checkout",
      checkboxId: "pixkuy-airport-mobile-legal-acceptance"
    });

    if (
      legalAcceptanceInstance.checkbox &&
      legalAcceptanceInstance.checkbox.__pixkuyAirportMobileLegalBound !== true
    ) {
      legalAcceptanceInstance.checkbox.__pixkuyAirportMobileLegalBound = true;
      legalAcceptanceInstance.checkbox.addEventListener("change", syncSubmitAvailability);
    }

    return legalAcceptanceInstance;
  }

  function syncLegalAcceptanceVisibility() {
    const host = getLegalAcceptanceHost();

    if (!host) {
      return false;
    }

    host.hidden = false;
    ensureLegalAcceptance();

    return true;
  }

  function validateLegalAcceptance() {
    const instance = ensureLegalAcceptance();

    if (!instance || typeof instance.validate !== "function") {
      return false;
    }

    return instance.validate();
  }

  function syncSubmitAvailability() {
    const submit = contactStepNode
      ? contactStepNode.querySelector("[data-airport-mobile-contact-submit]")
      : null;
    const isReady = hasFilledContactData() && isLegalAcceptanceAccepted();

    if (!submit) {
      return false;
    }

    submit.disabled = !isReady;
    submit.setAttribute("aria-disabled", isReady ? "false" : "true");
    submit.setAttribute("data-airport-mobile-contact-submit-ready", isReady ? "true" : "false");

    return true;
  }

  function validateContactStep() {
    const name = normalizeText(getContactField(FIELD_NAME).value);
    const phone = normalizePhoneValue(getContactField(FIELD_PHONE).value);
    const email = normalizeText(getContactField(FIELD_EMAIL).value);
    const validity = {
      name: Boolean(name),
      phone: isValidPhone(phone),
      email: isValidEmail(email),
      notes: true
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

  function clearValidationForField(name) {
    setFieldValidity(name, true);
    hideGlobalError();
  }

  function getContactData() {
    return {
      name: normalizeText(getContactField(FIELD_NAME).value),
      phone: normalizePhoneValue(getContactField(FIELD_PHONE).value),
      email: normalizeText(getContactField(FIELD_EMAIL).value),
      notes: normalizeText(getContactField(FIELD_NOTES).value)
    };
  }

  function fillReservationForm(snapshot, contactData, options) {
    const owner = getReservationFormsApi();
    if (!owner || !snapshot.state || !snapshot.payload || !owner.fromPanel(snapshot.state, snapshot.payload, snapshot.passengerBucketLabel)) return false;
    owner.restoreContact(Object.assign({}, owner.raw(), contactData, {message:contactData.notes,luggage:snapshot.luggage}));
    return options?.skipLegacyValidation === true || owner.refreshReservationRequestValidationUX();
  }

    function parseFareAmount(value) {
    const normalizedValue = normalizeText(value)
      .replace(/[^\d.,]/g, "")
      .replace(/,/g, "");
    const numericValue = Number(normalizedValue);

    return Number.isFinite(numericValue) ? numericValue : NaN;
  }
  
    function isAirportBookingApiCheckoutBridgeReady() {
    return Boolean(
      document.documentElement &&
      document.documentElement.dataset.airportTransferBookingApiCheckoutBound === "1"
    );
  }

  function dispatchTransactionalCheckoutSubmit(form) {
    if (!form || !isAirportBookingApiCheckoutBridgeReady()) {
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

  function trackAirportMobileContactRequest(snapshot) {
    const analytics = window.PixkuyAnalytics;
    const safeSnapshot = snapshot || {};
    const price = parseFareAmount(safeSnapshot.fare);
    const payload = {
      service_type: "airport_hotel",
      direction: normalizeText(safeSnapshot.direction),
      passenger_fare_key: normalizeText(safeSnapshot.passengerFareKey),
      luggage: normalizeText(safeSnapshot.luggage),
      currency: "MXN",
      flow_surface: "mobile_route"
    };

    if (Number.isFinite(price)) {
      payload.price = price;
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

  function submitContactStep() {
    const formsApi = getReservationFormsApi();
    const form = formsApi ? formsApi.getReservationForm() : null;
    const snapshot = buildAirportSnapshot(currentPanel);
    const contactData = getContactData();
    const isContactValid = validateContactStep();
    let isFormValid;

    if (!isContactValid) {
      return false;
    }

    if (!hasCompleteAirportSnapshot(snapshot)) {
      showGlobalError();
      return false;
    }

    isFormValid = fillReservationForm(snapshot, contactData, {
      skipLegacyValidation: true
    });

    if (!isFormValid) {
      showGlobalError();
      return false;
    }

    if (!validateLegalAcceptance()) {
      syncSubmitAvailability();
      return false;
    }

    trackAirportMobileContactRequest(snapshot);

    if (dispatchTransactionalCheckoutSubmit(form)) {
      return true;
    }

    showGlobalError();
    return false;
  }

  function bindContactStepEvents() {
    if (!contactStepNode || contactStepNode.dataset.airportMobileContactBound === "1") {
      return false;
    }

    contactStepNode.dataset.airportMobileContactBound = "1";

    [FIELD_NAME, FIELD_PHONE, FIELD_EMAIL, FIELD_NOTES]
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
      const back = event.target.closest("[data-airport-mobile-contact-back]");
      const submit = event.target.closest("[data-airport-mobile-contact-submit]");

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

  function open(panel) {
    const snapshot = buildAirportSnapshot(panel);
    const node = ensureContactStepNode(panel);

    if (!isMobileViewport() || !panel || !node || !hasCompleteAirportSnapshot(snapshot)) {
      return false;
    }

    currentPanel = panel;

    syncCopy();
    syncSummary(snapshot);
    syncLegalAcceptanceVisibility();
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

  function close() {
    if (!contactStepNode) {
      return false;
    }

    blurActiveElementInside(contactStepNode);

    if (currentPanel) {
      currentPanel.removeAttribute(PRIMARY_STEP_HIDDEN_ATTR);
    }

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

  function canOpen(panel) {
    return hasCompleteAirportSnapshot(buildAirportSnapshot(panel));
  }

  // Presentation only for the shared booking controller: reuse the original
  // mobile route, summary rows and styles, without creating another form.
  function createReviewSummary(value) {
    const view = window.PixkuyAirportDesktopView;
    const section = view.node("section", "airport-mobile-contact-step__summary airport-mobile-review__trip");
    section.appendChild(view.node("h1", "airport-mobile-contact-step__summary-title", view.t("mobileReviewTitle")));
    const places = view.node("dl", "airport-mobile-review__places");
    const toAirport = value.airport_transfer_direction === "destination_to_airport";
    const airport = value.airport_transfer_airport_label;
    const destination = value.airport_transfer_destination_label || "";
    const location = value.airport_transfer_non_airport_location || {};
    let address = location.address || "";
    const name = destination.split(" — ")[0];
    if (address.startsWith(name + " — ")) address = address.slice(name.length + 3);
    const placeOptions = address && address !== destination ? {address:address} : {};
    const airportOptions = {airportId:value.airport_transfer_airport_id};
    places.append(
      view.locationField(view.t("origin"), toAirport ? destination : airport, toAirport ? placeOptions : airportOptions),
      view.locationField(view.t("destination"), toAirport ? airport : destination, toAirport ? airportOptions : placeOptions)
    );
    const details = view.node("dl", "airport-mobile-review__facts");
    details.append(
      view.field(view.t("date"), view.date(value.airport_transfer_date, true)),
      view.field(view.t("time"), value.airport_transfer_time),
      view.field(view.t("passengers"), getPassengerBucketLabel(value.airport_transfer_passenger_fare_key)),
      view.field(view.t("luggage"), String(value.luggage ?? value.airport_transfer_luggage ?? "0"))
    );
    const vehicle = view.node("dl", "airport-mobile-review__vehicle");
    vehicle.appendChild(view.field(getI18nValue("fleetSelection.model", ""), value.fleet_model && value.fleet_model.name));
    section.append(places, details, vehicle);
    return section;
  }
  function createBookingView(value, onBack, review) {
    const view = window.PixkuyAirportDesktopView;
    const root = document.createElement("section");
    root.className = "airport-booking airport-mobile-contact-step";
    const backRow = document.createElement("div");
    backRow.className = "airport-mobile-flow__back-row";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "airport-mobile-flow__back";
    back.textContent = getI18nValue("airportMobileFlow.back", "Volver");
    back.addEventListener("click", onBack);
    backRow.appendChild(back);
    if (review) { root.append(backRow, createReviewSummary(value)); return root; }
    const summary = document.createElement("section");
    summary.className = "airport-mobile-contact-step__summary";
    const title = document.createElement("p");
    title.className = "airport-mobile-contact-step__summary-title";
    title.textContent = getI18nValue("airportMobileContactStep.summary.title", "") + " " +
      getDirectionLabel(value.airport_transfer_direction === "destination_to_airport" ? "hotel_to_airport" : "airport_to_hotel");
    const list = document.createElement("dl");
    list.className = "airport-mobile-contact-step__summary-list";
    const values = {
      airport: value.airport_transfer_airport_label,
      hotel: value.airport_transfer_destination_label,
      zone: value.airport_transfer_zone_label || window.PixkuyAirportTariffCatalog.resolveDisplayLabel('zone', value.airport_transfer_zone_id),
      date: view.date(value.airport_transfer_date, true),
      time: value.airport_transfer_time,
      passengers: getPassengerBucketLabel(value.airport_transfer_passenger_fare_key),
      luggage: value.luggage ?? value.airport_transfer_luggage ?? "0",
      vehicle: value.fleet_model && value.fleet_model.name,
      fare: view.price(value)
    };
    Object.keys(values).forEach(function (key) {
      if (key === 'zone' && !values[key]) return;
      const row = buildSummaryRow(key);
      row.querySelector("dt").textContent = getI18nValue("airportMobileContactStep.summary." + key, key === "vehicle" ? getI18nValue("fleetSelection.model", "") : "");
      row.querySelector("dd").textContent = values[key] || "";
      list.appendChild(row);
    });
    summary.append(title, list);
    root.append(backRow, summary);
    return root;
  }

  window.PixkuyAirportMobileContactStep = {
    createBookingView: createBookingView,
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

      if (currentPanel && isOpen()) {
        syncSummary(buildAirportSnapshot(currentPanel));
      }
    }
  });
})(window, document);
