(function(window,document){
  "use strict";
  var base=window.PixkuyAirportDesktopView,copy={},summaryCopy={};
  if(!base)return;
  function t(key){return copy[key]||copy[{yourTrip:"tripTitle",trip:"tripTitle",backTrip:"editTrip"}[key]]||base.t(key);}
  function load(){
    var lang=(document.documentElement.lang||"es").toLowerCase();
    return Promise.all([base.ready,window.fetch("assets/i18n/"+lang+"/services-hourly.json").then(function(r){
      if(!r.ok)throw new Error("HOURLY_TRANSLATION_UNAVAILABLE");return r.json();
    })]).then(function(values){copy=values[1].hourlyBooking||{};summaryCopy=values[1].services.cards.hourly.mobileFlow.contactStep.summary;window.dispatchEvent(new CustomEvent("pixkuy:hourly-booking-copy"));});
  }
  function end(snapshot,compact){
    var date=snapshot.hourly_daily_date,time=snapshot.hourly_daily_start_time,hours=Number(snapshot.hourly_daily_duration_hours);
    if(!date||!time||!Number.isFinite(hours))return "";
    var clock=new Date(date+"T"+time+":00Z");clock.setUTCMinutes(clock.getUTCMinutes()+hours*60);
    return base.date(clock.toISOString().slice(0,10),compact)+" · "+clock.toISOString().slice(11,16);
  }
  function price(snapshot,fresh,reservationAmount){
    if(reservationAmount)return base.money(reservationAmount.amountMinor,reservationAmount.currency);
    if(!fresh)return null;
    var amount=Number(String(snapshot.hourly_daily_price||"").replace(/[^0-9.]/g,""));
    return base.money(Math.round(amount*100),snapshot.hourly_daily_currency||"MXN");
  }
  function summary(snapshot,fresh,reservationAmount){
    var aside=base.node("aside","hourly-booking__summary"),list=base.node("dl","");
    var model=window.PixkuyFleetSelection.model("hourly_daily")||snapshot.fleet_model||{};
    var photo=window.PixkuyFleetSelection.photo(model);
    if(photo){var image=base.node("img","hourly-booking__photo");image.src=photo;image.alt=model.name||"";image.addEventListener("error",function(){image.remove();});aside.appendChild(image);}
    aside.appendChild(base.node("h2","",model.name||t("tripTitle")));
    list.append(base.field(t("tripTitle"),t(snapshot.hourly_daily_mode==="full_day"?"fullDay":"hourly")),
      base.field(t("origin"),snapshot.hourly_daily_pickup),
      base.field(t("date"),base.date(snapshot.hourly_daily_date)),
      base.field(t("time"),snapshot.hourly_daily_start_time),
      base.field(t("duration"),snapshot.hourly_daily_duration_hours+" h"),
      base.field(t("end"),end(snapshot)),
      base.field(t("passengers"),window.PixkuyFleetSelection.passengerLabel(snapshot.hourly_daily_passengers)));
    aside.append(list,base.node("p","hourly-booking__timezone",t("timezone")));
    var amount=price(snapshot,fresh,reservationAmount);
    if(amount)aside.appendChild(base.node("p","airport-booking__total",amount));
    else aside.appendChild(base.node("p","",t("unverified")));
    return aside;
  }
  // Same compact summary hierarchy as Airport's createBookingView; Hourly
  // civil dates, duration and notes remain owned by this service.
  function dataSummary(snapshot,fresh,contactOnly,reservationAmount){
    var summary=base.node("section","hourly-booking__data-summary");
    summary.appendChild(base.node("h2","",summaryCopy.title+" "+t(snapshot.hourly_daily_mode==="full_day"?"fullDay":"hourly")));
    var list=base.node("dl","");
    var model=window.PixkuyFleetSelection.model("hourly_daily")||snapshot.fleet_model||{};
    var amount=price(snapshot,fresh,reservationAmount);
    [["pickup",snapshot.hourly_daily_pickup,true],
      ["start",base.date(snapshot.hourly_daily_date,true)+" · "+snapshot.hourly_daily_start_time,true],
      ["end",end(snapshot,true),true],
      ["duration",snapshot.hourly_daily_duration_hours+" h"],
      ["passengers",window.PixkuyFleetSelection.passengerLabel(snapshot.hourly_daily_passengers)],
      ["vehicle",model.name],
      ["price",amount||t("unverified")],
      ["notes",snapshot.hourly_daily_notes,true]].forEach(function(entry){
        if(entry[0]==="notes"&&!String(entry[1]||"").trim())return;
        var row=entry[0]==="pickup"&&contactOnly?pickupField(summaryCopy.pickup,entry[1]):base.field(summaryCopy[entry[0]]||t(entry[0]),entry[1]);
        row.setAttribute("data-hourly-summary-row",entry[0]);
        if(entry[2])row.classList.add("hourly-booking__detail--wide");list.appendChild(row);
      });
    summary.append(list,base.node("p","hourly-booking__timezone",t("timezone")));
    return summary;
  }
  // Hourly's display label is not a structured place name. Split only an
  // explicit separator or an independently supplied address, never a comma.
  function pickupField(label,value,address){
    var raw=String(value||"").trim(),detail=String(address||"").trim(),name=raw;
    if(detail&&raw.endsWith(detail))name=raw.slice(0,-detail.length).replace(/\s*(?:—|,)\s*$/,"").trim();
    var row;
    if(detail&&name&&name!==raw)row=base.locationField(label,name,{address:detail});
    else if(detail&&raw&&raw!==detail&&raw.indexOf(detail.split(",")[0])<0)row=base.locationField(label,raw,{address:detail});
    else if(!detail&&raw.indexOf(" — ")>0)row=base.locationField(label,raw);
    else row=base.field(label,raw||detail);
    row.classList.add("hourly-booking__pickup");return row;
  }
  function mobileSummary(snapshot,fresh,stage,contactOnly,reservationAmount){
    if(stage==="datos")return dataSummary(snapshot,fresh,contactOnly,reservationAmount);
    var aside=base.node("section","hourly-booking__review-block hourly-booking__review-service");
    var model=window.PixkuyFleetSelection.model("hourly_daily")||snapshot.fleet_model||{};
    aside.appendChild(base.node("h2","",t("mobileReviewTitle")));
    aside.appendChild(base.node("p","hourly-booking__service",t(snapshot.hourly_daily_mode==="full_day"?"fullDay":"hourly")));
    var places=base.node("dl","hourly-booking__review-places");
    places.appendChild(pickupField(t("origin"),snapshot.hourly_daily_pickup));
    var list=base.node("dl","hourly-booking__review-facts");
    [["start",base.date(snapshot.hourly_daily_date,true)+" · "+snapshot.hourly_daily_start_time,true],
      ["end",end(snapshot,true),true],
      ["duration",snapshot.hourly_daily_duration_hours+" h"],
      ["passengers",window.PixkuyFleetSelection.passengerLabel(snapshot.hourly_daily_passengers)],
      ["vehicle",model.name,true]].forEach(function(entry){
        var row=base.field(summaryCopy[entry[0]]||t(entry[0]),entry[1]);
        row.setAttribute("data-hourly-review-row",entry[0]);
        if(entry[2])row.classList.add("hourly-booking__detail--wide");list.appendChild(row);
      });
    aside.append(places,list,base.node("p","hourly-booking__timezone",t("timezone")));
    return aside;
  }
  function mobileTotal(snapshot,fresh,reservationAmount){
    var total=base.node("p","hourly-booking__review-total");
    total.append(base.node("span","",t("mobileTotal")),base.node("strong","",price(snapshot,fresh,reservationAmount)||"—"));
    return total;
  }
  window.PixkuyHourlyBookingView={t:t,node:base.node,action:base.action,field:base.field,summary:summary,mobileSummary:mobileSummary,mobileTotal:mobileTotal,pickupField:pickupField,
    money:base.money,deadline:base.deadline,date:base.date,locationField:base.locationField,vehicle:base.vehicle,icon:base.icon,
    mobileShell:function(back,step){
      var shell=base.node("section","hourly-booking hourly-booking--mobile"),row=base.node("div","hourly-mobile-flow__back-row");
      var control=base.action(window.__pixkuyI18nDict?.airportMobileFlow?.back||t("editTrip"),back,false);
      control.classList.add("hourly-mobile-flow__back");row.appendChild(control);shell.appendChild(row);return shell;
    },
    shell:function(step,back,editData,options){
      var shell=base.shell(step,back,editData,options);
      var first=shell.querySelector(".airport-booking__step-label");
      if(first){first.textContent=t("tripTitle");
        var tripAction=first.closest("button");if(tripAction)tripAction.setAttribute("aria-label",t("tripTitle"));}
      var backButton=shell.querySelector(".airport-booking__identity button");
      if(backButton&&step<4)backButton.textContent=t("editTrip");
      return shell;
    },focus:base.focus,media:base.media,ready:load()};
  window.addEventListener("pixkuy:i18n-applied",function(){load().catch(function(){});});
})(window,document);
