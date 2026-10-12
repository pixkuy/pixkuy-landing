(function(window,document){
  "use strict";
  var KEY="pixkuy_hourly_checkout_review_snapshot",RETURN="pixkuy_hourly_checkout_review_return";
  function read(){try{return JSON.parse(window.sessionStorage.getItem(KEY)||"null");}catch(_){return null;}}
  function save(value){
    var encoded=JSON.stringify(value);window.sessionStorage.setItem(KEY,encoded);
    if(window.sessionStorage.getItem(KEY)!==encoded)throw new Error("FLEET_STORAGE_UNAVAILABLE");
    return value;
  }
  function panelSnapshot(value){
    var snapshot={};
    [ ["mode","mode"],["durationHours","duration_hours"],["customTerm","custom_term"],
      ["vehicleType","vehicle_type"],["pickup","pickup"],["pickupPlaceId","pickup_place_id"],
      ["pickupLat","pickup_lat"],["pickupLng","pickup_lng"],["tripDate","date"],
      ["startTime","start_time"],["notes","notes"],["currency","currency"] ].forEach(function(entry){
      if(value && value["hourly_daily_"+entry[1]]!=null)snapshot[entry[0]]=value["hourly_daily_"+entry[1]];
    });
    return snapshot;
  }
  function syncPanel(value){
    window.dispatchEvent(new CustomEvent("pixkuy:contact-hourly-daily-sync",{detail:{snapshot:panelSnapshot(value)}}));
  }
  function restore(value){
    var form=window.PixkuyHourlyBookingForm?.getReservationForm();
    if(!form||!value)return false;
    var edit=window.PixkuyFleetSelection?.hourlyEdit();
    if(edit?.contactOnly && value.hourlyPendingToken===edit.token){
      var recovered=false;
      ["name","phone","email"].forEach(function(key){
        // Absence can fall back to the authorized reservation. An intentional
        // empty string is an edit and must continue through normal validation.
        if(value[key]==null && edit.contact?.[key]!=null){value[key]=edit.contact[key];recovered=true;}
      });
      if(recovered)save(value);
    }
    Object.keys(value).forEach(function(key){
      var field=form.elements.namedItem(key);
      if(field && typeof value[key]!=="object" && value[key]!=null)field.value=String(value[key]);
    });
    var notes=form.elements.namedItem("message");if(notes)notes.value=value.hourly_daily_notes??value.message??"";
    var api=window.PixkuyHourlyBookingForm;
    if(api)api.syncReservationRequestState(api.getReservationRequestFields(form));
    if(window.PixkuyFleetSelection && value.hourly_daily_passengers!=null)
      window.PixkuyFleetSelection.setPassengers(value.hourly_daily_passengers);
    syncPanel(value);
    if(window.PixkuyHourlyCheckout)window.PixkuyHourlyCheckout.sync();
    if(value.legal_acceptance_accepted===false){
      var acceptance=document.getElementById("pixkuy-hourly-legal-acceptance");
      if(acceptance){acceptance.checked=false;acceptance.dispatchEvent(new Event("change",{bubbles:true}));}
    }
    return true;
  }
  function acceptance(value){
    var legal=window.PixkuyForms&&window.PixkuyForms.LegalAcceptance;
    if(!legal||!value||![true,"true"].includes(value.legal_acceptance_accepted)||
      value.legal_acceptance_channel!=="web_hourly_checkout"||!Number.isFinite(Date.parse(value.legal_acceptance_accepted_at)))return null;
    // Read current policy identifiers only. Never use the newly built timestamp
    // or turn an absent acceptance into consent.
    var policy=legal.buildSnapshot("web_hourly_checkout"),fields=legal.fieldNames;
    if(["termsVersion","cancellationsVersion","privacyVersion","termsUrl","cancellationsUrl","privacyUrl"].some(function(key){return value[fields[key]]!==policy[key];}))return null;
    var evidence={};Object.keys(fields).forEach(function(key){evidence[fields[key]]=String(value[fields[key]]);});
    return evidence;
  }
  function fromPublic(draft,evidence){
    var snapshot=Object.assign({},draft,{
      name:draft.customer&&draft.customer.full_name||"",phone:draft.customer&&draft.customer.phone||"",
      email:draft.customer&&draft.customer.email||"",message:draft.hourly_daily_notes||"",
      // Public status uses numbers; the existing form/panel handoff uses strings.
      hourly_daily_pickup_lat:draft.hourly_daily_pickup_lat==null?"":String(draft.hourly_daily_pickup_lat),
      hourly_daily_pickup_lng:draft.hourly_daily_pickup_lng==null?"":String(draft.hourly_daily_pickup_lng),
      hourly_daily_price:String(draft.hourly_daily_price/100),legal_acceptance_accepted:false
    });
    var verified=Object.prototype.hasOwnProperty.call(draft,"legal_acceptance_accepted")?acceptance(draft):acceptance(evidence);
    Object.keys(snapshot).forEach(function(key){if(key.indexOf("legal_acceptance_")===0)delete snapshot[key];});
    Object.assign(snapshot,verified||{legal_acceptance_accepted:false});
    delete snapshot.customer;return snapshot;
  }
  window.PixkuyHourlyBookingDraft={read:read,save:save,restore:restore,panelSnapshot:panelSnapshot,syncPanel:syncPanel,fromPublic:fromPublic,acceptance:acceptance,key:KEY,returnKey:RETURN};
})(window,document);
