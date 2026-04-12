(function initContactServiceSwitcherModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getServiceStateApi() {
    const api = NAMESPACE.contactServiceState;
    if (!api || typeof api !== "object") {
      return null;
    }

    if (
      typeof api.getActiveServiceType !== "function" ||
      typeof api.setActiveServiceType !== "function"
    ) {
      return null;
    }

    return api;
  }

  function getReservationForm() {
    if (typeof NAMESPACE.getReservationForm === "function") {
      return NAMESPACE.getReservationForm();
    }

    return document.querySelector('form[name="contact"]');
  }

  function getSwitcherNodes(form) {
    if (!form) {
      return null;
    }

    const switcher = form.querySelector("[data-contact-service-switcher]");
    const buttons = Array.from(
      form.querySelectorAll("[data-contact-service-trigger]")
    );
    const panels = Array.from(
      form.querySelectorAll("[data-contact-service-panel]")
    );

    if (!switcher || !buttons.length || !panels.length) {
      return null;
    }

    return {
      switcher,
      buttons,
      panels
    };
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

  function getDefaultServiceType() {
    const serviceStateApi = getServiceStateApi();

    if (
      serviceStateApi &&
      typeof serviceStateApi.DEFAULT_SERVICE_TYPE === "string"
    ) {
      return normalizeText(serviceStateApi.DEFAULT_SERVICE_TYPE);
    }

    return "other";
  }

  function isSupportedServiceType(serviceType) {
    const safeServiceType = normalizeText(serviceType);

    return (
      safeServiceType === "airport_hotel" ||
      safeServiceType === "tour_private" ||
      safeServiceType === "other"
    );
  }

  function findFirstFocusable(container) {
    if (!container || typeof container.querySelector !== "function") {
      return null;
    }

    return (
      container.querySelector(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
      ) || null
    );
  }

  function syncSwitcherAriaLabel(switcher) {
    if (!switcher) {
      return false;
    }

    const i18nPath = normalizeText(
      switcher.getAttribute("data-contact-service-switcher-aria-label")
    );

    if (!i18nPath) {
      return false;
    }

    const translated = getI18nValue(i18nPath, "");
    if (!translated) {
      return false;
    }

    switcher.setAttribute("aria-label", translated);
    return true;
  }

  function syncButtonState(buttons, activeServiceType) {
    buttons.forEach(function (button) {
      const serviceType = normalizeText(
        button.getAttribute("data-contact-service-trigger")
      );
      const isActive = serviceType === activeServiceType;

      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("data-service-active", isActive ? "true" : "false");
      button.removeAttribute("data-service-pending-confirm");
    });
  }

  function syncCommonTripFieldsVisibility(form, activeServiceType) {
    if (!form) {
      return false;
    }

    const originField = form.querySelector(
      '.form-field.form-field--place[data-place-field="origin"]'
    );
    const destinationField = form.querySelector(
      '.form-field.form-field--place[data-place-field="destination"]'
    );
    const passengersField = form.querySelector(
      '#contact-passengers'
    );
    const passengersWrapper = passengersField
      ? passengersField.closest('.form-field')
      : null;
    const luggageField = form.querySelector(
      '#contact-luggage'
    );
    const luggageWrapper = luggageField
      ? luggageField.closest('.form-field')
      : null;
    const commonTripDateField = form.querySelector('#contact-trip-date');
    const commonTripDateWrapper = commonTripDateField
      ? commonTripDateField.closest('.form-field')
      : null;
    const commonTripTimeField = form.querySelector('#contact-trip-time');
    const commonTripTimeWrapper = commonTripTimeField
      ? commonTripTimeField.closest('.form-field')
      : null;
    const shouldHideSharedPlacesAndPassengers =
      activeServiceType === "airport_hotel" ||
      activeServiceType === "tour_private";
    const shouldHideSharedTripDateTime =
      activeServiceType === "tour_private";
    const shouldHideSharedLuggage =
      activeServiceType === "tour_private";

    if (originField) {
      originField.hidden = shouldHideSharedPlacesAndPassengers;
      originField.setAttribute(
        "aria-hidden",
        shouldHideSharedPlacesAndPassengers ? "true" : "false"
      );
    }

    if (destinationField) {
      destinationField.hidden = shouldHideSharedPlacesAndPassengers;
      destinationField.setAttribute(
        "aria-hidden",
        shouldHideSharedPlacesAndPassengers ? "true" : "false"
      );
    }

    if (passengersWrapper) {
      passengersWrapper.hidden = shouldHideSharedPlacesAndPassengers;
      passengersWrapper.setAttribute(
        "aria-hidden",
        shouldHideSharedPlacesAndPassengers ? "true" : "false"
      );
    }

    if (luggageWrapper) {
      luggageWrapper.hidden = shouldHideSharedLuggage;
      luggageWrapper.setAttribute(
        "aria-hidden",
        shouldHideSharedLuggage ? "true" : "false"
      );
    }

    if (commonTripDateWrapper) {
      commonTripDateWrapper.hidden = shouldHideSharedTripDateTime;
      commonTripDateWrapper.setAttribute(
        "aria-hidden",
        shouldHideSharedTripDateTime ? "true" : "false"
      );
    }

    if (commonTripTimeWrapper) {
      commonTripTimeWrapper.hidden = shouldHideSharedTripDateTime;
      commonTripTimeWrapper.setAttribute(
        "aria-hidden",
        shouldHideSharedTripDateTime ? "true" : "false"
      );
    }

    return true;
  }
  
  function syncOperationalSummaryFields(form, activeServiceType) {
    var serviceLabelField;
    var requestSummaryField;
    var airportHotelFieldNames;
    var tourPrivateFieldNames;

    function clearFields(fieldNames) {
      var index;
      var field;

      for (index = 0; index < fieldNames.length; index += 1) {
        field = form.querySelector('input[name="' + fieldNames[index] + '"]');

        if (!field) {
          continue;
        }

        field.value = "";
      }
    }

    if (!form) {
      return false;
    }

    serviceLabelField = form.querySelector('input[name="service_label"]');
    requestSummaryField = form.querySelector('input[name="request_summary"]');

    if (!serviceLabelField || !requestSummaryField) {
      return false;
    }

    airportHotelFieldNames = [
      "zone",
      "fare",
      "airport_hotel_direction",
      "airport_hotel_airport",
      "airport_hotel_hotel",
      "passenger_fare_key",
      "passenger_bucket_label",
      "airport_hotel_trip_summary",
      "airport_hotel_direction_label",
      "airport_hotel_airport_label",
      "airport_hotel_hotel_label",
      "airport_hotel_zone_label",
      "airport_hotel_fare_label",
      "airport_hotel_passenger_bucket_label"
    ];

    tourPrivateFieldNames = [
      "tour_private_tour_id",
      "tour_private_tour_label",
      "tour_private_duration_hours",
      "tour_private_passenger_fare_key",
      "tour_private_passenger_bucket_label",
      "tour_private_pickup",
      "tour_private_pickup_place_id",
      "tour_private_pickup_lat",
      "tour_private_pickup_lng",
      "tour_private_date",
      "tour_private_time",
      "tour_private_has_guide",
      "tour_private_guide_language",
      "tour_private_price",
      "tour_private_currency",
      "tour_private_trip_summary",
      "tour_private_pickup_label",
      "tour_private_guide_label",
      "tour_private_guide_language_label",
      "tour_private_price_label"
    ];

    if (activeServiceType === "airport_hotel") {
      clearFields(tourPrivateFieldNames);
      return true;
    }

    if (activeServiceType === "tour_private") {
      clearFields(airportHotelFieldNames);
      return true;
    }

    serviceLabelField.value = "";
    requestSummaryField.value = "";
    clearFields(airportHotelFieldNames);
    clearFields(tourPrivateFieldNames);

    return true;
  }

  function syncPanelState(form, panels, activeServiceType) {
    panels.forEach(function (panel) {
      const serviceType = normalizeText(
        panel.getAttribute("data-contact-service-panel")
      );
      const isActive = serviceType === activeServiceType;

      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      panel.setAttribute("data-service-active", isActive ? "true" : "false");
    });

    syncCommonTripFieldsVisibility(form, activeServiceType);
  }

  function renderActiveService(form, activeServiceType, options) {
    const nodes = getSwitcherNodes(form);
    const safeOptions =
      options && typeof options === "object" ? options : {};

    if (!nodes || !isSupportedServiceType(activeServiceType)) {
      return false;
    }

    syncSwitcherAriaLabel(nodes.switcher);
    syncButtonState(nodes.buttons, activeServiceType);
    syncPanelState(form, nodes.panels, activeServiceType);
    syncOperationalSummaryFields(form, activeServiceType);

    if (safeOptions.focusPanel === true) {
      const activePanel = nodes.panels.find(function (panel) {
        return (
          normalizeText(panel.getAttribute("data-contact-service-panel")) ===
          activeServiceType
        );
      });

      const focusTarget = findFirstFocusable(activePanel);
      if (focusTarget && typeof focusTarget.focus === "function") {
        window.setTimeout(function () {
          focusTarget.focus();
        }, 0);
      }
    }

    return true;
  }

  function bindSwitcherEvents(form) {
    const nodes = getSwitcherNodes(form);
    const serviceStateApi = getServiceStateApi();

    if (!nodes || !serviceStateApi) {
      return false;
    }

    nodes.buttons.forEach(function (button) {
      if (button.dataset.contactServiceSwitcherBound === "1") {
        return;
      }

      button.dataset.contactServiceSwitcherBound = "1";

      button.addEventListener("click", function () {
        const nextServiceType = normalizeText(
          button.getAttribute("data-contact-service-trigger")
        );

        if (!isSupportedServiceType(nextServiceType)) {
          return;
        }

        const result = serviceStateApi.setActiveServiceType(nextServiceType, {
          source: "contact-service-switcher"
        });

        if (!result || result.ok !== true) {
          renderActiveService(
            form,
            serviceStateApi.getActiveServiceType(),
            { focusPanel: false }
          );
          return;
        }

        renderActiveService(form, result.activeServiceType, {
          focusPanel: true
        });
      });
    });

    form.addEventListener("pixkuy:contact-service-change", function (event) {
      const detail = event && event.detail ? event.detail : {};
      const nextServiceType = normalizeText(detail.nextServiceType);

      if (!isSupportedServiceType(nextServiceType)) {
        return;
      }

      renderActiveService(form, nextServiceType, {
        focusPanel: detail.source === "airport-panel-handoff"
      });
    });

    return true;
  }
  
  function initContactServiceSwitcher() {
    const form = getReservationForm();
    const serviceStateApi = getServiceStateApi();

    if (!form || !serviceStateApi) {
      return false;
    }

    const nodes = getSwitcherNodes(form);
    if (!nodes) {
      return false;
    }

    bindSwitcherEvents(form);

    return renderActiveService(
      form,
      serviceStateApi.getActiveServiceType() || getDefaultServiceType(),
      { focusPanel: false }
    );
  }

  NAMESPACE.initContactServiceSwitcher = initContactServiceSwitcher;
})(window, document);