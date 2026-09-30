(function (window, document) {
  "use strict";
  var view = window.PixkuyAirportDesktopView;
  var state = null;
  var mount = null;
  var ready = false;
  var receivedAt = 0;
  function serverNow(raw) { return new Date(Date.parse(raw.serverNow) + window.performance.now() - receivedAt).toISOString(); }
  function home() { window.location.assign("/"); }
  function trip() { window.location.assign("/?service=airport_hotel#services"); }
  function render() {
    document.querySelectorAll('[data-airport-mobile-deadline]').forEach(function (node) { node.remove(); });
    if(ready && !view.media.matches && state && state.result.serviceType === "airport_transfer" && state.result.view !== "confirmed") {
      var nativePanel=document.querySelector('[data-booking-cancelled-mobile-panel]');
      var raw=state.result.raw;
      if(nativePanel && raw.hold && raw.serverNow && !raw.actions.canCreateNewReservation) {
        var timing=view.deadline(raw.hold.expiresAt,serverNow(raw),raw.actions.canCreateNewReservation ? 'paymentDeadlineResolved' : 'paymentDeadlinePassed');
        timing.className='booking-status-mobile__lead';
        timing.setAttribute('data-airport-mobile-deadline','');
        var nativeLead=nativePanel.querySelector('[data-booking-status-lead]');
        if(nativeLead) nativeLead.after(timing); else nativePanel.appendChild(timing);
      }
    }
    if (mount) mount.remove();
    mount = null;
    document.body.classList.remove("airport-booking-active");
    if (ready && view.media.matches && /\/booking-checkout\.html$/.test(window.location.pathname)) {
      try {
        var checkoutToken = new URLSearchParams(window.location.search).get("token");
        var original = window.PixkuyFleetSelection.read("airport_transfer").attempt;
        var draft = JSON.parse(window.sessionStorage.getItem("pixkuy_airport_transfer_checkout_review_snapshot"));
        var handoff = JSON.parse(window.sessionStorage.getItem("pixkuy_booking_checkout:" + checkoutToken));
        if (!checkoutToken || !original || !original.response || original.response.bookingStatusToken !== checkoutToken || !draft ||
            !handoff || handoff.token !== checkoutToken || !/^https:\/\/checkout\.stripe\.com\//.test(handoff.checkoutUrl || "")) return;
        mount = view.shell(3, trip, null, {backLabel:"backTrip"});
        mount.append(view.node("h1", "", view.t("payment")), view.summary(draft, false));
        document.body.appendChild(mount);
        document.body.classList.add("airport-booking-active");
      } catch (_) { /* Leave the existing handoff visible if context is missing. */ }
      return;
    }
    if (!ready || !view.media.matches || !state || state.result.serviceType !== "airport_transfer") return;
    if (["confirmed", "pending", "expired"].indexOf(state.result.view) < 0) return;
    var result = state.result;
    var confirmed = result.view === "confirmed" && result.paymentStatus === "paid";
    var retry = result.view === "pending" && result.raw.actions && result.raw.actions.canRetryCheckout === true;
    var kind = confirmed ? "confirmed" : result.view === "expired" ? "expired" : retry ? "failed" : "pending";
    mount = view.shell(confirmed ? 4 : 3, confirmed ? home : trip, null, {backLabel:confirmed ? "home" : "backTrip"});
    mount.classList.add("airport-booking--result");
    document.body.appendChild(mount);
    document.body.classList.add("airport-booking-active");
    var title = view.node("h1", "", view.t(kind + "Title"));
    var lead = view.node("p", "airport-booking__lead", view.t(kind + "Text"));
    var windowClosed = result.raw.actions && result.raw.actions.paymentWindowClosed === true;
    if (windowClosed) lead.textContent = view.t("paymentWindowClosed");
    mount.append(title, lead);
    if(!confirmed && result.raw.hold && result.raw.serverNow) mount.appendChild(view.deadline(result.raw.hold.expiresAt,serverNow(result.raw),result.raw.actions.canCreateNewReservation ? 'paymentDeadlineResolved' : 'paymentDeadlinePassed',function () {
      window.queueMicrotask(function () { if(mount)mount.querySelectorAll('[data-airport-pay]').forEach(function (button) { button.disabled=true; }); });
    }));
    var layout = view.node("div", "airport-booking__layout");
    var main = view.node("section", "airport-booking__block");
    var details = view.node("dl", "airport-booking__details");
    details.append(view.field(view.t("reference"), result.publicCode), view.locationField(view.t("origin"), result.pickupAddress, {address:result.pickupAddressDetail}),
      view.locationField(view.t("destination"), result.destinationAddress, {address:result.destinationAddressDetail}), view.field(view.t("date"), view.date(result.serviceStartLocalDate)),
      view.field(view.t("time"), result.serviceStartLocalTime + " · " + view.t("timezone")),
      view.field(view.t("passengers"), result.passengerLabel || result.passengerCount),
      view.field(view.t("luggage"), result.luggageCount === null ? "—" : String(result.luggageCount)),
      view.field(view.t("name"), result.customerFullName));
    [3,4,5,6].forEach(function (index) { details.children[index].classList.add("airport-booking__detail--half"); });
    if (result.customerPhone) details.appendChild(view.field(view.t("phone"), result.customerPhone));
    if (result.customerEmail) details.appendChild(view.field(view.t("email"), result.customerEmail));
    if (result.customerNotes) details.appendChild(view.field(view.t("notes"), result.customerNotes));
    main.appendChild(details);
    if (result.publicCode && window.navigator.clipboard) main.appendChild(view.action(view.t("copy"), function () {
      window.navigator.clipboard.writeText(result.publicCode).catch(function () { view.focus(details.firstElementChild); });
    }));
    var aside = view.node("aside", "airport-booking__summary");
    aside.appendChild(view.node("h2", "", view.t("yourTrip")));
    if (result.vehicleDisplayName) aside.appendChild(view.vehicle({fleet_model:{name:result.vehicleDisplayName,photoUrl:result.vehiclePhotoUrl}}));
    aside.appendChild(view.node("p", "", confirmed ? view.t("paid") : view.t(kind + "Title")));
    aside.appendChild(view.node("p", "airport-booking__total", view.money(confirmed ? result.paymentAmountPaid : result.paymentAmountExpected, result.paymentCurrency)));
    var actions = view.node("div", "airport-booking__actions");
    var paymentActions = view.node("div", "airport-booking__payment-actions");
    aside.appendChild(paymentActions);
    if (retry && window.PixkuyBookingCancelledRetry) {
      var pay = view.action(view.t("payCta"), function () {
        if (pay.disabled) return;
        pay.disabled = true;
        window.PixkuyBookingCancelledRetry.retry(state.token).catch(function () {
          pay.disabled = false;
          message.textContent = view.t("uncertain");
        });
      }, true);
      paymentActions.appendChild(pay);
      pay.setAttribute('data-airport-pay','');
    }
    var editApi = window.PixkuyBookingCancelledEdit;
    if (editApi && result.raw.actions.canCreateNewReservation && result.raw.continuation) {
      paymentActions.appendChild(view.action(view.t("startAgain"), function () { editApi.beginNew(state); }, true));
    }
    if (editApi && editApi.allowed(state)) {
      var edit = view.action(editApi.label(state), function () {
        editApi.begin(state);
      });
      edit.classList.add("airport-booking__secondary");
      edit.setAttribute('data-airport-pay','');
      paymentActions.appendChild(edit);
    }
    if (!confirmed && result.view !== "expired") {
      var check = view.action(view.t("recover"), function () {
        if (check.disabled) return;
        Array.from(paymentActions.children).forEach(function (button) { button.disabled = true; });
        check.textContent = view.t("paymentChecking");
        check.setAttribute("aria-busy", "true");
        lead.textContent = view.t("paymentChecking");
        message.textContent = "";
        window.PixkuyBookingStatusState.refresh().then(function () {
          var next = mount && mount.querySelector("[data-airport-check-status]");
          if (next) next.focus();
        }).catch(function () {
          lead.textContent = view.t(kind + "Text");
          message.textContent = view.t("checkError");
          Array.from(paymentActions.children).forEach(function (button) { button.disabled = false; });
          check.textContent = view.t("recover");
          check.removeAttribute("aria-busy");
          check.focus();
        });
      });
      check.setAttribute("data-airport-check-status", "");
      paymentActions.appendChild(check);
    }
    var message = view.node("p", "airport-booking__notice");
    message.setAttribute("role", "status");
    aside.appendChild(message);
    if (result.view === "manualReview" || result.view === "unknown" || result.view === "cancelled") {
      message.textContent = view.t("uncertain");
    }
    actions.appendChild(view.action(view.t("home"), home, false, "home"));
    var contact = document.querySelector('[data-booking-status-desktop] [data-booking-status-whatsapp], [data-booking-cancelled-desktop] [data-booking-status-whatsapp]');
    if (contact) {
      var contactLink = contact.cloneNode(true);
      contactLink.className = "airport-booking__link airport-booking__contact-action";
      contactLink.replaceChildren(view.icon("contact"), view.node("span", "", view.t("contact") + " · Pixkuy"));
      actions.appendChild(contactLink);
    }
    layout.append(main, aside); mount.append(layout, actions);
  }
  if (window.PixkuyBookingStatusState) window.PixkuyBookingStatusState.onReady(function (value) {
    state = value;
    receivedAt = window.performance.now();
    if(state.result.serviceType === "airport_transfer") document.querySelectorAll('[data-booking-cancelled-new]').forEach(function (button) {
      if(button.dataset.airportContinuationBound) return;
      button.dataset.airportContinuationBound='1';
      button.addEventListener('click',function (event) {
        event.preventDefault();
        if(window.PixkuyBookingCancelledEdit)window.PixkuyBookingCancelledEdit.beginNew(state);
      });
    });
    if (state.result.serviceType === "airport_transfer" && state.result.view === "confirmed" && state.result.paymentStatus === "paid") {
      window.PixkuyFleetSelection.completeReservation("airport_transfer", state.token);
    }
    render();
  });
  view.ready.then(function () { ready = true; render(); });
  view.media.addEventListener("change", render);
  window.addEventListener("pixkuy:airport-desktop-copy", render);
})(window, document);
