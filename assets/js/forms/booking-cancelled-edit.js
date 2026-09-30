(function initBookingCancelledEdit(window, document) {
  "use strict";
  if (!window || !document || !window.PixkuyBookingStatusState) return;

  var SNAPSHOT_KEY = "pixkuy_airport_transfer_checkout_review_snapshot";
  var RETURN_KEY = "pixkuy_airport_transfer_checkout_review_return";
  var EDIT_KEY = "pixkuy_airport_pending_edit_v1";
  var FLEET_KEY = "pixkuy_fleet_b:airport_transfer";

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

  function beginEdit(state) {
    var edit = state.result.raw && state.result.raw.edit;
    var draft = edit && edit.draft;
    if (!edit || !edit.allowed || !draft) return false;
    var prior;
    try { prior = JSON.parse(window.sessionStorage.getItem(EDIT_KEY) || "null"); }
    catch (_) { prior = null; }
    var context = {
      version: 1,
      token: state.token,
      editRevision: edit.revision,
      idempotencyKey: prior && prior.token === state.token && prior.editRevision === edit.revision
        ? prior.idempotencyKey
        : window.crypto.randomUUID(),
      publicCode: state.result.publicCode,
      expiresAt: state.result.raw.hold.expiresAt,
      serverNow: state.result.raw.serverNow,
      receivedAt: Date.now(),
      createdAt: new Date().toISOString()
    };
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(buildSnapshot(draft)));
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
      state.result.serviceType === "airport_transfer" &&
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
    beginNew: function (state) {
      var raw = state.result.raw;
      if (!raw.actions.canCreateNewReservation || !raw.continuation || !raw.continuation.draft) return false;
      var fleet = window.PixkuyFleetSelection.read("airport_transfer");
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
    var button = document.querySelector("[data-booking-cancelled-modify]");
    var allowed = canEdit(state);
    if (!button) return;
    button.textContent = t(
      state.dictionary,
      "cancelled.actions.modify",
      "Modificar datos"
    );
    visible(button, allowed);
    button.disabled = !allowed;
    button.setAttribute("aria-disabled", allowed ? "false" : "true");
    if (button.dataset.bookingCancelledModifyBound === "1") return;
    button.dataset.bookingCancelledModifyBound = "1";
    button.addEventListener("click", function () {
      if (!button.disabled) beginEdit(state);
    });
  });
})(window, document);
