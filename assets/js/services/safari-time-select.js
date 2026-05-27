/* assets/js/services/safari-time-select.js
   Safari desktop time select fallback.
   Responsabilidad:
   - detectar Safari desktop real
   - sustituir input[type="time"] por select HH:MM fiable cuando el navegador no escribe value correctamente
   - sincronizar valor visible y estado del consumidor mediante callbacks explícitos
   NO incluir:
   - pricing
   - quote
   - availability
   - handoff
   - submit
   - lógica específica de Airport, Hourly, Direct Transfer o Events
*/

(function initPixkuySafariTimeSelect(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isDesktopSafariEnabled() {
    var userAgent = window.navigator && window.navigator.userAgent
      ? window.navigator.userAgent
      : "";
    var platform = window.navigator && window.navigator.platform
      ? window.navigator.platform
      : "";
    var maxTouchPoints = window.navigator && Number.isFinite(window.navigator.maxTouchPoints)
      ? window.navigator.maxTouchPoints
      : 0;
    var isSafari = /Safari/i.test(userAgent) &&
      !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/i.test(userAgent);
    var isMobileUserAgent = /Mobile|iPhone|iPad|iPod|Android/i.test(userAgent);
    var isIpadDesktopMode = /Mac/i.test(platform) && maxTouchPoints > 1;

    return Boolean(isSafari && !isMobileUserAgent && !isIpadDesktopMode);
  }

  function buildSelect(options) {
    var safeOptions = options && typeof options === "object" ? options : {};
    var select = document.createElement("select");
    var placeholder = document.createElement("option");
    var hour;
    var minute;

    select.className = normalizeText(safeOptions.className);
    select.setAttribute("data-pixkuy-safari-time-select", "1");

    if (safeOptions.dataAttributeName && safeOptions.dataAttributeValue) {
      select.setAttribute(
        normalizeText(safeOptions.dataAttributeName),
        normalizeText(safeOptions.dataAttributeValue)
      );
    }

    select.setAttribute("aria-label", normalizeText(safeOptions.label) || normalizeText(safeOptions.placeholder) || "Hora");
    select.style.width = "100%";
    select.style.paddingRight = "34px";
    select.style.webkitAppearance = "none";
    select.style.appearance = "none";

    placeholder.value = "";
    placeholder.textContent = normalizeText(safeOptions.placeholder) || "--:--";
    select.appendChild(placeholder);

    for (hour = 0; hour < 24; hour += 1) {
      for (minute = 0; minute < 60; minute += 15) {
        var value = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
        var option = document.createElement("option");

        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
    }

    return select;
  }

  function getSelect(container, selector) {
    if (!container || !selector) {
      return null;
    }

    return container.querySelector(selector);
  }

  function syncSelect(select, value) {
    var safeValue = normalizeText(value);

    if (!select) {
      return false;
    }

    if (select.value !== safeValue) {
      select.value = safeValue;
    }

    return true;
  }

  function hideNativeInput(input, overlay) {
    input.hidden = true;
    input.style.display = "none";
    input.setAttribute("aria-hidden", "true");
    input.setAttribute("tabindex", "-1");

    if (overlay) {
      overlay.hidden = true;
      overlay.style.display = "none";
    }
  }

  function mount(options) {
    var safeOptions = options && typeof options === "object" ? options : {};
    var input = safeOptions.input || null;
    var container = safeOptions.container || (input && input.parentNode ? input.parentNode : null);
    var existingSelect = getSelect(container, safeOptions.selectSelector);
    var select;

    if (
      !isDesktopSafariEnabled() ||
      !input ||
      !input.parentNode ||
      !container ||
      !safeOptions.selectSelector ||
      typeof safeOptions.getValue !== "function" ||
      typeof safeOptions.onValueChange !== "function"
    ) {
      return {
        mounted: false,
        select: null,
        sync: function syncFallback() {
          return false;
        }
      };
    }

    if (existingSelect) {
      syncSelect(existingSelect, safeOptions.getValue());
      return {
        mounted: true,
        select: existingSelect,
        sync: function syncExistingFallback() {
          return syncSelect(existingSelect, safeOptions.getValue());
        }
      };
    }

    select = buildSelect({
      className: safeOptions.className,
      label: safeOptions.label,
      placeholder: safeOptions.placeholder,
      dataAttributeName: safeOptions.dataAttributeName,
      dataAttributeValue: safeOptions.dataAttributeValue
    });

    hideNativeInput(input, safeOptions.overlay || null);

    select.addEventListener("input", function onSelectInput() {
      safeOptions.onValueChange(normalizeText(select.value), input, select);
      syncSelect(select, safeOptions.getValue());
    });

    select.addEventListener("change", function onSelectChange() {
      safeOptions.onValueChange(normalizeText(select.value), input, select);
      syncSelect(select, safeOptions.getValue());
    });

    input.parentNode.insertBefore(select, input);
    syncSelect(select, safeOptions.getValue());

    return {
      mounted: true,
      select: select,
      sync: function syncMountedFallback() {
        return syncSelect(select, safeOptions.getValue());
      }
    };
  }

  window.PixkuySafariTimeSelect = {
    isDesktopSafariEnabled: isDesktopSafariEnabled,
    mount: mount
  };
})(window, document);