(function initContactServiceSwitcherModule(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});
  const MOBILE_BLOCKED_SERVICE_TYPE = "airport_hotel";
  const MOBILE_FALLBACK_SERVICE_TYPE = "hourly_daily";

  let mobileBlockedOptionSnapshot = null;

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
    const mobileField = switcher
      ? switcher.querySelector("[data-contact-service-mobile-field]")
      : null;
    const mobileSelect = switcher
      ? switcher.querySelector("[data-contact-service-mobile-select]")
      : null;

    if (!switcher || !buttons.length || !panels.length) {
      return null;
    }

    return {
      switcher,
      buttons,
      panels,
      mobileField,
      mobileSelect
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
      safeServiceType === "hourly_daily" ||
      safeServiceType === "event_special" ||
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
  
    function syncMobileSelectState(mobileSelect, activeServiceType) {
    if (!mobileSelect) {
      return false;
    }

    if (mobileSelect.value !== activeServiceType) {
      mobileSelect.value = activeServiceType;
    }

    return true;
  }
  
    function isMobileServiceSelectViewport() {
    return Boolean(
      window &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches
    );
  }

  function isMobileBlockedServiceType(serviceType) {
    return Boolean(
      isMobileServiceSelectViewport() &&
      normalizeText(serviceType) === MOBILE_BLOCKED_SERVICE_TYPE
    );
  }

  function getMobileFallbackServiceType() {
    return MOBILE_FALLBACK_SERVICE_TYPE;
  }

  function syncMobileSelectOptionsAvailability(mobileSelect) {
    var blockedOption;
    var insertBeforeOption;

    if (!mobileSelect) {
      return false;
    }

    blockedOption = Array.from(mobileSelect.options).find(function findBlockedOption(option) {
      return normalizeText(option.value) === MOBILE_BLOCKED_SERVICE_TYPE;
    });

    if (isMobileServiceSelectViewport()) {
      if (blockedOption) {
        mobileBlockedOptionSnapshot = {
          node: blockedOption,
          nextValue: blockedOption.nextElementSibling
            ? normalizeText(blockedOption.nextElementSibling.value)
            : ""
        };

        blockedOption.remove();
      }

      return true;
    }

    if (
      !blockedOption &&
      mobileBlockedOptionSnapshot &&
      mobileBlockedOptionSnapshot.node
    ) {
      insertBeforeOption = mobileBlockedOptionSnapshot.nextValue
        ? Array.from(mobileSelect.options).find(function findInsertBeforeOption(option) {
            return normalizeText(option.value) === mobileBlockedOptionSnapshot.nextValue;
          })
        : null;

      mobileSelect.insertBefore(
        mobileBlockedOptionSnapshot.node,
        insertBeforeOption || mobileSelect.firstChild
      );

      mobileBlockedOptionSnapshot = null;
    }

    return true;
  }

  function enforceMobileServiceAvailability(form, serviceStateApi) {
    const activeServiceType =
      serviceStateApi && typeof serviceStateApi.getActiveServiceType === "function"
        ? normalizeText(serviceStateApi.getActiveServiceType())
        : "";

    if (!isMobileBlockedServiceType(activeServiceType)) {
      return activeServiceType;
    }

    const result = serviceStateApi.setActiveServiceType(getMobileFallbackServiceType(), {
      source: "contact-service-mobile-exclusion",
      skipConfirm: true
    });

    return result && result.ok === true
      ? result.activeServiceType
      : getMobileFallbackServiceType();
  }

  function syncMobileFieldVisibility(mobileField) {
    const shouldShow = isMobileServiceSelectViewport();

    if (!mobileField) {
      return false;
    }

    mobileField.hidden = !shouldShow;
    mobileField.setAttribute("aria-hidden", shouldShow ? "false" : "true");

    return true;
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
      activeServiceType === "tour_private" ||
      activeServiceType === "hourly_daily" ||
      activeServiceType === "event_special";
    const shouldHideSharedTripDateTime =
      activeServiceType === "airport_hotel" ||
      activeServiceType === "tour_private" ||
      activeServiceType === "hourly_daily" ||
      activeServiceType === "event_special";
    const shouldHideSharedLuggage =
      activeServiceType === "tour_private" ||
      activeServiceType === "hourly_daily" ||
      activeServiceType === "event_special";

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
    var hourlyDailyFieldNames;
    var eventSpecialFieldNames;

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
	
    hourlyDailyFieldNames = [
      "hourly_daily_mode",
      "hourly_daily_vehicle_type",
      "hourly_daily_pickup",
      "hourly_daily_pickup_place_id",
      "hourly_daily_pickup_lat",
      "hourly_daily_pickup_lng",
      "hourly_daily_date",
      "hourly_daily_start_time",
      "hourly_daily_duration_hours",
      "hourly_daily_custom_term",
      "hourly_daily_notes",
      "hourly_daily_price",
      "hourly_daily_currency",
      "hourly_daily_km_included",
      "hourly_daily_extra_km_price",
      "hourly_daily_out_of_zone_supplement",
      "hourly_daily_trip_summary",
      "hourly_daily_pickup_label",
      "hourly_daily_mode_label",
      "hourly_daily_duration_label",
      "hourly_daily_price_label"
    ];

    eventSpecialFieldNames = [
      "event_special_trip_summary",
      "event_special_event_label",
      "event_special_venue_label",
      "event_special_variant_label",
      "event_special_origin_label",
      "event_special_destination_label",
      "event_special_passenger_bucket_label",
      "event_special_price_label",
      "event_special_event_id",
      "event_special_event_type",
      "event_special_event_starts_at",
      "event_special_venue_id",
      "event_special_variant",
      "event_special_origin_address",
      "event_special_origin_address_place_id",
      "event_special_origin_address_lat",
      "event_special_origin_address_lng",
      "event_special_destination_address",
      "event_special_destination_address_place_id",
      "event_special_destination_address_lat",
      "event_special_destination_address_lng",
      "event_special_origin_pickup_time",
      "event_special_return_pickup_time",
      "event_special_estimated_event_arrival_time",
      "event_special_estimated_destination_arrival_time",
      "event_special_outbound_duration_seconds",
      "event_special_return_duration_seconds",
      "event_special_outbound_distance_meters",
      "event_special_return_distance_meters",
      "event_special_passenger_fare_key",
      "event_special_price",
      "event_special_currency",
      "event_special_notes"
    ];

    if (activeServiceType === "airport_hotel") {
      clearFields(tourPrivateFieldNames);
      clearFields(hourlyDailyFieldNames);
      clearFields(eventSpecialFieldNames);
      return true;
    }

    if (activeServiceType === "tour_private") {
      clearFields(airportHotelFieldNames);
      clearFields(hourlyDailyFieldNames);
      clearFields(eventSpecialFieldNames);
      return true;
    }

    if (activeServiceType === "hourly_daily") {
      clearFields(airportHotelFieldNames);
      clearFields(tourPrivateFieldNames);
      clearFields(eventSpecialFieldNames);
      return true;
    }

    if (activeServiceType === "event_special") {
      clearFields(airportHotelFieldNames);
      clearFields(tourPrivateFieldNames);
      clearFields(hourlyDailyFieldNames);
      return true;
    }

    serviceLabelField.value = "";
    requestSummaryField.value = "";
    clearFields(airportHotelFieldNames);
    clearFields(tourPrivateFieldNames);
    clearFields(hourlyDailyFieldNames);
    clearFields(eventSpecialFieldNames);

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
    syncMobileSelectOptionsAvailability(nodes.mobileSelect);
    syncMobileSelectState(nodes.mobileSelect, activeServiceType);
    syncMobileFieldVisibility(nodes.mobileField);
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
	
	    if (
      nodes.mobileSelect &&
      nodes.mobileSelect.dataset.contactServiceSwitcherBound !== "1"
    ) {
      nodes.mobileSelect.dataset.contactServiceSwitcherBound = "1";

      nodes.mobileSelect.addEventListener("change", function () {
        const nextServiceType = normalizeText(nodes.mobileSelect.value);

        if (
          !isSupportedServiceType(nextServiceType) ||
          isMobileBlockedServiceType(nextServiceType)
        ) {
          syncMobileSelectState(
            nodes.mobileSelect,
            serviceStateApi.getActiveServiceType()
          );
          return;
        }

        const result = serviceStateApi.setActiveServiceType(nextServiceType, {
          source: "contact-service-mobile-select"
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
          focusPanel: false
        });
      });
    }

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

    window.addEventListener("resize", function () {
      const activeServiceType = enforceMobileServiceAvailability(form, serviceStateApi);

      renderActiveService(form, activeServiceType || serviceStateApi.getActiveServiceType(), {
        focusPanel: false
      });
    });

    return true;
  }
  
  function initContactServiceSwitcher() {
    const form = getReservationForm();
    const serviceStateApi = getServiceStateApi();
    let activeServiceType;

    if (!form || !serviceStateApi) {
      return false;
    }

    const nodes = getSwitcherNodes(form);
    if (!nodes) {
      return false;
    }

    bindSwitcherEvents(form);

    activeServiceType = serviceStateApi.getActiveServiceType() || getDefaultServiceType();
    activeServiceType = enforceMobileServiceAvailability(form, serviceStateApi) || activeServiceType;

        if (activeServiceType === "other") {
      const result = serviceStateApi.setActiveServiceType("hourly_daily", {
        source: "contact-service-default"
      });

      if (result && result.ok === true) {
        activeServiceType = result.activeServiceType;
      }
    }

    activeServiceType = enforceMobileServiceAvailability(form, serviceStateApi) || activeServiceType;

    return renderActiveService(
      form,
      activeServiceType,
      { focusPanel: false }
    );
  }

  NAMESPACE.initContactServiceSwitcher = initContactServiceSwitcher;
})(window, document);