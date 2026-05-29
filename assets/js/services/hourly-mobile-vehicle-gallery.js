/* assets/js/services/hourly-mobile-vehicle-gallery.js
   Hourly / Daily mobile vehicle gallery.
   Responsabilidad:
   - abrir un lightbox/gallery viewer desde la foto del footer móvil Hourly
   - preparado para varias fotos
   - no tocar hourly-daily-panel.js
   - no tocar desktop
   - no tocar tarifa, CTA ni payload
*/

(function initHourlyMobileVehicleGallery(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const DATA_URL = "assets/js/data/fleet-gallery.json";
  const VEHICLE_ID = "byd_m9";
  const BODY_SCREEN_ATTR = "data-hourly-mobile-screen";
  const BODY_GALLERY_ATTR = "data-hourly-mobile-vehicle-gallery-active";
  const FOOTER_MEDIA_SELECTOR =
    '.hourly-mobile-route [data-hourly-mobile-vehicle-in-footer="true"] .services-hourly-panel__vehicle-media';
  const GALLERY_SELECTOR = "[data-hourly-mobile-vehicle-gallery]";
  const IMAGE_SELECTOR = "[data-hourly-mobile-vehicle-gallery-image]";
  const CAPTION_SELECTOR = "[data-hourly-mobile-vehicle-gallery-caption]";
  const COUNTER_SELECTOR = "[data-hourly-mobile-vehicle-gallery-counter]";
  const CLOSE_SELECTOR = "[data-hourly-mobile-vehicle-gallery-close]";
  const PREV_SELECTOR = "[data-hourly-mobile-vehicle-gallery-prev]";
  const NEXT_SELECTOR = "[data-hourly-mobile-vehicle-gallery-next]";
  const BACKDROP_SELECTOR = "[data-hourly-mobile-vehicle-gallery-backdrop]";
  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let galleryNode = null;
  let cachedPayload = null;
  let currentIndex = 0;
  let previousFocus = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function isHourlyMobileRouteActive() {
    return (
      isMobileViewport() &&
      document.body.getAttribute(BODY_SCREEN_ATTR) === "true"
    );
  }
  
    function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeImages(images) {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .filter(function filterImage(item) {
        return Boolean(
          item &&
            item.active === true &&
            normalizeText(item.id) &&
            normalizeText(item.src)
        );
      })
      .map(function mapImage(item) {
        return {
          id: normalizeText(item.id),
          src: normalizeText(item.src)
        };
      });
  }

  function getVehicleFromPayload(payload) {
    const vehicles = payload && payload.vehicles ? payload.vehicles : {};
    const vehicle = vehicles[VEHICLE_ID] || null;
    const images = normalizeImages(vehicle ? vehicle.images : []);

    if (!vehicle || vehicle.active !== true || !images.length) {
      return null;
    }

    return {
      id: VEHICLE_ID,
      images: images
    };
  }

  function getVehicle() {
    return getVehicleFromPayload(cachedPayload);
  }

  async function loadFleetGallery() {
    let response;
    let payload;

    if (cachedPayload) {
      return cachedPayload;
    }

    response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    payload = await response.json();
    cachedPayload = payload && typeof payload === "object" ? payload : {};

    return cachedPayload;
  }

  function getSlideCopyKeys(slide, index) {
    const id = slide && slide.id ? slide.id : "";

    if (index === 0 || id === "byd_m9_main") {
      return {
        altKey: "services.cards.hourly.mobileFlow.vehicleGallery.slides.main.alt",
        captionKey: "services.cards.hourly.mobileFlow.vehicleGallery.slides.main.caption"
      };
    }

    if (id.includes("passengers") || id.includes("captain")) {
      return {
        altKey: "services.cards.hourly.mobileFlow.vehicleGallery.slides.passengers.alt",
        captionKey: "services.cards.hourly.mobileFlow.vehicleGallery.slides.passengers.caption"
      };
    }

    return {
      altKey: "services.cards.hourly.mobileFlow.vehicleGallery.slides.interior.alt",
      captionKey: "services.cards.hourly.mobileFlow.vehicleGallery.slides.interior.caption"
    };
  }
  
  function getI18nText(key) {
    const modules = window.__pixkuyI18nModules;
    const dict = window.__pixkuyI18nDict;

    if (modules && typeof modules.getValue === "function") {
      return modules.getValue(dict, key) || "";
    }

    if (!dict || !key) {
      return "";
    }

    return key.split(".").reduce(function resolvePath(value, segment) {
      if (!value || typeof value !== "object") {
        return "";
      }

      return value[segment] || "";
    }, dict) || "";
  }

  function getSlides() {
    const vehicle = getVehicle();

    if (!vehicle || !Array.isArray(vehicle.images)) {
      return [];
    }

    return vehicle.images.map(function mapVehicleImage(image, index) {
      const copyKeys = getSlideCopyKeys(image, index);

      return {
        src: image.src,
        altKey: copyKeys.altKey,
        captionKey: copyKeys.captionKey
      };
    });
  }
  function buildGalleryNode() {
    const root = document.createElement("section");
    const backdrop = document.createElement("button");
    const panel = document.createElement("div");
    const close = document.createElement("button");
    const imageWrap = document.createElement("div");
    const image = document.createElement("img");
    const footer = document.createElement("div");
    const caption = document.createElement("p");
    const counter = document.createElement("p");
    const prev = document.createElement("button");
    const next = document.createElement("button");

    root.className = "hourly-mobile-vehicle-gallery";
    root.setAttribute("data-hourly-mobile-vehicle-gallery", "1");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.hidden = true;

    backdrop.type = "button";
    backdrop.className = "hourly-mobile-vehicle-gallery__backdrop";
    backdrop.setAttribute("data-hourly-mobile-vehicle-gallery-backdrop", "1");
    backdrop.setAttribute(
      "aria-label",
      getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.closePreview")
    );

    panel.className = "hourly-mobile-vehicle-gallery__panel";
    panel.setAttribute("role", "document");

    close.type = "button";
    close.className = "hourly-mobile-vehicle-gallery__close";
    close.setAttribute("data-hourly-mobile-vehicle-gallery-close", "1");
    close.setAttribute(
      "aria-label",
      getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.close")
    );
    close.textContent = "×";

    imageWrap.className = "hourly-mobile-vehicle-gallery__image-wrap";

    image.className = "hourly-mobile-vehicle-gallery__image";
    image.setAttribute("data-hourly-mobile-vehicle-gallery-image", "1");
    image.decoding = "async";

    footer.className = "hourly-mobile-vehicle-gallery__footer";

    caption.className = "hourly-mobile-vehicle-gallery__caption";
    caption.setAttribute("data-hourly-mobile-vehicle-gallery-caption", "1");

    counter.className = "hourly-mobile-vehicle-gallery__counter";
    counter.setAttribute("data-hourly-mobile-vehicle-gallery-counter", "1");

    prev.type = "button";
    prev.className = "hourly-mobile-vehicle-gallery__nav hourly-mobile-vehicle-gallery__nav--prev";
    prev.setAttribute("data-hourly-mobile-vehicle-gallery-prev", "1");
    prev.setAttribute(
      "aria-label",
      getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.previous")
    );
    prev.textContent = "‹";

    next.type = "button";
    next.className = "hourly-mobile-vehicle-gallery__nav hourly-mobile-vehicle-gallery__nav--next";
    next.setAttribute("data-hourly-mobile-vehicle-gallery-next", "1");
    next.setAttribute(
      "aria-label",
      getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.next")
    );
    next.textContent = "›";

    imageWrap.appendChild(image);

    footer.appendChild(caption);
    footer.appendChild(counter);

    panel.appendChild(close);
    panel.appendChild(imageWrap);
    panel.appendChild(footer);
    panel.appendChild(prev);
    panel.appendChild(next);

    root.appendChild(backdrop);
    root.appendChild(panel);

    return root;
  }

  function syncGalleryCopy() {
    const gallery = galleryNode || document.querySelector(GALLERY_SELECTOR);
    const backdrop = gallery ? gallery.querySelector(BACKDROP_SELECTOR) : null;
    const close = gallery ? gallery.querySelector(CLOSE_SELECTOR) : null;
    const prev = gallery ? gallery.querySelector(PREV_SELECTOR) : null;
    const next = gallery ? gallery.querySelector(NEXT_SELECTOR) : null;

    if (backdrop) {
      backdrop.setAttribute(
        "aria-label",
        getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.closePreview")
      );
    }

    if (close) {
      close.setAttribute(
        "aria-label",
        getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.close")
      );
    }

    if (prev) {
      prev.setAttribute(
        "aria-label",
        getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.previous")
      );
    }

    if (next) {
      next.setAttribute(
        "aria-label",
        getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.next")
      );
    }

    return true;
  }

  function ensureGalleryNode() {
    if (galleryNode) {
      syncGalleryCopy();
      return galleryNode;
    }

    galleryNode = document.querySelector(GALLERY_SELECTOR);

    if (!galleryNode) {
      galleryNode = buildGalleryNode();
      document.body.appendChild(galleryNode);
    }

    bindGalleryEvents();
    syncGalleryCopy();

    return galleryNode;
  }

  function renderGallery() {
    const slides = getSlides();
    const gallery = ensureGalleryNode();
    const image = gallery.querySelector(IMAGE_SELECTOR);
    const caption = gallery.querySelector(CAPTION_SELECTOR);
    const counter = gallery.querySelector(COUNTER_SELECTOR);
    const prev = gallery.querySelector(PREV_SELECTOR);
    const next = gallery.querySelector(NEXT_SELECTOR);
    const slide = slides[currentIndex] || slides[0];

    if (!slide || !image || !caption || !counter || !prev || !next) {
      return false;
    }

    image.src = slide.src;
    image.alt = getI18nText(slide.altKey);
    caption.textContent = getI18nText(slide.captionKey);
    counter.textContent = `${currentIndex + 1} / ${slides.length}`;

    prev.hidden = slides.length <= 1;
    next.hidden = slides.length <= 1;

    return true;
  }

  function openGallery(index) {
    const gallery = ensureGalleryNode();
    const slides = getSlides();

    if (!isHourlyMobileRouteActive() || !gallery || !slides.length) {
      return false;
    }

    previousFocus = document.activeElement;

    currentIndex = Number.isInteger(index) ? index : 0;

    if (currentIndex < 0) {
      currentIndex = 0;
    }

    if (currentIndex > slides.length - 1) {
      currentIndex = slides.length - 1;
    }

    renderGallery();

    gallery.hidden = false;
    gallery.setAttribute("aria-hidden", "false");
    document.body.setAttribute(BODY_GALLERY_ATTR, "true");

    return true;
  }

  function closeGallery() {
    const gallery = ensureGalleryNode();

    if (!gallery) {
      return false;
    }

    if (
      document.activeElement &&
      gallery.contains(document.activeElement) &&
      typeof document.activeElement.blur === "function"
    ) {
      document.activeElement.blur();
    }

    gallery.hidden = true;
    gallery.setAttribute("aria-hidden", "true");
    document.body.setAttribute(BODY_GALLERY_ATTR, "false");

    if (
      previousFocus &&
      typeof previousFocus.focus === "function" &&
      document.contains(previousFocus)
    ) {
      previousFocus.focus({ preventScroll: true });
    }

    previousFocus = null;

    return true;
  }

  function goToSlide(direction) {
    const slides = getSlides();

    if (!slides.length) {
      return false;
    }

    currentIndex += direction;

    if (currentIndex < 0) {
      currentIndex = slides.length - 1;
    }

    if (currentIndex > slides.length - 1) {
      currentIndex = 0;
    }

    renderGallery();

    return true;
  }

  function isOpen() {
    return Boolean(
      galleryNode &&
      galleryNode.hidden !== true &&
      galleryNode.getAttribute("aria-hidden") !== "true"
    );
  }

  function bindGalleryEvents() {
    if (!galleryNode || galleryNode.dataset.hourlyMobileVehicleGalleryBound === "1") {
      return false;
    }

    galleryNode.dataset.hourlyMobileVehicleGalleryBound = "1";

    galleryNode.addEventListener("click", function onGalleryClick(event) {
      if (
        event.target.closest(CLOSE_SELECTOR) ||
        event.target.closest(BACKDROP_SELECTOR)
      ) {
        event.preventDefault();
        closeGallery();
        return;
      }

      if (event.target.closest(PREV_SELECTOR)) {
        event.preventDefault();
        goToSlide(-1);
        return;
      }

      if (event.target.closest(NEXT_SELECTOR)) {
        event.preventDefault();
        goToSlide(1);
      }
    });

    return true;
  }

  function bindFooterTrigger() {
    document.addEventListener("click", function onFooterImageClick(event) {
      const media = event.target.closest(FOOTER_MEDIA_SELECTOR);

      if (!media || !isHourlyMobileRouteActive()) {
        return;
      }

      event.preventDefault();
      openGallery(0);
    });

    document.addEventListener("keydown", function onKeydown(event) {
      if (!isOpen()) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeGallery();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToSlide(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToSlide(1);
      }
    });

    return true;
  }

  function syncActiveState() {
    const media = document.querySelector(FOOTER_MEDIA_SELECTOR);

    if (media) {
      media.setAttribute("role", "button");
      media.setAttribute("tabindex", "0");
      media.setAttribute(
        "aria-label",
        getI18nText("services.cards.hourly.mobileFlow.vehicleGallery.open")
      );
    }

    syncGalleryCopy();

    if (isOpen()) {
      renderGallery();
    }

    if (!isHourlyMobileRouteActive() && isOpen()) {
      closeGallery();
    }

    return true;
  }

  async function init() {
    try {
      await loadFleetGallery();
      ensureGalleryNode();
      bindFooterTrigger();
      syncActiveState();

      window.addEventListener("resize", syncActiveState);
      window.addEventListener("pageshow", syncActiveState);
      window.addEventListener("pixkuy:hourly-daily-panel-ui-sync", syncActiveState);
      window.addEventListener("pixkuy:i18n-applied", syncActiveState);

      if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", syncActiveState);
      } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
        mobileQuery.addListener(syncActiveState);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PixkuyHourlyMobileVehicleGallery = {
    open: openGallery,
    close: closeGallery,
    next: function next() {
      return goToSlide(1);
    },
    prev: function prev() {
      return goToSlide(-1);
    },
    sync: syncActiveState
  };
})(window, document);