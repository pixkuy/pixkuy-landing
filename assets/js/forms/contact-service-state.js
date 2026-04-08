(function initContactServiceStateModule(window) {
  "use strict";

  if (!window || !window.document) {
    return;
  }

  const NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});

  const SERVICE_TYPES = Object.freeze({
    AIRPORT_HOTEL: "airport_hotel",
    OTHER: "other"
  });

  const DEFAULT_SERVICE_TYPE = SERVICE_TYPES.OTHER;

  const state = {
    activeServiceType: DEFAULT_SERVICE_TYPE,
    specificDraftProbes: {},
    specificResetters: {}
  };

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isSupportedServiceType(value) {
    return (
      value === SERVICE_TYPES.AIRPORT_HOTEL ||
      value === SERVICE_TYPES.OTHER
    );
  }

  function getReservationForm() {
    if (
      NAMESPACE &&
      typeof NAMESPACE.getReservationForm === "function"
    ) {
      return NAMESPACE.getReservationForm();
    }

    return window.document.querySelector('form[name="contact"]');
  }

  function getServiceTypeHiddenField(form) {
    if (!form) {
      return null;
    }

    return form.querySelector('input[name="service_type"]');
  }

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) {
      return "";
    }

    const parts = String(path).split(".");
    let cursor = dict;

    for (let index = 0; index < parts.length; index += 1) {
      const key = parts[index];

      if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
        return "";
      }

      cursor = cursor[key];
    }

    return typeof cursor === "string" ? cursor.trim() : "";
  }

  function getConfirmChangeMessage() {
    return (
      getI18nValue("contact.services.confirmChangeSpecificData") ||
      "Si cambias de servicio, se perderán los datos específicos del servicio actual. ¿Quieres continuar?"
    );
  }

  function readInitialServiceTypeFromDom(form) {
    const hiddenField = getServiceTypeHiddenField(form);
    const hiddenValue = normalizeText(hiddenField && hiddenField.value);

    if (isSupportedServiceType(hiddenValue)) {
      return hiddenValue;
    }

    const dataValue = normalizeText(
      form && form.getAttribute("data-contact-active-service")
    );

    if (isSupportedServiceType(dataValue)) {
      return dataValue;
    }

    return DEFAULT_SERVICE_TYPE;
  }

  function writeServiceTypeToDom(form, serviceType) {
    const safeServiceType = isSupportedServiceType(serviceType)
      ? serviceType
      : DEFAULT_SERVICE_TYPE;

    const hiddenField = getServiceTypeHiddenField(form);

    if (hiddenField) {
      hiddenField.value = safeServiceType;
    }

    if (form) {
      form.setAttribute("data-contact-active-service", safeServiceType);
    }
  }

  function getActiveServiceType() {
    return state.activeServiceType;
  }

  function registerSpecificDraftProbe(serviceType, probeFn) {
    if (!isSupportedServiceType(serviceType) || typeof probeFn !== "function") {
      return false;
    }

    state.specificDraftProbes[serviceType] = probeFn;
    return true;
  }

  function registerSpecificReset(serviceType, resetFn) {
    if (!isSupportedServiceType(serviceType) || typeof resetFn !== "function") {
      return false;
    }

    state.specificResetters[serviceType] = resetFn;
    return true;
  }

  function hasSpecificDraftData(serviceType) {
    const safeServiceType = isSupportedServiceType(serviceType)
      ? serviceType
      : "";

    const probeFn = safeServiceType
      ? state.specificDraftProbes[safeServiceType]
      : null;

    if (typeof probeFn !== "function") {
      return false;
    }

    try {
      return Boolean(probeFn());
    } catch (error) {
      return false;
    }
  }

  function resetSpecificDraftData(serviceType) {
    const safeServiceType = isSupportedServiceType(serviceType)
      ? serviceType
      : "";

    const resetFn = safeServiceType
      ? state.specificResetters[safeServiceType]
      : null;

    if (typeof resetFn !== "function") {
      return false;
    }

    try {
      resetFn();
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureActiveServiceConsistency() {
    const activeServiceType = state.activeServiceType;

    if (!isSupportedServiceType(activeServiceType)) {
      return false;
    }

    if (activeServiceType === SERVICE_TYPES.OTHER) {
      return true;
    }

    if (!hasSpecificDraftData(activeServiceType)) {
      resetSpecificDraftData(activeServiceType);
    }

    return true;
  }

  function shouldConfirmServiceChange(currentServiceType, nextServiceType, options) {
    const safeOptions =
      options && typeof options === "object" ? options : {};

    if (safeOptions.skipConfirm === true) {
      return false;
    }

    if (!isSupportedServiceType(currentServiceType)) {
      return false;
    }

    if (!isSupportedServiceType(nextServiceType)) {
      return false;
    }

    if (currentServiceType === nextServiceType) {
      return false;
    }

    return hasSpecificDraftData(currentServiceType);
  }

  function confirmServiceChange(currentServiceType, nextServiceType, options) {
    if (!shouldConfirmServiceChange(currentServiceType, nextServiceType, options)) {
      return true;
    }

    return window.confirm(getConfirmChangeMessage());
  }

  function dispatchServiceChangeEvent(form, detail) {
    if (!form) {
      return;
    }

    form.dispatchEvent(
      new window.CustomEvent("pixkuy:contact-service-change", {
        bubbles: true,
        detail: detail || {}
      })
    );
  }

  function setActiveServiceType(nextServiceType, options) {
    const form = getReservationForm();
    const safeNextServiceType = isSupportedServiceType(nextServiceType)
      ? nextServiceType
      : DEFAULT_SERVICE_TYPE;
    const safeOptions =
      options && typeof options === "object" ? options : {};
    const previousServiceType = state.activeServiceType;

    if (!confirmServiceChange(previousServiceType, safeNextServiceType, safeOptions)) {
      return {
        ok: false,
        reason: "cancelled-by-user",
        activeServiceType: previousServiceType
      };
    }

    if (
      previousServiceType !== safeNextServiceType &&
      hasSpecificDraftData(previousServiceType)
    ) {
      resetSpecificDraftData(previousServiceType);
    }

    state.activeServiceType = safeNextServiceType;
    writeServiceTypeToDom(form, safeNextServiceType);

    dispatchServiceChangeEvent(form, {
      previousServiceType: previousServiceType,
      nextServiceType: safeNextServiceType,
      source: normalizeText(safeOptions.source) || "unknown"
    });

    return {
      ok: true,
      reason: "",
      activeServiceType: safeNextServiceType
    };
  }

  function initContactServiceState() {
    const form = getReservationForm();

    if (!form) {
      return false;
    }

    state.activeServiceType = readInitialServiceTypeFromDom(form);
    writeServiceTypeToDom(form, state.activeServiceType);

    return true;
  }

  NAMESPACE.contactServiceState = {
    SERVICE_TYPES: SERVICE_TYPES,
    DEFAULT_SERVICE_TYPE: DEFAULT_SERVICE_TYPE,
    init: initContactServiceState,
    getActiveServiceType: getActiveServiceType,
    setActiveServiceType: setActiveServiceType,
    registerSpecificDraftProbe: registerSpecificDraftProbe,
    registerSpecificReset: registerSpecificReset,
    hasSpecificDraftData: hasSpecificDraftData,
    resetSpecificDraftData: resetSpecificDraftData,
    ensureActiveServiceConsistency: ensureActiveServiceConsistency
  };
})(window);