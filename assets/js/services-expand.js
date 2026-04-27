(function () {
  const root = document.querySelector('.services-cards');
  const expand = document.getElementById('services-expand');

  if (!root || !expand) return;

  const inner = expand.querySelector('.services-expand__inner');
  if (!inner) return;

  const cards = Array.from(root.querySelectorAll('.service-card'));
  const panels = Array.from(inner.querySelectorAll('.services-expand__panel[data-service-panel]'));

  if (!cards.length || !panels.length) return;

  const ACTIVE_CLASS = 'service-card--active';
  const EXPAND_OPEN_CLASS = 'services-expand--open';
  const MOBILE_MEDIA = '(max-width: 720px)';
  const MOBILE_HINT_CLASS = 'service-card--mobile-hint';
  const mobileQuery = window.matchMedia(MOBILE_MEDIA);

  let mobileHintTimeout = null;
  let mobileHintObserver = null;
  let mobileHintWasVisible = false;
  let openService = null;

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function findCardByI18nKey(path) {
    return cards.find((card) => !!card.querySelector(`[data-i18n="${path}"]`)) || null;
  }

  function buildServiceRegistry() {
    const registry = {
      airport: {
        key: 'airport',
        card: findCardByI18nKey('services.cards.airport.title'),
        panel: document.getElementById('services-expand-airport'),
        closedLabel: 'services.cards.airport.ctaClosed',
        openLabel: 'services.cards.airport.ctaOpen'
      },
      tours: {
        key: 'tours',
        card: findCardByI18nKey('services.cards.tours.title'),
        panel: document.getElementById('services-expand-tours'),
        closedLabel: 'services.cards.tours.ctaClosed',
        openLabel: 'services.cards.tours.ctaOpen'
      },
      hourly: {
        key: 'hourly',
        card: findCardByI18nKey('services.cards.hourly.title'),
        panel: document.getElementById('services-expand-hourly'),
        closedLabel: 'services.cards.hourly.ctaClosed',
        openLabel: 'services.cards.hourly.ctaOpen'
      },
      events: {
        key: 'events',
        card: findCardByI18nKey('services.cards.events.title'),
        panel: document.getElementById('services-expand-events'),
        closedLabel: 'services.cards.events.ctaClosed',
        openLabel: 'services.cards.events.ctaOpen'
      }
    };

    Object.keys(registry).forEach((serviceKey) => {
      const entry = registry[serviceKey];
      if (!entry.card || !entry.panel) return;

      entry.actionLabel = entry.card.querySelector('.service-card__action-label');
    });

    return registry;
  }

  const services = buildServiceRegistry();

  const serviceKeys = Object.keys(services).filter((serviceKey) => {
    const entry = services[serviceKey];
    return !!(entry && entry.card && entry.panel);
  });

  if (!serviceKeys.length) return;

  function getRequestedServiceFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const rawService = String(params.get('service') || '').trim().toLowerCase();

      const publicToInternalMap = {
        airport_hotel: 'airport',
        tour_private: 'tours',
        hourly_daily: 'hourly',
        event_special: 'events'
      };

      return publicToInternalMap[rawService] || null;
    } catch (error) {
      return null;
    }
  }
  
    function shouldSkipMobileDeepLinkFraming(serviceKey) {
    if (!mobileQuery.matches) return false;
    if (serviceKey !== 'tours') return false;

    try {
      const params = new URLSearchParams(window.location.search || '');
      const rawService = String(params.get('service') || '').trim().toLowerCase();
      const rawTour = String(params.get('tour') || '').trim();

      return rawService === 'tour_private' && !!rawTour;
    } catch (error) {
      return false;
    }
  }

  function getPrimaryCard() {
    const airport = services.airport;
    if (airport && airport.card) return airport.card;
    const tours = services.tours;
    if (tours && tours.card) return tours.card;
    return cards[0] || null;
  }

  function getMobileHintCards() {
    return serviceKeys
      .map((serviceKey) => services[serviceKey])
      .filter((entry) => !!(entry && entry.card));
  }

  function getAnchorCardForDesktop() {
    const primaryCard = getPrimaryCard();
    const hourlyEntry = services.hourly;

    if (openService === 'hourly' && hourlyEntry && hourlyEntry.card) {
      return cards[cards.length - 1] || hourlyEntry.card;
    }

    const eventsEntry = services.events;
    if (openService === 'events' && eventsEntry && eventsEntry.card) {
      return cards[cards.length - 1] || eventsEntry.card;
    }

    if (!primaryCard) return null;
    return primaryCard.nextElementSibling || null;
  }

  function placeExpandForViewport() {
    const primaryCard = getPrimaryCard();
    if (!primaryCard) return;

    if (mobileQuery.matches) {
      if (openService && services[openService] && services[openService].card) {
        services[openService].card.insertAdjacentElement('afterend', expand);
        return;
      }

      primaryCard.insertAdjacentElement('afterend', expand);
      return;
    }

    const desktopAnchor = getAnchorCardForDesktop();
    if (desktopAnchor && desktopAnchor.parentNode === root) {
      desktopAnchor.insertAdjacentElement('afterend', expand);
      return;
    }

    root.appendChild(expand);
  }

  function setActionLabel(entry, path) {
    if (!entry || !entry.actionLabel || !path) return;

    entry.actionLabel.setAttribute('data-i18n', path);

    const translated = getI18nValue(path);
    if (translated) {
      entry.actionLabel.textContent = translated;
    }
  }

  function updateCardState(entry, isOpen) {
    if (!entry || !entry.card) return;

    entry.card.classList.toggle(ACTIVE_CLASS, isOpen);
    entry.card.setAttribute('aria-expanded', String(isOpen));

    setActionLabel(entry, isOpen ? entry.openLabel : entry.closedLabel);
  }

  function updatePanelState(entry, isOpen) {
    if (!entry || !entry.panel) return;

    entry.panel.hidden = !isOpen;
    entry.panel.setAttribute('aria-hidden', String(!isOpen));
  }

  function setExpandedState(nextServiceKey) {
    openService = nextServiceKey || null;

    placeExpandForViewport();

    const isAnyOpen = !!openService;

    expand.hidden = !isAnyOpen;
    expand.setAttribute('aria-hidden', String(!isAnyOpen));
    expand.classList.toggle(EXPAND_OPEN_CLASS, isAnyOpen);

    serviceKeys.forEach((serviceKey) => {
      const entry = services[serviceKey];
      const isOpen = serviceKey === openService;

      updateCardState(entry, isOpen);
      updatePanelState(entry, isOpen);
    });
  }

  function toggleService(serviceKey) {
    if (!serviceKey || !services[serviceKey]) return;

    const nextService = openService === serviceKey ? null : serviceKey;
    setExpandedState(nextService);
  }

  function bindCard(entry) {
    if (!entry || !entry.card) return;

    entry.card.setAttribute('role', 'button');
    entry.card.setAttribute('tabindex', '0');
    entry.card.setAttribute('aria-controls', 'services-expand');
    entry.card.setAttribute('aria-expanded', 'false');
    entry.card.setAttribute('data-service-expand-trigger', entry.key);

    entry.card.addEventListener('click', () => {
      toggleService(entry.key);
    });

    entry.card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleService(entry.key);
      }
    });
  }

  function clearMobileHint(card) {
    if (card) {
      card.classList.remove(MOBILE_HINT_CLASS);
    } else {
      serviceKeys.forEach((serviceKey) => {
        const entry = services[serviceKey];
        if (entry && entry.card) {
          entry.card.classList.remove(MOBILE_HINT_CLASS);
        }
      });
    }

    if (mobileHintTimeout) {
      window.clearTimeout(mobileHintTimeout);
      mobileHintTimeout = null;
    }
  }

  function triggerMobileHint(card) {
    if (!mobileQuery.matches || !card) return;

    if (openService && services[openService] && services[openService].card === card) {
      return;
    }

    clearMobileHint(card);
    card.classList.add(MOBILE_HINT_CLASS);

    mobileHintTimeout = window.setTimeout(() => {
      card.classList.remove(MOBILE_HINT_CLASS);
      mobileHintTimeout = null;
    }, 1400);
  }

  function bindMobileHintObserver() {
    if (!('IntersectionObserver' in window)) return;

    if (mobileHintObserver) {
      mobileHintObserver.disconnect();
      mobileHintObserver = null;
    }

    const hintCards = getMobileHintCards();
    if (!hintCards.length) return;

    const visibilityState = new WeakMap();

    mobileHintObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        const wasVisible = visibilityState.get(card) === true;

        if (isVisible && !wasVisible) {
          visibilityState.set(card, true);
          triggerMobileHint(card);
          return;
        }

        if (!isVisible && wasVisible) {
          visibilityState.set(card, false);
          clearMobileHint(card);
        }
      });
    }, {
      threshold: [0, 0.55]
    });

    hintCards.forEach((entry) => {
      visibilityState.set(entry.card, false);
      mobileHintObserver.observe(entry.card);
    });
  }

  function handleViewportChange() {
    placeExpandForViewport();
    clearMobileHint();
    bindMobileHintObserver();
  }
  
  function scrollMobileDeepLinkedPanelIntoView(serviceKey) {
    if (!mobileQuery.matches || !serviceKey || !services[serviceKey]) return;

    const entry = services[serviceKey];
    if (!entry || !entry.panel) return;

    let attempts = 0;
    const maxAttempts = 8;

    function runScroll() {
      if (!mobileQuery.matches || entry.panel.hidden) return;

      const panelRect = entry.panel.getBoundingClientRect();
      const panelTop = panelRect.top + window.scrollY;
      const targetTop = Math.max(panelTop - 12, 0);

      window.scrollTo(0, targetTop);

      attempts += 1;
      if (attempts >= maxAttempts) return;

      window.setTimeout(() => {
        const currentTop = entry.panel.getBoundingClientRect().top + window.scrollY;
        const delta = Math.abs(currentTop - targetTop);

        if (delta > 6) {
          runScroll();
        }
      }, 120);
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        runScroll();
      });
    });
  }

  function scrollDesktopEventsDeepLinkPanelIntoView(serviceKey) {
    if (mobileQuery.matches || serviceKey !== 'events') return;

    const entry = services.events;
    if (!entry || !entry.panel || entry.panel.hidden || expand.hidden) return;

    let attempts = 0;
    const maxAttempts = 6;

    function runScroll() {
      if (mobileQuery.matches || entry.panel.hidden || expand.hidden) return;

      const targetRect = expand.getBoundingClientRect();
      const targetTop = Math.max(targetRect.top + window.scrollY - 18, 0);

      window.scrollTo({
        top: targetTop,
        behavior: 'auto'
      });

      attempts += 1;
      if (attempts >= maxAttempts) return;

      window.setTimeout(runScroll, 140);
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runScroll);
    });
  }
  
  serviceKeys.forEach((serviceKey) => {
    bindCard(services[serviceKey]);
  });

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', handleViewportChange);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(handleViewportChange);
  }

  placeExpandForViewport();

  const requestedService = getRequestedServiceFromUrl();
  if (requestedService && services[requestedService]) {
    setExpandedState(requestedService);

    scrollDesktopEventsDeepLinkPanelIntoView(requestedService);

    if (!shouldSkipMobileDeepLinkFraming(requestedService)) {
      scrollMobileDeepLinkedPanelIntoView(requestedService);

      window.addEventListener('load', () => {
        scrollDesktopEventsDeepLinkPanelIntoView(requestedService);
        scrollMobileDeepLinkedPanelIntoView(requestedService);
      }, { once: true });

      window.addEventListener('pageshow', () => {
        scrollDesktopEventsDeepLinkPanelIntoView(requestedService);
        scrollMobileDeepLinkedPanelIntoView(requestedService);
      }, { once: true });
    }
  } else {
    setExpandedState(null);
  }

  bindMobileHintObserver();
})();