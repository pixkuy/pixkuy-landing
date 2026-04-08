(function () {
  const ACTIVE_ATTR = "data-panel-handoff-active";
  const ORIGIN_SNAPSHOT_ATTR = "data-panel-handoff-origin-snapshot";
  const DESTINATION_SNAPSHOT_ATTR = "data-panel-handoff-destination-snapshot";
  let isRevertingTripValues = false;
  let isConfirmingInvalidation = false;
  let blurCheckTimer = 0;

  function getFormsNamespace() {
    const api = window.PixkuyForms;
    if (!api || typeof api !== "object") {
      return null;
    }
    return api;
  }

  function getReservationApi() {
    const formsApi = getFormsNamespace();
    if (!formsApi) {
      return null;
    }

    if (
      typeof formsApi.getReservationForm !== "function" ||
      typeof formsApi.getReservationRequestFields !== "function" ||
      typeof formsApi.syncReservationRequestState !== "function"
    ) {
      return null;
    }

    return formsApi;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isSameValue(a, b) {
    return normalizeText(a) === normalizeText(b);
  }

  function getFormAndFields() {
    const reservationApi = getReservationApi();
    if (!reservationApi) {
      return null;
    }

    const form = reservationApi.getReservationForm();
    if (!form) {
      return null;
    }

    const fields = reservationApi.getReservationRequestFields(form);
    if (!fields || typeof fields !== "object") {
      return null;
    }

    fields.zone = form.querySelector('input[name="zone"]');
    fields.fare = form.querySelector('input[name="fare"]');

    return { form, fields, reservationApi };
  }

  function getSummaryNodes(form) {
    if (!form) {
      return null;
    }

    const zoneBlock = form.querySelector("[data-contact-panel-zone]");
    const zoneValue = form.querySelector("[data-contact-panel-zone-value]");
    const fareBlock = form.querySelector("[data-contact-panel-fare]");
    const fareValue = form.querySelector("[data-contact-panel-fare-value]");

    if (!zoneBlock || !zoneValue || !fareBlock || !fareValue) {
      return null;
    }

    return {
      zoneBlock,
      zoneValue,
      fareBlock,
      fareValue
    };
  }

  function setHidden(node, shouldHide) {
    if (!node) {
      return;
    }

    if (shouldHide) {
      node.hidden = true;
      return;
    }

    node.hidden = false;
  }

  function getActiveState(form) {
    return form && form.getAttribute(ACTIVE_ATTR) === "true";
  }

  function setActiveState(form, nextValue) {
    if (!form) {
      return;
    }

    if (nextValue) {
      form.setAttribute(ACTIVE_ATTR, "true");
      return;
    }

    form.removeAttribute(ACTIVE_ATTR);
  }

  function setTripSnapshots(form, originValue, destinationValue) {
    if (!form) {
      return;
    }

    form.setAttribute(ORIGIN_SNAPSHOT_ATTR, normalizeText(originValue));
    form.setAttribute(DESTINATION_SNAPSHOT_ATTR, normalizeText(destinationValue));
  }

  function clearTripSnapshots(form) {
    if (!form) {
      return;
    }

    form.removeAttribute(ORIGIN_SNAPSHOT_ATTR);
    form.removeAttribute(DESTINATION_SNAPSHOT_ATTR);
  }

  function getTripSnapshots(form) {
    if (!form) {
      return {
        origin: "",
        destination: ""
      };
    }

    return {
      origin: normalizeText(form.getAttribute(ORIGIN_SNAPSHOT_ATTR)),
      destination: normalizeText(form.getAttribute(DESTINATION_SNAPSHOT_ATTR))
    };
  }

  function clearPanelHandoffSummary() {
    const formData = getFormAndFields();
    if (!formData) {
      return false;
    }

    const { form, fields } = formData;
    const nodes = getSummaryNodes(form);
    if (!nodes) {
      return false;
    }

    nodes.zoneValue.textContent = "";
    nodes.fareValue.textContent = "";

    if (fields.zone) {
      fields.zone.value = "";
    }

    if (fields.fare) {
      fields.fare.value = "";
    }
    setHidden(nodes.zoneBlock, true);
    setHidden(nodes.fareBlock, true);
    setActiveState(form, false);
    clearTripSnapshots(form);

    return true;
  }

  function setPanelHandoffSummary(payload) {
    const formData = getFormAndFields();
    if (!formData) {
      return false;
    }

    const { form, fields } = formData;
    const nodes = getSummaryNodes(form);
    if (!nodes) {
      return false;
    }

    const zone = normalizeText(payload && payload.zone);
    const fare = normalizeText(payload && payload.fare);
    const origin = normalizeText(payload && payload.origin);
    const destination = normalizeText(payload && payload.destination);

    if (!zone || !fare || !origin || !destination) {
      return false;
    }

    nodes.zoneValue.textContent = zone;
    nodes.fareValue.textContent = fare;

    if (fields.zone) {
      fields.zone.value = zone;
    }

    if (fields.fare) {
      fields.fare.value = fare;
    }

    setHidden(nodes.zoneBlock, false);
    setHidden(nodes.fareBlock, false);
    setActiveState(form, true);
    setTripSnapshots(form, fields.origin ? fields.origin.value : origin, fields.destination ? fields.destination.value : destination);

    return true;
  }

  function shouldInvalidateForField(fieldName) {
    return fieldName === "origin" || fieldName === "destination";
  }

  function hasTripChanged(form, fields) {
    const snapshots = getTripSnapshots(form);
    const currentOrigin = normalizeText(fields && fields.origin ? fields.origin.value : "");
    const currentDestination = normalizeText(fields && fields.destination ? fields.destination.value : "");

    return (
      !isSameValue(snapshots.origin, currentOrigin) ||
      !isSameValue(snapshots.destination, currentDestination)
    );
  }

  function revertTripValues(form, fields) {
    const snapshots = getTripSnapshots(form);

    isRevertingTripValues = true;

    if (fields && fields.origin) {
      fields.origin.value = snapshots.origin;
    }

    if (fields && fields.destination) {
      fields.destination.value = snapshots.destination;
    }

    window.setTimeout(function () {
      isRevertingTripValues = false;
    }, 0);
  }
  
  function getI18nRuntime() {
    const dict = window.__pixkuyI18nDict;
    const lang = normalizeText(window.__pixkuyI18nLang);

    if (!dict || typeof dict !== "object" || !lang) {
      return null;
    }

    return { dict, lang };
  }

  function getI18nValue(path) {
    const runtime = getI18nRuntime();
    if (!runtime) {
      return "";
    }

    const segments = normalizeText(path).split(".").filter(Boolean);
    let cursor = runtime.dict;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];

      if (!cursor || typeof cursor !== "object" || !(segment in cursor)) {
        return "";
      }

      cursor = cursor[segment];
    }

    return typeof cursor === "string" ? cursor.trim() : "";
  }

  function confirmInvalidation() {
    const message = getI18nValue("contact.panelHandoff.confirmInvalidate");

    if (!message) {
      return false;
    }

    return window.confirm(message);
  }

  function invalidatePanelHandoff(form) {
    clearPanelHandoffSummary();

    if (form) {
      form.dispatchEvent(
        new CustomEvent("pixkuy:panel-handoff-invalidated", {
          bubbles: true
        })
      );
    }
  }

  function runTripFieldInvalidationCheck(target) {
    let fieldName;
    let formData;
    let form;
    let fields;

    if (!target || target.nodeType !== 1) {
      return;
    }

    fieldName = normalizeText(target.getAttribute("name"));
    if (!shouldInvalidateForField(fieldName)) {
      return;
    }

    formData = getFormAndFields();
    if (!formData) {
      return;
    }

    form = formData.form;
    fields = formData.fields;

    if (!getActiveState(form)) {
      return;
    }

    if (!hasTripChanged(form, fields)) {
      return;
    }

    isConfirmingInvalidation = true;

    if (confirmInvalidation()) {
      isConfirmingInvalidation = false;
      invalidatePanelHandoff(form);
      return;
    }

    isConfirmingInvalidation = false;
    revertTripValues(form, fields);
  }
  
  function handleTripFieldInteraction(event) {
    const target = event && event.target ? event.target : null;

    if (isRevertingTripValues || isConfirmingInvalidation) {
      return;
    }

    runTripFieldInvalidationCheck(target);
  }

  function handleTripFieldBlur(event) {
    const target = event && event.target ? event.target : null;

    if (!target || isRevertingTripValues || isConfirmingInvalidation) {
      return;
    }

    if (blurCheckTimer) {
      window.clearTimeout(blurCheckTimer);
      blurCheckTimer = 0;
    }

    blurCheckTimer = window.setTimeout(function () {
      blurCheckTimer = 0;
      runTripFieldInvalidationCheck(target);
    }, 180);
  }

  function getTripFieldNameFromTarget(target) {
    if (!target || target.nodeType !== 1) {
      return "";
    }

    return (
      normalizeText(target.getAttribute("name")) ||
      normalizeText(target.getAttribute("data-place-clear"))
    );
  }

  function handleTripEditIntent(event) {
    let target;
    let fieldName;
    let formData;
    let form;
    let fields;

    if (isRevertingTripValues || isConfirmingInvalidation) {
      return;
    }

    target = event && event.currentTarget ? event.currentTarget : null;
    if (!target || target.nodeType !== 1) {
      return;
    }

    fieldName = getTripFieldNameFromTarget(target);
    if (!shouldInvalidateForField(fieldName)) {
      return;
    }

    formData = getFormAndFields();
    if (!formData) {
      return;
    }

    form = formData.form;
    fields = formData.fields;

    if (!getActiveState(form)) {
      return;
    }

    isConfirmingInvalidation = true;

    if (confirmInvalidation()) {
      isConfirmingInvalidation = false;
      invalidatePanelHandoff(form);
      return;
    }

    isConfirmingInvalidation = false;

    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    if (event && typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }

    if (event && typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    revertTripValues(form, fields);

    window.setTimeout(function () {
      if (target && typeof target.blur === "function") {
        target.blur();
      }
    }, 0);
  }

  function handleTripClearClick(event) {
    handleTripEditIntent(event);
  }

  function handleTripFieldFocus(event) {
    handleTripEditIntent(event);
  }

  function bindTripInvalidation() {
    const formData = getFormAndFields();
    let originClear;
    let destinationClear;

    if (!formData) {
      return false;
    }

    const { form, fields } = formData;
    if (!fields || !fields.origin || !fields.destination) {
      return false;
    }

    originClear = form.querySelector('[data-place-clear="origin"]');
    destinationClear = form.querySelector('[data-place-clear="destination"]');

    fields.origin.addEventListener("focus", handleTripFieldFocus, true);
    fields.destination.addEventListener("focus", handleTripFieldFocus, true);

    fields.origin.addEventListener("input", handleTripFieldInteraction, true);
    fields.destination.addEventListener("input", handleTripFieldInteraction, true);

    fields.origin.addEventListener("blur", handleTripFieldBlur, true);
    fields.destination.addEventListener("blur", handleTripFieldBlur, true);

    if (originClear) {
      originClear.addEventListener("click", handleTripClearClick, true);
    }

    if (destinationClear) {
      destinationClear.addEventListener("click", handleTripClearClick, true);
    }

    return true;
  }
  
  function registerServiceSpecificHooks() {
    const formsApi = getFormsNamespace();
    const serviceStateApi =
      formsApi &&
      formsApi.contactServiceState &&
      typeof formsApi.contactServiceState === "object"
        ? formsApi.contactServiceState
        : null;

    if (!serviceStateApi) {
      return false;
    }

    if (typeof serviceStateApi.registerSpecificDraftProbe === "function") {
      serviceStateApi.registerSpecificDraftProbe("airport_hotel", function () {
        const formData = getFormAndFields();

        if (!formData || !formData.form) {
          return false;
        }

        return getActiveState(formData.form);
      });
    }

    if (typeof serviceStateApi.registerSpecificReset === "function") {
      serviceStateApi.registerSpecificReset("airport_hotel", function () {
        clearPanelHandoffSummary();
      });
    }

    return true;
  }

  function initPanelHandoffSummary() {
    const formData = getFormAndFields();
    if (!formData) {
      return false;
    }

    const { form } = formData;
    const nodes = getSummaryNodes(form);
    if (!nodes) {
      return false;
    }

    setHidden(nodes.zoneBlock, true);
    setHidden(nodes.fareBlock, true);
    setActiveState(form, false);
    clearTripSnapshots(form);
    bindTripInvalidation();
    registerServiceSpecificHooks();

    return true;
  }

  const formsApi = getFormsNamespace();
  if (!formsApi) {
    return;
  }

  formsApi.initPanelHandoffSummary = initPanelHandoffSummary;
  formsApi.setPanelHandoffSummary = setPanelHandoffSummary;
  formsApi.clearPanelHandoffSummary = clearPanelHandoffSummary;
})();