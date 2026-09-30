(function (window, document) {
  "use strict";

  var panel = document.getElementById("services-expand-airport");
  var media = window.matchMedia("(min-width: 721px)");
  if (!panel) return;

  var form = panel.querySelector(".services-expand__form");
  var eyebrow = panel.querySelector(".services-expand__eyebrow");
  var title = panel.querySelector(".services-expand__title");
  var text = panel.querySelector(".services-expand__text");
  var passengers = panel.querySelector('[data-airport-tariff-role="passengers"]');
  var date = panel.querySelector('[data-airport-tariff-role="date"]');
  var time = panel.querySelector('[data-airport-tariff-role="time"]');
  var fare = panel.querySelector(".services-expand__field--fare");
  var actions = panel.querySelector(".services-expand__actions");
  var origin = panel.querySelector('[data-airport-tariff-role="origin"]');
  var destination = panel.querySelector('[data-airport-tariff-role="destination"]');
  var swap = panel.querySelector(".services-expand__swap");
  if (![form, eyebrow, title, text, passengers, date, time, fare, actions, origin, destination, swap].every(Boolean)) return;

  var layout = null;
  var vehicle = null;
  var empty = null;
  var syncFrame = 0;
  var resizeObserver = window.ResizeObserver ? new window.ResizeObserver(requestSync) : null;

  function translation(key, fallback) {
    var value = key.split(".").reduce(function (part, name) { return part && part[name]; }, window.__pixkuyI18nDict);
    return typeof value === "string" && value.trim() ? value : fallback;
  }

  function icon(kind) {
    var source = document.querySelector('[data-service-expand-trigger="' + kind + '"] .service-card__icon svg');
    var wrapper = document.createElement("span");
    wrapper.className = "airport-endpoint__icon";
    wrapper.setAttribute("aria-hidden", "true");
    if (source) wrapper.appendChild(source.cloneNode(true));
    return wrapper;
  }

  function airportDetails() {
    var api = window.PixkuyAirportZoneTariff;
    var state = api && api.getState && api.getState();
    var id = state && (state.originType === "airport" ? state.originValue : state.destinationType === "airport" ? state.destinationValue : "");
    var airports = (window.PIXKUY_AIRPORT_ZONE_CATALOG || {}).airports || [];
    var item = airports.find(function (airport) { return airport.id === id; });
    return item ? { id: id, iata: item.iata } : null;
  }

  function decorateAirportButtons() {
    if (!layout) return;
    var airport = airportDetails();
    if (!airport) return;
    panel.querySelectorAll(".services-expand__airport-shell .services-expand__control").forEach(function (button) {
      if (button.closest(".services-expand__airport-shell").hidden) return;
      var language = document.documentElement.lang;
      if (button.dataset.airportEndpointId === airport.id && button.dataset.airportEndpointLang === language && button.querySelector(".airport-endpoint__copy")) return;
      var full = translation("services.cards.airport.panel.catalog.airports." + airport.id, button.textContent.trim());
      var prefix = airport.id === "mex" && /^AICM[\s—·-]/.test(full) ? "AICM" : airport.iata;
      var name = full.startsWith(prefix) ? full.slice(prefix.length).replace(/^[\s—·-]+/, "").trim() : full;
      var copy = document.createElement("span");
      copy.className = "airport-endpoint__copy";
      var code = document.createElement("strong");
      code.className = "airport-endpoint__primary";
      code.textContent = airport.iata;
      var detail = document.createElement("span");
      detail.className = "airport-endpoint__secondary";
      detail.textContent = name;
      copy.append(code, detail);
      button.dataset.airportEndpointOriginal = full;
      button.dataset.airportEndpointId = airport.id;
      button.dataset.airportEndpointLang = language;
      button.setAttribute("aria-label", airport.iata + " — " + name);
      button.replaceChildren(icon("airport"), copy);
    });
  }

  function restoreAirportButtons() {
    panel.querySelectorAll(".services-expand__airport-shell .services-expand__control[data-airport-endpoint-original]").forEach(function (button) {
      button.textContent = button.dataset.airportEndpointOriginal;
      button.removeAttribute("aria-label");
      delete button.dataset.airportEndpointOriginal;
      delete button.dataset.airportEndpointId;
      delete button.dataset.airportEndpointLang;
    });
  }

  function installPlaceIcons() {
    panel.querySelectorAll(".services-expand__destination-search, .services-expand__destination-resolved-main").forEach(function (host) {
      if (!host.querySelector(":scope > .airport-endpoint__icon")) host.prepend(icon("direct"));
    });
  }

  function visibleControl(field) {
    return Array.from(field.querySelectorAll(".services-expand__airport-shell .services-expand__control, .services-expand__destination-resolved, .services-expand__destination-search input"))
      .find(function (node) { return node.getClientRects().length && window.getComputedStyle(node).visibility !== "hidden"; });
  }

  function updateSwapCenter() {
    if (!layout) return;
    var first = visibleControl(origin);
    var second = visibleControl(destination);
    if (!first || !second) return;
    var top = swap.getBoundingClientRect().top;
    var firstBox = first.getBoundingClientRect();
    var secondBox = second.getBoundingClientRect();
    var firstCenter = firstBox.top + firstBox.height / 2 - top;
    var secondCenter = secondBox.top + secondBox.height / 2 - top;
    swap.style.setProperty("--airport-origin-center", firstCenter.toFixed(2) + "px");
    swap.style.setProperty("--airport-destination-center", secondCenter.toFixed(2) + "px");
    swap.style.setProperty("--airport-swap-center", ((firstCenter + secondCenter) / 2).toFixed(2) + "px");
  }

  function syncInitial() {
    if (!layout || !empty) return;
    var api = window.PixkuyAirportZoneTariff;
    var ready = !!(api && api.fleetContextKey && api.fleetContextKey());
    var status = panel.querySelector("[data-airport-tariff-availability]");
    var showingStatus = !!(status && !status.hidden && status.textContent.trim());
    empty.hidden = ready || showingStatus || !!panel.querySelector(".airport-desktop-vehicle [data-fleet-single-model], .airport-desktop-vehicle [data-fleet-selection]");
    empty.textContent = translation("services.cards.airport.panel.availability.initial", "Complete los datos del viaje para consultar los vehículos disponibles");
  }

  function requestSync() {
    if (syncFrame || !layout) return;
    syncFrame = window.requestAnimationFrame(function () {
      syncFrame = 0;
      decorateAirportButtons();
      updateSwapCenter();
      syncInitial();
    });
  }

  function selection() {
    return panel.querySelector('[data-fleet-selection="airport_transfer"]');
  }

  function showDesktop() {
    if (layout) return;
    layout = document.createElement("div");
    layout.className = "airport-desktop-layout";
    var trip = document.createElement("div");
    trip.className = "airport-desktop-trip";
    vehicle = document.createElement("div");
    vehicle.className = "airport-desktop-vehicle";
    var heading = document.createElement("p");
    heading.className = "airport-desktop-vehicle__heading";
    heading.setAttribute("data-i18n", "fleetSelection.model");
    heading.textContent = (window.__pixkuyI18nDict || {}).fleetSelection?.model || "Vehículo";
    empty = document.createElement("p");
    empty.className = "airport-desktop-vehicle__empty";
    empty.setAttribute("data-i18n", "services.cards.airport.panel.availability.initial");

    panel.insertBefore(layout, eyebrow);
    layout.appendChild(trip);
    layout.appendChild(vehicle);
    trip.append(eyebrow, title, text, form);
    if (time.parentNode === form) form.insertBefore(passengers, time.nextSibling);
    vehicle.append(heading, empty, fare, actions);
    var control = selection();
    if (control) vehicle.insertBefore(control, fare);
    var model = panel.querySelector("[data-fleet-single-model]");
    if (model) vehicle.insertBefore(model, fare);
    installPlaceIcons();
    if (resizeObserver) { resizeObserver.observe(origin); resizeObserver.observe(destination); }
    requestSync();
    window.requestAnimationFrame(function () { window.PixkuyAirportDestination?.renderDestinationUi(); requestSync(); });
  }

  function showMobile() {
    if (!layout) return;
    if (resizeObserver) resizeObserver.disconnect();
    restoreAirportButtons();
    panel.querySelectorAll(".services-expand__destination > .airport-endpoint__icon, .services-expand__destination .airport-endpoint__icon").forEach(function (node) { node.remove(); });
    var footer = form.querySelector(".airport-mobile-fare-footer");
    if (footer) footer.append(fare, actions);
    else form.append(fare, actions);
    if (date.parentNode === form) form.insertBefore(passengers, date);
    var control = selection();
    if (control) {
      if (footer && footer.parentNode === form) form.insertBefore(control, footer);
      else form.insertBefore(control, actions);
    }
    var model = panel.querySelector("[data-fleet-single-model]");
    if (model) model.remove();
    panel.insertBefore(eyebrow, layout);
    panel.insertBefore(title, layout);
    panel.insertBefore(text, layout);
    panel.insertBefore(form, layout);
    layout.remove();
    layout = null;
    vehicle = null;
    empty = null;
    window.requestAnimationFrame(function () { window.PixkuyAirportDestination?.renderDestinationUi(); });
  }

  function sync() {
    if (media.matches) showDesktop();
    else showMobile();
  }

  media.addEventListener("change", sync);
  new window.MutationObserver(requestSync).observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "data-airport-tariff-type"] });
  new window.MutationObserver(requestSync).observe(actions, { subtree: true, childList: true, characterData: true, attributes: true });
  ["input", "change", "click"].forEach(function (eventName) { form.addEventListener(eventName, requestSync); });
  ["pixkuy:fleet-model-selected", "pixkuy:fleet-offer-invalidated", "pixkuy:fleet-choice-required"].forEach(function (eventName) { document.addEventListener(eventName, requestSync); });
  window.addEventListener("resize", requestSync);
  window.addEventListener("pixkuy:i18n-applied", function () { window.PixkuyAirportDestination?.renderDestinationUi(); requestSync(); });
  document.addEventListener("DOMContentLoaded", requestSync, { once: true });
  sync();
})(window, document);
