(function () {
  "use strict";

  const SELECTORS = {
    route: "[data-airport-mobile-route]",
    sourceInput: "[data-airport-lodging-input]",
    sheet: "[data-airport-mobile-hotel-search-sheet]",
    input: "[data-airport-mobile-hotel-search-input]",
    list: "[data-airport-mobile-hotel-search-list]",
    close: "[data-airport-mobile-hotel-search-close]",
    clear: "[data-airport-mobile-hotel-search-clear]"
  };

  const I18N_KEYS = {
    title: "services.cards.airport.panel.hotelPlaceholder",
    close: "services.cards.airport.panel.back"
  };

  let activeSourceInput = null;
  let hasCommittedSelection = false;
  let hasSearchEdited = false;
  let openingSelectedLabel = "";

  function normalizeText(value) {
    return typeof value === "string" ? value : "";
  }

  function isMobileRouteActive() {
    const isMobile = window.matchMedia
      ? window.matchMedia("(max-width: 720px)").matches
      : false;

    return Boolean(
      isMobile &&
        document.body &&
        document.body.getAttribute("data-airport-mobile-screen") === "true"
    );
  }

  function getI18nValue(path, fallback) {
    const dict = window.__pixkuyI18nDict;

    if (!dict || !path) {
      return fallback;
    }

    const parts = path.split(".");
    let cursor = dict;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];

      if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
        return fallback;
      }

      cursor = cursor[part];
    }

    return typeof cursor === "string" ? cursor : fallback;
  }

  function getAutocompleteApi() {
    const api = window.PixkuyAirportLodgingAutocomplete;

    return api && typeof api === "object" ? api : null;
  }

  function getActiveDom() {
    const api = getAutocompleteApi();

    return api && typeof api.getActiveDom === "function"
      ? api.getActiveDom()
      : null;
  }

  function getCurrentSelectedLabel() {
    const api = getAutocompleteApi();
    const selectedItem =
      api && typeof api.getSelectedItem === "function"
        ? api.getSelectedItem()
        : null;

    return normalizeText(selectedItem && selectedItem.label);
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
    const list = document.createElement("div");

    sheet.className = "airport-mobile-hotel-search-sheet";
    sheet.setAttribute("data-airport-mobile-hotel-search-sheet", "1");
    sheet.setAttribute("aria-hidden", "true");

    panel.className = "airport-mobile-hotel-search-sheet__panel";

    header.className = "airport-mobile-hotel-search-sheet__header";

    title.className = "airport-mobile-hotel-search-sheet__title";
    title.setAttribute("data-airport-mobile-hotel-search-title", "1");

    close.type = "button";
    close.className = "airport-mobile-hotel-search-sheet__close";
    close.setAttribute("data-airport-mobile-hotel-search-close", "1");

    search.className = "airport-mobile-hotel-search-sheet__search";

    input.type = "text";
    input.className = "airport-mobile-hotel-search-sheet__input";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("data-airport-mobile-hotel-search-input", "1");

    clear.type = "button";
    clear.className = "airport-mobile-hotel-search-sheet__clear";
    clear.setAttribute("data-airport-mobile-hotel-search-clear", "1");
    clear.hidden = true;
    clear.textContent = "×";

    list.className = "airport-mobile-hotel-search-sheet__list";
    list.setAttribute("data-airport-mobile-hotel-search-list", "1");

    header.appendChild(title);
    header.appendChild(close);
    search.appendChild(input);
    search.appendChild(clear);
    panel.appendChild(header);
    panel.appendChild(search);
    panel.appendChild(list);
    sheet.appendChild(panel);

    return sheet;
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
    const title = sheet.querySelector("[data-airport-mobile-hotel-search-title]");
    const close = sheet.querySelector(SELECTORS.close);
    const input = sheet.querySelector(SELECTORS.input);
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
  }

  function clearRenderedOptions() {
    const sheet = getSheet();
    const list = sheet ? sheet.querySelector(SELECTORS.list) : null;

    if (list) {
      list.innerHTML = "";
    }

    return true;
  }

  function renderOptions(items, activeIndex) {
    const sheet = ensureSheet();
    const list = sheet.querySelector(SELECTORS.list);

    if (!list) {
      return false;
    }

    list.innerHTML = "";

    if (!Array.isArray(items) || !items.length) {
      return false;
    }

    items.forEach(function renderOption(item, index) {
      const label = normalizeText(item && item.label);
      const option = document.createElement("button");

      if (!label) {
        return;
      }

      option.type = "button";
      option.className = "airport-mobile-hotel-search-sheet__option";
      option.dataset.airportMobileHotelSearchOption = String(index);
      option.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
      option.textContent = label;

      list.appendChild(option);
    });

    return true;
  }

  function setInternalValue(value) {
    const sheet = ensureSheet();
    const input = sheet.querySelector(SELECTORS.input);
    const clear = sheet.querySelector(SELECTORS.clear);
    const normalized = normalizeText(value);

    if (input && input.value !== normalized) {
      input.value = normalized;
    }

    if (clear) {
      clear.hidden = normalized.trim().length === 0;
    }
  }

  function syncSourceInputValue(value) {
    const sourceInput = activeSourceInput || getActiveSourceInput();

    if (!sourceInput) {
      return false;
    }

    if (sourceInput.value !== value) {
      sourceInput.value = value;
    }

    sourceInput.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );

    return true;
  }

  function resetSourceInputScroll() {
    const sourceInput = activeSourceInput || getActiveSourceInput();

    if (!sourceInput) {
      return false;
    }

    window.requestAnimationFrame(function resetInputScrollFrame() {
      sourceInput.scrollLeft = 0;
      sourceInput.setSelectionRange(0, 0);
      sourceInput.blur();
    });

    return true;
  }

  function openSheet(sourceInput) {
    const sheet = ensureSheet();
    const resolvedSourceInput = sourceInput || getActiveSourceInput();
    const value = resolvedSourceInput ? resolvedSourceInput.value : "";

    activeSourceInput = resolvedSourceInput;
    hasCommittedSelection = false;
    hasSearchEdited = false;
    openingSelectedLabel = getCurrentSelectedLabel();

    syncSheetCopy(sheet);
    setInternalValue(value);
    clearRenderedOptions();

    sheet.setAttribute("aria-hidden", "false");
    document.body.setAttribute("data-airport-mobile-hotel-search-open", "true");

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
      syncSourceInputValue(openingSelectedLabel);
    }

    clearRenderedOptions();

    sheet.setAttribute("aria-hidden", "true");
    document.body.removeAttribute("data-airport-mobile-hotel-search-open");

    if (shouldRefocus && activeSourceInput) {
      activeSourceInput.focus({ preventScroll: true });
    }

    hasCommittedSelection = false;
    hasSearchEdited = false;
    openingSelectedLabel = "";

    return true;
  }

  function clearSearch() {
    hasSearchEdited = true;

    setInternalValue("");
    syncSourceInputValue("");

    const sheet = ensureSheet();
    const list = sheet.querySelector(SELECTORS.list);

    if (list) {
      list.innerHTML = "";
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

    openSheet(sourceInput);
  }

  function handleAutocompleteUpdate(event) {
    const detail = event && event.detail ? event.detail : {};
    const sheet = getSheet();

    if (
      !isMobileRouteActive() ||
      !sheet ||
      sheet.getAttribute("aria-hidden") !== "false"
    ) {
      return;
    }

    renderOptions(detail.items, detail.activeIndex);
  }

  function bindSheetEvents(sheet) {
    if (!sheet || sheet.dataset.airportMobileHotelSearchBound === "1") {
      return false;
    }

    sheet.dataset.airportMobileHotelSearchBound = "1";

    sheet.addEventListener("click", function onSheetClick(event) {
      const close = event.target.closest(SELECTORS.close);
      const clear = event.target.closest(SELECTORS.clear);
      const option = event.target.closest("[data-airport-mobile-hotel-search-option]");
      const panel = event.target.closest(".airport-mobile-hotel-search-sheet__panel");
      const api = getAutocompleteApi();

      if (close) {
        closeSheet({ refocus: false });
        return;
      }

      if (clear) {
        clearSearch();
        return;
      }

      if (option && api && typeof api.selectItemAtIndex === "function") {
        const selected = api.selectItemAtIndex(
          option.dataset.airportMobileHotelSearchOption
        );

        if (selected) {
          hasCommittedSelection = true;
          resetSourceInputScroll();
          closeSheet({ refocus: false });
        }

        return;
      }

      if (!panel) {
        closeSheet();
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

  function bindGlobalEvents() {
    document.addEventListener("pointerdown", handleSourceActivation, true);
    document.addEventListener("focusin", handleSourceActivation, true);

    window.addEventListener(
      "pixkuy:airport-lodging-autocomplete-updated",
      handleAutocompleteUpdate
    );

    window.addEventListener("pixkuy:i18n-applied", function onI18nApplied() {
      const sheet = getSheet();

      if (sheet) {
        syncSheetCopy(sheet);
      }
    });
  }

  bindGlobalEvents();
})();