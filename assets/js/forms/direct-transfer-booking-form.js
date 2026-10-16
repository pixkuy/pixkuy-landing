(function (window, document) {
  'use strict';
  // Direct owns its trip record and contact controls. Serialized aliases preserve
  // the existing review/checkout contract, not fields of the Netlify form.
  var trip = {}, revision = 0;
  var home = document.createElement('div'), form = document.createElement('form');
  home.hidden = true; form.id = 'direct-booking-form'; form.name = 'direct-booking';
  form.className = 'form airport-booking__form'; form.noValidate = true;
  home.appendChild(form); document.body.appendChild(home);
  var error = document.createElement('p'); error.className = 'form-error'; error.hidden = true; error.setAttribute('role','alert');
  var grid = document.createElement('div'); grid.className = 'form-grid'; form.append(error, grid);
  function text(v) { return v == null ? '' : String(v).trim(); }
  function copy(key) { return key.split('.').reduce(function(v,k){return v && v[k];},window.__pixkuyI18nDict) || ''; }
  ['name','phone','email'].forEach(function(name) {
    var wrap = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input');
    wrap.className = 'form-field'; input.id = 'direct-contact-' + name; input.name = name;
    input.type = name === 'phone' ? 'tel' : name === 'email' ? 'email' : 'text';
    input.autocomplete = name === 'phone' ? 'tel' : name; input.required = true;
    if(name === 'phone') { input.inputMode='tel'; input.maxLength=16; }
    label.htmlFor=input.id; label.setAttribute('data-direct-contact-label',name); wrap.append(label,input); grid.appendChild(wrap);
  });
  var actions = document.createElement('div'), submit = document.createElement('button');
  actions.className='form-actions'; submit.type='submit'; submit.className='cta airport-booking__primary'; actions.appendChild(submit); grid.appendChild(actions);
  Object.values(window.PixkuyForms.LegalAcceptance.fieldNames).forEach(function(name){var input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input);});
  function raw() {
    var result = Object.assign({}, trip, {service_type:'direct_transfer'});
    new window.FormData(form).forEach(function(v,k){if(typeof v==='string')result[k]=v;});
    result.message = text(result.direct_transfer_notes); return result;
  }
  function fields() { return {form:form,formError:error,submit:submit,name:form.elements.namedItem('name'),phone:form.elements.namedItem('phone'),email:form.elements.namedItem('email')}; }
  function parsedPhone() { try{return window.libphonenumber?.parsePhoneNumberFromString(text(fields().phone.value));}catch(_){return null;} }
  function data() { var value=raw(), result={serviceType:'direct_transfer',notes:value.direct_transfer_notes}; Object.keys(value).forEach(function(k){result[k.replace(/_([a-z])/g,function(_,c){return c.toUpperCase();})]=value[k];}); var phone=parsedPhone();if(phone?.isValid())result.phone=phone.number;return result; }
  var touched={},submitted=false;
  function validate(show) {
    if(show===true)submitted=true;
    var f=fields(), phone=parsedPhone(), valid={name:!!text(f.name.value),phone:!!phone?.isValid(),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(f.email.value))};
    Object.keys(valid).forEach(function(k){f[k].setCustomValidity(valid[k]?'':copy('contact.validation.'+k+'Required'));f[k].setAttribute('aria-invalid',String(!valid[k]&&(submitted||touched[k]===true)));});
    return Object.values(valid).every(Boolean);
  }
  function setTrip(value) {
    var next={}; Object.keys(value || {}).forEach(function(k){if(k.indexOf('direct_transfer_')===0 || k==='fleet_model' || k==='fleet_selection')next[k]=value[k];});
    trip=next; revision++; return true;
  }
  function patch(value) { Object.assign(trip,value); revision++; }
  function contact(value) { ['name','phone','email'].forEach(function(k){if(Object.prototype.hasOwnProperty.call(value,k))fields()[k].value=text(value[k]);}); revision++; }
  function restore(value) {
    if(!value)return false; setTrip(value);contact(value);
    var legal=window.PixkuyForms.LegalAcceptance;
    Object.values(legal.fieldNames).forEach(function(k){form.elements.namedItem(k).value=text(value[k]);});
    var proof=legal.readEvidence(form,'web_direct_transfer_checkout');if(!proof)legal.clearFields(form);
    var instance=form.querySelector('[data-direct-transfer-checkout-legal-acceptance]')?.__pixkuyLegalAcceptanceInstance;
    if(instance)instance.restore(proof);return true;
  }
  function translate(){form.querySelectorAll('[data-direct-contact-label]').forEach(function(n){n.textContent=copy('contact.'+n.getAttribute('data-direct-contact-label'));});submit.textContent=window.PixkuyAirportDesktopView?.t('reviewCta') || copy('directTransferMobileFlow.cta.continue');}
  form.addEventListener('submit',function(e){e.preventDefault();});
  form.addEventListener('input',function(){revision++;error.hidden=true;validate(false);});
  form.addEventListener('blur',function(e){if(e.target.name==='phone'){var p=parsedPhone();if(p?.isValid())e.target.value=p.number;}if(['name','phone','email'].includes(e.target.name)){touched[e.target.name]=true;validate(false);}},true);
  window.addEventListener('pixkuy:i18n-applied',translate);translate();
  window.PixkuyDirectBookingForm={home:home,getReservationForm:function(){return form;},getReservationRequestFields:fields,getReservationRequestData:data,
    raw:raw,value:function(name){return raw()[name];},setTrip:setTrip,patch:patch,contact:contact,restore:restore,validate:validate,
    syncReservationRequestState:function(){return validate(false);},refreshReservationRequestValidationUX:function(){return validate(true);},revision:function(){return revision;}};
})(window,document);
