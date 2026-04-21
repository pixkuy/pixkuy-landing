(function initContactHourlyDailyEditorModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});

  const MODES = Object.freeze({
    HOURLY: "hourly",
    FULL_DAY: "full_day",
    LONG_TERM: "custom_long_term"
  });

  const DEFAULT_MODE = MODES.HOURLY;
  const DEFAULT_VEHICLE_TYPE = "executive_van";
  const DEFAULT_DURATION_HOURS = 2;
  const DEFAULT_CURRENCY = "MXN";

  const HOURLY_DURATION_OPTIONS = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const LONG_TERM_OPTIONS = Object.freeze(["week", "fortnight", "monthly", "custom"]);

  const state = {
    mode: DEFAULT_MODE,
    vehicleType: DEFAULT_VEHICLE_TYPE,
    pickup: "",
    pickupPlaceId: "",
    pickupLat: "",
    pickupLng: "",
    tripDate: "",
    startTime: "",
    durationHours: DEFAULT_DURATION_HOURS,
    longTermOption: "",
    notes: "",
    price: "",
    currency: DEFAULT_CURRENCY
  };

  let pickupController = null;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      return NAMESPACE.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function isHourlyDailyServiceActive(form) {
    const reservationForm = form || getReservationForm();
    const serviceTypeField = reservationForm
      ? reservationForm.querySelector('input[name="service_type"]')
      : null;

    return normalizeText(serviceTypeField && serviceTypeField.value) === "hourly_daily";
  }

  function getI18nValue(path, fallback) {
    const dict = window.__pixkuyI18nDict;

    if (!dict || !path) {
      return fallback || "";
    }

    const parts = String(path).split(".");
    let cursor = dict;

    for (let index = 0; index < parts.length; index += 1) {
      const key = parts[index];

      if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
        return fallback || "";
      }

      cursor = cursor[key];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function getLabels() {
    return {
      serviceLabel: getI18nValue("contact.services.hourlyDaily", ""),
      helper: getI18nValue("services.cards.hourly.contact.helper", ""),
      modeLabel: getI18nValue("services.cards.hourly.panel.modeLabel", ""),
      pickupLabel: getI18nValue("services.cards.hourly.panel.pickupLabel", ""),
      dateLabel: getI18nValue("services.cards.hourly.panel.dateLabel", ""),
      timeLabel: getI18nValue("services.cards.hourly.panel.timeLabel", ""),
      durationLabel: getI18nValue("services.cards.hourly.panel.durationLabel", ""),
      longTermDurationLabel: getI18nValue("services.cards.hourly.panel.longTermDurationLabel", ""),
      notesLabel: getI18nValue("services.cards.hourly.panel.notesLabel", ""),
      priceLabel: getI18nValue("services.cards.hourly.panel.priceLabel", ""),
      fullDayPriceLabel: getI18nValue("services.cards.hourly.panel.fullDayPriceLabel", ""),
      longTermPriceLabel: getI18nValue("services.cards.hourly.panel.longTermPriceLabel", ""),
      longTermPriceValue: getI18nValue("services.cards.hourly.panel.longTermPriceValue", ""),
      pricePending: getI18nValue("services.cards.hourly.panel.priceValuePending", "—"),
      pickupPlaceholder: getI18nValue("services.cards.hourly.panel.pickupPlaceholder", ""),
      notesPlaceholder: getI18nValue("services.cards.hourly.panel.notesPlaceholder", ""),
      longTermNotesPlaceholder: getI18nValue("services.cards.hourly.panel.longTermNotesPlaceholder", ""),
      tabHourly: getI18nValue("services.cards.hourly.panel.tabs.hourly", ""),
      tabFullDay: getI18nValue("services.cards.hourly.panel.tabs.fullDay", ""),
      tabLongTerm: getI18nValue("services.cards.hourly.panel.tabs.longTerm", ""),
      longTermWeek: getI18nValue("services.cards.hourly.panel.longTerm.week", ""),
      longTermFortnight: getI18nValue("services.cards.hourly.panel.longTerm.fortnight", ""),
      longTermMonthly: getI18nValue("services.cards.hourly.panel.longTerm.monthly", ""),
      longTermCustom: getI18nValue("services.cards.hourly.panel.longTerm.custom", ""),
      disclaimers: {
        includesTitle: getI18nValue("services.cards.hourly.panel.disclaimers.includesTitle", ""),
        supplementsTitle: getI18nValue("services.cards.hourly.panel.disclaimers.supplementsTitle", ""),
        includesServiceKm: getI18nValue("services.cards.hourly.panel.disclaimers.includesServiceKm", ""),
        fullDayIncludesKm: getI18nValue("services.cards.hourly.panel.disclaimers.fullDayIncludesKm", ""),
        includesServiceWifi: getI18nValue("services.cards.hourly.panel.disclaimers.includesServiceWifi", ""),
        includesServiceWater: getI18nValue("services.cards.hourly.panel.disclaimers.includesServiceWater", ""),
        includesVanPassengers: getI18nValue("services.cards.hourly.panel.disclaimers.includesVanPassengers", ""),
        includesVanUsb: getI18nValue("services.cards.hourly.panel.disclaimers.includesVanUsb", ""),
        includesVanSeats: getI18nValue("services.cards.hourly.panel.disclaimers.includesVanSeats", ""),
        extraHourExtension: getI18nValue("services.cards.hourly.panel.disclaimers.extraHourExtension", ""),
        fullDayExtraKm: getI18nValue("services.cards.hourly.panel.disclaimers.fullDayExtraKm", ""),
        fullDayExtensionPolicy: getI18nValue("services.cards.hourly.panel.disclaimers.fullDayExtensionPolicy", ""),
        extraKm: getI18nValue("services.cards.hourly.panel.disclaimers.extraKm", ""),
        outOfZone: getI18nValue("services.cards.hourly.panel.disclaimers.outOfZone", ""),
        longTermApproachTitle: getI18nValue("services.cards.hourly.panel.disclaimers.longTermApproachTitle", ""),
        longTermApproach1: getI18nValue("services.cards.hourly.panel.disclaimers.longTermApproach1", ""),
        longTermApproach2: getI18nValue("services.cards.hourly.panel.disclaimers.longTermApproach2", ""),
        longTermApproach3: getI18nValue("services.cards.hourly.panel.disclaimers.longTermApproach3", ""),
        longTermPricingTitle: getI18nValue("services.cards.hourly.panel.disclaimers.longTermPricingTitle", ""),
        longTermPricing1: getI18nValue("services.cards.hourly.panel.disclaimers.longTermPricing1", ""),
        longTermPricing2: getI18nValue("services.cards.hourly.panel.disclaimers.longTermPricing2", ""),
        longTermPricing3: getI18nValue("services.cards.hourly.panel.disclaimers.longTermPricing3", ""),
        longTermValidationTitle: getI18nValue("services.cards.hourly.panel.disclaimers.longTermValidationTitle", ""),
        longTermValidation1: getI18nValue("services.cards.hourly.panel.disclaimers.longTermValidation1", ""),
        longTermValidation2: getI18nValue("services.cards.hourly.panel.disclaimers.longTermValidation2", ""),
        longTermValidation3: getI18nValue("services.cards.hourly.panel.disclaimers.longTermValidation3", "")
      }
    };
  }

  function getModeLabel(mode) {
    const labels = getLabels();

    if (mode === MODES.FULL_DAY) {
      return labels.tabFullDay;
    }

    if (mode === MODES.LONG_TERM) {
      return labels.tabLongTerm;
    }

    return labels.tabHourly;
  }

  function getLongTermOptionLabel(option) {
    const labels = getLabels();

    if (option === "week") return labels.longTermWeek;
    if (option === "fortnight") return labels.longTermFortnight;
    if (option === "monthly") return labels.longTermMonthly;
    if (option === "custom") return labels.longTermCustom;

    return "";
  }

  function getPriceLabelByMode() {
    const labels = getLabels();

    if (state.mode === MODES.FULL_DAY) {
      return labels.fullDayPriceLabel || labels.priceLabel;
    }

    if (state.mode === MODES.LONG_TERM) {
      return labels.longTermPriceLabel || labels.priceLabel;
    }

    return labels.priceLabel;
  }

  function formatCurrency(value, currency) {
    const labels = getLabels();
    const currencyCode = normalizeText(currency) || DEFAULT_CURRENCY;

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return labels.pricePending;
    }

    try {
      const amount = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(value);

      return amount + " " + currencyCode;
    } catch (error) {
      return String(value) + " " + currencyCode;
    }
  }

  function getHourlyDailyMinimumDate() {
    const formsApi = NAMESPACE && typeof NAMESPACE === "object" ? NAMESPACE : {};
    const getMinimumDateTime =
      typeof formsApi.getReservationMinimumDateTime === "function"
        ? formsApi.getReservationMinimumDateTime
        : null;
    const formatDate =
      typeof formsApi.formatReservationDateForInput === "function"
        ? formsApi.formatReservationDateForInput
        : null;
    const minimumDateTime = getMinimumDateTime ? getMinimumDateTime() : null;

    if (!minimumDateTime || !formatDate) {
      return "";
    }

    return normalizeText(formatDate(minimumDateTime));
  }

  function shouldShowDateField() {
    return true;
  }

  function getComputedPriceNumber() {
    const temporalApi = window.PixkuyHourlyDailyTemporalPricing;
    const serviceDateLiteral = normalizeText(state.tripDate);
    let basePrice = null;

    if (state.mode === MODES.HOURLY) {
      basePrice = state.durationHours <= 2
        ? 4500
        : 4500 + ((state.durationHours - 2) * 1300);
    } else if (state.mode === MODES.FULL_DAY) {
      basePrice = 15000;
    }

    if (typeof basePrice !== "number" || !Number.isFinite(basePrice)) {
      return null;
    }

    if (shouldShowDateField()) {
      if (!serviceDateLiteral) {
        return null;
      }

      if (
        temporalApi &&
        typeof temporalApi.isIsoDateLiteral === "function" &&
        !temporalApi.isIsoDateLiteral(serviceDateLiteral)
      ) {
        return null;
      }

      if (
        temporalApi &&
        typeof temporalApi.applyTemporalPricing === "function"
      ) {
        return temporalApi.applyTemporalPricing(basePrice, serviceDateLiteral);
      }
    }

    return basePrice;
  }

  function getPriceLabelValue() {
    const labels = getLabels();

    if (state.mode === MODES.LONG_TERM) {
      return labels.longTermPriceValue;
    }

    if (!state.price) {
      return labels.pricePending;
    }

    return formatCurrency(Number(state.price), state.currency);
  }

  function getDurationLabelValue() {
    if (state.mode === MODES.FULL_DAY) {
      return getModeLabel(MODES.FULL_DAY);
    }

    if (state.mode === MODES.LONG_TERM) {
      return getLongTermOptionLabel(state.longTermOption);
    }

    if (HOURLY_DURATION_OPTIONS.indexOf(Number(state.durationHours)) >= 0) {
      return String(state.durationHours) + "h";
    }

    return "";
  }

  function buildTripSummary() {
    const labels = getLabels();
    const parts = [];
    const modeLabel = getModeLabel(state.mode);
    const durationLabel = getDurationLabelValue();
    const priceLabelValue = getPriceLabelValue();

    if (modeLabel) {
      parts.push(labels.modeLabel + ": " + modeLabel);
    }

    if (state.pickup) {
      parts.push(labels.pickupLabel + ": " + state.pickup);
    }

    if (state.tripDate) {
      parts.push(labels.dateLabel + ": " + state.tripDate);
    }

    if (state.startTime) {
      parts.push(labels.timeLabel + ": " + state.startTime);
    }

    if (durationLabel) {
      parts.push(
        (state.mode === MODES.LONG_TERM ? labels.longTermDurationLabel : labels.durationLabel) +
          ": " +
          durationLabel
      );
    }

    if (priceLabelValue) {
      parts.push(getPriceLabelByMode() + ": " + priceLabelValue);
    }

    return parts.join(" | ");
  }

  function getEditorRoot(form) {
    if (!form) {
      return null;
    }

    return form.querySelector("[data-contact-hourly-daily-editor]");
  }

  function getEditorNodes(form) {
    const root = getEditorRoot(form);

    if (!root) {
      return null;
    }

    return {
      root: root,

      helper: root.querySelector("[data-contact-hourly-daily-helper]"),

      modeInput: root.querySelector("[data-contact-hourly-daily-mode]"),
      modePickerRoot: root.querySelector("[data-contact-hourly-daily-modepicker]"),
      modeTrigger: root.querySelector("[data-contact-hourly-daily-mode-trigger]"),
      modeValue: root.querySelector("[data-contact-hourly-daily-mode-value]"),
      modePanel: root.querySelector("[data-contact-hourly-daily-mode-panel]"),
      modeOptions: Array.from(root.querySelectorAll("[data-contact-hourly-daily-mode-option]")),

      pickupInput: root.querySelector("[data-contact-hourly-daily-pickup]"),
      pickupMount: root.querySelector("[data-contact-hourly-daily-pickup-mount]"),

      dateInput: root.querySelector("[data-contact-hourly-daily-date]"),
      timeInput: root.querySelector("[data-contact-hourly-daily-time]"),

      durationField: root.querySelector("[data-contact-hourly-daily-duration-field]"),
      durationButtons: Array.from(root.querySelectorAll("[data-contact-hourly-daily-duration-option]")),

      longTermField: root.querySelector("[data-contact-hourly-daily-long-term-field]"),
      longTermButtons: Array.from(root.querySelectorAll("[data-contact-hourly-daily-long-term-option]")),

      notesInput: root.querySelector("[data-contact-hourly-daily-notes]"),

      disclaimersRoot: root.querySelector("[data-contact-hourly-daily-disclaimers]"),

      priceBlock: root.querySelector("[data-contact-hourly-daily-price]"),
      priceLabel: root.querySelector("[data-contact-hourly-daily-price-label]"),
      priceValue: root.querySelector("[data-contact-hourly-daily-price-value]"),

      hiddenMode: form.querySelector('input[name="hourly_daily_mode"]'),
      hiddenVehicleType: form.querySelector('input[name="hourly_daily_vehicle_type"]'),
      hiddenPickup: form.querySelector('input[name="hourly_daily_pickup"]'),
      hiddenPickupPlaceId: form.querySelector('input[name="hourly_daily_pickup_place_id"]'),
      hiddenPickupLat: form.querySelector('input[name="hourly_daily_pickup_lat"]'),
      hiddenPickupLng: form.querySelector('input[name="hourly_daily_pickup_lng"]'),
      hiddenDate: form.querySelector('input[name="hourly_daily_date"]'),
      hiddenStartTime: form.querySelector('input[name="hourly_daily_start_time"]'),
      hiddenDurationHours: form.querySelector('input[name="hourly_daily_duration_hours"]'),
      hiddenCustomTerm: form.querySelector('input[name="hourly_daily_custom_term"]'),
      hiddenNotes: form.querySelector('input[name="hourly_daily_notes"]'),
      hiddenPrice: form.querySelector('input[name="hourly_daily_price"]'),
      hiddenCurrency: form.querySelector('input[name="hourly_daily_currency"]'),
      hiddenKmIncluded: form.querySelector('input[name="hourly_daily_km_included"]'),
      hiddenExtraKmPrice: form.querySelector('input[name="hourly_daily_extra_km_price"]'),
      hiddenOutOfZoneSupplement: form.querySelector('input[name="hourly_daily_out_of_zone_supplement"]'),

      hiddenServiceLabel: form.querySelector('input[name="service_label"]'),
      hiddenRequestSummary: form.querySelector('input[name="request_summary"]'),
      hiddenTripSummary: form.querySelector('input[name="hourly_daily_trip_summary"]'),
      hiddenPickupLabel: form.querySelector('input[name="hourly_daily_pickup_label"]'),
      hiddenModeLabel: form.querySelector('input[name="hourly_daily_mode_label"]'),
      hiddenDurationLabel: form.querySelector('input[name="hourly_daily_duration_label"]'),
      hiddenPriceLabel: form.querySelector('input[name="hourly_daily_price_label"]')
    };
  }

  function hasCriticalNodes(nodes) {
    return Boolean(
      nodes &&
      nodes.root &&
      nodes.modeInput &&
      nodes.modePickerRoot &&
      nodes.modeTrigger &&
      nodes.modeValue &&
      nodes.modePanel &&
      nodes.modeOptions &&
      nodes.modeOptions.length &&
      nodes.pickupInput &&
      nodes.pickupMount &&
      nodes.dateInput &&
      nodes.timeInput &&
      nodes.durationField &&
      nodes.durationButtons &&
      nodes.durationButtons.length &&
      nodes.longTermField &&
      nodes.longTermButtons &&
      nodes.longTermButtons.length &&
      nodes.notesInput &&
      nodes.disclaimersRoot &&
      nodes.priceBlock &&
      nodes.priceLabel &&
      nodes.priceValue &&
      nodes.hiddenMode &&
      nodes.hiddenVehicleType &&
      nodes.hiddenPickup &&
      nodes.hiddenPickupPlaceId &&
      nodes.hiddenPickupLat &&
      nodes.hiddenPickupLng &&
      nodes.hiddenDate &&
      nodes.hiddenStartTime &&
      nodes.hiddenDurationHours &&
      nodes.hiddenCustomTerm &&
      nodes.hiddenNotes &&
      nodes.hiddenPrice &&
      nodes.hiddenCurrency &&
      nodes.hiddenKmIncluded &&
      nodes.hiddenExtraKmPrice &&
      nodes.hiddenOutOfZoneSupplement &&
      nodes.hiddenServiceLabel &&
      nodes.hiddenRequestSummary &&
      nodes.hiddenTripSummary &&
      nodes.hiddenPickupLabel &&
      nodes.hiddenModeLabel &&
      nodes.hiddenDurationLabel &&
      nodes.hiddenPriceLabel
    );
  }

  function writeHiddenValue(field, value) {
    if (!field) {
      return;
    }

    field.value = typeof value === "string" ? value : "";
  }

  function clearPickupPlaceSelection() {
    state.pickupPlaceId = "";
    state.pickupLat = "";
    state.pickupLng = "";
  }

  function applyPickupPlaceSelection(place) {
    const safePlace = place && typeof place === "object" ? place : {};

    state.pickup = normalizeText(
      safePlace.label ||
      safePlace.formattedAddress ||
      safePlace.displayName
    );

    state.pickupPlaceId = normalizeText(safePlace.placeId);
    state.pickupLat = normalizeText(
      safePlace.lat !== undefined && safePlace.lat !== null
        ? String(safePlace.lat)
        : ""
    );
    state.pickupLng = normalizeText(
      safePlace.lng !== undefined && safePlace.lng !== null
        ? String(safePlace.lng)
        : ""
    );
  }

  function syncDerivedState() {
    if (state.mode === MODES.FULL_DAY) {
      state.durationHours = 12;
      state.longTermOption = "";
    }

    if (state.mode === MODES.LONG_TERM) {
      state.price = "";
      state.currency = "";
      return;
    }

    const nextPrice = getComputedPriceNumber();
    state.price =
      typeof nextPrice === "number" && Number.isFinite(nextPrice)
        ? String(nextPrice)
        : "";
    state.currency = state.price ? DEFAULT_CURRENCY : "";
  }

  function syncModePicker(nodes) {
    const currentMode = normalizeText(state.mode);
    const triggerText = getModeLabel(currentMode);

    nodes.modeInput.value = currentMode;
    nodes.modeValue.textContent = triggerText;
    nodes.modeValue.setAttribute("data-select-empty", triggerText ? "false" : "true");

    nodes.modeOptions.forEach(function (option) {
      const optionValue = normalizeText(
        option.getAttribute("data-contact-hourly-daily-mode-option")
      );
      const isSelected = optionValue === currentMode;

      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.setAttribute("data-select-selected", isSelected ? "true" : "false");
    });
  }

  function closeModePicker(nodes) {
    if (!nodes || !nodes.modeTrigger || !nodes.modePanel) {
      return false;
    }

    nodes.modePanel.hidden = true;
    nodes.modeTrigger.setAttribute("aria-expanded", "false");
    nodes.modePickerRoot.setAttribute("data-select-open", "false");
    return true;
  }

  function openModePicker(nodes) {
    if (!nodes || !nodes.modeTrigger || !nodes.modePanel) {
      return false;
    }

    nodes.modePanel.hidden = false;
    nodes.modeTrigger.setAttribute("aria-expanded", "true");
    nodes.modePickerRoot.setAttribute("data-select-open", "true");
    return true;
  }

  function syncModeSpecificVisibility(nodes) {
    const isHourly = state.mode === MODES.HOURLY;
    const isLongTerm = state.mode === MODES.LONG_TERM;
    const notesLabels = getLabels();

    nodes.durationField.hidden = !isHourly;
    nodes.durationField.setAttribute("aria-hidden", isHourly ? "false" : "true");

    nodes.longTermField.hidden = !isLongTerm;
    nodes.longTermField.setAttribute("aria-hidden", isLongTerm ? "false" : "true");

    if (nodes.notesInput) {
      nodes.notesInput.setAttribute(
        "placeholder",
        isLongTerm
          ? notesLabels.longTermNotesPlaceholder
          : notesLabels.notesPlaceholder
      );
    }
  }

  function syncDurationButtons(nodes) {
    nodes.durationButtons.forEach(function (button) {
      const nextValue = Number(
        button.getAttribute("data-contact-hourly-daily-duration-option")
      );
      const isActive =
        state.mode === MODES.HOURLY &&
        Number(state.durationHours) === nextValue;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("data-service-active", isActive ? "true" : "false");
    });
  }

  function syncLongTermButtons(nodes) {
    nodes.longTermButtons.forEach(function (button) {
      const nextValue = normalizeText(
        button.getAttribute("data-contact-hourly-daily-long-term-option")
      );
      const isActive =
        state.mode === MODES.LONG_TERM &&
        normalizeText(state.longTermOption) === nextValue;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("data-service-active", isActive ? "true" : "false");
    });
  }

  function syncInputs(nodes) {
    if (nodes.pickupInput.value !== state.pickup) {
      nodes.pickupInput.value = state.pickup;
    }

    if (nodes.dateInput.value !== state.tripDate) {
      nodes.dateInput.value = state.tripDate;
    }

    if (nodes.timeInput.value !== state.startTime) {
      nodes.timeInput.value = state.startTime;
    }

    if (nodes.notesInput.value !== state.notes) {
      nodes.notesInput.value = state.notes;
    }
  }

  function syncDateMinimum(nodes) {
    const minimumDate = getHourlyDailyMinimumDate();
    const currentDateValue = normalizeText(nodes.dateInput.value);

    if (minimumDate) {
      nodes.dateInput.setAttribute("min", minimumDate);
    } else {
      nodes.dateInput.removeAttribute("min");
    }

    nodes.dateInput.disabled = false;

    if (minimumDate && currentDateValue && currentDateValue < minimumDate) {
      nodes.dateInput.value = "";
      state.tripDate = "";
    }

    return true;
  }

  function syncPrice(nodes) {
    const priceLabel = getPriceLabelByMode();
    const priceValue = getPriceLabelValue();

    nodes.priceLabel.textContent = priceLabel;
    nodes.priceValue.textContent = priceValue;
    nodes.priceBlock.hidden = !priceValue;
  }
  
    function buildDisclaimersMarkup() {
    const labels = getLabels();

    if (state.mode === MODES.LONG_TERM) {
      return `
        <div class="services-hourly-panel__disclaimers-groups">
          <section class="services-hourly-panel__disclaimer-group services-hourly-panel__disclaimer-group--includes-wide">
            <h4 class="services-hourly-panel__disclaimer-title">${labels.disclaimers.longTermApproachTitle}</h4>
            <ul class="services-hourly-panel__disclaimers">
              <li>${labels.disclaimers.longTermApproach1}</li>
              <li>${labels.disclaimers.longTermApproach2}</li>
              <li>${labels.disclaimers.longTermApproach3}</li>
            </ul>
          </section>

          <section class="services-hourly-panel__disclaimer-group">
            <h4 class="services-hourly-panel__disclaimer-title">${labels.disclaimers.longTermPricingTitle}</h4>
            <ul class="services-hourly-panel__disclaimers">
              <li>${labels.disclaimers.longTermPricing1}</li>
              <li>${labels.disclaimers.longTermPricing2}</li>
              <li>${labels.disclaimers.longTermPricing3}</li>
            </ul>
          </section>

          <section class="services-hourly-panel__disclaimer-group services-hourly-panel__disclaimer-group--supplements">
            <h4 class="services-hourly-panel__disclaimer-title">${labels.disclaimers.longTermValidationTitle}</h4>
            <ul class="services-hourly-panel__disclaimers">
              <li>${labels.disclaimers.longTermValidation1}</li>
              <li>${labels.disclaimers.longTermValidation2}</li>
              <li>${labels.disclaimers.longTermValidation3}</li>
            </ul>
          </section>
        </div>
      `;
    }

    return `
      <div class="services-hourly-panel__disclaimers-groups">
        <section class="services-hourly-panel__disclaimer-group services-hourly-panel__disclaimer-group--includes-wide">
          <h4 class="services-hourly-panel__disclaimer-title">${labels.disclaimers.includesTitle}</h4>

          <div class="services-hourly-panel__disclaimers-columns">
            <ul class="services-hourly-panel__disclaimers">
              <li>${state.mode === MODES.FULL_DAY ? labels.disclaimers.fullDayIncludesKm : labels.disclaimers.includesServiceKm}</li>
              <li>${labels.disclaimers.includesServiceWifi}</li>
              <li>${labels.disclaimers.includesServiceWater}</li>
            </ul>

            <ul class="services-hourly-panel__disclaimers">
              <li>${labels.disclaimers.includesVanPassengers}</li>
              <li>${labels.disclaimers.includesVanUsb}</li>
              <li>${labels.disclaimers.includesVanSeats}</li>
            </ul>
          </div>
        </section>

        <section class="services-hourly-panel__disclaimer-group services-hourly-panel__disclaimer-group--supplements">
          <h4 class="services-hourly-panel__disclaimer-title">${labels.disclaimers.supplementsTitle}</h4>
          <ul class="services-hourly-panel__disclaimers">
            ${state.mode === MODES.FULL_DAY ? `
              <li>${labels.disclaimers.fullDayExtraKm}</li>
              <li>${labels.disclaimers.outOfZone}</li>
              <li>${labels.disclaimers.fullDayExtensionPolicy}</li>
            ` : `
              <li>${labels.disclaimers.extraHourExtension}</li>
              <li>${labels.disclaimers.extraKm}</li>
              <li>${labels.disclaimers.outOfZone}</li>
            `}
          </ul>
        </section>
      </div>
    `;
  }
  
  function syncDisclaimers(nodes) {
    if (!nodes || !nodes.disclaimersRoot) {
      return false;
    }

    nodes.disclaimersRoot.innerHTML = buildDisclaimersMarkup();
    return true;
  }

  function getKmIncludedValue() {
    if (state.mode === MODES.LONG_TERM) {
      return "";
    }

    if (state.mode === MODES.FULL_DAY) {
      return "500";
    }

    if (HOURLY_DURATION_OPTIONS.indexOf(Number(state.durationHours)) >= 0) {
      return String(Number(state.durationHours) * 40);
    }

    return "";
  }

  function clearHiddenFields(nodes) {
    writeHiddenValue(nodes.hiddenMode, "");
    writeHiddenValue(nodes.hiddenVehicleType, "");
    writeHiddenValue(nodes.hiddenPickup, "");
    writeHiddenValue(nodes.hiddenPickupPlaceId, "");
    writeHiddenValue(nodes.hiddenPickupLat, "");
    writeHiddenValue(nodes.hiddenPickupLng, "");
    writeHiddenValue(nodes.hiddenDate, "");
    writeHiddenValue(nodes.hiddenStartTime, "");
    writeHiddenValue(nodes.hiddenDurationHours, "");
    writeHiddenValue(nodes.hiddenCustomTerm, "");
    writeHiddenValue(nodes.hiddenNotes, "");
    writeHiddenValue(nodes.hiddenPrice, "");
    writeHiddenValue(nodes.hiddenCurrency, "");
    writeHiddenValue(nodes.hiddenKmIncluded, "");
    writeHiddenValue(nodes.hiddenExtraKmPrice, "");
    writeHiddenValue(nodes.hiddenOutOfZoneSupplement, "");
    writeHiddenValue(nodes.hiddenTripSummary, "");
    writeHiddenValue(nodes.hiddenPickupLabel, "");
    writeHiddenValue(nodes.hiddenModeLabel, "");
    writeHiddenValue(nodes.hiddenDurationLabel, "");
    writeHiddenValue(nodes.hiddenPriceLabel, "");
  }

  function syncHiddenFields(nodes) {
    const form = getReservationForm();
    const isActive = isHourlyDailyServiceActive(form);
    const modeLabel = getModeLabel(state.mode);
    const durationLabel = getDurationLabelValue();
    const priceLabelValue = getPriceLabelValue();
    const tripSummary = buildTripSummary();

    if (!isActive) {
      clearHiddenFields(nodes);
      return true;
    }

    writeHiddenValue(nodes.hiddenMode, state.mode);
    writeHiddenValue(nodes.hiddenVehicleType, state.vehicleType);
    writeHiddenValue(nodes.hiddenPickup, state.pickup);
    writeHiddenValue(nodes.hiddenPickupPlaceId, state.pickupPlaceId);
    writeHiddenValue(nodes.hiddenPickupLat, state.pickupLat);
    writeHiddenValue(nodes.hiddenPickupLng, state.pickupLng);
    writeHiddenValue(nodes.hiddenDate, state.tripDate);
    writeHiddenValue(nodes.hiddenStartTime, state.startTime);
    writeHiddenValue(
      nodes.hiddenDurationHours,
      state.mode === MODES.HOURLY || state.mode === MODES.FULL_DAY
        ? String(state.durationHours)
        : ""
    );
    writeHiddenValue(
      nodes.hiddenCustomTerm,
      state.mode === MODES.LONG_TERM ? state.longTermOption : ""
    );
    writeHiddenValue(nodes.hiddenNotes, state.notes);
    writeHiddenValue(nodes.hiddenPrice, state.price);
    writeHiddenValue(nodes.hiddenCurrency, state.currency);
    writeHiddenValue(nodes.hiddenKmIncluded, getKmIncludedValue());
    writeHiddenValue(nodes.hiddenExtraKmPrice, "35");
    writeHiddenValue(nodes.hiddenOutOfZoneSupplement, "4500");

    writeHiddenValue(nodes.hiddenServiceLabel, getLabels().serviceLabel);
    writeHiddenValue(nodes.hiddenRequestSummary, tripSummary);
    writeHiddenValue(nodes.hiddenTripSummary, tripSummary);
    writeHiddenValue(nodes.hiddenPickupLabel, state.pickup);
    writeHiddenValue(nodes.hiddenModeLabel, modeLabel);
    writeHiddenValue(nodes.hiddenDurationLabel, durationLabel);
    writeHiddenValue(nodes.hiddenPriceLabel, priceLabelValue);

    return true;
  }

  function syncReservationRequestUiState(options) {
    const form = getReservationForm();
    const safeOptions = options && typeof options === "object" ? options : {};
    const skipValidation = safeOptions.skipValidation === true;

    if (!form || !NAMESPACE || typeof NAMESPACE !== "object") {
      return false;
    }

    if (
      typeof NAMESPACE.getReservationRequestFields !== "function" ||
      typeof NAMESPACE.syncReservationRequestState !== "function"
    ) {
      return false;
    }

    const fields = NAMESPACE.getReservationRequestFields(form);
    if (!fields || typeof fields !== "object") {
      return false;
    }

    NAMESPACE.syncReservationRequestState(fields);

    if (
      !skipValidation &&
      typeof NAMESPACE.refreshReservationRequestValidationUX === "function"
    ) {
      NAMESPACE.refreshReservationRequestValidationUX(fields);
    }

    return true;
  }

  function syncView(nodes, options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const shouldSyncReservationState = safeOptions.syncReservationState !== false;

    syncDerivedState();
    syncDateMinimum(nodes);
    syncModePicker(nodes);
    syncModeSpecificVisibility(nodes);
    syncDurationButtons(nodes);
    syncLongTermButtons(nodes);
    syncInputs(nodes);
    syncPrice(nodes);
    syncDisclaimers(nodes);
    syncHiddenFields(nodes);

    if (shouldSyncReservationState) {
      syncReservationRequestUiState({
        skipValidation: false
      });
    }

    return true;
  }

  function syncViewWithoutValidation(nodes) {
    const form = getReservationForm();
    const fields =
      form &&
      typeof NAMESPACE.getReservationRequestFields === "function"
        ? NAMESPACE.getReservationRequestFields(form)
        : null;

    syncView(nodes, {
      syncReservationState: false
    });

    if (
      fields &&
      typeof NAMESPACE.syncReservationRequestState === "function"
    ) {
      NAMESPACE.syncReservationRequestState(fields);
    }

    return true;
  }

  function resetState() {
    state.mode = DEFAULT_MODE;
    state.vehicleType = DEFAULT_VEHICLE_TYPE;
    state.pickup = "";
    state.pickupPlaceId = "";
    state.pickupLat = "";
    state.pickupLng = "";
    state.tripDate = "";
    state.startTime = "";
    state.durationHours = DEFAULT_DURATION_HOURS;
    state.longTermOption = "";
    state.notes = "";
    state.price = "";
    state.currency = DEFAULT_CURRENCY;
  }

  function hasSpecificDraftData() {
    return Boolean(
      state.pickup ||
      state.pickupPlaceId ||
      state.tripDate ||
      state.startTime ||
      state.notes ||
      state.mode !== DEFAULT_MODE ||
      Number(state.durationHours) !== DEFAULT_DURATION_HOURS ||
      state.longTermOption
    );
  }

  function getTripSnapshot() {
    return {
      serviceType: "hourly_daily",
      mode: state.mode,
      vehicleType: state.vehicleType,
      pickup: state.pickup,
      pickupPlaceId: state.pickupPlaceId,
      pickupLat: state.pickupLat,
      pickupLng: state.pickupLng,
      tripDate: state.tripDate,
      startTime: state.startTime,
      durationHours:
        state.mode === MODES.HOURLY || state.mode === MODES.FULL_DAY
          ? String(state.durationHours)
          : "",
      customTerm:
        state.mode === MODES.LONG_TERM
          ? state.longTermOption
          : "",
      notes: state.notes,
      price: state.price,
      currency: state.currency
    };
  }

  function applyHandoff(payload) {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const nextMode = normalizeText(safePayload.hourly_daily_mode);
    const nextDuration = Number(safePayload.hourly_daily_duration_hours);
    const nextCustomTerm = normalizeText(safePayload.hourly_daily_custom_term);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    state.mode =
      nextMode === MODES.HOURLY ||
      nextMode === MODES.FULL_DAY ||
      nextMode === MODES.LONG_TERM
        ? nextMode
        : DEFAULT_MODE;

    state.vehicleType = normalizeText(safePayload.hourly_daily_vehicle_type) || DEFAULT_VEHICLE_TYPE;
    state.pickup = normalizeText(safePayload.hourly_daily_pickup);
    state.pickupPlaceId = normalizeText(safePayload.hourly_daily_pickup_place_id);
    state.pickupLat = normalizeText(safePayload.hourly_daily_pickup_lat);
    state.pickupLng = normalizeText(safePayload.hourly_daily_pickup_lng);
    state.tripDate = normalizeText(safePayload.hourly_daily_date);
    state.startTime = normalizeText(safePayload.hourly_daily_start_time);
    state.durationHours =
      HOURLY_DURATION_OPTIONS.indexOf(nextDuration) >= 0
        ? nextDuration
        : (state.mode === MODES.FULL_DAY ? 12 : DEFAULT_DURATION_HOURS);
    state.longTermOption =
      LONG_TERM_OPTIONS.indexOf(nextCustomTerm) >= 0
        ? nextCustomTerm
        : "";
    state.notes = normalizeText(safePayload.hourly_daily_notes);
    state.price = normalizeText(
      typeof safePayload.hourly_daily_price === "number"
        ? String(safePayload.hourly_daily_price)
        : safePayload.hourly_daily_price
    );
    state.currency = normalizeText(safePayload.hourly_daily_currency) || DEFAULT_CURRENCY;

    syncViewWithoutValidation(nodes);
    return true;
  }

  function destroyPickupController() {
    if (pickupController && typeof pickupController.destroy === "function") {
      pickupController.destroy();
    }

    pickupController = null;
  }

  function mountPickupController(nodes) {
    const googlePlacesApi =
      NAMESPACE.googlePlaces &&
      typeof NAMESPACE.googlePlaces.createAutocompleteController === "function"
        ? NAMESPACE.googlePlaces
        : null;

    destroyPickupController();

    if (!nodes || !nodes.pickupInput || !nodes.pickupMount || !googlePlacesApi) {
      return false;
    }

    pickupController = googlePlacesApi.createAutocompleteController({
      fieldName: "hourly_daily_pickup",
      input: nodes.pickupInput,
      mountNode: nodes.pickupMount,
      hiddenFields: {
        placeId: nodes.hiddenPickupPlaceId,
        lat: nodes.hiddenPickupLat,
        lng: nodes.hiddenPickupLng
      },
      language: normalizeText(document.documentElement && document.documentElement.lang) || "es",
      region: "mx",
      includedRegionCodes: ["mx"],
      onSelection: function (selectedPlace, meta) {
        const fields =
          typeof NAMESPACE.getReservationRequestFields === "function"
            ? NAMESPACE.getReservationRequestFields(getReservationForm())
            : null;
        const safeMeta = meta && typeof meta === "object" ? meta : {};
        const shouldPreserveVisibleInput = safeMeta.preserveInputValue === true;

        if (!selectedPlace) {
          if (shouldPreserveVisibleInput) {
            return;
          }

          state.pickup = "";
          clearPickupPlaceSelection();

          syncView(nodes, {
            syncReservationState: false
          });

          if (
            fields &&
            typeof NAMESPACE.syncReservationRequestState === "function"
          ) {
            NAMESPACE.syncReservationRequestState(fields);
          }

          return;
        }

        applyPickupPlaceSelection(selectedPlace);

        syncView(nodes, {
          syncReservationState: false
        });

        if (
          fields &&
          typeof NAMESPACE.syncReservationRequestState === "function"
        ) {
          NAMESPACE.syncReservationRequestState(fields);
        }
      },
      onCoverageReject: function () {},
      onManualFallback: function () {},
      onError: function () {}
    });

    pickupController.mount();
    return true;
  }

  function bindEvents(nodes) {
    if (nodes.root.dataset.contactHourlyDailyEditorBound === "1") {
      return false;
    }

    nodes.root.dataset.contactHourlyDailyEditorBound = "1";

    nodes.modeTrigger.addEventListener("click", function () {
      const isOpen = nodes.modeTrigger.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeModePicker(nodes);
        return;
      }

      openModePicker(nodes);
    });

    nodes.modeOptions.forEach(function (option) {
      option.addEventListener("click", function () {
        const fields =
          typeof NAMESPACE.getReservationRequestFields === "function"
            ? NAMESPACE.getReservationRequestFields(getReservationForm())
            : null;

        const nextValue = normalizeText(
          option.getAttribute("data-contact-hourly-daily-mode-option")
        );

        if (
          nextValue !== MODES.HOURLY &&
          nextValue !== MODES.FULL_DAY &&
          nextValue !== MODES.LONG_TERM
        ) {
          return;
        }

        state.mode = nextValue;

        if (state.mode !== MODES.LONG_TERM) {
          state.longTermOption = "";
        }

        if (state.mode === MODES.FULL_DAY) {
          state.durationHours = 12;
        } else if (
          state.mode === MODES.HOURLY &&
          HOURLY_DURATION_OPTIONS.indexOf(Number(state.durationHours)) === -1
        ) {
          state.durationHours = DEFAULT_DURATION_HOURS;
        }

        closeModePicker(nodes);

        syncView(nodes, {
          syncReservationState: false
        });

        if (
          fields &&
          typeof NAMESPACE.syncReservationRequestState === "function"
        ) {
          NAMESPACE.syncReservationRequestState(fields);
        }
      });
    });

    nodes.durationButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextValue = Number(
          button.getAttribute("data-contact-hourly-daily-duration-option")
        );

        if (HOURLY_DURATION_OPTIONS.indexOf(nextValue) === -1) {
          return;
        }

        state.durationHours = nextValue;
        syncViewWithoutValidation(nodes);
      });
    });

    nodes.longTermButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextValue = normalizeText(
          button.getAttribute("data-contact-hourly-daily-long-term-option")
        );

        if (LONG_TERM_OPTIONS.indexOf(nextValue) === -1) {
          return;
        }

        state.longTermOption = nextValue;
        syncViewWithoutValidation(nodes);
      });
    });

        nodes.pickupInput.addEventListener("input", function () {
      const fields =
        typeof NAMESPACE.getReservationRequestFields === "function"
          ? NAMESPACE.getReservationRequestFields(getReservationForm())
          : null;

      state.pickup = typeof nodes.pickupInput.value === "string"
        ? nodes.pickupInput.value
        : "";
      clearPickupPlaceSelection();

      syncView(nodes, {
        syncReservationState: false
      });

      if (
        fields &&
        typeof NAMESPACE.syncReservationRequestState === "function"
      ) {
        NAMESPACE.syncReservationRequestState(fields);
      }
    });

    nodes.dateInput.addEventListener("input", function () {
      const fields =
        typeof NAMESPACE.getReservationRequestFields === "function"
          ? NAMESPACE.getReservationRequestFields(getReservationForm())
          : null;

      state.tripDate = normalizeText(nodes.dateInput.value);
      syncDateMinimum(nodes);
      state.tripDate = normalizeText(nodes.dateInput.value);

      syncView(nodes, {
        syncReservationState: false
      });

      if (
        fields &&
        typeof NAMESPACE.syncReservationRequestState === "function"
      ) {
        NAMESPACE.syncReservationRequestState(fields);
      }
    });

    nodes.dateInput.addEventListener("change", function () {
      const fields =
        typeof NAMESPACE.getReservationRequestFields === "function"
          ? NAMESPACE.getReservationRequestFields(getReservationForm())
          : null;

      state.tripDate = normalizeText(nodes.dateInput.value);
      syncDateMinimum(nodes);
      state.tripDate = normalizeText(nodes.dateInput.value);

      syncView(nodes, {
        syncReservationState: false
      });

      if (
        fields &&
        typeof NAMESPACE.syncReservationRequestState === "function"
      ) {
        NAMESPACE.syncReservationRequestState(fields);
      }
    });

    nodes.timeInput.addEventListener("input", function () {
      const fields =
        typeof NAMESPACE.getReservationRequestFields === "function"
          ? NAMESPACE.getReservationRequestFields(getReservationForm())
          : null;

      state.startTime = normalizeText(nodes.timeInput.value);

      syncView(nodes, {
        syncReservationState: false
      });

      if (
        fields &&
        typeof NAMESPACE.syncReservationRequestState === "function"
      ) {
        NAMESPACE.syncReservationRequestState(fields);
      }
    });

    nodes.timeInput.addEventListener("change", function () {
      const fields =
        typeof NAMESPACE.getReservationRequestFields === "function"
          ? NAMESPACE.getReservationRequestFields(getReservationForm())
          : null;

      state.startTime = normalizeText(nodes.timeInput.value);

      syncView(nodes, {
        syncReservationState: false
      });

      if (
        fields &&
        typeof NAMESPACE.syncReservationRequestState === "function"
      ) {
        NAMESPACE.syncReservationRequestState(fields);
      }
    });

    nodes.notesInput.addEventListener("input", function () {
      const fields =
        typeof NAMESPACE.getReservationRequestFields === "function"
          ? NAMESPACE.getReservationRequestFields(getReservationForm())
          : null;

      state.notes = typeof nodes.notesInput.value === "string"
        ? nodes.notesInput.value
        : "";

      syncView(nodes, {
        syncReservationState: false
      });

      if (
        fields &&
        typeof NAMESPACE.syncReservationRequestState === "function"
      ) {
        NAMESPACE.syncReservationRequestState(fields);
      }
    });

    document.addEventListener("click", function (event) {
      if (!event.target) {
        return;
      }

      if (
        nodes.modePickerRoot &&
        nodes.modePickerRoot.contains(event.target)
      ) {
        return;
      }

      closeModePicker(nodes);
    });

    const form = getReservationForm();
    if (form) {
      form.addEventListener("pixkuy:contact-service-change", function (event) {
        const detail = event && event.detail ? event.detail : {};
        const previousServiceType = normalizeText(detail.previousServiceType);
        const nextServiceType = normalizeText(detail.nextServiceType);

        if (
          previousServiceType !== "hourly_daily" &&
          nextServiceType === "hourly_daily"
        ) {
          window.setTimeout(function () {
            const fields =
              typeof NAMESPACE.getReservationRequestFields === "function"
                ? NAMESPACE.getReservationRequestFields(form)
                : null;

            syncView(nodes, {
              syncReservationState: false
            });

            if (
              fields &&
              typeof NAMESPACE.syncReservationRequestState === "function"
            ) {
              NAMESPACE.syncReservationRequestState(fields);
            }
          }, 0);
        }
      });
    }

    return true;
  }

  function bindI18nLanguageSync(nodes) {
    if (!nodes || !nodes.root || !window) {
      return false;
    }

    if (nodes.root.__hourlyDailyI18nLangSyncBound === "1") {
      return true;
    }

    nodes.root.__hourlyDailyI18nLangSyncBound = "1";

    window.addEventListener("pixkuy:i18n-applied", function () {
      if (!document.body.contains(nodes.root)) {
        return;
      }

      syncView(nodes, {
        syncReservationState: false
      });
    });

    return true;
  }

  function registerStateHooks() {
    if (!NAMESPACE.contactServiceState) {
      return false;
    }

    if (typeof NAMESPACE.contactServiceState.registerSpecificDraftProbe === "function") {
      NAMESPACE.contactServiceState.registerSpecificDraftProbe(
        "hourly_daily",
        hasSpecificDraftData
      );
    }

    return true;
  }

  function initContactHourlyDailyEditor() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    bindEvents(nodes);
    bindI18nLanguageSync(nodes);
    registerStateHooks();
    mountPickupController(nodes);
    syncView(nodes, {
      syncReservationState: false
    });

    return true;
  }

  NAMESPACE.initContactHourlyDailyEditor = initContactHourlyDailyEditor;
  NAMESPACE.getContactHourlyDailySnapshot = getTripSnapshot;
  NAMESPACE.applyContactHourlyDailyHandoff = applyHandoff;

  NAMESPACE.setContactHourlyDailyPickupPlace = function setContactHourlyDailyPickupPlace(place) {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);
    const fields =
      typeof NAMESPACE.getReservationRequestFields === "function"
        ? NAMESPACE.getReservationRequestFields(form)
        : null;

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    applyPickupPlaceSelection(place);

    syncView(nodes, {
      syncReservationState: false
    });

    if (
      fields &&
      typeof NAMESPACE.syncReservationRequestState === "function"
    ) {
      NAMESPACE.syncReservationRequestState(fields);
    }

    return true;
  };

  NAMESPACE.clearContactHourlyDailyPickupPlace = function clearContactHourlyDailyPickupPlace() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);
    const fields =
      typeof NAMESPACE.getReservationRequestFields === "function"
        ? NAMESPACE.getReservationRequestFields(form)
        : null;

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    state.pickup = "";
    clearPickupPlaceSelection();

    syncView(nodes, {
      syncReservationState: false
    });

    if (
      fields &&
      typeof NAMESPACE.syncReservationRequestState === "function"
    ) {
      NAMESPACE.syncReservationRequestState(fields);
    }

    return true;
  };
})(window, document);