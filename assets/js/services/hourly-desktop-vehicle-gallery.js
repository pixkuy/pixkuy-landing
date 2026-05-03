/* assets/js/services/hourly-desktop-vehicle-gallery.js
   Hourly / Daily desktop vehicle gallery.
   Responsabilidad:
   - abrir galería/lightbox desde la foto desktop del vehículo Hourly
   - cargar fotos desde assets/js/data/fleet-gallery.json
   - no tocar hourly-daily-panel.js
   - no tocar móvil
   - no tocar tarifa, CTA ni payload
*/

(function initHourlyDesktopVehicleGallery(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DESKTOP_QUERY = "(min-width: 721px)";
  var DATA_URL = "assets/js/data/fleet-gallery.json";
  var VEHICLE_ID = "byd_m9";

  var BODY_GALLERY_ATTR = "data-hourly-desktop-vehicle-gallery-active";

  var VEHICLE_MEDIA_SELECTOR =
    '#services-expand-hourly .services-hourly-panel__vehicle-media';

  var GALLERY_SELECTOR = "[data-hourly-desktop-vehicle-gallery]";
  var IMAGE_SELECTOR = "[data-hourly-desktop-vehicle-gallery-image]";
  var LABEL_SELECTOR = "[data-hourly-desktop-vehicle-gallery-label]";
  var COUNTER_SELECTOR = "[data-hourly-desktop-vehicle-gallery-counter]";
  var CLOSE_SELECTOR = "[data-hourly-desktop-vehicle-gallery-close]";
  var PREV_SELECTOR = "[data-hourly-desktop-vehicle-gallery-prev]";
  var NEXT_SELECTOR = "[data-hourly-desktop-vehicle-gallery-next]";
  var BACKDROP_SELECTOR = "[data-hourly-desktop-vehicle-gallery-backdrop]";

  var desktopQuery = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;

  var galleryNode = null;
  var cachedPayload = null;
  var currentIndex = 0;
  var previousFocus = null;

  function isDesktopViewport() {
    return Boolean(desktopQuery && desktopQuery.matches);
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
    var vehicles = payload && payload.vehicles ? payload.vehicles : {};
    var vehicle = vehicles[VEHICLE_ID] || null;
    var images = normalizeImages(vehicle ? vehicle.images : []);

    if (!vehicle || vehicle.active !== true || !images.length) {
      return null;
    }

    return {
      id: VEHICLE_ID,
      label: normalizeText(vehicle.label) || "BYD M9",
      openLabel:
        normalizeText(vehicle.openLabel) ||
        normalizeText(vehicle.label) ||
        "Abrir galería del vehículo",
      closeLabel: normalizeText(vehicle.closeLabel) || "Cerrar galería del vehículo",
      previousLabel: normalizeText(vehicle.previousLabel) || "Foto anterior",
      nextLabel: normalizeText(vehicle.nextLabel) || "Foto siguiente",
      imageAlt:
        normalizeText(vehicle.imageAlt) ||
        normalizeText(vehicle.label) ||
        "BYD M9 de Pixkuy Mobility",
      images: images
    };
  }

  function getVehicle() {
    return getVehicleFromPayload(cachedPayload);
  }

  async function loadFleetGallery() {
    var response;
    var payload;

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

  function getVehicleMediaNodes() {
    return Array.from(document.querySelectorAll(VEHICLE_MEDIA_SELECTOR));
  }

  function buildGalleryNode() {
    var root = document.createElement("section");
    var backdrop = document.createElement("button");
    var panel = document.createElement("div");
    var close = document.createElement("button");
    var imageWrap = document.createElement("div");
    var image = document.createElement("img");
    var footer = document.createElement("div");
    var label = document.createElement("p");
    var counter = document.createElement("p");
    var prev = document.createElement("button");
    var next = document.createElement("button");

    root.className = "hourly-desktop-vehicle-gallery";
    root.setAttribute("data-hourly-desktop-vehicle-gallery", "1");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.hidden = true;

    backdrop.type = "button";
    backdrop.className = "hourly-desktop-vehicle-gallery__backdrop";
    backdrop.setAttribute("data-hourly-desktop-vehicle-gallery-backdrop", "1");

    panel.className = "hourly-desktop-vehicle-gallery__panel";
    panel.setAttribute("role", "document");

    close.type = "button";
    close.className = "hourly-desktop-vehicle-gallery__close";
    close.setAttribute("data-hourly-desktop-vehicle-gallery-close", "1");
    close.textContent = "×";

    imageWrap.className = "hourly-desktop-vehicle-gallery__image-wrap";

    image.className = "hourly-desktop-vehicle-gallery__image";
    image.setAttribute("data-hourly-desktop-vehicle-gallery-image", "1");
    image.decoding = "async";

    footer.className = "hourly-desktop-vehicle-gallery__footer";

    label.className = "hourly-desktop-vehicle-gallery__label";
    label.setAttribute("data-hourly-desktop-vehicle-gallery-label", "1");

    counter.className = "hourly-desktop-vehicle-gallery__counter";
    counter.setAttribute("data-hourly-desktop-vehicle-gallery-counter", "1");

    prev.type = "button";
    prev.className = "hourly-desktop-vehicle-gallery__nav hourly-desktop-vehicle-gallery__nav--prev";
    prev.setAttribute("data-hourly-desktop-vehicle-gallery-prev", "1");
    prev.textContent = "‹";

    next.type = "button";
    next.className = "hourly-desktop-vehicle-gallery__nav hourly-desktop-vehicle-gallery__nav--next";
    next.setAttribute("data-hourly-desktop-vehicle-gallery-next", "1");
    next.textContent = "›";

    imageWrap.appendChild(image);

    footer.appendChild(label);
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

  function syncGalleryCopy(vehicle) {
    var gallery = galleryNode || document.querySelector(GALLERY_SELECTOR);
    var backdrop = gallery ? gallery.querySelector(BACKDROP_SELECTOR) : null;
    var close = gallery ? gallery.querySelector(CLOSE_SELECTOR) : null;
    var prev = gallery ? gallery.querySelector(PREV_SELECTOR) : null;
    var next = gallery ? gallery.querySelector(NEXT_SELECTOR) : null;

    if (!gallery || !vehicle) {
      return false;
    }

    if (backdrop) {
      backdrop.setAttribute("aria-label", vehicle.closeLabel);
    }

    if (close) {
      close.setAttribute("aria-label", vehicle.closeLabel);
    }

    if (prev) {
      prev.setAttribute("aria-label", vehicle.previousLabel);
    }

    if (next) {
      next.setAttribute("aria-label", vehicle.nextLabel);
    }

    return true;
  }

  function ensureGalleryNode() {
    var vehicle = getVehicle();

    if (galleryNode) {
      syncGalleryCopy(vehicle);
      return galleryNode;
    }

    galleryNode = document.querySelector(GALLERY_SELECTOR);

    if (!galleryNode) {
      galleryNode = buildGalleryNode();
      document.body.appendChild(galleryNode);
    }

    bindGalleryEvents();
    syncGalleryCopy(vehicle);

    return galleryNode;
  }

  function renderGallery() {
    var vehicle = getVehicle();
    var gallery = ensureGalleryNode();
    var image = gallery ? gallery.querySelector(IMAGE_SELECTOR) : null;
    var label = gallery ? gallery.querySelector(LABEL_SELECTOR) : null;
    var counter = gallery ? gallery.querySelector(COUNTER_SELECTOR) : null;
    var prev = gallery ? gallery.querySelector(PREV_SELECTOR) : null;
    var next = gallery ? gallery.querySelector(NEXT_SELECTOR) : null;
    var slide = vehicle && vehicle.images ? vehicle.images[currentIndex] : null;

    if (!vehicle || !slide || !image || !label || !counter || !prev || !next) {
      return false;
    }

    image.src = slide.src;
    image.alt = vehicle.imageAlt;
    label.textContent = vehicle.label;
    counter.textContent = String(currentIndex + 1) + " / " + String(vehicle.images.length);

    prev.hidden = vehicle.images.length <= 1;
    next.hidden = vehicle.images.length <= 1;

    syncGalleryCopy(vehicle);

    return true;
  }

  function openGallery(index) {
    var vehicle = getVehicle();
    var gallery = ensureGalleryNode();

    if (!isDesktopViewport() || !vehicle || !gallery) {
      return false;
    }

    previousFocus = document.activeElement;

    currentIndex = Number.isInteger(index) ? index : 0;

    if (currentIndex < 0) {
      currentIndex = 0;
    }

    if (currentIndex > vehicle.images.length - 1) {
      currentIndex = vehicle.images.length - 1;
    }

    renderGallery();

    gallery.hidden = false;
    gallery.setAttribute("aria-hidden", "false");
    document.body.setAttribute(BODY_GALLERY_ATTR, "true");

    return true;
  }

  function closeGallery() {
    var gallery = ensureGalleryNode();

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
    var vehicle = getVehicle();

    if (!vehicle || !vehicle.images.length) {
      return false;
    }

    currentIndex += direction;

    if (currentIndex < 0) {
      currentIndex = vehicle.images.length - 1;
    }

    if (currentIndex > vehicle.images.length - 1) {
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
    if (!galleryNode || galleryNode.dataset.hourlyDesktopVehicleGalleryBound === "1") {
      return false;
    }

    galleryNode.dataset.hourlyDesktopVehicleGalleryBound = "1";

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

  function syncTriggerState() {
    var vehicle = getVehicle();
    var nodes = getVehicleMediaNodes();

    nodes.forEach(function syncMedia(media) {
      if (!isDesktopViewport() || !vehicle) {
        media.removeAttribute("role");
        media.removeAttribute("tabindex");
        media.removeAttribute("aria-label");
        media.removeAttribute("data-hourly-desktop-vehicle-gallery-trigger");
        return;
      }

      media.setAttribute("role", "button");
      media.setAttribute("tabindex", "0");
      media.setAttribute("aria-label", vehicle.openLabel);
      media.setAttribute("data-hourly-desktop-vehicle-gallery-trigger", "1");
    });

    if (!isDesktopViewport() && isOpen()) {
      closeGallery();
    }

    if (isOpen()) {
      renderGallery();
    }

    return true;
  }

  function bindDocumentEvents() {
    document.addEventListener("click", function onVehicleMediaClick(event) {
      var media = event.target.closest(VEHICLE_MEDIA_SELECTOR);

      if (!media || !isDesktopViewport()) {
        return;
      }

      event.preventDefault();
      openGallery(0);
    });

    document.addEventListener("keydown", function onKeydown(event) {
      var media = event.target.closest(VEHICLE_MEDIA_SELECTOR);

      if (
        media &&
        isDesktopViewport() &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        openGallery(0);
        return;
      }

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

  async function init() {
    try {
      await loadFleetGallery();
      ensureGalleryNode();
      bindDocumentEvents();
      syncTriggerState();

      window.addEventListener("resize", syncTriggerState);
      window.addEventListener("pageshow", syncTriggerState);
      window.addEventListener("pixkuy:hourly-daily-panel-ui-sync", syncTriggerState);
      window.addEventListener("pixkuy:i18n-applied", syncTriggerState);

      if (desktopQuery && typeof desktopQuery.addEventListener === "function") {
        desktopQuery.addEventListener("change", syncTriggerState);
      } else if (desktopQuery && typeof desktopQuery.addListener === "function") {
        desktopQuery.addListener(syncTriggerState);
      }
    } catch (error) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PixkuyHourlyDesktopVehicleGallery = {
    open: openGallery,
    close: closeGallery,
    next: function next() {
      return goToSlide(1);
    },
    prev: function prev() {
      return goToSlide(-1);
    },
    sync: syncTriggerState
  };
})(window, document);