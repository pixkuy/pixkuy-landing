(function(window,document){
  "use strict";
  const C=window.PixkuyEventPackagesState;const roots=new Set();let catalogSequence=0;let catalogLoad=null;let packageDetailsDialog=null;let packageDetailsPreviousFocus=null;let recoveryInitialization=null;
  const AUTO_QUOTE_DELAY_MS=320;let airportQuoteTimer=null;let airportQuoteTimerRoot=null;let airportQuoteTimerSignature='';let airportQuoteAttemptedSignature='';
  const fallback={"ordinaryArrival":"Llegada: aeropuerto → dirección","ordinaryDeparture":"Salida: dirección → aeropuerto","ordinaryHourly":"Por horas","ordinaryFullDay":"Día completo","ordinaryDirection":"Sentido","ordinaryDate":"Fecha (CDMX)","ordinaryTime":"Hora (CDMX)","ordinaryMode":"Modalidad","ordinaryDuration":"Duración en horas","ordinaryPricing":"Pixkuy calcula el precio según los datos del servicio.","ordinaryDeferred":"Pendiente para coordinación posterior","ordinaryFixed":"Definido por el evento","ordinaryOutside":"El servicio seleccionado no cubre este trayecto. Puedes solicitar una valoración personalizada si está disponible.",title:"Paquetes para eventos",publicDatesLabel:"Fechas",choose:"Seleccionar",viewPackages:"Ver paquetes",custom:"Empresas y grupos · solicitud personalizada",empty:"No hay paquetes publicados en este momento.",error:"No se pudo completar la operación. Revisa los datos y vuelve a intentarlo.",loading:"Cargando…",back:"Volver",package:"Paquete",option:"Opción",passengers:"Pasajeros",services:"Servicios",date:"Fecha y hora local (CDMX)",origin:"Origen",destination:"Destino",airport:"Aeropuerto",address:"Dirección",baggage:"Equipaje",unknown:"Pendiente",none:"Sin equipaje",declared:"Declarado",specialNeeds:"Necesidades especiales por valorar",quote:"Revisar cálculo",continue:"Continuar con los datos de contacto",name:"Nombre",phone:"Teléfono",email:"Correo electrónico",submit:"Enviar solicitud",retry:"Reintentar el mismo envío",recover:"Recuperar recibo",received:"Solicitud recibida",notBooking:"La solicitud no confirma una reserva ni disponibilidad.",pending:"Hay datos o condiciones pendientes de valoración.",conditional:"Subtotal condicionado",personalized:"Valoración personalizada",quoted:"Subtotal cotizado",description:"Describe lo que necesitas",reason:"Motivo",knownPassengers:"Número de personas conocido",additional:"Servicio adicional",conditions:"Condiciones",recoveryNotice:"No se ha podido recuperar la recepción. Conservamos el mismo intento; reintroduce los datos si recargaste la página.",storageWarning:"El navegador no puede conservar el intento al recargar. Mantén esta página abierta para reintentar.",sending:"Enviando…",unknownReception:"La recepción es desconocida. Recupera el recibo o reintenta con la misma clave.",newRequest:"Nueva consulta",whatsapp:"Continuar voluntariamente en WhatsApp",flight:"Vuelo",notes:"Notas operativas (opcional)",notOffered:"Combinación no ofrecida",reviewChanged:"Revisa de nuevo la oferta antes de enviar.",close:"Cerrar",inclusions:"Qué incluye",base:"Base",multiplier:"Multiplicador",result:"Resultado",calculationStatus:"Estado del cálculo",selectPackageOption:"Selecciona paquete y opción para continuar."};
  Object.assign(fallback,{mobileConfigureTrip:'Configurar mi viaje',mobileTripData:'Datos del viaje',vehicleCategoryLabel:'Van Premium · BYD M9 o similar',vehicleGalleryOpen:'Ver galería',vehicleFareLabel:'Tarifa',"confirmationTitle":"Solicitud recibida correctamente","confirmationNext":"Gracias por contactar con Pixkuy. Su solicitud ha quedado registrada. Nos pondremos en contacto con usted para revisar los detalles.","receiptReference":"Referencia de la solicitud","copyReference":"Copiar referencia","referenceCopied":"Referencia copiada.","referenceCopyUnavailable":"No se pudo copiar. Seleccione la referencia y cópiela manualmente.","confirmationWhatsapp":"Contactar por WhatsApp","confirmationNew":"Nueva solicitud","confirmationNoRepeat":"No necesita enviarla de nuevo.","confirmationReservation":"Esta solicitud no constituye una reserva confirmada.","receiptEvent":"Evento","confirmationArrival":"Traslado de llegada","confirmationDeparture":"Traslado de salida"});
  Object.assign(fallback,{"hourlyReviewIntro":"Revise su servicio y complete sus datos","hourlyReviewChangePackage":"Cambiar paquete","hourlyReviewNotes":"Notas adicionales","hourlyReviewNotesHelp":"Indique detalles que debamos tener en cuenta para su servicio."});
  const journeyFallback={"eventUnavailable":"El evento seleccionado ya no está disponible o su publicación ha cambiado. Seleccione un evento para continuar.","continueContact":"Continuar","editTransfer":"Editar traslado","editTransfers":"Editar traslados","customTitle": "¿Necesita un servicio a medida?", "customIntro": "También organizamos traslados con otros horarios, recorridos o necesidades, para particulares, empresas y grupos.", "proposal": "Solicitar propuesta", "customLink": "Servicio a medida", "noPackage": "¿Ningún paquete se ajusta a lo que necesita?", "configure": "Configurar", "goServices": "Continuar a servicios", "reviewContact": "Revisión y contacto", "priceByDetails": "El precio depende de la opción y de los datos del servicio.", "groupTotal": "Total del grupo", "breakdown": "Desglose", "customNotesHelp": "Indique fechas, horarios, recorrido y necesidades. Si representa a una empresa, puede indicarlo aquí.", "changeLoss": "Este cambio descarta datos de servicios que no son compatibles. ¿Desea continuar?", "invalidData": "Revise los datos del servicio, su periodo operativo y las restricciones publicadas.", "reuseLodging": "Usar el alojamiento de otro servicio", "selectEvent": "Seleccione el evento de su solicitud", "calculatePrice": "Calcular precio", "arrivalTime": "Hora de inicio del servicio (CDMX)", "pickupTime": "Hora de recogida (CDMX)", "transferFlight": "Número de vuelo", "editServices": "Editar servicios", "backToEvents": "← Volver a eventos", "choosePackage": "Elija su paquete", "modeAvailable": "Modalidad disponible", "transferOne": "1 traslado", "transferMany": "{count} traslados", "viewInclusions": "Ver las {count} inclusiones", "viewAllDetails": "Ver todas las inclusiones y condiciones", "customStepIntro": "Para particulares, empresas y grupos con otros horarios o recorridos.", "configureTransfer": "Configurar traslado", "configureServices": "Configurar servicios", "missingForQuote": "Falta: {fields}.", "invalidForQuote": "Revisa: {fields}.", "placeDetailsError": "No hemos podido confirmar la dirección seleccionada. Vuelve a elegirla de la lista.", "automaticQuotePending": "El precio se calculará automáticamente.", "retryCalculation": "Reintentar cálculo"};
  const bandsFallback={"baggageCount":"Número de maletas","baggageQuantityUnknown":"Cantidad no indicada","baggageMayBePending":"Puede dejar la cantidad pendiente para coordinación.","baggageConfigurationRequired":"Falta configurar quién indica el número de maletas.","optional":"opcional","flightOptionalHelp":"Si lo conoce, lo usaremos para coordinar la recogida.","baggageOptionalHelp":"Puede indicarlo si desea facilitar la coordinación.","noCompatibleBand":"No hay bandas de pasajeros compatibles con esta opción.","historicalExact":"cantidad exacta histórica"};
  Object.assign(journeyFallback,{journeyHeading:'Day · {date}',mobileViewDetails:'Ver detalles, inclusiones y condiciones',mobilePriceByDetails:'El precio se calcula al completar sus datos'});
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
    if(!valid&&!fieldName){const invalid=root.querySelector?.('[aria-invalid="true"]');invalid?.focus?.({preventScroll:true});}
    return valid;
  }
  Object.assign(fallback,{sharedTripData:"Datos compartidos",arrivalHeading:"Llegada",returnHeading:"Regreso",roundTripTotal:"Total de ida y vuelta",arrivalRoute:"Aeropuerto → Alojamiento",returnRoute:"Alojamiento → Aeropuerto",roundTripRoute:"Aeropuerto → Alojamiento → Mismo aeropuerto",returnDate:'Fecha de regreso',returnPickupTime:'Hora de recogida en el hotel (CDMX)'});
  Object.assign(fallback,{"outboundHeading": "Ida", "directTransferLabel": "Direct Transfer", "directSharedData": "Datos compartidos", "directDestination": "Destino / dirección de llegada", "directSharedDate": "Fecha de ida y regreso (CDMX)", "directOutboundDate": "Fecha de ida", "directOutboundTime": "Hora de ida (CDMX)", "directReturnTime": "Hora de regreso (CDMX)", "directEndpointsHelp": "El regreso utiliza los mismos extremos en sentido inverso."});
  const ordinaryChoices={airportId:[['mex','MEX'],['nlu','NLU'],['tlc','TLC'],['pbc','PBC'],['qro','QRO']],direction:[['airport_to_destination','ordinaryArrival'],['destination_to_airport','ordinaryDeparture']],mode:[['hourly','ordinaryHourly'],['full_day','ordinaryFullDay']],baggageStatus:[['unknown','unknown'],['none','none'],['declared','declared']]};
  const ordinaryFieldLabels={airportId:'airport',direction:'ordinaryDirection',origin:'origin',destination:'address',date:'ordinaryDate',time:'ordinaryTime',mode:'ordinaryMode',durationHours:'ordinaryDuration',flight:'flight',baggageStatus:'baggage'};
  Object.assign(fallback,{"hourlyReviewAllDays":"Todas las jornadas","hourlyReviewDate":"Fecha","hourlyReviewDuration":"{hours} h por jornada · Horario de Ciudad de México","hourlyReviewHours":"{hours} h"});
  Object.assign(fallback,{"hourlyMobileStart":"Inicio","hourlyMobileEnd":"Fin","hourlyMobileCommonStart":"Hora habitual","hourlyMobileDuration":"12 h por jornada · Horario de Ciudad de México"});
  Object.assign(fallback,{"hourlyPickup":"Recogida","hourlyStart":"Inicio (CDMX)","hourlyEnd":"Fin del servicio (CDMX)","hourlyHabits":"Datos habituales","hourlyHabitsHelp":"Aplique una recogida y hora habituales; puede cambiarlas por jornada. Los cambios habituales conservan sus excepciones.","hourlyCommonPickup":"Recogida habitual","hourlyCommonStart":"Hora habitual (CDMX)","hourlyWeekStart":"Fecha inicial de la semana","hourlyDay":"Jornada {number}","hourlyDuration":"12 horas consecutivas por jornada","hourlyCount":"{count} jornadas · 12 horas por jornada"});
  Object.assign(fallback,{"hourlyEnterTime":"Indique la hora","hourlyChooseDate":"Seleccione una fecha para organizar sus jornadas.","hourlyDateRange":"Elija una fecha entre {from} y {until}.","hourlyLatestStart":"Comience como máximo a las {time} para completar las 12 horas.","hourlyInvalidTime":"Revise el horario: debe respetar el periodo y no solaparse con otra jornada.","hourlySelectPlace":"Seleccione una dirección de las sugerencias.","hourlyNextDay":"día siguiente","hourlyDifferentPickup":"Recogida diferente","hourlyDifferentTime":"Horario diferente","hourlyCheckDay":"Revise los datos de esta jornada","hourlyEditDay":"Editar {date}","hourlyEdit":"Editar","hourlyDone":"Listo","hourlyUseHabits":"Usar recogida y hora habituales","hourlyAdjustDay":"Puede ajustar la recogida y el horario de cada jornada","hourlyComplete":"Complete fecha, pasajeros, recogida y hora para obtener el total.","hourlyCheckData":"Revisar datos"});
  Object.assign(fallback,{"hourlyDesktopSingle":"1 jornada · {hours} h","hourlyDesktopComposition":"{count} jornadas · {hours} h por jornada","hourlyDesktopHabitual":"Recogida habitual","hourlyDesktopPickupPending":"Indique la recogida","hourlyDesktopChangeDay":"Cambiar {date}","hourlyDesktopChange":"Cambiar","hourlyDesktopFixedDates":"Fechas fijadas","hourlyDesktopSchedule":"Horario","hourlyDesktopAction":"Acción"});
  const H=window.PixkuyEventPackagesHourly({C,t,esc,ordinaryInput,addressField,field,passengerField,baggageField,serviceBounds,desktopDate,receiptServiceTime,locale});
  function serviceBounds(service,state=C.state){
    const period=state.selectedEvent?.snapshot.servicePeriod;
    const localMinute=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(' ','T'):'';
    const bounds={min:localMinute(period?.from),max:localMinute(period?.until?new Date(Date.parse(period.until)-60000).toISOString():null)};
    const selection=state.selection;
    const option=state.selectedEvent?.snapshot.packages.find(p=>p.id===selection?.packageId)?.options.find(o=>o.id===selection?.optionId);
    const r=option?.calculationModel==='ordinary_services'?service.ordinary?.restrictions:null;
    if(service.ordinary?.baseService==='hourly_daily'&&service.ordinary.inputs.mode?.source==='fixed'&&service.ordinary.inputs.mode.value==='hourly'&&service.ordinary.inputs.durationHours?.source==='fixed'&&period?.until)bounds.max=localMinute(new Date(Date.parse(period.until)-Number(service.ordinary.inputs.durationHours.value)*3600000-60000).toISOString());
    if(service.ordinary?.baseService==='hourly_daily'||option?.services.some(item=>item.ordinary?.airportReturn||item.ordinary?.directReturn)){
      const earliest=Math.ceil((Date.now()+(state.selectedEvent.snapshot.minimumLeadMinutes||0)*60000)/60000)*60000;
      bounds.min=[bounds.min,localMinute(new Date(earliest).toISOString())].sort().pop();
    }
    if(service.ordinary?.airportReturn||service.ordinary?.directReturn){
      const arrival=option.services.find(item=>item.id===(service.ordinary.airportReturn?.arrivalServiceId||service.ordinary.directReturn?.outboundServiceId));
      const values=arrival&&resolvedOrdinaryValues(arrival,state);
      if(values?.date&&values?.time){
        const instant=Date.parse(values.date+'T'+values.time+':00-06:00');
        if(Number.isFinite(instant))bounds.min=[bounds.min,localMinute(new Date(instant+60000).toISOString())].sort().pop();
      }
    }
    const sharedReturn=option?.services.find(item=>item.ordinary?.directReturn?.outboundServiceId===service.id&&item.ordinary.directReturn.dateMode==='shared')?.ordinary?.restrictions;
    return {minDate:[bounds.min.slice(0,10),r?.fromDate||'',sharedReturn?.fromDate||''].sort().pop(),maxDate:[bounds.max.slice(0,10),r?.untilDate||'',sharedReturn?.untilDate||''].filter(Boolean).sort()[0]||'',...bounds};
  }
  function airportQuoteReadiness(state,view){
    if(!view)return {ready:false,missing:[],invalid:[]};
    if(view.hourly)return H.readiness(state,view);
    if(view.service.ordinary?.baseService==='direct_transfer')return directQuoteReadiness(state,view);
    const {option,service,arrival}=view;const data=state.selection.services.find(item=>item.serviceId===service.id)||{};const inputs=service.ordinary.inputs;const values=data.ordinaryInputs||{};const missing=[];const invalid=[];
    const requireValue=(key,label,validate)=>{
      if(service.ordinary.airportReturn&&['airportId','destination'].includes(key))return;
      const field=inputs[key];if(!field){invalid.push(t(label));return;}
      if(field.source!=='customer')return;
      const value=values[key];if(value===undefined||value===null||value===''){missing.push(t(label));return;}
      if(validate&&!validate(value))invalid.push(t(label));
    };
    if(!state.selection.passengerBand)missing.push(t('passengers'));
    requireValue('airportId',arrival?'arrivalAirport':'departureAirport',value=>typeof value==='string'&&value!=='');
    requireValue('destination',arrival?'arrivalAddress':'departureAddress',value=>!!value&&typeof value==='object'&&!!value.address?.trim()&&!!value.placeId?.trim());
    const bounds=serviceBounds(service,state);
    requireValue('date',service.ordinary.airportReturn?'returnDate':'transferDate',value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&(!bounds.minDate||value>=bounds.minDate)&&(!bounds.maxDate||value<=bounds.maxDate));
    const restrictions=service.ordinary.restrictions||{};
    requireValue('time',service.ordinary.airportReturn?'returnPickupTime':arrival?'transferStartTime':'transferPickupTime',value=>{
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
    const current=resolvedOrdinaryValues(service,state);
    const start=current.date&&current.time?current.date+'T'+current.time:'';
    if(start&&((bounds.min&&start<bounds.min)||(bounds.max&&start>bounds.max)))invalid.push(t(service.ordinary.airportReturn?'returnDate':'transferDate'));
    if(view.returning){
      const result=airportQuoteReadiness(state,{option,service:view.returning,arrival:false});
      missing.push(...result.missing);invalid.push(...result.invalid);
      const back=resolvedOrdinaryValues(view.returning,state);
      if(start&&back.date&&back.time&&back.date+'T'+back.time<=start)invalid.push(t('returnPickupTime'));
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
    const label=(presentation?.textLabel||t(presentation?.label|| (key==='time'&&service.ordinary?.baseService==='airport_transfer'?(direction==='airport_to_destination'?'arrivalTime':'pickupTime'):ordinaryFieldLabels[key]||'pending')))+(presentation?.optional&&input.source==='customer'?' ('+t('optional')+')':'');
    if(input.source==='fixed'){
      const date=presentation&&key==='date'&&!input.redacted&&localDate(input.value);
      const value=date?new Intl.DateTimeFormat(locale(),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date):input.redacted?(input.displayLabel||t('ordinaryFixed')):displayOrdinaryValue(key,input.value);
      return value?'<div class="events-package-fixed services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':'';
    }
    if(input.source==='deferred')return '<div class="events-package-deferred services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><strong>'+esc(t('ordinaryDeferred'))+'</strong></div>';
    const value=data.ordinaryInputs?.[key]??'';const name=prefix+'ordinary-'+key;
    if(ordinaryChoices[key]){const restriction=service.ordinary.restrictions?.[key==='airportId'?'airportIds':key==='direction'?'directions':''];return '<label class="events-package-field services-expand__field '+esc(className||'')+'"><span class="services-expand__label">'+esc(label)+'</span><select class="services-expand__control" data-package-field="'+esc(name)+'">'+optionHtml('',t('choose'),!value)+ordinaryChoices[key].filter(([id])=>!restriction||restriction.includes(id)).map(([id,text])=>optionHtml(id,key==='airportId'?text:t(text),id===value)).join('')+'</select></label>';}
    if(key==='origin'||key==='destination')return addressField(name,label,value,className);
    const bounds=serviceBounds(service);
    const dateValue=resolvedOrdinaryValues(service,C.state).date;
    const minTime=[service.ordinary.restrictions?.fromTime||'',dateValue===bounds.min.slice(0,10)?bounds.min.slice(11):''].filter(Boolean).sort().pop()||'';
    const maxTime=[service.ordinary.restrictions?.untilTime||'',dateValue===bounds.max.slice(0,10)?bounds.max.slice(11):''].filter(Boolean).sort()[0]||'';
    const constraints=key==='date'?((bounds.minDate?'min="'+esc(bounds.minDate)+'" ':'')+(bounds.maxDate?'max="'+esc(bounds.maxDate)+'"':'')):key==='time'?((minTime?'min="'+esc(minTime)+'" ':'')+(maxTime?'max="'+esc(maxTime)+'"':'')):key==='durationHours'?'min="1" max="24" step="1"':'maxlength="2000"';
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
    if(source.source!=='customer')return ordinaryInput(service,data,prefix,key,'',{textLabel:label});
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
  function mobileBaggageField(service,data,prefix){
    const source=service.ordinary?.inputs.baggageCount||service.ordinary?.inputs.baggageStatus;
    return source&&source.source!=='deferred'&&!(source.source==='fixed'&&source.value==='unknown')?baggageField(service,data,prefix):'';
  }
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
    const bags=bagInput?.source==='customer'?'<label class="airport-mobile-luggage"><span class="airport-mobile-luggage__label">'+esc(shared('airportMobileFlow.fields.luggage','baggageCount'))+'</span>'+ordinaryQuantity(prefix,data.ordinaryInputs?.baggageCount??(data.ordinaryInputs?.baggageStatus==='none'?0:''),!pendingAllowed,pendingAllowed).match(/<input\b[^>]*>/)?.[0].replace('class="services-expand__control"','class="airport-mobile-luggage__select"')+'</label>':mobileBaggageField(service,data,prefix);
    return '<div class="events-package-mobile-airport"><div class="services-expand__form">'+(binding.inputs.direction?.source==='customer'?ordinaryInput(service,data,prefix,'direction'):'')+(direction==='destination_to_airport'?role('destination',address)+role('origin',airport):role('origin',airport)+role('destination',address))+mobileAirportZone(state,service,data)+bands+bags+dateTime('date')+dateTime('time')+'<div class="events-package-airport-flight">'+ordinaryInput(service,data,prefix,'flight','',{label:'transferFlight',optional:true})+'</div></div>'+returnSchedule(state,configuredAirportOption(state),true)+'</div>';
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
    const bags=cell('bags',mobileBaggageField(service,data,prefix));
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
  Object.assign(fallback,{"sharedTripData": "Su traslado", "sharedEndpointsHelp": "El regreso utiliza el mismo aeropuerto y alojamiento.", "arrivalDate": "Fecha de llegada", "sharedLocalTime": "Fecha y hora locales de Ciudad de México", "returnHotelPickup": "Hora de recogida en el hotel", "completeTransfer": "Completar mi traslado", "completeRequest": "Completar mi solicitud", "chooseOptionRequired": "Elija una modalidad para continuar.", "completeQuoteFields": "Complete estos datos para calcular el total:", "reviewQuoteFields": "Revise estos datos para calcular el total:", "serviceLabel": "Servicio"});
  function quoteServiceLabel(state,serviceId){
    const pkg=activePackages(state.selectedEvent).find(item=>item.id===state.selection.packageId);
    const option=pkg?.options.find(item=>item.id===state.selection.optionId);
    const direct=option&&optionDirectView(state,pkg,option);if(direct)return t(option.services.find(item=>item.id===serviceId)?.ordinary?.directReturn?'returnHeading':'outboundHeading');
    const view=option&&optionAirportView(state,pkg,option);
    return view?.returning&&serviceId===view.returning.id?t('returnHeading'):view?.returning&&serviceId===view.service.id?t('arrivalHeading'):t('serviceLabel');
  }
  function summary(state,surface,hourlyDesktop){
    if(!state.quote)return '';
    const calculation=state.quote.calculation;
    const price=calculation.priceBreakdown;
    const complete=price.priceStatus==='quoted'&&price.pricedSubtotal!==null;
    const amount=complete?(hourlyDesktop?receiptMoney:money)(price.pricedSubtotal,price.currency):t('pending');
    const packageOption=state.selection?.requestKind==='package';
    const coordinationFields=[...new Set((calculation.serviceLines||[]).flatMap(line=>Object.entries(line.inputStatus||{}).filter(([,input])=>input.pending).map(([key])=>t(ordinaryFieldLabels[key]||'pending'))).concat(calculation.baggageAssessment==='pending'?[t('baggageCount')]:[]))];
    const conditions=surface==='mobile-config'?'':surface==='mobile-review'
      ?'<button type="button" class="events-package-offer__details-trigger" data-package-action="details" data-package-details="'+esc(state.selection.packageId)+'" data-package-review-conditions aria-haspopup="dialog">'+esc(t('desktopConditions'))+'</button>'
      :'<details><summary>'+esc(t('conditions'))+'</summary><ul>'+(calculation.conditions||[]).map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong> '+esc(local(condition.description))+'</li>').join('')+'</ul></details>';
    if(['desktop-review','mobile-review'].includes(surface)&&packageOption){
      const option=state.selectedEvent.snapshot.packages.find(pkg=>pkg.id===state.selection.packageId)?.options.find(item=>item.id===state.selection.optionId);
      const passiveBaggage=option?.services.every(service=>{const source=service.ordinary?.inputs.baggageCount||service.ordinary?.inputs.baggageStatus;return service.ordinary&&(!source||source.source==='deferred'||option.baggagePolicy?.allowUnknown!==false);});
      const pendingFields=[...new Set((calculation.serviceLines||[]).flatMap(line=>Object.entries(line.inputStatus||{}).filter(([key,input])=>input.pending&&(!passiveBaggage||!['baggageCount','baggageStatus'].includes(key))).map(([key])=>t(ordinaryFieldLabels[key]||'pending'))).concat(calculation.baggageAssessment==='pending'&&!passiveBaggage?[t('baggageCount')]:[]))];
      const remainingCodes=(calculation.coordinationPendingCodes||[]).filter(code=>!passiveBaggage||!/:BAGGAGE(?:COUNT|STATUS)_PENDING$/.test(code));
      const detail=surface==='mobile-review'?conditions:'<details class="events-package-review-conditions"><summary>'+esc(t('desktopConditions'))+'</summary><ul>'+(calculation.conditions||[]).map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong><p>'+esc(local(condition.description))+'</p></li>').join('')+'</ul></details>';
      return '<section class="events-package-summary events-package-summary--review">'+detail+(calculation.pendingCodes.length?'<p class="events-package-help">'+esc(t('pending'))+'</p>':'')+(pendingFields.length?'<p class="events-package-help">'+esc(pendingFields.join(', '))+': '+esc(t('ordinaryDeferred'))+'</p>':remainingCodes.length?'<p class="events-package-help">'+esc(t('pending'))+': '+esc(t('ordinaryDeferred'))+'</p>':'')+'<p class="events-package-help">'+esc(t('notBooking'))+'</p><div class="events-package-review-total" aria-live="polite"><h4>'+esc(t('packageTotal'))+'</h4><p class="events-package-summary__amount">'+esc((surface==='mobile-review'||hourlyDesktop)&&!airportCanReview(state)?t('reviewChanged'):amount)+'</p></div></section>';
    }
    return '<section class="events-package-summary" aria-live="polite">'
      +'<h4>'+esc(t(packageOption?'packageTotal':complete?'groupTotal':'pending'))+'</h4>'
      +'<p class="events-package-summary__amount">'+esc(amount)+'</p>'
      +(!packageOption?'<p>'+esc(t("services"))+': '+esc(calculation.serviceCount===null?t("unknown"):calculation.serviceCount)+'</p>':'')
      +(packageOption||calculation.calculationModel==='ordinary_services'&&price.pricedSubtotal===null?[]:price.automaticAddOns||[]).map(line=>'<p>'+esc(t("additional"))+': '+esc(money(line.totalMinorUnits,price.currency))+'</p>').join('')
      +(calculation.pendingCodes.length?'<p class="events-package-help">'+esc(t("pending"))+'</p>':'')
      +(coordinationFields.length?'<p class="events-package-help">'+esc(coordinationFields.join(', '))+': '+esc(t('ordinaryDeferred'))+'</p>':calculation.coordinationPendingCodes?.length?'<p class="events-package-help">'+esc(t('pending'))+': '+esc(t('ordinaryDeferred'))+'</p>':'')
      +conditions
      +(surface==='mobile-config'?'':'<p class="events-package-help">'+esc(t("notBooking"))+'</p>')
      +'</section>';
  }
  function mobileAirportOption(option){
    return !!option&&option.calculationModel==='ordinary_services'&&option.services.length>0&&option.services.every(service=>['airport_transfer','direct_transfer'].includes(service.ordinary?.baseService));
  }
  function mobileAirportQuoteCard(state,option,locked){
    const calculation=state.quote?.calculation;
    const price=calculation?.priceBreakdown;
    // The existing van fare bands describe a category, never an assigned vehicle.
    const band=calculation?.passengerBand||state.selection?.passengerBand;
    const vehicle=window.PixkuyEventsMobileVehicleGallery?.getVehicle?.();
    if((!mobileAirportOption(option)&&!H.configured(state))||!['van_1_2','van_3_4','van_5_6'].includes(band)||vehicle?.id!=='byd_m9'||!vehicle.images?.length||!airportCanReview(state)||price?.priceStatus!=='quoted'||price.pricedSubtotal===null||price.pricedSubtotal===undefined)return '';
    const formatted=money(price.pricedSubtotal,price.currency);
    const currency=String(price.currency||'MXN');
    const suffix=' '+currency;
    if(!formatted.endsWith(suffix))return '';
    const amount=formatted.slice(0,-suffix.length);
    return '<section class="events-package-vehicle-card" aria-label="'+esc(t('vehicleCategoryLabel'))+'">'
      +'<button type="button" class="events-package-vehicle-card__gallery" data-package-action="vehicle-gallery" aria-haspopup="dialog" aria-label="'+esc(t('vehicleGalleryOpen'))+'">'
      +'<img class="events-package-vehicle-card__image" src="'+esc(vehicle.images[0].src)+'" alt="'+esc(t('vehicleCategoryLabel'))+'" loading="lazy" decoding="async">'
      +'<span class="events-package-vehicle-card__gallery-label">'+esc(t('vehicleGalleryOpen'))+'</span></button>'
      +'<p class="events-package-vehicle-card__vehicle">'+esc(t('vehicleCategoryLabel'))+'</p>'
      +'<div class="events-package-vehicle-card__fare"><span>'+esc(t('packageTotal'))+'</span><strong><span>'+esc(amount)+'</span><span class="events-package-vehicle-card__currency">'+esc(currency)+'</span></strong></div>'
      +button(configuredDirectOption(state)||H.configured(state)?'airport-review':'contact',t('continueContact'),locked,'primary')+'</section>';
  }
  Object.assign(fallback,{"mobileBackToPackage":"Volver al paquete","mobileTripStep":"Paso 2 de 3 · Datos del viaje","mobileJourneyDate":"Fecha de ida y regreso","mobileMissingJourneyField":"Complete el horario de {field} de {date}."});
  function mobileQuoteMessage(state,view){
    if(state.quoteStatus==='loading')return t('transferCalculating');
    if(state.quoteStatus==='error')return t('error');
    const ready=airportQuoteReadiness(state,view);
    if(ready.invalid.length)return t('desktopInvalid');
    if(!ready.missing.length)return t('automaticQuotePending');
    if(view.multiJourney){
      if(!state.selection.passengerBand&&!resolvedOrdinaryValues(view.service,state).origin)return t('desktopCompleteShared');
      const onlyTimes=ready.missing.every(label=>[t('directOutboundTime'),t('directReturnTime')].includes(label));
      if(onlyTimes){
        for(const pair of view.pairs)for(const service of [pair.service,pair.returning]){
          const values=resolvedOrdinaryValues(service,state);
          if(service.ordinary.inputs.time?.source==='customer'&&!values.time)return t('mobileMissingJourneyField',{date:desktopDate(values.date),field:t(service===pair.returning?'returnHeading':'outboundHeading')});
        }
      }
    }
    return t('desktopCompleteFields',{fields:ready.missing.slice(0,3).join(', ')});
  }
  function mobileCalculationContent(state,option,locked){
    const automaticView=configuredAirportOption(state)||configuredDirectOption(state)||H.configured(state);
    if(!automaticView||automaticView.option!==option)return summary(state,'mobile-config')+calculationControls(state,locked);
    const card=mobileAirportQuoteCard(state,option,locked);
    if(card)return card;
    const hourlyProblem=automaticView.hourly&&H.firstProblem(state);
    if(hourlyProblem&&state.quoteStatus!=='error')return '<p class="events-package-status">'+esc(t(H.readiness(state,automaticView).invalid.length?'hourlyCheckDay':'hourlyComplete'))+'</p>'+(automaticView.services.length>1&&/ordinary-(origin|time|baggageCount)$/.test(hourlyProblem)?button('hourly-fix',t('hourlyCheckData'),locked,'quiet'):'')+button('airport-review',t('continueContact'),true,'primary');
    const calculation=state.quoteStatus==='ready'?state.quote?.calculation:null;
    if(calculation?.coverageStatus==='outside'){let content='<p class="events-package-alert" role="alert">'+esc(t('ordinaryOutside'))+'</p>';if(state.selectedEvent.snapshot.customInquiryEnabled)content+=button('ordinary-custom',t('custom'),locked,'secondary');return content;}
    const current=airportCanReview(state),price=current?calculation?.priceBreakdown:null;
    const amount=price?.pricedSubtotal!==null&&price?.pricedSubtotal!==undefined?'<p class="events-package-summary__amount"><span>'+esc(t('packageTotal'))+'</span> '+esc(money(price.pricedSubtotal,price.currency))+'</p>':'';
    const message=current?(price?.priceStatus==='quoted'?'':t('pending')):mobileQuoteMessage(state,automaticView);
    return amount+(message?'<p class="events-package-status" role="status">'+esc(message)+'</p>':'')+(state.quoteStatus==='error'?button('retry-quote',t('retryCalculation'),locked,'secondary'):'')+(!current||price?.priceStatus==='quoted'||configuredDirectOption(state)?button(configuredDirectOption(state)||H.configured(state)?'airport-review':'contact',t('continueContact'),locked||!current,'primary'):'');
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
    return '<div class="services-events-panel__event-media"><picture>'+(mobile?'<source media="(max-width: 720px)" srcset="'+esc(mobile)+'">':'')+'<img class="services-events-panel__event-image" src="'+esc(main)+'" width="'+esc(event.snapshot.media.main.width)+'" height="'+esc(event.snapshot.media.main.height)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async"></picture></div>';
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
  function packageCard(event,mobile=false){
    const hasPackages=activePackages(event).length>0;
    const fromPrice=event.fromPrice;
    const selected=C.state.screen!=='catalog'&&C.state.selectedEvent?.id===event.id;
    const actionClass='events-package-button events-package-button--primary'+(mobile?'':' services-events-panel__event-cta');
    const actions='<div class="events-package-card__actions">'
      +(hasPackages?'<button type="button" class="'+actionClass+'" data-package-event="'+esc(event.id)+'">'+esc(t('viewPackages'))+'</button>':'')
      +(!hasPackages&&event.snapshot.customInquiryEnabled?'<button type="button" class="'+actionClass+'" data-package-custom="'+esc(event.id)+'">'+esc(t('proposal'))+'</button>':'')
      +'</div>';
    return '<article class="services-events-panel__event events-package-card'+(selected?' is-selected':'')+'" data-package-card="'+esc(event.id)+'" role="listitem">'
      +eventMedia(event)
      +'<div class="services-events-panel__event-body">'
      +'<p class="services-events-panel__event-type">'+esc(eventType(event))+'</p>'
      +'<h4 class="services-events-panel__event-title">'+esc(eventTitle(event))+'</h4>'
      +eventMetadata(event)
      +'<div class="services-events-panel__event-footer">'
      +(fromPrice?'<div class="services-events-panel__event-price"><span>'+esc(sharedEventText(['services','cards','events','panel','priceFromLabel'],'Desde'))+'</span><strong>'+esc(money(fromPrice.minorUnits,fromPrice.currency))+'</strong></div>':'<span aria-hidden="true"></span>')
      +(mobile?'':actions)+'</div></div>'+(mobile?actions:'')+'</article>';
  }
  function catalog(state,mobile=false){
    if(state.catalogStatus==='loading')return '<p class="events-package-catalog__status" role="status">'+esc(t("loading"))+'</p>';
    if(state.catalogStatus==='error')return '<div class="events-package-catalog__status"><p role="alert">'+esc(t("error"))+'</p>'+button('reload',t('retry'),false,'secondary')+'</div>';
    // The ordinary Events surface owns the single empty message for both catalogs.
    // Loading and errors remain local to each source, including their retry actions.
    if(state.events.length===0)return '';
    return '<div class="events-package-offers" role="list" aria-label="'+esc(t('title'))+'">'+state.events.map(event=>packageCard(event,mobile)).join('')+'</div>';
  }
  function customStrip(state){
    const events=state.events.filter(e=>e.snapshot.customInquiryEnabled);
    if(!events.length)return '';
    return '<section class="events-package-custom-strip"><div><h3>'+esc(t('customTitle'))+'</h3><p>'+esc(t('customIntro'))+'</p></div>'+button('custom-entry',t('proposal'),false,'secondary')+(state.customPicker?'<div class="events-package-custom-picker"><p>'+esc(t('selectEvent'))+'</p>'+events.map(e=>'<button type="button" class="events-package-button events-package-button--secondary" data-package-custom="'+esc(e.id)+'">'+esc(eventTitle(e))+'</button>').join('')+'</div>':'')+'</section>';
  }
  const activePackages=event=>(event.snapshot.packages||[]).filter(p=>p.active!==false);
  const activeOptions=pkg=>pkg.options.filter(o=>o.active!==false);
  // Exploration is presentation state, separate from the accepted selection/quote.
  Object.assign(fallback,{allPackages:'Ver todos los paquetes',packageCount:'Paquetes disponibles: {count}'});
  const mobilePackageViews=new Map();
  function mobilePackageView(state){
    const key=state.selectedEvent.id+':'+state.selectedEvent.publicationVersion;
    if(!mobilePackageViews.has(key))mobilePackageViews.set(key,{packageId:'',options:{},scrollTop:0});
    return mobilePackageViews.get(key);
  }
  function mobilePackageSelection(state,header){
    const view=mobilePackageView(state),packages=activePackages(state.selectedEvent).filter(pkg=>activeOptions(pkg).length);
    const pkg=packages.find(item=>item.id===view.packageId);
    if(pkg){
      const optionId=view.options[pkg.id]??(state.selection.packageId===pkg.id?state.selection.optionId:'');
      return '<div class="events-package-step-one events-package-mobile-detail">'+header+offer(state,'mobile',{packageId:pkg.id,optionId})+'</div>';
    }
    const footer=state.selectedEvent.snapshot.customInquiryEnabled?'<div class="events-package-offer-footer"><p>'+esc(t('customTitle'))+'</p>'+button('ordinary-custom',t('proposal'),false,'secondary')+'</div>':'';
    return '<section class="events-package-step-one events-package-mobile-list">'+header+'<div class="events-package-mobile-list__heading"><h3 class="events-package-offer-heading" tabindex="-1" data-package-step-heading>'+esc(t('choosePackage'))+'</h3><p class="events-package-mobile-list__count">'+esc(t('packageCount',{count:packages.length}))+'</p></div><ul>'+packages.map(pkg=>{
      const brief=local(pkg.subtitle);
      return '<li><button type="button" class="events-package-mobile-list__row" data-package-browse="'+esc(pkg.id)+'">'+mobilePackageIcon(state,pkg)+'<span class="events-package-mobile-list__copy"><strong>'+esc(local(pkg.title))+'</strong>'+(brief?'<span>'+esc(brief)+'</span>':'')+'</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg></button></li>';
    }).join('')+'</ul>'+(!packages.length?'<p>'+esc(t('empty'))+'</p>':'')+footer+'</section>';
  }
  function returnToPackageDetail(root){
    if(root.getAttribute('data-event-package-root')==='mobile'&&C.state.selection?.requestKind==='package'){
      const view=mobilePackageView(C.state);view.packageId=C.state.selection.packageId;
      if(C.state.selection.optionId)view.options[view.packageId]=C.state.selection.optionId;
    }
    return C.go('package');
  }
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
    return (conditionsOnly?'':'<section><'+heading+'>'+esc(t('inclusions'))+' ('+inclusions.length+')</'+heading+'><ul>'+inclusions.map(i=>inclusionHighlight(i,true)).join('')+'</ul></section>')+'<section><'+heading+'>'+esc(t('conditions'))+' ('+conditions.length+')</'+heading+'><ul>'+conditions.map(condition).join('')+'</ul></section>';
  }
  function offerDisclosures(event,pkg,surface){
    if(surface==='mobile')return '<details class="events-package-offer__disclosure"><summary>'+esc(t('mobileViewDetails'))+'</summary><div class="events-package-offer__details"><p class="events-package-offer__description">'+esc(local(pkg.description))+'</p>'+packageDetailsContent(event,pkg,false)+'</div></details>';
    return '<details class="events-package-offer__disclosure"><summary>'+esc(t('viewAllDetails'))+'</summary><div class="events-package-offer__details">'+packageDetailsContent(event,pkg,false)+'</div></details>';
  }
  // Fixed local vector vocabulary; no editor-provided markup or URL is rendered.
  const inclusionIconPaths={
    calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 17h2M12 17h2',
    plane:'M2.5 16.5L10 14l4-8.5a1.4 1.4 0 1 1 2.5 1.2L13.8 15l5.7 2.1a1 1 0 0 1-.3 1.9h-4.6l-2.4 3.2a.9.9 0 0 1-1.6-.5v-4.1l-7-1.6a.8.8 0 0 1-.1-1.5Z',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    round_trip:'M4 7h16l-4-4M20 7l-4 4M20 17H4l4-4M4 17l4 4',
    clock:'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0ZM12 7.8v4.6l3.1 1.9'
  };
  function inclusionHighlight(inclusion,fullText){
    const path=Object.prototype.hasOwnProperty.call(inclusionIconPaths,inclusion.iconId)?inclusionIconPaths[inclusion.iconId]:null;
    const icon=path?'<svg class="events-package-offer__highlight-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+path+'"/></svg>':'';
    return '<li'+(fullText&&path?' class="events-package-inclusion"':'')+'>'+icon+'<span>'+esc(fullText?local(inclusion):(local(inclusion.summary)||local(inclusion)))+'</span></li>';
  }
  function optionDirectView(state,pkg,option){return configuredDirectOption({...state,step:'services',screen:'config',selection:{...state.selection,requestKind:'package',packageId:pkg.id,optionId:option.id}});}
  function optionAirportView(state,pkg,option){
    return configuredAirportOption({...state,step:'services',screen:'config',selection:{...state.selection,requestKind:'package',packageId:pkg.id,optionId:option.id}});
  }
  function mobilePackageIcon(state,pkg){
    // All active options must share one capability: Airport, explicit shared-origin
    // Direct journeys, or a single Direct pair. Titles/inclusions are not semantics.
    // Mixed, unsupported or empty compositions use the neutral passenger symbol.
    const options=activeOptions(pkg);
    const views=options.map(option=>optionDirectView(state,pkg,option));
    const key=options.length&&options.every(option=>optionAirportView(state,pkg,option))?'plane':views.length&&views.every(view=>view?.multiJourney)?'calendar':views.length&&views.every(view=>view&&!view.multiJourney)?'round_trip':'users';
    return '<svg class="events-package-mobile-list__icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+inclusionIconPaths[key]+'"/></svg>';
  }
  function optionRouteCaption(state,pkg,option,surface){
    if(surface==='mobile')return '';
    const view=optionAirportView(state,pkg,option);
    return view?'<span class="events-package-option-route">'+esc(t(view.returning?'roundTripRoute':view.arrival?'arrivalRoute':'returnRoute'))+'</span>':'';
  }
  function offer(state,surface,exploration){
    const event=state.selectedEvent;
    const packages=activePackages(event).filter(pkg=>!exploration||pkg.id===exploration.packageId);
    return '<div class="events-package-offer-grid'+(packages.length===1?' events-package-offer-grid--single':'')+'">'+packages.map(pkg=>{
      const options=activeOptions(pkg);const selected=state.selection.packageId===pkg.id;
      const chosen=exploration?options.find(o=>o.id===exploration.optionId):selected?options.find(o=>o.id===state.selection.optionId):surface==='mobile'?null:options.find(o=>o.id===C.rememberedOption?.(pkg.id));
      const optionField=exploration?'data-package-browse-option':'data-package-field="option"';
      let alternatives='';
      if(options.length>1){
        if(options.length<=4)alternatives='<fieldset class="events-package-options"><legend>'+esc(t('option'))+'</legend>'+options.map(o=>'<label class="events-package-check"><input type="radio" name="package-option" '+optionField+' data-package-option-package="'+esc(pkg.id)+'" value="'+esc(o.id)+'"'+(o.id===chosen?.id?' checked':'')+'><span>'+esc(local(o.title))+optionRouteCaption(state,pkg,o,surface)+'</span></label>').join('')+'</fieldset>';
        else alternatives='<label class="events-package-field"><span>'+esc(t('option'))+'</span><select '+optionField+' data-package-option-package="'+esc(pkg.id)+'">'+optionHtml('',t('choose'),!chosen)+options.map(o=>optionHtml(o.id,local(o.title),o===chosen)).join('')+'</select></label>';
      }
      const detail=chosen||(options.length===1?options[0]:null);
      const additionalIds=new Set((event.snapshot.addOns||[]).filter(a=>a.packageId===pkg.id&&a.optionIds.includes(detail?.id)&&a.kind!=='airport_leg_supplement').flatMap(a=>a.serviceIds));
      const includedServices=detail?.services.filter(s=>!additionalIds.has(s.id))||[];
      const isTransfer=detail&&includedServices.length>0&&includedServices.every(service=>detail.calculationModel==='ordinary_services'?['airport_transfer','direct_transfer'].includes(service.ordinary?.baseService):service.kind==='trip');
      const transferLabel=isTransfer?(includedServices.length===1?t('transferOne'):t('transferMany',{count:includedServices.length})):t('services')+': '+includedServices.length;
      const mode=detail?'<section class="events-package-offer__mode">'+(surface==='mobile'?'<h5>'+esc(t('modeAvailable'))+'</h5>':'')+'<p>'+esc(local(detail.title))+(includedServices.length&&!optionDirectView(state,pkg,detail)?' · '+esc(transferLabel):'')+'</p>'+optionRouteCaption(state,pkg,detail,surface)+'</section>':'';
      const subtitle=local(pkg.subtitle);
      if(surface==='mobile'){
        const singleMode=options.length===1?'<section class="events-package-offer__mode"><p>'+esc(local(detail.title))+'</p></section>':'';
        const linkedPrice=detail?detail.calculationModel==='ordinary_services':options.length&&options.every(option=>option.calculationModel==='ordinary_services');
        const price=linkedPrice?'<p class="events-package-help">'+esc(t('mobilePriceByDetails'))+'</p>':optionPrice(detail);
        const transfer=detail?(optionAirportView(state,pkg,detail)||optionDirectView(state,pkg,detail)):options.length&&options.every(option=>optionAirportView(state,pkg,option)||optionDirectView(state,pkg,option));
        return '<article class="events-package-offer"><div class="events-package-offer__content"><h4'+(exploration?' tabindex="-1" data-package-step-heading':'')+'>'+esc(local(pkg.title))+'</h4>'+(subtitle?'<p class="events-package-offer__subtitle">'+esc(subtitle)+'</p>':'')+singleMode+alternatives+offerDisclosures(event,pkg,surface)+'</div><div class="events-package-offer__controls">'+price+'<button type="button" class="events-package-button events-package-button--primary" data-package-configure="'+esc(pkg.id)+'">'+esc(t(transfer?'completeTransfer':'completeRequest'))+'</button></div></article>';
      }
      return '<article class="events-package-offer"><div class="events-package-offer__content"><h4'+(exploration?' tabindex="-1" data-package-step-heading':'')+'>'+esc(local(pkg.title))+'</h4>'+(subtitle?'<p class="events-package-offer__subtitle">'+esc(subtitle)+'</p>':'')+'<p class="events-package-offer__description">'+esc(local(pkg.description))+'</p>'+mode+'<ul class="events-package-offer__highlights">'+pkg.inclusions.slice(0,3).map(i=>inclusionHighlight(i,false)).join('')+'</ul>'+offerDisclosures(event,pkg,surface)+'</div><div class="events-package-offer__controls">'+optionPrice(detail)+alternatives+'<button type="button" class="events-package-button events-package-button--primary" data-package-configure="'+esc(pkg.id)+'">'+esc(t((detail?(optionAirportView(state,pkg,detail)||optionDirectView(state,pkg,detail)):options.length&&options.every(o=>optionAirportView(state,pkg,o)||optionDirectView(state,pkg,o)))?'completeTransfer':'completeRequest'))+'</button></div></article>';
    }).join('')+'</div>'+(!exploration&&event.snapshot.customInquiryEnabled?'<div class="events-package-offer-footer"><div><h4>'+esc(t('customTitle'))+'</h4><p>'+esc(t('customStepIntro'))+'</p></div>'+button('ordinary-custom',t('proposal'),false,'secondary')+'</div>':'');
  }
  function packageDetailsFocusables(){return packageDetailsDialog?Array.from(packageDetailsDialog.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(node=>!node.hidden):[];}
  function closePackageDetailsDialog(){
    roots.forEach(root=>{if(root.getAttribute('data-event-package-root')==='mobile'){root.closePackageAirport?.();window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));}});
    if(!packageDetailsDialog||packageDetailsDialog.hidden)return false;
    const configConditions=packageDetailsDialog.hasAttribute('data-package-config-dialog');
    packageDetailsDialog.hidden=true;packageDetailsDialog.setAttribute('aria-hidden','true');document.body.setAttribute('data-events-package-details-dialog-active','false');
    if(packageDetailsPreviousFocus&&document.contains(packageDetailsPreviousFocus))packageDetailsPreviousFocus.focus({preventScroll:true});
    packageDetailsPreviousFocus=null;if(configConditions)refreshAirportQuote();roots.forEach(refreshMobileReview);return true;
  }
  function ensurePackageDetailsDialog(){
    if(packageDetailsDialog)return packageDetailsDialog;
    const dialog=document.createElement('section');dialog.className='events-package-details-dialog';dialog.setAttribute('data-events-package-details-dialog','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-hidden','true');dialog.setAttribute('aria-labelledby','events-package-details-dialog-title');dialog.hidden=true;
    dialog.innerHTML='<button type="button" class="events-package-details-dialog__backdrop" data-package-details-close tabindex="-1"></button><section class="events-package-details-dialog__panel" role="document"><header><div><h2 id="events-package-details-dialog-title"></h2><p data-package-details-context></p></div><button type="button" class="events-package-details-dialog__close" data-package-details-close aria-label="'+esc(t('close'))+'">×</button></header><div class="events-package-details-dialog__body" data-package-details-body></div></section>';
    dialog.addEventListener('click',event=>{if(event.target.closest('[data-package-details-close]')){event.preventDefault();closePackageDetailsDialog();}});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(dialog.hasAttribute('data-package-config-dialog')||dialog.hasAttribute('data-package-review-dialog')||dialog.hasAttribute('data-package-receipt-dialog'))event.stopPropagation();closePackageDetailsDialog();return;}if(event.key!=='Tab')return;const focusable=packageDetailsFocusables();if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
    document.body.appendChild(dialog);packageDetailsDialog=dialog;return dialog;
  }
  function openPackageDetailsDialog(root,pkgId,trigger){
    if(root.getAttribute('data-event-package-root')!=='mobile'||!window.matchMedia('(max-width:720px)').matches)return false;
    const event=C.state.selectedEvent;if(!event)return false;const pkg=activePackages(event).find(item=>item.id===pkgId);if(!pkg)return false;
    const dialog=ensurePackageDetailsDialog();const title=dialog.querySelector('#events-package-details-dialog-title');const context=dialog.querySelector('[data-package-details-context]');const body=dialog.querySelector('[data-package-details-body]');const close=dialog.querySelector('[data-package-details-close]:not([tabindex="-1"])');
    if(!title||!context||!body||!close)return false;
    dialog.removeAttribute('data-package-receipt-dialog');
    const configConditions=trigger?.hasAttribute('data-package-config-conditions');
    if(configConditions){window.PixkuyEventsMobileVehicleGallery?.close?.();dialog.setAttribute('data-package-config-dialog','');}else dialog.removeAttribute('data-package-config-dialog');
    const reviewConditions=trigger?.hasAttribute('data-package-review-conditions');
    dialog.toggleAttribute('data-package-review-dialog',!!reviewConditions);
    const conditionsOnly=reviewConditions||trigger?.hasAttribute('data-package-conditions-only');
    const option=reviewConditions?activeOptions(pkg).find(item=>item.id===C.state.selection?.optionId):null;
    title.textContent=configConditions||reviewConditions?t('desktopConditions'):conditionsOnly?t('conditions'):t('inclusions')+' · '+t('conditions');context.textContent=[eventTitle(event),local(pkg.title),option&&local(option.title)].filter(Boolean).join(' · ');body.innerHTML=packageDetailsContent(event,pkg,true,conditionsOnly,reviewConditions?(C.state.quote?.calculation?.conditions||[]):undefined);body.scrollTop=0;packageDetailsPreviousFocus=trigger||document.activeElement;dialog.hidden=false;dialog.setAttribute('aria-hidden','false');document.body.setAttribute('data-events-package-details-dialog-active','true');close.focus({preventScroll:true});return true;
  }
  function openReceiptConditions(root,trigger){
    const receipt=C.state.receipt;
    if(!receipt||root.getAttribute('data-event-package-root')!=='mobile'||!window.matchMedia('(max-width:720px)').matches)return false;
    window.PixkuyEventsMobileVehicleGallery?.close?.();
    const dialog=ensurePackageDetailsDialog();
    dialog.removeAttribute('data-package-config-dialog');dialog.removeAttribute('data-package-review-dialog');dialog.setAttribute('data-package-receipt-dialog','');
    dialog.querySelector('#events-package-details-dialog-title').textContent=t('desktopConditions');
    dialog.querySelector('[data-package-details-context]').textContent=[local(receipt.confirmation?.eventTitle)||receipt.eventTitle,local(receipt.confirmation?.packageTitle)||receipt.packageTitle].filter(Boolean).join(' · ');
    const body=dialog.querySelector('[data-package-details-body]');
    body.innerHTML=packageDetailsContent(null,{},true,true,receipt.confirmation?.conditions||[]);body.scrollTop=0;
    packageDetailsPreviousFocus=trigger;dialog.hidden=false;dialog.setAttribute('aria-hidden','false');document.body.setAttribute('data-events-package-details-dialog-active','true');
    dialog.querySelector('[data-package-details-close]:not([tabindex="-1"])').focus({preventScroll:true});return true;
  }
  function navigation(state,surface){
    if(state.selection.requestKind==='custom')return button('packages',t('viewPackages'),false,'quiet');
    if(surface==='mobile'&&state.step==='package')return '';
    const steps=surface==='mobile'?['package','services','review']:['package','services'];
    return '<nav class="events-package-steps" aria-label="'+esc(t('title'))+'">'+steps.map((step,index)=>'<button type="button" data-package-step="'+step+'"'+(state.step===step?' aria-current="step"':'')+((step==='services'&&!state.selection.optionId)||(step==='review'&&state.step!=='review')?' disabled':'')+'>'+(index+1)+'. '+esc(step==='review'?t('reviewContact'):t(surface==='mobile'&&step==='services'?'mobileTripData':step))+'</button>').join('')+'</nav>';
  }
  function contactHandoff(root){
    if(!airportCanReview(C.state)||!validFields(root)||!C.go('review'))return false;
    if(root.getAttribute('data-event-package-root')==='mobile'){focusDetail(root);return true;}
    window.dispatchEvent(new CustomEvent('pixkuy:events-special-panel-submit',{detail:{contextKind:'event_packages'}}));
    return true;
  }
  function localServiceDate(value,withZone=true){
    if(!value)return t('ordinaryDeferred');
    const date=new Date(value.length===10?value+'T00:00:00Z':value+'Z');
    if(!Number.isFinite(date.getTime()))return t('ordinaryDeferred');
    return new Intl.DateTimeFormat(locale(),{dateStyle:'long',...(value.length>10?{timeStyle:'short'}:{}),timeZone:'UTC'}).format(date)+(withZone?' · CDMX':'');
  }
  function resolvedOrdinaryValues(service,state){
    if(service.ordinary?.baseService==='hourly_daily'&&H.view(state))return H.values(service,state);
    const data=state.selection.services.find(item=>item.serviceId===service.id)?.ordinaryInputs||{};
    const values=Object.fromEntries(Object.entries(service.ordinary?.inputs||{}).map(([key,input])=>[key,input.source==='fixed'?(input.redacted?(input.displayLabel||t('ordinaryFixed')):input.value):input.source==='customer'?data[key]:undefined]));
    if(service.ordinary?.sharedOrigin){
      const option=state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)?.options.find(o=>o.id===state.selection.optionId);
      const source=option?.services.find(item=>item.id===service.ordinary.sharedOrigin.serviceId&&item.id!==service.id&&item.ordinary?.baseService==='direct_transfer'&&!item.ordinary.sharedOrigin&&!item.ordinary.directReturn&&!item.ordinary.airportReturn);
      if(source)values.origin=resolvedOrdinaryValues(source,state).origin;
    }
    const relation=service.ordinary?.airportReturn;
    if(relation){
      const option=state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)?.options.find(o=>o.id===state.selection.optionId);
      const arrival=option?.services.find(item=>item.id===relation.arrivalServiceId&&!item.ordinary?.airportReturn);
      if(arrival){const source=resolvedOrdinaryValues(arrival,state);values.airportId=source.airportId;values.destination=source.destination;}
    }
    const direct=service.ordinary?.directReturn;
    if(direct){
      const option=state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)?.options.find(o=>o.id===state.selection.optionId);
      const outbound=option?.services.find(item=>item.id===direct.outboundServiceId&&!item.ordinary?.directReturn&&item.ordinary?.baseService==='direct_transfer');
      if(outbound){const source=resolvedOrdinaryValues(outbound,state);values.origin=source.destination;values.destination=source.origin;if(direct.dateMode==='shared')values.date=source.date;}
    }
    return values;
  }
  function returnSchedule(state,view,mobile){
    if(!view?.returning)return '';
    const service=view.returning,data=state.selection.services.find(item=>item.serviceId===service.id)||{},prefix='service:'+service.id+':';
    const control=(key,label)=>mobile?mobileTemporalInput(service,data,prefix,key,t(label)):ordinaryInput(service,data,prefix,key,'',{label});
    return '<fieldset class="events-package-primary-form'+(mobile?'':' events-package-airport__leg')+'" data-package-airport-return="'+esc(service.id)+'"'+(window.PixkuyEventPackagesRequest.hasFrozenBody()?' disabled':'')+'><legend>'+esc(t('returnHeading'))+'</legend><div class="'+(mobile?'services-expand__form events-package-airport-return__schedule':'events-package-airport__extras')+'">'+control('date','returnDate')+control('time',mobile?'returnPickupTime':'returnHotelPickup')+'</div></fieldset>';
  }
  Object.assign(fallback,{"reviewIntro":"Revise su traslado y complete sus datos","contactDetails":"Datos de contacto","packageTotal":"Total del paquete","reviewPickup":"Recogida","reviewDestination":"Destino","reviewMode":"Modalidad","receiptRequestedTime":"Hora solicitada (CDMX)","receiptEnd":"Fin del servicio"});
  function hourlyDesktopReview(state){
    const current=H.view(state);if(!current)return '';
    return '<section class="events-package-review events-package-review--hourly-desktop"><header><p class="events-package-review__event">'+esc(eventTitle(state.selectedEvent))+'</p><div class="events-package-review__heading"><h4>'+esc(local(current.pkg.title))+'</h4>'+button('edit-services',t('editServices'),false,'quiet')+'</div><p class="events-package-review__mode">'+esc(local(current.option.title))+' · '+esc(passengerDescription(state.selection))+' '+esc(t('passengers'))+'</p>'+button('change-package',t('hourlyReviewChangePackage'),false,'quiet')+'</header>'+H.review(state,false)+'</section>';
  }
  function reviewSelectors(state,locked){
    const selection=state.selection,packages=activePackages(state.selectedEvent).filter(pkg=>activeOptions(pkg).length);
    const pkg=packages.find(item=>item.id===selection.packageId);
    const options=(pkg?.options||[]).filter(item=>item.active!==false);
    const control=(key,items,value)=>'<label class="events-package-field"><span>'+esc(t(key==='option'?'reviewMode':key))+'</span><select data-package-review-select="'+key+'"'+(locked?' disabled':'')+'><option value="" disabled'+(!value?' selected':'')+'>'+esc(t('choose'))+'</option>'+items.map(item=>'<option value="'+esc(item.id)+'"'+(item.id===value?' selected':'')+'>'+esc(local(item.title))+'</option>').join('')+'</select></label>';
    return '<div class="events-package-review__selectors">'+control('package',packages,selection.packageId)+(options.length===1?'<div class="events-package-field"><span>'+esc(t('reviewMode'))+'</span><p>'+esc(local(options[0].title))+'</p></div>':options.length?control('option',options,selection.optionId):'')+'</div>';
  }
  function reviewItinerary(state,compact,omitTitle,mobile){
    const hourly=H.review(state,mobile);if(hourly){const view=H.view(state);return '<section class="events-package-review events-package-review--compact">'+(omitTitle?'':'<h4>'+esc(local(view.pkg.title))+'</h4><p class="events-package-review__mode">'+esc(local(view.option.title))+(mobile?' · '+esc(t('passengers'))+': '+esc(passengerDescription(state.selection)):'')+'</p>')+(mobile?'':'<p>'+esc(t('passengers'))+': '+esc(passengerDescription(state.selection))+'</p>')+hourly+button('edit-services',t('editServices'),false,'quiet')+'</section>';}
    const selection=state.selection,event=state.selectedEvent;
    if(selection.requestKind==='custom')return '<p>'+esc(selection.inquiry.notes)+'</p><p>'+esc(t('passengers'))+': '+esc(selection.inquiry.passengers.count??t('unknown'))+'</p>'+button('edit-services',t('editServices'),false,'quiet');
    const pkg=activePackages(event).find(p=>p.id===selection.packageId),option=pkg?.options.find(o=>o.id===selection.optionId);
    const pair=optionDirectView(state,pkg,option)||optionAirportView(state,pkg,option);
    if(compact&&pair?.service.ordinary.baseService==='direct_transfer')return reviewDirectJourneys(state,pair,omitTitle);
    const linked=compact&&pair?.returning&&!pair.multiJourney;
    const singleAirport=compact&&pair?.service.ordinary.baseService==='airport_transfer'&&!pair.returning;
    let places='';
    if(linked||singleAirport){
      const values=resolvedOrdinaryValues(pair.service,state),airport=pair.service.ordinary.baseService==='airport_transfer';
      const ends=airport?[window.PixkuyAirportTariffCatalog?.resolveDisplayLabel('airport',String(values.airportId).toLowerCase())||displayOrdinaryValue('airportId',values.airportId),values.destination]:[values.origin,values.destination];
      places=mobile?mobileReviewPlaces(ends.map((value,i)=>[airport?(i?'address':'airport'):(i?'reviewDestination':'reviewPickup'),value])):'<dl class="events-package-review__places">'+ends.map((value,i)=>'<div><dt>'+esc(t(airport?(i?'address':'airport'):(i?'reviewDestination':'reviewPickup')))+'</dt><dd>'+esc(typeof value==='object'?value?.address||t('ordinaryFixed'):value||t('ordinaryFixed'))+'</dd></div>').join('')+'</dl>';
    }
    const title=omitTitle?'':compact?'<h4>'+esc(local(pkg?.title))+'</h4><p class="events-package-review__mode">'+esc(local(option?.title))+(mobile?' · '+esc(t('passengers'))+': '+esc(passengerDescription(selection)):'')+'</p>':'<h4>'+esc(local(pkg?.title))+' · '+esc(local(option?.title))+'</h4>';
    return '<section class="events-package-review'+(compact?' events-package-review--compact':'')+'">'+title+(mobile?'':'<p>'+esc(t('passengers'))+': '+esc(passengerDescription(selection))+'</p>')+places+'<ol>'+(state.quote?.calculation?.itinerary?.services||option?.services||[]).map((service,index)=>{
      const template=option.services.find(s=>s.id===service.id);const data=selection.services.find(s=>s.serviceId===service.id)||{};
      const endpoint=role=>data[role]||data[role+'Airport']||template?.[role]?.airportCode||(template?.[role]?.kind==='venue'?eventVenue(event):t('unknown'));
      const values=option.calculationModel==='ordinary_services'&&template?.ordinary?resolvedOrdinaryValues(template,state):{...data,from:endpoint('from'),to:endpoint('to')};
      const airport=value=>window.PixkuyAirportTariffCatalog?.resolveDisplayLabel('airport',String(value).toLowerCase())||displayOrdinaryValue('airportId',value);
      const route=values.airportId?(values.direction==='destination_to_airport'?[values.destination,airport(values.airportId)]:[airport(values.airportId),values.destination]):[values.origin||values.from,values.destination||values.to].map((value,i)=>value&&template?.ordinary?.baseService!=='direct_transfer'&&template?.[i?'to':'from']?.kind==='airport'?airport(value):value);
      const count=state.quote?.calculation?.serviceLines?.find(line=>line.serviceId===service.id)?.baggage?.count??data.ordinaryInputs?.baggageCount;
      const directView=optionDirectView(state,pkg,option);
      const airportView=directView||optionAirportView(state,pkg,option);
      if(singleAirport||airportView?.returning&&(compact||directView||!window.matchMedia('(max-width:720px)').matches)){
        const isReturn=directView?!!template?.ordinary?.directReturn:service.id===airportView.returning?.id;
        const heading=singleAirport?(values.direction==='destination_to_airport'?'confirmationDeparture':'confirmationArrival'):isReturn?'returnHeading':directView?'outboundHeading':'arrivalHeading';
        const labels=directView?['reviewPickup','reviewDestination']:['airport','address'];
        if(isReturn||singleAirport&&values.direction==='destination_to_airport')labels.reverse();
        const routeText=linked||singleAirport?labels.map(key=>esc(t(key))).join(' → '):route.filter(Boolean).map(value=>esc(typeof value==='object'?value.address||t('ordinaryFixed'):value)).join(' → ');
        return '<li class="events-package-review__leg"><h5>'+esc(t(heading))+'</h5><p class="events-package-review__route">'+routeText+'</p><p class="events-package-review__time">'+esc(service.startsAtUtc?receiptServiceTime(service.startsAtUtc):localServiceDate(service.startLocal||[values.date,values.time].filter(Boolean).join('T')))+'</p>'+(values.flight?'<span>'+esc(t('flight'))+': '+esc(values.flight)+'</span>':'')+(count!==undefined?'<span>'+esc(t('baggageCount'))+': '+esc(count)+'</span>':'')+'</li>';
      }
      return '<li><strong>'+esc(airportView?.returning?quoteServiceLabel(state,service.id):t('serviceLabel')+' '+(index+1))+'</strong><span>'+esc(localServiceDate(service.startLocal||[values.date,values.time].filter(Boolean).join('T')))+'</span><span>'+route.filter(Boolean).map(value=>esc(typeof value==='object'?value.address||t('ordinaryFixed'):value)).join(' → ')+'</span>'+(values.flight?'<span>'+esc(t('flight'))+': '+esc(values.flight)+'</span>':'')+(count!==undefined?'<span>'+esc(t('baggageCount'))+': '+esc(count)+'</span>':'')+'</li>';
    }).join('')+'</ol>'+button('edit-services',t(option.services.length===1?'editTransfer':'editTransfers'),false,'quiet')+'</section>';
  }
  function reviewDirectJourneys(state,view,omitTitle){
    const root=resolvedOrdinaryValues(view.service,state),common=desktopCommonDestination(view,state);
    const days=view.pairs.map(pair=>{
      const out=resolvedOrdinaryValues(pair.service,state),back=resolvedOrdinaryValues(pair.returning,state);
      const schedule=(service,value,isReturn)=>{
        const count=state.quote?.calculation?.serviceLines?.find(line=>line.serviceId===service.id)?.baggage?.count??value.baggageCount;
        return '<td>'+((isReturn&&!pair.sharedDate)||value.date!==out.date?'<span class="events-package-review-table__date">'+esc(desktopDate(value.date))+'</span>':'')+'<span class="events-package-review-table__time">'+esc(value.time||t('unknown'))+'</span>'+(count===undefined?'':'<p class="events-package-help">'+esc(t('baggageCount'))+': '+esc(count)+'</p>')+'</td>';
      };
      return '<tr><th scope="row">'+esc(desktopDate(out.date))+(!common?desktopDestination(out.destination):'')+'</th>'+schedule(pair.service,out,false)+schedule(pair.returning,back,true)+'</tr>';
    }).join('');
    return '<section class="events-package-review events-package-review--compact">'+(omitTitle?'':'<h4>'+esc(local(view.pkg.title))+'</h4><p>'+esc(local(view.option.title))+'</p>')+'<p>'+esc(t('passengers'))+': '+esc(passengerDescription(state.selection))+'</p><dl class="events-package-review__places"><div><dt>'+esc(t('reviewPickup'))+'</dt><dd>'+esc(typeof root.origin==='string'?root.origin:root.origin?.address||t('ordinaryFixed'))+'</dd></div></dl>'+(common?desktopDestination(common):'')+'<p class="events-package-help">'+esc(t('directReturnToPickup'))+' · '+esc(t('sharedLocalTime'))+'</p><table class="events-package-review-table"><thead><tr><th scope="col">'+esc(t('desktopJourney'))+'</th><th scope="col">'+esc(t('outboundHeading'))+'</th><th scope="col">'+esc(t('returnHeading'))+'</th></tr></thead><tbody>'+days+'</tbody></table>'+button('edit-services',t('editTransfers'),false,'quiet')+'</section>';
  }
  Object.assign(fallback,{mobileReviewBack:'Volver a datos del viaje',mobileReviewStep:'Paso 3 de 3 · Revisión y contacto',mobileFullAddresses:'Ver direcciones completas'});
  function mobileReviewDate(value){const date=localDate(value);return date?new Intl.DateTimeFormat(locale(),{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date):t('unknown');}
  function mobileReviewPlaces(entries){
    const address=value=>typeof value==='string'?value:value?.address||t('ordinaryFixed');
    return '<dl class="events-package-review__places">'+entries.map(([label,value])=>'<div><dt>'+esc(t(label))+'</dt><dd>'+esc(address(value))+'</dd></div>').join('')+'</dl>';
  }
  function mobileReviewItinerary(state){
    const pkg=activePackages(state.selectedEvent).find(p=>p.id===state.selection.packageId),option=pkg?.options.find(o=>o.id===state.selection.optionId);
    const view=optionDirectView(state,pkg,option);
    if(!view)return reviewItinerary(state,true,false,true);
    const common=desktopCommonDestination(view,state),origin=resolvedOrdinaryValues(view.service,state).origin;
    const rows=view.pairs.map(pair=>{
      const out=resolvedOrdinaryValues(pair.service,state),back=resolvedOrdinaryValues(pair.returning,state);
      const schedule=(service,value,isReturn)=>{
        const count=state.quote?.calculation?.serviceLines?.find(line=>line.serviceId===service.id)?.baggage?.count??value.baggageCount;
        return '<td data-package-review-service="'+esc(service.id)+'">'+(isReturn&&(!pair.sharedDate||value.date!==out.date)?'<span class="events-package-review-table__date">'+esc(mobileReviewDate(value.date))+'</span>':'')+'<span class="events-package-review-table__time">'+esc(value.time||t('unknown'))+'</span>'+(count===undefined?'':'<p class="events-package-help">'+esc(t('baggageCount'))+': '+esc(count)+'</p>')+'</td>';
      };
      return '<tr><th scope="row">'+esc(mobileReviewDate(out.date))+(!common?mobileReviewPlaces([['reviewDestination',out.destination]]):'')+'</th>'+schedule(pair.service,out,false)+schedule(pair.returning,back,true)+'</tr>';
    }).join('');
    return '<section class="events-package-review events-package-review--compact"><h4>'+esc(local(pkg.title))+'</h4><p class="events-package-review__mode">'+esc(local(option.title))+' · '+esc(t('passengers'))+': '+esc(passengerDescription(state.selection))+'</p>'+mobileReviewPlaces([['reviewPickup',origin],...(common?[['reviewDestination',common]]:[])])+'<p class="events-package-help">'+esc(t('directReturnToPickup'))+'</p><table class="events-package-review-table"><thead><tr><th scope="col">'+esc(t('desktopJourney'))+'</th><th scope="col">'+esc(t('outboundHeading'))+'</th><th scope="col">'+esc(t('returnHeading'))+'</th></tr></thead><tbody>'+rows+'</tbody></table><p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p>'+button('edit-services',t('editTransfers'),false,'secondary')+'</section>';
  }
  function refreshMobileReview(root){
    if(root.getAttribute('data-event-package-root')!=='mobile'||C.state.screen!=='contact')return;
    const current=airportCanReview(C.state),amount=root.querySelector('[data-package-mobile-review-result] .events-package-summary__amount'),submit=root.querySelector('[data-package-action="submit"]');
    if(!current&&amount)amount.textContent=t('reviewChanged');
    if(submit){submit.disabled=!current||window.PixkuyEventPackagesRequest.hasFrozenBody()||C.state.requestStatus==='submitting';submit.setAttribute('aria-disabled',String(submit.disabled));}
  }
  function scheduleMobileReviewExpiry(root){
    if(root.packageReviewExpiryTimer)window.clearTimeout(root.packageReviewExpiryTimer);
    root.packageReviewExpiryTimer=null;
    if(root.getAttribute('data-event-package-root')!=='mobile'||C.state.screen!=='contact')return;
    refreshMobileReview(root);
    const expiry=Math.min(...(C.state.quote?.calculation?.serviceLines||[]).map(line=>Date.parse(line.included?.quoteExpiresAt)).filter(Number.isFinite));
    if(Number.isFinite(expiry)&&expiry>Date.now())root.packageReviewExpiryTimer=window.setTimeout(()=>refreshMobileReview(root),Math.min(expiry-Date.now()+10,2147483647));
  }
  function mobileReviewContact(state){
    const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';
    const contact=state.contact||{},hourly=!!H.view(state);
    const phoneLabel=i18nText('airportMobileContactStep.fields.phone',t('phone'));
    const phonePlaceholder=i18nText('airportMobileContactStep.placeholders.phone','');
    return '<section class="events-package-mobile-contact'+(hourly?' events-package-mobile-contact--hourly':'')+'" data-package-mobile-contact>'
      +'<header class="events-package-config__header events-package-mobile-contact__header">'+button('back',t('mobileReviewBack'),locked,hourly?'quiet':'secondary')+'<h3 tabindex="-1" data-package-heading>'+esc(eventTitle(state.selectedEvent))+'</h3><p>'+esc(t('mobileReviewStep'))+'</p></header>'
      +mobileReviewItinerary(state)+'<form data-package-mobile-contact-form novalidate>'
      +'<fieldset class="events-package-mobile-contact__fields"'+(locked?' disabled':'')+'><legend>'+esc(t('contactDetails'))+'</legend>'
      +contactField('name',i18nText('airportMobileContactStep.fields.name',t('name')),contact.name,'text','required minlength="2" maxlength="180" autocomplete="name"')
      +contactField('phone',phoneLabel,contact.phone,'tel','required autocomplete="tel" inputmode="tel" autocapitalize="off" spellcheck="false" placeholder="'+esc(phonePlaceholder)+'"','airportMobileContactStep.validation.phone')
      +contactField('email',t('email'),contact.email,'email','required maxlength="254" autocomplete="email" inputmode="email"')
      +'</fieldset><div data-package-mobile-review-result>'+summary(state,'mobile-review')+'</div>'
      +'<div class="events-package-mobile-contact__actions"><button type="submit" class="events-package-button events-package-button--primary" data-package-action="submit"'+(locked||!airportCanReview(state)?' disabled aria-disabled="true"':'')+'>'+esc(state.requestStatus==='submitting'?t('sending'):t('submit'))+'</button></div><p class="events-package-mobile-contact__privacy">'+esc(i18nText('contact.footer',''))+'</p></form></section>';
  }
  Object.assign(fallback,{"directPickupAddress": "Alojamiento o dirección de recogida", "directReturnToLodging": "Regreso al mismo alojamiento", "directReturnToPickup": "Regreso al mismo punto de recogida"});
  function configuredDirectOption(state){
    if(state.step!=='services'||state.screen!=='config'||state.selection?.requestKind!=='package')return null;
    const pkg=state.selectedEvent?.snapshot.packages.find(p=>p.id===state.selection.packageId),option=pkg?.options.find(o=>o.id===state.selection.optionId);
    if(option?.calculationModel!=='ordinary_services'||option.services.length<2||option.services.some(item=>item.ordinary?.baseService!=='direct_transfer'||item.ordinary.airportReturn))return null;
    const pairs=option.services.filter(item=>item.ordinary.directReturn?.version===1).map(returning=>({returning,service:option.services.find(item=>item.id===returning.ordinary.directReturn.outboundServiceId),sharedDate:returning.ordinary.directReturn.dateMode==='shared'}));
    if(pairs.length*2!==option.services.length||pairs.some(pair=>!pair.service||pair.service===pair.returning||pair.service.ordinary.directReturn||pair.returning.ordinary.sharedOrigin)||new Set(pairs.map(pair=>pair.service.id)).size!==pairs.length)return null;
    if(state.selectedEvent.snapshot.addOns.some(a=>a.packageId===pkg.id&&a.optionIds.includes(option.id)&&a.serviceIds.some(id=>option.services.some(service=>service.id===id))))return null;
    const roots=pairs.filter(pair=>!pair.service.ordinary.sharedOrigin);
    if(roots.length!==1)return null;
    const {service,returning,sharedDate}=roots[0],multiJourney=pairs.length>1;
    if(multiJourney){
      if(!['customer','fixed'].includes(service.ordinary.inputs.origin?.source)||pairs.some(pair=>pair.service!==service&&(pair.service.ordinary.sharedOrigin?.version!==1||pair.service.ordinary.sharedOrigin.serviceId!==service.id||pair.service.ordinary.inputs.origin)))return null;
      if(pairs.some(pair=>pair.service.ordinary.inputs.date?.source!=='fixed'||!localDate(pair.service.ordinary.inputs.date.value)||pair.service.ordinary.inputs.destination?.source!=='fixed')||new Set(pairs.map(pair=>pair.service.ordinary.inputs.date.value)).size!==pairs.length)return null;
      pairs.sort((a,b)=>a.service.ordinary.inputs.date.value.localeCompare(b.service.ordinary.inputs.date.value));
    }
    return {pkg,option,service,returning,sharedDate,pairs,multiJourney,customerPickup:service.ordinary.inputs.origin?.source==='customer'&&service.ordinary.inputs.destination?.source==='fixed'};
  }
  function directQuoteReadiness(state,view){
    if(view.multiJourney){
      const results=view.pairs.map(pair=>directQuoteReadiness(state,{...view,...pair,multiJourney:false}));
      return {ready:results.every(result=>result.ready),missing:[...new Set(results.flatMap(result=>result.missing))],invalid:[...new Set(results.flatMap(result=>result.invalid))]};
    }
    const missing=[],invalid=[];
    if(!state.selection.passengerBand)missing.push(t('passengers'));
    for(const service of [view.service,view.returning]){
      const inputs=service.ordinary.inputs,values=resolvedOrdinaryValues(service,state),back=service===view.returning,bounds=serviceBounds(service,state),r=service.ordinary.restrictions||{};
      for(const key of ['origin','destination'])if(inputs[key]?.source==='customer'){
        if(!values[key]?.address?.trim())missing.push(t(key==='origin'?(view.customerPickup?'directPickupAddress':'origin'):'directDestination'));
        else if(!values[key]?.placeId?.trim())invalid.push(t(key==='origin'?(view.customerPickup?'directPickupAddress':'origin'):'directDestination'));
      }
      const dateLabel=view.sharedDate?'directSharedDate':back?'returnDate':'directOutboundDate',timeLabel=back?'directReturnTime':'directOutboundTime';
      if(!values.date)missing.push(t(dateLabel));
      else if(!localDate(values.date)||bounds.minDate&&values.date<bounds.minDate||bounds.maxDate&&values.date>bounds.maxDate)invalid.push(t(dateLabel));
      if(!values.time)missing.push(t(timeLabel));
      else if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)||(r.fromTime&&r.untilTime?(r.fromTime<=r.untilTime?(values.time<r.fromTime||values.time>r.untilTime):(values.time<r.fromTime&&values.time>r.untilTime)):(r.fromTime&&values.time<r.fromTime||r.untilTime&&values.time>r.untilTime)))invalid.push(t(timeLabel));
      const start=values.date&&values.time?values.date+'T'+values.time:'';
      if(start&&(bounds.min&&start<bounds.min||bounds.max&&start>bounds.max))invalid.push(t(timeLabel));
      const bag=inputs.baggageCount||inputs.baggageStatus;
      if(bag?.source==='customer'){
        const count=values.baggageCount??(values.baggageStatus==='none'?0:undefined);
        if(count===undefined&&view.option.baggagePolicy?.allowUnknown===false)missing.push(t('baggageCount')+' · '+t(back?'returnHeading':'outboundHeading'));
        else if(count!==undefined&&(!Number.isSafeInteger(count)||count<0))invalid.push(t('baggageCount'));
      }
    }
    const first=resolvedOrdinaryValues(view.service,state),back=resolvedOrdinaryValues(view.returning,state);
    if(first.date&&first.time&&back.date&&back.time&&back.date+'T'+back.time<=first.date+'T'+first.time)invalid.push(t('directReturnTime'));
    return {ready:!missing.length&&!invalid.length,missing:[...new Set(missing)],invalid:[...new Set(invalid)]};
  }
  function directSchedule(state,view,service,surface){
    const back=service===view.returning,data=state.selection.services.find(item=>item.serviceId===service.id)||{},prefix='service:'+service.id+':';
    const input=(key,label)=>surface==='mobile'?mobileTemporalInput(service,data,prefix,key,t(key==='time'?(back?'returnHeading':'outboundHeading'):label)):ordinaryInput(service,data,prefix,key,'',surface==='desktop-table'&&key==='time'?{textLabel:desktopDate(resolvedOrdinaryValues(service,state).date)+' · '+t(back?'returnHeading':'outboundHeading')}:view.multiJourney&&key==='time'?{textLabel:t(back?'returnHeading':'outboundHeading')}:{label});
    return '<fieldset class="events-package-primary-form events-package-direct__leg" aria-label="'+esc((surface==='mobile'&&resolvedOrdinaryValues(service,state).date?desktopDate(resolvedOrdinaryValues(service,state).date)+' · ':'')+t(back?'returnHeading':'outboundHeading'))+'"'+(back?' data-package-direct-return="'+esc(service.id)+'"':'')+(window.PixkuyEventPackagesRequest.hasFrozenBody()?' disabled':'')+'>'+(!view.sharedDate?input('date',back?'returnDate':'directOutboundDate'):'')+input('time',back?'directReturnTime':'directOutboundTime')+'</fieldset>';
  }
  function directBaggage(state,view){
    const legs=view.multiJourney?view.pairs.flatMap(pair=>[pair.service,pair.returning]):[view.service,view.returning],markup=legs.map(service=>baggageField(service,state.selection.services.find(item=>item.serviceId===service.id)||{},'service:'+service.id+':'));
    const pending=service=>{const input=service.ordinary.inputs.baggageCount||service.ordinary.inputs.baggageStatus;return !input||input.source==='deferred';};
    if(legs.every(pending)&&markup.every(html=>html===markup[0]))return markup[0];
    return '<div class="events-package-direct__baggage">'+markup.map((html,index)=>'<fieldset class="events-package-primary-form"'+(window.PixkuyEventPackagesRequest.hasFrozenBody()?' disabled':'')+'><legend>'+esc(t('baggage'))+' · '+esc(t(legs[index].ordinary.directReturn?'returnHeading':'outboundHeading'))+(view.multiJourney?' · '+esc(localServiceDate(resolvedOrdinaryValues(legs[index],state).date)):'')+'</legend>'+html+'</fieldset>').join('')+'</div>';
  }
  function commonDirectDestination(view,state){
    const destinations=view.pairs.map(pair=>resolvedOrdinaryValues(pair.service,state).destination);
    // A redacted displayLabel is not a canonical identity.
    return destinations[0]?.placeId&&destinations.every(value=>value?.placeId===destinations[0].placeId)?destinations[0]:null;
  }
  function destinationDisclosure(value){
    return '<details class="events-package-route-detail"><summary>'+esc(t('directDestination'))+'</summary><p>'+esc(typeof value==='string'?value:value?.address||t('ordinaryFixed'))+'</p></details>';
  }
  Object.assign(fallback,{"desktopCompleteShared":"Enter the pickup location, passengers and times to calculate the total.","desktopSingleDayCount":"1 day · {transfers} transfers","desktopSingleTransfer":"1 transfer","desktopViewAddress":"View address","desktopYourPackage":"Your package","desktopJourneyCount":"{days} days · {transfers} transfers","desktopTransferCount":"{count} transfers","desktopDailyReturn":"Round trip each day","desktopJourneys":"Days and times","desktopJourney":"Day","desktopSharedPickup":"Same pickup and return location across all {count} days.","desktopCompleteFields":"Complete {fields} to calculate the total.","desktopMissingDayTimes":"Complete the times for {date} to calculate the total.","desktopMissingJourneyTimes":"Times are missing on {count} days to calculate the total.","desktopInvalid":"Check the selected dates, times or locations to calculate the total.","desktopConditions":"Service conditions","desktopFieldInvalid":"Check this value and the permitted service period."});
  function desktopPackageConfig(state,surface){return state.step==='services'&&state.selection?.requestKind==='package'&&['desktop','contact','desktop-table'].includes(surface)&&!window.matchMedia('(max-width:720px)').matches;}
  function desktopDate(value){const date=localDate(value);return date?new Intl.DateTimeFormat(locale(),{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date):t('directSharedDate');}
  function desktopCommonDestination(view,state){
    if(!view.pairs)return null;
    const fields=view.pairs.map(pair=>pair.service.ordinary.inputs.destination),first=fields[0];
    if(first?.destinationGroupId&&fields.every(field=>field?.destinationGroupId===first.destinationGroupId&&field.displayLabel))return {address:first.displayLabel};
    return commonDirectDestination(view,state);
  }
  function desktopDestination(value){const address=typeof value==='string'?value:value?.address;if(!address)return '';return '<details class="events-package-desktop-destination"><summary><span>'+esc(address.split(' — ')[0])+'</span><span>'+esc(t('desktopViewAddress'))+'</span></summary><p>'+esc(address)+'</p></details>';}
  function desktopHeader(state,surface,locked){return '<header class="events-package-desktop-header"><div class="events-package-desktop-nav">'+button('packages',t('backToPackages'),locked,'secondary')+(state.selectedEvent.snapshot.customInquiryEnabled?button('ordinary-custom',t('customLink'),locked,'secondary'):'')+'</div><h3 tabindex="-1" data-package-heading>'+esc(eventTitle(state.selectedEvent))+'</h3>'+eventMetadata(state.selectedEvent,true)+'</header>'+navigation(state,surface);}
  function desktopActions(state){const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';return (state.quoteStatus==='error'?button('retry-quote',t('retryCalculation'),locked,'secondary'):'')+button('airport-review',t('continueContact'),locked||state.quoteStatus==='loading'||!airportCanReview(state),'primary');}
  function desktopPrice(state,view){
    const calculation=state.quoteStatus==='ready'?state.quote?.calculation:null,price=calculation?.priceBreakdown,ready=airportQuoteReadiness(state,view);
    const quoted=price?.priceStatus==='quoted'&&price.pricedSubtotal!==null&&calculation.coverageStatus!=='outside';
    let message=state.quoteStatus==='loading'?t('transferCalculating'):state.quoteStatus==='error'?t('error'):calculation?.coverageStatus==='outside'?t('ordinaryOutside'):quoted?'':calculation?t('pending'):ready.invalid.length?t('desktopInvalid'):ready.missing.length?t('desktopCompleteFields',{fields:ready.missing.slice(0,3).join(', ')}):t('automaticQuotePending');
    if(!calculation&&state.quoteStatus==='idle'&&!ready.invalid.length&&view.multiJourney){
      if(!state.selection.passengerBand&&!state.selection.passengerCount&&!resolvedOrdinaryValues(view.service,state).origin)message=t('desktopCompleteShared');
      const missing=view.pairs.filter(pair=>[pair.service,pair.returning].some(service=>service.ordinary.inputs.time?.source==='customer'&&!resolvedOrdinaryValues(service,state).time));
      const onlyTimes=ready.missing.length&&ready.missing.every(label=>[t('directOutboundTime'),t('directReturnTime')].includes(label));
      if(onlyTimes)message=missing.length===1?t('desktopMissingDayTimes',{date:desktopDate(resolvedOrdinaryValues(missing[0].service,state).date)}):t('desktopMissingJourneyTimes',{count:missing.length});
    }
    return '<span class="services-expand__label">'+esc(t('packageTotal'))+'</span>'+(quoted?'<strong class="events-package-airport__price is-quoted">'+esc(money(price.pricedSubtotal,price.currency))+'</strong>':'')+(message?'<p class="events-package-desktop-status">'+esc(message)+'</p>':'');
  }
  function desktopFrame(state,view,body){
    const common=desktopCommonDestination(view,state),pairs=view.pairs||[],dates=new Set(pairs.map(pair=>resolvedOrdinaryValues(pair.service,state).date).filter(Boolean));
    // Relocate the existing presentation fragments only; their controls and contracts stay intact.
    body=body.replace(/<h3[^>]*data-package-step-heading[^>]*>[\s\S]*?<\/h3><p[^>]*>[\s\S]*?<\/p>/,'').replace(airportConditions(state.selectedEvent,view.pkg),'').replace(/<div[^>]*data-airport-price[^>]*>[\s\S]*?<\/div>/g,'').replace(/<div[^>]*data-airport-actions[^>]*>[\s\S]*?<\/div>/g,'');
    for(const service of view.option.services){const input=service.ordinary?.inputs.baggageCount||service.ordinary?.inputs.baggageStatus;if(!input||input.source==='deferred')body=body.replace(baggageField(service,state.selection.services.find(s=>s.serviceId===service.id)||{},'service:'+service.id+':'),'');}
    const count=view.hourly?t('hourlyCount',{count:view.option.services.length}):pairs.length&&dates.size===pairs.length?t(dates.size===1?'desktopSingleDayCount':'desktopJourneyCount',{days:dates.size,transfers:view.option.services.length}):t(view.option.services.length===1?'desktopSingleTransfer':'desktopTransferCount',{count:view.option.services.length});
    const daily=pairs.length&&pairs.every(pair=>pair.sharedDate);
    const conditions=conditionsHtml(state.selectedEvent,view.pkg).replace(esc(t('conditions')),esc(t('desktopConditions')));
    return '<section class="events-package-desktop-config"><h3 tabindex="-1" data-package-step-heading>'+esc(t('configureTransferTitle'))+'</h3><div class="events-package-desktop-selection"><p>'+esc(local(view.pkg.title))+' · '+esc(local(view.option.title))+'</p>'+(common?desktopDestination(common):'')+'</div><div class="events-package-desktop-columns"><div class="events-package-desktop-main">'+body+'</div><aside class="events-package-desktop-summary" aria-label="'+esc(t('desktopYourPackage'))+'"><h4>'+esc(t('desktopYourPackage'))+'</h4><p>'+esc(count)+'</p>'+(daily?'<p class="events-package-desktop-roundtrip">'+'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+inclusionIconPaths.round_trip+'"/></svg>'+esc(t('desktopDailyReturn'))+'</p>':'')+'<div data-airport-price role="status" aria-live="polite" aria-atomic="true">'+desktopPrice(state,view)+'</div><div data-airport-actions>'+desktopActions(state)+'</div>'+conditions+'<p class="events-package-desktop-notice">'+esc(t('notBooking'))+'</p></aside></div></section>';
  }
  function hourlyDesktopVehicle(state){
    const vehicle=window.PixkuyEventsMobileVehicleGallery?.getVehicle?.();
    if(!H.configured(state)||!airportCanReview(state)||state.quote?.calculation?.priceBreakdown?.priceStatus!=='quoted'||!['van_1_2','van_3_4','van_5_6'].includes(state.selection.passengerBand)||vehicle?.id!=='byd_m9'||!vehicle.images?.length||!window.PixkuyHourlyDesktopVehicleGallery)return '';
    return '<button type="button" class="events-package-hourly-desktop__gallery" data-package-action="hourly-desktop-gallery" aria-haspopup="dialog"><img src="'+esc(vehicle.images[0].src)+'" alt="" loading="lazy"><span>'+esc(t('vehicleGalleryOpen'))+'</span></button><p>'+esc(t('vehicleCategoryLabel'))+'</p>';
  }
  function hourlyDesktopActions(state){
    const problem=H.firstProblem(state),locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||['unknown','submitting','received'].includes(state.requestStatus);
    const view=H.configured(state),repair=problem&&(H.readiness(state,view).invalid.length||view.services.length>1&&/ordinary-(origin|time|baggageCount)$/.test(problem));
    return (repair?button('hourly-fix',t('hourlyCheckData'),locked,'quiet'):'')+desktopActions(state);
  }
  function hourlyDesktopConfig(state,view,body,surface,locked){
    return '<div class="events-package-hourly-config"><header class="events-package-hourly-desktop__header"><div class="events-package-desktop-nav">'+button('packages',t('backToPackages'),locked,'secondary')+(state.selectedEvent.snapshot.customInquiryEnabled?button('ordinary-custom',t('customLink'),locked,'quiet'):'')+'</div><p>'+esc(eventTitle(state.selectedEvent))+'</p>'+navigation(state,surface)+'</header><section class="events-package-desktop-config"><h3 tabindex="-1" data-package-step-heading>'+esc(local(view.pkg.title))+'</h3><p class="events-package-hourly-desktop__mode">'+esc(local(view.option.title))+' · '+esc(H.composition(view))+'</p><div class="events-package-desktop-columns"><div class="events-package-desktop-main">'+body+'</div><aside class="events-package-desktop-summary" aria-label="'+esc(t('desktopYourPackage'))+'"><h4>'+esc(t('desktopYourPackage'))+'</h4><p>'+esc(H.composition(view))+'</p><div data-airport-price role="status" aria-live="polite" aria-atomic="true">'+desktopPrice(state,view)+'</div><div data-airport-actions>'+hourlyDesktopActions(state)+'</div>'+conditionsHtml(state.selectedEvent,view.pkg).replace(esc(t('conditions')),esc(t('desktopConditions')))+'<p class="events-package-desktop-notice">'+esc(t('notBooking'))+'</p><div data-hourly-desktop-vehicle>'+hourlyDesktopVehicle(state)+'</div></aside></div></section></div>';
  }
  function syncHourlyDesktopSummary(root){
    const summary=root.querySelector?.('.events-package-hourly-config .events-package-desktop-summary');
    if(root.hourlySummaryTarget!==summary){root.hourlySummaryObserver?.disconnect();root.hourlySummaryTarget=summary;if(summary&&window.ResizeObserver){root.hourlySummaryObserver=new window.ResizeObserver(()=>syncHourlyDesktopSummary(root));root.hourlySummaryObserver.observe(summary);}}
    if(!summary)return;
    const fits=window.innerWidth>=1200&&summary.getBoundingClientRect().height<=window.innerHeight-112;
    summary.classList.toggle('is-sticky',fits);
  }
  function openHourlyDesktopGallery(root,target){
    if(!H.configured(C.state)||window.matchMedia('(max-width:720px)').matches||!hourlyDesktopVehicle(C.state))return;
    target.focus({preventScroll:true});const scroll=window.scrollY;
    if(!window.PixkuyHourlyDesktopVehicleGallery.open(0))return;
    const gallery=document.querySelector('[data-hourly-desktop-vehicle-gallery]');if(!gallery)return;
    const label=gallery.querySelector('[data-hourly-desktop-vehicle-gallery-label]');
    const sync=()=>{if(label&&label.textContent!==t('vehicleCategoryLabel'))label.textContent=t('vehicleCategoryLabel');};sync();
    const trap=event=>{if(event.key!=='Tab')return;const buttons=Array.from(gallery.querySelectorAll('button')).filter(b=>!b.hidden&&b.offsetParent!==null&&!b.hasAttribute('data-hourly-desktop-vehicle-gallery-backdrop')),first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
    gallery.addEventListener('keydown',trap);
    const observer=new MutationObserver(()=>{if(gallery.getAttribute('aria-hidden')==='true'){observer.disconnect();gallery.removeEventListener('keydown',trap);window.scrollTo(0,scroll);(root.querySelector('[data-package-action="hourly-desktop-gallery"]')||target)?.focus({preventScroll:true});}else sync();});observer.observe(gallery,{attributes:true,subtree:true,childList:true});
    gallery.querySelector('[data-hourly-desktop-vehicle-gallery-close]')?.focus({preventScroll:true});
  }
  function desktopDirect(state,view,locked,endpoint){
    const common=desktopCommonDestination(view,state);
    const rows=view.pairs.map(pair=>{
      const legView={...view,...pair,multiJourney:false},data=state.selection.services.find(s=>s.serviceId===pair.service.id)||{},date=resolvedOrdinaryValues(pair.service,state).date;
      const day=pair.service.ordinary.inputs.date?.source==='customer'?ordinaryInput(pair.service,data,'service:'+pair.service.id+':','date','',{label:pair.sharedDate?'directSharedDate':'directOutboundDate'}):'<span>'+esc(desktopDate(date))+'</span>';
      const leg=service=>{
        // The date belongs in the day cell for outbound; independent return dates remain editable in their leg.
        let html=directSchedule(state,legView,service,'desktop-table');
        if(service===pair.service&&!pair.sharedDate)html=html.replace(ordinaryInput(service,data,'service:'+service.id+':','date','',{label:'directOutboundDate'}),'');
        return html;
      };
      return '<tr class="events-package-desktop-journey"><th scope="row">'+day+(!common?desktopDestination(resolvedOrdinaryValues(pair.service,state).destination):'')+'</th><td>'+leg(pair.service)+'</td><td>'+leg(pair.returning)+'</td></tr>';
    }).join('');
    const help=view.pairs.length>1?t('desktopSharedPickup',{count:view.pairs.length}):t('directReturnToPickup');
    return '<section class="events-package-direct events-package-airport"><fieldset class="events-package-primary-form"'+(locked?' disabled':'')+'><legend>'+esc(t('directSharedData'))+'</legend><div class="events-package-desktop-shared"><div>'+endpoint('origin')+'<p class="events-package-help">'+esc(help)+'</p></div>'+(!common&&view.service.ordinary.inputs.destination?.source==='customer'?endpoint('destination'):'')+passengerField(state.selection)+'</div></fieldset><h4>'+esc(t('desktopJourneys'))+'</h4><p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p><table class="events-package-desktop-table"><thead><tr><th scope="col">'+esc(t('desktopJourney'))+'</th><th scope="col">'+esc(t('outboundHeading'))+'</th><th scope="col">'+esc(t('returnHeading'))+'</th></tr></thead><tbody>'+rows+'</tbody></table>'+directBaggage(state,view)+'</section>';
  }
  function mobileConditions(state,pkg){
    return '<div class="events-package-mobile-conditions"><button type="button" class="events-package-offer__details-trigger" data-package-action="details" data-package-details="'+esc(pkg.id)+'" data-package-conditions-only data-package-config-conditions aria-haspopup="dialog">'+esc(t('desktopConditions'))+'</button><p class="events-package-help">'+esc(t('notBooking'))+'</p></div>';
  }
  function mobileDirect(state,view,locked,endpoint){
    const common=desktopCommonDestination(view,state);
    const journeys=view.pairs.map(pair=>{
      const legView={...view,...pair,multiJourney:false},data=state.selection.services.find(item=>item.serviceId===pair.service.id)||{},date=resolvedOrdinaryValues(pair.service,state).date;
      const dayControl=pair.service.ordinary.inputs.date?.source==='customer'&&pair.sharedDate?mobileTemporalInput(pair.service,data,'service:'+pair.service.id+':','date',t('mobileJourneyDate')):'';
      const day=locked&&dayControl?'<fieldset class="events-package-primary-form services-expand__field--date" disabled>'+dayControl+'</fieldset>':dayControl;
      const title=day?'':date?'<h4>'+esc(desktopDate(date))+'</h4>':'';
      const destination=!common&&pair.service.ordinary.inputs.destination?.source==='fixed'?desktopDestination(resolvedOrdinaryValues(pair.service,state).destination):'';
      return '<section class="events-package-direct-journey">'+title+destination+day+'<div class="events-package-direct-journey__times">'+directSchedule(state,legView,pair.service,'mobile')+directSchedule(state,legView,pair.returning,'mobile')+'</div></section>';
    }).join('');
    const bags=view.pairs.flatMap(pair=>[pair.service,pair.returning]).map(service=>{
      const html=mobileBaggageField(service,state.selection.services.find(item=>item.serviceId===service.id)||{},'service:'+service.id+':');
      return html?'<fieldset class="events-package-primary-form"'+(locked?' disabled':'')+'><legend>'+esc(t('baggage'))+' · '+esc(t(service.ordinary.directReturn?'returnHeading':'outboundHeading'))+(view.multiJourney?' · '+esc(localServiceDate(resolvedOrdinaryValues(service,state).date)):'')+'</legend>'+html+'</fieldset>':'';
    }).join('');
    const help=view.multiJourney?t('desktopSharedPickup',{count:view.pairs.length}):t('directReturnToPickup');
    return '<section class="events-package-direct events-package-airport">'+(common?desktopDestination(common):'')+'<fieldset class="events-package-primary-form" aria-label="'+esc(t('services'))+'"'+(locked?' disabled':'')+'>'+endpoint('origin')+'<p class="events-package-help">'+esc(help)+'</p>'+(!common&&view.service.ordinary.inputs.destination?.source==='customer'?endpoint('destination'):'')+passengerField(state.selection)+'</fieldset><p class="events-package-mobile-timezone">'+esc(t('sharedLocalTime'))+'</p>'+journeys+(bags?'<div class="events-package-direct__baggage">'+bags+'</div>':'')+mobileConditions(state,view.pkg)+'<div class="events-package-layout__actions" data-package-mobile-result tabindex="-1">'+mobileCalculationContent(state,view.option,locked)+'</div></section>';
  }
  function directConfiguration(state,view,locked,surface){
    const {pkg,option,service}=view,data=state.selection.services.find(item=>item.serviceId===service.id)||{},prefix='service:'+service.id+':';
    const endpoint=key=>{
      const label=key==='origin'?(view.customerPickup?'directPickupAddress':'origin'):'directDestination';
      if(surface==='mobile'&&service.ordinary.inputs[key]?.source==='customer')return mobileAddressInput(service,data,prefix,key,t(label),true).replace(esc(t(ordinaryFieldLabels[key])),esc(t(label)));
      let html=ordinaryInput(service,data,prefix,key,'',{label});
      if(service.ordinary.inputs[key]?.source==='customer')html=html.replace('<span data-package-address-mount>','<button type="button" class="place-autocomplete__clear" data-package-address-clear aria-label="'+esc(t(key==='origin'?'clearPickup':'clearDestination'))+'"'+(data.ordinaryInputs?.[key]?.address?'':' hidden')+'><span aria-hidden="true">×</span></button><span data-package-address-mount>');
      return html;
    };
    if(surface==='desktop-table')return desktopDirect(state,view,locked,endpoint);
    if(surface==='mobile')return mobileDirect(state,view,locked,endpoint);
    if(view.multiJourney){
      const desktop=surface!=='mobile'&&!window.matchMedia('(max-width:720px)').matches;
      const common=desktop&&commonDirectDestination(view,state);
      const journeys=view.pairs.map(pair=>{
        const legView={...view,...pair,multiJourney:desktop},date=pair.service.ordinary.inputs.date.value;
        const target=common?'':desktop?destinationDisclosure(resolvedOrdinaryValues(pair.service,state).destination):ordinaryInput(pair.service,{},'service:'+pair.service.id+':','destination','',{label:'directDestination'});
        return '<section class="events-package-direct-journey"><h4>'+esc(desktop?localServiceDate(date,false):t('journeyHeading',{date:localServiceDate(date)}))+'</h4>'+target+'<div class="events-package-direct-journey__times">'+directSchedule(state,legView,pair.service,surface)+directSchedule(state,legView,pair.returning,surface)+'</div></section>';
      }).join('');
      return '<section class="events-package-direct events-package-airport events-package-direct--journeys"><h3 tabindex="-1" data-package-step-heading>'+esc(t('configureTransferTitle'))+'</h3><p>'+esc(local(pkg.title))+' · '+esc(local(option.title))+'</p><fieldset class="events-package-primary-form"'+(locked?' disabled':'')+'><legend>'+esc(t('directSharedData'))+'</legend><div class="events-package-fields-grid">'+endpoint('origin')+passengerField(state.selection)+'</div></fieldset>'+(desktop?'<p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p>':'')+(common?destinationDisclosure(common):'')+journeys+directBaggage(state,view)+airportConditions(state.selectedEvent,pkg)+'<div class="events-package-direct__quote"><div data-airport-price role="status" aria-live="polite">'+airportPrice(state,view)+'</div><div class="events-package-calculation-actions" data-airport-actions>'+airportActions(state)+'</div></div></section>';
    }
    const sharedDateControl=view.sharedDate?(surface==='mobile'?mobileTemporalInput(service,data,prefix,'date',t('directSharedDate')):ordinaryInput(service,data,prefix,'date','',{label:'directSharedDate'})):'';
    const sharedDate=locked?'<fieldset class="events-package-primary-form services-expand__field--date" disabled>'+sharedDateControl+'</fieldset>':sharedDateControl;
    return '<section class="events-package-direct events-package-airport"><h3 tabindex="-1" data-package-step-heading>'+esc(t('configureTransferTitle'))+'</h3><p>'+esc(local(pkg.title))+' · '+esc(local(option.title))+'</p><fieldset class="events-package-primary-form"'+(locked?' disabled':'')+'><legend>'+esc(t('directSharedData'))+'</legend><div class="events-package-fields-grid">'+endpoint('origin')+endpoint('destination')+passengerField(state.selection)+'</div><p class="events-package-help">'+esc(t(view.customerPickup?'directReturnToLodging':'directReturnToPickup'))+'</p></fieldset><div class="events-package-direct__schedule'+(view.sharedDate?' is-shared':'')+'">'+sharedDate+directSchedule(state,view,service,surface)+directSchedule(state,view,view.returning,surface)+'</div>'+directBaggage(state,view)+airportConditions(state.selectedEvent,pkg)+'<div class="events-package-direct__quote"><div data-airport-price role="status" aria-live="polite">'+airportPrice(state,view)+'</div><div class="events-package-calculation-actions" data-airport-actions>'+airportActions(state)+'</div></div></section>';
  }
  // This view is capability-bound; other service models keep their existing calculation controls.
  function configuredAirportOption(state){
    if(state.step!=='services'||state.screen!=='config'||state.selection?.requestKind!=='package')return null;
    const pkg=state.selectedEvent?.snapshot.packages.find(p=>p.id===state.selection.packageId);
    const option=pkg?.options.find(o=>o.id===state.selection.optionId);
    const returning=option?.services.length===2&&option.services.find(item=>item.ordinary?.airportReturn?.version===1);
    const service=returning?option.services.find(item=>item.id===returning.ordinary.airportReturn.arrivalServiceId):option?.services.length===1&&option.services[0];
    if(returning&&(!service||service.ordinary?.airportReturn||returning.ordinary.baseService!=='airport_transfer'||returning.ordinary.inputs.direction?.source!=='fixed'||returning.ordinary.inputs.direction.value!=='destination_to_airport'||service.ordinary?.inputs.direction?.value!=='airport_to_destination'))return null;
    const binding=service?.ordinary;
    if(option?.calculationModel!=='ordinary_services'||binding?.baseService!=='airport_transfer'||binding.inputs.direction?.source!=='fixed'||!['airport_to_destination','destination_to_airport'].includes(binding.inputs.direction.value))return null;
    if(state.selectedEvent.snapshot.addOns.some(a=>a.packageId===pkg.id&&a.optionIds.includes(option.id)&&a.kind!=='airport_leg_supplement'&&a.serviceIds.some(id=>id===service.id||id===returning?.id)))return null;
    return {pkg,option,service,returning:returning||null,arrival:binding.inputs.direction.value==='airport_to_destination'};
  }
  function airportConfiguredView(state,surface,mobile){
    const mobileViewport=window.matchMedia?.('(max-width:720px)').matches;
    if(mobile?(surface!=='mobile'||!mobileViewport):(!['desktop','contact'].includes(surface)||mobileViewport))return null;
    return configuredAirportOption(state);
  }
  function airportDesktop(state,surface){return airportConfiguredView(state,surface,false);}
  function airportAutoQuoteView(state,surface){const mobile=window.matchMedia?.('(max-width:720px)').matches;if(surface==='mobile'?!mobile:!['desktop','contact'].includes(surface)||mobile)return null;return configuredAirportOption(state)||configuredDirectOption(state)||H.configured(state);}
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
    const pendingFields=!calculation&&!['loading','error'].includes(state.quoteStatus)?(readiness.invalid.length?readiness.invalid:readiness.missing):[];
    if(view.multiJourney&&pendingFields.length&&!window.matchMedia('(max-width:720px)').matches){
      const items=new Map();
      for(const pair of view.pairs){
        const result=directQuoteReadiness(state,{...view,...pair,multiJourney:false});
        const labels=readiness.invalid.length?result.invalid:result.missing;
        for(const label of labels){
          const baggage=label.startsWith(t('baggageCount'));
          const back=label===t('directReturnTime')||label===t('returnDate')||baggage&&label.endsWith(t('returnHeading')),temporal=[t('directReturnTime'),t('directOutboundTime'),t('returnDate'),t('directSharedDate'),t('directOutboundDate')].includes(label);
          const service=back?pair.returning:pair.service;
          const field=label===t('passengers')?'passengerBand':baggage?'baggageCount':label===t('directReturnTime')||label===t('directOutboundTime')?'time':temporal?'date':label===t('directDestination')?'destination':'origin';
          const key=field==='passengerBand'?field:'service:'+(temporal||baggage||field==='destination'?service.id:view.service.id)+':ordinary-'+field;
          items.set(key,(temporal?localServiceDate(resolvedOrdinaryValues(service,state).date,false)+' · ':'')+label);
        }
      }
      return '<span class="services-expand__label">'+esc(t('packageTotal'))+'</span><p>'+esc(t(readiness.invalid.length?'reviewQuoteFields':'completeQuoteFields'))+'</p><ul class="events-package-airport__pending">'+Array.from(items,([key,label])=>'<li><button type="button" data-package-focus-field="'+esc(key)+'">'+esc(label)+'</button></li>').join('')+'</ul>';
    }
    if(view.returning&&pendingFields.length)return '<span class="services-expand__label">'+esc(t(view.multiJourney?'packageTotal':'roundTripTotal'))+'</span><p>'+esc(t(readiness.invalid.length?'reviewQuoteFields':'completeQuoteFields'))+'</p><ul class="events-package-airport__pending">'+pendingFields.map(label=>'<li>'+esc(view.service.ordinary.baseService==='direct_transfer'?label:label===t('transferDate')?t('arrivalDate'):label===t('returnPickupTime')?t('returnHotelPickup'):label)+'</li>').join('')+'</ul>';
    return '<span class="services-expand__label">'+esc(t(view.multiJourney?'packageTotal':view.returning?'roundTripTotal':'transferPrice'))+'</span><strong class="events-package-airport__price'+(quoted?' is-quoted':'')+'">'+esc(text)+'</strong>';
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
    if(view.returning){
      return '<section class="events-package-airport events-package-airport--paired"><h3 tabindex="-1" data-package-step-heading>'+esc(t('configureTransferTitle'))+'</h3><p class="events-package-airport__selection">'+esc(local(pkg.title))+' · '+esc(local(option.title))+'</p>'
        +'<fieldset class="events-package-airport__shared"'+(locked?' disabled':'')+'><legend>'+esc(t('sharedTripData'))+'</legend><div class="events-package-airport__shared-fields">'+airport+address+'<p class="events-package-airport__shared-note">'+esc(t('sharedEndpointsHelp'))+'</p>'+passengerField(state.selection)+'</div></fieldset>'
        +'<div class="events-package-airport__legs"><fieldset class="events-package-primary-form events-package-airport__leg"'+(locked?' disabled':'')+'><legend>'+esc(t('arrivalHeading'))+'</legend><div class="events-package-airport__extras">'+input('date','arrivalDate')+input('time','transferStartTime')+'</div><div class="events-package-airport__leg-extras"><div>'+input('flight','transferFlight',{optional:true})+(service.ordinary.inputs.flight?.source==='customer'?'<p class="events-package-help">'+esc(t('flightOptionalHelp'))+'</p>':'')+'</div><div>'+baggageField(service,data,prefix)+'</div></div></fieldset>'
        +returnSchedule(state,view,false)+'</div><p class="events-package-airport__timezone">'+esc(t('sharedLocalTime'))+'</p>'
        +airportConditions(state.selectedEvent,pkg)+'<div class="events-package-airport__closing"><div class="events-package-airport__fare" data-airport-price role="status" aria-live="polite" aria-atomic="true">'+airportPrice(state,view)+'</div><div class="events-package-airport__actions" data-airport-actions>'+airportActions(state)+'</div></div></section>';
    }
    return '<section class="events-package-airport"><h3 tabindex="-1" data-package-step-heading>'+esc(t('configureTransferTitle'))+'</h3><p class="events-package-airport__selection">'+esc(local(pkg.title))+' · '+esc(local(option.title))+'</p>'
      +'<fieldset class="events-package-airport__form" aria-label="'+esc(t('services'))+'"'+(locked?' disabled':'')+'>'
      +'<div class="events-package-airport__route">'+(arrival?airport+address:address+airport)+'<div class="events-package-airport__fare" data-airport-price role="status" aria-live="polite" aria-atomic="true">'+airportPrice(state,view)+'</div></div>'
      +'<div class="events-package-airport__schedule">'+passengerField(state.selection)+input('date','transferDate')+input('time',arrival?'transferStartTime':'transferPickupTime')+'</div>'
      +'<p class="events-package-airport__timezone">'+esc(t('transferLocalTime'))+'</p>'
      +'<div class="events-package-airport__extras">'+input('flight','transferFlight',{optional:true})+(service.ordinary.inputs.flight?.source==='customer'?'<p class="events-package-help">'+esc(t('flightOptionalHelp'))+'</p>':'')+baggageField(service,data,prefix)+'</div></fieldset>'
      +returnSchedule(state,view,false)
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
  function updateQuoteMarkup(node,html){
    // innerHTML serializes boolean attributes differently from the template.
    // Compare templates so blur cannot replace a button between down and click.
    if(node&&node.packageQuoteMarkup!==html){node.innerHTML=html;node.packageQuoteMarkup=html;}
  }
  function refreshAirportQuote(){
    // Silent typing must invalidate the visible price without remounting Places or stealing focus.
    roots.forEach(root=>{
      if(!isRootInteractive(root))return;
      refreshMobileReview(root);
      if(root.getAttribute('data-event-package-root')==='mobile'&&C.state.step==='services'){
        const area=root.querySelector('.events-package-layout__actions');
        const pkg=C.state.selectedEvent?.snapshot.packages.find(item=>item.id===C.state.selection?.packageId);
        const option=pkg?.options.find(item=>item.id===C.state.selection?.optionId);
        updateQuoteMarkup(area,mobileCalculationContent(C.state,option,window.PixkuyEventPackagesRequest.hasFrozenBody()));
      }
      const configured=configuredAirportOption(C.state)||configuredDirectOption(C.state)||H.configured(C.state);
      if(!configured&&root.getAttribute('data-event-package-root')!=='mobile'&&C.state.step==='services'){
        const area=root.querySelector('.events-package-layout__actions');
        updateQuoteMarkup(area,calculationControls(C.state,window.PixkuyEventPackagesRequest.hasFrozenBody()));
        if(!C.state.quote)root.querySelector('.events-package-summary')?.remove();
      }
      const pairs=configured?.multiJourney?configured.pairs.map(pair=>({...configured,...pair,multiJourney:false})):[configured];
      pairs.forEach(pair=>{
      const back=configured?.multiJourney?root.querySelector('[data-package-direct-return="'+pair.returning.id+'"]'):root.querySelector('[data-package-airport-return]')||root.querySelector('[data-package-direct-return]');
      if(back&&pair?.returning&&!back.contains(document.activeElement)){
        back.outerHTML=pair.service.ordinary.baseService==='direct_transfer'?directSchedule(C.state,{...pair,multiJourney:configured.multiJourney&&root.getAttribute('data-event-package-root')!=='mobile'},pair.returning,root.querySelector('.events-package-desktop-table')?'desktop-table':root.getAttribute('data-event-package-root')):returnSchedule(C.state,pair,root.getAttribute('data-event-package-root')==='mobile');
      }
      if(back&&pair?.returning&&back.contains(document.activeElement)){
        // Changing the return date updates time constraints without replacing the focused control.
        const service=pair.returning,data=C.state.selection.services.find(item=>item.serviceId===service.id)||{};
        const raw=ordinaryInput(service,data,'service:'+service.id+':','time');
        const input=back.querySelector?.('input[type="time"]');
        // Chromium resets the native minute-entry buffer even when min is assigned
        // its existing value. Only apply an effective constraint change.
        for(const key of ['min','max']){const value=raw.match(new RegExp(' '+key+'="([^"]*)"'))?.[1];if(value&&input?.getAttribute(key)!==value)input?.setAttribute(key,value);else if(!value&&input?.hasAttribute(key))input.removeAttribute(key);}
      }
      });
      const price=root.querySelector('[data-airport-price]'),actions=root.querySelector('[data-airport-actions]');
      H.refresh(root,C.state);
      const view=airportDesktop(C.state,root.getAttribute('data-event-package-root'))||configuredDirectOption(C.state)||H.configured(C.state);
      const desktop=!!root.querySelector('.events-package-desktop-config');
      if(desktop&&configured?.pairs)configured.pairs.forEach(pair=>[pair.service,pair.returning].forEach(service=>{
        const input=root.querySelector('[data-package-field="service:'+service.id+':ordinary-time"]'),label=input?.closest('label')?.querySelector('span');
        if(label)label.textContent=desktopDate(resolvedOrdinaryValues(service,C.state).date)+' · '+t(service===pair.returning?'returnHeading':'outboundHeading');
      }));
      if(price&&view)updateQuoteMarkup(price,desktop?desktopPrice(C.state,view):airportPrice(C.state,view));
      updateQuoteMarkup(actions,desktop?(view?.hourly?hourlyDesktopActions(C.state):desktopActions(C.state)):airportActions(C.state));
      const hourlyVehicle=root.querySelector('[data-hourly-desktop-vehicle]');if(hourlyVehicle)updateQuoteMarkup(hourlyVehicle,hourlyDesktopVehicle(C.state));
      syncHourlyDesktopSummary(root);
      if(desktop)root.querySelectorAll('input[type=date],input[type=time]').forEach(input=>{
        const invalid=!!input.value&&!input.validity.valid;
        let error=input.parentElement.querySelector('.events-package-desktop-field-error');
        if(invalid&&!error){error=document.createElement('span');error.className='events-package-desktop-field-error';input.parentElement.appendChild(error);}
        if(error){error.textContent=invalid?t('desktopFieldInvalid'):'';error.hidden=!invalid;}
        if(invalid)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
      });
      if(['desktop','mobile','contact'].includes(root.getAttribute('data-event-package-root')))scheduleAirportAutoQuote(root);
    });
  }
  function mobileConfigurationHeader(state,locked){
    const pkg=state.selectedEvent.snapshot.packages.find(item=>item.id===state.selection.packageId),option=pkg?.options.find(item=>item.id===state.selection.optionId);
    if(H.configured(state))return '<header class="events-package-hourly-mobile__header">'+button('back',t('mobileBackToPackage'),locked,'quiet')+'<p class="events-package-hourly-mobile__event">'+esc(eventTitle(state.selectedEvent))+'</p><p class="events-package-hourly-mobile__step">'+esc(t('mobileTripStep'))+'</p><h3 tabindex="-1" data-package-step-heading>'+esc(local(pkg?.title))+'</h3><p>'+esc(local(option?.title))+'</p></header>';
    return '<header class="events-package-mobile-config__header">'+button('back',t('mobileBackToPackage'),locked,'secondary')+'<h3>'+esc(eventTitle(state.selectedEvent))+'</h3><p>'+esc(eventDates(state.selectedEvent))+'</p></header><h3 class="events-package-mobile-config__step" tabindex="-1" data-package-step-heading>'+esc(t('mobileTripStep'))+'</h3><p class="events-package-mobile-config__selection"><strong>'+esc(local(pkg?.title))+'</strong><span>'+esc(local(option?.title))+'</span></p>';
  }
  function configuration(state,surface){
    const selection=state.selection;
    const event=state.selectedEvent;
    if(!selection||!event)return catalog(state);
    const locked=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';
    const title=eventTitle(event);
    const isPackageStep=selection.requestKind==='package'&&state.step==='package';
    if(isPackageStep&&surface==='mobile'){
      const view=mobilePackageView(state),detail=activePackages(event).some(pkg=>pkg.id===view.packageId&&activeOptions(pkg).length);
      const metadata=[eventDates(event),eventVenue(event)].filter(Boolean).map(text=>'<span>'+esc(text)+'</span>').join('');
      const mobileHeader='<header class="events-package-config__header events-package-mobile-header">'+button(detail?'package-list':'back',t(detail?'allPackages':'backToEvents'),locked,'quiet')+'<div class="events-package-event-heading"><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3>'+(metadata?'<p class="events-package-event-heading__meta">'+metadata+'</p>':'')+'</div></header>';
      return mobilePackageSelection(state,mobileHeader);
    }
    const mobileConfig=surface==='mobile'&&state.step==='services'&&selection.requestKind==='package';
    const wrap=html=>mobileConfig?'<div class="events-package-mobile-config">'+html+'</div>':html;
    const header=mobileConfig?mobileConfigurationHeader(state,locked):surface==='contact'?'<header class="events-package-config__header"><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3></header>'+navigation(state,surface):(isPackageStep||surface==='mobile')?'<header class="events-package-config__header events-package-config__header--package">'+button('back',t(isPackageStep?'backToEvents':'back'),locked,'quiet')+'<div class="events-package-event-heading"><div><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3>'+eventMetadata(event,true)+'</div>'+((surface!=='mobile'&&event.snapshot.customInquiryEnabled)?button('ordinary-custom',t('customLink'),locked,'quiet'):'')+'</div></header>'+navigation(state,surface):'<header class="events-package-config__header">'+button('back',t('back'),locked,'quiet')+'<div><h3 tabindex="-1" data-package-heading>'+esc(title)+'</h3>'+eventMetadata(event,true)+'</div>'+((surface!=='mobile'&&event.snapshot.customInquiryEnabled&&selection.requestKind==='package')?button('ordinary-custom',t('customLink'),locked,'quiet'):'')+'</header>'+navigation(state,surface);
    if(isPackageStep)return '<div class="events-package-step-one">'+header+'<h3 class="events-package-offer-heading" tabindex="-1" data-package-step-heading>'+esc(t('choosePackage'))+'</h3>'+offer(state,surface)+'</div>';
    const hourlyView=H.configured(state);
    if(hourlyView){const body=H.render(state,hourlyView,locked,surface);return desktopPackageConfig(state,surface)?hourlyDesktopConfig(state,hourlyView,body,surface,locked):'<div class="events-package-mobile-config events-package-hourly-mobile-config">'+header+body+mobileConditions(state,hourlyView.pkg)+'<div class="events-package-layout__actions">'+mobileCalculationContent(state,hourlyView.option,locked)+'</div></div>';}
    const directView=configuredDirectOption(state);
    const desktopView=desktopPackageConfig(state,surface)&&(directView||airportDesktop(state,surface));
    if(desktopView)return desktopHeader(state,surface,locked)+desktopFrame(state,desktopView,directView?directConfiguration(state,directView,locked,'desktop-table'):airportConfiguration(state,desktopView,locked));
    if(directView)return wrap(header+directConfiguration(state,directView,locked,surface));
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
      if(!mobileConfig)form+='<p><strong>'+esc(local(pkg?.title))+' · '+esc(local(option?.title))+'</strong></p>';
      if(option){
        const mobileRecognized=surface==='mobile'&&option.calculationModel==='ordinary_services'&&option.services.every(mobileBaseRecognized);
        form+=(mobileRecognized?'':passengerField(selection))+(mobileConfig?'':surface==='mobile'?'<button type="button" class="events-package-offer__details-trigger" data-package-action="details" data-package-details="'+esc(pkg.id)+'" data-package-conditions-only aria-haspopup="dialog">'+esc(t('conditions'))+'</button>':conditionsHtml(event,pkg));
        if(option.calculationModel!=='ordinary_services'&&option.coverage){const coverage=option.coverage;form+='<details class="events-package-option-copy"><summary>'+esc(t('reason_coverage_review'))+'</summary><p>'+esc([...(coverage.allowedAirports||[]),...(coverage.nonAirportCoverage?.administrativeAreas||[]),...(coverage.dedicatedPerimeter?.administrativeAreas||[])].join(' · '))+'</p></details>';}
        const extraIds=new Set(event.snapshot.addOns.filter(a=>a.packageId===pkg.id&&a.optionIds.includes(option.id)&&a.kind!=='airport_leg_supplement').flatMap(a=>a.serviceIds));
        form+='<div class="events-package-services">';
        const orderedServices=option.services.slice().sort((a,b)=>{const date=s=>(option.calculationModel==='ordinary_services'?s.ordinary?.inputs.date?.value:'')||(event.snapshot.days||[]).find(d=>d.id===s.dayId)?.date||s.startLocal||'';return date(a).localeCompare(date(b));});
        orderedServices.forEach((service,index)=>{
          if(configuredAirportOption(state)?.returning?.id===service.id)return;
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
    if(mobileConfig){const pkg=event.snapshot.packages.find(item=>item.id===selection.packageId);if(pkg)form+=mobileConditions(state,pkg);}

    const actions=surface==='mobile'&&state.step==='services'?mobileCalculationContent(state,mobileOption,locked):calculationControls(state,locked);
    return wrap(header+'<div class="events-package-layout"><div class="events-package-layout__main">'+form+'</div><div class="events-package-layout__actions"'+(mobileConfig?' data-package-mobile-result tabindex="-1"':'')+'>'+actions+'</div></div>');
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
    const currentDestination=()=>{const [,id,key]=name.split(':');return C.state.selection?.services.find(service=>service.serviceId===id)?.ordinaryInputs?.[key.slice(9)];};
    const showError=message=>{if(!error)return;error.textContent=message||'';error.hidden=!message;};
    const sync=preserveCanonical=>{
      clear.hidden=!input.value;showError('');
      const selected=currentDestination();
      if(preserveCanonical&&selected?.address===input.value)return;
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
            const [,id,key]=name.split(':');
            const address=place?.label||place?.formattedAddress||place?.displayName||'',placeId=place?.placeId||place?.id;
            if(!address||!placeId){sync(false);showError(t('placeDetailsError'));return;}
            C.change(selection=>{let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}data.ordinaryInputs=data.ordinaryInputs||{};data.ordinaryInputs[key.slice(9)]={address,placeId};});
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
        if(!isRootInteractive(root)||C.state.selection!==capturedSelection||capturedSelection?.optionId!==capturedOption||typeof root.contains==='function'&&!root.contains(input))return;
        const address=place?.label||place?.formattedAddress||'';const placeId=place?.placeId||place?.id;
        if(!address||!placeId){window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));showError(t('placeDetailsError'));return;}
        showError('');window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));
        if(name==='hourly-common:origin'){H.changeHabit(C.state,'origin',{address,placeId});input.value=address;refreshAirportQuote();return;}
        const [,id,fieldName]=name.split(':');H.markException(C.state,id,fieldName.slice(9));
        C.change(selection=>{let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}const value={address,placeId};if(fieldName.startsWith('ordinary-')){data.ordinaryInputs=data.ordinaryInputs||{};data.ordinaryInputs[fieldName.slice(9)]=value;}else data[fieldName==='fromAddress'?'from':'to']=value;});
      };
      const sheet=window.PixkuyAirportMobileHotelSearchSheet;
      if(sheet&&input.hasAttribute('data-package-mobile-address-input')){
        const linkedDirect=!!configuredDirectOption(C.state);
        input.readOnly=true;input.setAttribute('aria-haspopup','dialog');
        if(input.hasAttribute('data-package-mobile-lodging-input'))input.placeholder=document.querySelector('#services-expand-airport [data-airport-lodging-input]')?.getAttribute('placeholder')||'';
        const clear=host.querySelector('[data-package-mobile-address-clear]');
        const editSearch=value=>{
          if(!linkedDirect||!isRootInteractive(root)||C.state.selection!==capturedSelection)return;
          input.value=value||'';
          if(clear)clear.hidden=true;
          host.classList?.remove('is-resolved');
          changeField(input,true);
        };
        if(clear)clear.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          sheet.closeForField(root.closest('.events-mobile-route'));
          if(linkedDirect){editSearch('');input.focus();return;}
          const [,id,fieldName]=name.split(':');
          input.value='';
          C.change(selection=>{const current=selection.services.find(service=>service.serviceId===id);if(!current)return;if(fieldName.startsWith('ordinary-'))delete current.ordinaryInputs?.[fieldName.slice(9)];else delete current[fieldName==='fromAddress'?'from':'to'];});
        });
        const open=()=>{
          showError('');
          sheet.openForField({
            host:root.closest('.events-mobile-route'),trigger:input,value:input.value,
            mount:(search,list)=>adapter.mount({root:list.parentElement,input:search,mountNode:list,fieldName:name,language:locale(),onManualInput:editSearch,onPlaceSelected:commit,onClearSelection:()=>editSearch(''),onError:()=>{sheet.closeForField(root.closest('.events-mobile-route'));showError(t('placeDetailsError'));}})
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
    window.requestAnimationFrame(()=>{
      const target=root.querySelector('[data-package-step-heading]')||root.querySelector('[data-package-heading]');
      if(!target||target.isConnected===false)return;
      target.focus({preventScroll:true});
      if(root.getAttribute('data-event-package-root')==='mobile'){
        const route=root.closest('.events-mobile-route');if(route)route.scrollTop=0;
      }else target.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
  }
  function settleMobileReceipt(root,receivedTransition){
    const fresh=C.state.receipt?.requestKind==='package'&&root.getAttribute('data-event-package-root')==='mobile'&&root.packageMobileReceiptReference!==C.state.receipt.reference&&root.offsetParent!==null;
    if(!receivedTransition&&!fresh)return;
    if(fresh)root.packageMobileReceiptReference=C.state.receipt.reference;
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
    if(!locked&&H.action(root,target,state))return;
    const focusField=target.getAttribute('data-package-focus-field');
    if(focusField&&!locked){
      const field=focusField==='passengerBand'?root.querySelector('[data-package-band]'):Array.from(root.querySelectorAll('[data-package-field]')).find(node=>node.getAttribute('data-package-field')===focusField);
      field?.focus();field?.scrollIntoView({block:'center'});return;
    }
    const action=target.getAttribute('data-package-action');
    const mobile=root.getAttribute('data-event-package-root')==='mobile';
    if(action==='receipt-conditions'&&mobile){openReceiptConditions(root,target);return;}
    const browseId=target.getAttribute('data-package-browse');
    if(browseId&&mobile&&!locked){
      const pkg=activePackages(state.selectedEvent).find(item=>item.id===browseId&&activeOptions(item).length);
      if(!pkg)return;
      const view=mobilePackageView(state);view.scrollTop=root.closest?.('.events-mobile-route')?.scrollTop||0;view.packageId=pkg.id;
      C.notify();focusDetail(root);return;
    }
    if(action==='package-list'&&mobile&&!locked){
      const view=mobilePackageView(state),id=view.packageId;view.packageId='';C.notify();
      window.requestAnimationFrame(()=>{const route=root.closest?.('.events-mobile-route');if(route)route.scrollTop=view.scrollTop;root.querySelector('[data-package-browse="'+id+'"]')?.focus({preventScroll:true});});return;
    }
    if(action==='details'){openPackageDetailsDialog(root,target.getAttribute('data-package-details'),target);return;}
    if(action==='hourly-desktop-gallery'){openHourlyDesktopGallery(root,target);return;}
    if(action==='vehicle-gallery'){
      if(root.getAttribute('data-event-package-root')!=='mobile'||!window.matchMedia('(max-width:720px)').matches)return;
      closePackageDetailsDialog();
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
          const focusCurrent=()=>{refreshAirportQuote();if(mobileRoute)mobileRoute.scrollTop=routeScrollTop;const focusTarget=root.querySelector('[data-package-action="vehicle-gallery"]')||root.querySelector('[data-package-mobile-result]')||(target.isConnected?target:null);focusTarget?.focus({preventScroll:true});};
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
    if(eventId){const item=state.events.find(e=>e.id===eventId);if(item&&C.selectEvent(item,target.hasAttribute('data-package-custom'))){state.customPicker=false;if(!target.hasAttribute('data-package-custom')){C.go('package');if(mobile)mobilePackageView(state).packageId='';}window.dispatchEvent(new CustomEvent('pixkuy:events-detail-activated',{detail:{source:'packages'}}));C.notify();focusDetail(root);}return;}
    const step=target.getAttribute('data-package-step');if(step){if(step==='package'?returnToPackageDetail(root):C.go(step))focusDetail(root);return;}
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
    if(pkgId){
      if(locked)return;
      const pkg=activePackages(state.selectedEvent).find(item=>item.id===pkgId);
      const optionId=mobile?(mobilePackageView(state).options[pkgId]??(state.selection.packageId===pkgId?state.selection.optionId:'')):(state.selection.packageId===pkgId?state.selection.optionId:C.rememberedOption?.(pkgId)||'');
      if(pkg&&activeOptions(pkg).length>1&&!activeOptions(pkg).some(option=>option.id===optionId)){
        const controls=target.closest('.events-package-offer__controls');
        if(controls&&!controls.querySelector('[data-package-option-required]'))controls.insertAdjacentHTML('afterbegin','<p class="events-package-alert" role="alert" tabindex="-1" data-package-option-required>'+esc(t('chooseOptionRequired'))+'</p>');
        controls?.querySelector('[data-package-option-required]')?.focus();return;
      }
      if(C.choose(pkgId,optionId,()=>window.confirm(t('changeLoss')))){if(mobile)mobilePackageView(state).packageId=pkgId;C.go('services');focusDetail(root);}return;
    }
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
    else if(action==='airport-review'&&!locked&&(airportDesktop(state,root.getAttribute('data-event-package-root'))||configuredDirectOption(state)||H.configured(state))&&validFields(root)){
      if(state.quoteStatus==='ready'&&!airportCanReview(state)){C.change(()=>{});return;}
      if(airportCanReview(state))contactHandoff(root);
    }
    else if(action==='retry-quote'&&!locked&&airportAutoQuoteView(state,root.getAttribute('data-event-package-root'))){airportQuoteAttemptedSignature='';C.change(()=>{},{silent:true});scheduleAirportAutoQuote(root,0);}
    else if(action==='custom-entry'&&!locked){const events=state.events.filter(e=>e.snapshot.customInquiryEnabled);const selected=state.screen!=='catalog'&&events.find(e=>e.id===state.selectedEvent?.id);if(selected||events.length===1){C.selectEvent(selected||events[0],true);window.dispatchEvent(new CustomEvent('pixkuy:events-detail-activated',{detail:{source:'packages'}}));focusDetail(root);}else{state.customPicker=!state.customPicker;C.notify();root.querySelector('[data-package-custom]')?.focus();}}
    else if(action==='ordinary-custom'&&!locked&&state.selectedEvent?.snapshot.customInquiryEnabled){C.selectEvent(state.selectedEvent,true);focusDetail(root);}
    else if(action==='packages'&&!locked){C.selectEvent(state.selectedEvent,false);if(mobile)mobilePackageView(state).packageId='';C.go('package');focusDetail(root);}
    else if(action==='edit-services'){C.go('services');focusDetail(root);}
    else if(action==='contact'){contactHandoff(root);}
    else if(action==='submit'&&root.getAttribute('data-event-package-root')==='mobile'&&state.screen==='contact')return;
    else if(action==='back'&&!locked){if(state.step==='review')C.go('services');else if(state.step==='services'&&state.selection?.requestKind==='package'){returnToPackageDetail(root);if(mobile)focusDetail(root);}else{state.screen='catalog';C.notify();root.querySelector('[data-package-event]')?.focus();}}
    else if(action==='reload')await load();
    else if(action==='recover')await window.PixkuyEventPackagesRequest.recover();
    else if(action==='retry')await window.PixkuyEventPackagesRequest.submit();
    else if(action==='new')window.PixkuyEventPackagesRequest.newKnownRequest();
    else if(action==='copy-reference')await copyReference(target,state.receipt);
    else if(action==='whatsapp'){const url=window.PixkuyEventPackagesRequest.whatsappUrl(state.receipt);if(url)window.open(url,'_blank','noopener,noreferrer');}
  }
  const temporalDrafts=new Map();
  function retainTemporalControls(root){
    if(!root.packageTemporalKey||root.getAttribute('data-event-package-root')==='mobile')return;
    const fields=new Map();
    root.querySelectorAll('input[type="time"],input[type="date"],input[type="datetime-local"]').forEach(input=>{
      const name=input.getAttribute('data-package-field');if(name)fields.set(name,input);
    });
    if(fields.size)temporalDrafts.set(root.packageTemporalKey,fields);
  }
  function restoreTemporalControls(root,state){
    const s=state.selection;
    root.packageTemporalKey=s?[root.getAttribute('data-event-package-root'),s.eventId,s.publicationVersion,s.requestKind,s.packageId,s.optionId].join(':'):'';
    const saved=temporalDrafts.get(root.packageTemporalKey);
    if(!saved)return;
    root.querySelectorAll('input[type="time"],input[type="date"],input[type="datetime-local"]').forEach(input=>{
      const old=saved.get(input.getAttribute('data-package-field'));
      // Retain the native partial segment buffer, which value cannot represent.
      if(!old||old.type!==input.type||old.value!==input.value)return;
      for(const attr of ['min','max','disabled','aria-invalid','aria-describedby']){
        const next=input.getAttribute(attr);if(old.getAttribute(attr)===next)continue;
        if(next===null)old.removeAttribute(attr);else old.setAttribute(attr,next);
      }
      input.replaceWith(old);
    });
  }
  function renderRoot(root){
    retainTemporalControls(root);
    if(C.state.receipt)temporalDrafts.clear();
    const state=C.state;root.setAttribute('data-package-screen',state.screen);
    const receivedTransition=root.getAttribute('data-event-package-root')==='mobile'&&state.screen==='receipt'&&state.requestStatus==='received'&&root.packageLastScreen!=='receipt'&&root.packageLastRequestStatus==='submitting';
    if(receivedTransition){
      const active=document.activeElement;
      if(active&&root.contains?.(active))active.blur?.();
    }
    if(root.getAttribute('data-event-package-root')==='mobile'){root.closePackageAirport?.();window.PixkuyAirportMobileHotelSearchSheet?.closeForField(root.closest('.events-mobile-route'));}
    const contactRoot=root.getAttribute('data-event-package-root')==='contact';
    if(contactRoot){root.hidden=!isRootInteractive(root);if(root.hidden){cancelAirportAutoQuote(root);(root.packageAddresses||[]).forEach(controller=>controller.destroy());root.packageAddresses=[];root.innerHTML='';return;}}
    const active=document.activeElement;const receiptHadFocus=root.contains?.(active)&&active?.hasAttribute?.('data-package-confirmation-title');const caret=active&&root.contains(active)?[active.selectionStart,active.selectionEnd]:null;const focused=document.activeElement&&root.contains(document.activeElement)?document.activeElement.getAttribute('data-package-field'):null;const focusedValue=active?.value;
    const sharedContact=window.PixkuyEventPackagesContact?.isActive();
    const receipt=sharedContact||state.configurationSurface==='contact'?'':receiptContent(state);
    const mobileReview=root.getAttribute('data-event-package-root')==='mobile'&&state.screen==='contact'&&state.selection?mobileReviewContact(state):'';
    let detail=receipt||mobileReview||(state.screen==='catalog'||state.screen==='contact'||(!contactRoot&&state.configurationSurface==='contact')?'':configuration(state,root.getAttribute('data-event-package-root')));
    const desktop=root.getAttribute('data-event-package-root')==='desktop';
    if(!sharedContact&&state.error)detail+='<p class="events-package-alert" role="alert" tabindex="-1">'+esc(state.error.includes('PUBLICATION')||state.error.includes('QUOTE')?t('reviewChanged'):t(/NOT_OFFERED/.test(state.error)?'notOffered':/INVALID|REQUIRED|OUTSIDE_PERIOD|RESTRICTION/.test(state.error)?'invalidData':'error'))+'</p>';
    if(!sharedContact&&state.recoveryNotice&&!state.receipt)detail+='<div class="events-package-status"><p role="status">'+esc(t('recoveryNotice'))+'</p>'+button('recover',t('recover'),false,'secondary')+'</div>';
    if(!sharedContact&&!state.storageAvailable)detail+='<p class="events-package-status" role="status">'+esc(t('storageWarning'))+'</p>';
    if(!sharedContact&&state.requestStatus==='unknown')detail+='<div class="events-package-status"><p role="alert">'+esc(t('unknownReception'))+'</p>'+button('recover',t('recover'),false,'secondary')+button('retry',t('retry'),false,'primary')+'</div>';
    const html=desktop?customStrip(state)+catalog(state)+(detail?'<section class="events-package-detail">'+detail+'</section>':''):state.screen==='catalog'?catalog(state,root.getAttribute('data-event-package-root')==='mobile')+customStrip(state)+(state.recoveryNotice?detail:''):detail;
    const mobileReceiptMarkup=root.getAttribute('data-event-package-root')==='mobile'&&state.receipt?.requestKind==='package'&&receipt;
    if(mobileReceiptMarkup&&root.packageReceiptMarkup===html){settleMobileReceipt(root,false);return;}
    root.packageReceiptMarkup=mobileReceiptMarkup?html:null;
    (root.packageAddresses||[]).forEach(controller=>controller.destroy());
    const reviewKey=mobileReview?[state.selection.eventId,state.selection.packageId,state.selection.optionId,locale()].join(':'):'';
    const contactFields=reviewKey&&root.packageReviewKey===reviewKey?root.querySelector('.events-package-mobile-contact__fields'):null;
    root.innerHTML=html.replaceAll('name="package-option"','name="package-option-'+root.getAttribute('data-event-package-root')+'"');
    if(contactFields){
      contactFields.disabled=window.PixkuyEventPackagesRequest.hasFrozenBody()||state.requestStatus==='submitting';
      contactFields.querySelectorAll('[data-package-field]').forEach(input=>{const value=state.contact?.[input.getAttribute('data-package-field').slice(8)]||'';if(input.value!==value)input.value=value;});
      root.querySelector('.events-package-mobile-contact__fields')?.replaceWith(contactFields);
    }
    root.packageReviewKey=reviewKey;
    scheduleMobileReviewExpiry(root);
    if(root.getAttribute('data-event-package-root')!=='mobile')restoreTemporalControls(root,state);
    mountAddresses(root);
    mountAirportSelector(root);
    syncHourlyDesktopSummary(root);
    root.querySelectorAll('[data-package-service]').forEach(node=>node.addEventListener('toggle',()=>{C.state.expandedServiceIds=Array.from(root.querySelectorAll('[data-package-service][open]')).map(item=>item.getAttribute('data-package-service'));}));
    if(focused){const target=Array.from(root.querySelectorAll('[data-package-field]')).find(node=>node.getAttribute('data-package-field')===focused&&(node.type!=='radio'||node.value===focusedValue));if(target){target.focus({preventScroll:true});if(caret&&typeof caret[0]==="number"){try{target.setSelectionRange(caret[0],caret[1]);}catch{}}}}
    const legacy=root.parentElement&&root.parentElement.querySelector('[data-events-mobile-flow]');if(legacy)legacy.hidden=state.screen!=='catalog';
    if(desktop||contactRoot||root.getAttribute('data-event-package-root')==='mobile')scheduleAirportAutoQuote(root);
    settleMobileReceipt(root,receivedTransition);
    if(desktop&&receipt&&(root.packageReceiptReference!==state.receipt.reference||receiptHadFocus)){
      root.packageReceiptReference=state.receipt.reference;
      window.requestAnimationFrame?.(()=>root.querySelector('[data-package-confirmation-title]')?.focus?.({preventScroll:true}));
    }
    root.packageLastScreen=state.screen;root.packageLastRequestStatus=state.requestStatus;
  }
  function isRootInteractive(root){
    if(root.getAttribute?.('data-event-package-root')==='contact')return C.state.configurationSurface==='contact'&&C.state.screen==='config'&&window.PixkuyEventPackagesContact?.isActive()&&window.PixkuyEventPackagesContact.matchesSelection();
    return C.state.configurationSurface!=='contact';
  }
  function changeField(target,silent){const name=target.getAttribute('data-package-field');if(!name)return;const value=target.value;const checked=target.checked;if(name.startsWith('hourly-common:')){const key=name.split(':')[1];H.changeHabit(C.state,key,key==='origin'?(value?{address:value}:null):value);refreshAirportQuote();return;}if(name.startsWith('contact:')){C.state.contact[name.slice(8)]=value;return;}if(name==='package'||name==='option'){if(!C.choose(name==='package'?value:(target.getAttribute('data-package-option-package')||C.state.selection.packageId),name==='option'?value:'',()=>window.confirm(t('changeLoss'))))C.notify();return;}
    C.change(selection=>{if(name.startsWith('need:')){const flag=name.slice(5);selection.inquiry.needsFlags=checked?[...new Set([...selection.inquiry.needsFlags,flag])]:selection.inquiry.needsFlags.filter(v=>v!==flag);}else if(name==='reason')selection.inquiry.reasonCode=value;else if(name==='inquiryNotes')selection.inquiry.notes=value;else if(name==='passengersKnown')selection.inquiry.passengers=checked?{status:'known',count:1}:{status:'pending',count:null};else if(name==='customPassengers')selection.inquiry.passengers={status:'known',count:Number(value)};else if(name.startsWith('service:')){const [,id,fieldName]=name.split(':');H.markException(C.state,id,fieldName.slice(9));if(fieldName==='additional'){selection.additionalServiceIds=checked?[...selection.additionalServiceIds,id]:selection.additionalServiceIds.filter(v=>v!==id);if(!checked)selection.services=selection.services.filter(s=>s.serviceId!==id);return;}let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}if(fieldName.startsWith('ordinary-')){const key=fieldName.slice(9);const option=C.state.selectedEvent.snapshot.packages.find(p=>p.id===selection.packageId)?.options.find(o=>o.id===selection.optionId);const input=option?.services.find(s=>s.id===id)?.ordinary?.inputs[key];if(option?.calculationModel!=='ordinary_services'||(input?.source!=='customer'&&!(key==='baggageCount'&&!input&&option.services.find(s=>s.id===id)?.ordinary?.inputs.baggageStatus?.source==='customer')))return;data.ordinaryInputs=data.ordinaryInputs||{};if(!value)delete data.ordinaryInputs[key];else data.ordinaryInputs[key]=key==='origin'||key==='destination'?{address:value}:key==='durationHours'||key==='baggageCount'?Number(value):value;if(key==='baggageCount')delete data.ordinaryInputs.baggageStatus;}else if(fieldName==='fromAddress'||fieldName==='toAddress')data[fieldName==='fromAddress'?'from':'to']={address:value};else if(fieldName==='baggage'){if(!value){delete data.baggage;return;}data.baggage={status:value,items:[],specialRequirementsPresent:false};}else if(fieldName.startsWith('bag-')){if(!data.baggage)return;const categoryId=fieldName.slice(4);data.baggage.items=data.baggage.items.filter(v=>v.categoryId!==categoryId);data.baggage.items.push({categoryId,count:Number(value)});}else if(fieldName==='specialNeeds'){if(!data.baggage)data.baggage={status:'unknown',items:[],specialRequirementsPresent:checked};else data.baggage.specialRequirementsPresent=checked;}else if(fieldName==='startLocal')data.startLocal=value||null;else if(value)data[fieldName]=value;else delete data[fieldName];}},{silent,onlyWhenChanged:true});
    if(silent)refreshAirportQuote();
  }
  function changeRootField(root,target){
    // Places can leave a native change pending until blur. Actual typing already
    // invalidates the reference on input; an unchanged committed address must survive.
    if(root.querySelector?.('[data-hourly-desktop]')&&H.unchangedAddress(C.state,target.getAttribute('data-package-field'),target.value))return;
    if(root.getAttribute('data-event-package-root')==='mobile'&&target.getAttribute('data-package-browse-option')===''){
      if(window.PixkuyEventPackagesRequest.hasFrozenBody()||['submitting','unknown','received'].includes(C.state.requestStatus))return;
      const view=mobilePackageView(C.state),pkg=activePackages(C.state.selectedEvent).find(item=>item.id===view.packageId);
      if(!pkg||!activeOptions(pkg).some(option=>option.id===target.value))return;
      const value=target.value;view.options[pkg.id]=value;C.notify();
      (root.querySelector('[data-package-browse-option][value="'+value+'"]')||root.querySelector('select[data-package-browse-option]'))?.focus({preventScroll:true});return;
    }
    if(root.getAttribute('data-event-package-root')==='mobile'&&target.hasAttribute?.('data-package-mobile-band')){
      if(['','van_1_2','van_3_4','van_5_6'].includes(target.value)){C.change(selection=>{delete selection.passengerCount;selection.passengerBand=target.value;},{silent:true});refreshAirportQuote();}
      return;
    }
    // A blur/change between pointerdown and click must not replace the mobile
    // conditions trigger. Input already updates state; keep the same control.
    const preserve=(root.getAttribute('data-event-package-root')==='mobile'||configuredDirectOption(C.state)||configuredAirportOption(C.state)||H.configured(C.state)||target.type==='time'||target.type==='datetime-local')&&target.getAttribute('data-package-field')?.startsWith('service:')&&['text','date','time','datetime-local','number','select-one'].includes(target.type);
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
  async function initializeRecoverySurface(){
    await window.PixkuyEventPackagesRequest.initialize();
    if(!C.state.receipt&&!C.state.recoveryNotice)return;
    // Surface controllers boot after this module. Recovery must not depend on
    // the catalogue finishing or on a service parameter surviving in the URL.
    if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    if(!C.state.receipt&&!C.state.recoveryNotice)return;
    C.state.configurationSurface='upper';
    const mobile=window.matchMedia('(max-width:720px)').matches;
    if(mobile)await window.PixkuyEventsMobileBookingFlow?.open();
    else window.PixkuyServicesExpand?.open('events',{scroll:false});
    C.notify();
    const root=Array.from(roots).find(node=>node.getAttribute('data-event-package-root')===(mobile?'mobile':'desktop'));
    const target=root?.querySelector(C.state.receipt?'[data-package-confirmation-title]':'[data-package-action="recover"]');
    if(mobile){if(!C.state.receipt){const route=root?.closest('.events-mobile-route');if(route)route.scrollTop=0;}}
    else target?.scrollIntoView?.({block:'start',behavior:'instant'});
    target?.focus?.({preventScroll:true});
  }
  function mount(parent,surface){if(!parent)return null;let root=parent.querySelector('[data-event-package-root="'+surface+'"]');if(root)return root;root=document.createElement('section');root.setAttribute('data-events-offer','packages');root.setAttribute('data-event-package-root',surface);let host=parent;if(surface==='desktop'){const legacyCatalog=parent.querySelector('[data-services-events-catalog]');let unified=parent.querySelector('[data-events-unified-catalog]');if(legacyCatalog&&!unified){unified=document.createElement('div');unified.className='events-catalog-grid';unified.setAttribute('data-events-unified-catalog','');legacyCatalog.before(unified);unified.appendChild(legacyCatalog);}if(unified)host=unified;}host.appendChild(root);roots.add(root);root.addEventListener('change',event=>changeRootField(root,event.target));root.addEventListener('input',event=>{const key=event.target.getAttribute('data-package-field');if(key&&key.startsWith('contact:')){C.state.contact[key.slice(8)]=event.target.value;clearMobileContactValidation(event.target);}else if(key&&['text','textarea','tel','email','date','time','datetime-local','number'].includes(event.target.type)){changeField(event.target,true);if(surface==='mobile'){const fields=Array.from(root.querySelectorAll('[data-package-field]'));validateField(root,event.target,Math.max(0,fields.indexOf(event.target)));}}});root.addEventListener('focusout',event=>{const key=event.target?.getAttribute?.('data-package-field');if(key?.startsWith('contact:'))validateMobilePackageContact(root,key.slice(8));});root.addEventListener('submit',event=>{if(!event.target?.matches?.('[data-package-mobile-contact-form]'))return;event.preventDefault();void submitMobilePackageContact(root);});root.addEventListener('click',event=>{void handleClick(root,event);});renderRoot(root);if(surface!=='contact'&&!recoveryInitialization){void load();recoveryInitialization=initializeRecoverySurface();}return root;}
  async function open(eventId){C.state.configurationSurface='upper';if(window.matchMedia('(max-width:720px)').matches&&window.PixkuyEventsMobileBookingFlow){window.PixkuyEventsMobileConfigStep?.close();await window.PixkuyEventsMobileBookingFlow.open();}else{const toggle=document.querySelector('[data-service-expand-trigger="events"]');const panel=document.getElementById('services-expand-events');if(panel&&panel.hidden&&toggle)toggle.click();}if(C.state.catalogStatus!=='ready')await load();const item=C.state.events.find(e=>e.id===eventId);if(item&&C.selectEvent(item,!item.snapshot.packages.length))window.dispatchEvent(new CustomEvent('pixkuy:events-detail-activated',{detail:{source:'packages'}}));const root=Array.from(roots).find(r=>r.offsetParent!==null);if(root)root.scrollIntoView({block:'start',behavior:'smooth'});}
  C.subscribe(()=>roots.forEach(renderRoot));window.addEventListener('pixkuy:events-detail-activated',event=>{if(event.detail?.source!=='special'||C.state.screen==='catalog')return;closePackageDetailsDialog();C.state.screen='catalog';C.notify();});window.addEventListener('pixkuy:i18n-applied',()=>{closePackageDetailsDialog();roots.forEach(renderRoot);void load();});
  window.addEventListener('resize',()=>roots.forEach(syncHourlyDesktopSummary));
  window.addEventListener('pixkuy:events-vehicle-gallery-ready',()=>{if(C.state.step==='services'&&(window.matchMedia('(max-width:720px)').matches||H.configured(C.state)))refreshAirportQuote();});
  window.matchMedia?.('(max-width:720px)').addEventListener?.('change',()=>{
    // Reassign queued work to the newly active surface before hidden roots render.
    if(window.matchMedia('(max-width:720px)').matches&&C.state.configurationSurface==='contact'&&H.configured(C.state))C.state.configurationSurface='upper';
    cancelAirportAutoQuote();roots.forEach(renderRoot);
  });
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
  function receiptJourneys(detail,mobile=false){
    const projection=detail?.directJourneys;
    if(projection?.version!==1||!Array.isArray(projection.journeys)||!projection.journeys.length||projection.journeys.some(day=>![day.outboundStartsAtUtc,day.returnStartsAtUtc].every(value=>typeof value==='string'&&Number.isFinite(Date.parse(value)))||typeof day.independentReturnDate!=='boolean'))return '';
    const format=(value,options)=>new Intl.DateTimeFormat(locale(),{...options,timeZone:'America/Mexico_City'}).format(new Date(value));
    const dayFormat=mobile?{weekday:'long',day:'numeric',month:'short',year:'numeric'}:{dateStyle:'full'};
    const rows=projection.journeys.map(day=>{
      const differentDate=format(day.outboundStartsAtUtc,{dateStyle:'short'})!==format(day.returnStartsAtUtc,{dateStyle:'short'});
      const time=value=>'<span>'+esc(format(value,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}))+'</span>';
      return '<tr><th scope="row">'+esc(format(day.outboundStartsAtUtc,dayFormat))+'</th><td>'+time(day.outboundStartsAtUtc)+'</td><td>'+((day.independentReturnDate||differentDate)?'<p>'+esc(format(day.returnStartsAtUtc,dayFormat))+'</p>':'')+time(day.returnStartsAtUtc)+'</td></tr>';
    }).join('');
    return '<table class="events-package-receipt__table"><thead><tr><th scope="col">'+esc(t('desktopJourney'))+'</th><th scope="col">'+esc(t('outboundHeading'))+'</th><th scope="col">'+esc(t('returnHeading'))+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  Object.assign(fallback,{mobileReceiptTitle:'Solicitud recibida',mobileReceiptNext:'Su solicitud ha quedado registrada. Nos pondremos en contacto con usted para revisar los detalles.',receiptRequestedSchedules:'Horarios solicitados',receiptRecordedEnd:'Fin registrado'});
  function receiptMoney(minor,currency){
    if(!/^(0|[1-9][0-9]*)$/.test(String(minor))||!(/^[A-Z]{3}$/).test(currency||''))return t('pending');
    // Format recorded minor units exactly, including values beyond Number's precision.
    const amount=BigInt(minor),fraction=new Intl.NumberFormat(locale(),{minimumIntegerDigits:2,useGrouping:false}).format(Number(amount%100n));
    return new Intl.NumberFormat(locale(),{style:'currency',currency,currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(amount/100n).map(part=>part.type==='fraction'?fraction:part.value).join('');
  }
  function mobileReceipt(receipt,services){
    const detail=receipt.confirmation,title=local(detail?.eventTitle)||receipt.eventTitle,packageTitle=local(detail?.packageTitle)||receipt.packageTitle,optionTitle=local(detail?.optionTitle)||receipt.optionTitle;
    const hourly=H.receipt(detail),itinerary=hourly?.table||receiptJourneys(detail,true)||(services?'<ol class="events-package-receipt__itinerary">'+services+'</ol>':'');
    const passengers=receipt.passengerBand||receipt.passengerCount!==undefined?passengerDescription(receipt):'';
    return '<section class="events-package-receipt events-package-receipt--mobile'+(hourly?' events-package-receipt--hourly':'')+'" data-package-confirmation aria-label="'+esc(t('mobileReceiptTitle'))+'">'+
      '<header><h3 tabindex="-1" data-package-confirmation-title><span class="events-package-receipt__check" aria-hidden="true">✓</span>'+esc(t('mobileReceiptTitle'))+'</h3><p>'+esc(t('mobileReceiptNext'))+'</p><p class="events-package-receipt__notice">'+esc(t('confirmationReservation'))+'</p><p>'+esc(t('confirmationNoRepeat'))+'</p></header>'+
      '<div class="events-package-receipt__reference"><div><span>'+esc(t('receiptReference'))+'</span><span class="events-package-receipt__reference-value">'+esc(receipt.reference)+'</span></div>'+button('copy-reference',t('copyReference'),false,'secondary')+'<span role="status" data-reference-status></span></div>'+
      (hourly?'<section class="events-package-receipt__summary"><p class="events-package-receipt__event">'+esc(title)+'</p><h4>'+esc(packageTitle||t('custom'))+'</h4>'+(optionTitle||passengers?'<p class="events-package-receipt__mode">'+esc([optionTitle,passengers?t('passengers')+': '+passengers:''].filter(Boolean).join(' · '))+'</p>':'')+'</section>':
      '<dl class="events-package-receipt__summary"><div><dt>'+esc(t('receiptEvent'))+'</dt><dd class="events-package-receipt__event">'+esc(title)+'</dd></div><div><dt>'+esc(t('package'))+'</dt><dd>'+esc(packageTitle||t('custom'))+'</dd>'+
      (optionTitle||passengers?'<dd class="events-package-receipt__mode">'+esc([optionTitle,passengers?t('passengers')+': '+passengers:''].filter(Boolean).join(' · '))+'</dd>':'')+'</div></dl>')+
      (itinerary?'<section class="events-package-receipt__journeys'+(hourly?' events-package-hourly-review--mobile':'')+'"><'+(hourly?'h5':'h4')+'>'+esc(t(hourly?'desktopJourneys':'receiptRequestedSchedules'))+(hourly?.years?' · '+esc(hourly.years):'')+'</'+(hourly?'h5':'h4')+'><p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p>'+itinerary+'</section>':'')+
      (receipt.baggage?.some(item=>Number.isSafeInteger(item.count)&&item.count>=0)?'<p>'+esc(t('baggage'))+': '+baggageSummary(receipt.baggage.map(item=>Number.isSafeInteger(item.count)&&item.count>=0?{baggage:item}:{}))+'</p>':'')+
      '<div class="events-package-receipt__total"><strong>'+esc(t('packageTotal'))+'</strong><p class="events-package-receipt__amount">'+esc(receipt.priceStatus==='quoted'&&receipt.pricedSubtotal!==null&&receipt.pricedSubtotal!==undefined?(hourly?receiptMoney:money)(receipt.pricedSubtotal,receipt.currency):t('pending'))+'</p>'+(receipt.priceStatus!=='quoted'?'<p>'+esc(t(receipt.priceStatus==='conditional'?'conditional':'personalized'))+'</p>':'')+'</div>'+
      (detail?.conditions?.length?'<button type="button" class="events-package-button events-package-button--secondary" data-package-action="receipt-conditions" aria-haspopup="dialog">'+esc(t('desktopConditions'))+'</button>':'')+
      '<div class="events-package-receipt__actions">'+button('whatsapp',t('confirmationWhatsapp'),false,'secondary')+button('new',t('confirmationNew'),false,'quiet')+'</div></section>';
  }
  function desktopHourlyReceipt(receipt,hourly){
    // Only the recorded receipt and its pure historical Hourly projection.
    const detail=receipt.confirmation,title=local(detail?.eventTitle)||receipt.eventTitle,packageTitle=local(detail?.packageTitle)||receipt.packageTitle,optionTitle=local(detail?.optionTitle)||receipt.optionTitle;
    const passengers=receipt.passengerBand||receipt.passengerCount!==undefined?passengerDescription(receipt):'',conditions=detail?.conditions||[];
    return '<section class="events-package-receipt events-package-receipt--desktop events-package-receipt--hourly-desktop" data-package-confirmation aria-label="'+esc(t('mobileReceiptTitle'))+'">'+
      '<header><h3 role="status" tabindex="-1" data-package-confirmation-title><span class="events-package-receipt__check" aria-hidden="true">✓</span>'+esc(t('mobileReceiptTitle'))+'</h3><p>'+esc(t('mobileReceiptNext'))+'</p><p class="events-package-receipt__notice">'+esc(t('confirmationReservation'))+'</p><p>'+esc(t('confirmationNoRepeat'))+'</p></header>'+
      '<div class="events-package-receipt__reference"><div><span>'+esc(t('receiptReference'))+'</span><span class="events-package-receipt__reference-value">'+esc(receipt.reference)+'</span></div>'+button('copy-reference',t('copyReference'),false,'secondary')+'<span role="status" data-reference-status></span></div>'+
      '<div class="events-package-receipt__columns"><div class="events-package-receipt__journeys"><section class="events-package-receipt__summary"><p class="events-package-receipt__event">'+esc(title)+'</p><h4>'+esc(packageTitle||t('custom'))+'</h4>'+(optionTitle||passengers?'<p class="events-package-receipt__mode">'+esc([optionTitle,passengers?t('passengers')+': '+passengers:''].filter(Boolean).join(' · '))+'</p>':'')+
      (receipt.baggage?.some(item=>Number.isSafeInteger(item.count)&&item.count>=0)?'<p>'+esc(t('baggage'))+': '+baggageSummary(receipt.baggage.map(item=>Number.isSafeInteger(item.count)&&item.count>=0?{baggage:item}:{}))+'</p>':'')+'</section>'+
      '<section class="events-package-receipt__hourly-schedule"><h5>'+esc(t('desktopJourneys'))+(hourly.years?' · '+esc(hourly.years):'')+'</h5><p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p>'+hourly.table+'</section></div><aside class="events-package-receipt__side">'+
      '<div class="events-package-receipt__total"><strong>'+esc(t('packageTotal'))+'</strong><p class="events-package-receipt__amount">'+esc(receipt.priceStatus==='quoted'&&receipt.pricedSubtotal!==null&&receipt.pricedSubtotal!==undefined?receiptMoney(receipt.pricedSubtotal,receipt.currency):t('pending'))+'</p>'+(receipt.priceStatus!=='quoted'?'<p>'+esc(t(receipt.priceStatus==='conditional'?'conditional':'personalized'))+'</p>':'')+'</div>'+
      (conditions.length?'<details class="events-package-receipt__conditions"><summary>'+esc(t('desktopConditions'))+'</summary><ul>'+conditions.map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong><p>'+esc(local(condition.description))+'</p></li>').join('')+'</ul></details>':'')+
      '<div class="events-package-receipt__actions">'+button('whatsapp',t('confirmationWhatsapp'),false,'secondary')+button('new',t('confirmationNew'),false,'quiet')+'</div></aside></div></section>';
  }
  function receiptContent(state){
    if(!state.receipt)return '';
    const receipt=state.receipt,detail=receipt.confirmation;
    const title=local(detail?.eventTitle)||receipt.eventTitle;
    const packageTitle=local(detail?.packageTitle)||receipt.packageTitle;
    const optionTitle=local(detail?.optionTitle)||receipt.optionTitle;
    const desktop=receipt.requestKind!=='custom'&&!window.matchMedia('(max-width:720px)').matches;
    const mobilePackage=receipt.requestKind==='package'&&window.matchMedia('(max-width:720px)').matches;
    const services=(detail?.services||[]).map(service=>{
      const route=service.baseService==='airport_transfer'
        ? t(service.direction==='airport_to_destination'?'confirmationArrival':service.direction==='destination_to_airport'?'confirmationDeparture':'airport')
        : service.baseService==='hourly_daily'||service.kind==='block'?t('ordinaryHourly')
        : service.baseService==='direct_transfer'?(service.directLeg?t(service.directLeg==='return'?'returnHeading':'outboundHeading')+(desktop?'':' · '+t('directTransferLabel')):t('directTransferLabel'))
        : [t(service.from==='airport'?'airport':service.from==='venue'?'venueLabel':'address'),t(service.to==='airport'?'airport':service.to==='venue'?'venueLabel':'address')].join(' → ');
      if(desktop||mobilePackage){
        const start=service.startsAtUtc&&Number.isFinite(Date.parse(service.startsAtUtc))?new Date(service.startsAtUtc):null;
        const format=options=>start?new Intl.DateTimeFormat(locale(),{...options,timeZone:'America/Mexico_City'}).format(start):t('ordinaryDeferred');
        // Direct endsAtUtc adds the route estimate to the requested start. It is
        // operational evidence, not another requested pickup or a promised arrival.
        const end=(service.kind==='block'||mobilePackage&&service.baseService!=='direct_transfer')&&service.endsAtUtc&&service.endsAtUtc!==service.startsAtUtc
          ?'<p>'+esc(t(service.kind==='block'?'receiptEnd':'receiptRecordedEnd'))+': '+esc(receiptServiceTime(service.endsAtUtc))+'</p>':'';
        return '<li><strong>'+esc(route)+'</strong><dl class="events-package-receipt__schedule"><div><dt>'+esc(t('ordinaryDate'))+'</dt><dd>'+esc(format({dateStyle:'full'}))+'</dd></div><div><dt>'+esc(t('receiptRequestedTime'))+'</dt><dd>'+esc(format({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}))+'</dd></div></dl>'+end+'</li>';
      }
      return '<li><strong>'+esc(route)+'</strong><p>'+esc(receiptServiceTime(service.startsAtUtc))+'</p>'+
        (service.endsAtUtc&&service.endsAtUtc!==service.startsAtUtc?'<p>'+esc(receiptServiceTime(service.endsAtUtc))+'</p>':'')+'</li>';
    }).join('');
    const conditions=detail?.conditions||[];
    if(mobilePackage)return mobileReceipt(receipt,services);
    const hourly=desktop&&H.receipt(detail);
    if(hourly)return desktopHourlyReceipt(receipt,hourly);
    if(desktop)return '<section class="events-package-receipt events-package-receipt--desktop" data-package-confirmation aria-label="'+esc(t('confirmationTitle'))+'">'+
      '<header><h3 role="status" tabindex="-1" data-package-confirmation-title><span class="events-package-receipt__check" aria-hidden="true">✓</span>'+esc(t('confirmationTitle'))+'</h3><p>'+esc(t('confirmationNext'))+'</p><p>'+esc(t('confirmationNoRepeat'))+'</p></header>'+
      '<div class="events-package-receipt__reference"><div><span>'+esc(t('receiptReference'))+'</span><span class="events-package-receipt__reference-value">'+esc(receipt.reference)+'</span></div>'+button('copy-reference',t('copyReference'),false,'secondary')+'<span role="status" data-reference-status></span></div>'+
      '<div class="events-package-receipt__columns"><div class="events-package-receipt__journeys"><dl class="events-package-receipt__summary"><dt>'+esc(t('receiptEvent'))+'</dt><dd>'+esc(title)+'</dd><dt>'+esc(t('package'))+'</dt><dd>'+esc(packageTitle||t('custom'))+'</dd>'+(optionTitle?'<dt>'+esc(t('reviewMode'))+'</dt><dd>'+esc(optionTitle)+'</dd>':'')+
      (receipt.passengerBand?'<dt>'+esc(t('passengers'))+'</dt><dd>'+esc(passengerDescription(receipt))+'</dd>':'')+
      (receipt.baggage?.some(item=>Number.isSafeInteger(item.count)&&item.count>=0)?'<dt>'+esc(t('baggage'))+'</dt><dd>'+baggageSummary(receipt.baggage.map(item=>Number.isSafeInteger(item.count)&&item.count>=0?{baggage:item}:{}))+'</dd>':'')+'</dl>'+
      (services?'<p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p>'+(receiptJourneys(detail)||'<ol class="events-package-receipt__itinerary">'+services+'</ol>'):'')+'</div><aside class="events-package-receipt__side">'+
      '<div class="events-package-receipt__total"><strong>'+esc(t('packageTotal'))+'</strong><p class="events-package-receipt__amount">'+esc(receipt.priceStatus==='quoted'&&receipt.pricedSubtotal!==null&&receipt.pricedSubtotal!==undefined?money(receipt.pricedSubtotal,receipt.currency):t('pending'))+'</p>'+(receipt.priceStatus!=='quoted'?'<p>'+esc(t(receipt.priceStatus==='conditional'?'conditional':'personalized'))+'</p>':'')+'</div>'+
      (conditions.length?'<details class="events-package-receipt__conditions"><summary>'+esc(t('desktopConditions'))+'</summary><ul>'+conditions.map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong><p>'+esc(local(condition.description))+'</p></li>').join('')+'</ul></details>':'')+
      '<p class="events-package-receipt__notice">'+esc(t('confirmationReservation'))+'</p><div class="events-package-receipt__actions">'+button('whatsapp',t('confirmationWhatsapp'),false,'secondary')+button('new',t('confirmationNew'),false,'quiet')+'</div></aside></div></section>';
    return '<section class="events-package-receipt" data-package-confirmation aria-label="'+esc(t('confirmationTitle'))+'">'+
      '<h3 role="status" tabindex="-1" data-package-confirmation-title><span class="events-package-receipt__check" aria-hidden="true">✓</span>'+esc(t('confirmationTitle'))+'</h3><p>'+esc(t('confirmationNext'))+'</p><p>'+esc(t('confirmationNoRepeat'))+'</p>'+
      '<div class="events-package-receipt__reference"><span>'+esc(t('receiptReference'))+': <span class="events-package-receipt__reference-value">'+esc(receipt.reference)+'</span></span>'+
      button('copy-reference',t('copyReference'),false,'secondary')+'<span role="status" data-reference-status></span></div>'+
      '<dl class="events-package-receipt__summary"><dt>'+esc(t('receiptEvent'))+'</dt><dd>'+esc(title)+'</dd>'+
      '<dt>'+esc(t('package'))+' / '+esc(t('option'))+'</dt><dd>'+esc([packageTitle,optionTitle].filter(Boolean).join(' · ')||t('custom'))+'</dd>'+
      (receipt.passengerBand?'<dt>'+esc(t('passengers'))+'</dt><dd>'+esc(passengerDescription(receipt))+'</dd>':'')+
      (services?'<dt>'+esc(t('services'))+'</dt><dd><ol>'+services+'</ol></dd>':'')+
      (receipt.baggage?.some(item=>Number.isSafeInteger(item.count)&&item.count>=0)?'<dt>'+esc(t('baggage'))+'</dt><dd>'+baggageSummary(receipt.baggage.map(item=>Number.isSafeInteger(item.count)&&item.count>=0?{baggage:item}:{}))+'</dd>':'')+
      '<dt>'+esc(t(receipt.priceStatus==='quoted'?'packageTotal':receipt.priceStatus==='conditional'?'conditional':'personalized'))+'</dt><dd class="events-package-receipt__amount">'+
      esc(receipt.priceStatus==='quoted'&&receipt.pricedSubtotal!==null&&receipt.pricedSubtotal!==undefined?money(receipt.pricedSubtotal,receipt.currency):t('pending'))+'</dd></dl>'+
      (conditions.length?'<details><summary>'+esc(t('conditions'))+'</summary><ul>'+conditions.map(condition=>'<li><strong>'+esc(local(condition.title))+'</strong> '+esc(local(condition.description))+'</li>').join('')+'</ul></details>':'')+
      '<p class="events-package-receipt__notice">'+esc(t('confirmationReservation'))+'</p>'+
      '<div class="events-package-receipt__actions">'+button('whatsapp',t('confirmationWhatsapp'),false,'secondary')+button('new',t('confirmationNew'),false,'quiet')+'</div></section>';
  }
  window.PixkuyEventPackagesConfig={mount,open,t,money,load,closePackageDetailsDialog,eventTitle,eventDates,eventVenue};
  Object.assign(window.PixkuyEventPackagesConfig,{copyReference,reviewSelectors,quoteIsCurrent:airportCanReview,renderContact:renderRoot,contactHandoff,receiptContent,isHourlyReview:state=>!!H.view(state),contactSummary:(state,omitTitle,hourlyDesktop)=> (hourlyDesktop?hourlyDesktopReview(state):reviewItinerary(state,!window.matchMedia('(max-width:720px)').matches,omitTitle))+summary(state,!window.matchMedia('(max-width:720px)').matches?'desktop-review':undefined,hourlyDesktop),editServices:()=>{if(!C.go('services'))return false;if(window.matchMedia('(max-width:720px)').matches&&window.PixkuyEventsMobileBookingFlow){void open(C.state.selectedEvent.id);return true;}const root=Array.from(roots).find(r=>r.offsetParent!==null);if(root){root.scrollIntoView({block:'start',behavior:'smooth'});focusDetail(root);}return true;}});
})(window,document);
