'use strict';
// Local Netlify Dev boundary. No upstream proxy, DB, provider SDK or secrets.
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const fixtures=require('../../scripts/airport-controlled-fixtures.cjs');
const mount='/.netlify/functions/airport-manual-acceptance';
const runs=new Map();
let canaryRequests=0;
const digest=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function response(statusCode,body,type='application/json',extra={}) {
  return {statusCode,headers:{'content-type':type+'; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra},body:typeof body==='string'?body:JSON.stringify(body)};
}
function root() {
  for(const candidate of [process.cwd(),path.resolve(__dirname,'../..')]) {
    if(fs.existsSync(path.join(candidate,'index.html')) && fs.existsSync(path.join(candidate,'scripts/airport-manual-browser.js')))return candidate;
  }
  throw new Error('LOCAL_PUBLIC_ROOT_UNAVAILABLE');
}
function policy(origin,context,child=false) {
  return "default-src 'none'; script-src 'unsafe-inline' "+origin+context+"/; style-src 'unsafe-inline' "+origin+"/assets/css/; img-src data: "+origin+"/assets/img/; font-src "+origin+"/assets/fonts/; connect-src "+origin+context+"/; frame-src "+origin+context+"/; form-action 'none'; object-src 'none'; worker-src 'none'; base-uri "+(child?origin:"'none'")+"; sandbox allow-scripts allow-same-origin allow-forms;";
}
function html(body,origin,context,child=false) {
  return response(200,body,'text/html',{'content-security-policy':policy(origin,context,child),'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','x-pixkuy-manual-boundary':'local-fixtures-only'});
}
function pageShell(context,scenario) {
  return '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Airport — aceptación local</title><style>body{margin:0;background:#101214;color:#fff;font:14px system-ui;height:100dvh;display:flex;flex-direction:column}header{padding:8px;flex-shrink:0}p{margin:4px 0}button,a{font:inherit;color:inherit;margin:4px;padding:8px;background:#25282b;border:1px solid #777}iframe{display:block;width:100%;height:0;min-height:0;flex:1;border:0}a{display:inline-block}</style></head><body><header><p><strong>PRUEBA LOCAL: sin operaciones reales. Retorno de pago simulado.</strong></p><p>Escenario: '+(scenario==='lost'?'respuesta perdida y recuperación':'recorrido normal')+'. Use datos ficticios.</p><button data-manual-reload>Recargar pantalla</button><a href="'+mount+'/start/normal">Nuevo recorrido normal</a><a href="'+mount+'/start/lost">Respuesta perdida</a><span data-manual-state></span></header><iframe title="Airport real con frontera simulada" sandbox="allow-scripts allow-same-origin allow-forms" src="'+context+'/app/index.html?service=airport_hotel&lang=es"></iframe><script src="'+context+'/browser.js?role=shell"></script></body></html>';
}
function guardedJavascript(source) {
  // Routing leaves only. The application preparation/state/storage code stays real.
  return "if(!window.PixkuyManualBoundary || !window.PixkuyManualBoundary.ready) throw new Error('MANUAL_PROTECTION_REQUIRED');\n"+source.replace(/window\.location\.(assign|replace)\s*\(/g,'window.PixkuyManualBoundary.$1(');
}
function appHtml(filename,origin,context,failBootstrap) {
  const allowed=['index.html','booking-checkout.html','booking-success.html','booking-cancelled.html'];
  if(!allowed.includes(filename))throw new Error('DOCUMENT_NOT_ALLOWED');
  let source=fs.readFileSync(path.join(root(),filename),'utf8');
  source=source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attrs,body)=>{
    if(/type=["']application\/(?:ld\+json|json)["']/i.test(attrs))return all;
    const src=attrs.match(/\bsrc=["']([^"']+)["']/i);
    if(src) {
      let file=src[1].split('?')[0];
      if(file.startsWith('https://unpkg.com/libphonenumber-js'))file='libphonenumber.js';
      if(!/^(?:assets\/js\/[a-zA-Z0-9_./-]+\.js|libphonenumber\.js)$/.test(file))return '';
      return '<script src="'+context+'/resource/'+file+'"></script>';
    }
    return '<script>'+guardedJavascript(body)+'</script>';
  });
  return source.replace(/<head([^>]*)>/i,'<head$1><base href="'+escape(origin+'/')+'"><script src="'+context+'/browser.js?role='+(failBootstrap?'disabled':'app')+'"></script>');
}
function publicResource(file,context) {
  if(file==='libphonenumber.js') {
    return response(200,guardedJavascript(fs.readFileSync(path.resolve(root(),'../../pixkuy_frontend/node_modules/libphonenumber-js/bundle/libphonenumber-max.js'),'utf8')),'application/javascript');
  }
  if(!/^assets\/(?:js|i18n)\/[a-zA-Z0-9_/-]+\.(?:js|json)$/.test(file) || file.split('/').some(part=>part==='..' || part==='.' ))return response(403,{code:'PUBLIC_RESOURCE_NOT_ALLOWED'});
  const absolute=path.resolve(root(),file);
  if(!absolute.startsWith(path.resolve(root(),'assets')+path.sep) || !fs.existsSync(absolute))return response(404,{code:'PUBLIC_RESOURCE_NOT_FOUND'});
  const source=fs.readFileSync(absolute,'utf8');
  return response(200,file.endsWith('.js')?guardedJavascript(source):source,file.endsWith('.js')?'application/javascript':'application/json');
}
function runState(id,scenario) {
  const now=Date.now();
  for(const [key,value] of runs)if(now-value.updated>2*60*60*1000)runs.delete(key);
  if(!runs.has(id)) {
    if(runs.size>=100)throw new Error('LOCAL_RUN_LIMIT');
    runs.set(id,{scenario,updated:now,prechecks:0,checkoutRequests:0,statusRequests:0,conflicts:0,attempt:null,state:'pending_payment',source:{},amount:null});
  }
  const value=runs.get(id);if(value.scenario!==scenario)throw new Error('SCENARIO_CONFLICT');value.updated=now;return value;
}
exports.handler=async event=>{
  try {
    const host=event.headers?.host || event.headers?.Host || '';
    if(process.env.NETLIFY_DEV!=='true' || !/^(?:192\.168\.0\.14|localhost|127\.0\.0\.1):8888$/.test(host))return response(403,{code:'LOCAL_NETLIFY_DEV_REQUIRED'});
    const origin='http://'+host;
    const url=new URL(event.rawUrl || event.path,origin);
    const route=url.pathname.slice(mount.length);
    if(!url.pathname.startsWith(mount+'/') && url.pathname!==mount)return response(403,{code:'BOUNDARY_PATH_REQUIRED'});
    if(route==='/canary') {canaryRequests++;return response(200,{localCanary:true});}
    if((!route || route==='/') && event.httpMethod==='GET')return response(302,'','text/plain',{location:mount+'/start/normal'});
    const start=route.match(/^\/start\/(normal|lost)$/);
    if(start && event.httpMethod==='GET')return response(302,'','text/plain',{location:mount+'/run/'+randomBytes(16).toString('hex')+'/'+start[1]+'/'});
    const match=route.match(/^\/run\/([a-f0-9]{32})\/(normal|lost)(\/.*)$/);
    if(!match)return response(403,{code:'MANUAL_ROUTE_NOT_ALLOWED'});
    const [,id,scenario,tail]=match,context=mount+'/run/'+id+'/'+scenario;
    const state=runState(id,scenario);
    const model={modelId:'00000000-0000-4000-8000-000000000001',modelRevision:1,name:'BYD M9',photoUrl:origin+'/assets/img/fleet/bydm9_xhoras001d.jpeg',passengersSupported:2};
    const token='synthetic-'+id;
    if(event.httpMethod==='GET') {
      if(tail==='/')return html(pageShell(context,scenario),origin,context);
      if(tail==='/browser.js')return response(200,url.searchParams.get('role')==='disabled'?'/* Bootstrap deliberately disabled for the safety regression. */':fs.readFileSync(path.join(root(),'scripts/airport-manual-browser.js'),'utf8'),'application/javascript');
      if(tail.startsWith('/resource/'))return publicResource(tail.slice('/resource/'.length),context);
      if(tail==='/control/summary')return response(200,{scenario,prechecks:state.prechecks,checkoutRequests:state.checkoutRequests,statusRequests:state.statusRequests,uniqueAttempts:state.attempt?1:0,attemptRequests:state.attempt?.requests || 0,identityAndContentPreserved:state.attempt?state.conflicts===0:null,conflicts:state.conflicts,canaryRequests,realBusinessWrites:0});
      if(tail==='/app/provider.html')return html('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago simulado</title><body><p><strong>FRONTERA SIMULADA: no se ha contactado con Stripe ni creado una sesión.</strong></p><p>El checkout sintético llegó aquí. Seleccione un retorno simulado.</p><a href="'+context+'/return/confirmed">Simular retorno confirmado</a><p><a href="'+context+'/return/pending_payment">Simular retorno pendiente</a></p></body></html>',origin,context,true);
      const returned=tail.match(/^\/return\/(confirmed|pending_payment)$/);
      if(returned) {if(!state.attempt)return response(409,{code:'SYNTHETIC_ATTEMPT_REQUIRED'});state.state=returned[1];return response(302,'','text/plain',{location:context+'/app/'+(state.state==='confirmed'?'booking-success.html':'booking-cancelled.html')+'?token='+token});}
      if(tail.startsWith('/app/'))return html(appHtml(tail.slice(5),origin,context,url.searchParams.get('bootstrap')==='disabled'),origin,context,true);
      if(tail==='/api/.netlify/functions/booking-public-config' || tail==='/api/v1/public/runtime-config')return response(200,{ok:true,bookingApi:{apiBaseUrl:origin+context+'/api'},publicSite:{siteKey:'local_manual_fixture'},recaptchaEnterprise:{siteKey:''}});
      if(tail==='/api/v1/public/reservations/status') {
        if(url.searchParams.get('token')!==token || !state.attempt)return response(404,{code:'SYNTHETIC_STATUS_NOT_FOUND'});
        state.statusRequests++;
        return response(200,fixtures.status({source:state.source,selected:model,amount:state.amount,service:'airport_transfer',state:state.state,canModify:false,canRetry:false}));
      }
      return response(403,{code:'GET_NOT_ALLOWED'});
    }
    if(event.httpMethod!=='POST' || event.isBase64Encoded || (event.body || '').length>32768)return response(403,{code:'METHOD_OR_BODY_NOT_ALLOWED'});
    const body=JSON.parse(event.body || '{}');
    if(tail==='/api/v1/public/reservations/airport-transfer-availability-precheck') {
      if(!Number.isSafeInteger(body.expectedAmountMinor) || body.expectedAmountMinor<=0)return response(400,{code:'SYNTHETIC_AMOUNT_REQUIRED'});
      state.prechecks++;
      return response(200,fixtures.precheck(body,{models:[{...model,passengersSupported:body.passengers || 2}],requestNumber:state.prechecks,available:true}));
    }
    if(tail==='/api/v1/public/reservations/checkout') {
      const key=event.headers['idempotency-key'];
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key || '') || !Number.isSafeInteger(body.airport_transfer_price) || body.airport_transfer_price<=0)return response(400,{code:'REAL_PREPARATION_REQUIRED'});
      const identity=digest(key),content=digest(event.body);
      if(state.attempt && (state.attempt.identity!==identity || state.attempt.content!==content)){state.conflicts++;return response(409,{code:'SYNTHETIC_ATTEMPT_CONFLICT'});}
      if(!state.attempt) {
        state.attempt={identity,content,requests:0};state.amount=body.airport_transfer_price;
        state.source={airport_transfer_date:body.airport_transfer_date,airport_transfer_time:body.airport_transfer_time};
      }
      state.checkoutRequests++;state.attempt.requests++;
      if(scenario==='lost' && state.attempt.requests===1)return response(200,'');
      if(scenario==='lost' && state.attempt.requests===2)return response(503,{code:'CHECKOUT_STATE_UNCERTAIN',recovery:{state:'unknown',preserveData:true}});
      return response(200,fixtures.checkout(token,'https://checkout.stripe.com/c/pay/synthetic-integrated-only'));
    }
    return response(403,{code:'BUSINESS_OPERATION_BLOCKED'});
  } catch (_) {return response(400,{code:'LOCAL_SIMULATION_INVALID_REQUEST'});}
};
