(function(window,document){
  'use strict';
  var KEY='pixkuy_long_term_request_v1',CHANNEL='web_long_term_request',copy={},lang='',loadVersion=0;
  var state=read(),mount,form,legal,status,submit,busy=false,ordinary=state.ordinary||null;
  var base=window.PixkuyAirportDesktopView;
  function desktop(){return window.innerWidth>720;}
  function read(){try{var value=JSON.parse(sessionStorage.getItem(KEY)||'null');return value&&value.version===1?value:{version:1,contact:{}};}catch(_){return {version:1,contact:{}};}}
  function save(){try{var value=JSON.stringify(state);sessionStorage.setItem(KEY,value);return sessionStorage.getItem(KEY)===value;}catch(_){return false;}}
  function t(key){return copy[key]||'';}
  function node(tag,cls,text){var n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;}
  function received(){return state.receipt?.state==='received';}
  function snapshot(detail){
    var value={mode:detail.hourly_daily_mode,pickup:detail.hourly_daily_pickup||'',pickupPlaceId:detail.hourly_daily_pickup_place_id||'',pickupLat:detail.hourly_daily_pickup_lat||'',pickupLng:detail.hourly_daily_pickup_lng||'',tripDate:detail.hourly_daily_date||'',startTime:detail.hourly_daily_start_time||'',customTerm:detail.hourly_daily_custom_term||'week',notes:detail.hourly_daily_notes||'',durationHours:detail.hourly_daily_duration_hours||'4'};
    // Only mobile offers a passenger selector for this request. Desktop omission
    // stays an omission, never an invented passenger count.
    if(!desktop())value.passengerBand={2:'1-2',4:'3-4',6:'5-6'}[detail.hourly_daily_passengers];
    return value;
  }
  function panelChanged(detail){
    if(detail.hourly_daily_mode!=='custom_long_term'||active())return;
    if(!received()){state.config=snapshot(detail);save();}configSteps();
  }
  function switchMode(previous,next,detail){
    // A completed request remains a receipt, never an editable configuration.
    if(next==='custom_long_term'&&received()){open();return snapshot(detail);}
    if(previous===next)return null;
    if(previous==='custom_long_term'){panelChanged(detail);return Object.assign({},ordinary||{pickup:'',tripDate:'',startTime:'',notes:'',durationHours:'4'},{mode:next});}
    if(next==='custom_long_term'){
      var pickup={},source=snapshot(detail);
      // Absence permits a first-use seed. An existing empty string belongs to
      // this draft, including an intentional clear; never refill it implicitly.
      if(!state.pickupSeedDisabled&&!Object.prototype.hasOwnProperty.call(state.config||{},'pickup')){
        ['pickup','pickupPlaceId','pickupLat','pickupLng'].forEach(function(key){pickup[key]=source[key];});
      }
      ordinary=source;state.ordinary=ordinary;save();
      return Object.assign({pickup:'',tripDate:'',startTime:'',notes:'',customTerm:'week'},desktop()?{}:{passengerBand:'1-2'},state.config||{},pickup,{mode:next});
    }
    return null;
  }
  function steps(current,extra){
    var ol=node('ol','airport-booking__progress long-term-request__steps '+(extra||''));ol.setAttribute('aria-label',t('progress'));
    ['configuration','data'].forEach(function(key,i){
      var complete=i<current,li=node('li',complete?'is-complete':i===current?'is-current':'is-pending');
      var content=node('span','airport-booking__step-content'),marker=node('span','airport-booking__step-marker',complete?'✓':String(i+1));marker.setAttribute('aria-hidden','true');
      content.append(marker,node('span','airport-booking__step-label',t(key)));li.appendChild(content);
      if(i===current)li.setAttribute('aria-current','step');ol.appendChild(li);
    });return ol;
  }
  function configSteps(){
    var host=document.querySelector('[data-services-hourly-config]');if(!host)return;
    host.querySelector('.long-term-request__steps--config')?.remove();
    var selected=host.querySelector('[data-services-hourly-mode="custom_long_term"][aria-pressed="true"]'),longTerm=desktop()&&selected;
    if(longTerm)host.prepend(steps(0,'long-term-request__steps--config'));
    var mobileLead=document.querySelector('[data-hourly-mobile-flow-helper]');
    if(!desktop()&&selected&&mobileLead&&t('configurationLead'))mobileLead.textContent=t('configurationLead');
    var lead=document.querySelector('#services-expand-hourly [data-i18n="services.cards.hourly.panel.text"]');
    var ordinaryLead=window.__pixkuyI18nDict?.services?.cards?.hourly?.panel?.text;
    if(lead)lead.textContent=longTerm&&t('configurationLead')?t('configurationLead'):ordinaryLead||lead.textContent;
  }
  function validConfig(config){
    if(!config)return false;
    var date=new Date(config.tripDate+'T00:00:00Z'),minimum=window.PixkuyFleetSelection?.minimumDate();
    return config.pickup.trim().length>=3 && config.pickup.length<=1000 && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===config.tripDate && (!minimum||config.tripDate>=minimum) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(config.startTime) && ['week','fortnight','monthly','custom'].includes(config.customTerm) && config.notes.length<=5000;
  }
  async function load(){
    var version=++loadVersion,current=(document.documentElement.lang||'es').toLowerCase();
    var response=await fetch('assets/i18n/'+current+'/long-term-request.json');
    if(!response.ok)throw new Error('LONG_TERM_TRANSLATION_UNAVAILABLE');
    var result=await response.json();if(version!==loadVersion)return;
    copy=result;lang=current;configSteps();if(active())render();
  }
  function active(){return location.hash==='#long-term/datos';}
  function syncPanel(){if(state.config)window.dispatchEvent(new CustomEvent('pixkuy:contact-hourly-daily-sync',{detail:{snapshot:state.config}}));}
  function releaseSentPanel(){
    if(!received()||!document.querySelector('[data-services-hourly-mode="custom_long_term"][aria-pressed="true"]'))return;
    window.dispatchEvent(new CustomEvent('pixkuy:contact-hourly-daily-sync',{detail:{snapshot:ordinary||{mode:'hourly',pickup:'',tripDate:'',startTime:'',notes:'',durationHours:'4'}}}));
  }
  function capture(){
    if(!form||state.attempt)return;
    ['name','phone','email'].forEach(function(key){state.contact[key]=form.elements.namedItem(key).value;});
    state.consent=legal.getSnapshot();save();
    if(!busy)showStatus('');
  }
  function hide(){
    if(mount)mount.hidden=true;document.body.classList.remove('long-term-request-active');
    document.querySelector('[data-hourly-mobile-route-content]')?.removeAttribute('data-long-term-step');
  }
  function navigate(hash){
    var url=new URL(location.href);url.searchParams.set('lang',lang);url.searchParams.delete('service');url.hash=hash;
    history.pushState(null,'',url.pathname+url.search+url.hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  function back(){if(busy||state.attempt)return;capture();hide();
    if(!desktop()){navigate('long-term/config');return;}
    navigate('services');syncPanel();
    window.PixkuyServicesExpand.open('hourly',{behavior:'instant'});
    requestAnimationFrame(function(){
      if(active()||location.hash!=='#services')return;
      var heading=document.querySelector('#services-expand-hourly h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    });
  }
  function exitTo(hash){
    if(busy)return;capture();
    if(!hash&&received()){
      // End the request document (and its reCAPTCHA widget). Session receipt
      // and independent service drafts survive this navigation without resend.
      var home=new URL(location.href);home.hash='';home.searchParams.delete('service');home.searchParams.set('lang',lang);
      window.location.assign(home.href);return;
    }
    hide();
    if(!desktop())window.PixkuyHourlyMobileBookingFlow?.close({collapsePanel:true,updateUrl:false});
    var expanded=window.PixkuyServicesExpand.getOpenService();
    if(expanded)document.querySelector('[data-service-expand-trigger="'+expanded+'"]')?.click();
    navigate(hash);
    requestAnimationFrame(function(){
      if(active()||location.hash!==(hash?'#'+hash:''))return;
      if(hash==='services'&&!desktop()){window.PixkuyMobileTopbarMenu.open();return;}
      var target=hash?document.getElementById(hash):null;
      window.scrollTo({top:target?target.getBoundingClientRect().top+scrollY:0,behavior:'instant'});
      var heading=target?.querySelector('h2')||document.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    });
  }
  function anotherService(){
    if(busy||!received())return;
    var previous=state,archiveKey=KEY+':received:'+state.receipt.reference;
    // Keep the completed attempt immutable and separate from the next draft.
    // Only this explicit action starts anew; reload/home still recover receipt.
    try{
      var archived=JSON.stringify(previous);sessionStorage.setItem(archiveKey,archived);
      if(sessionStorage.getItem(archiveKey)!==archived)throw new Error('STORAGE_UNAVAILABLE');
    }catch(_){showStatus('storageError');return;}
    releaseSentPanel();
    state={version:1,contact:{},ordinary:ordinary,pickupSeedDisabled:true};
    if(!save()){state=previous;showStatus('storageError');return;}
    exitTo('services');
  }
  function civil(config){
    var locale=lang==='zh-hans'?'zh-CN':lang;
    return new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date(config.tripDate+'T00:00:00Z'))+' · '+new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date('2000-01-01T'+config.startTime+':00Z'));
  }
  function contactAction(){
    var href=window.PixkuyWhatsappContact?.url();if(!href)return null;
    var link=node('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';
    link.className='airport-booking__link airport-booking__contact-action';
    var label=window.__pixkuyI18nDict?.contact?.whatsappCta||'';
    link.setAttribute('aria-label',label);link.append(base.icon('contact'),node('span','',label));return link;
  }
  function render(){
    if(!active()||!copy.title)return hide();
    if(!validConfig(state.config)&&!state.attempt){hide();location.hash='services';syncPanel();return;}
    capture();if(legal)legal.destroy();
    if(mount)mount.remove();
    var mobile=!desktop(),completed=received(),header;
    if(mobile){
      if(!window.PixkuyHourlyMobileBookingFlow.isOpen())window.PixkuyHourlyMobileBookingFlow.open();
      var host=document.querySelector('[data-hourly-mobile-route-content]');host.setAttribute('data-long-term-step',completed?'received':'data');
      mount=window.PixkuyHourlyBookingView.mobileShell(back,'datos');mount.classList.add('long-term-request','hourly-booking--data');
      header=mount.firstElementChild;header.hidden=completed;host.appendChild(mount);
    }else{
      mount=node('main','airport-booking hourly-booking long-term-request');document.body.appendChild(mount);
      header=base.shell(completed?4:1,back,null,{showBack:!completed}).querySelector('.airport-booking__header');
    }
    mount.hidden=false;document.body.classList.add('long-term-request-active');
    mount.classList.toggle('hourly-booking--desktop-final',completed);
    var previous=header.querySelector('button');if(previous){previous.replaceChildren(node('span','',t('back')));if(!mobile)previous.prepend(base.icon('arrowLeft'));previous.setAttribute('aria-label',t('back'));previous.disabled=busy||!!state.attempt;}
    var home=header.querySelector('a');if(home){home.href='?lang='+encodeURIComponent(lang);home.setAttribute('aria-label',t('home'));home.addEventListener('click',function(event){event.preventDefault();exitTo('');});}
    var caption=node('p','airport-booking__step-caption',t('progress')+' · '+(completed?'✓':'2/2 · '+t('data')));
    var title=node('h1','',t('title'));title.tabIndex=-1;mount.append(header,caption,steps(completed?2:1),title);
    var layout=node('div','hourly-booking__layout'),content=node('section','hourly-booking__content'),summary=node('aside','hourly-booking__summary'),list=node('dl');
    summary.appendChild(node('h2','',t('summary')));var c=state.attempt?state.attempt.config:state.config;
    [[t('pickup'),c.pickup],[t('dateTime'),civil(c)],[t(mobile?'requestedPeriod':'period'),t(c.customTerm)],[t('passengers'),c.passengerBand?.replace('-','–')],[t('notes'),c.notes]].forEach(function(pair,i){if(pair[1]){var row=base.field(pair[0],pair[1]);if(i===0||i===1||i===4)row.classList.add('hourly-booking__detail--wide');list.appendChild(row);}});
    if(mobile){summary.className='hourly-booking__data-summary';if(!completed)content.appendChild(summary);}
    summary.append(list,node('p','hourly-booking__timezone',t('timezone')));
    status=node('p','long-term-request__status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    if(completed){
      content.append(node('h2','',t('received')),node('p','',t('receivedDetail')));form=null;legal=null;
      if(mobile)content.appendChild(summary);
      status.hidden=true;content.appendChild(status);
    }else{
      content.appendChild(node('h2','',t('data')));form=node('form','hourly-booking__form');form.noValidate=true;var grid=node('div','form-grid');
      ['name','phone','email'].forEach(function(key){
        var field=node('div','form-field'),label=node('label','',t(key)),input=node('input');
        field.setAttribute('data-hourly-booking-field',key);
        input.name=key;input.id='long-term-'+key;input.type={name:'text',phone:'tel',email:'email'}[key];input.autocomplete={name:'name',phone:'tel',email:'email'}[key];input.required=true;
        input.maxLength={name:180,phone:30,email:254}[key];input.value=state.contact[key]||'';input.disabled=!!state.attempt;label.htmlFor=input.id;
        field.append(label,input);grid.appendChild(field);
      });
      var legalHost=node('div','long-term-request__legal');
      legalHost.setAttribute('data-hourly-checkout-legal-acceptance','');
      Object.values(window.PixkuyForms.LegalAcceptance.fieldNames).forEach(function(name){var input=node('input');input.type='hidden';input.name=name;form.appendChild(input);});
      grid.appendChild(legalHost);form.appendChild(grid);content.appendChild(form);
      legal=window.PixkuyForms.LegalAcceptance.create({container:legalHost,form:form,channel:CHANNEL,checkboxId:'long-term-consent'});legal.restore(state.consent);legal.checkbox.disabled=!!state.attempt;
      submit=base.action(t(state.attempt?'checkStatus':'send'),function(){},true);submit.type='submit';submit.disabled=busy;
      form.append(submit,status);form.addEventListener('input',capture);form.addEventListener('change',capture);
      form.addEventListener('submit',function(event){event.preventDefault();send();});showStatus(state.error||state.receipt?.state||'');
    }
    layout.appendChild(content);if(!mobile)layout.appendChild(summary);mount.appendChild(layout);
    if(completed){
      var actions=node('div','airport-booking__actions');
      actions.append(base.action(t('bookAnother'),anotherService,true),base.action(t('backHome'),function(){exitTo('');},false,'home'));
      var contact=contactAction();if(contact)actions.appendChild(contact);
      mount.appendChild(actions);
    }
  }
  function showStatus(key){if(status){status.textContent=t(key);if(received())status.hidden=!key;}}
  function token(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),function(b){return b.toString(16).padStart(2,'0');}).join('');}
  async function request(recover){
    await window.PixkuyBookingPublicConfig?.ready;var config=window.PIXKUY_BOOKING_API_CONFIG||{};
    if(!config.apiBaseUrl||!config.publicSiteKey)throw new Error('CONFIG_UNAVAILABLE');
    var body=recover?{}:{request:state.attempt.body,recaptchaToken:await window.PixkuyRecaptchaEnterprise?.execute('long_term_request')||''};
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},55000);
    try{
      var response=await fetch(config.apiBaseUrl.replace(/\/$/,'')+'/v1/public/long-term-requests'+(recover?'/recover':''),{method:'POST',headers:{'Content-Type':'application/json','X-Pixkuy-Site-Key':config.publicSiteKey,'Idempotency-Key':state.attempt.key,'X-Request-Recovery-Secret':state.attempt.secret},body:JSON.stringify(body),signal:controller.signal});
      var result=await response.json();if(!response.ok){var error=new Error(result.code||'REQUEST_UNAVAILABLE');error.status=response.status;throw error;}
      if(!result.receipt || !['received','processing','retryable','uncertain'].includes(result.receipt.state) || typeof result.receipt.reference!=='string')throw new Error('REQUEST_RESPONSE_INVALID');
      return result.receipt;
    }finally{clearTimeout(timer);}
  }
  async function send(){
    if(busy)return;capture();
    if(!state.attempt){
      var contact={name:state.contact.name?.trim()||'',phone:(state.contact.phone||'').replace(/[\s().-]/g,''),email:state.contact.email?.trim()||''};
      if(!validConfig(state.config)||contact.name.length<2||!/^\+[1-9]\d{6,14}$/.test(contact.phone)||!form.elements.email.validity.valid){showStatus('invalid');form.reportValidity();return;}
      if(!legal.isAccepted()||!window.PixkuyForms.LegalAcceptance.readEvidence(state.consent,CHANNEL)){showStatus('consentRequired');legal.checkbox.focus();return;}
      var c=state.config;state.attempt={key:token(),secret:token(),config:structuredClone(c),body:{locale:lang,pickup:c.pickup,date:c.tripDate,time:c.startTime,period:c.customTerm,notes:c.notes,contact:contact,consent:state.consent}};
      if(c.passengerBand)state.attempt.body.passengerBand=c.passengerBand;
      if(!save()){delete state.attempt;showStatus('storageError');return;}
    }
    busy=true;state.error='';render();showStatus('sending');
    try{
      var receipt;try{receipt=await request(true);}catch(error){if(error.status!==404)throw error;}
      if(!receipt||receipt.state==='retryable')receipt=await request(false);
      state.receipt=receipt;save();
    }catch(error){
      // These responses explicitly precede persistence. Other failures keep the
      // immutable attempt, since SMTP may already have accepted the request.
      if(['NOTIFICATION_NOT_CONFIGURED','REQUEST_INPUT_INVALID'].includes(error.message)){delete state.attempt;delete state.receipt;}
      state.error='sendError';save();
    }finally{busy=false;render();}
  }
  async function open(detail){
    if(detail)panelChanged(detail);if(!copy.title)await ready;
    if(!received()&&!validConfig(state.config)){
      var host=document.querySelector('[data-services-hourly-config]'),error=host.querySelector('[data-long-term-error]')||node('p','form-error');
      error.dataset.longTermError='';error.setAttribute('role','alert');error.textContent=t('invalid');host.appendChild(error);return false;
    }
    location.hash='long-term/datos';render();requestAnimationFrame(function(){mount?.querySelector('h1')?.focus({preventScroll:true});window.scrollTo(0,0);});return true;
  }
  async function route(){
    if(!active()){
      hide();
      if(!desktop()&&location.hash==='#long-term/config'&&state.config&&!received()){
        await ready;syncPanel();window.PixkuyHourlyMobileBookingFlow.open();
        document.querySelector('[data-hourly-mobile-route-content]').scrollTop=0;
      }else releaseSentPanel();return;
    }await ready;render();
    if(state.attempt&&state.receipt?.state!=='received'&&!busy){busy=true;try{state.receipt=await request(true);state.error='';save();}catch(_){state.error='sendError';}finally{busy=false;render();}}
  }
  var ready=load().catch(function(){/* Copy failures do not authorize a request. */});
  window.PixkuyLongTermRequest={open:open,panelChanged:panelChanged,switchMode:switchMode,configurationLead:function(){return t('configurationLead');}};
  window.addEventListener('pixkuy:i18n-applied',function(){load().catch(function(){hide();});});
  window.addEventListener('pixkuy:hourly-daily-panel-ui-sync',configSteps);
  window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
  window.matchMedia('(min-width:721px)').addEventListener('change',function(){route();configSteps();});ready.then(route);
})(window,document);
