/* assets/js/services/direct-transfer-panel.js
   Direct Transfer desktop panel.
   Responsabilidad:
   - panel desktop dentro de #services
   - origen/destino con Places desktop
   - restricciones de cobertura/aeropuertos
   - quote real server-side
   NO incluir:
   - route móvil Direct Transfer
   - Contact Step móvil
   - submit Netlify
   - lógica de pricing frontend
*/

(function initServicesDirectTransferPanel(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const PASSENGER_BUCKETS = ["van_1_2", "van_3_4", "van_5_6"];
  const DEFAULT_PASSENGER_BUCKET = "van_1_2";
  const DEFAULT_CURRENCY = "MXN";
  const QUOTE_DEBOUNCE_MS = 220;

  const panelRoot = document.querySelector("[data-services-direct-transfer-panel]");
  const configMount = document.querySelector("[data-services-direct-transfer-config]");

  if (!panelRoot || !configMount) {
    return;
  }

  let quoteTimer = 0;
  let quoteRequestId = 0;
  let addressControllerMountRequestId = 0;
  let controllers = [];

  const state = {
    origin: "",
    originPlace: null,
    originCoverage: null,
    destination: "",
    destinationPlace: null,
    destinationCoverage: null,
    date: "",
    time: "",
    passengerFareKey: DEFAULT_PASSENGER_BUCKET,
    quoteStatus: "pending",
    quote: null,
    quoteErrorCode: ""
  };

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getSafariTimeSelectApi() {
    const api = window.PixkuySafariTimeSelect;

    return api && typeof api.mount === "function" ? api : null;
  }

  function getSafariDesktopTimeSelect() {
    return configMount
      ? configMount.querySelector("[data-direct-transfer-panel-time-select]")
      : null;
  }

  function syncSafariDesktopTimeSelect() {
    const select = getSafariDesktopTimeSelect();

    if (!select) {
      return false;
    }

    if (select.value !== state.time) {
      select.value = state.time || "";
    }

    return true;
  }

  function ensureSafariDesktopTimeFallback() {
    const api = getSafariTimeSelectApi();
    const timeInput = configMount
      ? configMount.querySelector('[data-direct-transfer-panel-field="time"]')
      : null;
    const wrap = timeInput ? timeInput.closest(".services-expand__time-wrap") : null;
    const timeOverlay = wrap
      ? wrap.querySelector(".services-expand__time-overlay")
      : null;
    const result = api && timeInput
      ? api.mount({
          input: timeInput,
          container: timeInput.parentNode,
          overlay: timeOverlay,
          selectSelector: "[data-direct-transfer-panel-time-select]",
          className: "services-expand__control",
          label: getI18nValue("directTransferMobileFlow.fields.time", "Hora"),
          placeholder: getI18nValue("directTransferMobileFlow.fields.timePlaceholder", "--:--"),
          dataAttributeName: "data-direct-transfer-panel-time-select",
          dataAttributeValue: "1",
          getValue: function getValue() {
            return state.time || "";
          },
          onValueChange: function onValueChange(value) {
            state.time = normalizeText(value);
            requestQuoteIfReady();
          }
        })
      : null;

    return Boolean(result && result.mounted);
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
    return String(value == null ? "" : value)
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

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      const value = getValue(dict, path);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    for (let index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function getDocumentLanguage() {
    const language = document.documentElement && document.documentElement.lang;

    return normalizeText(language).toLowerCase() || "es";
  }

  function normalizeGoogleLanguage(language) {
    const value = normalizeText(language).toLowerCase() || "es";

    if (value === "zh-hans") {
      return "zh-CN";
    }

    return value;
  }

  function getQuoteApi() {
    const api = window.PixkuyDirectTransferQuote;

    return api && typeof api === "object" ? api : null;
  }

  function getGooglePlacesApi() {
    const forms = window.PixkuyForms || {};
    const api = forms.googlePlaces;

    return api && typeof api.createAutocompleteController === "function"
      ? api
      : null;
  }
  
    function getDirectTransferCoverageApi() {
    const api = window.PixkuyDirectTransferCoverage;

    return api && typeof api === "object" ? api : null;
  }
  
    function isValidPlacesLocationRestriction(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        Number.isFinite(Number(value.north)) &&
        Number.isFinite(Number(value.south)) &&
        Number.isFinite(Number(value.east)) &&
        Number.isFinite(Number(value.west)) &&
        Number(value.north) > Number(value.south) &&
        Number(value.east) > Number(value.west)
    );
  }

  function clonePlacesLocationRestriction(value) {
    if (!isValidPlacesLocationRestriction(value)) {
      return null;
    }

    return {
      north: Number(value.north),
      south: Number(value.south),
      east: Number(value.east),
      west: Number(value.west)
    };
  }

  function getDirectTransferSearchLocationRestriction() {
    const api = getDirectTransferCoverageApi();

    if (!api || typeof api.getSearchLocationRestriction !== "function") {
      return Promise.resolve(null);
    }

    return api.getSearchLocationRestriction(false).then(function onSearchLocationRestriction(value) {
      return clonePlacesLocationRestriction(value);
    });
  }

  function getNeutralPanelCoverageApi() {
    return {
      getCoverageDecision: function getCoverageDecision() {
        return {
          isWithinCoverage: true
        };
      }
    };
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
      throw new Error("[Pixkuy Direct Transfer Panel] Airport guard is not available.");
    }

    return api;
  }
  
    function getAirportHandoffApi() {
    const api = window.PixkuyDirectTransferAirportHandoff;

    if (
      !api ||
      typeof api.applyToAirport !== "function"
    ) {
      throw new Error("[Pixkuy Direct Transfer Panel] Airport handoff bridge is not available.");
    }

    return api;
  }

  function getCataloguedAirportTransferId(place) {
    return getAirportGuardApi().getCataloguedAirportTransferId(place);
  }

  function isCataloguedAirportTransferPlace(place) {
    return getAirportGuardApi().isCataloguedAirportTransferPlace(place);
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

  function getSelectedPlaceLabel(place, fallback) {
    const safePlace = place && typeof place === "object" ? place : {};

    return normalizeText(
      safePlace.label ||
        safePlace.formattedAddress ||
        safePlace.displayName ||
        fallback
    );
  }

  function getSelectedPlaceId(place) {
    const safePlace = place && typeof place === "object" ? place : {};

    return normalizeText(safePlace.placeId || safePlace.place_id || safePlace.id);
  }

  function getSelectedPlaceCoordinate(place, key) {
    const safePlace = place && typeof place === "object" ? place : {};
    const directValue = safePlace[key];
    const location = safePlace.location && typeof safePlace.location === "object"
      ? safePlace.location
      : {};
    const nestedValue = location[key];
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

  function getPassengerBucketLabel(bucket) {
    const safeBucket = normalizeText(bucket);

    return getI18nValue(
      "directTransferMobileFlow.passengerBuckets." + safeBucket,
      safeBucket
    );
  }

  function buildPassengerOptionsMarkup() {
    return PASSENGER_BUCKETS.map(function mapBucket(bucket) {
      const isSelected = bucket === state.passengerFareKey;

      return [
        '<button',
          ' type="button"',
          ' class="services-expand__passenger-chip services-direct-transfer-panel__passenger-chip"',
          ' data-direct-transfer-panel-passenger-option="' + escapeHtml(bucket) + '"',
          ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"',
        '>',
          '<span class="services-expand__passenger-chip-text">',
            escapeHtml(getPassengerBucketLabel(bucket)),
          '</span>',
        '</button>'
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

  function formatPriceLabel() {
    if (!state.quote || !state.quote.price) {
      return "";
    }

    return [
      "$",
      formatCurrencyAmount(state.quote.price),
      " ",
      getI18nValue("directTransferMobileFlow.fare.readySuffix", state.quote.currency || DEFAULT_CURRENCY)
    ].join("");
  }
  
    function getQuoteNumberValue(keys) {
    const quote = state.quote && typeof state.quote === "object" ? state.quote : {};
    const candidates = Array.isArray(keys) ? keys : [];

    for (let index = 0; index < candidates.length; index += 1) {
      const key = candidates[index];
      const value = quote[key];
      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }

    if (quote.route && typeof quote.route === "object") {
      for (let index = 0; index < candidates.length; index += 1) {
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

  function getFareText() {
    if (state.quoteStatus === "loading") {
      return getI18nValue(
        "directTransferMobileFlow.fare.loading",
        "Calculando precio…"
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

    if (areSameLocations() && state.origin && state.destination) {
      return getI18nValue(
        "directTransferMobileFlow.validation.sameRoute",
        "El origen y el destino no pueden ser iguales."
      );
    }

    if (state.quoteStatus === "error") {
      return getI18nValue(
        "directTransferMobileFlow.fare.unavailable",
        "No pudimos calcular el precio para este trayecto."
      );
    }

    if (state.quoteStatus === "ready" && state.quote && state.quote.price) {
      return formatPriceLabel();
    }

    return getPendingFareText();
  }

  function buildAirportUrl() {
    const context = getAirportTransferContext();
    const params = new URLSearchParams();

    params.set("service", "airport_hotel");

    if (context.airportId) {
      params.set("airport_id", context.airportId);
    }

    if (context.direction) {
      params.set("airport_direction", context.direction);
    }

    return "?" + params.toString() + "#services";
  }
  
    function openAirportPanelFromRestriction() {
    const context = getAirportTransferContext();
    const servicesExpandApi = window.PixkuyServicesExpand;
    const airportHandoffApi = getAirportHandoffApi();
    const url = buildAirportUrl();
    let opened = false;

    if (!context.airportId) {
      return false;
    }

    try {
      window.history.pushState(
        { pixkuyService: "airport_hotel", source: "direct_transfer_airport_restriction" },
        document.title,
        url
      );
    } catch (error) {
      return false;
    }

    if (servicesExpandApi && typeof servicesExpandApi.open === "function") {
      opened = servicesExpandApi.open("airport", {
        behavior: "smooth"
      });
    }

    airportHandoffApi.applyToAirport(buildAirportHandoffInput(context));

    return opened;
  }

  function buildWhatsappUrl() {
    const phone = ["52", "1", "55", "2883", "7400"].join("").replace(/[^\d]/g, "");
    const lines = [];

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

    if (state.quote && state.quote.price) {
      lines.push(getI18nValue("directTransferMobileFlow.whatsapp.price", "Precio estimado") + ": " + formatPriceLabel());
    }

    return phone ? "https://wa.me/" + phone + "?text=" + encodeURIComponent(lines.filter(Boolean).join("\n")) : "#contact";
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

    syncView();

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
      syncView();
      return false;
    }

    quoteRequestId = requestId;
    state.quoteStatus = "loading";
    state.quote = null;
    state.quoteErrorCode = "";
    syncView();

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
            syncView();
            return;
          }

          state.quoteStatus = "ready";
          state.quote = result.quote;
          state.quoteErrorCode = "";
          syncView();
        })
        .catch(function onQuoteError(error) {
          if (requestId !== quoteRequestId) {
            return;
          }

          state.quoteStatus = "error";
          state.quote = null;
          state.quoteErrorCode = error && error.message ? error.message : "QUOTE_ERROR";
          syncView();
        });
    }, QUOTE_DEBOUNCE_MS);

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

  function clearAddress(role) {
    const input = configMount.querySelector('[data-direct-transfer-panel-address-input="' + role + '"]');

    setAddressValue(role, "");

    if (input) {
      input.value = "";
    }

    syncView();

    return true;
  }

  function getDateValue() {
    const input = configMount.querySelector("[data-direct-transfer-panel-field='date']");

    return normalizeText(input && input.value);
  }

  function getTimeValue() {
    const input = configMount.querySelector("[data-direct-transfer-panel-field='time']");

    return normalizeText(input && input.value);
  }

  function getPassengerFareKeyValue() {
    return PASSENGER_BUCKETS.indexOf(state.passengerFareKey) >= 0
      ? state.passengerFareKey
      : DEFAULT_PASSENGER_BUCKET;
  }

  function syncFieldStateFromDom(target) {
    if (target && target.getAttribute("data-direct-transfer-panel-field") === "date" && isPastDate(target.value)) {
      target.value = "";
    }

    state.date = getDateValue();
    state.time = getTimeValue();
    state.passengerFareKey = getPassengerFareKeyValue();

    return true;
  }

  function buildAddressMarkup(role) {
    const isDestination = role === "destination";
    const inputId = isDestination
      ? "direct-transfer-desktop-destination"
      : "direct-transfer-desktop-origin";
    const label = isDestination
      ? getI18nValue("directTransferMobileFlow.fields.destination", "Destino")
      : getI18nValue("directTransferMobileFlow.fields.origin", "Origen");
    const placeholder = isDestination
      ? getI18nValue("directTransferMobileFlow.fields.destinationPlaceholder", "Selecciona punto de destino")
      : getI18nValue("directTransferMobileFlow.fields.originPlaceholder", "Selecciona punto de origen");
    const value = isDestination ? state.destination : state.origin;

    return [
      '<div class="services-direct-transfer-panel__field services-direct-transfer-panel__field--place">',
        '<label class="services-expand__label" for="' + escapeHtml(inputId) + '">' + escapeHtml(label) + '</label>',
        '<div class="place-autocomplete services-direct-transfer-panel__place" data-direct-transfer-panel-address="' + escapeHtml(role) + '">',
          '<input',
            ' id="' + escapeHtml(inputId) + '"',
            ' type="text"',
            ' class="services-expand__control"',
            ' autocomplete="off"',
            ' spellcheck="false"',
            ' value="' + escapeHtml(value) + '"',
            ' placeholder="' + escapeHtml(placeholder) + '"',
            ' data-direct-transfer-panel-address-input="' + escapeHtml(role) + '"',
          ' />',
          '<button type="button" class="place-autocomplete__clear" data-direct-transfer-panel-address-clear="' + escapeHtml(role) + '"' + (value ? "" : " hidden") + '>',
            '<span aria-hidden="true">×</span>',
          '</button>',
          '<div class="place-autocomplete__mount" data-direct-transfer-panel-address-mount="' + escapeHtml(role) + '" aria-hidden="true"></div>',
        '</div>',
      '</div>'
    ].join("");
  }

  
  function buildRestrictionMarkup() {
    const type = getDirectTransferRestrictionType();

    if (!type) {
      return "";
    }

    if (type === "airport") {
      return [
        '<div class="services-direct-transfer-panel__notice">',
          '<p>',
            escapeHtml(getI18nValue("directTransferMobileFlow.validation.airportRoute", "Para traslados desde o hacia los aeropuertos que cubrimos, usa el servicio Aeropuerto / Hotel.")),
            ' ',
            '<a class="services-direct-transfer-panel__link" href="' + escapeHtml(buildAirportUrl()) + '">',
              escapeHtml(getI18nValue("directTransferMobileFlow.cta.airport", "Ir a Aeropuerto / Hotel")),
            '</a>',
          '</p>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="services-direct-transfer-panel__notice">',
        '<p>' + escapeHtml(getI18nValue("directTransferMobileFlow.validation.outOfCoverage", "Este trayecto queda fuera de nuestra zona operativa para traslados directos.")) + '</p>',
        '<div class="services-direct-transfer-panel__notice-actions">',
          '<a class="services-direct-transfer-panel__link" href="' + escapeHtml(buildWhatsappUrl()) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(getI18nValue("directTransferMobileFlow.cta.whatsapp", "WhatsApp")) + '</a>',
          '<a class="services-direct-transfer-panel__link" href="?service=hourly_daily#services">' + escapeHtml(getI18nValue("directTransferMobileFlow.cta.hourly", "Vehículo con conductor")) + '</a>',
        '</div>',
      '</div>'
    ].join("");
  }

  function buildMarkup() {
    const dateLabel = getI18nValue("directTransferMobileFlow.fields.date", "Fecha");
    const timeLabel = getI18nValue("directTransferMobileFlow.fields.time", "Hora");
    const passengersLabel = getI18nValue("directTransferMobileFlow.fields.passengers", "Pasajeros");
    const fareLabel = getI18nValue("directTransferMobileFlow.fare.label", "Precio");
    const ctaText = getI18nValue("directTransferMobileFlow.cta.continue", "Continuar");
    const vehicleLabel = getI18nValue("directTransferMobileFlow.vehicle.title", "BYD M9");
    const isReady = state.quoteStatus === "ready" && state.quote && state.quote.price;

    return [
      '<div class="services-direct-transfer-panel__config-inner">',
        '<div class="services-direct-transfer-panel__route">',
          buildAddressMarkup("origin"),
          buildAddressMarkup("destination"),
        '</div>',

        '<p class="services-direct-transfer-panel__same-route"' + (areSameLocations() && state.origin && state.destination ? '' : ' hidden') + '>',
          escapeHtml(getI18nValue("directTransferMobileFlow.validation.sameRoute", "El origen y el destino no pueden ser iguales.")),
        '</p>',

        buildRestrictionMarkup(),

        '<div class="services-direct-transfer-panel__trip-row">',
          '<div class="services-direct-transfer-panel__field services-direct-transfer-panel__field--passengers">',
            '<label class="services-expand__label" id="direct-transfer-desktop-passengers-label">' + escapeHtml(passengersLabel) + '</label>',
            '<div class="services-expand__passengers-segmented services-direct-transfer-panel__passengers" role="group" aria-labelledby="direct-transfer-desktop-passengers-label">',
              buildPassengerOptionsMarkup(),
            '</div>',
          '</div>',

          '<div class="services-direct-transfer-panel__field services-direct-transfer-panel__field--date services-expand__field--date">',
            '<label class="services-expand__label" for="direct-transfer-desktop-date">' + escapeHtml(dateLabel) + '</label>',
            '<div class="services-expand__date-wrap services-direct-transfer-panel__date-wrap">',
              '<input id="direct-transfer-desktop-date" type="date" class="services-expand__control" min="' + escapeHtml(getTodayDateValue()) + '" value="' + escapeHtml(state.date) + '" data-direct-transfer-panel-field="date" />',
              '<span class="services-expand__date-overlay" aria-hidden="true">' + escapeHtml(getI18nValue("directTransferMobileFlow.fields.datePlaceholder", "dd/mm/aaaa")) + '</span>',
              '<span class="services-expand__date-icon" aria-hidden="true">',
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
                  '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>',
                  '<line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>',
                  '<line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>',
                  '<line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>',
                '</svg>',
              '</span>',
            '</div>',
          '</div>',

          '<div class="services-expand__field services-expand__field--time" data-direct-transfer-panel-time-field>',
            '<label class="services-expand__label" for="direct-transfer-desktop-time">' + escapeHtml(timeLabel) + '</label>',
            '<div class="services-expand__date-wrap services-expand__time-wrap">',
              '<input',
                ' id="direct-transfer-desktop-time"',
                ' type="time"',
                ' class="services-expand__control"',
                ' value="' + escapeHtml(state.time) + '"',
                ' data-direct-transfer-panel-field="time"',
              ' />',
              '<span class="services-expand__date-overlay services-expand__time-overlay" aria-hidden="true">' + escapeHtml(getI18nValue("directTransferMobileFlow.fields.timePlaceholder", "--:--")) + '</span>',
              '<span class="services-expand__date-icon services-expand__time-icon" aria-hidden="true">',
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">',
                  '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>',
                  '<polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>',
                '</svg>',
              '</span>',
            '</div>',
          '</div>',
        '</div>',

        '<div class="services-direct-transfer-panel__summary">',
          '<div class="services-direct-transfer-panel__vehicle">',
            '<img class="services-direct-transfer-panel__vehicle-image" src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="' + escapeHtml(vehicleLabel) + '" loading="lazy" decoding="async" />',
            '<span>' + escapeHtml(vehicleLabel) + '</span>',
          '</div>',

          '<div class="services-expand__field services-expand__field--fare services-direct-transfer-panel__fare" data-direct-transfer-panel-fare-state="' + escapeHtml(state.quoteStatus) + '">',
            '<div class="services-direct-transfer-panel__estimate" data-direct-transfer-panel-estimate hidden>',
              '<p data-direct-transfer-panel-estimate-distance hidden><span>' + escapeHtml(getI18nValue("directTransferMobileFlow.estimate.distanceLabel", "Distancia")) + ':</span> <strong></strong></p>',
              '<p data-direct-transfer-panel-estimate-duration hidden><span>' + escapeHtml(getI18nValue("directTransferMobileFlow.estimate.durationLongLabel", "Tiempo estimado")) + ':</span> <strong></strong></p>',
            '</div>',
            '<span class="services-expand__label">' + escapeHtml(fareLabel) + '</span>',
            '<strong class="services-expand__fare services-direct-transfer-panel__fare-value">' + escapeHtml(getFareText()) + '</strong>',
            '<div class="services-direct-transfer-panel__airport-action" data-direct-transfer-panel-airport-action hidden>',
              '<a class="services-direct-transfer-panel__airport-link" data-direct-transfer-panel-airport-link href="' + escapeHtml(buildAirportUrl()) + '">',
                escapeHtml(getI18nValue("directTransferMobileFlow.cta.airport", "Ir a Aeropuerto / Hotel")),
              '</a>',
            '</div>',
          '</div>',

          '<button type="button" class="services-expand__cta services-direct-transfer-panel__cta" data-direct-transfer-panel-cta' + (isReady ? '' : ' disabled aria-disabled="true"') + '>',
            escapeHtml(ctaText),
          '</button>',
        '</div>',
      '</div>'
    ].join("");
  }

  
  function destroyControllers() {
    controllers.forEach(function destroy(controller) {
      if (controller && typeof controller.destroy === "function") {
        controller.destroy();
      }
    });

    controllers = [];
  }

  function mountAddressControllers() {
    const googlePlacesApi = getGooglePlacesApi();
    const language = normalizeGoogleLanguage(getDocumentLanguage());
    const mountRequestId = addressControllerMountRequestId + 1;

    addressControllerMountRequestId = mountRequestId;
    destroyControllers();

    if (!googlePlacesApi) {
      return false;
    }

    getDirectTransferSearchLocationRestriction()
      .then(function onLocationRestrictionReady(locationRestriction) {
        if (mountRequestId !== addressControllerMountRequestId) {
          return;
        }

        if (!isValidPlacesLocationRestriction(locationRestriction)) {
          return;
        }

        ["origin", "destination"].forEach(function mountAddress(role) {
          const input = configMount.querySelector('[data-direct-transfer-panel-address-input="' + role + '"]');
          const mountNode = configMount.querySelector('[data-direct-transfer-panel-address-mount="' + role + '"]');
          const clearButton = configMount.querySelector('[data-direct-transfer-panel-address-clear="' + role + '"]');

          if (!input || !mountNode) {
            return;
          }

          const controller = googlePlacesApi.createAutocompleteController({
            fieldName: "direct_transfer_" + role,
            input,
            mountNode,
            hiddenFields: {},
            language,
            region: "mx",
            includedRegionCodes: ["mx"],
            locationRestriction: clonePlacesLocationRestriction(locationRestriction),
            coverageApi: getNeutralPanelCoverageApi(),
            onSelection: function onSelection(selectedPlace, meta) {
              const safeMeta = meta && typeof meta === "object" ? meta : {};
              const shouldPreserveVisibleInput = safeMeta.preserveInputValue === true;

              if (!selectedPlace) {
                if (!shouldPreserveVisibleInput) {
                  setAddressValue(role, input.value);
                }
                syncView();
                return;
              }

              setAddressPlace(role, selectedPlace).then(function onAddressPlaceApplied() {
                if (clearButton) {
                  clearButton.hidden = !normalizeText(input.value);
                }

                syncView();
              });
            },
            onCoverageReject: function onCoverageReject() {},
            onManualFallback: function onManualFallback() {},
            onError: function onError() {}
          });

          controllers.push(controller);
          controller.mount();
        });
      })
      .catch(function onLocationRestrictionError() {});

    return true;
  }

  function syncView() {
    const fare = configMount.querySelector(".services-direct-transfer-panel__fare");
    const fareValue = configMount.querySelector(".services-direct-transfer-panel__fare-value");
    const cta = configMount.querySelector("[data-direct-transfer-panel-cta]");
    const sameRoute = configMount.querySelector(".services-direct-transfer-panel__same-route");
    const originClear = configMount.querySelector('[data-direct-transfer-panel-address-clear="origin"]');
    const destinationClear = configMount.querySelector('[data-direct-transfer-panel-address-clear="destination"]');
    const passengerButtons = Array.from(
      configMount.querySelectorAll("[data-direct-transfer-panel-passenger-option]")
    );
    const estimate = configMount.querySelector("[data-direct-transfer-panel-estimate]");
    const estimateDistance = configMount.querySelector("[data-direct-transfer-panel-estimate-distance]");
    const estimateDuration = configMount.querySelector("[data-direct-transfer-panel-estimate-duration]");
    const airportAction = configMount.querySelector("[data-direct-transfer-panel-airport-action]");
    const airportLink = configMount.querySelector("[data-direct-transfer-panel-airport-link]");
    const restrictionType = getDirectTransferRestrictionType();
    const isReady = state.quoteStatus === "ready" && state.quote && state.quote.price;

    syncSafariDesktopTimeSelect();

    if (fare) {
      fare.setAttribute("data-direct-transfer-panel-fare-state", state.quoteStatus);
    }

    if (fareValue) {
      fareValue.textContent = getFareText();
    }

    if (airportAction) {
      airportAction.hidden = restrictionType !== "airport";
    }

    if (airportLink) {
      airportLink.setAttribute("href", buildAirportUrl());
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

    if (cta) {
      cta.disabled = !isReady;
      cta.setAttribute("aria-disabled", isReady ? "false" : "true");
    }

    if (sameRoute) {
      sameRoute.hidden = !(areSameLocations() && state.origin && state.destination);
    }

    if (originClear) {
      originClear.hidden = !state.origin;
    }

    if (destinationClear) {
      destinationClear.hidden = !state.destination;
    }
	
	    passengerButtons.forEach(function syncPassengerButton(button) {
      const fareKey = normalizeText(
        button.getAttribute("data-direct-transfer-panel-passenger-option")
      );
      const isSelected = fareKey === state.passengerFareKey;

      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.classList.toggle("is-active", isSelected);
    });

    return true;
  }

  function render() {
    configMount.hidden = false;
    configMount.innerHTML = buildMarkup();
    ensureSafariDesktopTimeFallback();
    mountAddressControllers();
    syncView();
    return true;
  }

  function bindEvents() {
    if (configMount.dataset.directTransferPanelBound === "1") {
      return false;
    }

    configMount.dataset.directTransferPanelBound = "1";

    configMount.addEventListener("input", function onInput(event) {
      const addressInput = event.target.closest("[data-direct-transfer-panel-address-input]");
      const field = event.target.closest("[data-direct-transfer-panel-field]");

      if (addressInput) {
        setAddressValue(
          normalizeText(addressInput.getAttribute("data-direct-transfer-panel-address-input")),
          addressInput.value
        );
        return;
      }

      if (field) {
        syncFieldStateFromDom(field);
        requestQuoteIfReady();
      }
    });

    configMount.addEventListener("change", function onChange(event) {
      const field = event.target.closest("[data-direct-transfer-panel-field]");

      if (!field) {
        return;
      }

      syncFieldStateFromDom(field);
      requestQuoteIfReady();
    });

    configMount.addEventListener("click", function onClick(event) {
      const clearButton = event.target.closest("[data-direct-transfer-panel-address-clear]");
      const passengerButton = event.target.closest("[data-direct-transfer-panel-passenger-option]");
      const airportLink = event.target.closest("[data-direct-transfer-panel-airport-link]");
      const cta = event.target.closest("[data-direct-transfer-panel-cta]");

      if (clearButton) {
        event.preventDefault();
        clearAddress(normalizeText(clearButton.getAttribute("data-direct-transfer-panel-address-clear")));
        return;
      }
	  
	        if (airportLink) {
        event.preventDefault();

        if (!openAirportPanelFromRestriction()) {
          window.location.href = buildAirportUrl();
        }

        return;
      }
	  
	        if (passengerButton) {
        event.preventDefault();

        const nextFareKey = normalizeText(
          passengerButton.getAttribute("data-direct-transfer-panel-passenger-option")
        );

        if (PASSENGER_BUCKETS.indexOf(nextFareKey) === -1) {
          return;
        }

        state.passengerFareKey = nextFareKey;
        syncView();
        requestQuoteIfReady();
        return;
      }

      if (cta) {
        event.preventDefault();

        if (cta.disabled || cta.getAttribute("aria-disabled") === "true") {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("pixkuy:direct-transfer-panel-submit", {
            detail: {
              originAddress: normalizeQuoteAddress(state.originPlace, state.origin),
              destinationAddress: normalizeQuoteAddress(state.destinationPlace, state.destination),
              direct_transfer_date: state.date,
              direct_transfer_time: state.time,
              direct_transfer_passenger_fare_key: state.passengerFareKey,
              direct_transfer_passenger_bucket_label: getPassengerBucketLabel(state.passengerFareKey),
              direct_transfer_price: state.quote && state.quote.price != null ? String(state.quote.price) : "",
              direct_transfer_currency: state.quote && state.quote.currency ? state.quote.currency : DEFAULT_CURRENCY,
              direct_transfer_duration_seconds: state.quote && state.quote.durationSeconds != null ? String(Math.round(Number(state.quote.durationSeconds))) : "",
              direct_transfer_distance_meters: state.quote && state.quote.distanceMeters != null ? String(Math.round(Number(state.quote.distanceMeters))) : "",
              direct_transfer_vehicle_label: getI18nValue("directTransferMobileFlow.vehicle.title", "BYD M9"),
              direct_transfer_price_label: formatPriceLabel(),
              quote: state.quote
            }
          })
        );
      }
    });

    return true;
  }

  render();
  bindEvents();

  window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
    render();
  });
})(window, document);