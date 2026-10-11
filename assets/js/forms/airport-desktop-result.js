(function (window, document) {
  "use strict";
  var view = window.PixkuyAirportDesktopView;
  var state = null;
  var mount = null;
  var ready = false;
  var receivedAt = 0;
  var mobileDeadline = null;
  var mobileDeadlineKey = "";
  var directLayout = null;
  function restoreDirectLayout() {
    if (!directLayout) return;
    directLayout.forEach(function (entry) {
      entry.anchor.replaceWith(entry.node);
      entry.node.classList.remove('airport-return__reference','airport-return__service','airport-return__estimated-duration');
    });
    directLayout = null;
  }
  function serverNow(raw) { return new Date(Date.parse(raw.serverNow) + window.performance.now() - receivedAt).toISOString(); }
  function home() { window.location.assign("/"); }
  function trip() { window.location.assign("/?service=airport_hotel#services"); }
  function mobileLocation(label, address) {
    label=String(label || '').trim();address=String(address || '').trim();
    if (!label) return address || '—';
    if (!address) return label;
    function comparable(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
    var display=comparable(label), detail=comparable(address);
    // The display contract can already include the POI and formatted address.
    // Compare the street component too: country spelling can differ. Never
    // split or truncate the displayed label to infer a place name.
    var street=comparable(address.split(',')[0]);
    if (display === detail || display.indexOf(detail) >= 0 ||
        street.length >= 12 && street.split(' ').length >= 2 && display.indexOf(street) >= 0) return label;
    return label + '\n' + address;
  }
  function renderMobileResult() {
    var root = document.querySelector('[data-booking-cancelled-mobile], [data-booking-status-mobile]');
    if (!root || !state) return;
    // A superseded initial translation load can resolve before the current one.
    // The copy-ready event will render; never seed a persistent clock with keys.
    if (view.t('paymentRemaining') === 'paymentRemaining') return;
    var result = state.result, raw = result.raw, actions = raw.actions || {};
    var directPending = result.serviceType === 'direct_transfer' && result.reservationStatus === 'pending_payment' && result.view === 'pending' && ['pending','processing'].indexOf(result.paymentStatus) >= 0;
    var directConfirmed = result.serviceType === 'direct_transfer' && result.reservationStatus === 'confirmed' && result.view === 'confirmed' && result.paymentStatus === 'paid';
    var directCompact = directPending || directConfirmed;
    var pending = (result.serviceType === 'airport_transfer' || directPending) && result.view === 'pending' && result.paymentStatus !== 'processing';
    root.toggleAttribute('data-airport-pending-return', pending);
    root.toggleAttribute('data-direct-pending-return', directPending);
    if (!directCompact && directLayout) {
      restoreDirectLayout();
      root.removeAttribute('data-airport-return');
      root.removeAttribute('data-airport-confirmed');
      root.querySelector('[data-booking-status-lead]').hidden=false;
      root.querySelectorAll('.airport-return__disclosure,.airport-return__resume,.airport-return__vehicle-summary,[data-airport-confirmed-timezone]').forEach(function (node) { node.remove(); });
    }
    var panel = root.querySelector('[data-booking-cancelled-mobile-panel], [data-booking-status-mobile-panel]');
    var details = root.querySelector('[data-booking-status-details]');
    if (!panel || !details || details.hidden || result.serviceType !== "airport_transfer" && !directCompact) {
      if(result.serviceType === 'direct_transfer')root.removeAttribute('data-airport-return');
      root.querySelectorAll('.airport-return__reference,.airport-return__service,.airport-return__disclosure,.airport-return__resume').forEach(function(node){node.hidden=true;});
      if(mobileDeadline)mobileDeadline.remove();mobileDeadline=null;mobileDeadlineKey="";
      return;
    }
    root.setAttribute('data-airport-return', 'true');
    if (directCompact && !directLayout) {
      // Keep the original nodes/handlers for status transitions out of the compact view.
      var nodes = ['public-code','amount','notes-row','service','date','time','duration','pickup','destination','vehicle','passengers','luggage'].map(function (key) {
        var node = root.querySelector('[data-booking-status-' + key + ']');
        return key === 'notes-row' ? node : node && node.parentNode;
      }).concat(['retry','modify','new'].map(function (key) { return root.querySelector('[data-booking-cancelled-' + key + ']'); }));
      directLayout = nodes.filter(Boolean).map(function (node) {
        var anchor = document.createComment('Direct result original position');node.before(anchor);return {node:node,anchor:anchor};
      });
    }
    var processing = result.paymentStatus === 'processing';
    var confirmed = result.view === 'confirmed' && result.paymentStatus === 'paid';
    root.toggleAttribute('data-airport-confirmed', confirmed);
    root.querySelector('[data-booking-status-lead]').hidden=confirmed;
    var kind = confirmed ? 'confirmed' : result.view === 'expired' ? 'expired' : result.view === 'pending' ? (processing ? 'pending' : 'returnPending') : '';
    if (kind) {
      root.querySelector('[data-booking-status-title]').textContent = view.t(confirmed ? 'mobileConfirmedTitle' : kind + 'Title');
      root.querySelector('[data-booking-status-lead]').textContent = actions.paymentWindowClosed ? view.t('paymentWindowClosed') : view.t(kind === 'returnPending' ? 'confirmAfterPayment' : kind + 'Text');
      if(result.view==='pending'&&(result.contactUpdatePending||result.paymentWindowRenewed))root.querySelector('[data-booking-status-lead]').textContent+=' '+state.dictionary[result.contactUpdatePending?'contactUpdatePending':'contactEmailRenewed'];
      var notice = root.querySelector('[data-booking-status-notice]');
      notice.textContent = '';
      notice.hidden = true;
    }
    root.querySelector('[data-booking-status-payment]').parentNode.hidden=!!kind;
    if (processing) root.querySelector('[data-booking-status-payment]').textContent=view.t('paymentChecking');
    var reference = root.querySelector('[data-booking-status-public-code]').parentNode;
    if (reference.tagName !== 'DL' && !directCompact) {
      var referenceList=view.node('dl','');
      while(reference.firstChild)referenceList.appendChild(reference.firstChild);
      reference.remove();reference=referenceList;
    }
    reference.classList.add('airport-return__reference');
    reference.hidden=false;
    root.querySelector('[data-booking-status-lead]').after(reference);
    ['pickup','destination'].forEach(function (key) {
      var value = root.querySelector('[data-booking-status-' + key + ']');
      var label = key === 'pickup' ? result.pickupAddress : result.destinationAddress;
      var address = key === 'pickup' ? result.pickupAddressDetail : result.destinationAddressDetail;
      var location=mobileLocation(label,address);
      value.textContent=location;
      if(confirmed || pending) {
        // Split only our separator between contract fields, never a display label.
        if(label && address && location===label+'\n'+address) {
          value.replaceChildren(view.node('strong','',label),view.node('span','airport-return__address',address));
        } else if(confirmed && key==='pickup' && !address) {
          value.replaceChildren(view.node('strong','',location));
        }
        // A compound destination stays complete and normal-weight. Do not guess
        // a place name by splitting user/server text on punctuation.
      }
      value.parentNode.hidden=!label && !address;
    });
    root.querySelector('[data-booking-status-date]').textContent = view.date(result.serviceStartLocalDate, true);
    if (directCompact) {
      var passenger = root.querySelector('[data-booking-status-passengers]');
      var band = String(result.passengerLabel || '').match(/(\d+)\s*[–-]\s*(\d+)/);
      if(band)passenger.textContent = band[1] + '–' + band[2];
      var duration = root.querySelector('[data-booking-status-duration]');
      duration.parentNode.hidden = !(Number.isFinite(result.durationHours) && result.durationHours > 0);
      var service = root.querySelector('[data-booking-status-service]');
      service.parentNode.hidden = false;
      service.textContent = state.dictionary.serviceLabels.direct_transfer;
    }
    details.appendChild(root.querySelector('[data-booking-status-vehicle]').parentNode);
    var contact = root.querySelector('[data-airport-return-contact]');
    var disclosure = root.querySelector('.airport-return__disclosure');
    if (!contact) {
      disclosure=view.node('details','airport-return__disclosure');
      disclosure.appendChild(view.node('summary',''));
      contact = view.node('dl', 'airport-return__contact');
      contact.setAttribute('data-airport-return-contact', '');
      ['name','phone','email'].forEach(function (key) { var row=view.field(view.t(key),'');row.setAttribute('data-airport-return-'+key,'');contact.appendChild(row); });
      disclosure.appendChild(contact);details.after(disclosure);
    }
    disclosure.querySelector('summary').textContent=view.t(result.customerNotes ? 'contactNotes' : 'contact');
    ['name','phone','email'].forEach(function (key) {
      var row=contact.querySelector('[data-airport-return-'+key+']');
      var value=result[key==='name'?'customerFullName':key==='phone'?'customerPhone':'customerEmail'];
      row.hidden=!value;row.querySelector('dt').textContent=view.t(key==='name'?'contact':key);row.querySelector('dd').textContent=value || '';
    });
    var notes=root.querySelector('[data-booking-status-notes-row]');
    if (notes) { contact.appendChild(notes);notes.removeAttribute('tabindex');notes.removeAttribute('role'); }
    disclosure.hidden=!result.customerFullName && !result.customerPhone && !result.customerEmail && !result.customerNotes;
    var resume=root.querySelector('.airport-return__resume');
    if (!resume) {
      resume=view.node('section','airport-return__resume');
      resume.appendChild(view.node('div','airport-return__payment-actions'));
      details.before(resume);
    }
    resume.hidden=false;
    var paymentActions=resume.querySelector('.airport-return__payment-actions');
    ['retry','modify','new'].forEach(function(key){var action=root.querySelector('[data-booking-cancelled-'+key+']');if(action && action.parentNode!==paymentActions)paymentActions.appendChild(action);});
    var amount=root.querySelector('[data-booking-status-amount]');
    var payment=root.querySelector('[data-airport-return-payment]');
    if (!payment) {
      payment=view.node('dl','airport-return__payment');payment.setAttribute('data-airport-return-payment','');
      resume.prepend(payment);
    }
    var amountRow=amount && amount.parentNode;
    payment.hidden=false;
    if (!amountRow) { amountRow=view.field('','');amount=amountRow.querySelector('dd');amount.setAttribute('data-booking-status-amount',''); }
    amountRow.querySelector('dt').textContent=view.t(confirmed?'paidAmount':result.view==='pending'?'pendingAmount':'amount');
    amount.textContent=view.money(confirmed?result.paymentAmountPaid:result.paymentAmountExpected,result.paymentCurrency);
    payment.prepend(amountRow);
    var key=result.reservationStatus!=='failed' && !confirmed && raw.hold && Number.isFinite(Date.parse(raw.hold.expiresAt)) && Number.isFinite(Date.parse(raw.serverNow)) && !actions.canCreateNewReservation ? state.token+'|'+raw.hold.expiresAt : '';
    if (key !== mobileDeadlineKey) {
      if (mobileDeadline) mobileDeadline.remove();
      mobileDeadline=null;mobileDeadlineKey=key;
      if (key) {
        mobileDeadline=view.deadline(raw.hold.expiresAt,serverNow(raw),'paymentDeadlinePassed');
        mobileDeadline.setAttribute('data-airport-mobile-deadline','');
        // The existing clock keeps its performance-time anchor across redraws.
        mobileDeadline.className='airport-return__deadline';
      }
    }
    if (mobileDeadline) payment.after(mobileDeadline);
    var retry=root.querySelector('[data-booking-cancelled-retry]');
    if (retry && !retry.disabled) retry.textContent=view.t('resumePayment');
    if (pending) {
      // Match the installed Hourly hierarchy, retaining action nodes and clock.
      details.after(disclosure);
      disclosure.after(resume);
    } else {
      // A live status refresh must restore the other states' existing order.
      details.before(resume);
    }
    var timezone=root.querySelector('[data-airport-confirmed-timezone]');
    if(confirmed) {
      if(!timezone) {timezone=view.node('div','airport-return__timezone');timezone.setAttribute('data-airport-confirmed-timezone','');}
      timezone.replaceChildren(view.node('dt','',view.t('confirmedTimezone')));
      ['date','time'].forEach(function(key){details.appendChild(root.querySelector('[data-booking-status-'+key+']').parentNode);});
      details.appendChild(timezone);
      var serviceRow=root.querySelector('[data-booking-status-service]').parentNode;
      serviceRow.classList.add('airport-return__service');serviceRow.hidden=false;
      reference.after(serviceRow);
      var durationValue=root.querySelector('[data-booking-status-duration]');
      var durationRow=durationValue.parentNode;
      durationRow.classList.add('airport-return__estimated-duration');
      durationRow.hidden=!(Number.isFinite(result.durationHours) && result.durationHours > 0 &&
        durationValue.textContent.trim() && durationValue.textContent.trim() !== (state.dictionary.details.empty || '—'));
      durationRow.querySelector('dt').textContent=view.t('estimatedDuration');
      details.appendChild(durationRow);
      ['pickup','destination'].forEach(function(key){var value=root.querySelector('[data-booking-status-'+key+']');if(value)details.appendChild(value.parentNode);});
      var vehicleSummary=root.querySelector('.airport-return__vehicle-summary');
      if(!vehicleSummary) {vehicleSummary=view.node('dl','airport-return__vehicle-summary');resume.before(vehicleSummary);}
      vehicleSummary.hidden=false;resume.hidden=true;
      var vehicle=root.querySelector('[data-booking-status-vehicle]');
      var thumbnail=vehicle.querySelector('[data-booking-status-vehicle-thumb]');
      var vehicleName=view.node('span','airport-return__vehicle-name',result.vehicleDisplayName || '—');
      vehicle.replaceChildren(vehicleName);if(thumbnail)vehicle.appendChild(thumbnail);
      ['vehicle','passengers','luggage'].forEach(function(key){var value=root.querySelector('[data-booking-status-'+key+']');if(value)vehicleSummary.appendChild(value.parentNode);});
      vehicleSummary.appendChild(amountRow);
      var whatsapp=root.querySelector('[data-booking-status-whatsapp]');
      var another=root.querySelector('[data-booking-status-primary],[data-booking-cancelled-home]');
      if(whatsapp) {whatsapp.textContent=view.t('talkWhatsApp');whatsapp.parentNode.prepend(whatsapp);}
      if(another)another.textContent=view.t('bookAnother');
    } else {
      if(timezone)timezone.remove();
      vehicleSummary=root.querySelector('.airport-return__vehicle-summary');
      if(vehicleSummary) {
        ['vehicle','passengers','luggage'].forEach(function(key){var value=root.querySelector('[data-booking-status-'+key+']');if(value)details.appendChild(value.parentNode);});
        vehicleSummary.hidden=true;
      }
    }
  }
  function render() {
    // Compact confirmations can use the current dictionary even while the superseded
    // initial copy request is unresolved. renderMobileResult guards copy readiness.
    if (!view.media.matches && (ready || state && (state.result.serviceType === 'airport_transfer' ||
        state.result.serviceType === 'direct_transfer' && state.result.view === 'confirmed' && state.result.paymentStatus === 'paid'))) renderMobileResult();
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
    if(result.view==='pending'&&(result.contactUpdatePending||result.paymentWindowRenewed))lead.textContent+=' '+state.dictionary[result.contactUpdatePending?'contactUpdatePending':'contactEmailRenewed'];
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
    if (!state || state.result !== value.result) receivedAt = window.performance.now();
    state = value;
    if (state.result.serviceType === 'airport_transfer' && state.result.reservationStatus === 'pending_payment' && state.result.view === 'pending' && state.result.paymentStatus !== 'paid') {
      var fleet = window.PixkuyFleetSelection.read('airport_transfer');
      var owner = fleet.reservationToken || fleet.attempt && fleet.attempt.response && fleet.attempt.response.bookingStatusToken;
      if ((!owner || owner === state.token) && (!fleet.attempt || fleet.attempt.state === 'committed' && owner === state.token)) window.PixkuyFleetSelection.bindReservation('airport_transfer', state.token);
    }
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
