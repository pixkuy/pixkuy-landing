/* assets/js/services/hourly-daily-pricing.js
   Hourly / Daily pricing policy.
   Responsabilidad:
   - consumir la versión tarifaria de Booking API para Hourly / Día completo
   - evitar duplicación entre panel desktop, contacto y flujo móvil
   - conservar la propuesta y pedir revisión ante un cambio de oferta
   - no aplicar multiplicadores temporales
*/

(function initHourlyDailyPricing(window) {
  "use strict";

  if (!window) {
    return;
  }

  const MODES = Object.freeze({
    HOURLY: "hourly",
    FULL_DAY: "full_day",
    LONG_TERM: "custom_long_term"
  });

  const CURRENCY = "MXN";
  const FULL_DAY_HOURS = 12;
  const KM_INCLUDED_PER_HOUR = 40;
  const EXTRA_KM_PRICE = 35;
  const OUT_OF_ZONE_SUPPLEMENT = 4500;
  const UNPLANNED_EXTENSION_HOUR_PRICE = 1000;

  const HOURLY_TIERS = Object.freeze(Array.from({length:11},(_,i)=>Object.freeze({durationHours:i+2})));

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function parsePositiveInteger(value) {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeMode(value) {
    const mode = normalizeText(value);

    if (
      mode === MODES.HOURLY ||
      mode === MODES.FULL_DAY ||
      mode === MODES.LONG_TERM
    ) {
      return mode;
    }

    return "";
  }

  function getDurationOptions() {
    return HOURLY_TIERS.map(function mapTier(tier) {
      return tier.durationHours;
    });
  }

  function getHourlyTier(durationHours) {
    const safeDurationHours = parsePositiveInteger(durationHours);

    if (!safeDurationHours) {
      return null;
    }

    return HOURLY_TIERS.find(function findTier(tier) {
      return tier.durationHours === safeDurationHours;
    }) || null;
  }

  function getEffectiveDurationHours(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const mode = normalizeMode(safeInput.mode);

    if (mode === MODES.FULL_DAY) {
      return FULL_DAY_HOURS;
    }

    if (mode !== MODES.HOURLY) {
      return null;
    }

    const tier = getHourlyTier(safeInput.durationHours);

    return tier ? tier.durationHours : null;
  }


  let remote = null, requestedKey = "", failedKey = "", inFlight = null, lastInput = {mode:"hourly",durationHours:2};
  let noticeCode = "", noticeKey = "";
  function editContext() {
    try { return JSON.parse(window.sessionStorage.getItem("pixkuy_hourly_pending_edit_v1")); } catch (_) { return null; }
  }
  function inputKey(input) {
    const edit=editContext();
    return [edit&&edit.token||"",input.mode,Number(input.durationHours)||2].join("|");
  }
  function copyFor(code) {
    const language=(document.documentElement.lang||"es").toLowerCase().split("-")[0];
    const messages={
      es:["Este cambio necesita revisión administrativa. Tu reserva y su precio siguen iguales. Conservamos tus datos.","La tarifa cambió. Revisa el total y vuelve a aceptar antes de continuar.","No hay una tarifa disponible. Conservamos tus datos; vuelve a consultar.","Contactar con Pixkuy","Consultar tarifa"],
      en:["This change needs an administrative review. Your reservation and price remain unchanged. Your entries are preserved.","The price changed. Review the total and accept it again before continuing.","No tariff is available. Your entries are preserved; please check again.","Contact Pixkuy","Check tariff"],
      de:["Diese Änderung muss administrativ geprüft werden. Buchung, Preis und Eingaben bleiben erhalten.","Der Preis hat sich geändert. Bitte den Gesamtpreis prüfen und erneut bestätigen.","Kein Tarif verfügbar. Ihre Eingaben bleiben erhalten.","Pixkuy kontaktieren","Tarif prüfen"],
      fr:["Ce changement nécessite un examen administratif. Réservation, prix et saisie sont conservés.","Le tarif a changé. Vérifiez le total et acceptez-le à nouveau.","Aucun tarif disponible. Vos données sont conservées.","Contacter Pixkuy","Consulter le tarif"],
      it:["Questa modifica richiede una verifica amministrativa. Prenotazione, prezzo e dati restano invariati.","La tariffa è cambiata. Verifica il totale e accetta nuovamente.","Nessuna tariffa disponibile. I dati inseriti sono conservati.","Contatta Pixkuy","Consulta tariffa"],
      pt:["Esta alteração exige revisão administrativa. Reserva, preço e dados são preservados.","A tarifa mudou. Reveja o total e aceite novamente.","Nenhuma tarifa disponível. Seus dados foram preservados.","Contactar Pixkuy","Consultar tarifa"],
      ru:["Изменение требует проверки администрацией. Бронирование, цена и введённые данные сохранены.","Цена изменилась. Проверьте итог и подтвердите его снова.","Тариф недоступен. Введённые данные сохранены.","Связаться с Pixkuy","Проверить тариф"],
      ko:["이 변경은 관리자 검토가 필요합니다. 예약, 가격 및 입력 내용은 유지됩니다.","요금이 변경되었습니다. 총액을 확인하고 다시 동의해 주세요.","이용 가능한 요금이 없습니다. 입력 내용은 유지됩니다.","Pixkuy에 문의","요금 확인"],
      zh:["此更改需要管理人员审核。预订、价格和填写的信息保持不变。","价格已更改。请核对总价并重新确认。","暂无可用价格。填写的信息已保留。","联系 Pixkuy","查询价格"]
    };
    const words=messages[language]||messages.es;
    return {text:words[code==="HOURLY_CHANGE_REQUIRES_ADMIN_REVIEW"?0:code==="OFFER_STALE"||code==="PRICE_MISMATCH"?1:2],contact:words[3],retry:words[4]};
  }
  function showStatus(code) {
    noticeCode=code;noticeKey=inputKey(lastInput);
    const form=window.PixkuyHourlyBookingForm?.getReservationForm?.()||document.querySelector('[data-hourly-booking-form]');
    // Configuration and Data have different visible mounts, especially on mobile.
    const config=document.querySelector('[data-services-hourly-config]');
    const host=[form,config,document.querySelector('.hourly-booking__content')].find(function(node){return node&&node.getClientRects().length;});
    if(!host)return;
    let box=host.querySelector('[data-hourly-tariff-notice]');
    if(!box){box=document.createElement('div');box.setAttribute('data-hourly-tariff-notice','');box.setAttribute('role','alert');host.appendChild(box);}
    box.replaceChildren();const words=copyFor(code),p=document.createElement('p');p.textContent=words.text;box.appendChild(p);
    if(code==="HOURLY_CHANGE_REQUIRES_ADMIN_REVIEW"){
      const existing=document.querySelector('[data-booking-status-whatsapp], [data-contact-whatsapp]');
      if(existing){const link=existing.cloneNode(false);link.textContent=words.contact;link.removeAttribute('id');box.appendChild(link);}
      else if(document.getElementById('contact')){const link=document.createElement('a');link.href='#contact';link.textContent=words.contact;box.appendChild(link);}
    }
    const retry=document.createElement('button');retry.type='button';retry.textContent=words.retry;
    retry.addEventListener('click',function(){refresh(lastInput);});box.appendChild(retry);
    document.querySelectorAll('[name="legal_acceptance_accepted"]').forEach(function(input){if('checked' in input)input.checked=false;});
  }
  function refresh(input) {
    input=input||lastInput;lastInput={mode:input.mode,durationHours:Number(input.durationHours)||2};
    const key=inputKey(lastInput);
    if(inFlight&&requestedKey===key)return inFlight;
    requestedKey=key;failedKey="";remote=null;noticeCode="";noticeKey="";
    const config=window.PIXKUY_BOOKING_API_CONFIG||{},edit=editContext();
    const headers={"X-Pixkuy-Site-Key":config.publicSiteKey||"local_pixkuy_site_key"};
    if(edit&&edit.token)headers["X-Pixkuy-Booking-Token"]=edit.token;
    const url=(typeof config.apiBaseUrl==="string"?config.apiBaseUrl:"http://localhost:3002").replace(/\/+$/,"")+
      "/v1/public/hourly/tariff?mode="+encodeURIComponent(lastInput.mode)+"&durationHours="+lastInput.durationHours;
    inFlight=fetch(url,{headers:headers,cache:"no-store"}).then(async function(response){
      const data=await response.json();if(requestedKey!==key)return null;
      if(!response.ok||!data.offer){failedKey=key;showStatus(data.code||"HOURLY_TARIFF_UNAVAILABLE");return null;}
      remote={key:key,offer:data.offer,tiers:data.tiers};failedKey="";noticeCode="";noticeKey="";
      document.querySelectorAll('[data-hourly-tariff-notice]').forEach(function(node){node.remove();});
      window.dispatchEvent(new CustomEvent("pixkuy:hourly-tariff",{detail:{offer:data.offer}}));return remote;
    }).catch(function(){if(requestedKey===key){failedKey=key;showStatus("HOURLY_TARIFF_UNAVAILABLE");}return null;})
      .finally(function(){if(requestedKey===key)inFlight=null;});
    return inFlight;
  }
  function getOffer(input) {
    const mode=normalizeMode(input&&input.mode),duration=mode===MODES.FULL_DAY?12:Number(input&&input.durationHours);
    if(!isTransactionalMode(mode)||!Number.isInteger(duration)||duration<2||duration>12)return null;
    const key=inputKey({mode:mode,durationHours:duration});
    lastInput={mode:mode,durationHours:duration};
    const edit=editContext();
    if(remote&&(!edit||!edit.token||remote.key===key)){
      if(remote.offer.source==="snapshot")return remote.key===key?remote.offer:null;
      const tier=(remote.tiers||[]).find(function(t){return t.durationHours===duration;});
      if(tier)return Object.assign({},remote.offer,{mode:mode,durationHours:duration,amountMinor:tier.priceAmountMinor});
    }
    if(key!==requestedKey&&key!==failedKey)refresh(lastInput);
    return null;
  }

  function getPrice(input) { const offer=getOffer(input);return offer?offer.amountMinor/100:null; }

  function getIncludedKilometers(input) {
    const effectiveDurationHours = getEffectiveDurationHours(input);

    return effectiveDurationHours
      ? effectiveDurationHours * KM_INCLUDED_PER_HOUR
      : null;
  }

  function isTransactionalMode(mode) {
    const safeMode = normalizeMode(mode);

    return safeMode === MODES.HOURLY || safeMode === MODES.FULL_DAY;
  }

  window.addEventListener('pixkuy:hourly-daily-panel-ui-sync',function(){
    if(noticeCode&&noticeKey===inputKey(lastInput))showStatus(noticeCode);
  });

  window.PixkuyHourlyDailyPricing = {
    modes: MODES,
    constants: Object.freeze({
      currency: CURRENCY,
      fullDayHours: FULL_DAY_HOURS,
      kmIncludedPerHour: KM_INCLUDED_PER_HOUR,
      extraKmPrice: EXTRA_KM_PRICE,
      outOfZoneSupplement: OUT_OF_ZONE_SUPPLEMENT,
      unplannedExtensionHourPrice: UNPLANNED_EXTENSION_HOUR_PRICE
    }),
    getDurationOptions: getDurationOptions,
    getEffectiveDurationHours: getEffectiveDurationHours,
    getIncludedKilometers: getIncludedKilometers,
    getPrice: getPrice,
    getOffer: getOffer,
    refresh: refresh,
    showStatus: showStatus,
    isTransactionalMode: isTransactionalMode
  };
})(window);
