(function (window, document) {
  'use strict';

  var GOOGLE_ADS_ID = 'AW-18114199280';
  var STORAGE_KEY = 'pixkuy_google_ads_consent';
  var BANNER_ID = 'pixkuy-google-ads-consent';
  var ACCEPTED = 'accepted';
  var REJECTED = 'rejected';

  function getI18nValue(path) {
    var dict = window.__pixkuyI18nDict;
    var parts;
    var value;
    var i;

    if (!dict || !path) {
      return '';
    }

    parts = String(path).split('.');
    value = dict;

    for (i = 0; i < parts.length; i += 1) {
      if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, parts[i])) {
        return '';
      }

      value = value[parts[i]];
    }

    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  function getStoredConsent() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function storeConsent(status) {
    try {
      window.localStorage.setItem(STORAGE_KEY, status);
    } catch (error) {
      // no-op
    }
  }

  function ensureGtagBase() {
    window.dataLayer = window.dataLayer || [];

    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
  }

  function loadGoogleAdsTag() {
    var existingScript;

    ensureGtagBase();

    existingScript = document.querySelector('script[data-google-ads-consent-tag="1"]');

    if (!existingScript) {
      existingScript = document.createElement('script');
      existingScript.async = true;
      existingScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GOOGLE_ADS_ID);
      existingScript.setAttribute('data-google-ads-consent-tag', '1');
      document.head.appendChild(existingScript);
    }

    window.gtag('js', new Date());
    window.gtag('config', GOOGLE_ADS_ID);
  }

  function removeBanner() {
    var banner = document.getElementById(BANNER_ID);

    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  function setText(root, selector, value) {
    var node = root.querySelector(selector);

    if (node) {
      node.textContent = value;
    }
  }

  function getBannerCopy() {
    return {
      ariaLabel: getI18nValue('consent.googleAds.ariaLabel'),
      title: getI18nValue('consent.googleAds.title'),
      text: getI18nValue('consent.googleAds.text'),
      reject: getI18nValue('consent.googleAds.reject'),
      accept: getI18nValue('consent.googleAds.accept')
    };
  }

  function hasCompleteBannerCopy(copy) {
    return !!(
      copy &&
      copy.ariaLabel &&
      copy.title &&
      copy.text &&
      copy.reject &&
      copy.accept
    );
  }

  function syncBannerCopy(banner) {
    var copy = getBannerCopy();

    if (!banner || !hasCompleteBannerCopy(copy)) {
      return false;
    }

    banner.setAttribute('aria-label', copy.ariaLabel);
    setText(banner, '[data-consent-title]', copy.title);
    setText(banner, '[data-consent-text]', copy.text);
    setText(banner, '[data-consent-reject]', copy.reject);
    setText(banner, '[data-consent-accept]', copy.accept);

    return true;
  }

  function buildBanner() {
    var banner = document.createElement('section');

    banner.id = BANNER_ID;
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML = [
      '<div class="consent-banner__content">',
      '  <p class="consent-banner__title" data-consent-title></p>',
      '  <p class="consent-banner__text" data-consent-text></p>',
      '</div>',
      '<div class="consent-banner__actions">',
      '  <button type="button" class="consent-banner__button consent-banner__button--secondary" data-consent-reject></button>',
      '  <button type="button" class="consent-banner__button consent-banner__button--primary" data-consent-accept></button>',
      '</div>'
    ].join('');

    if (!syncBannerCopy(banner)) {
      return null;
    }

    return banner;
  }

  function bindBanner(banner) {
    var accept = banner.querySelector('[data-consent-accept]');
    var reject = banner.querySelector('[data-consent-reject]');

    if (accept) {
      accept.addEventListener('click', function () {
        storeConsent(ACCEPTED);
        loadGoogleAdsTag();
        removeBanner();
      });
    }

    if (reject) {
      reject.addEventListener('click', function () {
        storeConsent(REJECTED);
        removeBanner();
      });
    }
  }

  function showBanner() {
    var banner;

    if (document.getElementById(BANNER_ID)) {
      return;
    }

    banner = buildBanner();

    if (!banner) {
      return;
    }

    bindBanner(banner);
    document.body.appendChild(banner);
  }

  function isMobileViewport() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia('(max-width: 720px)').matches
    );
  }

  function isDesktopViewport() {
    return !isMobileViewport();
  }

  function bindI18nRefresh() {
    window.addEventListener('pixkuy:i18n-applied', function () {
      var banner = document.getElementById(BANNER_ID);
      var stored = getStoredConsent();

      if (stored === ACCEPTED || stored === REJECTED) {
        return;
      }

      if (banner) {
        syncBannerCopy(banner);
        return;
      }

      if (isMobileViewport()) {
        showBanner();
        return;
      }

      if (isDesktopViewport()) {
        showBanner();
      }
    });
  }

  function init() {
    var stored = getStoredConsent();

    bindI18nRefresh();

    if (stored === ACCEPTED) {
      loadGoogleAdsTag();
      return;
    }

    if (stored === REJECTED) {
      return;
    }

    showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);