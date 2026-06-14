(function (window, document) {
  'use strict';

  var GOOGLE_ADS_ID = 'AW-18114199280';
  var GOOGLE_ANALYTICS_ID = 'G-1N23WLB73N';
  var GOOGLE_ADS_LEAD_CONVERSION_SEND_TO = 'AW-18114199280/JkAeCOvxvKEcEPD9wr1D';
  var GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO = 'AW-18114199280/yfbjCPOSl6scEPD9wr1D';
  var GOOGLE_ADS_PAID_RESERVATION_CONVERSION_SEND_TO = 'AW-18114199280/jWSbCK7p1b4cEPD9wr1D';
  var STORAGE_KEY = 'pixkuy_google_ads_consent';
  var LEAD_SUCCESS_SIGNAL_KEY = 'pixkuy_lead_success';
  var LEAD_CONVERSION_STORAGE_KEY = 'pixkuy_google_ads_lead_conversion';
  var PAID_RESERVATION_CONVERSION_STORAGE_KEY = 'pixkuy_google_ads_paid_reservation_conversion';
  var ENHANCED_CONVERSION_DATA_STORAGE_KEY = 'pixkuy_google_ads_enhanced_conversion_data';
  var BANNER_ID = 'pixkuy-google-ads-consent';
  var ACCEPTED = 'accepted';
  var REJECTED = 'rejected';

  function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

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

  function hasLeadSuccessParam() {
    var params;

    try {
      params = new URLSearchParams(window.location.search);
      return params.get('lead') === 'ok';
    } catch (error) {
      return false;
    }
  }

  function hasLeadSuccessSignal() {
    try {
      return window.sessionStorage.getItem(LEAD_SUCCESS_SIGNAL_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function clearLeadSuccessSignal() {
    try {
      window.sessionStorage.removeItem(LEAD_SUCCESS_SIGNAL_KEY);
    } catch (error) {
      // no-op
    }
  }

  function hasLeadSuccess() {
    return hasLeadSuccessParam() || hasLeadSuccessSignal();
  }

  function getLeadConversionKey() {
    return [
      LEAD_CONVERSION_STORAGE_KEY,
      window.location.pathname,
      window.location.search
    ].join(':');
  }

  function hasTrackedLeadConversion() {
    try {
      return window.sessionStorage.getItem(getLeadConversionKey()) === '1';
    } catch (error) {
      return false;
    }
  }

  function markLeadConversionTracked() {
    try {
      window.sessionStorage.setItem(getLeadConversionKey(), '1');
    } catch (error) {
      // no-op
    }
  }
  
    function getEnhancedConversionData() {
    var raw;
    var parsed;

    try {
      raw = window.sessionStorage.getItem(ENHANCED_CONVERSION_DATA_STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      email: typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '',
      phone_number: typeof parsed.phone_number === 'string' ? parsed.phone_number.trim() : '',
      first_name: typeof parsed.first_name === 'string' ? parsed.first_name.trim() : '',
      last_name: typeof parsed.last_name === 'string' ? parsed.last_name.trim() : ''
    };
  }

  function hasEnhancedConversionData(data) {
    return Boolean(
      data &&
      (
        data.email ||
        data.phone_number ||
        data.first_name ||
        data.last_name
      )
    );
  }

  function clearEnhancedConversionData() {
    try {
      window.sessionStorage.removeItem(ENHANCED_CONVERSION_DATA_STORAGE_KEY);
    } catch (error) {
      // no-op
    }
  }

  function applyEnhancedConversionData() {
    var data = getEnhancedConversionData();
    var userData;

    if (!hasEnhancedConversionData(data)) {
      return false;
    }

    userData = {};

    if (data.email) {
      userData.email = data.email;
    }

    if (data.phone_number) {
      userData.phone_number = data.phone_number;
    }

    if (data.first_name || data.last_name) {
      userData.address = {};

      if (data.first_name) {
        userData.address.first_name = data.first_name;
      }

      if (data.last_name) {
        userData.address.last_name = data.last_name;
      }
    }

    window.gtag('set', 'user_data', userData);

    return true;
  }

  function trackLeadConversionIfNeeded() {
    if (!hasLeadSuccess()) {
      return;
    }

    if (hasTrackedLeadConversion()) {
      clearLeadSuccessSignal();
      clearEnhancedConversionData();
      return;
    }

    ensureGtagBase();
    applyEnhancedConversionData();

    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_LEAD_CONVERSION_SEND_TO
    });

    markLeadConversionTracked();
    clearLeadSuccessSignal();
    clearEnhancedConversionData();
  }
  
    function trackWhatsappConversion() {
    if (getStoredConsent() !== ACCEPTED) {
      return false;
    }

    ensureGtagBase();

    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO,
      value: 1.0,
      currency: 'EUR'
    });

    return true;
  }
  
    function normalizeConversionValue(value) {
    var parsed;

    if (typeof value === 'number') {
      parsed = value;
    } else if (typeof value === 'string') {
      parsed = Number(value.trim().replace(',', '.'));
    } else {
      parsed = NaN;
    }

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed * 100) / 100;
  }

  function normalizeConversionCurrency(value) {
    var currency = normalizeText(value).toUpperCase();

    return /^[A-Z]{3}$/.test(currency) ? currency : '';
  }

  function getPaidReservationConversionKey(transactionId) {
    return [
      PAID_RESERVATION_CONVERSION_STORAGE_KEY,
      GOOGLE_ADS_PAID_RESERVATION_CONVERSION_SEND_TO,
      transactionId
    ].join(':');
  }

  function hasTrackedPaidReservationConversion(transactionId) {
    if (!transactionId) {
      return false;
    }

    try {
      return window.sessionStorage.getItem(getPaidReservationConversionKey(transactionId)) === '1';
    } catch (error) {
      return false;
    }
  }

  function markPaidReservationConversionTracked(transactionId) {
    if (!transactionId) {
      return false;
    }

    try {
      window.sessionStorage.setItem(getPaidReservationConversionKey(transactionId), '1');
      return true;
    } catch (error) {
      return false;
    }
  }

  function trackPaidReservationConversion(input) {
    var conversion = input && typeof input === 'object' ? input : {};
    var transactionId = normalizeText(conversion.transaction_id || conversion.transactionId);
    var value = normalizeConversionValue(conversion.value);
    var currency = normalizeConversionCurrency(conversion.currency);

    if (
      getStoredConsent() !== ACCEPTED ||
      !transactionId ||
      value === null ||
      !currency ||
      hasTrackedPaidReservationConversion(transactionId)
    ) {
      return false;
    }

    ensureGtagBase();

    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_PAID_RESERVATION_CONVERSION_SEND_TO,
      value: value,
      currency: currency,
      transaction_id: transactionId
    });

    markPaidReservationConversionTracked(transactionId);
    return true;
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
    window.gtag('config', GOOGLE_ANALYTICS_ID);

    window.dispatchEvent(
      new CustomEvent('pixkuy:analytics-consent-ready', {
        detail: {
          source: 'google_ads_consent',
          status: ACCEPTED
        }
      })
    );
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
        trackLeadConversionIfNeeded();
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
  
  function bindWhatsappConversionTracking() {
    if (document.documentElement.dataset.googleAdsWhatsappTrackingBound === '1') {
      return false;
    }

    document.addEventListener('click', function (event) {
      var link = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('[data-contact-whatsapp="1"]')
        : null;

      if (!link) {
        return;
      }

      trackWhatsappConversion();
    }, true);

    document.documentElement.dataset.googleAdsWhatsappTrackingBound = '1';
    return true;
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
    bindWhatsappConversionTracking();

    if (stored === ACCEPTED) {
      loadGoogleAdsTag();
      trackLeadConversionIfNeeded();
      return;
    }

    if (stored === REJECTED) {
      return;
    }

    showBanner();
  }

  window.PixkuyGoogleAdsConversions = Object.assign(
    {},
    window.PixkuyGoogleAdsConversions && typeof window.PixkuyGoogleAdsConversions === 'object'
      ? window.PixkuyGoogleAdsConversions
      : {},
    {
      trackPaidReservationConversion: trackPaidReservationConversion
    }
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);