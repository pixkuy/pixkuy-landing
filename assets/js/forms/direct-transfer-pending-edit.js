(function (window, document) {
  'use strict';
  const KEY='pixkuy_direct_pending_edit_v1';
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(_){return null;}};
  const write=value=>sessionStorage.setItem(KEY,JSON.stringify(value));
  const ready=()=>Promise.resolve(window.PixkuyBookingPublicConfig?.ready);
  function diagnostic(phase,code,http=0){
    const known=['CONTACT_CURRENT','DATA','RECONCILE_REQUIRED','STATE_UNVERIFIED','STATUS_HTTP','STATUS_SERVICE','STATUS_RESERVATION','STATUS_PAYMENT','STATUS_EDIT','STATUS_REVISION','STATUS_DEADLINE','PUBLIC_SITE_NOT_FOUND','SITE_KEY_REQUIRED','BOOKING_STATUS_NOT_FOUND','BOOKING_STATUS_TOKEN_EXPIRED','CHECKOUT_STATE_UNCERTAIN','CHECKOUT_REPLACEMENT_STALE'];
    const entry={phase,code:known.includes(code)?code:'REQUEST_FAILED',http,attempt:!!read()?.attempt};
    // Local, bounded, and deliberately without URLs, tokens, references or contact.
    let entries=[];try{entries=JSON.parse(sessionStorage.getItem('pixkuy_direct_pending_trace_v1')||'[]');}catch(_){}
    try{sessionStorage.setItem('pixkuy_direct_pending_trace_v1',JSON.stringify([...(Array.isArray(entries)?entries.slice(-11):[]),entry]));}catch(_){/* Diagnostics must not block recovery. */}
    return ' [DPE1-'+phase+'-'+entry.code+'-'+http+'-A'+Number(entry.attempt)+']';
  }
  function unchangedContactAttempt(context,raw,legal){
    const attempt=context.attempt,payload=attempt?.payload,draft=raw.edit?.draft;
    if(!payload||!attempt.key||attempt.revision!==raw.edit.revision||context.expiresAt!==raw.hold?.expiresAt||
      raw.contactUpdatePending!==false||raw.reservation.status!=='pending_payment'||raw.payment.status!=='pending'||
      !raw.edit.allowed||!raw.actions.canModify||payload.service_type!=='direct_transfer'||!draft?.customer)return false;
    if(Object.keys(payload).some(key=>!['service_type','customer','direct_transfer_notes'].includes(key)&&!key.startsWith('legal_acceptance_')))return false;
    const text=value=>String(value??'').trim();
    if(['full_name','phone'].some(key=>text(payload.customer?.[key])!==text(draft.customer[key]))||
      text(payload.customer?.email).toLowerCase()!==text(draft.customer.email).toLowerCase()||
      Object.hasOwn(payload,'direct_transfer_notes')&&text(payload.direct_transfer_notes)!==text(draft.direct_transfer_notes))return false;
    const channel=payload.legal_acceptance_channel;
    if(!['web_direct_transfer_mobile_checkout','web_direct_transfer_checkout'].includes(channel))return false;
    if(!legal.readEvidence(payload,channel)||!legal.readEvidence(draft,channel)||!context.proof)return false;
    // validate() historically refreshes accepted_at even without another consent
    // gesture. All other legal fields must match; a late receipt can only advance
    // the revision, never change contact/payment. Later edits retain the API fence.
    return Object.values(legal.fieldNames).every(key=>key==='legal_acceptance_accepted_at'||text(payload[key])===text(draft[key]));
  }
  const route=()=>new URLSearchParams(location.search).get('pending')==='1';
  const dataUrl=()=> '/?service=direct_transfer&pending=1&lang='+encodeURIComponent(document.documentElement.lang||'es')+'#direct/datos';
  const activeData=()=>location.pathname==='/'&&route()&&new URLSearchParams(location.search).get('service')==='direct_transfer'&&!!read()?.token;
  function snapshotOf(context){
    const frozen=context.attempt?.payload,contact=frozen?.customer||context.customer;
    const snapshot={...context.base,name:contact.full_name,email:contact.email,phone:contact.phone,
      direct_transfer_price:Number(context.base.direct_transfer_amount_minor)/100};
    if(frozen&&Object.hasOwn(frozen,'direct_transfer_notes'))snapshot.direct_transfer_notes=frozen.direct_transfer_notes;
    const band=String(snapshot.direct_transfer_passenger_bucket_label||'').match(/(\d+)\s*[–-]\s*(\d+)/);
    if(band)snapshot.direct_transfer_passenger_bucket_label=band[1]+'–'+band[2];
    return snapshot;
  }
  async function mountData(configStep){
    const context=read(),step=window.PixkuyDirectTransferMobileContactStep;
    if(!context||configStep.dataset.directPendingMounted)return;
    configStep.dataset.directPendingMounted='1';
    if(context.attempt){location.assign('/direct-transfer-checkout-review.html?pending=1#revision');return;}
    await Promise.all([window.PixkuyAirportDesktopView.ready,ready()]);
    let verified=false;
    const config=window.PIXKUY_BOOKING_API_CONFIG||{};
    const canReview=()=>verified&&Date.parse(context.expiresAt)>Date.parse(context.serverNow)+Math.max(0,Date.now()-context.receivedAt);
    step.openPending(configStep,snapshotOf(context),{
      contact:{name:context.customer.full_name,phone:context.customer.phone,email:context.customer.email},proof:context.proof,
      publicCode:context.publicCode,expiresAt:context.expiresAt,
      serverNow:new Date(Date.parse(context.serverNow)+Math.max(0,Date.now()-context.receivedAt)).toISOString(),canReview,
      onChange:(contact,proof)=>{context.customer.full_name=contact.name;context.customer.phone=contact.phone;context.customer.email=contact.email;context.proof=proof;write(context);},
      onBack:()=>location.assign('/booking-cancelled.html?token='+encodeURIComponent(context.token)),
      onReview:()=>location.assign('/direct-transfer-checkout-review.html?pending=1&lang='+encodeURIComponent(document.documentElement.lang||'es')+'#revision')
    });
    try{
      const response=await fetch((config.apiBaseUrl||'').replace(/\/$/,'')+'/v1/public/reservations/status?token='+encodeURIComponent(context.token),{headers:{'X-Pixkuy-Site-Key':config.publicSiteKey||'local_pixkuy_site_key'}});
      const raw=await response.json();
      if(!activeData())return;
      if(!response.ok||raw.reservation?.serviceType!=='direct_transfer'||raw.reservation.status!=='pending_payment'||raw.payment?.status!=='pending'||!raw.edit?.allowed||raw.edit.revision!==context.revision||raw.hold?.expiresAt!==context.expiresAt)throw new Error('STATE_CHANGED');
      context.serverNow=raw.serverNow;context.receivedAt=Date.now();write(context);verified=true;step.refreshPending();
    }catch(_){const error=document.querySelector('[data-direct-transfer-mobile-contact-global-error]');error.hidden=false;error.textContent=window.PixkuyAirportDesktopView.t('uncertain')+diagnostic('DATA','STATE_UNVERIFIED');}
  }
  function begin(state){
    const raw=state.result.raw, fleet=window.PixkuyFleetSelection.read('direct_transfer');
    const owner=fleet.reservationToken || fleet.attempt?.response?.bookingStatusToken;
    if(state.result.view!=='pending'||!raw.edit?.allowed||!raw.actions?.canModify||raw.reservation.serviceType!=='direct_transfer'||owner&&owner!==state.token)return false;
    if(fleet.attempt&&fleet.attempt.state!=='not_committed'&&fleet.attempt.response?.bookingStatusToken!==state.token)return false;
    const prior=read(), draft=raw.edit.draft;
    if(!draft?.customer)return false;
    const legal=window.PixkuyForms.LegalAcceptance;
    let proof=legal.readEvidence(draft,'web_direct_transfer_mobile_checkout') || legal.readEvidence(draft,'web_direct_transfer_checkout');
    if(!Object.hasOwn(draft,'legal_acceptance_accepted')&&owner===state.token&&fleet.attempt?.response?.bookingStatusToken===state.token){
      const payload=Object.assign({},fleet.attempt.payload?.form_payload_raw,fleet.attempt.payload);
      proof=legal.readEvidence(payload,'web_direct_transfer_mobile_checkout')||legal.readEvidence(payload,'web_direct_transfer_checkout');
    }
    if(prior?.token===state.token&&prior.revision===raw.edit.revision){
      if(unchangedContactAttempt(prior,raw,legal)){
        // Retain the former request for diagnosis; it is never sent with new data.
        prior.reconciledAttempt=prior.attempt;delete prior.attempt;diagnostic('BEGIN','CONTACT_CURRENT');
      }
      prior.base=draft;prior.expiresAt=raw.hold.expiresAt;prior.serverNow=raw.serverNow;prior.receivedAt=Date.now();write(prior);
    }
    else write({version:1,token:state.token,revision:raw.edit.revision,base:draft,customer:{...draft.customer},notes:draft.direct_transfer_notes||'',proof,
      publicCode:raw.reservation.publicCode,expiresAt:raw.hold.expiresAt,serverNow:raw.serverNow,receivedAt:Date.now()});
    diagnostic('BEGIN',read()?.attempt?'RECONCILE_REQUIRED':'DATA');location.assign(dataUrl());return true;
  }
  function mount(api){
    let context=read(), dictionary={}, verified=false,busy=false;
    if(location.hash!=='#revision'&&!context?.attempt){location.replace(dataUrl());return;}
    if(context?.attempt&&location.hash!=='#revision')history.replaceState(null,'',location.pathname+location.search+'#revision');
    const q=s=>document.querySelector(s), view=window.PixkuyAirportDesktopView;
    const status=()=>location.assign('/booking-cancelled.html?token='+encodeURIComponent(context.token));
    const live=()=>context&&Date.parse(context.expiresAt)>Date.parse(context.serverNow)+Math.max(0,Date.now()-context.receivedAt);
    const config=()=>window.PIXKUY_BOOKING_API_CONFIG||{};
    const endpoint=path=>(config().apiBaseUrl||'').replace(/\/$/,'')+'/v1/public/reservations/'+path;
    const headers=()=>({'X-Pixkuy-Site-Key':config().publicSiteKey||'local_pixkuy_site_key'});
    const flat=()=>Object.fromEntries(Object.entries(window.PixkuyForms.LegalAcceptance.fieldNames).map(([key,name])=>[name,context.proof?.[key]||'']));
    function valid(){return verified&&live()&&!busy&&!!context.proof&&!!context.customer.full_name&&/^\+[1-9]\d{7,14}$/.test(context.customer.phone);}
    function gate(){const button=q('[data-direct-transfer-checkout-review-proceed]');if(button){button.disabled=!valid();button.setAttribute('aria-disabled',String(button.disabled));}}
    function error(code,http=0){const node=q('[data-direct-transfer-checkout-review-error]');node.hidden=false;node.textContent=(code==='DIRECT_PENDING_EMAIL_CHANGE_UNAVAILABLE'?dictionary.pendingEmailLocked:dictionary.pendingUnavailable)+diagnostic('REVIEW',code||'STATE_UNVERIFIED',http);const recovery=view.action(dictionary.recover,status);node.appendChild(recovery);}
    function render(){
      if(!context){q('[data-direct-transfer-checkout-review-empty]').hidden=false;return;}
      const snapshot={...snapshotOf(context),...flat()};
      api.renderStaticCopy(dictionary);api.renderDetails(snapshot,dictionary);api.renderLegal(snapshot,dictionary);
      q('[data-direct-transfer-checkout-review-empty]').hidden=true;q('[data-direct-transfer-checkout-review-content]').hidden=false;
      document.body.setAttribute('data-direct-pending-edit','true');
      document.querySelectorAll('[data-direct-pending-form],[data-direct-pending-reference],[data-direct-pending-deadline]').forEach(n=>n.remove());
      const details=q('[data-direct-transfer-checkout-review-details]');
      const reference=view.node('p','booking-status__lead',view.t('reference')+': '+context.publicCode);reference.dataset.directPendingReference='';details.before(reference);
      const estimate=new Date(Date.parse(context.serverNow)+Math.max(0,Date.now()-context.receivedAt)).toISOString();
      const deadline=view.deadline(context.expiresAt,estimate,'editDeadlinePassed',gate);deadline.dataset.directPendingDeadline='';reference.after(deadline);
      const edit=q('[data-direct-transfer-checkout-review-edit]');edit.hidden=false;edit.removeAttribute('aria-disabled');edit.href=dataUrl();
      edit.onclick=event=>{event.preventDefault();if(!busy)location.assign(dataUrl());};
      const proceed=q('[data-direct-transfer-checkout-review-proceed]');proceed.textContent=dictionary.proceed;
      q('[data-direct-transfer-checkout-review-legal]').hidden=false;
      proceed.onclick=async()=>{
        if(busy)return;
        if(!valid()){gate();return;}busy=true;gate();edit.setAttribute('aria-disabled','true');
        try{
          if(!context.attempt){delete context.reconciledAttempt;context.attempt={key:window.PixkuyFleetSelection.createAttemptKey(),revision:context.revision,
            payload:{service_type:'direct_transfer',customer:{...context.customer},...flat(),legal_acceptance_accepted:true}};write(context);}
          const attempt=context.attempt;
          const response=await fetch(endpoint('update-contact'),{method:'POST',headers:{...headers(),'Content-Type':'application/json','X-Pixkuy-Booking-Token':context.token,'X-Pixkuy-Edit-Revision':attempt.revision,'Idempotency-Key':attempt.key},body:JSON.stringify(attempt.payload)});
          const body=await response.json();if(!response.ok){const e=new Error(body.code);e.code=body.code;e.recovery=body.recovery;throw e;}
          if(body.bookingStatusToken!==context.token||!body.checkoutUrl||!body.hold?.expiresAt||body.hold.expiresAt!==context.expiresAt&&!body.paymentWindowRenewed)throw new Error('INCOMPATIBLE_RESPONSE');
          context.revision=body.editRevision;context.expiresAt=body.hold.expiresAt;delete context.attempt;write(context);
          if(!api.redirectToCheckout(body.checkoutUrl,context.token))throw new Error('CHECKOUT_HANDOFF_FAILED');
        }catch(e){busy=false;if(e.recovery?.state==='authoritative_status'){status();return;}if(e.code&&!e.recovery&&!['IDEMPOTENCY_REQUEST_IN_PROGRESS','CHECKOUT_STATE_UNCERTAIN'].includes(e.code)){delete context.attempt;verified=false;write(context);}error(e.code);gate();}
      };
      if(context.attempt){edit.onclick=event=>{event.preventDefault();};edit.setAttribute('aria-disabled','true');}
      gate();
    }
    async function load(){dictionary=await api.loadDictionary();await view.ready;render();}
    window.addEventListener('hashchange',()=>{if(location.hash!=='#revision'){location.assign(dataUrl());return;}render();});
    window.matchMedia('(max-width:720px)').addEventListener('change',render);
    window.addEventListener('pixkuy:i18n-applied',load);
    Promise.all([load(),ready()]).then(async()=>{
      if(!context)return;
      try{const response=await fetch(endpoint('status?token='+encodeURIComponent(context.token)),{headers:headers()});const raw=await response.json();
        if(!response.ok){error(['PUBLIC_SITE_NOT_FOUND','SITE_KEY_REQUIRED','BOOKING_STATUS_NOT_FOUND','BOOKING_STATUS_TOKEN_EXPIRED'].includes(raw.code)?raw.code:'STATUS_HTTP',response.status);return;}
        const mismatch=raw.reservation?.serviceType!=='direct_transfer'?'STATUS_SERVICE':raw.reservation.status!=='pending_payment'?'STATUS_RESERVATION':raw.payment?.status!=='pending'?'STATUS_PAYMENT':!raw.edit?.allowed?'STATUS_EDIT':raw.edit.revision!==context.revision&&!context.attempt?'STATUS_REVISION':raw.hold?.expiresAt!==context.expiresAt?'STATUS_DEADLINE':'';
        if(mismatch){error(mismatch,response.status);return;}
        context.serverNow=raw.serverNow;context.receivedAt=Date.now();write(context);verified=true;gate();
      }catch(_){verified=false;error();gate();}
    });
  }
  window.PixkuyDirectPendingEdit={begin,route,mount,activeData,mountData};
})(window,document);
