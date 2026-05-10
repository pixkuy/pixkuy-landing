/* assets/js/forms/contact-direct-transfer-editor.js
   Editor Direct Transfer dentro de #contact.
   Responsabilidad:
   - recibir handoff desde el panel desktop de direct_transfer
   - editar origen/destino/fecha/hora/pasajeros/notas en #contact
   - montar Places para origen/destino con el runtime compartido
   - aplicar las mismas restricciones operativas que el panel desktop
   - recalcular quote server-side
   - escribir payload semántico direct_transfer_*
   - sincronizar estado del formulario final
   NO incluir:
   - panel comercial de #services
   - cálculo de precio frontend
   - cambios en Google Places compartido
   - flujo móvil Direct Transfer
   - submit Netlify directo
*/

(function initContactDirectTransferEditorModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});
  const SERVICE_TYPE = "direct_transfer";
  const DEFAULT_CURRENCY = "MXN";
  const DEFAULT_PASSENGER_BUCKET = "van_1_2";
  const PASSENGER_BUCKETS = ["van_1_2", "van_3_4", "van_5_6"];
  const QUOTE_DEBOUNCE_MS = 220;

  const state = {
    origin: "",
    originPlace: null,
    originCoverage: null,
    destination: "",
    destinationPlace: null,
    destinationCoverage: null,
    tripDate: "",
    tripTime: "",
    passengerFareKey: DEFAULT_PASSENGER_BUCKET,
    price: "",
    currency: DEFAULT_CURRENCY,
    durationSeconds: "",
    distanceMeters: "",
    quoteStatus: "pending",
    quoteErrorCode: "",
    notes: ""
  };

  let quoteTimer = 0;
  let quoteRequestId = 0;
  let controllers = [];

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
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      return NAMESPACE.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
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

  function getDocumentLanguage() {
    const language = document.documentElement && document.documentElement.lang;
    return normalizeText(language).toLowerCase() || "es";
  }

  function normalizeGoogleLanguage(language) {
    const value = normalizeText(language).toLowerCase() || "es";
    return value === "zh-hans" ? "zh-CN" : value;
  }

  function getQuoteApi() {
    const api = window.PixkuyDirectTransferQuote;
    return api && typeof api === "object" ? api : null;
  }

  function getGooglePlacesApi() {
    const api = NAMESPACE.googlePlaces;
    return api && typeof api.createAutocompleteController === "function"
      ? api
      : null;
  }

  function getCoverageApi() {
    const api = NAMESPACE.coverage;
    return api && typeof api === "object" ? api : null;
  }

  function getCoverageDecision(place) {
    const api = getCoverageApi();

    if (!api || typeof api.getCoverageDecision !== "function") {
      return null;
    }

    return api.getCoverageDecision(place);
  }
  
    function getDirectTransferCoverageApi() {
    const api = window.PixkuyDirectTransferCoverage;

    return api && typeof api === "object" ? api : null;
  }

  function getNeutralEditorCoverageApi() {
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

  function isDirectTransferServiceActive(form) {
    const reservationForm = form || getReservationForm();
    const serviceTypeField = reservationForm
      ? reservationForm.querySelector('input[name="service_type"]')
      : null;

    return normalizeText(serviceTypeField && serviceTypeField.value) === SERVICE_TYPE;
  }

  function getServiceLabel() {
    return getI18nValue(
      "directTransferMobileFlow.whatsapp.serviceLabel",
      getI18nValue("directTransferMobileFlow.title", "Traslado directo")
    );
  }

  function getVehicleLabel() {
    return getI18nValue("directTransferMobileFlow.vehicle.title", "BYD M9");
  }

  function getPassengerBucketLabel(bucket) {
    const safeBucket = normalizeText(bucket);

    return getI18nValue(
      "directTransferMobileFlow.passengerBuckets." + safeBucket,
      safeBucket
    );
  }

  function getFieldLabel(key, fallback) {
    return getI18nValue("directTransferMobileFlow.contactStep.summary." + key, fallback);
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
    const location = safePlace.location && typeof safePlace.location === "object"
      ? safePlace.location
      : {};
    const directValue = safePlace[key];
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
      safePlace.iataCode
    ].map(normalizeLocationComparisonValue).filter(Boolean).join(" | ");
  }

  function getCataloguedAirportTransferId(place) {
    const decision = getCoverageDecision(place);
    const airportCode = normalizeText(decision && decision.airportIataCode).toUpperCase();
    const explicitIataCode = normalizeText(place && place.iataCode).toUpperCase();
    const text = getPlaceSearchText(place);

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

  function isCataloguedAirportTransferPlace(place) {
    return Boolean(getCataloguedAirportTransferId(place));
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

  function areSameLocations(nodes) {
    const safeNodes = nodes && typeof nodes === "object" ? nodes : {};
    const originPlaceId = getSelectedPlaceId(state.originPlace);
    const destinationPlaceId = getSelectedPlaceId(state.destinationPlace);
    const originInputText = safeNodes.originInput
      ? safeNodes.originInput.value
      : state.origin;
    const destinationInputText = safeNodes.destinationInput
      ? safeNodes.destinationInput.value
      : state.destination;
    const originText = normalizeLocationComparisonValue(originInputText || state.origin);
    const destinationText = normalizeLocationComparisonValue(destinationInputText || state.destination);

    if (originPlaceId && destinationPlaceId) {
      return originPlaceId === destinationPlaceId;
    }

    if (!originText || !destinationText) {
      return false;
    }

    return originText === destinationText;
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

  function formatCurrency(value, currency) {
    const numericValue = Number(value);
    const currencyCode = normalizeText(currency) || DEFAULT_CURRENCY;

    if (!Number.isFinite(numericValue)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(numericValue) + " " + currencyCode;
    } catch (error) {
      return String(Math.round(numericValue)) + " " + currencyCode;
    }
  }

  function formatDistanceLabel(value) {
    const meters = Number(value);

    if (!Number.isFinite(meters) || meters <= 0) {
      return "";
    }

    const kilometers = meters / 1000;
    const roundedKilometers = kilometers >= 10
      ? Math.round(kilometers)
      : Math.round(kilometers * 10) / 10;

    return String(roundedKilometers).replace(".", ",") + " km";
  }

  function formatDurationLabel(value) {
    const seconds = Number(value);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "";
    }

    return String(Math.max(1, Math.round(seconds / 60))) + " min aprox.";
  }

  function getPriceLabelValue() {
    return formatCurrency(state.price, state.currency);
  }

  function getFareText(nodes) {
    if (state.quoteStatus === "loading") {
      return getI18nValue("directTransferMobileFlow.fare.loading", "Calculando precio…");
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

    if (areSameLocations(nodes) && state.origin && state.destination) {
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

    if (state.quoteStatus === "ready" && state.price) {
      return getPriceLabelValue();
    }

    return getI18nValue(
      "directTransferMobileFlow.fare.pending",
      "Completa los datos del traslado para calcular el precio."
    );
  }

  function buildTripSummary() {
    const parts = [];
    const priceLabel = getPriceLabelValue();
    const distanceLabel = formatDistanceLabel(state.distanceMeters);
    const durationLabel = formatDurationLabel(state.durationSeconds);

    if (state.origin) {
      parts.push(getFieldLabel("origin", "Origen") + ": " + state.origin);
    }

    if (state.destination) {
      parts.push(getFieldLabel("destination", "Destino") + ": " + state.destination);
    }

    if (state.tripDate) {
      parts.push(getFieldLabel("date", "Fecha") + ": " + state.tripDate);
    }

    if (state.tripTime) {
      parts.push(getFieldLabel("time", "Hora") + ": " + state.tripTime);
    }

    if (state.passengerFareKey) {
      parts.push(getFieldLabel("passengers", "Pasajeros") + ": " + getPassengerBucketLabel(state.passengerFareKey));
    }

    parts.push(getFieldLabel("vehicle", "Vehículo") + ": " + getVehicleLabel());

    if (distanceLabel) {
      parts.push("Distancia: " + distanceLabel);
    }

    if (durationLabel) {
      parts.push("Tiempo estimado: " + durationLabel);
    }

    if (priceLabel) {
      parts.push(getFieldLabel("price", "Precio") + ": " + priceLabel);
    }

    return parts.join(" | ");
  }

  function getEditorRoot(form) {
    if (!form) {
      return null;
    }

    return form.querySelector("[data-contact-direct-transfer-editor]");
  }

  function getEditorNodes(form) {
    const root = getEditorRoot(form);

    if (!root) {
      return null;
    }

    return {
      root: root,

      originInput: root.querySelector("[data-contact-direct-transfer-origin-input]"),
      originMount: root.querySelector("[data-contact-direct-transfer-origin-mount]"),
      originClear: root.querySelector("[data-contact-direct-transfer-origin-clear]"),

      destinationInput: root.querySelector("[data-contact-direct-transfer-destination-input]"),
      destinationMount: root.querySelector("[data-contact-direct-transfer-destination-mount]"),
      destinationClear: root.querySelector("[data-contact-direct-transfer-destination-clear]"),

      dateInput: root.querySelector("[data-contact-direct-transfer-date]"),
      timeInput: root.querySelector("[data-contact-direct-transfer-time]"),
      passengerButtons: Array.from(root.querySelectorAll("[data-contact-direct-transfer-passenger-option]")),

      status: root.querySelector("[data-contact-direct-transfer-status]"),
      distanceValue: root.querySelector("[data-contact-direct-transfer-distance]"),
      durationValue: root.querySelector("[data-contact-direct-transfer-duration]"),
      priceBlock: root.querySelector("[data-contact-direct-transfer-price]"),
      priceValue: root.querySelector("[data-contact-direct-transfer-price-value]"),
      notesInput: root.querySelector("[data-contact-direct-transfer-notes]"),

      hiddenServiceLabel: form.querySelector('input[name="service_label"]'),
      hiddenRequestSummary: form.querySelector('input[name="request_summary"]'),

      hiddenTripSummary: form.querySelector('input[name="direct_transfer_trip_summary"]'),
      hiddenOriginLabel: form.querySelector('input[name="direct_transfer_origin_label"]'),
      hiddenDestinationLabel: form.querySelector('input[name="direct_transfer_destination_label"]'),
      hiddenPassengerBucketLabel: form.querySelector('input[name="direct_transfer_passenger_bucket_label"]'),
      hiddenPriceLabel: form.querySelector('input[name="direct_transfer_price_label"]'),

      hiddenOriginAddress: form.querySelector('input[name="direct_transfer_origin_address"]'),
      hiddenOriginPlaceId: form.querySelector('input[name="direct_transfer_origin_place_id"]'),
      hiddenOriginLat: form.querySelector('input[name="direct_transfer_origin_lat"]'),
      hiddenOriginLng: form.querySelector('input[name="direct_transfer_origin_lng"]'),
      hiddenDestinationAddress: form.querySelector('input[name="direct_transfer_destination_address"]'),
      hiddenDestinationPlaceId: form.querySelector('input[name="direct_transfer_destination_place_id"]'),
      hiddenDestinationLat: form.querySelector('input[name="direct_transfer_destination_lat"]'),
      hiddenDestinationLng: form.querySelector('input[name="direct_transfer_destination_lng"]'),
      hiddenDate: form.querySelector('input[name="direct_transfer_date"]'),
      hiddenTime: form.querySelector('input[name="direct_transfer_time"]'),
      hiddenPassengerFareKey: form.querySelector('input[name="direct_transfer_passenger_fare_key"]'),
      hiddenPassengerBucketLabelSemantic: form.querySelector('input[name="direct_transfer_passenger_bucket_label"]'),
      hiddenPrice: form.querySelector('input[name="direct_transfer_price"]'),
      hiddenCurrency: form.querySelector('input[name="direct_transfer_currency"]'),
      hiddenDurationSeconds: form.querySelector('input[name="direct_transfer_duration_seconds"]'),
      hiddenDistanceMeters: form.querySelector('input[name="direct_transfer_distance_meters"]'),
      hiddenVehicleLabel: form.querySelector('input[name="direct_transfer_vehicle_label"]'),
      hiddenNotes: form.querySelector('input[name="direct_transfer_notes"]')
    };
  }

  function hasCriticalNodes(nodes) {
    return Boolean(
      nodes &&
        nodes.root &&
        nodes.originInput &&
        nodes.originMount &&
        nodes.originClear &&
        nodes.destinationInput &&
        nodes.destinationMount &&
        nodes.destinationClear &&
        nodes.dateInput &&
        nodes.timeInput &&
        nodes.passengerButtons &&
        nodes.passengerButtons.length === PASSENGER_BUCKETS.length &&
        nodes.status &&
        nodes.distanceValue &&
        nodes.durationValue &&
        nodes.priceBlock &&
        nodes.priceValue &&
        nodes.notesInput &&
        nodes.hiddenServiceLabel &&
        nodes.hiddenRequestSummary &&
        nodes.hiddenTripSummary &&
        nodes.hiddenOriginLabel &&
        nodes.hiddenDestinationLabel &&
        nodes.hiddenPassengerBucketLabel &&
        nodes.hiddenPriceLabel &&
        nodes.hiddenOriginAddress &&
        nodes.hiddenOriginPlaceId &&
        nodes.hiddenOriginLat &&
        nodes.hiddenOriginLng &&
        nodes.hiddenDestinationAddress &&
        nodes.hiddenDestinationPlaceId &&
        nodes.hiddenDestinationLat &&
        nodes.hiddenDestinationLng &&
        nodes.hiddenDate &&
        nodes.hiddenTime &&
        nodes.hiddenPassengerFareKey &&
        nodes.hiddenPassengerBucketLabelSemantic &&
        nodes.hiddenPrice &&
        nodes.hiddenCurrency &&
        nodes.hiddenDurationSeconds &&
        nodes.hiddenDistanceMeters &&
        nodes.hiddenVehicleLabel &&
        nodes.hiddenNotes
    );
  }

  function writeHiddenValue(field, value) {
    if (!field) {
      return;
    }

    field.value = value === null || value === undefined ? "" : String(value);
  }

  function clearHiddenFields(nodes) {
    writeHiddenValue(nodes.hiddenTripSummary, "");
    writeHiddenValue(nodes.hiddenOriginLabel, "");
    writeHiddenValue(nodes.hiddenDestinationLabel, "");
    writeHiddenValue(nodes.hiddenPassengerBucketLabel, "");
    writeHiddenValue(nodes.hiddenPriceLabel, "");
    writeHiddenValue(nodes.hiddenOriginAddress, "");
    writeHiddenValue(nodes.hiddenOriginPlaceId, "");
    writeHiddenValue(nodes.hiddenOriginLat, "");
    writeHiddenValue(nodes.hiddenOriginLng, "");
    writeHiddenValue(nodes.hiddenDestinationAddress, "");
    writeHiddenValue(nodes.hiddenDestinationPlaceId, "");
    writeHiddenValue(nodes.hiddenDestinationLat, "");
    writeHiddenValue(nodes.hiddenDestinationLng, "");
    writeHiddenValue(nodes.hiddenDate, "");
    writeHiddenValue(nodes.hiddenTime, "");
    writeHiddenValue(nodes.hiddenPassengerFareKey, "");
    writeHiddenValue(nodes.hiddenPassengerBucketLabelSemantic, "");
    writeHiddenValue(nodes.hiddenPrice, "");
    writeHiddenValue(nodes.hiddenCurrency, "");
    writeHiddenValue(nodes.hiddenDurationSeconds, "");
    writeHiddenValue(nodes.hiddenDistanceMeters, "");
    writeHiddenValue(nodes.hiddenVehicleLabel, "");
    writeHiddenValue(nodes.hiddenNotes, "");
  }

  function syncHiddenFields(nodes) {
    const form = getReservationForm();
    const isActive = isDirectTransferServiceActive(form);
    const priceLabel = getPriceLabelValue();
    const tripSummary = buildTripSummary();
    const originAddress = normalizeQuoteAddress(state.originPlace, state.origin);
    const destinationAddress = normalizeQuoteAddress(state.destinationPlace, state.destination);

    if (!isActive) {
      clearHiddenFields(nodes);
      return true;
    }

    writeHiddenValue(nodes.hiddenServiceLabel, getServiceLabel());
    writeHiddenValue(nodes.hiddenRequestSummary, tripSummary);

    writeHiddenValue(nodes.hiddenTripSummary, tripSummary);
    writeHiddenValue(nodes.hiddenOriginLabel, state.origin);
    writeHiddenValue(nodes.hiddenDestinationLabel, state.destination);
    writeHiddenValue(nodes.hiddenPassengerBucketLabel, getPassengerBucketLabel(state.passengerFareKey));
    writeHiddenValue(nodes.hiddenPriceLabel, priceLabel);

    writeHiddenValue(nodes.hiddenOriginAddress, state.origin);
    writeHiddenValue(nodes.hiddenOriginPlaceId, originAddress ? originAddress.placeId : "");
    writeHiddenValue(nodes.hiddenOriginLat, originAddress ? String(originAddress.lat) : "");
    writeHiddenValue(nodes.hiddenOriginLng, originAddress ? String(originAddress.lng) : "");
    writeHiddenValue(nodes.hiddenDestinationAddress, state.destination);
    writeHiddenValue(nodes.hiddenDestinationPlaceId, destinationAddress ? destinationAddress.placeId : "");
    writeHiddenValue(nodes.hiddenDestinationLat, destinationAddress ? String(destinationAddress.lat) : "");
    writeHiddenValue(nodes.hiddenDestinationLng, destinationAddress ? String(destinationAddress.lng) : "");
    writeHiddenValue(nodes.hiddenDate, state.tripDate);
    writeHiddenValue(nodes.hiddenTime, state.tripTime);
    writeHiddenValue(nodes.hiddenPassengerFareKey, state.passengerFareKey);
    writeHiddenValue(nodes.hiddenPassengerBucketLabelSemantic, getPassengerBucketLabel(state.passengerFareKey));
    writeHiddenValue(nodes.hiddenPrice, state.price);
    writeHiddenValue(nodes.hiddenCurrency, state.price ? state.currency : "");
    writeHiddenValue(nodes.hiddenDurationSeconds, state.durationSeconds);
    writeHiddenValue(nodes.hiddenDistanceMeters, state.distanceMeters);
    writeHiddenValue(nodes.hiddenVehicleLabel, getVehicleLabel());
    writeHiddenValue(nodes.hiddenNotes, state.notes);

    return true;
  }

  function syncReservationRequestState() {
    const form = getReservationForm();

    if (
      !form ||
      typeof NAMESPACE.getReservationRequestFields !== "function" ||
      typeof NAMESPACE.syncReservationRequestState !== "function"
    ) {
      return false;
    }

    NAMESPACE.syncReservationRequestState(
      NAMESPACE.getReservationRequestFields(form)
    );

    return true;
  }

  function resetQuote() {
    quoteRequestId += 1;
    state.quoteStatus = "pending";
    state.quoteErrorCode = "";
    state.price = "";
    state.currency = DEFAULT_CURRENCY;
    state.durationSeconds = "";
    state.distanceMeters = "";

    if (quoteTimer) {
      window.clearTimeout(quoteTimer);
      quoteTimer = 0;
    }

    return true;
  }

  function hasRequiredFieldsForQuote(nodes) {
    return Boolean(
      state.origin &&
        state.destination &&
        !areSameLocations(nodes) &&
        !getDirectTransferRestrictionType() &&
        state.tripDate &&
        state.tripTime &&
        state.passengerFareKey &&
        normalizeQuoteAddress(state.originPlace, state.origin) &&
        normalizeQuoteAddress(state.destinationPlace, state.destination)
    );
  }

  function buildQuoteInput() {
    return {
      originAddress: normalizeQuoteAddress(state.originPlace, state.origin),
      destinationAddress: normalizeQuoteAddress(state.destinationPlace, state.destination),
      pickupDate: state.tripDate,
      pickupTime: state.tripTime,
      passengerFareKey: state.passengerFareKey
    };
  }

  function requestQuoteIfReady(nodes) {
    const quoteApi = getQuoteApi();
    const requestId = quoteRequestId + 1;

    if (quoteTimer) {
      window.clearTimeout(quoteTimer);
      quoteTimer = 0;
    }

    if (!hasRequiredFieldsForQuote(nodes)) {
      resetQuote();
      syncView(nodes);
      return false;
    }

    if (!quoteApi || typeof quoteApi.requestQuote !== "function") {
      state.quoteStatus = "error";
      state.quoteErrorCode = "QUOTE_API_MISSING";
      syncView(nodes);
      return false;
    }

    quoteRequestId = requestId;
    state.quoteStatus = "loading";
    state.quoteErrorCode = "";
    state.price = "";
    state.currency = DEFAULT_CURRENCY;
    state.durationSeconds = "";
    state.distanceMeters = "";
    syncView(nodes);

    quoteTimer = window.setTimeout(function quoteDebounced() {
      quoteApi.requestQuote(buildQuoteInput())
        .then(function onQuoteResult(result) {
          const quote = result && result.quote && typeof result.quote === "object"
            ? result.quote
            : null;

          if (requestId !== quoteRequestId) {
            return;
          }

          if (!result || result.ok !== true || !quote || !quote.price) {
            state.quoteStatus = "error";
            state.quoteErrorCode = result && result.code ? result.code : "QUOTE_UNAVAILABLE";
            state.price = "";
            state.currency = DEFAULT_CURRENCY;
            state.durationSeconds = "";
            state.distanceMeters = "";
            syncView(nodes);
            return;
          }

          state.quoteStatus = "ready";
          state.quoteErrorCode = "";
          state.price = String(quote.price);
          state.currency = normalizeText(quote.currency) || DEFAULT_CURRENCY;
          state.durationSeconds = quote.durationSeconds != null ? String(Math.round(Number(quote.durationSeconds))) : "";
          state.distanceMeters = quote.distanceMeters != null ? String(Math.round(Number(quote.distanceMeters))) : "";
          syncView(nodes);
        })
        .catch(function onQuoteError(error) {
          if (requestId !== quoteRequestId) {
            return;
          }

          state.quoteStatus = "error";
          state.quoteErrorCode = error && error.message ? error.message : "QUOTE_ERROR";
          state.price = "";
          state.currency = DEFAULT_CURRENCY;
          state.durationSeconds = "";
          state.distanceMeters = "";
          syncView(nodes);
        });
    }, QUOTE_DEBOUNCE_MS);

    return true;
  }

  function syncStatus(nodes) {
    const text = getFareText(nodes);
    const restrictionType = getDirectTransferRestrictionType();
    const shouldShowStatus = (
      state.quoteStatus === "loading" ||
      state.quoteStatus === "error" ||
      restrictionType ||
      (areSameLocations(nodes) && state.origin && state.destination)
    );

    nodes.status.hidden = !shouldShowStatus;

    if (!shouldShowStatus) {
      nodes.status.textContent = "";
      return true;
    }

    if (restrictionType === "airport") {
      nodes.status.innerHTML = [
        escapeHtml(text),
        " ",
        '<a class="services-direct-transfer-panel__link" href="' + escapeHtml(buildAirportUrl()) + '">',
          escapeHtml(getI18nValue("directTransferMobileFlow.cta.airport", "Ir a Aeropuerto / Hotel")),
        "</a>"
      ].join("");
      return true;
    }

    nodes.status.textContent = text;
    return true;
  }

  function syncView(nodes, options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const priceLabel = getPriceLabelValue();
    const distanceLabel = formatDistanceLabel(state.distanceMeters);
    const durationLabel = formatDurationLabel(state.durationSeconds);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    if (nodes.dateInput.value !== state.tripDate) {
      nodes.dateInput.value = state.tripDate;
    }

    if (nodes.timeInput.value !== state.tripTime) {
      nodes.timeInput.value = state.tripTime;
    }

    if (nodes.notesInput.value !== state.notes) {
      nodes.notesInput.value = state.notes;
    }

    nodes.originClear.hidden = !state.origin;
    nodes.destinationClear.hidden = !state.destination;

    nodes.passengerButtons.forEach(function syncPassengerButton(button) {
      const fareKey = normalizeText(
        button.getAttribute("data-contact-direct-transfer-passenger-option")
      );
      const isSelected = fareKey === state.passengerFareKey;

      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.classList.toggle("is-active", isSelected);
    });

    nodes.distanceValue.textContent = distanceLabel || "—";
    nodes.durationValue.textContent = durationLabel || "—";
    nodes.priceValue.textContent = priceLabel || "—";
    nodes.priceBlock.hidden = !priceLabel;

    syncStatus(nodes);
    syncHiddenFields(nodes);

    if (safeOptions.syncReservationState !== false) {
      syncReservationRequestState();
    }

    return true;
  }

  async function setAddressPlace(nodes, role, selectedPlace) {
    const label = getSelectedPlaceLabel(selectedPlace, "");
    const coverage = await resolveDirectTransferCoverage(selectedPlace);

    if (role === "destination") {
      state.destination = label || state.destination;
      state.destinationPlace = selectedPlace || null;
      state.destinationCoverage = coverage;

      if (nodes.destinationInput && label) {
        nodes.destinationInput.value = label;
      }

      requestQuoteIfReady(nodes);
      return true;
    }

    state.origin = label || state.origin;
    state.originPlace = selectedPlace || null;
    state.originCoverage = coverage;

    if (nodes.originInput && label) {
      nodes.originInput.value = label;
    }

    requestQuoteIfReady(nodes);
    return true;
  }

  function setAddressValue(nodes, role, value) {
    if (role === "destination") {
      state.destination = normalizeText(value);
      state.destinationPlace = null;
      state.destinationCoverage = null;
      resetQuote();
      syncView(nodes);
      return true;
    }

    state.origin = normalizeText(value);
    state.originPlace = null;
    state.originCoverage = null;
    resetQuote();
    syncView(nodes);
    return true;
  }

  function clearAddress(nodes, role) {
    if (role === "destination") {
      setAddressValue(nodes, "destination", "");

      if (nodes.destinationInput) {
        nodes.destinationInput.value = "";
      }

      syncView(nodes);
      return true;
    }

    setAddressValue(nodes, "origin", "");

    if (nodes.originInput) {
      nodes.originInput.value = "";
    }

    syncView(nodes);
    return true;
  }

  function destroyControllers() {
    controllers.forEach(function destroy(controller) {
      if (controller && typeof controller.destroy === "function") {
        controller.destroy();
      }
    });

    controllers = [];
  }

  function mountAddressControllers(nodes) {
    const googlePlacesApi = getGooglePlacesApi();
    const language = normalizeGoogleLanguage(getDocumentLanguage());

    destroyControllers();

    if (!googlePlacesApi) {
      return false;
    }

    [
      {
        role: "origin",
        input: nodes.originInput,
        mountNode: nodes.originMount,
        clearButton: nodes.originClear
      },
      {
        role: "destination",
        input: nodes.destinationInput,
        mountNode: nodes.destinationMount,
        clearButton: nodes.destinationClear
      }
    ].forEach(function mountAddress(config) {
      const controller = googlePlacesApi.createAutocompleteController({
        fieldName: "direct_transfer_" + config.role,
        input: config.input,
        mountNode: config.mountNode,
        hiddenFields: {},
        language,
        region: "mx",
        includedRegionCodes: ["mx"],
        coverageApi: getNeutralEditorCoverageApi(),
        onSelection: function onSelection(selectedPlace, meta) {
          const safeMeta = meta && typeof meta === "object" ? meta : {};
          const shouldPreserveVisibleInput = safeMeta.preserveInputValue === true;

          if (!selectedPlace) {
            if (!shouldPreserveVisibleInput) {
              setAddressValue(nodes, config.role, config.input.value);
            } else {
              syncView(nodes);
            }

            return;
          }

          setAddressPlace(nodes, config.role, selectedPlace).then(function onAddressPlaceApplied() {
            if (config.clearButton) {
              config.clearButton.hidden = !normalizeText(config.input.value);
            }

            syncView(nodes);
          });
        },
        onCoverageReject: function onCoverageReject() {},
        onManualFallback: function onManualFallback() {},
        onError: function onError() {}
      });

      controllers.push(controller);
      controller.mount();
    });

    return true;
  }

  function bindEvents(nodes) {
    if (!nodes || !nodes.root || nodes.root.dataset.contactDirectTransferEditorBound === "1") {
      return false;
    }

    nodes.root.dataset.contactDirectTransferEditorBound = "1";
	
    nodes.originClear.addEventListener("click", function (event) {
      event.preventDefault();
      clearAddress(nodes, "origin");
    });

    nodes.destinationClear.addEventListener("click", function (event) {
      event.preventDefault();
      clearAddress(nodes, "destination");
    });

    nodes.dateInput.addEventListener("change", function () {
      if (isPastDate(nodes.dateInput.value)) {
        nodes.dateInput.value = "";
      }

      state.tripDate = normalizeText(nodes.dateInput.value);
      requestQuoteIfReady(nodes);
    });

    nodes.timeInput.addEventListener("change", function () {
      state.tripTime = normalizeText(nodes.timeInput.value);
      requestQuoteIfReady(nodes);
    });

    nodes.passengerButtons.forEach(function bindPassenger(button) {
      button.addEventListener("click", function (event) {
        const fareKey = normalizeText(
          button.getAttribute("data-contact-direct-transfer-passenger-option")
        );

        event.preventDefault();

        if (PASSENGER_BUCKETS.indexOf(fareKey) === -1) {
          return;
        }

        state.passengerFareKey = fareKey;
        requestQuoteIfReady(nodes);
      });
    });

    nodes.notesInput.addEventListener("input", function () {
      state.notes = typeof nodes.notesInput.value === "string"
        ? nodes.notesInput.value
        : "";
      syncView(nodes);
    });

    return true;
  }
  
    function isDirectTransferReadyToSubmit(nodes) {
    return Boolean(
      isDirectTransferServiceActive() &&
        state.quoteStatus === "ready" &&
        state.price &&
        hasRequiredFieldsForQuote(nodes)
    );
  }

  function focusFirstInvalidRouteField(nodes) {
    if (!nodes) {
      return false;
    }

    if (
      !state.origin ||
      !normalizeQuoteAddress(state.originPlace, state.origin)
    ) {
      if (nodes.originInput && typeof nodes.originInput.focus === "function") {
        nodes.originInput.focus();
        return true;
      }
    }

    if (
      !state.destination ||
      !normalizeQuoteAddress(state.destinationPlace, state.destination) ||
      areSameLocations(nodes)
    ) {
      if (nodes.destinationInput && typeof nodes.destinationInput.focus === "function") {
        nodes.destinationInput.focus();
        return true;
      }
    }

    if (!state.tripDate && nodes.dateInput && typeof nodes.dateInput.focus === "function") {
      nodes.dateInput.focus();
      return true;
    }

    if (!state.tripTime && nodes.timeInput && typeof nodes.timeInput.focus === "function") {
      nodes.timeInput.focus();
      return true;
    }

    return false;
  }

  function bindSubmitGuard(nodes) {
    const form = getReservationForm();

    if (!form || form.dataset.contactDirectTransferSubmitGuardBound === "1") {
      return false;
    }

    form.dataset.contactDirectTransferSubmitGuardBound = "1";

    form.addEventListener("submit", function onDirectTransferSubmit(event) {
      if (!isDirectTransferServiceActive(form)) {
        return;
      }

      if (isDirectTransferReadyToSubmit(nodes)) {
        return;
      }

      event.preventDefault();
      syncView(nodes);

      if (nodes.status) {
        nodes.status.hidden = false;
        nodes.status.textContent = getFareText(nodes);
      }

      focusFirstInvalidRouteField(nodes);
    });

    return true;
  }

  function bindI18nLanguageSync(nodes) {
    if (!nodes || !nodes.root || nodes.root.__directTransferI18nLangSyncBound === "1") {
      return false;
    }

    nodes.root.__directTransferI18nLangSyncBound = "1";

    window.addEventListener("pixkuy:i18n-applied", function () {
      if (!document.body.contains(nodes.root)) {
        return;
      }

      mountAddressControllers(nodes);
      syncView(nodes, {
        syncReservationState: false
      });
    });

    return true;
  }

  function resetState() {
    state.origin = "";
    state.originPlace = null;
    state.originCoverage = null;
    state.destination = "";
    state.destinationPlace = null;
    state.destinationCoverage = null;
    state.tripDate = "";
    state.tripTime = "";
    state.passengerFareKey = DEFAULT_PASSENGER_BUCKET;
    state.price = "";
    state.currency = DEFAULT_CURRENCY;
    state.durationSeconds = "";
    state.distanceMeters = "";
    state.quoteStatus = "pending";
    state.quoteErrorCode = "";
    state.notes = "";
    resetQuote();
  }

  function hasSpecificDraftData() {
    return Boolean(
      state.origin ||
        state.destination ||
        state.tripDate ||
        state.tripTime ||
        state.passengerFareKey !== DEFAULT_PASSENGER_BUCKET ||
        state.price ||
        state.notes
    );
  }

  function applyHandoff(payload) {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const originAddress = safePayload.originAddress;
    const destinationAddress = safePayload.destinationAddress;

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    state.origin = getSelectedPlaceLabel(originAddress, "");
    state.originPlace = originAddress || null;
    state.originCoverage = null;

    state.destination = getSelectedPlaceLabel(destinationAddress, "");
    state.destinationPlace = destinationAddress || null;
    state.destinationCoverage = null;

    if (state.originPlace) {
      resolveDirectTransferCoverage(state.originPlace).then(function onOriginCoverageResolved(coverage) {
        state.originCoverage = coverage;
        syncView(nodes);
      });
    }

    if (state.destinationPlace) {
      resolveDirectTransferCoverage(state.destinationPlace).then(function onDestinationCoverageResolved(coverage) {
        state.destinationCoverage = coverage;
        syncView(nodes);
      });
    }

    if (nodes.originInput) {
      nodes.originInput.value = state.origin;
    }

    if (nodes.destinationInput) {
      nodes.destinationInput.value = state.destination;
    }

    state.tripDate = normalizeText(safePayload.direct_transfer_date);
    state.tripTime = normalizeText(safePayload.direct_transfer_time);
    state.passengerFareKey = PASSENGER_BUCKETS.indexOf(normalizeText(safePayload.direct_transfer_passenger_fare_key)) >= 0
      ? normalizeText(safePayload.direct_transfer_passenger_fare_key)
      : DEFAULT_PASSENGER_BUCKET;
    state.price = normalizeText(safePayload.direct_transfer_price);
    state.currency = normalizeText(safePayload.direct_transfer_currency) || DEFAULT_CURRENCY;
    state.durationSeconds = normalizeText(safePayload.direct_transfer_duration_seconds);
    state.distanceMeters = normalizeText(safePayload.direct_transfer_distance_meters);
    state.quoteStatus = state.price ? "ready" : "pending";
    state.quoteErrorCode = "";
    state.notes = normalizeText(safePayload.direct_transfer_notes);

    syncView(nodes);
    return true;
  }

  function getTripSnapshot() {
    return {
      serviceType: SERVICE_TYPE,
      originAddress: state.origin,
      originPlaceId: getSelectedPlaceId(state.originPlace),
      originLat: getSelectedPlaceCoordinate(state.originPlace, "lat") !== null ? String(getSelectedPlaceCoordinate(state.originPlace, "lat")) : "",
      originLng: getSelectedPlaceCoordinate(state.originPlace, "lng") !== null ? String(getSelectedPlaceCoordinate(state.originPlace, "lng")) : "",
      destinationAddress: state.destination,
      destinationPlaceId: getSelectedPlaceId(state.destinationPlace),
      destinationLat: getSelectedPlaceCoordinate(state.destinationPlace, "lat") !== null ? String(getSelectedPlaceCoordinate(state.destinationPlace, "lat")) : "",
      destinationLng: getSelectedPlaceCoordinate(state.destinationPlace, "lng") !== null ? String(getSelectedPlaceCoordinate(state.destinationPlace, "lng")) : "",
      tripDate: state.tripDate,
      tripTime: state.tripTime,
      passengerFareKey: state.passengerFareKey,
      passengerBucketLabel: getPassengerBucketLabel(state.passengerFareKey),
      price: state.price,
      currency: state.currency,
      durationSeconds: state.durationSeconds,
      distanceMeters: state.distanceMeters,
      vehicleLabel: getVehicleLabel(),
      notes: state.notes
    };
  }

  function registerStateHooks() {
    const serviceStateApi = NAMESPACE.contactServiceState;

    if (!serviceStateApi || typeof serviceStateApi !== "object") {
      return false;
    }

    if (typeof serviceStateApi.registerSpecificDraftProbe === "function") {
      serviceStateApi.registerSpecificDraftProbe(
        SERVICE_TYPE,
        hasSpecificDraftData
      );
    }

    return true;
  }

  function initContactDirectTransferEditor() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    if (!hasCriticalNodes(nodes)) {
      return false;
    }

    nodes.dateInput.setAttribute("min", getTodayDateValue());

    bindEvents(nodes);
    bindSubmitGuard(nodes);
    bindI18nLanguageSync(nodes);
    registerStateHooks();
    mountAddressControllers(nodes);
    syncView(nodes, {
      syncReservationState: false
    });

    return true;
  }

  NAMESPACE.initContactDirectTransferEditor = initContactDirectTransferEditor;
  NAMESPACE.getContactDirectTransferSnapshot = getTripSnapshot;
  NAMESPACE.applyContactDirectTransferHandoff = applyHandoff;
  NAMESPACE.resetContactDirectTransferEditor = function resetContactDirectTransferEditor() {
    const form = getReservationForm();
    const nodes = getEditorNodes(form);

    resetState();

    if (hasCriticalNodes(nodes)) {
      syncView(nodes);
    }

    return true;
  };
})(window, document);