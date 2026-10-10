(function (window, document) {
  "use strict";
  var dictionary = {};
  var sequence = 0;
  var media = window.matchMedia("(min-width: 721px)");
  function t(key) { return dictionary[key] || key; }
  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }
  function icon(kind) {
    var paths = {
      arrowLeft: '<path d="m15 18-6-6 6-6"/><path d="M21 12H9"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      contact: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
      document: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>'
    };
    var svg = node("span", "airport-booking__icon");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' + (paths[kind] || "") + "</svg>";
    return svg;
  }
  function action(label, callback, primary, iconName, accessibleLabel) {
    var button = node("button", primary ? "cta airport-booking__primary" : "airport-booking__link", label);
    button.type = "button";
    if (iconName) button.replaceChildren(icon(iconName), node("span", "", label));
    if (accessibleLabel) button.setAttribute("aria-label", accessibleLabel);
    button.addEventListener("click", callback);
    return button;
  }
  function field(label, value, className) {
    var row = node("div", "airport-booking__detail" + (className ? " " + className : ""));
    row.append(node("dt", "", label), node("dd", "", value || "—"));
    return row;
  }
  function publicAirportLabel(value, airportId) {
    var raw = String(value || "").trim();
    var code = String(airportId || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    var existing = /^([A-Z]{3})\s*[—·-]\s*(.+)$/.exec(raw);
    if (!code && existing) code = existing[1];
    if (!code) return raw;
    var name = dictionary.airportLabels && dictionary.airportLabels[code.toLowerCase()] || (existing ? existing[2] : raw);
    name = name
      .replace(new RegExp("^(?:" + code + "|AICM)\\s*[—·-]\\s*", "i"), "")
      .replace(new RegExp("\\s*\\(" + code + "\\)\\s*$", "i"), "")
      .trim();
    return name && name.toUpperCase() !== code ? code + " — " + name : code;
  }
  function locationField(label, value, options) {
    options = options || {};
    var row = node("div", "airport-booking__detail airport-booking__location-detail");
    var raw = options.airportId ? publicAirportLabel(value, options.airportId) : String(value || "").trim();
    var separator = raw.indexOf(" — ");
    var primary = raw;
    var secondary = String(options.address || "").trim();
    if (options.airportId && separator > 0) {
      primary = raw.slice(0, separator);
      secondary = raw.slice(separator + 3);
    } else if (separator > 0) {
      primary = raw.slice(0, separator);
      if (!secondary) secondary = raw.slice(separator + 3);
    }
    var description = node("dd", "");
    description.appendChild(node("strong", "airport-booking__location-name", primary || "—"));
    if (secondary) description.appendChild(node("span", "airport-booking__location-address", secondary));
    row.append(node("dt", "", label), description);
    return row;
  }
  function money(amount, currency) {
    if (!Number.isFinite(amount) || !currency) return "—";
    if (window.PixkuyBookingPresentation) return window.PixkuyBookingPresentation.money(amount,currency);
    return new Intl.NumberFormat(document.documentElement.lang || "es", { maximumFractionDigits: 2 }).format(amount / 100) + " " + currency;
  }
  function passengerLabel(snapshot) {
    var key = snapshot.airport_transfer_passenger_fare_key;
    return dictionary.passengerBuckets && dictionary.passengerBuckets[key] || snapshot.airport_transfer_passenger_bucket_label || snapshot.passenger_bucket_label;
  }
  function price(snapshot) {
    if (Number.isSafeInteger(snapshot.airport_desktop_amount_minor)) return money(snapshot.airport_desktop_amount_minor, snapshot.airport_transfer_currency || "MXN");
    var model = snapshot.fleet_model;
    if (model && Number.isFinite(model.amountMinor)) return money(model.amountMinor, model.currency || snapshot.airport_transfer_currency);
    return snapshot.airport_transfer_price_label || snapshot.airport_transfer_price || snapshot.fareLabel || "—";
  }
  function date(value, compact) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "—";
    var parts = value.split("-").map(Number);
    var civil = new Date(parts[0], parts[1] - 1, parts[2], 12);
    if (civil.getFullYear() !== parts[0] || civil.getMonth() !== parts[1] - 1 || civil.getDate() !== parts[2]) return value;
    return new Intl.DateTimeFormat(document.documentElement.lang || "es", compact ? {day:"numeric",month:"short",year:"numeric"} : {dateStyle:"long"}).format(civil);
  }
  function shell(step, back, editData, options) {
    options = options || {};
    var root = node("main", "airport-booking");
    var header = node("header", "airport-booking__header");
    var identity = node("div", "airport-booking__identity");
    var logo = node("img", "airport-booking__logo");
    logo.src = "assets/img/pixkuy-logo_only words-white.webp";
    logo.alt = "Pixkuy Mobility";
    identity.appendChild(logo);
    if (options.showBack !== false && typeof back === "function") {
      identity.appendChild(action(t(options.backLabel || "backTrip"), back, false, "arrowLeft"));
    }
    header.appendChild(identity);
    var progress = node("ol", "airport-booking__progress");
    progress.setAttribute("aria-label", t("progress"));
    ["trip", "data", "review", "payment"].forEach(function (key, index) {
      var complete = step >= 4 || index < step;
      var current = step < 4 && index === step;
      var item = node("li", complete ? "is-complete" : current ? "is-current" : "is-pending");
      var content = node("span", "airport-booking__step-content");
      var marker = node("span", "airport-booking__step-marker", complete ? "✓" : String(index + 1));
      marker.setAttribute("aria-hidden", "true");
      content.append(marker, node("span", "airport-booking__step-label", t(key)));
      if (index === 0 && step < 3) {
        var previous = action(t(key), back, false);
        previous.className = "airport-booking__step-action";
        previous.setAttribute("aria-label", t(key));
        previous.replaceChildren.apply(previous, Array.from(content.childNodes));
        item.appendChild(previous);
      } else if (index === 1 && step === 2 && editData) {
        var dataAction = action(t(key), editData, false);
        dataAction.className = "airport-booking__step-action";
        dataAction.setAttribute("aria-label", t(key));
        dataAction.replaceChildren.apply(dataAction, Array.from(content.childNodes));
        item.appendChild(dataAction);
      } else item.appendChild(content);
      if (current) item.setAttribute("aria-current", "step");
      progress.appendChild(item);
    });
    var caption = step >= 4
      ? t("progress") + " · ✓"
      : t("progress") + " · " + (step + 1) + "/4 · " + t(["trip", "data", "review", "payment"][step]);
    root.append(header, node("p", "airport-booking__step-caption", caption), progress);
    return root;
  }
  function vehicle(snapshot) {
    var section = node("div", "airport-booking__vehicle");
    var selected = snapshot.fleet_model;
    if (!selected) return section;
    var url = window.PixkuyFleetSelection.photo(selected);
    if (url) {
      var photo = node("img", "airport-booking__photo");
      photo.src = url; photo.alt = selected.name || "";
      photo.addEventListener("error", function () { photo.remove(); }, {once:true});
      section.appendChild(photo);
    }
    section.appendChild(node("h3", "", selected.name));
    return section;
  }
  function trip(snapshot) {
    var details = node("dl", "airport-booking__details");
    var airportId = snapshot.airport_transfer_airport_id;
    var toAirport = snapshot.airport_transfer_direction === "destination_to_airport";
    var location = snapshot.airport_transfer_non_airport_location || {};
    var nonAirportLabel = snapshot.airport_transfer_destination_label || snapshot.airport_hotel_hotel_label || snapshot.airport_hotel_hotel;
    var origin = snapshot.airport_transfer_origin || snapshot.origin;
    var destination = snapshot.airport_transfer_destination || snapshot.destination;
    details.append(
      locationField(t("origin"), toAirport ? nonAirportLabel || origin : origin, toAirport ? {address:location.address} : {airportId:airportId}),
      locationField(t("destination"), toAirport ? destination : nonAirportLabel || destination, toAirport ? {airportId:airportId} : {address:location.address}),
      field(t("date"), date(snapshot.airport_transfer_date || snapshot.airport_hotel_date), "airport-booking__detail--compact"),
      field(t("time"), (snapshot.airport_transfer_time || snapshot.airport_hotel_time || "—") + " · " + t("timezone"), "airport-booking__detail--compact"),
      field(t("passengers"), passengerLabel(snapshot), "airport-booking__detail--compact"),
      field(t("luggage"), String(snapshot.airport_transfer_luggage ?? snapshot.luggage ?? "—"), "airport-booking__detail--compact")
    );
    return details;
  }
  function summary(snapshot, pending) {
    var aside = node("aside", "airport-booking__summary");
    aside.append(node("h2", "", t("yourTrip")), vehicle(snapshot), trip(snapshot));
    if (pending) aside.appendChild(node("p", "airport-booking__notice", t("unverified")));
    if (pending && window.PixkuyAirportDesktopBooking && window.PixkuyAirportDesktopBooking.pendingEdit()) {
      aside.appendChild(node("p", "", t("originalAmount")));
    }
    aside.appendChild(node("p", "airport-booking__total", price(snapshot)));
    return aside;
  }
  function focus(element) {
    if (!element) return;
    if (!element.matches("input,button,textarea,select,a")) element.tabIndex = -1;
    element.focus({preventScroll:true});
    element.scrollIntoView({block:"nearest"});
  }
  function focusRouteHeading(element) {
    if (!element) return;
    if (!element.matches("input,button,textarea,select,a")) element.tabIndex = -1;
    window.scrollTo({top:0, left:0, behavior:"instant"});
    element.focus({preventScroll:true});
  }
  function deadline(expiresAt, serverNow, expiredKey, onExpired) {
    var line = node("p", "airport-booking__lead");
    line.setAttribute("data-airport-deadline", "");
    var started = window.performance.now();
    var remaining = Date.parse(expiresAt) - Date.parse(serverNow);
    var notified = false;
    function update() {
      var seconds = Math.max(0, Math.ceil((remaining - (window.performance.now() - started)) / 1000));
      line.textContent = seconds > 0 ? t("paymentRemaining").replace("{time}", Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0")) : t(expiredKey || "paymentDeadlinePassed");
      if (!seconds && !notified) { notified = true; if (onExpired) onExpired(); }
    }
    update();
    var timer = window.setInterval(function () { if (!line.isConnected) window.clearInterval(timer); else update(); }, 1000);
    return line;
  }
  function load() {
    var current = ++sequence;
    var lang = (document.documentElement.lang || "es").toLowerCase();
    if (["es","en","fr","de","it","pt","ru","ko","zh-hans"].indexOf(lang) < 0) lang = "es";
    return window.fetch("assets/i18n/" + lang + "/airport-desktop-booking.json").then(function (response) {
      if (!response.ok) throw new Error("AIRPORT_DESKTOP_TRANSLATION_UNAVAILABLE");
      return response.json();
    }).then(function (value) {
      if (current !== sequence) return;
      dictionary = value;
      window.dispatchEvent(new CustomEvent("pixkuy:airport-desktop-copy"));
    });
  }
  window.PixkuyAirportDesktopView = { t:t, node:node, icon:icon, action:action, field:field, locationField:locationField,
    publicAirportLabel:publicAirportLabel, money:money, price:price, deadline:deadline,
    date:date, shell:shell, vehicle:vehicle, trip:trip, summary:summary, focus:focus,
    focusRouteHeading:focusRouteHeading, media:media, ready:load() };
  window.addEventListener("pixkuy:i18n-applied", function () { load().catch(function () {}); });
})(window, document);
