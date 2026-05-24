(function initContactTourPrivateEditorModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});

  const TOUR_IDS = Object.freeze([
    "teotihuacan",
    "teotihuacan_basilica",
    "xochimilco_coyoacan",
    "cholula_puebla",
    "san_miguel_allende",
    "valquirico"
  ]);

  const DEFAULT_TOUR_ID = "teotihuacan";

  const PASSENGER_BUCKETS = Object.freeze([
    "van_1_2",
    "van_3_4",
    "van_5_6"
  ]);

  const GUIDE_LANGUAGES = Object.freeze(["es", "en", "fr"]);

  const TOUR_PRIVATE_TIME_OPTIONS = Object.freeze([
    "05:00",
    "05:30",
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30"
  ]);

  const TOURS = Object.freeze({
    teotihuacan: {
      id: "teotihuacan",
      durationHours: 6,
      includesTickets: true,
      supportsGuide: true,
      fares: {
        van_1_2: { no: 4000, yes: 5000 },
        van_3_4: { no: 4500, yes: 5500 },
        van_5_6: { no: 5200, yes: 6200 }
      }
    },
    teotihuacan_basilica: {
      id: "teotihuacan_basilica",
      durationHours: 9,
      includesTickets: true,
      supportsGuide: true,
      fares: {
        van_1_2: { no: 5000, yes: 6200 },
        van_3_4: { no: 6200, yes: 7400 },
        van_5_6: { no: 7600, yes: 8800 }
      }
    },
    xochimilco_coyoacan: {
      id: "xochimilco_coyoacan",
      durationHours: 6,
      includesTickets: false,
      supportsGuide: false,
      fares: {
        van_1_2: { no: 4500 },
        van_3_4: { no: 5000 },
        van_5_6: { no: 5800 }
      }
    },
    cholula_puebla: {
      id: "cholula_puebla",
      durationHours: 9,
      includesTickets: false,
      supportsGuide: false,
      fares: {
        van_1_2: { no: 7200 },
        van_3_4: { no: 8600 },
        van_5_6: { no: 10250 }
      }
    },
    san_miguel_allende: {
      id: "san_miguel_allende",
      durationHours: 10,
      includesTickets: false,
      supportsGuide: false,
      fares: {
        van_1_2: { no: 7800 },
        van_3_4: { no: 9300 },
        van_5_6: { no: 11200 }
      }
    },
    valquirico: {
      id: "valquirico",
      durationHours: 9,
      includesTickets: false,
      supportsGuide: false,
      fares: {
        van_1_2: { no: 5500 },
        van_3_4: { no: 6900 },
        van_5_6: { no: 8300 }
      }
    }
  });

  const state = {
    selectedTourId: "",
    passengerFareKey: "",
    pickup: "",
    pickupPlaceId: "",
    pickupLat: "",
    pickupLng: "",
    tripDate: "",
    tripTime: "",
    hasGuide: "no",
    guideLanguage: "",
    price: "",
    currency: "MXN"
  };

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      return NAMESPACE.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }
  
  function isTourPrivateServiceActive(form) {
  const reservationForm = form || getReservationForm();
  const serviceTypeField = reservationForm
    ? reservationForm.querySelector('input[name="service_type"]')
    : null;

  return normalizeText(serviceTypeField && serviceTypeField.value) === "tour_private";
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

  function getTourById(tourId) {
    return TOURS[tourId] || null;
  }

  function getTourLabel(tourId) {
    const safeTourId = normalizeText(tourId);

    if (!safeTourId) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.catalog." + safeTourId + ".title",
      safeTourId
    );
  }

  function getTourDesktopImageSrc(tourId) {
    const safeTourId = normalizeText(tourId);

    if (!safeTourId) {
      return "";
    }

    return "assets/img/tours/" + safeTourId + "_desktop.jpg";
  }

  function getTourImageAlt(tourId) {
    const safeTourId = normalizeText(tourId);

    if (!safeTourId) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.catalog." + safeTourId + ".imageAlt",
      getTourLabel(safeTourId)
    );
  }

  function getTourDescription(tourId) {
    const safeTourId = normalizeText(tourId);

    if (!safeTourId) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.catalog." + safeTourId + ".description",
      ""
    );
  }

  function getPassengerBucketLabel(fareKey) {
    const safeFareKey = normalizeText(fareKey);

    if (!safeFareKey) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.passengerBuckets." + safeFareKey,
      safeFareKey
    );
  }

  function getGuideLanguageLabel(code) {
    const safeCode = normalizeText(code);

    if (!safeCode) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.guideLanguages." + safeCode,
      safeCode
    );
  }

  function getGuideOptionLabel(value) {
    const safeValue = normalizeText(value);

    if (!safeValue) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.guideOptions." + safeValue,
      safeValue
    );
  }

  function getTicketsLabel(includesTickets) {
    return includesTickets
      ? getGuideOptionLabel("yes")
      : getGuideOptionLabel("no");
  }

  function isMobileTourPrivateSummaryContext() {
    return Boolean(
      window &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }

  function hasResolvedTourSummaryI18n(tourId) {
    const safeTourId = normalizeText(tourId);

    if (!safeTourId) {
      return false;
    }

    return Boolean(
      getI18nValue(
        "services.cards.tours.panel.catalog." + safeTourId + ".title",
        ""
      ) &&
      getI18nValue(
        "services.cards.tours.panel.catalog." + safeTourId + ".description",
        ""
      ) &&
      getI18nValue(
        "services.cards.tours.panel.guideOptions.yes",
        ""
      ) &&
      getI18nValue(
        "services.cards.tours.panel.guideOptions.no",
        ""
      )
    );
  }

  function hasResolvedTourPickerI18n() {
    return TOUR_IDS.every(function (tourId) {
      return Boolean(
        getI18nValue(
          "services.cards.tours.panel.catalog." + tourId + ".title",
          ""
        )
      );
    });
  }

  function scheduleMobileSummaryI18nResync(nodes) {
    if (
      !nodes ||
      !nodes.root ||
      !isMobileTourPrivateSummaryContext()
    ) {
      return false;
    }

    if (nodes.root.__tourPrivateMobileI18nResyncScheduled) {
      return false;
    }

    nodes.root.__tourPrivateMobileI18nResyncScheduled = true;

    let attempts = 0;
    const maxAttempts = 24;

    function retry() {
      attempts += 1;

      if (!nodes.root || !document.body.contains(nodes.root)) {
        nodes.root.__tourPrivateMobileI18nResyncScheduled = false;
        return;
      }

      if (
        hasResolvedTourSummaryI18n(state.selectedTourId) &&
        hasResolvedTourPickerI18n()
      ) {
        nodes.root.__tourPrivateMobileI18nResyncScheduled = false;
        syncTourPrivateTourpicker(nodes);
        syncSummary(nodes);
        return;
      }

      if (attempts >= maxAttempts) {
        nodes.root.__tourPrivateMobileI18nResyncScheduled = false;
        return;
      }

      window.requestAnimationFrame(retry);
    }

    window.requestAnimationFrame(retry);
    return true;
  }

  function formatCurrency(value, currency) {
  const currencyCode = normalizeText(currency) || "MXN";
  let formattedValue = "";

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  try {
    formattedValue = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0
    }).format(value);
  } catch (error) {
    formattedValue = String(value);
  }

  return formattedValue ? formattedValue + " " + currencyCode : "";
}

  function getReservationFormsApi() {
    return NAMESPACE && typeof NAMESPACE === "object"
      ? NAMESPACE
      : {};
  }

  function getTourPrivateMinimumDate() {
    const formsApi = getReservationFormsApi();
    const getMinimumDateTime =
      typeof formsApi.getReservationMinimumDateTime === "function"
        ? formsApi.getReservationMinimumDateTime
        : null;
    const formatDate =
      typeof formsApi.formatReservationDateForInput === "function"
        ? formsApi.formatReservationDateForInput
        : null;
    const minimumDateTime = getMinimumDateTime
      ? getMinimumDateTime()
      : null;

    if (!minimumDateTime || !formatDate) {
      return "";
    }

    return normalizeText(formatDate(minimumDateTime));
  }

  function syncTourPrivateDateMinimum(nodes) {
    const minimumDate = getTourPrivateMinimumDate();
    const currentDateValue = normalizeText(nodes && nodes.dateInput && nodes.dateInput.value);

    if (!nodes || !nodes.dateInput) {
      return false;
    }

    if (minimumDate) {
      nodes.dateInput.setAttribute("min", minimumDate);
    } else {
      nodes.dateInput.removeAttribute("min");
    }

    if (minimumDate && currentDateValue && currentDateValue < minimumDate) {
      nodes.dateInput.value = "";
      state.tripDate = "";
    }

    return true;
  }

  function syncTourPrivateTimeOptions(nodes) {
    const currentTimeValue = normalizeText(nodes && nodes.timeInput && nodes.timeInput.value);

    if (!nodes || !nodes.timeInput) {
      return false;
    }

    if (
      currentTimeValue &&
      TOUR_PRIVATE_TIME_OPTIONS.indexOf(currentTimeValue) === -1
    ) {
      nodes.timeInput.value = "";
      state.tripTime = "";
    }

    return true;
  }

  function getTourPrivateTimePlaceholder() {
    return getI18nValue(
      "services.cards.tours.contact.timePlaceholder",
      "Hora de salida"
    );
  }

  function closeTourPrivateTimepicker(nodes) {
    if (!nodes || !nodes.timepickerTrigger || !nodes.timepickerPanel) {
      return false;
    }

    nodes.timepickerPanel.hidden = true;
    nodes.timepickerTrigger.setAttribute("aria-expanded", "false");
    nodes.timepickerRoot.setAttribute("data-timepicker-open", "false");
    return true;
  }

  function openTourPrivateTimepicker(nodes) {
    if (!nodes || !nodes.timepickerTrigger || !nodes.timepickerPanel) {
      return false;
    }

    nodes.timepickerPanel.hidden = false;
    nodes.timepickerTrigger.setAttribute("aria-expanded", "true");
    nodes.timepickerRoot.setAttribute("data-timepicker-open", "true");
    return true;
  }

  function syncTourPrivateTimepicker(nodes) {
    const selectedTime = normalizeText(state.tripTime);
    const placeholder = getTourPrivateTimePlaceholder();

    if (
      !nodes ||
      !nodes.timeInput ||
      !nodes.timepickerValue ||
      !nodes.timepickerOptions ||
      !nodes.timepickerOptions.length
    ) {
      return false;
    }

    nodes.timeInput.value = selectedTime;
    nodes.timepickerValue.textContent = selectedTime || placeholder;
    nodes.timepickerValue.setAttribute(
      "data-timepicker-empty",
      selectedTime ? "false" : "true"
    );

    nodes.timepickerOptions.forEach(function (option) {
      const optionValue = normalizeText(
        option.getAttribute("data-contact-tour-private-time-option")
      );
      const isSelected = Boolean(selectedTime && optionValue === selectedTime);

      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.setAttribute("data-timepicker-selected", isSelected ? "true" : "false");
    });

    if (!selectedTime) {
      closeTourPrivateTimepicker(nodes);
    }

    return true;
  }

  function getTourPrivateTourPlaceholder() {
    return getI18nValue(
      "services.cards.tours.contact.tourPlaceholder",
      "Selecciona tour"
    );
  }

  function closeTourPrivateTourpicker(nodes) {
    if (!nodes || !nodes.tourpickerTrigger || !nodes.tourpickerPanel) {
      return false;
    }

    nodes.tourpickerPanel.hidden = true;
    nodes.tourpickerTrigger.setAttribute("aria-expanded", "false");
    nodes.tourpickerRoot.setAttribute("data-select-open", "false");
    return true;
  }

  function openTourPrivateTourpicker(nodes) {
    if (!nodes || !nodes.tourpickerTrigger || !nodes.tourpickerPanel) {
      return false;
    }

    nodes.tourpickerPanel.hidden = false;
    nodes.tourpickerTrigger.setAttribute("aria-expanded", "true");
    nodes.tourpickerRoot.setAttribute("data-select-open", "true");
    return true;
  }

  function syncTourPrivateTourpicker(nodes) {
    const selectedTourId = normalizeText(state.selectedTourId);
    const placeholder = getTourPrivateTourPlaceholder();

    if (
      !nodes ||
      !nodes.tourInput ||
      !nodes.tourpickerValue ||
      !nodes.tourpickerOptions ||
      !nodes.tourpickerOptions.length
    ) {
      return false;
    }

    nodes.tourInput.value = selectedTourId;
    nodes.tourpickerValue.textContent = selectedTourId
      ? getTourLabel(selectedTourId)
      : placeholder;
    nodes.tourpickerValue.setAttribute(
      "data-select-empty",
      selectedTourId ? "false" : "true"
    );

    nodes.tourpickerOptions.forEach(function (option) {
      const optionValue = normalizeText(
        option.getAttribute("data-contact-tour-private-tour-option")
      );
      const isSelected = optionValue === selectedTourId;
      const nextLabel = optionValue
        ? getTourLabel(optionValue)
        : placeholder;

      option.textContent = nextLabel;
      option.setAttribute("aria-label", nextLabel);
      option.setAttribute("title", nextLabel);
      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.setAttribute("data-select-selected", isSelected ? "true" : "false");
    });

    if (!selectedTourId) {
      closeTourPrivateTourpicker(nodes);
    }

    if (
      isMobileTourPrivateSummaryContext() &&
      !hasResolvedTourPickerI18n()
    ) {
      scheduleMobileSummaryI18nResync(nodes);
    }

    return true;
  }

  function getTourPrivateGuideLanguagePlaceholder() {
    return getI18nValue(
      "services.cards.tours.contact.guideLanguagePlaceholder",
      "Selecciona idioma"
    );
  }

  function closeTourPrivateGuideLanguagePicker(nodes) {
    if (!nodes || !nodes.guideLanguageTrigger || !nodes.guideLanguagePanel) {
      return false;
    }

    nodes.guideLanguagePanel.hidden = true;
    nodes.guideLanguageTrigger.setAttribute("aria-expanded", "false");
    nodes.guideLanguagePickerRoot.setAttribute("data-select-open", "false");
    return true;
  }

  function openTourPrivateGuideLanguagePicker(nodes) {
    if (!nodes || !nodes.guideLanguageTrigger || !nodes.guideLanguagePanel) {
      return false;
    }

    nodes.guideLanguagePanel.hidden = false;
    nodes.guideLanguageTrigger.setAttribute("aria-expanded", "true");
    nodes.guideLanguagePickerRoot.setAttribute("data-select-open", "true");
    return true;
  }

  function syncTourPrivateGuideLanguagePicker(nodes) {
    const selectedLanguage = normalizeText(state.guideLanguage);
    const placeholder = getTourPrivateGuideLanguagePlaceholder();

    if (
      !nodes ||
      !nodes.guideLanguageInput ||
      !nodes.guideLanguageValue ||
      !nodes.guideLanguageOptions ||
      !nodes.guideLanguageOptions.length
    ) {
      return false;
    }

    nodes.guideLanguageInput.value = selectedLanguage;
    nodes.guideLanguageValue.textContent = selectedLanguage
      ? getGuideLanguageLabel(selectedLanguage)
      : placeholder;
    nodes.guideLanguageValue.setAttribute(
      "data-select-empty",
      selectedLanguage ? "false" : "true"
    );

    nodes.guideLanguageOptions.forEach(function (option) {
      const optionValue = normalizeText(
        option.getAttribute("data-contact-tour-private-guide-language-option")
      );
      const isSelected = optionValue === selectedLanguage;

      option.textContent = optionValue
        ? getGuideLanguageLabel(optionValue)
        : placeholder;

      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.setAttribute("data-select-selected", isSelected ? "true" : "false");
    });

    if (!selectedLanguage) {
      closeTourPrivateGuideLanguagePicker(nodes);
    }

    return true;
  }

  function closeAllTourPrivatePickers(nodes) {
    closeTourPrivateTourpicker(nodes);
    closeTourPrivateTimepicker(nodes);
    closeTourPrivateGuideLanguagePicker(nodes);
  }

  function getEditorRoot(form) {
    if (!form) {
      return null;
    }

    return form.querySelector("[data-contact-tour-private-editor]");
  }

  function getEditorNodes(form) {
    const root = getEditorRoot(form);

    if (!root) {
      return null;
    }

    return {
      root: root,
      tourInput: root.querySelector("[data-contact-tour-private-tour]"),
      tourpickerRoot: root.querySelector("[data-contact-tour-private-tourpicker]"),
      tourpickerTrigger: root.querySelector("[data-contact-tour-private-tour-trigger]"),
      tourpickerValue: root.querySelector("[data-contact-tour-private-tour-value]"),
      tourpickerPanel: root.querySelector("[data-contact-tour-private-tour-panel]"),
      tourpickerOptions: Array.from(
        root.querySelectorAll("[data-contact-tour-private-tour-option]")
      ),
      passengersGroup: root.querySelector("[data-contact-tour-private-passengers-group]"),
      passengerButtons: Array.from(
        root.querySelectorAll("[data-contact-tour-private-passenger-option]")
      ),
      pickupInput: root.querySelector("[data-contact-tour-private-pickup]"),
      dateInput: root.querySelector("[data-contact-tour-private-date]"),
      timeInput: root.querySelector("[data-contact-tour-private-time]"),
      timepickerRoot: root.querySelector("[data-contact-tour-private-timepicker]"),
      timepickerTrigger: root.querySelector("[data-contact-tour-private-time-trigger]"),
      timepickerValue: root.querySelector("[data-contact-tour-private-time-value]"),
      timepickerPanel: root.querySelector("[data-contact-tour-private-time-panel]"),
      timepickerOptions: Array.from(
        root.querySelectorAll("[data-contact-tour-private-time-option]")
      ),
      guideSection: root.querySelector("[data-contact-tour-private-guide]"),
      guideGroup: root.querySelector("[data-contact-tour-private-guide-group]"),
      guideButtons: Array.from(
        root.querySelectorAll("[data-contact-tour-private-guide-option]")
      ),
      guideLanguageWrapper: root.querySelector("[data-contact-tour-private-guide-language-wrapper]"),
      guideLanguageInput: root.querySelector("[data-contact-tour-private-guide-language]"),
      guideLanguagePickerRoot: root.querySelector("[data-contact-tour-private-guide-language-picker]"),
      guideLanguageTrigger: root.querySelector("[data-contact-tour-private-guide-language-trigger]"),
      guideLanguageValue: root.querySelector("[data-contact-tour-private-guide-language-value]"),
      guideLanguagePanel: root.querySelector("[data-contact-tour-private-guide-language-panel]"),
      guideLanguageOptions: Array.from(
        root.querySelectorAll("[data-contact-tour-private-guide-language-option]")
      ),
      summaryMedia: root.querySelector("[data-contact-tour-private-summary-media]"),
      summaryImage: root.querySelector("[data-contact-tour-private-summary-image]"),
      summaryTour: root.querySelector("[data-contact-tour-private-summary-tour]"),
      summaryDuration: root.querySelector("[data-contact-tour-private-summary-duration]"),
      summaryTickets: root.querySelector("[data-contact-tour-private-summary-tickets]"),
      summaryDescription: root.querySelector("[data-contact-tour-private-summary-description]"),
      summaryPrice: root.querySelector("[data-contact-tour-private-summary-price]"),
      priceBlock: root.querySelector("[data-contact-tour-private-price]"),
      priceValue: root.querySelector("[data-contact-tour-private-price-value]"),
      hiddenTourId: form.querySelector('input[name="tour_private_tour_id"]'),
      hiddenTourLabel: form.querySelector('input[name="tour_private_tour_label"]'),
      hiddenDurationHours: form.querySelector('input[name="tour_private_duration_hours"]'),
      hiddenPassengerFareKey: form.querySelector('input[name="tour_private_passenger_fare_key"]'),
      hiddenPassengerBucketLabel: form.querySelector('input[name="tour_private_passenger_bucket_label"]'),
      hiddenPickup: form.querySelector('input[name="tour_private_pickup"]'),
      hiddenPickupPlaceId: form.querySelector('input[name="tour_private_pickup_place_id"]'),
      hiddenPickupLat: form.querySelector('input[name="tour_private_pickup_lat"]'),
      hiddenPickupLng: form.querySelector('input[name="tour_private_pickup_lng"]'),
      hiddenDate: form.querySelector('input[name="tour_private_date"]'),
      hiddenTime: form.querySelector('input[name="tour_private_time"]'),
      hiddenHasGuide: form.querySelector('input[name="tour_private_has_guide"]'),
      hiddenGuideLanguage: form.querySelector('input[name="tour_private_guide_language"]'),
      hiddenPrice: form.querySelector('input[name="tour_private_price"]'),
      hiddenCurrency: form.querySelector('input[name="tour_private_currency"]'),
      hiddenServiceLabel: form.querySelector('input[name="service_label"]'),
      hiddenRequestSummary: form.querySelector('input[name="request_summary"]'),
      hiddenTourPrivateTripSummary: form.querySelector('input[name="tour_private_trip_summary"]'),
      hiddenTourPrivatePickupLabel: form.querySelector('input[name="tour_private_pickup_label"]'),
      hiddenTourPrivateGuideLabel: form.querySelector('input[name="tour_private_guide_label"]'),
      hiddenTourPrivateGuideLanguageLabel: form.querySelector('input[name="tour_private_guide_language_label"]'),
      hiddenTourPrivatePriceLabel: form.querySelector('input[name="tour_private_price_label"]')
    };
  }

  function hasCriticalNodes(nodes) {
    return Boolean(
      nodes &&
      nodes.root &&
      nodes.tourInput &&
      nodes.tourpickerRoot &&
      nodes.tourpickerTrigger &&
      nodes.tourpickerValue &&
      nodes.tourpickerPanel &&
      nodes.tourpickerOptions &&
      nodes.tourpickerOptions.length &&
      nodes.passengersGroup &&
      nodes.passengerButtons.length &&
      nodes.pickupInput &&
      nodes.dateInput &&
      nodes.timeInput &&
      nodes.timepickerRoot &&
      nodes.timepickerTrigger &&
      nodes.timepickerValue &&
      nodes.timepickerPanel &&
      nodes.timepickerOptions &&
      nodes.timepickerOptions.length &&
      nodes.guideSection &&
      nodes.guideGroup &&
      nodes.guideButtons.length &&
      nodes.guideLanguageWrapper &&
      nodes.guideLanguageInput &&
      nodes.guideLanguagePickerRoot &&
      nodes.guideLanguageTrigger &&
      nodes.guideLanguageValue &&
      nodes.guideLanguagePanel &&
      nodes.guideLanguageOptions &&
      nodes.guideLanguageOptions.length &&
      nodes.summaryMedia &&
      nodes.summaryImage &&
      nodes.summaryTour &&
      nodes.summaryDuration &&
      nodes.summaryTickets &&
      nodes.summaryDescription &&
      nodes.summaryPrice &&
      nodes.priceBlock &&
      nodes.priceValue &&
      nodes.hiddenTourId &&
      nodes.hiddenTourLabel &&
      nodes.hiddenDurationHours &&
      nodes.hiddenPassengerFareKey &&
      nodes.hiddenPassengerBucketLabel &&
      nodes.hiddenPickup &&
      nodes.hiddenPickupPlaceId &&
      nodes.hiddenPickupLat &&
      nodes.hiddenPickupLng &&
      nodes.hiddenDate &&
      nodes.hiddenTime &&
      nodes.hiddenHasGuide &&
      nodes.hiddenGuideLanguage &&
      nodes.hiddenPrice &&
      nodes.hiddenCurrency &&
      nodes.hiddenServiceLabel &&
      nodes.hiddenRequestSummary &&
      nodes.hiddenTourPrivateTripSummary &&
      nodes.hiddenTourPrivatePickupLabel &&
      nodes.hiddenTourPrivateGuideLabel &&
      nodes.hiddenTourPrivateGuideLanguageLabel &&
      nodes.hiddenTourPrivatePriceLabel
    );
  }

  function getComputedPrice() {
    const tour = getTourById(state.selectedTourId);
    const temporalPricing =
      window && window.PixkuyToursTemporalPricing
        ? window.PixkuyToursTemporalPricing
        : null;

    if (!tour || !state.passengerFareKey) {
      return null;
    }

    const fareBucket = tour.fares[state.passengerFareKey];
    if (!fareBucket) {
      return null;
    }

    const guideKey = tour.supportsGuide && state.hasGuide === "yes"
      ? "yes"
      : "no";

    const basePrice =
      typeof fareBucket[guideKey] === "number"
        ? fareBucket[guideKey]
        : null;

    if (basePrice === null) {
      return null;
    }

    if (
      !temporalPricing ||
      typeof temporalPricing.applyTemporalPricing !== "function"
    ) {
      return basePrice;
    }

    return temporalPricing.applyTemporalPricing(
      basePrice,
      normalizeText(state.tripDate)
    );
  }

  function syncDerivedState() {
    const tour = getTourById(state.selectedTourId);

    if (!tour) {
      state.price = "";
      state.currency = "MXN";
      return;
    }

    if (!tour.supportsGuide) {
      state.hasGuide = "no";
      state.guideLanguage = "";
    } else if (state.hasGuide !== "yes" && state.hasGuide !== "no") {
      state.hasGuide = "no";
    }

    const nextPrice = getComputedPrice();
    state.price = typeof nextPrice === "number" ? String(nextPrice) : "";
    state.currency = "MXN";
  }

  function writeHiddenValue(field, value) {
    if (!field) {
      return;
    }

    field.value = typeof value === "string" ? value : "";
  }
  
    function getTourPrivateServiceLabel() {
    return getI18nValue(
      "contact.services.tourPrivate",
      "Tour privado"
    );
  }

  function getTourPrivateGuideSummaryLabel() {
    const tour = getTourById(state.selectedTourId);

    if (!tour || !tour.supportsGuide) {
      return "No aplica";
    }

    if (state.hasGuide !== "yes") {
      return getGuideOptionLabel("no");
    }

    return getGuideOptionLabel("yes");
  }

  function getTourPrivateGuideLanguageSummaryLabel() {
    const tour = getTourById(state.selectedTourId);

    if (!tour || !tour.supportsGuide || state.hasGuide !== "yes") {
      return "";
    }

    return getGuideLanguageLabel(state.guideLanguage);
  }

  function getTourPrivatePriceSummaryLabel() {
    const priceNumber = normalizeText(state.price);

    if (!priceNumber) {
      return "";
    }

    return formatCurrency(Number(priceNumber), state.currency);
  }

  function buildTourPrivateTripSummary() {
    const parts = [];
    const tourLabel = getTourLabel(state.selectedTourId);
    const passengerLabel = getPassengerBucketLabel(state.passengerFareKey);
    const pickupLabel = normalizeText(state.pickup);
    const dateLabel = normalizeText(state.tripDate);
    const timeLabel = normalizeText(state.tripTime);
    const guideLabel = getTourPrivateGuideSummaryLabel();
    const guideLanguageLabel = getTourPrivateGuideLanguageSummaryLabel();
    const priceLabel = getTourPrivatePriceSummaryLabel();

    if (tourLabel) {
      parts.push("Tour: " + tourLabel);
    }

    if (passengerLabel) {
      parts.push("Pasajeros: " + passengerLabel);
    }

    if (pickupLabel) {
      parts.push("Recogida: " + pickupLabel);
    }

    if (dateLabel) {
      parts.push("Fecha: " + dateLabel);
    }

    if (timeLabel) {
      parts.push("Hora: " + timeLabel);
    }

    if (guideLabel) {
      parts.push("Guía: " + guideLabel);
    }

    if (guideLanguageLabel) {
      parts.push("Idioma guía: " + guideLanguageLabel);
    }

    if (priceLabel) {
      parts.push("Precio: " + priceLabel);
    }

    return parts.join(" | ");
  }

  function clearPickupPlaceSelection() {
    state.pickupPlaceId = "";
    state.pickupLat = "";
    state.pickupLng = "";
  }

  function applyPickupPlaceSelection(place) {
    var safePlace = place && typeof place === "object" ? place : {};
    var nextLabel = normalizeText(
      safePlace.label ||
      safePlace.formattedAddress ||
      safePlace.displayName
    );

    state.pickup = nextLabel;
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

  function syncHiddenFields(nodes) {
    const form = getReservationForm();
    const tour = getTourById(state.selectedTourId);
    const durationHours = tour ? String(tour.durationHours) : "";
    const priceNumber = normalizeText(state.price);
    const tourLabel = getTourLabel(state.selectedTourId);
    const passengerBucketLabel = getPassengerBucketLabel(state.passengerFareKey);
    const isActive = isTourPrivateServiceActive(form);

    if (isActive) {
      writeHiddenValue(nodes.hiddenTourId, state.selectedTourId);
      writeHiddenValue(nodes.hiddenTourLabel, tourLabel);
      writeHiddenValue(nodes.hiddenDurationHours, durationHours);
      writeHiddenValue(nodes.hiddenPassengerFareKey, state.passengerFareKey);
      writeHiddenValue(nodes.hiddenPassengerBucketLabel, passengerBucketLabel);
      writeHiddenValue(nodes.hiddenPickup, state.pickup);
      writeHiddenValue(nodes.hiddenPickupPlaceId, normalizeText(state.pickupPlaceId));
      writeHiddenValue(nodes.hiddenPickupLat, normalizeText(state.pickupLat));
      writeHiddenValue(nodes.hiddenPickupLng, normalizeText(state.pickupLng));
      writeHiddenValue(nodes.hiddenDate, state.tripDate);
      writeHiddenValue(nodes.hiddenTime, state.tripTime);
      writeHiddenValue(nodes.hiddenHasGuide, state.hasGuide === "yes" ? "true" : "false");
      writeHiddenValue(nodes.hiddenGuideLanguage, state.guideLanguage);
      writeHiddenValue(nodes.hiddenPrice, priceNumber);
      writeHiddenValue(nodes.hiddenCurrency, priceNumber ? state.currency : "");

      writeHiddenValue(nodes.hiddenServiceLabel, getTourPrivateServiceLabel());
      writeHiddenValue(nodes.hiddenRequestSummary, buildTourPrivateTripSummary());
      writeHiddenValue(nodes.hiddenTourPrivateTripSummary, buildTourPrivateTripSummary());
      writeHiddenValue(nodes.hiddenTourPrivatePickupLabel, state.pickup);
      writeHiddenValue(nodes.hiddenTourPrivateGuideLabel, getTourPrivateGuideSummaryLabel());
      writeHiddenValue(nodes.hiddenTourPrivateGuideLanguageLabel, getTourPrivateGuideLanguageSummaryLabel());
      writeHiddenValue(nodes.hiddenTourPrivatePriceLabel, getTourPrivatePriceSummaryLabel());

      return true;
    }

    writeHiddenValue(nodes.hiddenTourId, "");
    writeHiddenValue(nodes.hiddenTourLabel, "");
    writeHiddenValue(nodes.hiddenDurationHours, "");
    writeHiddenValue(nodes.hiddenPassengerFareKey, "");
    writeHiddenValue(nodes.hiddenPassengerBucketLabel, "");
    writeHiddenValue(nodes.hiddenPickup, "");
    writeHiddenValue(nodes.hiddenPickupPlaceId, "");
    writeHiddenValue(nodes.hiddenPickupLat, "");
    writeHiddenValue(nodes.hiddenPickupLng, "");
    writeHiddenValue(nodes.hiddenDate, "");
    writeHiddenValue(nodes.hiddenTime, "");
    writeHiddenValue(nodes.hiddenHasGuide, "");
    writeHiddenValue(nodes.hiddenGuideLanguage, "");
    writeHiddenValue(nodes.hiddenPrice, "");
    writeHiddenValue(nodes.hiddenCurrency, "");

    writeHiddenValue(nodes.hiddenTourPrivateTripSummary, "");
    writeHiddenValue(nodes.hiddenTourPrivatePickupLabel, "");
    writeHiddenValue(nodes.hiddenTourPrivateGuideLabel, "");
    writeHiddenValue(nodes.hiddenTourPrivateGuideLanguageLabel, "");
    writeHiddenValue(nodes.hiddenTourPrivatePriceLabel, "");

    return true;
  }

  function syncSummary(nodes) {
    const tour = getTourById(state.selectedTourId);
    const hasTour = Boolean(tour);
    const priceNumber = normalizeText(state.price);
    const priceValue = priceNumber
      ? formatCurrency(Number(priceNumber), state.currency)
      : "";
    const imageSrc = hasTour ? getTourDesktopImageSrc(state.selectedTourId) : "";
    const imageAlt = hasTour ? getTourImageAlt(state.selectedTourId) : "";
    const description = hasTour ? getTourDescription(state.selectedTourId) : "";
    const title = hasTour ? getTourLabel(state.selectedTourId) : "";
    const ticketsLabel = hasTour
      ? getTicketsLabel(Boolean(tour.includesTickets))
      : "";

    nodes.summaryTour.textContent = title;
    nodes.summaryDuration.textContent = hasTour ? String(tour.durationHours) + " h" : "";
    nodes.summaryTickets.textContent = ticketsLabel;
    nodes.summaryDescription.textContent = description;
    nodes.summaryPrice.textContent = priceValue;
    nodes.priceValue.textContent = priceValue;

    if (hasTour && imageSrc) {
      nodes.summaryImage.setAttribute("src", imageSrc);
      nodes.summaryImage.setAttribute("alt", imageAlt);
      nodes.summaryMedia.hidden = false;
    } else {
      nodes.summaryImage.setAttribute("src", "");
      nodes.summaryImage.setAttribute("alt", "");
      nodes.summaryMedia.hidden = true;
    }

    nodes.priceBlock.hidden = !priceValue;

    if (
      hasTour &&
      isMobileTourPrivateSummaryContext() &&
      (!description || title === state.selectedTourId || ticketsLabel === "yes" || ticketsLabel === "no")
    ) {
      scheduleMobileSummaryI18nResync(nodes);
    }
  }

  function syncTourSelectOptions() {
    return true;
  }

  function syncTourSelectValue(nodes) {
    return syncTourPrivateTourpicker(nodes);
  }

  function syncPassengerButtons(nodes) {
    nodes.passengerButtons.forEach(function (button) {
      const fareKey = normalizeText(
        button.getAttribute("data-contact-tour-private-fare-key")
      );
      const isActive = fareKey === state.passengerFareKey;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("data-service-active", isActive ? "true" : "false");
    });
  }

  function syncGuideButtons(nodes) {
    const tour = getTourById(state.selectedTourId);
    const showGuide = Boolean(tour && tour.supportsGuide);

    if (!showGuide) {
      state.hasGuide = "no";
      state.guideLanguage = "";
    }

    if (nodes.guideSection) {
      nodes.guideSection.hidden = !showGuide;
      nodes.guideSection.setAttribute("aria-hidden", showGuide ? "false" : "true");
      nodes.guideSection.style.display = showGuide ? "" : "none";
    }

    nodes.guideGroup.hidden = !showGuide;
    nodes.guideGroup.setAttribute("aria-hidden", showGuide ? "false" : "true");

    nodes.guideButtons.forEach(function (button) {
      const optionValue = normalizeText(
        button.getAttribute("data-contact-tour-private-guide-option")
      );
      const isActive = showGuide && optionValue === state.hasGuide;

      button.hidden = !showGuide;
      button.setAttribute("aria-hidden", showGuide ? "false" : "true");
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("data-service-active", isActive ? "true" : "false");

      const labelNode = button.querySelector(".services-expand__passenger-chip-text");
      if (labelNode) {
        labelNode.textContent = getGuideOptionLabel(optionValue);
      }
    });
  
  }

  function syncGuideLanguageVisibility(nodes) {
    const tour = getTourById(state.selectedTourId);
    const showGuide = Boolean(tour && tour.supportsGuide);
    const showGuideLanguage = Boolean(
      showGuide &&
      state.hasGuide === "yes"
    );

    if (!showGuideLanguage) {
      state.guideLanguage = "";
    }

    nodes.guideLanguageWrapper.hidden = !showGuideLanguage;
    nodes.guideLanguageWrapper.setAttribute(
      "aria-hidden",
      showGuideLanguage ? "false" : "true"
    );

    if (nodes.guideLanguagePickerRoot) {
      nodes.guideLanguagePickerRoot.hidden = !showGuideLanguage;
      nodes.guideLanguagePickerRoot.setAttribute(
        "aria-hidden",
        showGuideLanguage ? "false" : "true"
      );
    }

    syncTourPrivateGuideLanguagePicker(nodes);

    if (!showGuideLanguage) {
      closeTourPrivateGuideLanguagePicker(nodes);
    }
  }

  function syncInputs(nodes) {
    if (nodes.pickupInput.value !== state.pickup) {
      nodes.pickupInput.value = state.pickup;
    }

    if (nodes.dateInput.value !== state.tripDate) {
      nodes.dateInput.value = state.tripDate;
    }

    syncTourPrivateTourpicker(nodes);
    syncTourPrivateTimepicker(nodes);
    syncTourPrivateGuideLanguagePicker(nodes);
  }

  function syncView(nodes, options) {
    const safeOptions =
      options && typeof options === "object" ? options : {};
    const shouldSyncReservationState =
      safeOptions.syncReservationState !== false;

    syncDerivedState();
    syncTourSelectOptions(nodes);
    syncTourSelectValue(nodes);
    syncPassengerButtons(nodes);
    syncGuideButtons(nodes);
    syncGuideLanguageVisibility(nodes);
    syncTourPrivateDateMinimum(nodes);
    syncTourPrivateTimeOptions(nodes);
    syncInputs(nodes);
    syncHiddenFields(nodes);
    syncSummary(nodes);

    if (
      shouldSyncReservationState &&
      typeof NAMESPACE.syncReservationRequestState === "function"
    ) {
      NAMESPACE.syncReservationRequestState(
        NAMESPACE.getReservationRequestFields(getReservationForm())
      );
    }
  }
 
    function shouldApplyDefaultTourOnColdStart() {
    return Boolean(
      !state.selectedTourId &&
      !state.passengerFareKey &&
      !state.pickup &&
      !state.pickupPlaceId &&
      !state.pickupLat &&
      !state.pickupLng &&
      !state.tripDate &&
      !state.tripTime &&
      state.hasGuide === "no" &&
      !state.guideLanguage &&
      !state.price
    );
  }

  function applyDefaultTourOnColdStart() {
    if (!shouldApplyDefaultTourOnColdStart()) {
      return false;
    }

    if (!getTourById(DEFAULT_TOUR_ID)) {
      return false;
    }

    state.selectedTourId = DEFAULT_TOUR_ID;
    return true;
  }

  function hasSpecificDraftData() {
    return Boolean(
      state.selectedTourId ||
      state.passengerFareKey ||
      state.pickup ||
      state.tripDate ||
      state.tripTime ||
      state.hasGuide === "yes" ||
      state.guideLanguage ||
      state.price
    );
  }

  function getTripSnapshot() {
    return {
      serviceType: "tour_private",
      tourId: state.selectedTourId,
      tourLabel: getTourLabel(state.selectedTourId),
      passengerFareKey: state.passengerFareKey,
      passengerBucketLabel: getPassengerBucketLabel(state.passengerFareKey),
      pickup: state.pickup,
      tripDate: state.tripDate,
      tripTime: state.tripTime,
      hasGuide: state.hasGuide === "yes",
      guideLanguage: state.guideLanguage,
      price: state.price,
      currency: state.currency
    };
  }

  function applyHandoff(payload) {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const nextTourId = normalizeText(safePayload.tour_private_tour_id);
    const nextFareKey = normalizeText(safePayload.tour_private_passenger_fare_key);
    const nextGuideLanguage = normalizeText(safePayload.tour_private_guide_language);
    const nextHasGuide = safePayload.tour_private_has_guide === true ? "yes" : "no";

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    state.selectedTourId = getTourById(nextTourId) ? nextTourId : "";
    state.passengerFareKey = PASSENGER_BUCKETS.indexOf(nextFareKey) >= 0 ? nextFareKey : "";
    state.pickup = normalizeText(safePayload.tour_private_pickup);
    state.pickupPlaceId = normalizeText(safePayload.tour_private_pickup_place_id);
    state.pickupLat = normalizeText(safePayload.tour_private_pickup_lat);
    state.pickupLng = normalizeText(safePayload.tour_private_pickup_lng);
    state.tripDate = normalizeText(safePayload.tour_private_date);
    state.tripTime = normalizeText(safePayload.tour_private_time);
    state.hasGuide = nextHasGuide;
    state.guideLanguage = GUIDE_LANGUAGES.indexOf(nextGuideLanguage) >= 0
      ? nextGuideLanguage
      : "";
    state.price = normalizeText(
      typeof safePayload.tour_private_price === "number"
        ? String(safePayload.tour_private_price)
        : safePayload.tour_private_price
    );
    state.currency = normalizeText(safePayload.tour_private_currency) || "MXN";

    syncView(nodes);
    return true;
  }

  function bindEvents(nodes) {
    if (nodes.root.dataset.contactTourPrivateEditorBound === "1") {
      return false;
    }

    nodes.root.dataset.contactTourPrivateEditorBound = "1";

    nodes.tourpickerTrigger.addEventListener("click", function () {
      const isOpen =
        nodes.tourpickerTrigger.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeTourPrivateTourpicker(nodes);
        return;
      }

      closeTourPrivateGuideLanguagePicker(nodes);
      closeTourPrivateTimepicker(nodes);
      openTourPrivateTourpicker(nodes);
    });

    nodes.tourpickerOptions.forEach(function (option) {
      option.addEventListener("click", function () {
        const nextTourId = normalizeText(
          option.getAttribute("data-contact-tour-private-tour-option")
        );
        const tour = getTourById(nextTourId);

        state.selectedTourId = tour ? nextTourId : "";

        if (!tour) {
          state.passengerFareKey = "";
          state.hasGuide = "no";
          state.guideLanguage = "";
        } else if (!tour.supportsGuide) {
          state.hasGuide = "no";
          state.guideLanguage = "";
        }

        syncView(nodes);
        closeTourPrivateTourpicker(nodes);
      });
    });

    nodes.passengerButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextFareKey = normalizeText(
          button.getAttribute("data-contact-tour-private-fare-key")
        );

        if (PASSENGER_BUCKETS.indexOf(nextFareKey) === -1) {
          return;
        }

        state.passengerFareKey = nextFareKey;
        syncView(nodes);
      });
    });

    nodes.pickupInput.addEventListener("input", function () {
      state.pickup = typeof nodes.pickupInput.value === "string"
        ? nodes.pickupInput.value
        : "";
      clearPickupPlaceSelection();
      syncView(nodes);
    });

    nodes.dateInput.addEventListener("input", function () {
      state.tripDate = normalizeText(nodes.dateInput.value);
      syncTourPrivateDateMinimum(nodes);
      state.tripDate = normalizeText(nodes.dateInput.value);
      syncView(nodes);
    });

    nodes.dateInput.addEventListener("change", function () {
      state.tripDate = normalizeText(nodes.dateInput.value);
      syncTourPrivateDateMinimum(nodes);
      state.tripDate = normalizeText(nodes.dateInput.value);
      syncView(nodes);
    });

    nodes.timepickerTrigger.addEventListener("click", function () {
      const isOpen =
        nodes.timepickerTrigger.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeTourPrivateTimepicker(nodes);
        return;
      }

      closeTourPrivateTourpicker(nodes);
      closeTourPrivateGuideLanguagePicker(nodes);
      openTourPrivateTimepicker(nodes);
    });

    nodes.timepickerOptions.forEach(function (option) {
      option.addEventListener("click", function () {
        const nextTime = normalizeText(
          option.getAttribute("data-contact-tour-private-time-option")
        );

        if (TOUR_PRIVATE_TIME_OPTIONS.indexOf(nextTime) === -1) {
          return;
        }

        state.tripTime = nextTime;
        syncView(nodes);
        closeTourPrivateTimepicker(nodes);
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target) {
        return;
      }

      if (
        nodes.tourpickerRoot &&
        nodes.tourpickerRoot.contains(event.target)
      ) {
        return;
      }

      if (
        nodes.timepickerRoot &&
        nodes.timepickerRoot.contains(event.target)
      ) {
        return;
      }

      if (
        nodes.guideLanguagePickerRoot &&
        nodes.guideLanguagePickerRoot.contains(event.target)
      ) {
        return;
      }

      closeAllTourPrivatePickers(nodes);
    });

    nodes.guideButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextValue = normalizeText(
          button.getAttribute("data-contact-tour-private-guide-option")
        );

        if (nextValue !== "yes" && nextValue !== "no") {
          return;
        }

        state.hasGuide = nextValue;

        if (nextValue !== "yes") {
          state.guideLanguage = "";
        }

        syncView(nodes);
      });
    });

    nodes.guideLanguageTrigger.addEventListener("click", function () {
      const isOpen =
        nodes.guideLanguageTrigger.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeTourPrivateGuideLanguagePicker(nodes);
        return;
      }

      closeTourPrivateTourpicker(nodes);
      closeTourPrivateTimepicker(nodes);
      openTourPrivateGuideLanguagePicker(nodes);
    });

    nodes.guideLanguageOptions.forEach(function (option) {
      option.addEventListener("click", function () {
        const nextValue = normalizeText(
          option.getAttribute("data-contact-tour-private-guide-language-option")
        );

        state.guideLanguage = GUIDE_LANGUAGES.indexOf(nextValue) >= 0
          ? nextValue
          : "";
        state.hasGuide = state.guideLanguage ? "yes" : state.hasGuide;

        syncView(nodes);
        closeTourPrivateGuideLanguagePicker(nodes);
      });
    });

    return true;
  }
  
    function bindI18nLanguageSync(nodes) {
    if (!nodes || !nodes.root || !window) {
      return false;
    }

    if (nodes.root.__tourPrivateI18nLangSyncBound === "1") {
      return true;
    }

    nodes.root.__tourPrivateI18nLangSyncBound = "1";

    window.addEventListener("pixkuy:i18n-applied", function () {
      if (!document.body.contains(nodes.root)) {
        return;
      }

      syncView(nodes, {
        syncReservationState: false
      });

      scheduleMobileSummaryI18nResync(nodes);
    });

    return true;
  }

  function registerStateHooks() {
    if (!NAMESPACE.contactServiceState) {
      return false;
    }

    if (typeof NAMESPACE.contactServiceState.registerSpecificDraftProbe === "function") {
      NAMESPACE.contactServiceState.registerSpecificDraftProbe(
        "tour_private",
        hasSpecificDraftData
      );
    }

    /* tour_private preserva su draft al cambiar de servicio:
       no registrar reset destructivo */

    return true;
  }

  function initContactTourPrivateEditor() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    bindEvents(nodes);
    bindI18nLanguageSync(nodes);
    registerStateHooks();
    applyDefaultTourOnColdStart();
    syncView(nodes);

    return true;
  }

  NAMESPACE.initContactTourPrivateEditor = initContactTourPrivateEditor;
  NAMESPACE.getContactTourPrivateSnapshot = getTripSnapshot;
  NAMESPACE.applyContactTourPrivateHandoff = applyHandoff;
  NAMESPACE.setContactTourPrivatePickupPlace = function setContactTourPrivatePickupPlace(place) {
    var form = getReservationForm();
    var nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    applyPickupPlaceSelection(place);
    syncView(nodes);
    return true;
  };

  NAMESPACE.clearContactTourPrivatePickupPlace = function clearContactTourPrivatePickupPlace() {
    var form = getReservationForm();
    var nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    state.pickup = "";
    clearPickupPlaceSelection();
    syncView(nodes);
    return true;
  };
})(window, document);