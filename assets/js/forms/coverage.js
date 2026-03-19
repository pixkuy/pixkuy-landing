(function (window) {
  'use strict';

  var NAMESPACE = window.PixkuyForms = window.PixkuyForms || {};

  var COVERAGE = {
    mexicoCountryCodes: ['mx', 'mex'],
    allowedPrimaryAdministrativeAreas: [
      'ciudad de mexico',
      'cdmx',
      'mexico city',
      'distrito federal',
      'estado de mexico',      
      'estado de méxico',
      'edomex'
    ],
    allowedAirportIataCodes: [
      'MEX',
      'NLU',
      'TLC',
      'PBC',
      'QRO'
    ],
    allowedAirportKeywords: [
      'aeropuerto internacional de la ciudad de mexico',
      'aeropuerto internacional de la ciudad de méxico',
      'benito juarez international airport',
      'benito juárez international airport',
      'aicm',
      'mex',

      'aeropuerto internacional felipe angeles',
      'aeropuerto internacional felipe ángeles',
      'felipe angeles international airport',
      'felipe ángeles international airport',
      'aifa',
      'nlu',

      'aeropuerto internacional de toluca',
      'toluca international airport',
      'licenciado adolfo lopez mateos international airport',
      'licenciado adolfo lópez mateos international airport',
      'tlc',

      'aeropuerto internacional de puebla',
      'puebla international airport',
      'hermanos serdan international airport',
      'hermanos serdán international airport',
      'pbc',

      'aeropuerto intercontinental de queretaro',
      'aeropuerto intercontinental de querétaro',
      'queretaro intercontinental airport',
      'querétaro intercontinental airport',
      'qro'
    ]
  };

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function includesNormalized(haystack, needle) {
    return normalizeText(haystack).indexOf(normalizeText(needle)) !== -1;
  }

  function someIncludesNormalized(text, candidates) {
    var index;

    if (!isNonEmptyString(text) || !Array.isArray(candidates) || !candidates.length) {
      return false;
    }

    for (index = 0; index < candidates.length; index += 1) {
      if (includesNormalized(text, candidates[index])) {
        return true;
      }
    }

    return false;
  }

  function getArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getString(value) {
    return isNonEmptyString(value) ? value.trim() : '';
  }

  function getPlaceTextTokens(place) {
    var tokens = [];
    var addressComponents;
    var index;
    var component;
    var shortText;
    var longText;

    if (!place || typeof place !== 'object') {
      return tokens;
    }

    tokens.push(getString(place.label));
    tokens.push(getString(place.displayName));
    tokens.push(getString(place.formattedAddress));
    tokens.push(getString(place.primaryText));
    tokens.push(getString(place.secondaryText));
    tokens.push(getString(place.text));
    tokens.push(getString(place.address));
    tokens.push(getString(place.regionCode));
    tokens.push(getString(place.countryCode));
    tokens.push(getString(place.locality));
    tokens.push(getString(place.administrativeAreaLevel1));
    tokens.push(getString(place.administrativeAreaLevel2));
    tokens.push(getString(place.placeId));
    tokens.push(getString(place.iataCode));

    addressComponents = getArray(place.addressComponents);

    for (index = 0; index < addressComponents.length; index += 1) {
      component = addressComponents[index] || {};
      shortText = getString(component.shortText || component.short_name);
      longText = getString(component.longText || component.long_name);

      tokens.push(shortText);
      tokens.push(longText);
    }

    return tokens.filter(Boolean);
  }

  function getCombinedPlaceText(place) {
    return getPlaceTextTokens(place).join(' | ');
  }

  function getPlaceTypes(place) {
    var types = getArray(place && place.types);
    return types.map(normalizeText).filter(Boolean);
  }

  function hasAnyType(place, allowedTypes) {
    var placeTypes;
    var index;

    placeTypes = getPlaceTypes(place);

    if (!placeTypes.length || !Array.isArray(allowedTypes) || !allowedTypes.length) {
      return false;
    }

    for (index = 0; index < allowedTypes.length; index += 1) {
      if (placeTypes.indexOf(normalizeText(allowedTypes[index])) !== -1) {
        return true;
      }
    }

    return false;
  }

  function getCountryCode(place) {
    var countryCode;
    var addressComponents;
    var index;
    var component;
    var componentTypes;

    countryCode = normalizeText(place && (place.countryCode || place.regionCode));

    if (countryCode) {
      return countryCode;
    }

    addressComponents = getArray(place && place.addressComponents);

    for (index = 0; index < addressComponents.length; index += 1) {
      component = addressComponents[index] || {};
      componentTypes = getArray(component.types).map(normalizeText);

      if (componentTypes.indexOf('country') !== -1) {
        countryCode = normalizeText(component.shortText || component.short_name || component.longText || component.long_name);
        if (countryCode) {
          return countryCode;
        }
      }
    }

    return '';
  }

  function getAdministrativeAreaLevel1(place) {
    var explicitValue;
    var addressComponents;
    var index;
    var component;
    var componentTypes;

    explicitValue = getString(place && (place.administrativeAreaLevel1 || place.adminAreaLevel1 || place.state || place.region));

    if (explicitValue) {
      return explicitValue;
    }

    addressComponents = getArray(place && place.addressComponents);

    for (index = 0; index < addressComponents.length; index += 1) {
      component = addressComponents[index] || {};
      componentTypes = getArray(component.types).map(normalizeText);

      if (componentTypes.indexOf('administrative_area_level_1') !== -1) {
        return getString(component.longText || component.long_name || component.shortText || component.short_name);
      }
    }

    return '';
  }

  function getAirportIataCode(place) {
    var explicitValue;
    var combinedText;
    var index;
    var code;

    explicitValue = getString(place && place.iataCode).toUpperCase();

    if (explicitValue) {
      return explicitValue;
    }

    combinedText = getCombinedPlaceText(place).toUpperCase();

    for (index = 0; index < COVERAGE.allowedAirportIataCodes.length; index += 1) {
      code = COVERAGE.allowedAirportIataCodes[index];
      if (combinedText.indexOf(code) !== -1) {
        return code;
      }
    }

    return '';
  }

  function isMexico(place) {
    var countryCode = getCountryCode(place);

    if (!countryCode) {
      return false;
    }

    return COVERAGE.mexicoCountryCodes.indexOf(countryCode) !== -1;
  }

  function isAllowedPrimaryArea(place) {
    var administrativeAreaLevel1;

    if (!isMexico(place)) {
      return false;
    }

    administrativeAreaLevel1 = normalizeText(getAdministrativeAreaLevel1(place));

    if (!administrativeAreaLevel1) {
      return false;
    }

    return COVERAGE.allowedPrimaryAdministrativeAreas.indexOf(administrativeAreaLevel1) !== -1;
  }

  function looksLikeAirport(place) {
    return (
      hasAnyType(place, ['airport']) ||
      someIncludesNormalized(getCombinedPlaceText(place), [
        'airport',
        'aeropuerto'
      ])
    );
  }

  function isAllowedAirport(place) {
    var combinedText;
    var iataCode;

    if (!looksLikeAirport(place)) {
      return false;
    }

    combinedText = getCombinedPlaceText(place);
    iataCode = getAirportIataCode(place);

    if (iataCode && COVERAGE.allowedAirportIataCodes.indexOf(iataCode) !== -1) {
      return true;
    }

    return someIncludesNormalized(combinedText, COVERAGE.allowedAirportKeywords);
  }

  function isPlaceWithinCoverage(place) {
    if (!place || typeof place !== 'object') {
      return false;
    }

    if (isAllowedPrimaryArea(place)) {
      return true;
    }

    if (isAllowedAirport(place)) {
      return true;
    }

    return false;
  }

  function getCoverageDecision(place) {
    return {
      isWithinCoverage: isPlaceWithinCoverage(place),
      isAllowedPrimaryArea: isAllowedPrimaryArea(place),
      isAllowedAirport: isAllowedAirport(place),
      countryCode: getCountryCode(place),
      administrativeAreaLevel1: getAdministrativeAreaLevel1(place),
      airportIataCode: getAirportIataCode(place)
    };
  }

  NAMESPACE.coverage = {
    normalizeText: normalizeText,
    getCountryCode: getCountryCode,
    getAdministrativeAreaLevel1: getAdministrativeAreaLevel1,
    getAirportIataCode: getAirportIataCode,
    looksLikeAirport: looksLikeAirport,
    isAllowedPrimaryArea: isAllowedPrimaryArea,
    isAllowedAirport: isAllowedAirport,
    isPlaceWithinCoverage: isPlaceWithinCoverage,
    getCoverageDecision: getCoverageDecision
  };
})(window);