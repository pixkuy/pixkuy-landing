/* assets/js/services/events-mobile-contact-step.js
   Events mobile contact step.
   Responsabilidad:
   - crear la tercera pantalla móvil del flujo event_special
   - mostrar resumen compacto del evento configurado
   - recoger datos personales mínimos
   - usar form[name="contact"] como infraestructura técnica de envío Netlify
   - no hacer scroll a #contact
   - no activar el editor visual legacy de #contact
   - no tocar Google Places, Google Ads, WhatsApp ni success modal
*/

(function initEventsMobileContactStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const CONTACT_STEP_SELECTOR = "[data-events-mobile-contact-step]";
  const CONTACT_STEP_ACTIVE_ATTR = "data-events-mobile-contact-step-active";
  const NOTES_EDITOR_ACTIVE_ATTR = "data-events-mobile-notes-editor-active";
  const PRIMARY_STEP_HIDDEN_ATTR = "data-events-mobile-config-step-hidden";

  const FIELD_NAME = "name";
  const FIELD_PHONE = "phone";
  const FIELD_EMAIL = "email";
  const FIELD_NOTES = "notes";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let contactStepNode = null;
  let currentConfigStep = null;
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
    return getI18nValue("contact.services.eventSpecial.label", "");
  }

  function formatCurrencyValue(value, currency) {
    const safeCurrency = normalizeText(currency) || "MXN";
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: 0
      }).format(numericValue) + " " + safeCurrency;
    } catch (error) {
      return String(numericValue) + " " + safeCurrency;
    }
  }

  function getEventDateValue(startsAt) {
    const match = String(startsAt || "").trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);

    return match ? match[1] : "";
  }

  function getEventTimeValue(startsAt) {
    const match = String(startsAt || "").trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);

    return match ? match[2] : "";
  }

  function formatEventDateTimeLabel(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) {
      return raw;
    }

    const date = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        12,
        0,
        0
      )
    );
    const dateLabel = new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(date);

    return dateLabel + " · " + match[4] + ":" + match[5];
  }

  function getPrimaryTripTime(snapshot) {
    const safeSnapshot = snapshot || {};

    return (
      safeSnapshot.event_special_origin_pickup_time ||
      safeSnapshot.event_special_return_pickup_time ||
      getEventTimeValue(safeSnapshot.event_special_event_starts_at)
    );
  }

  function getGenericOrigin(snapshot) {
    const safeSnapshot = snapshot || {};

    if (safeSnapshot.event_special_variant === "departure") {
      return safeSnapshot.event_special_venue_label;
    }

    return safeSnapshot.event_special_origin_address;
  }

  function getGenericDestination(snapshot) {
    const safeSnapshot = snapshot || {};

    if (safeSnapshot.event_special_variant === "arrival") {
      return safeSnapshot.event_special_venue_label;
    }

    return safeSnapshot.event_special_destination_address;
  }

  function buildSnapshotFromPayload(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const price = normalizeText(
      typeof safePayload.event_special_price === "number"
        ? String(safePayload.event_special_price)
        : safePayload.event_special_price
    );
    const currency = normalizeText(safePayload.event_special_currency) || "MXN";

    return {
      serviceType: "event_special",

      event_special_event_id: normalizeText(safePayload.event_special_event_id),
      event_special_event_label: normalizeText(safePayload.event_special_event_label),
      event_special_event_type: normalizeText(safePayload.event_special_event_type),
      event_special_event_starts_at: normalizeText(safePayload.event_special_event_starts_at),

      event_special_venue_id: normalizeText(safePayload.event_special_venue_id),
      event_special_venue_label: normalizeText(safePayload.event_special_venue_label),

      event_special_variant: normalizeText(safePayload.event_special_variant),
      event_special_variant_label: normalizeText(safePayload.event_special_variant_label),

      event_special_origin_address: normalizeText(safePayload.event_special_origin_address),
      event_special_origin_address_place_id: normalizeText(safePayload.event_special_origin_address_place_id),
      event_special_origin_address_lat: normalizeText(safePayload.event_special_origin_address_lat),
      event_special_origin_address_lng: normalizeText(safePayload.event_special_origin_address_lng),

      event_special_destination_address: normalizeText(safePayload.event_special_destination_address),
      event_special_destination_address_place_id: normalizeText(safePayload.event_special_destination_address_place_id),
      event_special_destination_address_lat: normalizeText(safePayload.event_special_destination_address_lat),
      event_special_destination_address_lng: normalizeText(safePayload.event_special_destination_address_lng),

      event_special_origin_pickup_time: normalizeText(safePayload.event_special_origin_pickup_time),
      event_special_return_pickup_time: normalizeText(safePayload.event_special_return_pickup_time),
      event_special_return_pickup_day_offset: normalizeText(safePayload.event_special_return_pickup_day_offset),
      event_special_return_pickup_label: normalizeText(safePayload.event_special_return_pickup_label),

      event_special_estimated_event_arrival_time: normalizeText(safePayload.event_special_estimated_event_arrival_time),
      event_special_estimated_destination_arrival_time: normalizeText(safePayload.event_special_estimated_destination_arrival_time),

      event_special_outbound_duration_seconds: normalizeText(safePayload.event_special_outbound_duration_seconds),
      event_special_return_duration_seconds: normalizeText(safePayload.event_special_return_duration_seconds),
      event_special_outbound_distance_meters: normalizeText(safePayload.event_special_outbound_distance_meters),
      event_special_return_distance_meters: normalizeText(safePayload.event_special_return_distance_meters),

      event_special_passenger_fare_key: normalizeText(safePayload.event_special_passenger_fare_key),
      event_special_passenger_bucket_label: normalizeText(safePayload.event_special_passenger_bucket_label),

      event_special_price: price,
      event_special_currency: price ? currency : "",
      event_special_price_label:
        normalizeText(safePayload.event_special_price_label) ||
        formatCurrencyValue(price, currency),

      event_special_notes: normalizeText(safePayload.event_special_notes)
    };
  }

  function hasCompleteEventSnapshot(snapshot) {
    const safeSnapshot = snapshot || {};
    const variant = safeSnapshot.event_special_variant;

    if (
      !safeSnapshot.event_special_event_id ||
      !safeSnapshot.event_special_variant ||
      !safeSnapshot.event_special_passenger_fare_key ||
      !safeSnapshot.event_special_price ||
      !safeSnapshot.event_special_currency
    ) {
      return false;
    }

    if (variant === "arrival") {
      return Boolean(
        safeSnapshot.event_special_origin_address &&
          safeSnapshot.event_special_origin_address_place_id &&
          safeSnapshot.event_special_origin_pickup_time
      );
    }

    if (variant === "departure") {
      return Boolean(
        safeSnapshot.event_special_destination_address &&
          safeSnapshot.event_special_destination_address_place_id &&
          safeSnapshot.event_special_return_pickup_time
      );
    }

    if (variant === "round_trip") {
      return Boolean(
        safeSnapshot.event_special_origin_address &&
          safeSnapshot.event_special_origin_address_place_id &&
          safeSnapshot.event_special_destination_address &&
          safeSnapshot.event_special_destination_address_place_id &&
          safeSnapshot.event_special_origin_pickup_time &&
          safeSnapshot.event_special_return_pickup_time
      );
    }

    return false;
  }

  function getCompactAddressLabel(value) {
    const parts = normalizeText(value)
      .split(",")
      .map(function normalizePart(part) {
        return normalizeText(part);
      })
      .filter(Boolean);

    if (parts.length <= 2) {
      return normalizeText(value);
    }

    return parts.slice(0, 2).join(" · ");
  }

  function getContactField(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-events-mobile-contact-field="' + name + '"]')
      : null;
  }

  function getContactError(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-events-mobile-contact-error="' + name + '"]')
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

  function getSummaryRowNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-events-mobile-contact-summary-row="' + key + '"]'
        )
      : null;
  }

  function setSummaryRowVisible(key, isVisible) {
    return setHidden(getSummaryRowNode(key), !isVisible);
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

  function getNotesEditorNode() {
    return contactStepNode
      ? contactStepNode.querySelector("[data-events-mobile-notes-editor]")
      : null;
  }

  function getNotesEditorInput() {
    const editor = getNotesEditorNode();

    return editor
      ? editor.querySelector("[data-events-mobile-notes-editor-input]")
      : null;
  }

  function getCompactNotesInput() {
    return getContactField(FIELD_NOTES);
  }

  function syncNotesEditorClear(notesEditor) {
    const editor = notesEditor || getNotesEditorNode();
    const input = editor
      ? editor.querySelector("[data-events-mobile-notes-editor-input]")
      : null;
    const clear = editor
      ? editor.querySelector("[data-events-mobile-notes-editor-clear]")
      : null;
    const hasValue = Boolean(normalizeText(input && input.value));

    if (!clear) {
      return false;
    }

    clear.hidden = !hasValue;
    clear.setAttribute("aria-hidden", hasValue ? "false" : "true");

    return true;
  }

  function syncNotesEditorToCompact() {
    const editorInput = getNotesEditorInput();
    const compactInput = getCompactNotesInput();

    if (!editorInput || !compactInput) {
      return false;
    }

    compactInput.value = editorInput.value || "";
    clearValidationForField(FIELD_NOTES);

    return true;
  }

  function syncCompactNotesToEditor() {
    const editorInput = getNotesEditorInput();
    const compactInput = getCompactNotesInput();

    if (!editorInput || !compactInput) {
      return false;
    }

    editorInput.value = compactInput.value || "";
    syncNotesEditorClear();

    return true;
  }

  function openNotesEditor() {
    const editor = getNotesEditorNode();
    const editorInput = getNotesEditorInput();

    if (!editor || !editorInput) {
      return false;
    }

    syncCompactNotesToEditor();

    editor.hidden = false;
    editor.setAttribute("aria-hidden", "false");
    document.body.setAttribute(NOTES_EDITOR_ACTIVE_ATTR, "true");

    window.requestAnimationFrame(function focusNotesEditor() {
      editorInput.focus({ preventScroll: true });
      editorInput.setSelectionRange(editorInput.value.length, editorInput.value.length);
    });

    return true;
  }

  function closeNotesEditor() {
    const editor = getNotesEditorNode();

    if (!editor) {
      return false;
    }

    syncNotesEditorToCompact();
    blurActiveElementInside(editor);

    editor.hidden = true;
    editor.setAttribute("aria-hidden", "true");
    document.body.setAttribute(NOTES_EDITOR_ACTIVE_ATTR, "false");

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

    row.className = "events-mobile-contact-step__summary-row";
    row.setAttribute("data-events-mobile-contact-summary-row", key);

    label.className = "events-mobile-contact-step__summary-label";
    label.setAttribute("data-events-mobile-contact-summary-label", key);

    value.className = "events-mobile-contact-step__summary-value";
    value.setAttribute("data-events-mobile-contact-summary-value", key);

    row.appendChild(label);
    row.appendChild(value);

    return row;
  }

  function buildNotesEditorNode() {
    const editor = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const title = document.createElement("p");
    const close = document.createElement("button");
    const body = document.createElement("div");
    const textarea = document.createElement("textarea");
    const clear = document.createElement("button");

    editor.className = "events-mobile-notes-editor";
    editor.setAttribute("data-events-mobile-notes-editor", "1");
    editor.setAttribute("aria-hidden", "true");
    editor.hidden = true;

    panel.className = "events-mobile-notes-editor__panel";

    header.className = "events-mobile-notes-editor__header";

    title.className = "events-mobile-notes-editor__title";
    title.setAttribute("data-events-mobile-notes-editor-title", "1");

    close.type = "button";
    close.className = "events-mobile-notes-editor__close";
    close.setAttribute("data-events-mobile-notes-editor-close", "1");

    body.className = "events-mobile-notes-editor__body";

    textarea.className = "events-mobile-notes-editor__input";
    textarea.rows = 8;
    textarea.setAttribute("data-events-mobile-notes-editor-input", "1");

    clear.type = "button";
    clear.className = "events-mobile-notes-editor__clear";
    clear.setAttribute("data-events-mobile-notes-editor-clear", "1");
    clear.textContent = "×";
    clear.hidden = true;
    clear.setAttribute("aria-hidden", "true");

    header.appendChild(title);
    header.appendChild(close);

    body.appendChild(textarea);
    body.appendChild(clear);

    panel.appendChild(header);
    panel.appendChild(body);

    editor.appendChild(panel);

    return editor;
  }

  function buildField(name, type, autocomplete) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const field =
      name === FIELD_NOTES
        ? document.createElement("textarea")
        : document.createElement("input");
    const error = document.createElement("p");
    const fieldId = "events-mobile-contact-" + name;

    wrapper.className = "events-mobile-contact-step__field";
    wrapper.setAttribute("data-events-mobile-contact-field-wrapper", name);

    label.className = "events-mobile-contact-step__label";
    label.setAttribute("for", fieldId);
    label.setAttribute("data-events-mobile-contact-label", name);

    field.id = fieldId;
    field.className = "events-mobile-contact-step__control";
    field.setAttribute("data-events-mobile-contact-field", name);
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
    error.className = "events-mobile-contact-step__error";
    error.setAttribute("data-events-mobile-contact-error", name);
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
    const notesEditor = buildNotesEditorNode();

    root.className = "events-mobile-contact-step";
    root.setAttribute("data-events-mobile-contact-step", "1");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;

    backRow.className = "events-mobile-config-step__back-row";

    back.type = "button";
    back.className = "events-mobile-config-step__back";
    back.setAttribute("data-events-mobile-contact-back", "1");

    summary.className = "events-mobile-contact-step__summary";
    summary.setAttribute("data-events-mobile-contact-summary", "1");

    summaryTitle.className = "events-mobile-contact-step__summary-title";
    summaryTitle.setAttribute("data-events-mobile-contact-summary-title", "1");

    summaryList.className = "events-mobile-contact-step__summary-list";
    summaryList.setAttribute("data-events-mobile-contact-summary-list", "1");

    [
      "date",
      "venue",
      "variant",
      "passengers",
      "origin",
      "originTime",
      "destination",
      "returnTime",
      "price"
    ].forEach(function appendRow(key) {
      summaryList.appendChild(buildSummaryRow(key));
    });

    form.className = "events-mobile-contact-step__form";
    form.setAttribute("data-events-mobile-contact-form", "1");

    form.appendChild(buildField(FIELD_NAME, "text", "name"));
    form.appendChild(buildField(FIELD_PHONE, "tel", "tel"));
    form.appendChild(buildField(FIELD_EMAIL, "email", "email"));
    form.appendChild(buildField(FIELD_NOTES, "", ""));

    globalError.className = "events-mobile-contact-step__global-error";
    globalError.setAttribute("data-events-mobile-contact-global-error", "1");
    globalError.hidden = true;

    actions.className = "events-mobile-contact-step__actions";

    submit.type = "button";
    submit.className = "events-mobile-contact-step__submit";
    submit.setAttribute("data-events-mobile-contact-submit", "1");

    actions.appendChild(submit);

    backRow.appendChild(back);

    summary.appendChild(summaryTitle);
    summary.appendChild(summaryList);

    root.appendChild(backRow);
    root.appendChild(summary);
    root.appendChild(form);
    root.appendChild(globalError);
    root.appendChild(actions);
    root.appendChild(notesEditor);

    return root;
  }

  function ensureContactStepNode(configStep) {
    const route = configStep
      ? configStep.closest("[data-events-mobile-route]")
      : document.querySelector("[data-events-mobile-route]");

    if (contactStepNode) {
      return contactStepNode;
    }

    contactStepNode = document.querySelector(CONTACT_STEP_SELECTOR);

    if (!contactStepNode) {
      contactStepNode = buildContactStepNode();

      if (route) {
        route.appendChild(contactStepNode);
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
          '[data-events-mobile-contact-summary-value="' + key + '"]'
        )
      : null;
  }

  function getSummaryLabelNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-events-mobile-contact-summary-label="' + key + '"]'
        )
      : null;
  }

  function syncSummary(snapshot) {
    const safeSnapshot = snapshot || {};
    const summaryTitle = contactStepNode
      ? contactStepNode.querySelector("[data-events-mobile-contact-summary-title]")
      : null;

    setText(
      summaryTitle,
      [
        getI18nValue("contact.services.eventSpecial.summaryTitle", ""),
        safeSnapshot.event_special_event_label || ""
      ].filter(Boolean).join(" · ")
    );

    const isArrival = safeSnapshot.event_special_variant === "arrival";
    const isDeparture = safeSnapshot.event_special_variant === "departure";
    const isRoundTrip = safeSnapshot.event_special_variant === "round_trip";
    const values = {
      date: formatEventDateTimeLabel(safeSnapshot.event_special_event_starts_at),
      venue: safeSnapshot.event_special_venue_label || "",
      variant: safeSnapshot.event_special_variant_label || "",
      passengers: safeSnapshot.event_special_passenger_bucket_label || "",
      origin: getCompactAddressLabel(safeSnapshot.event_special_origin_address),
      destination: getCompactAddressLabel(safeSnapshot.event_special_destination_address),
      originTime: safeSnapshot.event_special_origin_pickup_time || "",
      returnTime:
        safeSnapshot.event_special_return_pickup_label ||
        safeSnapshot.event_special_return_pickup_time ||
        "",
      price: safeSnapshot.event_special_price_label || ""
    };

    Object.keys(values).forEach(function syncValue(key) {
      setText(getSummaryValueNode(key), values[key]);
    });
	
	setSummaryRowVisible("date", true);
    setSummaryRowVisible("venue", true);
    setSummaryRowVisible("variant", true);
    setSummaryRowVisible("passengers", true);
    setSummaryRowVisible("origin", isArrival || isRoundTrip);
    setSummaryRowVisible("destination", isDeparture || isRoundTrip);
    setSummaryRowVisible("originTime", isArrival || isRoundTrip);
    setSummaryRowVisible("returnTime", isDeparture || isRoundTrip);
    setSummaryRowVisible("price", true);

    return true;
  }

  function syncCopy() {
    const root = contactStepNode;
    const back = root
      ? root.querySelector("[data-events-mobile-contact-back]")
      : null;
    const submit = root
      ? root.querySelector("[data-events-mobile-contact-submit]")
      : null;
    const globalError = root
      ? root.querySelector("[data-events-mobile-contact-global-error]")
      : null;
    const notesEditorTitle = root
      ? root.querySelector("[data-events-mobile-notes-editor-title]")
      : null;
    const notesEditorClose = root
      ? root.querySelector("[data-events-mobile-notes-editor-close]")
      : null;
    const notesEditorInput = root
      ? root.querySelector("[data-events-mobile-notes-editor-input]")
      : null;
    const notesEditorClear = root
      ? root.querySelector("[data-events-mobile-notes-editor-clear]")
      : null;

    if (!root) {
      return false;
    }

    setText(
      back,
      getI18nValue("services.cards.events.mobileFlow.back", "")
    );
    setText(
      submit,
      getI18nValue("contact.submit", "")
    );
    setText(
      globalError,
      getI18nValue("contact.validation.formIncomplete", "")
    );
    setText(
      notesEditorTitle,
      getI18nValue(
        "contact.services.eventSpecial.notesLabel",
        getI18nValue("contact.notes", "")
      )
    );
    setText(
      notesEditorClose,
      getI18nValue("services.cards.events.mobileContact.notesSave", "")
    );
    if (notesEditorClear) {
      notesEditorClear.setAttribute(
        "aria-label",
        getI18nValue("services.cards.events.mobileContact.notesClear", "")
      );
    }

    if (notesEditorInput) {
      notesEditorInput.setAttribute(
        "placeholder",
        getI18nValue("contact.notes", "")
      );
      notesEditorInput.setAttribute(
        "aria-label",
        getI18nValue(
          "contact.services.eventSpecial.notesLabel",
          getI18nValue("contact.notes", "")
        )
      );
    }

    [
      "date",
      "venue",
      "variant",
      "passengers",
      "origin",
      "destination",
      "originTime",
      "returnTime",
      "price"
    ].forEach(function syncSummaryLabel(key) {
      const map = {
        date: "contact.services.eventSpecial.dateLabel",
        venue: "contact.services.eventSpecial.venueLabel",
        variant: "contact.services.eventSpecial.variantLabel",
        passengers: "contact.services.eventSpecial.passengersLabel",
        origin: "contact.services.eventSpecial.originLabel",
        destination: "contact.services.eventSpecial.destinationLabel",
        originTime: "contact.services.eventSpecial.originPickupTimeLabel",
        returnTime: "contact.services.eventSpecial.returnPickupTimeLabel",
        price: "contact.services.eventSpecial.priceLabel"
      };

      setText(getSummaryLabelNode(key), getI18nValue(map[key], ""));
    });

    [FIELD_NAME, FIELD_PHONE, FIELD_EMAIL, FIELD_NOTES]
      .forEach(function syncFieldCopy(name) {
        const field = getContactField(name);
        const label = root.querySelector(
          '[data-events-mobile-contact-label="' + name + '"]'
        );
        const error = getContactError(name);
        const fieldLabel = getI18nValue(
          name === FIELD_NOTES
            ? "contact.services.eventSpecial.notesLabel"
            : "contact." + name,
          getI18nValue("contact." + name, "")
        );
        const placeholder = getI18nValue(
          name === FIELD_NOTES
            ? "contact.notes"
            : "contact." + name,
          ""
        );
        const errorPathMap = {
          name: "contact.validation.nameRequired",
          phone: "contact.validation.phoneRequired",
          email: "contact.validation.emailRequired",
          notes: ""
        };

        setText(label, fieldLabel);

        if (field) {
          field.setAttribute("placeholder", placeholder);
          field.setAttribute("aria-label", fieldLabel);
        }

        setText(error, getI18nValue(errorPathMap[name], ""));
      });

    return true;
  }

  function setFieldValidity(name, isValid) {
    const field = getContactField(name);
    const wrapper = contactStepNode
      ? contactStepNode.querySelector(
          '[data-events-mobile-contact-field-wrapper="' + name + '"]'
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
      error.hidden = isValid || !error.textContent;
    }

    return isValid;
  }

  function hideGlobalError() {
    const error = contactStepNode
      ? contactStepNode.querySelector("[data-events-mobile-contact-global-error]")
      : null;

    setHidden(error, true);
    return true;
  }

  function showGlobalError() {
    const error = contactStepNode
      ? contactStepNode.querySelector("[data-events-mobile-contact-global-error]")
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
      ? contactStepNode.querySelector("[data-events-mobile-contact-submit]")
      : null;
    const isReady = hasFilledContactData();

    if (!submit) {
      return false;
    }

    submit.disabled = !isReady;
    submit.setAttribute("aria-disabled", isReady ? "false" : "true");
    submit.setAttribute("data-events-mobile-contact-submit-ready", isReady ? "true" : "false");

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

  function getContactData() {
    return {
      name: normalizeText(getContactField(FIELD_NAME).value),
      phone: normalizePhoneValue(getContactField(FIELD_PHONE).value),
      email: normalizeText(getContactField(FIELD_EMAIL).value),
      notes: normalizeText(getContactField(FIELD_NOTES).value)
    };
  }

  function buildRequestSummary(snapshot) {
    const safeSnapshot = snapshot || {};
    const labels = {
      event: getI18nValue("contact.whatsappMessage.eventSpecial.event", ""),
      date: getI18nValue("contact.whatsappMessage.eventSpecial.date", ""),
      venue: getI18nValue("contact.whatsappMessage.eventSpecial.venue", ""),
      variant: getI18nValue("contact.whatsappMessage.eventSpecial.variant", ""),
      origin: getI18nValue("contact.whatsappMessage.eventSpecial.origin", ""),
      destination: getI18nValue("contact.whatsappMessage.eventSpecial.destination", ""),
      originPickupTime: getI18nValue("contact.whatsappMessage.eventSpecial.originPickupTime", ""),
      returnPickupTime: getI18nValue("contact.whatsappMessage.eventSpecial.returnPickupTime", ""),
      passengers: getI18nValue("contact.whatsappMessage.eventSpecial.passengers", ""),
      price: getI18nValue("contact.whatsappMessage.eventSpecial.price", "")
    };
    const parts = [];

    if (safeSnapshot.event_special_event_label) {
      parts.push(labels.event + ": " + safeSnapshot.event_special_event_label);
    }

    if (safeSnapshot.event_special_event_starts_at) {
      parts.push(labels.date + ": " + safeSnapshot.event_special_event_starts_at);
    }

    if (safeSnapshot.event_special_venue_label) {
      parts.push(labels.venue + ": " + safeSnapshot.event_special_venue_label);
    }

    if (safeSnapshot.event_special_variant_label) {
      parts.push(labels.variant + ": " + safeSnapshot.event_special_variant_label);
    }

    if (safeSnapshot.event_special_origin_address) {
      parts.push(labels.origin + ": " + safeSnapshot.event_special_origin_address);
    }

    if (safeSnapshot.event_special_destination_address) {
      parts.push(labels.destination + ": " + safeSnapshot.event_special_destination_address);
    }

    if (safeSnapshot.event_special_origin_pickup_time) {
      parts.push(labels.originPickupTime + ": " + safeSnapshot.event_special_origin_pickup_time);
    }

    if (safeSnapshot.event_special_return_pickup_label || safeSnapshot.event_special_return_pickup_time) {
      parts.push(
        labels.returnPickupTime +
          ": " +
          (safeSnapshot.event_special_return_pickup_label || safeSnapshot.event_special_return_pickup_time)
      );
    }

    if (safeSnapshot.event_special_passenger_bucket_label) {
      parts.push(labels.passengers + ": " + safeSnapshot.event_special_passenger_bucket_label);
    }

    if (safeSnapshot.event_special_price_label) {
      parts.push(labels.price + ": " + safeSnapshot.event_special_price_label);
    }

    return parts.filter(Boolean).join(" | ");
  }

  function fillReservationForm(snapshot, contactData) {
    const formsApi = getReservationFormsApi();
    const form = formsApi ? formsApi.getReservationForm() : null;
    const fields = form && formsApi ? formsApi.getReservationRequestFields(form) : null;
    const summary = buildRequestSummary(snapshot);

    if (!form || !fields) {
      return false;
    }

    writeFormValue(form, "service_type", "event_special", false);

    writeFormValue(form, "name", contactData.name, true);
    writeFormValue(form, "phone", contactData.phone, true);
    writeFormValue(form, "email", contactData.email, true);

    writeFormValue(form, "trip_date", getEventDateValue(snapshot.event_special_event_starts_at), true);
    writeFormValue(form, "trip_time", getPrimaryTripTime(snapshot), true);
    writeFormValue(form, "origin", getGenericOrigin(snapshot), true);
    writeFormValue(form, "destination", getGenericDestination(snapshot), true);
    writeFormValue(form, "passengers", "", true);
    writeFormValue(form, "luggage", "", true);
    writeFormValue(form, "message", contactData.notes, true);

    writeFormValue(form, "service_label", getServiceLabel(), false);
    writeFormValue(form, "request_summary", summary, false);
    writeFormValue(form, "event_special_trip_summary", summary, false);

    writeFormValue(form, "event_special_event_label", snapshot.event_special_event_label, false);
    writeFormValue(form, "event_special_venue_label", snapshot.event_special_venue_label, false);
    writeFormValue(form, "event_special_variant_label", snapshot.event_special_variant_label, false);
    writeFormValue(form, "event_special_origin_label", snapshot.event_special_origin_address, false);
    writeFormValue(form, "event_special_destination_label", snapshot.event_special_destination_address, false);
    writeFormValue(form, "event_special_passenger_bucket_label", snapshot.event_special_passenger_bucket_label, false);
    writeFormValue(form, "event_special_price_label", snapshot.event_special_price_label, false);

    writeFormValue(form, "event_special_event_id", snapshot.event_special_event_id, false);
    writeFormValue(form, "event_special_event_type", snapshot.event_special_event_type, false);
    writeFormValue(form, "event_special_event_starts_at", snapshot.event_special_event_starts_at, false);
    writeFormValue(form, "event_special_venue_id", snapshot.event_special_venue_id, false);
    writeFormValue(form, "event_special_variant", snapshot.event_special_variant, false);

    writeFormValue(form, "event_special_origin_address", snapshot.event_special_origin_address, false);
    writeFormValue(form, "event_special_origin_address_place_id", snapshot.event_special_origin_address_place_id, false);
    writeFormValue(form, "event_special_origin_address_lat", snapshot.event_special_origin_address_lat, false);
    writeFormValue(form, "event_special_origin_address_lng", snapshot.event_special_origin_address_lng, false);

    writeFormValue(form, "event_special_destination_address", snapshot.event_special_destination_address, false);
    writeFormValue(form, "event_special_destination_address_place_id", snapshot.event_special_destination_address_place_id, false);
    writeFormValue(form, "event_special_destination_address_lat", snapshot.event_special_destination_address_lat, false);
    writeFormValue(form, "event_special_destination_address_lng", snapshot.event_special_destination_address_lng, false);

    writeFormValue(form, "event_special_origin_pickup_time", snapshot.event_special_origin_pickup_time, false);
    writeFormValue(form, "event_special_return_pickup_time", snapshot.event_special_return_pickup_time, false);
    writeFormValue(form, "event_special_return_pickup_day_offset", snapshot.event_special_return_pickup_day_offset, false);
    writeFormValue(form, "event_special_return_pickup_label", snapshot.event_special_return_pickup_label, false);

    writeFormValue(form, "event_special_estimated_event_arrival_time", snapshot.event_special_estimated_event_arrival_time, false);
    writeFormValue(form, "event_special_estimated_destination_arrival_time", snapshot.event_special_estimated_destination_arrival_time, false);
    writeFormValue(form, "event_special_outbound_duration_seconds", snapshot.event_special_outbound_duration_seconds, false);
    writeFormValue(form, "event_special_return_duration_seconds", snapshot.event_special_return_duration_seconds, false);
    writeFormValue(form, "event_special_outbound_distance_meters", snapshot.event_special_outbound_distance_meters, false);
    writeFormValue(form, "event_special_return_distance_meters", snapshot.event_special_return_distance_meters, false);

    writeFormValue(form, "event_special_passenger_fare_key", snapshot.event_special_passenger_fare_key, false);
    writeFormValue(form, "event_special_price", snapshot.event_special_price, false);
    writeFormValue(form, "event_special_currency", snapshot.event_special_currency, false);
    writeFormValue(form, "event_special_notes", contactData.notes, false);

    formsApi.syncReservationRequestState(fields);

    if (typeof formsApi.refreshReservationRequestValidationUX === "function") {
      return formsApi.refreshReservationRequestValidationUX(fields);
    }

    return true;
  }
  
    function parsePositiveAnalyticsNumber(value) {
    const numericValue = Number(normalizeText(value));

    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : NaN;
  }
  
    function trackEventMobileContactRequest(snapshot) {
    const analytics = window.PixkuyAnalytics;
    const safeSnapshot = snapshot || {};
    const price = parsePositiveAnalyticsNumber(safeSnapshot.event_special_price);
    const outboundDistanceMeters = parsePositiveAnalyticsNumber(safeSnapshot.event_special_outbound_distance_meters);
    const returnDistanceMeters = parsePositiveAnalyticsNumber(safeSnapshot.event_special_return_distance_meters);
    const outboundDurationSeconds = parsePositiveAnalyticsNumber(safeSnapshot.event_special_outbound_duration_seconds);
    const returnDurationSeconds = parsePositiveAnalyticsNumber(safeSnapshot.event_special_return_duration_seconds);
    const payload = {
      service_type: "event_special",
      event_id: normalizeText(safeSnapshot.event_special_event_id),
      venue_id: normalizeText(safeSnapshot.event_special_venue_id),
      variant: normalizeText(safeSnapshot.event_special_variant),
      passenger_fare_key: normalizeText(safeSnapshot.event_special_passenger_fare_key),
      currency: normalizeText(safeSnapshot.event_special_currency),
      flow_surface: "mobile_route"
    };

    if (Number.isFinite(price)) {
      payload.price = price;
    }

    if (Number.isFinite(outboundDistanceMeters)) {
      payload.outbound_distance_meters = outboundDistanceMeters;
    }

    if (Number.isFinite(returnDistanceMeters)) {
      payload.return_distance_meters = returnDistanceMeters;
    }

    if (Number.isFinite(outboundDurationSeconds)) {
      payload.outbound_duration_seconds = outboundDurationSeconds;
    }

    if (Number.isFinite(returnDurationSeconds)) {
      payload.return_duration_seconds = returnDurationSeconds;
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
    const snapshot = currentSnapshot;
    const contactData = getContactData();
    const isContactValid = validateContactStep();
    let isFormValid;

    if (!isContactValid) {
      return false;
    }

    if (!hasCompleteEventSnapshot(snapshot)) {
      showGlobalError();
      return false;
    }

    isFormValid = fillReservationForm(snapshot, contactData);

    if (!isFormValid) {
      showGlobalError();
      return false;
    }

    if (form && typeof form.requestSubmit === "function") {
      trackEventMobileContactRequest(snapshot);
      form.requestSubmit();
      return true;
    }

    showGlobalError();
    return false;
  }

  function bindContactStepEvents() {
    if (!contactStepNode || contactStepNode.dataset.eventsMobileContactBound === "1") {
      return false;
    }

    contactStepNode.dataset.eventsMobileContactBound = "1";

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

        if (name === FIELD_NOTES) {
          field.addEventListener("focus", function onNotesFocus(event) {
            event.preventDefault();
            openNotesEditor();
          });

          field.addEventListener("click", function onNotesClick(event) {
            event.preventDefault();
            openNotesEditor();
          });
        }
      });

    contactStepNode.addEventListener("click", function onClick(event) {
      const notesEditorClose = event.target.closest("[data-events-mobile-notes-editor-close]");
      const notesEditorClear = event.target.closest("[data-events-mobile-notes-editor-clear]");
      const back = event.target.closest("[data-events-mobile-contact-back]");
      const submit = event.target.closest("[data-events-mobile-contact-submit]");

      if (notesEditorClose) {
        event.preventDefault();
        closeNotesEditor();
        return;
      }

      if (notesEditorClear) {
        const notesEditorInput = getNotesEditorInput();

        event.preventDefault();

        if (notesEditorInput) {
          notesEditorInput.value = "";
          syncNotesEditorToCompact();
          syncNotesEditorClear();
          notesEditorInput.focus({ preventScroll: true });
        }

        return;
      }

      if (back) {
        event.preventDefault();

        if (getNotesEditorNode() && getNotesEditorNode().hidden !== true) {
          closeNotesEditor();
          return;
        }

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

    const notesEditorInput = getNotesEditorInput();

    if (notesEditorInput) {
      notesEditorInput.addEventListener("input", function onNotesEditorInput() {
        syncNotesEditorToCompact();
        syncNotesEditorClear();
      });
    }

    return true;
  }

  function open(configStep, payload) {
    const snapshot = buildSnapshotFromPayload(payload);
    const node = ensureContactStepNode(configStep);

    if (!isMobileViewport() || !configStep || !node || !hasCompleteEventSnapshot(snapshot)) {
      return false;
    }

    currentConfigStep = configStep;
    currentSnapshot = snapshot;

    syncCopy();
    syncSummary(snapshot);
    syncSubmitAvailability();

    configStep.setAttribute(PRIMARY_STEP_HIDDEN_ATTR, "true");
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

    if (getNotesEditorNode() && getNotesEditorNode().hidden !== true) {
      closeNotesEditor();
    }

    blurActiveElementInside(contactStepNode);

    if (currentConfigStep) {
      currentConfigStep.removeAttribute(PRIMARY_STEP_HIDDEN_ATTR);
    }

    contactStepNode.hidden = true;
    contactStepNode.setAttribute("aria-hidden", "true");
    document.body.setAttribute(CONTACT_STEP_ACTIVE_ATTR, "false");

    currentConfigStep = null;
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
    return hasCompleteEventSnapshot(buildSnapshotFromPayload(payload));
  }

  window.PixkuyEventsMobileContactStep = {
    open,
    close,
    isOpen,
    canOpen,
    syncCopy,
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