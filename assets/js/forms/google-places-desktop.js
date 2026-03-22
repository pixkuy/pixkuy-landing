(function initDesktopPlacesAdapter(window) {
  'use strict';

  if (!window || !window.document) {
    return;
  }

  function noop() {}

  function logDesktopKeyboard() {}

  function ensurePixkuyFormsNamespace() {
    window.PixkuyForms = window.PixkuyForms || {};
    return window.PixkuyForms;
  }

  function isFunction(value) {
    return typeof value === 'function';
  }

  function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function createElement(tagName, className) {
    var element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    return element;
  }

  function clearElement(node) {
    if (!node) {
      return;
    }

    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function getSuggestionMainText(suggestion) {
    var structured = suggestion && suggestion.structuredFormat;
    var mainText = structured && structured.mainText;

    if (mainText && typeof mainText === 'object' && typeof mainText.text === 'string') {
      return mainText.text;
    }

    if (typeof mainText === 'string') {
      return mainText;
    }

    if (typeof suggestion === 'object') {
      return normalizeString(suggestion.mainText) ||
        normalizeString(suggestion.text) ||
        normalizeString(suggestion.description) ||
        normalizeString(suggestion.label);
    }

    return '';
  }

  function getSuggestionSecondaryText(suggestion) {
    var structured = suggestion && suggestion.structuredFormat;
    var secondaryText = structured && structured.secondaryText;

    if (secondaryText && typeof secondaryText === 'object' && typeof secondaryText.text === 'string') {
      return secondaryText.text;
    }

    if (typeof secondaryText === 'string') {
      return secondaryText;
    }

    if (typeof suggestion === 'object') {
      return normalizeString(suggestion.secondaryText) ||
        normalizeString(suggestion.subtitle);
    }

    return '';
  }

  function getSuggestionDisplayValue(suggestion) {
    return (
      normalizeString(suggestion && suggestion.fullText) ||
      normalizeString(suggestion && suggestion.description) ||
      normalizeString(suggestion && suggestion.label) ||
      getSuggestionMainText(suggestion)
    );
  }

  function getSuggestionSelectionLabel(suggestion) {
    var mainText = getSuggestionMainText(suggestion);
    var secondaryText = getSuggestionSecondaryText(suggestion);

    if (mainText && secondaryText) {
      return mainText + ', ' + secondaryText;
    }

    return mainText || secondaryText || getSuggestionDisplayValue(suggestion);
  }

  function createDesktopPlacesAutocompleteController(config) {
    var controller;
    var programmaticFactory;
    var panelNode;
    var statusNode;
    var listNode;
    var detachDocumentClick = null;
    var detachInputListeners = null;

    config = config || {};
    programmaticFactory = window.PixkuyForms && window.PixkuyForms.createProgrammaticPlacesController;

    if (!isFunction(programmaticFactory)) {
      throw new Error('Programmatic Places controller factory is unavailable.');
    }

    panelNode = createElement('div', 'place-autocomplete__panel');
    panelNode.hidden = true;

    statusNode = createElement('div', 'place-autocomplete__status');
    statusNode.hidden = true;

    listNode = createElement('div', 'place-autocomplete__list');
    listNode.hidden = true;

    panelNode.appendChild(statusNode);
    panelNode.appendChild(listNode);

    controller = {
      input: config.input || null,
      mountNode: config.mountNode || null,
      fieldName: config.fieldName || '',
      callbacks: {
        onPlaceSelected: isFunction(config.onPlaceSelected) ? config.onPlaceSelected : noop,
        onCoverageReject: isFunction(config.onCoverageReject) ? config.onCoverageReject : noop,
        onError: isFunction(config.onError) ? config.onError : noop,
        onUiStateChange: isFunction(config.onUiStateChange) ? config.onUiStateChange : noop
      },
      state: {
        isDestroyed: false,
        isMounted: false,
        isOpen: false,
        isLoading: false,
        suggestions: [],
        activeSuggestionIndex: -1,
        keyboardOwner: false,
        pendingSelectedDisplayValue: ''
      },
      core: null
    };

    function syncUiState(partialState) {
      var shouldAllowMountPointerEvents;

      partialState = partialState || {};

      if (typeof partialState.isOpen === 'boolean') {
        controller.state.isOpen = partialState.isOpen;
      }

      if (typeof partialState.isLoading === 'boolean') {
        controller.state.isLoading = partialState.isLoading;
      }

      controller.callbacks.onUiStateChange({
        isOpen: controller.state.isOpen,
        isLoading: controller.state.isLoading,
        isReady: true,
        isFallback: false
      });

      panelNode.hidden = !controller.state.isOpen && !controller.state.isLoading && !controller.state.suggestions.length;

      shouldAllowMountPointerEvents = Boolean(
        controller.state.isOpen ||
        controller.state.isLoading ||
        (controller.state.suggestions && controller.state.suggestions.length)
      );

      if (controller.mountNode && controller.mountNode.style) {
        controller.mountNode.style.pointerEvents = shouldAllowMountPointerEvents ? 'auto' : 'none';
      }

      panelNode.style.pointerEvents = shouldAllowMountPointerEvents ? 'auto' : 'none';
    }
	
    function closePanel() {
      controller.state.isOpen = false;
      controller.state.isLoading = false;
      controller.state.suggestions = [];
      controller.state.activeSuggestionIndex = -1;
      controller.state.keyboardOwner = false;
      controller.state.pendingSelectedDisplayValue = '';

      panelNode.hidden = true;
      statusNode.hidden = true;
      listNode.hidden = true;

      clearElement(listNode);

      syncUiState({
        isOpen: false,
        isLoading: false
      });
    }
	
    function openPanel() {
      controller.state.isOpen = true;
      panelNode.hidden = false;

      syncUiState({
        isOpen: true
      });
    }

    function getSuggestionButtons() {
      if (!listNode || typeof listNode.querySelectorAll !== 'function') {
        return [];
      }

      return Array.prototype.slice.call(
        listNode.querySelectorAll('[data-place-autocomplete-item="true"]')
      );
    }

    function syncActiveSuggestionUi() {
      var buttons = getSuggestionButtons();

      buttons.forEach(function (button, index) {
        var isActive = index === controller.state.activeSuggestionIndex;

        button.setAttribute('aria-selected', isActive ? 'true' : 'false');

        if (isActive) {
          button.classList.add('is-active');

          if (typeof button.scrollIntoView === 'function') {
            button.scrollIntoView({
              block: 'nearest'
            });
          }
        } else {
          button.classList.remove('is-active');
        }
      });
    }

    function moveActiveSuggestion(delta) {
      var suggestions = controller.state.suggestions || [];
      var nextIndex;

      if (!suggestions.length) {
        return;
      }

      nextIndex = controller.state.activeSuggestionIndex + delta;

      if (nextIndex < 0) {
        nextIndex = suggestions.length - 1;
      }

      if (nextIndex >= suggestions.length) {
        nextIndex = 0;
      }

      controller.state.activeSuggestionIndex = nextIndex;
      syncActiveSuggestionUi();
    }

    function selectActiveSuggestion() {
      var suggestions = controller.state.suggestions || [];
      var activeSuggestion = suggestions[controller.state.activeSuggestionIndex];
      var selectionLabel;

      if (!activeSuggestion) {
        return;
      }

      selectionLabel = getSuggestionSelectionLabel(activeSuggestion);
      controller.state.pendingSelectedDisplayValue = selectionLabel;

      if (controller.input) {
        controller.input.value = selectionLabel;
      }

      controller.core.handleSuggestionSelect(activeSuggestion);
    }

    function renderSuggestions(suggestions, meta) {
      var items = Array.isArray(suggestions) ? suggestions : [];
      var reason = meta && meta.reason ? meta.reason : '';

      controller.state.suggestions = items;
      controller.state.activeSuggestionIndex = -1;
      clearElement(listNode);

      if (reason === 'fetch-error') {
        panelNode.hidden = false;
        statusNode.hidden = false;
        statusNode.textContent = '';
        listNode.hidden = true;
        return;
      }

      if (!items.length) {
        if (reason === 'empty-query' || reason === 'close' || reason === 'selection-success' || reason === 'clear-visible-value') {
          closePanel();
          return;
        }

        panelNode.hidden = false;
        statusNode.hidden = false;
        statusNode.textContent = '';
        listNode.hidden = true;
        return;
      }

      statusNode.hidden = true;
      listNode.hidden = false;

      items.forEach(function (suggestion) {
        var item = createElement('div', 'place-autocomplete__item');
        var button = createElement('button', 'place-autocomplete__item-button');
        var title = createElement('span', 'place-autocomplete__item-title');
        var subtitle = createElement('span', 'place-autocomplete__item-subtitle');
        var mainText = getSuggestionMainText(suggestion);
        var secondaryText = getSuggestionSecondaryText(suggestion);

        button.type = 'button';
        button.setAttribute('data-place-autocomplete-item', 'true');
        button.setAttribute('aria-label', getSuggestionDisplayValue(suggestion));
        button.setAttribute('aria-selected', 'false');

        title.textContent = mainText || getSuggestionDisplayValue(suggestion);
        button.appendChild(title);

        if (secondaryText) {
          subtitle.textContent = secondaryText;
          button.appendChild(subtitle);
        }

        button.addEventListener('mousedown', function (event) {
          event.preventDefault();
        });

        button.addEventListener('click', function () {
          var selectionLabel = getSuggestionSelectionLabel(suggestion);

          controller.state.pendingSelectedDisplayValue = selectionLabel;

          if (controller.input) {
            controller.input.value = selectionLabel;
          }

          controller.core.handleSuggestionSelect(suggestion);
        });

        item.appendChild(button);
        listNode.appendChild(item);
      });
	  
      openPanel();
      syncActiveSuggestionUi();
    }

    function bindDocumentEvents() {
      function handleDocumentClick(event) {
        var target = event.target;
        var isSuggestionItemClick = Boolean(
          target &&
          typeof target.closest === 'function' &&
          target.closest('[data-place-autocomplete-item="true"]')
        );

        if (controller.state.isDestroyed) {
          return;
        }

        if (controller.mountNode && controller.mountNode.contains(target)) {
          if (isSuggestionItemClick) {
            return;
          }

          closePanel();

          if (controller.input && typeof controller.input.focus === 'function') {
            controller.input.focus();
          }

          return;
        }

        if (controller.input && target === controller.input) {
          return;
        }

        closePanel();
      }

      document.addEventListener('click', handleDocumentClick);

      detachDocumentClick = function detach() {
        document.removeEventListener('click', handleDocumentClick);
      };
    }

    function bindInputEvents() {
      function handleInput(event) {
        if (controller.state.isDestroyed || !controller.core) {
          return;
        }

        controller.state.keyboardOwner = true;
        controller.state.activeSuggestionIndex = -1;
        syncActiveSuggestionUi({ moveFocus: false });

        logDesktopKeyboard('input', {
          fieldName: controller.fieldName,
          value: event.target && event.target.value
        });

        controller.core.handleInputValueChange(event.target.value);
      }

      function handleFocus() {
        if (controller.state.isDestroyed || !controller.core) {
          return;
        }

        controller.state.keyboardOwner = true;
        controller.state.activeSuggestionIndex = -1;
        syncActiveSuggestionUi({ moveFocus: false });

        logDesktopKeyboard('focus', {
          fieldName: controller.fieldName,
          value: controller.input && controller.input.value,
          activeTag: document.activeElement && document.activeElement.tagName,
          activeId: document.activeElement && document.activeElement.id,
          activeClass: document.activeElement && document.activeElement.className,
          inputIsActive: document.activeElement === controller.input
        });

        if (normalizeString(controller.input && controller.input.value)) {
          controller.core.handleInputValueChange(controller.input.value);
        }
      }

      function handlePointerDown(event) {
        var activeBefore = document.activeElement;

        logDesktopKeyboard('pointerdown-input-before', {
          fieldName: controller.fieldName,
          eventTargetTag: event && event.target && event.target.tagName,
          eventTargetClass: event && event.target && event.target.className,
          activeBeforeTag: activeBefore && activeBefore.tagName,
          activeBeforeId: activeBefore && activeBefore.id,
          activeBeforeClass: activeBefore && activeBefore.className,
          isOpenBefore: controller.state.isOpen,
          suggestionsLengthBefore: controller.state.suggestions ? controller.state.suggestions.length : 0,
          activeSuggestionIndexBefore: controller.state.activeSuggestionIndex,
          keyboardOwnerBefore: controller.state.keyboardOwner
        });

        controller.state.keyboardOwner = true;
        controller.state.activeSuggestionIndex = -1;
        closePanel();
        syncActiveSuggestionUi({ moveFocus: false });

        if (
          document.activeElement &&
          document.activeElement !== controller.input &&
          typeof document.activeElement.blur === 'function'
        ) {
          document.activeElement.blur();
        }

        if (controller.input && typeof controller.input.focus === 'function') {
          controller.input.focus();
        }

        logDesktopKeyboard('pointerdown-input-after', {
          fieldName: controller.fieldName,
          activeAfterTag: document.activeElement && document.activeElement.tagName,
          activeAfterId: document.activeElement && document.activeElement.id,
          activeAfterClass: document.activeElement && document.activeElement.className,
          inputIsActiveAfter: document.activeElement === controller.input,
          isOpenAfter: controller.state.isOpen,
          suggestionsLengthAfter: controller.state.suggestions ? controller.state.suggestions.length : 0,
          activeSuggestionIndexAfter: controller.state.activeSuggestionIndex,
          keyboardOwnerAfter: controller.state.keyboardOwner
        });
      }

      function shouldHandleKeyboardNavigation(event) {
        var key = event && event.key;
        var isNavigationKey = (
          key === 'ArrowDown' ||
          key === 'ArrowUp' ||
          key === 'Enter' ||
          key === 'Escape'
        );

        return Boolean(
          isNavigationKey &&
          controller.state.keyboardOwner &&
          controller.state.isOpen &&
          controller.state.suggestions &&
          controller.state.suggestions.length
        );
      }

      function handleKeydown(event) {
        if (controller.state.isDestroyed || !controller.core) {
          return;
        }

        if (!shouldHandleKeyboardNavigation(event)) {
          return;
        }

        logDesktopKeyboard('keydown-captured', {
          fieldName: controller.fieldName,
          key: event.key,
          activeSuggestionIndex: controller.state.activeSuggestionIndex,
          activeTag: document.activeElement && document.activeElement.tagName,
          activeId: document.activeElement && document.activeElement.id,
          activeClass: document.activeElement && document.activeElement.className,
          inputIsActive: document.activeElement === controller.input
        });

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveActiveSuggestion(1);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveActiveSuggestion(-1);
          return;
        }

        if (event.key === 'Enter') {
          if (controller.state.activeSuggestionIndex >= 0) {
            event.preventDefault();
            selectActiveSuggestion();
          }
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closePanel();
        }
      }

      controller.input.addEventListener('input', handleInput);
      controller.input.addEventListener('focus', handleFocus);
      controller.input.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeydown, true);

      detachInputListeners = function detach() {
        controller.input.removeEventListener('input', handleInput);
        controller.input.removeEventListener('focus', handleFocus);
        controller.input.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeydown, true);
      };
    }
	
    controller.core = programmaticFactory({
      input: controller.input,
      debounceMs: 180,
      getAutocompleteSessionToken: config.getAutocompleteSessionToken,
      fetchSuggestions: config.fetchSuggestions,
      resolveSuggestionToPlace: config.resolveSuggestionToPlace,
      onStateChange: function onStateChange(nextState) {
        syncUiState(nextState);
      },
      onPlaceSelected: function onPlaceSelected(normalizedPlace, meta) {
        var visibleLabel = controller.state.pendingSelectedDisplayValue ||
          (normalizedPlace && normalizedPlace.label) ||
          '';

        if (controller.input && visibleLabel) {
          controller.input.value = visibleLabel;
        }

        controller.callbacks.onPlaceSelected(normalizedPlace, meta || {});
        closePanel();
      },
      onCoverageReject: function onCoverageReject(payload) {
        controller.callbacks.onCoverageReject(payload || {});
      },
      onError: function onError(error) {
        controller.callbacks.onError(error);
      },
      renderSuggestions: renderSuggestions
    });

    controller.mount = function mount() {
      controller.state.isDestroyed = false;
      controller.state.isMounted = true;

      if (controller.mountNode) {
        clearElement(controller.mountNode);

        controller.mountNode.style.top = '100%';
        controller.mountNode.style.left = '0';
        controller.mountNode.style.right = '0';
        controller.mountNode.style.bottom = 'auto';
        controller.mountNode.style.inset = 'auto 0 auto 0';
        controller.mountNode.style.zIndex = '12';

        controller.mountNode.appendChild(panelNode);
      }

      bindInputEvents();
      bindDocumentEvents();

      controller.core.mount();
      return Promise.resolve(controller);
    };

    controller.destroy = function destroy() {
      controller.state.isDestroyed = true;
      controller.state.isMounted = false;
      controller.state.isOpen = false;
      controller.state.isLoading = false;
      controller.state.suggestions = [];

      if (detachInputListeners) {
        detachInputListeners();
        detachInputListeners = null;
      }

      if (detachDocumentClick) {
        detachDocumentClick();
        detachDocumentClick = null;
      }

      if (controller.core && isFunction(controller.core.destroy)) {
        controller.core.destroy();
      }

      if (controller.mountNode) {
        clearElement(controller.mountNode);
      }
    };

    controller.close = function close() {
      if (controller.core && isFunction(controller.core.close)) {
        controller.core.close();
      }

      closePanel();
    };

    controller.clearVisibleValue = function clearVisibleValue() {
      if (controller.core && isFunction(controller.core.clearVisibleValue)) {
        controller.core.clearVisibleValue();
      } else if (controller.input) {
        controller.input.value = '';
      }

      closePanel();
    };

    return controller;
  }

  ensurePixkuyFormsNamespace().createDesktopPlacesAutocompleteController = createDesktopPlacesAutocompleteController;
}(window));