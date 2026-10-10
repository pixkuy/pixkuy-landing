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
  var revision = 0;
  var deadlineInitialContext = "";
  var revalidation = null;
  var revalidationSequence = 0;
  var mobileReviewAttempt = "";
  var mobileReviewHydrated = document.readyState === "complete";
  var deferredRender = false;
  var mobileUiFrame = 0;
  var mobileEntryPending = false;
  var originalSubmitKey = document.getElementById("contact-submit").getAttribute("data-i18n");
  form.before(placeholder);

  function route() { return /^#airport\/(datos|revision|traslado)(?:\/(name|phone|email|luggage|message|legal))?$/.exec(window.location.hash); }
  function active() { return !!(route() && route()[1] !== "traslado"); }
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
    // An unresolved replacement keeps its frozen request and identity on exit.
    if (!editing.attempt) [KEY, RETURN, EDIT_KEY, "pixkuy_fleet_b:airport_transfer"].forEach(function (key) {
      window.sessionStorage.removeItem(key);
    });
    window.location.assign("/booking-cancelled.html?token=" + encodeURIComponent(editing.token));
  }
  function editExpired() {
    var context = editContext();
    return context && context.expiresAt && context.serverNow &&
      Date.parse(context.expiresAt) <= Date.parse(context.serverNow) + Math.max(0, Date.now() - context.receivedAt);
  }
  function guardReviewExpiry() {
    if (!editExpired()) return false;
    busy = false; reviewed = null; notice = "editDeadlinePassed";
    if (active()) renderPreservingUi();
    return true;
  }
  function protectExpiredReview() {
    var submit = form.querySelector("#contact-submit");
    // Shared form synchronizers may enable their valid fields. They cannot
    // override this editor's existing deadline guard (nor own another service).
    if (active() && route()[1] === "datos" && editExpired() && !submit.disabled) {
      submit.disabled = true;
      submit.setAttribute("aria-disabled", "true");
    }
  }
  new window.MutationObserver(protectExpiredReview).observe(form.querySelector("#contact-submit"), {
    attributes: true, attributeFilter: ["disabled"]
  });
  function editProvenance() {
    var value = read() || snapshot, context = editContext();
    return window.history.state && window.history.state.airportPendingToken ||
      value && value.airport_pending_token || context && context.token;
  }
  function missingEditAuthority() {
    var token = editProvenance(), context = editContext();
    return !!token && (!context || context.token !== token);
  }
  function missingEditDraft() {
    var token = editProvenance(), saved = read(), context = editContext();
    // A dispatched replacement owns its frozen recovery payload. Presentation
    // completeness must not replace that existing recovery with a new attempt.
    if (context && context.attempt) return false;
    return !!token && (!saved || saved.airport_pending_token !== token ||
      ["name", "phone", "email", "message"].some(function (key) {
        return !Object.prototype.hasOwnProperty.call(saved, key);
      }));
  }
  function editRecoveryRequired() { return missingEditAuthority() || missingEditDraft(); }
  function restorePendingContact() {
    if (!editProvenance() || editRecoveryRequired()) return false;
    // History can restore an older document or an unhydrated configurator.
    // Read the current edit draft, not that document's cached snapshot/form.
    // Own empty properties are deliberate deletions and must remain empty.
    snapshot = read();
    return window.PixkuyForms.restoreContactAirportHotelDraftFields(snapshot);
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
  function refreshEditDeadline(initial) {
    var context = editContext();
    if(!context || !window.PixkuyAirportReview || !window.PixkuyAirportReview.requestStatus) return;
    // pageshow and the ready fallback initialize the same document. Refresh once
    // there; history restoration, visibility and explicit resume still refresh.
    var key = context.token + "|" + context.editRevision;
    if (initial && deadlineInitialContext === key) return;
    deadlineInitialContext = key;
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
    }).catch(function () {
      if (deadlineInitialContext === key) deadlineInitialContext = "";
      // Backend authorization remains mandatory on every write.
    });
  }
  function pending() {
    if (editContext()) return null;
    var attempt = window.PixkuyFleetSelection.read("airport_transfer").attempt;
    return attempt && attempt.state !== "not_committed" ? attempt : null;
  }
  function read() { try { return JSON.parse(window.sessionStorage.getItem(KEY)); } catch (_) { return null; } }
  function restoreTripContext(value) {
    var airport = window.PixkuyAirportZoneTariff;
    var location = window.PixkuyAirportMobileDraft.locationOf(value) || {};
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
    var context = editContext(), prior = read();
    if (context) {
      value.airport_pending_token = context.token;
      value.airport_draft_stage = route() ? route()[1] : "datos";
    } else if (prior && prior.airport_pending_token && !value.airport_new_continuation) {
      value.airport_pending_token = prior.airport_pending_token;
    }
    if (!view.media.matches && !editContext() && !pending()) {
      value.airport_mobile_draft = true;
      value.airport_draft_stage = route() ? route()[1] : "datos";
    }
    snapshot = value;
    try { window.sessionStorage.setItem(KEY, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function offerFresh() {
    var state = window.PixkuyFleetSelection.airportOfferStatus && window.PixkuyFleetSelection.airportOfferStatus();
    return !!(state && state.valid);
  }
  function save() {
    // The shared form can already belong to another service during navigation.
    if (form.elements.namedItem("service_type").value !== "airport_hotel") return false;
    if (editRecoveryRequired()) return false;
    var draft = window.PixkuyAirportCheckout.draft();
    if (!draft || !draft.airport_transfer_airport_id) return false;
    snapshot = draft;
    if (mount && route() && route()[1] === "datos") {
      var summary = mount.querySelector(".airport-booking__summary");
      if (summary) {
        var freshSummary = view.summary(snapshot, !!notice || !offerFresh());
        if (summary.innerHTML !== freshSummary.innerHTML) summary.replaceChildren.apply(summary, Array.from(freshSummary.childNodes));
      }
    }
    return persist(draft);
  }
  // Reuse the authorized review-return mechanism for reload and browser history.
  if (route() && route()[1] !== "traslado" && read()) window.sessionStorage.setItem(RETURN, "1");

  function navigate(step, focus, replace) {
    if (!view.media.matches) {
      mobileReviewAttempt = "";
      revalidationSequence += 1;
      revalidation = null;
      if (notice === "checking" || notice === "unverified") notice = "";
    }
    revision += 1;
    window.history[replace ? "replaceState" : "pushState"](editProvenance() ? {airportPendingToken:editProvenance()} : null, "", "#airport/" + step + (focus ? "/" + focus : ""));
    render();
  }
  var mobileAppearance = [];
  function mobileStyle(node, attributes, text) {
    if (!node) return;
    mobileAppearance.push({node:node, attributes:Object.keys(attributes).map(function (key) { return [key,node.getAttribute(key)]; }), text:text === undefined ? undefined : node.textContent});
    Object.keys(attributes).forEach(function (key) { if (attributes[key] === null) node.removeAttribute(key); else node.setAttribute(key,attributes[key]); });
    if (text !== undefined) node.textContent = text;
  }
  function mobileScroller() { return document.querySelector('.airport-mobile-route__content'); }
  function focusMobileScreen(preserved) {
    var currentMount = mount;
    if (!preserved) mobileEntryPending = true;
    window.cancelAnimationFrame(mobileUiFrame);
    mobileUiFrame = window.requestAnimationFrame(function () {
      mobileUiFrame = 0;
      if (!mount || mount !== currentMount || view.media.matches) return;
      if (mobileEntryPending) {
        mobileEntryPending = false;
        // A user can reach a field before this deferred entry frame (notably WebKit).
        // Do not steal focus/keyboard or scroll away from an interaction already begun.
        var focused=document.activeElement;
        if(focused && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(focused.tagName) && focused.getClientRects().length && window.getComputedStyle(focused).visibility!=='hidden')return;
        mount.querySelector('.airport-mobile-flow__back').focus({preventScroll:true});
        mobileScroller().scrollTop = 0;
      } else if (preserved) restoreUiPosition(preserved);
    });
  }
  function restoreForm() {
    form.inert = false;
    mobileAppearance.reverse().forEach(function (entry) {
      entry.attributes.forEach(function (attribute) { if (attribute[1] === null) entry.node.removeAttribute(attribute[0]); else entry.node.setAttribute(attribute[0],attribute[1]); });
      if (entry.text !== undefined) entry.node.textContent = entry.text;
    });
    mobileAppearance = [];
    placeholder.after(form);
    form.classList.remove("airport-booking__form");
    document.getElementById("contact-submit").setAttribute("data-i18n", originalSubmitKey);
    if (mount) mount.remove();
    mount = null;
    document.body.classList.remove("airport-booking-active");
    document.body.setAttribute("data-airport-mobile-contact-step-active", "false");
    document.getElementById("services-expand-airport").removeAttribute("data-airport-mobile-primary-step-hidden");
    var api = window.PixkuyForms;
    if (api && api.syncReservationRequestState) api.syncReservationRequestState(api.getReservationRequestFields(form));
  }
  function goTrip() {
    save(); reviewed = null; notice = ""; pendingPrice = null;
    if (!view.media.matches && window.PixkuyAirportMobileBookingFlow) {
      window.PixkuyAirportMobileBookingFlow.setLuggage(form.elements.namedItem("luggage").value);
    }
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
    if (!view.media.matches) {
      if (!window.PixkuyAirportMobileBookingFlow.isOpen()) window.PixkuyAirportMobileBookingFlow.open();
      mount = window.PixkuyAirportMobileContactStep.createBookingView(snapshot || {}, step === 2 ? function () { navigate("datos"); } : goTrip, step === 2);
      mobileScroller().appendChild(mount);
      document.getElementById("services-expand-airport").setAttribute("data-airport-mobile-primary-step-hidden", "true");
      document.body.classList.add("airport-booking-active");
      document.body.setAttribute("data-airport-mobile-contact-step-active", "true");
      mount.setAttribute("data-airport-mobile-booking-step", step === 1 ? "datos" : "revision");
      return mount;
    }
    mount = view.shell(step, goTrip, step === 2 ? function () { navigate("datos"); } : null, { showBack: false });
    document.body.appendChild(mount);
    document.body.classList.add("airport-booking-active");
    if (!view.media.matches) {
      document.body.setAttribute("data-airport-mobile-contact-step-active", step === 1 ? "true" : "false");
      mount.setAttribute("data-airport-mobile-booking-step", step === 1 ? "datos" : "revision");
    }
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
    } else if (notice === "incomplete" && view.media.matches) {
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
      y: !view.media.matches && mount ? mobileScroller().scrollTop : window.scrollY,
      element: activeElement,
      id: activeElement && activeElement.id || "",
      name: activeElement && activeElement.getAttribute && activeElement.getAttribute("name") || "",
      href: activeElement && activeElement.getAttribute && activeElement.getAttribute("href") || "",
      ariaLabel: activeElement && activeElement.getAttribute && activeElement.getAttribute("aria-label") || ""
    };
  }
  function restoreUiState(state) {
    if (!view.media.matches) { focusMobileScreen(state); return; }
    window.requestAnimationFrame(function () {
      restoreUiPosition(state);
    });
  }
  function restoreUiPosition(state) {
      if (!view.media.matches && mount) mobileScroller().scrollTop = state.y;
      else window.scrollTo({ left: state.x, top: state.y, behavior: "instant" });
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
  }
  function finishScreenFocus(main, preserved) {
    if (preserved) restoreUiState(preserved);
    else view.focusRouteHeading(main.querySelector("h1"));
  }
  function dataScreen(preserved) {
    mountShell(1);
    if (!view.media.matches) { mobileDataScreen(preserved); return; }
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
  function mobileDataScreen(preserved) {
    fields();
    form.inert = !mobileReviewHydrated;
    form.classList.add("airport-booking__form");
    mobileStyle(form, {class:form.className + " airport-mobile-contact-step__form"});
    ["name","phone","email","message"].forEach(function (name) {
      var input = form.elements.namedItem(name), wrapper = input.closest('.form-field');
      var key = name === "message" ? "notes" : name;
      mobileStyle(wrapper, {class:wrapper.className + " airport-mobile-contact-step__field"});
      mobileStyle(input, {class:input.className + " airport-mobile-contact-step__control" + (name === "message" ? " airport-mobile-contact-step__control--notes" : ""), placeholder:pageCopy("airportMobileContactStep.placeholders." + key,input.placeholder)});
      if (name === "message") mobileStyle(input, {readonly:"",role:"button","aria-haspopup":"dialog"});
      var label = wrapper.querySelector('label');
      mobileStyle(label, {class:"airport-mobile-contact-step__label", "data-i18n":null},pageCopy("airportMobileContactStep.fields." + key,label.textContent));
      mobileStyle(wrapper.querySelector('.field-error'), {class:"field-error airport-mobile-contact-step__error"});
    });
    var actions = form.querySelector('.form-actions');
    mobileStyle(actions,{class:actions.className + " airport-mobile-contact-step__actions"});
    var submit = form.querySelector('#contact-submit');
    mobileStyle(submit,{class:"airport-mobile-contact-step__submit", "data-i18n":null},view.t('mobileReviewCta'));
    mount.appendChild(form);
    mount.appendChild(view.node('p','booking-no-payment',view.t('noPayment')));
    var editing = editContext();
    if (editing) {
      mount.setAttribute('data-airport-pending-edit', '');
      var summary = mount.querySelector('.airport-mobile-contact-step__summary');
      var reference = view.node('p', 'airport-booking__reference', view.t('reference') + ': ' + editing.publicCode);
      summary.before(reference);
      if (editing.expiresAt && editing.serverNow) reference.after(editDeadline(editing));
    }
    renderNotice(mount);
    mount.querySelectorAll('.airport-booking__primary').forEach(function (node) { node.classList.add('airport-mobile-contact-step__submit'); node.classList.remove('cta'); });
    var focus = route()[2];
    if (focus === 'luggage') { goTrip(); return; }
    if (focus) view.focus(focus === 'legal' ? form.querySelector('[type="checkbox"]') : form.elements.namedItem(focus));
    else focusMobileScreen(preserved);
  }
  function reviewBlock(title, focus, content) {
    var section = view.node("section", "airport-booking__block");
    var heading = view.node("div", "airport-booking__block-heading");
    heading.appendChild(view.node(view.media.matches ? "h2" : "p", view.media.matches ? "" : "airport-mobile-contact-step__summary-title", view.t(title)));
    if (view.media.matches) {
      var edit = button("edit", function () { focus === "trip" ? goTrip() : navigate("datos", focus); });
      edit.replaceChildren(view.icon("edit"), view.node("span", "", view.t("edit")));
      edit.setAttribute("aria-label", view.t("edit") + ": " + view.t(title));
      heading.appendChild(edit);
    }
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
  function mobileLegalCurrent() {
    var host = form.querySelector('[data-airport-transfer-checkout-legal-acceptance]');
    var instance = host && host.__pixkuyLegalAcceptanceInstance;
    var api = window.PixkuyForms && window.PixkuyForms.LegalAcceptance;
    if (!snapshot || !instance || !instance.isAccepted() || !api || snapshot.legal_acceptance_accepted !== "true" || !snapshot.legal_acceptance_accepted_at) return false;
    // Inspect current document versions; never create or sync an acceptance here.
    var policy = api.buildSnapshot(snapshot.legal_acceptance_channel);
    return ["termsVersion","cancellationsVersion","privacyVersion","channel"].every(function (key) { return snapshot[api.fieldNames[key]] === policy[key]; });
  }
  function conditions() {
    var accepted = view.media.matches ? snapshot.legal_acceptance_accepted === "true" : mobileLegalCurrent();
    var legal = view.node("section", "airport-booking__conditions");
    var status = view.node("p", "airport-booking__conditions-status");
    status.append(view.icon(accepted ? "check" : "document"), view.node("span", "", view.t(accepted ? "accepted" : "conditions")));
    if (!view.media.matches) status.textContent = view.t(accepted ? "accepted" : "conditions");
    legal.appendChild(status);
    var links = form.querySelector("[data-airport-transfer-checkout-legal-acceptance] .legal-acceptance__links");
    var copy = links ? links.cloneNode(true) : legalLinks();
    if (!view.media.matches) {
      Array.from(copy.querySelectorAll("a")).forEach(function (link, index) { link.textContent = view.t(["mobileTerms","mobileCancellations","mobilePrivacy"][index]); });
      Array.from(copy.childNodes).forEach(function (node) { if (node.nodeType === 3 || node.nodeType === 1 && node.tagName !== "A") node.remove(); });
    }
    if (view.media.matches) Array.from(copy.querySelectorAll("a")).forEach(function (link) { link.prepend(view.icon("document")); });
    legal.appendChild(copy);
    return legal;
  }
  function reviewScreen(preserved) {
    mountShell(2);
    var layout = view.node("div", "airport-booking__layout");
    var main = view.node("section", "");
    if (view.media.matches) main.append(view.node("h1", "", view.t("reviewTitle")), view.node("p", "airport-booking__lead", view.t("reviewText")));
    var contact = view.node("dl", "airport-booking__details");
    contact.append(view.field(view.t("name"), snapshot.name), view.field(view.t("phone"), snapshot.phone), view.field(view.t("email"), snapshot.email));
    var notes = view.node("dl", "airport-booking__details");
    if (view.media.matches) notes.append(view.field(view.t("luggage"), snapshot.luggage));
    var noteText = Object.prototype.hasOwnProperty.call(snapshot, "message") ? snapshot.message : snapshot.notes;
    if (noteText && view.media.matches) notes.append(view.field(view.t("transferNotes"), noteText));
    if (view.media.matches) main.appendChild(reviewBlock("trip", "trip", view.trip(snapshot)));
    var contactBlock = reviewBlock("contact", "name", contact);
    main.appendChild(contactBlock);
    if (view.media.matches) main.appendChild(reviewBlock("transferNotes", "luggage", notes));
    else if (String(noteText || "").trim()) {
      var mobileNotes = view.node("div", "airport-mobile-review__notes");
      mobileNotes.append(view.node("p", "airport-mobile-contact-step__summary-label", view.t("mobileNotes")), view.node("p", "airport-mobile-contact-step__summary-value", noteText));
      contactBlock.appendChild(mobileNotes);
    }
    main.appendChild(conditions());
    var aside = view.node("aside", "airport-booking__summary");
    if (view.media.matches) aside.append(view.node("h2", "", view.t("amountTitle")), view.vehicle(snapshot));
    if (notice && view.media.matches) aside.appendChild(view.node("p", "", view.t("lastReviewedAmount")));
    if (view.media.matches) aside.appendChild(view.node("p", "airport-booking__total", view.price(snapshot)));
    else {
      var total = view.node("p", "airport-booking__total");
      total.append(view.node("span", "", view.t("mobileTotal")), view.node("strong", "", notice && !changed || revalidation || !offerFresh() ? "—" : view.price(snapshot)));
      aside.appendChild(total);
    }
    if (view.media.matches || notice !== "checking" && notice !== "unverified") renderNotice(aside);
    else {
      var progress = view.node("p", "airport-booking__notice airport-mobile-review__status", view.t("mobileChecking"));
      progress.setAttribute("role", "status"); aside.appendChild(progress);
    }
    var editing = editContext();
    if(editing && editing.expiresAt && editing.serverNow) aside.appendChild(editDeadline(editing));
    else if(!editing && view.media.matches) aside.appendChild(view.node("p", "airport-booking__lead", view.t("paymentPolicy")));
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
      var mobileRetry = !view.media.matches && notice === "technical";
      var mobileWaiting = !view.media.matches && (revalidation || notice === "checking" || notice === "unverified");
      var checkoutButton = button(notice === "localError" ? "retryCheckout" : !view.media.matches ? mobileWaiting ? "mobileChecking" : mobileRetry ? "checkAgain" : editContext() ? "replacePayCta" : "payCta" : notice ? "checkAgain" : editContext() ? "replacePayCta" : "payCta", mobileRetry ? revalidateOffer : checkout, true);
      checkoutButton.setAttribute('data-airport-pay','');
      if (revalidation || editExpired() || !view.media.matches && !mobileRetry && (notice && notice !== "localError" || !offerFresh() || !mobileLegalCurrent())) checkoutButton.disabled = true;
      aside.appendChild(checkoutButton);
    }
    if (view.media.matches) aside.appendChild(view.node("p", "airport-booking__lead", view.t("confirmAfterPayment")));
    layout.append(main, aside); mount.append(layout);
    if (!view.media.matches) {
      mount.querySelectorAll('.airport-booking__block, .airport-booking__conditions').forEach(function (node) { node.classList.add('airport-mobile-contact-step__summary'); });
      mount.querySelectorAll('.airport-booking__detail dt').forEach(function (node) { node.classList.add('airport-mobile-contact-step__summary-label'); });
      mount.querySelectorAll('.airport-booking__detail dd').forEach(function (node) { node.classList.add('airport-mobile-contact-step__summary-value'); });
      mount.querySelectorAll('.airport-booking__link').forEach(function (node) { node.classList.add('airport-mobile-flow__back'); });
      mount.querySelectorAll('.airport-booking__primary').forEach(function (node) { node.classList.add('airport-mobile-contact-step__submit'); node.classList.remove('cta'); });
      focusMobileScreen(preserved);
      return;
    }
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
    if (editing && body.recovery && body.recovery.action === "reservation_status") {
      window.location.assign("/booking-success.html?token=" + encodeURIComponent(editing.token));
      return;
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
      return window.PixkuyAirportReview.redirectToCheckout(body.checkoutUrl, body.bookingStatusToken);
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
    if (editRecoveryRequired()) { render(); return; }
    // An existing dispatched attempt uses its recovery path, never a new clock.
    if (!(editContext() && editContext().attempt) && guardReviewExpiry()) return;
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
    var checkingOnly = notice !== "localError" && (!!notice || !reviewed);
    var operation = "availability";
    var departing = false;
    var current = revision;
    busy = true;
    // Only the action state changes while the existing review is submitted.
    // Keep its form, deadline and focus mounted; error/offer results still render.
    mount.setAttribute("aria-busy", "true");
    mount.querySelectorAll("button.airport-booking__primary, button.airport-booking__link").forEach(function (button) { button.disabled = true; });
    Promise.resolve().then(function () { return window.PixkuyAirportCheckout.prepare(); }).then(function (fresh) {
      if (current !== revision || !active() || route()[1] !== "revision") return;
      if (editRecoveryRequired() || guardReviewExpiry()) return;
      snapshot = fresh;
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
      operation = "checkout";
      var request = editing
        ? window.PixkuyAirportReview.requestReplacement(fresh, editing)
        : window.PixkuyAirportReview.requestCheckout(fresh);
      return request.then(function (result) {
        departing = receiveCheckoutResult(result, editing) === true;
      });
    }).catch(function (error) {
      if (current !== revision) return;
      var failedEdit = editContext();
      // The transport persists its attempt before dispatch. Availability,
      // validation or storage failures without that evidence are not a lost payment.
      notice = failedEdit && failedEdit.attempt ? "saveUncertain" : pending() ? "uncertain" : operation === "checkout" ? "localError" : requestErrorKind(error, "technical");
      reviewed = null;
    }).finally(function () { busy = false; if (active() && !departing) render(); });
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
    var currentResult = result && result.raw && result.raw.result;
    var price = currentResult && currentResult.price;
    var availability = currentResult && currentResult.availability;
    var codes = (result && result.code || "") + " " + (availability && availability.code || "");
    if (price && price.reason === "AIRPORT_TRANSFER_PRICE_MISMATCH" && Number.isSafeInteger(price.actualAmountMinor) && price.actualAmountMinor > 0) {
      pendingPrice = price.actualAmountMinor;
      return "offerChanged";
    }
    if (/FAILED|UNDETERMINED|TECHNICAL|PENDING/.test(codes)) return "technical";
    if (/NO_AVAILABILITY|FLEET_UNAVAILABLE|TRANSFER_UNAVAILABLE/.test(codes) ||
        availability && availability.available === false && availability.status === "unavailable") return "unavailable";
    return "technical";
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
    if (offerFresh() && (!mobileReviewActive() || mobileReviewFresh())) {
      if (mobileReviewActive()) mobileReviewAttempt = "";
      if (notice === "checking" || notice === "unverified" || mobileReviewActive() && notice === "technical") {
        notice = "";
        if (mobileReviewActive()) reviewed = snapshot;
        renderPreservingUi();
      }
      return Promise.resolve(true);
    }
    if (revalidation) return revalidation;
    var before = snapshot;
    var current = ++revalidationSequence;
    var routeRevision = revision;
    pendingPrice = null;
    changed = false;
    reviewed = null;
    notice = "checking";
    var request = window.PixkuyAirportCheckout.prepare({ interactive: false });
    revalidation = request;
    renderPreservingUi();
    request.then(function (fresh) {
      if (current !== revalidationSequence || !active() || !view.media.matches && routeRevision !== revision) return false;
      if (editRecoveryRequired() || guardReviewExpiry()) return false;
      changed = commercialKey(before) !== commercialKey(fresh);
      notice = changed ? "offerChanged" : "";
      persist(fresh);
      if (mobileReviewActive() && !changed && !mobileReviewFresh()) throw new Error("FLEET_REVIEW_CONTEXT_CHANGED");
      reviewed = route()[1] === "revision" && !changed ? fresh : null;
      mobileReviewAttempt = "";
      return true;
    }).catch(function (error) {
      if (current !== revalidationSequence || !active() || !view.media.matches && routeRevision !== revision) return false;
      if (guardReviewExpiry()) return false;
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
      if (!view.media.matches && routeRevision !== revision) {
        mobileReviewAttempt = "";
        if (notice === "checking") notice = "unverified";
      }
      if (active()) renderPreservingUi();
    });
    return request;
  }
  function mobileReviewActive() {
    var editing = editContext();
    return !view.media.matches && active() && route()[1] === "revision" && !(editing && editing.attempt) && !pending();
  }
  function mobileReviewFresh() {
    return offerFresh() && snapshot && commercialKey(snapshot) === commercialKey(window.PixkuyAirportCheckout.draft() || {});
  }
  function syncMobileReviewOffer() {
    if (!mobileReviewHydrated || !mobileReviewActive() || busy || revalidation || changed || pendingPrice) return;
    if (notice && notice !== "unverified" && notice !== "checking") return;
    if (mobileReviewFresh()) {
      mobileReviewAttempt = "";
      reviewed = snapshot;
      if (notice) { notice = ""; renderPreservingUi(); }
      return;
    }
    var key = window.PixkuyFleetSelection.airportOfferStatus().contextKey + "|" + commercialKey(snapshot);
    if (mobileReviewAttempt === key) return;
    mobileReviewAttempt = key;
    revalidateOffer();
  }
  function render(options) {
    if (!active()) {
      // Hourly may own the same canonical form during its route navigation.
      if (!form.classList.contains("hourly-booking__form")) restoreForm();
      if (route() && route()[1] === "traslado") {
        if (!view.media.matches && window.PixkuyAirportMobileBookingFlow) window.PixkuyAirportMobileBookingFlow.open();
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
    // History is provenance only: a confirmed/cleared edit may recover status,
    // never silently become a new payable reservation when revisiting Review.
    if (editContext() && !(window.history.state && window.history.state.airportPendingToken)) {
      window.history.replaceState(Object.assign({},window.history.state,{airportPendingToken:editContext().token}),"",window.location.href);
    }
    if (editRecoveryRequired()) {
      mountShell(2);
      mount.appendChild(view.node("p", "airport-booking__notice", view.t("incomplete")));
      mount.appendChild(button("recover", function () {
        window.location.assign("/booking-cancelled.html?token=" + encodeURIComponent(editProvenance()));
      }, true));
      return;
    }
    if (!snapshot) { goTrip(); return; }
    if (form.elements.namedItem("service_type").value !== "airport_hotel") {
      window.PixkuyForms.contactServiceState.setActiveServiceType("airport_hotel", {source:"airport-desktop-route", skipConfirm:true});
      window.PixkuyForms.applyContactAirportHotelHandoff(snapshot);
      window.PixkuyFleetSelection.editFromReview("airport_transfer");
    }
    var preserved = options && options.preserve ? captureUiState() : null;
    if (route()[1] === "revision" && pending() && !notice) notice = "uncertain";
    if (route()[1] === "revision" && !pending() && !offerFresh() && !notice) {
      notice = "unverified";
    }
    if (route()[1] === "revision" && editContext() && editContext().attempt) notice = "saveUncertain";
    if (route()[1] === "revision") reviewScreen(preserved); else dataScreen(preserved);
    syncMobileReviewOffer();
  }
  function focusError() {
    var invalid = form.querySelector('[aria-invalid="true"]');
    view.focus(invalid || form.querySelector("[data-airport-desktop-field] input"));
  }
  window.PixkuyAirportDesktopBooking = {
    pendingEdit: function () {
      var editing = route() && editContext();
      return editing ? { token: editing.token, revision: editing.editRevision } : null;
    },
    active: active,
    guardReviewExpiry: guardReviewExpiry,
    leave: function () {
      if (!active()) return false;
      save(); revision += 1; revalidationSequence += 1; revalidation = null;
      restoreForm(); return true;
    },
    resumePending: function () {
      var saved = read(), context = editContext();
      var fleet = window.PixkuyFleetSelection.read("airport_transfer");
      var token = fleet.reservationToken || fleet.attempt && fleet.attempt.response && fleet.attempt.response.bookingStatusToken;
      if (!context && token) {
        window.location.assign('/booking-cancelled.html?token=' + encodeURIComponent(token));
        return true;
      }
      if (!saved || !(context || saved.airport_pending_token)) return false;
      snapshot = saved;
      window.sessionStorage.setItem(RETURN, "1");
      restoreTripContext(saved);
      window.PixkuyForms.contactServiceState.setActiveServiceType("airport_hotel", {source:"airport-pending-resume",skipConfirm:true});
      window.PixkuyForms.applyContactAirportHotelHandoff(saved);
      navigate(context && context.attempt || saved.airport_draft_stage === "revision" ? "revision" : "datos");
      refreshEditDeadline();
      return true;
    },
    resumeDraft: function () {
      var saved = read(), fleet = window.PixkuyFleetSelection.read("airport_transfer");
      // Menu re-entry resumes an ordinary draft, never a payment/edit context
      // or an explicit new continuation, which starts in the configurator.
      if (view.media.matches || !saved || !saved.airport_mobile_draft ||
          !/^(datos|revision)$/.test(saved.airport_draft_stage) ||
          saved.airport_pending_token || window.sessionStorage.getItem(EDIT_KEY) ||
          fleet.reservationToken || pending()) return false;
      if (!saved.airport_transfer_date || !saved.airport_transfer_time ||
          !saved.airport_transfer_passenger_fare_key || !window.PixkuyAirportMobileDraft.locationOf(saved)) return false;
      if (!restoreTripContext(saved)) return false;
      window.PixkuyForms.contactServiceState.setActiveServiceType("airport_hotel", {source:"airport-draft-resume",skipConfirm:true});
      if (!window.PixkuyForms.applyContactAirportHotelHandoff(saved)) return false;
      snapshot = saved;
      notice = ""; reviewed = null; changed = false; pendingPrice = null;
      // The existing form/consent validator decides whether Review is usable.
      // The offer remains subject to the normal refresh and checkout guards.
      var step = saved.airport_draft_stage === "revision" && window.PixkuyAirportCheckout.validate() ? "revision" : "datos";
      navigate(step, null, true);
      var resumedRevision = revision;
      // The handoff schedules the existing consent synchronizer on the next
      // frame. Reflect its verified state after it runs, unless we have left.
      window.requestAnimationFrame(function () {
        if (revision === resumedRevision && active()) renderPreservingUi();
      });
      return true;
    },
    revision: function () { return revision; },
    focusError: focusError,
    open: function () {
      if (editProvenance()) {
        if (!restorePendingContact()) { navigate("datos"); return true; }
      }
      save(); notice = ""; reviewed = null; pendingPrice = null;
      window.PixkuyFleetSelection.editFromReview("airport_transfer");
      navigate("datos"); return true;
    },
    review: function (value) {
      if (!active()) return false;
      if (editRecoveryRequired() || guardReviewExpiry()) return true;
      persist(value); reviewed = value; notice = ""; changed = false; pendingPrice = null;
      navigate("revision");
      return true;
    },
    availabilityError: function (result) {
      if (!active()) return false;
      var fleet = window.PixkuyFleetSelection.read("airport_transfer");
      var selectedModel = snapshot && snapshot.fleet_selection && snapshot.fleet_selection.model_id;
      if (selectedModel && fleet && fleet.explicit && !fleet.selected && fleet.offer && fleet.offer.models.length) {
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
    window.queueMicrotask(function () {
      var label = view.t(view.media.matches ? "reviewCta" : "mobileReviewCta");
      if (submit.textContent !== label) submit.textContent = label;
    });
  });
  form.addEventListener("change", function () { if (active()) save(); });
  form.addEventListener("blur", function () {
    if (active()) window.queueMicrotask(function () {
      var submit = form.querySelector("#contact-submit");
      var label = view.t(view.media.matches ? "reviewCta" : "mobileReviewCta");
      if (submit.textContent !== label) submit.textContent = label;
    });
  }, true);
  document.addEventListener("pixkuy:fleet-choice-required", function (event) {
    if (active() && event.detail.service === "airport_transfer") {
      notice = "offerChanged";
      // The canonical configurator owns explicit model choice and its waiting precheck.
      save(); navigate("traslado");
    }
  });
  window.addEventListener("popstate", function () {
    if (route()) restorePendingContact();
    revision += 1; render();
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("pageshow", function (event) {
    if (!editContext() && new URLSearchParams(window.location.search).get('service') === 'airport_hotel' && window.PixkuyAirportDesktopBooking.resumePending()) return;
    // The draft adapter is registered first and restores the trip on pageshow.
    // Contact restoration also owns deferred reapplications. Wait for its
    // terminal event before preparing with the canonical hidden quote fields.
    if (editContext()) {
      snapshot = read();
      restoreTripContext(snapshot);
      if (route() || new URLSearchParams(window.location.search).get("service") === "airport_hotel") restorePendingContact();
    }
    mobileReviewHydrated = window.sessionStorage.getItem(RETURN) !== "1";
    refreshEditDeadline(!event.persisted);
    busy = false;
    if (!active()) return;
    if (window.PixkuyFleetSelection.expireAirportOfferIfNeeded) window.PixkuyFleetSelection.expireAirportOfferIfNeeded();
    render();
  });
  document.addEventListener("pixkuy:airport-draft-restored", function (event) {
    if (!event.detail || !event.detail.reviewReturnCompleted) return;
    // Restoration can finish before load/pageshow; the mobile draft adapter
    // still has to restore its panel context in that case.
    mobileReviewHydrated = document.readyState === "complete";
    if (!view.media.matches && active()) {
      if (!event.detail.restored) notice = "incomplete";
      renderPreservingUi();
    }
  });
  document.addEventListener("pixkuy:fleet-offer-expired", function (event) {
    if (event.detail && event.detail.service === "airport_transfer" && active()) {
      reviewed = null;
      if (!pending()) notice = "unverified";
      renderPreservingUi();
    }
  });
  document.addEventListener("pixkuy:fleet-offer-accepted", function (event) {
    if (event.detail && event.detail.service === "airport_transfer" && mobileReviewActive()) window.queueMicrotask(syncMobileReviewOffer);
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
    if (window.PixkuyHourlyBookingFlow && window.PixkuyHourlyBookingFlow.isActive()) return;
    revision += 1;
    if (form.elements.namedItem("service_type").value !== "airport_hotel") window.history.replaceState(null, "", "#contact");
    render();
  });
  window.addEventListener("beforeunload", function (event) {
    if (active() && !editRecoveryRequired() && !save()) { event.preventDefault(); event.returnValue = ""; }
  });
  view.ready.then(function () {
    window.setTimeout(function () {
      if (route()) {
        if(!mount) {
          snapshot = read();
          if (editContext() || snapshot && (snapshot.airport_new_continuation || snapshot.airport_mobile_draft)) restoreTripContext(snapshot);
          render();
        }
        refreshEditDeadline(true);
      }
    }, 350);
  });
})(window, document);
