/* assets/js/services/mobile-booking-entry.js
   Entrada móvil de reserva.
   Responsabilidad:
   - detectar si el hero móvil ya fue superado
   - exponer estado al CSS mediante atributo en body
*/

(function initMobileBookingEntry(window, document) {
  "use strict";

  const MOBILE_QUERY = "(max-width: 720px)";
  const HERO_SELECTOR = ".screen.hero";
  const HERO_PASSED_ATTR = "data-mobile-booking-entry-hero-passed";

  let isTicking = false;
  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function getHero() {
    return document.querySelector(HERO_SELECTOR);
  }

  function hasMobileHeroPassed() {
    const hero = getHero();
    let rect;

    if (!isMobileViewport()) {
      return false;
    }

    if (!hero || typeof hero.getBoundingClientRect !== "function") {
      return false;
    }

    rect = hero.getBoundingClientRect();

    return rect.bottom <= 0;
  }

  function syncHeroPassedState() {
    document.body.setAttribute(
      HERO_PASSED_ATTR,
      hasMobileHeroPassed() ? "true" : "false"
    );
  }

  function requestSyncHeroPassedState() {
    if (isTicking) {
      return;
    }

    isTicking = true;

    window.requestAnimationFrame(function runSyncHeroPassedState() {
      isTicking = false;
      syncHeroPassedState();
    });
  }

  function init() {
    syncHeroPassedState();

    window.addEventListener("scroll", requestSyncHeroPassedState, { passive: true });
    window.addEventListener("resize", requestSyncHeroPassedState);
    window.addEventListener("pageshow", requestSyncHeroPassedState);

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", requestSyncHeroPassedState);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(requestSyncHeroPassedState);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);