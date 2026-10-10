(function (window, document) {
  "use strict";
  // Display only. Never writes an address input, quote, selection or price payload.
  function locale() { return document.documentElement.lang === "es" ? "es-MX" : document.documentElement.lang || "es-MX"; }
  function amount(minor, currency) {
    if (!Number.isFinite(Number(minor)) || minor === null || minor === "") return "—";
    return new Intl.NumberFormat(locale(), {style:"currency",currency:currency || "MXN",currencyDisplay:"narrowSymbol",minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(minor)/100);
  }
  function money(minor, currency) { return amount(minor,currency) + (minor === null || minor === "" ? "" : " " + (currency || "MXN")); }
  function date(value) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value || ''))return value || '';
    var parsed=new Date(value+'T12:00:00'),parts=value.split('-').map(Number);
    if(!Number.isFinite(parsed.getTime()) || parsed.getFullYear()!==parts[0] || parsed.getMonth()+1!==parts[1] || parsed.getDate()!==parts[2])return '—';
    return new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',year:'numeric'}).format(parsed);
  }
  function distanceTime(meters, seconds) {
    if(!Number.isFinite(Number(meters))||!Number.isFinite(Number(seconds))||Number(meters)<=0||Number(seconds)<=0)return '';
    var minutes=Math.max(1,Math.round(Number(seconds)/60)), hours=Math.floor(minutes/60), remainder=minutes%60;
    return new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(Number(meters)/1000)+" km · "+(hours?hours+" h":"")+(remainder?(hours?" ":"")+remainder+" min":"");
  }
  function shortAddress(value, name) {
    if (name && String(value).toLowerCase().includes(name.toLowerCase())) return name;
    return String(value || "").split(/\s[—–]\s/)[0].split(",")[0].trim();
  }
  var selectors='[data-airport-lodging-input], [data-services-hourly-pickup-input], [data-direct-transfer-mobile-address-input]';
  var frame=0;
  function sync() {
    frame=0;
    document.querySelectorAll(selectors).forEach(function (input) {
      var mobile=window.matchMedia('(max-width:720px)').matches;
      var active=mobile && !!input.value && input.getBoundingClientRect().width>0;
      input.classList.toggle('booking-short-address__input',active);
      var parent=input.parentElement, label=parent.querySelector('[data-booking-short-address]');
      if (!active) { if(label)label.hidden=true; return; }
      if (!label) { parent.classList.add('booking-short-address');label=document.createElement('span');label.setAttribute('data-booking-short-address','');label.setAttribute('aria-hidden','true');parent.appendChild(label); }
      label.hidden=false;
      var text=shortAddress(input.value,input.dataset.bookingPlaceName);
      if(label.textContent!==text)label.textContent=text;
      var style=window.getComputedStyle(input);
      label.style.left=(input.offsetLeft+parseFloat(style.paddingLeft || 0))+'px';
      label.style.top=(input.offsetTop+input.offsetHeight/2)+'px';
      label.style.width=Math.max(0,input.clientWidth-parseFloat(style.paddingLeft || 0)-parseFloat(style.paddingRight || 0))+'px';
    });
  }
  function schedule() { if(!frame)frame=window.requestAnimationFrame(sync); }
  document.addEventListener('input',schedule);document.addEventListener('change',schedule);
  document.addEventListener('pixkuy:airport-trip-changed',schedule);
  ['pixkuy:hourly-daily-pickup-selected','pixkuy:direct-transfer-mobile-address-place'].forEach(function(type){document.addEventListener(type,function(event){var place=event.detail && event.detail.selectedPlace;var input=event.target;if(place && input.matches(selectors))input.dataset.bookingPlaceName=typeof place.displayName==='string'?place.displayName:place.displayName && place.displayName.text || '';schedule();},true);});
  window.addEventListener('resize',schedule);window.addEventListener('pixkuy:i18n-applied',schedule);
  document.addEventListener('DOMContentLoaded',function(){new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});schedule();});
  window.PixkuyBookingPresentation={amount:amount,money:money,date:date,distanceTime:distanceTime,shortAddress:shortAddress,sync:schedule};
})(window,document);
