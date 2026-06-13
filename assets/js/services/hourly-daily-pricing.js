/* assets/js/services/hourly-daily-pricing.js
   Hourly / Daily pricing policy.
   Responsabilidad:
   - exponer una única fuente de verdad de pricing Hourly Launch V2 para landing
   - evitar duplicación entre panel desktop, contacto y flujo móvil
   - no consultar Booking API
   - no aplicar multiplicadores temporales
*/

(function initHourlyDailyPricing(window) {
  "use strict";

  if (!window) {
    return;
  }

  const MODES = Object.freeze({
    HOURLY: "hourly",
    FULL_DAY: "full_day",
    LONG_TERM: "custom_long_term"
  });

  const CURRENCY = "MXN";
  const FULL_DAY_HOURS = 12;
  const KM_INCLUDED_PER_HOUR = 40;
  const EXTRA_KM_PRICE = 35;
  const OUT_OF_ZONE_SUPPLEMENT = 4500;
  const UNPLANNED_EXTENSION_HOUR_PRICE = 1000;

  const HOURLY_TIERS = Object.freeze([
    Object.freeze({ durationHours: 2, price: 1500 }),
    Object.freeze({ durationHours: 3, price: 2000 }),
    Object.freeze({ durationHours: 4, price: 2500 }),
    Object.freeze({ durationHours: 5, price: 3000 }),
    Object.freeze({ durationHours: 6, price: 3500 }),
    Object.freeze({ durationHours: 7, price: 4000 }),
    Object.freeze({ durationHours: 8, price: 4500 }),
    Object.freeze({ durationHours: 9, price: 5000 }),
    Object.freeze({ durationHours: 10, price: 5400 }),
    Object.freeze({ durationHours: 11, price: 5700 }),
    Object.freeze({ durationHours: 12, price: 6000 })
  ]);

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function parsePositiveInteger(value) {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeMode(value) {
    const mode = normalizeText(value);

    if (
      mode === MODES.HOURLY ||
      mode === MODES.FULL_DAY ||
      mode === MODES.LONG_TERM
    ) {
      return mode;
    }

    return "";
  }

  function getDurationOptions() {
    return HOURLY_TIERS.map(function mapTier(tier) {
      return tier.durationHours;
    });
  }

  function getHourlyTier(durationHours) {
    const safeDurationHours = parsePositiveInteger(durationHours);

    if (!safeDurationHours) {
      return null;
    }

    return HOURLY_TIERS.find(function findTier(tier) {
      return tier.durationHours === safeDurationHours;
    }) || null;
  }

  function getEffectiveDurationHours(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const mode = normalizeMode(safeInput.mode);

    if (mode === MODES.FULL_DAY) {
      return FULL_DAY_HOURS;
    }

    if (mode !== MODES.HOURLY) {
      return null;
    }

    const tier = getHourlyTier(safeInput.durationHours);

    return tier ? tier.durationHours : null;
  }

  function getPrice(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const mode = normalizeMode(safeInput.mode);

    if (mode === MODES.LONG_TERM) {
      return null;
    }

    if (mode === MODES.FULL_DAY) {
      return getHourlyTier(FULL_DAY_HOURS).price;
    }

    if (mode !== MODES.HOURLY) {
      return null;
    }

    const tier = getHourlyTier(safeInput.durationHours);

    return tier ? tier.price : null;
  }

  function getIncludedKilometers(input) {
    const effectiveDurationHours = getEffectiveDurationHours(input);

    return effectiveDurationHours
      ? effectiveDurationHours * KM_INCLUDED_PER_HOUR
      : null;
  }

  function isTransactionalMode(mode) {
    const safeMode = normalizeMode(mode);

    return safeMode === MODES.HOURLY || safeMode === MODES.FULL_DAY;
  }

  window.PixkuyHourlyDailyPricing = {
    modes: MODES,
    constants: Object.freeze({
      currency: CURRENCY,
      fullDayHours: FULL_DAY_HOURS,
      kmIncludedPerHour: KM_INCLUDED_PER_HOUR,
      extraKmPrice: EXTRA_KM_PRICE,
      outOfZoneSupplement: OUT_OF_ZONE_SUPPLEMENT,
      unplannedExtensionHourPrice: UNPLANNED_EXTENSION_HOUR_PRICE
    }),
    getDurationOptions: getDurationOptions,
    getEffectiveDurationHours: getEffectiveDurationHours,
    getIncludedKilometers: getIncludedKilometers,
    getPrice: getPrice,
    isTransactionalMode: isTransactionalMode
  };
})(window);