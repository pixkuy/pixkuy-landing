/* assets/js/services/hourly-mobile-pickup-search-sheet.js
   Hourly / Daily mobile pickup search sheet.
   Responsabilidad:
   - abrir el punto de recogida Hourly en una search sheet móvil tipo Airport Hotel
   - reutilizar Google Places shared runtime
   - sincronizar el input real del panel Hourly
   - no duplicar pricing, payload ni handoff
   - no tocar desktop
*/

(function initHourlyMobilePickupSearchSheet(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const SELECTORS = {
    route: "[data-hourly-mobile-route]",
    sourceInput: ".hourly-mobile-route [data-services-hourly-pickup-input]",
    sheet: "[data-hourly-mobile-pickup-search-sheet]",
    input: "[data-hourly-mobile-pickup-search-input]",
    mount: "[data-hourly-mobile-pickup-search-mount]",
    close: "[data-hourly-mobile-pickup-search-close]",
    clear: "[data-hourly-mobile-pickup-search-clear]",
    title: "[data-hourly-mobile-pickup-search-title]"
  };

  const I18N_KEYS = {
    title: "services.cards.hourly.panel.pickupLabel",
    close: "services.cards.airport.panel.back"
  };

  let activeSourceInput = null;
  let activeController = null;
  let hasCommittedSelection = false;
  let hasSearchEdited = false;
  let openingValue = "";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
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

  function isMobileRouteActive() {
    const isMobile = window.matchMedia
      ? window.matchMedia("(max-width:720px)").matches
      : false;

    return Boolean(
      isMobile &&
        document.body &&
        document.body.getAttribute("data-hourly-mobile-screen") === "true"
    );
  }

  function getI18nValue(path, fallback) {
    const dict = window.__pixkuyI18nDict;

    if (!dict || !path) {
      return fallback || "";
    }

    const parts = String(path).split(".");
    let cursor = dict;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];

      if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
        return fallback || "";
      }

      cursor = cursor[part];
    }

    return typeof cursor === "string" ? cursor : (fallback || "");
  }

  function getPlacesApi() {
    const api =
      window.PixkuyForms &&
      window.PixkuyForms.googlePlaces &&
      typeof window.PixkuyForms.googlePlaces.createAutocompleteController === "function"
        ? window.PixkuyForms.googlePlaces
        : null;

    return api;
  }

  function getSheet() {
    return document.querySelector(SELECTORS.sheet);
  }

  function buildSheet() {
    const sheet = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const title = document.createElement("p");
    const close = document.createElement("button");
    const search = document.createElement("div");
    const input = document.createElement("input");
    const clear = document.createElement("button");
    const mount = document.createElement("div");

    sheet.className = "hourly-mobile-pickup-search-sheet";
    sheet.setAttribute("data-hourly-mobile-pickup-search-sheet", "1");
    sheet.setAttribute("aria-hidden", "true");

    panel.className = "hourly-mobile-pickup-search-sheet__panel";

    header.className = "hourly-mobile-pickup-search-sheet__header";

    title.className = "hourly-mobile-pickup-search-sheet__title";
    title.setAttribute("data-hourly-mobile-pickup-search-title", "1");

    close.type = "button";
    close.className = "hourly-mobile-pickup-search-sheet__close";
    close.setAttribute("data-hourly-mobile-pickup-search-close", "1");

    search.className = "hourly-mobile-pickup-search-sheet__search";

    input.type = "text";
    input.className = "hourly-mobile-pickup-search-sheet__input";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("data-hourly-mobile-pickup-search-input", "1");

    clear.type = "button";
    clear.className = "hourly-mobile-pickup-search-sheet__clear";
    clear.setAttribute("data-hourly-mobile-pickup-search-clear", "1");
    clear.hidden = true;
    clear.textContent = "×";

    mount.className = "hourly-mobile-pickup-search-sheet__mount";
    mount.setAttribute("data-hourly-mobile-pickup-search-mount", "1");

    header.appendChild(title);
    header.appendChild(close);
    search.appendChild(input);
    search.appendChild(clear);
    panel.appendChild(header);
    panel.appendChild(search);
    panel.appendChild(mount);
    sheet.appendChild(panel);

    return sheet;
  }

  function bindSheetEvents(sheet) {
    if (!sheet || sheet.dataset.hourlyMobilePickupSearchBound === "1") {
      return false;
    }

    sheet.dataset.hourlyMobilePickupSearchBound = "1";

    sheet.addEventListener("click", function onSheetClick(event) {
      const close = event.target.closest(SELECTORS.close);
      const clear = event.target.closest(SELECTORS.clear);
      const panel = event.target.closest(".hourly-mobile-pickup-search-sheet__panel");

      if (close) {
        closeSheet({ refocus: false });
        return;
      }

      if (clear) {
        clearSearch();
        return;
      }

      if (!panel) {
        closeSheet({ refocus: false });
      }
    });

    sheet.addEventListener("input", function onSheetInput(event) {
      const input = event.target.closest(SELECTORS.input);

      if (!input) {
        return;
      }

      hasSearchEdited = true;
      setInternalValue(input.value);
      syncSourceInputValue(input.value);
    });

    return true;
  }

  function ensureSheet() {
    let sheet = getSheet();
    const route = document.querySelector(SELECTORS.route);

    if (sheet) {
      return sheet;
    }

    sheet = buildSheet();

    if (route) {
      route.appendChild(sheet);
    } else {
      document.body.appendChild(sheet);
    }

    bindSheetEvents(sheet);

    return sheet;
  }

  function syncSheetCopy(sheet) {
    const title = sheet ? sheet.querySelector(SELECTORS.title) : null;
    const close = sheet ? sheet.querySelector(SELECTORS.close) : null;
    const input = sheet ? sheet.querySelector(SELECTORS.input) : null;

    const titleText = getI18nValue(I18N_KEYS.title, "");
    const closeText = getI18nValue(I18N_KEYS.close, "");

    if (title) {
      title.textContent = titleText;
    }

    if (close) {
      close.textContent = closeText;
    }

    if (input) {
      input.setAttribute("placeholder", "");
    }

    return true;
  }

  function setInternalValue(value) {
    const sheet = ensureSheet();
    const input = sheet.querySelector(SELECTORS.input);
    const clear = sheet.querySelector(SELECTORS.clear);
    const normalized = typeof value === "string" ? value : "";

    if (input && input.value !== normalized) {
      input.value = normalized;
    }

    if (clear) {
      clear.hidden = normalizeText(normalized).length === 0;
    }

    return true;
  }

  function syncSourceInputValue(value) {
    const sourceInput = activeSourceInput;
    const normalized = typeof value === "string" ? value : "";

    if (!sourceInput) {
      return false;
    }

    if (sourceInput.value !== normalized) {
      sourceInput.value = normalized;
    }

    sourceInput.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );

    return true;
  }
  
  function dispatchSourcePlaceSelection(selectedPlace, label) {
  const sourceInput = activeSourceInput;
  const normalizedLabel = normalizeText(label);

  if (!sourceInput || !selectedPlace || !normalizedLabel) {
    return false;
  }

  sourceInput.value = normalizedLabel;

  sourceInput.dispatchEvent(
    new CustomEvent("pixkuy:hourly-daily-pickup-selected", {
      bubbles: true,
      detail: {
        selectedPlace: selectedPlace,
        label: normalizedLabel
      }
    })
  );

  return true;
}

  function resetSourceInputScroll() {
    const sourceInput = activeSourceInput;

    if (!sourceInput) {
      return false;
    }

    window.requestAnimationFrame(function resetInputScrollFrame() {
      sourceInput.scrollLeft = 0;

      try {
        sourceInput.setSelectionRange(0, 0);
      } catch (error) {}

      sourceInput.blur();
    });

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
  
    function collapseSourceAutocomplete() {
    const sourceInput = activeSourceInput;
    const root = sourceInput
      ? sourceInput.closest('[data-place-autocomplete="hourly_daily_pickup"]')
      : null;
    const mountNode = root
      ? root.querySelector('[data-place-mount="hourly_daily_pickup"]')
      : null;

    function collapseOnce() {
      if (root) {
        root.classList.remove("is-open");
        root.setAttribute("aria-expanded", "false");
      }

      if (mountNode) {
        mountNode.setAttribute("aria-hidden", "true");
        mountNode.innerHTML = "";
      }

      if (sourceInput) {
        sourceInput.blur();
      }
    }

    collapseOnce();

    window.requestAnimationFrame(function collapseAfterFrame() {
      collapseOnce();

      window.setTimeout(function collapseAfterControllerRender() {
        collapseOnce();
      }, 80);
    });

    return true;
  }

  function destroyController() {
    if (activeController && typeof activeController.destroy === "function") {
      activeController.destroy();
    }

    activeController = null;

    return true;
  }

  function mountSheetAutocomplete(sheet) {
    const placesApi = getPlacesApi();
    const input = sheet ? sheet.querySelector(SELECTORS.input) : null;
    const mountNode = sheet ? sheet.querySelector(SELECTORS.mount) : null;

    destroyController();

    if (!placesApi || !input || !mountNode) {
      return false;
    }

    mountNode.innerHTML = "";

    activeController = placesApi.createAutocompleteController({
      fieldName: "hourly_daily_pickup_mobile_sheet",
      input: input,
      mountNode: mountNode,
      hiddenFields: {},
      language: normalizeGoogleLanguage(getDocumentLanguage()),
      region: "mx",
      includedRegionCodes: ["mx"],
      onSelection: function onPickupSheetSelection(selectedPlace) {
        const label = normalizeText(
          selectedPlace &&
            (
              selectedPlace.label ||
              selectedPlace.formattedAddress ||
              selectedPlace.displayName
            )
        );

        if (!selectedPlace || !label) {
          return;
        }

        hasCommittedSelection = true;
setInternalValue(label);
dispatchSourcePlaceSelection(selectedPlace, label);
resetSourceInputScroll();
closeSheet({ refocus: false });
collapseSourceAutocomplete();
      },
      onError: function onPickupSheetError() {}
    });

    activeController.mount();

    return true;
  }

  function openSheet(sourceInput) {
    const sheet = ensureSheet();
    const resolvedSourceInput = sourceInput || null;
    const value = resolvedSourceInput ? resolvedSourceInput.value : "";

    activeSourceInput = resolvedSourceInput;
    hasCommittedSelection = false;
    hasSearchEdited = false;
    openingValue = value || "";

    syncSheetCopy(sheet);
    setInternalValue(value || "");
    mountSheetAutocomplete(sheet);

    sheet.setAttribute("aria-hidden", "false");
    document.body.setAttribute("data-hourly-mobile-pickup-search-open", "true");

    if (activeSourceInput) {
      activeSourceInput.blur();
    }

    window.setTimeout(function focusSearchInput() {
      const input = sheet.querySelector(SELECTORS.input);

      if (input) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 160);

    return true;
  }

  function closeSheet(options) {
    const sheet = getSheet();
    const shouldRefocus = Boolean(options && options.refocus === true);

    if (!sheet) {
      return false;
    }

    if (!hasCommittedSelection && hasSearchEdited) {
      setInternalValue(openingValue);
      syncSourceInputValue(openingValue);
    }

    blurActiveElementInside(sheet);

    sheet.setAttribute("aria-hidden", "true");
    document.body.removeAttribute("data-hourly-mobile-pickup-search-open");

    destroyController();

    if (shouldRefocus && activeSourceInput) {
      activeSourceInput.focus({ preventScroll: true });
    }

    hasCommittedSelection = false;
    hasSearchEdited = false;
    openingValue = "";

    return true;
  }

  function clearSearch() {
    const sheet = ensureSheet();
    const mountNode = sheet.querySelector(SELECTORS.mount);

    hasSearchEdited = true;

    setInternalValue("");
    syncSourceInputValue("");

    if (mountNode) {
      mountNode.innerHTML = "";
    }

    return true;
  }

  function handleSourceActivation(event) {
    const sourceInput = event.target.closest(SELECTORS.sourceInput);
    const sheet = getSheet();

    if (!sourceInput || !isMobileRouteActive()) {
      return;
    }

    if (sheet && sheet.getAttribute("aria-hidden") === "false") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    openSheet(sourceInput);
  }

  function bindGlobalEvents() {
    document.addEventListener("pointerdown", handleSourceActivation, true);
    document.addEventListener("focusin", handleSourceActivation, true);

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      const sheet = getSheet();

      if (sheet) {
        syncSheetCopy(sheet);
      }
    });

    return true;
  }

  bindGlobalEvents();
})(window, document);