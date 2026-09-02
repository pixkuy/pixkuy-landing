/* assets/js/services/direct-transfer-mobile-config-step.js
   Direct transfer mobile config step.
   Responsabilidad:
   - mostrar la pantalla móvil de configuración de direct_transfer
   - capturar origen, destino, fecha, hora y pasajeros
   - recibir selección de direcciones desde sheet propia
   - validar que origen y destino no sean iguales
   - solicitar quote real server-side
   - mostrar vehículo BYD M9 fijo y precio real
   - abrir Contact Step móvil propio cuando el quote está listo
   - no enviar Netlify directamente desde Config Step
*/

(function initDirectTransferMobileConfigStep(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const CONFIG_STEP_SELECTOR = "[data-direct-transfer-mobile-config-step]";
  const CONFIG_BACK_SELECTOR = "[data-direct-transfer-mobile-config-back]";
  const CONFIG_FIELD_SELECTOR = "[data-direct-transfer-mobile-config-field]";
  const CONFIG_ADDRESS_CLEAR_SELECTOR = "[data-direct-transfer-mobile-address-clear]";
  const CONFIG_CTA_SELECTOR = "[data-direct-transfer-mobile-config-cta]";
  const SAME_ROUTE_ERROR_SELECTOR = "[data-direct-transfer-mobile-same-route-error]";
  const RESTRICTION_NOTICE_SELECTOR = "[data-direct-transfer-mobile-restriction-notice]";
  const FARE_SELECTOR = "[data-direct-transfer-mobile-fare]";
  const FARE_VALUE_SELECTOR = "[data-direct-transfer-mobile-fare-value]";
  const ESTIMATE_SELECTOR = "[data-direct-transfer-mobile-estimate]";
  const ESTIMATE_DISTANCE_SELECTOR = "[data-direct-transfer-mobile-estimate-distance]";
  const ESTIMATE_DURATION_SELECTOR = "[data-direct-transfer-mobile-estimate-duration]";

  const BODY_CONFIG_ATTR = "data-direct-transfer-mobile-config-screen";

  const PASSENGER_BUCKETS = ["van_1_2", "van_3_4", "van_5_6"];

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let stepNode = null;
  let parentRoute = null;
  let quoteRequestId = 0;
  let quoteTimer = 0;
  let activeCanonicalContextKey = "";
  let continueBusy = false;

  let state = {
    origin: "",
    originPlace: null,
    originCoverage: null,
    destination: "",
    destinationPlace: null,
    destinationCoverage: null,
    date: "",
    time: "",
    passengerFareKey: "van_1_2",
    quoteStatus: "pending",
    quote: null,
    quoteState: "none",
    quoteErrorCode: "",
    quoteErrorMessage: "",
    nextAvailableStartLocal: "",
    precheckAllowed: false,
    quoteReviewRequired: false
  };

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeLocationComparisonValue(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
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

  function getQuoteApi() {
    const api = window.PixkuyDirectTransferQuote;

    return api && typeof api === "object" ? api : null;
  }

  function getTransactionalStateApi() {
    const api = window.PixkuyDirectTransferTransactionalState;

    return api && typeof api === "object" ? api : null;
  }

  function getContactStepApi() {
    const api = window.PixkuyDirectTransferMobileContactStep;

    return api && typeof api === "object" ? api : null;
  }
  
  
  function getDirectTransferCoverageApi() {
    const api = window.PixkuyDirectTransferCoverage;

    return api && typeof api === "object" ? api : null;
  }

  async function resolveDirectTransferCoverage(place) {
    const api = getDirectTransferCoverageApi();
    const address = normalizeQuoteAddress(place, "");

    if (!api || typeof api.resolveCoverageFromPoint !== "function" || !address) {
      return null;
    }

    try {
      return await api.resolveCoverageFromPoint({
        lat: address.lat,
        lng: address.lng
      });
    } catch (error) {
      return null;
    }
  }

  function getAirportGuardApi() {
    const api = window.PixkuyDirectTransferAirportGuard;

    if (
      !api ||
      typeof api.getCataloguedAirportTransferId !== "function" ||
      typeof api.isCataloguedAirportTransferPlace !== "function"
    ) {
      throw new Error("[Pixkuy Direct Transfer Mobile Config Step] Airport guard is not available.");
    }

    return api;
  }
  
    function getAirportHandoffApi() {
    const api = window.PixkuyDirectTransferAirportHandoff;

    if (
      !api ||
      typeof api.storePendingHandoff !== "function"
    ) {
      throw new Error("[Pixkuy Direct Transfer Mobile Config Step] Airport handoff bridge is not available.");
    }

    return api;
  }

  function getCataloguedAirportTransferId(place) {
    return getAirportGuardApi().getCataloguedAirportTransferId(place);
  }

  function isCataloguedAirportTransferPlace(place) {
    return getAirportGuardApi().isCataloguedAirportTransferPlace(place);
  }


  function getAirportTransferContext() {
    const originAirportId = getCataloguedAirportTransferId(state.originPlace);
    const destinationAirportId = getCataloguedAirportTransferId(state.destinationPlace);

    if (originAirportId) {
      return {
        airportId: originAirportId,
        direction: "airport_to_hotel"
      };
    }

    if (destinationAirportId) {
      return {
        airportId: destinationAirportId,
        direction: "hotel_to_airport"
      };
    }

    return {
      airportId: "",
      direction: ""
    };
  }
  
    function buildAirportHandoffInput(context) {
    const safeContext = context && typeof context === "object" ? context : {};

    return {
      airportId: normalizeText(safeContext.airportId),
      direction: normalizeText(safeContext.direction),
      originPlace: state.originPlace,
      destinationPlace: state.destinationPlace
    };
  }

  function isDirectTransferCoveredPlace(role) {
    const coverage = role === "destination"
      ? state.destinationCoverage
      : state.originCoverage;

    return Boolean(coverage && coverage.isWithinCoverage === true);
  }

  function getDirectTransferRestrictionType() {
    const hasOriginPlace = Boolean(state.originPlace);
    const hasDestinationPlace = Boolean(state.destinationPlace);

    if (
      (hasOriginPlace && isCataloguedAirportTransferPlace(state.originPlace)) ||
      (hasDestinationPlace && isCataloguedAirportTransferPlace(state.destinationPlace))
    ) {
      return "airport";
    }

    if (
      (hasOriginPlace && !isDirectTransferCoveredPlace("origin")) ||
      (hasDestinationPlace && !isDirectTransferCoveredPlace("destination"))
    ) {
      return "out_of_coverage";
    }

    return "";
  }

  function lowerFirst(value) {
    const text = normalizeText(value);

    if (!text) {
      return "";
    }

    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function normalizeListSeparator(value, fallback) {
    const raw = typeof value === "string" ? value : "";
    const separator = raw.trim();
    const spacedWordSeparators = [
      "y",
      "and",
      "und",
      "et",
      "e",
      "и",
      "및"
    ];

    if (!separator) {
      return fallback;
    }

    if (separator === ",") {
      return ", ";
    }

    if (separator === "、") {
      return "、";
    }

    if (spacedWordSeparators.indexOf(separator) >= 0) {
      return " " + separator + " ";
    }

    return separator;
  }

  function buildNaturalList(items) {
    const values = Array.isArray(items)
      ? items.map(normalizeText).filter(Boolean)
      : [];
    const separator = normalizeListSeparator(
      getI18nValue("directTransferMobileFlow.fare.separator", ", "),
      ", "
    );
    const finalSeparator = normalizeListSeparator(
      getI18nValue("directTransferMobileFlow.fare.finalSeparator", " y "),
      " y "
    );

    if (values.length <= 1) {
      return values[0] || "";
    }

    if (values.length === 2) {
      return values[0] + finalSeparator + values[1];
    }

    return values.slice(0, -1).join(separator) + finalSeparator + values[values.length - 1];
  }

  function getStep() {
    return stepNode || document.querySelector(CONFIG_STEP_SELECTOR);
  }

  function getFlowApi() {
    const api = window.PixkuyDirectTransferMobileBookingFlow;

    return api && typeof api === "object" ? api : null;
  }

  function getWhatsappPhoneNumber() {
    return ["52", "1", "55", "2883", "7400"].join("").replace(/[^\d]/g, "");
  }

  function buildWhatsappUrl(message) {
    const phone = getWhatsappPhoneNumber();
    const encodedMessage = encodeURIComponent(message || "");

    return phone ? "https://wa.me/" + phone + "?text=" + encodedMessage : "";
  }

  function getDirectTransferWhatsappMessage() {
    const lines = [];
    const restrictionType = getDirectTransferRestrictionType();
    const fareText = state.quote && state.quote.price
      ? "$" + formatCurrencyAmount(state.quote.price) + " " + getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || "MXN")
      : "";

    lines.push(getI18nValue("directTransferMobileFlow.whatsapp.intro", "Hola, quiero consultar un traslado directo con Pixkuy."));
    lines.push(
      getI18nValue("directTransferMobileFlow.whatsapp.serviceType", "Tipo de servicio") +
        ": " +
        getI18nValue("directTransferMobileFlow.whatsapp.serviceLabel", "Traslado directo")
    );

    if (state.origin) {
      lines.push(getI18nValue("directTransferMobileFlow.whatsapp.origin", "Origen") + ": " + state.origin);
    }

    if (state.destination) {
      lines.push(getI18nValue("directTransferMobileFlow.whatsapp.destination", "Destino") + ": " + state.destination);
    }

    if (state.date) {
      lines.push(getI18nValue("directTransferMobileFlow.whatsapp.date", "Fecha") + ": " + state.date);
    }

    if (state.time) {
      lines.push(getI18nValue("directTransferMobileFlow.whatsapp.time", "Hora") + ": " + state.time);
    }

    if (state.passengerFareKey) {
      lines.push(
        getI18nValue("directTransferMobileFlow.whatsapp.passengers", "Pasajeros") +
          ": " +
          getPassengerBucketLabel(state.passengerFareKey)
      );
    }

    if (fareText) {
      lines.push(getI18nValue("directTransferMobileFlow.whatsapp.price", "Precio estimado") + ": " + fareText);
    }

    if (restrictionType === "airport") {
      lines.push(
        getI18nValue("directTransferMobileFlow.whatsapp.restriction", "Motivo") +
          ": " +
          getI18nValue("directTransferMobileFlow.validation.airportRoute", "Para traslados desde o hacia los aeropuertos que cubrimos, usa el servicio Aeropuerto / Hotel.")
      );
    }

    if (restrictionType === "out_of_coverage") {
      lines.push(
        getI18nValue("directTransferMobileFlow.whatsapp.restriction", "Motivo") +
          ": " +
          getI18nValue("directTransferMobileFlow.validation.outOfCoverage", "Este trayecto queda fuera de nuestra zona operativa para traslados directos.")
      );
    }

    return lines.filter(Boolean).join("\n");
  }

  function getLinkedServiceHeroLink(serviceType) {
    const safeServiceType = normalizeText(serviceType);

    if (!safeServiceType) {
      return null;
    }

    return document.querySelector('.hero-mobile-entry__action[href*="service=' + safeServiceType + '"]');
  }

  function setReturnToDirectTransferUrl(serviceType) {
    try {
      const url = new URL(window.location.href);
      const airportContext = serviceType === "airport_hotel"
        ? getAirportTransferContext()
        : { airportId: "", direction: "" };

      url.searchParams.set("service", serviceType);
      url.searchParams.set("return_to", "direct_transfer");

      if (airportContext.airportId) {
        url.searchParams.set("airport_id", airportContext.airportId);
      } else {
        url.searchParams.delete("airport_id");
      }

      if (airportContext.direction) {
        url.searchParams.set("airport_direction", airportContext.direction);
      } else {
        url.searchParams.delete("airport_direction");
      }

      url.hash = "";

      window.history.pushState(
        { directTransferReturnTarget: serviceType },
        document.title,
        url.pathname + url.search + url.hash
      );

      if (serviceType === "airport_hotel" && airportContext.airportId) {
        getAirportHandoffApi().storePendingHandoff(
          buildAirportHandoffInput(airportContext)
        );
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function openLinkedMobileService(serviceType) {
    const flowApi = getFlowApi();
    const link = getLinkedServiceHeroLink(serviceType);

    setReturnToDirectTransferUrl(serviceType);

    if (flowApi && typeof flowApi.close === "function") {
      flowApi.close({ updateUrl: false });
    }

    if (link && typeof link.click === "function") {
      link.click();
      return true;
    }

    return false;
  }

  function getFieldValue(name) {
    const step = getStep();
    const field = step
      ? step.querySelector('[data-direct-transfer-mobile-config-field="' + name + '"]')
      : null;

    return normalizeText(field && typeof field.value === "string" ? field.value : "");
  }

  function getAddressInput(role) {
    const step = getStep();

    return step
      ? step.querySelector('[data-direct-transfer-mobile-address-input][data-direct-transfer-mobile-address-role="' + role + '"]')
      : null;
  }

  function getSelectedPlaceLabel(selectedPlace, fallback) {
    const safePlace = selectedPlace && typeof selectedPlace === "object" ? selectedPlace : {};

    return normalizeText(
      safePlace.label ||
        safePlace.formattedAddress ||
        safePlace.displayName ||
        fallback
    );
  }

  function getSelectedPlaceId(selectedPlace) {
    const safePlace = selectedPlace && typeof selectedPlace === "object" ? selectedPlace : {};

    return normalizeText(safePlace.placeId || safePlace.place_id || safePlace.id);
  }

  function getSelectedPlaceCoordinate(selectedPlace, key) {
    const safePlace = selectedPlace && typeof selectedPlace === "object" ? selectedPlace : {};
    const directValue = safePlace[key];
    const nestedLocation = safePlace.location && typeof safePlace.location === "object"
      ? safePlace.location
      : {};
    const nestedValue = nestedLocation[key];
    const value = directValue !== undefined && directValue !== null ? directValue : nestedValue;
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  function normalizeQuoteAddress(place, label) {
    const safePlace = place && typeof place === "object" ? place : {};
    const lat = getSelectedPlaceCoordinate(place, "lat");
    const lng = getSelectedPlaceCoordinate(place, "lng");

    if (!place || lat === null || lng === null) {
      return null;
    }

    return {
      label: getSelectedPlaceLabel(place, label),
      placeId: getSelectedPlaceId(place),
      lat,
      lng,
      countryCode: normalizeText(safePlace.countryCode || safePlace.regionCode),
      administrativeAreaLevel1: normalizeText(
        safePlace.administrativeAreaLevel1 ||
          safePlace.adminAreaLevel1 ||
          safePlace.state ||
          safePlace.region
      ),
      administrativeAreaLevel2: normalizeText(
        safePlace.administrativeAreaLevel2 ||
          safePlace.adminAreaLevel2 ||
          safePlace.county
      ),
      locality: normalizeText(safePlace.locality || safePlace.city),
      iataCode: normalizeText(safePlace.iataCode),
      types: Array.isArray(safePlace.types) ? safePlace.types.slice(0, 12) : [],
      addressComponents: Array.isArray(safePlace.addressComponents)
        ? safePlace.addressComponents.slice(0, 16)
        : []
    };
  }

  function areSameLocations() {
    const originPlaceId = getSelectedPlaceId(state.originPlace);
    const destinationPlaceId = getSelectedPlaceId(state.destinationPlace);
    const originText = normalizeLocationComparisonValue(state.origin);
    const destinationText = normalizeLocationComparisonValue(state.destination);

    if (originPlaceId && destinationPlaceId) {
      return originPlaceId === destinationPlaceId;
    }

    if (!originText || !destinationText) {
      return false;
    }

    return originText === destinationText;
  }

  function syncStateFromFields() {
    state.origin = getFieldValue("origin");
    state.destination = getFieldValue("destination");
    state.date = getFieldValue("date");
    state.time = getFieldValue("time");
    state.passengerFareKey = getFieldValue("passengers") || "van_1_2";

    return true;
  }

  function hasRequiredFieldsForQuote() {
    return Boolean(
      state.origin &&
        state.destination &&
        !areSameLocations() &&
        !getDirectTransferRestrictionType() &&
        state.date &&
        state.time &&
        state.passengerFareKey &&
        normalizeQuoteAddress(state.originPlace, state.origin) &&
        normalizeQuoteAddress(state.destinationPlace, state.destination)
    );
  }

  function getMissingQuoteFieldLabels() {
    const missing = [];

    if (!state.origin || !normalizeQuoteAddress(state.originPlace, state.origin)) {
      missing.push(lowerFirst(getI18nValue("directTransferMobileFlow.fields.origin", "Origen")));
    }

    if (!state.destination || !normalizeQuoteAddress(state.destinationPlace, state.destination)) {
      missing.push(lowerFirst(getI18nValue("directTransferMobileFlow.fields.destination", "Destino")));
    }

    if (!state.date) {
      missing.push(lowerFirst(getI18nValue("directTransferMobileFlow.fields.date", "Fecha")));
    }

    if (!state.time) {
      missing.push(lowerFirst(getI18nValue("directTransferMobileFlow.fields.time", "Hora")));
    }

    if (!state.passengerFareKey) {
      missing.push(lowerFirst(getI18nValue("directTransferMobileFlow.fields.passengers", "Pasajeros")));
    }

    return missing;
  }

  function getPendingFareText() {
    const missingFields = getMissingQuoteFieldLabels();

    if (!missingFields.length) {
      return getI18nValue(
        "directTransferMobileFlow.fare.pendingReady",
        "Preparando cálculo del precio…"
      );
    }

    return getI18nValue(
      "directTransferMobileFlow.fare.pendingTemplate",
      "Completa {fields} para calcular el precio."
    ).replace("{fields}", buildNaturalList(missingFields));
  }

  function hasCanonicalMobileQuote(currentState) {
    const safeState = currentState && typeof currentState === "object"
      ? currentState
      : {};
    const quote = safeState.quote && typeof safeState.quote === "object"
      ? safeState.quote
      : {};
    const amountMinor = Number(quote.amountMinor);

    return Boolean(
      safeState.quoteState === "canonical" &&
      Number.isInteger(amountMinor) &&
      amountMinor > 0 &&
      normalizeText(quote.pricingVersion) &&
      normalizeText(quote.quoteFingerprint) &&
      normalizeText(quote.quoteExpiresAt)
    );
  }

  function isCanonicalRequoteCode(code) {
    return [
      "DIRECT_TRANSFER_PRICE_MISMATCH",
      "DIRECT_TRANSFER_QUOTE_STALE",
      "DIRECT_TRANSFER_PRICING_VERSION_MISMATCH",
      "DIRECT_TRANSFER_QUOTE_FINGERPRINT_MISMATCH"
    ].indexOf(normalizeText(code)) !== -1;
  }

  function buildCanonicalMobileQuote(currentQuote, detail) {
    const safeCurrentQuote = currentQuote && typeof currentQuote === "object"
      ? currentQuote
      : {};
    const safeDetail = detail && typeof detail === "object" ? detail : {};
    const price = Number(safeDetail.price);
    const amountMinor = Number(safeDetail.amountMinor);
    const quote = Object.assign({}, safeCurrentQuote, {
      price,
      amountMinor,
      currency: normalizeText(safeDetail.currency) || "MXN",
      durationSeconds: Number(safeDetail.durationSeconds) || safeCurrentQuote.durationSeconds,
      distanceMeters: Number(safeDetail.distanceMeters) || safeCurrentQuote.distanceMeters,
      pricingVersion: normalizeText(safeDetail.pricingVersion),
      quoteFingerprint: normalizeText(safeDetail.quoteFingerprint),
      quoteExpiresAt: normalizeText(safeDetail.quoteExpiresAt),
      quoteAcceptedAt: normalizeText(safeDetail.quoteAcceptedAt)
    });

    return Number.isFinite(price) && price > 0 &&
      Number.isInteger(amountMinor) && amountMinor > 0
      ? quote
      : null;
  }

  function applyCanonicalPriceState(currentState, detail) {
    const safeState = currentState && typeof currentState === "object"
      ? currentState
      : {};
    const safeDetail = detail && typeof detail === "object" ? detail : {};
    const hadCanonicalQuote = hasCanonicalMobileQuote(safeState);
    const canonicalQuote = buildCanonicalMobileQuote(safeState.quote, safeDetail);
    const canonicalState = canonicalQuote
      ? Object.assign({}, safeState, {
        quote: canonicalQuote,
        quoteState: "canonical"
      })
      : safeState;
    const code = normalizeText(safeDetail.code);

    if (
      safeDetail.checkoutAllowed === true &&
      canonicalQuote &&
      hasCanonicalMobileQuote(canonicalState)
    ) {
      return Object.assign({}, canonicalState, {
        quoteStatus: "ready",
        quoteErrorCode: "",
        quoteErrorMessage: "",
        nextAvailableStartLocal: "",
        precheckAllowed: true,
        quoteReviewRequired: false
      });
    }

    if (
      safeDetail.checkoutAllowed !== true &&
      hadCanonicalQuote &&
      canonicalQuote &&
      hasCanonicalMobileQuote(canonicalState) &&
      isCanonicalRequoteCode(code)
    ) {
      return Object.assign({}, canonicalState, {
        quoteStatus: "review",
        quoteErrorCode: code,
        quoteErrorMessage: normalizeText(safeDetail.availabilityMessage),
        nextAvailableStartLocal: normalizeText(safeDetail.nextAvailableStartLocal),
        precheckAllowed: false,
        quoteReviewRequired: true
      });
    }

    return Object.assign({}, safeState, {
      quote: null,
      quoteState: "none",
      quoteStatus: "error",
      quoteErrorCode: code || "PRECHECK_UNAVAILABLE",
      quoteErrorMessage: normalizeText(safeDetail.availabilityMessage),
      nextAvailableStartLocal: normalizeText(safeDetail.nextAvailableStartLocal),
      precheckAllowed: false,
      quoteReviewRequired: false
    });
  }

  function resetCanonicalPriceState(currentState) {
    return Object.assign({}, currentState && typeof currentState === "object" ? currentState : {}, {
      quote: null,
      quoteState: "none",
      quoteStatus: "pending",
      quoteErrorCode: "",
      quoteErrorMessage: "",
      nextAvailableStartLocal: "",
      precheckAllowed: false,
      quoteReviewRequired: false
    });
  }

  function canContinueCanonicalPriceState(currentState) {
    const safeState = currentState && typeof currentState === "object"
      ? currentState
      : {};

    return Boolean(
      safeState.quoteStatus === "ready" &&
      safeState.precheckAllowed === true &&
      safeState.quoteReviewRequired !== true &&
      hasCanonicalMobileQuote(safeState)
    );
  }

  function canReacceptCanonicalPriceState(currentState) {
    const safeState = currentState && typeof currentState === "object"
      ? currentState
      : {};

    return Boolean(
      safeState.quoteStatus === "review" &&
      safeState.precheckAllowed !== true &&
      safeState.quoteReviewRequired === true &&
      hasCanonicalMobileQuote(safeState)
    );
  }

  function canContinue() {
    return Boolean(
      hasRequiredFieldsForQuote() &&
      getMinimumLeadTimeValidation().valid === true &&
      canContinueCanonicalPriceState(state)
    );
  }

  function canReacceptCanonicalPrice() {
    return Boolean(
      hasRequiredFieldsForQuote() &&
      getMinimumLeadTimeValidation().valid === true &&
      canReacceptCanonicalPriceState(state)
    );
  }

  function getPassengerBucketLabel(bucket) {
    const safeBucket = normalizeText(bucket);

    return getI18nValue(
      "directTransferMobileFlow.passengerBuckets." + safeBucket,
      safeBucket
    );
  }

  function buildPassengerOptionsMarkup() {
    return PASSENGER_BUCKETS.map(function mapBucket(bucket) {
      return [
        '<option value="' + escapeHtml(bucket) + '"',
        bucket === state.passengerFareKey ? ' selected' : '',
        '>',
        escapeHtml(getPassengerBucketLabel(bucket)),
        '</option>'
      ].join("");
    }).join("");
  }

  function formatCurrencyAmount(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return String(Math.round(amount));
    }
  }
  
    function getQuoteNumberValue(keys) {
    const quote = state.quote && typeof state.quote === "object" ? state.quote : {};
    const candidates = Array.isArray(keys) ? keys : [];
    let index;

    for (index = 0; index < candidates.length; index += 1) {
      const key = candidates[index];
      const value = quote[key];
      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }

    if (quote.route && typeof quote.route === "object") {
      for (index = 0; index < candidates.length; index += 1) {
        const key = candidates[index];
        const value = quote.route[key];
        const number = Number(value);

        if (Number.isFinite(number) && number > 0) {
          return number;
        }
      }
    }

    return null;
  }

  function formatDistanceLabel() {
    const meters = getQuoteNumberValue([
      "distanceMeters",
      "distance_meters",
      "distance"
    ]);

    if (!meters) {
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

  function formatDurationHoursMinutes(seconds) {
    const totalMinutes = Math.max(1, Math.round(Number(seconds) / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return [
      String(hours),
      String(minutes).padStart(2, "0")
    ].join(":");
  }

  function formatDurationLabel() {
    const seconds = getQuoteNumberValue([
      "durationSeconds",
      "duration_seconds",
      "duration"
    ]);

    if (!seconds) {
      return "";
    }

    return getI18nValue(
      "directTransferMobileFlow.estimate.hoursMinutesApprox",
      "{duration} h aprox."
    ).replace("{duration}", formatDurationHoursMinutes(seconds));
  }

  function getMinimumLeadTimeValidation() {
    const api = getTransactionalStateApi();

    if (!api || typeof api.validateDirectTransferMinimumLeadTime !== "function") {
      return { valid: false };
    }

    return api.validateDirectTransferMinimumLeadTime(state.date, state.time);
  }

  function getMinimumDateValue() {
    const api = getTransactionalStateApi();

    return api && typeof api.getDirectTransferMinimumDateValue === "function"
      ? normalizeText(api.getDirectTransferMinimumDateValue())
      : "";
  }

  function getMinimumTimeValue(dateValue) {
    const api = getTransactionalStateApi();

    return api && typeof api.getDirectTransferMinimumTimeValue === "function"
      ? normalizeText(api.getDirectTransferMinimumTimeValue(dateValue))
      : "";
  }

  function normalizeDateTimeField(target) {
    const minimumDate = getMinimumDateValue();
    const minimumTime = getMinimumTimeValue(state.date);

    if (
      target &&
      target.getAttribute("data-direct-transfer-mobile-config-field") === "date" &&
      minimumDate &&
      normalizeText(target.value) < minimumDate
    ) {
      return true;
    }

    if (
      target &&
      target.getAttribute("data-direct-transfer-mobile-config-field") === "time" &&
      minimumTime &&
      normalizeText(target.value) < minimumTime
    ) {
      return true;
    }

    return false;
  }

  function syncDateTimeConstraints() {
    const step = getStep();
    const dateField = step
      ? step.querySelector('[data-direct-transfer-mobile-config-field="date"]')
      : null;
    const timeField = step
      ? step.querySelector('[data-direct-transfer-mobile-config-field="time"]')
      : null;
    const minimumDate = getMinimumDateValue();
    const minimumTime = getMinimumTimeValue(state.date);

    if (dateField && minimumDate) {
      dateField.setAttribute("min", minimumDate);
    }

    if (timeField) {
      if (minimumTime) {
        timeField.setAttribute("min", minimumTime);
      } else {
        timeField.removeAttribute("min");
      }
    }

    return true;
  }

  function syncAddressClearState(role) {
    const step = getStep();
    const input = getAddressInput(role);
    const clear = step
      ? step.querySelector('[data-direct-transfer-mobile-address-clear="' + role + '"]')
      : null;
    const hasValue = Boolean(normalizeText(input && input.value));

    if (clear) {
      clear.hidden = !hasValue;
    }

    return true;
  }

  function syncAllAddressClearState() {
    syncAddressClearState("origin");
    syncAddressClearState("destination");

    return true;
  }

  function syncSameRouteError() {
    const step = getStep();
    const error = step ? step.querySelector(SAME_ROUTE_ERROR_SELECTOR) : null;
    const shouldShow = Boolean(state.origin && state.destination && areSameLocations());

    if (!error) {
      return false;
    }

    error.hidden = !shouldShow;

    return true;
  }
  
    function syncRestrictionNotice() {
    const step = getStep();
    const notice = step ? step.querySelector(RESTRICTION_NOTICE_SELECTOR) : null;
    const text = notice ? notice.querySelector("[data-direct-transfer-mobile-restriction-text]") : null;
    const actions = notice ? notice.querySelector("[data-direct-transfer-mobile-restriction-actions]") : null;
    const type = getDirectTransferRestrictionType();

    if (!notice || !text || !actions) {
      return false;
    }

    if (!type) {
      notice.hidden = true;
      text.textContent = "";
      actions.innerHTML = "";
      return true;
    }

    notice.hidden = false;

    if (type === "airport") {
      text.textContent = getI18nValue(
        "directTransferMobileFlow.validation.airportRoute",
        "Para traslados desde o hacia los aeropuertos que cubrimos, usa el servicio Aeropuerto / Hotel."
      );
      actions.innerHTML = [
        '<a class="direct-transfer-mobile-config-step__restriction-link direct-transfer-mobile-config-step__restriction-link--primary" href="?service=airport_hotel&return_to=direct_transfer#services" data-direct-transfer-restriction-action="airport">',
        escapeHtml(getI18nValue("directTransferMobileFlow.cta.airport", "Ir a Aeropuerto / Hotel")),
        '</a>'
      ].join("");
      return true;
    }

    text.textContent = getI18nValue(
      "directTransferMobileFlow.validation.outOfCoverage",
      "Este trayecto queda fuera de nuestra zona operativa para traslados directos."
    );
    actions.innerHTML = [
      '<a class="direct-transfer-mobile-config-step__restriction-link direct-transfer-mobile-config-step__restriction-link--primary" href="' + escapeHtml(buildWhatsappUrl(getDirectTransferWhatsappMessage())) + '" target="_blank" rel="noopener noreferrer" data-direct-transfer-restriction-action="whatsapp">',
      escapeHtml(getI18nValue("directTransferMobileFlow.cta.whatsapp", "WhatsApp")),
      '</a>',
      '<a class="direct-transfer-mobile-config-step__restriction-link" href="?service=hourly_daily&return_to=direct_transfer#services" data-direct-transfer-restriction-action="hourly">',
      escapeHtml(getI18nValue("directTransferMobileFlow.cta.hourly", "Vehículo con conductor")),
      '</a>'
    ].join("");

    return true;
  }

  function syncDateTimeOverlayState(input) {
    const wrap = input
      ? input.closest("[data-direct-transfer-mobile-date-state], [data-direct-transfer-mobile-time-state]")
      : null;

    if (!wrap) {
      return false;
    }

    if (wrap.hasAttribute("data-direct-transfer-mobile-date-state")) {
      wrap.setAttribute(
        "data-direct-transfer-mobile-date-state",
        normalizeText(input.value) ? "value" : "empty"
      );
    }

    if (wrap.hasAttribute("data-direct-transfer-mobile-time-state")) {
      wrap.setAttribute(
        "data-direct-transfer-mobile-time-state",
        normalizeText(input.value) ? "value" : "empty"
      );
    }

    return true;
  }

  function getFareText() {
    if (state.quoteStatus === "loading") {
      return getI18nValue(
        "directTransferMobileFlow.fare.loading",
        "Calculando precio…"
      );
    }

    if (state.quoteStatus === "review") {
      return [
        state.quoteErrorMessage || getI18nValue(
          "directTransferMobileFlow.fare.acceptUpdated",
          "Continúa de nuevo para aceptar el precio actualizado."
        ),
        state.quote && state.quote.price
          ? "$" + formatCurrencyAmount(state.quote.price) + " " +
            getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || "MXN")
          : ""
      ].filter(Boolean).join(" ");
    }

    if (state.quoteStatus === "error") {
      if (state.quoteErrorMessage) {
        return state.quoteErrorMessage;
      }

      if (state.quoteErrorCode === "DIRECT_TRANSFER_MINIMUM_LEAD_TIME_NOT_MET") {
        return getI18nValue(
          "services.cards.hourly.panel.availability.minimumLeadTime",
          "Necesitamos al menos 24 horas de antelación para confirmar este servicio."
        );
      }

      return getI18nValue(
        "directTransferMobileFlow.fare.unavailable",
        "No pudimos calcular el precio para este trayecto."
      );
    }
	
	if (getDirectTransferRestrictionType() === "airport") {
      return getI18nValue(
        "directTransferMobileFlow.fare.airportTransfer",
        "Este trayecto debe gestionarse como Aeropuerto / Hotel."
      );
    }

    if (getDirectTransferRestrictionType() === "out_of_coverage") {
      return getI18nValue(
        "directTransferMobileFlow.fare.outOfCoverage",
        "Para este trayecto, podemos ayudarte por WhatsApp o con servicio de vehículo con conductor."
      );
    }

    if (state.quoteStatus === "ready" && state.quote && state.quote.price) {
      return [
        "$",
        formatCurrencyAmount(state.quote.price),
        " ",
        getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || "MXN")
      ].join("");
    }

    return getPendingFareText();
  }

  function applyNextAvailableSuggestion(nextAvailableStartLocal) {
    const suggestion = window.PixkuySharedAvailabilitySuggestion;
    let fieldsUpdated = false;

    if (!suggestion || typeof suggestion.apply !== "function") {
      return Promise.resolve(false);
    }

    return suggestion.apply({
      nextAvailableStartLocal,
      invalidate: resetQuote,
      applyDateTime: function applyDirectTransferDateTime(applied) {
        const step = getStep();
        const dateField = step
          ? step.querySelector('[data-direct-transfer-mobile-config-field="date"]')
          : null;
        const timeField = step
          ? step.querySelector('[data-direct-transfer-mobile-config-field="time"]')
          : null;

        if (!dateField || !timeField) {
          return;
        }

        dateField.value = applied.date;
        timeField.value = applied.time;
        syncStateFromFields();
        syncDateTimeOverlayState(dateField);
        syncDateTimeOverlayState(timeField);
        syncDateTimeConstraints();
        fieldsUpdated = true;
      },
      recheck: function recheckDirectTransferSuggestion() {
        return fieldsUpdated ? requestQuoteIfReady() : false;
      }
    });
  }

  function renderNextAvailableFareSuggestion(fareValue) {
    const suggestion = window.PixkuySharedAvailabilitySuggestion;
    const template = getI18nValue(
      "services.cards.hourly.panel.availability.nextAvailableSlot",
      "Siguiente hora disponible: {time}"
    );
    const result = {
      nextAvailableStartLocal: state.nextAvailableStartLocal,
      requestedLocalDate: state.date
    };
    const description = suggestion && typeof suggestion.describe === "function"
      ? suggestion.describe(result, {
          requestedLocalDate: state.date,
          template
        })
      : { message: "", nextAvailableStartLocal: "" };
    const baseMessage = description.message && state.quoteErrorMessage.endsWith(description.message)
      ? state.quoteErrorMessage.slice(0, -description.message.length).trim()
      : state.quoteErrorMessage;

    if (!description.nextAvailableStartLocal || !description.message || !suggestion) {
      return false;
    }

    fareValue.textContent = baseMessage;

    if (baseMessage) {
      fareValue.appendChild(document.createTextNode(" "));
    }

    const action = document.createElement("button");
    action.type = "button";
    action.textContent = description.message;
    action.setAttribute("aria-label", description.message);
    action.setAttribute(
      "data-direct-transfer-mobile-next-available",
      description.nextAvailableStartLocal
    );
    action.className = "shared-availability-suggestion__link";
    action.addEventListener("click", function applyDirectTransferSuggestion(event) {
      event.preventDefault();
      applyNextAvailableSuggestion(description.nextAvailableStartLocal);
    });
    fareValue.appendChild(action);

    return true;
  }
  
    function getFareReadyMarkup() {
    if (state.quoteStatus !== "ready" || !state.quote || !state.quote.price) {
      return "";
    }

    return [
      '<span class="direct-transfer-mobile-config-step__fare-amount">',
      "$",
      escapeHtml(formatCurrencyAmount(state.quote.price)),
      '</span>',
      '<span class="direct-transfer-mobile-config-step__fare-currency">',
      escapeHtml(getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || "MXN")),
      '</span>'
    ].join("");
  }

  function syncFareUi() {
    const step = getStep();
    const fare = step ? step.querySelector(FARE_SELECTOR) : null;
    const fareValue = step ? step.querySelector(FARE_VALUE_SELECTOR) : null;
    const estimate = step ? step.querySelector(ESTIMATE_SELECTOR) : null;
    const estimateDistance = step ? step.querySelector(ESTIMATE_DISTANCE_SELECTOR) : null;
    const estimateDuration = step ? step.querySelector(ESTIMATE_DURATION_SELECTOR) : null;
    const isReady = state.quoteStatus === "ready" && state.quote && state.quote.price;

    if (fare) {
      fare.setAttribute("data-direct-transfer-mobile-fare-state", state.quoteStatus);
    }

    if (estimate) {
      const distanceLabel = isReady ? formatDistanceLabel() : "";
      const durationLabel = isReady ? formatDurationLabel() : "";
      const hasEstimate = Boolean(distanceLabel || durationLabel);

      estimate.hidden = !hasEstimate;

      if (estimateDistance) {
        const valueNode = estimateDistance.querySelector("strong");

        estimateDistance.hidden = !distanceLabel;

        if (valueNode) {
          valueNode.textContent = distanceLabel;
        }
      }

      if (estimateDuration) {
        const valueNode = estimateDuration.querySelector("strong");

        estimateDuration.hidden = !durationLabel;

        if (valueNode) {
          valueNode.textContent = durationLabel;
        }
      }
    }

    if (fareValue) {
      if (state.quoteStatus === "ready" && state.quote && state.quote.price) {
        fareValue.innerHTML = getFareReadyMarkup();
      } else if (
        state.quoteStatus === "error" &&
        state.quoteErrorMessage &&
        state.nextAvailableStartLocal &&
        renderNextAvailableFareSuggestion(fareValue)
      ) {
        return true;
      } else {
        fareValue.textContent = getFareText();
      }
    }

    return true;
  }
  
  function syncCta() {
    const step = getStep();
    const cta = step ? step.querySelector(CONFIG_CTA_SELECTOR) : null;
    const isReady = canContinue() || canReacceptCanonicalPrice();

    syncSameRouteError();
    syncRestrictionNotice();
    syncFareUi();

    if (!cta) {
      return false;
    }

    cta.disabled = !isReady;
    cta.setAttribute("aria-disabled", isReady ? "false" : "true");

    return true;
  }

  function resetQuote() {
    quoteRequestId += 1;
    activeCanonicalContextKey = "";
    state = resetCanonicalPriceState(state);

    if (quoteTimer) {
      window.clearTimeout(quoteTimer);
      quoteTimer = 0;
    }

    syncCta();

    return true;
  }

  function rejectMinimumLeadTime() {
    quoteRequestId += 1;
    activeCanonicalContextKey = "";

    if (quoteTimer) {
      window.clearTimeout(quoteTimer);
      quoteTimer = 0;
    }

    state.quoteStatus = "error";
    state.quote = null;
    state.quoteErrorCode = "DIRECT_TRANSFER_MINIMUM_LEAD_TIME_NOT_MET";
    state.quoteErrorMessage = getI18nValue(
      "services.cards.hourly.panel.availability.minimumLeadTime",
      "Necesitamos al menos 24 horas de antelación para confirmar este servicio."
    );
    state.nextAvailableStartLocal = "";
    state.precheckAllowed = false;
    state.quoteReviewRequired = false;
    state.quoteState = "none";
    syncCta();

    return false;
  }

  function buildQuoteInput() {
    return {
      originAddress: normalizeQuoteAddress(state.originPlace, state.origin),
      destinationAddress: normalizeQuoteAddress(state.destinationPlace, state.destination),
      pickupDate: state.date,
      pickupTime: state.time,
      passengerFareKey: state.passengerFareKey
    };
  }

  function buildContactStepPayload() {
    return {
      originAddress: normalizeQuoteAddress(state.originPlace, state.origin),
      destinationAddress: normalizeQuoteAddress(state.destinationPlace, state.destination),
      date: state.date,
      time: state.time,
      passengerFareKey: state.passengerFareKey,
      passengerBucketLabel: getPassengerBucketLabel(state.passengerFareKey),
      priceLabel: state.quote && state.quote.price
        ? "$" + formatCurrencyAmount(state.quote.price) + " " + getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || "MXN")
        : "",
      vehicleLabel: getI18nValue("directTransferMobileFlow.vehicle.title", "BYD M9"),
      quote: state.quote
    };
  }

  function buildCanonicalQuoteDetail() {
    const originAddress = normalizeQuoteAddress(state.originPlace, state.origin);
    const destinationAddress = normalizeQuoteAddress(state.destinationPlace, state.destination);

    return {
      surface: "mobile",
      quoteState: state.quoteState,
      contextKey: [
        state.date,
        state.time,
        state.passengerFareKey,
        originAddress && (originAddress.placeId || originAddress.place_id),
        originAddress && originAddress.lat,
        originAddress && originAddress.lng,
        destinationAddress && (destinationAddress.placeId || destinationAddress.place_id),
        destinationAddress && destinationAddress.lat,
        destinationAddress && destinationAddress.lng
      ].map(function normalizeContextValue(value) {
        return normalizeText(value == null ? "" : String(value));
      }).join("|"),
      originAddress,
      destinationAddress,
      direct_transfer_date: state.date,
      direct_transfer_time: state.time,
      direct_transfer_passenger_fare_key: state.passengerFareKey,
      direct_transfer_passenger_bucket_label: getPassengerBucketLabel(state.passengerFareKey),
      direct_transfer_price: state.quote && state.quote.price != null ? String(state.quote.price) : "",
      direct_transfer_currency: state.quote && state.quote.currency ? state.quote.currency : "MXN",
      direct_transfer_duration_seconds: state.quote && state.quote.durationSeconds != null ? String(Math.round(Number(state.quote.durationSeconds))) : "",
      direct_transfer_distance_meters: state.quote && state.quote.distanceMeters != null ? String(Math.round(Number(state.quote.distanceMeters))) : "",
      direct_transfer_vehicle_label: getI18nValue("directTransferMobileFlow.vehicle.title", "BYD M9"),
      direct_transfer_price_label: state.quote && state.quote.price
        ? "$" + formatCurrencyAmount(state.quote.price) + " " + getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || "MXN")
        : "",
      quote: state.quote
    };
  }

    function trackDirectTransferMobileQuoteReady() {
    const analytics = window.PixkuyAnalytics;
    const quote = state.quote && typeof state.quote === "object" ? state.quote : {};
    const price = Number(quote.price);
    const currency = normalizeText(quote.currency) || "MXN";
    const dedupeKey = [
      "direct_transfer",
      state.passengerFareKey,
      price,
      currency
    ].join("|");

    if (
      !analytics ||
      typeof analytics.trackOnce !== "function" ||
      !isMobileViewport() ||
      state.quoteStatus !== "ready" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return false;
    }

    return analytics.trackOnce("pixkuy_mobile_quote_ready", {
      service_type: "direct_transfer",
      flow_surface: "mobile_route",
      passenger_fare_key: state.passengerFareKey,
      price: price,
      currency: currency,
      distance_meters: getQuoteNumberValue(["distanceMeters", "distance_meters", "distance"]) || "",
      duration_seconds: getQuoteNumberValue(["durationSeconds", "duration_seconds", "duration"]) || ""
    }, dedupeKey);
  }

  function requestQuoteIfReady() {
    const quoteApi = getQuoteApi();
    const requestId = quoteRequestId + 1;

    if (quoteTimer) {
      window.clearTimeout(quoteTimer);
      quoteTimer = 0;
    }

    if (!hasRequiredFieldsForQuote()) {
      resetQuote();
      return false;
    }

    if (getMinimumLeadTimeValidation().valid !== true) {
      return rejectMinimumLeadTime();
    }

    if (!quoteApi || typeof quoteApi.requestQuote !== "function") {
      state.quoteStatus = "error";
      state.quote = null;
      state.quoteState = "none";
      state.quoteErrorCode = "QUOTE_API_MISSING";
      state.quoteErrorMessage = "";
      state.precheckAllowed = false;
      state.quoteReviewRequired = false;
      syncCta();
      return false;
    }

    quoteRequestId = requestId;
    activeCanonicalContextKey = "";
    state.quoteStatus = "loading";
    state.quote = null;
    state.quoteState = "none";
    state.quoteErrorCode = "";
    state.quoteErrorMessage = "";
    state.precheckAllowed = false;
    state.quoteReviewRequired = false;
    syncCta();

    quoteTimer = window.setTimeout(function quoteDebounced() {
      quoteApi.requestQuote(buildQuoteInput())
        .then(function onQuoteResult(result) {
          if (requestId !== quoteRequestId) {
            return;
          }

          if (!result || result.ok !== true || !result.quote || !result.quote.price) {
            state.quoteStatus = "error";
            state.quote = null;
            state.quoteState = "none";
            state.quoteErrorCode = result && result.code ? result.code : "QUOTE_UNAVAILABLE";
            state.quoteErrorMessage = "";
            state.precheckAllowed = false;
            state.quoteReviewRequired = false;
            syncCta();
            return;
          }

          state.quote = Object.assign({}, result.quote, {
            provisionalPricingVersion: normalizeText(result.quote.pricingVersion),
            amountMinor: null,
            pricingVersion: "",
            quoteFingerprint: "",
            quoteExpiresAt: "",
            quoteAcceptedAt: ""
          });
          state.quoteState = "provisional";
          state.quoteErrorCode = "";
          state.quoteErrorMessage = "";
          state.precheckAllowed = false;
          state.quoteReviewRequired = false;
          state.quoteStatus = "loading";
          syncCta();
          const canonicalDetail = buildCanonicalQuoteDetail();

          activeCanonicalContextKey = canonicalDetail.contextKey;
          window.dispatchEvent(
            new CustomEvent("pixkuy:direct-transfer-provisional-quote", {
              detail: canonicalDetail
            })
          );
        })
        .catch(function onQuoteError(error) {
          if (requestId !== quoteRequestId) {
            return;
          }

          state.quoteStatus = "error";
          state.quote = null;
          state.quoteState = "none";
          state.quoteErrorCode = error && error.message ? error.message : "QUOTE_ERROR";
          state.quoteErrorMessage = "";
          state.precheckAllowed = false;
          state.quoteReviewRequired = false;
          syncCta();
        });
    }, 220);

    return true;
  }

  function requestCanonicalPriceReacceptance() {
    const canonicalDetail = buildCanonicalQuoteDetail();

    if (!canReacceptCanonicalPrice()) {
      return false;
    }

    state.quoteStatus = "loading";
    state.quoteErrorCode = "";
    state.quoteErrorMessage = "";
    state.precheckAllowed = false;
    state.quoteReviewRequired = false;
    syncCta();

    activeCanonicalContextKey = canonicalDetail.contextKey;
    window.dispatchEvent(
      new CustomEvent("pixkuy:direct-transfer-provisional-quote", {
        detail: canonicalDetail
      })
    );

    return true;
  }

  function setAddressValue(role, value) {
    if (role === "destination") {
      state.destination = normalizeText(value);
      state.destinationPlace = null;
      state.destinationCoverage = null;
      resetQuote();
      return true;
    }

    state.origin = normalizeText(value);
    state.originPlace = null;
    state.originCoverage = null;
    resetQuote();
    return true;
  }

  async function setAddressPlace(role, selectedPlace) {
    const label = getSelectedPlaceLabel(selectedPlace, "");
    const coverage = await resolveDirectTransferCoverage(selectedPlace);

    if (role === "destination") {
      state.destination = label || state.destination;
      state.destinationPlace = selectedPlace || null;
      state.destinationCoverage = coverage;
      requestQuoteIfReady();
      return true;
    }

    state.origin = label || state.origin;
    state.originPlace = selectedPlace || null;
    state.originCoverage = coverage;
    requestQuoteIfReady();
    return true;
  }

  function clearAddressField(role) {
    const input = getAddressInput(role);

    setAddressValue(role, "");

    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.blur();
    }

    syncAddressClearState(role);
    syncCta();

    return true;
  }

  function buildAddressFieldMarkup(role) {
    const isDestination = role === "destination";
    const inputId = isDestination
      ? "direct-transfer-mobile-destination"
      : "direct-transfer-mobile-origin";
    const label = isDestination
      ? getI18nValue("directTransferMobileFlow.fields.destination", "Destino")
      : getI18nValue("directTransferMobileFlow.fields.origin", "Origen");
    const placeholder = isDestination
      ? getI18nValue("directTransferMobileFlow.fields.destinationPlaceholder", "Selecciona punto de destino")
      : getI18nValue("directTransferMobileFlow.fields.originPlaceholder", "Selecciona punto de origen");
    const clearLabel = getI18nValue("directTransferMobileFlow.addressSearch.clear", "Borrar dirección");
    const value = isDestination ? state.destination : state.origin;

    return [
      '<div class="direct-transfer-mobile-config-step__route-group">',
      '<label class="direct-transfer-mobile-config-step__label" for="' + escapeHtml(inputId) + '">' + escapeHtml(label) + '</label>',
      '<div class="place-autocomplete direct-transfer-mobile-address-compact" data-direct-transfer-mobile-address-shell="' + escapeHtml(role) + '">',
      '<input',
      ' id="' + escapeHtml(inputId) + '"',
      ' type="text"',
      ' class="direct-transfer-mobile-config-step__control direct-transfer-mobile-config-step__control--address"',
      ' data-direct-transfer-mobile-config-field="' + escapeHtml(role) + '"',
      ' data-direct-transfer-mobile-address-input',
      ' data-direct-transfer-mobile-address-role="' + escapeHtml(role) + '"',
      ' autocomplete="off"',
      ' spellcheck="false"',
      ' readonly',
      ' value="' + escapeHtml(value) + '"',
      ' placeholder="' + escapeHtml(placeholder) + '"',
      ' />',
      '<button type="button" class="place-autocomplete__clear" data-direct-transfer-mobile-address-clear="' + escapeHtml(role) + '"' + (value ? '' : ' hidden') + '>',
      '<span class="visually-hidden">' + escapeHtml(clearLabel) + '</span>',
      '<span aria-hidden="true">×</span>',
      '</button>',
      '<div class="place-autocomplete__mount" data-direct-transfer-mobile-address-compact-mount aria-hidden="true"></div>',
      '</div>',
      '</div>'
    ].join("");
  }

  function buildSameRouteErrorMarkup() {
    return [
      '<p class="direct-transfer-mobile-config-step__error" data-direct-transfer-mobile-same-route-error hidden>',
      escapeHtml(getI18nValue("directTransferMobileFlow.validation.sameRoute", "El origen y el destino no pueden ser iguales.")),
      '</p>'
    ].join("");
  }
  
  function buildRestrictionNoticeMarkup() {
    return [
      '<div class="direct-transfer-mobile-config-step__restriction" data-direct-transfer-mobile-restriction-notice hidden>',
      '<p class="direct-transfer-mobile-config-step__restriction-text" data-direct-transfer-mobile-restriction-text></p>',
      '<div class="direct-transfer-mobile-config-step__restriction-actions" data-direct-transfer-mobile-restriction-actions></div>',
      '</div>'
    ].join("");
  }

  function buildDateFieldMarkup(dateLabel) {
    return [
      '<div class="direct-transfer-mobile-config-step__field direct-transfer-mobile-config-step__field--date">',
      '<label class="direct-transfer-mobile-config-step__label" for="direct-transfer-mobile-date">' + escapeHtml(dateLabel) + '</label>',
      '<div class="direct-transfer-mobile-config-step__date-wrap" data-direct-transfer-mobile-date-state="' + (state.date ? 'value' : 'empty') + '">',
      '<input id="direct-transfer-mobile-date" type="date" class="direct-transfer-mobile-config-step__control" data-direct-transfer-mobile-config-field="date" min="' + escapeHtml(getMinimumDateValue()) + '" value="' + escapeHtml(state.date) + '" />',
      '<span class="direct-transfer-mobile-config-step__date-overlay" aria-hidden="true">' + escapeHtml(getI18nValue("directTransferMobileFlow.fields.datePlaceholder", "dd/mm/aaaa")) + '</span>',
      '<span class="direct-transfer-mobile-config-step__date-icon" aria-hidden="true">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>',
      '<line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>',
      '<line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>',
      '<line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>',
      '</svg>',
      '</span>',
      '</div>',
      '</div>'
    ].join("");
  }

  function buildTimeFieldMarkup(timeLabel) {
    return [
      '<div class="direct-transfer-mobile-config-step__field direct-transfer-mobile-config-step__field--time">',
      '<label class="direct-transfer-mobile-config-step__label" for="direct-transfer-mobile-time">' + escapeHtml(timeLabel) + '</label>',
      '<div class="direct-transfer-mobile-config-step__time-wrap" data-direct-transfer-mobile-time-state="' + (state.time ? 'value' : 'empty') + '">',
      '<input id="direct-transfer-mobile-time" type="time" class="direct-transfer-mobile-config-step__control" data-direct-transfer-mobile-config-field="time" min="' + escapeHtml(getMinimumTimeValue(state.date)) + '" value="' + escapeHtml(state.time) + '" />',
      '<span class="direct-transfer-mobile-config-step__time-overlay" aria-hidden="true">' + escapeHtml(getI18nValue("directTransferMobileFlow.fields.timePlaceholder", "--:--")) + '</span>',
      '<span class="direct-transfer-mobile-config-step__time-icon" aria-hidden="true">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>',
      '<polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>',
      '</svg>',
      '</span>',
      '</div>',
      '</div>'
    ].join("");
  }

  function buildStepMarkup() {
    const backText = getI18nValue("directTransferMobileFlow.back", "Volver");
    const titleText = getI18nValue("directTransferMobileFlow.title", "Traslados directos");
    const helperText = getI18nValue("directTransferMobileFlow.helper", "Elige origen, destino, fecha y hora.");
    const dateLabel = getI18nValue("directTransferMobileFlow.fields.date", "Fecha");
    const timeLabel = getI18nValue("directTransferMobileFlow.fields.time", "Hora");
    const passengersLabel = getI18nValue("directTransferMobileFlow.fields.passengers", "Pasajeros");
    const fareLabel = getI18nValue("directTransferMobileFlow.fare.label", "Precio");
    const ctaText = getI18nValue("directTransferMobileFlow.cta.continue", "Continuar");
    const vehicleAlt = getI18nValue("directTransferMobileFlow.vehicle.alt", "BYD M9 — van ejecutiva eléctrica");

    return [
      '<section class="direct-transfer-mobile-config-step" data-direct-transfer-mobile-config-step aria-hidden="true" hidden>',
      '<div class="direct-transfer-mobile-config-step__screen">',
      '<div class="direct-transfer-mobile-config-step__content">',

      '<div class="direct-transfer-mobile-config-step__back-row">',
      '<button type="button" class="direct-transfer-mobile-config-step__back" data-direct-transfer-mobile-config-back>' + escapeHtml(backText) + '</button>',
      '</div>',

      '<div class="direct-transfer-mobile-config-step__header">',
      '<h3 class="direct-transfer-mobile-config-step__title">' + escapeHtml(titleText) + '</h3>',
      '<p class="direct-transfer-mobile-config-step__helper">' + escapeHtml(helperText) + '</p>',
      '</div>',

      '<div class="direct-transfer-mobile-config-step__fields">',
      buildAddressFieldMarkup("origin"),
      buildAddressFieldMarkup("destination"),
      buildSameRouteErrorMarkup(),
      buildRestrictionNoticeMarkup(),

      '<div class="direct-transfer-mobile-config-step__row direct-transfer-mobile-config-step__row--trip">',
      '<div class="direct-transfer-mobile-config-step__field direct-transfer-mobile-config-step__field--passengers">',
      '<label class="direct-transfer-mobile-config-step__label" for="direct-transfer-mobile-passengers">' + escapeHtml(passengersLabel) + '</label>',
      '<select id="direct-transfer-mobile-passengers" class="direct-transfer-mobile-config-step__control" data-direct-transfer-mobile-config-field="passengers">',
      buildPassengerOptionsMarkup(),
      '</select>',
      '</div>',
      buildDateFieldMarkup(dateLabel),
      buildTimeFieldMarkup(timeLabel),
      '</div>',
      '</div>',

      '<div class="direct-transfer-mobile-config-step__footer">',
      '<div class="direct-transfer-mobile-config-step__vehicle">',
      '<img class="direct-transfer-mobile-config-step__vehicle-image" src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="' + escapeHtml(vehicleAlt) + '" loading="lazy" decoding="async" />',
      '</div>',
      '<div class="direct-transfer-mobile-config-step__fare" data-direct-transfer-mobile-fare data-direct-transfer-mobile-fare-state="' + escapeHtml(state.quoteStatus) + '">',
      '<div class="direct-transfer-mobile-config-step__estimate" data-direct-transfer-mobile-estimate hidden>',
      '<p data-direct-transfer-mobile-estimate-distance hidden><span>' + escapeHtml(getI18nValue("directTransferMobileFlow.estimate.distanceLabel", "Distancia")) + ':</span> <strong></strong></p>',
      '<p data-direct-transfer-mobile-estimate-duration hidden><span>' + escapeHtml(getI18nValue("directTransferMobileFlow.estimate.durationLabel", "Duración")) + ':</span> <strong></strong></p>',
      '</div>',
      '<span class="direct-transfer-mobile-config-step__fare-label">' + escapeHtml(fareLabel) + '</span>',
      '<p class="direct-transfer-mobile-config-step__fare-pending" data-direct-transfer-mobile-fare-value>' + escapeHtml(getFareText()) + '</p>',
      '</div>',
      '<button type="button" class="cta direct-transfer-mobile-config-step__cta" data-direct-transfer-mobile-config-cta disabled aria-disabled="true">' + escapeHtml(ctaText) + '</button>',
      '</div>',

      '</div>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderStep() {
    const route = parentRoute;
    const wasOpen = isOpen();

    if (!route) {
      return false;
    }

    if (!stepNode) {
      stepNode = document.createElement("div");
      route.appendChild(stepNode);
    }

    stepNode.outerHTML = buildStepMarkup();
    stepNode = route.querySelector(CONFIG_STEP_SELECTOR);

    if (wasOpen && stepNode) {
      stepNode.hidden = false;
      stepNode.setAttribute("aria-hidden", "false");
    }

    bindStepEvents();
    syncStateFromFields();
    syncDateTimeConstraints();
    syncAllAddressClearState();
    syncCta();
    requestQuoteIfReady();

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

  function open(route) {
    if (!isMobileViewport() || !route) {
      return false;
    }

    parentRoute = route;

    renderStep();
    setStepVisibility(true);

    return true;
  }

  function close() {
    setStepVisibility(false);
    resetQuote();
    return true;
  }

  function isOpen() {
    const step = getStep();

    return Boolean(
      step &&
        step.hidden !== true &&
        step.getAttribute("aria-hidden") !== "true"
    );
  }
  
    function trackDirectTransferMobileContinueClick() {
    const analytics = window.PixkuyAnalytics;
    const quote = state.quote && typeof state.quote === "object" ? state.quote : {};
    const price = Number(quote.price);
    const currency = normalizeText(quote.currency) || "MXN";

    if (
      !analytics ||
      typeof analytics.track !== "function" ||
      !isMobileViewport() ||
      state.quoteStatus !== "ready" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return false;
    }

    return analytics.track("pixkuy_continue_click", {
      service_type: "direct_transfer",
      flow_surface: "mobile_route",
      passenger_fare_key: state.passengerFareKey,
      price: price,
      currency: currency,
      distance_meters: getQuoteNumberValue(["distanceMeters", "distance_meters", "distance"]) || "",
      duration_seconds: getQuoteNumberValue(["durationSeconds", "duration_seconds", "duration"]) || ""
    });
  }

  function bindStepEvents() {
    const step = getStep();

    if (!step || step.dataset.directTransferMobileConfigBound === "1") {
      return false;
    }

    step.dataset.directTransferMobileConfigBound = "1";

    step.addEventListener("click", function onConfigClick(event) {
      const back = event.target.closest(CONFIG_BACK_SELECTOR);
      const addressClear = event.target.closest(CONFIG_ADDRESS_CLEAR_SELECTOR);
      const cta = event.target.closest(CONFIG_CTA_SELECTOR);
      const flowApi = getFlowApi();

      if (back) {
        event.preventDefault();

        if (flowApi && typeof flowApi.close === "function") {
          flowApi.close({ updateUrl: true });
          return;
        }

        close();
        return;
      }

      if (addressClear) {
        event.preventDefault();
        event.stopPropagation();
        clearAddressField(normalizeText(addressClear.getAttribute("data-direct-transfer-mobile-address-clear")));
        return;
      }

      const restrictionAction = event.target.closest("[data-direct-transfer-restriction-action]");

      if (restrictionAction) {
        const action = normalizeText(restrictionAction.getAttribute("data-direct-transfer-restriction-action"));

        if (action === "airport") {
          event.preventDefault();
          event.stopPropagation();
          openLinkedMobileService("airport_hotel");
          return;
        }

        if (action === "hourly") {
          event.preventDefault();
          event.stopPropagation();
          openLinkedMobileService("hourly_daily");
          return;
        }

        if (action === "whatsapp") {
          return;
        }
      }

      if (cta) {
        const contactStepApi = getContactStepApi();

        event.preventDefault();

        if (canReacceptCanonicalPrice()) {
          requestCanonicalPriceReacceptance();
          return;
        }

        if (
          continueBusy ||
          cta.disabled ||
          cta.getAttribute("aria-disabled") === "true" ||
          !canContinue()
        ) {
          return;
        }

        continueBusy = true;
        cta.disabled = true;
        cta.setAttribute("aria-disabled", "true");

        if (contactStepApi && typeof contactStepApi.open === "function") {
          if (contactStepApi.open(step, buildContactStepPayload())) {
            trackDirectTransferMobileContinueClick();
            continueBusy = false;
            return;
          }
        }

        continueBusy = false;
        syncCta();
      }
    });

    step.addEventListener("pixkuy:direct-transfer-mobile-address-place", function onAddressPlace(event) {
      const detail = event.detail || {};
      const role = normalizeText(detail.role);
      const selectedPlace = detail.selectedPlace || null;

      if (role !== "origin" && role !== "destination") {
        return;
      }

      setAddressPlace(role, selectedPlace).then(function onAddressPlaceApplied() {
        syncAddressClearState(role);
        syncCta();
      });
    });

    step.addEventListener("input", function onConfigInput(event) {
      if (!event.target || !event.target.matches(CONFIG_FIELD_SELECTOR)) {
        return;
      }

      const fieldName = normalizeText(
        event.target.getAttribute("data-direct-transfer-mobile-config-field")
      );

      if (fieldName === "date" || fieldName === "time") {
        resetQuote();
      }

      if (event.target.matches("[data-direct-transfer-mobile-address-input]")) {
        setAddressValue(
          normalizeText(event.target.getAttribute("data-direct-transfer-mobile-address-role")),
          event.target.value
        );
        syncAddressClearState(normalizeText(event.target.getAttribute("data-direct-transfer-mobile-address-role")));
      }

      normalizeDateTimeField(event.target);
      syncDateTimeOverlayState(event.target);
      syncStateFromFields();
      syncDateTimeConstraints();
      requestQuoteIfReady();
      syncCta();
    });

    step.addEventListener("change", function onConfigChange(event) {
      if (!event.target || !event.target.matches(CONFIG_FIELD_SELECTOR)) {
        return;
      }

      const fieldName = normalizeText(
        event.target.getAttribute("data-direct-transfer-mobile-config-field")
      );

      if (fieldName === "date" || fieldName === "time") {
        resetQuote();
      }

      normalizeDateTimeField(event.target);
      syncDateTimeOverlayState(event.target);
      syncStateFromFields();
      syncDateTimeConstraints();
      requestQuoteIfReady();
      syncCta();
    });

    return true;
  }

  window.PixkuyDirectTransferMobileConfigStep = {
    open,
    close,
    isOpen
  };

  window.PixkuyDirectTransferMobileQuoteContract = {
    applyCanonicalPriceState,
    resetCanonicalPriceState,
    canContinueCanonicalPriceState,
    canReacceptCanonicalPriceState,
    hasCanonicalMobileQuote
  };

  window.addEventListener("pixkuy:direct-transfer-canonical-price", function onCanonicalPrice(event) {
    const detail = event && event.detail && typeof event.detail === "object"
      ? event.detail
      : {};
    const contextKey = normalizeText(detail.contextKey);
    const contextMatches = Boolean(
      contextKey && contextKey === activeCanonicalContextKey
    );

    if (!contextMatches) {
      return;
    }

    activeCanonicalContextKey = "";
    state = applyCanonicalPriceState(state, detail);
    syncCta();

    if (state.quoteStatus === "ready") {
      trackDirectTransferMobileQuoteReady();
    }
  });

  window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
    if (isOpen()) {
      renderStep();
      setStepVisibility(true);
    }
  });
})(window, document);
