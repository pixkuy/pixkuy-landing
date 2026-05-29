(function () {
  "use strict";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizePrimaryType(value) {
    return normalizeText(value).toLowerCase();
  }

  function getAcceptedPrimaryTypes() {
    return [];
  }

  function isAcceptedLodgingPrimaryType(primaryType) {
    const normalized = normalizePrimaryType(primaryType);
    if (!normalized) {
      return false;
    }

    return true;
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