(function (window, document) {
  "use strict";
  // Adapter for the partial Airport trip in either viewport. The review snapshot and fleet
  // state remain the only stores; a draft never contains an offer certificate.
  var KEY = "pixkuy_airport_transfer_checkout_review_snapshot";
  var ready = false;
  var restoring = false;
  function read() { try { return JSON.parse(window.sessionStorage.getItem(KEY) || "null"); } catch (_) { return null; } }
  function locationOf(value) {
    if (!value) return null;
    var saved = value.airport_transfer_non_airport_location || {};
    var side = value.airport_transfer_direction === "destination_to_airport" ? "origin" : "destination";
    var placeId = saved.place_id || value.lodgingPlaceId || value["airport_transfer_"+side+"_place_id"];
    var lat = saved.lat ?? value.lodgingLat ?? value["airport_transfer_"+side+"_lat"];
    var lng = saved.lng ?? value.lodgingLng ?? value["airport_transfer_"+side+"_lng"];
    if (!placeId || lat === "" || lat == null || lng === "" || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
    return {place_id:placeId,lat:Number(lat),lng:Number(lng),address:saved.address || value.airport_transfer_destination_label || value.airport_hotel_hotel || ""};
  }
  function ordinary() {
    if (window.sessionStorage.getItem("pixkuy_airport_pending_edit_v1")) return false;
    var fleet = window.PixkuyFleetSelection && window.PixkuyFleetSelection.read("airport_transfer");
    return !!fleet && !fleet.reservationToken && !(fleet.attempt && fleet.attempt.state !== "not_committed");
  }
  function saveTrip() {
    var flow = window.PixkuyAirportDesktopBooking;
    var airport = window.PixkuyAirportZoneTariff;
    if (!ready || restoring || !ordinary() || !airport || flow && flow.active()) return false;
    var mobile = window.matchMedia("(max-width:720px)").matches;
    if (mobile ? !window.PixkuyAirportMobileBookingFlow || !window.PixkuyAirportMobileBookingFlow.isOpen() : airport.panel.hidden) return false;
    var previous = read() || {};
    var state = airport.getState();
    var toAirport = state.originType !== "airport";
    var airportId = toAirport ? state.destinationValue : state.originValue;
    var airportLabel = toAirport ? state.destinationLabel : state.originLabel;
    var addressInput = Array.from(airport.panel.querySelectorAll("[data-airport-lodging-input]")).find(function (node) { return node.getClientRects().length; });
    var address = state.lodgingEndpointLabel || addressInput && addressInput.value || "";
    var location = state.lodgingEndpointPlaceId ? {address:address,place_id:state.lodgingEndpointPlaceId,lat:state.lodgingEndpointLat,lng:state.lodgingEndpointLng} : null;
    var luggage = mobile ? airport.panel.querySelector("[data-airport-mobile-luggage-select]") : null;
    var luggageValue = luggage ? luggage.value : previous.luggage ?? previous.airport_transfer_luggage ?? "";
    var value = {service_type:"airport_transfer",legacy_service_type:"airport_hotel",airport_mobile_draft:true,airport_draft_stage:"traslado"};
    ["name","phone","email","message","notes"].forEach(function (key) { value[key] = previous[key] || ""; });
    Object.keys(previous).filter(function (key) { return key.indexOf("legal_acceptance_") === 0; }).forEach(function (key) { value[key] = previous[key]; });
    Object.assign(value, {
      airport_transfer_airport_id:airportId,airport_transfer_airport_label:airportLabel,
      airport_transfer_direction:toAirport?"destination_to_airport":"airport_to_destination",
      airport_hotel_direction:toAirport?"hotel_to_airport":"airport_to_hotel",
      airport_transfer_destination_label:address,airport_hotel_hotel:address,
      airport_transfer_non_airport_location:location,airport_mobile_unresolved_address:location?"":address,
      airport_transfer_zone_id:state.lodgingEndpointZoneId || "",zoneId:state.lodgingEndpointZoneId || "",
      lodgingPlaceId:location?location.place_id:"",lodgingLat:location?location.lat:"",lodgingLng:location?location.lng:"",
      airport_transfer_passenger_fare_key:state.selectedFareKey,passenger_fare_key:state.selectedFareKey,
      airport_transfer_date:state.serviceDate,airport_hotel_date:state.serviceDate,
      airport_transfer_time:state.serviceTime,airport_hotel_time:state.serviceTime,
      airport_transfer_luggage:luggageValue,luggage:luggageValue,
      airport_transfer_origin:toAirport?address:airportLabel,airport_transfer_destination:toAirport?airportLabel:address
    });
    value = window.PixkuyFleetSelection.snapshot("airport_transfer", value);
    var serialized = JSON.stringify(value);
    if (serialized !== window.sessionStorage.getItem(KEY)) window.sessionStorage.setItem(KEY, serialized);
    return true;
  }
  function restore() {
    var value = read(), airport = window.PixkuyAirportZoneTariff;
    if (ready || !ordinary() || !airport) { ready = true; return false; }
    if (!value || !value.airport_mobile_draft) { ready = true; return false; }
    restoring = true;
    try {
      window.PixkuyFleetSelection.invalidateOffer("airport_transfer");
      ["date","time"].forEach(function (key) {
        var field=airport.panel.querySelector('[data-airport-tariff-role="'+key+'"] input');
        field.value=""; field.dispatchEvent(new window.Event("change",{bubbles:true}));
      });
      airport.clearResolvedDestination();
      airport.setAirportSelection({airportId:value.airport_transfer_airport_id,direction:value.airport_transfer_direction==="destination_to_airport"?"hotel_to_airport":"airport_to_hotel"});
      airport.setFareKeySelection({fareKey:value.airport_transfer_passenger_fare_key || ""});
      var location = locationOf(value);
      if (location && location.place_id) airport.setResolvedDestination({placeLabel:location.address,placeId:location.place_id,lat:location.lat,lng:location.lng,zoneId:value.airport_transfer_zone_id,primaryType:"lodging"});
      else if (value.airport_mobile_unresolved_address) {
        var input=Array.from(airport.panel.querySelectorAll("[data-airport-lodging-input]")).find(function (node) { return node.getClientRects().length; });
        if (input) input.value=value.airport_mobile_unresolved_address;
      }
      if (window.PixkuyAirportMobileBookingFlow) window.PixkuyAirportMobileBookingFlow.setLuggage(value.airport_transfer_luggage ?? value.luggage ?? "0");
      // Restoring the panel in the background never grants Airport another
      // service's contact or legal fields. Re-entry uses the normal handoff.
      var requestedService = new URLSearchParams(window.location.search).get("service");
      var airportRoute = /^#airport\/(datos|revision|traslado)(?:\/|$)/.test(window.location.hash);
      if (airportRoute || requestedService === "airport_hotel" && !/^#hourly\//.test(window.location.hash))
        window.PixkuyForms.restoreContactAirportHotelDraftFields(value);
      document.dispatchEvent(new window.CustomEvent("pixkuy:airport-draft-restored"));
      ["date","time"].forEach(function (key) {
        var field=airport.panel.querySelector('[data-airport-tariff-role="'+key+'"] input');
        field.value=value["airport_transfer_"+key] || "";
        field.dispatchEvent(new window.Event("change",{bubbles:true}));
      });
    } finally { restoring=false; ready=true; }
    return true;
  }
  document.addEventListener("pixkuy:airport-trip-changed", function () { window.queueMicrotask(saveTrip); });
  document.addEventListener("input", function (event) { if (event.target.closest("#services-expand-airport")) window.queueMicrotask(saveTrip); });
  document.addEventListener("change", function (event) { if (event.target.closest("#services-expand-airport")) window.queueMicrotask(saveTrip); });
  document.addEventListener("pixkuy:fleet-model-selected", function (event) { if (event.detail.service==="airport_transfer") window.queueMicrotask(saveTrip); });
  window.addEventListener("pagehide", saveTrip);
  window.addEventListener("pageshow", restore);
  window.PixkuyAirportMobileDraft = {restore:restore,saveTrip:saveTrip,locationOf:locationOf};
})(window, document);
