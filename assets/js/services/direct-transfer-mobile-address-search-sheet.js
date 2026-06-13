/* assets/js/services/direct-transfer-mobile-address-search-sheet.js
   Direct transfer mobile address search sheet.
   Responsabilidad:
   - abrir origen/destino Direct Transfer en una search sheet móvil
   - reutilizar Google Places shared runtime
   - sincronizar el input compacto del Config Step Direct Transfer
   - no tocar desktop
   - no tocar Google Places shared
   - no tocar Netlify/contact/submit
*/

(function initDirectTransferMobileAddressSearchSheet(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const SELECTORS = {
    route: "[data-direct-transfer-mobile-route]",
    sourceInput: ".direct-transfer-mobile-config-step [data-direct-transfer-mobile-address-input]",
    sheet: "[data-direct-transfer-mobile-address-search-sheet]",
    input: "[data-direct-transfer-mobile-address-search-input]",
    mount: "[data-direct-transfer-mobile-address-search-mount]",
    close: "[data-direct-transfer-mobile-address-search-close]",
    clear: "[data-direct-transfer-mobile-address-search-clear]",
    title: "[data-direct-transfer-mobile-address-search-title]"
  };

  let activeSourceInput = null;
  let activeController = null;
  let controllerMountRequestId = 0;
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

  function isDirectTransferConfigActive() {
    const isMobile = window.matchMedia
      ? window.matchMedia("(max-width:720px)").matches
      : false;

    return Boolean(
      isMobile &&
        document.body &&
        document.body.getAttribute("data-direct-transfer-mobile-config-screen") === "true"
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

  function getPlacesApi() {
    return (
      window.PixkuyForms &&
      window.PixkuyForms.googlePlaces &&
      typeof window.PixkuyForms.googlePlaces.createAutocompleteController === "function"
    )
      ? window.PixkuyForms.googlePlaces
      : null;
  }
  
    function getDirectTransferCoverageApi() {
    const api = window.PixkuyDirectTransferCoverage;

    return api && typeof api === "object" ? api : null;
  }

  function isValidPlacesLocationRestriction(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        Number.isFinite(Number(value.north)) &&
        Number.isFinite(Number(value.south)) &&
        Number.isFinite(Number(value.east)) &&
        Number.isFinite(Number(value.west)) &&
        Number(value.north) > Number(value.south) &&
        Number(value.east) > Number(value.west)
    );
  }

  function clonePlacesLocationRestriction(value) {
    if (!isValidPlacesLocationRestriction(value)) {
      return null;
    }

    return {
      north: Number(value.north),
      south: Number(value.south),
      east: Number(value.east),
      west: Number(value.west)
    };
  }

  function getDirectTransferSearchLocationRestriction() {
    const api = getDirectTransferCoverageApi();

    if (!api || typeof api.getSearchLocationRestriction !== "function") {
      return Promise.resolve(null);
    }

    return api.getSearchLocationRestriction(false).then(function onSearchLocationRestriction(value) {
      return clonePlacesLocationRestriction(value);
    });
  }
  
  function getNeutralSheetCoverageApi() {
    return {
      getCoverageDecision: function getCoverageDecision() {
        return {
          isWithinCoverage: true
        };
      }
    };
  }

  function getSheet() {
    return document.querySelector(SELECTORS.sheet);
  }

  function getSourceRole(sourceInput) {
    return normalizeText(sourceInput && sourceInput.getAttribute("data-direct-transfer-mobile-address-role"));
  }

  function getSheetTitle(role) {
    if (role === "destination") {
      return getI18nValue(
        "directTransferMobileFlow.addressSearch.destinationTitle",
        "Introduce el punto de destino"
      );
    }

    return getI18nValue(
      "directTransferMobileFlow.addressSearch.originTitle",
      "Introduce el punto de origen"
    );
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

    sheet.className = "direct-transfer-mobile-address-search-sheet";
    sheet.setAttribute("data-direct-transfer-mobile-address-search-sheet", "1");
    sheet.setAttribute("aria-hidden", "true");

    panel.className = "direct-transfer-mobile-address-search-sheet__panel";

    header.className = "direct-transfer-mobile-address-search-sheet__header";

    title.className = "direct-transfer-mobile-address-search-sheet__title";
    title.setAttribute("data-direct-transfer-mobile-address-search-title", "1");

    close.type = "button";
    close.className = "direct-transfer-mobile-address-search-sheet__close";
    close.setAttribute("data-direct-transfer-mobile-address-search-close", "1");

    search.className = "direct-transfer-mobile-address-search-sheet__search";

    input.type = "text";
    input.className = "direct-transfer-mobile-address-search-sheet__input";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("data-direct-transfer-mobile-address-search-input", "1");

    clear.type = "button";
    clear.className = "direct-transfer-mobile-address-search-sheet__clear";
    clear.setAttribute("data-direct-transfer-mobile-address-search-clear", "1");
    clear.hidden = true;
    clear.textContent = "×";

    mount.className = "direct-transfer-mobile-address-search-sheet__mount";
    mount.setAttribute("data-direct-transfer-mobile-address-search-mount", "1");
    mount.setAttribute("aria-hidden", "true");

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
    if (!sheet || sheet.dataset.directTransferMobileAddressSearchBound === "1") {
      return false;
    }

    sheet.dataset.directTransferMobileAddressSearchBound = "1";

    sheet.addEventListener("click", function onSheetClick(event) {
      const close = event.target.closest(SELECTORS.close);
      const clear = event.target.closest(SELECTORS.clear);
      const panel = event.target.closest(".direct-transfer-mobile-address-search-sheet__panel");

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
      syncSourceInputValue(input.value, null);
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
    const role = getSourceRole(activeSourceInput);
    const titleText = getSheetTitle(role);
    const closeText = getI18nValue("directTransferMobileFlow.addressSearch.close", "Volver");

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

  function dispatchSourceInputEvent(sourceInput, selectedPlace) {
    const role = getSourceRole(sourceInput);

    sourceInput.dispatchEvent(new Event("input", { bubbles: true }));

    if (selectedPlace) {
      sourceInput.dispatchEvent(
        new CustomEvent("pixkuy:direct-transfer-mobile-address-place", {
          bubbles: true,
          detail: {
            role,
            selectedPlace
          }
        })
      );
    }

    return true;
  }

  function syncSourceInputValue(value, selectedPlace) {
    const sourceInput = activeSourceInput;
    const normalized = typeof value === "string" ? value : "";

    if (!sourceInput) {
      return false;
    }

    if (sourceInput.value !== normalized) {
      sourceInput.value = normalized;
    }

    dispatchSourceInputEvent(sourceInput, selectedPlace || null);

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

  function destroyController() {
    controllerMountRequestId += 1;

    if (activeController && typeof activeController.destroy === "function") {
      activeController.destroy();
    }

    activeController = null;

    return true;
  }
  
  function hideAndClearMountSafely(mountNode) {
    if (!mountNode) {
      return false;
    }

    blurActiveElementInside(mountNode);

    window.requestAnimationFrame(function hideMountAfterFocusRelease() {
      blurActiveElementInside(mountNode);
      mountNode.setAttribute("aria-hidden", "true");
      mountNode.innerHTML = "";
    });

    return true;
  }

  function mountSheetAutocomplete(sheet) {
    const placesApi = getPlacesApi();
    const input = sheet ? sheet.querySelector(SELECTORS.input) : null;
    const mountNode = sheet ? sheet.querySelector(SELECTORS.mount) : null;
    const role = getSourceRole(activeSourceInput);
    const fieldName = role === "destination"
      ? "direct_transfer_destination_mobile_sheet"
      : "direct_transfer_origin_mobile_sheet";

    destroyController();

    if (!placesApi || !input || !mountNode) {
      return false;
    }

    const mountRequestId = controllerMountRequestId;

    mountNode.innerHTML = "";
    mountNode.setAttribute("aria-hidden", "false");

    getDirectTransferSearchLocationRestriction()
      .then(function onLocationRestrictionReady(locationRestriction) {
        if (mountRequestId !== controllerMountRequestId) {
          return false;
        }

        if (!isValidPlacesLocationRestriction(locationRestriction)) {
          return false;
        }

        activeController = placesApi.createAutocompleteController({
          fieldName,
          input,
          mountNode,
          hiddenFields: {},
          language: normalizeGoogleLanguage(getDocumentLanguage()),
          region: "mx",
          includedRegionCodes: ["mx"],
          locationRestriction: clonePlacesLocationRestriction(locationRestriction),
          coverageApi: getNeutralSheetCoverageApi(),
          onSelection: function onAddressSheetSelection(selectedPlace) {
            blurActiveElementInside(mountNode);

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
            syncSourceInputValue(label, selectedPlace);
            resetSourceInputScroll();
            closeSheet({ refocus: false });
          },
          onCoverageReject: function onCoverageReject() {
            hasSearchEdited = true;
            setInternalValue("");
            syncSourceInputValue("", null);
          },
          onError: function onAddressSheetError() {}
        });

        return Promise.resolve(activeController.mount()).then(function onControllerMounted() {
          if (mountRequestId !== controllerMountRequestId) {
            return false;
          }

          if (normalizeText(input.value).length >= 3) {
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }

          return true;
        });
      })
      .catch(function onLocationRestrictionError() {});

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
    document.body.setAttribute("data-direct-transfer-mobile-address-search-open", "true");

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
      syncSourceInputValue(openingValue, null);
    }

    blurActiveElementInside(sheet);

    destroyController();

    const mountNode = sheet.querySelector(SELECTORS.mount);

    hideAndClearMountSafely(mountNode);

    sheet.setAttribute("aria-hidden", "true");
    document.body.removeAttribute("data-direct-transfer-mobile-address-search-open");

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
    syncSourceInputValue("", null);

    hideAndClearMountSafely(mountNode);

    return true;
  }

  function handleSourceActivation(event) {
    const sourceInput = event.target.closest(SELECTORS.sourceInput);
    const sheet = getSheet();

    if (!sourceInput || !isDirectTransferConfigActive()) {
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