/* assets/js/services/direct-transfer-mobile-contact-step.js
   Direct transfer mobile contact step.
   Responsabilidad:
   - crear la segunda pantalla móvil del flujo direct_transfer
   - mostrar resumen compacto del traslado configurado
   - recoger datos personales mínimos
   - usar form[name="contact"] como infraestructura técnica de envío Netlify
   - no hacer scroll a #contact
   - no activar el editor visual legacy de #contact
   - no tocar Google Places, Google Ads, WhatsApp ni success modal
*/

(function initDirectTransferMobileContactStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const CONTACT_STEP_SELECTOR = "[data-direct-transfer-mobile-contact-step]";
  const CONTACT_STEP_ACTIVE_ATTR = "data-direct-transfer-mobile-contact-step-active";
  const NOTES_EDITOR_ACTIVE_ATTR = "data-direct-transfer-mobile-notes-editor-active";
  const PRIMARY_STEP_HIDDEN_ATTR = "data-direct-transfer-mobile-config-step-hidden";

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
    return getI18nValue(
      "directTransferMobileFlow.title",
      "Traslados directos"
    );
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

  function normalizeSnapshotNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? String(Math.round(number)) : "";
  }
  
    function getQuoteNumberValue(quote, keys) {
    const safeQuote = quote && typeof quote === "object" ? quote : {};
    const candidates = Array.isArray(keys) ? keys : [];
    let index;

    for (index = 0; index < candidates.length; index += 1) {
      const key = candidates[index];
      const value = safeQuote[key];
      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }

    if (safeQuote.route && typeof safeQuote.route === "object") {
      for (index = 0; index < candidates.length; index += 1) {
        const key = candidates[index];
        const value = safeQuote.route[key];
        const number = Number(value);

        if (Number.isFinite(number) && number > 0) {
          return number;
        }
      }
    }

    return null;
  }

  function formatDistanceSummaryLabel(snapshot) {
    const meters = Number(snapshot && snapshot.direct_transfer_distance_meters);

    if (!Number.isFinite(meters) || meters <= 0) {
      return "";
    }

    const kilometers = meters / 1000;
    const roundedKilometers = kilometers >= 10
      ? Math.round(kilometers)
      : Math.round(kilometers * 10) / 10;

    return [
      String(roundedKilometers).replace(".", ","),
      getI18nValue("directTransferMobileFlow.estimate.distanceUnit", "km")
    ].filter(Boolean).join(" ");
  }

  function formatDurationSummaryLabel(snapshot) {
    const seconds = Number(snapshot && snapshot.direct_transfer_duration_seconds);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "";
    }

    const minutes = Math.max(1, Math.round(seconds / 60));

    return getI18nValue(
      "directTransferMobileFlow.estimate.minutesApproxShort",
      "{minutes} min aprox."
    ).replace("{minutes}", String(minutes));
  }

  function buildEstimateSummaryLabel(snapshot) {
    return [
      formatDistanceSummaryLabel(snapshot),
      formatDurationSummaryLabel(snapshot)
    ].filter(Boolean).join(
      getI18nValue("directTransferMobileFlow.estimate.separator", " · ")
    );
  }

  function buildSnapshotFromPayload(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const quote = safePayload.quote && typeof safePayload.quote === "object"
      ? safePayload.quote
      : {};
    const originAddress = safePayload.originAddress && typeof safePayload.originAddress === "object"
      ? safePayload.originAddress
      : {};
    const destinationAddress = safePayload.destinationAddress && typeof safePayload.destinationAddress === "object"
      ? safePayload.destinationAddress
      : {};
    const price = normalizeText(
      typeof quote.price === "number" ? String(quote.price) : quote.price
    );
    const currency = normalizeText(quote.currency) || "MXN";
    const durationSeconds = getQuoteNumberValue(quote, [
      "durationSeconds",
      "duration_seconds",
      "duration"
    ]);
    const distanceMeters = getQuoteNumberValue(quote, [
      "distanceMeters",
      "distance_meters",
      "distance"
    ]);

    return {
      serviceType: "direct_transfer",

      direct_transfer_origin_address: normalizeText(originAddress.label),
      direct_transfer_origin_place_id: normalizeText(originAddress.placeId),
      direct_transfer_origin_lat: normalizeText(originAddress.lat),
      direct_transfer_origin_lng: normalizeText(originAddress.lng),

      direct_transfer_destination_address: normalizeText(destinationAddress.label),
      direct_transfer_destination_place_id: normalizeText(destinationAddress.placeId),
      direct_transfer_destination_lat: normalizeText(destinationAddress.lat),
      direct_transfer_destination_lng: normalizeText(destinationAddress.lng),

      direct_transfer_date: normalizeText(safePayload.date),
      direct_transfer_time: normalizeText(safePayload.time),

      direct_transfer_passenger_fare_key: normalizeText(safePayload.passengerFareKey),
      direct_transfer_passenger_bucket_label: normalizeText(safePayload.passengerBucketLabel),

      direct_transfer_price: price,
      direct_transfer_currency: price ? currency : "",
      direct_transfer_price_label:
        normalizeText(safePayload.priceLabel) ||
        formatCurrencyValue(price, currency),

      direct_transfer_duration_seconds: normalizeSnapshotNumber(durationSeconds),
      direct_transfer_distance_meters: normalizeSnapshotNumber(distanceMeters),
      direct_transfer_vehicle_label: normalizeText(safePayload.vehicleLabel) || "BYD M9",
      direct_transfer_notes: normalizeText(safePayload.notes)
    };
  }

  function hasCompleteDirectTransferSnapshot(snapshot) {
    const safeSnapshot = snapshot || {};

    return Boolean(
      safeSnapshot.direct_transfer_origin_address &&
      safeSnapshot.direct_transfer_origin_place_id &&
      safeSnapshot.direct_transfer_destination_address &&
      safeSnapshot.direct_transfer_destination_place_id &&
      safeSnapshot.direct_transfer_date &&
      safeSnapshot.direct_transfer_time &&
      safeSnapshot.direct_transfer_passenger_fare_key &&
      safeSnapshot.direct_transfer_price &&
      safeSnapshot.direct_transfer_currency
    );
  }

  function getContactField(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-direct-transfer-mobile-contact-field="' + name + '"]')
      : null;
  }

  function getContactError(name) {
    const root = contactStepNode;

    return root
      ? root.querySelector('[data-direct-transfer-mobile-contact-error="' + name + '"]')
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
      ? contactStepNode.querySelector("[data-direct-transfer-mobile-notes-editor]")
      : null;
  }

  function getNotesEditorInput() {
    const editor = getNotesEditorNode();

    return editor
      ? editor.querySelector("[data-direct-transfer-mobile-notes-editor-input]")
      : null;
  }

  function getCompactNotesInput() {
    return getContactField(FIELD_NOTES);
  }

  function syncNotesEditorClear(notesEditor) {
    const editor = notesEditor || getNotesEditorNode();
    const input = editor
      ? editor.querySelector("[data-direct-transfer-mobile-notes-editor-input]")
      : null;
    const clear = editor
      ? editor.querySelector("[data-direct-transfer-mobile-notes-editor-clear]")
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

  function buildSummaryRow(key) {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");

    row.className = "direct-transfer-mobile-contact-step__summary-row";
    row.setAttribute("data-direct-transfer-mobile-contact-summary-row", key);

    label.className = "direct-transfer-mobile-contact-step__summary-label";
    label.setAttribute("data-direct-transfer-mobile-contact-summary-label", key);

    value.className = "direct-transfer-mobile-contact-step__summary-value";
    value.setAttribute("data-direct-transfer-mobile-contact-summary-value", key);

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

    editor.className = "direct-transfer-mobile-notes-editor";
    editor.setAttribute("data-direct-transfer-mobile-notes-editor", "1");
    editor.setAttribute("aria-hidden", "true");
    editor.hidden = true;

    panel.className = "direct-transfer-mobile-notes-editor__panel";

    header.className = "direct-transfer-mobile-notes-editor__header";

    title.className = "direct-transfer-mobile-notes-editor__title";
    title.setAttribute("data-direct-transfer-mobile-notes-editor-title", "1");

    close.type = "button";
    close.className = "direct-transfer-mobile-notes-editor__close";
    close.setAttribute("data-direct-transfer-mobile-notes-editor-close", "1");

    body.className = "direct-transfer-mobile-notes-editor__body";

    textarea.className = "direct-transfer-mobile-notes-editor__input";
    textarea.rows = 8;
    textarea.setAttribute("data-direct-transfer-mobile-notes-editor-input", "1");

    clear.type = "button";
    clear.className = "direct-transfer-mobile-notes-editor__clear";
    clear.setAttribute("data-direct-transfer-mobile-notes-editor-clear", "1");
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
    const fieldId = "direct-transfer-mobile-contact-" + name;

    wrapper.className = "direct-transfer-mobile-contact-step__field";
    wrapper.setAttribute("data-direct-transfer-mobile-contact-field-wrapper", name);

    label.className = "direct-transfer-mobile-contact-step__label";
    label.setAttribute("for", fieldId);
    label.setAttribute("data-direct-transfer-mobile-contact-label", name);

    field.id = fieldId;
    field.className = "direct-transfer-mobile-contact-step__control";
    field.setAttribute("data-direct-transfer-mobile-contact-field", name);
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
    error.className = "direct-transfer-mobile-contact-step__error";
    error.setAttribute("data-direct-transfer-mobile-contact-error", name);
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

    root.className = "direct-transfer-mobile-contact-step";
    root.setAttribute("data-direct-transfer-mobile-contact-step", "1");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;

    backRow.className = "direct-transfer-mobile-config-step__back-row";

    back.type = "button";
    back.className = "direct-transfer-mobile-config-step__back";
    back.setAttribute("data-direct-transfer-mobile-contact-back", "1");

    summary.className = "direct-transfer-mobile-contact-step__summary";
    summary.setAttribute("data-direct-transfer-mobile-contact-summary", "1");

    summaryTitle.className = "direct-transfer-mobile-contact-step__summary-title";
    summaryTitle.setAttribute("data-direct-transfer-mobile-contact-summary-title", "1");

    summaryList.className = "direct-transfer-mobile-contact-step__summary-list";
    summaryList.setAttribute("data-direct-transfer-mobile-contact-summary-list", "1");

    [
      "origin",
      "destination",
      "date",
      "time",
      "passengers",
      "vehicle",
      "estimate",
      "price"
    ].forEach(function appendRow(key) {
      summaryList.appendChild(buildSummaryRow(key));
    });

    form.className = "direct-transfer-mobile-contact-step__form";
    form.setAttribute("data-direct-transfer-mobile-contact-form", "1");

    form.appendChild(buildField(FIELD_NAME, "text", "name"));
    form.appendChild(buildField(FIELD_PHONE, "tel", "tel"));
    form.appendChild(buildField(FIELD_EMAIL, "email", "email"));
    form.appendChild(buildField(FIELD_NOTES, "", ""));

    globalError.className = "direct-transfer-mobile-contact-step__global-error";
    globalError.setAttribute("data-direct-transfer-mobile-contact-global-error", "1");
    globalError.hidden = true;

    actions.className = "direct-transfer-mobile-contact-step__actions";

    submit.type = "button";
    submit.className = "direct-transfer-mobile-contact-step__submit";
    submit.setAttribute("data-direct-transfer-mobile-contact-submit", "1");

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
      ? configStep.closest("[data-direct-transfer-mobile-route]")
      : document.querySelector("[data-direct-transfer-mobile-route]");

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
          '[data-direct-transfer-mobile-contact-summary-value="' + key + '"]'
        )
      : null;
  }
  
    function getSummaryRowNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-direct-transfer-mobile-contact-summary-row="' + key + '"]'
        )
      : null;
  }

  function getSummaryLabelNode(key) {
    return contactStepNode
      ? contactStepNode.querySelector(
          '[data-direct-transfer-mobile-contact-summary-label="' + key + '"]'
        )
      : null;
  }

  function syncSummary(snapshot) {
    const safeSnapshot = snapshot || {};
    const summaryTitle = contactStepNode
      ? contactStepNode.querySelector("[data-direct-transfer-mobile-contact-summary-title]")
      : null;
    const values = {
      origin: getCompactAddressLabel(safeSnapshot.direct_transfer_origin_address),
      destination: getCompactAddressLabel(safeSnapshot.direct_transfer_destination_address),
      date: safeSnapshot.direct_transfer_date || "",
      time: safeSnapshot.direct_transfer_time || "",
      passengers: safeSnapshot.direct_transfer_passenger_bucket_label || "",
      vehicle: safeSnapshot.direct_transfer_vehicle_label || "",
      estimate: buildEstimateSummaryLabel(safeSnapshot),
      price: safeSnapshot.direct_transfer_price_label || ""
    };

    setText(
      summaryTitle,
      getI18nValue("directTransferMobileFlow.contactStep.summary.title", "")
    );

    Object.keys(values).forEach(function syncValue(key) {
      setText(getSummaryValueNode(key), values[key]);
      setHidden(getSummaryRowNode(key), key === "estimate" && !values[key]);
    });

    return true;
  }

  function syncCopy() {
    const root = contactStepNode;
    const back = root
      ? root.querySelector("[data-direct-transfer-mobile-contact-back]")
      : null;
    const submit = root
      ? root.querySelector("[data-direct-transfer-mobile-contact-submit]")
      : null;
    const globalError = root
      ? root.querySelector("[data-direct-transfer-mobile-contact-global-error]")
      : null;
    const notesEditorTitle = root
      ? root.querySelector("[data-direct-transfer-mobile-notes-editor-title]")
      : null;
    const notesEditorClose = root
      ? root.querySelector("[data-direct-transfer-mobile-notes-editor-close]")
      : null;
    const notesEditorInput = root
      ? root.querySelector("[data-direct-transfer-mobile-notes-editor-input]")
      : null;
    const notesEditorClear = root
      ? root.querySelector("[data-direct-transfer-mobile-notes-editor-clear]")
      : null;

    if (!root) {
      return false;
    }

    setText(
      back,
      getI18nValue("directTransferMobileFlow.back", "")
    );
    setText(
      submit,
      getI18nValue("directTransferMobileFlow.contactStep.cta.submit", "")
    );
    setText(
      globalError,
      getI18nValue("directTransferMobileFlow.contactStep.validation.formIncomplete", "")
    );
    setText(
      notesEditorTitle,
      getI18nValue("directTransferMobileFlow.contactStep.notesEditor.title", "")
    );
    setText(
      notesEditorClose,
      getI18nValue("directTransferMobileFlow.contactStep.notesEditor.save", "")
    );
    if (notesEditorClear) {
      notesEditorClear.setAttribute(
        "aria-label",
        getI18nValue("directTransferMobileFlow.contactStep.notesEditor.clear", "")
      );
    }

    if (notesEditorInput) {
      notesEditorInput.setAttribute(
        "placeholder",
        getI18nValue("directTransferMobileFlow.contactStep.notesEditor.placeholder", "")
      );
      notesEditorInput.setAttribute(
        "aria-label",
        getI18nValue("directTransferMobileFlow.contactStep.notesEditor.title", "")
      );
    }

    ["origin", "destination", "date", "time", "passengers", "vehicle", "estimate", "price"]
      .forEach(function syncSummaryLabel(key) {
        setText(
          getSummaryLabelNode(key),
          getI18nValue(
            "directTransferMobileFlow.contactStep.summary." + key,
            key === "estimate"
              ? getI18nValue("directTransferMobileFlow.estimate.summaryLabel", "Ruta")
              : ""
          )
        );
      });

    [FIELD_NAME, FIELD_PHONE, FIELD_EMAIL, FIELD_NOTES]
      .forEach(function syncFieldCopy(name) {
        const field = getContactField(name);
        const label = root.querySelector(
          '[data-direct-transfer-mobile-contact-label="' + name + '"]'
        );
        const error = getContactError(name);
        const fieldLabel = getI18nValue(
          "directTransferMobileFlow.contactStep.fields." + name,
          ""
        );
        const placeholder = getI18nValue(
          "directTransferMobileFlow.contactStep.placeholders." + name,
          ""
        );

        setText(label, fieldLabel);

        if (field) {
          field.setAttribute("placeholder", placeholder);
          field.setAttribute("aria-label", fieldLabel);
        }

        setText(
          error,
          getI18nValue("directTransferMobileFlow.contactStep.validation." + name, "")
        );
      });

    return true;
  }

  function setFieldValidity(name, isValid) {
    const field = getContactField(name);
    const wrapper = contactStepNode
      ? contactStepNode.querySelector(
          '[data-direct-transfer-mobile-contact-field-wrapper="' + name + '"]'
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
      ? contactStepNode.querySelector("[data-direct-transfer-mobile-contact-global-error]")
      : null;

    setHidden(error, true);
    return true;
  }

  function showGlobalError() {
    const error = contactStepNode
      ? contactStepNode.querySelector("[data-direct-transfer-mobile-contact-global-error]")
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
      ? contactStepNode.querySelector("[data-direct-transfer-mobile-contact-submit]")
      : null;
    const isReady = hasFilledContactData();

    if (!submit) {
      return false;
    }

    submit.disabled = !isReady;
    submit.setAttribute("aria-disabled", isReady ? "false" : "true");
    submit.setAttribute("data-direct-transfer-mobile-contact-submit-ready", isReady ? "true" : "false");

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
      origin: getI18nValue("directTransferMobileFlow.contactStep.summary.origin", ""),
      destination: getI18nValue("directTransferMobileFlow.contactStep.summary.destination", ""),
      date: getI18nValue("directTransferMobileFlow.contactStep.summary.date", ""),
      time: getI18nValue("directTransferMobileFlow.contactStep.summary.time", ""),
      passengers: getI18nValue("directTransferMobileFlow.contactStep.summary.passengers", ""),
      vehicle: getI18nValue("directTransferMobileFlow.contactStep.summary.vehicle", ""),
      estimate: getI18nValue(
        "directTransferMobileFlow.contactStep.summary.estimate",
        getI18nValue("directTransferMobileFlow.estimate.summaryLabel", "Ruta")
      ),
      price: getI18nValue("directTransferMobileFlow.contactStep.summary.price", "")
    };
    const parts = [];

    if (safeSnapshot.direct_transfer_origin_address) {
      parts.push(labels.origin + ": " + safeSnapshot.direct_transfer_origin_address);
    }

    if (safeSnapshot.direct_transfer_destination_address) {
      parts.push(labels.destination + ": " + safeSnapshot.direct_transfer_destination_address);
    }

    if (safeSnapshot.direct_transfer_date) {
      parts.push(labels.date + ": " + safeSnapshot.direct_transfer_date);
    }

    if (safeSnapshot.direct_transfer_time) {
      parts.push(labels.time + ": " + safeSnapshot.direct_transfer_time);
    }

    if (safeSnapshot.direct_transfer_passenger_bucket_label) {
      parts.push(labels.passengers + ": " + safeSnapshot.direct_transfer_passenger_bucket_label);
    }

    if (safeSnapshot.direct_transfer_vehicle_label) {
      parts.push(labels.vehicle + ": " + safeSnapshot.direct_transfer_vehicle_label);
    }

    if (buildEstimateSummaryLabel(safeSnapshot)) {
      parts.push(labels.estimate + ": " + buildEstimateSummaryLabel(safeSnapshot));
    }

    if (safeSnapshot.direct_transfer_price_label) {
      parts.push(labels.price + ": " + safeSnapshot.direct_transfer_price_label);
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

    writeFormValue(form, "service_type", "direct_transfer", false);

    writeFormValue(form, "name", contactData.name, true);
    writeFormValue(form, "phone", contactData.phone, true);
    writeFormValue(form, "email", contactData.email, true);

    writeFormValue(form, "trip_date", snapshot.direct_transfer_date, true);
    writeFormValue(form, "trip_time", snapshot.direct_transfer_time, true);
    writeFormValue(form, "origin", snapshot.direct_transfer_origin_address, true);
    writeFormValue(form, "destination", snapshot.direct_transfer_destination_address, true);
    writeFormValue(form, "passengers", "", true);
    writeFormValue(form, "luggage", "", true);
    writeFormValue(form, "message", contactData.notes, true);

    writeFormValue(form, "service_label", getServiceLabel(), false);
    writeFormValue(form, "request_summary", summary, false);
    writeFormValue(form, "direct_transfer_trip_summary", summary, false);

    writeFormValue(form, "direct_transfer_origin_label", snapshot.direct_transfer_origin_address, false);
    writeFormValue(form, "direct_transfer_destination_label", snapshot.direct_transfer_destination_address, false);
    writeFormValue(form, "direct_transfer_passenger_bucket_label", snapshot.direct_transfer_passenger_bucket_label, false);
    writeFormValue(form, "direct_transfer_price_label", snapshot.direct_transfer_price_label, false);

    writeFormValue(form, "direct_transfer_origin_address", snapshot.direct_transfer_origin_address, false);
    writeFormValue(form, "direct_transfer_origin_place_id", snapshot.direct_transfer_origin_place_id, false);
    writeFormValue(form, "direct_transfer_origin_lat", snapshot.direct_transfer_origin_lat, false);
    writeFormValue(form, "direct_transfer_origin_lng", snapshot.direct_transfer_origin_lng, false);

    writeFormValue(form, "direct_transfer_destination_address", snapshot.direct_transfer_destination_address, false);
    writeFormValue(form, "direct_transfer_destination_place_id", snapshot.direct_transfer_destination_place_id, false);
    writeFormValue(form, "direct_transfer_destination_lat", snapshot.direct_transfer_destination_lat, false);
    writeFormValue(form, "direct_transfer_destination_lng", snapshot.direct_transfer_destination_lng, false);

    writeFormValue(form, "direct_transfer_date", snapshot.direct_transfer_date, false);
    writeFormValue(form, "direct_transfer_time", snapshot.direct_transfer_time, false);
    writeFormValue(form, "direct_transfer_passenger_fare_key", snapshot.direct_transfer_passenger_fare_key, false);
    writeFormValue(form, "direct_transfer_passenger_bucket_label", snapshot.direct_transfer_passenger_bucket_label, false);
    writeFormValue(form, "direct_transfer_price", snapshot.direct_transfer_price, false);
    writeFormValue(form, "direct_transfer_currency", snapshot.direct_transfer_currency, false);
    writeFormValue(form, "direct_transfer_duration_seconds", snapshot.direct_transfer_duration_seconds, false);
    writeFormValue(form, "direct_transfer_distance_meters", snapshot.direct_transfer_distance_meters, false);
    writeFormValue(form, "direct_transfer_vehicle_label", snapshot.direct_transfer_vehicle_label, false);
    writeFormValue(form, "direct_transfer_notes", contactData.notes, false);

    writeFormValue(form, "origin_place_id", snapshot.direct_transfer_origin_place_id, false);
    writeFormValue(form, "origin_lat", snapshot.direct_transfer_origin_lat, false);
    writeFormValue(form, "origin_lng", snapshot.direct_transfer_origin_lng, false);

    writeFormValue(form, "destination_place_id", snapshot.direct_transfer_destination_place_id, false);
    writeFormValue(form, "destination_lat", snapshot.direct_transfer_destination_lat, false);
    writeFormValue(form, "destination_lng", snapshot.direct_transfer_destination_lng, false);

    formsApi.syncReservationRequestState(fields);

    if (typeof formsApi.refreshReservationRequestValidationUX === "function") {
      return formsApi.refreshReservationRequestValidationUX(fields);
    }

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

    if (!hasCompleteDirectTransferSnapshot(snapshot)) {
      showGlobalError();
      return false;
    }

    isFormValid = fillReservationForm(snapshot, contactData);

    if (!isFormValid) {
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
    if (!contactStepNode || contactStepNode.dataset.directTransferMobileContactBound === "1") {
      return false;
    }

    contactStepNode.dataset.directTransferMobileContactBound = "1";

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
      const notesEditorClose = event.target.closest("[data-direct-transfer-mobile-notes-editor-close]");
      const notesEditorClear = event.target.closest("[data-direct-transfer-mobile-notes-editor-clear]");
      const back = event.target.closest("[data-direct-transfer-mobile-contact-back]");
      const submit = event.target.closest("[data-direct-transfer-mobile-contact-submit]");

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

    if (!isMobileViewport() || !configStep || !node || !hasCompleteDirectTransferSnapshot(snapshot)) {
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
    return hasCompleteDirectTransferSnapshot(buildSnapshotFromPayload(payload));
  }

  window.PixkuyDirectTransferMobileContactStep = {
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