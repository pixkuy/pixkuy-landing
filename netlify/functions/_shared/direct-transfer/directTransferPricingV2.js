const VALID_PASSENGER_KEYS = new Set(["van_1_2", "van_3_4", "van_5_6"]);

const STANDARD_PRICING = {
  currency: "MXN",
  roundingStep: 50,
  baseFee: 125,
  kmRate: 6.9,
  minuteRate: 4.25,
  minimum: 150,
  referenceMinutesPerKm: 2.35,
  congestionSoftCapMinutes: 18,
  capacityPremiums: {
    van_1_2: {
      minimum: 150
    },
    van_3_4: {
      minimum: 200
    },
    van_5_6: {
      minimum: 300
    }
  }
};

const PRICING_V2 = {
  currency: "MXN",
  roundingStep: 50,
  slowdownReferenceMinutesPerKm: 0.85,
  longTailStartKm: 270,
  distanceStressStartKm: 90,
  distanceStressSpanKm: 220,
  market: {
    baseKmRate: 14.6,
    decayKmRate: 5.0,
    decayDistanceKm: 300,
    slowdownRate: 15,
    longTailRate: 21,
    van_3_4: {
      baseMultiplier: 1.37,
      stressMultiplier: 0.08
    },
    van_5_6: {
      baseMultiplier: 1.78,
      stressMultiplier: 0.17
    }
  },
  technicalFloor: {
    baseFee: 125,
    kmRate: 6.9,
    minuteRate: 4.25,
    capacityMinimums: {
      van_1_2: 150,
      van_3_4: 200,
      van_5_6: 300
    }
  }
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(value) {
  const number = toFiniteNumber(value);

  return number !== null && number > 0 ? number : null;
}

function roundToDecimals(value, decimals) {
  const number = Number(value);
  const factor = Math.pow(10, Number(decimals) || 0);

  if (!Number.isFinite(number) || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }

  return Math.round(number * factor) / factor;
}

function getRoundingStep(step) {
  const safeStep = Number(step);

  return Number.isFinite(safeStep) && safeStep > 0
    ? safeStep
    : PRICING_V2.roundingStep;
}

function ceilToStep(value, step) {
  const number = Number(value);
  const safeStep = getRoundingStep(step);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.ceil(number / safeStep) * safeStep;
}

function floorToStep(value, step) {
  const number = Number(value);
  const safeStep = getRoundingStep(step);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.floor(number / safeStep) * safeStep;
}

function clamp(value, min, max) {
  const number = Number(value);
  const minValue = Number(min);
  const maxValue = Number(max);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue > maxValue) {
    return number;
  }

  return Math.min(Math.max(number, minValue), maxValue);
}

function smoothstep(value) {
  const number = clamp(value, 0, 1);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number * number * (3 - (2 * number));
}

function getPassengerFareKey(value) {
  const passengerFareKey = normalizeText(value);

  return VALID_PASSENGER_KEYS.has(passengerFareKey) ? passengerFareKey : "";
}

function getDistanceKm(distanceMeters) {
  const meters = toPositiveNumber(distanceMeters);

  return meters === null ? null : meters / 1000;
}

function getDurationMinutes(durationSeconds) {
  const seconds = toPositiveNumber(durationSeconds);

  return seconds === null ? null : seconds / 60;
}

function calculateSlowdownMinutes(distanceKm, durationMinutes) {
  const referenceMinutes = distanceKm * PRICING_V2.slowdownReferenceMinutesPerKm;

  return Math.max(0, durationMinutes - referenceMinutes);
}

function calculateLongTailKm(distanceKm) {
  return Math.max(0, distanceKm - PRICING_V2.longTailStartKm);
}

function calculateDistanceStress(distanceKm) {
  const rawStress =
    (distanceKm - PRICING_V2.distanceStressStartKm) /
    PRICING_V2.distanceStressSpanKm;

  return smoothstep(clamp(rawStress, 0, 1));
}

function calculateMarketOneTwoPrice(input) {
  const distanceKm = Number(input.distanceKm);
  const durationMinutes = Number(input.durationMinutes);
  const slowdownMinutes = calculateSlowdownMinutes(distanceKm, durationMinutes);
  const longTailKm = calculateLongTailKm(distanceKm);
  const market = PRICING_V2.market;
  const distanceRate =
    market.baseKmRate +
    (market.decayKmRate * Math.exp(-distanceKm / market.decayDistanceKm));

  return {
    marketRaw:
      (distanceKm * distanceRate) +
      (market.slowdownRate * slowdownMinutes) +
      (market.longTailRate * longTailKm),
    distanceRate,
    slowdownMinutes,
    longTailKm
  };
}

function calculateMarketPrice(input) {
  const passengerFareKey = getPassengerFareKey(input.passengerFareKey);
  const oneTwo = calculateMarketOneTwoPrice(input);
  const distanceStress = calculateDistanceStress(input.distanceKm);
  let multiplier = 1;

  if (!passengerFareKey || !Number.isFinite(oneTwo.marketRaw) || !Number.isFinite(distanceStress)) {
    return null;
  }

  if (passengerFareKey === "van_3_4") {
    multiplier =
      PRICING_V2.market.van_3_4.baseMultiplier +
      (PRICING_V2.market.van_3_4.stressMultiplier * distanceStress);
  }

  if (passengerFareKey === "van_5_6") {
    multiplier =
      PRICING_V2.market.van_5_6.baseMultiplier +
      (PRICING_V2.market.van_5_6.stressMultiplier * distanceStress);
  }

  return {
    marketRaw: oneTwo.marketRaw * multiplier,
    marketOneTwoRaw: oneTwo.marketRaw,
    passengerMultiplier: multiplier,
    distanceRate: oneTwo.distanceRate,
    slowdownMinutes: oneTwo.slowdownMinutes,
    longTailKm: oneTwo.longTailKm,
    distanceStress
  };
}

function calculateTechnicalFloor(input) {
  const passengerFareKey = getPassengerFareKey(input.passengerFareKey);
  const distanceKm = Number(input.distanceKm);
  const durationMinutes = Number(input.durationMinutes);
  const capacityMinimum =
    PRICING_V2.technicalFloor.capacityMinimums[passengerFareKey];

  if (
    !passengerFareKey ||
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(durationMinutes) ||
    !Number.isFinite(capacityMinimum)
  ) {
    return null;
  }

  const technicalRaw =
    PRICING_V2.technicalFloor.baseFee +
    (distanceKm * PRICING_V2.technicalFloor.kmRate) +
    (durationMinutes * PRICING_V2.technicalFloor.minuteRate);

  return {
    technicalFloor: Math.max(technicalRaw, capacityMinimum),
    technicalRaw,
    capacityMinimum
  };
}

function calculateStandardPricing(input) {
  const passengerFareKey = getPassengerFareKey(input.passengerFareKey);
  const distanceKm = Number(input.distanceKm);
  const durationMinutes = Number(input.durationMinutes);
  const roundingStep = getRoundingStep(input.roundingStep);
  const airportCeiling = normalizeAirportCeiling(input.airportCeiling, roundingStep);
  const capacityPricing = STANDARD_PRICING.capacityPremiums[passengerFareKey];

  if (
    !passengerFareKey ||
    !capacityPricing ||
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(durationMinutes)
  ) {
    return null;
  }

  const referenceMinutes = distanceKm * STANDARD_PRICING.referenceMinutesPerKm;
  const structuralMinutes = Math.min(durationMinutes, referenceMinutes);
  const congestionMinutes = Math.max(0, durationMinutes - referenceMinutes);
  const softenedCongestionMinutes = STANDARD_PRICING.congestionSoftCapMinutes *
    (1 - Math.exp(-congestionMinutes / STANDARD_PRICING.congestionSoftCapMinutes));
  const effectiveMinutes = structuralMinutes + softenedCongestionMinutes;

  const baseRaw =
    STANDARD_PRICING.baseFee +
    (distanceKm * STANDARD_PRICING.kmRate) +
    (effectiveMinutes * STANDARD_PRICING.minuteRate);

  const congestionStress = congestionMinutes / (congestionMinutes + 14);
  const fareScale = 1 - Math.exp(-baseRaw / 650);
  const congestionSignal = smoothstep(congestionStress);
  const fareSignal = smoothstep(fareScale);

  if (!Number.isFinite(congestionSignal) || !Number.isFinite(fareSignal)) {
    return null;
  }

  const marketStress = clamp(
    (0.78 * congestionSignal) + (0.22 * fareSignal),
    0,
    1
  );

  if (!Number.isFinite(marketStress)) {
    return null;
  }

  const premiumFiveSix = clamp(
    105 + (110 * Math.pow(marketStress, 0.85)),
    115,
    225
  );
  const premiumThreeFour = clamp(
    25 + (0.26 * premiumFiveSix),
    45,
    85
  );

  if (!Number.isFinite(premiumFiveSix) || !Number.isFinite(premiumThreeFour)) {
    return null;
  }

  let capacityPremium = 0;

  if (passengerFareKey === "van_3_4") {
    capacityPremium = premiumThreeFour;
  }

  if (passengerFareKey === "van_5_6") {
    capacityPremium = premiumFiveSix;
  }

  const rawBeforeCeiling = Math.max(
    baseRaw + capacityPremium,
    capacityPricing.minimum
  );
  const rawAfterCeiling = airportCeiling !== null
    ? Math.min(rawBeforeCeiling, airportCeiling)
    : rawBeforeCeiling;
  const airportCeilingApplied = airportCeiling !== null && rawAfterCeiling < rawBeforeCeiling;
  const price = airportCeilingApplied
    ? floorToStep(rawAfterCeiling, roundingStep)
    : ceilToStep(rawAfterCeiling, roundingStep);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    price,
    currency: STANDARD_PRICING.currency,
    passengerFareKey,
    pricingMode: "standard",
    pricingModel: "standard_legacy",
    roundingStep,
    distanceKm: roundToDecimals(distanceKm, 3),
    durationMinutes: roundToDecimals(durationMinutes, 2),
    baseFee: STANDARD_PRICING.baseFee,
    kmRate: STANDARD_PRICING.kmRate,
    minuteRate: STANDARD_PRICING.minuteRate,
    minimum: capacityPricing.minimum,
    referenceMinutes: roundToDecimals(referenceMinutes, 2),
    congestionMinutes: roundToDecimals(congestionMinutes, 2),
    softenedCongestionMinutes: roundToDecimals(softenedCongestionMinutes, 2),
    effectiveMinutes: roundToDecimals(effectiveMinutes, 2),
    capacityPremium: roundToDecimals(capacityPremium, 2),
    marketStress: roundToDecimals(marketStress, 3),
    baseRaw: roundToDecimals(baseRaw, 2),
    rawBeforeCeiling: roundToDecimals(rawBeforeCeiling, 2),
    rawAfterCeiling: roundToDecimals(rawAfterCeiling, 2),
    airportCeiling,
    airportCeilingApplied,
    technicalFloorBreachedByCeiling: false
  };
}

function normalizeAirportCeiling(value, roundingStep) {
  const ceiling = toPositiveNumber(value);

  if (ceiling === null) {
    return null;
  }

  const roundedCeiling = floorToStep(ceiling, roundingStep);

  return roundedCeiling && roundedCeiling > 0 ? roundedCeiling : null;
}

function calculateDirectTransferPricingV2(options) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const passengerFareKey = getPassengerFareKey(safeOptions.passengerFareKey);
  const pricingMode = normalizeText(safeOptions.pricingMode);
  const distanceKm = getDistanceKm(safeOptions.distanceMeters);
  const durationMinutes = getDurationMinutes(safeOptions.durationSeconds);
  const roundingStep = getRoundingStep(safeOptions.roundingStep);
  const airportCeiling = normalizeAirportCeiling(
    safeOptions.airportCeiling,
    roundingStep
  );

  if (!passengerFareKey || !pricingMode || distanceKm === null || durationMinutes === null) {
    return null;
  }

  if (pricingMode === "standard") {
    return calculateStandardPricing({
      distanceKm,
      durationMinutes,
      passengerFareKey,
      airportCeiling,
      roundingStep
    });
  }

  const market = calculateMarketPrice({
    distanceKm,
    durationMinutes,
    passengerFareKey
  });
  const technical = calculateTechnicalFloor({
    distanceKm,
    durationMinutes,
    passengerFareKey
  });

  if (!market || !technical) {
    return null;
  }

  const rawBeforeCeiling = Math.max(market.marketRaw, technical.technicalFloor);
  const rawAfterCeiling = airportCeiling !== null
    ? Math.min(rawBeforeCeiling, airportCeiling)
    : rawBeforeCeiling;
  const airportCeilingApplied = airportCeiling !== null && rawAfterCeiling < rawBeforeCeiling;
  const price = airportCeilingApplied
    ? floorToStep(rawAfterCeiling, roundingStep)
    : ceilToStep(rawAfterCeiling, roundingStep);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    price,
    currency: PRICING_V2.currency,
    passengerFareKey,
    pricingMode,
    pricingModel: "extended_v2",
    roundingStep,
    distanceKm: roundToDecimals(distanceKm, 3),
    durationMinutes: roundToDecimals(durationMinutes, 2),
    marketRaw: roundToDecimals(market.marketRaw, 2),
    marketOneTwoRaw: roundToDecimals(market.marketOneTwoRaw, 2),
    technicalFloor: roundToDecimals(technical.technicalFloor, 2),
    technicalRaw: roundToDecimals(technical.technicalRaw, 2),
    capacityMinimum: technical.capacityMinimum,
    rawBeforeCeiling: roundToDecimals(rawBeforeCeiling, 2),
    rawAfterCeiling: roundToDecimals(rawAfterCeiling, 2),
    airportCeiling,
    airportCeilingApplied,
    technicalFloorBreachedByCeiling:
      airportCeilingApplied && technical.technicalFloor > airportCeiling,
    passengerMultiplier: roundToDecimals(market.passengerMultiplier, 4),
    distanceRate: roundToDecimals(market.distanceRate, 4),
    slowdownMinutes: roundToDecimals(market.slowdownMinutes, 2),
    longTailKm: roundToDecimals(market.longTailKm, 3),
    distanceStress: roundToDecimals(market.distanceStress, 4)
  };
}

module.exports = {
  STANDARD_PRICING,
  PRICING_V2,
  VALID_PASSENGER_KEYS,
  ceilToStep,
  floorToStep,
  smoothstep,
  calculateMarketPrice,
  calculateTechnicalFloor,
  calculateStandardPricing,
  calculateDirectTransferPricingV2
};