/* Local manual boundary only. Never referenced by the normal application. */
(function (window,document) {
  'use strict';
  const match=location.pathname.match(/^(\/.netlify\/functions\/airport-manual-acceptance\/run\/([a-f0-9]{32})\/(normal|lost))(?:\/|$)/);
  if(!match || location.protocol!=='http:' || !['192.168.0.14','localhost','127.0.0.1'].includes(location.hostname) || location.port!=='8888')throw new Error('MANUAL_LOCAL_CONTEXT_REQUIRED');
  const context=match[1],prefix='pixkuy_manual:'+match[2]+':',origin=location.origin;
  const role=new URL(document.currentScript.src).searchParams.get('role');
  if(role==='shell') {
    const frame=document.querySelector('iframe');
    const saved=window.sessionStorage.getItem(prefix+'shell-route');
    if(saved && saved.startsWith(origin+context+'/app/'))frame.src=saved;
    const remember=()=>{
      try {
        const current=frame.contentWindow.location.href;
        if(current.startsWith(origin+context+'/app/'))window.sessionStorage.setItem(prefix+'shell-route',current);
      } catch (_) { /* CSP/sandbox blocks an unexpected destination. */ }
    };
    frame.addEventListener('load',remember);
    window.addEventListener('message',event=>{
      if(event.origin===origin && event.source===frame.contentWindow && event.data?.type==='manual-route')remember();
    });
    document.querySelector('[data-manual-reload]').addEventListener('click',()=>frame.contentWindow.location.reload());
    return;
  }
  if(role!=='app')throw new Error('MANUAL_PROTECTION_REQUIRED');
  function scopedStorage(native) {
    const indexKey=prefix+'__index';
    const ownKeys=()=>{
      const keys=JSON.parse(native.getItem(indexKey) || '[]');
      if(!Array.isArray(keys) || keys.some(key=>typeof key!=='string' || key==='__index'))throw new Error('MANUAL_STORAGE_INDEX_INVALID');
      return keys;
    };
    const updateIndex=keys=>native.setItem(indexKey,JSON.stringify(keys));
    const api={
      getItem:key=>native.getItem(prefix+String(key)),
      setItem:(key,value)=>{key=String(key);if(key==='__index')throw new Error('MANUAL_STORAGE_RESERVED_KEY');const keys=ownKeys();native.setItem(prefix+key,String(value));if(!keys.includes(key))updateIndex([...keys,key]);},
      removeItem:key=>{key=String(key);if(key==='__index')throw new Error('MANUAL_STORAGE_RESERVED_KEY');native.removeItem(prefix+key);updateIndex(ownKeys().filter(value=>value!==key));},
      key:index=>ownKeys()[Number(index)] ?? null,
      clear:()=>{ownKeys().forEach(key=>native.removeItem(prefix+key));updateIndex([]);}
    };
    return new Proxy(native,{
      get:(_,key)=>key==='length'?ownKeys().length:Object.prototype.hasOwnProperty.call(api,key)?api[key]:key==='constructor'?Storage:typeof key==='string'?api.getItem(key):undefined,
      set:(_,key,value)=>{api.setItem(key,value);return true;},
      deleteProperty:(_,key)=>{api.removeItem(key);return true;},
      ownKeys,
      getOwnPropertyDescriptor:(_,key)=>ownKeys().includes(key)?{configurable:true,enumerable:true,writable:true,value:api.getItem(key)}:undefined
    });
  }
  // Forward to the real browser Storage API. No fake persistence or native clear.
  const scopedSession=scopedStorage(window.sessionStorage),scopedLocal=scopedStorage(window.localStorage);
  Object.defineProperty(window,'sessionStorage',{value:scopedSession,configurable:false});
  Object.defineProperty(window,'localStorage',{value:scopedLocal,configurable:false});
  function mapped(value,method='GET') {
    const url=new URL(value,document.baseURI);
    if(url.origin===origin && url.pathname.startsWith(context+'/api/'))return url.href;
    if(url.origin===origin && url.pathname.startsWith(context+'/resource/') && ['GET','HEAD'].includes(method))return url.href;
    const paths=['/.netlify/functions/booking-public-config','/v1/public/runtime-config','/v1/public/reservations/airport-transfer-availability-precheck','/v1/public/reservations/checkout','/v1/public/reservations/status'];
    if(paths.includes(url.pathname))return origin+context+'/api'+url.pathname+url.search;
    if(['GET','HEAD'].includes(method) && /^\/assets\/(js|i18n)\/[a-zA-Z0-9_./-]+\.(js|json)$/.test(url.pathname))return origin+context+'/resource'+url.pathname+url.search;
    throw new Error('MANUAL_NETWORK_BLOCKED');
  }
  const realFetch=window.fetch.bind(window);
  window.fetch=function(input,init) {
    try {
      const method=String(init?.method || (input instanceof Request?input.method:'GET')).toUpperCase();
      const request=new Request(mapped(input instanceof Request?input.url:input,method),input instanceof Request?input:init);
      return realFetch(new Request(request,{credentials:'omit'}));
    } catch (_) {return Promise.reject(new Error('MANUAL_NETWORK_BLOCKED'));}
  };
  const realOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...rest){return realOpen.call(this,method,mapped(url,String(method).toUpperCase()),...rest);};
  navigator.sendBeacon=()=>false;
  window.open=()=>null;
  for(const capability of ['WebSocket','EventSource','Worker','SharedWorker'])window[capability]=function(){throw new Error('MANUAL_NETWORK_BLOCKED');};
  function mounted(url) {
    if(url.origin!==origin)throw new Error('MANUAL_NAVIGATION_BLOCKED');
    if(url.pathname.startsWith(context+'/app/') || url.pathname.startsWith(context+'/return/'))return url.href;
    const page=url.pathname==='/' || url.pathname==='/index.html'?'index.html':url.pathname.slice(1);
    if(!['index.html','booking-checkout.html','booking-success.html','booking-cancelled.html'].includes(page))throw new Error('MANUAL_NAVIGATION_BLOCKED');
    if(page==='index.html' && !url.searchParams.has('service'))url.searchParams.set('service','airport_hotel');
    return origin+context+'/app/'+page+url.search+url.hash;
  }
  for(const method of ['pushState','replaceState']) {
    const real=window.history[method].bind(window.history);
    window.history[method]=function(state,title,url){return real(state,title,url==null?url:mounted(new URL(url,location.href)));};
  }
  function navigate(value,replace=false) {
    const url=new URL(value,document.baseURI);
    const target=url.origin==='https://checkout.stripe.com' && url.pathname==='/c/pay/synthetic-integrated-only' && !url.search?origin+context+'/app/provider.html':mounted(url);
    window.location[replace?'replace':'assign'](target);
  }
  Object.defineProperty(window,'PixkuyManualBoundary',{value:Object.freeze({ready:true,context,assign:value=>navigate(value),replace:value=>navigate(value,true)}),writable:false,configurable:false});
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');if(!anchor)return;
    const raw=anchor.getAttribute('href');
    if(raw?.startsWith('#'))return;
    const url=new URL(raw,document.baseURI);
    if(url.origin===origin && (url.pathname.startsWith(context+'/app/') || url.pathname.startsWith(context+'/return/')))return;
    event.preventDefault();
    if(url.origin===origin && ['/', '/index.html','/booking-success.html','/booking-cancelled.html'].includes(url.pathname))navigate(url.href);
  },true);
  const notify=()=>window.parent.postMessage({type:'manual-route'},origin);
  window.addEventListener('hashchange',notify);window.addEventListener('load',notify);
  window.addEventListener('load',()=>{
    if(!location.pathname.endsWith('/index.html') || sessionStorage.getItem('__manual-seeded')==='1' || !window.PixkuyAirportZoneTariff)return;
    const address='Hotel MX Condesa — Salamanca 35, Roma Norte, Ciudad de México';
    window.PixkuyAirportZoneTariff.setAirportSelection({airportId:'mex',direction:'airport_to_hotel'});
    window.PixkuyAirportZoneTariff.setResolvedDestination({placeLabel:address,zoneId:'roma_condesa',placeId:'synthetic-place',primaryType:'lodging',lat:19.418,lng:-99.169});
    const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    for(const [selector,value] of [['#airport-tariff-date',date],['#airport-tariff-time','12:30']]) {
      const control=document.querySelector(selector);if(control){control.value=value;control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    const luggage=document.querySelector('[data-airport-mobile-luggage-select]');
    if(luggage){luggage.value='2';luggage.dispatchEvent(new Event('change',{bubbles:true}));}
    sessionStorage.setItem('__manual-seeded','1');
  });
})(window,document);
