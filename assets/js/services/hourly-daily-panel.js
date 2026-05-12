(function () {
  const panelRoot = document.querySelector('[data-services-hourly-panel]');
  const configMount = document.querySelector('[data-services-hourly-config]');

  if (!panelRoot || !configMount) return;

  const MODES = Object.freeze({
    HOURLY: 'hourly',
    FULL_DAY: 'full_day',
    LONG_TERM: 'custom_long_term'
  });

  const VEHICLES = Object.freeze({
    executive_van: {
      id: 'executive_van',
      image: 'assets/img/fleet/bydm9_xhoras001d.jpeg',
      fallbackLabel: 'Van ejecutiva'
    }
  });

  const HOURLY_DURATION_OPTIONS = Object.freeze([
    2, 3, 4, 5, 6, 7, 8, 9, 10
  ]);

  const LONG_TERM_OPTIONS = Object.freeze([
    'week',
    'fortnight',
    'monthly',
    'custom'
  ]);

  const state = {
    mode: MODES.HOURLY,
    vehicleType: 'executive_van',
    pickup: '',
    tripDate: '',
    startTime: '',
    durationHours: 2,
    longTermOption: '',
    notes: '',
    price: null,
    currency: 'MXN'
  };
  
  let pickupControllerHandle = null;

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }
  
    let deepLinkedHourlyScrollDone = false;

  function isHourlyDailyDeepLink() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const rawService = String(params.get('service') || '').trim().toLowerCase();

      return rawService === 'hourly_daily';
    } catch (error) {
      return false;
    }
  }

  function ensureDeepLinkedHourlyPanelVisible() {
    if (!isHourlyDailyDeepLink()) return;
    if (!configMount || configMount.hidden) return;

    const configRect = configMount.getBoundingClientRect();
    const topSafeOffset = 24;
    const targetTop = Math.max(0, window.scrollY + configRect.top - topSafeOffset);

    if (Math.abs(targetTop - window.scrollY) < 4) return;

    window.scrollTo({
      top: targetTop,
      behavior: 'smooth'
    });
  }

  function applyDeepLinkedHourlyPanelScrollWhenReady(attempt, previousTop) {
    if (!isHourlyDailyDeepLink()) return;
    if (deepLinkedHourlyScrollDone) return;

    const safeAttempt = Number.isFinite(attempt) ? attempt : 0;
    const lastTop = Number.isFinite(previousTop) ? previousTop : null;

    const isReady =
      document.readyState === 'complete' &&
      panelRoot &&
      !panelRoot.hidden &&
      configMount &&
      !configMount.hidden &&
      configMount.offsetHeight > 0;

    if (!isReady) {
      if (safeAttempt >= 40) return;

      requestAnimationFrame(() => {
        applyDeepLinkedHourlyPanelScrollWhenReady(safeAttempt + 1, lastTop);
      });
      return;
    }

    const currentTop = Math.round(configMount.getBoundingClientRect().top);

    if (lastTop === null || Math.abs(currentTop - lastTop) > 1) {
      if (safeAttempt >= 40) return;

      requestAnimationFrame(() => {
        applyDeepLinkedHourlyPanelScrollWhenReady(safeAttempt + 1, currentTop);
      });
      return;
    }

    deepLinkedHourlyScrollDone = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ensureDeepLinkedHourlyPanelVisible();
      });
    });
  }

  function getLabels() {
    return {
      title: getI18nValue('services.cards.hourly.panel.title') || 'Conductor por horas / día completo',
      text: getI18nValue('services.cards.hourly.panel.text') || 'Configura modalidad, fecha y hora para ver el precio final.',
      modeLabel: getI18nValue('services.cards.hourly.panel.modeLabel') || 'Modalidad',
      pickupLabel: getI18nValue('services.cards.hourly.panel.pickupLabel') || 'Punto de recogida',
      pickupPlaceholder: getI18nValue('services.cards.hourly.panel.pickupPlaceholder') || 'Indica punto de recogida',
      vehicleLabel: getI18nValue('services.cards.hourly.panel.vehicleLabel') || 'Vehículo',
      dateLabel: getI18nValue('services.cards.hourly.panel.dateLabel') || 'Fecha',
      timeLabel: getI18nValue('services.cards.hourly.panel.timeLabel') || 'Hora de recogida',
      durationLabel: getI18nValue('services.cards.hourly.panel.durationLabel') || 'Duración',
      longTermDurationLabel: getI18nValue('services.cards.hourly.panel.longTermDurationLabel') || 'Periodo solicitado',
      notesLabel: getI18nValue('services.cards.hourly.panel.notesLabel') || 'Notas / Itinerario',
      longTermNotesLabel: getI18nValue('services.cards.hourly.panel.longTermNotesLabel') || 'Agenda / operativa',
      notesPlaceholder: getI18nValue('services.cards.hourly.panel.notesPlaceholder') || 'Añade paradas, agenda o indicaciones relevantes',
      longTermNotesPlaceholder: getI18nValue('services.cards.hourly.panel.longTermNotesPlaceholder') || 'Ej.: servicio corporativo durante 2 semanas, traslados diarios, agenda variable y disponibilidad en CDMX',
      fullDayNotesHelper: getI18nValue('services.cards.hourly.panel.fullDayNotesHelper') || 'Reserva el vehículo para una jornada completa, con tarifa fija y margen para una agenda flexible.',
      longTermNotesHelper: getI18nValue('services.cards.hourly.panel.longTermNotesHelper') || 'Indica fechas, tipo de uso, horarios aproximados, ciudad base, desplazamientos previstos y cualquier necesidad operativa relevante.',
      priceLabel: getI18nValue('services.cards.hourly.panel.priceLabel') || 'Precio final',
      fullDayPriceLabel: getI18nValue('services.cards.hourly.panel.fullDayPriceLabel') || 'Tarifa jornada',
      longTermPriceLabel: getI18nValue('services.cards.hourly.panel.longTermPriceLabel') || 'Propuesta a medida',
      longTermPriceValue: getI18nValue('services.cards.hourly.panel.longTermPriceValue') || 'Según operación',
      pricePending: getI18nValue('services.cards.hourly.panel.priceValuePending') || '—',
      cta: getI18nValue('services.cards.hourly.panel.cta') || 'Solicitar',
      ctaDisabled: getI18nValue('services.cards.hourly.panel.ctaDisabled') || 'Completa la configuración',
      tabs: {
        hourly: getI18nValue('services.cards.hourly.panel.tabs.hourly') || 'Por horas',
        fullDay: getI18nValue('services.cards.hourly.panel.tabs.fullDay') || 'Día completo',
        longTerm: getI18nValue('services.cards.hourly.panel.tabs.longTerm') || 'Planes largos'
      },
      vehicleExecutiveVan: getI18nValue('services.cards.hourly.panel.vehicles.executive_van') || 'Van ejecutiva',
      longTerm: {
        week: getI18nValue('services.cards.hourly.panel.longTerm.week') || 'Semana',
        fortnight: getI18nValue('services.cards.hourly.panel.longTerm.fortnight') || '15 días',
        monthly: getI18nValue('services.cards.hourly.panel.longTerm.monthly') || 'Mensual',
        custom: getI18nValue('services.cards.hourly.panel.longTerm.custom') || 'Otro periodo'
      },
      disclaimers: {
        includesTitle: getI18nValue('services.cards.hourly.panel.disclaimers.includesTitle') || 'Incluye',
        mobileIncludedTitle: getI18nValue('services.cards.hourly.panel.disclaimers.mobileIncludedTitle') || 'Incluido',
        supplementsTitle: getI18nValue('services.cards.hourly.panel.disclaimers.supplementsTitle') || 'Suplementos posibles',
        includesServiceKm: getI18nValue('services.cards.hourly.panel.disclaimers.includesServiceKm') || '40 km incluidos por hora contratada',
        fullDayIncludesKm: getI18nValue('services.cards.hourly.panel.disclaimers.fullDayIncludesKm') || '500 km incluidos por día',
        includesServiceWifi: getI18nValue('services.cards.hourly.panel.disclaimers.includesServiceWifi') || 'Wi-Fi propia a bordo',
        includesServiceWater: getI18nValue('services.cards.hourly.panel.disclaimers.includesServiceWater') || 'Agua y cortesías',
        includesVanPassengers: getI18nValue('services.cards.hourly.panel.disclaimers.includesVanPassengers') || 'Hasta 6 pasajeros',
        includesVanUsb: getI18nValue('services.cards.hourly.panel.disclaimers.includesVanUsb') || 'Conectores USB y USB-C',
        includesVanSeats: getI18nValue('services.cards.hourly.panel.disclaimers.includesVanSeats') || 'Asientos capitán en segunda fila con climatización independiente',
        extraHourExtension: getI18nValue('services.cards.hourly.panel.disclaimers.extraHourExtension') || 'Ampliación del servicio en bloques completos de 1 hora: 1.000 MXN',
        fullDayExtraKm: getI18nValue('services.cards.hourly.panel.disclaimers.fullDayExtraKm') || '35 MXN por km adicional a partir de 500 km',
        fullDayExtensionPolicy: getI18nValue('services.cards.hourly.panel.disclaimers.fullDayExtensionPolicy') || 'Extensiones sujetas a disponibilidad y validación operativa',
        extraKm: getI18nValue('services.cards.hourly.panel.disclaimers.extraKm') || '35 MXN por km adicional',
        outOfZone: getI18nValue('services.cards.hourly.panel.disclaimers.outOfZone') || '+4.500 MXN si finaliza fuera de la zona operativa',
        longTermApproachTitle: getI18nValue('services.cards.hourly.panel.disclaimers.longTermApproachTitle') || 'Enfoque del servicio',
        longTermApproach1: getI18nValue('services.cards.hourly.panel.disclaimers.longTermApproach1') || 'Configuración adaptada a la operación',
        longTermApproach2: getI18nValue('services.cards.hourly.panel.disclaimers.longTermApproach2') || 'Vehículo ejecutivo y conductor',
        longTermApproach3: getI18nValue('services.cards.hourly.panel.disclaimers.longTermApproach3') || 'Continuidad para agendas de varios días',
        longTermPricingTitle: getI18nValue('services.cards.hourly.panel.disclaimers.longTermPricingTitle') || 'Cómo se define la propuesta',
        longTermPricing1: getI18nValue('services.cards.hourly.panel.disclaimers.longTermPricing1') || 'Según periodo solicitado',
        longTermPricing2: getI18nValue('services.cards.hourly.panel.disclaimers.longTermPricing2') || 'Según uso previsto y cobertura',
        longTermPricing3: getI18nValue('services.cards.hourly.panel.disclaimers.longTermPricing3') || 'Según horarios, kilómetros y disponibilidad',
        longTermValidationTitle: getI18nValue('services.cards.hourly.panel.disclaimers.longTermValidationTitle') || 'Validación operativa',
        longTermValidation1: getI18nValue('services.cards.hourly.panel.disclaimers.longTermValidation1') || 'Sujeto a disponibilidad real',
        longTermValidation2: getI18nValue('services.cards.hourly.panel.disclaimers.longTermValidation2') || 'Confirmación operativa previa',
        longTermValidation3: getI18nValue('services.cards.hourly.panel.disclaimers.longTermValidation3') || 'Condiciones finales según servicio solicitado'
      }
    };
  }
  
    function destroyPickupController() {
    if (
      pickupControllerHandle &&
      typeof pickupControllerHandle.destroy === 'function'
    ) {
      pickupControllerHandle.destroy();
    }

    pickupControllerHandle = null;
  }

  function mountPickupController() {
    const pickupApi = window.PixkuyServicesHourlyDailyPickup;
    const root = configMount.querySelector('[data-services-hourly-pickup-root]');
    const input = configMount.querySelector('[data-place-input="hourly_daily_pickup"]');
    const mountNode = configMount.querySelector('[data-place-mount="hourly_daily_pickup"]');

    destroyPickupController();

    if (
      !pickupApi ||
      typeof pickupApi.mount !== 'function' ||
      !root ||
      !input ||
      !mountNode
    ) {
      return false;
    }

    pickupControllerHandle = pickupApi.mount({
      root: root,
      input: input,
      mountNode: mountNode,
      onManualInput: function (value) {
        state.pickup = typeof value === 'string' ? value : '';
        syncDerivedState();
        syncLiveFieldValues();
      },
      onPlaceSelected: function (selectedPlace) {
        state.pickup = normalizeText(
          selectedPlace &&
          (selectedPlace.label || selectedPlace.formattedAddress || selectedPlace.displayName)
        );
        syncDerivedState();
        syncLiveFieldValues();
      },
      onClearSelection: function () {
        state.pickup = '';
        syncDerivedState();
        syncLiveFieldValues();
      },
      onError: function () {}
    });

    return Boolean(pickupControllerHandle);
  }

  function getTemporalPricingApi() {
    const api = window.PixkuyHourlyDailyTemporalPricing;
    return api && typeof api === 'object' ? api : null;
  }

  function shouldShowDateFieldInServices() {
    const api = getTemporalPricingApi();

    if (!api || typeof api.shouldShowDateFieldInServices !== 'function') {
      return false;
    }

    return api.shouldShowDateFieldInServices();
  }

  function applyTemporalPricing(basePrice, serviceDateLiteral) {
    const api = getTemporalPricingApi();

    if (!api || typeof api.applyTemporalPricing !== 'function') {
      return basePrice;
    }

    return api.applyTemporalPricing(basePrice, serviceDateLiteral);
  }

  function getReservationMinimumDateLiteral() {
    const formsApi = window.PixkuyForms || {};
    const getMinimumDateTime =
      typeof formsApi.getReservationMinimumDateTime === 'function'
        ? formsApi.getReservationMinimumDateTime
        : null;
    const formatDate =
      typeof formsApi.formatReservationDateForInput === 'function'
        ? formsApi.formatReservationDateForInput
        : null;
    const minimumDateTime = getMinimumDateTime
      ? getMinimumDateTime()
      : null;

    if (!minimumDateTime || !formatDate) {
      return '';
    }

    return String(formatDate(minimumDateTime) || '').trim();
  }

  function isServicesDateAtOrAfterMinimum(dateLiteral) {
    const safeDate = normalizeText(dateLiteral);
    const minimumDateLiteral = getReservationMinimumDateLiteral();

    if (!safeDate || !minimumDateLiteral) {
      return false;
    }

    return safeDate >= minimumDateLiteral;
  }

  function getBasePrice() {
    if (state.mode === MODES.HOURLY) {
      if (state.durationHours <= 2) {
        return 3500;
      }

      return 3500 + ((state.durationHours - 2) * 1000);
    }

    if (state.mode === MODES.FULL_DAY) {
      return 12500;
    }

    return null;
  }

  function getComputedPrice() {
    const basePrice = getBasePrice();
    const serviceDateLiteral = normalizeText(state.tripDate);

    if (typeof basePrice !== 'number') {
      return null;
    }

    if (shouldShowDateFieldInServices() && !serviceDateLiteral) {
      return null;
    }

    if (shouldShowDateFieldInServices() && !isServicesDateAtOrAfterMinimum(serviceDateLiteral)) {
      return null;
    }

    return applyTemporalPricing(basePrice, serviceDateLiteral);
  }

  function syncDerivedState() {
    if (state.mode === MODES.FULL_DAY) {
      state.durationHours = 12;
      state.longTermOption = '';
    }

    if (state.mode === MODES.LONG_TERM) {
      state.price = null;
      return;
    }

    state.price = getComputedPrice();
  }

  function isConfigComplete() {
    if (!normalizeText(state.pickup)) return false;
    if (shouldShowDateFieldInServices() && !normalizeText(state.tripDate)) return false;
    if (!normalizeText(state.startTime)) return false;

    if (state.mode === MODES.HOURLY) {
      return typeof state.price === 'number' && HOURLY_DURATION_OPTIONS.indexOf(state.durationHours) >= 0;
    }

    if (state.mode === MODES.FULL_DAY) {
      return typeof state.price === 'number';
    }

    return Boolean(state.longTermOption);
  }
  
    function getHourlyAnalyticsSurface() {
    const isMobileRoute = Boolean(
      document.body &&
        document.body.getAttribute('data-hourly-mobile-screen') === 'true' &&
        isMobileHourlyViewport()
    );

    return isMobileRoute ? 'mobile_route' : 'desktop_panel';
  }
  
    function trackHourlyContinueClick() {
    const analytics = window.PixkuyAnalytics;

    if (
      !analytics ||
      typeof analytics.track !== 'function' ||
      !isConfigComplete()
    ) {
      return false;
    }

    return analytics.track('pixkuy_continue_click', {
      service_type: 'hourly_daily',
      flow_surface: getHourlyAnalyticsSurface(),
      mode: state.mode,
      duration_hours: state.mode === MODES.HOURLY || state.mode === MODES.FULL_DAY
        ? String(state.durationHours)
        : '',
      price: typeof state.price === 'number' ? state.price : '',
      currency: state.currency || 'MXN'
    });
  }

  function trackHourlyQuoteReady() {
    const analytics = window.PixkuyAnalytics;
    const dedupeKey = [
      'hourly_daily',
      getHourlyAnalyticsSurface(),
      state.mode,
      state.mode === MODES.HOURLY || state.mode === MODES.FULL_DAY
        ? String(state.durationHours)
        : '',
      state.price,
      state.currency || 'MXN'
    ].join('|');

    if (
      !analytics ||
      typeof analytics.trackOnce !== 'function' ||
      !isConfigComplete() ||
      typeof state.price !== 'number'
    ) {
      return false;
    }

    return analytics.trackOnce('pixkuy_quote_ready', {
      service_type: 'hourly_daily',
      flow_surface: getHourlyAnalyticsSurface(),
      mode: state.mode,
      duration_hours: state.mode === MODES.HOURLY || state.mode === MODES.FULL_DAY
        ? String(state.durationHours)
        : '',
      price: state.price,
      currency: state.currency || 'MXN'
    }, dedupeKey);
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

  function buildModeTabsMarkup(labels) {
    return `
      <div class="services-hourly-panel__tabs" role="tablist" aria-label="${labels.modeLabel}">
        <button
          type="button"
          class="services-hourly-panel__tab${state.mode === MODES.HOURLY ? ' is-active' : ''}"
          data-services-hourly-mode="${MODES.HOURLY}"
          aria-pressed="${state.mode === MODES.HOURLY ? 'true' : 'false'}"
        >${labels.tabs.hourly}</button>

        <button
          type="button"
          class="services-hourly-panel__tab${state.mode === MODES.FULL_DAY ? ' is-active' : ''}"
          data-services-hourly-mode="${MODES.FULL_DAY}"
          aria-pressed="${state.mode === MODES.FULL_DAY ? 'true' : 'false'}"
        >${labels.tabs.fullDay}</button>

        <button
          type="button"
          class="services-hourly-panel__tab${state.mode === MODES.LONG_TERM ? ' is-active' : ''}"
          data-services-hourly-mode="${MODES.LONG_TERM}"
          aria-pressed="${state.mode === MODES.LONG_TERM ? 'true' : 'false'}"
        >${labels.tabs.longTerm}</button>
      </div>
    `;
  }

  function buildDurationChipMarkup(hours) {
    const isSelected = state.durationHours === hours;
    const isFullWidth = hours === 10;

    return `
      <button
        type="button"
        class="services-hourly-panel__chip${isSelected ? ' is-active' : ''}${isFullWidth ? ' services-hourly-panel__chip--full' : ''}"
        data-services-hourly-duration="${hours}"
        aria-pressed="${isSelected ? 'true' : 'false'}"
      >${hours}h</button>
    `;
  }

  function buildDurationOptionsMarkup() {
    if (isMobileHourlyViewport()) {
      const firstRow = [2, 3, 4, 5, 6, 7];
      const secondRow = [8, 9, 10];

      return `
        <div class="services-hourly-panel__duration-rows">
          <div class="services-hourly-panel__duration-row services-hourly-panel__duration-row--six">
            ${firstRow.map(buildDurationChipMarkup).join('')}
          </div>
          <div class="services-hourly-panel__duration-row services-hourly-panel__duration-row--three-centered">
            ${secondRow.map(buildDurationChipMarkup).join('')}
          </div>
        </div>
      `;
    }

    const firstRow = [2, 3, 4, 5];
    const secondRow = [6, 7, 8, 9];
    const thirdRow = [10];

    return `
      <div class="services-hourly-panel__duration-rows">
        <div class="services-hourly-panel__duration-row services-hourly-panel__duration-row--four">
          ${firstRow.map(buildDurationChipMarkup).join('')}
        </div>
        <div class="services-hourly-panel__duration-row services-hourly-panel__duration-row--four">
          ${secondRow.map(buildDurationChipMarkup).join('')}
        </div>
        <div class="services-hourly-panel__duration-row services-hourly-panel__duration-row--single">
          ${thirdRow.map(buildDurationChipMarkup).join('')}
        </div>
      </div>
    `;
  }

  function buildLongTermOptionsMarkup(labels) {
    return LONG_TERM_OPTIONS.map((option) => {
      const isSelected = state.longTermOption === option;

      return `
        <button
          type="button"
          class="services-hourly-panel__chip${isSelected ? ' is-active' : ''}"
          data-services-hourly-long-term="${option}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
        >${labels.longTerm[option]}</button>
      `;
    }).join('');
  }
  
    function isMobileHourlyViewport() {
    return window.innerWidth <= 720;
  }

  function isMobileCompactViewport() {
    return window.innerWidth <= 720;
  }

  function isMobileModeSwitchWithoutRemount(nextMode) {
    if (!isMobileCompactViewport()) {
      return false;
    }

    const currentMode = state.mode;
    const allowedModes = [MODES.HOURLY, MODES.FULL_DAY, MODES.LONG_TERM];

    return (
      allowedModes.indexOf(currentMode) >= 0 &&
      allowedModes.indexOf(nextMode) >= 0 &&
      currentMode !== nextMode
    );
  }

  function syncModeTabsUi() {
    const modeButtons = configMount.querySelectorAll('[data-services-hourly-mode]');

    modeButtons.forEach((button) => {
      const buttonMode = normalizeText(button.getAttribute('data-services-hourly-mode'));
      const isActive = buttonMode === state.mode;

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function syncPriceAndCtaUi() {
    const labels = getLabels();
    const priceValue = configMount.querySelector('.services-hourly-panel__price-value');
    const priceLabel = configMount.querySelector('.services-hourly-panel__price-label');
    const ctaButton = configMount.querySelector('[data-services-hourly-cta]');
    const ctaDisabled = !isConfigComplete();
    const priceText = formatCurrency(state.price, state.currency);
    const priceLabelText = state.mode === MODES.FULL_DAY
      ? labels.fullDayPriceLabel
      : labels.priceLabel;

    if (priceValue) {
      priceValue.textContent = priceText;
    }

    if (priceLabel) {
      priceLabel.textContent = priceLabelText;
    }

    if (ctaButton) {
      ctaButton.disabled = ctaDisabled;
      ctaButton.setAttribute('aria-disabled', ctaDisabled ? 'true' : 'false');
      ctaButton.textContent = ctaDisabled ? labels.ctaDisabled : labels.cta;
    }
  }

  function buildMobileModeSpecificMarkup(labels) {
    if (state.mode === MODES.FULL_DAY) {
      return '';
    }

    if (state.mode === MODES.LONG_TERM) {
      return `
        <div class="services-hourly-panel__field services-hourly-panel__field--long-term">
          <span class="services-hourly-panel__label">${labels.longTermDurationLabel}</span>
          <div class="services-hourly-panel__chips">
            ${buildLongTermOptionsMarkup(labels)}
          </div>
        </div>
      `;
    }

    return `
      <div class="services-hourly-panel__field services-hourly-panel__field--duration">
        <span class="services-hourly-panel__label">${labels.durationLabel}</span>
        <div class="services-hourly-panel__chips">
          ${buildDurationOptionsMarkup()}
        </div>
      </div>
    `;
  }

  function buildMobileNotesHelperMarkup(labels) {
    if (state.mode === MODES.FULL_DAY) {
      return `<p class="services-hourly-panel__notes-helper">${labels.fullDayNotesHelper}</p>`;
    }

    if (state.mode === MODES.LONG_TERM) {
      return `<p class="services-hourly-panel__notes-helper">${labels.longTermNotesHelper}</p>`;
    }

    return '';
  }

  function syncMobileCompactModeUi() {
    const labels = getLabels();
    const modeHost = configMount.querySelector('.services-hourly-panel__row--mobile-duration[data-services-hourly-mobile-mode-host]');
    const notesLabel = configMount.querySelector('[data-services-hourly-mobile-notes-label]');
    const notesHelperHost = configMount.querySelector('[data-services-hourly-mobile-notes-helper]');
    const notesInput = configMount.querySelector('[data-services-hourly-notes]');
    const metaHost = configMount.querySelector('[data-services-hourly-mobile-meta-host]');

    syncDerivedState();
    configMount.setAttribute('data-services-hourly-mode-active', state.mode);
    syncModeTabsUi();

    if (modeHost) {
      modeHost.innerHTML = buildMobileModeSpecificMarkup(labels);
    }

    if (notesLabel) {
      notesLabel.textContent = state.mode === MODES.LONG_TERM
        ? labels.longTermNotesLabel
        : labels.notesLabel;
    }

    if (notesHelperHost) {
      notesHelperHost.innerHTML = buildMobileNotesHelperMarkup(labels);
    }

    if (notesInput) {
      notesInput.setAttribute(
        'placeholder',
        state.mode === MODES.LONG_TERM
          ? labels.longTermNotesPlaceholder
          : labels.notesPlaceholder
      );
    }

    if (metaHost) {
      metaHost.innerHTML = buildDisclaimersMarkup(labels);
    }

    syncPriceAndCtaUi();
    syncLiveFieldValues();
  }

  function buildMobileCompactMarkup(labels, vehicle, priceLabelText, priceText, ctaDisabled, minimumDateLiteral, showDateField) {
  return `
    <div class="services-hourly-panel__config-head">
      ${buildModeTabsMarkup(labels)}
    </div>

    <div class="services-hourly-panel__layout services-hourly-panel__layout--mobile-hourly">
      <div class="services-hourly-panel__row services-hourly-panel__row--mobile-hero">
        <div class="services-hourly-panel__field services-hourly-panel__field--vehicle services-hourly-panel__field--vehicle-mobile">
          <label class="services-hourly-panel__label">${labels.vehicleLabel}</label>
          <div class="services-hourly-panel__vehicle" id="services-hourly-vehicle-mobile">
            <div class="services-hourly-panel__vehicle-media">
              <img
                class="services-hourly-panel__vehicle-image"
                src="${vehicle.image}"
                alt="${labels.vehicleExecutiveVan}"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div class="services-hourly-panel__vehicle-copy">
              <strong class="services-hourly-panel__vehicle-name">${labels.vehicleExecutiveVan}</strong>
            </div>
          </div>
        </div>

        <div class="services-hourly-panel__field services-hourly-panel__field--pickup services-hourly-panel__field--pickup-mobile">
          ${window.PixkuyServicesHourlyDailyPickup && typeof window.PixkuyServicesHourlyDailyPickup.buildPickupMarkup === 'function'
            ? window.PixkuyServicesHourlyDailyPickup.buildPickupMarkup({
                inputId: 'services-hourly-pickup',
                label: labels.pickupLabel,
                placeholder: labels.pickupPlaceholder,
                value: state.pickup
              })
            : ''}
        </div>

        ${showDateField ? `
          <div class="services-hourly-panel__field services-hourly-panel__field--date services-hourly-panel__field--date-mobile">
            <label class="services-hourly-panel__label" for="services-hourly-date">${labels.dateLabel}</label>
            <div class="services-hourly-panel__date-wrap">
              <input
                id="services-hourly-date"
                type="date"
                class="services-hourly-panel__control"
                data-services-hourly-date
                value="${state.tripDate.replace(/"/g, '&quot;')}"
                ${minimumDateLiteral ? `min="${minimumDateLiteral}"` : ''}
              />
              <span
                class="services-hourly-panel__date-overlay"
                aria-hidden="true"
                ${state.tripDate ? 'hidden' : ''}
              >dd/mm/aaaa</span>
              <span class="services-hourly-panel__date-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>
                  <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>
                  <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>
                </svg>
              </span>
            </div>
          </div>
        ` : ''}

        <div class="services-hourly-panel__field services-hourly-panel__field--time services-hourly-panel__field--time-mobile">
          <label class="services-hourly-panel__label" for="services-hourly-time">${labels.timeLabel}</label>
          <div class="services-hourly-panel__date-wrap">
            <input
              id="services-hourly-time"
              type="time"
              class="services-hourly-panel__control"
              data-services-hourly-time
              value="${state.startTime.replace(/"/g, '&quot;')}"
            />
            <span
              class="services-hourly-panel__date-overlay services-hourly-panel__time-overlay"
              aria-hidden="true"
              ${state.startTime ? 'hidden' : ''}
            >--:--</span>
            <span class="services-hourly-panel__date-icon services-hourly-panel__time-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>
                <polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div
        class="services-hourly-panel__row services-hourly-panel__row--mobile-duration"
        data-services-hourly-mobile-mode-host
      >
        ${buildMobileModeSpecificMarkup(labels)}
      </div>

      <div class="services-hourly-panel__row services-hourly-panel__row--mobile-notes">
        <div class="services-hourly-panel__field services-hourly-panel__field--notes">
          <label
            class="services-hourly-panel__label"
            for="services-hourly-notes"
            data-services-hourly-mobile-notes-label
          >${labels.notesLabel}</label>
          <div data-services-hourly-mobile-notes-helper>
            ${buildMobileNotesHelperMarkup(labels)}
          </div>
          <textarea
            id="services-hourly-notes"
            class="services-hourly-panel__control services-hourly-panel__control--textarea"
            data-services-hourly-notes
            rows="4"
            placeholder="${labels.notesPlaceholder.replace(/"/g, '&quot;')}"
          >${state.notes}</textarea>
        </div>
      </div>

      <div class="services-hourly-panel__row services-hourly-panel__row--mobile-meta">
        <div class="services-hourly-panel__meta" data-services-hourly-mobile-meta-host>
          ${buildDisclaimersMarkup(labels)}
        </div>
      </div>

      <div class="services-hourly-panel__row services-hourly-panel__row--mobile-footer-spacer">
        <div class="services-hourly-panel__price services-hourly-panel__price--inline">
          <p class="services-hourly-panel__price-label">${priceLabelText}</p>
          <strong class="services-hourly-panel__price-value">${priceText}</strong>
        </div>

        <button
          type="button"
          class="services-hourly-panel__cta services-hourly-panel__cta--full"
          data-services-hourly-cta
          ${ctaDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          ${ctaDisabled ? labels.ctaDisabled : labels.cta}
        </button>
      </div>
    </div>
  `;
}

  function buildDisclaimersMarkup(labels) {
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

    const includesTitle = isMobileHourlyViewport()
      ? labels.disclaimers.mobileIncludedTitle
      : labels.disclaimers.includesTitle;

    return `
      <div class="services-hourly-panel__disclaimers-groups">
        <section class="services-hourly-panel__disclaimer-group services-hourly-panel__disclaimer-group--includes-wide">
          <h4 class="services-hourly-panel__disclaimer-title">${includesTitle}</h4>

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

  function buildConfigMarkup() {
  const labels = getLabels();
  const vehicle = VEHICLES[state.vehicleType];
  const priceText = state.mode === MODES.LONG_TERM
    ? labels.longTermPriceValue
    : formatCurrency(state.price, state.currency);
  const priceLabelText = state.mode === MODES.LONG_TERM
    ? labels.longTermPriceLabel
    : (state.mode === MODES.FULL_DAY ? labels.fullDayPriceLabel : labels.priceLabel);
  const ctaDisabled = !isConfigComplete();
  const minimumDateLiteral = getReservationMinimumDateLiteral();
  const showDateField = shouldShowDateFieldInServices();

    if (
    isMobileHourlyViewport() &&
    [MODES.HOURLY, MODES.FULL_DAY, MODES.LONG_TERM].indexOf(state.mode) >= 0
  ) {
    return buildMobileCompactMarkup(
      labels,
      vehicle,
      priceLabelText,
      priceText,
      ctaDisabled,
      minimumDateLiteral,
      showDateField
    );
  }

  return `
      <div class="services-hourly-panel__config-head">
        ${buildModeTabsMarkup(labels)}
      </div>

      <div class="services-hourly-panel__layout">
        <div class="services-hourly-panel__row services-hourly-panel__row--top">
          <div class="services-hourly-panel__field services-hourly-panel__field--pickup">
            ${window.PixkuyServicesHourlyDailyPickup && typeof window.PixkuyServicesHourlyDailyPickup.buildPickupMarkup === 'function'
              ? window.PixkuyServicesHourlyDailyPickup.buildPickupMarkup({
                  inputId: 'services-hourly-pickup',
                  label: labels.pickupLabel,
                  placeholder: labels.pickupPlaceholder,
                  value: state.pickup
                })
              : ''}
          </div>

          <div class="services-hourly-panel__field services-hourly-panel__field--vehicle">
            <label class="services-hourly-panel__label" for="services-hourly-vehicle">${labels.vehicleLabel}</label>
            <div class="services-hourly-panel__vehicle" id="services-hourly-vehicle">
              <div class="services-hourly-panel__vehicle-media">
                <img
                  class="services-hourly-panel__vehicle-image"
                  src="${vehicle.image}"
                  alt="${labels.vehicleExecutiveVan}"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="services-hourly-panel__vehicle-copy">
                <strong class="services-hourly-panel__vehicle-name">${labels.vehicleExecutiveVan}</strong>
              </div>
            </div>
          </div>

          ${showDateField ? `
            <div class="services-hourly-panel__field services-hourly-panel__field--date">
              <label class="services-hourly-panel__label" for="services-hourly-date">${labels.dateLabel}</label>
              <div class="services-hourly-panel__date-wrap">
                <input
                  id="services-hourly-date"
                  type="date"
                  class="services-hourly-panel__control"
                  data-services-hourly-date
                  value="${state.tripDate.replace(/"/g, '&quot;')}"
                  ${minimumDateLiteral ? `min="${minimumDateLiteral}"` : ''}
                />
                <span
                  class="services-hourly-panel__date-overlay"
                  aria-hidden="true"
                  ${state.tripDate ? 'hidden' : ''}
                >dd/mm/aaaa</span>
                <span class="services-hourly-panel__date-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>
                    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>
                    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>
                  </svg>
                </span>
              </div>
            </div>
          ` : ''}

          <div class="services-hourly-panel__field services-hourly-panel__field--time">
            <label class="services-hourly-panel__label" for="services-hourly-time">${labels.timeLabel}</label>
            <div class="services-hourly-panel__date-wrap">
              <input
                id="services-hourly-time"
                type="time"
                class="services-hourly-panel__control"
                data-services-hourly-time
                value="${state.startTime.replace(/"/g, '&quot;')}"
              />
              <span
                class="services-hourly-panel__date-overlay services-hourly-panel__time-overlay"
                aria-hidden="true"
                ${state.startTime ? 'hidden' : ''}
              >--:--</span>
              <span class="services-hourly-panel__date-icon services-hourly-panel__time-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>
                  <polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
              </span>
            </div>
          </div>

          <div class="services-hourly-panel__price services-hourly-panel__price--inline">
            <p class="services-hourly-panel__price-label">${priceLabelText}</p>
            <strong class="services-hourly-panel__price-value">${priceText}</strong>
          </div>
        </div>

        <div class="services-hourly-panel__row services-hourly-panel__row--middle">
          ${state.mode === MODES.HOURLY ? `
            <div class="services-hourly-panel__field services-hourly-panel__field--duration">
              <span class="services-hourly-panel__label">${labels.durationLabel}</span>
              <div class="services-hourly-panel__chips">
                ${buildDurationOptionsMarkup()}
              </div>
            </div>
          ` : ''}

          ${state.mode === MODES.LONG_TERM ? `
            <div class="services-hourly-panel__field services-hourly-panel__field--long-term">
              <span class="services-hourly-panel__label">${labels.longTermDurationLabel}</span>
              <div class="services-hourly-panel__chips">
                ${buildLongTermOptionsMarkup(labels)}
              </div>
            </div>
          ` : ''}

          <div class="services-hourly-panel__field services-hourly-panel__field--notes">
            <label class="services-hourly-panel__label" for="services-hourly-notes">${state.mode === MODES.LONG_TERM ? labels.longTermNotesLabel : labels.notesLabel}</label>
            ${state.mode === MODES.FULL_DAY ? `
              <p class="services-hourly-panel__notes-helper">${labels.fullDayNotesHelper}</p>
            ` : ''}
            ${state.mode === MODES.LONG_TERM ? `
              <p class="services-hourly-panel__notes-helper">${labels.longTermNotesHelper}</p>
            ` : ''}
            <textarea
              id="services-hourly-notes"
              class="services-hourly-panel__control services-hourly-panel__control--textarea"
              data-services-hourly-notes
              rows="4"
              placeholder="${(state.mode === MODES.LONG_TERM ? labels.longTermNotesPlaceholder : labels.notesPlaceholder).replace(/"/g, '&quot;')}"
            >${state.notes}</textarea>
          </div>
        </div>

        <div class="services-hourly-panel__row services-hourly-panel__row--bottom">
          <div class="services-hourly-panel__meta">
            ${buildDisclaimersMarkup(labels)}
          </div>
        </div>

        <div class="services-hourly-panel__row services-hourly-panel__row--cta">
          <button
            type="button"
            class="services-hourly-panel__cta services-hourly-panel__cta--full"
            data-services-hourly-cta
            ${ctaDisabled ? 'disabled aria-disabled="true"' : ''}
          >
            ${ctaDisabled ? labels.ctaDisabled : labels.cta}
          </button>
        </div>
      </div>
    `;
}

  function renderConfig() {
    syncDerivedState();
    configMount.hidden = false;
    configMount.setAttribute('data-services-hourly-mode-active', state.mode);
    configMount.innerHTML = buildConfigMarkup();
    mountPickupController();
    trackHourlyQuoteReady();
  }

  function renderAll() {
    renderConfig();
    window.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-panel-ui-sync'));
  }

  function syncHourlyDurationSelectionUi() {
    const durationButtons = configMount.querySelectorAll('[data-services-hourly-duration]');

    durationButtons.forEach((button) => {
      const buttonDuration = Number(button.getAttribute('data-services-hourly-duration'));
      const isActive = buttonDuration === state.durationHours;

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  
  function syncLongTermSelectionUi() {
    const longTermButtons = configMount.querySelectorAll('[data-services-hourly-long-term]');

    longTermButtons.forEach((button) => {
      const buttonOption = normalizeText(button.getAttribute('data-services-hourly-long-term'));
      const isActive = buttonOption === state.longTermOption;

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  
    function syncLiveFieldValues() {
    const pickupInput = configMount.querySelector('[data-services-hourly-pickup]');
    const dateInput = configMount.querySelector('[data-services-hourly-date]');
    const timeInput = configMount.querySelector('[data-services-hourly-time]');
    const notesInput = configMount.querySelector('[data-services-hourly-notes]');
    const dateOverlay = configMount.querySelector('.services-hourly-panel__field--date .services-hourly-panel__date-overlay');
    const timeOverlay = configMount.querySelector('.services-hourly-panel__field--time .services-hourly-panel__time-overlay');
    const priceValue = configMount.querySelector('.services-hourly-panel__price-value');
    const ctaButton = configMount.querySelector('[data-services-hourly-cta]');
    const labels = getLabels();
    const ctaDisabled = !isConfigComplete();
    const priceText = state.mode === MODES.LONG_TERM
      ? labels.longTermPriceValue
      : formatCurrency(state.price, state.currency);

    if (pickupInput && pickupInput.value !== state.pickup) {
      pickupInput.value = state.pickup;
    }

    if (dateInput && dateInput.value !== state.tripDate) {
      dateInput.value = state.tripDate;
    }

    if (timeInput && timeInput.value !== state.startTime) {
      timeInput.value = state.startTime;
    }

    if (dateOverlay) {
      dateOverlay.hidden = Boolean(state.tripDate);
    }

    if (timeOverlay) {
      timeOverlay.hidden = Boolean(state.startTime);
    }

    if (notesInput && notesInput.value !== state.notes) {
      notesInput.value = state.notes;
    }

    if (priceValue) {
      priceValue.textContent = priceText;
    }

    if (ctaButton) {
      ctaButton.disabled = ctaDisabled;
      ctaButton.setAttribute('aria-disabled', ctaDisabled ? 'true' : 'false');
      ctaButton.textContent = ctaDisabled ? labels.ctaDisabled : labels.cta;
    }

    trackHourlyQuoteReady();

    window.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-panel-ui-sync'));
  }

  function bindEvents() {
    if (panelRoot.dataset.servicesHourlyPanelBound === '1') {
      return false;
    }

    panelRoot.dataset.servicesHourlyPanelBound = '1';

    configMount.addEventListener('click', (event) => {
      const modeButton = event.target.closest('[data-services-hourly-mode]');
      if (modeButton) {
        const nextMode = normalizeText(modeButton.getAttribute('data-services-hourly-mode')) || MODES.HOURLY;
        const shouldSyncWithoutRemount = isMobileModeSwitchWithoutRemount(nextMode);

        state.mode = nextMode;

        if (state.mode === MODES.HOURLY && HOURLY_DURATION_OPTIONS.indexOf(state.durationHours) === -1) {
          state.durationHours = 2;
        }

        if (state.mode !== MODES.LONG_TERM) {
          state.longTermOption = '';
        }

        if (shouldSyncWithoutRemount) {
          syncMobileCompactModeUi();
          return;
        }

        renderAll();
        return;
      }

      const durationButton = event.target.closest('[data-services-hourly-duration]');
      if (durationButton) {
        const nextDuration = Number(durationButton.getAttribute('data-services-hourly-duration'));

        if (HOURLY_DURATION_OPTIONS.indexOf(nextDuration) === -1) {
          return;
        }

        state.durationHours = nextDuration;

        if (isMobileHourlyViewport() && state.mode === MODES.HOURLY) {
          syncDerivedState();
          syncHourlyDurationSelectionUi();
          syncLiveFieldValues();
        } else {
          renderAll();
        }

        return;
      }

      const longTermButton = event.target.closest('[data-services-hourly-long-term]');
      if (longTermButton) {
        const nextLongTerm = normalizeText(longTermButton.getAttribute('data-services-hourly-long-term'));

        if (LONG_TERM_OPTIONS.indexOf(nextLongTerm) === -1) {
          return;
        }

        state.longTermOption = nextLongTerm;

        if (isMobileHourlyViewport() && state.mode === MODES.LONG_TERM) {
          syncDerivedState();
          syncLongTermSelectionUi();
          syncLiveFieldValues();
        } else {
          renderAll();
        }

        return;
      }

      const ctaButton = event.target.closest('[data-services-hourly-cta]');
      if (ctaButton && !ctaButton.disabled) {
        trackHourlyContinueClick();

        window.dispatchEvent(new CustomEvent('pixkuy:hourly-daily-panel-submit', {
          detail: {
            serviceType: 'hourly_daily',
            hourly_daily_mode: state.mode,
            hourly_daily_vehicle_type: state.vehicleType,
            hourly_daily_pickup: state.pickup,
            hourly_daily_date: state.tripDate,
            hourly_daily_start_time: state.startTime,
            hourly_daily_duration_hours: state.mode === MODES.HOURLY || state.mode === MODES.FULL_DAY
              ? String(state.durationHours)
              : '',
            hourly_daily_custom_term: state.mode === MODES.LONG_TERM
              ? state.longTermOption
              : '',
            hourly_daily_notes: state.notes,
            hourly_daily_price: typeof state.price === 'number' ? state.price : '',
            hourly_daily_currency: state.currency,
            hourly_daily_km_included:
  state.mode === MODES.LONG_TERM
    ? ''
    : (
        state.mode === MODES.FULL_DAY
          ? '500'
          : String((state.durationHours || 0) * 40)
      ),
            hourly_daily_extra_km_price: '35',
            hourly_daily_out_of_zone_supplement: '4500'
          }
        }));
      }
    });

    configMount.addEventListener('input', (event) => {
      const target = event.target;

      if (target.matches('[data-services-hourly-date]')) {
        state.tripDate = target.value || '';

        if (state.tripDate && !isServicesDateAtOrAfterMinimum(state.tripDate)) {
          state.tripDate = '';
          target.value = '';
        }

        syncDerivedState();
        syncLiveFieldValues();
        return;
      }

      if (target.matches('[data-services-hourly-time]')) {
        state.startTime = target.value || '';
        syncDerivedState();
        syncLiveFieldValues();
        return;
      }

      if (target.matches('[data-services-hourly-notes]')) {
        state.notes = target.value || '';
        syncDerivedState();
        syncLiveFieldValues();
      }
    });

    configMount.addEventListener('change', (event) => {
      const target = event.target;

      if (target.matches('[data-services-hourly-date]')) {
        state.tripDate = target.value || '';

        if (state.tripDate && !isServicesDateAtOrAfterMinimum(state.tripDate)) {
          state.tripDate = '';
          target.value = '';
        }

        syncDerivedState();
        syncLiveFieldValues();
      }
    });

    return true;
  }

  bindEvents();
  renderAll();

  if (document.readyState === 'complete') {
    applyDeepLinkedHourlyPanelScrollWhenReady(0, null);
  } else {
    window.addEventListener('load', () => {
      applyDeepLinkedHourlyPanelScrollWhenReady(0, null);
    }, { once: true });
  }

  window.addEventListener('pageshow', () => {
    deepLinkedHourlyScrollDone = false;
    applyDeepLinkedHourlyPanelScrollWhenReady(0, null);
  });

  window.addEventListener('pixkuy:i18n-applied', () => {
    renderAll();
    deepLinkedHourlyScrollDone = false;
    applyDeepLinkedHourlyPanelScrollWhenReady(0, null);
  });
})();