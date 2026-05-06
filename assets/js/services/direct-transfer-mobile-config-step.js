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

  const BODY_CONFIG_ATTR = "data-direct-transfer-mobile-config-screen";

  const PASSENGER_BUCKETS = ["van_1_2", "van_3_4", "van_5_6"];

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let stepNode = null;
  let parentRoute = null;
  let quoteRequestId = 0;
  let quoteTimer = 0;

  let state = {
    origin: "",
    originPlace: null,
    destination: "",
    destinationPlace: null,
    date: "",
    time: "",
    passengerFareKey: "van_1_2",
    quoteStatus: "pending",
    quote: null,
    quoteErrorCode: ""
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

  function getContactStepApi() {
    const api = window.PixkuyDirectTransferMobileContactStep;

    return api && typeof api === "object" ? api : null;
  }
  
    function getCoverageApi() {
    const forms = window.PixkuyForms || {};
    const coverage = forms.coverage;

    return coverage && typeof coverage === "object" ? coverage : null;
  }

  function getCoverageDecision(place) {
    const coverage = getCoverageApi();

    if (!coverage || typeof coverage.getCoverageDecision !== "function") {
      return null;
    }

    return coverage.getCoverageDecision(place);
  }

  function getPlaceSearchText(place) {
    const safePlace = place && typeof place === "object" ? place : {};

    return [
      safePlace.label,
      safePlace.displayName,
      safePlace.formattedAddress,
      safePlace.primaryText,
      safePlace.secondaryText,
      safePlace.text,
      safePlace.address,
      safePlace.placeId,
      safePlace.iataCode
    ].map(normalizeLocationComparisonValue).filter(Boolean).join(" | ");
  }

  function isCataloguedAirportTransferPlace(place) {
    return Boolean(getCataloguedAirportTransferId(place));
  }
  
    function getCataloguedAirportTransferId(place) {
    const decision = getCoverageDecision(place);
    const airportCode = normalizeText(decision && decision.airportIataCode).toUpperCase();
    const text = getPlaceSearchText(place);
    const explicitIataCode = normalizeText(place && place.iataCode).toUpperCase();

    if (
      explicitIataCode === "NLU" ||
      text.indexOf("aifa") !== -1 ||
      text.indexOf("aeropuerto internacional felipe angeles") !== -1 ||
      text.indexOf("felipe angeles international airport") !== -1
    ) {
      return "nlu";
    }

    if (
      explicitIataCode === "TLC" ||
      airportCode === "TLC" ||
      text.indexOf("aeropuerto internacional de toluca") !== -1 ||
      text.indexOf("toluca international airport") !== -1 ||
      text.indexOf("licenciado adolfo lopez mateos international airport") !== -1
    ) {
      return "tlc";
    }

    if (
      explicitIataCode === "PBC" ||
      airportCode === "PBC" ||
      text.indexOf("aeropuerto internacional de puebla") !== -1 ||
      text.indexOf("puebla international airport") !== -1 ||
      text.indexOf("hermanos serdan international airport") !== -1
    ) {
      return "pbc";
    }

    if (
      explicitIataCode === "QRO" ||
      airportCode === "QRO" ||
      text.indexOf("aeropuerto intercontinental de queretaro") !== -1 ||
      text.indexOf("queretaro intercontinental airport") !== -1
    ) {
      return "qro";
    }

    if (
      explicitIataCode === "MEX" ||
      text.indexOf("aicm") !== -1 ||
      text.indexOf("aeropuerto internacional de la ciudad de mexico") !== -1 ||
      text.indexOf("benito juarez international airport") !== -1
    ) {
      return "mex";
    }

    return "";
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

  function isDirectTransferCoveredPlace(place) {
    const decision = getCoverageDecision(place);

    return Boolean(decision && decision.isAllowedPrimaryArea === true);
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
      (hasOriginPlace && !isDirectTransferCoveredPlace(state.originPlace)) ||
      (hasDestinationPlace && !isDirectTransferCoveredPlace(state.destinationPlace))
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

    if (!raw.trim()) {
      return fallback;
    }

    if (raw.trim() === ",") {
      return ", ";
    }

    if (raw.trim() === "y") {
      return " y ";
    }

    return raw;
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

  function canContinue() {
    return Boolean(hasRequiredFieldsForQuote() && state.quoteStatus === "ready" && state.quote);
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

  function getTodayDateValue() {
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function isPastDate(value) {
    const date = normalizeText(value);
    const today = getTodayDateValue();

    return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today);
  }
  
  function normalizePastDateField(target) {
    if (
      target &&
      target.getAttribute("data-direct-transfer-mobile-config-field") === "date" &&
      isPastDate(target.value)
    ) {
      target.value = "";
      return true;
    }

    return false;
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

    if (state.quoteStatus === "error") {
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

    if (fare) {
      fare.setAttribute("data-direct-transfer-mobile-fare-state", state.quoteStatus);
    }

    if (fareValue) {
      if (state.quoteStatus === "ready" && state.quote && state.quote.price) {
        fareValue.innerHTML = getFareReadyMarkup();
      } else {
        fareValue.textContent = getFareText();
      }
    }

    return true;
  }

  function syncCta() {
    const step = getStep();
    const cta = step ? step.querySelector(CONFIG_CTA_SELECTOR) : null;
    const isReady = canContinue();

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
    state.quoteStatus = "pending";
    state.quote = null;
    state.quoteErrorCode = "";

    if (quoteTimer) {
      window.clearTimeout(quoteTimer);
      quoteTimer = 0;
    }

    syncCta();

    return true;
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

    if (!quoteApi || typeof quoteApi.requestQuote !== "function") {
      state.quoteStatus = "error";
      state.quote = null;
      state.quoteErrorCode = "QUOTE_API_MISSING";
      syncCta();
      return false;
    }

    quoteRequestId = requestId;
    state.quoteStatus = "loading";
    state.quote = null;
    state.quoteErrorCode = "";
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
            state.quoteErrorCode = result && result.code ? result.code : "QUOTE_UNAVAILABLE";
            syncCta();
            return;
          }

          state.quoteStatus = "ready";
          state.quote = result.quote;
          state.quoteErrorCode = "";
          syncCta();
        })
        .catch(function onQuoteError(error) {
          if (requestId !== quoteRequestId) {
            return;
          }

          state.quoteStatus = "error";
          state.quote = null;
          state.quoteErrorCode = error && error.message ? error.message : "QUOTE_ERROR";
          syncCta();
        });
    }, 220);

    return true;
  }

  function setAddressValue(role, value) {
    if (role === "destination") {
      state.destination = normalizeText(value);
      state.destinationPlace = null;
      resetQuote();
      return true;
    }

    state.origin = normalizeText(value);
    state.originPlace = null;
    resetQuote();
    return true;
  }

  function setAddressPlace(role, selectedPlace) {
    const label = getSelectedPlaceLabel(selectedPlace, "");

    if (role === "destination") {
      state.destination = label || state.destination;
      state.destinationPlace = selectedPlace || null;
      requestQuoteIfReady();
      return true;
    }

    state.origin = label || state.origin;
    state.originPlace = selectedPlace || null;
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
      '<input id="direct-transfer-mobile-date" type="date" class="direct-transfer-mobile-config-step__control" data-direct-transfer-mobile-config-field="date" min="' + escapeHtml(getTodayDateValue()) + '" value="' + escapeHtml(state.date) + '" />',
      '<span class="direct-transfer-mobile-config-step__date-overlay" aria-hidden="true">dd/mm/aaaa</span>',
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
      '<input id="direct-transfer-mobile-time" type="time" class="direct-transfer-mobile-config-step__control" data-direct-transfer-mobile-config-field="time" value="' + escapeHtml(state.time) + '" />',
      '<span class="direct-transfer-mobile-config-step__time-overlay" aria-hidden="true">--:--</span>',
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

        if (cta.disabled || cta.getAttribute("aria-disabled") === "true") {
          return;
        }

        if (contactStepApi && typeof contactStepApi.open === "function") {
          contactStepApi.open(step, buildContactStepPayload());
        }
      }
    });

    step.addEventListener("pixkuy:direct-transfer-mobile-address-place", function onAddressPlace(event) {
      const detail = event.detail || {};
      const role = normalizeText(detail.role);
      const selectedPlace = detail.selectedPlace || null;

      if (role !== "origin" && role !== "destination") {
        return;
      }

      setAddressPlace(role, selectedPlace);
      syncAddressClearState(role);
      syncCta();
    });

    step.addEventListener("input", function onConfigInput(event) {
      if (!event.target || !event.target.matches(CONFIG_FIELD_SELECTOR)) {
        return;
      }

      if (event.target.matches("[data-direct-transfer-mobile-address-input]")) {
        setAddressValue(
          normalizeText(event.target.getAttribute("data-direct-transfer-mobile-address-role")),
          event.target.value
        );
        syncAddressClearState(normalizeText(event.target.getAttribute("data-direct-transfer-mobile-address-role")));
      }

      normalizePastDateField(event.target);
      syncDateTimeOverlayState(event.target);
      syncStateFromFields();
      requestQuoteIfReady();
      syncCta();
    });

    step.addEventListener("change", function onConfigChange(event) {
      if (!event.target || !event.target.matches(CONFIG_FIELD_SELECTOR)) {
        return;
      }

      normalizePastDateField(event.target);
      syncDateTimeOverlayState(event.target);
      syncStateFromFields();
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

  window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
    if (isOpen()) {
      renderStep();
      setStepVisibility(true);
    }
  });
})(window, document);