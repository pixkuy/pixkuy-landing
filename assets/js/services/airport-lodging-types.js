(function () {
  "use strict";

  const ACCEPTED_PRIMARY_TYPES = [
    "hotel",
    "lodging",
    "resort_hotel",
    "extended_stay_hotel",
    "bed_and_breakfast",
    "guest_house",
    "inn"
  ];

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizePrimaryType(value) {
    return normalizeText(value).toLowerCase();
  }

  function getAcceptedPrimaryTypes() {
    return ACCEPTED_PRIMARY_TYPES.slice();
  }

  function isAcceptedLodgingPrimaryType(primaryType) {
    const normalized = normalizePrimaryType(primaryType);
    if (!normalized) {
      return false;
    }

    return ACCEPTED_PRIMARY_TYPES.indexOf(normalized) >= 0;
  }

  function getRejectedReason(primaryType) {
    const normalized = normalizePrimaryType(primaryType);

    if (!normalized) {
      return "missing-primary-type";
    }

    if (isAcceptedLodgingPrimaryType(normalized)) {
      return "";
    }

    return "unsupported-primary-type";
  }

  window.PixkuyAirportLodgingTypes = {
    getAcceptedPrimaryTypes: getAcceptedPrimaryTypes,
    isAcceptedLodgingPrimaryType: isAcceptedLodgingPrimaryType,
    getRejectedReason: getRejectedReason
  };
})();