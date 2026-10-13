(function(window,document){
  'use strict';
  var own=window.PixkuyDirectBookingForm, state=window.PixkuyDirectTransferTransactionalState, base=window.PixkuyAirportDesktopView, view=window.PixkuyDirectDesktopView;
  var form=own.getReservationForm(), mount=null, pending=null, pendingReceivedAt=0, hydrated=false;
  function desktop(){return base.media.matches;}
  function active(){return desktop() && /^#direct\/datos/.test(location.hash);}
  function snapshot(){return state.buildSnapshot(form,own.getReservationRequestData());}
  function save(){
    if(!hydrated)return;
    if(pending){pending.proof=window.PixkuyForms.LegalAcceptance.readEvidence(form,'web_direct_transfer_checkout');pending.onChange(own.getReservationRequestData(),pending.proof);return;}
    var saved=snapshot();saved.desktopDraft={version:1,stage:active()?'datos':'servicio'};state.writeReviewSnapshot(saved);
  }
  function close(){own.home.appendChild(form);if(mount)mount.remove();mount=null;document.body.classList.remove('direct-booking-active');}
  function configure(field){
    save();close();history.pushState(null,'','/?service=direct_transfer&lang='+encodeURIComponent(document.documentElement.lang)+'#direct/servicio');
    window.PixkuyDirectTransferPanel.restore(own.raw()).then(function(){
      window.PixkuyServicesExpand.open('direct');
      requestAnimationFrame(function(){var target=document.querySelector(field==='notes'?'[data-direct-transfer-panel-notes]':'[data-services-direct-transfer-config]');if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}});
    });
  }
  function summary(){
    var aside=view.summary(snapshot());aside.appendChild(view.trip(snapshot()));
    aside.appendChild(view.block('notes',base.node('p','',own.value('direct_transfer_notes')||'—'),pending?null:function(){configure('notes');}));
    return aside;
  }
  function refreshQuote(){
    if(!active()||pending||!mount)return false;
    // Persist an updated, unaccepted quote too. F5 must not resurrect the
    // rejected binding, and the current amount must be visible before retrying.
    save();
    var aside=mount.querySelector('.airport-booking__summary');
    if(aside)aside.replaceWith(summary());
    return true;
  }
  function render(){
    if(!active()){close();return;}
    close();mount=base.shell(1,function(){pending?pending.onBack():configure();},null,{showBack:false});
    mount.classList.add('direct-booking');document.body.appendChild(mount);document.body.classList.add('direct-booking-active');
    var layout=base.node('div','airport-booking__layout'),left=base.node('section','airport-booking__main');
    left.append(base.node('h1','',base.t(pending?'editDataTitle':'dataTitle')),form);
    own.getReservationRequestFields().submit.textContent=base.t('reviewCta');
    var legal=window.PixkuyForms.LegalAcceptance,host=form.querySelector('[data-direct-transfer-checkout-legal-acceptance]');
    if(!host){host=base.node('div','');host.setAttribute('data-direct-transfer-checkout-legal-acceptance','1');form.querySelector('.form-actions').before(host);}
    var instance=host.__pixkuyLegalAcceptanceInstance;
    if(!instance){var proof=legal.readEvidence(form,'web_direct_transfer_checkout');instance=legal.create({container:host,form:form,channel:'web_direct_transfer_checkout',checkboxId:'pixkuy-direct-transfer-legal-acceptance'});host.__pixkuyLegalAcceptanceInstance=instance;instance.restore(proof);}
    host.hidden=false;
    if(pending){instance.restore(pending.proof);var estimate=new Date(Date.parse(pending.serverNow)+Math.max(0,Date.now()-pendingReceivedAt)).toISOString();left.prepend(base.deadline(pending.expiresAt,estimate,'editDeadlinePassed',refreshPending));left.appendChild(base.action(base.t('exitEdit'),pending.onBack));}
    else left.appendChild(base.action(base.t('backTrip'),function(){configure();}));
    left.appendChild(base.node('p','airport-booking__help',base.t('noPayment')));
    layout.append(left,summary());mount.appendChild(layout);refreshPending();
    // Restored contact/consent must update guards without waiting for an event.
    if(!pending)window.PixkuyDirectBookingCheckout.refreshFormState();
    base.focusRouteHeading(mount.querySelector('h1'));
  }
  function open(value){
    pending=null;own.setTrip(value);hydrated=true;save();history.pushState(null,'','/?service=direct_transfer&lang='+encodeURIComponent(document.documentElement.lang)+'#direct/datos');
    base.ready.then(render);return true;
  }
  function refreshPending(){if(pending){var submit=own.getReservationRequestFields().submit;submit.disabled=!pending.canReview()||!own.validate(false)||!window.PixkuyForms.LegalAcceptance.readEvidence(form,'web_direct_transfer_checkout');submit.setAttribute('aria-disabled',String(submit.disabled));}}
  function openPending(_,value,options){pending=options;pendingReceivedAt=Date.now();own.setTrip(value);own.contact(options.contact);hydrated=true;render();return true;}
  form.addEventListener('input',save);form.addEventListener('change',function(){save();refreshPending();});
  document.addEventListener('submit',function(e){if(e.target!==form||!pending)return;e.preventDefault();e.stopImmediatePropagation();save();if(pending.canReview()&&own.validate(true)&&window.PixkuyForms.LegalAcceptance.readEvidence(form,'web_direct_transfer_checkout'))pending.onReview();},true);
  function restore(){
    if(!desktop())return;
    if(window.PixkuyDirectPendingEdit.activeData()){window.PixkuyDirectPendingEdit.mountData(null);return;}
    var saved=state.readReviewSnapshot();
    if(new URLSearchParams(location.search).get('service')==='direct_transfer' && location.hash==='#contact')history.replaceState(null,'',location.pathname+location.search+'#direct/servicio');
    if(saved && (active()||location.hash==='#direct/servicio'||location.hash==='#direct/servicio/notes')){own.restore(saved);hydrated=true;if(active())render();else configure(location.hash.endsWith('/notes')?'notes':null);}
    else if(active()||location.hash==='#direct/servicio'){close();history.replaceState(null,'',location.pathname+location.search+'#direct/servicio');window.PixkuyServicesExpand.open('direct');}
  }
  window.addEventListener('popstate',function(){active()?restore():close();});
  window.addEventListener('pixkuy:i18n-applied',function(){base.ready.then(function(){if(active())render();});});
  window.addEventListener('pixkuy:airport-desktop-copy',function(){if(active())render();});
  window.PixkuyDirectDesktopBooking={open:open,configure:configure,openPending:openPending,refreshPending:refreshPending,refreshQuote:refreshQuote};
  base.ready.then(restore);
})(window,document);
