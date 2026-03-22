(function initGooglePlacesProgrammaticModule(window) {
  'use strict';

  if (!window || !window.document) {
    return;
  }

  function noop() {}

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

  function debounce(fn, wait) {
    var timeoutId = null;

    return function debounced() {
      var context = this;
      var args = arguments;

      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  function createSessionTokenManager(options) {
    var getAutocompleteSessionToken = options.getAutocompleteSessionToken;
    var sessionTokenPromise = null;

    function reset() {
      sessionTokenPromise = null;
    }

    function get() {
      if (!sessionTokenPromise) {
        sessionTokenPromise = Promise.resolve()
          .then(function () {
            return getAutocompleteSessionToken();
          })
          .catch(function (error) {
            reset();
            throw error;
          });
      }

      return sessionTokenPromise;
    }

    return {
      get: get,
      reset: reset
    };
  }

  function createProgrammaticPlacesController(options) {
    var controller;
    var debouncedFetch;

    controller = {
      options: options,
      state: {
        isMounted: false,
        isDestroyed: false,
        isOpen: false,
        isLoading: false,
        activeRequestId: 0,
        latestAppliedRequestId: 0,
        suggestions: []
      },
      session: createSessionTokenManager({
        getAutocompleteSessionToken: options.getAutocompleteSessionToken
      })
    };

    function syncState(nextState) {
      if (isFunction(options.onStateChange)) {
        options.onStateChange(nextState || {});
      }
    }

    function emitError(error) {
      if (isFunction(options.onError)) {
        options.onError(error);
      }
    }

    function emitSelection(place, meta) {
      if (isFunction(options.onPlaceSelected)) {
        options.onPlaceSelected(place, meta || {});
      }
    }

    function emitCoverageReject(payload) {
      if (isFunction(options.onCoverageReject)) {
        options.onCoverageReject(payload || {});
      }
    }

    function clearSuggestions(meta) {
      controller.state.suggestions = [];
      controller.state.isOpen = false;
      controller.state.isLoading = false;

      if (isFunction(options.renderSuggestions)) {
        options.renderSuggestions([], meta || {});
      }

      syncState({
        isOpen: false,
        isLoading: false
      });
    }

    function openSuggestions() {
      controller.state.isOpen = true;

      syncState({
        isOpen: true
      });
    }

    function closeSuggestions() {
      controller.state.isOpen = false;

      syncState({
        isOpen: false
      });
    }

    function applySuggestions(suggestions, meta) {
      controller.state.suggestions = Array.isArray(suggestions) ? suggestions : [];
      controller.state.isLoading = false;
      controller.state.isOpen = controller.state.suggestions.length > 0;

      if (isFunction(options.renderSuggestions)) {
        options.renderSuggestions(controller.state.suggestions, meta || {});
      }

      syncState({
        isOpen: controller.state.isOpen,
        isLoading: false
      });
    }

    function fetchSuggestionsNow(rawQuery) {
      var query = normalizeString(rawQuery);
      var requestId;

      if (controller.state.isDestroyed) {
        return Promise.resolve();
      }

      if (!query) {
        clearSuggestions({
          reason: 'empty-query'
        });
        return Promise.resolve();
      }

      requestId = controller.state.activeRequestId + 1;
      controller.state.activeRequestId = requestId;
      controller.state.isLoading = true;

      syncState({
        isLoading: true
      });

      return controller.session
        .get()
        .then(function (sessionToken) {
          return options.fetchSuggestions({
            query: query,
            sessionToken: sessionToken
          });
        })
        .then(function (suggestions) {
          if (controller.state.isDestroyed) {
            return;
          }

          if (requestId < controller.state.activeRequestId) {
            return;
          }

          controller.state.latestAppliedRequestId = requestId;
          applySuggestions(suggestions, {
            reason: 'fetch-success',
            query: query
          });
        })
        .catch(function (error) {
          if (controller.state.isDestroyed) {
            return;
          }

          controller.state.isLoading = false;
          clearSuggestions({
            reason: 'fetch-error'
          });
          emitError(error);
        });
    }

    debouncedFetch = debounce(fetchSuggestionsNow, options.debounceMs || 180);

    controller.mount = function mount() {
      controller.state.isMounted = true;
      controller.state.isDestroyed = false;
      return controller;
    };

    controller.destroy = function destroy() {
      controller.state.isDestroyed = true;
      controller.state.isMounted = false;
      controller.state.isOpen = false;
      controller.state.isLoading = false;
      controller.state.suggestions = [];
      controller.session.reset();

      if (isFunction(options.teardown)) {
        options.teardown();
      }
    };

    controller.open = function open() {
      openSuggestions();
    };

    controller.close = function close() {
      closeSuggestions();

      if (isFunction(options.renderSuggestions)) {
        options.renderSuggestions(controller.state.suggestions, {
          reason: 'close'
        });
      }
    };

    controller.clearVisibleValue = function clearVisibleValue() {
      if (options.input) {
        options.input.value = '';
      }

      clearSuggestions({
        reason: 'clear-visible-value'
      });
    };

    controller.handleInputValueChange = function handleInputValueChange(value) {
      debouncedFetch(value);
    };

    controller.handleSuggestionSelect = function handleSuggestionSelect(suggestion) {
      var safeSuggestion = suggestion || {};

      Promise.resolve()
        .then(function () {
          return options.resolveSuggestionToPlace({
            suggestion: safeSuggestion,
            sessionTokenManager: controller.session
          });
        })
        .then(function (resolvedPlace) {
          if (!resolvedPlace) {
            emitError(new Error('PLACE_RESOLUTION_EMPTY'));
            return;
          }

          emitSelection(resolvedPlace, {
            suggestion: safeSuggestion
          });

          controller.session.reset();
          clearSuggestions({
            reason: 'selection-success'
          });
        })
        .catch(function (error) {
          emitError(error);
        });
    };

    controller.handleCoverageReject = function handleCoverageReject(payload) {
      emitCoverageReject(payload || {});
      controller.clearVisibleValue();
    };

    return controller;
  }

  ensurePixkuyFormsNamespace().createProgrammaticPlacesController = createProgrammaticPlacesController;
})(window);