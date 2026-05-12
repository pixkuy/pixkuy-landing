/* assets/js/services/tours-mobile-config-step.js
   Tours mobile config step.
   Responsabilidad:
   - mostrar la segunda pantalla móvil de configuración de tour_private
   - calcular tarifa del tour seleccionado
   - validar campos operativos antes de continuar
   - no tocar tours-panel.js
   - no tocar #contact todavía
   - no enviar Netlify todavía
*/

(function initToursMobileConfigStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const ROUTE_SELECTOR = "[data-tours-mobile-route]";
  const CONFIG_STEP_SELECTOR = "[data-tours-mobile-config-step]";
  const CONFIG_BACK_SELECTOR = "[data-tours-mobile-config-back]";
  const CONFIG_FIELD_SELECTOR = "[data-tours-mobile-config-field]";
  const CONFIG_PASSENGERS_SELECTOR = "[data-tours-mobile-config-passengers]";
  const CONFIG_GUIDE_SELECTOR = "[data-tours-mobile-config-guide]";
  const CONFIG_LANGUAGE_SELECTOR = "[data-tours-mobile-config-language]";
  const CONFIG_PRICE_SELECTOR = "[data-tours-mobile-config-price]";
  const CONFIG_CTA_SELECTOR = "[data-tours-mobile-config-cta]";
  const CONFIG_PICKUP_CLEAR_SELECTOR = "[data-tours-mobile-pickup-clear]";

  const BODY_CONFIG_ATTR = "data-tours-mobile-config-screen";

  const TOUR_IDS = [
    "teotihuacan",
    "teotihuacan_basilica",
    "xochimilco_coyoacan",
    "cholula_puebla",
    "san_miguel_allende"
  ];

  const PASSENGER_BUCKETS = ["van_1_2", "van_3_4", "van_5_6"];
  const GUIDE_LANGUAGES = ["es", "en", "fr"];
  const OPERATION_TIME_OPTIONS = [
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
  ];

  const TOURS = {
    teotihuacan: {
      durationHours: 6,
      includesTickets: true,
      supportsGuide: true,
      image: "assets/img/tours/teotihuacan_mobile.jpg",
      fares: {
        van_1_2: { no: 4000, yes: 5000 },
        van_3_4: { no: 4500, yes: 5500 },
        van_5_6: { no: 5200, yes: 6200 }
      }
    },
    teotihuacan_basilica: {
      durationHours: 9,
      includesTickets: true,
      supportsGuide: true,
      image: "assets/img/tours/teotihuacan_basilica_mobile.jpg",
      fares: {
        van_1_2: { no: 5000, yes: 6200 },
        van_3_4: { no: 6200, yes: 7400 },
        van_5_6: { no: 7600, yes: 8800 }
      }
    },
    xochimilco_coyoacan: {
      durationHours: 6,
      includesTickets: false,
      supportsGuide: false,
      image: "assets/img/tours/xochimilco_coyoacan_mobile.jpg",
      fares: {
        van_1_2: { no: 4500 },
        van_3_4: { no: 5000 },
        van_5_6: { no: 5800 }
      }
    },
    cholula_puebla: {
      durationHours: 9,
      includesTickets: false,
      supportsGuide: false,
      image: "assets/img/tours/cholula_puebla_mobile.jpg",
      fares: {
        van_1_2: { no: 7200 },
        van_3_4: { no: 8600 },
        van_5_6: { no: 10250 }
      }
    },
    san_miguel_allende: {
      durationHours: 10,
      includesTickets: false,
      supportsGuide: false,
      image: "assets/img/tours/san_miguel_allende_mobile.jpg",
      fares: {
        van_1_2: { no: 7800 },
        van_3_4: { no: 9300 },
        van_5_6: { no: 11200 }
      }
    }
  };

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let stepNode = null;
  let activeTourId = "";
  let state = {
    passengerFareKey: "van_1_2",
    pickup: "",
    date: "",
    time: "",
    hasGuide: "no",
    guideLanguage: ""
  };

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getI18nValue(path, fallback) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = String(path || "").split(".");
    let cursor = dict;
    let index;

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      const value = getValue(dict, path);

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

  function getTour(tourId) {
    return TOURS[tourId] || null;
  }

  function getTourText(tourId, field) {
    return getI18nValue(
      "services.cards.tours.panel.catalog." + tourId + "." + field,
      ""
    );
  }

  function formatMoneyAmount(value) {
    const number = Number(value || 0);

    if (!number) {
      return "";
    }

    return new Intl.NumberFormat("es-MX", {
      maximumFractionDigits: 0
    }).format(number);
  }

  function buildMoneyMarkup(value) {
    const amount = formatMoneyAmount(value);

    if (!amount) {
      return escapeHtml(getI18nValue("services.cards.tours.panel.priceValuePending", "—"));
    }

    return [
      '<span class="tours-mobile-config-step__fare-amount">',
      escapeHtml(amount),
      '</span>',
      '<span class="tours-mobile-config-step__fare-currency">MXN</span>'
    ].join("");
  }
  
    function buildPendingPriceMarkup() {
    return escapeHtml(
      getI18nValue(
        "services.cards.tours.panel.priceValuePending",
        "—"
      )
    );
  }

  function buildVisiblePriceMarkup() {
    return canContinue()
      ? buildMoneyMarkup(getPrice())
      : buildPendingPriceMarkup();
  }

  function getGuideKey() {
    const tour = getTour(activeTourId);

    if (!tour || !tour.supportsGuide) {
      return "no";
    }

    return state.hasGuide === "yes" ? "yes" : "no";
  }

  function getPrice() {
    const tour = getTour(activeTourId);
    const passengerFareKey = state.passengerFareKey || "van_1_2";
    const guideKey = getGuideKey();
    const bucket = tour && tour.fares ? tour.fares[passengerFareKey] : null;

    if (!bucket) {
      return 0;
    }

    return Number(bucket[guideKey] || bucket.no || 0);
  }

  function canContinue() {
    const tour = getTour(activeTourId);

    if (!tour) {
      return false;
    }

    if (!state.passengerFareKey || !state.pickup || !state.date || !state.time) {
      return false;
    }

    if (tour.supportsGuide && state.hasGuide === "yes" && !state.guideLanguage) {
      return false;
    }

    return true;
  }
  
    function trackTourMobileQuoteReady() {
    const analytics = window.PixkuyAnalytics;
    const price = getPrice();
    const dedupeKey = [
      "tour_private",
      activeTourId,
      state.passengerFareKey,
      state.hasGuide,
      state.guideLanguage,
      price,
      "MXN"
    ].join("|");

    if (
      !analytics ||
      typeof analytics.trackOnce !== "function" ||
      !isMobileViewport() ||
      !canContinue() ||
      !price
    ) {
      return false;
    }

    return analytics.trackOnce("pixkuy_mobile_quote_ready", {
      service_type: "tour_private",
      flow_surface: "mobile_route",
      tour_id: activeTourId,
      passenger_fare_key: state.passengerFareKey,
      has_guide: state.hasGuide === "yes",
      guide_language: state.guideLanguage,
      price: price,
      currency: "MXN"
    }, dedupeKey);
  }

  function getPassengerBucketLabel(fareKey) {
    const safeFareKey = normalizeText(fareKey);

    if (!safeFareKey) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.passengerBuckets." + safeFareKey,
      getAirportStylePassengerLabel(safeFareKey)
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

  function getGuideLanguageLabel(language) {
    const safeLanguage = normalizeText(language);

    if (!safeLanguage) {
      return "";
    }

    return getI18nValue(
      "services.cards.tours.panel.guideLanguages." + safeLanguage,
      safeLanguage
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

  function getSnapshot() {
    const tour = getTour(activeTourId);
    const price = getPrice();
    const hasGuide = Boolean(
      tour &&
        tour.supportsGuide &&
        state.hasGuide === "yes"
    );
    const guideLanguage = hasGuide ? normalizeText(state.guideLanguage) : "";

    return {
      serviceType: "tour_private",
      tour_private_tour_id: activeTourId,
      tour_private_tour_label: getTourText(activeTourId, "title"),
      tour_private_duration_hours: tour ? String(tour.durationHours) : "",
      tour_private_passenger_fare_key: normalizeText(state.passengerFareKey),
      tour_private_passenger_bucket_label: getPassengerBucketLabel(state.passengerFareKey),
      tour_private_pickup: normalizeText(state.pickup),
      tour_private_pickup_place_id: "",
      tour_private_pickup_lat: "",
      tour_private_pickup_lng: "",
      tour_private_date: normalizeText(state.date),
      tour_private_time: normalizeText(state.time),
      tour_private_has_guide: hasGuide,
      tour_private_guide_language: guideLanguage,
      tour_private_price: price ? String(price) : "",
      tour_private_currency: price ? "MXN" : "",
      tour_private_guide_label: tour && tour.supportsGuide
        ? getGuideOptionLabel(hasGuide ? "yes" : "no")
        : "",
      tour_private_guide_language_label: guideLanguage
        ? getGuideLanguageLabel(guideLanguage)
        : "",
      tour_private_price_label: formatCurrencyValue(price, "MXN")
    };
  }

  function canOpenContactStep() {
    const snapshot = getSnapshot();

    return Boolean(
      canContinue() &&
        snapshot.tour_private_tour_id &&
        snapshot.tour_private_passenger_fare_key &&
        snapshot.tour_private_pickup &&
        snapshot.tour_private_date &&
        snapshot.tour_private_time &&
        snapshot.tour_private_price &&
        snapshot.tour_private_currency &&
        (
          snapshot.tour_private_has_guide !== true ||
          snapshot.tour_private_guide_language
        )
    );
  }
  
    function trackTourMobileContinueClick() {
    const analytics = window.PixkuyAnalytics;
    const price = getPrice();

    if (
      !analytics ||
      typeof analytics.track !== "function" ||
      !isMobileViewport() ||
      !canContinue() ||
      !price
    ) {
      return false;
    }

    return analytics.track("pixkuy_continue_click", {
      service_type: "tour_private",
      flow_surface: "mobile_route",
      tour_id: activeTourId,
      passenger_fare_key: state.passengerFareKey,
      has_guide: state.hasGuide === "yes",
      guide_language: state.guideLanguage,
      price: price,
      currency: "MXN"
    });
  }

  function openContactStep() {
    const contactStep = window.PixkuyToursMobileContactStep;
    const step = getStep();

    if (
      !contactStep ||
      typeof contactStep.open !== "function" ||
      !step ||
      !canOpenContactStep()
    ) {
      return false;
    }

    return contactStep.open(step, getSnapshot());
  }

  function getRoute() {
    return document.querySelector(ROUTE_SELECTOR);
  }

  function getStep() {
    return stepNode || document.querySelector(CONFIG_STEP_SELECTOR);
  }

  function getFieldValue(name) {
    const step = getStep();
    const field = step
      ? step.querySelector('[data-tours-mobile-config-field="' + name + '"]')
      : null;

    return normalizeText(field && typeof field.value === "string" ? field.value : "");
  }

  function syncPickupClearState() {
    const step = getStep();
    const pickup = step ? step.querySelector('[data-tours-mobile-config-field="pickup"]') : null;
    const clear = step ? step.querySelector(CONFIG_PICKUP_CLEAR_SELECTOR) : null;
    const hasValue = Boolean(normalizeText(pickup && typeof pickup.value === "string" ? pickup.value : ""));

    if (clear) {
      clear.hidden = !hasValue;
    }

    return true;
  }

  function syncStateFromFields() {
    state.pickup = getFieldValue("pickup");
    state.date = getFieldValue("date");
    state.time = getFieldValue("time");

    syncPickupClearState();

    return true;
  }

  function clearPickupField() {
    const step = getStep();
    const pickup = step ? step.querySelector('[data-tours-mobile-config-field="pickup"]') : null;

    state.pickup = "";

    if (pickup) {
      pickup.value = "";
      pickup.dispatchEvent(new Event("input", { bubbles: true }));
    }

    syncPickupClearState();
    syncPriceAndCta();

    return true;
  }

  function getAirportStylePassengerLabel(bucket) {
    const labels = {
      van_1_2: "1–2",
      van_3_4: "3–4",
      van_5_6: "5–6"
    };

    return labels[bucket] || bucket;
  }

  function buildPassengerOptionsMarkup() {
    return PASSENGER_BUCKETS.map(function mapBucket(bucket) {
      const label = getAirportStylePassengerLabel(bucket);

      return [
        '<option value="' + escapeHtml(bucket) + '"',
        bucket === state.passengerFareKey ? ' selected' : '',
        '>',
        escapeHtml(label),
        '</option>'
      ].join("");
    }).join("");
  }
  
    function buildOperationTimeOptionsMarkup() {
    const selectedTime = OPERATION_TIME_OPTIONS.indexOf(state.time) !== -1
      ? state.time
      : OPERATION_TIME_OPTIONS[0];

    return OPERATION_TIME_OPTIONS.map(function mapTimeOption(time) {
      return [
        '<option value="' + escapeHtml(time) + '"',
        time === selectedTime ? ' selected' : '',
        '>',
        escapeHtml(time),
        '</option>'
      ].join("");
    }).join("");
  }

  function buildGuideLanguageOptionsMarkup() {
    const placeholder = getI18nValue(
      "services.cards.tours.panel.guideLanguagePlaceholder",
      getI18nValue("services.cards.tours.contact.guideLanguagePlaceholder", "")
    );

    return [
      '<option value="">' + escapeHtml(placeholder) + '</option>'
    ].concat(GUIDE_LANGUAGES.map(function mapLanguage(language) {
      const label = getI18nValue(
        "services.cards.tours.panel.guideLanguages." + language,
        language
      );

      return [
        '<option value="' + escapeHtml(language) + '"',
        language === state.guideLanguage ? ' selected' : '',
        '>',
        escapeHtml(label),
        '</option>'
      ].join("");
    })).join("");
  }

  function buildGuideLanguageChipsMarkup() {
    const activeLanguage = normalizeText(state.guideLanguage);

    return GUIDE_LANGUAGES.map(function mapGuideLanguage(language) {
      const label = getI18nValue(
        "services.cards.tours.panel.guideLanguages." + language,
        language.toUpperCase()
      );

      return [
        '<button type="button"',
        ' class="tours-mobile-guide-inline__language-option"',
        ' data-tours-mobile-guide-language-option="' + escapeHtml(language) + '"',
        ' aria-pressed="' + (activeLanguage === language ? 'true' : 'false') + '">',
        escapeHtml(label),
        '</button>'
      ].join("");
    }).join("");
  }

  function buildGuideMarkup(tour) {
    const guideLabel = getI18nValue("services.cards.tours.panel.guideLabel", "");
    const guideNo = getI18nValue("services.cards.tours.panel.guideOptions.no", "");
    const guideYes = getI18nValue("services.cards.tours.panel.guideOptions.yes", "");
    const languageLabel = getI18nValue("services.cards.tours.panel.guideLanguageLabel", "");
    const hasGuide = state.hasGuide === "yes";

    if (!tour || !tour.supportsGuide) {
      return "";
    }

    return [
      '<div class="tours-mobile-guide-inline" data-tours-mobile-guide-inline data-tours-mobile-guide-active="' + (hasGuide ? 'true' : 'false') + '">',
      '<div class="tours-mobile-guide-inline__top">',
      '<span class="tours-mobile-guide-inline__label">' + escapeHtml(guideLabel) + '</span>',
      '<div class="tours-mobile-guide-inline__choice" data-tours-mobile-config-guide>',
      '<button type="button" class="tours-mobile-guide-inline__choice-option" data-tours-mobile-guide-option="no" aria-pressed="' + (hasGuide ? 'false' : 'true') + '">' + escapeHtml(guideNo) + '</button>',
      '<button type="button" class="tours-mobile-guide-inline__choice-option" data-tours-mobile-guide-option="yes" aria-pressed="' + (hasGuide ? 'true' : 'false') + '">' + escapeHtml(guideYes) + '</button>',
      '</div>',
      '</div>',
      '<div class="tours-mobile-guide-inline__language" data-tours-mobile-config-language-wrapper' + (hasGuide ? '' : ' hidden') + '>',
      '<span class="tours-mobile-guide-inline__language-label">' + escapeHtml(languageLabel) + '</span>',
      '<div class="tours-mobile-guide-inline__language-options">',
      buildGuideLanguageChipsMarkup(),
      '</div>',
      '</div>',
      '</div>'
    ].join("");
  }

  function buildStepMarkup(tourId) {
    const tour = getTour(tourId);
    const title = getTourText(tourId, "title");
    const duration = getTourText(tourId, "duration");
    const imageAlt = getTourText(tourId, "imageAlt");
    const backText = getI18nValue("services.cards.airport.panel.back", "");
    const pickupLabel = getI18nValue("services.cards.tours.panel.pickupLabel", "");
    const pickupPlaceholder = getI18nValue("services.cards.tours.panel.pickupPlaceholder", "");
    const dateLabel = getI18nValue("services.cards.tours.panel.dateLabel", "");
    const timeLabel = getI18nValue("services.cards.tours.panel.departureTimeLabel", "Hora salida");
    const passengersLabel = getI18nValue("services.cards.tours.panel.passengersLabel", "");
    const priceLabel = getI18nValue("services.cards.tours.panel.priceLabel", "");
    const ctaText = getI18nValue("airportMobileFlow.cta.continue", "Continuar");

    if (!tour) {
      return "";
    }

    return [
      '<section class="tours-mobile-config-step" data-tours-mobile-config-step aria-hidden="true" hidden>',
      '<div class="tours-mobile-config-step__screen">',
      '<div class="tours-mobile-config-step__content">',
      '<div class="tours-mobile-config-step__back-row">',
      '<button type="button" class="tours-mobile-config-step__back" data-tours-mobile-config-back>' + escapeHtml(backText) + '</button>',
      '</div>',
      '<div class="tours-mobile-config-step__summary">',
      '<img class="tours-mobile-config-step__image" src="' + escapeHtml(tour.image) + '" alt="' + escapeHtml(imageAlt) + '" loading="lazy" decoding="async" />',
      '<div class="tours-mobile-config-step__summary-copy">',
      '<h3 class="tours-mobile-config-step__title">' + escapeHtml(title) + '</h3>',
      '<p class="tours-mobile-config-step__meta">' + escapeHtml(duration) + '</p>',
      '</div>',
      '</div>',
      '<div class="tours-mobile-config__fields">',
      '<div class="services-hourly-panel__field services-hourly-panel__field--pickup-mobile tours-mobile-config__pickup" data-place-field="tour_private_pickup">',
      '<label class="services-hourly-panel__label" for="tours-mobile-pickup">' + escapeHtml(pickupLabel) + '</label>',
      '<div class="place-autocomplete services-hourly-panel__pickup-autocomplete" data-tours-mobile-pickup-shell>',
      '<input id="tours-mobile-pickup" type="text" class="services-hourly-panel__control" data-tours-mobile-config-field="pickup" data-tours-mobile-pickup-input autocomplete="off" spellcheck="false" value="' + escapeHtml(state.pickup) + '" placeholder="' + escapeHtml(pickupPlaceholder) + '" />',
      '<button type="button" class="place-autocomplete__clear" data-tours-mobile-pickup-clear hidden>',
      '<span aria-hidden="true">×</span>',
      '</button>',
      '<div class="place-autocomplete__mount" data-tours-mobile-pickup-compact-mount aria-hidden="true"></div>',
      '</div>',
      '</div>',
      '<div class="tours-mobile-config__row tours-mobile-config__row--trip">',
      '<div class="airport-mobile-passengers tours-mobile-config__passengers">',
      '<span class="airport-mobile-passengers__label">' + escapeHtml(passengersLabel) + '</span>',
      '<select id="tours-mobile-passengers" class="airport-mobile-passengers__select" data-tours-mobile-config-passengers>',
      buildPassengerOptionsMarkup(),
      '</select>',
      '</div>',
      '<div class="services-hourly-panel__field services-hourly-panel__field--date-airport-mobile tours-mobile-config__date">',
      '<label class="services-hourly-panel__label" for="tours-mobile-date">' + escapeHtml(dateLabel) + '</label>',
      '<div class="services-hourly-panel__date-wrap">',
      '<input id="tours-mobile-date" type="date" class="services-hourly-panel__control" data-tours-mobile-config-field="date" value="' + escapeHtml(state.date) + '" />',
      '<span class="services-hourly-panel__date-overlay" aria-hidden="true" data-tours-mobile-date-overlay>dd/mm/aaaa</span>',
      '<span class="services-hourly-panel__date-icon" aria-hidden="true">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>',
      '<line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>',
      '<line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>',
      '<line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>',
      '</svg>',
      '</span>',
      '</div>',
      '</div>',
      '<div class="services-hourly-panel__field services-hourly-panel__field--time-mobile tours-mobile-config__time">',
      '<label class="services-hourly-panel__label" for="tours-mobile-time">' + escapeHtml(timeLabel) + '</label>',
      '<div class="services-hourly-panel__date-wrap services-hourly-panel__time-wrap">',
      '<select id="tours-mobile-time" class="services-hourly-panel__control" data-tours-mobile-config-field="time">',
      buildOperationTimeOptionsMarkup(),
      '</select>',
      '<span class="services-hourly-panel__date-overlay services-hourly-panel__time-overlay" aria-hidden="true" hidden>--:--</span>',
      '<span class="services-hourly-panel__date-icon services-hourly-panel__time-icon" aria-hidden="true">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>',
      '<polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>',
      '</svg>',
      '</span>',
      '</div>',
      '</div>',
      '</div>',
      buildGuideMarkup(tour),
      '</div>',
      '<div class="tours-mobile-config-step__footer">',
      '<div class="tours-mobile-config-step__vehicle">',
      '<img class="tours-mobile-config-step__vehicle-image" src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="" loading="lazy" decoding="async" aria-hidden="true" />',
      '</div>',
      '<div class="tours-mobile-config-step__fare">',
      '<span class="tours-mobile-config-step__fare-label">' + escapeHtml(priceLabel) + '</span>',
      '<strong class="tours-mobile-config-step__fare-value" data-tours-mobile-config-price>' + buildVisiblePriceMarkup() + '</strong>',
      '</div>',
      '<button type="button" class="cta tours-mobile-config-step__cta" data-tours-mobile-config-cta>' + escapeHtml(ctaText) + '</button>',
      '</div>',
      '</div>',
      '</div>',
      '</section>'
    ].join("");
  }

  function syncGuideUi() {
    const step = getStep();
    const guideRoot = step ? step.querySelector("[data-tours-mobile-guide-inline]") : null;
    const languageWrapper = step ? step.querySelector("[data-tours-mobile-config-language-wrapper]") : null;
    const hasGuide = state.hasGuide === "yes";

    if (guideRoot) {
      guideRoot.setAttribute("data-tours-mobile-guide-active", hasGuide ? "true" : "false");
    }

    if (languageWrapper) {
      languageWrapper.hidden = !hasGuide;
    }

    if (!hasGuide) {
      state.guideLanguage = "";
    }

    if (step) {
      step.querySelectorAll("[data-tours-mobile-guide-option]").forEach(function syncGuideOption(button) {
        const value = normalizeText(button.getAttribute("data-tours-mobile-guide-option"));
        const isActive = hasGuide ? value === "yes" : value === "no";

        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      step.querySelectorAll("[data-tours-mobile-guide-language-option]").forEach(function syncLanguageOption(button) {
        const value = normalizeText(button.getAttribute("data-tours-mobile-guide-language-option"));
        const isActive = hasGuide && value === state.guideLanguage;

        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    return true;
  }

  function syncPriceAndCta() {
    const step = getStep();
    const price = step ? step.querySelector(CONFIG_PRICE_SELECTOR) : null;
    const cta = step ? step.querySelector(CONFIG_CTA_SELECTOR) : null;
    const isReady = canContinue();

    if (price) {
      price.innerHTML = buildVisiblePriceMarkup();
    }

    if (cta) {
      cta.disabled = !isReady;
      cta.setAttribute("aria-disabled", isReady ? "false" : "true");
    }

    trackTourMobileQuoteReady();

    return true;
  }

  function renderStep(tourId) {
    const route = getRoute();
    const wasOpen = isOpen();

    if (!route) {
      return false;
    }

    if (!stepNode) {
      stepNode = document.createElement("div");
      route.appendChild(stepNode);
    }

    stepNode.outerHTML = buildStepMarkup(tourId);
    stepNode = route.querySelector(CONFIG_STEP_SELECTOR);

    if (wasOpen) {
      stepNode.hidden = false;
      stepNode.setAttribute("aria-hidden", "false");
    }

    bindStepEvents();
    syncPickupClearState();
    syncPriceAndCta();

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

  function setStepVisibility(isVisible) {
    const step = getStep();

    if (!step) {
      return false;
    }

    if (!isVisible) {
      blurActiveElementInside(step);
    }

    step.hidden = !isVisible;
    step.setAttribute("aria-hidden", isVisible ? "false" : "true");
    document.body.setAttribute(BODY_CONFIG_ATTR, isVisible ? "true" : "false");

    return true;
  }

  function open(tourId) {
    const safeTourId = normalizeText(tourId);

    if (!isMobileViewport() || TOUR_IDS.indexOf(safeTourId) === -1) {
      return false;
    }

    activeTourId = safeTourId;
    state = {
      passengerFareKey: state.passengerFareKey || "van_1_2",
      pickup: state.pickup || "",
      date: state.date || "",
      time: OPERATION_TIME_OPTIONS.indexOf(state.time) !== -1 ? state.time : OPERATION_TIME_OPTIONS[0],
      hasGuide: "no",
      guideLanguage: ""
    };

    renderStep(activeTourId);
    setStepVisibility(true);

    return true;
  }

  function close() {
    setStepVisibility(false);
    return true;
  }

  function bindStepEvents() {
    const step = getStep();

    if (!step || step.dataset.toursMobileConfigBound === "1") {
      return false;
    }

    step.dataset.toursMobileConfigBound = "1";

    step.addEventListener("click", function onConfigClick(event) {
      const back = event.target.closest(CONFIG_BACK_SELECTOR);
      const pickupClear = event.target.closest(CONFIG_PICKUP_CLEAR_SELECTOR);
      const guideLanguageButton = event.target.closest("[data-tours-mobile-guide-language-option]");
      const guideButton = event.target.closest("[data-tours-mobile-guide-option]");
      const cta = event.target.closest(CONFIG_CTA_SELECTOR);

      if (back) {
        close();
        return;
      }

      if (cta) {
        event.preventDefault();
        event.stopPropagation();

        if (cta.disabled || cta.getAttribute("aria-disabled") === "true") {
          return;
        }

        if (openContactStep()) {
          trackTourMobileContinueClick();
        }

        return;
      }

      if (pickupClear) {
        event.preventDefault();
        event.stopPropagation();
        clearPickupField();
        return;
      }

      if (guideLanguageButton) {
        event.preventDefault();
        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        state.guideLanguage = normalizeText(
          guideLanguageButton.getAttribute("data-tours-mobile-guide-language-option")
        );

        syncGuideUi();
        syncPriceAndCta();
        return;
      }

      if (guideButton) {
        event.preventDefault();
        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        state.hasGuide = normalizeText(guideButton.getAttribute("data-tours-mobile-guide-option")) === "yes" ? "yes" : "no";

        if (state.hasGuide !== "yes") {
          state.guideLanguage = "";
        }

        syncGuideUi();
        syncPriceAndCta();
        return;
      }
    });

    step.addEventListener("input", function onConfigInput(event) {
      if (!event.target || !event.target.matches(CONFIG_FIELD_SELECTOR)) {
        return;
      }

      syncStateFromFields();
      syncPriceAndCta();
    });

    step.addEventListener("change", function onConfigChange(event) {
      if (!event.target) {
        return;
      }

      if (event.target.matches(CONFIG_PASSENGERS_SELECTOR)) {
        state.passengerFareKey = normalizeText(event.target.value) || "van_1_2";
        syncPriceAndCta();
        return;
      }

      if (event.target.matches(CONFIG_LANGUAGE_SELECTOR)) {
        state.guideLanguage = normalizeText(event.target.value);
        syncPriceAndCta();
        return;
      }

      if (event.target.matches(CONFIG_FIELD_SELECTOR)) {
        syncStateFromFields();
        syncPriceAndCta();
      }
    });

    return true;
  }

  function isOpen() {
    const step = getStep();

    return Boolean(step && step.hidden !== true && step.getAttribute("aria-hidden") !== "true");
  }

  window.PixkuyToursMobileConfigStep = {
    open: open,
    close: close,
    isOpen: isOpen,
    getSnapshot: getSnapshot,
    canOpenContactStep: canOpenContactStep,
    openContactStep: openContactStep
  };
})(window, document);