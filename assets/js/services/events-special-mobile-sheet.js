(function () {
  'use strict';

  const panelRoot = document.querySelector('[data-services-events-panel]');
  const catalogMount = document.querySelector('[data-services-events-catalog]');
  const configMount = document.querySelector('[data-services-events-config]');

  if (!panelRoot || !catalogMount || !configMount) return;

  const MOBILE_QUERY = window.matchMedia('(max-width: 720px)');

  let backdropEl = null;
  let sheetEl = null;
  let headMetaEl = null;
  let bodyEl = null;
  let priceLabelEl = null;
  let priceValueEl = null;
  let configMountPlaceholder = null;

  let isSheetOpen = false;
  let pointerSession = null;
  let isNativeTimePickerActive = false;

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function ensureSheet() {
    if (backdropEl && sheetEl) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'services-events-panel__sheet-backdrop';
    backdropEl.hidden = true;

    sheetEl = document.createElement('div');
    sheetEl.className = 'services-events-panel__sheet';
    sheetEl.hidden = true;
    sheetEl.setAttribute('aria-hidden', 'true');
    sheetEl.style.pointerEvents = 'none';

    sheetEl.innerHTML = `
      <div class="services-events-panel__sheet-handle-wrap" data-services-events-sheet-drag>
        <div class="services-events-panel__sheet-handle" aria-hidden="true"></div>
      </div>

      <div class="services-events-panel__sheet-head">
        <div>
          <h4 class="services-events-panel__sheet-title" data-services-events-sheet-title></h4>
          <p class="services-events-panel__sheet-meta" data-services-events-sheet-meta></p>
        </div>

        <button
          type="button"
          class="services-events-panel__sheet-close"
          data-services-events-sheet-close
          aria-label="Cerrar"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <div class="services-events-panel__sheet-body" data-services-events-sheet-body></div>

      <div class="services-events-panel__sheet-footer">
        <div class="services-events-panel__sheet-price">
          <p class="services-events-panel__sheet-price-label" data-services-events-sheet-price-label></p>
          <strong class="services-events-panel__sheet-price-value" data-services-events-sheet-price-value></strong>
        </div>
      </div>
    `;

    document.body.appendChild(backdropEl);
    document.body.appendChild(sheetEl);

    headMetaEl = sheetEl.querySelector('[data-services-events-sheet-meta]');
    bodyEl = sheetEl.querySelector('[data-services-events-sheet-body]');
    priceLabelEl = sheetEl.querySelector('[data-services-events-sheet-price-label]');
    priceValueEl = sheetEl.querySelector('[data-services-events-sheet-price-value]');

    syncSheetI18n();
    bindSheetEvents();
  }

  function getSelectedEventTitle() {
    const titleEl = configMount.querySelector('.services-events-panel__selected-title');
    return titleEl ? titleEl.textContent.trim() : '';
  }

  function getSelectedVenueName() {
    const titleEls = configMount.querySelectorAll('.services-events-panel__selected-title');
    const venueEl = titleEls.length > 1 ? titleEls[1] : null;
    return venueEl ? venueEl.textContent.trim() : '';
  }

  function getInlineQuoteLabel() {
    const labelEl = configMount.querySelector('.services-events-panel__quote-label');
    return labelEl ? labelEl.textContent.trim() : '';
  }

  function getInlineQuoteValue() {
    const valueEl = configMount.querySelector('.services-events-panel__quote-value');
    return valueEl ? valueEl.textContent.trim() : '';
  }

  function isConfigMountedInsideSheet() {
    return Boolean(bodyEl && configMount && configMount.parentNode === bodyEl);
  }

  function isTimeFieldTarget(target) {
    return !!(
      target &&
      typeof target.matches === 'function' &&
      target.matches('[data-services-events-time]')
    );
  }

  function setNativeTimePickerActive(nextValue) {
    isNativeTimePickerActive = nextValue === true;
  }
  
  function isSheetUsingLiveConfigMount(target, selector) {
    const inlineNodes = Array.from(configMount.querySelectorAll(selector));

    if (!inlineNodes.length || !target) {
      return false;
    }

    return inlineNodes.indexOf(target) !== -1;
  }

  function syncInlineConfigVisibility() {
    if (!MOBILE_QUERY.matches) {
      configMount.hidden = false;
      return;
    }

    configMount.hidden = !isSheetOpen;
  }

  function mountConfigIntoSheet() {
    if (!bodyEl || !configMount) return;

    bodyEl.innerHTML = '';

    if (!configMountPlaceholder) {
      configMountPlaceholder = document.createComment('services-events-config-placeholder');
    }

    if (!configMountPlaceholder.parentNode && configMount.parentNode) {
      configMount.parentNode.insertBefore(configMountPlaceholder, configMount);
    }

    configMount.hidden = false;
    configMount.removeAttribute('hidden');
    configMount.removeAttribute('data-services-events-config');

    bodyEl.appendChild(configMount);
    configMount.style.display = 'grid';
    configMount.style.width = '100%';
  }

  function restoreConfigFromSheet() {
    if (!configMount || !configMountPlaceholder || !configMountPlaceholder.parentNode) return;

    configMountPlaceholder.parentNode.insertBefore(configMount, configMountPlaceholder);
    configMount.setAttribute('data-services-events-config', '');
    configMount.style.display = '';
  }

  function syncSheetI18n() {
    if (!sheetEl) return;

    const closeButton = sheetEl.querySelector('[data-services-events-sheet-close]');

    if (priceLabelEl) {
      priceLabelEl.textContent =
        getI18nValue('services.cards.events.panel.finalPriceLabel') || 'Precio final';
    }

    if (closeButton) {
      closeButton.setAttribute(
        'aria-label',
        getI18nValue('legalOverlay.close') || 'Cerrar'
      );
    }
  }

  function syncSheetHeader() {
    if (!sheetEl) return;

    const titleEl = sheetEl.querySelector('[data-services-events-sheet-title]');

    if (titleEl) {
      titleEl.textContent = getSelectedEventTitle();
    }

    if (headMetaEl) {
      headMetaEl.textContent = getSelectedVenueName();
    }
  }

  function syncSheetFooter() {
    const quoteValue = getInlineQuoteValue();
    const quoteLabel = getInlineQuoteLabel();

    if (priceLabelEl) {
      priceLabelEl.textContent =
        getI18nValue('services.cards.events.panel.finalPriceLabel') || 'Precio final';
    }

    if (priceValueEl) {
      priceValueEl.textContent = quoteValue || quoteLabel;
    }
  }

  function syncSheetFromPanel(options) {
    const safeOptions = options && typeof options === 'object' ? options : {};
    const resetScroll = safeOptions.resetScroll === true;

    syncInlineConfigVisibility();

    if (!MOBILE_QUERY.matches || !isSheetOpen || !sheetEl) return;
    if (isNativeTimePickerActive) return;

    const previousScrollTop = bodyEl ? bodyEl.scrollTop : 0;

    mountConfigIntoSheet();
    syncSheetHeader();
    syncSheetFooter();

    if (!bodyEl) return;

    bodyEl.scrollTop = resetScroll ? 0 : previousScrollTop;
  }

  function forceSheetOwnsConfigMount() {
    if (!MOBILE_QUERY.matches || !isSheetOpen || !sheetEl || !bodyEl || !configMount) {
      return false;
    }

    if (isNativeTimePickerActive) {
      return false;
    }

    bodyEl.innerHTML = '';
    mountConfigIntoSheet();
    syncInlineConfigVisibility();
    syncSheetHeader();
    syncSheetFooter();

    if (bodyEl) {
      bodyEl.scrollTop = 0;
    }

    return true;
  }

  function openSheet() {
    if (!MOBILE_QUERY.matches) return;

    ensureSheet();

    isSheetOpen = true;
    panelRoot.classList.add('services-events-panel--sheet-open');

    backdropEl.hidden = false;
    sheetEl.hidden = false;

    backdropEl.style.display = 'block';
    sheetEl.style.display = 'grid';
    sheetEl.style.visibility = 'visible';
    sheetEl.style.pointerEvents = 'auto';
    sheetEl.style.transform = 'translateY(100%)';

    if (bodyEl) {
      bodyEl.scrollTop = 0;
    }

    syncSheetFromPanel({ resetScroll: true });

    requestAnimationFrame(() => {
      sheetEl.classList.add('is-open');
      sheetEl.setAttribute('aria-hidden', 'false');
      sheetEl.style.transform = 'translateY(0)';

      requestAnimationFrame(() => {
        syncSheetFromPanel({ resetScroll: true });
      });

      window.setTimeout(() => {
        if (isSheetOpen && sheetEl) {
          sheetEl.style.transform = 'none';
          sheetEl.style.willChange = 'auto';
        }
      }, 220);
    });
  }

  function closeSheet() {
    if (!sheetEl || !isSheetOpen) return;

    isSheetOpen = false;
    pointerSession = null;
    setNativeTimePickerActive(false);

    panelRoot.classList.remove('services-events-panel--sheet-open');
    sheetEl.classList.remove('is-open');
    sheetEl.setAttribute('aria-hidden', 'true');
    sheetEl.style.willChange = 'transform';
    sheetEl.style.transform = 'translateY(100%)';
    sheetEl.style.pointerEvents = 'none';

    restoreConfigFromSheet();
    syncInlineConfigVisibility();

    window.setTimeout(() => {
      if (!isSheetOpen) {
        backdropEl.hidden = true;
        sheetEl.hidden = true;
        backdropEl.style.display = '';
        sheetEl.style.display = '';
        sheetEl.style.visibility = '';
        sheetEl.style.pointerEvents = '';
      }
    }, 180);
  }

  function bindSheetEvents() {
    if (!sheetEl || !backdropEl) return;

    backdropEl.addEventListener('click', closeSheet);

    sheetEl.addEventListener('click', (event) => {
      const closeButton = event.target.closest('[data-services-events-sheet-close]');
      if (closeButton) {
        closeSheet();
      }
    });

    sheetEl.addEventListener('change', (event) => {
      const target = event.target;

      if (!isTimeFieldTarget(target)) return;

      if (isSheetUsingLiveConfigMount(target, '[data-services-events-time]')) {
        setNativeTimePickerActive(false);
        syncSheetHeader();
        syncSheetFooter();
        return;
      }

      setNativeTimePickerActive(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          syncSheetFromPanel({ resetScroll: false });
        });
      });
    });

    sheetEl.addEventListener('pointerdown', (event) => {
      if (isTimeFieldTarget(event.target)) {
        setNativeTimePickerActive(true);
      }
    });

    sheetEl.addEventListener('focusin', (event) => {
      if (isTimeFieldTarget(event.target)) {
        setNativeTimePickerActive(true);
      }
    });

    const dragArea = sheetEl.querySelector('[data-services-events-sheet-drag]');
    if (dragArea) {
      dragArea.addEventListener('pointerdown', onPointerDown);
    }
  }

  function onPointerDown(event) {
    if (!MOBILE_QUERY.matches || !sheetEl || !isSheetOpen) return;

    pointerSession = {
      pointerId: event.pointerId,
      startY: event.clientY,
      currentY: event.clientY,
      dragging: false
    };

    sheetEl.setPointerCapture(event.pointerId);
    sheetEl.addEventListener('pointermove', onPointerMove);
    sheetEl.addEventListener('pointerup', onPointerUp);
    sheetEl.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(event) {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;

    const deltaY = event.clientY - pointerSession.startY;
    if (deltaY <= 0) return;

    pointerSession.currentY = event.clientY;
    pointerSession.dragging = true;
    sheetEl.style.transition = 'none';
    sheetEl.style.transform = `translateY(${deltaY}px)`;
  }

  function onPointerUp(event) {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;

    const deltaY = pointerSession.currentY - pointerSession.startY;

    sheetEl.releasePointerCapture(pointerSession.pointerId);
    sheetEl.removeEventListener('pointermove', onPointerMove);
    sheetEl.removeEventListener('pointerup', onPointerUp);
    sheetEl.removeEventListener('pointercancel', onPointerUp);

    sheetEl.style.transition = '';
    sheetEl.style.transform = '';

    const shouldClose = pointerSession.dragging && deltaY > 90;
    pointerSession = null;

    if (shouldClose) {
      closeSheet();
      return;
    }

    requestAnimationFrame(() => {
      if (isSheetOpen) {
        sheetEl.classList.add('is-open');
      }
    });
  }

  function handleCatalogClick(event) {
    if (!MOBILE_QUERY.matches) return;

    const card = event.target.closest('[data-services-events-group]');
    if (!card) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!configMount.hidden) {
          openSheet();
        }
      });
    });
  }

  function handlePanelSync() {
    if (!MOBILE_QUERY.matches || !isSheetOpen) return;
    if (isNativeTimePickerActive) return;

    if (isConfigMountedInsideSheet()) {
      syncSheetHeader();
      syncSheetFooter();
      return;
    }

    requestAnimationFrame(() => {
      syncSheetFromPanel({ resetScroll: false });
    });
  }

  function isEventsPanelActuallyOpen() {
    const eventsPanel = document.getElementById('services-expand-events');
    const servicesExpand = document.getElementById('services-expand');

    if (!eventsPanel || !servicesExpand) {
      return false;
    }

    if (eventsPanel.hidden || servicesExpand.hidden) {
      return false;
    }

    if (eventsPanel.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    if (servicesExpand.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    return true;
  }

  function handleViewportChange() {
    if (!MOBILE_QUERY.matches) {
      closeSheet();
      configMount.hidden = false;

      if (sheetEl) {
        sheetEl.hidden = true;
      }

      if (backdropEl) {
        backdropEl.hidden = true;
      }

      panelRoot.classList.remove('services-events-panel--sheet-open');
      return;
    }

    if (!isEventsPanelActuallyOpen()) {
      closeSheet();
      syncInlineConfigVisibility();
      return;
    }

    syncInlineConfigVisibility();
  }

  function bindExternalEvents() {
    catalogMount.addEventListener('click', handleCatalogClick);

    const observer = new MutationObserver(handlePanelSync);
    observer.observe(configMount, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-disabled', 'class', 'value']
    });

    const eventsPanel = document.getElementById('services-expand-events');
    const servicesExpand = document.getElementById('services-expand');

    if (eventsPanel && servicesExpand) {
      const visibilityObserver = new MutationObserver(() => {
        handleViewportChange();
      });

      visibilityObserver.observe(eventsPanel, {
        attributes: true,
        attributeFilter: ['hidden', 'aria-hidden']
      });

      visibilityObserver.observe(servicesExpand, {
        attributes: true,
        attributeFilter: ['hidden', 'aria-hidden']
      });
    }

    if (typeof MOBILE_QUERY.addEventListener === 'function') {
      MOBILE_QUERY.addEventListener('change', handleViewportChange);
    } else if (typeof MOBILE_QUERY.addListener === 'function') {
      MOBILE_QUERY.addListener(handleViewportChange);
    }
  }

  ensureSheet();
  bindExternalEvents();
  handleViewportChange();

  window.addEventListener('pixkuy:events-special-panel-submit', () => {
    if (!MOBILE_QUERY.matches || !isSheetOpen) {
      return;
    }

    closeSheet();
  });

  window.addEventListener('pixkuy:i18n-applied', () => {
    syncSheetI18n();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isSheetOpen) {
          forceSheetOwnsConfigMount();
          return;
        }

        restoreConfigFromSheet();
        syncInlineConfigVisibility();
      });
    });
  });
})();