(function(window,document){
  'use strict';
  // Hourly owns this form. It has no Netlify attributes or contact-form nodes.
  var form=document.createElement('form'),home=document.createElement('div');
  form.id='hourly-booking-form';form.className='form';form.name='hourly-booking';form.noValidate=true;
  home.hidden=true;home.setAttribute('data-hourly-form-home','');home.appendChild(form);document.body.appendChild(home);
  var grid=document.createElement('div');grid.className='form-grid';form.appendChild(grid);
  function copy(path){return path.split('.').reduce(function(v,k){return v&&v[k];},window.__pixkuyI18nDict)||'';}
  function field(name,type,key){
    var wrap=document.createElement('div'),label=document.createElement('label'),input=document.createElement(type==='textarea'?'textarea':'input');
    wrap.className='form-field';wrap.setAttribute('data-hourly-booking-field',name);label.className='visually-hidden';
    input.id='hourly-contact-'+name;input.name=name;label.htmlFor=input.id;label.setAttribute('data-i18n',key);
    input.setAttribute('data-i18n-ph',key);input.autocomplete={name:'name',phone:'tel',email:'email'}[name]||'off';
    if(type==='textarea')input.rows=4;else{input.type=type;input.required=true;}
    if(name==='phone'){input.maxLength=16;input.inputMode='tel';input.autocapitalize='off';input.spellcheck=false;input.pattern='^\\+[1-9]\\d{6,14}$';}
    wrap.append(label,input);
    if(type!=='textarea'){
      var error=document.createElement('p');error.id=input.id+'-error';error.className='form-error';error.hidden=true;
      error.setAttribute('data-error-for',name);error.setAttribute('data-i18n','contact.validation.'+name+'Required');input.setAttribute('aria-describedby',error.id);wrap.appendChild(error);
    }
    grid.appendChild(wrap);
  }
  field('name','text','contact.name');field('phone','tel','contact.phone');field('email','email','contact.email');
  var actions=document.createElement('div'),submit=document.createElement('button'),error=document.createElement('p');
  actions.className='form-actions';submit.id='hourly-contact-submit';submit.type='submit';submit.className='cta';submit.setAttribute('data-i18n','contact.submit');actions.appendChild(submit);grid.appendChild(actions);
  error.className='form-error form-error--global';error.hidden=true;error.setAttribute('role','alert');error.tabIndex=-1;error.setAttribute('data-hourly-form-error','');form.appendChild(error);
  // Notes are owned by Configuration. Keep the raw checkout alias, not a second editor.
  var metadata=['message','service_type','service_label','request_summary'].concat(['mode','vehicle_type','passengers','pickup','pickup_place_id','pickup_lat','pickup_lng','date','start_time','duration_hours','custom_term','notes','price','currency','km_included','extra_km_price','out_of_zone_supplement'].map(function(k){return 'hourly_daily_'+k;}));
  metadata.concat(Object.values(window.PixkuyForms.LegalAcceptance.fieldNames)).forEach(function(name){var input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input);});
  form.elements.service_type.value='hourly_daily';
  function normalizePhone(value){return String(value||'').trim().replace(/[^\d+]/g,'').replace(/(?!^)\+/g,'');}
  function parsedPhone(value){try{return window.libphonenumber?.parsePhoneNumberFromString(normalizePhone(value));}catch(_){return null;}}
  function fields(){
    var result={form:form,formError:error,submit:submit};
    Array.from(form.elements).forEach(function(n){if(n.name)result[n.name.replace(/_([a-z])/g,function(_,c){return c.toUpperCase();})]=n;});
    return result;
  }
  function data(){
    var result={};Object.entries(fields()).forEach(function(entry){if(entry[1]&&'value' in entry[1])result[entry[0]]=String(entry[1].value||'').trim();});
    var phone=parsedPhone(result.phone);result.phone=phone?.isValid()?phone.number:normalizePhone(result.phone);return result;
  }
  var touched={},submitted=false;
  function validate(show){
    if(show===true)submitted=true;
    var value=data(),validity={name:!!value.name,phone:/^\+[1-9]\d{6,14}$/.test(value.phone)&&!!parsedPhone(value.phone)?.isValid(),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)};
    Object.keys(validity).forEach(function(key){
      var input=form.elements.namedItem(key),message=copy('contact.validation.'+key+'Required'),visible=!validity[key]&&(submitted||touched[key]===true);
      input.setCustomValidity(validity[key]?'':message);
      input.setAttribute('aria-invalid',String(visible));form.querySelector('[data-error-for="'+key+'"]').hidden=!visible;
    });
    return Object.values(validity).every(Boolean);
  }
  function sync(){validate(false);window.PixkuyHourlyCheckout?.sync();return true;}
  function restore(value){
    if(!value)return false;
    Object.keys(value).forEach(function(key){var input=form.elements.namedItem(key);if(input&&typeof value[key]!=='object'&&value[key]!=null)input.value=String(value[key]);});
    form.elements.message.value=form.elements.hourly_daily_notes.value;
    form.elements.service_type.value='hourly_daily';sync();return true;
  }
  function translate(){
    form.querySelectorAll('[data-i18n]').forEach(function(n){n.textContent=copy(n.getAttribute('data-i18n'));});
    form.querySelectorAll('[data-i18n-ph]').forEach(function(n){n.placeholder=copy(n.getAttribute('data-i18n-ph'));});
  }
  form.addEventListener('input',function(){error.hidden=true;sync();});form.addEventListener('change',sync);
  form.addEventListener('submit',function(event){event.preventDefault();});
  form.addEventListener('blur',function(e){
    if(e.target.name==='phone'){var value=parsedPhone(e.target.value);if(value?.isValid())e.target.value=value.number;}
    if(['name','phone','email'].includes(e.target.name)){touched[e.target.name]=true;validate(false);}
  },true);
  window.addEventListener('pixkuy:i18n-applied',translate);translate();
  window.PixkuyHourlyBookingForm={getReservationForm:function(){return form;},getReservationRequestFields:fields,getReservationRequestData:data,refreshReservationRequestValidationUX:function(){return validate(true);},syncReservationRequestState:sync,restore:restore,home:home};
})(window,document);
