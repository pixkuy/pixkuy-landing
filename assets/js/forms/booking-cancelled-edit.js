(function initBookingCancelledEdit(window, document) {
  "use strict";
  if (!window || !document || !window.PixkuyBookingStatusState) return;

  var SNAPSHOT_KEY = "pixkuy_airport_transfer_checkout_review_snapshot";
  var RETURN_KEY = "pixkuy_airport_transfer_checkout_review_return";
  var EDIT_KEY = "pixkuy_airport_pending_edit_v1";
  var FLEET_KEY = "pixkuy_fleet_b:airport_transfer";
  var currentState = null;
  var hourlyStatusReceivedAt = 0;

  function t(dictionary, path, fallback) {
    var value = String(path || "").split(".").reduce(function (cursor, key) {
      return cursor && cursor[key];
    }, dictionary);
    return typeof value === "string" ? value : fallback;
  }

  function visible(node, show) {
    if (!node) return;
    node.hidden = !show;
    node.style.display = show ? "" : "none";
    node.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function buildSnapshot(draft) {
    var location = draft.airport_transfer_non_airport_location || {};
    var apiDirection = draft.airport_transfer_direction;
    var direction = apiDirection === "destination_to_airport"
      ? "hotel_to_airport"
      : "airport_to_hotel";
    var airportLabel = draft.airport_transfer_airport_label ||
      String(draft.airport_transfer_airport_id || "").toUpperCase();
    var destinationLabel = draft.airport_transfer_destination_label || location.address || "";
    var hasCanonicalNotes = Object.prototype.hasOwnProperty.call(draft, "airport_transfer_notes");
    var snapshot = Object.assign({}, draft, {
      name: draft.customer && draft.customer.full_name || "",
      email: draft.customer && draft.customer.email || "",
      phone: draft.customer && draft.customer.phone || "",
      message: hasCanonicalNotes ? draft.airport_transfer_notes : "",
      luggage: draft.airport_transfer_luggage == null ? "" : String(draft.airport_transfer_luggage),
      direction: direction,
      airport_hotel_direction: direction,
      airportId: draft.airport_transfer_airport_id,
      zoneId: draft.airport_transfer_zone_id,
      zoneLabel: draft.airport_transfer_zone_label || "",
      airport_hotel_zone_label: draft.airport_transfer_zone_label || "",
      passenger_fare_key: draft.airport_transfer_passenger_fare_key,
      passengerFareKey: draft.airport_transfer_passenger_fare_key,
      passenger_bucket_label: draft.airport_transfer_passenger_bucket_label,
      passengerBucketLabel: draft.airport_transfer_passenger_bucket_label,
      serviceDate: draft.airport_transfer_date,
      serviceTime: draft.airport_transfer_time,
      airport_hotel_date: draft.airport_transfer_date,
      airport_hotel_time: draft.airport_transfer_time,
      airport_hotel_hotel: destinationLabel,
      airport_hotel_hotel_label: destinationLabel,
      airport_transfer_destination_label: destinationLabel,
      lodgingPlaceId: location.place_id,
      lodgingLat: location.lat,
      lodgingLng: location.lng,
      destination_place_id: location.place_id,
      destination_lat: location.lat,
      destination_lng: location.lng,
      origin_place_id: location.place_id,
      origin_lat: location.lat,
      origin_lng: location.lng,
      origin: direction === "hotel_to_airport" ? destinationLabel : airportLabel,
      destination: direction === "hotel_to_airport" ? airportLabel : destinationLabel,
      airport_transfer_origin: direction === "hotel_to_airport" ? destinationLabel : airportLabel,
      airport_transfer_destination: direction === "hotel_to_airport" ? airportLabel : destinationLabel,
      airport_desktop_amount_minor: draft.airport_transfer_price,
      fleet_model: draft.fleet_model,
      form_payload_raw: Object.assign({}, draft)
    });
    delete snapshot.form_payload_raw.customer;
    delete snapshot.form_payload_raw.fleet_model;
    return snapshot;
  }

  function persistFleetDraft(draft, token) {
    var model = draft.fleet_model || {};
    var selection = draft.fleet_selection || {};
    var current;
    try { current = JSON.parse(window.sessionStorage.getItem(FLEET_KEY) || "{}"); }
    catch (_) { current = {}; }
    current.offer = {
      version: 1,
      requestKey: "pending-edit",
      status: "available",
      selectedModelEligible: true,
      models: [{
        modelId: selection.model_id,
        modelRevision: selection.model_revision,
        name: model.name,
        photoUrl: model.photoUrl || null,
        photoUrls: model.photoUrl ? [model.photoUrl] : [],
        passengersSupported: draft.airport_transfer_passengers
      }]
    };
    current.selected = current.offer.models[0];
    current.selectedByUser = true;
    current.reservationToken = token;
    current.explicit = false;
    window.sessionStorage.setItem(FLEET_KEY, JSON.stringify(current));
  }

  function ownsAttempt(attempt, token, context) {
    if (!attempt || attempt.state === 'not_committed') return true;
    return !!(attempt.response && attempt.response.bookingStatusToken === token ||
      context && context.token === token && attempt.headers && attempt.headers['X-Pixkuy-Booking-Token'] === token);
  }

  function beginHourly(state,startNew,target){
    var raw=state.result.raw,edit=raw.edit;
    var source=startNew?raw.continuation&&raw.continuation.draft:edit&&edit.allowed&&edit.draft;
    if(!source || startNew&&!raw.actions.canCreateNewReservation)return false;
    var store=window.PixkuyHourlyBookingDraft,fleet=window.PixkuyFleetSelection;
    if(!store||!fleet)return false;
    var current=fleet.read("hourly_daily"),prior=fleet.hourlyEdit();
    if (!ownsAttempt(current.attempt, state.token, prior)) return false;
    if(current.reservationToken&&current.reservationToken!==state.token)return false;
    if(!startNew && prior && prior.token===state.token && current.attempt &&
      current.attempt.state!=="not_committed" &&
      !(current.attempt.state==="committed" && current.attempt.response?.bookingStatusToken===state.token) &&
      current.attempt.headers&&current.attempt.headers["X-Pixkuy-Booking-Token"]===state.token){
      // Older edit contexts can lack presentation metadata. Reacquire it from
      // this authorized status without changing the frozen attempt or its clock.
      prior.reservationAmount={amountMinor:raw.payment.amountExpected,currency:raw.payment.currency};
      prior.contact={name:source.customer?.full_name,phone:source.customer?.phone,email:source.customer?.email};
      window.sessionStorage.setItem("pixkuy_hourly_pending_edit_v1",JSON.stringify(prior));
      // Restore a missing presentation draft from the frozen request, without
      // changing that request or releasing its recovery guard.
      if(!store.read()){
        var frozen=current.attempt.payload||{},rawFields=frozen.form_payload_raw||{};
        var recoverySource=Object.assign({},source,{customer:frozen.customer||source.customer});
        Object.keys(source).forEach(function(key){if(/^(hourly_daily_|fleet_)/.test(key)&&key in frozen)recoverySource[key]=frozen[key];});
        if(rawFields.hourly_daily_notes!=null)recoverySource.hourly_daily_notes=rawFields.hourly_daily_notes;
        var recovered=store.fromPublic(recoverySource,frozen);recovered.hourlyPendingToken=state.token;store.save(recovered);
      }
      window.location.assign("/?service=hourly_daily#hourly/revision");return true;
    }
    var consent=null,attempt=current.attempt;
    if(!startNew&&current.reservationToken===state.token){
      // Same-reservation local evidence (including an explicit revocation) is
      // newer than the committed request. Service editing also owns this draft.
      var saved=store.read();
      if(prior&&prior.token===state.token&&saved?.hourlyPendingToken===state.token)consent=saved;
      else if(attempt&&attempt.state==="committed"&&attempt.response&&attempt.response.bookingStatusToken===state.token)consent=attempt.payload;
    }
    var snapshot=store.fromPublic(source,consent);
    if(startNew){
      fleet.completeReservation("hourly_daily",state.token,true);
      var unsaved;try{unsaved=JSON.parse(window.sessionStorage.getItem("pixkuy_hourly_unsaved:"+state.token));}catch(_){}
      if(unsaved)["name","email","phone","message","hourly_daily_notes"].forEach(function(key){if(key in unsaved)snapshot[key]=unsaved[key];});
      delete snapshot.fleet_selection;delete snapshot.fleet_model;snapshot.legal_acceptance_accepted=false;
    }else{
      var context={version:1,token:state.token,editRevision:edit.revision,idempotencyKey:prior && prior.token===state.token && prior.editRevision===edit.revision && !attempt ? prior.idempotencyKey : fleet.createAttemptKey(),contactOnly:target!=="servicio",serviceBaseline:source,
        publicCode:state.result.publicCode,expiresAt:raw.hold.expiresAt,
        // Carry the elapsed Pending time into the persisted editor clock.
        serverNow:new Date(Date.parse(raw.serverNow)+Math.max(0,window.performance.now()-hourlyStatusReceivedAt)).toISOString(),receivedAt:Date.now(),
        reservationAmount:{amountMinor:raw.payment.amountExpected,currency:raw.payment.currency},
        contact:{name:snapshot.name,phone:snapshot.phone,email:snapshot.email}};
      window.sessionStorage.setItem("pixkuy_hourly_pending_edit_v1",JSON.stringify(context));
      // Public authorization permits replacing the old attempt. The new replacement
      // is owned by the same shared fleet state, never by a parallel attempt store.
      var model=source.fleet_model||{},selection=source.fleet_selection||{};
      current.attempt=null;current.offer=null;current.explicit=false;current.reservationToken=state.token;
      current.selected={modelId:selection.model_id,modelRevision:selection.model_revision,name:model.name,
        photoUrl:model.photoUrl,photoUrls:model.photoUrl?[model.photoUrl]:[]};
      window.sessionStorage.setItem("pixkuy_fleet_b:hourly_daily",JSON.stringify(current));
    }
    if(!startNew)snapshot.hourlyPendingToken=state.token;
    store.save(snapshot);window.sessionStorage.setItem(store.returnKey,"1");
    window.location.assign("/?service=hourly_daily#hourly/"+(startNew||target==="servicio"?"servicio":"datos"));return true;
  }
  function beginEdit(state) {
    if (!canEdit(state)) return false;
    if(state.result.serviceType==='direct_transfer')return window.PixkuyDirectPendingEdit.begin(state);
    if(state.result.serviceType==="hourly_daily")return beginHourly(state,false);
    var edit = state.result.raw && state.result.raw.edit;
    var draft = edit && edit.draft;
    if (!edit || !edit.allowed || !draft) return false;
    var prior;
    try { prior = JSON.parse(window.sessionStorage.getItem(EDIT_KEY) || "null"); }
    catch (_) { prior = null; }
    var fleet = window.PixkuyFleetSelection.read("airport_transfer");
    if (!ownsAttempt(fleet.attempt, state.token, prior)) return false;
    var owner = fleet.reservationToken || fleet.attempt && fleet.attempt.response && fleet.attempt.response.bookingStatusToken;
    if (owner && owner !== state.token) return false;
    if (prior && prior.token === state.token && prior.attempt) {
      // Recover the original replacement even if the public revision advanced.
      if (!window.sessionStorage.getItem(SNAPSHOT_KEY)) window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(buildSnapshot(draft)));
      window.sessionStorage.setItem(RETURN_KEY, "1");
      window.location.assign("/?service=airport_hotel#airport/revision");
      return true;
    }
    var context = {
      version: 1,
      token: state.token,
      editRevision: edit.revision,
      idempotencyKey: prior && prior.token === state.token && prior.editRevision === edit.revision
        ? prior.idempotencyKey
        : window.PixkuyFleetSelection.createAttemptKey(),
      publicCode: state.result.publicCode,
      authorizedServiceDate: draft.airport_transfer_date,
      serviceBaseline: draft,
      expiresAt: state.result.raw.hold.expiresAt,
      serverNow: state.result.raw.serverNow,
      receivedAt: Date.now(),
      createdAt: new Date().toISOString()
    };
    var snapshot = buildSnapshot(draft);
    var saved;
    try { saved = JSON.parse(window.sessionStorage.getItem(SNAPSHOT_KEY) || "null"); } catch (_) {}
    // A same-edit revocation takes precedence over the original receipt.
    var evidence = prior && prior.token === state.token && saved && saved.airport_pending_token === state.token ? saved : draft;
    if (!Object.prototype.hasOwnProperty.call(evidence, "legal_acceptance_accepted") &&
        fleet.attempt && fleet.attempt.state === "committed" && fleet.attempt.response && fleet.attempt.response.bookingStatusToken === state.token) {
      evidence = Object.assign({}, fleet.attempt.payload && fleet.attempt.payload.form_payload_raw, fleet.attempt.payload);
    }
    var legal = window.PixkuyForms.LegalAcceptance;
    var proof = legal.readEvidence(evidence, "web_airport_checkout");
    Object.keys(snapshot).filter(function (key) { return key.indexOf("legal_acceptance_") === 0; }).forEach(function (key) { delete snapshot[key]; delete snapshot.form_payload_raw[key]; });
    snapshot.legal_acceptance_accepted = false;
    if (proof) Object.keys(legal.fieldNames).forEach(function (key) { snapshot[legal.fieldNames[key]] = proof[key]; });
    Object.keys(snapshot).filter(function (key) { return key.indexOf("legal_acceptance_") === 0; }).forEach(function (key) { snapshot.form_payload_raw[key] = snapshot[key]; });
    snapshot.airport_pending_token = state.token;
    snapshot.airport_draft_stage = "datos";
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    window.sessionStorage.setItem(RETURN_KEY, "1");
    window.sessionStorage.setItem(EDIT_KEY, JSON.stringify(context));
    persistFleetDraft(draft, state.token);
    window.location.assign("/?service=airport_hotel#airport/datos");
    return true;
  }

  function canEdit(state) {
    return Boolean(
      state &&
      state.result &&
      state.result.view === "pending" &&
      ["airport_transfer","hourly_daily","direct_transfer"].indexOf(state.result.serviceType)>=0 &&
      state.result.raw &&
      state.result.raw.actions &&
      state.result.raw.actions.canModify === true &&
      state.result.raw.edit &&
      state.result.raw.edit.allowed === true
    );
  }

  window.PixkuyBookingCancelledEdit = {
    allowed: canEdit,
    begin: beginEdit,
    beginConfigure: function(state) {
      return canEdit(state) && state.result.serviceType==="hourly_daily" && beginHourly(state,false,"servicio");
    },
    beginNew: function (state) {
      if(state.result.serviceType==="hourly_daily")return beginHourly(state,true);
      var raw = state.result.raw;
      if (!raw.actions.canCreateNewReservation || !raw.continuation || !raw.continuation.draft) return false;
      var fleet = window.PixkuyFleetSelection.read("airport_transfer");
      if (!ownsAttempt(fleet.attempt, state.token, null)) return false;
      if (fleet.reservationToken && fleet.reservationToken !== state.token) return false;
      window.PixkuyFleetSelection.completeReservation("airport_transfer", state.token, true);
      window.sessionStorage.removeItem(EDIT_KEY);
      var draft = buildSnapshot(raw.continuation.draft);
      var unsaved;
      try { unsaved = JSON.parse(window.sessionStorage.getItem("pixkuy_airport_unsaved:" + state.token)); } catch (_) {}
      if (unsaved) ["name","phone","email","luggage","message"].forEach(function (key) { if (Object.prototype.hasOwnProperty.call(unsaved,key)) draft[key] = unsaved[key]; });
      draft.airport_transfer_notes = draft.message;
      draft.form_payload_raw.airport_transfer_notes = draft.message;
      draft.airport_transfer_luggage = draft.luggage;
      draft.customer = {full_name:draft.name,phone:draft.phone,email:draft.email};
      delete draft.fleet_selection; delete draft.fleet_model;
      draft.airport_new_continuation = true;
      draft.legal_acceptance_accepted = false;
      draft.form_payload_raw.legal_acceptance_accepted = false;
      window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(draft));
      window.sessionStorage.setItem(RETURN_KEY, "1");
      window.location.assign("/?service=airport_hotel#airport/traslado");
      return true;
    },
    label: function (state) {
      return t(state && state.dictionary, "cancelled.actions.modify", "Modificar datos");
    }
  };

  window.PixkuyBookingStatusState.onReady(function renderEdit(state) {
    if(state.result.serviceType==="hourly_daily"&&(!currentState||currentState.result!==state.result))hourlyStatusReceivedAt=window.performance.now();
    currentState = state;
    var allowed = canEdit(state);
    document.querySelectorAll("[data-booking-cancelled-modify]").forEach(function (button) {
    var mobileHourly=state.result.serviceType==="hourly_daily"&&!!button.closest('[data-booking-cancelled-mobile]');
    var serviceButton=button.parentNode.querySelector('[data-booking-cancelled-modify-service]');
    if(mobileHourly&&!serviceButton){
      serviceButton=document.createElement('button');serviceButton.type='button';serviceButton.className=button.className;
      serviceButton.setAttribute('data-booking-cancelled-modify-service','');button.before(serviceButton);
      serviceButton.addEventListener('click',function(){window.PixkuyBookingCancelledEdit.beginConfigure(currentState);});
    }
    if(serviceButton){
      serviceButton.textContent=t(state.dictionary,'cancelled.actions.modifyService','Modificar servicio');
      visible(serviceButton,allowed&&mobileHourly);serviceButton.disabled=!allowed;
    }
    button.textContent = t(
      state.dictionary,
      mobileHourly?"cancelled.actions.modifyContact":"cancelled.actions.modify",
      "Modificar datos"
    );
    visible(button, allowed);
    button.disabled = !allowed;
    button.setAttribute("aria-disabled", allowed ? "false" : "true");
    if (button.dataset.bookingCancelledModifyBound === "1") return;
    button.dataset.bookingCancelledModifyBound = "1";
    button.addEventListener("click", function () {
      if (!button.disabled && canEdit(currentState)) beginEdit(currentState);
    });
    });
  });
})(window, document);
