(function () {
  "use strict";

  const UI_VISIBLE_UNTIL = "2026-07-05";
  const PRICE_WINDOW_START = "2026-06-11";
  const PRICE_WINDOW_END = "2026-07-05";
  const PRICE_MULTIPLIER = 1.5;

  function normalizeDateLiteral(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isIsoDateLiteral(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(normalizeDateLiteral(value));
  }

  function getTodayLiteral() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function isDateWithinInclusiveRange(dateLiteral, startLiteral, endLiteral) {
    const safeDate = normalizeDateLiteral(dateLiteral);
    const safeStart = normalizeDateLiteral(startLiteral);
    const safeEnd = normalizeDateLiteral(endLiteral);

    if (
      !isIsoDateLiteral(safeDate) ||
      !isIsoDateLiteral(safeStart) ||
      !isIsoDateLiteral(safeEnd)
    ) {
      return false;
    }

    return safeDate >= safeStart && safeDate <= safeEnd;
  }

  function shouldShowDateFieldInServices(todayLiteral) {
    const safeToday = isIsoDateLiteral(todayLiteral)
      ? normalizeDateLiteral(todayLiteral)
      : getTodayLiteral();

    return safeToday <= UI_VISIBLE_UNTIL;
  }

  function isSpecialPricingDate(serviceDateLiteral) {
    return isDateWithinInclusiveRange(
      serviceDateLiteral,
      PRICE_WINDOW_START,
      PRICE_WINDOW_END
    );
  }

  function applyTemporalPricing(basePrice, serviceDateLiteral) {
    if (typeof basePrice !== "number" || !Number.isFinite(basePrice)) {
      return null;
    }

    if (!isSpecialPricingDate(serviceDateLiteral)) {
      return basePrice;
    }

    return Math.round(basePrice * PRICE_MULTIPLIER);
  }

  window.PixkuyHourlyDailyTemporalPricing = {
    normalizeDateLiteral: normalizeDateLiteral,
    isIsoDateLiteral: isIsoDateLiteral,
    getTodayLiteral: getTodayLiteral,
    isDateWithinInclusiveRange: isDateWithinInclusiveRange,
    shouldShowDateFieldInServices: shouldShowDateFieldInServices,
    isSpecialPricingDate: isSpecialPricingDate,
    applyTemporalPricing: applyTemporalPricing,
    constants: {
      uiVisibleUntil: UI_VISIBLE_UNTIL,
      priceWindowStart: PRICE_WINDOW_START,
      priceWindowEnd: PRICE_WINDOW_END,
      priceMultiplier: PRICE_MULTIPLIER
    }
  };
})();