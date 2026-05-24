/* assets/js/services/in-motion-gallery.js
   Pixkuy en movimiento.
   Responsabilidad:
   - cargar galería curada desde JSON
   - aplicar rotación por recarga de página
   - mantener la selección estable durante rehidrataciones i18n
   - renderizar desktop/mobile desde el mismo contrato
   - ocultar sección si no hay items activos o copy i18n disponible
*/

(function () {
  "use strict";

  var DATA_URL = "assets/js/data/in-motion-gallery.json";
  var MAX_MOBILE_ITEMS = 6;
  var section = document.querySelector("[data-in-motion-section]");
  var mount = document.querySelector("[data-in-motion-gallery]");
  var cachedItems = null;
  var pageLoadSeed = String(Date.now()) + "::" + String(Math.random());

  if (!section || !mount) {
    return;
  }

  function getI18nValue(path) {
    var dict = window.__pixkuyI18nDict || null;
    var parts;
    var cursor;
    var index;

    if (!dict || !path) {
      return "";
    }

    parts = String(path).split(".");
    cursor = dict;

    for (index = 0; index < parts.length; index += 1) {
      if (!cursor || typeof cursor !== "object") {
        return "";
      }

      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor.trim() : "";
  }

  function hashString(value) {
    var text = String(value || "");
    var hash = 2166136261;
    var index;

    for (index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return hash >>> 0;
  }

  function seededSortValue(item, seed) {
    return hashString(seed + "::" + String(item && item.id ? item.id : ""));
  }

  function isValidItem(item) {
    return Boolean(
      item &&
        item.active === true &&
        typeof item.id === "string" &&
        item.id.trim() &&
        typeof item.imageSrc === "string" &&
        item.imageSrc.trim() &&
        typeof item.href === "string" &&
        item.href.trim() &&
        typeof item.titleKey === "string" &&
        item.titleKey.trim() &&
        typeof item.contextKey === "string" &&
        item.contextKey.trim() &&
        typeof item.lineKey === "string" &&
        item.lineKey.trim() &&
        typeof item.monthKey === "string" &&
        item.monthKey.trim()
    );
  }

  function hasRequiredCopy(item) {
    return Boolean(
      getI18nValue(item.titleKey) &&
        getI18nValue(item.contextKey) &&
        getI18nValue(item.lineKey) &&
        getI18nValue(item.monthKey)
    );
  }

  function getSelectedItems(items) {
    var seed = pageLoadSeed;
    var activeItems = items
      .filter(isValidItem)
      .filter(hasRequiredCopy)
      .slice();

    activeItems.sort(function (a, b) {
      return seededSortValue(a, seed) - seededSortValue(b, seed);
    });

    return activeItems.slice(0, MAX_MOBILE_ITEMS);
  }

  function createTextNode(tagName, className, value) {
    var node = document.createElement(tagName);

    node.className = className;
    node.textContent = value;

    return node;
  }

  function createCard(item, index) {
    var title = getI18nValue(item.titleKey);
    var context = getI18nValue(item.contextKey);
    var line = getI18nValue(item.lineKey);
    var month = getI18nValue(item.monthKey);
    var alt = getI18nValue(item.imageAltKey) || title + " — " + context;

    var card = document.createElement("a");
    var media = document.createElement("div");
    var image = document.createElement("img");
    var body = document.createElement("div");

    card.className = "in-motion__card";
    if (index === 0) {
      card.className += " in-motion__card--primary";
    }

    card.href = item.href;
    card.setAttribute("data-in-motion-card", item.id);
    card.setAttribute("data-in-motion-service", item.serviceType || "");

    media.className = "in-motion__media";

    image.className = "in-motion__image";
    image.src = item.imageSrc;
    image.alt = alt;
    image.loading = "lazy";
    image.decoding = "async";

    media.appendChild(image);

    body.className = "in-motion__body";
    body.appendChild(createTextNode("h3", "in-motion__title", title));
    body.appendChild(createTextNode("p", "in-motion__context", context));
    body.appendChild(createTextNode("p", "in-motion__line", line));
    body.appendChild(createTextNode("p", "in-motion__month", month));

    card.appendChild(media);
    card.appendChild(body);

    return card;
  }

  function render(items) {
    var selectedItems = getSelectedItems(items);
    var fragment = document.createDocumentFragment();

    mount.innerHTML = "";

    if (!selectedItems.length) {
      section.hidden = true;
      return false;
    }

    selectedItems.forEach(function (item, index) {
      fragment.appendChild(createCard(item, index));
    });

    mount.appendChild(fragment);
    section.hidden = false;

    return true;
  }

  function normalizeItems(payload) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.items)) {
      return [];
    }

    return payload.items.slice();
  }

  async function loadItems() {
    var response;
    var payload;

    if (cachedItems) {
      return cachedItems.slice();
    }

    response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    payload = await response.json();
    cachedItems = normalizeItems(payload);

    return cachedItems.slice();
  }

  async function initInMotionGallery() {
    try {
      var items = await loadItems();
      render(items);
    } catch (error) {
      section.hidden = true;
    }
  }

  window.addEventListener("pixkuy:i18n-applied", initInMotionGallery);

  if (window.__pixkuyI18nDict) {
    initInMotionGallery();
  }
})();