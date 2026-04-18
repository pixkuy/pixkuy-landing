(function () {
  const panelRoot = document.querySelector('[data-services-tours-panel]');
  const catalogMount = document.querySelector('[data-services-tours-catalog]');
  const configMount = document.querySelector('[data-services-tours-config]');

  if (!panelRoot || !catalogMount || !configMount) return;

  const PASSENGER_BUCKETS = ['van_1_2', 'van_3_4', 'van_5_6'];
  const GUIDE_LANGUAGES = ['es', 'en', 'fr'];

  const TOURS = {
    teotihuacan: {
      id: 'teotihuacan',
      durationHours: 6,
      includesTickets: true,
      supportsGuide: true,
      imageDesktop: 'assets/img/tours/teotihuacan_desktop.jpg',
      imageMobile: 'assets/img/tours/teotihuacan_mobile.jpg',
      fallback: {
        title: 'Pirámides Teotihuacan',
        description: 'Descubre Teotihuacan en una experiencia privada con traslado de ida y vuelta, entradas incluidas y una visita a tu ritmo.',
        duration: '6 horas',
        priceFrom: '4.000 MXN'
      },
      fares: {
        van_1_2: { no: 4000, yes: 5000 },
        van_3_4: { no: 4500, yes: 5500 },
        van_5_6: { no: 5200, yes: 6200 }
      }
    },
    teotihuacan_basilica: {
      id: 'teotihuacan_basilica',
      durationHours: 9,
      includesTickets: true,
      supportsGuide: true,
      imageDesktop: 'assets/img/tours/teotihuacan_basilica_desktop.jpg',
      imageMobile: 'assets/img/tours/teotihuacan_basilica_mobile.jpg',
      fallback: {
        title: 'Pirámides Teotihuacan + Basílica Santa María de Guadalupe',
        description: 'Descubre Teotihuacan y la Basílica en una experiencia privada de día completo, con traslado de ida y vuelta, entradas incluidas y una visita bien aprovechada.',
        duration: '9 horas',
        priceFrom: '5.000 MXN'
      },
      fares: {
        van_1_2: { no: 5000, yes: 6200 },
        van_3_4: { no: 6200, yes: 7400 },
        van_5_6: { no: 7600, yes: 8800 }
      }
    },
    xochimilco_coyoacan: {
      id: 'xochimilco_coyoacan',
      durationHours: 6,
      includesTickets: false,
      supportsGuide: false,
      imageDesktop: 'assets/img/tours/xochimilco_coyoacan_desktop.jpg',
      imageMobile: 'assets/img/tours/xochimilco_coyoacan_mobile.jpg',
      fallback: {
        title: 'Xochimilco + Coyoacán',
        description: 'Disfruta Xochimilco y Coyoacán en un recorrido privado con traslado de ida y vuelta, pensado para vivir dos de los lugares más emblemáticos de Ciudad de México con calma y comodidad.',
        duration: '6 horas',
        priceFrom: '4.500 MXN'
      },
      fares: {
        van_1_2: { no: 4500 },
        van_3_4: { no: 5000 },
        van_5_6: { no: 5800 }
      }
    },
    cholula_puebla: {
      id: 'cholula_puebla',
      durationHours: 9,
      includesTickets: false,
      supportsGuide: false,
      imageDesktop: 'assets/img/tours/cholula_puebla_desktop.jpg',
      imageMobile: 'assets/img/tours/cholula_puebla_mobile.jpg',
      fallback: {
        title: 'Cholula + Puebla',
        description: 'Explora Cholula y Puebla en una experiencia privada de día completo, con traslado desde Ciudad de México y tiempo suficiente para disfrutar la visita a tu ritmo.',
        duration: '9 horas',
        priceFrom: '7.200 MXN'
      },
      fares: {
        van_1_2: { no: 7200 },
        van_3_4: { no: 8600 },
        van_5_6: { no: 10250 }
      }
    },
    san_miguel_allende: {
      id: 'san_miguel_allende',
      durationHours: 10,
      includesTickets: false,
      supportsGuide: false,
      imageDesktop: 'assets/img/tours/san_miguel_allende_desktop.jpg',
      imageMobile: 'assets/img/tours/san_miguel_allende_mobile.jpg',
      fallback: {
        title: 'San Miguel de Allende',
        description: 'Descubre San Miguel de Allende en un recorrido privado con traslado desde Ciudad de México, pensado para disfrutar la visita con comodidad y sin prisas innecesarias.',
        duration: '10 horas',
        priceFrom: '7.800 MXN'
      },
      fares: {
        van_1_2: { no: 7800 },
        van_3_4: { no: 9300 },
        van_5_6: { no: 11200 }
      }
    }
  };

  const state = {
    selectedTourId: null,
    passengerFareKey: '',
    passengerFareKeyAuto: false,
    pickup: '',
    tripDate: '',
    tripTime: '',
    hasGuide: 'no',
    guideLanguage: '',
    price: null,
    currency: 'MXN',
    pendingTourId: null
  };

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getLabels() {
    return {
      priceFromLabel: getI18nValue('services.cards.tours.panel.priceFromLabel') || 'Precio desde',
      passengersLabel: getI18nValue('services.cards.tours.panel.passengersLabel') || 'Pasajeros',
      pickupLabel: getI18nValue('services.cards.tours.panel.pickupLabel') || 'Recogida',
      pickupPlaceholder: getI18nValue('services.cards.tours.panel.pickupPlaceholder') || 'Indica punto de recogida',
      pickupHelp: getI18nValue('services.cards.tours.panel.pickupHelp') || 'El punto de recogida valida operativa, pero no cambia el precio.',
      dateLabel: getI18nValue('services.cards.tours.panel.dateLabel') || 'Fecha',
      timeLabel: getI18nValue('services.cards.tours.panel.timeLabel') || 'Hora',
      guideLabel: getI18nValue('services.cards.tours.panel.guideLabel') || 'Guía',
      guideLanguageLabel: getI18nValue('services.cards.tours.panel.guideLanguageLabel') || 'Idioma del guía',
      guideLanguagePlaceholder: getI18nValue('services.cards.tours.panel.guideLanguagePlaceholder') || 'Selecciona idioma',
      durationLabel: getI18nValue('services.cards.tours.panel.durationLabel') || 'Duración',
      priceLabel: getI18nValue('services.cards.tours.panel.priceLabel') || 'Precio final',
      pricePending: getI18nValue('services.cards.tours.panel.priceValuePending') || '—',
      cta: getI18nValue('services.cards.tours.panel.cta') || 'Solicitar',
      ctaDisabled: getI18nValue('services.cards.tours.panel.ctaDisabled') || 'Completa la configuración',
      emptyStateTitle: getI18nValue('services.cards.tours.panel.emptyStateTitle') || 'Selecciona un tour',
      emptyStateText: getI18nValue('services.cards.tours.panel.emptyStateText') || 'Primero elige una opción del catálogo para ver su configuración y el precio final.',
      changeTourConfirm: getI18nValue('services.cards.tours.panel.changeTourConfirm') || 'Si cambias de tour, revisaremos la configuración actual y solo se conservarán los datos compatibles. ¿Quieres continuar?',
      confirmAccept: getI18nValue('services.cards.tours.panel.confirmAccept') || 'Continuar',
      confirmCancel: getI18nValue('services.cards.tours.panel.confirmCancel') || 'Cancelar'
    };
  }

  function getTourMeta(tourId) {
    const tour = TOURS[tourId];
    if (!tour) return null;

    const imageSrc = isMobileToursCatalogLayout() && tour.imageMobile
      ? tour.imageMobile
      : (tour.imageDesktop || '');

    return {
      title: getI18nValue(`services.cards.tours.panel.catalog.${tourId}.title`) || tour.fallback.title,
      description: getI18nValue(`services.cards.tours.panel.catalog.${tourId}.description`) || tour.fallback.description,
      duration: getI18nValue(`services.cards.tours.panel.catalog.${tourId}.duration`) || tour.fallback.duration,
      priceFrom: getI18nValue(`services.cards.tours.panel.catalog.${tourId}.priceFrom`) || tour.fallback.priceFrom,
      imageSrc,
      imageAlt: getI18nValue(`services.cards.tours.panel.catalog.${tourId}.imageAlt`) || tour.fallback.title
    };
  }

  function getGuideLanguageLabel(code) {
    return getI18nValue(`services.cards.tours.panel.guideLanguages.${code}`) || code;
  }

  function getGuideOptionLabel(value) {
    return getI18nValue(`services.cards.tours.panel.guideOptions.${value}`) || value;
  }

  function getPassengerBucketLabel(key) {
    return getI18nValue(`services.cards.tours.panel.passengerBuckets.${key}`) || key;
  }

  function getTourById(tourId) {
    return TOURS[tourId] || null;
  }
  
    function getTemporalPricingApi() {
    const api = window.PixkuyToursTemporalPricing;
    return api && typeof api === "object" ? api : null;
  }

  function shouldShowTemporalDateField() {
    const api = getTemporalPricingApi();

    if (!api || typeof api.shouldShowDateFieldInServices !== "function") {
      return false;
    }

    return api.shouldShowDateFieldInServices();
  }

  function applyTemporalDatePricing(basePrice, serviceDateLiteral) {
    const api = getTemporalPricingApi();

    if (!api || typeof api.applyTemporalPricing !== "function") {
      return basePrice;
    }

    return api.applyTemporalPricing(basePrice, serviceDateLiteral);
  }

  function getReservationMinimumDateLiteral() {
    const formsApi = window.PixkuyForms || {};
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

    return String(formatDate(minimumDateTime) || "").trim();
  }
  
    function isServicesDateAtOrAfterMinimum(dateLiteral) {
    const safeDate = typeof dateLiteral === "string" ? dateLiteral.trim() : "";
    const minimumDateLiteral = getReservationMinimumDateLiteral();

    if (!safeDate || !minimumDateLiteral) {
      return false;
    }

    return safeDate >= minimumDateLiteral;
  }

  function getServicesDateFieldValue() {
    return typeof state.tripDate === "string" ? state.tripDate.trim() : "";
  }

  function formatCurrency(value, currency) {
    const labels = getLabels();
    const currencyCode = currency || 'MXN';

    if (typeof value !== 'number') return labels.pricePending;

    try {
      const amount = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(value);

      return `${amount} ${currencyCode}`;
    } catch (err) {
      return `${value} ${currencyCode}`;
    }
  }

  function hasSpecificConfigData() {
    return !!(
      (state.passengerFareKey && !state.passengerFareKeyAuto) ||
      state.hasGuide === 'yes' ||
      state.guideLanguage
    );
  }

  function getComputedPrice() {
    const tour = getTourById(state.selectedTourId);
    const serviceDateLiteral = getServicesDateFieldValue();
    let basePrice = null;

    if (!tour || !state.passengerFareKey) return null;

    const fareBucket = tour.fares[state.passengerFareKey];
    if (!fareBucket) return null;

    const guideKey = tour.supportsGuide && state.hasGuide === 'yes' ? 'yes' : 'no';
    basePrice = typeof fareBucket[guideKey] === 'number' ? fareBucket[guideKey] : null;

    if (typeof basePrice !== "number") {
      return null;
    }

    if (shouldShowTemporalDateField() && !serviceDateLiteral) {
      return null;
    }

    if (shouldShowTemporalDateField() && !isServicesDateAtOrAfterMinimum(serviceDateLiteral)) {
      return null;
    }

    return applyTemporalDatePricing(basePrice, serviceDateLiteral);
  }

  function syncDerivedState() {
    const tour = getTourById(state.selectedTourId);

    if (!shouldShowTemporalDateField()) {
      state.tripDate = '';
    }

    if (!tour) {
      state.price = null;
      state.hasGuide = 'no';
      state.guideLanguage = '';
      return;
    }

    if (!tour.supportsGuide) {
      state.hasGuide = 'no';
      state.guideLanguage = '';
    } else if (state.hasGuide !== 'yes' && state.hasGuide !== 'no') {
      state.hasGuide = 'no';
    }

    if (tour.supportsGuide && state.hasGuide !== 'yes') {
      state.guideLanguage = '';
    }

    state.price = getComputedPrice();
  }

  function isConfigComplete() {
    const tour = getTourById(state.selectedTourId);

    if (!tour) return false;
    if (!state.passengerFareKey) return false;
    if (shouldShowTemporalDateField() && !getServicesDateFieldValue()) return false;
    if (tour.supportsGuide && state.hasGuide === 'yes' && !state.guideLanguage) return false;

    return typeof state.price === 'number';
  }

  function buildCatalogMarkup() {
    const labels = getLabels();
    const tourIds = Object.keys(TOURS);

    return tourIds.map((tourId, index) => {
      const meta = getTourMeta(tourId);
      const isBottomRowTour = index >= 3;

      const mediaMarkup = meta.imageSrc
        ? `
          <div class="services-tours-panel__tour-media">
            <img
              class="services-tours-panel__tour-image"
              src="${escapeHtml(meta.imageSrc)}"
              alt="${escapeHtml(meta.imageAlt)}"
              loading="lazy"
              decoding="async"
            />
          </div>
        `
        : '';

      return `
        <button
          type="button"
          class="services-tours-panel__tour${meta.imageSrc ? ' services-tours-panel__tour--with-media' : ''}${isBottomRowTour ? ' services-tours-panel__tour--bottom-row' : ''}"
          data-services-tour-option="${escapeHtml(tourId)}"
          aria-pressed="${state.selectedTourId === tourId ? 'true' : 'false'}"
        >
          ${mediaMarkup}

          <div class="services-tours-panel__tour-head">
            <h4 class="services-tours-panel__tour-title">${escapeHtml(meta.title)}</h4>
            <span class="services-tours-panel__tour-duration">${escapeHtml(meta.duration)}</span>
          </div>

          <p class="services-tours-panel__tour-text">${escapeHtml(meta.description)}</p>

          <div class="services-tours-panel__tour-footer">
            <div class="services-tours-panel__tour-price">
              <span class="services-tours-panel__tour-price-label">${escapeHtml(labels.priceFromLabel)}</span>
              <strong class="services-tours-panel__tour-price-value">${escapeHtml(meta.priceFrom)}</strong>
            </div>

            <span class="services-tours-panel__tour-check" aria-hidden="true">
              ${state.selectedTourId === tourId ? '✓' : '+'}
            </span>
          </div>
        </button>
      `;
    }).join('');
  }

  function renderCatalog() {
    catalogMount.innerHTML = buildCatalogMarkup();
  }
  
  function isDesktopToursLayout() {
  return window.innerWidth > 1024;
}

function isMobileToursCatalogLayout() {
  return window.innerWidth <= 720;
}

function getSelectedTourIndex() {
  if (!state.selectedTourId) return -1;
  return Object.keys(TOURS).indexOf(state.selectedTourId);
}

function placeConfigMountForCurrentLayout() {
  if (!catalogMount || !configMount) return;

  if (!isDesktopToursLayout()) {
    if (panelRoot.classList.contains('services-tours-panel--sheet-open')) {
      return;
    }

    if (configMount.parentElement !== panelRoot) {
      panelRoot.appendChild(configMount);
    }
    return;
  }

  const tourIndex = getSelectedTourIndex();

  if (tourIndex === -1) {
    if (configMount.parentElement !== panelRoot) {
      panelRoot.appendChild(configMount);
    }
    return;
  }

  const tourCards = catalogMount.querySelectorAll('[data-services-tour-option]');
  if (!tourCards.length) return;

  if (tourIndex <= 2) {
    const anchorCard = tourCards[2];
    if (anchorCard && anchorCard.nextSibling !== configMount) {
      anchorCard.insertAdjacentElement('afterend', configMount);
    }
    return;
  }

  if (configMount.parentElement !== catalogMount || catalogMount.lastElementChild !== configMount) {
    catalogMount.appendChild(configMount);
  }
}

function getSelectedRowAnchorCard() {
  if (!catalogMount) return null;

  const tourIndex = getSelectedTourIndex();
  if (tourIndex === -1) return null;

  const tourCards = catalogMount.querySelectorAll('[data-services-tour-option]');
  if (!tourCards.length) return null;

  if (tourIndex <= 2) {
    return tourCards[0] || null;
  }

  return tourCards[3] || tourCards[tourIndex] || null;
}

function ensureSelectedTourRowVisible() {
  if (!isDesktopToursLayout()) return;

  const anchorCard = getSelectedRowAnchorCard();
  if (!anchorCard || !configMount || configMount.hidden) return;

  const cardRect = anchorCard.getBoundingClientRect();
  const configRect = configMount.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  const topSafeOffset = 24;
  const bottomSafeOffset = 24;
  const availableHeight = viewportHeight - topSafeOffset - bottomSafeOffset;

  const blockTop = cardRect.top;
  const blockBottom = configRect.bottom;
  const blockHeight = blockBottom - blockTop;

  let targetTop = null;

  if (blockHeight <= availableHeight) {
    const desiredTop = topSafeOffset + ((availableHeight - blockHeight) / 2);
    targetTop = window.scrollY + blockTop - desiredTop;
  } else {
    const preferredTopOffset = 24;

    if (blockTop < topSafeOffset || configRect.bottom > (viewportHeight - bottomSafeOffset)) {
      targetTop = window.scrollY + blockTop - preferredTopOffset;
    }
  }

  if (targetTop === null) return;

  targetTop = Math.max(0, targetTop);

  if (Math.abs(targetTop - window.scrollY) < 4) return;

  window.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  });
}

  function buildGuideLanguageOptionsMarkup() {
    return GUIDE_LANGUAGES.map((code) => {
      const isSelected = state.guideLanguage === code;

      return `
        <button
          type="button"
          class="services-tours-panel__guide-language-option${isSelected ? ' is-selected' : ''}"
          role="option"
          data-services-tours-guide-language-option="${escapeHtml(code)}"
          aria-selected="${isSelected ? 'true' : 'false'}"
        >
          ${escapeHtml(getGuideLanguageLabel(code))}
        </button>
      `;
    }).join('');
  }

  function closeGuideLanguagePicker() {
    const trigger = configMount.querySelector('[data-services-tours-guide-language-trigger]');
    const panel = configMount.querySelector('[data-services-tours-guide-language-panel]');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }

    if (panel) {
      panel.hidden = true;
    }
  }

  function openGuideLanguagePicker() {
    const trigger = configMount.querySelector('[data-services-tours-guide-language-trigger]');
    const panel = configMount.querySelector('[data-services-tours-guide-language-panel]');

    if (!trigger || !panel) return;

    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    scrollGuideLanguagePickerIntoView();
  }

  function scrollGuideLanguagePickerIntoView() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const pickerRoot = configMount.querySelector('[data-services-tours-guide-language-picker]');
        const panel = configMount.querySelector('[data-services-tours-guide-language-panel]');
        const scrollTarget = panel && !panel.hidden ? panel : pickerRoot;

        if (!scrollTarget || typeof scrollTarget.scrollIntoView !== 'function') return;

        scrollTarget.scrollIntoView({
          block: 'end',
          inline: 'nearest',
          behavior: 'smooth'
        });
      });
    });
  }

  function toggleGuideLanguagePicker() {
    const panel = configMount.querySelector('[data-services-tours-guide-language-panel]');
    if (!panel) return;

    if (panel.hidden) {
      openGuideLanguagePicker();
      return;
    }

    closeGuideLanguagePicker();
  }

  function getGuideLanguageTriggerLabel() {
    const labels = getLabels();

    if (!state.guideLanguage) {
      return labels.guideLanguagePlaceholder;
    }

    return getGuideLanguageLabel(state.guideLanguage);
  }

  function buildPassengerChipsMarkup() {
    return PASSENGER_BUCKETS.map((bucketKey) => {
      const isActive = state.passengerFareKey === bucketKey;
      return `
        <button
          type="button"
          class="services-tours-panel__chip${isActive ? ' is-active' : ''}"
          data-services-tours-passenger="${escapeHtml(bucketKey)}"
          aria-pressed="${isActive ? 'true' : 'false'}"
        >
          ${escapeHtml(getPassengerBucketLabel(bucketKey))}
        </button>
      `;
    }).join('');
  }

  function buildGuideOptionsMarkup(tour) {
    if (!tour || !tour.supportsGuide) return '';

    return ['no', 'yes'].map((value) => {
      const isActive = state.hasGuide === value;
      return `
        <button
          type="button"
          class="services-tours-panel__chip${isActive ? ' is-active' : ''}"
          data-services-tours-guide="${escapeHtml(value)}"
          aria-pressed="${isActive ? 'true' : 'false'}"
        >
          ${escapeHtml(getGuideOptionLabel(value))}
        </button>
      `;
    }).join('');
  }

  function buildGuideLanguageFieldMarkup(tour) {
    const labels = getLabels();

    if (!tour || !tour.supportsGuide || state.hasGuide !== 'yes') return '';

    return `
      <div class="services-tours-panel__field services-tours-panel__field--guide-language">
        <label class="services-tours-panel__label" for="services-tours-guide-language-trigger">
          ${escapeHtml(labels.guideLanguageLabel)}
        </label>

        <div
          class="services-tours-panel__guide-language"
          data-services-tours-guide-language-picker
        >
          <button
            id="services-tours-guide-language-trigger"
            type="button"
            class="services-tours-panel__control services-tours-panel__control--select services-tours-panel__guide-language-trigger"
            data-services-tours-guide-language-trigger
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-controls="services-tours-guide-language-listbox"
          >
            <span class="services-tours-panel__guide-language-trigger-label">
              ${escapeHtml(getGuideLanguageTriggerLabel())}
            </span>
          </button>

          <div
            class="services-tours-panel__guide-language-panel"
            data-services-tours-guide-language-panel
            hidden
          >
            <div
              id="services-tours-guide-language-listbox"
              class="services-tours-panel__guide-language-listbox"
              role="listbox"
              aria-labelledby="services-tours-guide-language-trigger"
            >
              ${buildGuideLanguageOptionsMarkup()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildEmptyStateMarkup() {
    return '';
  }

  function buildConfigMarkup() {
    const labels = getLabels();
    const tour = getTourById(state.selectedTourId);
    const meta = getTourMeta(state.selectedTourId);

    if (!tour || !meta) {
      return buildEmptyStateMarkup();
    }

    const priceText = formatCurrency(state.price, state.currency);
    const ctaDisabled = !isConfigComplete();
    const showGuide = !!tour.supportsGuide;
    const showGuideLanguage = showGuide && state.hasGuide === 'yes';
    const showTemporalDateField = shouldShowTemporalDateField();
    const minimumDateLiteral = getReservationMinimumDateLiteral();
    const currentDateValue = getServicesDateFieldValue();

    return `
      <div class="services-tours-panel__config-head">
        <div class="services-tours-panel__selected-tour">
          <div>
            <h4 class="services-tours-panel__selected-tour-title">${escapeHtml(meta.title)}</h4>
          </div>
        </div>
      </div>

      <div class="services-tours-panel__layout">
        <div class="services-tours-panel__row services-tours-panel__row--top">
          <div class="services-tours-panel__field services-tours-panel__field--passengers">
            <span class="services-tours-panel__label">${escapeHtml(labels.passengersLabel)}</span>
            <div class="services-tours-panel__chips">
              ${buildPassengerChipsMarkup()}
            </div>
          </div>

          ${
            showGuide
              ? `
                <div class="services-tours-panel__field services-tours-panel__field--guide">
                  <span class="services-tours-panel__label">${escapeHtml(labels.guideLabel)}</span>
                  <div class="services-tours-panel__chips">
                    ${buildGuideOptionsMarkup(tour)}
                  </div>
                </div>
              `
              : ''
          }

                    ${
            showGuideLanguage
              ? buildGuideLanguageFieldMarkup(tour)
              : ''
          }

                    ${
            showTemporalDateField
              ? `
                <div class="services-tours-panel__field services-tours-panel__field--date">
                  <label
                    class="services-tours-panel__label"
                    for="services-tours-date"
                  >
                    ${escapeHtml(labels.dateLabel)}
                  </label>

                  <div class="services-tours-panel__date-wrap">
                    <input
                      id="services-tours-date"
                      type="date"
                      class="services-tours-panel__control"
                      data-services-tours-date
                      value="${escapeHtml(currentDateValue)}"
                      ${minimumDateLiteral ? `min="${escapeHtml(minimumDateLiteral)}"` : ""}
                    />

                    <span
                      class="services-tours-panel__date-overlay"
                      aria-hidden="true"
                      ${currentDateValue ? 'hidden' : ''}
                    >
                      dd/mm/aaaa
                    </span>

                    <span class="services-tours-panel__date-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>
                      </svg>
                    </span>
                  </div>
                </div>
              `
              : ''
          }

          <div class="services-tours-panel__price services-tours-panel__price--inline">
            <p class="services-tours-panel__price-label">${escapeHtml(labels.priceLabel)}</p>
            <strong class="services-tours-panel__price-value">${escapeHtml(priceText)}</strong>
          </div>
        </div>

        <div class="services-tours-panel__row services-tours-panel__row--cta">
          <button
            type="button"
            class="services-tours-panel__cta services-tours-panel__cta--full"
            data-services-tours-cta
            ${ctaDisabled ? 'disabled aria-disabled="true"' : ''}
          >
            ${escapeHtml(ctaDisabled ? labels.ctaDisabled : labels.cta)}
          </button>
        </div>
      </div>
    `;
  }
  
  function renderConfig() {
    syncDerivedState();

    if (!state.selectedTourId) {
      configMount.hidden = true;
      configMount.innerHTML = '';
      placeConfigMountForCurrentLayout();
      return;
    }

    configMount.hidden = false;
    configMount.innerHTML = buildConfigMarkup();
    placeConfigMountForCurrentLayout();
  }

  function renderAll() {
  renderCatalog();
  renderConfig();
}

function syncConfigComputedUi() {
  const priceValueNodes = configMount.querySelectorAll('.services-tours-panel__price-value');
  const ctaNodes = configMount.querySelectorAll('[data-services-tours-cta]');
  const dateInput = configMount.querySelector('[data-services-tours-date]');
  const dateOverlay = configMount.querySelector('.services-tours-panel__date-overlay');
  const nextPriceText = formatCurrency(state.price, state.currency);
  const nextCtaDisabled = !isConfigComplete();
  const labels = getLabels();

  priceValueNodes.forEach((node) => {
    node.textContent = nextPriceText;
  });

  ctaNodes.forEach((node) => {
    node.disabled = nextCtaDisabled;
    node.setAttribute('aria-disabled', nextCtaDisabled ? 'true' : 'false');
    node.textContent = nextCtaDisabled ? labels.ctaDisabled : labels.cta;
  });

  if (dateOverlay) {
    dateOverlay.hidden = !!(dateInput && dateInput.value);
  }

  window.dispatchEvent(new CustomEvent('pixkuy:tours-panel-ui-sync'));
}

  function applyTourSelection(nextTourId) {
    const nextTour = getTourById(nextTourId);
    const previousTour = getTourById(state.selectedTourId);
    const hadSpecificConfig = hasSpecificConfigData();

    state.selectedTourId = nextTourId;
    state.pendingTourId = null;

    if (!nextTour.supportsGuide) {
      state.hasGuide = 'no';
      state.guideLanguage = '';
    } else if (previousTour && !previousTour.supportsGuide) {
      state.hasGuide = 'no';
      state.guideLanguage = '';
    }

    if (!hadSpecificConfig) {
      state.passengerFareKey = 'van_1_2';
      state.passengerFareKeyAuto = true;
    }

    renderAll();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ensureSelectedTourRowVisible();
      });
    });
  }

  function requestTourSelection(nextTourId) {
    if (!TOURS[nextTourId]) return;
    if (state.selectedTourId === nextTourId) return;

    applyTourSelection(nextTourId);
  }

  function emitSubmit() {
    if (!isConfigComplete()) return;

    const selectedTour = getTourById(state.selectedTourId);
    const meta = getTourMeta(state.selectedTourId);

    const detail = {
      serviceType: 'tour_private',
      tour_private_tour_id: state.selectedTourId,
      tour_private_tour_label: meta ? meta.title : '',
      tour_private_duration_hours: selectedTour.durationHours,
      tour_private_passenger_fare_key: state.passengerFareKey,
      tour_private_passenger_bucket_label: getPassengerBucketLabel(state.passengerFareKey),
      tour_private_has_guide: state.hasGuide === 'yes',
      tour_private_guide_language: state.guideLanguage || '',
      tour_private_price: state.price,
      tour_private_currency: state.currency
    };

    detail.tour_private_date = getServicesDateFieldValue();

    window.dispatchEvent(new CustomEvent('pixkuy:tours-panel-submit', { detail }));
  }

  function bindEvents() {
    catalogMount.addEventListener('click', (event) => {
      const button = event.target.closest('[data-services-tour-option]');
      if (!button) return;

      const tourId = button.getAttribute('data-services-tour-option');
      requestTourSelection(tourId);
    });

    configMount.addEventListener('click', (event) => {

    if (state.pendingTourId) return;

      const passengerButton = event.target.closest('[data-services-tours-passenger]');
      if (passengerButton) {
        state.passengerFareKey = passengerButton.getAttribute('data-services-tours-passenger') || '';
        state.passengerFareKeyAuto = false;
        renderAll();
        return;
      }

      const guideButton = event.target.closest('[data-services-tours-guide]');
      if (guideButton) {
        state.hasGuide = guideButton.getAttribute('data-services-tours-guide') || 'no';
        if (state.hasGuide !== 'yes') {
          state.guideLanguage = '';
        }
        renderAll();
        return;
      }

      const ctaButton = event.target.closest('[data-services-tours-cta]');
      if (ctaButton) {
        emitSubmit();
      }
    });

    configMount.addEventListener('input', (event) => {
      if (state.pendingTourId) return;

      const target = event.target;

      if (target.matches('[data-services-tours-pickup]')) {
        state.pickup = target.value || '';
        syncDerivedState();
        renderConfig();
        return;
      }

      if (target.matches('[data-services-tours-date]')) {
        state.tripDate = target.value || '';

        if (state.tripDate && !isServicesDateAtOrAfterMinimum(state.tripDate)) {
          state.tripDate = '';
          target.value = '';
        }

        syncDerivedState();
        syncConfigComputedUi();
        return;
      }

      if (target.matches('[data-services-tours-time]')) {
        state.tripTime = target.value || '';
        syncDerivedState();
        renderConfig();
      }
    });

    configMount.addEventListener('change', (event) => {
      if (state.pendingTourId) return;

      const target = event.target;

      if (target.matches('[data-services-tours-date]')) {
        state.tripDate = target.value || '';

        if (state.tripDate && !isServicesDateAtOrAfterMinimum(state.tripDate)) {
          state.tripDate = '';
          target.value = '';
        }

        syncDerivedState();
        syncConfigComputedUi();
      }
    });

    configMount.addEventListener('click', (event) => {
      if (state.pendingTourId) return;

      const trigger = event.target.closest('[data-services-tours-guide-language-trigger]');
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        toggleGuideLanguagePicker();
        return;
      }

      const option = event.target.closest('[data-services-tours-guide-language-option]');
      if (option) {
        state.guideLanguage = option.getAttribute('data-services-tours-guide-language-option') || '';
        renderAll();

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const priceBlock = configMount.querySelector('.services-tours-panel__price');
            if (priceBlock && typeof priceBlock.scrollIntoView === 'function') {
              priceBlock.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: 'smooth'
              });
            }
          });
        });

        return;
      }

      const clickedInsidePicker = event.target.closest('[data-services-tours-guide-language-picker]');
      if (!clickedInsidePicker) {
        closeGuideLanguagePicker();
      }
    });

    document.addEventListener('click', (event) => {
      const clickedInsidePicker = event.target.closest('[data-services-tours-guide-language-picker]');
      if (clickedInsidePicker) return;

      closeGuideLanguagePicker();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeGuideLanguagePicker();
    });
  }

  function ensureCatalogTextReady(attempt) {
    renderAll();

    const firstTitle = catalogMount.querySelector('.services-tours-panel__tour-title');
    const hasText = firstTitle && firstTitle.textContent && firstTitle.textContent.trim();

    if (!hasText && attempt < 10) {
      window.setTimeout(() => {
        ensureCatalogTextReady(attempt + 1);
      }, 80);
    }
  }

  bindEvents();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ensureCatalogTextReady(0);
    });
  });

  window.addEventListener('pageshow', () => {
    ensureCatalogTextReady(0);
  });
  
  let lastIsMobileToursCatalogLayout = isMobileToursCatalogLayout();

  window.addEventListener('resize', () => {
    const nextIsMobileToursCatalogLayout = isMobileToursCatalogLayout();

    if (nextIsMobileToursCatalogLayout !== lastIsMobileToursCatalogLayout) {
      lastIsMobileToursCatalogLayout = nextIsMobileToursCatalogLayout;
      renderAll();
      return;
    }

    placeConfigMountForCurrentLayout();
  });

  window.addEventListener('pixkuy:i18n-applied', () => {
    renderAll();
  });
})();