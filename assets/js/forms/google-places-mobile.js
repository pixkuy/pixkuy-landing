(function () {
  'use strict';

  var DEFAULT_DEBOUNCE_MS = 180;
  var MIN_QUERY_LENGTH = 2;
  var MOBILE_PANEL_CLASS = 'place-autocomplete__panel';
  var MOBILE_PANEL_VISIBLE_CLASS = 'is-visible';
  var MOBILE_ITEM_CLASS = 'place-autocomplete__item';
  var MOBILE_ITEM_BUTTON_CLASS = 'place-autocomplete__item-button';
  var MOBILE_ITEM_TITLE_CLASS = 'place-autocomplete__item-title';
  var MOBILE_ITEM_SUBTITLE_CLASS = 'place-autocomplete__item-subtitle';
  var MOBILE_ITEM_META_CLASS = 'place-autocomplete__item-meta';
  var MOBILE_STATUS_CLASS = 'place-autocomplete__status';
  var MOBILE_STATUS_ERROR_CLASS = 'is-error';
  var MOBILE_STATUS_EMPTY_CLASS = 'is-empty';
  var MOBILE_STATUS_LOADING_CLASS = 'is-loading';

  function noop() {}

    function pushPersistentDebug() {}

  function ensurePixkuyFormsNamespace() {
    window.PixkuyForms = window.PixkuyForms || {};
    return window.PixkuyForms;
  }

  function normalizeString(value) {
    return String(value || '').trim();
  }

  function buildVisibleErrorMessage(error, fallbackMessage) {
    var message;

    message = normalizeString(error && error.message);

    if (!message) {
      message = normalizeString(fallbackMessage);
    }

    if (!message) {
      message = 'Unknown mobile autocomplete error.';
    }

    pushPersistentDebug('visible-error', message);

    return '[DEBUG Places móvil] ' + message;
  }

  function createNode(tagName, className) {
    var node = document.createElement(tagName);

    if (className) {
      node.className = className;
    }

    return node;
  }

  function clearNode(node) {
    if (!node) {
      return;
    }

    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function isAbortError(error) {
    return Boolean(error && (error.name === 'AbortError' || error.code === 20));
  }

  function getPanelMountNode(controller) {
    if (!controller || !controller.mountNode || typeof controller.mountNode.querySelector !== 'function') {
      return null;
    }

    return controller.mountNode.querySelector('[data-mobile-place-panel]');
  }

  function getClearButtonNode(controller) {
    var root;
    var fieldName;

    root = controller && controller.root ? controller.root : null;
    fieldName = normalizeString(controller && controller.fieldName);

    if (!root || !fieldName || typeof root.querySelector !== 'function') {
      return null;
    }

    return root.querySelector('[data-place-clear="' + fieldName + '"]');
  }

  function syncClearButtonVisibility(controller) {
    var clearButton;
    var hasValue;

    clearButton = getClearButtonNode(controller);

    if (!clearButton) {
      return;
    }

    hasValue = Boolean(getInputValue(controller));

    clearButton.hidden = !hasValue;
    clearButton.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
  }

  function ensurePanelNode(controller) {
    var panelNode;
    var mountNode;

    mountNode = controller && controller.mountNode ? controller.mountNode : null;
    if (!mountNode) {
      return null;
    }

    panelNode = getPanelMountNode(controller);

    if (!panelNode) {
      panelNode = createNode('div', MOBILE_PANEL_CLASS);
      panelNode.setAttribute('data-mobile-place-panel', 'true');
      mountNode.appendChild(panelNode);
    }

    return panelNode;
  }

  function hidePanel(controller) {
    var panelNode = getPanelMountNode(controller);

    if (!panelNode) {
      return;
    }

    panelNode.classList.remove(MOBILE_PANEL_VISIBLE_CLASS);
    clearNode(panelNode);
  }

  function showPanel(controller) {
    var panelNode = ensurePanelNode(controller);

    if (!panelNode) {
      return;
    }

    panelNode.classList.add(MOBILE_PANEL_VISIBLE_CLASS);
  }

  function renderStatus(controller, text, stateClass) {
    var panelNode = ensurePanelNode(controller);
    var statusNode;

    if (!panelNode) {
      return;
    }

    clearNode(panelNode);

    statusNode = createNode('div', MOBILE_STATUS_CLASS);
    if (stateClass) {
      statusNode.classList.add(stateClass);
    }

    statusNode.textContent = text || '';
    panelNode.appendChild(statusNode);
    showPanel(controller);
  }

  function buildSecondaryText(parts) {
    return parts.filter(Boolean).join(' · ');
  }

  function normalizeSuggestion(rawSuggestion, index) {
    var structured = rawSuggestion && (rawSuggestion.structuredFormat || rawSuggestion.structuredFormatting) || {};
    var title = normalizeString(
      structured && structured.mainText && structured.mainText.text
        ? structured.mainText.text
        : (
          structured.primaryText ||
          rawSuggestion && rawSuggestion.text && rawSuggestion.text.text ||
          rawSuggestion && rawSuggestion.displayName
        )
    );
    var subtitle = normalizeString(
      structured && structured.secondaryText && structured.secondaryText.text
        ? structured.secondaryText.text
        : (
          rawSuggestion && rawSuggestion.secondaryText ||
          rawSuggestion && rawSuggestion.formattedAddress
        )
    );
    var placeId = normalizeString(
      rawSuggestion && (
        rawSuggestion.placeId ||
        rawSuggestion.placePrediction && rawSuggestion.placePrediction.placeId ||
        rawSuggestion.id
      )
    );

    return {
      key: placeId || 'suggestion-' + String(index || 0),
      index: Number(index || 0),
      title: title,
      subtitle: subtitle,
      text: buildSecondaryText([title, subtitle]) || title || subtitle || '',
      raw: rawSuggestion
    };
  }

  function renderSuggestions(controller, suggestions) {
    var panelNode = ensurePanelNode(controller);
    var fragment;
    var i;

    if (!panelNode) {
      return;
    }

    clearNode(panelNode);

    if (!Array.isArray(suggestions) || !suggestions.length) {
      renderStatus(
        controller,
        controller.copy.noResults,
        MOBILE_STATUS_EMPTY_CLASS
      );
      return;
    }

    fragment = document.createDocumentFragment();

    for (i = 0; i < suggestions.length; i += 1) {
      fragment.appendChild(createSuggestionNode(controller, suggestions[i]));
    }

    panelNode.appendChild(fragment);
    showPanel(controller);
  }

  function createSuggestionNode(controller, suggestion) {
    var itemNode = createNode('div', MOBILE_ITEM_CLASS);
    var buttonNode = createNode('button', MOBILE_ITEM_BUTTON_CLASS);
    var titleNode = createNode('span', MOBILE_ITEM_TITLE_CLASS);
    var subtitleNode = createNode('span', MOBILE_ITEM_SUBTITLE_CLASS);
    var metaNode = createNode('span', MOBILE_ITEM_META_CLASS);

    buttonNode.type = 'button';
    buttonNode.setAttribute('data-place-suggestion-key', suggestion.key);
    buttonNode.setAttribute('data-place-suggestion-index', String(suggestion.index));
    buttonNode.setAttribute('aria-label', suggestion.text || suggestion.title || '');

    titleNode.textContent = suggestion.title || suggestion.text || '';
    subtitleNode.textContent = suggestion.subtitle || '';
    metaNode.textContent = suggestion.text || '';

    buttonNode.appendChild(titleNode);

    if (suggestion.subtitle) {
      buttonNode.appendChild(subtitleNode);
    }

    if (!suggestion.subtitle && suggestion.text && suggestion.text !== suggestion.title) {
      buttonNode.appendChild(metaNode);
    }

    itemNode.appendChild(buttonNode);
    return itemNode;
  }

  function resetAbortController(controller) {
    if (controller.state.abortController) {
      try {
        controller.state.abortController.abort();
      } catch (error) {
        noop(error);
      }
    }

    controller.state.abortController = null;
  }

  function clearPendingTimer(controller) {
    if (controller.state.debounceTimer) {
      window.clearTimeout(controller.state.debounceTimer);
      controller.state.debounceTimer = 0;
    }
  }

  function createSessionToken(controller) {
    if (!controller.deps.createSessionToken) {
      return null;
    }

    try {
      return controller.deps.createSessionToken();
    } catch (error) {
      controller.callbacks.onError(error);
      return null;
    }
  }

  function ensureSessionToken(controller) {
    if (controller.state.sessionTokenPromise) {
      return controller.state.sessionTokenPromise;
    }

    if (controller.state.sessionToken) {
      return Promise.resolve(controller.state.sessionToken);
    }

    controller.state.sessionTokenPromise = Promise.resolve(createSessionToken(controller))
      .then(function (sessionToken) {
        controller.state.sessionToken = sessionToken || null;
        controller.state.sessionTokenPromise = null;
        return controller.state.sessionToken;
      })
      .catch(function (error) {
        controller.state.sessionToken = null;
        controller.state.sessionTokenPromise = null;
        throw error;
      });

    return controller.state.sessionTokenPromise;
  }

  function resetSessionToken(controller) {
    controller.state.sessionToken = null;
    controller.state.sessionTokenPromise = null;
  }

  function setLoadingState(controller, isLoading) {
    controller.state.isLoading = Boolean(isLoading);

    if (controller.callbacks.onUiStateChange) {
      controller.callbacks.onUiStateChange({
        isLoading: controller.state.isLoading,
        isOpen: controller.state.isOpen,
        isFallback: false,
        isReady: true
      });
    }
  }

  function closeSuggestions(controller) {
    pushPersistentDebug('close-suggestions', {
      fieldName: controller.fieldName,
      lastQuery: controller.state.lastQuery,
      suggestionCount: controller.state.suggestions.length
    });

    controller.state.isOpen = false;
    controller.state.suggestions = [];
    hidePanel(controller);

    if (controller.callbacks.onUiStateChange) {
      controller.callbacks.onUiStateChange({
        isLoading: controller.state.isLoading,
        isOpen: false,
        isFallback: false,
        isReady: true
      });
    }
  }

  function openSuggestions(controller) {
    controller.state.isOpen = true;

    if (controller.callbacks.onUiStateChange) {
      controller.callbacks.onUiStateChange({
        isLoading: controller.state.isLoading,
        isOpen: true,
        isFallback: false,
        isReady: true
      });
    }
  }

  function setManualValue(controller, value) {
    if (!controller.input) {
      return;
    }

    controller.input.value = value || '';
    syncClearButtonVisibility(controller);

    if (controller.callbacks.onManualInput) {
      controller.callbacks.onManualInput(controller.input.value);
    }
  }

  function handleDocumentPointerDown(controller, event) {
    var target = event && event.target;
    var fieldRoot = controller.root;

    if (!target || !fieldRoot) {
      return;
    }

    if (fieldRoot.contains(target)) {
      return;
    }

    closeSuggestions(controller);
  }

  function bindDocumentEvents(controller) {
    controller.bound.handleDocumentPointerDown = function (event) {
      handleDocumentPointerDown(controller, event);
    };

    document.addEventListener('pointerdown', controller.bound.handleDocumentPointerDown, true);
  }

  function unbindDocumentEvents(controller) {
    if (controller.bound.handleDocumentPointerDown) {
      document.removeEventListener('pointerdown', controller.bound.handleDocumentPointerDown, true);
      controller.bound.handleDocumentPointerDown = null;
    }
  }

  function getInputValue(controller) {
    if (!controller.input) {
      return '';
    }

    return normalizeString(controller.input.value);
  }

  function scheduleSuggestionsFetch(controller) {
    var query = getInputValue(controller);

    pushPersistentDebug('schedule-fetch', {
      fieldName: controller.fieldName,
      query: query,
      queryLength: query.length
    });

    clearPendingTimer(controller);
    resetAbortController(controller);

    if (!query || query.length < controller.options.minQueryLength) {
      controller.state.lastQuery = query;
      closeSuggestions(controller);
      controller.callbacks.onClearSelection();
      return;
    }

    controller.state.lastQuery = query;

    controller.state.debounceTimer = window.setTimeout(function () {
      fetchSuggestions(controller, query);
    }, controller.options.debounceMs);
  }

  function fetchSuggestions(controller, query) {
    var abortController;

    if (!controller.deps.fetchSuggestions) {
      pushPersistentDebug('fetch-missing-dependency', {
        fieldName: controller.fieldName
      });
      controller.callbacks.onError(new Error('Missing fetchSuggestions dependency.'));
      return;
    }

    abortController = typeof AbortController === 'function' ? new AbortController() : null;
    controller.state.abortController = abortController;

    pushPersistentDebug('fetch-start', {
      fieldName: controller.fieldName,
      query: query,
      hasAbortController: Boolean(abortController)
    });

    setLoadingState(controller, true);
    renderStatus(controller, controller.copy.loading, MOBILE_STATUS_LOADING_CLASS);
    openSuggestions(controller);

    Promise.resolve(ensureSessionToken(controller))
      .then(function (sessionToken) {
        var requestContext = {
          input: query,
          sessionToken: sessionToken,
          signal: abortController ? abortController.signal : null,
          inputElement: controller.input,
          fieldName: controller.fieldName
        };

        pushPersistentDebug('fetch-request', {
          fieldName: controller.fieldName,
          query: query,
          hasSessionToken: Boolean(sessionToken)
        });

        return controller.deps.fetchSuggestions(requestContext);
      })
      .then(function (result) {
        var rawSuggestions;
        var suggestions;
        var i;

        if (query !== controller.state.lastQuery) {
          return;
        }

        rawSuggestions = Array.isArray(result) ? result : [];
        suggestions = [];

        pushPersistentDebug('fetch-result', {
          fieldName: controller.fieldName,
          rawCount: rawSuggestions.length
        });

        for (i = 0; i < rawSuggestions.length; i += 1) {
          suggestions.push(normalizeSuggestion(rawSuggestions[i], i));
        }

        controller.state.suggestions = suggestions;
        setLoadingState(controller, false);

        pushPersistentDebug('render-suggestions', {
          fieldName: controller.fieldName,
          normalizedCount: suggestions.length
        });

        renderSuggestions(controller, suggestions);
      })
      .catch(function (error) {
        if (isAbortError(error)) {
          pushPersistentDebug('fetch-abort', {
            fieldName: controller.fieldName,
            query: query
          });
          return;
        }

        pushPersistentDebug('fetch-error', {
          fieldName: controller.fieldName,
          message: error && error.message ? error.message : 'unknown'
        });

        setLoadingState(controller, false);
        controller.callbacks.onError(error);
        renderStatus(
          controller,
          buildVisibleErrorMessage(error, controller.copy.loadError),
          MOBILE_STATUS_ERROR_CLASS
        );
      });
  }

  function getSuggestionByButton(controller, buttonNode) {
    var indexValue;
    var index;

    if (!buttonNode) {
      return null;
    }

    indexValue = buttonNode.getAttribute('data-place-suggestion-index');
    index = Number(indexValue);

    if (!Number.isFinite(index)) {
      return null;
    }

    return controller.state.suggestions[index] || null;
  }

  function resolveSelectedPlace(controller, suggestion) {
    if (!controller.deps.resolveSuggestionToPlace) {
      return Promise.reject(new Error('Missing resolveSuggestionToPlace dependency.'));
    }

    return Promise.resolve(
      controller.deps.resolveSuggestionToPlace({
        suggestion: suggestion.raw,
        sessionToken: controller.state.sessionToken,
        fieldName: controller.fieldName,
        inputElement: controller.input
      })
    );
  }

  function applySelectedPlace(controller, normalizedPlace, displayLabel) {
    var finalLabel = normalizeString(displayLabel || normalizedPlace && normalizedPlace.label);

    setManualValue(controller, finalLabel);
    closeSuggestions(controller);
    resetSessionToken(controller);

    if (controller.callbacks.onPlaceSelected) {
      controller.callbacks.onPlaceSelected(normalizedPlace, {
        label: finalLabel,
        fieldName: controller.fieldName
      });
    }
  }

  function handleSuggestionSelection(controller, buttonNode) {
    var suggestion = getSuggestionByButton(controller, buttonNode);

    if (!suggestion) {
      pushPersistentDebug('tap-miss', {
        fieldName: controller.fieldName
      });
      return;
    }

    pushPersistentDebug('tap-suggestion', {
      fieldName: controller.fieldName,
      key: suggestion.key,
      title: suggestion.title,
      subtitle: suggestion.subtitle
    });

    setLoadingState(controller, true);

    resolveSelectedPlace(controller, suggestion)
      .then(function (normalizedPlace) {
        pushPersistentDebug('resolve-success', {
          fieldName: controller.fieldName,
          label: normalizedPlace && normalizedPlace.label ? normalizedPlace.label : ''
        });

        setLoadingState(controller, false);
        applySelectedPlace(controller, normalizedPlace, suggestion.text || suggestion.title);
      })
      .catch(function (error) {
        pushPersistentDebug('resolve-error', {
          fieldName: controller.fieldName,
          message: error && error.message ? error.message : 'unknown'
        });

        setLoadingState(controller, false);
        controller.callbacks.onError(error);
        renderStatus(
          controller,
          buildVisibleErrorMessage(error, controller.copy.loadError),
          MOBILE_STATUS_ERROR_CLASS
        );
      });
  }

  function bindInputEvents(controller) {
    controller.bound.handleInput = function () {
      pushPersistentDebug('input', {
        fieldName: controller.fieldName,
        value: getInputValue(controller)
      });

      syncClearButtonVisibility(controller);
      controller.callbacks.onClearSelection();
      scheduleSuggestionsFetch(controller);
    };

    controller.bound.handleFocus = function () {
      pushPersistentDebug('focus', {
        fieldName: controller.fieldName,
        value: getInputValue(controller)
      });

      if (getInputValue(controller).length >= controller.options.minQueryLength) {
        scheduleSuggestionsFetch(controller);
      }
    };

    controller.bound.handleBlur = function () {
      pushPersistentDebug('blur', {
        fieldName: controller.fieldName,
        activeElement: document.activeElement && document.activeElement.tagName ? document.activeElement.tagName : ''
      });

      window.setTimeout(function () {
        if (!controller.root || !document.activeElement || !controller.root.contains(document.activeElement)) {
          closeSuggestions(controller);
        }
      }, 120);
    };

    controller.bound.handlePanelClick = function (event) {
      var buttonNode = event.target && event.target.closest('[data-place-suggestion-index]');

      if (!buttonNode) {
        return;
      }

      event.preventDefault();
      handleSuggestionSelection(controller, buttonNode);
    };

    controller.bound.handleClearClick = function (event) {
      event.preventDefault();

      clearPendingTimer(controller);
      resetAbortController(controller);
      resetSessionToken(controller);
      closeSuggestions(controller);
      setManualValue(controller, '');
      controller.callbacks.onClearSelection();

      if (controller.input && typeof controller.input.focus === 'function') {
        controller.input.focus();
      }
    };

    controller.input.addEventListener('input', controller.bound.handleInput);
    controller.input.addEventListener('focus', controller.bound.handleFocus);
    controller.input.addEventListener('blur', controller.bound.handleBlur);

    if (controller.mountNode) {
      controller.mountNode.addEventListener('click', controller.bound.handlePanelClick);
    }

    controller.clearButton = getClearButtonNode(controller);

    if (controller.clearButton) {
      controller.clearButton.addEventListener('click', controller.bound.handleClearClick);
      syncClearButtonVisibility(controller);
    }
  }

  function unbindInputEvents(controller) {
    if (controller.input && controller.bound.handleInput) {
      controller.input.removeEventListener('input', controller.bound.handleInput);
      controller.input.removeEventListener('focus', controller.bound.handleFocus);
      controller.input.removeEventListener('blur', controller.bound.handleBlur);
    }

    if (controller.mountNode && controller.bound.handlePanelClick) {
      controller.mountNode.removeEventListener('click', controller.bound.handlePanelClick);
    }

    if (controller.clearButton && controller.bound.handleClearClick) {
      controller.clearButton.removeEventListener('click', controller.bound.handleClearClick);
    }

    controller.clearButton = null;
    controller.bound.handleInput = null;
    controller.bound.handleFocus = null;
    controller.bound.handleBlur = null;
    controller.bound.handlePanelClick = null;
    controller.bound.handleClearClick = null;
  }

  function createMobileAutocompleteController(config) {
    var controller;

    config = config || {};

    pushPersistentDebug('controller-create', {
      fieldName: config.fieldName || '',
      hasRoot: Boolean(config.root),
      hasInput: Boolean(config.input),
      hasMountNode: Boolean(config.mountNode),
      hasFetchSuggestions: Boolean(config.fetchSuggestions),
      hasResolveSuggestionToPlace: Boolean(config.resolveSuggestionToPlace),
      hasCreateSessionToken: Boolean(config.createSessionToken)
    });

    controller = {
      root: config.root || null,
      input: config.input || null,
      mountNode: config.mountNode || null,
      fieldName: config.fieldName || '',
      deps: {
        fetchSuggestions: config.fetchSuggestions || null,
        resolveSuggestionToPlace: config.resolveSuggestionToPlace || null,
        createSessionToken: config.createSessionToken || null
      },
      callbacks: {
        onPlaceSelected: config.onPlaceSelected || noop,
        onClearSelection: config.onClearSelection || noop,
        onManualInput: config.onManualInput || noop,
        onError: config.onError || noop,
        onUiStateChange: config.onUiStateChange || noop
      },
      options: {
        debounceMs: Number(config.debounceMs || DEFAULT_DEBOUNCE_MS),
        minQueryLength: Number(config.minQueryLength || MIN_QUERY_LENGTH)
      },
      copy: {
        loading: normalizeString(config.copy && config.copy.loading) || 'Loading suggestions…',
        noResults: normalizeString(config.copy && config.copy.noResults) || 'No results found.',
        loadError: normalizeString(config.copy && config.copy.loadError) || 'Autocomplete is temporarily unavailable.'
      },
      state: {
        isLoading: false,
        isOpen: false,
        suggestions: [],
        lastQuery: '',
        sessionToken: null,
        sessionTokenPromise: null,
        abortController: null,
        debounceTimer: 0
      },
      bound: {}
    };

    controller.mount = function mount() {
      pushPersistentDebug('mount-start', {
        fieldName: controller.fieldName,
        hasRoot: Boolean(controller.root),
        hasInput: Boolean(controller.input),
        hasMountNode: Boolean(controller.mountNode)
      });

      if (!controller.root || !controller.input || !controller.mountNode) {
        pushPersistentDebug('mount-error', 'Missing mobile autocomplete controller dependencies.');
        throw new Error('Missing mobile autocomplete controller dependencies.');
      }

      controller.mountNode.innerHTML = '';
      ensurePanelNode(controller);
      bindInputEvents(controller);
      bindDocumentEvents(controller);
      syncClearButtonVisibility(controller);

      pushPersistentDebug('mount-ok', {
        fieldName: controller.fieldName,
        inputValue: controller.input && controller.input.value ? controller.input.value : ''
      });

      controller.callbacks.onUiStateChange({
        isLoading: false,
        isOpen: false,
        isFallback: false,
        isReady: true
      });

      return controller;
    };

    controller.destroy = function destroy() {
      clearPendingTimer(controller);
      resetAbortController(controller);
      unbindInputEvents(controller);
      unbindDocumentEvents(controller);
      closeSuggestions(controller);
      resetSessionToken(controller);

      if (controller.mountNode) {
        controller.mountNode.innerHTML = '';
      }
    };

    controller.close = function close() {
      closeSuggestions(controller);
    };

    return controller;
  }

    ensurePixkuyFormsNamespace().createMobilePlacesAutocompleteController = createMobileAutocompleteController;
}());