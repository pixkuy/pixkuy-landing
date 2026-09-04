(function initEventsSpecialCatalogSource(window) {
  "use strict";

  if (!window || !window.fetch) return;

  const ENDPOINT = "/v1/public/special-events";
  const SUPPORTED_LOCALES = ["es", "en", "de", "fr", "it", "ko", "pt", "ru", "zh-hans"];
  const EVENT_TYPES = ["concert", "expo", "festival", "other", "sport"];
  const CACHE_MAX_AGE_MS = 60 * 1000;
  const cacheByLocale = new Map();
  let activeLocale = "";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeLocale(value) {
    const normalized = normalizeText(value).toLowerCase().replace("_", "-");

    if (normalized === "zh" || normalized === "zh-cn" || normalized === "zh-hans") {
      return "zh-hans";
    }

    const language = normalized.split("-")[0];
    return SUPPORTED_LOCALES.indexOf(language) >= 0 ? language : "es";
  }

  function getDocumentLocale() {
    return normalizeLocale(
      window.__pixkuyI18nLang ||
      (window.document && window.document.documentElement
        ? window.document.documentElement.lang
        : "es")
    );
  }

  function waitForPublicConfig() {
    const loader = window.PixkuyBookingPublicConfig;
    return loader && loader.ready && typeof loader.ready.then === "function"
      ? loader.ready
      : Promise.resolve();
  }

  function getPublicConfig() {
    const config = window.PIXKUY_BOOKING_API_CONFIG;
    const safeConfig = config && typeof config === "object" ? config : {};

    return {
      apiBaseUrl: normalizeText(safeConfig.apiBaseUrl),
      publicSiteKey: normalizeText(safeConfig.publicSiteKey)
    };
  }

  function buildUrl(config, locale) {
    const base = config.apiBaseUrl.replace(/\/+$/, "");
    return base + ENDPOINT + "?lang=" + encodeURIComponent(locale);
  }

  function normalizeMediaUrl(value) {
    const raw = normalizeText(value);
    let url;

    if (!raw) return "";

    try {
      url = new URL(raw, window.location.href);
    } catch (error) {
      return "";
    }

    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  }

  function normalizeCatalogEvent(event) {
    const source = event && typeof event === "object" ? event : {};
    const id = normalizeText(source.id);
    const eventGroupId = normalizeText(source.eventGroupId);
    const venueId = normalizeText(source.venueId);
    const title = normalizeText(source.title);
    const dateLabel = normalizeText(source.dateLabel);
    const venueName = normalizeText(source.venueName);
    const venueAddress = normalizeText(source.venueAddress);
    const startsAt = normalizeText(source.startsAt);
    const startsAtUtc = normalizeText(source.startsAtUtc);
    const posterSrc = normalizeMediaUrl(source.posterSrc);
    const posterMobileSrc = normalizeMediaUrl(source.posterMobileSrc);
    const snapshotVersion = Number(source.snapshotVersion);
    const priority = Number(source.priority);

    if (
      !id ||
      !eventGroupId ||
      !venueId ||
      !title ||
      !dateLabel ||
      !venueName ||
      !venueAddress ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) ||
      !Number.isFinite(Date.parse(startsAtUtc)) ||
      !posterSrc ||
      !posterMobileSrc ||
      EVENT_TYPES.indexOf(source.type) < 0 ||
      source.active !== true ||
      !Number.isSafeInteger(priority) ||
      priority < 1 ||
      !Number.isInteger(snapshotVersion) ||
      snapshotVersion < 1
    ) {
      throw new Error("SPECIAL_EVENT_CATALOG_INVALID");
    }

    return {
      id,
      eventGroupId,
      type: source.type,
      title,
      dateLabel,
      startsAt,
      startsAtUtc,
      estimatedEndAt: normalizeText(source.estimatedEndAt) || null,
      estimatedEndAtUtc: normalizeText(source.estimatedEndAtUtc) || null,
      venueId,
      venueName,
      venueAddress,
      venue: {
        id: venueId,
        name: venueName,
        address: venueAddress,
        nameKey: "",
        addressKey: "",
        active: true
      },
      posterSrc,
      posterMobileSrc,
      active: source.active === true,
      featured: source.featured === true,
      priority,
      snapshotVersion
    };
  }

  function projectCatalog(payload) {
    if (!payload || !normalizeText(payload.catalogVersion)) {
      throw new Error("SPECIAL_EVENT_CATALOG_INVALID");
    }

    const events = payload && Array.isArray(payload.events)
      ? payload.events.map(normalizeCatalogEvent)
      : [];
    const venuesById = {};

    events.forEach(function collectVenue(event) {
      const venueId = normalizeText(event && event.venueId);

      if (!venueId || venuesById[venueId]) return;

      venuesById[venueId] = {
        id: venueId,
        name: normalizeText(event.venueName),
        address: normalizeText(event.venueAddress),
        nameKey: "",
        addressKey: "",
        active: true
      };
    });

    return {
      status: "ok",
      catalogVersion: normalizeText(payload && payload.catalogVersion),
      locale: normalizeLocale(payload && payload.locale),
      fallbackLocale: "es",
      timeZone: normalizeText(payload && payload.timeZone) || "America/Mexico_City",
      minimumLeadHours: Number(payload && payload.minimumLeadHours) || 6,
      venues: Object.keys(venuesById).map(function mapVenue(venueId) {
        return venuesById[venueId];
      }),
      events: events,
      pricing: payload && payload.pricingPresentation && typeof payload.pricingPresentation === "object"
        ? payload.pricingPresentation
        : {}
    };
  }

  function requestCatalog(locale, cached, controller) {
    return waitForPublicConfig().then(function afterConfigReady() {
      const config = getPublicConfig();
      const headers = {
        "Accept": "application/json",
        "X-Pixkuy-Site-Key": config.publicSiteKey
      };

      if (!config.publicSiteKey) {
        throw new Error("SPECIAL_EVENT_PUBLIC_CONFIG_UNAVAILABLE");
      }

      if (cached && cached.etag) {
        headers["If-None-Match"] = cached.etag;
      }

      return window.fetch(buildUrl(config, locale), {
        method: "GET",
        headers,
        cache: "no-cache",
        signal: controller ? controller.signal : undefined
      });
    }).then(function parseResponse(response) {
      if (response && response.status === 304 && cached && cached.data) {
        return { data: cached.data, etag: cached.etag };
      }

      if (!response || !response.ok) {
        throw new Error("SPECIAL_EVENT_CATALOG_HTTP_" + (response ? response.status : "UNAVAILABLE"));
      }

      return response.json().then(function validatePayload(payload) {
        if (!payload || payload.status !== "ok" || !Array.isArray(payload.events)) {
          throw new Error("SPECIAL_EVENT_CATALOG_INVALID");
        }

        return {
          data: projectCatalog(payload),
          etag: normalizeText(response.headers && response.headers.get("ETag"))
        };
      });
    });
  }

  function loadCatalog(locale) {
    const selectedLocale = normalizeLocale(locale || getDocumentLocale());
    const cached = cacheByLocale.get(selectedLocale);
    const now = Date.now();

    if (activeLocale && activeLocale !== selectedLocale) {
      cacheByLocale.forEach(function abortObsoleteRequest(entry, entryLocale) {
        if (entryLocale !== selectedLocale && entry && entry.controller) {
          entry.controller.abort();
        }
      });
    }
    activeLocale = selectedLocale;

    if (
      cached &&
      cached.data &&
      now - Number(cached.fetchedAt || 0) < CACHE_MAX_AGE_MS
    ) {
      return Promise.resolve(cached.data);
    }

    if (cached && cached.promise) {
      return cached.promise;
    }

    const controller = typeof window.AbortController === "function"
      ? new window.AbortController()
      : null;
    let promise;

    promise = requestCatalog(selectedLocale, cached, controller)
      .then(function storeCatalog(result) {
        cacheByLocale.set(selectedLocale, {
          data: result.data,
          etag: result.etag,
          fetchedAt: Date.now(),
          promise: null,
          controller: null
        });
        return result.data;
      })
      .catch(function clearRejectedRequest(error) {
        const current = cacheByLocale.get(selectedLocale);

        if (current && current.promise === promise) {
          if (cached && cached.data) {
            cacheByLocale.set(selectedLocale, {
              data: cached.data,
              etag: cached.etag,
              fetchedAt: 0,
              promise: null,
              controller: null
            });
          } else {
            cacheByLocale.delete(selectedLocale);
          }
        }
        throw error;
      });

    cacheByLocale.set(selectedLocale, {
      data: null,
      etag: cached ? cached.etag : "",
      fetchedAt: cached ? cached.fetchedAt : 0,
      promise,
      controller
    });

    return promise;
  }

  function invalidate(locale) {
    if (locale) {
      const selectedLocale = normalizeLocale(locale);
      const cached = cacheByLocale.get(selectedLocale);
      if (cached && cached.controller) cached.controller.abort();
      if (cached && cached.data) {
        cacheByLocale.set(selectedLocale, {
          data: cached.data,
          etag: cached.etag,
          fetchedAt: 0,
          promise: null,
          controller: null
        });
      } else {
        cacheByLocale.delete(selectedLocale);
      }
      return;
    }

    cacheByLocale.forEach(function invalidateEntry(cached, selectedLocale) {
      if (cached && cached.controller) cached.controller.abort();
      if (cached && cached.data) {
        cacheByLocale.set(selectedLocale, {
          data: cached.data,
          etag: cached.etag,
          fetchedAt: 0,
          promise: null,
          controller: null
        });
      } else {
        cacheByLocale.delete(selectedLocale);
      }
    });
  }

  window.PixkuyServicesEventsCatalogSource = {
    loadCatalog,
    invalidate
  };
})(window);
