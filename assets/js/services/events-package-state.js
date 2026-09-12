(function(window){
  "use strict";
  const listeners=new Set();let revision=0;let quoteSequence=0;
  const state={screen:"catalog",events:[],catalogStatus:"loading",selectedEvent:null,selection:null,contact:{name:"",phone:"",email:""},quote:null,quoteStatus:"idle",error:"",requestStatus:"idle",receipt:null,recoveryNotice:false,storageAvailable:true};
  const drafts=new Map();
  state.step='package';
  state.configurationSurface='upper';
  const notify=()=>listeners.forEach(fn=>fn(state));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const draftKey=(event,kind)=>event.id+':'+event.publicationVersion+':'+kind;
  function remember(){if(state.selectedEvent&&state.selection)drafts.set(draftKey(state.selectedEvent,state.selection.requestKind),{selection:clone(state.selection),contact:{...state.contact},step:state.step});}
  function go(step){
    if(!state.selection||['submitting','unknown','received'].includes(state.requestStatus)||window.PixkuyEventPackagesRequest?.hasFrozenBody())return false;
    if(step==='services'&&state.selection.requestKind==='package'&&!state.selection.optionId)return false;
    if(step==='review'&&state.quoteStatus!=='ready')return false;
    if(state.step==='services'&&step!=='services'&&state.quoteStatus==='loading'){quoteSequence++;state.quoteStatus='idle';state.quote=null;state.error='';}
    state.step=step;state.screen=step==='review'?'contact':'config';notify();return true;
  }
  function choose(packageId,optionId,confirmLoss){
    const selection=state.selection;
    if(selection?.requestKind!=='package'||['submitting','unknown','received'].includes(state.requestStatus))return false;
    const packages=state.selectedEvent.snapshot.packages.filter(p=>p.active!==false);
    const pkg=packages.find(p=>p.id===packageId);if(!pkg)return false;
    const options=pkg.options.filter(o=>o.active!==false);
    const next=options.find(o=>o.id===optionId)||(options.length===1?options[0]:null);
    const previous=packages.find(p=>p.id===selection.packageId)?.options.find(o=>o.id===selection.optionId);
    if(selection.packageId===packageId&&selection.optionId===(next?.id||''))return true;
    const compatible=new Set((next?.services||[]).filter(s=>previous&&(previous.calculationModel||'fixed')===(next.calculationModel||'fixed')&&JSON.stringify(previous.services.find(old=>old.id===s.id))===JSON.stringify(s)&&JSON.stringify(previous.coverage)===JSON.stringify(next.coverage)&&JSON.stringify(previous.baggagePolicy)===JSON.stringify(next.baggagePolicy)).map(s=>s.id));
    if(selection.services.some(s=>!compatible.has(s.serviceId))&&(!confirmLoss||!confirmLoss()))return false;
    change(s=>{s.packageId=packageId;s.optionId=next?.id||'';s.services=s.services.filter(v=>compatible.has(v.serviceId));s.additionalServiceIds=s.additionalServiceIds.filter(id=>compatible.has(id));});
    return true;
  }
  function selectEvent(event,custom){
    if(state.requestStatus==='submitting'||state.requestStatus==='unknown'||state.receipt||window.PixkuyEventPackagesRequest?.hasFrozenBody())return false;
    if(custom&&event.snapshot?.customInquiryEnabled===false)return false;
    if(state.selectedEvent?.id===event.id&&state.selection?.publicationVersion===event.publicationVersion&&state.selection.requestKind===(custom?'custom':'package')){state.screen='config';notify();return true;}
    remember();revision++;quoteSequence++;state.selectedEvent=event;
    const saved=drafts.get(draftKey(event,custom?'custom':'package'));
    state.selection=saved?clone(saved.selection):custom?{requestKind:'custom',eventId:event.id,publicationVersion:event.publicationVersion,inquiry:{reasonCode:'other',passengers:{status:'pending',count:null},services:[],needsFlags:[],notes:''}}:{requestKind:'package',eventId:event.id,publicationVersion:event.publicationVersion,packageId:'',optionId:'',passengerBand:"",services:[],additionalServiceIds:[],pendingCodes:[]};
    state.contact=saved?{...saved.contact}:{name:'',phone:'',email:''};state.step=saved?.step==='services'?'services':custom?'services':'package';
    if(event.snapshot?.schemaVersion===3){state.selection.contractVersion=3;state.selection.airportReturnVersion=1;state.selection.directReturnVersion=1;}
    state.quote=null;state.quoteStatus='idle';state.error='';state.screen='config';notify();return true;
  }
  function change(fn,options){if(!state.selection||['submitting','unknown','received'].includes(state.requestStatus)||window.PixkuyEventPackagesRequest?.hasFrozenBody())return;fn(state.selection);revision++;quoteSequence++;state.quote=null;state.quoteStatus='idle';state.error='';if(state.step==='review'){state.step='services';state.screen='config';}if(!options?.silent)notify();}
  function suspendQuote(){if(state.quoteStatus==='loading'){quoteSequence++;state.quoteStatus='idle';state.quote=null;}notify();}
  async function quote(options){if(!state.selection||["submitting","unknown","received"].includes(state.requestStatus))return;const sequence=++quoteSequence;const captured=revision;state.quoteStatus="loading";state.error="";if(!options?.silent)notify();try{const result=await window.PixkuyEventPackagesApi.quote(JSON.parse(JSON.stringify(state.selection)));if(sequence!==quoteSequence||captured!==revision)return;if(result.source!=="published"||!/^[a-f0-9]{64}$/.test(result.quoteFingerprint))throw new Error("QUOTE_INVALID");state.quote=result;state.quoteStatus="ready";}catch(error){if(sequence!==quoteSequence)return;state.quoteStatus="error";state.error=error.message;}if(!options?.silent)notify();return true;}
  function received(receipt){if(state.selectedEvent&&state.selection)drafts.delete(draftKey(state.selectedEvent,state.selection.requestKind));quoteSequence++;state.receipt=receipt;state.requestStatus="received";state.screen="receipt";state.selection=null;state.contact={name:"",phone:"",email:""};state.quote=null;state.quoteStatus="idle";state.error="";state.recoveryNotice=false;notify();}
  // Suspension cancels only in-flight work; a valid completed quote remains reusable.

  window.PixkuyEventPackagesState={state,notify,suspendQuote,selectEvent,choose,go,change,quote,received,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},resetKnown:()=>{if(!state.receipt)return;state.receipt=null;state.selectedEvent=null;state.selection=null;state.requestStatus="idle";state.screen="catalog";state.step='package';state.recoveryNotice=false;notify();}};
})(window);
