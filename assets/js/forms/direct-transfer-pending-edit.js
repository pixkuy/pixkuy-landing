(function (window, document) {
  'use strict';
  const KEY='pixkuy_direct_pending_edit_v1';
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(_){return null;}};
  const write=value=>sessionStorage.setItem(KEY,JSON.stringify(value));
  const route=()=>new URLSearchParams(location.search).get('pending')==='1';
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
    if(prior?.token===state.token&&prior.revision===raw.edit.revision){prior.base=draft;prior.expiresAt=raw.hold.expiresAt;prior.serverNow=raw.serverNow;prior.receivedAt=Date.now();write(prior);}
    else write({version:1,token:state.token,revision:raw.edit.revision,base:draft,customer:{...draft.customer},notes:draft.direct_transfer_notes||'',proof,
      publicCode:raw.reservation.publicCode,expiresAt:raw.hold.expiresAt,serverNow:raw.serverNow,receivedAt:Date.now()});
    location.assign('/direct-transfer-checkout-review.html?pending=1&lang='+encodeURIComponent(document.documentElement.lang||'es')+'#datos');return true;
  }
  function mount(api){
    let context=read(), dictionary={}, verified=false,busy=false,legalInstance=null,form=null;
    if(context?.attempt&&location.hash!=='#revision')history.replaceState(null,'',location.pathname+location.search+'#revision');
    const q=s=>document.querySelector(s), view=window.PixkuyAirportDesktopView;
    const status=()=>location.assign('/booking-cancelled.html?token='+encodeURIComponent(context.token));
    const live=()=>context&&Date.parse(context.expiresAt)>Date.parse(context.serverNow)+Math.max(0,Date.now()-context.receivedAt);
    const config=()=>window.PIXKUY_BOOKING_API_CONFIG||{};
    const endpoint=path=>(config().apiBaseUrl||'').replace(/\/$/,'')+'/v1/public/reservations/'+path;
    const headers=()=>({'X-Pixkuy-Site-Key':config().publicSiteKey||'local_pixkuy_site_key'});
    const flat=()=>Object.fromEntries(Object.entries(window.PixkuyForms.LegalAcceptance.fieldNames).map(([key,name])=>[name,context.proof?.[key]||'']));
    function save(){if(!form||!context)return;context.customer.full_name=form.elements.full_name.value.trim();context.customer.phone=form.elements.phone.value.trim();context.notes=form.elements.notes.value;context.proof=legalInstance?.getSnapshot()||null;write(context);}
    function valid(){return verified&&live()&&!busy&&!!context.proof&&!!context.customer.full_name&&/^\+[1-9]\d{7,14}$/.test(context.customer.phone);}
    function gate(){const button=q('[data-direct-transfer-checkout-review-proceed]');if(button){button.disabled=!valid();button.setAttribute('aria-disabled',String(button.disabled));}}
    function error(code){const node=q('[data-direct-transfer-checkout-review-error]');node.hidden=false;node.textContent=code==='DIRECT_PENDING_EMAIL_CHANGE_UNAVAILABLE'?dictionary.pendingEmailLocked:dictionary.pendingUnavailable;const recovery=view.action(dictionary.recover,status);node.appendChild(recovery);}
    function render(){
      if(!context){q('[data-direct-transfer-checkout-review-empty]').hidden=false;return;}
      if(legalInstance){legalInstance.destroy();legalInstance=null;}form=null;
      const data=location.hash!=='#revision', snapshot={...context.base,...flat(),name:context.customer.full_name,email:context.customer.email,phone:context.customer.phone,
        direct_transfer_notes:context.notes,direct_transfer_price:Number(context.base.direct_transfer_amount_minor)/100};
      api.renderStaticCopy(dictionary);api.renderDetails(snapshot,dictionary);api.renderLegal(snapshot,dictionary);
      q('[data-direct-transfer-checkout-review-empty]').hidden=true;q('[data-direct-transfer-checkout-review-content]').hidden=false;
      document.body.setAttribute('data-direct-pending-edit','true');
      q('[data-direct-transfer-checkout-review-copy="title"]').textContent=data?view.t('data'):dictionary.title;
      q('[data-direct-transfer-checkout-review-copy="text"]').textContent=dictionary.pendingContactOnly;
      document.querySelectorAll('[data-direct-pending-form],[data-direct-pending-reference],[data-direct-pending-deadline]').forEach(n=>n.remove());
      const details=q('[data-direct-transfer-checkout-review-details]');
      const reference=view.node('p','booking-status__lead',view.t('reference')+': '+context.publicCode);reference.dataset.directPendingReference='';details.before(reference);
      const estimate=new Date(Date.parse(context.serverNow)+Math.max(0,Date.now()-context.receivedAt)).toISOString();
      const deadline=view.deadline(context.expiresAt,estimate,'editDeadlinePassed',gate);deadline.dataset.directPendingDeadline='';reference.after(deadline);
      const edit=q('[data-direct-transfer-checkout-review-edit]');edit.hidden=false;edit.removeAttribute('aria-disabled');edit.href=data?'/booking-cancelled.html?token='+encodeURIComponent(context.token):'#datos';
      edit.onclick=event=>{event.preventDefault();if(busy)return;if(data){save();status();}else{location.hash='datos';}};
      const proceed=q('[data-direct-transfer-checkout-review-proceed]');proceed.textContent=data?view.t('review'):dictionary.proceed;
      q('[data-direct-transfer-checkout-review-legal]').hidden=data;
      if(data){
        document.querySelectorAll('[data-direct-review-contact],.booking-status__detail--customer-name,.booking-status__detail--customer-phone,.booking-status__detail--customer-email,.booking-status__detail--notes').forEach(n=>n.hidden=true);
        form=view.node('form','form direct-pending-form');form.dataset.directPendingForm='';form.noValidate=true;
        for(const [name,key,type] of [['full_name','name','text'],['phone','phone','tel'],['email','email','email'],['notes','notes','textarea']]){
          const label=view.node('label','',dictionary.details[key]),field=view.node(type==='textarea'?'textarea':'input','');field.name=name;field.id='direct-pending-'+name;
          label.htmlFor=field.id;if(type!=='textarea')field.type=type;field.value=name==='notes'?context.notes:context.customer[name]||'';
          if(name==='email'){field.readOnly=true;field.setAttribute('aria-describedby','direct-pending-email-help');}
          if(name==='notes')field.dataset.directPendingNotes='';else field.required=true;
          form.append(label,field);
          if(name==='email'){const hint=view.node('p','booking-status__lead',dictionary.pendingEmailLocked);hint.id='direct-pending-email-help';form.append(hint);}
        }
        const host=view.node('div','');form.append(host);details.after(form);
        Object.values(window.PixkuyForms.LegalAcceptance.fieldNames).forEach(name=>{const field=view.node('input','');field.type='hidden';field.name=name;form.appendChild(field);});
        const channel=context.proof?.channel||'web_direct_transfer_mobile_checkout';
        legalInstance=window.PixkuyForms.LegalAcceptance.create({container:host,form,channel,checkboxId:'direct-pending-legal'});legalInstance.restore(flat());
        form.addEventListener('input',()=>{window.queueMicrotask(()=>{save();gate();});});form.addEventListener('change',()=>{save();gate();});
        form.addEventListener('submit',event=>{event.preventDefault();proceed.click();});
      }
      proceed.onclick=async()=>{
        if(busy)return;if(data){save();if(!valid()){gate();form.reportValidity();return;}proceed.blur();location.hash='revision';return;}
        if(!valid()){gate();return;}busy=true;gate();edit.setAttribute('aria-disabled','true');
        try{
          if(!context.attempt){context.attempt={key:window.PixkuyFleetSelection.createAttemptKey(),revision:context.revision,
            payload:{service_type:'direct_transfer',customer:{...context.customer},direct_transfer_notes:context.notes,...flat(),legal_acceptance_accepted:true}};write(context);}
          const attempt=context.attempt;
          const response=await fetch(endpoint('update-contact'),{method:'POST',headers:{...headers(),'Content-Type':'application/json','X-Pixkuy-Booking-Token':context.token,'X-Pixkuy-Edit-Revision':attempt.revision,'Idempotency-Key':attempt.key},body:JSON.stringify(attempt.payload)});
          const body=await response.json();if(!response.ok){const e=new Error(body.code);e.code=body.code;throw e;}
          if(body.bookingStatusToken!==context.token||body.hold?.expiresAt!==context.expiresAt||!body.checkoutUrl)throw new Error('INCOMPATIBLE_RESPONSE');
          context.revision=body.editRevision;delete context.attempt;write(context);
          if(!api.redirectToCheckout(body.checkoutUrl,context.token))throw new Error('CHECKOUT_HANDOFF_FAILED');
        }catch(e){busy=false;if(e.code&&!['IDEMPOTENCY_REQUEST_IN_PROGRESS','CHECKOUT_STATE_UNCERTAIN'].includes(e.code)){delete context.attempt;verified=false;write(context);}error(e.code);gate();}
      };
      if(context.attempt){edit.onclick=event=>{event.preventDefault();};edit.setAttribute('aria-disabled','true');}
      gate();
    }
    async function load(){dictionary=await api.loadDictionary();await view.ready;render();}
    window.addEventListener('hashchange',()=>{save();render();requestAnimationFrame(()=>window.scrollTo(0,0));});
    window.matchMedia('(max-width:720px)').addEventListener('change',()=>{save();render();});
    window.addEventListener('pixkuy:i18n-applied',()=>{save();load();});
    load().then(async()=>{
      if(!context)return;
      try{const response=await fetch(endpoint('status?token='+encodeURIComponent(context.token)),{headers:headers()});const raw=await response.json();
        if(!response.ok||raw.reservation?.serviceType!=='direct_transfer'||raw.reservation.status!=='pending_payment'||raw.payment?.status!=='pending'||!raw.edit?.allowed||raw.edit.revision!==context.revision&&!context.attempt||raw.hold?.expiresAt!==context.expiresAt)throw new Error('STATE_CHANGED');
        context.serverNow=raw.serverNow;context.receivedAt=Date.now();write(context);verified=true;gate();
      }catch(_){verified=false;error();gate();}
    });
  }
  window.PixkuyDirectPendingEdit={begin,route,mount};
})(window,document);
