(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'pixkuy_campaign_attribution';

  var PARAM_TO_FIELD = {
    gclid: 'campaign_gclid',
    utm_source: 'campaign_utm_source',
    utm_medium: 'campaign_utm_medium',
    utm_campaign: 'campaign_utm_campaign',
    utm_term: 'campaign_utm_term',
    utm_content: 'campaign_utm_content'
  };

  function getReservationForm() {
    return document.querySelector('form[name="contact"]');
  }

  function safeTrim(value) {
    return String(value || '').trim();
  }

  function getCurrentAttributionFromUrl() {
    var params;
    var data;
    var hasCampaignValue;

    try {
      params = new URLSearchParams(window.location.search || '');
    } catch (error) {
      return null;
    }

    data = {};
    hasCampaignValue = false;

    Object.keys(PARAM_TO_FIELD).forEach(function (paramName) {
      var value = safeTrim(params.get(paramName));

      if (value) {
        data[PARAM_TO_FIELD[paramName]] = value;
        hasCampaignValue = true;
      }
    });

    if (!hasCampaignValue) {
      return null;
    }

    data.campaign_landing_url = window.location.href || '';
    data.campaign_referrer = document.referrer || '';
    data.captured_at = new Date().toISOString();

    return data;
  }

  function readStoredAttribution() {
    var raw;

    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function storeAttribution(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveAttribution() {
    var fromUrl = getCurrentAttributionFromUrl();

    if (fromUrl) {
      storeAttribution(fromUrl);
      return fromUrl;
    }

    return readStoredAttribution();
  }

  function setHiddenValue(form, fieldName, value) {
    var field;

    if (!form || !fieldName) {
      return false;
    }

    field = form.querySelector('input[name="' + fieldName + '"]');

    if (!field) {
      return false;
    }

    field.value = safeTrim(value);
    return true;
  }

  function applyAttributionToForm(form, attribution) {
    if (!form || !attribution || typeof attribution !== 'object') {
      return false;
    }

    Object.keys(PARAM_TO_FIELD).forEach(function (paramName) {
      var fieldName = PARAM_TO_FIELD[paramName];
      setHiddenValue(form, fieldName, attribution[fieldName]);
    });

    setHiddenValue(form, 'campaign_landing_url', attribution.campaign_landing_url);
    setHiddenValue(form, 'campaign_referrer', attribution.campaign_referrer);

    return true;
  }

  function initCampaignAttribution() {
    var form = getReservationForm();
    var attribution = resolveAttribution();

    if (!form || !attribution) {
      return false;
    }

    return applyAttributionToForm(form, attribution);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCampaignAttribution);
  } else {
    initCampaignAttribution();
  }

  window.PixkuyCampaignAttribution = {
    init: initCampaignAttribution,
    resolve: resolveAttribution
  };
})(window, document);