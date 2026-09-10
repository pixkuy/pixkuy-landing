(function(window,document){
  "use strict";
  const C=window.PixkuyEventPackagesState;const roots=new Set();let catalogSequence=0;let catalogLoad=null;let packageDetailsDialog=null;let packageDetailsPreviousFocus=null;
  const AUTO_QUOTE_DELAY_MS=320;let airportQuoteTimer=null;let airportQuoteTimerRoot=null;let airportQuoteTimerSignature='';let airportQuoteAttemptedSignature='';
  const fallback={"ordinaryArrival":"Llegada: aeropuerto → dirección","ordinaryDeparture":"Salida: dirección → aeropuerto","ordinaryHourly":"Por horas","ordinaryFullDay":"Día completo","ordinaryDirection":"Sentido","ordinaryDate":"Fecha (CDMX)","ordinaryTime":"Hora (CDMX)","ordinaryMode":"Modalidad","ordinaryDuration":"Duración en horas","ordinaryPricing":"Pixkuy calcula el precio según los datos del servicio.","ordinaryDeferred":"Pendiente para coordinación posterior","ordinaryFixed":"Definido por el evento","ordinaryOutside":"El servicio seleccionado no cubre este trayecto. Puedes solicitar una valoración personalizada si está disponible.",title:"Paquetes para eventos",publicDatesLabel:"Fechas",choose:"Seleccionar",viewPackages:"Ver paquetes",custom:"Empresas y grupos · solicitud personalizada",empty:"No hay paquetes publicados en este momento.",error:"No se pudo completar la operación. Revisa los datos y vuelve a intentarlo.",loading:"Cargando…",back:"Volver",package:"Paquete",option:"Opción",passengers:"Pasajeros",services:"Servicios",date:"Fecha y hora local (CDMX)",origin:"Origen",destination:"Destino",airport:"Aeropuerto",address:"Dirección",baggage:"Equipaje",unknown:"Pendiente",none:"Sin equipaje",declared:"Declarado",specialNeeds:"Necesidades especiales por valorar",quote:"Revisar cálculo",continue:"Continuar con los datos de contacto",name:"Nombre",phone:"Teléfono",email:"Correo electrónico",submit:"Enviar solicitud",retry:"Reintentar el mismo envío",recover:"Recuperar recibo",received:"Solicitud recibida",notBooking:"La solicitud no confirma una reserva ni disponibilidad.",pending:"Hay datos o condiciones pendientes de valoración.",conditional:"Subtotal condicionado",personalized:"Valoración personalizada",quoted:"Subtotal cotizado",description:"Describe lo que necesitas",reason:"Motivo",knownPassengers:"Número de personas conocido",additional:"Servicio adicional",conditions:"Condiciones",recoveryNotice:"No se ha podido recuperar la recepción. Conservamos el mismo intento; reintroduce los datos si recargaste la página.",storageWarning:"El navegador no puede conservar el intento al recargar. Mantén esta página abierta para reintentar.",sending:"Enviando…",unknownReception:"La recepción es desconocida. Recupera el recibo o reintenta con la misma clave.",newRequest:"Nueva consulta",whatsapp:"Continuar voluntariamente en WhatsApp",flight:"Vuelo",notes:"Notas operativas (opcional)",notOffered:"Combinación no ofrecida",reviewChanged:"Revisa de nuevo la oferta antes de enviar.",close:"Cerrar",inclusions:"Qué incluye",base:"Base",multiplier:"Multiplicador",result:"Resultado",calculationStatus:"Estado del cálculo",selectPackageOption:"Selecciona paquete y opción para continuar."};
  Object.assign(fallback,{mobileConfigureTrip:'Configurar mi viaje',mobileTripData:'Datos del viaje',vehicleCategoryLabel:'Van Premium · BYD M9 o similar',vehicleGalleryOpen:'Ver galería',vehicleFareLabel:'Tarifa',"confirmationTitle":"Solicitud recibida correctamente","confirmationNext":"Gracias por contactar con Pixkuy. Su solicitud ha quedado registrada. Nos pondremos en contacto con usted para revisar los detalles.","receiptReference":"Referencia de la solicitud","copyReference":"Copiar referencia","referenceCopied":"Referencia copiada.","referenceCopyUnavailable":"No se pudo copiar. Seleccione la referencia y cópiela manualmente.","confirmationWhatsapp":"Contactar por WhatsApp","confirmationNew":"Nueva solicitud","confirmationNoRepeat":"No necesita enviarla de nuevo.","confirmationReservation":"Esta solicitud no constituye una reserva confirmada.","receiptEvent":"Evento","confirmationArrival":"Traslado de llegada","confirmationDeparture":"Traslado de salida"});
  const journeyFallback={"eventUnavailable":"El evento seleccionado ya no está disponible o su publicación ha cambiado. Seleccione un evento para continuar.","continueContact":"Continuar","editTransfer":"Editar traslado","editTransfers":"Editar traslados","customTitle": "¿Necesita un servicio a medida?", "customIntro": "También organizamos traslados con otros horarios, recorridos o necesidades, para particulares, empresas y grupos.", "proposal": "Solicitar propuesta", "customLink": "Servicio a medida", "noPackage": "¿Ningún paquete se ajusta a lo que necesita?", "configure": "Configurar", "goServices": "Continuar a servicios", "reviewContact": "Revisión y contacto", "priceByDetails": "El precio depende de la opción y de los datos del servicio.", "groupTotal": "Total del grupo", "breakdown": "Desglose", "customNotesHelp": "Indique fechas, horarios, recorrido y necesidades. Si representa a una empresa, puede indicarlo aquí.", "changeLoss": "Este cambio descarta datos de servicios que no son compatibles. ¿Desea continuar?", "invalidData": "Revise los datos del servicio, su periodo operativo y las restricciones publicadas.", "reuseLodging": "Usar el alojamiento de otro servicio", "selectEvent": "Seleccione el evento de su solicitud", "calculatePrice": "Calcular precio", "arrivalTime": "Hora de inicio del servicio (CDMX)", "pickupTime": "Hora de recogida (CDMX)", "transferFlight": "Número de vuelo", "editServices": "Editar servicios", "backToEvents": "← Volver a eventos", "choosePackage": "Elija su paquete", "modeAvailable": "Modalidad disponible", "transferOne": "1 traslado", "transferMany": "{count} traslados", "viewInclusions": "Ver las {count} inclusiones", "viewAllDetails": "Ver todas las inclusiones y condiciones", "customStepIntro": "Para particulares, empresas y grupos con otros horarios o recorridos.", "configureTransfer": "Configurar traslado", "configureServices": "Configurar servicios", "missingForQuote": "Falta: {fields}.", "invalidForQuote": "Revisa: {fields}.", "placeDetailsError": "No hemos podido confirmar la dirección seleccionada. Vuelve a elegirla de la lista.", "automaticQuotePending": "El precio se calculará automáticamente.", "retryCalculation": "Reintentar cálculo"};
  const bandsFallback={"baggageCount":"Número de maletas","baggageQuantityUnknown":"Cantidad no indicada","baggageMayBePending":"Puede dejar la cantidad pendiente para coordinación.","baggageConfigurationRequired":"Falta configurar quién indica el número de maletas.","optional":"opcional","flightOptionalHelp":"Si lo conoce, lo usaremos para coordinar la recogida.","baggageOptionalHelp":"Puede indicarlo si desea facilitar la coordinación.","noCompatibleBand":"No hay bandas de pasajeros compatibles con esta opción.","historicalExact":"cantidad exacta histórica"};
  function t(key,values){const dict=window.__pixkuyI18nDict;const text=dict&&dict.eventPackages&&dict.eventPackages[key];const template=typeof text==="string"&&text?text:bandsFallback[key]||journeyFallback[key]||fallback[key]||fallback.pending;return values?template.replace(/\{(\w+)\}/g,(_,name)=>values[name]??''):template;}
  function i18nText(path,fallbackValue){
    const modules=window.__pixkuyI18nModules||{},dict=window.__pixkuyI18nDict||{};
    const resolved=typeof modules.getValue==='function'?modules.getValue(dict,path):String(path||'').split('.').reduce((value,key)=>value&&value[key],dict);
    return typeof resolved==='string'&&resolved.trim()?resolved.trim():fallbackValue||'';
  }
  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const locale=()=>window.__pixkuyI18nLang||document.documentElement.lang||"es";
  const local=value=>value&&(value[locale()]||value.es)||"";
  function money(minor,currency){if(minor===null||minor===undefined)return t("personalized");if(!/^(0|[1-9][0-9]*)$/.test(String(minor)))return t("pending");const n=BigInt(minor);return String(n/100n)+"."+String(n%100n).padStart(2,"0")+" "+(currency||"MXN");}
  const button=(action,label,disabled,variant)=>'<button type="button" class="events-package-button events-package-button--'+esc(variant||'secondary')+'" data-package-action="'+action+'"'+(disabled?' disabled aria-disabled="true"':'')+'>'+esc(label)+'</button>';
  function optionHtml(value,label,selected){return '<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';}
  function field(name,label,value,type,extra,className){return '<label class="events-package-field services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><input class="services-expand__control" data-package-field="'+esc(name)+'" type="'+(type||"text")+'" value="'+esc(value)+'" '+(extra||"")+'></label>';}
  function contactField(name,label,value,type,extra,errorPath){
    const id='events-package-contact-'+name,validationKey=name==='name'?'nameRequired':name==='phone'?'phoneRequired':'emailRequired',validationPath=errorPath||'contact.validation.'+validationKey;
    return '<div class="events-package-field services-expand__field form-field" data-package-contact-field="'+esc(name)+'"><label for="'+id+'"><span class="services-expand__label">'+esc(label)+'</span><input id="'+id+'" class="services-expand__control" name="'+esc(name)+'" data-package-field="contact:'+esc(name)+'"'+(name==='phone'?' data-package-canonical-phone':'')+' type="'+esc(type)+'" value="'+esc(value)+'" '+(extra||'')+' aria-describedby="'+id+'-error"></label><p id="'+id+'-error" class="form-error" data-package-field-error data-error-for="'+esc(name)+'" data-i18n="'+esc(validationPath)+'" hidden>'+esc(i18nText(validationPath,''))+'</p></div>';
  }
  function mobileContactValidationFields(root){
    const forms=window.PixkuyForms,form=root.querySelector?.('[data-package-mobile-contact-form]');
    const canonicalForm=forms?.getReservationForm?.(),fields=forms?.getReservationRequestFields?.(canonicalForm);
    const mobile=name=>form?.querySelector?.('[data-package-field="contact:'+name+'"]')||null;
    const name=mobile('name'),phone=mobile('phone'),email=mobile('email');
    if(!form||!fields||!name||!phone||!email)return null;
    return {...fields,name,phone,email};
  }
  function clearMobileContactValidation(input){
    const name=input?.getAttribute?.('data-package-field')?.slice(8),wrapper=input?.closest?.('.form-field'),error=name?input?.form?.querySelector?.('[data-error-for="'+name+'"]'):null;
    wrapper?.classList?.remove('is-invalid');
    input?.setAttribute?.('aria-invalid','false');
    if(error)error.hidden=true;
  }
  function validateMobilePackageContact(root,fieldName){
    const forms=window.PixkuyForms,fields=mobileContactValidationFields(root);
    if(!forms||!fields||typeof forms.refreshReservationRequestValidationUX!=='function'||typeof forms.getReservationRequestData!=='function')return false;
    const names=fieldName?[fieldName]:['name','phone','email'];let valid=true;
    names.forEach(name=>{if(!forms.refreshReservationRequestValidationUX(fields,name))valid=false;});
    const data=forms.getReservationRequestData(fields);
    if(valid&&data?.phone&&names.includes('phone')){fields.phone.value=data.phone;C.state.contact.phone=data.phone;}
    if(!valid){const invalid=root.querySelector?.('[aria-invalid="true"]');invalid?.focus?.({preventScroll:true});}
    return valid;
  }
  const ordinaryChoices={airportId:[['mex','MEX'],['nlu','NLU'],['tlc','TLC'],['pbc','PBC'],['qro','QRO']],direction:[['airport_to_destination','ordinaryArrival'],['destination_to_airport','ordinaryDeparture']],mode:[['hourly','ordinaryHourly'],['full_day','ordinaryFullDay']],baggageStatus:[['unknown','unknown'],['none','none'],['declared','declared']]};
  const ordinaryFieldLabels={airportId:'airport',direction:'ordinaryDirection',origin:'origin',destination:'address',date:'ordinaryDate',time:'ordinaryTime',mode:'ordinaryMode',durationHours:'ordinaryDuration',flight:'flight',baggageStatus:'baggage'};
  function serviceBounds(service,state=C.state){
    const period=state.selectedEvent?.snapshot.servicePeriod;
    const localMinute=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(' ','T'):'';
    const bounds={min:localMinute(period?.from),max:localMinute(period?.until?new Date(Date.parse(period.until)-60000).toISOString():null)};
    const selection=state.selection;
    const option=state.selectedEvent?.snapshot.packages.find(p=>p.id===selection?.packageId)?.options.find(o=>o.id===selection?.optionId);
    const r=option?.calculationModel==='ordinary_services'?service.ordinary?.restrictions:null;
    return {minDate:[bounds.min.slice(0,10),r?.fromDate||''].sort().pop(),maxDate:[bounds.max.slice(0,10),r?.untilDate||''].filter(Boolean).sort()[0]||'',...bounds};
  }
  function airportQuoteReadiness(state,view){
    if(!view)return {ready:false,missing:[],invalid:[]};
    const {option,service,arrival}=view;const data=state.selection.services.find(item=>item.serviceId===service.id)||{};const inputs=service.ordinary.inputs;const values=data.ordinaryInputs||{};const missing=[];const invalid=[];
    const requireValue=(key,label,validate)=>{
      const field=inputs[key];if(!field){invalid.push(t(label));return;}
      if(field.source!=='customer')return;
      const value=values[key];if(value===undefined||value===null||value===''){missing.push(t(label));return;}
      if(validate&&!validate(value))invalid.push(t(label));
    };
    if(!state.selection.passengerBand)missing.push(t('passengers'));
    requireValue('airportId',arrival?'arrivalAirport':'departureAirport',value=>typeof value==='string'&&value!=='');
    requireValue('destination',arrival?'arrivalAddress':'departureAddress',value=>!!value&&typeof value==='object'&&!!value.address?.trim()&&!!value.placeId?.trim());
    const bounds=serviceBounds(service,state);
    requireValue('date','transferDate',value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&(!bounds.minDate||value>=bounds.minDate)&&(!bounds.maxDate||value<=bounds.maxDate));
    const restrictions=service.ordinary.restrictions||{};
    requireValue('time',arrival?'transferStartTime':'transferPickupTime',value=>{
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return false;
      if(restrictions.fromTime&&restrictions.untilTime)return restrictions.fromTime<=restrictions.untilTime?value>=restrictions.fromTime&&value<=restrictions.untilTime:value>=restrictions.fromTime||value<=restrictions.untilTime;
      return (!restrictions.fromTime||value>=restrictions.fromTime)&&(!restrictions.untilTime||value<=restrictions.untilTime);
    });
    const baggage=inputs.baggageCount||inputs.baggageStatus;const pendingBaggage=baggage?.source==='deferred'||option.baggagePolicy?.allowUnknown!==false;
    if(!baggage)invalid.push(t('baggageCount'));
    else if(baggage.source==='customer'){
      const value=values.baggageCount??(values.baggageStatus==='none'?0:undefined);
      if(value===undefined){if(!pendingBaggage)missing.push(t('baggageCount'));}
      else if(!Number.isSafeInteger(value)||value<0)invalid.push(t('baggageCount'));
    }
    return {ready:missing.length===0&&invalid.length===0,missing:[...new Set(missing)],invalid:[...new Set(invalid)]};
  }
  function addressField(name,label,value,className){
    return '<label class="events-package-field services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><span data-package-address="'+esc(name)+'"><input class="services-expand__control" data-package-field="'+esc(name)+'" type="text" value="'+esc(value?.address||'')+'" maxlength="2000" autocomplete="off"><span data-package-address-mount></span><span class="events-package-help" data-package-address-error role="alert" hidden></span></span></label>';
  }
  function displayOrdinaryValue(key,value){
    if(value&&typeof value==='object')return value.address||'';
    const choice=(ordinaryChoices[key]||[]).find(([id])=>id===value);
    return choice?(key==='airportId'?choice[1]:t(choice[1])):value;
  }
  function ordinaryInput(service,data,prefix,key,className,presentation){
    const input=service.ordinary?.inputs?.[key];
    if(!input)return '';
    const direction=service.ordinary?.inputs.direction?.value||data.ordinaryInputs?.direction;
    const label=t(presentation?.label|| (key==='time'&&service.ordinary?.baseService==='airport_transfer'?(direction==='airport_to_destination'?'arrivalTime':'pickupTime'):ordinaryFieldLabels[key]||'pending'))+(presentation?.optional&&input.source==='customer'?' ('+t('optional')+')':'');
    if(input.source==='fixed'){
      const date=presentation&&key==='date'&&!input.redacted&&localDate(input.value);
      const value=date?new Intl.DateTimeFormat(locale(),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date):input.redacted?t('ordinaryFixed'):displayOrdinaryValue(key,input.value);
      return value?'<div class="events-package-fixed services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':'';
    }
    if(input.source==='deferred')return '<div class="events-package-deferred services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><strong>'+esc(t('ordinaryDeferred'))+'</strong></div>';
    const value=data.ordinaryInputs?.[key]??'';const name=prefix+'ordinary-'+key;
    if(ordinaryChoices[key]){const restriction=service.ordinary.restrictions?.[key==='airportId'?'airportIds':key==='direction'?'directions':''];return '<label class="events-package-field services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><select class="services-expand__control" data-package-field="'+esc(name)+'">'+optionHtml('',t('choose'),!value)+ordinaryChoices[key].filter(([id])=>!restriction||restriction.includes(id)).map(([id,text])=>optionHtml(id,key==='airportId'?text:t(text),id===value)).join('')+'</select></label>';}
    if(key==='origin'||key==='destination')return addressField(name,label,value,className);
    const bounds=serviceBounds(service);
    const constraints=key==='date'?((bounds.minDate?'min="'+esc(bounds.minDate)+'" ':'')+(bounds.maxDate?'max="'+esc(bounds.maxDate)+'"':'')):key==='time'?((service.ordinary.restrictions?.fromTime?'min="'+esc(service.ordinary.restrictions.fromTime)+'" ':'')+(service.ordinary.restrictions?.untilTime?'max="'+esc(service.ordinary.restrictions.untilTime)+'"':'')):key==='durationHours'?'min="1" max="24" step="1"':'maxlength="2000"';
    return field(name,label,value,key==='date'?'date':key==='time'?'time':key==='durationHours'?'number':'text',constraints,className);
  }
  function passengerField(selection){
    const pkg=C.state.selectedEvent?.snapshot.packages.find(p=>p.id===selection.packageId);
    const option=pkg?.options.find(o=>o.id===selection.optionId);
    const bands=['van_1_2','van_3_4','van_5_6'].filter(band=>option?.calculationModel==='ordinary_services'||option?.rates?.[band]?.status==='configured');
    return '<fieldset class="events-package-passenger-bands"><legend>'+esc(t('passengers'))+'</legend><div class="services-expand__passengers-segmented">'+bands.map(band=>{
      const reference=document.querySelector?.('[data-airport-tariff-passenger-option="'+band+'"] .services-expand__passenger-chip-icon');
      return '<button type="button" class="services-expand__passenger-chip'+(selection.passengerBand===band?' is-active':'')+'" data-package-band="'+band+'" aria-pressed="'+(selection.passengerBand===band)+'">'+(reference?.outerHTML||'')+'<span class="services-expand__passenger-chip-text">'+esc(bandLabel(band))+'</span></button>';
    }).join('')+'</div>'+(!bands.length?'<p role="status">'+esc(t('noCompatibleBand'))+'</p>':'')+'</fieldset>';
  }
  function bandLabel(band){return ({van_1_2:'1–2',van_3_4:'3–4',van_5_6:'5–6'})[band]||t('choose');}
  function passengerDescription(value){return value.passengerSource==='band'||value.passengerCount===undefined?bandLabel(value.passengerBand):String(value.passengerCount)+' · '+t('historicalExact');}
  function baggageSummary(lines){return (lines||[]).map((line,index)=>line.baggage?'<p>'+esc(t('services'))+' '+(index+1)+' · '+esc(t('baggageCount'))+': '+esc(line.baggage.count??t('baggageQuantityUnknown'))+' · '+esc(t(line.baggage.status))+'</p>':'').join('');}
  function baggageField(service,data,prefix){
    const binding=service.ordinary;
    const configured=binding.inputs.baggageCount;
    const legacy=binding.inputs.baggageStatus;
    const field=configured||legacy;
    const option=C.state.selectedEvent?.snapshot.packages.find(p=>p.id===C.state.selection?.packageId)?.options.find(o=>o.id===C.state.selection?.optionId);
    const pendingAllowed=field?.source==='deferred'||option?.baggagePolicy?.allowUnknown!==false;
    if(field?.source==='fixed'){
      const count=configured?configured.value:legacy.value==='none'?0:null;
      return '<div class="events-package-fixed services-expand__field"><span class="services-expand__label">'+esc(t('baggageCount'))+'</span><strong>'+esc(count===null?t('baggageQuantityUnknown'):String(count))+'</strong></div>';
    }
    if(field?.source==='deferred')return '<p class="events-package-help">'+esc(t('baggageCount'))+': '+esc(t('ordinaryDeferred'))+'</p>';
    if(!field)return '<p role="status">'+esc(t(pendingAllowed?'baggageMayBePending':'baggageConfigurationRequired'))+'</p>';
    const value=data.ordinaryInputs?.baggageCount??(data.ordinaryInputs?.baggageStatus==='none'?0:'');
    return ordinaryQuantity(prefix,value,!pendingAllowed,pendingAllowed)+(pendingAllowed?'<p class="events-package-help">'+esc(t('baggageOptionalHelp'))+'</p>':'');
  }
  function ordinaryQuantity(prefix,value,required,optional,descriptionId){
    const description=descriptionId?' aria-describedby="'+esc(descriptionId)+'" data-package-description="'+esc(descriptionId)+'"':'';
    return field(prefix+'ordinary-baggageCount',t('baggageCount')+(optional?' ('+t('optional')+')':''),value,'number','min="0" step="1" inputmode="numeric"'+(required?' required':'')+description);
  }
  function boundedDateChoices(minDate,maxDate){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(minDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(maxDate||''))return null;
    const start=new Date(minDate+'T12:00:00Z'),end=new Date(maxDate+'T12:00:00Z');
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start.toISOString().slice(0,10)!==minDate||end.toISOString().slice(0,10)!==maxDate)return [];
    const dayCount=Math.floor((end-start)/86400000)+1;
    if(dayCount<1||dayCount>1000)return [];
    return Array.from({length:dayCount},(_,index)=>new Date(start.getTime()+index*86400000).toISOString().slice(0,10));
  }
  function dateChoiceLabel(value){
    return new Intl.DateTimeFormat(locale(),{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  }
  function mobileTemporalInput(service,data,prefix,key,label){
    const source=service.ordinary.inputs[key];if(!source)return '';
    if(source.source!=='customer')return ordinaryInput(service,data,prefix,key);
    const raw=ordinaryInput(service,data,prefix,key);let control=raw.match(/<input\b[^>]*>/)?.[0];
    const icon=document.querySelector?.('#services-expand-airport .services-expand__'+(key==='date'?'date':'time')+'-icon')?.outerHTML||'';
    const overlay=document.querySelector?.('#services-expand-airport .services-expand__'+(key==='date'?'date':'time')+'-overlay')?.textContent||'';
    let dateError='';
    if(key==='date'){
      const bounds=serviceBounds(service),choices=boundedDateChoices(bounds.minDate,bounds.maxDate),value=data.ordinaryInputs?.date||'';
      if(choices!==null){
        const validChoice=choices.includes(value),invalidChoice=Boolean(value&&!validChoice),unavailable=!choices.length;
        control='<select class="services-expand__control" data-package-field="'+esc(prefix+'ordinary-date')+'" data-package-date-choice data-min="'+esc(bounds.minDate)+'" data-max="'+esc(bounds.maxDate)+'" required'+(unavailable?' disabled':'')+(invalidChoice||unavailable?' aria-invalid="true"':'')+'>'+optionHtml('',t('choose'),!validChoice)+choices.map(choice=>optionHtml(choice,dateChoiceLabel(choice),choice===value)).join('')+'</select>';
        dateError=invalidChoice||unavailable?'<span data-package-field-error role="alert">'+esc(t('invalidForQuote',{fields:t('transferDate')}))+'</span>':'';
      }
    }
    return '<label class="events-package-trip__temporal services-expand__field services-expand__field--'+key+'"><span class="services-expand__label">'+esc(label)+'</span><span class="services-expand__date-wrap '+(key==='time'?'services-expand__time-wrap':'')+'">'+control+(key==='date'&&control.includes('<select')?'':'<span class="services-expand__date-overlay" aria-hidden="true"'+(data.ordinaryInputs?.[key]?' hidden':'')+'>'+esc(overlay)+'</span>')+icon+'</span>'+dateError+'</label>';
  }
  function mobileAddressInput(service,data,prefix,key,title,lodging){
    const raw=ordinaryInput(service,data,prefix,key,'events-package-trip__field events-package-trip__field--address');
    if(!raw.includes('<input'))return raw;
    if(!lodging)return raw.replace('<span data-package-address=', '<span class="services-expand__destination services-expand__destination-search" data-package-address=').replace('<input ', '<input data-package-mobile-address-input data-package-mobile-address-title="'+esc(title)+'" ');
    const value=data.ordinaryInputs?.[key];
    const resolved=!!value?.address&&!!value?.placeId;
    const clearLabel=sharedEventText(['services','cards','airport','panel','clearResolvedDestination'],t('choose'));
    const clear='<button type="button" class="events-package-mobile-address__clear" data-package-mobile-address-clear aria-label="'+esc(clearLabel)+'"'+(resolved?'':' hidden')+'><span aria-hidden="true">×</span></button>';
    return raw.replace('<span data-package-address=', '<span class="services-expand__destination services-expand__destination-search events-package-mobile-address'+(resolved?' is-resolved':'')+'" data-package-address=').replace('<input ', '<input data-package-mobile-address-input data-package-mobile-address-title="'+esc(title)+'" '+(lodging?'data-package-mobile-lodging-input ':'')+'').replace('<span data-package-address-mount></span>',clear+'<span data-package-address-mount></span>');
  }
  function mobileAirportZone(state,service,data){
    const destination=data.ordinaryInputs?.destination;
    if(!destination?.address||!destination?.placeId)return '';
    const line=state.quote?.calculation?.serviceLines?.find(item=>item.serviceId===service.id);
    const zoneId=line?.zoneIds?.[0];
    const zoneLabel=zoneId&&window.PixkuyAirportTariffCatalog?.resolveDisplayLabel?.('zone',zoneId);
    if(!zoneLabel||zoneLabel===zoneId)return '';
    const label=sharedEventText(['services','cards','airport','panel','destinationZoneLabel'],t('destination'));
    return '<p class="events-package-mobile-airport__zone"><span>'+esc(label)+'</span> <strong>'+esc(zoneLabel)+'</strong></p>';
  }
  function mobilePassengerInput(state,className){
    return '<label class="events-package-mobile-passengers '+esc(className||'')+'"><span class="services-expand__label">'+esc(t('passengers'))+'</span><select class="events-package-mobile-passengers__control" data-package-mobile-band>'+optionHtml('','—',!state.selection.passengerBand)+['van_1_2','van_3_4','van_5_6'].map(b=>optionHtml(b,bandLabel(b),b===state.selection.passengerBand)).join('')+'</select></label>';
  }
  function mobileBaseRecognized(service){return ['airport_transfer','direct_transfer','hourly_daily'].includes(service.ordinary?.baseService);}
  function mobileAirportInputs(service,data,prefix,state,includePassengers){
    const binding=service.ordinary;
    const shared=(key,fallback)=>sharedEventText(key.split('.'),t(fallback));
    const airport=airportSelector(service,data,prefix,'airport',true);
    const direction=binding.inputs.direction?.source==='fixed'?binding.inputs.direction.value:data.ordinaryInputs?.direction;
    const address=mobileAddressInput(service,data,prefix,'destination',t('address'),true).replace('events-package-field ','');
    const role=(name,html)=>html.replace(/^<(div|label) /,'<$1 data-airport-tariff-role="'+name+'" ');
    const dateTime=key=>mobileTemporalInput(service,data,prefix,key,shared('services.cards.airport.panel.'+(key==='date'?'dateLabel':'timeLabel'),key==='date'?'ordinaryDate':'ordinaryTime'));
    const bands=includePassengers?'<label class="airport-mobile-passengers"><span class="airport-mobile-passengers__label">'+esc(t('passengers'))+'</span><select class="airport-mobile-passengers__select" data-package-mobile-band>'+optionHtml('','—',!state.selection.passengerBand)+['van_1_2','van_3_4','van_5_6'].map(b=>optionHtml(b,bandLabel(b),b===state.selection.passengerBand)).join('')+'</select></label>':'';
    const bagInput=binding.inputs.baggageCount||binding.inputs.baggageStatus;
    const pendingAllowed=bagInput?.source==='deferred'||state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)?.options.find(o=>o.id===state.selection.optionId)?.baggagePolicy?.allowUnknown!==false;
    const bags=bagInput?.source==='customer'?'<label class="airport-mobile-luggage"><span class="airport-mobile-luggage__label">'+esc(shared('airportMobileFlow.fields.luggage','baggageCount'))+'</span>'+ordinaryQuantity(prefix,data.ordinaryInputs?.baggageCount??(data.ordinaryInputs?.baggageStatus==='none'?0:''),!pendingAllowed,pendingAllowed).match(/<input\b[^>]*>/)?.[0].replace('class="services-expand__control"','class="airport-mobile-luggage__select"')+'</label>':baggageField(service,data,prefix);
    return '<div class="events-package-mobile-airport"><div class="services-expand__form">'+(binding.inputs.direction?.source==='customer'?ordinaryInput(service,data,prefix,'direction'):'')+(direction==='destination_to_airport'?role('destination',address)+role('origin',airport):role('origin',airport)+role('destination',address))+mobileAirportZone(state,service,data)+bands+bags+dateTime('date')+dateTime('time')+'<div class="events-package-airport-flight">'+ordinaryInput(service,data,prefix,'flight','',{label:'transferFlight',optional:true})+'</div></div></div>';
  }
  function mobileOrdinaryInputs(service,data,prefix,state,includePassengers){
    const binding=service.ordinary;
    if(binding.baseService==='airport_transfer')return mobileAirportInputs(service,data,prefix,state,includePassengers);
    if(!['direct_transfer','hourly_daily'].includes(binding.baseService)){
      const input=key=>ordinaryInput(service,data,prefix,key,'',key==='flight'?{label:'transferFlight',optional:true}:key==='time'?{label:'ordinaryTime'}:undefined);
      const cell=(key,html)=>html?'<div class="events-package-trip__cell events-package-trip__cell--'+key+'">'+html+'</div>':'';
      const schedule='<div class="events-package-trip__pair">'+cell('date',input('date'))+cell('time',input('time'))+'</div>';
      return '<div class="events-package-trip events-package-trip--legacy">'+cell('address',input('origin'))+'<div class="events-package-trip__pair">'+cell('mode',input('mode'))+cell('duration',input('durationHours'))+'</div>'+schedule+cell('bags',baggageField(service,data,prefix))+'</div>';
    }
    const cell=(key,html)=>html?'<div class="events-package-trip__cell events-package-trip__cell--'+key+'">'+html+'</div>':'';
    const passenger=includePassengers?cell('passengers',mobilePassengerInput(state,binding.baseService==='direct_transfer'?'events-package-mobile-passengers--direct':'events-package-mobile-passengers--hourly')):'';
    const dateLabel=binding.baseService==='direct_transfer'?sharedEventText(['directTransferMobileFlow','fields','date'],t('ordinaryDate')):sharedEventText(['services','cards','hourly','panel','dateLabel'],t('ordinaryDate'));
    const timeLabel=binding.baseService==='direct_transfer'?sharedEventText(['directTransferMobileFlow','fields','time'],t('ordinaryTime')):sharedEventText(['services','cards','hourly','panel','timeLabel'],t('ordinaryTime'));
    const date=cell('date',mobileTemporalInput(service,data,prefix,'date',dateLabel));
    const time=cell('time',mobileTemporalInput(service,data,prefix,'time',timeLabel));
    const bags=cell('bags',baggageField(service,data,prefix));
    if(binding.baseService==='direct_transfer'){
      const origin=cell('address',mobileAddressInput(service,data,prefix,'origin',sharedEventText(['directTransferMobileFlow','addressSearch','originTitle'],t('origin'))));
      const destination=cell('address',mobileAddressInput(service,data,prefix,'destination',sharedEventText(['directTransferMobileFlow','addressSearch','destinationTitle'],t('destination'))));
      return '<div class="events-package-trip events-package-trip--direct">'+origin+destination+'<div class="events-package-trip__schedule events-package-trip__schedule--direct'+(includePassengers?' has-passengers':'')+'">'+passenger+date+time+'</div>'+bags+'</div>';
    }
    const origin=cell('address',mobileAddressInput(service,data,prefix,'origin',sharedEventText(['services','cards','hourly','panel','pickupLabel'],t('origin'))));
    const mode=cell('mode',ordinaryInput(service,data,prefix,'mode'));
    const duration=cell('duration',ordinaryInput(service,data,prefix,'durationHours'));
    return '<div class="events-package-trip events-package-trip--hourly">'+passenger+mode+origin+'<div class="events-package-trip__schedule events-package-trip__schedule--hourly">'+duration+date+time+'</div>'+bags+'</div>';
  }
  function ordinaryInputs(service,data,prefix,state,includePassengers,surface){
    if(!service.ordinary)return '<p>'+esc(t('pending'))+'</p>';
    if(surface==='mobile')return mobileOrdinaryInputs(service,data,prefix,state,includePassengers);
    const binding=service.ordinary;
    if(binding.baseService==='airport_transfer'){
      const direction=binding.inputs.direction?.source==='fixed'?binding.inputs.direction.value:data.ordinaryInputs?.direction;
      const airport=ordinaryInput(service,data,prefix,'airportId','events-package-ordinary__airport');
      const destination=ordinaryInput(service,data,prefix,'destination','events-package-ordinary__destination');
      const arrival=direction!=='destination_to_airport';
      return '<p class="events-package-help">'+esc(t('ordinaryPricing'))+'</p>'
        +(binding.inputs.direction?.source==='customer'?ordinaryInput(service,data,prefix,'direction'):'')
        +'<div class="events-package-ordinary__route">'+(arrival?airport:destination)+'<span class="events-package-ordinary__direction" aria-hidden="true">→</span>'+(arrival?destination:airport)+'</div>'
        +'<div class="events-package-ordinary__details">'+(includePassengers?passengerField(state.selection):'')+ordinaryInput(service,data,prefix,'date','events-package-ordinary__date')+ordinaryInput(service,data,prefix,'time','events-package-ordinary__time')+ordinaryInput(service,data,prefix,'flight','events-package-ordinary__flight',{label:'transferFlight',optional:true}) +(binding.inputs.flight?.source==='customer'?'<p class="events-package-help">'+esc(t('flightOptionalHelp'))+'</p>':'')+baggageField(service,data,prefix)+'</div>';
    }
    const keys=binding.baseService==='direct_transfer'?['origin','destination','date','time']:['origin','mode','durationHours','date','time'];
    return '<p class="events-package-help">'+esc(t('ordinaryPricing'))+'</p><div class="events-package-fields-grid">'+(includePassengers?passengerField(state.selection):'')+keys.map(key=>ordinaryInput(service,data,prefix,key)).join('')+baggageField(service,data,prefix)+'</div>';
  }
  function summary(state,surface){
    if(!state.quote)return '';
    const calculation=state.quote.calculation;
    const price=calculation.priceBreakdown;
    const complete=price.priceStatus==='quoted'&&price.pricedSubtotal!==null;
    const amount=complete?money(price.pricedSubtotal,price.currency):t('pending');
    const conditions=surface==='mobile-review'
      ?'<button type="button" class="events-package-offer__details-trigger" data-package-action="details" data-package-details="'+esc(state.selection.packageId)+'" data-package-review-conditions aria-haspopup="dialog">'+esc(t('conditions'))+'</button>'
      :'<details><summary>'+esc(t('breakdown'))+' · '+esc(t('conditions'))+'</summary>'+(calculation.serviceCount>1?(calculation.serviceLines||[]).map((line,index)=>'<p>'+esc(t('services'))+' '+(index+1)+': '+esc(line.resultMinorUnits===null?t('pending'):money(line.resultMinorUnits,line.currency))+'</p>').join(''):'')+'<h4>'+esc(t("conditions"))+'</h4><ul>'+(calculation.conditions||[]).map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong> '+esc(local(condition.description))+'</li>').join('')+'</ul></details>';
    return '<section class="events-package-summary" aria-live="polite">'
      +'<h4>'+esc(t(complete?'groupTotal':'pending'))+'</h4>'
      +'<p class="events-package-summary__amount">'+esc(amount)+'</p>'
      +'<p>'+esc(t("services"))+': '+esc(calculation.serviceCount===null?t("unknown"):calculation.serviceCount)+'</p>'
      +(calculation.calculationModel==='ordinary_services'&&price.pricedSubtotal===null?[]:price.automaticAddOns||[]).map(line=>'<p>'+esc(t("additional"))+': '+esc(money(line.totalMinorUnits,price.currency))+'</p>').join('')
      +(calculation.pendingCodes.length?'<p class="events-package-help">'+esc(t("pending"))+'</p>':'')
      +(calculation.coordinationPendingCodes?.length?'<p class="events-package-help">'+esc(t('ordinaryDeferred'))+'</p>':'')
      +(calculation.serviceLines||[]).map((line,index)=>{const pending=Object.entries(line.inputStatus||{}).filter(([,input])=>input.pending).map(([key])=>t(ordinaryFieldLabels[key]||'pending'));return pending.length?'<p>'+esc(t('services'))+' '+(index+1)+': '+esc(pending.join(', '))+' · '+esc(t('ordinaryDeferred'))+'</p>':'';}).join('')
      +conditions
      +'<p class="events-package-help">'+esc(t("notBooking"))+'</p>'
      +'</section>';
  }
  function mobileAirportOption(option){
    return !!option&&option.calculationModel==='ordinary_services'&&option.services.length>0&&option.services.every(service=>service.ordinary?.baseService==='airport_transfer');
  }
  function mobileAirportQuoteCard(state,option,locked){
    const calculation=state.quote?.calculation;
    const price=calculation?.priceBreakdown;
    if(!mobileAirportOption(option)||!airportCanReview(state)||price?.priceStatus!=='quoted'||price.pricedSubtotal===null||price.pricedSubtotal===undefined)return '';
    const formatted=money(price.pricedSubtotal,price.currency);
    const currency=String(price.currency||'MXN');
    const suffix=' '+currency;
    if(!formatted.endsWith(suffix))return '';
    const amount=formatted.slice(0,-suffix.length);
    return '<section class="events-package-vehicle-card" aria-label="'+esc(t('vehicleCategoryLabel'))+'">'
      +'<button type="button" class="events-package-vehicle-card__gallery" data-package-action="vehicle-gallery" aria-haspopup="dialog" aria-label="'+esc(t('vehicleGalleryOpen'))+'">'
      +'<img class="events-package-vehicle-card__image" src="assets/img/fleet/bydm9_xhoras001d.jpeg" alt="'+esc(t('vehicleCategoryLabel'))+'" loading="lazy" decoding="async">'
      +'<span class="events-package-vehicle-card__gallery-label">'+esc(t('vehicleGalleryOpen'))+'</span></button>'
      +'<p class="events-package-vehicle-card__vehicle">'+esc(t('vehicleCategoryLabel'))+'</p>'
      +'<div class="events-package-vehicle-card__fare"><span>'+esc(t('vehicleFareLabel'))+'</span><strong><span>'+esc(amount)+'</span><span class="events-package-vehicle-card__currency">'+esc(currency)+'</span></strong></div>'
      +button('contact',t('continueContact'),locked,'primary')+'</section>';
  }
  function mobileCalculationContent(state,option,locked){
    const automaticView=configuredAirportOption(state);
    if(!automaticView||automaticView.option!==option)return summary(state)+calculationControls(state,locked);
    const card=mobileAirportQuoteCard(state,option,locked);
    if(card)return card;
    const outside=state.quote?.calculation?.coverageStatus==='outside';
    if(outside){let content='<p class="events-package-alert" role="alert">'+esc(t('ordinaryOutside'))+'</p>';if(state.selectedEvent.snapshot.customInquiryEnabled)content+=button('ordinary-custom',t('custom'),locked,'secondary');return content;}
    const content=state.quote?summary(state):'';
    if(state.quoteStatus==='loading')return content+'<p class="events-package-status" role="status">'+esc(t('transferCalculating'))+'</p>';
    if(state.quoteStatus==='error')return content+button('retry-quote',t('retryCalculation'),locked,'secondary');
    if(!state.quote)return '<p class="events-package-status" role="status">'+esc(t('automaticQuotePending'))+'</p>';
    return content;
  }
  function sharedEventText(path,fallbackValue){
    let value=window.__pixkuyI18nDict;
    for(const key of path)value=value&&value[key];
    return typeof value==='string'&&value?value:fallbackValue;
  }
  function eventTitle(event){return event.snapshot.translations[locale()]?.title||event.snapshot.translations.es.title;}
  function eventType(event){return sharedEventText(['services','cards','events','types',event.snapshot.type],sharedEventText(['services','cards','events','types','other'],'Evento'));}
  function eventVenue(event){
    const venue=event.snapshot.venue;
    return venue&&(venue.translations?.[locale()]?.name||venue.translations?.es?.name||venue.baseName)||'';
  }
  function localDate(value){
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return null;
    const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),12));
    return date.toISOString().slice(0,10)===value?date:null;
  }
  function eventDates(event){
    const range=event.snapshot.publicEventDates;
    if(!range||range.timeZone!=='America/Mexico_City')return '';
    const start=localDate(range.startLocalDate);
    const endExclusive=localDate(range.endLocalDateExclusive);
    if(!start||!endExclusive||endExclusive<=start)return '';
    const end=new Date(endExclusive.getTime()-86400000);
    const language=locale();
    if(language==='es'||language.startsWith('es-')){
      const months=['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
      const startText=start.getUTCDate()+' '+months[start.getUTCMonth()];
      const endText=end.getUTCDate()+' '+months[end.getUTCMonth()];
      return start.getUTCFullYear()===end.getUTCFullYear()?startText+' – '+endText+' '+end.getUTCFullYear():startText+' '+start.getUTCFullYear()+' – '+endText+' '+end.getUTCFullYear();
    }
    return new Intl.DateTimeFormat(language,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).formatRange(start,end);
  }
  function eventMedia(event){
    const main=event.snapshot.media?.main?.url;
    const mobile=event.snapshot.media?.mobile?.url;
    if(!main)return '<div class="services-events-panel__event-media"><div class="services-events-panel__event-image events-package-card__media-fallback" aria-hidden="true"><span>'+esc(eventType(event))+'</span></div></div>';
    const alt=sharedEventText(['services','cards','events','panel','posterAlt'],'Cartel del evento')+': '+eventTitle(event);
    return '<div class="services-events-panel__event-media"><picture>'+(mobile?'<source media="(max-width: 720px)" srcset="'+esc(mobile)+'">':'')+'<img class="services-events-panel__event-image" src="'+esc(main)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async"></picture></div>';
  }
  function eventMetadata(event,compact){
    const dates=eventDates(event);
    const venue=eventVenue(event);
    if(compact)return dates||venue?'<p class="events-package-event-heading__meta">'+esc([dates,venue].filter(Boolean).join(' · '))+'</p>':'';
    const rows=[];
    if(dates)rows.push('<div><dt>'+esc(t('publicDatesLabel'))+'</dt><dd>'+esc(dates)+'</dd></div>');
    if(venue)rows.push('<div><dt>'+esc(sharedEventText(['services','cards','events','panel','venueLabel'],'Recinto'))+'</dt><dd>'+esc(venue)+'</dd></div>');
    return rows.length?'<dl class="services-events-panel__event-meta">'+rows.join('')+'</dl>':'';
  }
  function packageCard(event){
    const hasPackages=activePackages(event).length>0;
    const fromPrice=event.fromPrice;
    const selected=C.state.screen!=='catalog'&&C.state.selectedEvent?.id===event.id;
    return '<article class="services-events-panel__event events-package-card'+(selected?' is-selected':'')+'" data-package-card="'+esc(event.id)+'" role="listitem">'
      +eventMedia(event)
      +'<div class="services-events-panel__event-body">'
      +'<p class="services-events-panel__event-type">'+esc(eventType(event))+'</p>'
      +'<h4 class="services-events-panel__event-title">'+esc(eventTitle(event))+'</h4>'
      +eventMetadata(event)
      +'<div class="services-events-panel__event-footer">'
      +(fromPrice?'<div class="services-events-panel__event-price"><span>'+esc(sharedEventText(['services','cards','events','panel','priceFromLabel'],'Desde'))+'</span><strong>'+esc(money(fromPrice.minorUnits,fromPrice.currency))+'</strong></div>':'<span aria-hidden="true"></span>')
      +'<div class="events-package-card__actions">'
      +(hasPackages?'<button type="button" class="services-events-panel__event-cta events-package-card__primary" data-package-event="'+esc(event.id)+'">'+esc(t('viewPackages'))+'</button>':'')
      +(!hasPackages&&event.snapshot.customInquiryEnabled?'<button type="button" class="services-events-panel__event-cta" data-package-custom="'+esc(event.id)+'">'+esc(t('proposal'))+'</button>':'')
      +'</div></div></div></article>';
  }
  function catalog(state){
    if(state.catalogStatus==='loading')return '<p class="events-package-catalog__status" role="status">'+esc(t("loading"))+'</p>';
    if(state.catalogStatus==='error')return '<div class="events-package-catalog__status"><p role="alert">'+esc(t("error"))+'</p>'+button('reload',t('retry'),false,'secondary')+'</div>';
    if(state.events.length===0)return '<p class="events-package-catalog__status">'+esc(t("empty"))+'</p>';
    return '<div class="events-package-offers" role="list" aria-label="'+esc(t('title'))+'">'+state.events.map(packageCard).join('')+'</div>';
  }
  function customStrip(state){
    const events=state.events.filter(e=>e.snapshot.customInquiryEnabled);
    if(!events.length)return '';
    return '<section class="events-package-custom-strip"><div><h3>'+esc(t('customTitle'))+'</h3><p>'+esc(t('customIntro'))+'</p></div>'+button('custom-entry',t('proposal'),false,'secondary')+(state.customPicker?'<div class="events-package-custom-picker"><p>'+esc(t('selectEvent'))+'</p>'+events.map(e=>'<button type="button" class="events-package-button events-package-button--secondary" data-package-custom="'+esc(e.id)+'">'+esc(eventTitle(e))+'</button>').join('')+'</div>':'')+'</section>';
  }
  const activePackages=event=>(event.snapshot.packages||[]).filter(p=>p.active!==false);
  const activeOptions=pkg=>pkg.options.filter(o=>o.active!==false);
  function optionPrice(option){
    if(!option||option.calculationModel==='ordinary_services')return '<p class="events-package-help">'+esc(t('priceByDetails'))+'</p>';
    const bands=[['van_1_2','1–2'],['van_3_4','3–4'],['van_5_6','5–6']];
    const rows=bands.filter(([band])=>option.rates?.[band]?.status==='configured'&&option.rates[band].minorUnits!==null).map(([band,label])=>'<div><dt>'+esc(t('passengers'))+' '+label+'</dt><dd>'+esc(money(option.rates[band].minorUnits,option.rates[band].currency))+'</dd></div>');
    return rows.length?'<dl class="events-package-published-rates">'+rows.join('')+'</dl>':'<p class="events-package-help">'+esc(t('priceByDetails'))+'</p>';
  }
  function conditionsHtml(event,pkg){return '<details class="events-package-option-copy"><summary>'+esc(t('conditions'))+'</summary><ul>'+[...(event.snapshot.conditions||[]),...(pkg?.conditions||[])].map(c=>'<li><strong>'+esc(local(c.title))+'</strong> '+esc(local(c.description))+'</li>').join('')+'</ul></details>';}
  function packageDetailsContent(event,pkg,forDialog,conditionsOnly,conditionSource){
    const inclusions=pkg.inclusions||[];
    const conditions=conditionSource===undefined?[...(event.snapshot.conditions||[]),...(pkg.conditions||[])]:conditionSource;
    const heading=forDialog?'h3':'h5';
    const condition=c=>forDialog?'<li><strong>'+esc(local(c.title))+'</strong><p>'+esc(local(c.description))+'</p></li>':'<li><strong>'+esc(local(c.title))+'</strong> '+esc(local(c.description))+'</li>';
    return (conditionsOnly?'':'<section><'+heading+'>'+esc(t('inclusions'))+' ('+inclusions.length+')</'+heading+'><ul>'+inclusions.map(i=>'<li>'+esc(local(i))+'</li>').join('')+'</ul></section>')+'<section><'+heading+'>'+esc(t('conditions'))+' ('+conditions.length+')</'+heading+'><ul>'+conditions.map(condition).join('')+'</ul></section>';
  }
  function offerDisclosures(event,pkg,surface){
    if(surface==='mobile')return '<button type="button" class="events-package-offer__details-trigger" data-package-action="details" data-package-details="'+esc(pkg.id)+'" aria-haspopup="dialog">'+esc(t('viewAllDetails'))+'</button>';
    return '<details class="events-package-offer__disclosure"><summary>'+esc(t('viewAllDetails'))+'</summary><div class="events-package-offer__details">'+packageDetailsContent(event,pkg,false)+'</div></details>';
  }
  // Fixed local vector vocabulary; no editor-provided markup or URL is rendered.
  const inclusionIconPaths={
    plane:'M2.5 16.5L10 14l4-8.5a1.4 1.4 0 1 1 2.5 1.2L13.8 15l5.7 2.1a1 1 0 0 1-.3 1.9h-4.6l-2.4 3.2a.9.9 0 0 1-1.6-.5v-4.1l-7-1.6a.8.8 0 0 1-.1-1.5Z',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    clock:'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0ZM12 7.8v4.6l3.1 1.9'
  };
  function inclusionHighlight(inclusion){
    const path=Object.prototype.hasOwnProperty.call(inclusionIconPaths,inclusion.iconId)?inclusionIconPaths[inclusion.iconId]:null;
    const icon=path?'<svg class="events-package-offer__highlight-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+path+'"/></svg>':'';
    return '<li>'+icon+'<span>'+esc(local(inclusion.summary)||local(inclusion))+'</span></li>';
  }
  function offer(state,surface){
    const event=state.selectedEvent;
    const packages=activePackages(event);
    return '<div class="events-package-offer-grid'+(packages.length===1?' events-package-offer-grid--single':'')+'">'+packages.map(pkg=>{
      const options=activeOptions(pkg);const selected=state.selection.packageId===pkg.id;
      const chosen=options.find(o=>o.id===state.selection.optionId);
      let alternatives='';
      if(selected&&options.length>1){
        if(options.length<=4)alternatives='<fieldset class="events-package-options"><legend>'+esc(t('option'))+'</legend>'+options.map(o=>'<label class="events-package-check"><input type="radio" name="package-option" data-package-field="option" value="'+esc(o.id)+'"'+(o.id===chosen?.id?' checked':'')+'><span>'+esc(local(o.title))+' · '+esc(t('services'))+': '+o.services.length+'</span></label>').join('')+'</fieldset>';
        else alternatives='<label class="events-package-field"><span>'+esc(t('option'))+'</span><select data-package-field="option">'+optionHtml('',t('choose'),!chosen)+options.map(o=>optionHtml(o.id,local(o.title),o===chosen)).join('')+'</select></label>';
      }
      const detail=chosen||(options.length===1?options[0]:null);
      const additionalIds=new Set((event.snapshot.addOns||[]).filter(a=>a.packageId===pkg.id&&a.optionIds.includes(detail?.id)&&a.kind!=='airport_leg_supplement').flatMap(a=>a.serviceIds));
      const includedServices=detail?.services.filter(s=>!additionalIds.has(s.id))||[];
      const isTransfer=detail&&includedServices.length>0&&includedServices.every(service=>detail.calculationModel==='ordinary_services'?['airport_transfer','direct_transfer'].includes(service.ordinary?.baseService):service.kind==='trip');
      const transferLabel=isTransfer?(includedServices.length===1?t('transferOne'):t('transferMany',{count:includedServices.length})):t('services')+': '+includedServices.length;
      const mode=detail?'<section class="events-package-offer__mode"><h5>'+esc(t('modeAvailable'))+'</h5><p>'+esc(local(detail.title))+(includedServices.length?' · '+esc(transferLabel):'')+'</p></section>':'';
      const subtitle=local(pkg.subtitle);
      return '<article class="events-package-offer"><div class="events-package-offer__content"><h4>'+esc(local(pkg.title))+'</h4>'+(subtitle?'<p class="events-package-offer__subtitle">'+esc(subtitle)+'</p>':'')+'<p class="events-package-offer__description">'+esc(local(pkg.description))+'</p>'+mode+'<ul class="events-package-offer__highlights">'+pkg.inclusions.slice(0,3).map(inclusionHighlight).join('')+'</ul>'+offerDisclosures(event,pkg,surface)+'</div><div class="events-package-offer__controls">'+optionPrice(detail)+alternatives+'<button type="button" class="events-package-button events-package-button--primary" data-package-configure="'+esc(pkg.id)+'">'+esc(surface==='mobile'?t('mobileConfigureTrip'):selected&&chosen?t('goServices'):isTransfer?t('configureTransfer'):t('configureServices'))+'</button></div></article>';
    }).join('')+'</div>'+(event.snapshot.customInquiryEnabled?'<div class="events-package-offer-footer"><div><h4>'+esc(t('customTitle'))+'</h4><p>'+esc(t('customStepIntro'))+'</p></div>'+button('ordinary-custom',t('proposal'),false,'secondary')+'</div>':'');
  }
  function packageDetailsFocusables(){return packageDetailsDialog?Array.from(packageDetailsDialog.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(node=>!node.hidden):[];}
  function closePackageDetailsDialog(){
    roots.forEach(root=>{if(root.getAttribute('data-event-package-root')==='mobile'){root.closePackageAirport?.();window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));}});
    if(!packageDetailsDialog||packageDetailsDialog.hidden)return false;
    packageDetailsDialog.hidden=true;packageDetailsDialog.setAttribute('aria-hidden','true');document.body.setAttribute('data-events-package-details-dialog-active','false');
    if(packageDetailsPreviousFocus&&document.contains(packageDetailsPreviousFocus))packageDetailsPreviousFocus.focus({preventScroll:true});
    packageDetailsPreviousFocus=null;return true;
  }
  function ensurePackageDetailsDialog(){
    if(packageDetailsDialog)return packageDetailsDialog;
    const dialog=document.createElement('section');dialog.className='events-package-details-dialog';dialog.setAttribute('data-events-package-details-dialog','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-hidden','true');dialog.setAttribute('aria-labelledby','events-package-details-dialog-title');dialog.hidden=true;
    dialog.innerHTML='<button type="button" class="events-package-details-dialog__backdrop" data-package-details-close tabindex="-1"></button><section class="events-package-details-dialog__panel" role="document"><header><div><h2 id="events-package-details-dialog-title"></h2><p data-package-details-context></p></div><button type="button" class="events-package-details-dialog__close" data-package-details-close aria-label="'+esc(t('close'))+'">×</button></header><div class="events-package-details-dialog__body" data-package-details-body></div></section>';
    dialog.addEventListener('click',event=>{if(event.target.closest('[data-package-details-close]')){event.preventDefault();closePackageDetailsDialog();}});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closePackageDetailsDialog();return;}if(event.key!=='Tab')return;const focusable=packageDetailsFocusables();if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
    document.body.appendChild(dialog);packageDetailsDialog=dialog;return dialog;
  }
  function openPackageDetailsDialog(root,pkgId,trigger){
    if(root.getAttribute('data-event-package-root')!=='mobile'||!window.matchMedia('(max-width:720px)').matches)return false;
    const event=C.state.selectedEvent;if(!event)return false;const pkg=activePackages(event).find(item=>item.id===pkgId);if(!pkg)return false;
    const dialog=ensurePackageDetailsDialog();const title=dialog.querySelector('#events-package-details-dialog-title');const context=dialog.querySelector('[data-package-details-context]');const body=dialog.querySelector('[data-package-details-body]');const close=dialog.querySelector('[data-package-details-close]:not([tabindex="-1"])');
    if(!title||!context||!body||!close)return false;
    const reviewConditions=trigger?.hasAttribute('data-package-review-conditions');
    const conditionsOnly=reviewConditions||trigger?.hasAttribute('data-package-conditions-only');
    const option=reviewConditions?activeOptions(pkg).find(item=>item.id===C.state.selection?.optionId):null;
    title.textContent=conditionsOnly?t('conditions'):t('inclusions')+' · '+t('conditions');context.textContent=[eventTitle(event),local(pkg.title),option&&local(option.title)].filter(Boolean).join(' · ');body.innerHTML=packageDetailsContent(event,pkg,true,conditionsOnly,reviewConditions?(C.state.quote?.calculation?.conditions||[]):undefined);body.scrollTop=0;packageDetailsPreviousFocus=trigger||document.activeElement;dialog.hidden=false;dialog.setAttribute('aria-hidden','false');document.body.setAttribute('data-events-package-details-dialog-active','true');close.focus({preventScroll:true});return true;
  }
  function navigation(state,surface){
    if(state.selection.requestKind==='custom')return button('packages',t('viewPackages'),false,'quiet');
    const steps=surface==='mobile'?['package','services','review']:['package','services'];
    return '<nav class="events-package-steps" aria-label="'+esc(t('title'))+'">'+steps.map((step,index)=>'<button type="button" data-package-step="'+step+'"'+(state.step===step?' aria-current="step"':'')+((step==='services'&&!state.selection.optionId)||(step==='review'&&state.step!=='review')?' disabled':'')+'>'+(index+1)+'. '+esc(step==='review'?t('reviewContact'):t(surface==='mobile'&&step==='services'?'mobileTripData':step))+'</button>').join('')+'</nav>';
  }
  function contactHandoff(root){
    if(!airportCanReview(C.state)||!validFields(root)||!C.go('review'))return false;
    if(root.getAttribute('data-event-package-root')==='mobile'){focusDetail(root);return true;}
    window.dispatchEvent(new CustomEvent('pixkuy:events-special-panel-submit',{detail:{contextKind:'event_packages'}}));
    return true;
  }
  function localServiceDate(value){
    if(!value)return t('ordinaryDeferred');
    const date=new Date(value.length===10?value+'T00:00:00Z':value+'Z');
    if(!Number.isFinite(date.getTime()))return t('ordinaryDeferred');
    return new Intl.DateTimeFormat(locale(),{dateStyle:'long',...(value.length>10?{timeStyle:'short'}:{}),timeZone:'UTC'}).format(date)+' · CDMX';
  }
  function reviewItinerary(state){
    const selection=state.selection,event=state.selectedEvent;
    if(selection.requestKind==='custom')return '<p>'+esc(selection.inquiry.notes)+'</p><p>'+esc(t('passengers'))+': '+esc(selection.inquiry.passengers.count??t('unknown'))+'</p>'+button('edit-services',t('editServices'),false,'quiet');
    const pkg=activePackages(event).find(p=>p.id===selection.packageId),option=pkg?.options.find(o=>o.id===selection.optionId);
    return '<section class="events-package-review"><h4>'+esc(local(pkg?.title))+' · '+esc(local(option?.title))+'</h4><p>'+esc(t('passengers'))+': '+esc(passengerDescription(selection))+'</p><ol>'+(state.quote?.calculation?.itinerary?.services||option?.services||[]).map((service,index)=>{
      const template=option.services.find(s=>s.id===service.id);const data=selection.services.find(s=>s.serviceId===service.id)||{};
      const endpoint=role=>data[role]||data[role+'Airport']||template?.[role]?.airportCode||(template?.[role]?.kind==='venue'?eventVenue(event):t('unknown'));
      const values=option.calculationModel==='ordinary_services'&&template?.ordinary?Object.fromEntries(Object.entries(template.ordinary.inputs).map(([key,input])=>[key,input.source==='fixed'?(input.redacted?t('ordinaryFixed'):input.value):input.source==='customer'?data.ordinaryInputs?.[key]:undefined])):{...data,from:endpoint('from'),to:endpoint('to')};
      const airport=value=>window.PixkuyAirportTariffCatalog?.resolveDisplayLabel('airport',String(value).toLowerCase())||displayOrdinaryValue('airportId',value);
      const route=values.airportId?(values.direction==='destination_to_airport'?[values.destination,airport(values.airportId)]:[airport(values.airportId),values.destination]):[values.origin||values.from,values.destination||values.to].map((value,i)=>value&&template?.[i?'to':'from']?.kind==='airport'?airport(value):value);
      const count=state.quote?.calculation?.serviceLines?.find(line=>line.serviceId===service.id)?.baggage?.count??data.ordinaryInputs?.baggageCount;
      return '<li><strong>'+esc(t('services'))+' '+(index+1)+'</strong><span>'+esc(localServiceDate(service.startLocal||[values.date,values.time].filter(Boolean).join('T')))+'</span><span>'+route.filter(Boolean).map(value=>esc(typeof value==='object'?value.address||t('ordinaryFixed'):value)).join(' → ')+'</span>'+(values.flight?'<span>'+esc(t('flight'))+': '+esc(values.flight)+'</span>':'')+(count!==undefined?'<span>'+esc(t('baggageCount'))+': '+esc(count)+'</span>':'')+'</li>';
    }).join('')+'</ol>'+button('edit-services',t(option.services.length===1?'editTransfer':'editTransfers'),false,'quiet')+'</section>';
  }
  function mobileReviewContact(state){
    const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';
    const contact=state.contact||{};
    const phoneLabel=i18nText('airportMobileContactStep.fields.phone',t('phone'));
    const phonePlaceholder=i18nText('airportMobileContactStep.placeholders.phone','');
    return '<section class="events-package-mobile-contact" data-package-mobile-contact>'
      +'<header class="events-package-config__header events-package-mobile-contact__header">'+button('back',t('back'),locked,'quiet')+'<h3 tabindex="-1" data-package-heading>'+esc(eventTitle(state.selectedEvent))+'</h3></header>'
      +navigation(state,'mobile')
      +'<h3 class="events-package-mobile-contact__title">'+esc(t('reviewContact'))+'</h3>'
      +reviewItinerary(state)+summary(state,'mobile-review')+'<form data-package-mobile-contact-form novalidate>'
      +'<fieldset class="events-package-mobile-contact__fields"'+(locked?' disabled':'')+'><legend>'+esc(t('reviewContact'))+'</legend>'
      +contactField('name',t('name'),contact.name,'text','required minlength="2" maxlength="180" autocomplete="name"')
      +contactField('phone',phoneLabel,contact.phone,'tel','required autocomplete="tel" inputmode="tel" autocapitalize="off" spellcheck="false" placeholder="'+esc(phonePlaceholder)+'"','airportMobileContactStep.validation.phone')
      +contactField('email',t('email'),contact.email,'email','required maxlength="254" autocomplete="email" inputmode="email"')
      +'</fieldset><p class="events-package-mobile-contact__notice">'+esc(t('notBooking'))+'</p>'
      +'<div class="events-package-mobile-contact__actions"><button type="submit" class="events-package-button events-package-button--primary" data-package-action="submit"'+(locked||!airportCanReview(state)?' disabled aria-disabled="true"':'')+'>'+esc(state.requestStatus==='submitting'?t('sending'):t('submit'))+'</button></div></form></section>';
  }
  // This view is capability-bound; other service models keep their existing calculation controls.
  function configuredAirportOption(state){
    if(state.step!=='services'||state.screen!=='config'||state.selection?.requestKind!=='package')return null;
    const pkg=state.selectedEvent?.snapshot.packages.find(p=>p.id===state.selection.packageId);
    const option=pkg?.options.find(o=>o.id===state.selection.optionId);
    const service=option?.services.length===1&&option.services[0];
    const binding=service?.ordinary;
    if(option?.calculationModel!=='ordinary_services'||binding?.baseService!=='airport_transfer'||binding.inputs.direction?.source!=='fixed'||!['airport_to_destination','destination_to_airport'].includes(binding.inputs.direction.value))return null;
    if(state.selectedEvent.snapshot.addOns.some(a=>a.packageId===pkg.id&&a.optionIds.includes(option.id)&&a.kind!=='airport_leg_supplement'&&a.serviceIds.includes(service.id)))return null;
    return {pkg,option,service,arrival:binding.inputs.direction.value==='airport_to_destination'};
  }
  function airportConfiguredView(state,surface,mobile){
    const mobileViewport=window.matchMedia?.('(max-width:720px)').matches;
    if(mobile?(surface!=='mobile'||!mobileViewport):(!['desktop','contact'].includes(surface)||mobileViewport))return null;
    return configuredAirportOption(state);
  }
  function airportDesktop(state,surface){return airportConfiguredView(state,surface,false);}
  function airportAutoQuoteView(state,surface){return airportConfiguredView(state,surface,surface==='mobile');}
  function airportCanReview(state){return state.quoteStatus==='ready'&&!!state.quote&&state.quote.calculation.coverageStatus!=='outside'&&!(state.quote.calculation.serviceLines||[]).some(line=>line.included?.quoteExpiresAt&&Date.parse(line.included.quoteExpiresAt)<=Date.now());}
  function airportSelector(service,data,prefix,label,mobile){
    const binding=service.ordinary;
    const catalog=window.PixkuyAirportTariffCatalog;
    if(binding.inputs.airportId?.source!=='customer'||!catalog||!window.PixkuyAirportTariffDropdowns)return ordinaryInput(service,data,prefix,'airportId','',{label});
    const allowed=binding.restrictions?.airportIds;
    const options=catalog.getActiveItemsByType('airport').filter(item=>ordinaryChoices.airportId.some(([id])=>id===item.id)&&(!allowed||allowed.includes(item.id))).map(item=>({id:item.id,label:catalog.resolveItemLabel(item)||item.iata}));
    const value=data.ordinaryInputs?.airportId||'';
    if(mobile){
      const id='package-mobile-airport-'+service.id;
      return '<div class="events-package-field services-expand__field" data-package-airport><span class="services-expand__label" id="'+esc(id)+'">'+esc(t(label))+'</span><select hidden aria-hidden="true" tabindex="-1" data-package-field="'+esc(prefix+'ordinary-airportId')+'">'+optionHtml('',t('choose'),!value)+options.map(o=>optionHtml(o.id,o.label,o.id===value)).join('')+'</select><div class="services-expand__airport-shell"><button type="button" class="services-expand__control services-expand__control--select" aria-labelledby="'+esc(id)+'" aria-haspopup="dialog" aria-expanded="false"><span data-package-airport-value>'+esc(options.find(o=>o.id===value)?.label||t('choose'))+'</span></button></div></div>';
    }
    return '<div class="events-package-field services-expand__field" data-package-airport><span class="services-expand__label" id="package-airport-label">'+esc(t(label))+'</span>'
      +'<select hidden aria-hidden="true" tabindex="-1" data-package-field="'+esc(prefix+'ordinary-airportId')+'">'+optionHtml('',t('choose'),!value)+options.map(o=>optionHtml(o.id,o.label,o.id===value)).join('')+'</select>'
      +'<div class="services-expand__airport-shell"><button type="button" class="services-expand__control services-expand__control--select" aria-labelledby="package-airport-label package-airport-value" aria-haspopup="listbox" aria-expanded="false"><span id="package-airport-value">'+esc(options.find(o=>o.id===value)?.label||t('choose'))+'</span></button></div></div>';
  }
  function mountAirportSelector(root){
    if(root.getAttribute('data-event-package-root')==='mobile'){
      const api=window.PixkuyAirportMobileBookingFlow;
      if(!api?.openAirportPicker)return;
      const route=root.closest('.events-mobile-route');if(!route)return;
      root.closePackageAirport=target=>{if(target&&(target.closest?.('[data-airport-mobile-airport-picker]')||target.closest?.('[data-package-airport]')))return;api.closeAirportPicker(route);};
      root.querySelectorAll('[data-package-airport]').forEach(host=>{
        const control=host.querySelector('button'),select=host.querySelector('select');
        const allowedIds=Array.from(select.options).map(o=>o.value).filter(Boolean);
        control.addEventListener('click',()=>api.openAirportPicker({host:route,trigger:control,selectedId:select.value,allowedIds,onSelect:id=>{
          if(!allowedIds.includes(id)||!root.contains(host))return false;
          select.value=id;changeField(select,true);host.querySelector('[data-package-airport-value]').textContent=select.selectedOptions[0].textContent;return true;
        }}));
      });
      return;
    }
    const api=window.PixkuyAirportTariffDropdowns;
    root.closePackageAirport?.();
    root.closePackageAirport=null;
    if(!api)return;
    const host=root.querySelector('[data-package-airport]');
    if(!host)return;
    const control=host.querySelector('button'),select=host.querySelector('select');
    const panel=api.createDropdownPanel('package-service');host.appendChild(panel);
    const options=Array.from(select.options).filter(o=>o.value).map(o=>({id:o.value,label:o.textContent,type:'airport'}));
    let activeIndex=-1;
    const close=()=>api.closeDropdown({panel,control});
    const open=()=>{activeIndex=api.renderDropdown({panel,control,role:'package-service',options,selectedIndex:options.findIndex(o=>o.id===select.value)}).activeIndex;api.openDropdown({panel,control});};
    const commit=index=>{if(!options[index])return;select.value=options[index].id;close();changeField(select);root.querySelector('[data-package-airport] button')?.focus();};
    control.addEventListener('click',()=>{if(panel.hidden)open();else close();});
    control.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(panel.hidden){open();return;}activeIndex=api.moveActiveIndex({panel,control,currentIndex:activeIndex,direction:event.key==='Home'?-options.length:event.key==='End'?options.length:event.key==='ArrowDown'?1:-1}).activeIndex;}
      else if(event.key==='Escape'){event.preventDefault();close();}
      else if(event.key==='Tab')close();
      else if((event.key==='Enter'||event.key===' ')&&!panel.hidden){event.preventDefault();commit(activeIndex);}
    });
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();control.focus();}});
    panel.addEventListener('click',event=>{const option=event.target.closest('[data-airport-tariff-option-index]');if(option)commit(Number(option.dataset.airportTariffOptionIndex));});
    root.closePackageAirport=target=>{if(!target||!host.contains(target))close();};
  }
  function airportConditions(event,pkg){
    return '<section class="events-package-airport__conditions services-hourly-panel__disclaimer-group"><h4 class="services-hourly-panel__disclaimer-title">'+esc(t('conditions'))+'</h4><ul class="services-hourly-panel__disclaimers">'
      +[...(event.snapshot.conditions||[]),...(pkg.conditions||[])].map(c=>'<li><strong>'+esc(local(c.title))+'</strong> '+esc(local(c.description))+'</li>').join('')+'</ul></section>';
  }
  function airportPrice(state,view){
    const calculation=state.quoteStatus==='ready'?state.quote?.calculation:null;
    const price=calculation?.priceBreakdown;
    const quoted=price?.priceStatus==='quoted'&&price.pricedSubtotal!==null&&calculation.coverageStatus!=='outside';
    const readiness=airportQuoteReadiness(state,view);
    const text=state.quoteStatus==='loading'?t('transferCalculating'):state.quoteStatus==='error'?t('error'):calculation?.coverageStatus==='outside'?t('ordinaryOutside'):quoted?money(price.pricedSubtotal,price.currency):calculation?t('pending'):readiness.invalid.length?t('invalidForQuote',{fields:readiness.invalid.join(', ')}):readiness.missing.length?t('missingForQuote',{fields:readiness.missing.join(', ')}):t('automaticQuotePending');
    return '<span class="services-expand__label">'+esc(t('transferPrice'))+'</span><strong class="events-package-airport__price'+(quoted?' is-quoted':'')+'">'+esc(text)+'</strong>';
  }
  function airportActions(state){
    const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';
    const retry=state.quoteStatus==='error'?button('retry-quote',t('retryCalculation'),locked,'secondary'):'';
    return button('packages',t('backToPackages'),locked,'secondary')+retry+button('airport-review',state.quoteStatus==='loading'?t('transferCalculating'):t('continueContact'),locked||state.quoteStatus==='loading'||!airportCanReview(state),'primary');
  }
  function airportConfiguration(state,view,locked){
    const {pkg,option,service,arrival}=view;
    const data=state.selection.services.find(s=>s.serviceId===service.id)||{};
    const prefix='service:'+service.id+':';
    const input=(key,label,presentation)=>ordinaryInput(service,data,prefix,key,'',{label,...presentation});
    const airport=airportSelector(service,data,prefix,arrival?'arrivalAirport':'departureAirport');
    let address=input('destination',arrival?'arrivalAddress':'departureAddress');
    if(service.ordinary.inputs.destination?.source==='customer')address=address.replace('<span data-package-address-mount>','<button type="button" class="place-autocomplete__clear" data-package-address-clear aria-label="'+esc(t(arrival?'clearDestination':'clearPickup'))+'"'+(data.ordinaryInputs?.destination?.address?'':' hidden')+'><span aria-hidden="true">×</span></button><span data-package-address-mount>');
    return '<section class="events-package-airport"><h3>'+esc(t('configureTransferTitle'))+'</h3><p class="events-package-airport__selection">'+esc(local(pkg.title))+' · '+esc(local(option.title))+'</p>'
      +'<fieldset class="events-package-airport__form" aria-label="'+esc(t('services'))+'"'+(locked?' disabled':'')+'>'
      +'<div class="events-package-airport__route">'+(arrival?airport+address:address+airport)+'<div class="events-package-airport__fare" data-airport-price role="status" aria-live="polite" aria-atomic="true">'+airportPrice(state,view)+'</div></div>'
      +'<div class="events-package-airport__schedule">'+passengerField(state.selection)+input('date','transferDate')+input('time',arrival?'transferStartTime':'transferPickupTime')+'</div>'
      +'<p class="events-package-airport__timezone">'+esc(t('transferLocalTime'))+'</p>'
      +'<div class="events-package-airport__extras">'+input('flight','transferFlight',{optional:true})+(service.ordinary.inputs.flight?.source==='customer'?'<p class="events-package-help">'+esc(t('flightOptionalHelp'))+'</p>':'')+baggageField(service,data,prefix)+'</div></fieldset>'
      +airportConditions(state.selectedEvent,pkg)
      +'<div class="events-package-airport__actions" data-airport-actions>'+airportActions(state)+'</div></section>';
  }
  function cancelAirportAutoQuote(root){
    if(root&&airportQuoteTimerRoot!==root)return;
    if(airportQuoteTimer!==null)window.clearTimeout(airportQuoteTimer);
    airportQuoteTimer=null;airportQuoteTimerRoot=null;airportQuoteTimerSignature='';
  }
  function airportQuoteSignature(state){return JSON.stringify(state.selection);}
  async function runAirportAutoQuote(root,signature){
    airportQuoteTimer=null;airportQuoteTimerRoot=null;airportQuoteTimerSignature='';
    const view=airportAutoQuoteView(C.state,root.getAttribute('data-event-package-root'));
    if(!view||airportQuoteSignature(C.state)!==signature||!airportQuoteReadiness(C.state,view).ready||C.state.quoteStatus!=='idle'||C.state.quote)return;
    airportQuoteAttemptedSignature=signature;
    const selection=C.state.selection,step=C.state.step,screen=C.state.screen;
    const pending=C.quote({silent:true});refreshAirportQuote();
    const completed=await pending;
    if(!completed||C.state.selection!==selection||C.state.step!==step||C.state.screen!==screen){if(airportQuoteAttemptedSignature===signature)airportQuoteAttemptedSignature='';scheduleAirportAutoQuote(root);return;}
    if(C.state.quoteStatus!=='error')airportQuoteAttemptedSignature='';
    refreshAirportQuote();
  }
  function scheduleAirportAutoQuote(root,delay=AUTO_QUOTE_DELAY_MS){
    if(!isRootInteractive(root)){cancelAirportAutoQuote(root);return;}
    const view=airportAutoQuoteView(C.state,root.getAttribute('data-event-package-root'));
    if(!view){cancelAirportAutoQuote(root);return;}
    const signature=airportQuoteSignature(C.state),readiness=airportQuoteReadiness(C.state,view);
    if(!readiness.ready||C.state.quoteStatus!=='idle'||C.state.quote||signature===airportQuoteAttemptedSignature){cancelAirportAutoQuote(root);return;}
    if(airportQuoteTimer!==null&&airportQuoteTimerSignature===signature)return;
    cancelAirportAutoQuote();airportQuoteTimerRoot=root;airportQuoteTimerSignature=signature;
    airportQuoteTimer=window.setTimeout(()=>{void runAirportAutoQuote(root,signature);},delay);
  }
  function refreshAirportQuote(){
    // Silent typing must invalidate the visible price without remounting Places or stealing focus.
    roots.forEach(root=>{
      if(!isRootInteractive(root))return;
      if(root.getAttribute('data-event-package-root')==='mobile'&&C.state.step==='services'){
        const area=root.querySelector('.events-package-layout__actions');
        const pkg=C.state.selectedEvent?.snapshot.packages.find(item=>item.id===C.state.selection?.packageId);
        const option=pkg?.options.find(item=>item.id===C.state.selection?.optionId);
        if(area)area.innerHTML=mobileCalculationContent(C.state,option,window.PixkuyEventPackagesRequest.hasFrozenBody());
      }
      const price=root.querySelector('[data-airport-price]'),actions=root.querySelector('[data-airport-actions]');
      const view=airportDesktop(C.state,root.getAttribute('data-event-package-root'));
      if(price&&view)price.innerHTML=airportPrice(C.state,view);
      if(actions)actions.innerHTML=airportActions(C.state);
      if(['desktop','mobile'].includes(root.getAttribute('data-event-package-root')))scheduleAirportAutoQuote(root);
    });
  }
  function configuration(state,surface){
    const selection=state.selection;
    const event=state.selectedEvent;
    if(!selection||!event)return catalog(state);
    const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';
    const title=eventTitle(event);
    const isPackageStep=selection.requestKind==='package'&&state.step==='package';
    const header=surface==='contact'?'<header class="events-package-config__header"><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3></header>'+navigation(state,surface):(isPackageStep||surface==='mobile')?'<header class="events-package-config__header events-package-config__header--package">'+button('back',t(isPackageStep?'backToEvents':'back'),locked,'quiet')+'<div class="events-package-event-heading"><div><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3>'+eventMetadata(event,true)+'</div>'+((surface!=='mobile'&&event.snapshot.customInquiryEnabled)?button('ordinary-custom',t('customLink'),locked,'quiet'):'')+'</div></header>'+navigation(state,surface):'<header class="events-package-config__header">'+button('back',t('back'),locked,'quiet')+'<div><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3>'+eventMetadata(event)+'</div>'+((surface!=='mobile'&&event.snapshot.customInquiryEnabled&&selection.requestKind==='package')?button('ordinary-custom',t('customLink'),locked,'quiet'):'')+'</header>'+navigation(state,surface);
    if(isPackageStep)return '<div class="events-package-step-one">'+header+'<h3 class="events-package-offer-heading">'+esc(t('choosePackage'))+'</h3>'+offer(state,surface)+'</div>';
    const airportView=airportDesktop(state,surface);
    if(airportView)return header+airportConfiguration(state,airportView,locked);
    let mobileOption=null;
    let form='<fieldset class="events-package-primary-form'+(surface==='mobile'&&selection.requestKind==='package'?' events-package-primary-form--trip':'')+'"'+(locked?' disabled':'')+'><legend>'+esc(selection.requestKind==='custom'?t('customLink'):t('services'))+'</legend>';

    if(selection.requestKind==='custom'){
      const inquiry=selection.inquiry;
      form+='<div class="events-package-fields-grid">'
        +'<label class="events-package-field"><span>'+esc(t('reason'))+'</span><select data-package-field="reason">'+['companies_groups','multiple_vehicles','special_itinerary','extra_stops','excursion','coverage_review','baggage_review','other'].map(reason=>optionHtml(reason,t('reason_'+reason),reason===inquiry.reasonCode)).join('')+'</select></label>'
        +'<label class="events-package-field events-package-field--wide"><span>'+esc(t('description'))+'</span><textarea data-package-field="inquiryNotes" minlength="10" maxlength="2000" required>'+esc(inquiry.notes)+'</textarea><span>'+esc(t('customNotesHelp'))+'</span></label>'
        +'<label class="events-package-check events-package-field--wide"><input type="checkbox" data-package-field="passengersKnown"'+(inquiry.passengers.status==='known'?' checked':'')+'><span>'+esc(t('knownPassengers'))+'</span></label>'
        +(inquiry.passengers.status==='known'?field('customPassengers',t('passengers'),inquiry.passengers.count,'number','min="1" max="10000"'):'')
        +[['MULTIPLE_VEHICLES','reason_multiple_vehicles'],['EXTRA_STOPS','reason_extra_stops'],['EXCURSION','reason_excursion'],['SPECIAL_REQUIREMENTS','specialNeeds']].map(([flag,label])=>'<label class="events-package-check"><input type="checkbox" data-package-field="need:'+flag+'"'+(inquiry.needsFlags.includes(flag)?' checked':'')+'><span>'+esc(t(label))+'</span></label>').join('')
        +'</div>';
    }else{
      const packages=activePackages(event);
      const pkg=packages.find(p=>p.id===selection.packageId);
      const option=pkg?.options.find(o=>o.id===selection.optionId);
      mobileOption=option||null;
      form+='<p><strong>'+esc(local(pkg?.title))+' · '+esc(local(option?.title))+'</strong></p>';
      if(option){
        const mobileRecognized=surface==='mobile'&&option.calculationModel==='ordinary_services'&&option.services.every(mobileBaseRecognized);
        form+=(mobileRecognized?'':passengerField(selection))+(surface==='mobile'?'<button type="button" class="events-package-offer__details-trigger" data-package-action="details" data-package-details="'+esc(pkg.id)+'" data-package-conditions-only aria-haspopup="dialog">'+esc(t('conditions'))+'</button>':conditionsHtml(event,pkg));
        if(option.calculationModel!=='ordinary_services'&&option.coverage){const coverage=option.coverage;form+='<details class="events-package-option-copy"><summary>'+esc(t('reason_coverage_review'))+'</summary><p>'+esc([...(coverage.allowedAirports||[]),...(coverage.nonAirportCoverage?.administrativeAreas||[]),...(coverage.dedicatedPerimeter?.administrativeAreas||[])].join(' · '))+'</p></details>';}
        const extraIds=new Set(event.snapshot.addOns.filter(a=>a.packageId===pkg.id&&a.optionIds.includes(option.id)&&a.kind!=='airport_leg_supplement').flatMap(a=>a.serviceIds));
        form+='<div class="events-package-services">';
        const orderedServices=option.services.slice().sort((a,b)=>{const date=s=>(option.calculationModel==='ordinary_services'?s.ordinary?.inputs.date?.value:'')||(event.snapshot.days||[]).find(d=>d.id===s.dayId)?.date||s.startLocal||'';return date(a).localeCompare(date(b));});
        orderedServices.forEach((service,index)=>{
          const data=selection.services.find(s=>s.serviceId===service.id)||{};
          const prefix='service:'+service.id+':';
          const extra=extraIds.has(service.id);
          const direction=service.ordinary?.inputs.direction?.value||data.ordinaryInputs?.direction;
          const serviceTitle=option.calculationModel!=='ordinary_services'?t('services')+' '+(index+1):service.ordinary?.baseService==='airport_transfer'?(direction==='destination_to_airport'?t('ordinaryDeparture'):direction==='airport_to_destination'?t('ordinaryArrival'):t('airport')):service.ordinary?.baseService==='direct_transfer'?sharedEventText(['services','cards','direct','title'],'Direct Transfer'):service.ordinary?.baseService==='hourly_daily'?t('ordinaryHourly'):t('services')+' '+(index+1);
          const day=(event.snapshot.days||[]).find(d=>d.id===service.dayId);
          const subtitle=surface==='mobile'?mobileServiceSubtitle(service,data,day):[day&&local(day.title),day?.date,data.ordinaryInputs?.date,data.ordinaryInputs?.time,data.startLocal].filter(Boolean).join(' · ');
          const mobileTitle=(option.services.length>1?(index+1)+'. ':'')+serviceTitle;
          const mobileService=surface==='mobile'&&option.calculationModel==='ordinary_services'&&mobileBaseRecognized(service);
          form+=(mobileService?'<section class="events-package-service-open events-package-service-open--'+esc(service.ordinary.baseService)+'" data-package-service="'+esc(service.id)+'">'+(option.services.length>1?'<h4>'+esc(mobileTitle)+'</h4>':''):'<details class="events-package-service-disclosure" data-package-service="'+esc(service.id)+'"'+(option.services.length===1||state.expandedServiceIds?.includes(service.id)?' open':'')+'><summary'+(surface==='mobile'?' data-package-service-title="'+esc(mobileTitle)+'"':'')+'>'+esc(surface==='mobile'?mobileTitle:serviceTitle)+(subtitle?' · '+esc(subtitle):'')+'</summary>')+'<fieldset class="events-package-service"><legend>'+esc(serviceTitle)+'</legend>';
          if(extra){const addOn=event.snapshot.addOns.find(a=>a.packageId===pkg.id&&a.optionIds.includes(option.id)&&a.kind!=='airport_leg_supplement'&&a.serviceIds.includes(service.id));form+='<label class="events-package-check"><input type="checkbox" data-package-field="'+prefix+'additional"'+(selection.additionalServiceIds.includes(service.id)?' checked':'')+'><span>'+esc(local(addOn?.title)||t('additional'))+'</span></label>';}
          if(!extra||selection.additionalServiceIds.includes(service.id)){
            if(option.calculationModel==='ordinary_services'){
              const firstIncluded=orderedServices.findIndex(s=>!extraIds.has(s.id)||selection.additionalServiceIds.includes(s.id));
              form+=ordinaryInputs(service,data,prefix,state,mobileRecognized&&index===firstIncluded,surface)+lodgingReuse(state,service)+'</fieldset>'+(mobileService?'</section>':'</details>');
              return;
            }
            const bounds=serviceBounds(service);
            form+='<div class="events-package-fields-grid">'+(service.startLocal?'<div class="events-package-fixed"><span>'+esc(t('date'))+'</span><strong>'+esc(service.startLocal)+'</strong></div>':field(prefix+'startLocal',t('date'),data.startLocal||'','datetime-local',(service.allowDeferredTime?'':'required ')+(bounds.min?'min="'+esc(bounds.min)+'" ':'')+(bounds.max?'max="'+esc(bounds.max)+'"':'')));
            if(service.allowDeferredTime&&!service.startLocal)form+='<p class="events-package-help">'+esc(t('ordinaryDeferred'))+'</p>';
            if(service.durationHours)form+='<p>'+esc(t('ordinaryDuration'))+': '+service.durationHours+'</p>';
            ['from','to'].forEach(role=>{
              const endpoint=service[role];
              if(endpoint.kind==='airport'){
                form+=endpoint.airportCode?'<div class="events-package-fixed"><span>'+esc(t('airport'))+'</span><strong>'+esc(endpoint.airportCode)+'</strong></div>':'<label class="events-package-field"><span>'+esc(t(role==='from'?'origin':'destination')+' · '+t('airport'))+'</span><select data-package-field="'+prefix+role+'Airport">'+optionHtml('',t('choose'),false)+(option.coverage?.allowedAirports||[]).map(code=>optionHtml(code,code,code===data[role+'Airport'])).join('')+'</select></label>';
              }else if(endpoint.kind==='lodging_or_address'){
                form+=addressField(prefix+role+'Address',t(role==='from'?'origin':'destination')+' · '+t('address'),data[role]);
              }else{
                form+='<div class="events-package-fixed"><span>'+esc(t(role==='from'?'origin':'destination'))+'</span><strong>'+esc(event.snapshot.venue?.baseName||t('pending'))+'</strong></div>';
              }
            });
            form+='<label class="events-package-field"><span>'+esc(t('baggage'))+'</span><select data-package-field="'+prefix+'baggage">'+optionHtml('',t('choose'),!data.baggage)+['unknown','none','declared'].map(value=>optionHtml(value,t(value),data.baggage?.status===value)).join('')+'</select></label>';
            if(data.baggage?.status==='declared'){
              (option.baggagePolicy?.categories||[]).forEach(category=>{
                form+=field(prefix+'bag-'+category.id,local(category.title),data.baggage.items.find(item=>item.categoryId===category.id)?.count||0,'number','min="0" max="100"');
              });
            }
            form+='<label class="events-package-check events-package-field--wide"><input type="checkbox" data-package-field="'+prefix+'specialNeeds"'+(data.baggage?.specialRequirementsPresent?' checked':'')+'><span>'+esc(t('specialNeeds'))+'</span></label>'
              +field(prefix+'flight',t('flight'),data.flight||'','text','maxlength="2000"')
              +field(prefix+'notes',t('notes'),data.notes||'','text','maxlength="2000"')
              +'</div>';
          }
          form+='</fieldset>'+(mobileService?'</section>':'</details>');
        });
        form+='</div>';
      }
    }
    form+='</fieldset>';

    const actions=surface==='mobile'&&state.step==='services'?mobileCalculationContent(state,mobileOption,locked):calculationControls(state,locked);
    return header+'<div class="events-package-layout"><div class="events-package-layout__main">'+form+'</div><div class="events-package-layout__actions">'+actions+'</div></div>';
  }
  function calculationControls(state,locked,hideReview){
    const event=state.selectedEvent;
    const outside=state.quote?.calculation?.coverageStatus==='outside';
    let actions='<div class="events-package-calculation-actions">'+button('quote',state.quoteStatus==='loading'?t('loading'):t('calculatePrice'),locked||state.quoteStatus==='loading','primary')+(!hideReview&&airportCanReview(state)?button('contact',t('continueContact'),locked,'primary'):'')+'</div>';
    if(outside){actions+='<p class="events-package-alert" role="alert">'+esc(t('ordinaryOutside'))+'</p>';if(event.snapshot.customInquiryEnabled)actions+=button('ordinary-custom',t('custom'),locked,'secondary');}
    return actions;
  }
  function mobileServiceSubtitle(service,data,day){
    // Only a fixed date or a customer choice describes the itinerary; a day label is not another date.
    const value=service.ordinary?.inputs.date?.value||data.ordinaryInputs?.date||service.startLocal||data.startLocal||day?.date;
    const date=localDate(String(value||'').slice(0,10));
    const time=service.ordinary?.inputs.time?.value||data.ordinaryInputs?.time||String(service.startLocal||data.startLocal||'').slice(11,16);
    return date?new Intl.DateTimeFormat(locale(),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date)+(/^([01]\d|2[0-3]):[0-5]\d$/.test(time)?' · '+time:''):'';
  }
  function lodgingCandidate(state,service){
    if(service.ordinary?.baseService!=='airport_transfer'||service.ordinary.inputs.destination?.source!=='customer')return null;
    const selection=state.selection;
    const option=state.selectedEvent.snapshot.packages.find(p=>p.id===selection.packageId)?.options.find(o=>o.id===selection.optionId);
    return selection.services.find(data=>data.serviceId!==service.id&&data.ordinaryInputs?.destination?.address&&option?.services.some(s=>s.id===data.serviceId&&s.ordinary?.baseService==='airport_transfer'&&s.ordinary.inputs.destination?.source==='customer'))||null;
  }
  function lodgingReuse(state,service){
    const candidate=lodgingCandidate(state,service);if(!candidate)return '';
    return '<button type="button" class="events-package-button events-package-button--quiet" data-package-reuse="'+esc(service.id)+'">'+esc(t('reuseLodging'))+': '+esc(candidate.ordinaryInputs.destination.address)+'</button>';
  }
  function mountClearableAddress(root,host,adapter){
    const name=host.getAttribute('data-package-address'),clear=host.querySelector('[data-package-address-clear]'),error=host.querySelector('[data-package-address-error]');
    const capturedSelection=C.state.selection,capturedOption=capturedSelection?.optionId;
    let input=host.querySelector('input'),controller=null,generation=0;
    const currentDestination=()=>{const [,id]=name.split(':');return C.state.selection?.services.find(service=>service.serviceId===id)?.ordinaryInputs?.destination;};
    const showError=message=>{if(!error)return;error.textContent=message||'';error.hidden=!message;};
    const sync=preserveCanonical=>{
      clear.hidden=!input.value;showError('');
      const selected=currentDestination();
      if(preserveCanonical&&selected?.placeId&&selected.address===input.value)return;
      changeField(input,true);
    };
    function bind(){
      const currentInput=input,currentGeneration=generation;
      const current=()=>isRootInteractive(root)&&generation===currentGeneration&&C.state.selection===capturedSelection&&C.state.selection?.optionId===capturedOption&&root.contains(host);
      input.addEventListener('input',()=>{if(current())sync(false);});
      input.addEventListener('change',event=>{event.stopPropagation();if(current())sync(true);});
      input.addEventListener('focus',()=>{
        controller=adapter.mount({root:host,input:currentInput,mountNode:host.querySelector('[data-package-address-mount]'),fieldName:name,language:locale(),
          onManualInput:()=>{if(current())sync(false);},
          onClearSelection:()=>{if(current()){currentInput.value='';sync(false);}},
          onPlaceSelected:place=>{
            if(!current())return;
            showError('');
            const [,id]=name.split(':');
            const address=place?.label||place?.formattedAddress||place?.displayName||'',placeId=place?.placeId||place?.id;
            if(!address||!placeId){sync(false);showError(t('placeDetailsError'));return;}
            C.change(selection=>{let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}data.ordinaryInputs=data.ordinaryInputs||{};data.ordinaryInputs.destination={address,placeId};});
          },
          onError:()=>{if(current())showError(t('placeDetailsError'));}});
        if(controller)root.packageAddresses.push(controller);
      },{once:true});
    }
    clear.addEventListener('pointerdown',event=>event.preventDefault());
    clear.addEventListener('click',event=>{
      event.preventDefault();
      generation++;
      // The shared adapter cannot cancel an in-flight details request. Retire only
      // its input/mount so a late provider write targets detached nodes, never the new search.
      controller?.destroy();
      root.packageAddresses=root.packageAddresses.filter(item=>item!==controller);controller=null;
      const next=input.cloneNode(true);next.value='';input.replaceWith(next);input=next;
      const mount=host.querySelector('[data-package-address-mount]');mount.replaceWith(mount.cloneNode(false));
      bind();sync(false);input.focus();
    });
    bind();
  }
  function mountAddresses(root){
    root.packageAddresses=[];
    const adapter=window.PixkuyServicesEventsSpecialAddress;
    if(!adapter)return;
    root.querySelectorAll('[data-package-address]').forEach(host=>{
      if(host.querySelector('[data-package-address-clear]')){mountClearableAddress(root,host,adapter);return;}
      const name=host.getAttribute('data-package-address'),input=host.querySelector('input');
      const capturedSelection=C.state.selection,capturedOption=capturedSelection?.optionId;
      const showError=message=>{const error=host.querySelector('[data-package-address-error]');if(error){error.textContent=message||'';error.hidden=!message;}};
      const commit=place=>{
        if(!isRootInteractive(root)||C.state.selection!==capturedSelection||capturedSelection?.optionId!==capturedOption)return;
        const address=place?.label||place?.formattedAddress||'';const placeId=place?.placeId||place?.id;
        if(!address||!placeId){window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));showError(t('placeDetailsError'));return;}
        showError('');window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));
        const [,id,fieldName]=name.split(':');
        C.change(selection=>{let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}const value={address,placeId};if(fieldName.startsWith('ordinary-')){data.ordinaryInputs=data.ordinaryInputs||{};data.ordinaryInputs[fieldName.slice(9)]=value;}else data[fieldName==='fromAddress'?'from':'to']=value;});
      };
      const sheet=window.PixkuyAirportMobileHotelSearchSheet;
      if(sheet&&input.hasAttribute('data-package-mobile-address-input')){
        input.readOnly=true;input.setAttribute('aria-haspopup','dialog');
        if(input.hasAttribute('data-package-mobile-lodging-input'))input.placeholder=document.querySelector('#services-expand-airport [data-airport-lodging-input]')?.getAttribute('placeholder')||'';
        const clear=host.querySelector('[data-package-mobile-address-clear]');
        if(clear)clear.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          sheet.closeForField(root.closest('.events-mobile-route'));
          const [,id,fieldName]=name.split(':');
          input.value='';
          C.change(selection=>{const current=selection.services.find(service=>service.serviceId===id);if(!current)return;if(fieldName.startsWith('ordinary-'))delete current.ordinaryInputs?.[fieldName.slice(9)];else delete current[fieldName==='fromAddress'?'from':'to'];});
        });
        const open=()=>{
          showError('');
          sheet.openForField({
            host:root.closest('.events-mobile-route'),trigger:input,value:input.value,
            mount:(search,list)=>adapter.mount({root:list.parentElement,input:search,mountNode:list,fieldName:name,language:locale(),onManualInput:()=>{},onPlaceSelected:commit,onClearSelection:()=>{},onError:()=>{sheet.closeForField(root.closest('.events-mobile-route'));showError(t('placeDetailsError'));}})
          });
        };
        input.addEventListener('click',open);
        input.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
        return;
      }
      input.addEventListener('focus',()=>{
        const controller=adapter.mount({root:host,input,mountNode:host.querySelector('[data-package-address-mount]'),fieldName:name,language:locale(),onManualInput:()=>changeField(input,true),onPlaceSelected:commit,onClearSelection:()=>{input.value='';changeField(input,true);}});
        if(controller)root.packageAddresses.push(controller);
      },{once:true});
    });
  }
  function focusDetail(root){
    const target=root.querySelector('[data-package-heading]');
    if(!target)return;
    target.focus({preventScroll:true});
    if(root.getAttribute('data-event-package-root')==='mobile'){
      const route=root.closest('.events-mobile-route');
      if(route)route.scrollTop=0;
    }else target.scrollIntoView({block:'nearest'});
  }
  function settleMobileReceipt(root,receivedTransition){
    if(!receivedTransition)return;
    const route=root.closest?.('.events-mobile-route');
    const heading=root.querySelector?.('[data-package-confirmation-title]');
    if(!route||!heading)return;
    const settle=()=>{
      route.scrollTop=0;
      heading.focus?.({preventScroll:true});
    };
    if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(settle);
    else Promise.resolve().then(settle);
  }
  function validateField(root,input,index){
    if(input.hasAttribute?.('data-package-canonical-phone'))return true;
    if(input.disabled||typeof input.checkValidity!=='function')return true;
    const valid=input.checkValidity(),container=input.closest?.('label')||input.parentElement;input.setAttribute('aria-invalid',String(!valid));
    let error=container?.querySelector('[data-package-field-error]');const description=input.getAttribute?.('data-package-description')||'';
    if(!valid){if(!error){error=document.createElement('span');error.setAttribute('data-package-field-error','');error.setAttribute('role','alert');container?.appendChild(error);}error.id='package-error-'+root.getAttribute('data-event-package-root')+'-'+index;error.textContent=input.validationMessage;input.setAttribute('aria-describedby',[description,error.id].filter(Boolean).join(' '));}
    else{if(error)error.remove();if(description)input.setAttribute('aria-describedby',description);else input.removeAttribute('aria-describedby');}
    return valid;
  }
  function validFields(root){
    let first=null;
    root.querySelectorAll('[data-package-field]').forEach((input,index)=>{if(!validateField(root,input,index)&&!first)first=input;});
    if(first){const disclosure=first.closest('details');if(disclosure)disclosure.open=true;first.focus();return false;}return true;
  }
  async function handleClick(root,event){
    const target=event.target.closest('button');if(!target||target.disabled)return;
    const state=C.state;
    if(root.getAttribute('data-event-package-root')!=='contact')state.configurationSurface='upper';
    const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||['submitting','unknown','received'].includes(state.requestStatus);
    const action=target.getAttribute('data-package-action');
    if(action==='details'){openPackageDetailsDialog(root,target.getAttribute('data-package-details'),target);return;}
    if(action==='vehicle-gallery'){
      if(root.getAttribute('data-event-package-root')!=='mobile'||!window.matchMedia('(max-width:720px)').matches)return;
      const bodyState=document.body.getAttribute('data-events-mobile-config-screen');
      const mobileRoute=root.closest?.('.events-mobile-route'),routeScrollTop=mobileRoute?.scrollTop||0;
      target.focus?.({preventScroll:true});
      document.body.setAttribute('data-events-mobile-config-screen','true');
      const opened=window.PixkuyEventsMobileVehicleGallery?.open?.(0)===true;
      if(!opened){if(bodyState===null)document.body.removeAttribute('data-events-mobile-config-screen');else document.body.setAttribute('data-events-mobile-config-screen',bodyState);return;}
      const gallery=document.querySelector('[data-events-mobile-vehicle-gallery]');
      if(gallery){
        const galleryLabel=gallery.querySelector?.('[data-events-mobile-vehicle-gallery-label]');
        const syncGalleryLabel=()=>{if(galleryLabel&&galleryLabel.textContent!==t('vehicleCategoryLabel'))galleryLabel.textContent=t('vehicleCategoryLabel');};
        syncGalleryLabel();
        let focusReturn=null,galleryLabelObserver=null;
        const restoreFocus=()=>{
          focusReturn?.disconnect();
          galleryLabelObserver?.disconnect();
          gallery.removeEventListener?.('keydown',handleGalleryEscape,true);
          gallery.removeEventListener?.('click',handleGalleryClose,true);
          if(bodyState===null)document.body.removeAttribute('data-events-mobile-config-screen');else document.body.setAttribute('data-events-mobile-config-screen',bodyState);
          const focusCurrent=()=>{if(mobileRoute)mobileRoute.scrollTop=routeScrollTop;const focusTarget=root.querySelector('[data-package-action="vehicle-gallery"]')||(target.isConnected?target:null);focusTarget?.focus({preventScroll:true});};
          if(window.requestAnimationFrame)window.requestAnimationFrame(focusCurrent);else focusCurrent();
        };
        const closeGallery=galleryEvent=>{galleryEvent.preventDefault();galleryEvent.stopPropagation();window.PixkuyEventsMobileVehicleGallery?.close?.();restoreFocus();};
        const handleGalleryEscape=galleryEvent=>{if(galleryEvent.key==='Escape')closeGallery(galleryEvent);};
        const handleGalleryClose=galleryEvent=>{if(galleryEvent.target.closest?.('[data-events-mobile-vehicle-gallery-close],[data-events-mobile-vehicle-gallery-backdrop]'))closeGallery(galleryEvent);};
        gallery.addEventListener?.('keydown',handleGalleryEscape,true);
        gallery.addEventListener?.('click',handleGalleryClose,true);
        if(window.MutationObserver){focusReturn=new MutationObserver(()=>{if(gallery.getAttribute('aria-hidden')==='true')restoreFocus();});focusReturn.observe(gallery,{attributes:true,attributeFilter:['aria-hidden']});}
        if(window.MutationObserver&&galleryLabel){galleryLabelObserver=new MutationObserver(syncGalleryLabel);galleryLabelObserver.observe(galleryLabel,{childList:true});}
      }
      window.requestAnimationFrame?.(()=>document.querySelector('[data-events-mobile-vehicle-gallery-close]')?.focus({preventScroll:true}));
      return;
    }
    const eventId=target.getAttribute('data-package-event')||target.getAttribute('data-package-custom');
    if(eventId){const item=state.events.find(e=>e.id===eventId);if(item&&C.selectEvent(item,target.hasAttribute('data-package-custom'))){state.customPicker=false;if(!target.hasAttribute('data-package-custom'))C.go('package');window.dispatchEvent(new CustomEvent('pixkuy:events-detail-activated',{detail:{source:'packages'}}));C.notify();focusDetail(root);}return;}
    const step=target.getAttribute('data-package-step');if(step){if(C.go(step))focusDetail(root);return;}
    const band=target.getAttribute('data-package-band');
    if(band&&!locked){
      const option=state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)?.options.find(o=>o.id===state.selection.optionId);
      if(['van_1_2','van_3_4','van_5_6'].includes(band)&&(option?.calculationModel==='ordinary_services'||option?.rates?.[band]?.status==='configured')){
        if(state.selection.passengerBand!==band||state.selection.passengerCount!==undefined)C.change(selection=>{delete selection.passengerCount;selection.passengerBand=band;});
        root.querySelector('[data-package-band="'+band+'"]')?.focus({preventScroll:true});
      }
      return;
    }
    const pkgId=target.getAttribute('data-package-configure');
    if(pkgId){if(!locked&&C.choose(pkgId,state.selection.packageId===pkgId?state.selection.optionId:'',()=>window.confirm(t('changeLoss')))){if(state.selection.optionId)C.go('services');else C.notify();focusDetail(root);}return;}
    const reuse=target.getAttribute('data-package-reuse');
    if(reuse&&!locked){const option=state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)?.options.find(o=>o.id===state.selection.optionId);const service=option?.services.find(s=>s.id===reuse);const candidate=service&&lodgingCandidate(state,service);const current=state.selection.services.find(s=>s.serviceId===reuse)?.ordinaryInputs?.destination;if(candidate&&(!current?.address||JSON.stringify(current)===JSON.stringify(candidate.ordinaryInputs.destination)||window.confirm(t('changeLoss'))))C.change(selection=>{let data=selection.services.find(s=>s.serviceId===reuse);if(!data){data={serviceId:reuse};selection.services.push(data);}data.ordinaryInputs=data.ordinaryInputs||{};data.ordinaryInputs.destination={...candidate.ordinaryInputs.destination};});return;}
    if(action==='quote'&&!locked){
      if(!validFields(root))return;
      if(state.selection.requestKind==='package'&&!state.selection.passengerBand){state.error='PASSENGER_BAND_REQUIRED';C.notify();return;}
      if(state.selection.locale!==locale())C.change(selection=>{selection.locale=locale();},{silent:true});
      const selection=state.selection,step=state.step,screen=state.screen;
      const current=await C.quote();
      if(!current||state.selection!==selection||state.step!==step||state.screen!==screen)return;
      if(airportDesktop(state,root.getAttribute('data-event-package-root'))){
        if(state.quoteStatus==='ready')root.querySelector('[data-package-action="'+(airportCanReview(state)?'airport-review':'quote')+'"]')?.focus();
      }else{focusDetail(root);}
      if(state.error)root.querySelector('[role="alert"]')?.focus();
    }
    else if(action==='airport-review'&&!locked&&airportDesktop(state,root.getAttribute('data-event-package-root'))&&airportCanReview(state)&&validFields(root)){contactHandoff(root);}
    else if(action==='retry-quote'&&!locked&&airportAutoQuoteView(state,root.getAttribute('data-event-package-root'))){airportQuoteAttemptedSignature='';C.change(()=>{},{silent:true});scheduleAirportAutoQuote(root,0);}
    else if(action==='custom-entry'&&!locked){const events=state.events.filter(e=>e.snapshot.customInquiryEnabled);const selected=state.screen!=='catalog'&&events.find(e=>e.id===state.selectedEvent?.id);if(selected||events.length===1){C.selectEvent(selected||events[0],true);window.dispatchEvent(new CustomEvent('pixkuy:events-detail-activated',{detail:{source:'packages'}}));focusDetail(root);}else{state.customPicker=!state.customPicker;C.notify();root.querySelector('[data-package-custom]')?.focus();}}
    else if(action==='ordinary-custom'&&!locked&&state.selectedEvent?.snapshot.customInquiryEnabled){C.selectEvent(state.selectedEvent,true);focusDetail(root);}
    else if(action==='packages'&&!locked){C.selectEvent(state.selectedEvent,false);C.go('package');focusDetail(root);}
    else if(action==='edit-services'){C.go('services');focusDetail(root);}
    else if(action==='contact'){contactHandoff(root);}
    else if(action==='submit'&&root.getAttribute('data-event-package-root')==='mobile'&&state.screen==='contact')return;
    else if(action==='back'&&!locked){if(state.step==='review')C.go('services');else if(state.step==='services'&&state.selection?.requestKind==='package')C.go('package');else{state.screen='catalog';C.notify();root.querySelector('[data-package-event]')?.focus();}}
    else if(action==='reload')await load();
    else if(action==='recover')await window.PixkuyEventPackagesRequest.recover();
    else if(action==='retry')await window.PixkuyEventPackagesRequest.submit();
    else if(action==='new')window.PixkuyEventPackagesRequest.newKnownRequest();
    else if(action==='copy-reference')await copyReference(target,state.receipt);
    else if(action==='whatsapp'){const url=window.PixkuyEventPackagesRequest.whatsappUrl(state.receipt);if(url)window.open(url,'_blank','noopener,noreferrer');}
  }
  function renderRoot(root){
    const state=C.state;root.setAttribute('data-package-screen',state.screen);
    const receivedTransition=root.getAttribute('data-event-package-root')==='mobile'&&state.screen==='receipt'&&state.requestStatus==='received'&&root.packageLastScreen!=='receipt'&&root.packageLastRequestStatus==='submitting';
    if(receivedTransition){
      const active=document.activeElement;
      if(active&&root.contains?.(active))active.blur?.();
    }
    if(root.getAttribute('data-event-package-root')==='mobile'){root.closePackageAirport?.();window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));}
    const contactRoot=root.getAttribute('data-event-package-root')==='contact';
    if(contactRoot){root.hidden=!isRootInteractive(root);if(root.hidden){cancelAirportAutoQuote(root);(root.packageAddresses||[]).forEach(controller=>controller.destroy());root.packageAddresses=[];root.innerHTML='';return;}}
    const active=document.activeElement;const caret=active&&root.contains(active)?[active.selectionStart,active.selectionEnd]:null;const focused=document.activeElement&&root.contains(document.activeElement)?document.activeElement.getAttribute('data-package-field'):null;
    const sharedContact=window.PixkuyEventPackagesContact?.isActive();
    const receipt=sharedContact||state.configurationSurface==='contact'?'':receiptContent(state);
    const mobileReview=root.getAttribute('data-event-package-root')==='mobile'&&state.screen==='contact'&&state.selection?mobileReviewContact(state):'';
    let detail=receipt||mobileReview||(state.screen==='catalog'||state.screen==='contact'||(!contactRoot&&state.configurationSurface==='contact')?'':configuration(state,root.getAttribute('data-event-package-root')));
    const desktop=root.getAttribute('data-event-package-root')==='desktop';
    if(!sharedContact&&state.error)detail+='<p class="events-package-alert" role="alert" tabindex="-1">'+esc(state.error.includes('PUBLICATION')||state.error.includes('QUOTE')?t('reviewChanged'):t(/NOT_OFFERED/.test(state.error)?'notOffered':/INVALID|REQUIRED|OUTSIDE_PERIOD|RESTRICTION/.test(state.error)?'invalidData':'error'))+'</p>';
    if(!sharedContact&&state.recoveryNotice&&!state.receipt)detail+='<div class="events-package-status"><p role="status">'+esc(t('recoveryNotice'))+'</p>'+button('recover',t('recover'),false,'secondary')+'</div>';
    if(!sharedContact&&!state.storageAvailable)detail+='<p class="events-package-status" role="status">'+esc(t('storageWarning'))+'</p>';
    if(!sharedContact&&state.requestStatus==='unknown')detail+='<div class="events-package-status"><p role="alert">'+esc(t('unknownReception'))+'</p>'+button('recover',t('recover'),false,'secondary')+button('retry',t('retry'),false,'primary')+'</div>';
    const html=desktop?customStrip(state)+catalog(state)+(detail?'<section class="events-package-detail">'+detail+'</section>':''):state.screen==='catalog'?catalog(state)+customStrip(state):detail;
    (root.packageAddresses||[]).forEach(controller=>controller.destroy());
    root.innerHTML=html.replaceAll('name="package-option"','name="package-option-'+root.getAttribute('data-event-package-root')+'"');
    mountAddresses(root);
    mountAirportSelector(root);
    root.querySelectorAll('[data-package-service]').forEach(node=>node.addEventListener('toggle',()=>{C.state.expandedServiceIds=Array.from(root.querySelectorAll('[data-package-service][open]')).map(item=>item.getAttribute('data-package-service'));}));
    if(focused){const target=Array.from(root.querySelectorAll('[data-package-field]')).find(node=>node.getAttribute('data-package-field')===focused);if(target){target.focus({preventScroll:true});if(caret&&typeof caret[0]==="number"){try{target.setSelectionRange(caret[0],caret[1]);}catch{}}}}
    const legacy=root.parentElement&&root.parentElement.querySelector('[data-events-mobile-flow]');if(legacy)legacy.hidden=state.screen!=='catalog';
    if(desktop||contactRoot||root.getAttribute('data-event-package-root')==='mobile')scheduleAirportAutoQuote(root);
    settleMobileReceipt(root,receivedTransition);
    root.packageLastScreen=state.screen;root.packageLastRequestStatus=state.requestStatus;
  }
  function isRootInteractive(root){
    if(root.getAttribute?.('data-event-package-root')==='contact')return C.state.configurationSurface==='contact'&&C.state.screen==='config'&&window.PixkuyEventPackagesContact?.isActive()&&window.PixkuyEventPackagesContact.matchesSelection();
    return C.state.configurationSurface!=='contact';
  }
  function changeField(target,silent){const name=target.getAttribute('data-package-field');if(!name)return;const value=target.value;const checked=target.checked;if(name.startsWith('contact:')){C.state.contact[name.slice(8)]=value;return;}if(name==='package'||name==='option'){if(!C.choose(name==='package'?value:C.state.selection.packageId,name==='option'?value:'',()=>window.confirm(t('changeLoss'))))C.notify();return;}
    C.change(selection=>{if(name.startsWith('need:')){const flag=name.slice(5);selection.inquiry.needsFlags=checked?[...new Set([...selection.inquiry.needsFlags,flag])]:selection.inquiry.needsFlags.filter(v=>v!==flag);}else if(name==='reason')selection.inquiry.reasonCode=value;else if(name==='inquiryNotes')selection.inquiry.notes=value;else if(name==='passengersKnown')selection.inquiry.passengers=checked?{status:'known',count:1}:{status:'pending',count:null};else if(name==='customPassengers')selection.inquiry.passengers={status:'known',count:Number(value)};else if(name.startsWith('service:')){const [,id,fieldName]=name.split(':');if(fieldName==='additional'){selection.additionalServiceIds=checked?[...selection.additionalServiceIds,id]:selection.additionalServiceIds.filter(v=>v!==id);if(!checked)selection.services=selection.services.filter(s=>s.serviceId!==id);return;}let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}if(fieldName.startsWith('ordinary-')){const key=fieldName.slice(9);const option=C.state.selectedEvent.snapshot.packages.find(p=>p.id===selection.packageId)?.options.find(o=>o.id===selection.optionId);const input=option?.services.find(s=>s.id===id)?.ordinary?.inputs[key];if(option?.calculationModel!=='ordinary_services'||(input?.source!=='customer'&&!(key==='baggageCount'&&!input&&option.services.find(s=>s.id===id)?.ordinary?.inputs.baggageStatus?.source==='customer')))return;data.ordinaryInputs=data.ordinaryInputs||{};if(!value)delete data.ordinaryInputs[key];else data.ordinaryInputs[key]=key==='origin'||key==='destination'?{address:value}:key==='durationHours'||key==='baggageCount'?Number(value):value;if(key==='baggageCount')delete data.ordinaryInputs.baggageStatus;}else if(fieldName==='fromAddress'||fieldName==='toAddress')data[fieldName==='fromAddress'?'from':'to']={address:value};else if(fieldName==='baggage'){if(!value){delete data.baggage;return;}data.baggage={status:value,items:[],specialRequirementsPresent:false};}else if(fieldName.startsWith('bag-')){if(!data.baggage)return;const categoryId=fieldName.slice(4);data.baggage.items=data.baggage.items.filter(v=>v.categoryId!==categoryId);data.baggage.items.push({categoryId,count:Number(value)});}else if(fieldName==='specialNeeds'){if(!data.baggage)data.baggage={status:'unknown',items:[],specialRequirementsPresent:checked};else data.baggage.specialRequirementsPresent=checked;}else if(fieldName==='startLocal')data.startLocal=value||null;else if(value)data[fieldName]=value;else delete data[fieldName];}},{silent});
    if(silent)refreshAirportQuote();
  }
  function changeRootField(root,target){
    if(root.getAttribute('data-event-package-root')==='mobile'&&target.hasAttribute?.('data-package-mobile-band')){
      if(['','van_1_2','van_3_4','van_5_6'].includes(target.value)){C.change(selection=>{delete selection.passengerCount;selection.passengerBand=target.value;},{silent:true});refreshAirportQuote();}
      return;
    }
    // A blur/change between pointerdown and click must not replace the mobile
    // conditions trigger. Input already updates state; keep the same control.
    const preserve=root.getAttribute('data-event-package-root')==='mobile'&&target.getAttribute('data-package-field')?.includes(':ordinary-')&&['text','date','time','number','select-one'].includes(target.type);
    changeField(target,preserve);
    const overlay=target.parentElement?.querySelector('.services-expand__date-overlay');if(overlay)overlay.hidden=Boolean(target.value);
    if(root.getAttribute('data-event-package-root')==='mobile'){
      const fields=typeof root.querySelectorAll==='function'?Array.from(root.querySelectorAll('[data-package-field]')):[target];
      validateField(root,target,Math.max(0,fields.indexOf(target)));
    }
    if(preserve){
      const disclosure=target.closest?.('[data-package-service]');const heading=disclosure?.querySelector('[data-package-service-title]');
      const selection=C.state.selection;const snapshot=C.state.selectedEvent?.snapshot;
      const service=snapshot?.packages.find(p=>p.id===selection.packageId)?.options.find(o=>o.id===selection.optionId)?.services.find(s=>s.id===disclosure?.getAttribute('data-package-service'));
      if(heading&&service){const subtitle=mobileServiceSubtitle(service,selection.services.find(s=>s.serviceId===service.id)||{},snapshot.days?.find(d=>d.id===service.dayId));heading.textContent=heading.getAttribute('data-package-service-title')+(subtitle?' · '+subtitle:'');}
    }
  }
  function load(){
    const language=locale();if(catalogLoad?.language===language)return catalogLoad.promise;
    const sequence=++catalogSequence,entry={language,promise:null};catalogLoad=entry;C.state.catalogStatus='loading';
    entry.promise=Promise.resolve().then(async()=>{
      C.notify();
      try{const result=await window.PixkuyEventPackagesApi.load(language);if(sequence!==catalogSequence)return;C.state.events=result.events;C.state.catalogStatus='ready';
        if(C.state.selectedEvent&&C.state.selection){const current=result.events.find(e=>e.id===C.state.selectedEvent.id);if(!current||current.publicationVersion!==C.state.selection.publicationVersion){C.change(()=>{},{silent:true});C.state.quote=null;C.state.quoteStatus='idle';C.state.error='PUBLICATION_CHANGED';}}
      }catch{if(sequence!==catalogSequence)return;C.state.catalogStatus='error';}
      if(catalogLoad===entry)catalogLoad=null;C.notify();
    });return entry.promise;
  }
  async function submitMobilePackageContact(root){
    if(!airportCanReview(C.state)||!validFields(root)||!validateMobilePackageContact(root))return false;
    await window.PixkuyEventPackagesRequest.submit();return true;
  }
  function mount(parent,surface){if(!parent)return null;let root=parent.querySelector('[data-event-package-root="'+surface+'"]');if(root)return root;root=document.createElement('section');root.setAttribute('data-events-offer','packages');root.setAttribute('data-event-package-root',surface);let host=parent;if(surface==='desktop'){const legacyCatalog=parent.querySelector('[data-services-events-catalog]');let unified=parent.querySelector('[data-events-unified-catalog]');if(legacyCatalog&&!unified){unified=document.createElement('div');unified.className='events-catalog-grid';unified.setAttribute('data-events-unified-catalog','');legacyCatalog.before(unified);unified.appendChild(legacyCatalog);}if(unified)host=unified;}host.appendChild(root);roots.add(root);root.addEventListener('change',event=>changeRootField(root,event.target));root.addEventListener('input',event=>{const key=event.target.getAttribute('data-package-field');if(key&&key.startsWith('contact:')){C.state.contact[key.slice(8)]=event.target.value;clearMobileContactValidation(event.target);}else if(key&&['text','textarea','tel','email','date','time','datetime-local','number'].includes(event.target.type)){changeField(event.target,true);if(surface==='mobile'){const fields=Array.from(root.querySelectorAll('[data-package-field]'));validateField(root,event.target,Math.max(0,fields.indexOf(event.target)));}}});root.addEventListener('focusout',event=>{const key=event.target?.getAttribute?.('data-package-field');if(key?.startsWith('contact:'))validateMobilePackageContact(root,key.slice(8));});root.addEventListener('submit',event=>{if(!event.target?.matches?.('[data-package-mobile-contact-form]'))return;event.preventDefault();void submitMobilePackageContact(root);});root.addEventListener('click',event=>{void handleClick(root,event);});renderRoot(root);if(surface!=='contact'&&roots.size===1){void load();void window.PixkuyEventPackagesRequest.initialize();}return root;}
  async function open(eventId){C.state.configurationSurface='upper';if(window.matchMedia('(max-width:720px)').matches&&window.PixkuyEventsMobileBookingFlow){window.PixkuyEventsMobileConfigStep?.close();await window.PixkuyEventsMobileBookingFlow.open();}else{const toggle=document.querySelector('[data-service-expand-trigger="events"]');const panel=document.getElementById('services-expand-events');if(panel&&panel.hidden&&toggle)toggle.click();}if(C.state.catalogStatus!=='ready')await load();const item=C.state.events.find(e=>e.id===eventId);if(item&&C.selectEvent(item,!item.snapshot.packages.length))window.dispatchEvent(new CustomEvent('pixkuy:events-detail-activated',{detail:{source:'packages'}}));const root=Array.from(roots).find(r=>r.offsetParent!==null);if(root)root.scrollIntoView({block:'start',behavior:'smooth'});}
  C.subscribe(()=>roots.forEach(renderRoot));window.addEventListener('pixkuy:events-detail-activated',event=>{if(event.detail?.source!=='special'||C.state.screen==='catalog')return;closePackageDetailsDialog();C.state.screen='catalog';C.notify();});window.addEventListener('pixkuy:i18n-applied',()=>{closePackageDetailsDialog();roots.forEach(renderRoot);void load();});
  window.matchMedia?.('(max-width:720px)').addEventListener?.('change',()=>roots.forEach(renderRoot));
  document.addEventListener('click',event=>roots.forEach(root=>root.closePackageAirport?.(event.target)));
  document.addEventListener('focusin',event=>roots.forEach(root=>root.closePackageAirport?.(event.target)));
  function receiptServiceTime(value){
    if(!value||!Number.isFinite(Date.parse(value)))return t('ordinaryDeferred');
    return new Intl.DateTimeFormat(locale(),{dateStyle:'long',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(value))+' · CDMX';
  }
  async function copyReference(target,receipt){
    if(!receipt?.reference)return;
    const status=target.closest('.events-package-receipt')?.querySelector('[data-reference-status]');
    try{
      if(!window.navigator?.clipboard?.writeText)throw Error('CLIPBOARD_UNAVAILABLE');
      await window.navigator.clipboard.writeText(receipt.reference);
      if(status)status.textContent=t('referenceCopied');
    }catch{if(status)status.textContent=t('referenceCopyUnavailable');}
  }
  function receiptContent(state){
    if(!state.receipt)return '';
    const receipt=state.receipt,detail=receipt.confirmation;
    const title=local(detail?.eventTitle)||receipt.eventTitle;
    const packageTitle=local(detail?.packageTitle)||receipt.packageTitle;
    const optionTitle=local(detail?.optionTitle)||receipt.optionTitle;
    const services=(detail?.services||[]).map(service=>{
      const route=service.baseService==='airport_transfer'
        ? t(service.direction==='airport_to_destination'?'confirmationArrival':service.direction==='destination_to_airport'?'confirmationDeparture':'airport')
        : service.baseService==='hourly_daily'||service.kind==='block'?t('ordinaryHourly')
        : service.baseService==='direct_transfer'?t('services')
        : [t(service.from==='airport'?'airport':service.from==='venue'?'venueLabel':'address'),t(service.to==='airport'?'airport':service.to==='venue'?'venueLabel':'address')].join(' → ');
      return '<li><strong>'+esc(route)+'</strong><p>'+esc(receiptServiceTime(service.startsAtUtc))+'</p>'+
        (service.endsAtUtc&&service.endsAtUtc!==service.startsAtUtc?'<p>'+esc(receiptServiceTime(service.endsAtUtc))+'</p>':'')+'</li>';
    }).join('');
    const conditions=detail?.conditions||[];
    return '<section class="events-package-receipt" data-package-confirmation aria-label="'+esc(t('confirmationTitle'))+'">'+
      '<h3 role="status" tabindex="-1" data-package-confirmation-title><span class="events-package-receipt__check" aria-hidden="true">✓</span>'+esc(t('confirmationTitle'))+'</h3><p>'+esc(t('confirmationNext'))+'</p><p>'+esc(t('confirmationNoRepeat'))+'</p>'+
      '<div class="events-package-receipt__reference"><span>'+esc(t('receiptReference'))+': <span class="events-package-receipt__reference-value">'+esc(receipt.reference)+'</span></span>'+
      button('copy-reference',t('copyReference'),false,'secondary')+'<span role="status" data-reference-status></span></div>'+
      '<dl class="events-package-receipt__summary"><dt>'+esc(t('receiptEvent'))+'</dt><dd>'+esc(title)+'</dd>'+
      '<dt>'+esc(t('package'))+' / '+esc(t('option'))+'</dt><dd>'+esc([packageTitle,optionTitle].filter(Boolean).join(' · ')||t('custom'))+'</dd>'+
      (receipt.passengerBand?'<dt>'+esc(t('passengers'))+'</dt><dd>'+esc(passengerDescription(receipt))+'</dd>':'')+
      (services?'<dt>'+esc(t('services'))+'</dt><dd><ol>'+services+'</ol></dd>':'')+
      (receipt.baggage?.some(item=>Number.isSafeInteger(item.count)&&item.count>=0)?'<dt>'+esc(t('baggage'))+'</dt><dd>'+baggageSummary(receipt.baggage.map(item=>Number.isSafeInteger(item.count)&&item.count>=0?{baggage:item}:{}))+'</dd>':'')+
      '<dt>'+esc(t(receipt.priceStatus==='quoted'?'quoted':receipt.priceStatus==='conditional'?'conditional':'personalized'))+'</dt><dd class="events-package-receipt__amount">'+
      esc(receipt.pricedSubtotal!==null&&receipt.pricedSubtotal!==undefined?money(receipt.pricedSubtotal,receipt.currency):t('personalized'))+'</dd></dl>'+
      (conditions.length?'<details><summary>'+esc(t('conditions'))+'</summary><ul>'+conditions.map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong> '+esc(local(condition.description))+'</li>').join('')+'</ul></details>':'')+
      '<p class="events-package-receipt__notice">'+esc(t('confirmationReservation'))+'</p>'+
      '<div class="events-package-receipt__actions">'+button('whatsapp',t('confirmationWhatsapp'),false,'secondary')+button('new',t('confirmationNew'),false,'quiet')+'</div></section>';
  }
  window.PixkuyEventPackagesConfig={mount,open,t,money,load,closePackageDetailsDialog};
  Object.assign(window.PixkuyEventPackagesConfig,{copyReference,quoteIsCurrent:airportCanReview,renderContact:renderRoot,contactHandoff,receiptContent,contactSummary:state=>'<h3>'+esc(eventTitle(state.selectedEvent))+'</h3>'+reviewItinerary(state)+summary(state),editServices:()=>{if(!C.go('services'))return false;if(window.matchMedia('(max-width:720px)').matches&&window.PixkuyEventsMobileBookingFlow){void open(C.state.selectedEvent.id);return true;}const root=Array.from(roots).find(r=>r.offsetParent!==null);if(root){root.scrollIntoView({block:'start',behavior:'smooth'});focusDetail(root);}return true;}});
})(window,document);
