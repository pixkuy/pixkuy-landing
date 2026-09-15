(function(window){
  'use strict';
  // UI conveniences only. The request always contains independent ordinary inputs.
  window.PixkuyEventPackagesHourly=function(api){
    const {C,t,esc,ordinaryInput,addressField,field,passengerField,baggageField,serviceBounds,receiptServiceTime,locale}=api;
    const defaults=new Map();
    C.subscribe(state=>{if(state.requestStatus==='received')defaults.clear();});
    const optionOf=state=>state.selectedEvent?.snapshot.packages.find(p=>p.id===state.selection?.packageId)?.options.find(o=>o.id===state.selection?.optionId);
    const offset=(date,days)=>{const value=Date.parse(date+'T12:00:00Z');return Number.isFinite(value)?new Date(value+days*86400000).toISOString().slice(0,10):'';};
    function view(state){
      const option=optionOf(state);
      if(state.selection?.requestKind!=='package'||option?.calculationModel!=='ordinary_services'||![1,3,7].includes(option.services.length)||option.services.some(s=>s.ordinary?.baseService!=='hourly_daily'||s.ordinary.inputs.mode?.source!=='fixed'||s.ordinary.inputs.mode.value!=='hourly'||s.ordinary.inputs.durationHours?.source!=='fixed'||s.ordinary.inputs.durationHours.value!==12))return null;
      if(option.services.length===7&&!option.hourlyCalendar)return null;
      const services=option.hourlyCalendar?[...option.hourlyCalendar.days].sort((a,b)=>a.dayOffset-b.dayOffset).map(day=>option.services.find(s=>s.id===day.serviceId)):[...option.services].sort((a,b)=>String(a.ordinary.inputs.date?.value||'').localeCompare(String(b.ordinary.inputs.date?.value||'')));
      if(services.some(s=>!s))return null;
      return {hourly:true,option,services,service:services[0],pkg:state.selectedEvent.snapshot.packages.find(p=>p.id===state.selection.packageId)};
    }
    function configured(state){return state.step==='services'&&state.screen==='config'?view(state):null;}
    function values(service,state){
      const data=state.selection.services.find(s=>s.serviceId===service.id)?.ordinaryInputs||{};
      const result=Object.fromEntries(Object.entries(service.ordinary.inputs).map(([key,input])=>[key,input.source==='fixed'?(input.redacted?input.displayLabel||t('ordinaryFixed'):input.value):data[key]]));
      const calendar=optionOf(state)?.hourlyCalendar,day=calendar?.days.find(d=>d.serviceId===service.id);
      if(day){const start=state.selection.services.find(s=>s.serviceId===calendar.startServiceId)?.ordinaryInputs?.date;result.date=start?offset(start,day.dayOffset):'';}
      return result;
    }
    function habits(state){
      const key=[state.selectedEvent.id,state.selection.publicationVersion,state.selection.packageId,state.selection.optionId].join(':');
      if(!defaults.has(key))defaults.set(key,{origin:null,time:'',exceptions:new Set()});
      return defaults.get(key);
    }
    function markException(state,id,key){if(view(state)&&['origin','time'].includes(key))habits(state).exceptions.add(id+':'+key);}
    function unchangedAddress(state,name,text){
      const current=configured(state);if(!current)return false;
      const service=name?.endsWith(':ordinary-origin')&&current.services.find(s=>'service:'+s.id+':ordinary-origin'===name);
      const origin=name==='hourly-common:origin'?habits(state).origin:service?values(service,state).origin:null;
      return !!origin?.placeId&&origin.address===text;
    }
    function changeHabit(state,key,value){
      if(!configured(state)||window.PixkuyEventPackagesRequest.hasFrozenBody()||['unknown','submitting','received'].includes(state.requestStatus))return;
      const common=habits(state),option=optionOf(state);common[key]=value;
      C.change(selection=>{for(const service of option.services){
        if(service.ordinary.inputs[key]?.source!=='customer'||common.exceptions.has(service.id+':'+key))continue;
        let data=selection.services.find(s=>s.serviceId===service.id);if(!data){data={serviceId:service.id};selection.services.push(data);}
        data.ordinaryInputs=data.ordinaryInputs||{};if(value)data.ordinaryInputs[key]=typeof value==='object'?{...value}:value;else delete data.ordinaryInputs[key];
      }},{silent:true,onlyWhenChanged:true});
    }
    function windowBounds(state){
      const option=optionOf(state),calendar=option.hourlyCalendar;
      let min=calendar?.startDateWindow.from||'',max=calendar?.startDateWindow.until||'';
      for(const service of option.services){const bounds=serviceBounds(service,state),day=calendar?.days.find(d=>d.serviceId===service.id)?.dayOffset||0;
        if(bounds.minDate)min=[min,offset(bounds.minDate,-day)].sort().pop();
        if(bounds.maxDate)max=[max,offset(bounds.maxDate,-day)].filter(Boolean).sort()[0];
      }
      return {min,max};
    }
    function readiness(state,current){
      const missing=[],invalid=[],starts=[];
      if(!state.selection.passengerBand)missing.push(t('passengers'));
      for(const service of current.services){const v=values(service,state),bounds=serviceBounds(service,state),r=service.ordinary.restrictions||{};
        if(service.ordinary.inputs.origin?.source==='customer'){
          if(!v.origin?.address?.trim())missing.push(t('hourlyPickup'));else if(!v.origin.placeId)invalid.push(t('hourlyPickup'));
        }
        if(!v.date)missing.push(t('ordinaryDate'));else if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||offset(v.date,0)!==v.date||bounds.minDate&&v.date<bounds.minDate||bounds.maxDate&&v.date>bounds.maxDate)invalid.push(t('ordinaryDate'));
        if(!v.time)missing.push(t('hourlyStart'));else if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)||(r.fromTime&&r.untilTime?(r.fromTime<=r.untilTime?(v.time<r.fromTime||v.time>r.untilTime):(v.time<r.fromTime&&v.time>r.untilTime)):r.fromTime&&v.time<r.fromTime||r.untilTime&&v.time>r.untilTime))invalid.push(t('hourlyStart'));
        const start=v.date&&v.time?v.date+'T'+v.time:'';
        if(start){if(bounds.min&&start<bounds.min||bounds.max&&start>bounds.max)invalid.push(t('hourlyStart'));starts.push(Date.parse(start+':00-06:00'));}
        const bag=service.ordinary.inputs.baggageCount;
        if(bag?.source==='customer'&&v.baggageCount===undefined&&current.option.baggagePolicy?.allowUnknown===false)missing.push(t('baggageCount'));
        if(v.baggageCount!==undefined&&(!Number.isSafeInteger(v.baggageCount)||v.baggageCount<0))invalid.push(t('baggageCount'));
      }
      starts.sort((a,b)=>a-b);if(starts.some((start,index)=>index&&start<starts[index-1]+12*3600000))invalid.push(t('hourlyStart'));
      if(current.option.hourlyCalendar){const c=current.option.hourlyCalendar,start=values(current.service,state).date,bounds=windowBounds(state);if(start&&(start<bounds.min||start>bounds.max||c.requiredDates.some(d=>d<start||d>offset(start,6))))invalid.push(t('hourlyWeekStart'));}
      return {ready:!missing.length&&!invalid.length,missing:[...new Set(missing)],invalid:[...new Set(invalid)]};
    }
    function render(state,current,locked,surface){
      return surface==='mobile'?renderMobile(state,current,locked):renderDesktop(state,current,locked);
    }
    function refresh(root,state){
      const current=configured(state);if(!current)return;
      if(root.querySelector('[data-hourly-mobile]'))refreshMobile(root,state,current);
      else if(root.querySelector('[data-hourly-desktop]'))refreshDesktop(root,state,current);
    }
    function composition(current){
      const hours=current.services[0].ordinary.inputs.durationHours.value;
      return t(current.services.length===1?'hourlyDesktopSingle':'hourlyDesktopComposition',{count:current.services.length,hours:new Intl.NumberFormat(locale()).format(hours)});
    }
    function desktopRange(service,state,onlyEnd){
      const v=values(service,state);if(!validDate(v.date))return t('hourlyChooseDate');if(!validTime(v.time))return t('hourlyEnterTime');
      const duration=service.ordinary.inputs.durationHours.value,finish=reviewStamp(new Date(Date.parse(v.date+'T'+v.time+':00-06:00')+duration*3600000).toISOString());
      return esc((onlyEnd?'':v.time+'–')+finish.time)+(finish.date!==v.date?'<span class="events-package-hourly-desktop__end-date">'+esc(dayDate(finish.date,true))+'</span>':'');
    }
    function desktopPickup(service,state){
      const v=values(service,state),common=habits(state);
      if(!v.origin?.address)return esc(t('hourlyDesktopPickupPending'));
      return v.origin.placeId&&v.origin.placeId===common.origin?.placeId?esc(t('hourlyDesktopHabitual')):esc(v.origin.address);
    }
    function desktopIssue(service,state,current){
      const common=habits(state),v=values(service,state),parts=[];
      if(common.exceptions.has(service.id+':time')&&v.time!==common.time)parts.push(t('hourlyDifferentTime'));
      const problems=dayProblems(state,current,service);
      if(v.origin?.address&&!v.origin.placeId||validTime(v.time)&&problems.includes('time')||v.date&&problems.includes('date')||problems.includes('baggageCount'))parts.push(t('hourlyCheckDay'));
      return parts.map(text=>'<span>'+esc(text)+'</span>').join('');
    }
    function desktopEditor(state,current,service,locked){
      const reset=['origin','time'].some(key=>habits(state).exceptions.has(service.id+':'+key));
      return '<div class="events-package-hourly-desktop__editor-fields">'+mobileInput(state,current,service,'origin',locked)+mobileInput(state,current,service,'time',locked)+'<p class="events-package-hourly-desktop__end"><span class="services-expand__label">'+esc(t('hourlyEnd'))+'</span><span data-hourly-desktop-end="'+esc(service.id)+'">'+desktopRange(service,state,true)+'</span></p></div>'+((service.ordinary.inputs.baggageCount||service.ordinary.inputs.baggageStatus)?baggageField(service,state.selection.services.find(s=>s.serviceId===service.id)||{},'service:'+service.id+':'):'')+'<div class="events-package-hourly-desktop__editor-actions">'+(reset?'<button type="button" class="events-package-button events-package-button--quiet" data-package-action="hourly-reset" data-hourly-id="'+esc(service.id)+'"'+(locked?' disabled':'')+'>'+esc(t('hourlyUseHabits'))+'</button>':'')+'<button type="button" class="events-package-button events-package-button--secondary" data-package-action="hourly-done" data-hourly-id="'+esc(service.id)+'">'+esc(t('hourlyDone'))+'</button></div>';
    }
    function desktopDays(state,current,locked){
      if(current.option.hourlyCalendar&&!validDate(values(current.service,state).date))return '';
      return current.services.map(service=>{
        const open=state.expandedServiceIds?.[0]===service.id,v=values(service,state),id='hourly-desktop-editor-'+service.id;
        return '<tr data-hourly-desktop-row="'+esc(service.id)+'"><th scope="row" data-hourly-desktop-date="'+esc(service.id)+'">'+dateText(v.date)+'</th><td data-hourly-desktop-pickup="'+esc(service.id)+'">'+desktopPickup(service,state)+'</td><td><span data-hourly-desktop-range="'+esc(service.id)+'">'+desktopRange(service,state)+'</span><span class="events-package-hourly-desktop__issue" data-hourly-desktop-issue="'+esc(service.id)+'">'+desktopIssue(service,state,current)+'</span></td><td><button type="button" class="events-package-button events-package-button--quiet" data-package-action="hourly-edit" data-hourly-id="'+esc(service.id)+'" aria-label="'+esc(t('hourlyDesktopChangeDay',{date:dayDate(v.date,true)}))+'" aria-expanded="'+open+'" aria-controls="'+esc(id)+'"'+(open?' hidden':'')+(locked?' disabled':'')+'>'+esc(t('hourlyDesktopChange'))+'</button></td></tr><tr class="events-package-hourly-desktop__editor-row"'+(open?'':' hidden')+'><td colspan="4"><div id="'+esc(id)+'" class="events-package-hourly-desktop__editor">'+(open?desktopEditor(state,current,service,locked):'')+'</div></td></tr>';
      }).join('');
    }
    function desktopYears(state,current){return [...new Set(current.services.map(s=>values(s,state).date?.slice(0,4)).filter(Boolean))].sort().join(' / ');}
    function renderDesktop(state,current,locked){
      const multi=current.services.length>1,calendar=current.option.hourlyCalendar,common=habits(state),b=windowBounds(state),name='service:'+current.service.id+':ordinary-date',v=values(current.service,state);
      const date=calendar?'<div>'+withHint(field(name,t('hourlyWeekStart'),v.date,'date',(b.min?' min="'+esc(b.min)+'"':'')+(b.max?' max="'+esc(b.max)+'"':'')),name,v.date?hint(state,current,name):'')+'</div>':!multi?mobileInput(state,current,current.service,'date',locked):'<div class="events-package-hourly-desktop__fixed"><span class="services-expand__label">'+esc(t('hourlyDesktopFixedDates'))+'</span>'+current.services.map(s=>'<span>'+esc(dayDate(values(s,state).date,true))+'</span>').join('')+'</div>';
      const hasDates=!calendar||validDate(v.date);
      return '<section class="events-package-hourly events-package-hourly-desktop" data-hourly-desktop><fieldset class="events-package-primary-form" aria-label="'+esc(t('mobileTripData'))+'"'+(locked?' disabled':'')+'><div class="events-package-hourly-desktop__principal">'+date+passengerField(state.selection)+'</div><div class="events-package-hourly-desktop__common">'+(multi?'<div>'+addressField('hourly-common:origin',t('hourlyCommonPickup'),common.origin)+'<p class="events-package-hourly-desktop__address" data-hourly-common-address>'+esc(common.origin?.placeId?common.origin.address:'')+'</p></div><div>'+withHint(field('hourly-common:time',t('hourlyMobileCommonStart'),common.time,'time'),'hourly-common:time',hint(state,current,'hourly-common:time'))+'</div>':mobileInput(state,current,current.service,'origin',locked)+mobileInput(state,current,current.service,'time',locked))+'</div><p class="events-package-help">'+esc(t(multi?'hourlyAdjustDay':'sharedLocalTime'))+'</p>'+(!multi?'<p class="events-package-hourly-desktop__single-end"><span>'+esc(t('hourlyEnd'))+': </span><span data-hourly-desktop-end="'+esc(current.service.id)+'">'+desktopRange(current.service,state,true)+'</span></p>'+((current.service.ordinary.inputs.baggageCount||current.service.ordinary.inputs.baggageStatus)?baggageField(current.service,state.selection.services.find(s=>s.serviceId===current.service.id)||{},'service:'+current.service.id+':'):''):'<p class="events-package-help" data-hourly-desktop-empty'+(hasDates?' hidden':'')+'>'+esc(t('hourlyChooseDate'))+'</p><div data-hourly-desktop-agenda'+(hasDates?'':' hidden')+'><h4>'+esc(t('desktopJourneys'))+' <span data-hourly-desktop-years>'+esc(desktopYears(state,current))+'</span></h4><p class="events-package-help">'+esc(t('sharedLocalTime'))+'</p><table class="events-package-hourly-table events-package-hourly-desktop__agenda"><thead><tr><th scope="col">'+esc(t('hourlyReviewDate'))+'</th><th scope="col">'+esc(t('hourlyPickup'))+'</th><th scope="col">'+esc(t('hourlyDesktopSchedule'))+'</th><th scope="col">'+esc(t('hourlyDesktopAction'))+'</th></tr></thead><tbody data-hourly-desktop-days>'+desktopDays(state,current,locked)+'</tbody></table></div>')+'</fieldset></section>';
    }
    function refreshDesktop(root,state,current){
      const days=root.querySelector('[data-hourly-desktop-days]'),hasDates=!current.option.hourlyCalendar||validDate(values(current.service,state).date);
      if(days&&Boolean(days.children.length)!==hasDates){if(!hasDates)state.expandedServiceIds=[];days.innerHTML=desktopDays(state,current,window.PixkuyEventPackagesRequest.hasFrozenBody());}
      const agenda=root.querySelector('[data-hourly-desktop-agenda]'),empty=root.querySelector('[data-hourly-desktop-empty]');if(agenda)agenda.hidden=!hasDates;if(empty)empty.hidden=hasDates;
      const years=root.querySelector('[data-hourly-desktop-years]');if(years)years.textContent=desktopYears(state,current);
      const address=root.querySelector('[data-hourly-common-address]');if(address)address.textContent=habits(state).origin?.placeId?habits(state).origin.address:'';
      for(const service of current.services){
        const v=values(service,state);
        for(const [attr,html] of [['date',dateText(v.date)],['pickup',desktopPickup(service,state)],['range',desktopRange(service,state)],['issue',desktopIssue(service,state,current)],['end',desktopRange(service,state,true)]]){const node=root.querySelector('[data-hourly-desktop-'+attr+'="'+service.id+'"]');if(node)node.innerHTML=html;}
        const edit=root.querySelector('[data-hourly-id="'+service.id+'"][data-package-action="hourly-edit"]');if(edit)edit.setAttribute('aria-label',t('hourlyDesktopChangeDay',{date:dayDate(v.date,true)}));
        for(const key of ['origin','time']){const input=root.querySelector('[data-package-field="service:'+service.id+':ordinary-'+key+'"]');if(!input)continue;const next=key==='origin'?v.origin?.address||'':v.time||'';if(input!==window.document.activeElement&&input.value!==next)input.value=next;
          if(key==='time'){const raw=ordinaryInput(service,state.selection.services.find(s=>s.serviceId===service.id)||{},'service:'+service.id+':','time');for(const attr of ['min','max']){const value=raw.match(new RegExp(' '+attr+'="([^"]*)"'))?.[1]||'';if(value&&input.getAttribute(attr)!==value)input.setAttribute(attr,value);else if(!value&&input.hasAttribute(attr))input.removeAttribute(attr);}}
        }
      }
      root.querySelectorAll('[data-hourly-hint]').forEach(node=>{const text=hint(state,current,node.getAttribute('data-hourly-hint'));node.textContent=text;node.hidden=!text;});
    }
    // Mobile uses the same ordinary inputs; expandedServiceIds is presentation only.
    const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&offset(value,0)===value;
    const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'');
    function dayDate(value,full){return validDate(value)?new Intl.DateTimeFormat(locale(),{weekday:full?'long':'short',day:'numeric',month:full?'long':'short',...(full?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'';}
    function dateText(value){return '<time datetime="'+esc(value)+'"><span aria-hidden="true">'+esc(dayDate(value,false))+'</span><span class="visually-hidden">'+esc(dayDate(value,true))+'</span></time>';}
    function timeRange(service,state,onlyEnd){
      const v=values(service,state);if(!validDate(v.date)||!validTime(v.time))return onlyEnd?'—':t('hourlyEnterTime');
      const start=Date.parse(v.date+'T'+v.time+':00-06:00'),finish=new Date(start+12*3600000);
      const time=new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Mexico_City'}).format(finish);
      return (onlyEnd?'':v.time+'–')+time+(Number(v.time.slice(0,2))>=12?' · '+t('hourlyNextDay'):'');
    }
    function dayProblems(state,current,service){
      const checks=readiness(state,{...current,services:[service],option:{...current.option,hourlyCalendar:null}});
      const labels={origin:t('hourlyPickup'),date:t('ordinaryDate'),time:t('hourlyStart'),baggageCount:t('baggageCount')};
      const problems=Object.keys(labels).filter(key=>checks.missing.includes(labels[key])||checks.invalid.includes(labels[key]));
      const v=values(service,state),start=Date.parse(v.date+'T'+v.time+':00-06:00');
      if(current.services.some(other=>other.id!==service.id&&(()=>{const o=values(other,state),before=Date.parse(o.date+'T'+o.time+':00-06:00');return Number.isFinite(start)&&Number.isFinite(before)&&start>=before&&start<before+12*3600000;})())&&!problems.includes('time'))problems.push('time');
      return problems;
    }
    function firstProblem(state){
      const current=configured(state);if(!current)return null;
      const common=habits(state),multi=current.services.length>1;
      if(current.option.hourlyCalendar){const date=values(current.service,state).date,b=windowBounds(state);if(!validDate(date)||date<b.min||date>b.max)return 'service:'+current.service.id+':ordinary-date';}
      if(!state.selection.passengerBand)return 'passengerBand';
      if(multi&&!common.origin?.placeId&&current.services.some(s=>!values(s,state).origin?.placeId))return 'hourly-common:origin';
      if(multi&&!validTime(common.time)&&current.services.some(s=>!validTime(values(s,state).time)))return 'hourly-common:time';
      for(const service of current.services){const key=dayProblems(state,current,service)[0];if(key)return 'service:'+service.id+':ordinary-'+key;}
      return null;
    }
    function withHint(html,name,text){
      const id='hourly-hint-'+name.replaceAll(':','-');
      return html.replace('data-package-field="'+esc(name)+'"','data-package-field="'+esc(name)+'" aria-describedby="'+esc(id)+'" data-package-description="'+esc(id)+'"')+'<p class="events-package-hourly-mobile__hint" id="'+esc(id)+'" data-hourly-hint="'+esc(name)+'"'+(text?'':' hidden')+'>'+esc(text)+'</p>';
    }
    function hint(state,current,name){
      if(name==='hourly-common:time')return validTime(habits(state).time)?'':t('hourlyEnterTime');
      const [,id,raw]=name.split(':'),service=current.services.find(s=>s.id===id);if(!service)return '';
      const key=raw.slice(9),v=values(service,state);
      if(key==='date'){
        if(!v.date)return t('hourlyChooseDate');
        const b=current.option.hourlyCalendar?windowBounds(state):serviceBounds(service,state),min=b.minDate||b.min,max=b.maxDate||b.max;
        return !validDate(v.date)||min&&v.date<min||max&&v.date>max?t('hourlyDateRange',{from:dayDate(min,true),until:dayDate(max,true)}):'';
      }
      if(key==='time'){
        if(!validTime(v.time))return t('hourlyEnterTime');
        if(dayProblems(state,current,service).includes('time')){const b=serviceBounds(service,state);return b.max?.slice(0,10)===v.date?t('hourlyLatestStart',{time:b.max.slice(11)}):t('hourlyInvalidTime');}
      }
      if(key==='origin'&&v.origin?.address&&!v.origin.placeId)return t('hourlySelectPlace');
      return '';
    }
    function mobileInput(state,current,service,key,locked){
      const name='service:'+service.id+':ordinary-'+key,data=state.selection.services.find(s=>s.serviceId===service.id)||{};
      return '<div>'+withHint(ordinaryInput(service,data,'service:'+service.id+':',key,'',{label:key==='origin'?'hourlyPickup':key==='time'?'hourlyMobileStart':'ordinaryDate'}),name,hint(state,current,name)).replace('<input ',locked?'<input disabled ':'<input ')+'</div>';
    }
    function rowSummary(state,current,service){
      const v=values(service,state),common=habits(state),different=[];
      if(common.exceptions.has(service.id+':origin')&&JSON.stringify(v.origin)!==JSON.stringify(common.origin))different.push(t('hourlyDifferentPickup'));
      if(common.exceptions.has(service.id+':time')&&v.time!==common.time)different.push(t('hourlyDifferentTime'));
      const problems=dayProblems(state,current,service),ownError=problems.some(key=>common.exceptions.has(service.id+':'+key)||key==='time'&&validTime(v.time));
      return '<span class="events-package-hourly-mobile__date">'+dateText(v.date)+'</span><span class="events-package-hourly-mobile__range">'+esc(!validTime(v.time)?t('hourlyEnterTime'):problems.includes('time')?'—':timeRange(service,state))+'</span>'+(different.length?'<span class="events-package-hourly-mobile__exception">'+esc(different.join(' · '))+'</span>':'')+(ownError?'<span class="events-package-hourly-mobile__issue">'+esc(t('hourlyCheckDay'))+'</span>':'');
    }
    function mobileDays(state,current,locked){
      if(current.option.hourlyCalendar&&!validDate(values(current.service,state).date))return '';
      return current.services.map(service=>{
        const open=state.expandedServiceIds?.[0]===service.id,v=values(service,state),common=habits(state),id='hourly-editor-'+service.id;
        const reset=['origin','time'].some(key=>common.exceptions.has(service.id+':'+key));
        return '<li data-hourly-row="'+esc(service.id)+'"><div class="events-package-hourly-mobile__row"><div data-hourly-summary="'+esc(service.id)+'">'+rowSummary(state,current,service)+'</div><button type="button" class="events-package-hourly-mobile__link" data-package-action="hourly-edit" data-hourly-id="'+esc(service.id)+'" aria-label="'+esc(t('hourlyEditDay',{date:dayDate(v.date,true)}))+'" aria-expanded="'+open+'" aria-controls="'+esc(id)+'"'+(open?' hidden':'')+(locked?' disabled':'')+'>'+esc(t('hourlyEdit'))+'</button></div><div id="'+esc(id)+'" class="events-package-hourly-mobile__editor"'+(open?'':' hidden')+'>'+(open?mobileInput(state,current,service,'origin',locked)+'<div class="events-package-hourly-mobile__schedule">'+mobileInput(state,current,service,'time',locked)+'<p class="events-package-hourly-mobile__end"><span class="services-expand__label">'+esc(t('hourlyMobileEnd'))+'</span><span data-hourly-mobile-end="'+esc(service.id)+'">'+esc(timeRange(service,state,true))+'</span></p></div>'+((service.ordinary.inputs.baggageCount||service.ordinary.inputs.baggageStatus)?baggageField(service,state.selection.services.find(s=>s.serviceId===service.id)||{},'service:'+service.id+':'):'')+'<div class="events-package-hourly-mobile__editor-actions">'+(reset?'<button type="button" class="events-package-hourly-mobile__link" data-package-action="hourly-reset" data-hourly-id="'+esc(service.id)+'"'+(locked?' disabled':'')+'>'+esc(t('hourlyUseHabits'))+'</button>':'')+'<button type="button" class="events-package-button events-package-button--secondary" data-package-action="hourly-done" data-hourly-id="'+esc(service.id)+'">'+esc(t('hourlyDone'))+'</button></div>':'')+'</div></li>';
      }).join('');
    }
    function renderMobile(state,current,locked){
      const multi=current.services.length>1,common=habits(state),calendar=current.option.hourlyCalendar,b=windowBounds(state),startName='service:'+current.service.id+':ordinary-date';
      const date=calendar?'<div>'+withHint(field(startName,t('hourlyWeekStart'),values(current.service,state).date,'date',(b.min?' min="'+esc(b.min)+'"':'')+(b.max?' max="'+esc(b.max)+'"':'')),startName,hint(state,current,startName))+'</div>':!multi?mobileInput(state,current,current.service,'date'):'<p class="events-package-hourly-mobile__dates">'+current.services.map(s=>dateText(values(s,state).date)).join(' · ')+'</p>';
      return '<section class="events-package-hourly-mobile" data-hourly-mobile><fieldset class="events-package-primary-form" aria-label="'+esc(t('mobileTripData'))+'"'+(locked?' disabled':'')+'>'+date+passengerField(state.selection)+(multi?addressField('hourly-common:origin',t('hourlyCommonPickup'),common.origin)+'<div>'+withHint(field('hourly-common:time',t('hourlyMobileCommonStart'),common.time,'time'),'hourly-common:time',hint(state,current,'hourly-common:time'))+'</div>':mobileInput(state,current,current.service,'origin')+mobileInput(state,current,current.service,'time'))+'<p class="events-package-hourly-mobile__duration">'+esc(t('hourlyMobileDuration'))+'</p>'+(!multi?'<p class="events-package-hourly-mobile__end" data-hourly-single-end'+(validDate(values(current.service,state).date)&&validTime(values(current.service,state).time)?'':' hidden')+'>'+esc(t('hourlyMobileEnd'))+': <span data-hourly-mobile-end="'+esc(current.service.id)+'">'+esc(timeRange(current.service,state,true))+'</span></p>':'<p class="events-package-hourly-mobile__help">'+esc(t('hourlyAdjustDay'))+'</p>')+'</fieldset>'+(multi?'<ul class="events-package-hourly-mobile__days" data-hourly-days>'+mobileDays(state,current,locked)+'</ul>':'')+'</section>';
    }
    function refreshMobile(root,state,current){
      const singleEnd=root.querySelector('[data-hourly-single-end]');if(singleEnd){const v=values(current.service,state);singleEnd.hidden=!validDate(v.date)||!validTime(v.time);}
      const days=root.querySelector('[data-hourly-days]'),hasDates=!current.option.hourlyCalendar||validDate(values(current.service,state).date);
      if(days&&Boolean(days.children.length)!==hasDates){if(!hasDates)state.expandedServiceIds=[];days.innerHTML=mobileDays(state,current,window.PixkuyEventPackagesRequest.hasFrozenBody());}
      for(const service of current.services){
        const summary=root.querySelector('[data-hourly-summary="'+service.id+'"]');if(summary)summary.innerHTML=rowSummary(state,current,service);
        const date=values(service,state).date,edit=root.querySelector('[data-hourly-id="'+service.id+'"][data-package-action="hourly-edit"]');if(edit)edit.setAttribute('aria-label',t('hourlyEditDay',{date:dayDate(date,true)}));
        const finish=root.querySelector('[data-hourly-mobile-end="'+service.id+'"]');if(finish)finish.textContent=timeRange(service,state,true);
        for(const key of ['origin','time']){const input=root.querySelector('[data-package-field="service:'+service.id+':ordinary-'+key+'"]');if(!input)continue;const v=values(service,state),next=key==='origin'?v.origin?.address||'':v.time||'';if(input!==window.document.activeElement&&input.value!==next)input.value=next;
          if(key==='time'){const raw=ordinaryInput(service,state.selection.services.find(s=>s.serviceId===service.id)||{},'service:'+service.id+':','time');for(const attr of ['min','max']){const value=raw.match(new RegExp(' '+attr+'="([^"]*)"'))?.[1]||'';if(value&&input.getAttribute(attr)!==value)input.setAttribute(attr,value);else if(!value&&input.hasAttribute(attr))input.removeAttribute(attr);}}
        }
      }
      root.querySelectorAll('[data-hourly-hint]').forEach(node=>{const text=hint(state,current,node.getAttribute('data-hourly-hint'));node.textContent=text;node.hidden=!text;});
    }
    function resetDay(state,id){
      const current=configured(state),common=habits(state),service=current?.services.find(s=>s.id===id);if(!service)return;
      C.change(selection=>{let data=selection.services.find(s=>s.serviceId===id);if(!data){data={serviceId:id};selection.services.push(data);}data.ordinaryInputs=data.ordinaryInputs||{};for(const key of ['origin','time']){if(service.ordinary.inputs[key]?.source!=='customer')continue;common.exceptions.delete(id+':'+key);if(common[key])data.ordinaryInputs[key]=typeof common[key]==='object'?{...common[key]}:common[key];else delete data.ordinaryInputs[key];}},{silent:true,onlyWhenChanged:true});
    }
    function action(root,target,state){
      const name=target.getAttribute('data-package-action');if(!['hourly-edit','hourly-done','hourly-reset','hourly-fix'].includes(name))return false;
      if(!root.querySelector('[data-hourly-mobile]')&&!root.querySelector('[data-hourly-desktop]'))return false;
      const fieldName=name==='hourly-fix'?firstProblem(state):null,id=fieldName?.startsWith('service:')?fieldName.split(':')[1]:target.getAttribute('data-hourly-id');
      if(name==='hourly-reset')resetDay(state,id);
      state.expandedServiceIds=name==='hourly-done'?[]:id?[id]:[];C.notify();
      const selector=name==='hourly-done'?'[data-package-action="hourly-edit"][data-hourly-id="'+id+'"]':fieldName==='passengerBand'?'[data-package-band]':fieldName?'[data-package-field="'+fieldName+'"]':'[data-package-field="service:'+id+':ordinary-origin"]';
      const input=root.querySelector(selector);input?.focus({preventScroll:true});input?.scrollIntoView({block:'nearest'});return true;
    }
    function reviewStamp(value){
      const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return null;
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Mexico_City'}).formatToParts(date).map(part=>[part.type,part.value]));
      return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
    }
    function receipt(detail){
      // Historical receipt only. No selection, calendar, quote, duration policy
      // or pickup data is available here; never reconstruct those from the form.
      const services=detail?.services;
      if(!Array.isArray(services)||!services.length||!services.every(service=>service?.baseService==='hourly_daily'||!service?.baseService&&service?.kind==='block'))return null;
      const rows=services.map(service=>({service,start:reviewStamp(service.startsAtUtc),finish:reviewStamp(service.endsAtUtc)}));
      const years=[...new Set(rows.flatMap(row=>[row.start?.date.slice(0,4),row.finish?.date.slice(0,4)]).filter(Boolean))].sort();
      const date=value=>!validDate(value)?esc(t('unknown')):years.length>1?'<time datetime="'+esc(value)+'"><span aria-hidden="true">'+esc(dayDate(value,false)+' '+value.slice(0,4))+'</span><span class="visually-hidden">'+esc(dayDate(value,true))+'</span></time>':dateText(value);
      const time=(value,stamp)=>stamp?'<time datetime="'+esc(value)+'"><span aria-hidden="true">'+esc(stamp.time)+'</span><span class="visually-hidden">'+esc(receiptServiceTime(value))+'</span></time>':esc(t('unknown'));
      return {years:years.join(' / '),table:'<table class="events-package-hourly-review__table"><thead><tr><th scope="col">'+esc(t('hourlyReviewDate'))+'</th><th scope="col">'+esc(t('hourlyMobileStart'))+'</th><th scope="col">'+esc(t('hourlyMobileEnd'))+'</th></tr></thead><tbody>'+rows.map(row=>'<tr><th scope="row">'+date(row.start?.date)+'</th><td>'+time(row.service.startsAtUtc,row.start)+'</td><td>'+time(row.service.endsAtUtc,row.finish)+(row.finish&&row.finish.date!==row.start?.date?'<span class="events-package-hourly-review__end-date">'+date(row.finish.date)+'</span>':'')+'</td></tr>').join('')+'</tbody></table>'};
    }
    function mobileReview(state,current){
      const recorded=state.quote?.calculation?.itinerary?.services||[],groups=new Map();
      const services=current.services.map(service=>{const item=recorded.find(row=>row.id===service.id),start=reviewStamp(item?.startsAtUtc),finish=reviewStamp(item?.endsAtUtc);return {service,item,start,finish,duration:Number.isFinite(item?.durationHours)&&item.durationHours>0?item.durationHours:start&&finish?(Date.parse(item.endsAtUtc)-Date.parse(item.startsAtUtc))/3600000:null};});
      const years=[...new Set(services.flatMap(row=>[row.start?.date.slice(0,4),row.finish?.date.slice(0,4)]).filter(Boolean))].sort(),crossYear=years.length>1;
      const date=value=>!validDate(value)?esc(t('unknown')):crossYear?'<time datetime="'+esc(value)+'"><span aria-hidden="true">'+esc(dayDate(value,false)+' '+value.slice(0,4))+'</span><span class="visually-hidden">'+esc(dayDate(value,true))+'</span></time>':dateText(value);
      const dates=values=>{const sorted=[...new Set(values)].sort(),runs=[];for(const value of sorted){const run=runs[runs.length-1];if(run&&validDate(value)&&offset(run[run.length-1],1)===value)run.push(value);else runs.push([value]);}return runs.map(run=>date(run[0])+(run.length>1?' – '+date(run[run.length-1]):'')).join('; ');};
      services.forEach(row=>{const origin=values(row.service,state).origin,key=origin?.placeId||row.service.id;if(!groups.has(key))groups.set(key,{address:origin?.address||origin||t('ordinaryFixed'),dates:[]});groups.get(key).dates.push(row.start?.date||'');});
      const pickups='<dl class="events-package-hourly-review__pickups">'+[...groups.values()].map(group=>'<div><dt>'+esc(t('hourlyPickup'))+(services.length===1?'':' · '+(groups.size===1?esc(t('hourlyReviewAllDays')):dates(group.dates)))+'</dt><dd>'+esc(group.address)+'</dd></div>').join('')+'</dl>';
      const durations=[...new Set(services.map(row=>row.duration))],commonDuration=durations.length===1&&durations[0]>0?durations[0]:null,hours=value=>new Intl.NumberFormat(locale(),{maximumFractionDigits:2}).format(value);
      const time=(value,stamp)=>stamp?'<time datetime="'+esc(value)+'"><span aria-hidden="true">'+esc(stamp.time)+'</span><span class="visually-hidden">'+esc(receiptServiceTime(value))+'</span></time>':esc(t('unknown'));
      const rows=services.map(row=>'<tr><th scope="row">'+date(row.start?.date)+(commonDuration||!row.duration?'':'<span class="events-package-hourly-review__end-date">'+esc(t('hourlyReviewHours',{hours:hours(row.duration)}))+'</span>')+'</th><td>'+time(row.item?.startsAtUtc,row.start)+'</td><td>'+time(row.item?.endsAtUtc,row.finish)+(row.finish&&row.finish.date!==row.start?.date?'<span class="events-package-hourly-review__end-date">'+date(row.finish.date)+'</span>':'')+'</td></tr>').join('');
      return '<section class="events-package-hourly-review events-package-hourly-review--mobile">'+pickups+'<p class="events-package-hourly-review__context">'+(years.length?'<span>'+esc(years.join(' / '))+'</span>':'')+'<span>'+esc(commonDuration?t('hourlyReviewDuration',{hours:hours(commonDuration)}):t('sharedLocalTime'))+'</span></p><table class="events-package-hourly-review__table"><thead><tr><th scope="col">'+esc(t('hourlyReviewDate'))+'</th><th scope="col">'+esc(t('hourlyMobileStart'))+'</th><th scope="col">'+esc(t('hourlyMobileEnd'))+'</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
    }
    function review(state,mobile){
      const current=view(state);if(!current)return null;
      const html=mobileReview(state,current);
      return mobile?html:html.replace('events-package-hourly-review--mobile','events-package-hourly-review--desktop');
    }
    return {configured,view,values,readiness,composition,render,review,receipt,refresh,changeHabit,markException,unchangedAddress,windowBounds,firstProblem,action};
  };
})(window);
