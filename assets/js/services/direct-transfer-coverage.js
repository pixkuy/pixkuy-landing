/* assets/js/services/direct-transfer-coverage.js
   Direct Transfer coverage resolver.
   Responsabilidad:
   - cargar assets/js/data/direct-transfer-coverage.geojson
   - resolver si un punto cae en primary_area o extended_ring
   - devolver coverageId y pricingMode
   - no calcular precio
   - no tocar Airport/Hotel
   - no tocar Google Places
*/

(function initDirectTransferCoverage(window) {
  "use strict";

  if (!window) {
    return;
  }

  const DEFAULT_GEOJSON_URL = "assets/js/data/direct-transfer-coverage.geojson";
  const SEARCH_LOCATION_RESTRICTION_PADDING_DEGREES = 0.15;

  const state = {
    geojsonUrl: DEFAULT_GEOJSON_URL,
    features: null,
    searchLocationRestriction: null,
    loadPromise: null
  };

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeCoordinate(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  function isCoordinatePair(value) {
    return (
      Array.isArray(value) &&
      value.length >= 2 &&
      isFiniteNumber(value[0]) &&
      isFiniteNumber(value[1])
    );
  }

  function isLinearRing(value) {
    if (!Array.isArray(value) || value.length < 4) {
      return false;
    }

    return value.every(isCoordinatePair);
  }

  function isPolygonCoordinates(value) {
    if (!Array.isArray(value) || !value.length) {
      return false;
    }

    return value.every(isLinearRing);
  }

  function isMultiPolygonCoordinates(value) {
    if (!Array.isArray(value) || !value.length) {
      return false;
    }

    return value.every(isPolygonCoordinates);
  }

  function isSupportedFeature(feature) {
    if (!feature || typeof feature !== "object") {
      return false;
    }

    if (feature.type !== "Feature") {
      return false;
    }

    if (!feature.properties || typeof feature.properties !== "object") {
      return false;
    }

    if (!feature.geometry || typeof feature.geometry !== "object") {
      return false;
    }

    if (feature.geometry.type === "Polygon") {
      return isPolygonCoordinates(feature.geometry.coordinates);
    }

    if (feature.geometry.type === "MultiPolygon") {
      return isMultiPolygonCoordinates(feature.geometry.coordinates);
    }

    return false;
  }

  function normalizeFeature(feature, index) {
    const properties = feature.properties || {};
    const coverageId = normalizeText(properties.coverageId);
    const pricingMode = normalizeText(properties.pricingMode);

    if (!coverageId) {
      throw new Error(
        "[Pixkuy Direct Transfer Coverage] Feature sin coverageId válido en índice " +
          String(index)
      );
    }

    if (!pricingMode) {
      throw new Error(
        "[Pixkuy Direct Transfer Coverage] Feature sin pricingMode válido en índice " +
          String(index)
      );
    }

    return {
      type: "Feature",
      properties: {
        coverageId: coverageId,
        pricingMode: pricingMode,
        active: properties.active !== false,
        priority: isFiniteNumber(properties.priority) ? properties.priority : 0
      },
      geometry: {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates
      }
    };
  }

  function normalizeFeatureCollection(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("[Pixkuy Direct Transfer Coverage] GeoJSON inválido.");
    }

    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error(
        "[Pixkuy Direct Transfer Coverage] El GeoJSON debe ser FeatureCollection."
      );
    }

    const features = payload.features
      .filter(isSupportedFeature)
      .map(normalizeFeature)
      .filter(function filterActive(feature) {
        return feature.properties.active === true;
      })
      .sort(function sortByPriority(left, right) {
        return right.properties.priority - left.properties.priority;
      });

    if (!features.length) {
      throw new Error(
        "[Pixkuy Direct Transfer Coverage] No hay features activas válidas."
      );
    }

    return features;
  }

  function getRingBoundingBox(ring) {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    ring.forEach(function eachCoordinate(coordinate) {
      const lng = coordinate[0];
      const lat = coordinate[1];

      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });

    return {
      minLng: minLng,
      minLat: minLat,
      maxLng: maxLng,
      maxLat: maxLat
    };
  }

  function isPointWithinBoundingBox(point, boundingBox) {
    return (
      point.lng >= boundingBox.minLng &&
      point.lng <= boundingBox.maxLng &&
      point.lat >= boundingBox.minLat &&
      point.lat <= boundingBox.maxLat
    );
  }
  
    function mergeBoundingBoxes(left, right) {
    if (!left) {
      return right || null;
    }

    if (!right) {
      return left;
    }

    return {
      minLng: Math.min(left.minLng, right.minLng),
      minLat: Math.min(left.minLat, right.minLat),
      maxLng: Math.max(left.maxLng, right.maxLng),
      maxLat: Math.max(left.maxLat, right.maxLat)
    };
  }

  function getPolygonBoundingBox(polygonCoordinates) {
    if (!isPolygonCoordinates(polygonCoordinates)) {
      return null;
    }

    return polygonCoordinates.reduce(function reducePolygonBoundingBox(currentBox, ring) {
      return mergeBoundingBoxes(currentBox, getRingBoundingBox(ring));
    }, null);
  }

  function getFeatureBoundingBox(feature) {
    const geometry = feature && feature.geometry ? feature.geometry : {};
    const coordinates = geometry.coordinates;

    if (geometry.type === "Polygon") {
      return getPolygonBoundingBox(coordinates);
    }

    if (geometry.type === "MultiPolygon" && isMultiPolygonCoordinates(coordinates)) {
      return coordinates.reduce(function reduceMultiPolygonBoundingBox(currentBox, polygonCoordinates) {
        return mergeBoundingBoxes(currentBox, getPolygonBoundingBox(polygonCoordinates));
      }, null);
    }

    return null;
  }

  function getFeaturesBoundingBox(features) {
    const safeFeatures = Array.isArray(features) ? features : [];

    return safeFeatures.reduce(function reduceFeaturesBoundingBox(currentBox, feature) {
      return mergeBoundingBoxes(currentBox, getFeatureBoundingBox(feature));
    }, null);
  }

  function clampCoordinate(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function buildSearchLocationRestriction(features) {
    const boundingBox = getFeaturesBoundingBox(features);

    if (!boundingBox) {
      return null;
    }

    return {
      west: clampCoordinate(
        boundingBox.minLng - SEARCH_LOCATION_RESTRICTION_PADDING_DEGREES,
        -180,
        180
      ),
      south: clampCoordinate(
        boundingBox.minLat - SEARCH_LOCATION_RESTRICTION_PADDING_DEGREES,
        -90,
        90
      ),
      east: clampCoordinate(
        boundingBox.maxLng + SEARCH_LOCATION_RESTRICTION_PADDING_DEGREES,
        -180,
        180
      ),
      north: clampCoordinate(
        boundingBox.maxLat + SEARCH_LOCATION_RESTRICTION_PADDING_DEGREES,
        -90,
        90
      )
    };
  }

  function cloneLocationRestriction(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    return {
      west: value.west,
      south: value.south,
      east: value.east,
      north: value.north
    };
  }

  function isPointOnSegment(point, start, end) {
    const px = point.lng;
    const py = point.lat;
    const x1 = start[0];
    const y1 = start[1];
    const x2 = end[0];
    const y2 = end[1];
    const squaredLength = ((x2 - x1) * (x2 - x1)) + ((y2 - y1) * (y2 - y1));

    if (squaredLength <= 1e-20) {
      return false;
    }

    const cross = ((px - x1) * (y2 - y1)) - ((py - y1) * (x2 - x1));

    if (Math.abs(cross) > 1e-10) {
      return false;
    }

    const dot = ((px - x1) * (x2 - x1)) + ((py - y1) * (y2 - y1));

    if (dot < 0) {
      return false;
    }

    if (dot > squaredLength) {
      return false;
    }

    return true;
  }

  function isPointInRing(point, ring) {
    let inside = false;

    for (
      let current = 0, previous = ring.length - 1;
      current < ring.length;
      previous = current, current += 1
    ) {
      const currentCoordinate = ring[current];
      const previousCoordinate = ring[previous];

      if (isPointOnSegment(point, previousCoordinate, currentCoordinate)) {
        return true;
      }

      const currentLng = currentCoordinate[0];
      const currentLat = currentCoordinate[1];
      const previousLng = previousCoordinate[0];
      const previousLat = previousCoordinate[1];

      const intersects =
        currentLat > point.lat !== previousLat > point.lat &&
        point.lng <
          ((previousLng - currentLng) * (point.lat - currentLat)) /
            (previousLat - currentLat) +
            currentLng;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  function isPointInPolygonCoordinates(point, polygonCoordinates) {
    if (!isPolygonCoordinates(polygonCoordinates)) {
      return false;
    }

    const outerRing = polygonCoordinates[0];
    const outerBoundingBox = getRingBoundingBox(outerRing);

    if (!isPointWithinBoundingBox(point, outerBoundingBox)) {
      return false;
    }

    if (!isPointInRing(point, outerRing)) {
      return false;
    }

    for (let holeIndex = 1; holeIndex < polygonCoordinates.length; holeIndex += 1) {
      if (isPointInRing(point, polygonCoordinates[holeIndex])) {
        return false;
      }
    }

    return true;
  }

  function isPointInFeature(point, feature) {
    const geometry = feature.geometry || {};
    const coordinates = geometry.coordinates;

    if (geometry.type === "Polygon") {
      return isPointInPolygonCoordinates(point, coordinates);
    }

    if (geometry.type === "MultiPolygon") {
      return coordinates.some(function somePolygon(polygonCoordinates) {
        return isPointInPolygonCoordinates(point, polygonCoordinates);
      });
    }

    return false;
  }

  async function fetchGeoJson(url) {
    const response = await window.fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(
        "[Pixkuy Direct Transfer Coverage] No se pudo cargar el GeoJSON (" +
          String(response.status) +
          ")."
      );
    }

    return response.json();
  }

  async function loadCoverage(forceReload) {
    const shouldForceReload = forceReload === true;

    if (!shouldForceReload && Array.isArray(state.features) && state.features.length) {
      return state.features;
    }

    if (!shouldForceReload && state.loadPromise) {
      return state.loadPromise;
    }

    state.loadPromise = fetchGeoJson(state.geojsonUrl)
      .then(function onCoverageLoaded(payload) {
        state.features = normalizeFeatureCollection(payload);
        state.searchLocationRestriction = buildSearchLocationRestriction(state.features);
        return state.features;
      })
      .finally(function onCoverageLoadFinished() {
        state.loadPromise = null;
      });

    return state.loadPromise;
  }

  function normalizePoint(input) {
    if (!input || typeof input !== "object") {
      return null;
    }

    const lat = normalizeCoordinate(input.lat);
    const lng = normalizeCoordinate(input.lng);

    if (lat === null || lng === null) {
      return null;
    }

    return {
      lat: lat,
      lng: lng
    };
  }

  function resolveCoverageFromPointSync(input) {
    const point = normalizePoint(input);

    if (!point || !Array.isArray(state.features) || !state.features.length) {
      return null;
    }

    for (let index = 0; index < state.features.length; index += 1) {
      const feature = state.features[index];

      if (isPointInFeature(point, feature)) {
        return {
          isWithinCoverage: true,
          coverageId: feature.properties.coverageId,
          pricingMode: feature.properties.pricingMode,
          priority: feature.properties.priority
        };
      }
    }

    return {
      isWithinCoverage: false,
      coverageId: "",
      pricingMode: "",
      priority: 0
    };
  }

  async function resolveCoverageFromPoint(input) {
    await loadCoverage(false);

    return resolveCoverageFromPointSync(input);
  }

  function getLoadedCoverageFeatures() {
    return Array.isArray(state.features) ? state.features.slice() : [];
  }
  
  function getSearchLocationRestrictionSync() {
    return cloneLocationRestriction(state.searchLocationRestriction);
  }

  async function getSearchLocationRestriction(forceReload) {
    await loadCoverage(forceReload === true);

    return getSearchLocationRestrictionSync();
  }

  function setGeoJsonUrl(url) {
    const safeUrl = normalizeText(url);

    if (!safeUrl) {
      throw new Error("[Pixkuy Direct Transfer Coverage] geoJsonUrl inválido.");
    }

    state.geojsonUrl = safeUrl;
    state.features = null;
    state.searchLocationRestriction = null;
    state.loadPromise = null;
  }

  window.PixkuyDirectTransferCoverage = {
    getGeoJsonUrl: function getGeoJsonUrl() {
      return state.geojsonUrl;
    },
    setGeoJsonUrl: setGeoJsonUrl,
    loadCoverage: function loadCoveragePublic(forceReload) {
      return loadCoverage(forceReload === true);
    },
    getLoadedCoverageFeatures: getLoadedCoverageFeatures,
    getSearchLocationRestriction: getSearchLocationRestriction,
    getSearchLocationRestrictionSync: getSearchLocationRestrictionSync,
    resolveCoverageFromPoint: resolveCoverageFromPoint,
    resolveCoverageFromPointSync: resolveCoverageFromPointSync
  };
})(window);