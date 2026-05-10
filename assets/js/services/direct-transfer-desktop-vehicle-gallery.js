/* assets/js/services/direct-transfer-desktop-vehicle-gallery.js
   Direct Transfer desktop vehicle gallery.
   Responsabilidad:
   - cargar catálogo de fotos de flota desde JSON
   - abrir galería desktop desde la imagen del vehículo en Direct Transfer desktop
   - reutilizar fleet-gallery.json
   NO incluir:
   - route móvil Direct Transfer
   - galería móvil
   - quote
   - contacto
*/

(function initDirectTransferDesktopVehicleGallery(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var DESKTOP_QUERY = "(min-width: 721px)";
  var DATA_URL = "assets/js/data/fleet-gallery.json";
  var VEHICLE_ID = "byd_m9";

  var TRIGGER_SELECTOR = ".services-direct-transfer-panel__vehicle";
  var TRIGGER_IMAGE_SELECTOR = ".services-direct-transfer-panel__vehicle-image";

  var GALLERY_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery]";
  var IMAGE_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-image]";
  var COUNTER_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-counter]";
  var LABEL_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-label]";
  var CLOSE_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-close]";
  var PREV_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-prev]";
  var NEXT_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-next]";
  var BACKDROP_SELECTOR = "[data-direct-transfer-desktop-vehicle-gallery-backdrop]";

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
      openLabel: normalizeText(vehicle.openLabel) || "Abrir galería del vehículo",
      closeLabel: normalizeText(vehicle.closeLabel) || "Cerrar galería del vehículo",
      previousLabel: normalizeText(vehicle.previousLabel) || "Foto anterior",
      nextLabel: normalizeText(vehicle.nextLabel) || "Foto siguiente",
      imageAlt: normalizeText(vehicle.imageAlt) || normalizeText(vehicle.label) || "BYD M9",
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

  function getTrigger() {
    return document.querySelector(TRIGGER_SELECTOR);
  }

  function syncTrigger(vehicle) {
    var trigger = getTrigger();
    var image = trigger ? trigger.querySelector(TRIGGER_IMAGE_SELECTOR) : null;

    if (!trigger || !vehicle) {
      return false;
    }

    trigger.setAttribute("role", "button");
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("aria-label", vehicle.openLabel);
    trigger.setAttribute("data-direct-transfer-desktop-vehicle-gallery-trigger", "1");

    if (image && vehicle.images[0]) {
      image.src = vehicle.images[0].src;
      image.alt = vehicle.imageAlt;
    }

    return true;
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

    root.className = "direct-transfer-desktop-vehicle-gallery";
    root.setAttribute("data-direct-transfer-desktop-vehicle-gallery", "1");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.hidden = true;

    backdrop.type = "button";
    backdrop.className = "direct-transfer-desktop-vehicle-gallery__backdrop";
    backdrop.setAttribute("data-direct-transfer-desktop-vehicle-gallery-backdrop", "1");

    panel.className = "direct-transfer-desktop-vehicle-gallery__panel";
    panel.setAttribute("role", "document");

    close.type = "button";
    close.className = "direct-transfer-desktop-vehicle-gallery__close";
    close.setAttribute("data-direct-transfer-desktop-vehicle-gallery-close", "1");
    close.textContent = "×";

    imageWrap.className = "direct-transfer-desktop-vehicle-gallery__image-wrap";

    image.className = "direct-transfer-desktop-vehicle-gallery__image";
    image.setAttribute("data-direct-transfer-desktop-vehicle-gallery-image", "1");
    image.decoding = "async";

    footer.className = "direct-transfer-desktop-vehicle-gallery__footer";

    label.className = "direct-transfer-desktop-vehicle-gallery__label";
    label.setAttribute("data-direct-transfer-desktop-vehicle-gallery-label", "1");

    counter.className = "direct-transfer-desktop-vehicle-gallery__counter";
    counter.setAttribute("data-direct-transfer-desktop-vehicle-gallery-counter", "1");

    prev.type = "button";
    prev.className = "direct-transfer-desktop-vehicle-gallery__nav direct-transfer-desktop-vehicle-gallery__nav--prev";
    prev.setAttribute("data-direct-transfer-desktop-vehicle-gallery-prev", "1");
    prev.textContent = "‹";

    next.type = "button";
    next.className = "direct-transfer-desktop-vehicle-gallery__nav direct-transfer-desktop-vehicle-gallery__nav--next";
    next.setAttribute("data-direct-transfer-desktop-vehicle-gallery-next", "1");
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
    document.body.setAttribute("data-direct-transfer-desktop-vehicle-gallery-active", "true");

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
    document.body.setAttribute("data-direct-transfer-desktop-vehicle-gallery-active", "false");

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
    if (!galleryNode || galleryNode.dataset.directTransferDesktopVehicleGalleryBound === "1") {
      return false;
    }

    galleryNode.dataset.directTransferDesktopVehicleGalleryBound = "1";

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

  function bindDocumentEvents() {
    document.addEventListener("click", function onTriggerClick(event) {
      var trigger = event.target.closest(TRIGGER_SELECTOR);

      if (!trigger || !isDesktopViewport()) {
        return;
      }

      event.preventDefault();
      openGallery(0);
    });

    document.addEventListener("keydown", function onKeydown(event) {
      var trigger;

      if (isOpen()) {
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

        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      trigger = document.activeElement && document.activeElement.closest
        ? document.activeElement.closest(TRIGGER_SELECTOR)
        : null;

      if (!trigger || !isDesktopViewport()) {
        return;
      }

      event.preventDefault();
      openGallery(0);
    });

    return true;
  }

  function syncActiveState() {
    var vehicle = getVehicle();

    if (!isDesktopViewport()) {
      if (isOpen()) {
        closeGallery();
      }

      return false;
    }

    if (vehicle) {
      syncTrigger(vehicle);
      syncGalleryCopy(vehicle);
    }

    if (isOpen()) {
      renderGallery();
    }

    return true;
  }

  async function init() {
    try {
      await loadFleetGallery();
      bindDocumentEvents();
      syncActiveState();

      window.addEventListener("resize", syncActiveState);
      window.addEventListener("pageshow", syncActiveState);
      window.addEventListener("pixkuy:i18n-applied", syncActiveState);
      window.addEventListener("click", function syncAfterClick() {
        window.requestAnimationFrame(syncActiveState);
      });

      if (desktopQuery && typeof desktopQuery.addEventListener === "function") {
        desktopQuery.addEventListener("change", syncActiveState);
      } else if (desktopQuery && typeof desktopQuery.addListener === "function") {
        desktopQuery.addListener(syncActiveState);
      }
    } catch (error) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PixkuyDirectTransferDesktopVehicleGallery = {
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