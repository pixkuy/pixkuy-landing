(function initSharedAvailabilitySuggestion(global) {
  "use strict";

  var LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getLocale(value) {
    var locale = normalizeText(value) ||
      normalizeText(global.__pixkuyI18nLang) ||
      normalizeText(global.document && global.document.documentElement.lang) ||
      "es";

    return locale.toLowerCase() === "zh-cn" ? "zh-hans" : locale;
  }

  function isLocalDateTime(value) {
    return LOCAL_DATE_TIME_PATTERN.test(normalizeText(value));
  }

  function extract(result) {
    var safeResult = result && typeof result === "object" ? result : {};
    var raw = safeResult.raw && typeof safeResult.raw === "object"
      ? safeResult.raw
      : safeResult;
    var body = raw.body && typeof raw.body === "object" ? raw.body : raw;
    var outer = body.result && typeof body.result === "object"
      ? body.result
      : body;
    var inner = outer.result && typeof outer.result === "object"
      ? outer.result
      : outer;
    var availability = inner.availability && typeof inner.availability === "object"
      ? inner.availability
      : (outer.availability && typeof outer.availability === "object"
          ? outer.availability
          : {});

    return {
      code:
        normalizeText(safeResult.code) ||
        normalizeText(inner.code) ||
        normalizeText(availability.code),
      nextAvailableStartLocal:
        normalizeText(safeResult.nextAvailableStartLocal) ||
        normalizeText(inner.nextAvailableStartLocal) ||
        normalizeText(outer.nextAvailableStartLocal) ||
        normalizeText(availability.nextAvailableStartLocal),
      requestedLocalDate:
        normalizeText(safeResult.requestedLocalDate) ||
        normalizeText(inner.date) ||
        normalizeText(outer.date),
      locale:
        normalizeText(safeResult.locale) ||
        normalizeText(inner.locale) ||
        normalizeText(outer.locale)
    };
  }

  function format(input) {
    var safeInput = input && typeof input === "object" ? input : {};
    var value = normalizeText(
      safeInput.nextAvailableStartLocal || safeInput.value
    );
    var formatter =
      global.__pixkuyI18nModules &&
      global.__pixkuyI18nModules.formatNextAvailabilityLabel;

    if (!value) {
      return "";
    }

    if (
      safeInput.compact &&
      isLocalDateTime(value) &&
      normalizeText(safeInput.requestedLocalDate) === value.slice(0, 10)
    ) {
      return value.slice(11, 16);
    }

    if (safeInput.compact && isLocalDateTime(value)) {
      var localDate = new Date(value.slice(0, 16) + "Z");

      if (!Number.isNaN(localDate.getTime())) {
        return new Intl.DateTimeFormat(getLocale(safeInput.locale), {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: "UTC"
        }).format(localDate).replace(".", "");
      }
    }

    if (typeof formatter === "function") {
      return formatter({
        requestedLocalDate: normalizeText(safeInput.requestedLocalDate),
        nextAvailableStartLocal: value,
        locale: getLocale(safeInput.locale)
      });
    }

    return isLocalDateTime(value) ? value.slice(11, 16) : value;
  }

  function describe(result, options) {
    var safeOptions = options && typeof options === "object" ? options : {};
    var normalized = extract(result);
    var value = normalized.nextAvailableStartLocal;
    var label = format({
      nextAvailableStartLocal: value,
      requestedLocalDate:
        normalizeText(safeOptions.requestedLocalDate) ||
        normalized.requestedLocalDate,
      locale: normalizeText(safeOptions.locale) || normalized.locale,
      compact: Boolean(safeOptions.compact)
    });
    var template = safeOptions.compact
      ? normalizeText(safeOptions.compactTemplate) || "Próxima: {time}"
      : normalizeText(safeOptions.template) ||
        "Siguiente hora disponible: {time}";

    return {
      code: normalized.code,
      nextAvailableStartLocal: value,
      label: label,
      message: label ? template.replace("{time}", label) : ""
    };
  }

  function render(input) {
    var safeInput = input && typeof input === "object" ? input : {};
    var container = safeInput.container;
    var suggestion = describe(safeInput.result, safeInput);
    var baseMessage = normalizeText(safeInput.baseMessage);
    var actionClassName = normalizeText(safeInput.actionClassName);
    var action;

    if (!container) {
      return suggestion;
    }

    container.textContent = baseMessage;

    if (!suggestion.nextAvailableStartLocal || !suggestion.message) {
      return suggestion;
    }

    if (baseMessage) {
      container.appendChild(global.document.createTextNode(" "));
    }

    action = global.document.createElement("a");
    action.href = "#";
    action.textContent = suggestion.message;
    action.setAttribute("aria-label", suggestion.message);
    action.className = actionClassName
      ? "shared-availability-suggestion__link " + actionClassName
      : "shared-availability-suggestion__link";

    if (normalizeText(safeInput.actionAttribute)) {
      action.setAttribute(
        safeInput.actionAttribute,
        suggestion.nextAvailableStartLocal
      );
    }

    if (typeof safeInput.onApply === "function") {
      action.addEventListener("click", function applySuggestion(event) {
        event.preventDefault();
        safeInput.onApply(suggestion.nextAvailableStartLocal, suggestion);
      });
    }

    container.appendChild(action);
    return suggestion;
  }

  function isCurrentRequest(input) {
    var safeInput = input && typeof input === "object" ? input : {};

    return Boolean(
      safeInput.requestId === safeInput.currentRequestId &&
      safeInput.contextKey === safeInput.currentContextKey &&
      (!Object.prototype.hasOwnProperty.call(safeInput, "liveContextKey") ||
        safeInput.contextKey === safeInput.liveContextKey)
    );
  }

  function apply(input) {
    var safeInput = input && typeof input === "object" ? input : {};
    var value = normalizeText(
      safeInput.nextAvailableStartLocal || safeInput.value
    );

    if (!isLocalDateTime(value) || typeof safeInput.applyDateTime !== "function") {
      return Promise.resolve(false);
    }

    if (typeof safeInput.invalidate === "function") {
      safeInput.invalidate();
    }

    safeInput.applyDateTime({
      value: value,
      date: value.slice(0, 10),
      time: value.slice(11, 16)
    });

    if (typeof safeInput.setPendingUi === "function") {
      safeInput.setPendingUi();
    }

    return Promise.resolve(
      typeof safeInput.recheck === "function" ? safeInput.recheck() : true
    );
  }

  function syncUiState(input) {
    var safeInput = input && typeof input === "object" ? input : {};
    var priceVisible = safeInput.priceVisible !== false;
    var ctaEnabled = safeInput.ctaEnabled === true;

    if (typeof safeInput.setPriceVisible === "function") {
      safeInput.setPriceVisible(priceVisible);
    }

    if (typeof safeInput.setCtaEnabled === "function") {
      safeInput.setCtaEnabled(ctaEnabled);
    }

    return {
      priceVisible: priceVisible,
      ctaEnabled: ctaEnabled
    };
  }

  global.PixkuySharedAvailabilitySuggestion = Object.freeze({
    apply: apply,
    describe: describe,
    extract: extract,
    format: format,
    isCurrentRequest: isCurrentRequest,
    isLocalDateTime: isLocalDateTime,
    render: render,
    syncUiState: syncUiState
  });
})(window);
