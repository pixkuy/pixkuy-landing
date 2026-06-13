const {
  loadDirectTransferCoverageGeojson
} = require("./directTransferDataLoader");

let cachedFeatures = null;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

function isCoverageFeature(value) {
  const geometry = value && value.geometry ? value.geometry : {};
  const properties = value && value.properties ? value.properties : {};

  if (!value || typeof value !== "object") {
    return false;
  }

  if (value.type !== "Feature") {
    return false;
  }

  if (!properties || typeof properties !== "object") {
    return false;
  }

  if (geometry.type === "Polygon") {
    return isPolygonCoordinates(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return isMultiPolygonCoordinates(geometry.coordinates);
  }

  return false;
}

function normalizeCoverageFeature(feature, index) {
  const properties = feature.properties || {};
  const geometry = feature.geometry || {};
  const coverageId = normalizeText(properties.coverageId);
  const pricingMode = normalizeText(properties.pricingMode);

  if (!coverageId) {
    throw new Error("DIRECT_TRANSFER_COVERAGE_FEATURE_MISSING_COVERAGE_ID:" + String(index));
  }

  if (!pricingMode) {
    throw new Error("DIRECT_TRANSFER_COVERAGE_FEATURE_MISSING_PRICING_MODE:" + String(index));
  }

  return {
    type: "Feature",
    properties: {
      coverageId,
      pricingMode,
      active: properties.active !== false,
      priority: isFiniteNumber(properties.priority) ? properties.priority : 0,
      description: normalizeText(properties.description),
      shape: normalizeText(properties.shape)
    },
    geometry: {
      type: geometry.type,
      coordinates: geometry.coordinates
    }
  };
}

function normalizeCoverageFeatureCollection(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("DIRECT_TRANSFER_COVERAGE_GEOJSON_INVALID");
  }

  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("DIRECT_TRANSFER_COVERAGE_GEOJSON_NOT_FEATURE_COLLECTION");
  }

  const features = payload.features
    .filter(isCoverageFeature)
    .map(normalizeCoverageFeature)
    .filter(function filterActiveFeature(feature) {
      return feature.properties.active === true;
    })
    .sort(function sortByPriority(left, right) {
      return right.properties.priority - left.properties.priority;
    });

  if (!features.length) {
    throw new Error("DIRECT_TRANSFER_COVERAGE_GEOJSON_NO_ACTIVE_FEATURES");
  }

  return features;
}

function loadCoverageFeatures(forceReload) {
  if (cachedFeatures && forceReload !== true) {
    return cachedFeatures;
  }

  cachedFeatures = normalizeCoverageFeatureCollection(
    loadDirectTransferCoverageGeojson()
  );

  return cachedFeatures;
}

function getRingBoundingBox(ring) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  ring.forEach(function inspectCoordinate(coordinate) {
    const lng = coordinate[0];
    const lat = coordinate[1];

    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  });

  return {
    minLng,
    minLat,
    maxLng,
    maxLat
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

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
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
  const outerRing = Array.isArray(polygonCoordinates) ? polygonCoordinates[0] : null;
  const outerBoundingBox = outerRing ? getRingBoundingBox(outerRing) : null;

  if (!isPolygonCoordinates(polygonCoordinates) || !outerBoundingBox) {
    return false;
  }

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
  const geometry = feature && feature.geometry ? feature.geometry : {};

  if (geometry.type === "Polygon") {
    return isPointInPolygonCoordinates(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some(function matchPolygon(polygonCoordinates) {
      return isPointInPolygonCoordinates(point, polygonCoordinates);
    });
  }

  return false;
}

function normalizePointInput(input) {
  const lat = Number(input && input.lat);
  const lng = Number(input && input.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng
  };
}

function buildNoCoverageResult() {
  return {
    isWithinCoverage: false,
    coverageId: "",
    pricingMode: "",
    priority: 0
  };
}

function buildCoverageResult(feature) {
  const properties = feature.properties || {};

  return {
    isWithinCoverage: true,
    coverageId: properties.coverageId,
    pricingMode: properties.pricingMode,
    priority: properties.priority,
    shape: properties.shape || ""
  };
}

function resolveCoverageFromFeatures(pointInput, features) {
  const point = normalizePointInput(pointInput);
  const safeFeatures = Array.isArray(features) ? features : [];

  if (!point || !safeFeatures.length) {
    return buildNoCoverageResult();
  }

  for (let index = 0; index < safeFeatures.length; index += 1) {
    if (isPointInFeature(point, safeFeatures[index])) {
      return buildCoverageResult(safeFeatures[index]);
    }
  }

  return buildNoCoverageResult();
}

function resolveCoverageFromPoint(pointInput, options) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const features = loadCoverageFeatures(safeOptions.forceReload === true);

  return resolveCoverageFromFeatures(pointInput, features);
}

module.exports = {
  normalizeCoverageFeatureCollection,
  loadCoverageFeatures,
  resolveCoverageFromFeatures,
  resolveCoverageFromPoint
};