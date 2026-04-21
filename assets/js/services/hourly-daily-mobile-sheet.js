(function () {
  const panelRoot = document.querySelector('[data-services-hourly-panel]');
  const configMount = document.querySelector('[data-services-hourly-config]');

  if (!panelRoot || !configMount) return;

  const MOBILE_QUERY = window.matchMedia('(max-width: 720px)');

  let backdropEl = null;
  let sheetEl = null;
  let bodyEl = null;
  let priceValueEl = null;
  let ctaEl = null;
  let configMountPlaceholder = null;

  let isSheetOpen = false;
  let pointerSession = null;
  let isNativeDatePickerActive = false;

  function ensureSheet() {
    if (backdropEl && sheetEl) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'services-hourly-panel__sheet-backdrop';
    backdropEl.hidden = true;

    sheetEl = document.createElement('div');
    sheetEl.className = 'services-hourly-panel__sheet';
    sheetEl.hidden = true;
    sheetEl.setAttribute('aria-hidden', 'true');
    sheetEl.style.pointerEvents = 'none';

    sheetEl.innerHTML = `
      <div class="services-hourly-panel__sheet-handle-wrap" data-services-hourly-sheet-drag>
        <div class="services-hourly-panel__sheet-handle" aria-hidden="true"></div>
      </div>

      <div class="services-hourly-panel__sheet-head">
        <div>
          <h4 class="services-hourly-panel__sheet-title" data-services-hourly-sheet-title></h4>
        </div>

        <button
          type="button"
          class="services-hourly-panel__sheet-close"
          data-services-hourly-sheet-close
          aria-label="Cerrar"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div class="services-hourly-panel__sheet-body" data-services-hourly-sheet-body></div>

      <div class="services-hourly-panel__sheet-footer">
        <div class="services-hourly-panel__sheet-price">
          <p class="services-hourly-panel__sheet-price-label" data-services-hourly-sheet-price-label></p>
          <strong class="services-hourly-panel__sheet-price-value" data-services-hourly-sheet-price-value></strong>
        </div>

        <button
          type="button"
          class="services-hourly-panel__sheet-cta"
          data-services-hourly-sheet-cta
        ></button>
      </div>
    `;

    document.body.appendChild(backdropEl);
    document.body.appendChild(sheetEl);

    bodyEl = sheetEl.querySelector('[data-services-hourly-sheet-body]');
    priceValueEl = sheetEl.querySelector('[data-services-hourly-sheet-price-value]');
    ctaEl = sheetEl.querySelector('[data-services-hourly-sheet-cta]');

    syncSheetI18n();
    bindSheetEvents();
  }

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function isDateFieldTarget(target) {
    return !!(
      target &&
      typeof target.matches === 'function' &&
      (
        target.matches('[data-services-hourly-date]') ||
        target.matches('[data-services-hourly-time]')
      )
    );
  }

  function setNativeDatePickerActive(nextValue) {
    isNativeDatePickerActive = nextValue === true;
  }

  function isSheetUsingLiveConfigMount(target, selector) {
    const inline = configMount.querySelector(selector);

    if (!inline || !target) {
      return false;
    }

    return inline === target;
  }

  function mountConfigIntoSheet() {
    if (!bodyEl || !configMount) return;

    bodyEl.innerHTML = '';
    bodyEl.style.display = 'flex';
    bodyEl.style.flexDirection = 'column';
    bodyEl.style.justifyContent = 'flex-start';
    bodyEl.style.alignItems = 'stretch';

    if (!configMountPlaceholder) {
      configMountPlaceholder = document.createComment('services-hourly-config-placeholder');
    }

    if (!configMountPlaceholder.parentNode && configMount.parentNode) {
      configMount.parentNode.insertBefore(configMountPlaceholder, configMount);
    }

    configMount.hidden = false;
    configMount.removeAttribute('hidden');
    configMount.removeAttribute('data-services-hourly-config');

    bodyEl.appendChild(configMount);
    configMount.style.display = 'grid';
    configMount.style.width = '100%';
  }

  function restoreConfigFromSheet() {
    if (!configMount || !configMountPlaceholder || !configMountPlaceholder.parentNode) return;

    configMountPlaceholder.parentNode.insertBefore(configMount, configMountPlaceholder);
    configMount.setAttribute('data-services-hourly-config', '');
    configMount.style.display = '';
  }

  function isConfigMountedInsideSheet() {
    return Boolean(bodyEl && configMount && configMount.parentNode === bodyEl);
  }

  function getInlinePriceValue() {
    const valueEl = configMount.querySelector('.services-hourly-panel__price-value');
    return valueEl ? valueEl.textContent.trim() : '';
  }

  function getInlineCta() {
    return configMount.querySelector('[data-services-hourly-cta]');
  }

  function getActiveModeLabel() {
    const activeTab = configMount.querySelector('[data-services-hourly-mode][aria-pressed="true"]');
    return activeTab ? activeTab.textContent.trim() : '';
  }
  
    function getActiveModeValue() {
    const activeTab = configMount.querySelector('[data-services-hourly-mode][aria-pressed="true"]');
    return activeTab
      ? (activeTab.getAttribute('data-services-hourly-mode') || '').trim()
      : '';
  }

  function syncInlineConfigVisibility() {
    if (!MOBILE_QUERY.matches) {
      configMount.hidden = false;
      return;
    }

    configMount.hidden = !isSheetOpen;
  }

  function syncSheetI18n() {
    if (!sheetEl) return;

    const titleEl = sheetEl.querySelector('[data-services-hourly-sheet-title]');
    const priceLabelEl = sheetEl.querySelector('[data-services-hourly-sheet-price-label]');
    const closeButton = sheetEl.querySelector('[data-services-hourly-sheet-close]');

    if (titleEl) {
      titleEl.textContent =
        getI18nValue('services.cards.hourly.panel.title') || 'Conductor por horas / día completo';
    }

    if (priceLabelEl) {
      priceLabelEl.textContent =
        getI18nValue('services.cards.hourly.panel.priceLabel') || 'Precio final';
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

    const titleEl = sheetEl.querySelector('[data-services-hourly-sheet-title]');
    const baseTitle = getI18nValue('services.cards.hourly.panel.title') || 'Conductor por horas / día completo';
    const activeMode = getActiveModeValue();

    if (titleEl) {
      titleEl.textContent = baseTitle;
    }

    if (activeMode) {
      sheetEl.setAttribute('data-services-hourly-sheet-mode', activeMode);
    } else {
      sheetEl.removeAttribute('data-services-hourly-sheet-mode');
    }
  }

  function syncSheetFooter() {
    if (!sheetEl) return;

    const priceText = getInlinePriceValue();
    if (priceValueEl) {
      priceValueEl.textContent = priceText;
    }

    const inlineCta = getInlineCta();
    if (ctaEl && inlineCta) {
      ctaEl.textContent = inlineCta.textContent.trim();
      ctaEl.disabled = inlineCta.disabled;
      ctaEl.setAttribute('aria-disabled', inlineCta.disabled ? 'true' : 'false');
    }
  }

  function syncSheetFromPanel(options) {
    const safeOptions = options && typeof options === 'object' ? options : {};
    const resetScroll = safeOptions.resetScroll === true;

    syncInlineConfigVisibility();

    if (!MOBILE_QUERY.matches || !isSheetOpen || !sheetEl) return;
    if (isNativeDatePickerActive) return;

    const previousScrollTop = bodyEl ? bodyEl.scrollTop : 0;

    mountConfigIntoSheet();
    syncSheetHeader();
    syncSheetFooter();

    if (!bodyEl) return;

    if (resetScroll) {
      bodyEl.scrollTop = 0;
      return;
    }

    bodyEl.scrollTop = previousScrollTop;
  }

  function forceSheetOwnsConfigMount() {
    if (!MOBILE_QUERY.matches || !isSheetOpen || !sheetEl || !bodyEl || !configMount) {
      return false;
    }

    if (isNativeDatePickerActive) {
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
    panelRoot.classList.add('services-hourly-panel--sheet-open');

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
        if (bodyEl) {
          bodyEl.scrollTop = 0;
        }
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

  function closeSheet(options) {
    const safeOptions = options && typeof options === 'object' ? options : {};
    const collapseService = safeOptions.collapseService === true;

    if (!sheetEl || !isSheetOpen) return;

    isSheetOpen = false;
    pointerSession = null;
    setNativeDatePickerActive(false);

    panelRoot.classList.remove('services-hourly-panel--sheet-open');
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

    if (collapseService) {
      window.setTimeout(() => {
        const hourlyTrigger = document.querySelector('[data-service-expand-trigger="hourly"]');
        const hourlyPanel = document.getElementById('services-expand-hourly');

        if (!hourlyTrigger || !hourlyPanel) {
          return;
        }

        if (hourlyPanel.hidden || hourlyPanel.getAttribute('aria-hidden') === 'true') {
          return;
        }

        hourlyTrigger.click();
      }, 0);
    }
  }

  function bindSheetEvents() {
    if (!sheetEl || !backdropEl) return;

    backdropEl.addEventListener('click', () => {
      closeSheet({ collapseService: true });
    });

    sheetEl.addEventListener('click', (event) => {
      const closeButton = event.target.closest('[data-services-hourly-sheet-close]');
      if (closeButton) {
        closeSheet({ collapseService: true });
        return;
      }

      const sheetCta = event.target.closest('[data-services-hourly-sheet-cta]');
      if (sheetCta) {
        const inlineCta = getInlineCta();
        if (inlineCta && !inlineCta.disabled) {
          inlineCta.click();
          closeSheet({ collapseService: true });
        }
        return;
      }
    });

    sheetEl.addEventListener('input', (event) => {
      const target = event.target;

      if (target.matches('[data-services-hourly-date]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-hourly-date]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-hourly-date]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      if (target.matches('[data-services-hourly-time]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-hourly-time]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-hourly-time]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      if (target.matches('[data-services-hourly-notes]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-hourly-notes]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-hourly-notes]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });

    sheetEl.addEventListener('change', (event) => {
      const target = event.target;

      if (target.matches('[data-services-hourly-date]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-hourly-date]')) {
          return;
        }

        setNativeDatePickerActive(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            syncSheetFromPanel({ resetScroll: false });
          });
        });
      }

      if (target.matches('[data-services-hourly-time]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-hourly-time]')) {
          return;
        }

        setNativeDatePickerActive(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            syncSheetFromPanel({ resetScroll: false });
          });
        });
      }
    });

    sheetEl.addEventListener('pointerdown', (event) => {
      if (isDateFieldTarget(event.target)) {
        setNativeDatePickerActive(true);
      }
    });

    sheetEl.addEventListener('focusin', (event) => {
      if (isDateFieldTarget(event.target)) {
        setNativeDatePickerActive(true);
      }
    });

    const dragArea = sheetEl.querySelector('[data-services-hourly-sheet-drag]');
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
      closeSheet({ collapseService: true });
      return;
    }

    requestAnimationFrame(() => {
      if (isSheetOpen) {
        sheetEl.classList.add('is-open');
      }
    });
  }

  function isPickupFieldActive() {
    const activeElement = document.activeElement;

    if (!activeElement || typeof activeElement.matches !== 'function') {
      return false;
    }

    return activeElement.matches('[data-place-input="hourly_daily_pickup"]');
  }

  function handlePanelSync() {
    if (!MOBILE_QUERY.matches || !isSheetOpen) return;
    if (isNativeDatePickerActive) return;

    if (isConfigMountedInsideSheet()) {
      syncSheetHeader();
      syncSheetFooter();
      return;
    }

    requestAnimationFrame(() => {
      syncSheetFromPanel({ resetScroll: false });
    });
  }

  function isHourlyPanelActuallyOpen() {
    const hourlyPanel = document.getElementById('services-expand-hourly');
    const servicesExpand = document.getElementById('services-expand');

    if (!hourlyPanel || !servicesExpand) {
      return false;
    }

    if (hourlyPanel.hidden) {
      return false;
    }

    if (hourlyPanel.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    if (servicesExpand.hidden) {
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
      panelRoot.classList.remove('services-hourly-panel--sheet-open');
      return;
    }

    if (!isHourlyPanelActuallyOpen()) {
      closeSheet();
      syncInlineConfigVisibility();
      return;
    }

    openSheet();
  }

  function bindExternalEvents() {
    const observer = new MutationObserver(handlePanelSync);
    observer.observe(configMount, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-disabled', 'class', 'value']
    });

    const hourlyPanel = document.getElementById('services-expand-hourly');
    const servicesExpand = document.getElementById('services-expand');

    if (hourlyPanel && servicesExpand) {
      const visibilityObserver = new MutationObserver(() => {
        handleViewportChange();
      });

      visibilityObserver.observe(hourlyPanel, {
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

  window.addEventListener('pixkuy:hourly-daily-panel-ui-sync', () => {
    if (!isSheetOpen) {
      return;
    }

    syncSheetHeader();
    syncSheetFooter();
  });

  window.addEventListener('pixkuy:hourly-daily-panel-submit', () => {
    if (!MOBILE_QUERY.matches || !isSheetOpen) {
      return;
    }

    closeSheet({ collapseService: true });
  });
})();