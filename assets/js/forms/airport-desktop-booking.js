(function (window, document) {
  "use strict";
  var view = window.PixkuyAirportDesktopView;
  var form = document.querySelector('form[name="contact"]');
  if (!view || !form) return;
  var KEY = "pixkuy_airport_transfer_checkout_review_snapshot";
  var RETURN = "pixkuy_airport_transfer_checkout_review_return";
  var EDIT_KEY = "pixkuy_airport_pending_edit_v1";
  var mount = null;
  var placeholder = document.createComment("Airport contact form home");
  var snapshot = null;
  var reviewed = null;
  var notice = "";
  var changed = false;
  var pendingPrice = null;
  var busy = false;
  var checkedAt = 0;
  var revision = 0;
  var revalidation = null;
  var revalidationSequence = 0;
  var deferredRender = false;
  var originalSubmitKey = document.getElementById("contact-submit").getAttribute("data-i18n");
  form.before(placeholder);

  function route() { return /^#airport\/(datos|revision|traslado)(?:\/(name|phone|email|luggage|message|legal))?$/.exec(window.location.hash); }
  function active() { return !!(view.media.matches && route() && route()[1] !== "traslado"); }
  function editContext() {
    try {
      var value = JSON.parse(window.sessionStorage.getItem(EDIT_KEY) || "null");
      return value && value.version === 1 && value.token && value.editRevision && value.idempotencyKey ? value : null;
    } catch (_) { return null; }
  }
  function returnToPaymentStatus() {
    var editing = editContext();
    if (!editing) return;
    rememberUnsaved(editing);
    [KEY, RETURN, EDIT_KEY, "pixkuy_fleet_b:airport_transfer"].forEach(function (key) {
      window.sessionStorage.removeItem(key);
    });
    window.location.assign("/booking-cancelled.html?token=" + encodeURIComponent(editing.token));
  }
  function editExpired() {
    var context = editContext();
    return context && context.expiresAt && context.serverNow &&
      Date.parse(context.expiresAt) <= Date.parse(context.serverNow) + Math.max(0, Date.now() - context.receivedAt);
  }
  function rememberUnsaved(context) {
    save();
    var draft = Object.assign({}, snapshot || {});
    ["name","phone","email","luggage","message"].forEach(function (key) {
      var field = form.elements.namedItem(key);
      if(field) draft[key] = field.value;
    });
    window.sessionStorage.setItem("pixkuy_airport_unsaved:" + context.token, JSON.stringify(draft));
  }
  function editDeadline(context) {
    var estimate = new Date(Date.parse(context.serverNow) + Math.max(0, Date.now() - context.receivedAt)).toISOString();
    return view.deadline(context.expiresAt, estimate, "editDeadlinePassed", function () {
      window.queueMicrotask(function () {
        if(!active()) return;
        rememberUnsaved(context);
        form.querySelector("#contact-submit").disabled = true;
        if(mount)mount.querySelectorAll('[data-airport-pay]').forEach(function (button) { button.disabled = true; });
      });
    });
  }
  function refreshEditDeadline() {
    var context = editContext();
    if(!context || !window.PixkuyAirportReview || !window.PixkuyAirportReview.requestStatus) return;
    window.PixkuyAirportReview.requestStatus(context.token).then(function (raw) {
      var current = editContext();
      if(!current || current.token !== context.token || !raw.serverNow || !raw.hold) return;
      current.serverNow = raw.serverNow; current.expiresAt = raw.hold.expiresAt; current.receivedAt = Date.now();
      window.sessionStorage.setItem(EDIT_KEY, JSON.stringify(current));
      // Refresh only timing. Remounting the canonical form can replay its handoff
      // and overwrite local edits that have not been submitted.
      if(active() && mount) mount.querySelectorAll('[data-airport-deadline]').forEach(function (line) {
        line.replaceWith(editDeadline(current));
      });
    }).catch(function () { /* Backend authorization remains mandatory on every write. */ });
  }
  function pending() {
    if (editContext()) return null;
    var attempt = window.PixkuyFleetSelection.read("airport_transfer").attempt;
    return attempt && attempt.state !== "not_committed" ? attempt : null;
  }
  function read() { try { return JSON.parse(window.sessionStorage.getItem(KEY)); } catch (_) { return null; } }
  function restoreTripContext(value) {
    var airport = window.PixkuyAirportZoneTariff;
    var location = value && value.airport_transfer_non_airport_location || {};
    if (!airport || !value || !value.airport_transfer_airport_id) return false;
    var direction = value.airport_transfer_direction === "destination_to_airport"
      ? "hotel_to_airport"
      : "airport_to_hotel";
    if (!airport.setAirportSelection({ airportId: value.airport_transfer_airport_id, direction: direction })) return false;
    airport.setResolvedDestination({
      placeLabel: value.airport_transfer_destination_label || location.address || "",
      zoneId: value.airport_transfer_zone_id,
      placeId: location.place_id,
      primaryType: "lodging",
      lat: location.lat,
      lng: location.lng
    });
    airport.setFareKeySelection({ fareKey: value.airport_transfer_passenger_fare_key });
    [
      ['[data-airport-tariff-role="date"] input', value.airport_transfer_date],
      ['[data-airport-tariff-role="time"] input', value.airport_transfer_time]
    ].forEach(function (entry) {
      var input = document.querySelector(entry[0]);
      if (!input || !entry[1]) return;
      input.value = entry[1];
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    return true;
  }
  function persist(value) {
    snapshot = value;
    try { window.sessionStorage.setItem(KEY, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function offerFresh() {
    var state = window.PixkuyFleetSelection.airportOfferStatus && window.PixkuyFleetSelection.airportOfferStatus();
    return !!(state && state.valid) || !!(
      checkedAt && Date.now() - checkedAt < 5 * 60 * 1000
    );
  }
  function save() {
    var draft = window.PixkuyAirportCheckout.draft();
    if (!draft || !draft.airport_transfer_airport_id) return false;
    snapshot = draft;
    if (mount && route() && route()[1] === "datos") {
      var summary = mount.querySelector(".airport-booking__summary");
      if (summary) {
        var freshSummary = view.summary(snapshot, !!notice || !offerFresh());
        summary.replaceChildren.apply(summary, Array.from(freshSummary.childNodes));
      }
    }
    return persist(draft);
  }
  // Reuse the authorized review-return mechanism for reload and browser history.
  if (route() && read()) window.sessionStorage.setItem(RETURN, "1");

  function navigate(step, focus) {
    revision += 1;
    window.history.pushState(null, "", "#airport/" + step + (focus ? "/" + focus : ""));
    render();
  }
  function restoreForm() {
    placeholder.after(form);
    form.classList.remove("airport-booking__form");
    document.getElementById("contact-submit").setAttribute("data-i18n", originalSubmitKey);
    if (mount) mount.remove();
    mount = null;
    document.body.classList.remove("airport-booking-active");
    var api = window.PixkuyForms;
    if (api && api.syncReservationRequestState) api.syncReservationRequestState(api.getReservationRequestFields(form));
  }
  function goTrip() {
    save(); reviewed = null; notice = ""; pendingPrice = null; checkedAt = 0;
    revalidationSequence += 1;
    revalidation = null;
    navigate("traslado");
  }
  function button(label, callback, primary) {
    var result = view.action(view.t(label), callback, primary);
    result.disabled = busy;
    return result;
  }
  function mountShell(step) {
    restoreForm();
    mount = view.shell(step, goTrip, step === 2 ? function () { navigate("datos"); } : null, { showBack: false });
    document.body.appendChild(mount);
    document.body.classList.add("airport-booking-active");
    return mount;
  }
  function fields() {
    ["name", "phone", "email", "message", "luggage"].forEach(function (name) {
      var field = form.elements.namedItem(name);
      if (!field) return;
      var wrapper = field.closest(".form-field");
      if (name === "luggage") {
        var luggageLabel = wrapper.querySelector("label");
        if (luggageLabel) {
          luggageLabel.removeAttribute("data-i18n");
          luggageLabel.textContent = view.t("luggageOptional");
        }
        field.required = false;
        field.removeAttribute("required");
        wrapper.classList.add("airport-booking__luggage");
        wrapper = wrapper.parentNode;
      }
      wrapper.setAttribute("data-airport-desktop-field", name);
      if (name === "message") {
        var label = wrapper.querySelector("label");
        if (label) {
          label.removeAttribute("data-i18n");
          label.textContent = view.t("notesOptional");
        }
        field.rows = 3;
        var help = wrapper.querySelector(".airport-booking__field-help");
        if (!help) { help = view.node("p", "airport-booking__field-help"); wrapper.appendChild(help); }
        help.textContent = view.t("notesHelp");
      }
    });
  }
  function renderNotice(parent) {
    if (!notice) return;
    var message = view.node("p", "airport-booking__notice", view.t(notice));
    message.setAttribute("role", "status");
    parent.appendChild(message);
    if (notice === "technical" && route() && route()[1] === "datos") {
      parent.appendChild(button("checkAgain", revalidateOffer, true));
    } else if (notice === "incomplete") {
      parent.appendChild(button("editTrip", goTrip, false));
    }
    if (pendingPrice) {
      parent.appendChild(view.node("p", "airport-booking__total", view.price(snapshot) + " → " + view.money(pendingPrice, "MXN")));
      parent.appendChild(button("acceptOffer", function () {
        window.PixkuyAirportCheckout.acceptPrice(pendingPrice);
        pendingPrice = null; notice = ""; reviewed = null; save();
        navigate("datos");
      }, true));
    }
  }
  function captureUiState() {
    var activeElement = document.activeElement;
    return {
      x: window.scrollX,
      y: window.scrollY,
      element: activeElement,
      id: activeElement && activeElement.id || "",
      name: activeElement && activeElement.getAttribute && activeElement.getAttribute("name") || "",
      href: activeElement && activeElement.getAttribute && activeElement.getAttribute("href") || "",
      ariaLabel: activeElement && activeElement.getAttribute && activeElement.getAttribute("aria-label") || ""
    };
  }
  function restoreUiState(state) {
    window.requestAnimationFrame(function () {
      window.scrollTo({ left: state.x, top: state.y, behavior: "instant" });
      var target = state.element && state.element.isConnected ? state.element : null;
      if (!target && state.id) target = document.getElementById(state.id);
      if (!target && state.name && form.elements) target = form.elements.namedItem(state.name);
      if (!target && mount && state.href) {
        target = Array.from(mount.querySelectorAll("a[href]")).find(function (link) { return link.getAttribute("href") === state.href; });
      }
      if (!target && mount && state.ariaLabel) {
        target = Array.from(mount.querySelectorAll("[aria-label]")).find(function (node) { return node.getAttribute("aria-label") === state.ariaLabel; });
      }
      if (target && target.focus) target.focus({ preventScroll: true });
    });
  }
  function finishScreenFocus(main, preserved) {
    if (preserved) restoreUiState(preserved);
    else view.focusRouteHeading(main.querySelector("h1"));
  }
  function dataScreen(preserved) {
    mountShell(1);
    var layout = view.node("div", "airport-booking__layout");
    var main = view.node("section", "");
    var editing = editContext();
    main.append(
      view.node("h1", "", view.t(editing ? "editDataTitle" : "dataTitle")),
      view.node("p", "airport-booking__lead", view.t(editing ? "editDataText" : "dataText"))
    );
    if (editing) main.appendChild(view.node("p", "airport-booking__reference", view.t("reference") + ": " + editing.publicCode));
    if (editing && editing.expiresAt && editing.serverNow) main.appendChild(editDeadline(editing));
    renderNotice(main);
    fields();
    form.classList.add("airport-booking__form");
    main.appendChild(form);
    var submit = form.querySelector("#contact-submit");
    submit.removeAttribute("data-i18n"); submit.textContent = view.t("reviewCta");
    main.append(view.node("p", "airport-booking__lead", view.t("noPayment")));
    if (editing) main.appendChild(button("exitEdit", returnToPaymentStatus, false));
    layout.append(main, view.summary(snapshot || {}, !!notice || !offerFresh())); mount.appendChild(layout);
    var focus = route()[2];
    if (focus) view.focus(focus === "legal" ? form.querySelector('[type="checkbox"]') : form.elements.namedItem(focus));
    else finishScreenFocus(main, preserved);
  }
  function reviewBlock(title, focus, content) {
    var section = view.node("section", "airport-booking__block");
    var heading = view.node("div", "airport-booking__block-heading");
    var edit = button("edit", function () { focus === "trip" ? goTrip() : navigate("datos", focus); });
    edit.replaceChildren(view.icon("edit"), view.node("span", "", view.t("edit")));
    edit.setAttribute("aria-label", view.t("edit") + ": " + view.t(title));
    heading.append(view.node("h2", "", view.t(title)), edit);
    section.append(heading, content);
    return section;
  }
  function pageCopy(path, fallback) {
    var value = String(path).split(".").reduce(function (cursor, key) {
      return cursor && cursor[key];
    }, window.__pixkuyI18nDict);
    return typeof value === "string" && value.trim() ? value : fallback;
  }
  function legalLinks() {
    var copy = view.node("div", "legal-acceptance__links");
    [
      [snapshot.legal_acceptance_terms_url || "legal/terms.html", "terms.acceptance.viewTerms", "Ver Términos"],
      [snapshot.legal_acceptance_cancellations_url || "legal/cancellations.html", "terms.acceptance.viewCancellations", "Ver Cancelaciones"],
      [snapshot.legal_acceptance_privacy_url || "legal/privacy.html", "terms.acceptance.viewPrivacy", "Ver Privacidad"]
    ].forEach(function (item) {
      var link = view.node("a", "", pageCopy(item[1], item[2]));
      link.href = item[0];
      copy.appendChild(link);
    });
    return copy;
  }
  function conditions() {
    var accepted = snapshot.legal_acceptance_accepted === "true";
    var legal = view.node("section", "airport-booking__conditions");
    var status = view.node("p", "airport-booking__conditions-status");
    status.append(view.icon(accepted ? "check" : "document"), view.node("span", "", view.t(accepted ? "accepted" : "conditions")));
    legal.appendChild(status);
    var links = form.querySelector("[data-airport-transfer-checkout-legal-acceptance] .legal-acceptance__links");
    var copy = links ? links.cloneNode(true) : legalLinks();
    Array.from(copy.querySelectorAll("a")).forEach(function (link) { link.prepend(view.icon("document")); });
    legal.appendChild(copy);
    return legal;
  }
  function reviewScreen(preserved) {
    mountShell(2);
    var layout = view.node("div", "airport-booking__layout");
    var main = view.node("section", "");
    main.append(view.node("h1", "", view.t("reviewTitle")), view.node("p", "airport-booking__lead", view.t("reviewText")));
    var contact = view.node("dl", "airport-booking__details");
    contact.append(view.field(view.t("name"), snapshot.name), view.field(view.t("phone"), snapshot.phone), view.field(view.t("email"), snapshot.email));
    var notes = view.node("dl", "airport-booking__details");
    notes.append(view.field(view.t("luggage"), snapshot.luggage), view.field(view.t("transferNotes"),
      Object.prototype.hasOwnProperty.call(snapshot, "message") ? snapshot.message : snapshot.notes));
    main.append(reviewBlock("trip", "trip", view.trip(snapshot)), reviewBlock("contact", "name", contact), reviewBlock("transferNotes", "luggage", notes), conditions());
    var aside = view.node("aside", "airport-booking__summary");
    aside.append(view.node("h2", "", view.t("amountTitle")), view.vehicle(snapshot));
    if (notice) aside.appendChild(view.node("p", "", view.t("lastReviewedAmount")));
    aside.appendChild(view.node("p", "airport-booking__total", view.price(snapshot)));
    renderNotice(aside);
    var editing = editContext();
    if(editing && editing.expiresAt && editing.serverNow) aside.appendChild(editDeadline(editing));
    else if(!editing) aside.appendChild(view.node("p", "airport-booking__lead", view.t("paymentPolicy")));
    if (editing && notice === "paymentWindowClosed") aside.appendChild(button("recover", function () {
      window.location.assign("/booking-cancelled.html?token=" + encodeURIComponent(editing.token));
    }, true));
    else if (editing && editing.attempt) aside.appendChild(button("recoverSave", recoverReplacement, true));
    else if (editing && notice === "saveRejected") aside.appendChild(button("recover", function () {
      window.location.assign("/booking-cancelled.html?token=" + encodeURIComponent(editing.token));
    }, true));
    else if (pending()) aside.appendChild(button("recover", recover, true));
    else if (changed) aside.appendChild(button("acceptOffer", function () { changed = false; reviewed = snapshot; notice = ""; render(); }, true));
    else {
      var checkoutButton = button(notice ? "checkAgain" : editContext() ? "replacePayCta" : "payCta", checkout, true);
      checkoutButton.setAttribute('data-airport-pay','');
      if (revalidation || editExpired()) checkoutButton.disabled = true;
      aside.appendChild(checkoutButton);
    }
    aside.appendChild(view.node("p", "airport-booking__lead", view.t("confirmAfterPayment")));
    layout.append(main, aside); mount.append(layout);
    finishScreenFocus(main, preserved);
  }
  function commercialKey(value) {
    var amount = value.airport_desktop_amount_minor || Math.round(Number(String(value.airport_transfer_price || "").replace(/[^0-9.]/g, "")) * 100);
    var location = value.airport_transfer_non_airport_location || {};
    var selection = value.fleet_selection || {};
    var placeId = location.place_id || value.lodgingPlaceId || (
      value.airport_transfer_direction === "destination_to_airport"
        ? value.airport_transfer_origin_place_id
        : value.airport_transfer_destination_place_id
    );
    return JSON.stringify([
      String(selection.model_id || ""),
      Number(selection.model_revision || 0),
      Number(amount || 0),
      String(value.airport_transfer_date || ""),
      String(value.airport_transfer_time || "").slice(0, 5),
      String(value.airport_transfer_airport_id || ""),
      String(value.airport_transfer_direction || ""),
      String(value.airport_transfer_zone_id || ""),
      String(placeId || ""),
      String(value.airport_transfer_passenger_fare_key || "")
    ]);
  }
  function receiveCheckoutResult(result, editing) {
    var body = result.body || {};
    if (body.code === "CHECKOUT_PAYMENT_WINDOW_CLOSED") {
      notice = "paymentWindowClosed";
      return;
    }
    if (editing && !result.ok && body.code &&
        (body.recovery && body.recovery.state === "not_committed" ||
          result.statusCode >= 400 && result.statusCode < 500 && !body.recovery)) {
      notice = "saveRejected"; reviewed = null; return;
    }
    if (editing && body.recovery && ["unknown", "committed"].indexOf(body.recovery.state) >= 0) {
      notice = "saveUncertain"; reviewed = null; return;
    }

    if (result.ok && body.checkoutUrl && body.bookingStatusToken) {
      if (editing) {
        window.PixkuyFleetSelection.bindReservation("airport_transfer", body.bookingStatusToken);
        window.sessionStorage.removeItem(EDIT_KEY);
        window.PixkuyFleetSelection.completeAttempt("airport_transfer", body.bookingStatusToken);
      }
      window.PixkuyAirportReview.redirectToCheckout(body.checkoutUrl, body.bookingStatusToken);
    } else if (body.code === "CHECKOUT_ALREADY_COMPLETED" ||
        body.recovery && body.recovery.state === "authoritative_status") {
      if (editing) window.sessionStorage.removeItem(EDIT_KEY);
      window.location.assign("/booking-success.html?token=" + encodeURIComponent(editing ? editing.token : body.bookingStatusToken || ""));
    } else if (body.recovery && body.recovery.action === "reservation_status" &&
        (body.bookingStatusToken || editing && editing.token)) {
      window.location.assign("/booking-success.html?token=" + encodeURIComponent(body.bookingStatusToken || editing.token));
    } else {
      notice = body.code === "CHECKOUT_REPLACEMENT_STALE" ? "offerChanged" :
        body.recovery && body.recovery.state === "not_committed" ? "offerChanged" : editing ? "saveUncertain" : "uncertain";
      reviewed = null;
    }
  }
  function recoverReplacement() {
    var editing = editContext();
    if (busy || !editing || !editing.attempt) return;
    busy = true; render();
    window.PixkuyAirportReview.requestReplacement(snapshot, editing).then(function (result) {
      receiveCheckoutResult(result, editing);
    }).catch(function () { notice = "saveUncertain"; }).finally(function () { busy = false; if (active()) render(); });
  }
  function checkout() {
    if(editExpired()) { save(); notice = "editDeadlinePassed"; renderPreservingUi(); return; }
    if (busy) return;
    var editingAttempt = editContext();
    if (editingAttempt && editingAttempt.attempt) { recoverReplacement(); return; }
    if (pending()) { recover(); return; }
    if (!window.PixkuyAirportCheckout.validate()) {
      navigate("datos");
      window.PixkuyAirportCheckout.validate();
      focusError();
      return;
    }
    var before = snapshot;
    var checkingOnly = !!notice || !reviewed;
    var current = revision;
    busy = true; render();
    window.PixkuyAirportCheckout.prepare().then(function (fresh) {
      if (current !== revision || !active() || route()[1] !== "revision") return;
      snapshot = fresh;
      checkedAt = Date.now();
      if (checkingOnly || commercialKey(before) !== commercialKey(fresh)) {
        changed = commercialKey(before) !== commercialKey(fresh);
        notice = changed ? "offerChanged" : "";
        if (!changed) reviewed = fresh;
        return;
      }
      if (fresh.legal_acceptance_accepted !== "true" || !window.PixkuyAirportReview.validateSnapshot(fresh)) {
        notice = "incomplete";
        reviewed = null;
        return;
      }
      var editing = editContext();
      var request = editing
        ? window.PixkuyAirportReview.requestReplacement(fresh, editing)
        : window.PixkuyAirportReview.requestCheckout(fresh);
      return request.then(function (result) {
        receiveCheckoutResult(result, editing);
      });
    }).catch(function (error) {
      if (current !== revision) return;
      var failedEdit = editContext();
      notice = requestErrorKind(error, failedEdit ? failedEdit.attempt ? "saveUncertain" : "technical" : "uncertain");
      reviewed = null;
    }).finally(function () { busy = false; if (active()) render(); });
  }
  function recover() {
    if (busy) return;
    busy = true; render();
    window.PixkuyFleetSelection.recoverAttempt("airport_transfer", function (token) { window.location.assign("/booking-success.html?token=" + encodeURIComponent(token)); }).then(function () {
      notice = "offerChanged"; reviewed = null;
    }).catch(function () { notice = "uncertain"; }).finally(function () { busy = false; if (active()) render(); });
  }
  function errorKind(result) {
    pendingPrice = null;
    var storedState = window.PixkuyFleetSelection.read("airport_transfer");
    var storedResult = storedState && storedState.precheck && storedState.precheck.body && storedState.precheck.body.result;
    var price = result && result.raw && result.raw.result && result.raw.result.price || storedResult && storedResult.price;
    var availabilityCode = result && result.raw && result.raw.result &&
      result.raw.result.availability && result.raw.result.availability.code ||
      storedResult && storedResult.availability && storedResult.availability.code;
    if (price && price.reason === "AIRPORT_TRANSFER_PRICE_MISMATCH" && Number.isSafeInteger(price.actualAmountMinor) && price.actualAmountMinor > 0) {
      pendingPrice = price.actualAmountMinor;
      return "offerChanged";
    }
    if (result && result.ok === true && result.available === false) return "unavailable";
    if (/NO_AVAILABILITY|FLEET_UNAVAILABLE|TRANSFER_UNAVAILABLE/.test((result && result.code || "") + " " + (availabilityCode || ""))) return "unavailable";
    if (!result || /FAILED|UNDETERMINED|TECHNICAL/.test(result.code || "")) return "technical";
    if (!result.ok && !result.code) return "technical";
    return "unavailable";
  }
  function requestErrorKind(error, fallback) {
    if (error && /^INVALID_AIRPORT_TRANSFER_/.test(error.message || "")) return "incomplete";
    if (error && /NO_AVAILABILITY|FLEET_UNAVAILABLE|TRANSFER_UNAVAILABLE/.test(error.message || "")) return "unavailable";
    return error && error.result ? errorKind(error.result) : fallback;
  }
  function legalOpen() {
    var overlay = document.getElementById("pixkuy-legal-overlay");
    return !!(overlay && overlay.getAttribute("data-open") === "1");
  }
  function renderPreservingUi() {
    if (legalOpen()) { deferredRender = true; return; }
    render({ preserve: true });
  }
  function revalidateOffer() {
    if(editExpired()) { notice = "editDeadlinePassed"; renderPreservingUi(); return Promise.resolve(false); }
    if (!active() || pending()) return Promise.resolve(false);
    if (offerFresh()) {
      if (notice === "checking" || notice === "unverified") {
        notice = "";
        renderPreservingUi();
      }
      return Promise.resolve(true);
    }
    if (revalidation) return revalidation;
    var before = snapshot;
    var current = ++revalidationSequence;
    pendingPrice = null;
    changed = false;
    reviewed = null;
    notice = "checking";
    var request = window.PixkuyAirportCheckout.prepare({ interactive: false });
    revalidation = request;
    renderPreservingUi();
    request.then(function (fresh) {
      if (current !== revalidationSequence || !active()) return false;
      changed = commercialKey(before) !== commercialKey(fresh);
      notice = changed ? "offerChanged" : "";
      checkedAt = Date.now();
      persist(fresh);
      reviewed = route()[1] === "revision" && !changed ? fresh : null;
      return true;
    }).catch(function (error) {
      if (current !== revalidationSequence || !active()) return false;
      var fleet = window.PixkuyFleetSelection.read("airport_transfer");
      if (fleet && fleet.explicit && !fleet.selected && fleet.offer && fleet.offer.models && fleet.offer.models.length) {
        goTrip();
        return false;
      }
      notice = requestErrorKind(error, "technical");
      changed = false;
      reviewed = null;
      return false;
    }).finally(function () {
      if (current !== revalidationSequence) return;
      if (revalidation === request) revalidation = null;
      if (active()) renderPreservingUi();
    });
    return request;
  }
  function render(options) {
    if (!active()) {
      restoreForm();
      if (route() && route()[1] === "traslado") {
        window.PixkuyFleetSelection.enterPanel("airport_transfer");
        var panel = document.getElementById("services-expand-airport");
        if (panel) {
          panel.hidden = false;
          if (window.PixkuyAirportZoneTariff && window.PixkuyAirportZoneTariff.reconcileAvailability) {
            window.PixkuyAirportZoneTariff.reconcileAvailability();
          }
          panel.scrollIntoView({block:"start", behavior:"instant"});
          view.focus(panel.querySelector('[data-airport-tariff-role="date"] input'));
        }
      }
      return;
    }
    snapshot = snapshot || read();
    if (!snapshot) { goTrip(); return; }
    if (form.elements.namedItem("service_type").value !== "airport_hotel") {
      window.PixkuyForms.contactServiceState.setActiveServiceType("airport_hotel", {source:"airport-desktop-route", skipConfirm:true});
      window.PixkuyForms.applyContactAirportHotelHandoff(snapshot);
      window.PixkuyFleetSelection.editFromReview("airport_transfer");
    }
    var preserved = options && options.preserve ? captureUiState() : null;
    if (route()[1] === "revision" && !pending() && !offerFresh() && !notice) {
      notice = "unverified";
    }
    if (route()[1] === "revision" && editContext() && editContext().attempt) notice = "saveUncertain";
    if (route()[1] === "revision") reviewScreen(preserved); else dataScreen(preserved);
  }
  function focusError() {
    var invalid = form.querySelector('[aria-invalid="true"]');
    view.focus(invalid || form.querySelector("[data-airport-desktop-field] input"));
  }
  window.PixkuyAirportDesktopBooking = {
    pendingEdit: function () {
      var editing = view.media.matches && route() && editContext();
      return editing ? { token: editing.token, revision: editing.editRevision } : null;
    },
    active: active,
    revision: function () { return revision; },
    focusError: focusError,
    open: function () {
      if (!view.media.matches) return false;
      save(); notice = ""; reviewed = null; pendingPrice = null; checkedAt = Date.now();
      window.PixkuyFleetSelection.editFromReview("airport_transfer");
      navigate("datos"); return true;
    },
    review: function (value) {
      if (!active()) return false;
      persist(value); reviewed = value; notice = ""; changed = false; pendingPrice = null;
      checkedAt = Date.now();
      navigate("revision");
      return true;
    },
    availabilityError: function (result) {
      if (!active()) return false;
      var fleet = window.PixkuyFleetSelection.read("airport_transfer");
      var selectedModel = snapshot && snapshot.fleet_selection && snapshot.fleet_selection.model_id;
      if (selectedModel && fleet && fleet.explicit && !fleet.selected) {
        goTrip();
        return true;
      }
      notice = errorKind(result); renderPreservingUi(); return true;
    }
  };
  form.addEventListener("input", function () {
    if (!active()) return;
    revision += 1;
    save(); reviewed = null;
    var submit = document.getElementById("contact-submit");
    window.queueMicrotask(function () { submit.textContent = view.t("reviewCta"); });
  });
  form.addEventListener("change", function () { if (active()) save(); });
  form.addEventListener("blur", function () {
    if (active()) window.queueMicrotask(function () { form.querySelector("#contact-submit").textContent = view.t("reviewCta"); });
  }, true);
  document.addEventListener("pixkuy:fleet-choice-required", function (event) {
    if (active() && event.detail.service === "airport_transfer") {
      notice = "offerChanged";
      // The canonical configurator owns explicit model choice and its waiting precheck.
      save(); navigate("traslado");
    }
  });
  window.addEventListener("popstate", function () { revision += 1; render(); });
  window.addEventListener("hashchange", render);
  window.addEventListener("pageshow", function () {
    refreshEditDeadline();
    busy = false;
    if (!active()) return;
    if (window.PixkuyFleetSelection.expireAirportOfferIfNeeded) window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
    render();
  });
  document.addEventListener("pixkuy:fleet-offer-expired", function (event) {
    if (event.detail && event.detail.service === "airport_transfer" && active()) {
      checkedAt = 0;
      reviewed = null;
      if (!pending()) notice = "unverified";
      renderPreservingUi();
    }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !active()) return;
    refreshEditDeadline();
    if (window.PixkuyFleetSelection.expireAirportOfferIfNeeded) window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
    if (route()[1] === "revision" && !busy && !notice && !offerFresh()) {
      reviewed = null;
      notice = "unverified";
      renderPreservingUi();
    }
  });
  document.addEventListener("pixkuy:legal-overlay-closed", function () {
    if (!deferredRender || !active()) return;
    deferredRender = false;
    window.requestAnimationFrame(renderPreservingUi);
  });
  window.addEventListener("pixkuy:airport-desktop-copy", function () { if (active()) renderPreservingUi(); });
  view.media.addEventListener("change", function () {
    revision += 1;
    if (!view.media.matches && mount) {
      save(); restoreForm();
      document.getElementById("contact").scrollIntoView({block:"start"});
    } else {
      if (form.elements.namedItem("service_type").value !== "airport_hotel") window.history.replaceState(null, "", "#contact");
      render();
    }
  });
  window.addEventListener("beforeunload", function (event) {
    if (active() && !save()) { event.preventDefault(); event.returnValue = ""; }
  });
  view.ready.then(function () {
    window.setTimeout(function () {
      if (route()) {
        if(!mount) {
          snapshot = read();
          if (editContext() || snapshot && snapshot.airport_new_continuation) restoreTripContext(snapshot);
          render();
        }
        refreshEditDeadline();
      }
    }, 350);
  });
})(window, document);
