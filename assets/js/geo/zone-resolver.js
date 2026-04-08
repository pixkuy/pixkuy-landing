(function () {
  "use strict";

  const DEFAULT_GEOJSON_URL = "assets/js/data/pixkuy_zones_cdmx_v3.geojson";

  const state = {
    geojsonUrl: DEFAULT_GEOJSON_URL,
    featureCollection: null,
    features: null,
    loadPromise: null
  };

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  
    function debugTrace() {
    return;
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
    if (!Array.isArray(value) || value.length < 4) return false;

    for (let index = 0; index < value.length; index += 1) {
      if (!isCoordinatePair(value[index])) {
        return false;
      }
    }

    return true;
  }

  function isPolygonCoordinates(value) {
    if (!Array.isArray(value) || value.length === 0) return false;

    for (let index = 0; index < value.length; index += 1) {
      if (!isLinearRing(value[index])) {
        return false;
      }
    }

    return true;
  }

  function isMultiPolygonCoordinates(value) {
    if (!Array.isArray(value) || value.length === 0) return false;

    for (let index = 0; index < value.length; index += 1) {
      if (!isPolygonCoordinates(value[index])) {
        return false;
      }
    }

    return true;
  }

  function isFeature(value) {
    if (!value || typeof value !== "object") return false;
    if (value.type !== "Feature") return false;
    if (!value.geometry || typeof value.geometry !== "object") return false;
    if (!value.properties || typeof value.properties !== "object") return false;

    const geometryType = value.geometry.type;
    const coordinates = value.geometry.coordinates;

    if (geometryType === "Polygon") {
      return isPolygonCoordinates(coordinates);
    }

    if (geometryType === "MultiPolygon") {
      return isMultiPolygonCoordinates(coordinates);
    }

    return false;
  }

  function normalizeFeature(feature, index) {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    const zoneId =
      typeof properties.zoneId === "string" ? properties.zoneId.trim() : "";

    if (!zoneId) {
      throw new Error(
        "[Pixkuy Zone Resolver] Feature sin zoneId válido en índice " + String(index)
      );
    }

    return {
      type: "Feature",
      properties: {
        zoneId: zoneId,
        labelKey:
          typeof properties.labelKey === "string" ? properties.labelKey.trim() : "",
        active: properties.active !== false,
        priority: isFiniteNumber(properties.priority) ? properties.priority : 0,
        city: typeof properties.city === "string" ? properties.city.trim() : "",
        zoneCode:
          typeof properties.zoneCode === "string" ? properties.zoneCode.trim() : "",
        notes: typeof properties.notes === "string" ? properties.notes : ""
      },
      geometry: {
        type: geometry.type,
        coordinates: geometry.coordinates
      }
    };
  }

  function normalizeFeatureCollection(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("[Pixkuy Zone Resolver] GeoJSON ausente o inválido.");
    }

    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error(
        "[Pixkuy Zone Resolver] El GeoJSON debe ser una FeatureCollection."
      );
    }

    const normalizedFeatures = payload.features
      .filter(function (feature) {
        return isFeature(feature);
      })
      .map(normalizeFeature)
      .filter(function (feature) {
        return feature.properties.active === true;
      })
      .sort(function (left, right) {
        return right.properties.priority - left.properties.priority;
      });

    if (!normalizedFeatures.length) {
      throw new Error(
        "[Pixkuy Zone Resolver] No hay features activas válidas en el GeoJSON."
      );
    }

    return {
      type: "FeatureCollection",
      features: normalizedFeatures
    };
  }

  function getRingBoundingBox(ring) {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (let index = 0; index < ring.length; index += 1) {
      const coordinate = ring[index];
      const lng = coordinate[0];
      const lat = coordinate[1];

      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }

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

  function isPointOnSegment(point, start, end) {
  const px = point.lng;
  const py = point.lat;
  const x1 = start[0];
  const y1 = start[1];
  const x2 = end[0];
  const y2 = end[1];

  const squaredLength = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

  if (squaredLength <= 1e-20) {
    return false;
  }

  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > 1e-10) return false;

  const dot = (px - x1) * (x2 - x1) + (py - y1) * (y2 - y1);
  if (dot < 0) return false;
  if (dot > squaredLength) return false;

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
    if (!isPolygonCoordinates(polygonCoordinates)) return false;

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

    if (geometry.type === "Polygon") {
      return isPointInPolygonCoordinates(point, geometry.coordinates);
    }

    if (geometry.type === "MultiPolygon") {
      for (let index = 0; index < geometry.coordinates.length; index += 1) {
        if (isPointInPolygonCoordinates(point, geometry.coordinates[index])) {
          return true;
        }
      }
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
        "[Pixkuy Zone Resolver] No se pudo cargar el GeoJSON (" +
          String(response.status) +
          ")."
      );
    }

    return response.json();
  }

  async function loadZones(forceReload) {
    const shouldForceReload = forceReload === true;

    if (!shouldForceReload && Array.isArray(state.features) && state.features.length) {
      return state.features;
    }

    if (!shouldForceReload && state.loadPromise) {
      return state.loadPromise;
    }

    state.loadPromise = fetchGeoJson(state.geojsonUrl)
      .then(function (payload) {
        const normalized = normalizeFeatureCollection(payload);
        state.featureCollection = normalized;
        state.features = normalized.features;
        return state.features;
      })
      .finally(function () {
        state.loadPromise = null;
      });

    return state.loadPromise;
  }

  function getLoadedZones() {
    return Array.isArray(state.features) ? state.features.slice() : [];
  }

  function normalizePointInput(input) {
    if (!input || typeof input !== "object") {
      return null;
    }

    const lat = input.lat;
    const lng = input.lng;

    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      return null;
    }

    return {
      lat: lat,
      lng: lng
    };
  }

  function resolveZoneFromPointSync(pointInput) {
    const point = normalizePointInput(pointInput);

    debugTrace("resolveZoneFromPointSync:start", {
      pointInput: pointInput,
      normalizedPoint: point,
      loadedFeatures: Array.isArray(state.features) ? state.features.length : 0
    });

    if (!point) {
      debugTrace("resolveZoneFromPointSync:invalid-point", {
        pointInput: pointInput
      });
      return null;
    }

    if (!Array.isArray(state.features) || !state.features.length) {
      debugTrace("resolveZoneFromPointSync:no-features", {
        hasFeatureCollection: !!state.featureCollection,
        loadedFeatures: Array.isArray(state.features) ? state.features.length : 0
      });
      return null;
    }

    for (let index = 0; index < state.features.length; index += 1) {
      const feature = state.features[index];
      const geometry = feature && feature.geometry ? feature.geometry : {};
      const coordinates = geometry.coordinates;
      const firstPolygon =
        geometry.type === "Polygon"
          ? coordinates
          : geometry.type === "MultiPolygon" && Array.isArray(coordinates)
            ? coordinates[0]
            : null;
      const outerRing =
        Array.isArray(firstPolygon) && Array.isArray(firstPolygon[0])
          ? firstPolygon[0]
          : null;
      const boundingBox = outerRing ? getRingBoundingBox(outerRing) : null;
      const bboxHit = boundingBox
        ? isPointWithinBoundingBox(point, boundingBox)
        : false;

      debugTrace("resolveZoneFromPointSync:feature-check", {
        index: index,
        zoneId: feature && feature.properties ? feature.properties.zoneId : "",
        geometryType: geometry.type || "",
        bboxHit: bboxHit,
        boundingBox: boundingBox
      });

      if (isPointInFeature(point, feature)) {
        const result = {
          zoneId: feature.properties.zoneId,
          labelKey: feature.properties.labelKey || "",
          priority: feature.properties.priority,
          city: feature.properties.city || "",
          zoneCode: feature.properties.zoneCode || "",
          feature: feature
        };

        debugTrace("resolveZoneFromPointSync:match", result);
        return result;
      }
    }

    debugTrace("resolveZoneFromPointSync:no-match", {
      point: point
    });

    return null;
  }

  async function resolveZoneFromPoint(pointInput) {
    debugTrace("resolveZoneFromPoint:before-load", {
      pointInput: pointInput,
      geojsonUrl: state.geojsonUrl
    });

    await loadZones(false);

    const result = resolveZoneFromPointSync(pointInput);

    debugTrace("resolveZoneFromPoint:result", {
      pointInput: pointInput,
      result: result
    });

    return result;
  }

  function setGeoJsonUrl(url) {
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("[Pixkuy Zone Resolver] geoJsonUrl inválido.");
    }

    state.geojsonUrl = url.trim();
    state.featureCollection = null;
    state.features = null;
    state.loadPromise = null;
  }

  window.PixkuyZoneResolver = {
    getGeoJsonUrl: function () {
      return state.geojsonUrl;
    },
    setGeoJsonUrl: setGeoJsonUrl,
    loadZones: function (forceReload) {
      return loadZones(forceReload === true);
    },
    getLoadedZones: getLoadedZones,
    resolveZoneFromPoint: resolveZoneFromPoint,
    resolveZoneFromPointSync: resolveZoneFromPointSync
  };
})();