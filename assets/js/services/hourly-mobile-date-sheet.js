/* assets/js/services/hourly-mobile-date-sheet.js
   Hourly / Daily mobile date sheet.
   Responsabilidad:
   - copiar la UX de Hotel Search Sheet de Airport para seleccionar fecha
   - abrir una pantalla secundaria móvil bajo topbar
   - sincronizar el input original [data-services-hourly-date]
   - no tocar hourly-daily-panel.js
   - no tocar desktop
*/

(function initHourlyMobileDateSheet(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const ROUTE_SELECTOR = ".hourly-mobile-route";
  const DATE_FIELD_SELECTOR = ".services-hourly-panel__field--date-mobile";
  const DATE_INPUT_SELECTOR = "[data-services-hourly-date]";
  const DATE_OVERLAY_SELECTOR = ".services-hourly-panel__date-overlay";

  const SHEET_SELECTOR = "[data-hourly-mobile-date-sheet]";
  const SHEET_PANEL_SELECTOR = "[data-hourly-mobile-date-sheet-panel]";
  const SHEET_INPUT_SELECTOR = "[data-hourly-mobile-date-sheet-input]";
  const SHEET_BACK_SELECTOR = "[data-hourly-mobile-date-sheet-back]";
  const SHEET_CLEAR_SELECTOR = "[data-hourly-mobile-date-sheet-clear]";
  const SHEET_CONFIRM_SELECTOR = "[data-hourly-mobile-date-sheet-confirm]";

  const BODY_SHEET_ATTR = "data-hourly-mobile-date-sheet-open";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let sheetNode = null;
  let sheetPanel = null;
  let sheetInput = null;
  let activeSourceInput = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function isHourlyRouteActive() {
    return Boolean(
      document.body &&
        document.body.getAttribute("data-hourly-mobile-screen") === "true"
    );
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

  function dispatchNativeInput(input) {
    if (!input) {
      return false;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function findSourceInput(target) {
    const route = document.querySelector(ROUTE_SELECTOR);
    const field = target && typeof target.closest === "function"
      ? target.closest(DATE_FIELD_SELECTOR)
      : null;

    if (!route || !field || !route.contains(field)) {
      return null;
    }

    return field.querySelector(DATE_INPUT_SELECTOR);
  }

  function syncSourceOverlay(sourceInput) {
    const field = sourceInput && typeof sourceInput.closest === "function"
      ? sourceInput.closest(DATE_FIELD_SELECTOR)
      : null;
    const overlay = field ? field.querySelector(DATE_OVERLAY_SELECTOR) : null;

    if (overlay) {
      overlay.hidden = Boolean(sourceInput.value);
    }

    return true;
  }

  function buildSheet() {
    const sheet = document.createElement("section");

    sheet.className = "hourly-mobile-date-sheet";
    sheet.setAttribute("data-hourly-mobile-date-sheet", "1");
    sheet.setAttribute("aria-hidden", "true");
    sheet.hidden = true;

    sheet.innerHTML = `
      <div class="hourly-mobile-date-sheet__screen" data-hourly-mobile-date-sheet-panel>
        <div class="hourly-mobile-date-sheet__top">
          <button
            type="button"
            class="hourly-mobile-date-sheet__back"
            data-hourly-mobile-date-sheet-back
          ></button>

          <button
            type="button"
            class="hourly-mobile-date-sheet__clear"
            data-hourly-mobile-date-sheet-clear
          >×</button>
        </div>

        <div class="hourly-mobile-date-sheet__header">
          <h3 class="hourly-mobile-date-sheet__title" data-hourly-mobile-date-sheet-title></h3>
          <p class="hourly-mobile-date-sheet__text" data-hourly-mobile-date-sheet-text></p>
        </div>

        <div class="hourly-mobile-date-sheet__body">
          <label
            class="hourly-mobile-date-sheet__label"
            for="hourly-mobile-date-sheet-input"
            data-hourly-mobile-date-sheet-label
          ></label>

          <div class="hourly-mobile-date-sheet__control-wrap">
            <input
              id="hourly-mobile-date-sheet-input"
              type="date"
              class="hourly-mobile-date-sheet__control"
              data-hourly-mobile-date-sheet-input
              autocomplete="off"
            />

            <span class="hourly-mobile-date-sheet__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" focusable="false">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"></line>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"></line>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"></line>
              </svg>
            </span>
          </div>
        </div>

        <div class="hourly-mobile-date-sheet__footer">
          <button
            type="button"
            class="hourly-mobile-date-sheet__confirm"
            data-hourly-mobile-date-sheet-confirm
          ></button>
        </div>
      </div>
    `;

    return sheet;
  }

  function syncCopy() {
    const title = sheetNode ? sheetNode.querySelector("[data-hourly-mobile-date-sheet-title]") : null;
    const text = sheetNode ? sheetNode.querySelector("[data-hourly-mobile-date-sheet-text]") : null;
    const label = sheetNode ? sheetNode.querySelector("[data-hourly-mobile-date-sheet-label]") : null;
    const back = sheetNode ? sheetNode.querySelector(SHEET_BACK_SELECTOR) : null;
    const clear = sheetNode ? sheetNode.querySelector(SHEET_CLEAR_SELECTOR) : null;
    const confirm = sheetNode ? sheetNode.querySelector(SHEET_CONFIRM_SELECTOR) : null;

    const backText = getI18nValue("services.cards.airport.panel.back", "Volver");
    const titleText = getI18nValue("services.cards.hourly.panel.dateLabel", "Fecha");
    const textValue = getI18nValue(
      "contact.datePlaceholder",
      "dd/mm/aaaa"
    );
    const confirmText = getI18nValue("services.cards.airport.panel.continue", "Continuar");

    if (title) {
      title.textContent = titleText;
    }

    if (text) {
      text.textContent = textValue;
    }

    if (label) {
      label.textContent = titleText;
    }

    if (back) {
      back.textContent = backText;
    }

    if (clear) {
      clear.setAttribute(
        "aria-label",
        getI18nValue("services.cards.airport.panel.clearResolvedDestination", "Borrar")
      );
    }

    if (confirm) {
      confirm.textContent = confirmText;
    }

    return true;
  }

  function ensureSheet() {
    if (sheetNode && sheetPanel && sheetInput) {
      return sheetNode;
    }

    sheetNode = document.querySelector(SHEET_SELECTOR);

    if (!sheetNode) {
      sheetNode = buildSheet();
      document.body.appendChild(sheetNode);
    }

    sheetPanel = sheetNode.querySelector(SHEET_PANEL_SELECTOR);
    sheetInput = sheetNode.querySelector(SHEET_INPUT_SELECTOR);

    bindSheetEvents();
    syncCopy();

    return sheetNode;
  }

  function openSheet(sourceInput) {
    if (!isMobileViewport() || !isHourlyRouteActive() || !sourceInput) {
      return false;
    }

    ensureSheet();

    activeSourceInput = sourceInput;
    sheetInput.value = sourceInput.value || "";

    if (sourceInput.min) {
      sheetInput.min = sourceInput.min;
    } else {
      sheetInput.removeAttribute("min");
    }

    if (sourceInput.max) {
      sheetInput.max = sourceInput.max;
    } else {
      sheetInput.removeAttribute("max");
    }

    sheetNode.hidden = false;
    sheetNode.setAttribute("aria-hidden", "false");
    document.body.setAttribute(BODY_SHEET_ATTR, "true");

    window.requestAnimationFrame(function focusDateInput() {
      if (sheetInput) {
        sheetInput.focus({ preventScroll: true });
      }
    });

    return true;
  }

  function closeSheet() {
    if (!sheetNode) {
      return false;
    }

    sheetNode.hidden = true;
    sheetNode.setAttribute("aria-hidden", "true");
    document.body.setAttribute(BODY_SHEET_ATTR, "false");

    activeSourceInput = null;

    return true;
  }

  function applyDateValue(value) {
    if (!activeSourceInput) {
      return false;
    }

    activeSourceInput.value = value || "";
    syncSourceOverlay(activeSourceInput);
    dispatchNativeInput(activeSourceInput);

    return true;
  }

  function bindSheetEvents() {
    if (!sheetNode || sheetNode.dataset.hourlyMobileDateSheetBound === "1") {
      return false;
    }

    sheetNode.dataset.hourlyMobileDateSheetBound = "1";

    sheetNode.addEventListener("click", function onSheetClick(event) {
      const back = event.target.closest(SHEET_BACK_SELECTOR);
      const clear = event.target.closest(SHEET_CLEAR_SELECTOR);
      const confirm = event.target.closest(SHEET_CONFIRM_SELECTOR);

      if (back) {
        closeSheet();
        return;
      }

      if (clear) {
        if (sheetInput) {
          sheetInput.value = "";
        }

        applyDateValue("");
        return;
      }

      if (confirm) {
        applyDateValue(sheetInput ? sheetInput.value : "");
        closeSheet();
      }
    });

    sheetNode.addEventListener("change", function onSheetChange(event) {
      if (!event.target.matches(SHEET_INPUT_SELECTOR)) {
        return;
      }

      applyDateValue(event.target.value || "");
    });

    sheetNode.addEventListener("input", function onSheetInput(event) {
      if (!event.target.matches(SHEET_INPUT_SELECTOR)) {
        return;
      }

      applyDateValue(event.target.value || "");
    });

    return true;
  }

  function interceptDateField(event) {
    const sourceInput = findSourceInput(event.target);

    if (!sourceInput || !isMobileViewport() || !isHourlyRouteActive()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    openSheet(sourceInput);
  }

  function bindGlobalEvents() {
    document.addEventListener("click", interceptDateField, true);
    document.addEventListener("pointerdown", interceptDateField, true);

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      if (sheetNode) {
        syncCopy();
      }
    });

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", function onViewportChange() {
        if (!isMobileViewport()) {
          closeSheet();
        }
      });
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(function onViewportChange() {
        if (!isMobileViewport()) {
          closeSheet();
        }
      });
    }

    return true;
  }

  bindGlobalEvents();
})(window, document);