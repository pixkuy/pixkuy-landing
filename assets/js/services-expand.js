(function () {
  const root = document.querySelector('.services-cards');
  const expand = document.getElementById('services-expand');
  const airportPanel = document.getElementById('services-expand-airport');

  if (!root || !expand || !airportPanel) return;

  const cards = Array.from(root.querySelectorAll('.service-card'));
  const airportCard = cards.find((card) => {
    const title = card.querySelector('[data-i18n="services.cards.airport.title"]');
    return !!title;
  });

  if (!airportCard) return;

  const ACTIVE_CLASS = 'service-card--active';
  const EXPAND_OPEN_CLASS = 'services-expand--open';
  const MOBILE_MEDIA = '(max-width: 720px)';
  const mobileQuery = window.matchMedia(MOBILE_MEDIA);
  const airportCardNextSibling = airportCard.nextElementSibling;
  const actionLabel = airportCard.querySelector('.service-card__action-label');

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict;
    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function setActionLabelI18n(path) {
    if (!actionLabel) return;

    actionLabel.setAttribute('data-i18n', path);

    const translated = getI18nValue(path);
    if (translated) {
      actionLabel.textContent = translated;
    }
  }

  function placeExpandForViewport() {
    if (mobileQuery.matches) {
      airportCard.insertAdjacentElement('afterend', expand);
      return;
    }

    if (airportCardNextSibling && airportCardNextSibling.parentNode === root) {
      airportCardNextSibling.insertAdjacentElement('afterend', expand);
      return;
    }

    root.appendChild(expand);
  }

  function setExpandedState(isOpen) {
    placeExpandForViewport();

    expand.hidden = !isOpen;
    expand.setAttribute('aria-hidden', String(!isOpen));
    airportPanel.hidden = !isOpen;
    airportPanel.setAttribute('aria-hidden', String(!isOpen));

    airportCard.classList.toggle(ACTIVE_CLASS, isOpen);
    expand.classList.toggle(EXPAND_OPEN_CLASS, isOpen);
    airportCard.setAttribute('aria-expanded', String(isOpen));

    setActionLabelI18n(
      isOpen
        ? 'services.cards.airport.ctaOpen'
        : 'services.cards.airport.ctaClosed'
    );
  }

  function toggleAirportExpand() {
    const isOpen = !expand.hidden;
    setExpandedState(!isOpen);
  }

  airportCard.setAttribute('role', 'button');
  airportCard.setAttribute('tabindex', '0');
  airportCard.setAttribute('aria-controls', 'services-expand');
  airportCard.setAttribute('aria-expanded', 'false');

  airportCard.addEventListener('click', toggleAirportExpand);

  airportCard.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleAirportExpand();
    }
  });

  const MOBILE_HINT_CLASS = 'service-card--mobile-hint';
  let mobileHintTimeout = null;
  let mobileHintObserver = null;
  let mobileHintWasVisible = false;

  function clearMobileHint() {
    airportCard.classList.remove(MOBILE_HINT_CLASS);

    if (mobileHintTimeout) {
      window.clearTimeout(mobileHintTimeout);
      mobileHintTimeout = null;
    }
  }

  function triggerMobileHint() {
    if (!mobileQuery.matches || airportCard.classList.contains(ACTIVE_CLASS)) {
      return;
    }

    clearMobileHint();
    airportCard.classList.add(MOBILE_HINT_CLASS);

    mobileHintTimeout = window.setTimeout(() => {
      airportCard.classList.remove(MOBILE_HINT_CLASS);
      mobileHintTimeout = null;
    }, 1400);
  }

  function bindMobileHintObserver() {
    if (!('IntersectionObserver' in window)) return;

    if (mobileHintObserver) {
      mobileHintObserver.disconnect();
      mobileHintObserver = null;
    }

    mobileHintWasVisible = false;

    mobileHintObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;

      if (isVisible && !mobileHintWasVisible) {
        mobileHintWasVisible = true;
        triggerMobileHint();
        return;
      }

      if (!isVisible && mobileHintWasVisible) {
        mobileHintWasVisible = false;
        clearMobileHint();
      }
    }, {
      threshold: [0, 0.55]
    });

    mobileHintObserver.observe(airportCard);
  }

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', () => {
      placeExpandForViewport();
      clearMobileHint();
      bindMobileHintObserver();
    });
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(() => {
      placeExpandForViewport();
      clearMobileHint();
      bindMobileHintObserver();
    });
  }

  placeExpandForViewport();
  setExpandedState(false);
  bindMobileHintObserver();
})();