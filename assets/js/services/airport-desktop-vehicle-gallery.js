(function (window, document) {
  "use strict";
  var triggerSelector = "#services-expand-airport [data-airport-desktop-vehicle-gallery-trigger]";
  var root = null, previousFocus = null, index = 0, openedModel = "";
  function vehicle() {
    return window.PixkuyFleetSelection && window.PixkuyFleetSelection.gallery("airport_transfer");
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true; root.setAttribute("aria-hidden", "true");
    document.body.removeAttribute("data-airport-desktop-vehicle-gallery-active");
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    previousFocus = null; openedModel = "";
  }
  function refresh() {
    if (!root || root.hidden) return;
    var current = vehicle();
    if (!current || current.id !== openedModel || !window.matchMedia("(min-width: 721px)").matches) { close(); return; }
    if (index >= current.images.length) index = 0;
    var image = root.querySelector("img");
    image.src = current.images[index].src; image.alt = current.imageAlt;
    root.querySelector("[data-gallery-label]").textContent = current.label;
    root.querySelector("[data-gallery-count]").textContent = (index + 1) + " / " + current.images.length;
    root.querySelectorAll("[data-gallery-step]").forEach(function (node) { node.hidden = current.images.length < 2; });
    root.querySelector("[data-gallery-close]").setAttribute("aria-label", current.closeLabel);
    root.querySelector('[data-gallery-step="-1"]').setAttribute("aria-label", current.previousLabel);
    root.querySelector('[data-gallery-step="1"]').setAttribute("aria-label", current.nextLabel);
  }
  function ensure() {
    if (root) return root;
    root = document.createElement("section");
    root.className = "direct-transfer-desktop-vehicle-gallery";
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-hidden", "true"); root.hidden = true;
    root.innerHTML = '<button type="button" tabindex="-1" class="direct-transfer-desktop-vehicle-gallery__backdrop" data-gallery-close></button>' +
      '<div class="direct-transfer-desktop-vehicle-gallery__panel" role="document">' +
      '<button type="button" class="direct-transfer-desktop-vehicle-gallery__close" data-gallery-close>×</button>' +
      '<div class="direct-transfer-desktop-vehicle-gallery__image-wrap"><img class="direct-transfer-desktop-vehicle-gallery__image"></div>' +
      '<div class="direct-transfer-desktop-vehicle-gallery__footer"><p data-gallery-label></p><p data-gallery-count></p></div>' +
      '<button type="button" class="direct-transfer-desktop-vehicle-gallery__nav direct-transfer-desktop-vehicle-gallery__nav--prev" data-gallery-step="-1">‹</button>' +
      '<button type="button" class="direct-transfer-desktop-vehicle-gallery__nav direct-transfer-desktop-vehicle-gallery__nav--next" data-gallery-step="1">›</button></div>';
    root.addEventListener("click", function (event) {
      if (event.target.closest("[data-gallery-close]")) close();
      var step = event.target.closest("[data-gallery-step]");
      if (step) { var current = vehicle(); if (current) { index = (index + Number(step.dataset.galleryStep) + current.images.length) % current.images.length; refresh(); } }
    });
    root.querySelector("img").addEventListener("error", close);
    document.body.appendChild(root);
    return root;
  }
  function open() {
    var current = vehicle();
    if (!current || !current.images.length || !window.matchMedia("(min-width: 721px)").matches) return;
    previousFocus = document.activeElement; openedModel = current.id; index = 0;
    ensure().hidden = false; root.setAttribute("aria-hidden", "false");
    document.body.setAttribute("data-airport-desktop-vehicle-gallery-active", "true");
    refresh(); root.querySelector(".direct-transfer-desktop-vehicle-gallery__close").focus();
  }
  document.addEventListener("click", function (event) { if (event.target.closest(triggerSelector)) { event.preventDefault(); open(); } });
  document.addEventListener("keydown", function (event) {
    if (root && !root.hidden) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "Tab") {
        var buttons = Array.from(root.querySelectorAll(".direct-transfer-desktop-vehicle-gallery__panel button:not([hidden])"));
        var first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); var current = vehicle();
        if (current && current.images.length > 1) { index = (index + (event.key === "ArrowLeft" ? -1 : 1) + current.images.length) % current.images.length; refresh(); }
      }
    } else if ((event.key === "Enter" || event.key === " ") && document.activeElement.matches(triggerSelector)) {
      event.preventDefault(); open();
    }
  });
  document.addEventListener("pixkuy:fleet-offer-invalidated", function (event) { if (event.detail.service === "airport_transfer") close(); });
  document.addEventListener("pixkuy:fleet-model-selected", function (event) { if (event.detail.service === "airport_transfer") refresh(); });
  document.addEventListener("pixkuy:fleet-offer-expired", close);
  window.addEventListener("resize", refresh);
  window.addEventListener("pageshow", refresh);
})(window, document);
