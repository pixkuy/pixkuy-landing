(function(window,document){
  "use strict";
  var view=window.PixkuyHourlyBookingView,draft=window.PixkuyHourlyBookingDraft,api=window.PixkuyHourlyCheckout;
  var form=window.PixkuyHourlyBookingForm?.getReservationForm();
  if(!view||!draft||!api||!form)return;
  var home=document.createComment("Hourly canonical form home"),mount=null,busy=false,notice="",snapshot=null,reviewed="",renderedStep="";
  var submit=form.querySelector("#hourly-contact-submit"),submitText=submit.textContent,submitKey=submit.getAttribute("data-i18n");
  var checkingAvailability=false,suspended=false,restoringDraft=false,editEntryPositioned=false,hydrated=false,navigationVersion=0;
  var keyboardNavigation=false;
  document.addEventListener("keydown",function(event){
    if(event.key!=="Tab" && !event.key.startsWith("Arrow"))return;
    keyboardNavigation=true;
    mount?.querySelectorAll("[data-hourly-touch-focus]").forEach(function(node){node.removeAttribute("data-hourly-touch-focus");});
    document.querySelector('#services-expand-hourly h3[data-hourly-programmatic-focus]')?.removeAttribute("data-hourly-programmatic-focus");
  },true);
  document.addEventListener("pointerdown",function(){keyboardNavigation=false;},true);
  var phoneLabel=form.querySelector('label[for="hourly-contact-phone"]'),phoneLabelText=phoneLabel.textContent;
  var phoneKey=phoneLabel.getAttribute("data-i18n"),phonePlaceholderKey=form.elements.phone.getAttribute("data-i18n-ph");
  var phonePlaceholder=form.elements.phone.getAttribute("placeholder"),phoneMobileCopy=false;
  form.before(home);
  function step(){var match=/^#hourly\/(datos|revision|servicio)$/.exec(window.location.hash);return match?match[1]:"";}
  function fresh(){return window.PixkuyFleetSelection.hourlyOfferStatus().valid;}
  function attempt(){var value=window.PixkuyFleetSelection.read("hourly_daily").attempt;return value&&value.state!=="not_committed"?value:null;}
  function save(fromEntry){
    if(!hydrated||suspended||restoringDraft)return snapshot;
    // Only Data owns editable fields. Review, an unmounted route and another
    // service's form cannot overwrite the proposal with their current values.
    if(fromEntry!==true && (renderedStep!=="datos" || !mount?.contains(form)))return snapshot;
    var value=api.draft();if(value){
      var owner=editing()?.token || snapshot?.hourlyPendingToken;
      if(owner)value.hourlyPendingToken=owner;
      snapshot=draft.save(value);
    }return snapshot;}
  function editing(){return window.PixkuyFleetSelection.hourlyEdit();}
  function contactEdit(){return !!editing()?.contactOnly;}
  function reservationAmount(){
    var edit=editing(),amount=edit?.reservationAmount;
    return edit?.contactOnly && snapshot?.hourlyPendingToken===edit.token &&
      Number.isSafeInteger(amount?.amountMinor) && amount.amountMinor>=0 &&
      typeof amount.currency==="string" && /^[A-Z]{3}$/.test(amount.currency)?amount:null;
  }
  function expired(){
    var edit=editing();return edit&&edit.expiresAt&&Date.parse(edit.expiresAt)<=Date.parse(edit.serverNow)+Math.max(0,Date.now()-edit.receivedAt);
  }
  function historyContext(){return editing()?{hourlyPendingToken:editing().token}:{};}
  function go(next){save();navigationVersion++;window.history.pushState(historyContext(),"","#hourly/"+next);render();}
  function validDraft(value){return !!(value && ["hourly","full_day"].includes(value.hourly_daily_mode) &&
    value.hourly_daily_pickup && value.hourly_daily_date && value.hourly_daily_start_time &&
    Number(value.hourly_daily_duration_hours)>0 && Number(value.hourly_daily_passengers)>=1);}
  function hourlyDestination(){
    return !!step() || ((!window.location.hash || window.location.hash==="#services") &&
      new URLSearchParams(window.location.search).get("service")==="hourly_daily");
  }
  function statusReturn(token){
    suspended=true;navigationVersion++;
    window.location.replace("/booking-cancelled.html?token="+encodeURIComponent(token));
  }
  // Resolve only a requested Hourly destination. Home and other services stay free.
  // Missing edit authority is reacquired from status, never converted into creation.
  function reconcileRoute(){
    if(!hourlyDestination())return true;
    var fleet=window.PixkuyFleetSelection.read("hourly_daily"),edit=editing(),sent=attempt();
    var token=edit?.token || fleet.reservationToken || sent?.response?.bookingStatusToken || snapshot?.hourlyPendingToken || window.history.state?.hourlyPendingToken;
    if(token && (!edit || !validDraft(snapshot) || (snapshot.hourlyPendingToken && snapshot.hourlyPendingToken!==edit.token) ||
      (edit.contactOnly && !reservationAmount()) || sent?.state==="committed")){
      statusReturn(token);return false;
    }
    var target=step();
    if(edit && target==="servicio" && !sent){
      if(!edit.serviceBaseline){statusReturn(edit.token);return false;}
      // A direct URL/history entry must enter the same service-edit mode as Back.
      edit.contactOnly=false;
      window.sessionStorage.setItem("pixkuy_hourly_pending_edit_v1",JSON.stringify(edit));
    }
    if(edit && !target)target=sent?"revision":"datos";
    else if(!validDraft(snapshot) && (target==="datos"||target==="revision"))target="servicio";
    else if(sent && validDraft(snapshot))target="revision";
    if(target && target!==step())window.history.replaceState(historyContext(),"","#hourly/"+target);
    else if(edit)window.history.replaceState(Object.assign({},window.history.state,historyContext()),"",window.location.href);
    return true;
  }
  function resumeEntry(){
    if(!hydrated || step()==="datos" || step()==="revision")return false;
    if(!editing() && !window.PixkuyFleetSelection.read("hourly_daily").reservationToken && !attempt())return false;
    if(!reconcileRoute())return true;
    if(step()==="datos"||step()==="revision"){render();return true;}
    return false;
  }
  function restore(){
    home.after(form);form.classList.remove("hourly-booking__form");form.inert=false;
    if(phoneMobileCopy){
      ["name","email"].forEach(function(name){var label=form.querySelector('label[for="hourly-contact-'+name+'"]');if(label){label.setAttribute('data-i18n','contact.'+name);label.textContent=window.__pixkuyI18nDict?.contact?.[name] || label.textContent;}});
      if(phoneKey)phoneLabel.setAttribute("data-i18n",phoneKey);
      phoneLabel.textContent=window.__pixkuyI18nDict?.contact?.phone||phoneLabelText;
      if(phonePlaceholderKey)form.elements.phone.setAttribute("data-i18n-ph",phonePlaceholderKey);
      var translatedPhonePlaceholder=phonePlaceholderKey&&phonePlaceholderKey.split(".").reduce(function(value,key){return value&&value[key];},window.__pixkuyI18nDict);
      form.elements.phone.setAttribute("placeholder",translatedPhonePlaceholder||phonePlaceholder||"");
      phoneMobileCopy=false;
    }
    submit.textContent=submitText;if(submitKey)submit.setAttribute("data-i18n",submitKey);
    if(mount)mount.remove();mount=null;document.body.classList.remove("hourly-booking-active");
    document.querySelector("#services-expand-hourly")?.removeAttribute("data-hourly-booking-hidden");
    document.querySelector("[data-hourly-mobile-route-content]")?.removeAttribute("data-hourly-booking-step");
  }
  function leave(){
    if(!mount)return false;
    save();navigationVersion++;checkingAvailability=false;api.setBusy(false);restore();renderedStep="";suspended=true;
    return true;
  }
  function button(key,fn,primary){var b=view.action(view.t(key),fn,primary);b.disabled=busy;return b;}
  function trip(focusNotes){
    if(attempt()){go("revision");return;}
    var edit=editing();
    if(edit){
      // Old contact-only contexts must reacquire the authorized service baseline.
      if(!edit.serviceBaseline){statusReturn(edit.token);return;}
      edit.contactOnly=false;
      window.sessionStorage.setItem("pixkuy_hourly_pending_edit_v1",JSON.stringify(edit));
    }
    save();reviewed="";notice="";go("servicio");
    openConfiguration(focusNotes);
  }
  function openConfiguration(focusNotes){
    draft.syncPanel(snapshot);
    if(!view.media.matches&&window.PixkuyHourlyMobileBookingFlow)window.PixkuyHourlyMobileBookingFlow.open();
    else {
      // Expand first; one guarded frame owns both focus and positioning.
      // A later route must not be moved by an obsolete return callback.
      var version=navigationVersion;
      window.PixkuyServicesExpand.open("hourly",{scroll:false});
      window.requestAnimationFrame(function(){
        if(version!==navigationVersion||step()!=="servicio"||!view.media.matches)return;
        var target=document.querySelector(focusNotes===true?'[data-services-hourly-notes]':'#services-expand-hourly');
        if(!target)return;
        if(focusNotes===true)target.focus({preventScroll:true});
        else {
          var heading=document.querySelector('#services-expand-hourly h3');
          if(heading){
            heading.tabIndex=-1;
            if(!keyboardNavigation)heading.setAttribute("data-hourly-programmatic-focus","");
            else heading.removeAttribute("data-hourly-programmatic-focus");
            heading.focus({preventScroll:true});
          }
        }
        var rect=target.getBoundingClientRect(),height=window.innerHeight||document.documentElement.clientHeight;
        var offset=focusNotes===true?Math.max(96,(height-rect.height)/2):Math.min(96,Math.max(56,Math.round(height*.1)));
        window.scrollTo({top:Math.max(0,rect.top+window.scrollY-offset),behavior:"instant"});
      });
    }
  }
  function backData(){if(contactEdit()&&attempt()){exitEdit();return;}go("datos");}
  function fingerprint(value){
    var copy=Object.assign({},value);delete copy.createdAt;delete copy.hourlyPendingToken;return JSON.stringify(copy);
  }
  function exitEdit(){
    save();var edit=editing();if(!edit)return;
    window.sessionStorage.setItem("pixkuy_hourly_unsaved:"+edit.token,JSON.stringify(snapshot));
    window.location.assign("/booking-cancelled.html?token="+encodeURIComponent(edit.token));
  }
  function recover(){
    var origin=navigationVersion;busy=true;notice="checking";render();
    window.PixkuyFleetSelection.recoverAttempt("hourly_daily").then(function(result){
      busy=false;if(origin!==navigationVersion||suspended)return;
      // Recovery already owns the authorized checkout handoff. Do not replace it with status.
      if(result?.bookingStatusToken&&(result.checkoutUrl||result.recovery?.action==="reservation_status"))return;
      notice="";render();
    }).catch(function(){busy=false;if(origin!==navigationVersion||suspended)return;notice="saveUncertain";render();});
  }
  function checkAvailability(){
    if(checkingAvailability||busy||attempt()||expired())return;
    var origin=navigationVersion;checkingAvailability=true;notice="checkingAvailability";render();
    api.precheck({interactive:false}).then(function(result){
      if(origin!==navigationVersion||suspended)return;
      checkingAvailability=false;
      // Server authority wins over the displayed countdown. Reacquire status
      // for rejected editing; do not label expiration/stale authority as no cars.
      if(editing() && ["BOOKING_STATUS_NOT_FOUND","BOOKING_STATUS_TOKEN_EXPIRED",
        "CHECKOUT_REPLACEMENT_STALE","CHECKOUT_REPLACEMENT_NOT_ALLOWED",
        "CHECKOUT_ALREADY_COMPLETED","CHECKOUT_PAYMENT_WINDOW_CLOSED",
        "CHECKOUT_STATE_UNCERTAIN"].includes(result.code)){
        statusReturn(editing().token);return;
      }
      if(expired()){notice="";render();return;}
      notice=result.available&&fresh()?"":(!result.ok||result.code==="PRECHECK_REQUEST_FAILED"||result.code==="PRECHECK_UNAVAILABLE"?"availabilityError":"availabilityUnavailable");
      if(step()==="datos"||step()==="revision")render();
    }).catch(function(){if(origin!==navigationVersion||suspended)return;checkingAvailability=false;notice=expired()?"":"availabilityError";if(mount)render();});
  }
  function guardReview(){
    if(step()!=="datos")return;
    api.sync();
    protectReview();
  }
  function reviewBlocked(){return step()==="datos"&&(checkingAvailability||!fresh()||expired()||!!attempt());}
  function guardReviewExpiry(){
    if(suspended||step()!=="datos")return false;
    if(!expired())return true;
    // Document submit, form capture and the final transition share this clock.
    checkingAvailability=false;api.setBusy(false);notice="";render();return false;
  }
  function protectReview(){
    // Consent synchronization also writes disabled. Preserve the additional
    // availability guard without enabling over its validation result.
    if(reviewBlocked()&&!submit.disabled){submit.disabled=true;submit.setAttribute("aria-disabled","true");}
  }
  new MutationObserver(protectReview).observe(submit,{attributes:true,attributeFilter:["disabled"]});
  form.addEventListener("submit",function(event){
    if(reviewBlocked()){event.preventDefault();event.stopImmediatePropagation();guardReviewExpiry();protectReview();}
  },true);
  function pay(){
    if(busy)return;
    if(attempt()){recover();return;}
    if(expired()){notice="editDeadlinePassed";render();return;}
    if(!fresh()||fingerprint(save())!==reviewed){notice="offerChanged";go("datos");return;}
    var origin=navigationVersion;busy=true;notice="";render();
    api.submit().then(function(result){
      busy=false;if(origin!==navigationVersion||suspended)return;
      var body=result.body||{};
      if(result.ok&&body.checkoutUrl&&body.bookingStatusToken){
        if(!api.redirect(body.checkoutUrl,body.bookingStatusToken))throw new Error("HANDOFF_STORAGE_REQUIRED");
        return;
      }
      notice=body.recovery&&body.recovery.state==="not_committed"?"offerChanged":"saveUncertain";
      busy=false;render();
    }).catch(function(){busy=false;if(origin!==navigationVersion||suspended)return;notice="saveUncertain";render();});
  }
  function render(){
    if(!hydrated || !reconcileRoute())return;
    var current=step(),focused=document.activeElement;
    if(current!=="datos"&&current!=="revision"){
      if(current==="servicio" && mount){save();restore();renderedStep=current;}
      else if(mount)leave();
      return;
    }
    var resumed=suspended;
    if(resumed){
      var saved=snapshot||draft.read();suspended=false;restoringDraft=true;
      try{
        draft.restore(saved);snapshot=saved;
      }finally{restoringDraft=false;}
    }
    var routeContent=document.querySelector("[data-hourly-mobile-route-content]");
    var previousStep=routeContent&&routeContent.getAttribute("data-hourly-booking-step");
    var previousScroll=window.scrollY;
    var selection=focused&&typeof focused.selectionStart==="number"?[focused.selectionStart,focused.selectionEnd]:null;
    save();restore();
    var changed=renderedStep!==current;
    if(changed){navigationVersion++;checkingAvailability=false;}
    renderedStep=current;
    if(current!=="datos"&&current!=="revision")return;
    if(!snapshot)return;
    document.body.classList.add("hourly-booking-active");
    var mobile=!view.media.matches;
    var desktopReview=!mobile&&current==="revision";
    if(mobile && window.PixkuyHourlyMobileBookingFlow && !window.PixkuyHourlyMobileBookingFlow.isOpen())
      window.PixkuyHourlyMobileBookingFlow.open();
    mount=mobile?view.mobileShell(current==="revision"?backData:trip,current):
      view.shell(current==="datos"?1:2,desktopReview?trip:current==="revision"?backData:trip,backData,desktopReview?{showBack:false}:undefined);
    if(mobile){
      document.querySelector("#services-expand-hourly")?.setAttribute("data-hourly-booking-hidden","");
      routeContent=document.querySelector("[data-hourly-mobile-route-content]");
      if(routeContent){routeContent.setAttribute("data-hourly-booking-step",current);if(previousStep!==current)routeContent.scrollTop=0;}
    }
    mount.classList.add("hourly-booking");
    if(desktopReview)mount.classList.add("hourly-booking--desktop-final");
    if(mobile)mount.classList.add(current==="datos"?"hourly-booking--data":"hourly-booking--review");
    if(contactEdit()){
      mount.classList.add("hourly-booking--contact-edit");
      var topBack=mount.querySelector(".airport-booking__identity button");
      if(topBack)topBack.textContent=window.__pixkuyI18nDict?.airportMobileFlow?.back||view.t("backData");
    }
    mount.setAttribute("aria-label",view.t(current==="datos"?"dataTitle":"reviewTitle"));
    var layout=view.node("div","hourly-booking__layout"),content=view.node("section","hourly-booking__content");
    var heading=view.node("h1","",view.t(current==="datos"?"dataTitle":"reviewTitle"));heading.tabIndex=-1;if(!mobile)content.appendChild(heading);
    var summary=desktopReview?view.reviewSummary(snapshot,fresh(),reservationAmount()):null;
    var statusHost=desktopReview?summary:content;
    if(desktopReview)content.appendChild(view.node("p","airport-booking__lead",view.t("reviewText")));
    var edit=editing();
    if(edit){
      statusHost.appendChild(view.node("p",desktopReview?"airport-booking__reference":"",edit.publicCode));
      var estimated=new Date(Date.parse(edit.serverNow)+Math.max(0,Date.now()-edit.receivedAt)).toISOString();
      statusHost.appendChild(view.deadline(edit.expiresAt,estimated,"editDeadlinePassed",function(){
        if(mount)mount.querySelectorAll("[data-hourly-pay]").forEach(function(b){b.disabled=true;});
        protectReview();
      }));
      if(mobile&&!contactEdit())content.appendChild(button("exitEdit",exitEdit));
    }
    if(notice){var message=view.node("p","hourly-booking__notice",view.t(notice));message.setAttribute("role","status");statusHost.appendChild(message);}
    if(notice==="availabilityError")statusHost.appendChild(button("retryAvailability",checkAvailability));
    if(notice==="availabilityUnavailable")statusHost.appendChild(button("editTrip",trip));
    if(attempt()){
      statusHost.appendChild(button("recoverSave",recover,true));
      if(attempt().response&&attempt().response.bookingStatusToken){
        statusHost.appendChild(button("resumePayment",function(){window.location.assign("/booking-cancelled.html?token="+encodeURIComponent(attempt().response.bookingStatusToken));}));
      }
    }
    if(current==="datos"){
      form.classList.add("hourly-booking__form");form.inert=busy||!!attempt();
      if(contactEdit()){
        if(!mobile&&snapshot.hourly_daily_notes){var readNotes=view.node("dl","");readNotes.appendChild(view.field(view.t("notes"),snapshot.hourly_daily_notes));content.appendChild(readNotes);}
      }
      ["name","phone","email"].forEach(function(name){
        var field=form.elements.namedItem(name),wrapper=field&&field.closest(".form-field");
        if(wrapper)wrapper.setAttribute("data-hourly-booking-field",name);
      });
      submit.removeAttribute("data-i18n");submit.textContent=view.t("reviewCta");
      content.append(form,view.node("p","",view.t("noPayment")));
      if(mobile){
        phoneMobileCopy=true;
        ["name","email"].forEach(function(name){var label=form.querySelector('label[for="hourly-contact-'+name+'"]');if(label){label.removeAttribute('data-i18n');label.textContent=window.__pixkuyI18nDict?.airportMobileContactStep?.fields?.[name] || label.textContent;}});
        phoneLabel.removeAttribute("data-i18n");phoneLabel.textContent=window.__pixkuyI18nDict?.airportMobileContactStep?.fields?.phone || view.t("phone");
        form.elements.phone.removeAttribute("data-i18n-ph");form.elements.phone.setAttribute("placeholder","+52 55 1234 5678");
      }
    }else{
      var contact=view.node("dl",desktopReview?"airport-booking__details":"hourly-booking__contact");
      [["name","name"],["phone","phone"],["email","email"],["notes","hourly_daily_notes"]].forEach(function(entry){
        if(desktopReview&&entry[0]==="notes")return;
        if(mobile && entry[0]==="notes" && !String(snapshot[entry[1]]||"").trim())return;
        var row=view.field(view.t(entry[0]),snapshot[entry[1]]);
        if(mobile&&entry[0]==="notes")row.classList.add("hourly-booking__review-notes");
        contact.appendChild(row);
      });
      if(mobile){
        var contactBlock=view.node("section","hourly-booking__review-block");
        contactBlock.append(view.node("h2","",view.t("contact")),contact);content.appendChild(contactBlock);
      }else{
        var tripDetails=view.desktopTrip(snapshot);
        var tripContent=view.node("div","");tripContent.append(tripDetails,view.node("p","hourly-booking__timezone",view.t("timezone")));
        content.append(view.desktopBlock("tripTitle",tripContent,contactEdit()?null:trip),view.desktopBlock("contact",contact,backData));
        if(String(snapshot.hourly_daily_notes||"").trim()){
          var notes=view.node("dl","airport-booking__details");notes.appendChild(view.field(view.t("notes"),snapshot.hourly_daily_notes));
          content.appendChild(view.desktopBlock("notes",notes,contactEdit()?null:function(){trip(true);}));
        }
      }
      var legal=view.node("div","legal-acceptance__links");
      [["terms","mobileTerms"],["cancellations","mobileCancellations"],["privacy","mobilePrivacy"]].forEach(function(entry){
        var link=view.node("a","",view.t(entry[1]));link.href="legal/"+entry[0]+".html";link.target="_blank";link.rel="noopener";legal.appendChild(link);
      });
      if(mobile){
        var conditions=view.node("section","hourly-booking__review-block hourly-booking__review-conditions");
        conditions.append(view.node("p","",view.t("accepted")),legal);
        content.append(conditions,view.mobileTotal(snapshot,fresh(),reservationAmount()));
      }else{
        var conditions=view.node("section","airport-booking__conditions"),accepted=view.node("p","airport-booking__conditions-status");
        accepted.append(view.icon("check"),view.node("span","",view.t("accepted")));
        legal.querySelectorAll("a").forEach(function(link){link.prepend(view.icon("document"));});
        conditions.append(accepted,legal);content.appendChild(conditions);
      }
      var proceed=button(edit?"replacePayCta":"payCta",pay,true);
      proceed.setAttribute("data-hourly-pay","");proceed.disabled=busy||expired()||!fresh()||!!attempt();
      statusHost.appendChild(proceed);
      if(!fresh()&&!mobile)statusHost.appendChild(button("backData",function(){notice="unverified";go("datos");}));
    }
    summary=summary||(mobile?view.mobileSummary(snapshot,fresh(),current,contactEdit(),reservationAmount()):view.summary(snapshot,fresh(),reservationAmount()));
    if(mobile){summary.classList.add("hourly-booking__summary--mobile");layout.append(summary,content);heading=summary.querySelector("h2");heading.tabIndex=-1;}
    else layout.append(content,summary);
    heading.setAttribute("data-hourly-route-heading","");
    mount.appendChild(layout);
    ((mobile?document.querySelector("[data-hourly-mobile-route-content]"):null) || document.body).appendChild(mount);
    // Checkout synchronization resolves the canonical form from the document.
    // Run after mounting so a completed precheck can release its loading guard.
    if(current==="datos")guardReview();
    if(mobile && previousStep===current)window.scrollTo({top:previousScroll,left:0,behavior:"instant"});
    if(contactEdit()&&current==="datos"&&!editEntryPositioned){
      editEntryPositioned=true;
      window.requestAnimationFrame(function(){window.requestAnimationFrame(function(){
        if(mount&&step()==="datos"&&!form.contains(document.activeElement))window.scrollTo({top:0,left:0,behavior:"instant"});
      });});
    }else if(changed)window.scrollTo({top:0,left:0,behavior:"instant"});
    if(!changed && current==="datos" && focused && form.contains(focused)){
      focused.focus({preventScroll:true});
      if(selection)focused.setSelectionRange(selection[0],selection[1]);
    }else if(changed || resumed || !focused || focused===document.body || focused.hasAttribute("data-hourly-route-heading")){
      // Keep the accessible route target without a touch-only decorative ring.
      // Keyboard navigation restores the ordinary :focus-visible treatment.
      if(mobile && !keyboardNavigation)heading.setAttribute("data-hourly-touch-focus","");
      heading.focus({preventScroll:true});
    }
    if(resumed&&!fresh()&&!attempt())checkAvailability();
  }
  function openData(value){
    hydrated=true;
    if(suspended){
      ["name","phone","email"].forEach(function(key){if(snapshot)form.elements.namedItem(key).value=snapshot[key]||"";});
      suspended=false;
    }
    // Configuration already owns the current offer. Copy its fields without
    // replaying the draft-to-panel sync, which would invalidate that offer.
    if(value&&value.service_type==="hourly_daily")window.PixkuyHourlyBookingForm.restore(value);
    if(renderedStep!=="datos" && renderedStep!=="revision" && form.elements.message)
      form.elements.message.value=form.elements.hourly_daily_notes.value;
    save(true);
    reviewed="";go("datos");return true;
  }
  function review(value){
    if(suspended||step()!=="datos")return false;
    // Expiry is handled in place, not as a generic checkout/redirect error.
    if(!guardReviewExpiry())return true;
    if(editing())value.hourlyPendingToken=editing().token;
    snapshot=draft.save(value);
    reviewed=fingerprint(value);notice="";go("revision");return true;
  }
  window.PixkuyHourlyBookingFlow={openData:openData,review:review,guardReviewExpiry:guardReviewExpiry,leave:leave,resumeEntry:resumeEntry,navigationVersion:function(){return navigationVersion;},isActive:function(){return hydrated && !!mount && !suspended&&(step()==="datos"||step()==="revision");}};
  window.addEventListener("pixkuy:hourly-daily-panel-submit",function(event){
    if(!view.media.matches)return;
    window.setTimeout(function(){if(["hourly","full_day"].indexOf(event.detail.hourly_daily_mode)>=0)openData(Object.assign({},event.detail,{service_type:"hourly_daily"}));},0);
  });
  function keepReviewLabel(){if(step()==="datos")window.queueMicrotask(function(){var label=view.t("reviewCta");if(submit.textContent!==label)submit.textContent=label;guardReview();});}
  form.addEventListener("input",function(){if(step()==="datos"){reviewed="";save();keepReviewLabel();}});
  form.addEventListener("change",keepReviewLabel);
  form.addEventListener("blur",keepReviewLabel,true);
  if(view.media.addEventListener)view.media.addEventListener("change",render);
  window.addEventListener("popstate",render);
  window.addEventListener("hashchange",render);
  document.addEventListener("pixkuy:fleet-offer-expired",function(event){if(event.detail.service==="hourly_daily"&&mount){notice="";render();checkAvailability();}});
  // The configuration engine may finish its existing refresh after history
  // restores Data. Re-evaluate the UI gate when that offer is accepted.
  document.addEventListener("pixkuy:fleet-offer-accepted",function(event){
    if(event.detail?.service==="hourly_daily" && mount && !suspended && step()==="datos")
      window.queueMicrotask(guardReview);
  });
  window.addEventListener("pagehide",save);
  window.addEventListener("pixkuy:hourly-booking-copy",function(){if(mount)render();});
  view.ready.then(function(){
    var saved=draft.read();snapshot=saved;
    // A page loaded at Home/another section has not hydrated Hourly's form.
    // Its later menu entry must take the same restore path as an in-page exit.
    suspended=!!saved&&!hourlyDestination();
    if(hourlyDestination() && validDraft(saved)){
      restoringDraft=true;
      try{
        draft.restore(saved);
        window.sessionStorage.removeItem(draft.returnKey);
      }finally{restoringDraft=false;}
    }
    hydrated=true;notice="";render();
    if(step()==="servicio" && editing() && !attempt())openConfiguration();
    if((step()==="datos"||step()==="revision")&&mount&&!fresh()&&!attempt())checkAvailability();
  }).catch(function(){
    var token=editing()?.token || window.PixkuyFleetSelection.read("hourly_daily").reservationToken;
    if(hourlyDestination()&&token)statusReturn(token);else restore();
  });
})(window,document);
