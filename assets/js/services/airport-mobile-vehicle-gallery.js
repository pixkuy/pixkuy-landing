/* assets/js/services/airport-mobile-vehicle-gallery.js
   Airport / Hotel mobile vehicle gallery.
   Responsabilidad:
   - cargar catálogo de fotos de flota desde JSON
   - insertar una miniatura tocable junto a la tarifa móvil Airport
   - abrir un lightbox de vehículo desde Airport Mobile Route
   - no tocar airport-mobile-booking-flow.js
   - no tocar tarifa, Places, Step 2, Netlify ni desktop
*/

(function initAirportMobileVehicleGallery(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var MOBILE_QUERY = "(max-width: 720px)";
  var DATA_URL = "assets/js/data/fleet-gallery.json";
  var VEHICLE_ID = "byd_m9";

  var BODY_SCREEN_ATTR = "data-airport-mobile-screen";
  var BODY_GALLERY_ATTR = "data-airport-mobile-vehicle-gallery-active";

  var FARE_FIELD_SELECTOR =
    ".airport-mobile-route #services-expand-airport .services-expand__field--fare";
  var ACTIONS_SELECTOR =
    ".airport-mobile-route #services-expand-airport .services-expand__actions";
  var FARE_FOOTER_SELECTOR = "[data-airport-mobile-fare-footer]";

  var TRIGGER_SELECTOR = "[data-airport-mobile-vehicle-gallery-trigger]";
  var GALLERY_SELECTOR = "[data-airport-mobile-vehicle-gallery]";
  var IMAGE_SELECTOR = "[data-airport-mobile-vehicle-gallery-image]";
  var COUNTER_SELECTOR = "[data-airport-mobile-vehicle-gallery-counter]";
  var LABEL_SELECTOR = "[data-airport-mobile-vehicle-gallery-label]";
  var CLOSE_SELECTOR = "[data-airport-mobile-vehicle-gallery-close]";
  var PREV_SELECTOR = "[data-airport-mobile-vehicle-gallery-prev]";
  var NEXT_SELECTOR = "[data-airport-mobile-vehicle-gallery-next]";
  var BACKDROP_SELECTOR = "[data-airport-mobile-vehicle-gallery-backdrop]";

  var mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  var galleryNode = null;
  var cachedPayload = null;
  var currentIndex = 0;
  var bodyObserver = null;
  var previousFocus = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function isAirportMobileRouteActive() {
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
    var vehicles = payload && payload.vehicles ? payload.vehicles : {};
    var vehicle = vehicles[VEHICLE_ID] || null;
    var images = normalizeImages(vehicle ? vehicle.images : []);

    if (!vehicle || vehicle.active !== true || !images.length) {
      return null;
    }

    return {
      id: VEHICLE_ID,
      label: normalizeText(vehicle.label) || "BYD M9",
      openLabel: normalizeText(vehicle.openLabel) || normalizeText(vehicle.label) || "BYD M9",
      closeLabel: normalizeText(vehicle.closeLabel) || "Cerrar",
      previousLabel: normalizeText(vehicle.previousLabel) || "Anterior",
      nextLabel: normalizeText(vehicle.nextLabel) || "Siguiente",
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

  function getFareField() {
    return document.querySelector(FARE_FIELD_SELECTOR);
  }

  function getActionsNode() {
    return document.querySelector(ACTIONS_SELECTOR);
  }

  function getFareFooter() {
    return document.querySelector(FARE_FOOTER_SELECTOR);
  }

  function ensureFareFooter() {
    var fareField = getFareField();
    var actions = getActionsNode();
    var footer = getFareFooter();

    if (!fareField || !actions) {
      return null;
    }

    if (!footer) {
      footer = document.createElement("div");
      footer.className = "airport-mobile-fare-footer";
      footer.setAttribute("data-airport-mobile-fare-footer", "1");

      fareField.parentNode.insertBefore(footer, fareField);
    }

    if (fareField.parentNode !== footer) {
      footer.appendChild(fareField);
    }

    if (actions.parentNode !== footer) {
      footer.appendChild(actions);
    }

    footer.setAttribute("data-airport-mobile-fare-footer-ready", "true");

    return footer;
  }

  function buildTrigger(vehicle) {
    var trigger = document.createElement("button");
    var image = document.createElement("img");
    var label = document.createElement("span");

    trigger.type = "button";
    trigger.className = "airport-mobile-vehicle-gallery-trigger";
    trigger.setAttribute("data-airport-mobile-vehicle-gallery-trigger", "1");
    trigger.setAttribute("aria-label", vehicle.openLabel);

    image.className = "airport-mobile-vehicle-gallery-trigger__image";
    image.src = vehicle.images[0].src;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.setAttribute("aria-hidden", "true");

    label.className = "airport-mobile-vehicle-gallery-trigger__label";
    label.setAttribute("data-airport-mobile-vehicle-gallery-trigger-label", "1");
    label.textContent = vehicle.label;

    trigger.appendChild(image);
    trigger.appendChild(label);

    return trigger;
  }

  function syncTriggerCopy(vehicle) {
    var trigger = document.querySelector(TRIGGER_SELECTOR);
    var image = trigger
      ? trigger.querySelector(".airport-mobile-vehicle-gallery-trigger__image")
      : null;
    var label = trigger
      ? trigger.querySelector("[data-airport-mobile-vehicle-gallery-trigger-label]")
      : null;

    if (!trigger || !vehicle) {
      return false;
    }

    trigger.setAttribute("aria-label", vehicle.openLabel);

    if (image && vehicle.images[0]) {
      image.src = vehicle.images[0].src;
    }

    if (label) {
      label.textContent = vehicle.label;
    }

    return true;
  }

  function ensureTrigger() {
    var vehicle = getVehicle();
    var fareField = getFareField();
    var footer = ensureFareFooter();
    var trigger = document.querySelector(TRIGGER_SELECTOR);

    if (!isAirportMobileRouteActive() || !vehicle || !fareField || !footer) {
      return false;
    }

    if (!trigger) {
      trigger = buildTrigger(vehicle);
    }

    if (trigger.parentNode !== footer) {
      footer.insertBefore(trigger, fareField);
    }

    fareField.setAttribute("data-airport-mobile-vehicle-gallery-ready", "true");
    footer.setAttribute("data-airport-mobile-fare-footer-ready", "true");
    syncTriggerCopy(vehicle);

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

    root.className = "airport-mobile-vehicle-gallery";
    root.setAttribute("data-airport-mobile-vehicle-gallery", "1");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.hidden = true;

    backdrop.type = "button";
    backdrop.className = "airport-mobile-vehicle-gallery__backdrop";
    backdrop.setAttribute("data-airport-mobile-vehicle-gallery-backdrop", "1");

    panel.className = "airport-mobile-vehicle-gallery__panel";
    panel.setAttribute("role", "document");

    close.type = "button";
    close.className = "airport-mobile-vehicle-gallery__close";
    close.setAttribute("data-airport-mobile-vehicle-gallery-close", "1");
    close.textContent = "×";

    imageWrap.className = "airport-mobile-vehicle-gallery__image-wrap";

    image.className = "airport-mobile-vehicle-gallery__image";
    image.setAttribute("data-airport-mobile-vehicle-gallery-image", "1");
    image.decoding = "async";

    footer.className = "airport-mobile-vehicle-gallery__footer";

    label.className = "airport-mobile-vehicle-gallery__label";
    label.setAttribute("data-airport-mobile-vehicle-gallery-label", "1");

    counter.className = "airport-mobile-vehicle-gallery__counter";
    counter.setAttribute("data-airport-mobile-vehicle-gallery-counter", "1");

    prev.type = "button";
    prev.className = "airport-mobile-vehicle-gallery__nav airport-mobile-vehicle-gallery__nav--prev";
    prev.setAttribute("data-airport-mobile-vehicle-gallery-prev", "1");
    prev.textContent = "‹";

    next.type = "button";
    next.className = "airport-mobile-vehicle-gallery__nav airport-mobile-vehicle-gallery__nav--next";
    next.setAttribute("data-airport-mobile-vehicle-gallery-next", "1");
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

    if (!isAirportMobileRouteActive() || !vehicle || !gallery) {
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
    if (!galleryNode || galleryNode.dataset.airportMobileVehicleGalleryBound === "1") {
      return false;
    }

    galleryNode.dataset.airportMobileVehicleGalleryBound = "1";

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

      if (!trigger || !isAirportMobileRouteActive()) {
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
    var vehicle = getVehicle();

    if (!isAirportMobileRouteActive()) {
      if (isOpen()) {
        closeGallery();
      }

      return false;
    }

    ensureTrigger();

    if (isOpen()) {
      renderGallery();
    }

    if (vehicle) {
      syncGalleryCopy(vehicle);
    }

    return true;
  }

  function observeAirportMobileScreenState() {
    if (bodyObserver) {
      return false;
    }

    bodyObserver = new MutationObserver(function onBodyMutation() {
      window.requestAnimationFrame(syncActiveState);
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: [BODY_SCREEN_ATTR]
    });

    return true;
  }

  async function init() {
    try {
      await loadFleetGallery();
      bindDocumentEvents();
      observeAirportMobileScreenState();
      syncActiveState();

      window.addEventListener("resize", syncActiveState);
      window.addEventListener("pageshow", syncActiveState);
      window.addEventListener("pixkuy:i18n-applied", syncActiveState);

      if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", syncActiveState);
      } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
        mobileQuery.addListener(syncActiveState);
      }
    } catch (error) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PixkuyAirportMobileVehicleGallery = {
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