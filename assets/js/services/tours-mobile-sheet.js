(function () {
  const panelRoot = document.querySelector('[data-services-tours-panel]');
  const catalogMount = document.querySelector('[data-services-tours-catalog]');
  const configMount = document.querySelector('[data-services-tours-config]');

  if (!panelRoot || !catalogMount || !configMount) return;

  const MOBILE_QUERY = window.matchMedia('(max-width: 720px)');

  let backdropEl = null;
  let sheetEl = null;
  let headMetaEl = null;
  let bodyEl = null;
  let priceValueEl = null;
  let ctaEl = null;
  let configMountPlaceholder = null;

  let isSheetOpen = false;
  let activeTourId = '';
  let activeTourTitle = '';
  let activeTourDuration = '';
  let pointerSession = null;
  let isNativeDatePickerActive = false;

  function ensureSheet() {
    if (backdropEl && sheetEl) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'services-tours-panel__sheet-backdrop';
    backdropEl.hidden = true;

    sheetEl = document.createElement('div');
    sheetEl.className = 'services-tours-panel__sheet';
    sheetEl.hidden = true;
    sheetEl.setAttribute('aria-hidden', 'true');
    sheetEl.style.pointerEvents = 'none';

    sheetEl.innerHTML = `
      <div class="services-tours-panel__sheet-handle-wrap" data-services-tours-sheet-drag>
        <div class="services-tours-panel__sheet-handle" aria-hidden="true"></div>
      </div>

      <div class="services-tours-panel__sheet-head">
        <div>
          <h4 class="services-tours-panel__sheet-title" data-services-tours-sheet-title></h4>
          <p class="services-tours-panel__sheet-meta" data-services-tours-sheet-meta></p>
        </div>

        <button
          type="button"
          class="services-tours-panel__sheet-close"
          data-services-tours-sheet-close
          aria-label="Cerrar"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div class="services-tours-panel__sheet-body" data-services-tours-sheet-body></div>

      <div class="services-tours-panel__sheet-footer">
        <div class="services-tours-panel__sheet-price">
          <p class="services-tours-panel__sheet-price-label" data-services-tours-sheet-price-label></p>
          <strong class="services-tours-panel__sheet-price-value" data-services-tours-sheet-price-value></strong>
        </div>

        <button
          type="button"
          class="services-tours-panel__sheet-cta"
          data-services-tours-sheet-cta
        ></button>
      </div>
    `;

    document.body.appendChild(backdropEl);
    document.body.appendChild(sheetEl);

    headMetaEl = sheetEl.querySelector('[data-services-tours-sheet-meta]');
    bodyEl = sheetEl.querySelector('[data-services-tours-sheet-body]');
    priceValueEl = sheetEl.querySelector('[data-services-tours-sheet-price-value]');
    ctaEl = sheetEl.querySelector('[data-services-tours-sheet-cta]');

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

  function mountConfigIntoSheet() {
    if (!bodyEl || !configMount) return;

    bodyEl.innerHTML = '';
    bodyEl.scrollTop = 0;
    bodyEl.style.display = 'flex';
    bodyEl.style.flexDirection = 'column';
    bodyEl.style.justifyContent = 'flex-start';
    bodyEl.style.alignItems = 'stretch';

    if (!configMountPlaceholder) {
      configMountPlaceholder = document.createComment('services-tours-config-placeholder');
    }

    if (!configMountPlaceholder.parentNode && configMount.parentNode) {
      configMount.parentNode.insertBefore(configMountPlaceholder, configMount);
    }

    configMount.hidden = false;
    configMount.removeAttribute('hidden');
    configMount.removeAttribute('data-services-tours-config');

    bodyEl.appendChild(configMount);
    configMount.style.display = 'grid';
    configMount.style.width = '100%';
  }

  function restoreConfigFromSheet() {
    if (!configMount || !configMountPlaceholder || !configMountPlaceholder.parentNode) return;

    configMountPlaceholder.parentNode.insertBefore(configMount, configMountPlaceholder);
    configMount.setAttribute('data-services-tours-config', '');
    configMount.style.display = '';
  }

  function getSelectedCatalogButton() {
    return catalogMount.querySelector('[data-services-tour-option][aria-pressed="true"]');
  }
  
    function readTourSnapshot(card) {
    if (!card) {
      return { id: '', title: '', duration: '' };
    }

    const titleEl = card.querySelector('.services-tours-panel__tour-title');
    const durationEl = card.querySelector('.services-tours-panel__tour-duration');

    return {
      id: card.getAttribute('data-services-tour-option') || '',
      title: titleEl ? titleEl.textContent.trim() : '',
      duration: durationEl ? durationEl.textContent.trim() : ''
    };
  }

  function getSelectedTourTitle() {
    if (activeTourTitle) return activeTourTitle;

    const selected = getSelectedCatalogButton();
    const titleEl = selected ? selected.querySelector('.services-tours-panel__tour-title') : null;
    return titleEl ? titleEl.textContent.trim() : '';
  }

  function getSelectedTourDuration() {
    if (activeTourDuration) return activeTourDuration;

    const selected = getSelectedCatalogButton();
    const durationEl = selected ? selected.querySelector('.services-tours-panel__tour-duration') : null;
    return durationEl ? durationEl.textContent.trim() : '';
  }

  function getInlinePriceValue() {
    const valueEl = configMount.querySelector('.services-tours-panel__price-value');
    return valueEl ? valueEl.textContent.trim() : '';
  }

  function getInlineCta() {
    return configMount.querySelector('[data-services-tours-cta]');
  }
  
  function isDateFieldTarget(target) {
    return !!(target && typeof target.matches === 'function' && target.matches('[data-services-tours-date]'));
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
  
  function syncInlineConfigVisibility() {
    if (!MOBILE_QUERY.matches) {
      configMount.hidden = false;
      return;
    }

    configMount.hidden = !isSheetOpen;
  }
  
    function syncSheetI18n() {
    if (!sheetEl) return;

    const priceLabelEl = sheetEl.querySelector('[data-services-tours-sheet-price-label]');
    const closeButton = sheetEl.querySelector('[data-services-tours-sheet-close]');

    if (priceLabelEl) {
      priceLabelEl.textContent =
        getI18nValue('services.cards.tours.panel.priceLabel') || 'Precio final';
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

    const titleEl = sheetEl.querySelector('[data-services-tours-sheet-title]');
    if (titleEl) {
      titleEl.textContent = getSelectedTourTitle();
    }

    if (headMetaEl) {
      headMetaEl.textContent = getSelectedTourDuration();
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

  function syncSheetFromPanel() {
    syncInlineConfigVisibility();

    if (!MOBILE_QUERY.matches || !isSheetOpen || !sheetEl) return;
    if (isNativeDatePickerActive) return;

    mountConfigIntoSheet();
    syncSheetHeader();
    syncSheetFooter();

    if (bodyEl) {
      bodyEl.scrollTop = 0;
    }
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
    panelRoot.classList.add('services-tours-panel--sheet-open');

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

    syncSheetFromPanel();

    requestAnimationFrame(() => {
      sheetEl.classList.add('is-open');
      sheetEl.setAttribute('aria-hidden', 'false');
      sheetEl.style.transform = 'translateY(0)';

      requestAnimationFrame(() => {
        if (bodyEl) {
          bodyEl.scrollTop = 0;
        }
        syncSheetFromPanel();
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
    setNativeDatePickerActive(false);

    panelRoot.classList.remove('services-tours-panel--sheet-open');
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
      const closeButton = event.target.closest('[data-services-tours-sheet-close]');
      if (closeButton) {
        closeSheet();
        return;
      }

      const sheetCta = event.target.closest('[data-services-tours-sheet-cta]');
      if (sheetCta) {
        const inlineCta = getInlineCta();
        if (inlineCta && !inlineCta.disabled) {
          closeSheet();
          inlineCta.click();
        }
        return;
      }
    });

    sheetEl.addEventListener('input', (event) => {
      const target = event.target;

      if (target.matches('[data-services-tours-pickup]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-tours-pickup]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-tours-pickup]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      if (target.matches('[data-services-tours-date]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-tours-date]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-tours-date]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      if (target.matches('[data-services-tours-time]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-tours-time]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-tours-time]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });

    sheetEl.addEventListener('change', (event) => {
      const target = event.target;

      if (target.matches('[data-services-tours-guide-language]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-tours-guide-language]')) {
          return;
        }

        const inline = configMount.querySelector('[data-services-tours-guide-language]');
        if (inline) {
          inline.value = target.value;
          inline.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      if (target.matches('[data-services-tours-date]')) {
        if (isSheetUsingLiveConfigMount(target, '[data-services-tours-date]')) {
          return;
        }

        setNativeDatePickerActive(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            syncSheetFromPanel();
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

    const dragArea = sheetEl.querySelector('[data-services-tours-sheet-drag]');
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

    const card = event.target.closest('[data-services-tour-option]');
    if (!card) return;

    const snapshot = readTourSnapshot(card);
    if (!snapshot.id) return;

    activeTourId = snapshot.id;
    activeTourTitle = snapshot.title;
    activeTourDuration = snapshot.duration;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        openSheet();
      });
    });
  }

  function handlePanelSync() {
    if (!MOBILE_QUERY.matches || !isSheetOpen) return;
    if (isNativeDatePickerActive) return;

    requestAnimationFrame(() => {
      syncSheetFromPanel();
    });
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
      panelRoot.classList.remove('services-tours-panel--sheet-open');
      return;
    }

    syncInlineConfigVisibility();

    if (isSheetOpen) {
      syncSheetFromPanel();
    }
  }

  function bindExternalEvents() {
    catalogMount.addEventListener('click', handleCatalogClick, true);

    const observer = new MutationObserver(handlePanelSync);
    observer.observe(configMount, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-disabled', 'class', 'value']
    });

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

  window.addEventListener('pixkuy:tours-panel-ui-sync', () => {
    if (!isSheetOpen) {
      return;
    }

    syncSheetFooter();
  });
})();